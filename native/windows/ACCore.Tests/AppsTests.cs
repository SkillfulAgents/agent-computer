using System.Reflection;
using ACCore;

namespace ACCore.Tests;

public class AppsTests
{
    // ---- Helper: invoke private static FriendlyAppxName ----

    private static string? InvokeFriendlyAppxName(string packageName)
    {
        var method = typeof(AppManager).GetMethod(
            "FriendlyAppxName",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (string?)method!.Invoke(null, new object[] { packageName });
    }

    // ---- Helper: read private static AppNameAliases dictionary ----

    private static Dictionary<string, string> GetAppNameAliases()
    {
        var field = typeof(AppManager).GetField(
            "AppNameAliases",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(field);
        return (Dictionary<string, string>)field!.GetValue(null)!;
    }

    // ==== FriendlyAppxName: known mappings ====

    [Theory]
    [InlineData("Microsoft.WindowsCalculator", "Calculator")]
    [InlineData("Microsoft.WindowsCamera", "Camera")]
    [InlineData("Microsoft.WindowsAlarms", "Alarms & Clock")]
    [InlineData("Microsoft.WindowsMaps", "Maps")]
    [InlineData("Microsoft.WindowsSoundRecorder", "Sound Recorder")]
    [InlineData("Microsoft.WindowsTerminal", "Terminal")]
    [InlineData("Microsoft.WindowsNotepad", "Notepad")]
    [InlineData("Microsoft.Paint", "Paint")]
    [InlineData("Microsoft.ScreenSketch", "Snipping Tool")]
    [InlineData("Microsoft.Photos", "Photos")]
    [InlineData("Microsoft.MicrosoftStickyNotes", "Sticky Notes")]
    [InlineData("Microsoft.Todos", "Microsoft To Do")]
    [InlineData("Microsoft.ZuneMusic", "Media Player")]
    [InlineData("Microsoft.ZuneVideo", "Movies & TV")]
    [InlineData("Microsoft.MicrosoftEdge.Stable", "Microsoft Edge")]
    [InlineData("Microsoft.OutlookForWindows", "Outlook")]
    public void FriendlyAppxName_KnownMappings(string packageName, string expected)
    {
        Assert.Equal(expected, InvokeFriendlyAppxName(packageName));
    }

    // ==== FriendlyAppxName: unknown package extracts last part ====

    [Fact]
    public void FriendlyAppxName_UnknownPackage_ExtractsLastPart()
    {
        // "Discord.Discord" → last part "Discord", no suffix to strip
        var result = InvokeFriendlyAppxName("Discord.Discord");
        Assert.Equal("Discord", result);
    }

    [Fact]
    public void FriendlyAppxName_SpotifyAB_SpotifyMusic_ExtractsSpotify()
    {
        // "SpotifyAB.SpotifyMusic" → last part "SpotifyMusic" → strip "Music" → "Spotify"
        var result = InvokeFriendlyAppxName("SpotifyAB.SpotifyMusic");
        Assert.Equal("Spotify", result);
    }

    [Fact]
    public void FriendlyAppxName_UnknownMultiPart_UsesLastPart()
    {
        var result = InvokeFriendlyAppxName("SomePublisher.CoolTool");
        Assert.Equal("CoolTool", result);
    }

    // ==== FriendlyAppxName: strips common suffixes ====

    [Theory]
    [InlineData("Publisher.CoolMusic", "Cool")]       // strips Music
    [InlineData("Publisher.MyVideo", "My")]            // strips Video
    [InlineData("Publisher.SuperApp", "Super")]        // strips App
    [InlineData("Publisher.ChatClient", "Chat")]       // strips Client
    public void FriendlyAppxName_StripsSuffixes(string packageName, string expected)
    {
        Assert.Equal(expected, InvokeFriendlyAppxName(packageName));
    }

    [Fact]
    public void FriendlyAppxName_DoesNotStripIfResultWouldBeEmpty()
    {
        // "Publisher.App" → last = "App", stripping "App" gives "" → length check:
        // last.Length > suffix.Length is false when last == suffix, so no strip
        var result = InvokeFriendlyAppxName("Publisher.App");
        Assert.Equal("App", result);
    }

    [Fact]
    public void FriendlyAppxName_OnlyStripsOneSuffix()
    {
        // "Publisher.MusicClient" → strip "Client" first (it checks Music, Video, App, Client in order)
        // Actually: "MusicClient" ends with "Music"? No. Ends with "Client"? Yes → "Music"
        var result = InvokeFriendlyAppxName("Publisher.MusicClient");
        Assert.Equal("Music", result);
    }

    // ==== FriendlyAppxName: skips framework packages ====

    [Theory]
    [InlineData("Microsoft.NETCore.Runtime")]
    [InlineData("Microsoft.NET.Native.Framework")]
    [InlineData("Microsoft.VCLibs.140.00")]
    [InlineData("Microsoft.UI.Xaml.2.8")]
    [InlineData("Microsoft.Services.Store.Engagement")]
    public void FriendlyAppxName_SkipsFrameworkPackages(string packageName)
    {
        Assert.Null(InvokeFriendlyAppxName(packageName));
    }

    [Fact]
    public void FriendlyAppxName_SkipsUnknownMicrosoftWindows()
    {
        // Microsoft.Windows.SomeUnknown is not in the known mappings → null
        Assert.Null(InvokeFriendlyAppxName("Microsoft.Windows.SomeUnknown"));
    }

    // ==== FriendlyAppxName: returns null for single-part names ====

    [Theory]
    [InlineData("Calculator")]
    [InlineData("SingleWord")]
    [InlineData("")]
    public void FriendlyAppxName_SinglePartName_ReturnsNull(string packageName)
    {
        Assert.Null(InvokeFriendlyAppxName(packageName));
    }

    // ==== FriendlyAppxName: case insensitivity of known mappings ====

    [Fact]
    public void FriendlyAppxName_KnownMappings_CaseInsensitive()
    {
        // The dictionary uses StringComparer.OrdinalIgnoreCase
        Assert.Equal("Calculator", InvokeFriendlyAppxName("microsoft.windowscalculator"));
        Assert.Equal("Paint", InvokeFriendlyAppxName("MICROSOFT.PAINT"));
    }

    // ==== AppNameAliases ====

    [Theory]
    [InlineData("Calculator", "calc")]
    [InlineData("Notepad", "notepad")]
    [InlineData("Paint", "mspaint")]
    [InlineData("WordPad", "wordpad")]
    [InlineData("Snipping Tool", "snippingtool")]
    [InlineData("Terminal", "wt")]
    [InlineData("Windows Terminal", "wt")]
    public void AppNameAliases_HasExpectedMappings(string appName, string expectedAlias)
    {
        var aliases = GetAppNameAliases();
        Assert.True(aliases.ContainsKey(appName), $"Missing alias for {appName}");
        Assert.Equal(expectedAlias, aliases[appName]);
    }

    [Fact]
    public void AppNameAliases_IsCaseInsensitive()
    {
        var aliases = GetAppNameAliases();
        // The dictionary uses StringComparer.OrdinalIgnoreCase
        Assert.True(aliases.ContainsKey("calculator"));
        Assert.True(aliases.ContainsKey("NOTEPAD"));
        Assert.True(aliases.ContainsKey("paint"));
    }

    [Fact]
    public void AppNameAliases_DoesNotContainUnknownApp()
    {
        var aliases = GetAppNameAliases();
        Assert.False(aliases.ContainsKey("NonExistentApp"));
    }

    // ==== ChromiumExecutables set (public IsChromiumApp(string) partially testable) ====

    [Theory]
    [InlineData("chrome")]
    [InlineData("msedge")]
    [InlineData("brave")]
    [InlineData("vivaldi")]
    [InlineData("opera")]
    [InlineData("electron")]
    [InlineData("code")]
    [InlineData("slack")]
    [InlineData("discord")]
    [InlineData("teams")]
    [InlineData("spotify")]
    public void IsChromiumApp_KnownExecutables_ReturnsTrue(string name)
    {
        // IsChromiumApp(string) checks ChromiumExecutables set first (case-insensitive),
        // then falls through to process check. Known names should match the set.
        // Note: Process.GetProcessesByName may return nothing, but the set check comes first.
        var manager = new AppManager();
        Assert.True(manager.IsChromiumApp(name));
    }

    [Fact]
    public void IsChromiumApp_UnknownName_ReturnsFalse()
    {
        var manager = new AppManager();
        // "notepad" is not in ChromiumExecutables and won't have chromium markers
        Assert.False(manager.IsChromiumApp("some_unlikely_app_name_xyz"));
    }
}
