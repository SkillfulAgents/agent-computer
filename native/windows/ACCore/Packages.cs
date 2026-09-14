using System.Runtime.InteropServices;
using System.Text;

namespace ACCore;

/// <summary>
/// Friendly names for packaged (Store / MSIX / UWP) processes. The process
/// name of a packaged app is often an implementation detail ("CalculatorApp",
/// "SystemSettings", "WindowsTerminal"); the package identity gives the name
/// the user knows the app by, and the same name `apps` lists for installed
/// packages, so `launch("Calculator")`, `grab --app Calculator` and the
/// `windows` output all agree.
/// </summary>
internal static class PackagedApps
{
    private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    private const int APPMODEL_ERROR_NO_PACKAGE = 15700;

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetPackageFullName(IntPtr hProcess, ref uint packageFullNameLength, StringBuilder? packageFullName);

    // pid → friendly name (or null). Package identity never changes for a
    // live pid, and pids are only recycled after exit, so cache per (pid, start time).
    private static readonly Dictionary<(int pid, long started), string?> s_cache = new();

    /// <summary>Package family "name" part for a process, e.g. "Microsoft.WindowsCalculator", or null if unpackaged.</summary>
    public static string? PackageName(int pid)
    {
        var h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, (uint)pid);
        if (h == IntPtr.Zero) return null;
        try
        {
            uint len = 0;
            var rc = GetPackageFullName(h, ref len, null);
            if (rc == APPMODEL_ERROR_NO_PACKAGE || len == 0) return null;
            var sb = new StringBuilder((int)len);
            rc = GetPackageFullName(h, ref len, sb);
            if (rc != 0) return null;
            // "Microsoft.WindowsCalculator_11.2409.0.0_x64__8wekyb3d8bbwe" → "Microsoft.WindowsCalculator"
            var full = sb.ToString();
            var underscore = full.IndexOf('_');
            return underscore > 0 ? full[..underscore] : full;
        }
        finally { CloseHandle(h); }
    }

    /// <summary>Friendly app name for a packaged process, or null when unpackaged or unmappable.</summary>
    public static string? FriendlyName(int pid, long processStartTicks)
    {
        var key = (pid, processStartTicks);
        lock (s_cache)
        {
            if (s_cache.TryGetValue(key, out var cached)) return cached;
        }
        string? name = null;
        try
        {
            var package = PackageName(pid);
            if (package != null) name = AppManager.KnownFriendlyAppxName(package);
        }
        catch { }
        lock (s_cache)
        {
            if (s_cache.Count > 4096) s_cache.Clear();
            s_cache[key] = name;
        }
        return name;
    }
}
