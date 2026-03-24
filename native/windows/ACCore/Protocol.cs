using System.Text.Json;
using System.Text.Json.Serialization;

namespace ACCore;

// JSON-RPC 2.0 request
public class RPCRequest
{
    [JsonPropertyName("jsonrpc")]
    public string JsonRpc { get; set; } = "2.0";

    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("method")]
    public string Method { get; set; } = "";

    [JsonPropertyName("params")]
    public JsonElement? Params { get; set; }

    public string GetString(string key, string defaultValue = "")
    {
        if (Params == null) return defaultValue;
        if (Params.Value.TryGetProperty(key, out var val) && val.ValueKind == JsonValueKind.String)
            return val.GetString() ?? defaultValue;
        return defaultValue;
    }

    public int GetInt(string key, int defaultValue = 0)
    {
        if (Params == null) return defaultValue;
        if (Params.Value.TryGetProperty(key, out var val) && val.ValueKind == JsonValueKind.Number)
            return val.GetInt32();
        return defaultValue;
    }

    public double GetDouble(string key, double defaultValue = 0)
    {
        if (Params == null) return defaultValue;
        if (Params.Value.TryGetProperty(key, out var val) && val.ValueKind == JsonValueKind.Number)
            return val.GetDouble();
        return defaultValue;
    }

    public bool GetBool(string key, bool defaultValue = false)
    {
        if (Params == null) return defaultValue;
        if (Params.Value.TryGetProperty(key, out var val))
        {
            if (val.ValueKind == JsonValueKind.True) return true;
            if (val.ValueKind == JsonValueKind.False) return false;
        }
        return defaultValue;
    }

    public bool HasParam(string key)
    {
        if (Params == null) return false;
        return Params.Value.TryGetProperty(key, out _);
    }

    public string[]? GetStringArray(string key)
    {
        if (Params == null) return null;
        if (Params.Value.TryGetProperty(key, out var val) && val.ValueKind == JsonValueKind.Array)
        {
            var list = new List<string>();
            foreach (var item in val.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                    list.Add(item.GetString()!);
            }
            return list.ToArray();
        }
        return null;
    }
}

// JSON-RPC 2.0 response
public class RPCResponse
{
    [JsonPropertyName("jsonrpc")]
    public string JsonRpc { get; set; } = "2.0";

    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("result")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Result { get; set; }

    [JsonPropertyName("error")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public RPCError? Error { get; set; }

    public static RPCResponse Success(int id, object result) => new()
    {
        Id = id,
        Result = result
    };

    public static RPCResponse FromError(int id, int code, string message, object? data = null) => new()
    {
        Id = id,
        Error = new RPCError { Code = code, Message = message, Data = data }
    };
}

public class RPCError
{
    [JsonPropertyName("code")]
    public int Code { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = "";

    [JsonPropertyName("data")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public object? Data { get; set; }
}

// Error codes matching the Swift implementation and TS error types
public static class ErrorCodes
{
    public const int ElementNotFound = -32001;
    public const int PermissionDenied = -32002;
    public const int Timeout = -32003;
    public const int AppNotFound = -32004;
    public const int WindowNotFound = -32005;
    public const int InvalidRef = -32006;
    public const int OcrFallbackFailed = -32007;
    public const int InvalidRequest = -32600;
    public const int MethodNotFound = -32601;
    public const int InvalidParams = -32602;

    public static int ExitCodeFromErrorCode(int code) => code switch
    {
        ElementNotFound => 1,
        PermissionDenied => 2,
        Timeout => 3,
        AppNotFound => 4,
        WindowNotFound => 5,
        InvalidRef => 6,
        OcrFallbackFailed => 7,
        _ => 126
    };
}

public class ACException : Exception
{
    public int Code { get; }
    public new object? Data { get; }

    public ACException(int code, string message, object? data = null) : base(message)
    {
        Code = code;
        Data = data;
    }
}

public static class ProtocolSerializer
{
    private static readonly JsonSerializerOptions _options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
    };

    public static RPCRequest? ParseRequest(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<RPCRequest>(json);
        }
        catch
        {
            return null;
        }
    }

    public static string Serialize(RPCResponse response)
    {
        return JsonSerializer.Serialize(response, _options);
    }

    public static string SerializeResult(object result)
    {
        return JsonSerializer.Serialize(result, _options);
    }
}
