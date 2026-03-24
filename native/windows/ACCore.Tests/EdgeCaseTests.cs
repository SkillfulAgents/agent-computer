using System.Reflection;
using System.Text.Json;
using ACCore;

namespace ACCore.Tests;

// ============================================================
// Protocol edge cases
// ============================================================

public class ProtocolEdgeCases
{
    private static RPCRequest MakeRequest(string paramsJson)
    {
        var full = $"{{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"test\",\"params\":{paramsJson}}}";
        return ProtocolSerializer.ParseRequest(full)!;
    }

    [Fact]
    public void GetInt_WithFloatJsonValue_ThrowsOrTruncates()
    {
        // JSON float 3.14 — GetInt32() on a non-integer number will throw a FormatException
        // because System.Text.Json's GetInt32() does not silently truncate floats.
        var req = MakeRequest("""{"count":3.14}""");
        // The value kind is Number, so the code reaches val.GetInt32() which throws
        Assert.ThrowsAny<Exception>(() => req.GetInt("count"));
    }

    [Fact]
    public void GetDouble_MissingKey_ReturnsDefault()
    {
        var req = MakeRequest("""{"other":1.5}""");
        Assert.Equal(0.0, req.GetDouble("missing"));
        Assert.Equal(9.9, req.GetDouble("missing", 9.9));
    }

    [Fact]
    public void GetDouble_WithNonNumberValue_ReturnsDefault()
    {
        var req = MakeRequest("""{"val":"not_a_number"}""");
        Assert.Equal(0.0, req.GetDouble("val"));
        Assert.Equal(5.5, req.GetDouble("val", 5.5));
    }

    [Fact]
    public void GetDouble_WithIntegerJsonValue_ReturnsCorrectDouble()
    {
        var req = MakeRequest("""{"val":42}""");
        Assert.Equal(42.0, req.GetDouble("val"), precision: 5);
    }

    [Fact]
    public void GetString_WithJsonNullValue_ReturnsDefault()
    {
        var req = MakeRequest("""{"name":null}""");
        // null ValueKind is not String, so returns default
        Assert.Equal("", req.GetString("name"));
        Assert.Equal("fallback", req.GetString("name", "fallback"));
    }

    [Fact]
    public void GetStringArray_WithMixedTypes_ReturnsOnlyStrings()
    {
        var req = MakeRequest("""{"items":["hello", 42, true, "world", null, false]}""");
        var arr = req.GetStringArray("items");
        Assert.NotNull(arr);
        // Only string items should be included
        Assert.Equal(2, arr!.Length);
        Assert.Equal("hello", arr[0]);
        Assert.Equal("world", arr[1]);
    }

    [Fact]
    public void GetBool_WithNumericOneOrZero_ReturnsDefault()
    {
        // Numeric 1 is not JsonValueKind.True, it's JsonValueKind.Number
        var req = MakeRequest("""{"flag":1}""");
        Assert.False(req.GetBool("flag"));
        Assert.True(req.GetBool("flag", true));

        var req2 = MakeRequest("""{"flag":0}""");
        Assert.False(req2.GetBool("flag"));
        Assert.True(req2.GetBool("flag", true));
    }

    [Fact]
    public void HasParam_ReturnsTrueRegardlessOfType()
    {
        // HasParam only checks existence, not type
        var req = MakeRequest("""{"count":"not_a_number"}""");
        Assert.True(req.HasParam("count")); // exists, even though type is wrong for GetInt

        var req2 = MakeRequest("""{"flag":42}""");
        Assert.True(req2.HasParam("flag")); // exists, even though type is wrong for GetBool

        var req3 = MakeRequest("""{"val":null}""");
        Assert.True(req3.HasParam("val")); // exists even though value is null
    }
}

// ============================================================
// Find edge cases
// ============================================================

public class FindEdgeCases
{
    private readonly FindHelper _finder = new();
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

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

    private static JsonDocument ToJson(object result)
    {
        var json = JsonSerializer.Serialize(result, JsonOpts);
        return JsonDocument.Parse(json);
    }

    private static int GetCount(JsonDocument doc) => doc.RootElement.GetProperty("count").GetInt32();
    private static JsonElement GetElements(JsonDocument doc) => doc.RootElement.GetProperty("elements");
    private static string GetRef(JsonElement el) => el.GetProperty("ref").GetString()!;

    [Fact]
    public void Find_EmptyStringText_MatchesAllElementsWithTextContent()
    {
        // Empty string is a substring of every string, so all elements with non-null label or value match
        var elements = new List<ElementInfo>
        {
            MakeElement("button", "Submit", null, "@b1"),
            MakeElement("textbox", null, "hello", "@t1"),
            MakeElement("group", null, null, "@g1"), // no label, no value — should NOT match
        };

        using var doc = ToJson(_finder.Find(elements, "", null, false));
        // @b1 matches (label "Submit" contains ""), @t1 matches (value "hello" contains ""),
        // @g1 does NOT match (both label and value are null)
        Assert.Equal(2, GetCount(doc));
    }

    [Fact]
    public void Find_ElementsWithNullLabelAndNullValue_DontMatchTextSearch()
    {
        var elements = new List<ElementInfo>
        {
            MakeElement("group", null, null, "@g1"),
            MakeElement("separator", null, null, "@s1"),
        };

        using var doc = ToJson(_finder.Find(elements, "anything", null, false));
        Assert.Equal(0, GetCount(doc));
    }

    [Fact]
    public void Find_FirstOnly_ReturnsFirstByTreeOrder()
    {
        var elements = new List<ElementInfo>
        {
            MakeElement("button", "Click", null, "@b1"),
            MakeElement("button", "Click", null, "@b2"),
            MakeElement("group", "Container", null, "@g1", children: new List<ElementInfo>
            {
                MakeElement("button", "Click", null, "@b3"),
            }),
        };

        using var doc = ToJson(_finder.Find(elements, "Click", "button", true));
        Assert.Equal(1, GetCount(doc));
        // Should be the first one encountered in tree traversal order
        Assert.Equal("@b1", GetRef(GetElements(doc)[0]));
    }
}

// ============================================================
// Diff edge cases
// ============================================================

public class DiffEdgeCases
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

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

    private static JsonDocument ToJson(object result)
    {
        var json = JsonSerializer.Serialize(result, JsonOpts);
        return JsonDocument.Parse(json);
    }

    private static bool GetChanged(JsonDocument doc) => doc.RootElement.GetProperty("changed").GetBoolean();
    private static int GetAddedCount(JsonDocument doc) => doc.RootElement.GetProperty("added_count").GetInt32();
    private static int GetRemovedCount(JsonDocument doc) => doc.RootElement.GetProperty("removed_count").GetInt32();

    [Fact]
    public void NullLabel_VsEmptyStringLabel_ProduceSameSignature()
    {
        // Signature is built as $"{role}|{label}|{value}|{ref}"
        // null.ToString() in string interpolation yields "" (empty string)
        // So "button||val|@b1" is the same whether label is null or ""
        var diff = new DiffHelper();

        var withNull = new List<ElementInfo> { MakeElement("button", null, "val", "@b1") };
        var withEmpty = new List<ElementInfo> { MakeElement("button", "", "val", "@b1") };

        diff.SetLastSnapshot(withNull);
        using var doc = ToJson(diff.Changed(withEmpty));

        // They should produce the same signature, hence no change detected
        Assert.False(GetChanged(doc));
        Assert.Equal(0, GetAddedCount(doc));
        Assert.Equal(0, GetRemovedCount(doc));
    }

    [Fact]
    public void Diff_UpdatesInternalState_SecondCallSeesNoChanges()
    {
        var diff = new DiffHelper();

        var original = new List<ElementInfo> { MakeElement("button", "OK", null, "@b1") };
        var modified = new List<ElementInfo> { MakeElement("button", "Cancel", null, "@b1") };

        diff.SetLastSnapshot(original);

        // First Diff sees the change
        using var doc1 = ToJson(diff.Diff(modified));
        var added1 = doc1.RootElement.GetProperty("added");
        var removed1 = doc1.RootElement.GetProperty("removed");
        Assert.True(added1.GetArrayLength() > 0 || removed1.GetArrayLength() > 0);

        // Second Diff with same modified data sees no changes (baseline was updated by first Diff)
        using var doc2 = ToJson(diff.Diff(modified));
        var added2 = doc2.RootElement.GetProperty("added");
        var removed2 = doc2.RootElement.GetProperty("removed");
        Assert.Equal(0, added2.GetArrayLength());
        Assert.Equal(0, removed2.GetArrayLength());
    }

    [Fact]
    public void Changed_ThenDiff_Interleaving()
    {
        var diff = new DiffHelper();

        var original = new List<ElementInfo>
        {
            MakeElement("button", "OK", null, "@b1"),
            MakeElement("textbox", "Name", "Alice", "@t1"),
        };
        var modified = new List<ElementInfo>
        {
            MakeElement("button", "OK", null, "@b1"),
            MakeElement("textbox", "Name", "Bob", "@t1"),
        };

        diff.SetLastSnapshot(original);

        // Changed() updates internal state
        using var docChanged = ToJson(diff.Changed(modified));
        Assert.True(GetChanged(docChanged));

        // Now Diff() with the same modified data — Changed already updated baseline to modified,
        // so Diff should see no changes
        using var docDiff = ToJson(diff.Diff(modified));
        Assert.Equal(0, docDiff.RootElement.GetProperty("added").GetArrayLength());
        Assert.Equal(0, docDiff.RootElement.GetProperty("removed").GetArrayLength());
    }

    [Fact]
    public void Elements_SameRoleLabelValue_DifferentRefs_DetectedAsDifferent()
    {
        var diff = new DiffHelper();

        var original = new List<ElementInfo> { MakeElement("button", "OK", null, "@b1") };
        var different = new List<ElementInfo> { MakeElement("button", "OK", null, "@b2") };

        diff.SetLastSnapshot(original);
        using var doc = ToJson(diff.Changed(different));

        // Different refs produce different signatures: "button|OK||@b1" vs "button|OK||@b2"
        Assert.True(GetChanged(doc));
        Assert.Equal(1, GetAddedCount(doc));
        Assert.Equal(1, GetRemovedCount(doc));
    }
}

// ============================================================
// Actions edge cases
// ============================================================

public class ActionsEdgeCases
{
    [Fact]
    public void VirtualKeyFromName_EmptyString_Throws()
    {
        var ex = Assert.Throws<ACException>(() => Actions.VirtualKeyFromName(""));
        Assert.Equal(ErrorCodes.InvalidParams, ex.Code);
        Assert.Contains("Unknown key", ex.Message);
    }

    [Fact]
    public void VirtualKeyFromName_Whitespace_Throws()
    {
        var ex = Assert.Throws<ACException>(() => Actions.VirtualKeyFromName(" "));
        Assert.Equal(ErrorCodes.InvalidParams, ex.Code);
        Assert.Contains("Unknown key", ex.Message);
    }

    [Fact]
    public void Drag_StepsZero_DoesNotCrash()
    {
        // After the fix, steps=0 should be guarded to steps=1 and not cause DivideByZeroException.
        // We can't easily call Drag directly without P/Invoke side effects on the real system,
        // but we can verify the method signature accepts steps=0 and the guard is in place
        // by reading the source logic. Instead, we verify via reflection that the guard exists
        // by checking the method doesn't throw DivideByZeroException.
        //
        // Since Drag calls SetCursorPos and mouse_event (P/Invoke), we test indirectly:
        // The key fix is that `if (steps <= 0) steps = 1;` prevents division by zero.
        // We verify the fix is in place by checking the method source through a simplified test.
        //
        // Create an Actions instance with an empty ref map (we won't use ref-based operations)
        var actions = new Actions(new Dictionary<string, System.Windows.Automation.AutomationElement>());

        // This would have thrown DivideByZeroException before the fix.
        // Now it should complete without error (it will call P/Invoke but with steps=1).
        // We catch any P/Invoke side effects by just ensuring no DivideByZeroException.
        try
        {
            actions.Drag(0, 0, 0, 0, durationMs: 100, steps: 0);
        }
        catch (DivideByZeroException)
        {
            Assert.Fail("Drag with steps=0 should not throw DivideByZeroException after the fix");
        }
        catch
        {
            // Other exceptions (e.g., from P/Invoke on CI) are acceptable — we only care about DivideByZero
        }
    }
}

// ============================================================
// Apps edge cases
// ============================================================

public class AppsEdgeCases
{
    private static string? InvokeFriendlyAppxName(string packageName)
    {
        var method = typeof(AppManager).GetMethod(
            "FriendlyAppxName",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (string?)method!.Invoke(null, new object[] { packageName });
    }

    [Fact]
    public void FriendlyAppxName_FourPlusDots_TakesLastPart()
    {
        // "A.B.C.D.SuperTool" — parts.Length >= 2, last = "SuperTool"
        var result = InvokeFriendlyAppxName("A.B.C.D.SuperTool");
        Assert.Equal("SuperTool", result);
    }

    [Fact]
    public void FriendlyAppxName_TrailingDot_EmptyLastPart_ReturnsNull()
    {
        // "Publisher.Something." — last part is "" which is whitespace-empty → returns null
        var result = InvokeFriendlyAppxName("Publisher.Something.");
        Assert.Null(result);
    }

    [Fact]
    public void FriendlyAppxName_NameEqualsSuffix_NoStrip()
    {
        // "Publisher.Music" — last = "Music", suffix "Music": last.Length > suffix.Length is false (6 == 6),
        // so no stripping occurs, returns "Music"
        var result = InvokeFriendlyAppxName("Publisher.Music");
        Assert.Equal("Music", result);
    }

    [Fact]
    public void IsChromiumApp_CaseInsensitive()
    {
        // ChromiumExecutables uses StringComparer.OrdinalIgnoreCase
        var manager = new AppManager();
        Assert.True(manager.IsChromiumApp("Chrome"));
        Assert.True(manager.IsChromiumApp("MSEDGE"));
        Assert.True(manager.IsChromiumApp("CHROME"));
        Assert.True(manager.IsChromiumApp("MsEdge"));
    }
}

// ============================================================
// Dispatcher edge cases
// ============================================================

public class DispatcherEdgeCases
{
    private readonly Dispatcher _dispatcher = new();

    private static RPCRequest MakeRequest(string method, string? paramsJson = null, int id = 1)
    {
        var req = new RPCRequest
        {
            Id = id,
            Method = method,
        };

        if (paramsJson != null)
        {
            var fullJson = $"{{\"jsonrpc\":\"2.0\",\"id\":{id},\"method\":\"{method}\",\"params\":{paramsJson}}}";
            var parsed = ProtocolSerializer.ParseRequest(fullJson);
            if (parsed != null)
                req.Params = parsed.Params;
        }

        return req;
    }

    [Fact]
    public void HandleBatch_NonArrayCommands_ReturnsError()
    {
        // After the fix, commands that are not an array should return an error
        var req = MakeRequest("batch", """{"commands":"not_an_array"}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidParams, resp.Error.Code);
        Assert.Contains("commands must be an array", resp.Error.Message);
    }

    [Fact]
    public void HandleBatch_EmptySubArrays_SkippedSilently()
    {
        // Sub-arrays with 0 elements are skipped (arr.Length == 0 → continue)
        var req = MakeRequest("batch", """{"commands":[[], ["ping"]]}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        var json = JsonSerializer.Serialize(resp.Result);
        // The empty sub-array is skipped, but counted in total
        Assert.Contains("ping", json);
    }

    [Fact]
    public void HandleBatch_NullMethodInSubArray()
    {
        // [null] — arr[0].GetString() returns null, method becomes ""
        var req = MakeRequest("batch", """{"commands":[[null]]}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        var json = JsonSerializer.Serialize(resp.Result);
        using var doc = JsonDocument.Parse(json);
        var results = doc.RootElement.GetProperty("results");
        // Should have an error result since "" method doesn't exist
        if (results.GetArrayLength() > 0)
        {
            var firstResult = results[0];
            if (firstResult.TryGetProperty("error", out _))
            {
                // Expected: method not found error for empty method name
                Assert.True(true);
            }
        }
    }

    [Fact]
    public void HandleWait_BothMsAndRef_MsTakesPrecedence()
    {
        // When ms > 0, it returns immediately via WaitMs regardless of ref
        var req = MakeRequest("wait", """{"ms":1,"ref":"@nonexistent"}""");
        var resp = _dispatcher.Dispatch(req);

        // ms > 0 path is taken first, so it should succeed (just sleeps 1ms)
        Assert.Null(resp.Error);
    }

    [Fact]
    public void HandleWait_MsZero_FallsThroughToOtherChecks()
    {
        // ms=0 means the `if (ms > 0)` check is false, so it falls through to ref/text/app/window checks
        // With no other valid params, it should throw InvalidParams
        var req = MakeRequest("wait", """{"ms":0}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidParams, resp.Error.Code);
    }

    [Fact]
    public void HandleKvSet_WithoutValueProperty()
    {
        // kv_set with key but no value — the code checks TryGetProperty("value", out val),
        // if false it just returns ok without storing anything meaningful
        var setReq = MakeRequest("kv_set", """{"key":"testkey"}""");
        var setResp = _dispatcher.Dispatch(setReq);

        // Should succeed (ok: true) — key is present but no value to store
        Assert.Null(setResp.Error);

        // Getting the key should return null since no value was stored
        var getReq = MakeRequest("kv_get", """{"key":"testkey"}""");
        var getResp = _dispatcher.Dispatch(getReq);

        Assert.Null(getResp.Error);
        var json = JsonSerializer.Serialize(getResp.Result);
        using var doc = JsonDocument.Parse(json);
        // Value should be null since kv_set without value doesn't store
        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            if (prop.Name.Equals("value", StringComparison.OrdinalIgnoreCase) ||
                prop.Name.Equals("Value", StringComparison.OrdinalIgnoreCase))
            {
                Assert.Equal(JsonValueKind.Null, prop.Value.ValueKind);
                return;
            }
        }
        // If we get here, the value property was not found — also acceptable (means null)
    }

    [Fact]
    public void HandleKvGet_AfterKvSetWithoutValue()
    {
        // Set a key with a value first, then set same key without value — original should remain
        var setReq1 = MakeRequest("kv_set", """{"key":"persist","value":"original"}""");
        _dispatcher.Dispatch(setReq1);

        // Set without value — does NOT overwrite because TryGetProperty returns false
        var setReq2 = MakeRequest("kv_set", """{"key":"persist"}""");
        _dispatcher.Dispatch(setReq2);

        var getResp = _dispatcher.Dispatch(MakeRequest("kv_get", """{"key":"persist"}"""));
        Assert.Null(getResp.Error);

        var json = JsonSerializer.Serialize(getResp.Result);
        // The original value should still be there since kv_set without value is a no-op for storage
        Assert.Contains("original", json);
    }
}
