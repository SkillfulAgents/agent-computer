using ACCore;

namespace ACCore.Tests;

public class SnapshotTests
{
    // ============================================================
    // ElementInfo — Default values
    // ============================================================

    [Fact]
    public void ElementInfo_DefaultValues()
    {
        var el = new ElementInfo();
        Assert.Equal("", el.Ref);
        Assert.Equal("", el.Role);
        Assert.Null(el.Label);
        Assert.Null(el.Value);
        Assert.True(el.Enabled);
        Assert.False(el.Focused);
        Assert.Equal(new[] { 0, 0, 0, 0 }, el.Bounds);
        Assert.Null(el.Children);
    }

    [Fact]
    public void ElementInfo_SetAllProperties()
    {
        var el = new ElementInfo
        {
            Ref = "@b1",
            Role = "button",
            Label = "Submit",
            Value = "active",
            Enabled = false,
            Focused = true,
            Bounds = [100, 200, 300, 40],
            Children = new List<ElementInfo>
            {
                new() { Ref = "@t1", Role = "text", Label = "Click me" }
            },
        };

        Assert.Equal("@b1", el.Ref);
        Assert.Equal("button", el.Role);
        Assert.Equal("Submit", el.Label);
        Assert.Equal("active", el.Value);
        Assert.False(el.Enabled);
        Assert.True(el.Focused);
        Assert.Equal(new[] { 100, 200, 300, 40 }, el.Bounds);
        Assert.NotNull(el.Children);
        Assert.Single(el.Children);
        Assert.Equal("@t1", el.Children[0].Ref);
    }

    // ============================================================
    // ElementInfo — Nested children tree
    // ============================================================

    [Fact]
    public void ElementInfo_NestedChildren_ThreeLevels()
    {
        var root = new ElementInfo
        {
            Ref = "@g1",
            Role = "group",
            Children = new List<ElementInfo>
            {
                new()
                {
                    Ref = "@g2",
                    Role = "group",
                    Children = new List<ElementInfo>
                    {
                        new() { Ref = "@b1", Role = "button", Label = "Deep" }
                    }
                }
            }
        };

        Assert.Equal("Deep", root.Children![0].Children![0].Label);
    }

    // ============================================================
    // SnapshotResult — Default values
    // ============================================================

    [Fact]
    public void SnapshotResult_DefaultValues()
    {
        var result = new SnapshotResult();
        Assert.Equal("", result.SnapshotId);
        Assert.Null(result.Window);
        Assert.NotNull(result.Elements);
        Assert.Empty(result.Elements);
        Assert.Null(result.Fallback);
    }

    [Fact]
    public void SnapshotResult_SetAllProperties()
    {
        var windowInfo = new WindowInfo
        {
            Ref = "@w1",
            Title = "Test Window",
            App = "testapp",
            ProcessId = 1234,
            Bounds = [0, 0, 800, 600],
        };

        var result = new SnapshotResult
        {
            SnapshotId = "abc12345",
            Window = windowInfo,
            Elements = new List<ElementInfo>
            {
                new() { Ref = "@b1", Role = "button" },
                new() { Ref = "@t1", Role = "text" },
            },
            Fallback = "OCR text fallback",
        };

        Assert.Equal("abc12345", result.SnapshotId);
        Assert.NotNull(result.Window);
        Assert.Equal("@w1", result.Window.Ref);
        Assert.Equal("Test Window", result.Window.Title);
        Assert.Equal(2, result.Elements.Count);
        Assert.Equal("OCR text fallback", result.Fallback);
    }

    // ============================================================
    // SnapshotResult — Elements can be populated manually
    // ============================================================

    [Fact]
    public void SnapshotResult_Elements_CanBuildTreeManually()
    {
        var result = new SnapshotResult
        {
            SnapshotId = "12345678",
            Elements = new List<ElementInfo>
            {
                new()
                {
                    Ref = "@g1",
                    Role = "group",
                    Label = "Toolbar",
                    Children = new List<ElementInfo>
                    {
                        new() { Ref = "@b1", Role = "button", Label = "Save" },
                        new() { Ref = "@b2", Role = "button", Label = "Load" },
                    }
                },
                new() { Ref = "@t1", Role = "textfield", Label = "Search", Value = "" },
            }
        };

        Assert.Equal(2, result.Elements.Count);
        Assert.Equal(2, result.Elements[0].Children!.Count);
        Assert.Equal("Save", result.Elements[0].Children![0].Label);
        Assert.Equal("", result.Elements[1].Value);
    }

    // ============================================================
    // SnapshotBuilder — Constructor creates valid state
    // ============================================================

    [Fact]
    public void SnapshotBuilder_Constructor_HasEmptyRefMap()
    {
        var builder = new SnapshotBuilder();
        Assert.NotNull(builder.LastRefMap);
        Assert.Empty(builder.LastRefMap);
    }

    // ============================================================
    // SnapshotBuilder — LastRefMap is a mutable dictionary
    // ============================================================

    [Fact]
    public void SnapshotBuilder_LastRefMap_IsInspectable()
    {
        var builder = new SnapshotBuilder();
        var map = builder.LastRefMap;

        // It's a Dictionary<string, AutomationElement>, initially empty
        Assert.IsType<Dictionary<string, System.Windows.Automation.AutomationElement>>(map);
        Assert.Empty(map);
    }

    // ============================================================
    // RefAssigner — 100+ elements, all unique
    // ============================================================

    [Fact]
    public void RefAssigner_HundredPlusElements_AllUnique()
    {
        var assigner = new RefAssigner();
        var refs = new HashSet<string>();
        var roles = new[] { "button", "textfield", "link", "checkbox", "group", "text", "image", "generic" };

        for (int i = 0; i < 150; i++)
        {
            var role = roles[i % roles.Length];
            var refStr = assigner.Assign(role);
            Assert.True(refs.Add(refStr), $"Duplicate ref detected: {refStr} on iteration {i}");
        }

        Assert.Equal(150, refs.Count);
    }

    // ============================================================
    // RefAssigner — All refs match @prefix+number pattern
    // ============================================================

    [Fact]
    public void RefAssigner_AllRefs_MatchExpectedPattern()
    {
        var assigner = new RefAssigner();
        var roles = new[] { "button", "textfield", "link", "checkbox", "combobox", "scrollarea", "generic" };

        foreach (var role in roles)
        {
            for (int i = 0; i < 10; i++)
            {
                var refStr = assigner.Assign(role);
                Assert.StartsWith("@", refStr);
                // After the @, there should be a prefix (letters) followed by a number
                var afterAt = refStr.Substring(1);
                Assert.Matches(@"^[a-z]+\d+$", afterAt);
            }
        }
    }

    // ============================================================
    // RefAssigner — Reset works between snapshots
    // ============================================================

    [Fact]
    public void RefAssigner_Reset_BetweenSnapshots_ProducesSameRefs()
    {
        var assigner = new RefAssigner();

        // First "snapshot"
        var first1 = assigner.Assign("button");
        var first2 = assigner.Assign("textfield");
        var first3 = assigner.Assign("button");

        Assert.Equal("@b1", first1);
        Assert.Equal("@t1", first2);
        Assert.Equal("@b2", first3);

        // Reset simulates new snapshot
        assigner.Reset();

        // Second "snapshot" — counters restart
        var second1 = assigner.Assign("button");
        var second2 = assigner.Assign("textfield");
        var second3 = assigner.Assign("button");

        Assert.Equal("@b1", second1);
        Assert.Equal("@t1", second2);
        Assert.Equal("@b2", second3);
    }

    // ============================================================
    // RefAssigner — Multiple resets
    // ============================================================

    [Fact]
    public void RefAssigner_MultipleResets_AreIdempotent()
    {
        var assigner = new RefAssigner();

        assigner.Assign("button");
        assigner.Reset();
        assigner.Reset(); // second reset should be harmless
        assigner.Reset(); // third reset should be harmless

        Assert.Equal("@b1", assigner.Assign("button"));
    }

    // ============================================================
    // RefAssigner — Multi-character prefixes
    // ============================================================

    [Fact]
    public void RefAssigner_MultiCharPrefixes_WorkCorrectly()
    {
        var assigner = new RefAssigner();

        Assert.Equal("@cb1", assigner.Assign("combobox"));
        Assert.Equal("@sa1", assigner.Assign("scrollarea"));
        Assert.Equal("@st1", assigner.Assign("stepper"));
        Assert.Equal("@sp1", assigner.Assign("splitgroup"));
        Assert.Equal("@tl1", assigner.Assign("timeline"));
        Assert.Equal("@pg1", assigner.Assign("progress"));
        Assert.Equal("@tv1", assigner.Assign("treeview"));
        Assert.Equal("@wb1", assigner.Assign("webarea"));

        // Increment
        Assert.Equal("@cb2", assigner.Assign("combobox"));
        Assert.Equal("@sa2", assigner.Assign("scrollarea"));
    }

    // ============================================================
    // RefAssigner — Large counter values
    // ============================================================

    [Fact]
    public void RefAssigner_LargeCounterValues()
    {
        var assigner = new RefAssigner();

        string last = "";
        for (int i = 1; i <= 500; i++)
        {
            last = assigner.Assign("button");
        }

        Assert.Equal("@b500", last);
    }

    // ============================================================
    // WindowInfo — Default and custom values
    // ============================================================

    [Fact]
    public void WindowInfo_DefaultValues()
    {
        var info = new WindowInfo();
        Assert.Equal("", info.Ref);
        Assert.Equal("", info.Title);
        Assert.Equal("", info.App);
        Assert.Equal(0, info.ProcessId);
        Assert.Equal(new[] { 0, 0, 0, 0 }, info.Bounds);
        Assert.False(info.Minimized);
        Assert.False(info.Hidden);
        Assert.False(info.Fullscreen);
    }

    [Fact]
    public void WindowInfo_SetAllProperties()
    {
        var info = new WindowInfo
        {
            Ref = "@w5",
            Title = "My App - Document.txt",
            App = "myapp",
            ProcessId = 9876,
            Bounds = [10, 20, 800, 600],
            Minimized = true,
            Hidden = false,
            Fullscreen = false,
        };

        Assert.Equal("@w5", info.Ref);
        Assert.Equal("My App - Document.txt", info.Title);
        Assert.Equal("myapp", info.App);
        Assert.Equal(9876, info.ProcessId);
        Assert.Equal(new[] { 10, 20, 800, 600 }, info.Bounds);
        Assert.True(info.Minimized);
    }

    // ============================================================
    // ElementInfo — Serialization roundtrip via JSON
    // ============================================================

    [Fact]
    public void ElementInfo_JsonRoundtrip()
    {
        var el = new ElementInfo
        {
            Ref = "@b1",
            Role = "button",
            Label = "OK",
            Value = null,
            Enabled = true,
            Focused = false,
            Bounds = [10, 20, 100, 30],
        };

        var json = System.Text.Json.JsonSerializer.Serialize(el);
        Assert.Contains("@b1", json);
        Assert.Contains("button", json);
        Assert.Contains("OK", json);

        var deserialized = System.Text.Json.JsonSerializer.Deserialize<ElementInfo>(json);
        Assert.NotNull(deserialized);
        Assert.Equal("@b1", deserialized!.Ref);
        Assert.Equal("button", deserialized.Role);
        Assert.Equal("OK", deserialized.Label);
        Assert.True(deserialized.Enabled);
    }

    // ============================================================
    // SnapshotResult — JSON serialization preserves structure
    // ============================================================

    [Fact]
    public void SnapshotResult_JsonSerialization()
    {
        var result = new SnapshotResult
        {
            SnapshotId = "abcd1234",
            Elements = new List<ElementInfo>
            {
                new() { Ref = "@b1", Role = "button", Label = "Test" }
            }
        };

        var json = System.Text.Json.JsonSerializer.Serialize(result);
        Assert.Contains("abcd1234", json);
        Assert.Contains("@b1", json);
        Assert.Contains("button", json);
        Assert.Contains("Test", json);
    }

    // ============================================================
    // RefAssigner + Roles integration — realistic mixed scenario
    // ============================================================

    [Fact]
    public void RefAssigner_RealisticMixedAssignment()
    {
        var assigner = new RefAssigner();

        // Simulate walking a real UI tree
        var assignments = new List<(string role, string expectedRef)>
        {
            ("group", "@g1"),
            ("toolbar", "@g2"),      // toolbar shares "g" prefix
            ("button", "@b1"),
            ("button", "@b2"),
            ("button", "@b3"),
            ("textfield", "@t1"),
            ("text", "@t2"),         // text shares "t" prefix with textfield
            ("text", "@t3"),
            ("link", "@l1"),
            ("checkbox", "@c1"),
            ("radio", "@r1"),
            ("combobox", "@cb1"),
            ("image", "@i1"),
            ("tab", "@a1"),
            ("tab", "@a2"),
            ("menuitem", "@m1"),
            ("menubar", "@m2"),      // menubar shares "m" prefix with menuitem
            ("slider", "@s1"),
            ("generic", "@e1"),
            ("table", "@x1"),
            ("row", "@o1"),
            ("row", "@o2"),
        };

        foreach (var (role, expectedRef) in assignments)
        {
            var actual = assigner.Assign(role);
            Assert.Equal(expectedRef, actual);
        }
    }
}
