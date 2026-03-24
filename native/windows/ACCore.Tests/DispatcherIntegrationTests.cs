using System.Text.Json;
using ACCore;

namespace ACCore.Tests;

public class DispatcherIntegrationTests
{
    private readonly Dispatcher _dispatcher = new();

    // ============================================================
    // apps with running=true — returns apps list (may be empty)
    // ============================================================

    [Fact]
    public void Apps_RunningTrue_ReturnsAppsList()
    {
        var req = MakeRequest("apps", """{"running":true}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        // Result should have an "apps" property (possibly empty array)
        Assert.Contains("apps", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Apps_RunningFalse_ReturnsAppsList()
    {
        var req = MakeRequest("apps", """{"running":false}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);
    }

    [Fact]
    public void Apps_NoParams_ReturnsAppsList()
    {
        var req = MakeRequest("apps");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);
    }

    // ============================================================
    // grab with invalid ref — WINDOW_NOT_FOUND error
    // ============================================================

    [Fact]
    public void Grab_InvalidRef_ReturnsWindowNotFound()
    {
        var req = MakeRequest("grab", """{"ref":"@w99999"}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.WindowNotFound, resp.Error.Code);
    }

    [Fact]
    public void Grab_NonExistentApp_ReturnsWindowNotFound()
    {
        var req = MakeRequest("grab", """{"app":"nonexistent_app_xyz_12345"}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.WindowNotFound, resp.Error.Code);
    }

    // ============================================================
    // grab with empty params — error (no ref or app)
    // ============================================================

    [Fact]
    public void Grab_EmptyParams_ReturnsWindowNotFound()
    {
        var req = MakeRequest("grab", """{}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.WindowNotFound, resp.Error.Code);
    }

    [Fact]
    public void Grab_NoParams_ReturnsWindowNotFound()
    {
        var req = MakeRequest("grab");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.WindowNotFound, resp.Error.Code);
    }

    // ============================================================
    // ungrab when nothing grabbed — ok
    // ============================================================

    [Fact]
    public void Ungrab_WhenNothingGrabbed_ReturnsOk()
    {
        var req = MakeRequest("ungrab");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        Assert.Contains("true", json);
    }

    [Fact]
    public void Ungrab_Twice_ReturnsOk()
    {
        _dispatcher.Dispatch(MakeRequest("ungrab"));
        var resp = _dispatcher.Dispatch(MakeRequest("ungrab"));

        Assert.Null(resp.Error);
    }

    // ============================================================
    // find without snapshot — error
    // ============================================================

    [Fact]
    public void Find_WithoutSnapshot_ReturnsError()
    {
        var req = MakeRequest("find", """{"text":"hello"}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidRequest, resp.Error.Code);
        Assert.Contains("snapshot", resp.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    // ============================================================
    // changed without snapshot — error
    // ============================================================

    [Fact]
    public void Changed_WithoutSnapshot_ReturnsError()
    {
        var req = MakeRequest("changed");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidRequest, resp.Error.Code);
        Assert.Contains("snapshot", resp.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    // ============================================================
    // diff without snapshot — error
    // ============================================================

    [Fact]
    public void Diff_WithoutSnapshot_ReturnsError()
    {
        var req = MakeRequest("diff");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidRequest, resp.Error.Code);
        Assert.Contains("snapshot", resp.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    // ============================================================
    // screenshot with screen=true (captures screen)
    // ============================================================

    [Fact]
    public void Screenshot_ScreenTrue_ReturnsResult()
    {
        var req = MakeRequest("screenshot", """{"screen":true}""");
        var resp = _dispatcher.Dispatch(req);

        // Screen capture should work (returns base64 or path)
        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);
    }

    // ============================================================
    // batch with empty commands array
    // ============================================================

    [Fact]
    public void Batch_EmptyCommandsArray_ReturnsOk()
    {
        var req = MakeRequest("batch", """{"commands":[]}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Should have count = 0 and total = 0
        int? count = null;
        int? total = null;
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("count", StringComparison.OrdinalIgnoreCase) ||
                prop.Name.Equals("Count", StringComparison.OrdinalIgnoreCase))
                count = prop.Value.GetInt32();
            if (prop.Name.Equals("total", StringComparison.OrdinalIgnoreCase) ||
                prop.Name.Equals("Total", StringComparison.OrdinalIgnoreCase))
                total = prop.Value.GetInt32();
        }

        Assert.Equal(0, count);
        Assert.Equal(0, total);
    }

    // ============================================================
    // batch with valid commands
    // ============================================================

    [Fact]
    public void Batch_PingAndVersion_ReturnsTwoResults()
    {
        var req = MakeRequest("batch", """{"commands":[["ping"],["version"]]}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        int? count = null;
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("count", StringComparison.OrdinalIgnoreCase))
                count = prop.Value.GetInt32();
        }

        Assert.Equal(2, count);
    }

    // ============================================================
    // batch with stop_on_error=true (default)
    // ============================================================

    [Fact]
    public void Batch_StopOnError_StopsAtFirstError()
    {
        // First command succeeds, second fails (grab with bad ref), third would succeed
        var req = MakeRequest("batch", """{"commands":[["ping"],["grab",{"ref":"@w99999"}],["version"]],"stop_on_error":true}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        int? count = null;
        int? total = null;
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("count", StringComparison.OrdinalIgnoreCase))
                count = prop.Value.GetInt32();
            if (prop.Name.Equals("total", StringComparison.OrdinalIgnoreCase))
                total = prop.Value.GetInt32();
        }

        // Should stop after the error (2 results: ping success, grab error)
        Assert.Equal(2, count);
        Assert.Equal(2, total);
    }

    // ============================================================
    // batch with stop_on_error=false
    // ============================================================

    [Fact]
    public void Batch_StopOnErrorFalse_ContinuesAfterError()
    {
        var req = MakeRequest("batch", """{"commands":[["ping"],["grab",{"ref":"@w99999"}],["version"]],"stop_on_error":false}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        int? count = null;
        int? total = null;
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("count", StringComparison.OrdinalIgnoreCase))
                count = prop.Value.GetInt32();
            if (prop.Name.Equals("total", StringComparison.OrdinalIgnoreCase))
                total = prop.Value.GetInt32();
        }

        // All 3 commands processed
        Assert.Equal(3, count);
        Assert.Equal(3, total);
    }

    // ============================================================
    // batch with missing commands — error
    // ============================================================

    [Fact]
    public void Batch_MissingCommands_ReturnsError()
    {
        var req = MakeRequest("batch", """{}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidParams, resp.Error.Code);
        Assert.Contains("commands", resp.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    // ============================================================
    // wait with ms parameter (small value)
    // ============================================================

    [Fact]
    public void Wait_SmallMs_ReturnsOk()
    {
        var req = MakeRequest("wait", """{"ms":10}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);
    }

    [Fact]
    public void Wait_OneMs_ReturnsOk()
    {
        var req = MakeRequest("wait", """{"ms":1}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
    }

    // ============================================================
    // Multiple sequential kv_set/kv_get operations
    // ============================================================

    [Fact]
    public void KvStore_MultipleKeys_IndependentStorage()
    {
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"alpha","value":"A"}"""));
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"beta","value":"B"}"""));
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"gamma","value":"C"}"""));

        var respA = _dispatcher.Dispatch(MakeRequest("kv_get", """{"key":"alpha"}"""));
        var respB = _dispatcher.Dispatch(MakeRequest("kv_get", """{"key":"beta"}"""));
        var respC = _dispatcher.Dispatch(MakeRequest("kv_get", """{"key":"gamma"}"""));

        Assert.Contains("A", JsonSerializer.Serialize(respA.Result));
        Assert.Contains("B", JsonSerializer.Serialize(respB.Result));
        Assert.Contains("C", JsonSerializer.Serialize(respC.Result));
    }

    [Fact]
    public void KvStore_OverwriteThenRead_ReturnsLatestValue()
    {
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"test","value":"first"}"""));
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"test","value":"second"}"""));
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"test","value":"third"}"""));

        var resp = _dispatcher.Dispatch(MakeRequest("kv_get", """{"key":"test"}"""));
        var json = JsonSerializer.Serialize(resp.Result);

        Assert.Contains("third", json);
        Assert.DoesNotContain("first", json);
        Assert.DoesNotContain("second", json);
    }

    [Fact]
    public void KvStore_BooleanValue_RoundTrips()
    {
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"flag","value":true}"""));
        var resp = _dispatcher.Dispatch(MakeRequest("kv_get", """{"key":"flag"}"""));

        Assert.Null(resp.Error);
        var json = JsonSerializer.Serialize(resp.Result);
        Assert.Contains("true", json);
    }

    [Fact]
    public void KvStore_ArrayValue_RoundTrips()
    {
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"items","value":[1,2,3]}"""));
        var resp = _dispatcher.Dispatch(MakeRequest("kv_get", """{"key":"items"}"""));

        Assert.Null(resp.Error);
        var json = JsonSerializer.Serialize(resp.Result);
        Assert.Contains("1", json);
        Assert.Contains("2", json);
        Assert.Contains("3", json);
    }

    [Fact]
    public void KvStore_NullValue_StoresOk()
    {
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"nullable","value":null}"""));
        var resp = _dispatcher.Dispatch(MakeRequest("kv_get", """{"key":"nullable"}"""));

        Assert.Null(resp.Error);
    }

    // ============================================================
    // status after grab attempt shows correct state
    // ============================================================

    [Fact]
    public void Status_AfterFailedGrab_StillShowsNoGrabbedWindow()
    {
        // Attempt to grab a non-existent window
        _dispatcher.Dispatch(MakeRequest("grab", """{"ref":"@w99999"}"""));

        var statusResp = _dispatcher.Dispatch(MakeRequest("status"));
        Assert.Null(statusResp.Error);

        var json = JsonSerializer.Serialize(statusResp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // grabbed_window should still be null after failed grab
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("grabbed_window", StringComparison.OrdinalIgnoreCase) ||
                prop.Name.Equals("GrabbedWindow", StringComparison.OrdinalIgnoreCase))
            {
                Assert.Equal(JsonValueKind.Null, prop.Value.ValueKind);
            }
        }
    }

    [Fact]
    public void Status_AfterUngrab_ShowsCleanState()
    {
        _dispatcher.Dispatch(MakeRequest("ungrab"));

        var statusResp = _dispatcher.Dispatch(MakeRequest("status"));
        Assert.Null(statusResp.Error);

        var json = JsonSerializer.Serialize(statusResp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("grabbed_window", StringComparison.OrdinalIgnoreCase))
                Assert.Equal(JsonValueKind.Null, prop.Value.ValueKind);
            if (prop.Name.Equals("grabbed_app", StringComparison.OrdinalIgnoreCase))
                Assert.Equal(JsonValueKind.Null, prop.Value.ValueKind);
            if (prop.Name.Equals("grabbed_pid", StringComparison.OrdinalIgnoreCase))
                Assert.Equal(JsonValueKind.Null, prop.Value.ValueKind);
            if (prop.Name.Equals("last_snapshot_id", StringComparison.OrdinalIgnoreCase))
                Assert.Equal(JsonValueKind.Null, prop.Value.ValueKind);
        }
    }

    // ============================================================
    // status — daemon_uptime_ms is non-negative
    // ============================================================

    [Fact]
    public void Status_DaemonUptimeMs_IsNonNegative()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("status"));
        var json = JsonSerializer.Serialize(resp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        long? uptime = null;
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("daemon_uptime_ms", StringComparison.OrdinalIgnoreCase) ||
                prop.Name.Equals("DaemonUptimeMs", StringComparison.OrdinalIgnoreCase))
            {
                uptime = prop.Value.GetInt64();
            }
        }

        Assert.NotNull(uptime);
        Assert.True(uptime >= 0, $"Uptime should be non-negative, got {uptime}");
    }

    // ============================================================
    // permissions — always true on Windows
    // ============================================================

    [Fact]
    public void Permissions_ReturnsAccessibilityAndScreenRecordingTrue()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("permissions"));
        Assert.Null(resp.Error);

        var json = JsonSerializer.Serialize(resp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        bool? accessibility = null;
        bool? screenRecording = null;
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("accessibility", StringComparison.OrdinalIgnoreCase))
                accessibility = prop.Value.GetBoolean();
            if (prop.Name.Equals("screen_recording", StringComparison.OrdinalIgnoreCase) ||
                prop.Name.Equals("ScreenRecording", StringComparison.OrdinalIgnoreCase))
                screenRecording = prop.Value.GetBoolean();
        }

        Assert.True(accessibility);
        Assert.True(screenRecording);
    }

    // ============================================================
    // windows — lists windows without error
    // ============================================================

    [Fact]
    public void Windows_NoFilter_ReturnsWindowsList()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("windows"));
        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        Assert.Contains("windows", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Windows_WithAppFilter_ReturnsFilteredList()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("windows", """{"app":"nonexistent_app_xyz"}"""));
        Assert.Null(resp.Error);
    }

    // ============================================================
    // snapshot without grab or app — error
    // ============================================================

    [Fact]
    public void Snapshot_WithoutGrabOrApp_ReturnsError()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("snapshot"));
        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.WindowNotFound, resp.Error.Code);
    }

    // ============================================================
    // children without ref — error
    // ============================================================

    [Fact]
    public void Children_WithoutRef_ReturnsError()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("children"));
        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidParams, resp.Error.Code);
    }

    // ============================================================
    // key without combo — error
    // ============================================================

    [Fact]
    public void Key_WithoutCombo_ReturnsError()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("key"));
        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidParams, resp.Error.Code);
    }

    // ============================================================
    // focus without ref — error
    // ============================================================

    [Fact]
    public void Focus_WithoutRef_ReturnsError()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("focus"));
        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidParams, resp.Error.Code);
    }

    // ============================================================
    // fill without ref — error
    // ============================================================

    [Fact]
    public void Fill_WithoutRef_ReturnsError()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("fill"));
        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidParams, resp.Error.Code);
    }

    // ============================================================
    // wait without any parameter — error
    // ============================================================

    [Fact]
    public void Wait_WithoutParams_ReturnsError()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("wait"));
        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidParams, resp.Error.Code);
        Assert.Contains("Wait requires", resp.Error.Message);
    }

    // ============================================================
    // dialog without grab — error
    // ============================================================

    [Fact]
    public void Dialog_WithoutGrab_ReturnsWindowNotFound()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("dialog"));
        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.WindowNotFound, resp.Error.Code);
    }

    // ============================================================
    // alert without grab — error
    // ============================================================

    [Fact]
    public void Alert_WithoutGrab_ReturnsWindowNotFound()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("alert"));
        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.WindowNotFound, resp.Error.Code);
    }

    // ============================================================
    // menu without grab — error
    // ============================================================

    [Fact]
    public void Menu_WithoutGrab_ReturnsWindowNotFound()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("menu", """{"list":true}"""));
        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.WindowNotFound, resp.Error.Code);
    }

    // ============================================================
    // displays — returns display info
    // ============================================================

    [Fact]
    public void Displays_ReturnsResult()
    {
        var resp = _dispatcher.Dispatch(MakeRequest("displays"));
        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);
    }

    // ============================================================
    // Batch nesting — batch within batch
    // ============================================================

    [Fact]
    public void Batch_NestedBatch_Works()
    {
        var req = MakeRequest("batch",
            """{"commands":[["ping"],["batch",{"commands":[["version"]]}]]}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        int? count = null;
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("count", StringComparison.OrdinalIgnoreCase))
                count = prop.Value.GetInt32();
        }

        Assert.Equal(2, count);
    }

    // ============================================================
    // Batch — results contain correct index and method
    // ============================================================

    [Fact]
    public void Batch_Results_ContainIndexAndMethod()
    {
        var req = MakeRequest("batch", """{"commands":[["ping"],["version"]]}""");
        var resp = _dispatcher.Dispatch(req);

        var json = JsonSerializer.Serialize(resp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        JsonElement results = default;
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("results", StringComparison.OrdinalIgnoreCase))
            {
                results = prop.Value;
                break;
            }
        }

        Assert.Equal(JsonValueKind.Array, results.ValueKind);
        Assert.Equal(2, results.GetArrayLength());

        // First result should be index=0, method=ping
        var first = results[0];
        bool hasIndex = false;
        bool hasMethod = false;
        foreach (var prop in first.EnumerateObject())
        {
            if (prop.Name.Equals("index", StringComparison.OrdinalIgnoreCase))
            {
                Assert.Equal(0, prop.Value.GetInt32());
                hasIndex = true;
            }
            if (prop.Name.Equals("method", StringComparison.OrdinalIgnoreCase))
            {
                Assert.Equal("ping", prop.Value.GetString());
                hasMethod = true;
            }
        }
        Assert.True(hasIndex);
        Assert.True(hasMethod);
    }

    // ============================================================
    // Multiple dispatches — dispatcher maintains state across calls
    // ============================================================

    [Fact]
    public void Dispatcher_MaintainsState_AcrossMultipleCalls()
    {
        // Set a kv value
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"persist","value":"yes"}"""));

        // Ping (doesn't affect kv)
        _dispatcher.Dispatch(MakeRequest("ping"));

        // Check status
        _dispatcher.Dispatch(MakeRequest("status"));

        // KV value should still be there
        var resp = _dispatcher.Dispatch(MakeRequest("kv_get", """{"key":"persist"}"""));
        Assert.Null(resp.Error);
        Assert.Contains("yes", JsonSerializer.Serialize(resp.Result));
    }

    // ============================================================
    // All registered methods return proper responses
    // ============================================================

    [Theory]
    [InlineData("ping")]
    [InlineData("version")]
    [InlineData("status")]
    [InlineData("permissions")]
    [InlineData("ungrab")]
    public void Dispatch_SafeMethods_NeverThrow(string method)
    {
        var resp = _dispatcher.Dispatch(MakeRequest(method));
        // These methods should always succeed without params
        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);
    }

    // ============================================================
    // Response ID always matches request ID
    // ============================================================

    [Theory]
    [InlineData(1)]
    [InlineData(42)]
    [InlineData(0)]
    [InlineData(999999)]
    public void Dispatch_ResponseId_MatchesRequestId(int id)
    {
        var req = MakeRequest("ping", id: id);
        var resp = _dispatcher.Dispatch(req);
        Assert.Equal(id, resp.Id);
    }

    // ============================================================
    // Error response ID also matches request ID
    // ============================================================

    [Fact]
    public void Dispatch_ErrorResponseId_MatchesRequestId()
    {
        var req = MakeRequest("nonexistent", id: 77);
        var resp = _dispatcher.Dispatch(req);
        Assert.Equal(77, resp.Id);
        Assert.NotNull(resp.Error);
    }

    // ============================================================
    // helpers
    // ============================================================

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
}
