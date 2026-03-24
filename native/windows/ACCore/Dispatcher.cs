using System.Diagnostics;
using System.Text.Json;
using System.Windows.Automation;

namespace ACCore;

public class Dispatcher
{
    private readonly Dictionary<string, Func<RPCRequest, object>> _methods = new();

    // Session state
    private string? _grabbedWindow;
    private string? _grabbedApp;
    private int? _grabbedPid;
    private string _lastSnapshotId = "";
    private SnapshotResult? _lastSnapshotData;
    private readonly Dictionary<string, object> _kvStore = new();
    private HaloOverlay? _haloOverlay;
    private readonly DateTime _startTime = DateTime.UtcNow;

    // Subsystems
    private readonly WindowManager _windowManager = new();
    private readonly AppManager _appManager = new();
    private readonly SnapshotBuilder _snapshotBuilder = new();
    private readonly MenuManager _menuManager = new();
    private readonly DialogManager _dialogManager = new();
    private readonly CaptureManager _captureManager = new();
    private readonly Clipboard _clipboard = new();
    private readonly FindHelper _findHelper = new();
    private readonly DiffHelper _diffHelper = new();

    public Dispatcher()
    {
        RegisterAllMethods();
    }

    public RPCResponse Dispatch(RPCRequest request)
    {
        if (!_methods.TryGetValue(request.Method, out var handler))
        {
            return RPCResponse.FromError(request.Id, ErrorCodes.MethodNotFound,
                $"Method not found: {request.Method}");
        }

        try
        {
            var result = handler(request);
            return RPCResponse.Success(request.Id, result);
        }
        catch (ACException ex)
        {
            return RPCResponse.FromError(request.Id, ex.Code, ex.Message, ex.Data);
        }
        catch (Exception ex)
        {
            return RPCResponse.FromError(request.Id, ErrorCodes.InvalidRequest,
                $"Internal error: {ex.Message}");
        }
    }

    private void RegisterAllMethods()
    {
        // Built-in
        _methods["ping"] = _ => new { pong = true };
        _methods["version"] = _ => new { version = "0.1.0" };
        _methods["shutdown"] = _ => { Environment.Exit(0); return new { ok = true }; };
        _methods["status"] = HandleStatus;
        _methods["permissions"] = _ => new { accessibility = true, screen_recording = true }; // No special perms needed on Windows

        // KV store
        _methods["kv_set"] = HandleKvSet;
        _methods["kv_get"] = HandleKvGet;

        // App management
        _methods["apps"] = HandleApps;
        _methods["launch"] = HandleLaunch;
        _methods["launch_cdp"] = HandleLaunchCDP;
        _methods["quit"] = HandleQuit;
        _methods["hide"] = HandleHide;
        _methods["unhide"] = HandleUnhide;
        _methods["switch"] = HandleSwitch;
        _methods["is_chromium"] = HandleIsChromium;
        _methods["cdp_port"] = HandleCdpPort;

        // Window management
        _methods["windows"] = HandleWindows;
        _methods["grab"] = HandleGrab;
        _methods["ungrab"] = HandleUngrab;
        _methods["minimize"] = HandleMinimize;
        _methods["maximize"] = HandleMaximize;
        _methods["fullscreen"] = HandleFullscreen;
        _methods["close"] = HandleClose;
        _methods["raise"] = HandleRaise;
        _methods["move"] = HandleMove;
        _methods["resize"] = HandleResize;
        _methods["bounds"] = HandleBounds;

        // Snapshot
        _methods["snapshot"] = HandleSnapshot;
        _methods["children"] = HandleChildren;

        // Actions
        _methods["click"] = HandleClick;
        _methods["hover"] = HandleHover;
        _methods["focus"] = HandleFocus;
        _methods["fill"] = HandleFill;
        _methods["type"] = HandleType;
        _methods["key"] = HandleKey;
        _methods["keydown"] = HandleKeyDown;
        _methods["keyup"] = HandleKeyUp;
        _methods["paste"] = HandlePaste;
        _methods["select"] = HandleSelect;
        _methods["check"] = HandleCheck;
        _methods["uncheck"] = HandleUncheck;
        _methods["set"] = HandleSetValue;

        // Scroll
        _methods["scroll"] = HandleScroll;
        _methods["scrollto"] = HandleScrollTo;

        // Drag
        _methods["drag"] = HandleDrag;

        // Mouse
        _methods["mouse"] = HandleMouse;

        // Find
        _methods["find"] = HandleFind;

        // Read & inspect
        _methods["read"] = HandleRead;
        _methods["title"] = HandleTitle;
        _methods["is"] = HandleIs;
        _methods["box"] = HandleBox;

        // Menu
        _methods["menu"] = HandleMenu;

        // Clipboard
        _methods["clipboard"] = HandleClipboard;

        // Screenshot & displays
        _methods["screenshot"] = HandleScreenshot;
        _methods["displays"] = _ => _captureManager.ListDisplays();

        // Dialog
        _methods["dialog"] = HandleDialog;
        _methods["alert"] = HandleAlert;

        // Wait
        _methods["wait"] = HandleWait;

        // Diff
        _methods["changed"] = HandleChanged;
        _methods["diff"] = HandleDiff;

        // Batch
        _methods["batch"] = HandleBatch;
    }

    // ---- Session ----

    private object HandleStatus(RPCRequest req)
    {
        return new
        {
            grabbed_window = _grabbedWindow,
            grabbed_app = _grabbedApp,
            grabbed_pid = _grabbedPid,
            last_snapshot_id = string.IsNullOrEmpty(_lastSnapshotId) ? null : _lastSnapshotId,
            daemon_pid = Process.GetCurrentProcess().Id,
            daemon_uptime_ms = (long)(DateTime.UtcNow - _startTime).TotalMilliseconds,
        };
    }

    private object HandleKvSet(RPCRequest req)
    {
        var key = req.GetString("key");
        if (string.IsNullOrEmpty(key))
            throw new ACException(ErrorCodes.InvalidParams, "Missing key");

        if (req.Params?.TryGetProperty("value", out var val) == true)
        {
            _kvStore[key] = val.Clone();
        }
        return new { ok = true };
    }

    private object HandleKvGet(RPCRequest req)
    {
        var key = req.GetString("key");
        if (_kvStore.TryGetValue(key, out var value))
            return new { value };
        return new { value = (object?)null };
    }

    // ---- Apps ----

    private object HandleApps(RPCRequest req)
    {
        var running = req.GetBool("running", false);
        var apps = _appManager.ListApps(running);
        return new { apps };
    }

    private object HandleLaunch(RPCRequest req)
    {
        var name = req.GetString("name");
        if (string.IsNullOrEmpty(name))
            throw new ACException(ErrorCodes.InvalidParams, "Missing app name");

        var wait = req.GetBool("wait", false);
        var background = req.GetBool("background", false);
        var proc = _appManager.Launch(name, wait, background);

        return new { ok = true, name, process_id = proc.Id };
    }

    private object HandleLaunchCDP(RPCRequest req)
    {
        var name = req.GetString("name");
        var port = req.GetInt("port");
        if (string.IsNullOrEmpty(name) || port == 0)
            throw new ACException(ErrorCodes.InvalidParams, "Missing name or port");

        var proc = _appManager.LaunchWithCDP(name, port);
        return new { ok = true, name, process_id = proc.Id, cdp_port = port };
    }

    private object HandleQuit(RPCRequest req)
    {
        var name = req.GetString("name");
        if (string.IsNullOrEmpty(name))
            throw new ACException(ErrorCodes.InvalidParams, "Missing app name");

        var force = req.GetBool("force", false);
        _appManager.Quit(name, force);
        return new { ok = true };
    }

    private object HandleHide(RPCRequest req)
    {
        // Windows doesn't have a direct "hide" concept like macOS
        var name = req.GetString("name", _grabbedApp ?? "");
        if (string.IsNullOrEmpty(name))
            throw new ACException(ErrorCodes.InvalidParams, "Missing app name");

        foreach (var win in _windowManager.ListWindows(name))
            _windowManager.Minimize(win.Ref);

        return new { ok = true };
    }

    private object HandleUnhide(RPCRequest req)
    {
        var name = req.GetString("name", _grabbedApp ?? "");
        if (string.IsNullOrEmpty(name))
            throw new ACException(ErrorCodes.InvalidParams, "Missing app name");

        foreach (var win in _windowManager.ListWindows(name))
            _windowManager.Raise(win.Ref);

        return new { ok = true };
    }

    private object HandleSwitch(RPCRequest req)
    {
        var name = req.GetString("name");
        if (string.IsNullOrEmpty(name))
            throw new ACException(ErrorCodes.InvalidParams, "Missing app name");

        var windows = _windowManager.ListWindows(name);
        if (windows.Count == 0)
            throw new ACException(ErrorCodes.AppNotFound, $"No windows found for app: {name}");

        _windowManager.Raise(windows[0].Ref);
        return new { ok = true };
    }

    private object HandleIsChromium(RPCRequest req)
    {
        var name = req.GetString("name");
        return new { is_chromium = _appManager.IsChromiumApp(name) };
    }

    private object HandleCdpPort(RPCRequest req)
    {
        var name = req.GetString("name");
        var port = _appManager.GetCDPPort(name);
        return new { port };
    }

    // ---- Windows ----

    private object HandleWindows(RPCRequest req)
    {
        var app = req.GetString("app");
        var windows = _windowManager.ListWindows(string.IsNullOrEmpty(app) ? null : app);
        return new { windows };
    }

    private object HandleGrab(RPCRequest req)
    {
        var windowRef = req.GetString("ref");
        var appName = req.GetString("app");

        WindowInfo? windowInfo = null;

        if (!string.IsNullOrEmpty(windowRef))
        {
            windowInfo = _windowManager.GetWindowInfo(windowRef);
        }
        else if (!string.IsNullOrEmpty(appName))
        {
            // Try matching by process name first
            var windows = _windowManager.ListWindows(appName);
            windowInfo = windows.FirstOrDefault();

            // Fallback: match by window title (handles UWP apps hosted in ApplicationFrameHost)
            if (windowInfo == null)
            {
                var allWindows = _windowManager.ListWindows();
                windowInfo = allWindows.FirstOrDefault(w =>
                    w.Title.Equals(appName, StringComparison.OrdinalIgnoreCase) ||
                    w.Title.StartsWith(appName + " ", StringComparison.OrdinalIgnoreCase) ||
                    w.Title.StartsWith(appName + " -", StringComparison.OrdinalIgnoreCase));
            }

            if (windowInfo != null)
                windowRef = windowInfo.Ref;
        }

        if (windowInfo == null || windowRef == null)
            throw new ACException(ErrorCodes.WindowNotFound, "Window not found for grab",
                new { available = _windowManager.ListWindows().Select(w => $"{w.Ref} {w.App}: {w.Title}").Take(10).ToArray() });

        _grabbedWindow = windowRef;
        _grabbedApp = windowInfo.App;
        _grabbedPid = windowInfo.ProcessId;

        // Raise the window
        _windowManager.Raise(windowRef);

        // Show overlay
        var handle = _windowManager.ResolveWindowHandle(windowRef);
        if (handle != null)
        {
            _haloOverlay?.Dispose();
            _haloOverlay = new HaloOverlay();
            _haloOverlay.Show(handle.Value);
        }

        return new { ok = true, window = windowInfo };
    }

    private object HandleUngrab(RPCRequest req)
    {
        _grabbedWindow = null;
        _grabbedApp = null;
        _grabbedPid = null;

        _haloOverlay?.Dispose();
        _haloOverlay = null;

        return new { ok = true };
    }

    private object HandleMinimize(RPCRequest req)
    {
        var windowRef = req.GetString("ref", _grabbedWindow ?? "");
        _windowManager.Minimize(windowRef);
        return new { ok = true };
    }

    private object HandleMaximize(RPCRequest req)
    {
        var windowRef = req.GetString("ref", _grabbedWindow ?? "");
        _windowManager.Maximize(windowRef);
        return new { ok = true };
    }

    private object HandleFullscreen(RPCRequest req)
    {
        var windowRef = req.GetString("ref", _grabbedWindow ?? "");
        _windowManager.Fullscreen(windowRef);
        return new { ok = true };
    }

    private object HandleClose(RPCRequest req)
    {
        var windowRef = req.GetString("ref", _grabbedWindow ?? "");
        _windowManager.Close(windowRef);
        return new { ok = true };
    }

    private object HandleRaise(RPCRequest req)
    {
        var windowRef = req.GetString("ref", _grabbedWindow ?? "");
        _windowManager.Raise(windowRef);
        return new { ok = true };
    }

    private object HandleMove(RPCRequest req)
    {
        var windowRef = req.GetString("ref", _grabbedWindow ?? "");
        var x = req.GetInt("x");
        var y = req.GetInt("y");
        _windowManager.Move(windowRef, x, y);
        return new { ok = true };
    }

    private object HandleResize(RPCRequest req)
    {
        var windowRef = req.GetString("ref", _grabbedWindow ?? "");
        var width = req.GetInt("width");
        var height = req.GetInt("height");
        _windowManager.Resize(windowRef, width, height);
        return new { ok = true };
    }

    private object HandleBounds(RPCRequest req)
    {
        var windowRef = req.GetString("ref", _grabbedWindow ?? "");
        var preset = req.GetString("preset");

        if (!string.IsNullOrEmpty(preset))
        {
            _windowManager.ApplyPreset(windowRef, preset);
            return new { ok = true };
        }

        var x = req.GetInt("x");
        var y = req.GetInt("y");
        var width = req.GetInt("width");
        var height = req.GetInt("height");
        _windowManager.SetBounds(windowRef, x, y, width, height);
        return new { ok = true };
    }

    // ---- Snapshot ----

    private object HandleSnapshot(RPCRequest req)
    {
        var windowRef = _grabbedWindow;
        var appName = req.GetString("app");
        var pid = req.GetInt("pid");

        AutomationElement? windowElement = null;
        WindowInfo? windowInfo = null;

        if (!string.IsNullOrEmpty(windowRef))
        {
            windowElement = _windowManager.GetWindowAutomationElement(windowRef);
            windowInfo = _windowManager.GetWindowInfo(windowRef);
        }
        else if (!string.IsNullOrEmpty(appName))
        {
            var windows = _windowManager.ListWindows(appName);
            if (windows.Count > 0)
            {
                windowInfo = windows[0];
                windowElement = _windowManager.GetWindowAutomationElement(windowInfo.Ref);
            }
        }
        else if (pid > 0)
        {
            var windows = _windowManager.ListWindows();
            windowInfo = windows.FirstOrDefault(w => w.ProcessId == pid);
            if (windowInfo != null)
                windowElement = _windowManager.GetWindowAutomationElement(windowInfo.Ref);
        }

        if (windowElement == null || windowInfo == null)
            throw new ACException(ErrorCodes.WindowNotFound, "No window to snapshot. Use 'grab' first or specify --app/--pid.");

        var interactive = req.GetBool("interactive", false);
        var depth = req.HasParam("depth") ? req.GetInt("depth") : (int?)null;
        var subtree = req.GetString("subtree");

        var snapshot = _snapshotBuilder.Build(windowElement, windowInfo, interactive, depth,
            string.IsNullOrEmpty(subtree) ? null : subtree);

        _lastSnapshotId = snapshot.SnapshotId;
        _lastSnapshotData = snapshot;
        _diffHelper.SetLastSnapshot(snapshot.Elements);

        return snapshot;
    }

    private object HandleChildren(RPCRequest req)
    {
        var refStr = req.GetString("ref");
        if (string.IsNullOrEmpty(refStr))
            throw new ACException(ErrorCodes.InvalidParams, "Missing ref");

        var readHelper = new ReadHelper(_snapshotBuilder.LastRefMap);
        return readHelper.Children(refStr);
    }

    // ---- Actions ----

    private Actions GetActions() => new(_snapshotBuilder.LastRefMap);

    private object HandleClick(RPCRequest req)
    {
        var actions = GetActions();
        var refStr = req.GetString("ref");
        var x = req.HasParam("x") ? req.GetInt("x") : (int?)null;
        var y = req.HasParam("y") ? req.GetInt("y") : (int?)null;
        var right = req.GetBool("right");
        var doubleClick = req.GetBool("double");
        var count = req.GetInt("count", 1);
        var modifiers = req.GetStringArray("modifiers");

        actions.Click(
            string.IsNullOrEmpty(refStr) ? null : refStr,
            x, y, right, doubleClick, count, modifiers);

        return new { ok = true };
    }

    private object HandleHover(RPCRequest req)
    {
        var actions = GetActions();
        var refStr = req.GetString("ref");
        var x = req.HasParam("x") ? req.GetInt("x") : (int?)null;
        var y = req.HasParam("y") ? req.GetInt("y") : (int?)null;

        actions.Hover(string.IsNullOrEmpty(refStr) ? null : refStr, x, y);
        return new { ok = true };
    }

    private object HandleFocus(RPCRequest req)
    {
        var refStr = req.GetString("ref");
        if (string.IsNullOrEmpty(refStr))
            throw new ACException(ErrorCodes.InvalidParams, "Missing ref");
        GetActions().Focus(refStr);
        return new { ok = true };
    }

    private object HandleFill(RPCRequest req)
    {
        var refStr = req.GetString("ref");
        var text = req.GetString("text");
        if (string.IsNullOrEmpty(refStr))
            throw new ACException(ErrorCodes.InvalidParams, "Missing ref");
        GetActions().Fill(refStr, text);
        return new { ok = true };
    }

    private object HandleType(RPCRequest req)
    {
        var text = req.GetString("text");
        var delay = req.GetInt("delay");
        GetActions().TypeText(text, delay);
        return new { ok = true };
    }

    private object HandleKey(RPCRequest req)
    {
        var combo = req.GetString("combo");
        var repeat = req.GetInt("repeat", 1);
        if (string.IsNullOrEmpty(combo))
            throw new ACException(ErrorCodes.InvalidParams, "Missing combo");
        GetActions().PressKey(combo, repeat);
        return new { ok = true };
    }

    private object HandleKeyDown(RPCRequest req)
    {
        var key = req.GetString("key");
        GetActions().KeyDown(key);
        return new { ok = true };
    }

    private object HandleKeyUp(RPCRequest req)
    {
        var key = req.GetString("key");
        GetActions().KeyUp(key);
        return new { ok = true };
    }

    private object HandlePaste(RPCRequest req)
    {
        var text = req.GetString("text");
        GetActions().Paste(text, _clipboard);
        return new { ok = true };
    }

    private object HandleSelect(RPCRequest req)
    {
        var refStr = req.GetString("ref");
        var value = req.GetString("value");
        GetActions().Select(refStr, value);
        return new { ok = true };
    }

    private object HandleCheck(RPCRequest req)
    {
        var refStr = req.GetString("ref");
        GetActions().Check(refStr);
        return new { ok = true };
    }

    private object HandleUncheck(RPCRequest req)
    {
        var refStr = req.GetString("ref");
        GetActions().Uncheck(refStr);
        return new { ok = true };
    }

    private object HandleSetValue(RPCRequest req)
    {
        var refStr = req.GetString("ref");
        var value = req.GetString("value");
        GetActions().SetValue(refStr, value);
        return new { ok = true };
    }

    // ---- Scroll ----

    private object HandleScroll(RPCRequest req)
    {
        var direction = req.GetString("direction");
        var amount = req.GetInt("amount", 3);
        var onRef = req.GetString("on");
        var smooth = req.GetBool("smooth");
        var pixels = req.HasParam("pixels") ? req.GetInt("pixels") : (int?)null;

        GetActions().Scroll(direction, amount, string.IsNullOrEmpty(onRef) ? null : onRef, smooth, pixels);
        return new { ok = true };
    }

    private object HandleScrollTo(RPCRequest req)
    {
        var refStr = req.GetString("ref");
        GetActions().ScrollTo(refStr);
        return new { ok = true };
    }

    // ---- Drag ----

    private object HandleDrag(RPCRequest req)
    {
        var actions = GetActions();
        var fromRef = req.GetString("from_ref");
        var toRef = req.GetString("to_ref");
        var fromX = req.HasParam("from_x") ? req.GetInt("from_x") : (int?)null;
        var fromY = req.HasParam("from_y") ? req.GetInt("from_y") : (int?)null;
        var toX = req.HasParam("to_x") ? req.GetInt("to_x") : (int?)null;
        var toY = req.HasParam("to_y") ? req.GetInt("to_y") : (int?)null;
        var duration = req.GetInt("duration", 500);
        var steps = req.GetInt("steps", 20);
        var modifiers = req.GetStringArray("modifiers");

        if (!string.IsNullOrEmpty(fromRef) && !string.IsNullOrEmpty(toRef))
        {
            actions.DragByRef(fromRef, toRef, duration, steps, modifiers);
        }
        else if (fromX.HasValue && fromY.HasValue && toX.HasValue && toY.HasValue)
        {
            actions.Drag(fromX.Value, fromY.Value, toX.Value, toY.Value, duration, steps, modifiers);
        }
        else
        {
            throw new ACException(ErrorCodes.InvalidParams, "Drag requires from/to refs or coordinates");
        }

        return new { ok = true };
    }

    // ---- Mouse ----

    private object HandleMouse(RPCRequest req)
    {
        var action = req.GetString("action");
        var button = req.GetString("button", "left");
        GetActions().MouseButton(action, button);
        return new { ok = true };
    }

    // ---- Find ----

    private object HandleFind(RPCRequest req)
    {
        if (_lastSnapshotData == null)
            throw new ACException(ErrorCodes.InvalidRequest, "No snapshot available. Take a snapshot first.");

        var text = req.GetString("text");
        var role = req.GetString("role");
        var first = req.GetBool("first");

        return _findHelper.Find(_lastSnapshotData.Elements,
            string.IsNullOrEmpty(text) ? null : text,
            string.IsNullOrEmpty(role) ? null : role,
            first);
    }

    // ---- Read & Inspect ----

    private object HandleRead(RPCRequest req)
    {
        var refStr = req.GetString("ref");
        var attr = req.GetString("attr");
        var readHelper = new ReadHelper(_snapshotBuilder.LastRefMap);
        return readHelper.Read(refStr, string.IsNullOrEmpty(attr) ? null : attr);
    }

    private object HandleTitle(RPCRequest req)
    {
        var appMode = req.GetBool("app");
        var readHelper = new ReadHelper(_snapshotBuilder.LastRefMap);
        return readHelper.Title(appMode, _grabbedWindow, _windowManager);
    }

    private object HandleIs(RPCRequest req)
    {
        var state = req.GetString("state");
        var refStr = req.GetString("ref");
        var readHelper = new ReadHelper(_snapshotBuilder.LastRefMap);
        return readHelper.IsState(state, refStr);
    }

    private object HandleBox(RPCRequest req)
    {
        var refStr = req.GetString("ref");
        var readHelper = new ReadHelper(_snapshotBuilder.LastRefMap);
        return readHelper.Box(refStr);
    }

    // ---- Menu ----

    private object HandleMenu(RPCRequest req)
    {
        var path = req.GetString("path");
        var list = req.GetBool("list");
        var menuName = req.GetString("name");

        AutomationElement? appElement = null;
        if (_grabbedWindow != null)
            appElement = _windowManager.GetWindowAutomationElement(_grabbedWindow);

        if (appElement == null)
            throw new ACException(ErrorCodes.WindowNotFound, "No window grabbed for menu access");

        if (list)
            return _menuManager.ListMenus(appElement, string.IsNullOrEmpty(menuName) ? null : menuName);

        if (string.IsNullOrEmpty(path))
            throw new ACException(ErrorCodes.InvalidParams, "Missing menu path");

        return _menuManager.NavigateMenu(appElement, path);
    }

    // ---- Clipboard ----

    private object HandleClipboard(RPCRequest req)
    {
        var setText = req.GetString("text");
        var action = req.GetString("action");

        if (!string.IsNullOrEmpty(setText))
        {
            _clipboard.Set(setText);
            return new { ok = true };
        }

        if (action == "copy")
        {
            GetActions().PressKey("ctrl+c");
            Thread.Sleep(100);
            return new { ok = true, text = _clipboard.Read() };
        }

        if (action == "paste")
        {
            GetActions().PressKey("ctrl+v");
            return new { ok = true };
        }

        // Read
        return new { text = _clipboard.Read() };
    }

    // ---- Screenshot ----

    private object HandleScreenshot(RPCRequest req)
    {
        var path = req.GetString("path");
        var screen = req.GetBool("screen");
        var format = req.GetString("format", "png");
        var quality = req.GetInt("quality", 90);

        IntPtr? windowHandle = null;
        if (!screen && _grabbedWindow != null)
        {
            windowHandle = _windowManager.ResolveWindowHandle(_grabbedWindow);
        }

        return _captureManager.CaptureWindow(
            screen ? null : windowHandle,
            string.IsNullOrEmpty(path) ? null : path,
            format, quality);
    }

    // ---- Dialog ----

    private object HandleDialog(RPCRequest req)
    {
        if (_grabbedWindow == null)
            throw new ACException(ErrorCodes.WindowNotFound, "No window grabbed");

        var windowElement = _windowManager.GetWindowAutomationElement(_grabbedWindow)
            ?? throw new ACException(ErrorCodes.WindowNotFound, "Window not found");

        var filePath = req.GetString("file");
        var buttonLabel = req.GetString("button");

        if (!string.IsNullOrEmpty(filePath))
        {
            // File dialog: fill path
            var dialog = windowElement;
            var actions = GetActions();
            // Find text field in dialog, fill it
            actions.PressKey("ctrl+l"); // Go to address bar / path input
            Thread.Sleep(100);
            actions.TypeText(filePath);
            Thread.Sleep(100);
            actions.PressKey("enter");
            return new { ok = true };
        }

        if (!string.IsNullOrEmpty(buttonLabel))
        {
            return _dialogManager.AcceptDialog(windowElement, buttonLabel);
        }

        return _dialogManager.DetectDialog(windowElement);
    }

    private object HandleAlert(RPCRequest req)
    {
        if (_grabbedWindow == null)
            throw new ACException(ErrorCodes.WindowNotFound, "No window grabbed");

        var windowElement = _windowManager.GetWindowAutomationElement(_grabbedWindow)
            ?? throw new ACException(ErrorCodes.WindowNotFound, "Window not found");

        var accept = req.GetBool("accept");
        var dismiss = req.GetBool("dismiss");
        var text = req.GetString("text");

        if (accept)
            return _dialogManager.AcceptDialog(windowElement, string.IsNullOrEmpty(text) ? null : text);
        if (dismiss)
            return _dialogManager.DismissDialog(windowElement);

        return _dialogManager.DetectDialog(windowElement);
    }

    // ---- Wait ----

    private object HandleWait(RPCRequest req)
    {
        var waitHelper = new WaitHelper(_snapshotBuilder.LastRefMap, _windowManager);
        var timeout = req.GetInt("timeout", 10000);

        var refStr = req.GetString("ref");
        var ms = req.GetInt("ms");
        var text = req.GetString("text");
        var appName = req.GetString("app");
        var windowTitle = req.GetString("window");

        if (ms > 0)
            return waitHelper.WaitMs(ms);

        if (!string.IsNullOrEmpty(refStr))
        {
            var hidden = req.GetBool("hidden");
            var enabled = req.GetBool("enabled");
            return waitHelper.WaitForElement(refStr, hidden, enabled, timeout);
        }

        if (!string.IsNullOrEmpty(text))
        {
            var gone = req.GetBool("gone");
            AutomationElement? windowElement = null;
            WindowInfo? windowInfo = null;
            if (_grabbedWindow != null)
            {
                windowElement = _windowManager.GetWindowAutomationElement(_grabbedWindow);
                windowInfo = _windowManager.GetWindowInfo(_grabbedWindow);
            }
            return waitHelper.WaitForText(text, gone, _snapshotBuilder, windowElement, windowInfo, timeout);
        }

        if (!string.IsNullOrEmpty(appName))
            return waitHelper.WaitForApp(appName, timeout);

        if (!string.IsNullOrEmpty(windowTitle))
            return waitHelper.WaitForWindow(windowTitle, timeout);

        throw new ACException(ErrorCodes.InvalidParams, "Wait requires a ref, text, app, window, or ms parameter");
    }

    // ---- Diff ----

    private object HandleChanged(RPCRequest req)
    {
        if (_lastSnapshotData == null)
            throw new ACException(ErrorCodes.InvalidRequest, "No snapshot available");

        // Take new snapshot to compare
        if (_grabbedWindow != null)
        {
            var windowElement = _windowManager.GetWindowAutomationElement(_grabbedWindow);
            var windowInfo = _windowManager.GetWindowInfo(_grabbedWindow);
            if (windowElement != null && windowInfo != null)
            {
                var snapshot = _snapshotBuilder.Build(windowElement, windowInfo);
                return _diffHelper.Changed(snapshot.Elements);
            }
        }

        return new { changed = false, added_count = 0, removed_count = 0 };
    }

    private object HandleDiff(RPCRequest req)
    {
        if (_lastSnapshotData == null)
            throw new ACException(ErrorCodes.InvalidRequest, "No snapshot available");

        if (_grabbedWindow != null)
        {
            var windowElement = _windowManager.GetWindowAutomationElement(_grabbedWindow);
            var windowInfo = _windowManager.GetWindowInfo(_grabbedWindow);
            if (windowElement != null && windowInfo != null)
            {
                var snapshot = _snapshotBuilder.Build(windowElement, windowInfo);
                return _diffHelper.Diff(snapshot.Elements);
            }
        }

        return new { added = Array.Empty<object>(), removed = Array.Empty<object>() };
    }

    // ---- Batch ----

    private object HandleBatch(RPCRequest req)
    {
        var stopOnError = req.GetBool("stop_on_error", true);

        if (req.Params == null || !req.Params.Value.TryGetProperty("commands", out var commandsEl))
            throw new ACException(ErrorCodes.InvalidParams, "Missing commands array");

        if (commandsEl.ValueKind != JsonValueKind.Array)
            throw new ACException(ErrorCodes.InvalidParams, "commands must be an array");

        var results = new List<object>();
        int total = 0;

        foreach (var cmdEl in commandsEl.EnumerateArray())
        {
            total++;
            if (cmdEl.ValueKind != JsonValueKind.Array) continue;
            var arr = cmdEl.EnumerateArray().ToArray();
            if (arr.Length == 0) continue;

            var method = arr[0].GetString() ?? "";
            JsonElement? cmdParams = arr.Length > 1 ? arr[1] : null;

            var subRequest = new RPCRequest
            {
                Id = req.Id,
                Method = method,
                Params = cmdParams,
            };

            var response = Dispatch(subRequest);

            if (response.Error != null)
            {
                results.Add(new { index = total - 1, method, error = response.Error.Message, code = response.Error.Code });
                if (stopOnError) break;
            }
            else
            {
                results.Add(new { index = total - 1, method, result = response.Result });
            }
        }

        return new { ok = true, results, count = results.Count, total };
    }
}
