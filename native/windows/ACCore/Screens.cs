using System.Drawing;
using System.Runtime.InteropServices;

namespace ACCore;

/// <summary>
/// Minimal replacement for System.Windows.Forms.Screen built on the monitor
/// APIs, so the daemon does not have to carry the WinForms runtime.
/// </summary>
public sealed class ScreenInfo
{
    public Rectangle Bounds { get; }
    public Rectangle WorkingArea { get; }
    public bool Primary { get; }
    public string DeviceName { get; }

    private ScreenInfo(MONITORINFOEX mi)
    {
        Bounds = ToRectangle(mi.rcMonitor);
        WorkingArea = ToRectangle(mi.rcWork);
        Primary = (mi.dwFlags & MONITORINFOF_PRIMARY) != 0;
        DeviceName = mi.szDevice ?? string.Empty;
    }

    public static ScreenInfo FromHandle(IntPtr hWnd)
    {
        var hMon = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
        return FromMonitor(hMon) ?? PrimaryScreen;
    }

    public static ScreenInfo FromPoint(Point p)
    {
        var hMon = MonitorFromPoint(new POINT { X = p.X, Y = p.Y }, MONITOR_DEFAULTTONEAREST);
        return FromMonitor(hMon) ?? PrimaryScreen;
    }

    public static ScreenInfo PrimaryScreen
    {
        get
        {
            var all = AllScreens;
            foreach (var s in all)
                if (s.Primary) return s;
            if (all.Length > 0) return all[0];
            // No monitor enumerated (headless session) — fall back to the virtual screen metrics.
            var w = GetSystemMetrics(SM_CXSCREEN);
            var h = GetSystemMetrics(SM_CYSCREEN);
            return new ScreenInfo(new MONITORINFOEX
            {
                rcMonitor = new RECT { Left = 0, Top = 0, Right = w, Bottom = h },
                rcWork = new RECT { Left = 0, Top = 0, Right = w, Bottom = h },
                dwFlags = MONITORINFOF_PRIMARY,
                szDevice = "DISPLAY",
            });
        }
    }

    public static ScreenInfo[] AllScreens
    {
        get
        {
            var list = new List<ScreenInfo>();
            EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr hMon, IntPtr _, ref RECT __, IntPtr ___) =>
            {
                var s = FromMonitor(hMon);
                if (s != null) list.Add(s);
                return true;
            }, IntPtr.Zero);
            return list.ToArray();
        }
    }

    private static ScreenInfo? FromMonitor(IntPtr hMon)
    {
        if (hMon == IntPtr.Zero) return null;
        var mi = new MONITORINFOEX { cbSize = Marshal.SizeOf<MONITORINFOEX>() };
        return GetMonitorInfo(hMon, ref mi) ? new ScreenInfo(mi) : null;
    }

    private static Rectangle ToRectangle(RECT r) =>
        new(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);

    // --- Win32 ---

    private const uint MONITOR_DEFAULTTONEAREST = 2;
    private const uint MONITORINFOF_PRIMARY = 1;
    private const int SM_CXSCREEN = 0;
    private const int SM_CYSCREEN = 1;

    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int X, Y; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct MONITORINFOEX
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string szDevice;
    }

    private delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData);

    [DllImport("user32.dll")]
    private static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumProc lpfnEnum, IntPtr dwData);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFOEX lpmi);

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

    [DllImport("user32.dll")]
    private static extern IntPtr MonitorFromPoint(POINT pt, uint dwFlags);

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int nIndex);
}
