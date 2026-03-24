using System.Text.Json;
using ACCore;

namespace ACCore.Tests;

public class FindTests
{
    private readonly FindHelper _finder = new();
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
            Bounds = [10, 20, 100, 30],
            Children = children,
        };
    }

    private static List<ElementInfo> SampleTree()
    {
        return new List<ElementInfo>
        {
            MakeElement("button", "Submit", null, "@b1"),
            MakeElement("textbox", "Username", "alice", "@t1"),
            MakeElement("checkbox", "Remember Me", "1", "@c1"),
            MakeElement("group", "Form Section", null, "@g1", children: new List<ElementInfo>
            {
                MakeElement("button", "Cancel", null, "@b2"),
                MakeElement("textbox", "Email", "bob@test.com", "@t2"),
                MakeElement("group", "Inner Group", null, "@g2", children: new List<ElementInfo>
                {
                    MakeElement("link", "Help Link", null, "@l1"),
                    MakeElement("textbox", "Search", "query text", "@t3"),
                }),
            }),
        };
    }

    /// Serialize an anonymous result to JsonDocument for property access across assemblies.
    private static JsonDocument ToJson(object result)
    {
        var json = JsonSerializer.Serialize(result, JsonOpts);
        return JsonDocument.Parse(json);
    }

    private static int GetCount(JsonDocument doc) => doc.RootElement.GetProperty("count").GetInt32();

    private static JsonElement GetElements(JsonDocument doc) => doc.RootElement.GetProperty("elements");

    private static string GetRef(JsonElement el) => el.GetProperty("ref").GetString()!;
    private static string GetRole(JsonElement el) => el.GetProperty("role").GetString()!;
    private static string? GetLabel(JsonElement el)
    {
        var prop = el.GetProperty("label");
        return prop.ValueKind == JsonValueKind.Null ? null : prop.GetString();
    }
    private static string? GetValue(JsonElement el)
    {
        var prop = el.GetProperty("value");
        return prop.ValueKind == JsonValueKind.Null ? null : prop.GetString();
    }

    // ---- Find by text in label (substring, case-insensitive) ----

    [Fact]
    public void Find_ByTextInLabel_SubstringMatch()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, "subm", null, false));

        Assert.Equal(1, GetCount(doc));
        Assert.Equal("@b1", GetRef(GetElements(doc)[0]));
    }

    [Fact]
    public void Find_ByTextInLabel_CaseInsensitive()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, "SUBMIT", null, false));

        Assert.Equal(1, GetCount(doc));
    }

    [Fact]
    public void Find_ByTextInLabel_PartialMatchMultiple()
    {
        var elements = new List<ElementInfo>
        {
            MakeElement("button", "Save File", null, "@b1"),
            MakeElement("button", "Save Draft", null, "@b2"),
            MakeElement("button", "Cancel", null, "@b3"),
        };

        using var doc = ToJson(_finder.Find(elements, "Save", null, false));
        Assert.Equal(2, GetCount(doc));
    }

    // ---- Find by text in value ----

    [Fact]
    public void Find_ByTextInValue_MatchesValue()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, "alice", null, false));

        Assert.Equal(1, GetCount(doc));
        Assert.Equal("@t1", GetRef(GetElements(doc)[0]));
    }

    [Fact]
    public void Find_ByTextInValue_CaseInsensitive()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, "ALICE", null, false));

        Assert.Equal(1, GetCount(doc));
    }

    [Fact]
    public void Find_ByTextInValue_SubstringMatch()
    {
        var elements = SampleTree();
        // "bob@test.com" should match text "test"
        using var doc = ToJson(_finder.Find(elements, "test", null, false));

        Assert.True(GetCount(doc) >= 1);
        var elems = GetElements(doc);
        bool found = false;
        for (int i = 0; i < elems.GetArrayLength(); i++)
        {
            if (GetRef(elems[i]) == "@t2") { found = true; break; }
        }
        Assert.True(found);
    }

    // ---- Find by role only ----

    [Fact]
    public void Find_ByRole_AllButtons()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, null, "button", false));

        // @b1 (top-level Submit) and @b2 (nested Cancel)
        Assert.Equal(2, GetCount(doc));
    }

    [Fact]
    public void Find_ByRole_CaseInsensitive()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, null, "BUTTON", false));

        Assert.Equal(2, GetCount(doc));
    }

    [Fact]
    public void Find_ByRole_AllTextboxes()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, null, "textbox", false));

        // @t1, @t2, @t3
        Assert.Equal(3, GetCount(doc));
    }

    // ---- Find by text + role combined ----

    [Fact]
    public void Find_ByTextAndRole_NarrowsResults()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, "Cancel", "button", false));

        Assert.Equal(1, GetCount(doc));
        Assert.Equal("@b2", GetRef(GetElements(doc)[0]));
    }

    [Fact]
    public void Find_ByTextAndRole_NoMatchWhenRoleDiffers()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, "Cancel", "textbox", false));

        Assert.Equal(0, GetCount(doc));
    }

    // ---- firstOnly ----

    [Fact]
    public void Find_FirstOnly_ReturnsSingleResult()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, null, "textbox", true));

        Assert.Equal(1, GetCount(doc));
        Assert.Equal("@t1", GetRef(GetElements(doc)[0]));
    }

    [Fact]
    public void Find_FirstOnly_WithNoMatch_ReturnsEmpty()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, "nonexistent", null, true));

        Assert.Equal(0, GetCount(doc));
    }

    // ---- Nested children (deep tree) ----

    [Fact]
    public void Find_InNestedChildren_FindsDeeplyNested()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, "Help Link", null, false));

        Assert.Equal(1, GetCount(doc));
        var first = GetElements(doc)[0];
        Assert.Equal("@l1", GetRef(first));
        Assert.Equal("link", GetRole(first));
    }

    [Fact]
    public void Find_InNestedChildren_FindsValueInDeepNode()
    {
        var elements = SampleTree();
        // "query text" is the value of @t3 nested inside Inner Group
        using var doc = ToJson(_finder.Find(elements, "query", null, false));

        Assert.Equal(1, GetCount(doc));
        Assert.Equal("@t3", GetRef(GetElements(doc)[0]));
    }

    // ---- No matches ----

    [Fact]
    public void Find_NoMatches_ReturnsEmpty()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, "zzz_no_match_zzz", null, false));

        Assert.Equal(0, GetCount(doc));
        Assert.Equal(0, GetElements(doc).GetArrayLength());
    }

    [Fact]
    public void Find_NoMatches_RoleDoesNotExist()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, null, "slider", false));

        Assert.Equal(0, GetCount(doc));
    }

    // ---- Null text and null role returns all ----

    [Fact]
    public void Find_NullTextNullRole_ReturnsAllElements()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, null, null, false));

        // Total elements: 4 top-level + 3 in Form Section children + 2 in Inner Group children = 9
        Assert.Equal(9, GetCount(doc));
    }

    // ---- Count is correct ----

    [Fact]
    public void Find_Count_MatchesElementsLength()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, null, "group", false));

        var elems = GetElements(doc);
        Assert.Equal(elems.GetArrayLength(), GetCount(doc));
        Assert.Equal(2, GetCount(doc)); // @g1 and @g2
    }

    // ---- Results don't include children (flattened) ----

    [Fact]
    public void Find_Results_AreFlattened_NoChildrenProperty()
    {
        var elements = SampleTree();
        using var doc = ToJson(_finder.Find(elements, null, "group", false));

        var elems = GetElements(doc);
        for (int i = 0; i < elems.GetArrayLength(); i++)
        {
            // The result anonymous objects have: ref, role, label, value, enabled, bounds
            // They should NOT have a children property
            Assert.False(elems[i].TryGetProperty("children", out _));
        }
    }

    [Fact]
    public void Find_Results_HaveExpectedProperties()
    {
        var elements = new List<ElementInfo>
        {
            MakeElement("button", "OK", "val1", "@b1"),
        };

        using var doc = ToJson(_finder.Find(elements, "OK", null, false));
        var item = GetElements(doc)[0];

        Assert.Equal("@b1", GetRef(item));
        Assert.Equal("button", GetRole(item));
        Assert.Equal("OK", GetLabel(item));
        Assert.Equal("val1", GetValue(item));
        Assert.True(item.GetProperty("enabled").GetBoolean());

        var bounds = item.GetProperty("bounds");
        Assert.Equal(4, bounds.GetArrayLength());
        Assert.Equal(10, bounds[0].GetInt32());
        Assert.Equal(20, bounds[1].GetInt32());
        Assert.Equal(100, bounds[2].GetInt32());
        Assert.Equal(30, bounds[3].GetInt32());
    }

    // ---- Empty input ----

    [Fact]
    public void Find_EmptyElementsList_ReturnsEmpty()
    {
        using var doc = ToJson(_finder.Find(new List<ElementInfo>(), "anything", null, false));
        Assert.Equal(0, GetCount(doc));
    }
}
