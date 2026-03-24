using System.Diagnostics;
using System.Windows.Automation;

namespace ACCore;

public class WaitHelper
{
    private readonly Dictionary<string, AutomationElement> _refMap;
    private readonly WindowManager _windowManager;

    public WaitHelper(Dictionary<string, AutomationElement> refMap, WindowManager windowManager)
    {
        _refMap = refMap;
        _windowManager = windowManager;
    }

    public object WaitMs(int ms)
    {
        Thread.Sleep(ms);
        return new { ok = true };
    }

    public object WaitForElement(string refStr, bool hidden = false, bool enabled = false, int timeout = 10000)
    {
        var start = Stopwatch.StartNew();

        while (start.ElapsedMilliseconds < timeout)
        {
            if (_refMap.TryGetValue(refStr, out var element))
            {
                try
                {
                    if (hidden)
                    {
                        // Wait for element to disappear
                        if (element.Current.IsOffscreen || element.Current.BoundingRectangle.IsEmpty)
                            return new { ok = true };
                    }
                    else if (enabled)
                    {
                        if (element.Current.IsEnabled)
                            return new { ok = true };
                    }
                    else
                    {
                        // Element exists and is visible
                        if (!element.Current.IsOffscreen)
                            return new { ok = true };
                    }
                }
                catch
                {
                    // Element went stale — if waiting for hidden, that counts
                    if (hidden) return new { ok = true };
                }
            }
            else if (hidden)
            {
                // Ref not in map — element is gone
                return new { ok = true };
            }

            Thread.Sleep(200);
        }

        throw new ACException(ErrorCodes.Timeout,
            $"Timed out waiting for element {refStr} (hidden={hidden}, enabled={enabled})");
    }

    public object WaitForApp(string name, int timeout = 10000)
    {
        var start = Stopwatch.StartNew();

        while (start.ElapsedMilliseconds < timeout)
        {
            var procs = Process.GetProcessesByName(name);
            foreach (var proc in procs)
            {
                try
                {
                    if (proc.MainWindowHandle != IntPtr.Zero)
                        return new { ok = true, process_id = proc.Id };
                }
                catch { }
            }
            Thread.Sleep(200);
        }

        throw new ACException(ErrorCodes.Timeout, $"Timed out waiting for app: {name}");
    }

    public object WaitForWindow(string title, int timeout = 10000)
    {
        var start = Stopwatch.StartNew();

        while (start.ElapsedMilliseconds < timeout)
        {
            var windows = _windowManager.ListWindows();
            var match = windows.FirstOrDefault(w =>
                w.Title.Contains(title, StringComparison.OrdinalIgnoreCase));
            if (match != null)
                return new { ok = true, window = match.Ref };

            Thread.Sleep(200);
        }

        throw new ACException(ErrorCodes.Timeout, $"Timed out waiting for window: {title}");
    }

    public object WaitForText(string text, bool gone, SnapshotBuilder snapshotBuilder,
        AutomationElement? windowElement, WindowInfo? windowInfo, int timeout = 10000)
    {
        var start = Stopwatch.StartNew();

        while (start.ElapsedMilliseconds < timeout)
        {
            if (windowElement != null && windowInfo != null)
            {
                var snapshot = snapshotBuilder.Build(windowElement, windowInfo);
                var found = ContainsText(snapshot.Elements, text);

                if (gone ? !found : found)
                    return new { ok = true };
            }

            Thread.Sleep(300);
        }

        throw new ACException(ErrorCodes.Timeout,
            $"Text \"{text}\" {(gone ? "did not disappear" : "not found")} within {timeout}ms");
    }

    private bool ContainsText(List<ElementInfo> elements, string text)
    {
        foreach (var el in elements)
        {
            if (el.Label?.Contains(text, StringComparison.OrdinalIgnoreCase) == true)
                return true;
            if (el.Value?.Contains(text, StringComparison.OrdinalIgnoreCase) == true)
                return true;
            if (el.Children != null && ContainsText(el.Children, text))
                return true;
        }
        return false;
    }
}
