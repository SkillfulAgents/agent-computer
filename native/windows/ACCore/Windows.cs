using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json.Serialization;
using ACCore.Uia;

namespace ACCore;

public class WindowInfo
{
    public string Ref { get; set; } = "";
    public string Title { get; set; } = "";
    /// <summary>App name as the user knows it ("Calculator", "Settings", "chrome"); see PackagedApps.</summary>
    public string App { get; set; } = "";
    /// <summary>Pid of the app itself — for UWP apps the CoreWindow's process, not ApplicationFrameHost.</summary>
    public int ProcessId { get; set; }
    /// <summary>Raw process name ("CalculatorApp"); accepted anywhere an app name is, but not part of the wire format.</summary>
    [JsonIgnore]
    public string ProcessName { get; set; } = "";
    public int[] Bounds { get; set; } = [0, 0, 0, 0]; // [x, y, w, h]
    public bool Minimized { get; set; }
    public bool Hidden { get; set; }
    public bool Fullscreen { get; set; }
}

public class WindowManager
{
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, char[] lpString, int nMaxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsZoomed(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool MoveWindow(IntPtr hWnd, int x, int y, int nWidth, int nHeight, bool bRepaint);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern IntPtr GetShellWindow();

    [DllImport("user32.dll")]
    private static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr hWnd, int dwAttribute, out int pvAttribute, int cbAttribute);

    private const int DWMWA_CLOAKED = 14;
    private const string CoreWindowClass = "Windows.UI.Core.CoreWindow";
    private const string FrameHostProcess = "ApplicationFrameHost";

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, char[] lpClassName, int nMaxCount);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT
    {
        public int Left, Top, Right, Bottom;
    }

    private const int SW_MINIMIZE = 6;
    private const int SW_MAXIMIZE = 3;
    private const int SW_RESTORE = 9;
    private const int SW_SHOW = 5;
    private const int SW_HIDE = 0;
    private const int GWL_STYLE = -16;
    private const int GWL_EXSTYLE = -20;
    private const int WS_MAXIMIZE = 0x01000000;
    private const int WS_EX_TOOLWINDOW = 0x00000080;
    private const int WS_EX_APPWINDOW = 0x00040000;
    private const uint WM_CLOSE = 0x0010;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOZORDER = 0x0004;
    private const uint SWP_SHOWWINDOW = 0x0040;

    // hwnd → ref mapping for the current session
    private readonly Dictionary<IntPtr, string> _handleToRef = new();
    private readonly Dictionary<string, IntPtr> _refToHandle = new();
    private int _windowCounter;

    public List<WindowInfo> ListWindows(string? appFilter = null)
    {
        var windows = new List<WindowInfo>();
        var shellWindow = GetShellWindow();
        // Top-level CoreWindows of UWP apps that are NOT currently parented into
        // their ApplicationFrameHost frame (inactive apps). Computed on demand,
        // once per listing, to pair frame windows with their app process.
        var looseCoreWindows = new Lazy<List<(string title, uint pid)>>(ListLooseCoreWindows);

        EnumWindows((hWnd, _) =>
        {
            if (hWnd == shellWindow) return true;
            if (!IsWindowVisible(hWnd) && !IsIconic(hWnd)) return true;

            // Skip tool windows unless they have APPWINDOW style
            int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
            if ((exStyle & WS_EX_TOOLWINDOW) != 0 && (exStyle & WS_EX_APPWINDOW) == 0)
                return true;

            int titleLen = GetWindowTextLength(hWnd);
            if (titleLen == 0) return true;

            var titleBuf = new char[titleLen + 1];
            GetWindowText(hWnd, titleBuf, titleBuf.Length);
            var title = new string(titleBuf, 0, titleLen);

            GetWindowThreadProcessId(hWnd, out uint pid);
            bool minimized = IsIconic(hWnd);

            // DWM-cloaked windows are not on screen: the loose CoreWindow twin
            // of every UWP frame ("Settings" showing up twice), the input-
            // experience host, and frames of suspended apps. Minimized
            // windows are cloaked too, and those the user does expect to see.
            if (!minimized && IsCloaked(hWnd)) return true;

            // UWP apps run inside ApplicationFrameHost; the app itself owns a
            // CoreWindow. Report the app, not its host.
            int appPid = (int)pid;
            var (processName, started) = ProcessIdentity(appPid);
            if (processName.Equals(FrameHostProcess, StringComparison.OrdinalIgnoreCase))
            {
                var corePid = FindHostedAppPid(hWnd, title, looseCoreWindows);
                if (corePid != 0)
                {
                    appPid = corePid;
                    (processName, started) = ProcessIdentity(appPid);
                }
            }

            string appName = PackagedApps.FriendlyName(appPid, started) ?? processName;

            if (appFilter != null
                && !appName.Equals(appFilter, StringComparison.OrdinalIgnoreCase)
                && !processName.Equals(appFilter, StringComparison.OrdinalIgnoreCase))
                return true;

            GetWindowRect(hWnd, out RECT rect);

            // Filter out tiny windows (< 50x50) unless minimized
            int w = rect.Right - rect.Left;
            int h = rect.Bottom - rect.Top;
            if (!minimized && (w < 50 || h < 50)) return true;

            // Check fullscreen: window covers the full screen
            bool fullscreen = false;
            try
            {
                var screen = ScreenInfo.FromHandle(hWnd);
                fullscreen = rect.Left <= screen.Bounds.Left && rect.Top <= screen.Bounds.Top
                    && rect.Right >= screen.Bounds.Right && rect.Bottom >= screen.Bounds.Bottom;
            }
            catch { }

            // Assign or retrieve ref
            string windowRef;
            if (_handleToRef.TryGetValue(hWnd, out var existingRef))
            {
                windowRef = existingRef;
            }
            else
            {
                _windowCounter++;
                windowRef = $"@w{_windowCounter}";
                _handleToRef[hWnd] = windowRef;
                _refToHandle[windowRef] = hWnd;
            }

            windows.Add(new WindowInfo
            {
                Ref = windowRef,
                Title = title,
                App = appName,
                ProcessName = processName,
                ProcessId = appPid,
                Bounds = [rect.Left, rect.Top, w, h],
                Minimized = minimized,
                Hidden = false,
                Fullscreen = fullscreen,
            });

            return true;
        }, IntPtr.Zero);

        return windows;
    }

    /// <summary>
    /// Windows that belong to <paramref name="name"/>: the friendly app name,
    /// the raw process name, or (for launch/grab by a name the user typed)
    /// the window title itself, e.g. "Calculator" for a UWP frame.
    /// </summary>
    public List<WindowInfo> FindWindows(string name)
    {
        var all = ListWindows();
        var byApp = all.Where(w =>
            w.App.Equals(name, StringComparison.OrdinalIgnoreCase) ||
            w.ProcessName.Equals(name, StringComparison.OrdinalIgnoreCase)).ToList();
        if (byApp.Count > 0) return byApp;

        return all.Where(w =>
            w.Title.Equals(name, StringComparison.OrdinalIgnoreCase) ||
            w.Title.StartsWith(name + " ", StringComparison.OrdinalIgnoreCase) ||
            w.Title.StartsWith(name + " -", StringComparison.OrdinalIgnoreCase)).ToList();
    }

    private static bool IsCloaked(IntPtr hWnd)
    {
        try
        {
            return DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out int cloaked, sizeof(int)) == 0 && cloaked != 0;
        }
        catch { return false; }
    }

    private static (string name, long started) ProcessIdentity(int pid)
    {
        try
        {
            using var proc = Process.GetProcessById(pid);
            long started;
            try { started = proc.StartTime.Ticks; } catch { started = 0; }
            return (proc.ProcessName, started);
        }
        catch
        {
            return ("Unknown", 0);
        }
    }

    /// <summary>
    /// Pid of the UWP app hosted in an ApplicationFrameHost frame window, or 0.
    /// While the app is active its CoreWindow is a child of the frame; while
    /// inactive the CoreWindow is a separate (cloaked) top-level window that
    /// carries the same title.
    /// </summary>
    private static int FindHostedAppPid(IntPtr frameHwnd, string title, Lazy<List<(string title, uint pid)>> looseCoreWindows)
    {
        uint found = 0;
        EnumChildWindows(frameHwnd, (child, _) =>
        {
            if (ClassNameOf(child) != CoreWindowClass) return true;
            GetWindowThreadProcessId(child, out found);
            return false;
        }, IntPtr.Zero);
        if (found != 0) return (int)found;

        foreach (var (coreTitle, corePid) in looseCoreWindows.Value)
        {
            if (coreTitle.Equals(title, StringComparison.Ordinal)) return (int)corePid;
        }
        return 0;
    }

    private static List<(string title, uint pid)> ListLooseCoreWindows()
    {
        var list = new List<(string, uint)>();
        EnumWindows((hWnd, _) =>
        {
            if (ClassNameOf(hWnd) != CoreWindowClass) return true;
            GetWindowThreadProcessId(hWnd, out uint pid);
            var (name, _) = ProcessIdentity((int)pid);
            if (name.Equals(FrameHostProcess, StringComparison.OrdinalIgnoreCase)) return true;
            int len = GetWindowTextLength(hWnd);
            if (len == 0) return true;
            var buf = new char[len + 1];
            GetWindowText(hWnd, buf, buf.Length);
            list.Add((new string(buf, 0, len), pid));
            return true;
        }, IntPtr.Zero);
        return list;
    }

    private static string ClassNameOf(IntPtr hWnd)
    {
        var buf = new char[256];
        int n = GetClassName(hWnd, buf, buf.Length);
        return n > 0 ? new string(buf, 0, n) : string.Empty;
    }

    public IntPtr? ResolveWindowHandle(string refOrApp)
    {
        // Direct ref lookup
        if (refOrApp.StartsWith("@w") && _refToHandle.TryGetValue(refOrApp, out var handle))
            return handle;

        // Search by app name
        var windows = ListWindows();
        var match = windows.FirstOrDefault(w =>
            w.App.Equals(refOrApp, StringComparison.OrdinalIgnoreCase) ||
            w.ProcessName.Equals(refOrApp, StringComparison.OrdinalIgnoreCase) ||
            w.Ref == refOrApp);

        if (match != null && _refToHandle.TryGetValue(match.Ref, out var h))
            return h;

        return null;
    }

    public WindowInfo? GetWindowInfo(string windowRef)
    {
        var windows = ListWindows();
        return windows.FirstOrDefault(w => w.Ref == windowRef);
    }

    public void Raise(string windowRef)
    {
        var handle = ResolveWindowHandle(windowRef)
            ?? throw new ACException(ErrorCodes.WindowNotFound, $"Window not found: {windowRef}");

        if (IsIconic(handle))
            ShowWindow(handle, SW_RESTORE);

        SetForegroundWindow(handle);
    }

    public void Minimize(string windowRef)
    {
        var handle = ResolveWindowHandle(windowRef)
            ?? throw new ACException(ErrorCodes.WindowNotFound, $"Window not found: {windowRef}");
        ShowWindow(handle, SW_MINIMIZE);
    }

    public void Maximize(string windowRef)
    {
        var handle = ResolveWindowHandle(windowRef)
            ?? throw new ACException(ErrorCodes.WindowNotFound, $"Window not found: {windowRef}");
        ShowWindow(handle, SW_MAXIMIZE);
    }

    public void Restore(string windowRef)
    {
        var handle = ResolveWindowHandle(windowRef)
            ?? throw new ACException(ErrorCodes.WindowNotFound, $"Window not found: {windowRef}");
        ShowWindow(handle, SW_RESTORE);
    }

    public void Close(string windowRef)
    {
        var handle = ResolveWindowHandle(windowRef)
            ?? throw new ACException(ErrorCodes.WindowNotFound, $"Window not found: {windowRef}");
        PostMessage(handle, WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
    }

    public void Move(string windowRef, int x, int y)
    {
        var handle = ResolveWindowHandle(windowRef)
            ?? throw new ACException(ErrorCodes.WindowNotFound, $"Window not found: {windowRef}");
        GetWindowRect(handle, out RECT rect);
        int w = rect.Right - rect.Left;
        int h = rect.Bottom - rect.Top;
        MoveWindow(handle, x, y, w, h, true);
    }

    public void Resize(string windowRef, int width, int height)
    {
        var handle = ResolveWindowHandle(windowRef)
            ?? throw new ACException(ErrorCodes.WindowNotFound, $"Window not found: {windowRef}");
        GetWindowRect(handle, out RECT rect);
        MoveWindow(handle, rect.Left, rect.Top, width, height, true);
    }

    public void SetBounds(string windowRef, int x, int y, int width, int height)
    {
        var handle = ResolveWindowHandle(windowRef)
            ?? throw new ACException(ErrorCodes.WindowNotFound, $"Window not found: {windowRef}");
        MoveWindow(handle, x, y, width, height, true);
    }

    public void ApplyPreset(string windowRef, string preset)
    {
        var handle = ResolveWindowHandle(windowRef)
            ?? throw new ACException(ErrorCodes.WindowNotFound, $"Window not found: {windowRef}");

        var screen = ScreenInfo.FromHandle(handle);
        var wa = screen.WorkingArea;

        switch (preset.ToLowerInvariant())
        {
            case "left-half":
                MoveWindow(handle, wa.Left, wa.Top, wa.Width / 2, wa.Height, true);
                break;
            case "right-half":
                MoveWindow(handle, wa.Left + wa.Width / 2, wa.Top, wa.Width / 2, wa.Height, true);
                break;
            case "top-half":
                MoveWindow(handle, wa.Left, wa.Top, wa.Width, wa.Height / 2, true);
                break;
            case "bottom-half":
                MoveWindow(handle, wa.Left, wa.Top + wa.Height / 2, wa.Width, wa.Height / 2, true);
                break;
            case "center":
                int cw = wa.Width * 2 / 3;
                int ch = wa.Height * 2 / 3;
                MoveWindow(handle, wa.Left + (wa.Width - cw) / 2, wa.Top + (wa.Height - ch) / 2, cw, ch, true);
                break;
            case "fill":
                MoveWindow(handle, wa.Left, wa.Top, wa.Width, wa.Height, true);
                break;
            default:
                throw new ACException(ErrorCodes.InvalidParams, $"Unknown preset: {preset}");
        }
    }

    public void Fullscreen(string windowRef)
    {
        var handle = ResolveWindowHandle(windowRef)
            ?? throw new ACException(ErrorCodes.WindowNotFound, $"Window not found: {windowRef}");

        int style = GetWindowLong(handle, GWL_STYLE);
        if ((style & WS_MAXIMIZE) != 0)
        {
            // Already maximized — restore first
            ShowWindow(handle, SW_RESTORE);
        }

        var screen = ScreenInfo.FromHandle(handle);
        var bounds = screen.Bounds;
        SetWindowPos(handle, IntPtr.Zero, bounds.Left, bounds.Top, bounds.Width, bounds.Height,
            SWP_NOZORDER | SWP_SHOWWINDOW);
    }

    public AutomationElement? GetWindowAutomationElement(string windowRef)
    {
        var handle = ResolveWindowHandle(windowRef);
        if (handle == null) return null;
        try
        {
            return AutomationElement.FromHandle(handle.Value);
        }
        catch
        {
            return null;
        }
    }

    public AutomationElement? GetWindowAutomationElementByHandle(IntPtr handle)
    {
        try
        {
            return AutomationElement.FromHandle(handle);
        }
        catch
        {
            return null;
        }
    }
}
