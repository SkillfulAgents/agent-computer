using System.Text.Json;
using ACCore;

// Entry point for ac-core Windows binary
// Three modes: --daemon, --version, or stdin pipe / CLI args

var cliArgs = Environment.GetCommandLineArgs().Skip(1).ToArray();

// --version
if (cliArgs.Contains("--version"))
{
    Console.WriteLine("0.1.0");
    return 0;
}

var dispatcher = new Dispatcher();

// --daemon mode: start named pipe server
if (cliArgs.Contains("--daemon"))
{
    var server = new DaemonServer(dispatcher);

    // Handle Ctrl+C gracefully
    Console.CancelKeyPress += (_, e) =>
    {
        e.Cancel = true;
        server.Stop();
    };

    // Handle process termination
    AppDomain.CurrentDomain.ProcessExit += (_, _) =>
    {
        server.Cleanup();
    };

    server.Start();
    return 0;
}

// Pipe mode: read JSON-RPC from stdin
if (Console.IsInputRedirected)
{
    var input = Console.In.ReadToEnd().Trim();
    if (string.IsNullOrEmpty(input))
    {
        Console.Error.WriteLine("No input received on stdin");
        return 126;
    }

    var request = ProtocolSerializer.ParseRequest(input);
    if (request == null)
    {
        var errorResp = RPCResponse.FromError(0, ErrorCodes.InvalidRequest, "Invalid JSON-RPC request");
        Console.WriteLine(ProtocolSerializer.Serialize(errorResp));
        return 126;
    }

    var response = dispatcher.Dispatch(request);
    Console.WriteLine(ProtocolSerializer.Serialize(response));

    if (response.Error != null)
        return ErrorCodes.ExitCodeFromErrorCode(response.Error.Code);

    return 0;
}

// CLI mode: build RPC request from command line args
if (cliArgs.Length > 0)
{
    var method = cliArgs[0];
    var paramDict = new Dictionary<string, JsonElement>();

    for (int i = 1; i < cliArgs.Length; i++)
    {
        var arg = cliArgs[i];
        if (arg.Contains('='))
        {
            var parts = arg.Split('=', 2);
            var key = parts[0].TrimStart('-');
            var val = parts[1];

            // Try to parse as JSON value
            try
            {
                paramDict[key] = JsonSerializer.Deserialize<JsonElement>(val);
            }
            catch
            {
                paramDict[key] = JsonSerializer.Deserialize<JsonElement>($"\"{val}\"");
            }
        }
        else if (arg.StartsWith("--"))
        {
            var key = arg[2..];
            // Check if next arg is a value
            if (i + 1 < cliArgs.Length && !cliArgs[i + 1].StartsWith("--"))
            {
                i++;
                try
                {
                    paramDict[key] = JsonSerializer.Deserialize<JsonElement>(cliArgs[i]);
                }
                catch
                {
                    paramDict[key] = JsonSerializer.Deserialize<JsonElement>($"\"{cliArgs[i]}\"");
                }
            }
            else
            {
                paramDict[key] = JsonSerializer.Deserialize<JsonElement>("true");
            }
        }
    }

    var jsonParams = JsonSerializer.Serialize(paramDict);
    var request = new RPCRequest
    {
        Id = 1,
        Method = method,
        Params = JsonSerializer.Deserialize<JsonElement>(jsonParams),
    };

    var response = dispatcher.Dispatch(request);
    Console.WriteLine(ProtocolSerializer.Serialize(response));

    if (response.Error != null)
        return ErrorCodes.ExitCodeFromErrorCode(response.Error.Code);

    return 0;
}

Console.Error.WriteLine("Usage: ac-core [--daemon | --version | <method> [args...]]");
return 126;
