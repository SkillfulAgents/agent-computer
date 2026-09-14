using System.Diagnostics;
using System.Runtime.InteropServices;

namespace ACCore;

/// <summary>One entry of the shell's Applications folder (what the Start menu shows).</summary>
public sealed record StartApp(string Name, string AppUserModelId)
{
    /// <summary>Package family ("Microsoft.WindowsCalculator_8wekyb3d8bbwe") for packaged apps, else null.</summary>
    public string? PackageFamily
    {
        get
        {
            var bang = AppUserModelId.IndexOf('!');
            if (bang <= 0) return null;
            var family = AppUserModelId[..bang];
            return family.Contains('_') ? family : null;
        }
    }
}

/// <summary>
/// The shell's Applications folder (`shell:AppsFolder`): every app the user
/// can start from the Start menu, packaged or classic, with its localized
/// display name and the AppUserModelID that activates it. This is the one
/// place Windows keeps user-facing app names, and the same names `apps`
/// lists, so `launch("Settings")` and `windows` naming both come from here.
///
/// Enumerated through IShellItem on an STA thread (~100-300 ms), cached for
/// the daemon's lifetime and refreshed on a lookup miss (new install) or
/// after <see cref="CacheTtl"/>. Falls back to PowerShell's Get-StartApps
/// if the COM route fails.
/// </summary>
internal static class StartApps
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(10);
    private static readonly object s_lock = new();
    private static List<StartApp>? s_apps;
    private static DateTime s_loadedAt;

    public static IReadOnlyList<StartApp> All(bool refresh = false)
    {
        lock (s_lock)
        {
            if (s_apps == null || refresh || DateTime.UtcNow - s_loadedAt > CacheTtl)
            {
                s_apps = Load();
                s_loadedAt = DateTime.UtcNow;
            }
            return s_apps;
        }
    }

    /// <summary>
    /// The app the user means by <paramref name="name"/>: exact (case-insensitive)
    /// display-name match, else a unique prefix match ("Snipping" → "Snipping Tool").
    /// A miss refreshes the cache once, so a just-installed app resolves.
    /// </summary>
    public static StartApp? Resolve(string name)
    {
        var app = Find(All(), name);
        if (app == null && s_apps != null && DateTime.UtcNow - s_loadedAt > TimeSpan.FromSeconds(30))
            app = Find(All(refresh: true), name);
        return app;
    }

    private static StartApp? Find(IReadOnlyList<StartApp> apps, string name)
    {
        var exact = apps.FirstOrDefault(a => a.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        if (exact != null) return exact;

        var prefix = apps.Where(a => a.Name.StartsWith(name, StringComparison.OrdinalIgnoreCase)).ToList();
        return prefix.Count == 1 ? prefix[0] : null;
    }

    /// <summary>Display name for a package family, e.g. "Microsoft.WindowsCalculator_8wekyb3d8bbwe" → "Calculator".</summary>
    public static string? NameForPackageFamily(string packageFamily)
    {
        var prefix = packageFamily + "!";
        return All().FirstOrDefault(a => a.AppUserModelId.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))?.Name;
    }

    /// <summary>Up to five installed app names that contain <paramref name="query"/>, for "did you mean" errors.</summary>
    public static string[] Suggest(string query)
    {
        return All()
            .Where(a => a.Name.Contains(query, StringComparison.OrdinalIgnoreCase))
            .Select(a => a.Name)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(5)
            .ToArray();
    }

    // ---- loading -------------------------------------------------------------

    private static List<StartApp> Load()
    {
        try
        {
            var viaShell = LoadViaShell();
            if (viaShell.Count > 0) return viaShell;
        }
        catch { }
        try { return LoadViaPowerShell(); }
        catch { return new List<StartApp>(); }
    }

    private static List<StartApp> LoadViaShell()
    {
        List<StartApp>? result = null;
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try { result = EnumerateAppsFolder(); }
            catch (Exception ex) { failure = ex; }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.IsBackground = true;
        thread.Start();
        if (!thread.Join(TimeSpan.FromSeconds(10)))
            throw new TimeoutException("AppsFolder enumeration timed out");
        if (failure != null) throw failure;
        return result ?? new List<StartApp>();
    }

    private static List<StartApp> EnumerateAppsFolder()
    {
        var list = new List<StartApp>();
        var folderId = FOLDERID_AppsFolder;
        var iidShellItem = IID_IShellItem;
        var folder = SHGetKnownFolderItem(ref folderId, 0, IntPtr.Zero, ref iidShellItem);
        try
        {
            var bhid = BHID_EnumItems;
            var iidEnum = IID_IEnumShellItems;
            folder.BindToHandler(IntPtr.Zero, ref bhid, ref iidEnum, out var enumObj);
            var enumerator = (IEnumShellItems)enumObj;
            try
            {
                while (enumerator.Next(1, out var item, out var fetched) == 0 && fetched == 1)
                {
                    try
                    {
                        item.GetDisplayName(SIGDN_NORMALDISPLAY, out var name);
                        item.GetDisplayName(SIGDN_PARENTRELATIVEPARSING, out var aumid);
                        if (!string.IsNullOrWhiteSpace(name) && !string.IsNullOrWhiteSpace(aumid))
                            list.Add(new StartApp(name, aumid));
                    }
                    finally { Marshal.ReleaseComObject(item); }
                }
            }
            finally { Marshal.ReleaseComObject(enumerator); }
        }
        finally { Marshal.ReleaseComObject(folder); }
        return list;
    }

    private static List<StartApp> LoadViaPowerShell()
    {
        var list = new List<StartApp>();
        using var proc = Process.Start(new ProcessStartInfo
        {
            FileName = "powershell",
            Arguments = "-NoProfile -Command \"Get-StartApps | ForEach-Object { $_.Name + [char]9 + $_.AppID }\"",
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        });
        if (proc == null) return list;
        var output = proc.StandardOutput.ReadToEnd();
        proc.WaitForExit(10000);
        foreach (var line in output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var tab = line.IndexOf('\t');
            if (tab <= 0) continue;
            list.Add(new StartApp(line[..tab], line[(tab + 1)..]));
        }
        return list;
    }

    // ---- COM -----------------------------------------------------------------

    private static readonly Guid FOLDERID_AppsFolder = new("1e87508d-89c2-42f0-8a7e-645a0f50ca58");
    private static readonly Guid BHID_EnumItems = new("94f60519-2850-4924-aa5a-d15e84868039");
    private static readonly Guid IID_IShellItem = new("43826d1e-e718-42ee-bc55-a1e261c37bfe");
    private static readonly Guid IID_IEnumShellItems = new("70629033-e363-4a28-a567-0db78006e6d7");
    private const uint SIGDN_NORMALDISPLAY = 0x00000000;
    private const uint SIGDN_PARENTRELATIVEPARSING = 0x80018001;

    [DllImport("shell32.dll", PreserveSig = false)]
    private static extern IShellItem SHGetKnownFolderItem(ref Guid rfid, int flags, IntPtr hToken, ref Guid riid);

    [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItem
    {
        void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppv);
        void GetParent(out IShellItem ppsi);
        void GetDisplayName(uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
        void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
        void Compare(IShellItem psi, uint hint, out int piOrder);
    }

    [ComImport, Guid("70629033-e363-4a28-a567-0db78006e6d7"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IEnumShellItems
    {
        [PreserveSig]
        int Next(uint celt, out IShellItem rgelt, out uint pceltFetched);
        void Skip(uint celt);
        void Reset();
        void Clone(out IEnumShellItems ppenum);
    }
}
