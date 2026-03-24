using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using File = System.IO.File;
using Directory = System.IO.Directory;
using Path = System.IO.Path;
using SearchOption = System.IO.SearchOption;

namespace ACCore;

public class AppInfo
{
    public string Name { get; set; } = "";
    public int ProcessId { get; set; }
    public bool IsActive { get; set; }
    public bool IsHidden { get; set; }
    public bool IsChromium { get; set; }
}

public class AppManager
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    // Known Chromium-based executables
    private static readonly HashSet<string> ChromiumExecutables = new(StringComparer.OrdinalIgnoreCase)
    {
        "chrome", "msedge", "brave", "vivaldi", "opera",
        "electron", "code", "slack", "discord", "teams",
        "spotify",
    };

    // Track CDP ports for launched apps
    private readonly Dictionary<string, int> _cdpPorts = new(StringComparer.OrdinalIgnoreCase);
    // Track launched processes for CDP
    private readonly Dictionary<string, Process> _cdpProcesses = new(StringComparer.OrdinalIgnoreCase);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    private const int GWL_EXSTYLE = -20;
    private const int WS_EX_TOOLWINDOW = 0x00000080;

    public List<AppInfo> ListApps(bool runningOnly = false)
    {
        var apps = new Dictionary<string, AppInfo>(StringComparer.OrdinalIgnoreCase);

        // Get active window PID
        var foreground = GetForegroundWindow();
        GetWindowThreadProcessId(foreground, out uint activePid);

        // Collect PIDs that own visible windows
        var pidsWithWindows = new HashSet<uint>();
        EnumWindows((hWnd, _) =>
        {
            if (!IsWindowVisible(hWnd)) return true;
            if (GetWindowTextLength(hWnd) == 0) return true;
            int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
            if ((exStyle & WS_EX_TOOLWINDOW) != 0) return true;

            GetWindowThreadProcessId(hWnd, out uint pid);
            pidsWithWindows.Add(pid);
            return true;
        }, IntPtr.Zero);

        // Running apps (always included)
        var runningNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var proc in Process.GetProcesses())
        {
            try
            {
                if (proc.SessionId == 0) continue;
                if (!pidsWithWindows.Contains((uint)proc.Id)) continue;

                string name = proc.ProcessName;
                if (apps.ContainsKey(name)) continue;
                runningNames.Add(name);

                apps[name] = new AppInfo
                {
                    Name = name,
                    ProcessId = proc.Id,
                    IsActive = proc.Id == (int)activePid,
                    IsHidden = false,
                    IsChromium = IsChromiumApp(proc),
                };
            }
            catch { }
        }

        // All installed apps (from Start Menu shortcuts and registry)
        if (!runningOnly)
        {
            foreach (var app in DiscoverInstalledApps())
            {
                if (apps.ContainsKey(app)) continue;
                apps[app] = new AppInfo
                {
                    Name = app,
                    ProcessId = 0,
                    IsActive = false,
                    IsHidden = false,
                    IsChromium = false,
                };
            }
        }

        return apps.Values.OrderBy(a => a.Name, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private List<string> DiscoverInstalledApps()
    {
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // 1. Start Menu shortcuts (.lnk files)
        string[] startMenuPaths = [
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu), "Programs"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs"),
        ];

        foreach (var dir in startMenuPaths)
        {
            if (!Directory.Exists(dir)) continue;
            foreach (var lnk in Directory.EnumerateFiles(dir, "*.lnk", SearchOption.AllDirectories))
            {
                var name = Path.GetFileNameWithoutExtension(lnk);
                // Skip common noise entries
                if (name.Contains("Uninstall", StringComparison.OrdinalIgnoreCase)) continue;
                if (name.Contains("README", StringComparison.OrdinalIgnoreCase)) continue;
                if (name.Contains("Help", StringComparison.OrdinalIgnoreCase)) continue;
                names.Add(name);
            }
        }

        // 2. Registry: Uninstall keys (for display names of installed programs)
        string[] uninstallKeys = [
            @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ];

        foreach (var keyPath in uninstallKeys)
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(keyPath);
                if (key == null) continue;
                foreach (var subKeyName in key.GetSubKeyNames())
                {
                    try
                    {
                        using var subKey = key.OpenSubKey(subKeyName);
                        var displayName = subKey?.GetValue("DisplayName") as string;
                        var systemComponent = subKey?.GetValue("SystemComponent");
                        if (string.IsNullOrWhiteSpace(displayName)) continue;
                        if (systemComponent is int sc && sc == 1) continue;
                        // Skip updates and patches
                        if (displayName.StartsWith("KB", StringComparison.OrdinalIgnoreCase)) continue;
                        if (displayName.Contains("Update for", StringComparison.OrdinalIgnoreCase)) continue;
                        names.Add(displayName);
                    }
                    catch { }
                }
            }
            catch { }
        }

        // 3. Windows Store / UWP / MSIX apps (Spotify, Calculator, etc.)
        try
        {
            var proc = Process.Start(new ProcessStartInfo
            {
                FileName = "powershell",
                Arguments = "-NoProfile -Command \"Get-AppxPackage | Where-Object { $_.IsFramework -eq $false -and $_.SignatureKind -eq 'Store' } | ForEach-Object { $_.Name }\"",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            if (proc != null)
            {
                var output = proc.StandardOutput.ReadToEnd();
                proc.WaitForExit(5000);
                foreach (var line in output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    // Package names like "SpotifyAB.SpotifyMusic" → "Spotify"
                    // or "Microsoft.WindowsCalculator" → "Calculator"
                    var friendly = FriendlyAppxName(line);
                    if (friendly != null)
                        names.Add(friendly);
                }
            }
        }
        catch { }

        return names.ToList();
    }

    private static string? FriendlyAppxName(string packageName)
    {
        // Map known package names to friendly names
        var knownMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "Microsoft.WindowsCalculator", "Calculator" },
            { "Microsoft.WindowsCamera", "Camera" },
            { "Microsoft.WindowsAlarms", "Alarms & Clock" },
            { "Microsoft.WindowsMaps", "Maps" },
            { "Microsoft.WindowsSoundRecorder", "Sound Recorder" },
            { "Microsoft.WindowsTerminal", "Terminal" },
            { "Microsoft.WindowsNotepad", "Notepad" },
            { "Microsoft.Paint", "Paint" },
            { "Microsoft.ScreenSketch", "Snipping Tool" },
            { "Microsoft.Photos", "Photos" },
            { "Microsoft.MicrosoftStickyNotes", "Sticky Notes" },
            { "Microsoft.Todos", "Microsoft To Do" },
            { "Microsoft.ZuneMusic", "Media Player" },
            { "Microsoft.ZuneVideo", "Movies & TV" },
            { "Microsoft.MicrosoftEdge.Stable", "Microsoft Edge" },
            { "Microsoft.OutlookForWindows", "Outlook" },
        };

        if (knownMappings.TryGetValue(packageName, out var friendly))
            return friendly;

        // For others, extract a reasonable name from the package ID
        // e.g. "SpotifyAB.SpotifyMusic" → "Spotify"
        // e.g. "Discord.Discord" → "Discord"
        var parts = packageName.Split('.');
        if (parts.Length < 2) return null;

        // Skip Microsoft framework/runtime packages
        if (packageName.StartsWith("Microsoft.NET", StringComparison.OrdinalIgnoreCase)) return null;
        if (packageName.StartsWith("Microsoft.VCLibs", StringComparison.OrdinalIgnoreCase)) return null;
        if (packageName.StartsWith("Microsoft.UI", StringComparison.OrdinalIgnoreCase)) return null;
        if (packageName.StartsWith("Microsoft.Services", StringComparison.OrdinalIgnoreCase)) return null;
        if (packageName.StartsWith("Microsoft.Windows.", StringComparison.OrdinalIgnoreCase)
            && !knownMappings.ContainsKey(packageName)) return null;

        // Use the last meaningful part: "SpotifyAB.SpotifyMusic" → "SpotifyMusic" → "Spotify"
        var last = parts[^1];
        // Strip common suffixes
        foreach (var suffix in new[] { "Music", "Video", "App", "Client" })
        {
            if (last.Length > suffix.Length && last.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            {
                last = last[..^suffix.Length];
                break;
            }
        }

        return string.IsNullOrWhiteSpace(last) ? null : last;
    }

    // Common app name → shell command mapping for Windows Store/UWP apps
    private static readonly Dictionary<string, string> AppNameAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Calculator", "calc" },
        { "Notepad", "notepad" },
        { "Paint", "mspaint" },
        { "WordPad", "wordpad" },
        { "Snipping Tool", "snippingtool" },
        { "Terminal", "wt" },
        { "Windows Terminal", "wt" },
    };

    public Process Launch(string name, bool wait = false, bool background = false)
    {
        // Resolve common aliases
        var resolvedName = AppNameAliases.TryGetValue(name, out var alias) ? alias : name;

        ProcessStartInfo psi;

        // Try to find by executable name first
        psi = new ProcessStartInfo
        {
            FileName = resolvedName,
            UseShellExecute = true,
        };

        try
        {
            var proc = Process.Start(psi)
                ?? throw new ACException(ErrorCodes.AppNotFound, $"Failed to launch: {name}");

            if (wait)
            {
                // Wait for the app to have a main window
                int elapsed = 0;
                while (elapsed < 10000)
                {
                    proc.Refresh();
                    if (proc.MainWindowHandle != IntPtr.Zero) break;
                    Thread.Sleep(200);
                    elapsed += 200;
                }
            }

            return proc;
        }
        catch (Exception ex) when (ex is not ACException)
        {
            throw new ACException(ErrorCodes.AppNotFound, $"App not found: {name}. {ex.Message}");
        }
    }

    public Process LaunchWithCDP(string name, int port)
    {
        // Find the executable path
        string? exePath = FindExecutablePath(name);
        if (exePath == null)
            throw new ACException(ErrorCodes.AppNotFound, $"Cannot find executable for: {name}");

        var psi = new ProcessStartInfo
        {
            FileName = exePath,
            Arguments = $"--remote-debugging-port={port} --force-renderer-accessibility",
            UseShellExecute = false,
        };

        var proc = Process.Start(psi)
            ?? throw new ACException(ErrorCodes.AppNotFound, $"Failed to launch with CDP: {name}");

        _cdpPorts[name] = port;
        _cdpProcesses[name] = proc;

        // Wait for app to register
        Thread.Sleep(2000);

        return proc;
    }

    public int? GetCDPPort(string name)
    {
        if (_cdpPorts.TryGetValue(name, out var port))
            return port;
        return null;
    }

    public void Quit(string name, bool force = false)
    {
        foreach (var proc in Process.GetProcessesByName(name))
        {
            try
            {
                if (force)
                    proc.Kill();
                else
                    proc.CloseMainWindow();
            }
            catch { }
        }

        // Clean up CDP tracking
        _cdpPorts.Remove(name);
        _cdpProcesses.Remove(name);
    }

    public bool IsChromiumApp(string name)
    {
        if (ChromiumExecutables.Contains(name)) return true;

        // Check running process
        foreach (var proc in Process.GetProcessesByName(name))
        {
            if (IsChromiumApp(proc)) return true;
        }
        return false;
    }

    private bool IsChromiumApp(Process proc)
    {
        if (ChromiumExecutables.Contains(proc.ProcessName)) return true;

        try
        {
            string? path = proc.MainModule?.FileName;
            if (path == null) return false;

            string dir = Path.GetDirectoryName(path) ?? "";

            // Check for Chromium/Electron markers in the same directory
            return File.Exists(Path.Combine(dir, "chrome_elf.dll"))
                || File.Exists(Path.Combine(dir, "libEGL.dll"))
                || Directory.Exists(Path.Combine(dir, "resources", "electron.asar"))
                || File.Exists(Path.Combine(dir, "electron.exe"));
        }
        catch
        {
            return false;
        }
    }

    private string? FindExecutablePath(string name)
    {
        // Try Process.GetProcessesByName first
        foreach (var proc in Process.GetProcessesByName(name))
        {
            try
            {
                return proc.MainModule?.FileName;
            }
            catch { }
        }

        // Try common locations
        string[] searchPaths = [
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs"),
        ];

        foreach (var searchPath in searchPaths)
        {
            var exe = Path.Combine(searchPath, name, $"{name}.exe");
            if (File.Exists(exe)) return exe;
            exe = Path.Combine(searchPath, name + ".exe");
            if (File.Exists(exe)) return exe;
        }

        // Fall back to name itself (let the OS resolve it)
        return name;
    }
}
