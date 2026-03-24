using System.Text.Json;
using ACCore;

namespace ACCore.Tests;

public class DispatcherTests
{
    private readonly Dispatcher _dispatcher = new();

    // ---- ping ----

    [Fact]
    public void Dispatch_Ping_ReturnsPong()
    {
        var req = MakeRequest("ping");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        Assert.Contains("pong", json);
        Assert.Contains("true", json);
    }

    [Fact]
    public void Dispatch_Ping_ResponseIdMatchesRequestId()
    {
        var req = MakeRequest("ping", id: 99);
        var resp = _dispatcher.Dispatch(req);

        Assert.Equal(99, resp.Id);
    }

    // ---- version ----

    [Fact]
    public void Dispatch_Version_ReturnsVersionString()
    {
        var req = MakeRequest("version");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        Assert.Contains("version", json);
        // Should contain a semver-like version
        Assert.Contains("0.1.0", json);
    }

    // ---- unknown method ----

    [Fact]
    public void Dispatch_UnknownMethod_ReturnsMethodNotFoundError()
    {
        var req = MakeRequest("nonexistent_method_xyz");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.MethodNotFound, resp.Error.Code);
        Assert.Contains("nonexistent_method_xyz", resp.Error.Message);
        Assert.Null(resp.Result);
    }

    [Fact]
    public void Dispatch_EmptyMethod_ReturnsMethodNotFoundError()
    {
        var req = MakeRequest("");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.MethodNotFound, resp.Error.Code);
    }

    // ---- status ----

    [Fact]
    public void Dispatch_Status_ReturnsSessionState()
    {
        var req = MakeRequest("status");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);

        // Status should include these fields (they may be null for fresh dispatcher)
        Assert.Contains("grabbed_window", json, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("grabbed_app", json, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("daemon_pid", json, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("daemon_uptime_ms", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Dispatch_Status_FreshDispatcher_NoGrabbedWindow()
    {
        var req = MakeRequest("status");
        var resp = _dispatcher.Dispatch(req);

        var json = JsonSerializer.Serialize(resp.Result);

        // grabbed_window and grabbed_app should be null in fresh state
        // In JSON serialization, null fields appear as "null" or the key is present with null value
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (root.TryGetProperty("grabbed_window", out var gw))
            Assert.Equal(JsonValueKind.Null, gw.ValueKind);
        if (root.TryGetProperty("GrabbedWindow", out var gw2))
            Assert.Equal(JsonValueKind.Null, gw2.ValueKind);
    }

    [Fact]
    public void Dispatch_Status_DaemonPidIsPositive()
    {
        var req = MakeRequest("status");
        var resp = _dispatcher.Dispatch(req);

        var json = JsonSerializer.Serialize(resp.Result);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Find daemon_pid regardless of casing
        int? pid = null;
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("daemon_pid", StringComparison.OrdinalIgnoreCase) ||
                prop.Name.Equals("DaemonPid", StringComparison.OrdinalIgnoreCase))
            {
                pid = prop.Value.GetInt32();
                break;
            }
        }

        Assert.NotNull(pid);
        Assert.True(pid > 0, "daemon_pid should be a positive integer");
    }

    // ---- kv_set / kv_get round-trip ----

    [Fact]
    public void KvSetAndGet_RoundTrip_Works()
    {
        var setReq = MakeRequest("kv_set", """{"key":"mykey","value":"myvalue"}""");
        var setResp = _dispatcher.Dispatch(setReq);

        Assert.Null(setResp.Error);

        var getReq = MakeRequest("kv_get", """{"key":"mykey"}""");
        var getResp = _dispatcher.Dispatch(getReq);

        Assert.Null(getResp.Error);
        Assert.NotNull(getResp.Result);

        var json = JsonSerializer.Serialize(getResp.Result);
        Assert.Contains("myvalue", json);
    }

    [Fact]
    public void KvSetAndGet_NumericValue_RoundTrips()
    {
        var setReq = MakeRequest("kv_set", """{"key":"num","value":42}""");
        _dispatcher.Dispatch(setReq);

        var getReq = MakeRequest("kv_get", """{"key":"num"}""");
        var getResp = _dispatcher.Dispatch(getReq);

        Assert.Null(getResp.Error);
        var json = JsonSerializer.Serialize(getResp.Result);
        Assert.Contains("42", json);
    }

    [Fact]
    public void KvSetAndGet_ObjectValue_RoundTrips()
    {
        var setReq = MakeRequest("kv_set", """{"key":"obj","value":{"nested":"data"}}""");
        _dispatcher.Dispatch(setReq);

        var getReq = MakeRequest("kv_get", """{"key":"obj"}""");
        var getResp = _dispatcher.Dispatch(getReq);

        Assert.Null(getResp.Error);
        var json = JsonSerializer.Serialize(getResp.Result);
        Assert.Contains("nested", json);
        Assert.Contains("data", json);
    }

    [Fact]
    public void KvSet_OverwritesExistingKey()
    {
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"k","value":"first"}"""));
        _dispatcher.Dispatch(MakeRequest("kv_set", """{"key":"k","value":"second"}"""));

        var getResp = _dispatcher.Dispatch(MakeRequest("kv_get", """{"key":"k"}"""));

        var json = JsonSerializer.Serialize(getResp.Result);
        Assert.Contains("second", json);
        Assert.DoesNotContain("first", json);
    }

    // ---- kv_get non-existent key ----

    [Fact]
    public void KvGet_NonExistentKey_ReturnsNullValue()
    {
        var req = MakeRequest("kv_get", """{"key":"does_not_exist"}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        Assert.NotNull(resp.Result);

        var json = JsonSerializer.Serialize(resp.Result);
        // The result should have a "value" field that is null
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        bool foundNull = false;
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name.Equals("value", StringComparison.OrdinalIgnoreCase) ||
                prop.Name.Equals("Value", StringComparison.OrdinalIgnoreCase))
            {
                Assert.Equal(JsonValueKind.Null, prop.Value.ValueKind);
                foundNull = true;
                break;
            }
        }
        Assert.True(foundNull, "Expected a 'value' property with null");
    }

    [Fact]
    public void KvGet_EmptyKey_ReturnsNullValue()
    {
        var req = MakeRequest("kv_get", """{"key":""}""");
        var resp = _dispatcher.Dispatch(req);

        // Should not error - just returns null value for non-existent empty key
        Assert.Null(resp.Error);
    }

    // ---- kv_set missing key ----

    [Fact]
    public void KvSet_MissingKey_ReturnsError()
    {
        var req = MakeRequest("kv_set", """{"value":"v"}""");
        var resp = _dispatcher.Dispatch(req);

        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.InvalidParams, resp.Error.Code);
    }

    // ---- permissions ----

    [Fact]
    public void Dispatch_Permissions_ReturnsTrue()
    {
        var req = MakeRequest("permissions");
        var resp = _dispatcher.Dispatch(req);

        Assert.Null(resp.Error);
        var json = JsonSerializer.Serialize(resp.Result);
        Assert.Contains("accessibility", json);
        Assert.Contains("true", json);
    }

    // ---- response format ----

    [Fact]
    public void Dispatch_SuccessResponse_HasJsonRpc20()
    {
        var req = MakeRequest("ping");
        var resp = _dispatcher.Dispatch(req);

        Assert.Equal("2.0", resp.JsonRpc);
    }

    [Fact]
    public void Dispatch_ErrorResponse_HasJsonRpc20()
    {
        var req = MakeRequest("nonexistent");
        var resp = _dispatcher.Dispatch(req);

        Assert.Equal("2.0", resp.JsonRpc);
    }

    // ---- helpers ----

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
