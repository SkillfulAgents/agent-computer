using System.Text.Json;
using ACCore;

namespace ACCore.Tests;

public class ProtocolTests
{
    // ---- ParseRequest ----

    [Fact]
    public void ParseRequest_ValidJson_ReturnsRPCRequest()
    {
        var json = """{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}""";
        var req = ProtocolSerializer.ParseRequest(json);

        Assert.NotNull(req);
        Assert.Equal("2.0", req.JsonRpc);
        Assert.Equal(1, req.Id);
        Assert.Equal("ping", req.Method);
        Assert.NotNull(req.Params);
    }

    [Fact]
    public void ParseRequest_ValidJsonWithParams_ReturnsCorrectParams()
    {
        var json = """{"jsonrpc":"2.0","id":42,"method":"kv_set","params":{"key":"foo","value":"bar"}}""";
        var req = ProtocolSerializer.ParseRequest(json);

        Assert.NotNull(req);
        Assert.Equal(42, req.Id);
        Assert.Equal("kv_set", req.Method);
        Assert.Equal("foo", req.GetString("key"));
        Assert.Equal("bar", req.GetString("value"));
    }

    [Fact]
    public void ParseRequest_InvalidJson_ReturnsNull()
    {
        var result = ProtocolSerializer.ParseRequest("not json at all {{{");
        Assert.Null(result);
    }

    [Fact]
    public void ParseRequest_EmptyString_ReturnsNull()
    {
        var result = ProtocolSerializer.ParseRequest("");
        Assert.Null(result);
    }

    [Fact]
    public void ParseRequest_NoParams_ParamsIsNull()
    {
        var json = """{"jsonrpc":"2.0","id":1,"method":"ping"}""";
        var req = ProtocolSerializer.ParseRequest(json);

        Assert.NotNull(req);
        Assert.Null(req.Params);
    }

    // ---- RPCResponse.Success ----

    [Fact]
    public void Success_CreatesProperResponse()
    {
        var resp = RPCResponse.Success(5, new { pong = true });

        Assert.Equal("2.0", resp.JsonRpc);
        Assert.Equal(5, resp.Id);
        Assert.NotNull(resp.Result);
        Assert.Null(resp.Error);
    }

    [Fact]
    public void Success_SerializesCorrectly()
    {
        var resp = RPCResponse.Success(1, new { hello = "world" });
        var json = ProtocolSerializer.Serialize(resp);

        Assert.Contains("\"jsonrpc\":\"2.0\"", json);
        Assert.Contains("\"id\":1", json);
        Assert.Contains("\"hello\":\"world\"", json);
        Assert.DoesNotContain("\"error\"", json);
    }

    // ---- RPCResponse.FromError ----

    [Fact]
    public void FromError_CreatesProperErrorResponse()
    {
        var resp = RPCResponse.FromError(7, ErrorCodes.MethodNotFound, "Method not found: foo");

        Assert.Equal("2.0", resp.JsonRpc);
        Assert.Equal(7, resp.Id);
        Assert.Null(resp.Result);
        Assert.NotNull(resp.Error);
        Assert.Equal(ErrorCodes.MethodNotFound, resp.Error.Code);
        Assert.Equal("Method not found: foo", resp.Error.Message);
        Assert.Null(resp.Error.Data);
    }

    [Fact]
    public void FromError_WithData_IncludesData()
    {
        var data = new { detail = "extra info" };
        var resp = RPCResponse.FromError(3, ErrorCodes.InvalidParams, "Bad params", data);

        Assert.NotNull(resp.Error);
        Assert.NotNull(resp.Error.Data);
    }

    [Fact]
    public void FromError_SerializesCorrectly()
    {
        var resp = RPCResponse.FromError(1, -32601, "Method not found");
        var json = ProtocolSerializer.Serialize(resp);

        Assert.Contains("\"error\"", json);
        Assert.Contains("-32601", json);
        Assert.Contains("Method not found", json);
        Assert.DoesNotContain("\"result\"", json);
    }

    // ---- ErrorCodes.ExitCodeFromErrorCode ----

    [Theory]
    [InlineData(ErrorCodes.ElementNotFound, 1)]
    [InlineData(ErrorCodes.PermissionDenied, 2)]
    [InlineData(ErrorCodes.Timeout, 3)]
    [InlineData(ErrorCodes.AppNotFound, 4)]
    [InlineData(ErrorCodes.WindowNotFound, 5)]
    [InlineData(ErrorCodes.InvalidRef, 6)]
    [InlineData(ErrorCodes.OcrFallbackFailed, 7)]
    public void ExitCodeFromErrorCode_MapsKnownCodes(int errorCode, int expectedExit)
    {
        Assert.Equal(expectedExit, ErrorCodes.ExitCodeFromErrorCode(errorCode));
    }

    [Theory]
    [InlineData(ErrorCodes.InvalidRequest)]
    [InlineData(ErrorCodes.MethodNotFound)]
    [InlineData(ErrorCodes.InvalidParams)]
    [InlineData(0)]
    [InlineData(-99999)]
    public void ExitCodeFromErrorCode_UnknownCodes_Return126(int errorCode)
    {
        Assert.Equal(126, ErrorCodes.ExitCodeFromErrorCode(errorCode));
    }

    // ---- RPCRequest helper methods ----

    [Fact]
    public void GetString_ReturnsValue()
    {
        var req = MakeRequest("""{"name":"hello"}""");
        Assert.Equal("hello", req.GetString("name"));
    }

    [Fact]
    public void GetString_MissingKey_ReturnsDefault()
    {
        var req = MakeRequest("""{"other":"value"}""");
        Assert.Equal("", req.GetString("name"));
        Assert.Equal("fallback", req.GetString("name", "fallback"));
    }

    [Fact]
    public void GetString_NullParams_ReturnsDefault()
    {
        var req = new RPCRequest { Params = null };
        Assert.Equal("default", req.GetString("key", "default"));
    }

    [Fact]
    public void GetString_NonStringValue_ReturnsDefault()
    {
        var req = MakeRequest("""{"count":42}""");
        Assert.Equal("", req.GetString("count"));
    }

    [Fact]
    public void GetInt_ReturnsValue()
    {
        var req = MakeRequest("""{"count":42}""");
        Assert.Equal(42, req.GetInt("count"));
    }

    [Fact]
    public void GetInt_MissingKey_ReturnsDefault()
    {
        var req = MakeRequest("""{"other":1}""");
        Assert.Equal(0, req.GetInt("count"));
        Assert.Equal(99, req.GetInt("count", 99));
    }

    [Fact]
    public void GetInt_NullParams_ReturnsDefault()
    {
        var req = new RPCRequest { Params = null };
        Assert.Equal(5, req.GetInt("x", 5));
    }

    [Fact]
    public void GetInt_NonNumberValue_ReturnsDefault()
    {
        var req = MakeRequest("""{"count":"notanumber"}""");
        Assert.Equal(0, req.GetInt("count"));
    }

    [Fact]
    public void GetBool_ReturnsTrue()
    {
        var req = MakeRequest("""{"flag":true}""");
        Assert.True(req.GetBool("flag"));
    }

    [Fact]
    public void GetBool_ReturnsFalse()
    {
        var req = MakeRequest("""{"flag":false}""");
        Assert.False(req.GetBool("flag"));
    }

    [Fact]
    public void GetBool_MissingKey_ReturnsDefault()
    {
        var req = MakeRequest("""{"other":true}""");
        Assert.False(req.GetBool("flag"));
        Assert.True(req.GetBool("flag", true));
    }

    [Fact]
    public void GetBool_NullParams_ReturnsDefault()
    {
        var req = new RPCRequest { Params = null };
        Assert.True(req.GetBool("flag", true));
    }

    [Fact]
    public void GetBool_NonBoolValue_ReturnsDefault()
    {
        var req = MakeRequest("""{"flag":"yes"}""");
        Assert.False(req.GetBool("flag"));
    }

    [Fact]
    public void GetDouble_ReturnsValue()
    {
        var req = MakeRequest("""{"ratio":3.14}""");
        Assert.Equal(3.14, req.GetDouble("ratio"), precision: 5);
    }

    [Fact]
    public void GetDouble_NullParams_ReturnsDefault()
    {
        var req = new RPCRequest { Params = null };
        Assert.Equal(1.5, req.GetDouble("x", 1.5));
    }

    [Fact]
    public void HasParam_ReturnsTrueWhenPresent()
    {
        var req = MakeRequest("""{"key":"value"}""");
        Assert.True(req.HasParam("key"));
    }

    [Fact]
    public void HasParam_ReturnsFalseWhenMissing()
    {
        var req = MakeRequest("""{"key":"value"}""");
        Assert.False(req.HasParam("other"));
    }

    [Fact]
    public void HasParam_NullParams_ReturnsFalse()
    {
        var req = new RPCRequest { Params = null };
        Assert.False(req.HasParam("key"));
    }

    [Fact]
    public void GetStringArray_ReturnsArray()
    {
        var req = MakeRequest("""{"items":["a","b","c"]}""");
        var arr = req.GetStringArray("items");
        Assert.NotNull(arr);
        Assert.Equal(3, arr.Length);
        Assert.Equal("a", arr[0]);
        Assert.Equal("b", arr[1]);
        Assert.Equal("c", arr[2]);
    }

    [Fact]
    public void GetStringArray_MissingKey_ReturnsNull()
    {
        var req = MakeRequest("""{"other":"x"}""");
        Assert.Null(req.GetStringArray("items"));
    }

    [Fact]
    public void GetStringArray_NullParams_ReturnsNull()
    {
        var req = new RPCRequest { Params = null };
        Assert.Null(req.GetStringArray("items"));
    }

    [Fact]
    public void GetStringArray_NonArrayValue_ReturnsNull()
    {
        var req = MakeRequest("""{"items":"not_an_array"}""");
        Assert.Null(req.GetStringArray("items"));
    }

    [Fact]
    public void GetStringArray_EmptyArray_ReturnsEmptyArray()
    {
        var req = MakeRequest("""{"items":[]}""");
        var arr = req.GetStringArray("items");
        Assert.NotNull(arr);
        Assert.Empty(arr);
    }

    // ---- ACException ----

    [Fact]
    public void ACException_HasCorrectProperties()
    {
        var ex = new ACException(ErrorCodes.ElementNotFound, "not found", new { ref_id = "@b1" });

        Assert.Equal(ErrorCodes.ElementNotFound, ex.Code);
        Assert.Equal("not found", ex.Message);
        Assert.NotNull(ex.Data);
    }

    [Fact]
    public void ACException_WithNullData_DataIsNull()
    {
        var ex = new ACException(ErrorCodes.Timeout, "timed out");

        Assert.Equal(ErrorCodes.Timeout, ex.Code);
        Assert.Equal("timed out", ex.Message);
        Assert.Null(ex.Data);
    }

    [Fact]
    public void ACException_IsException()
    {
        var ex = new ACException(ErrorCodes.InvalidParams, "bad params");
        Assert.IsAssignableFrom<Exception>(ex);
    }

    // ---- Serialize ----

    [Fact]
    public void Serialize_SuccessResponse_UsesSnakeCaseNaming()
    {
        var resp = RPCResponse.Success(1, new { some_field = "value" });
        var json = ProtocolSerializer.Serialize(resp);
        Assert.Contains("some_field", json);
    }

    [Fact]
    public void SerializeResult_ProducesJson()
    {
        var json = ProtocolSerializer.SerializeResult(new { hello = "world" });
        Assert.Contains("hello", json);
        Assert.Contains("world", json);
    }

    // ---- Error code constants ----

    [Fact]
    public void ErrorCodes_HaveExpectedValues()
    {
        Assert.Equal(-32001, ErrorCodes.ElementNotFound);
        Assert.Equal(-32002, ErrorCodes.PermissionDenied);
        Assert.Equal(-32003, ErrorCodes.Timeout);
        Assert.Equal(-32004, ErrorCodes.AppNotFound);
        Assert.Equal(-32005, ErrorCodes.WindowNotFound);
        Assert.Equal(-32006, ErrorCodes.InvalidRef);
        Assert.Equal(-32007, ErrorCodes.OcrFallbackFailed);
        Assert.Equal(-32600, ErrorCodes.InvalidRequest);
        Assert.Equal(-32601, ErrorCodes.MethodNotFound);
        Assert.Equal(-32602, ErrorCodes.InvalidParams);
    }

    // ---- helpers ----

    private static RPCRequest MakeRequest(string paramsJson)
    {
        var full = $"{{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"test\",\"params\":{paramsJson}}}";
        return ProtocolSerializer.ParseRequest(full)!;
    }
}
