using System.Text.Json;
using ACCore;

namespace ACCore.Tests;

public class DiffTests
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    // ---- Helpers ----

    private static ElementInfo MakeElement(string role, string? label = null, string? value = null, string refId = "", List<ElementInfo>? children = null)
    {
        return new ElementInfo
        {
            Ref = refId,
            Role = role,
            Label = label,
            Value = value,
            Enabled = true,
            Bounds = [0, 0, 100, 30],
            Children = children,
        };
    }

    private static List<ElementInfo> SampleElements()
    {
        return new List<ElementInfo>
        {
            MakeElement("button", "OK", null, "@b1"),
            MakeElement("textbox", "Name", "Alice", "@t1"),
            MakeElement("checkbox", "Agree", "1", "@c1"),
        };
    }

    private static List<ElementInfo> CloneSampleElements()
    {
        return new List<ElementInfo>
        {
            MakeElement("button", "OK", null, "@b1"),
            MakeElement("textbox", "Name", "Alice", "@t1"),
            MakeElement("checkbox", "Agree", "1", "@c1"),
        };
    }

    private static JsonDocument ToJson(object result)
    {
        var json = JsonSerializer.Serialize(result, JsonOpts);
        return JsonDocument.Parse(json);
    }

    private static bool GetChanged(JsonDocument doc) => doc.RootElement.GetProperty("changed").GetBoolean();
    private static int GetAddedCount(JsonDocument doc) => doc.RootElement.GetProperty("added_count").GetInt32();
    private static int GetRemovedCount(JsonDocument doc) => doc.RootElement.GetProperty("removed_count").GetInt32();
    private static JsonElement GetAdded(JsonDocument doc) => doc.RootElement.GetProperty("added");
    private static JsonElement GetRemoved(JsonDocument doc) => doc.RootElement.GetProperty("removed");

    // ---- Changed() with no previous snapshot ----

    [Fact]
    public void Changed_NoPreviousSnapshot_ReturnsFalse()
    {
        var diff = new DiffHelper();
        using var doc = ToJson(diff.Changed(SampleElements()));

        Assert.False(GetChanged(doc));
        Assert.Equal(0, GetAddedCount(doc));
        Assert.Equal(0, GetRemovedCount(doc));
    }

    // ---- Changed() with identical elements ----

    [Fact]
    public void Changed_IdenticalElements_ReturnsFalse()
    {
        var diff = new DiffHelper();
        diff.SetLastSnapshot(SampleElements());

        using var doc = ToJson(diff.Changed(CloneSampleElements()));

        Assert.False(GetChanged(doc));
        Assert.Equal(0, GetAddedCount(doc));
        Assert.Equal(0, GetRemovedCount(doc));
    }

    // ---- Changed() after modifying an element ----

    [Fact]
    public void Changed_ModifiedElement_ReturnsTrue()
    {
        var diff = new DiffHelper();
        diff.SetLastSnapshot(SampleElements());

        var modified = CloneSampleElements();
        modified[1].Value = "Bob";

        using var doc = ToJson(diff.Changed(modified));

        Assert.True(GetChanged(doc));
        Assert.Equal(1, GetAddedCount(doc));
        Assert.Equal(1, GetRemovedCount(doc));
    }

    [Fact]
    public void Changed_ModifiedLabel_ReturnsTrue()
    {
        var diff = new DiffHelper();
        diff.SetLastSnapshot(SampleElements());

        var modified = CloneSampleElements();
        modified[0].Label = "Cancel";

        using var doc = ToJson(diff.Changed(modified));

        Assert.True(GetChanged(doc));
        Assert.Equal(1, GetAddedCount(doc));
        Assert.Equal(1, GetRemovedCount(doc));
    }

    // ---- Changed() after adding elements ----

    [Fact]
    public void Changed_AddedElements_ShowsAddedCount()
    {
        var diff = new DiffHelper();
        diff.SetLastSnapshot(SampleElements());

        var updated = CloneSampleElements();
        updated.Add(MakeElement("link", "Help", null, "@l1"));
        updated.Add(MakeElement("button", "Reset", null, "@b2"));

        using var doc = ToJson(diff.Changed(updated));

        Assert.True(GetChanged(doc));
        Assert.Equal(2, GetAddedCount(doc));
        Assert.Equal(0, GetRemovedCount(doc));
    }

    // ---- Changed() after removing elements ----

    [Fact]
    public void Changed_RemovedElements_ShowsRemovedCount()
    {
        var diff = new DiffHelper();
        diff.SetLastSnapshot(SampleElements());

        var updated = new List<ElementInfo>
        {
            MakeElement("button", "OK", null, "@b1"),
        };

        using var doc = ToJson(diff.Changed(updated));

        Assert.True(GetChanged(doc));
        Assert.Equal(0, GetAddedCount(doc));
        Assert.Equal(2, GetRemovedCount(doc));
    }

    // ---- Diff() returns added/removed element details ----

    [Fact]
    public void Diff_WithAddedElements_ReturnsAddedDetails()
    {
        var diff = new DiffHelper();
        diff.SetLastSnapshot(SampleElements());

        var updated = CloneSampleElements();
        updated.Add(MakeElement("link", "Help", null, "@l1"));

        using var doc = ToJson(diff.Diff(updated));

        var added = GetAdded(doc);
        Assert.Equal(1, added.GetArrayLength());

        var addedItem = added[0];
        Assert.Equal("link", addedItem.GetProperty("role").GetString());
        Assert.Equal("Help", addedItem.GetProperty("label").GetString());
        Assert.Equal("@l1", addedItem.GetProperty("ref").GetString());
    }

    [Fact]
    public void Diff_WithRemovedElements_ReturnsRemovedDetails()
    {
        var diff = new DiffHelper();
        diff.SetLastSnapshot(SampleElements());

        // Remove checkbox
        var updated = new List<ElementInfo>
        {
            MakeElement("button", "OK", null, "@b1"),
            MakeElement("textbox", "Name", "Alice", "@t1"),
        };

        using var doc = ToJson(diff.Diff(updated));

        var removed = GetRemoved(doc);
        Assert.Equal(1, removed.GetArrayLength());

        var sig = removed[0].GetProperty("signature").GetString()!;
        Assert.Contains("checkbox", sig);
        Assert.Contains("Agree", sig);
    }

    // ---- Diff() with no changes ----

    [Fact]
    public void Diff_NoChanges_ReturnsEmptyArrays()
    {
        var diff = new DiffHelper();
        diff.SetLastSnapshot(SampleElements());

        using var doc = ToJson(diff.Diff(CloneSampleElements()));

        Assert.Equal(0, GetAdded(doc).GetArrayLength());
        Assert.Equal(0, GetRemoved(doc).GetArrayLength());
    }

    // ---- Diff() with no previous snapshot ----

    [Fact]
    public void Diff_NoPreviousSnapshot_ReturnsEmptyArrays()
    {
        var diff = new DiffHelper();
        using var doc = ToJson(diff.Diff(SampleElements()));

        Assert.Equal(0, GetAdded(doc).GetArrayLength());
        Assert.Equal(0, GetRemoved(doc).GetArrayLength());
    }

    // ---- SetLastSnapshot updates baseline ----

    [Fact]
    public void SetLastSnapshot_UpdatesBaseline()
    {
        var diff = new DiffHelper();

        diff.SetLastSnapshot(SampleElements());

        var modified = new List<ElementInfo>
        {
            MakeElement("button", "OK", null, "@b1"),
            MakeElement("textbox", "Name", "Bob", "@t1"),
        };
        diff.SetLastSnapshot(modified);

        using var doc = ToJson(diff.Changed(new List<ElementInfo>
        {
            MakeElement("button", "OK", null, "@b1"),
            MakeElement("textbox", "Name", "Bob", "@t1"),
        }));

        Assert.False(GetChanged(doc));
    }

    [Fact]
    public void SetLastSnapshot_PreviousBaselineOverwritten()
    {
        var diff = new DiffHelper();

        diff.SetLastSnapshot(SampleElements());

        var newBaseline = new List<ElementInfo>
        {
            MakeElement("button", "OK", null, "@b1"),
        };
        diff.SetLastSnapshot(newBaseline);

        using var doc = ToJson(diff.Changed(SampleElements()));

        Assert.True(GetChanged(doc));
        Assert.Equal(2, GetAddedCount(doc));
        Assert.Equal(0, GetRemovedCount(doc));
    }

    // ---- Signatures include role, label, value, ref ----

    [Fact]
    public void Signatures_IncludeAllFields()
    {
        var diff = new DiffHelper();

        var elements = new List<ElementInfo>
        {
            MakeElement("button", "Click Me", "val", "@b1"),
        };
        diff.SetLastSnapshot(elements);

        var updated = new List<ElementInfo>
        {
            MakeElement("button", "Click Me", "val", "@b2"),
        };

        using var doc = ToJson(diff.Diff(updated));

        var removed = GetRemoved(doc);
        Assert.Equal(1, removed.GetArrayLength());

        var sig = removed[0].GetProperty("signature").GetString()!;
        Assert.Equal("button|Click Me|val|@b1", sig);
    }

    // ---- Nested children are included in signatures ----

    [Fact]
    public void Signatures_IncludeNestedChildren()
    {
        var diff = new DiffHelper();

        var elements = new List<ElementInfo>
        {
            MakeElement("group", "Panel", null, "@g1", children: new List<ElementInfo>
            {
                MakeElement("button", "Inner Button", null, "@b1"),
            }),
        };
        diff.SetLastSnapshot(elements);

        // Remove the inner button's child
        var updated = new List<ElementInfo>
        {
            MakeElement("group", "Panel", null, "@g1"),
        };

        using var doc = ToJson(diff.Changed(updated));

        Assert.True(GetChanged(doc));
        Assert.Equal(0, GetAddedCount(doc));
        Assert.Equal(1, GetRemovedCount(doc));
    }

    [Fact]
    public void Signatures_NestedChildAdded()
    {
        var diff = new DiffHelper();

        var elements = new List<ElementInfo>
        {
            MakeElement("group", "Panel", null, "@g1"),
        };
        diff.SetLastSnapshot(elements);

        var updated = new List<ElementInfo>
        {
            MakeElement("group", "Panel", null, "@g1", children: new List<ElementInfo>
            {
                MakeElement("button", "New Button", null, "@b1"),
            }),
        };

        using var doc = ToJson(diff.Changed(updated));

        Assert.True(GetChanged(doc));
        Assert.Equal(1, GetAddedCount(doc));
        Assert.Equal(0, GetRemovedCount(doc));
    }

    // ---- Changed() updates internal state ----

    [Fact]
    public void Changed_UpdatesInternalSnapshot()
    {
        var diff = new DiffHelper();

        // First call establishes baseline
        diff.Changed(SampleElements());

        // Second call with same data: no change
        using var doc2 = ToJson(diff.Changed(CloneSampleElements()));
        Assert.False(GetChanged(doc2));

        // Third call with modified data: change detected
        var modified = CloneSampleElements();
        modified[0].Label = "Changed";
        using var doc3 = ToJson(diff.Changed(modified));
        Assert.True(GetChanged(doc3));

        // Fourth call with same modified data: no change (baseline was updated)
        var sameModified = CloneSampleElements();
        sameModified[0].Label = "Changed";
        using var doc4 = ToJson(diff.Changed(sameModified));
        Assert.False(GetChanged(doc4));
    }

    // ---- Edge: empty elements ----

    [Fact]
    public void Changed_EmptyElements_NoChange()
    {
        var diff = new DiffHelper();
        diff.SetLastSnapshot(new List<ElementInfo>());

        using var doc = ToJson(diff.Changed(new List<ElementInfo>()));

        Assert.False(GetChanged(doc));
        Assert.Equal(0, GetAddedCount(doc));
        Assert.Equal(0, GetRemovedCount(doc));
    }

    [Fact]
    public void Diff_BothModifiedAndRemoved()
    {
        var diff = new DiffHelper();
        diff.SetLastSnapshot(SampleElements());

        // Remove checkbox, modify button label
        var updated = new List<ElementInfo>
        {
            MakeElement("button", "Cancel", null, "@b1"),
            MakeElement("textbox", "Name", "Alice", "@t1"),
        };

        using var doc = ToJson(diff.Diff(updated));

        var added = GetAdded(doc);
        var removed = GetRemoved(doc);

        // button|Cancel||@b1 is new; checkbox|Agree|1|@c1 and button|OK||@b1 are removed
        Assert.Equal(1, added.GetArrayLength());
        Assert.Equal(2, removed.GetArrayLength());
    }
}
