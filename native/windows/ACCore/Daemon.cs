using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using File = System.IO.File;
using Path = System.IO.Path;
using Directory = System.IO.Directory;
using StreamReader = System.IO.StreamReader;
using StreamWriter = System.IO.StreamWriter;

namespace ACCore;

public class DaemonServer
{
    private const string PipeName = "ac-daemon";
    private readonly Dispatcher _dispatcher;
    private bool _running = true;
    private readonly string _acDir;
    private readonly string _daemonJsonPath;

    public DaemonServer(Dispatcher dispatcher)
    {
        _dispatcher = dispatcher;
        _acDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".ac");
        _daemonJsonPath = Path.Combine(_acDir, "daemon.json");
    }

    public void Start()
    {
        Directory.CreateDirectory(_acDir);

        // Write daemon.json
        var daemonInfo = new
        {
            pid = Environment.ProcessId,
            socket = $"\\\\.\\pipe\\{PipeName}",
            started_at = DateTime.UtcNow.ToString("o"),
        };
        File.WriteAllText(_daemonJsonPath, JsonSerializer.Serialize(daemonInfo));

        Console.Error.WriteLine($"[daemon] Listening on \\\\.\\pipe\\{PipeName} (pid {Environment.ProcessId})");

        // Accept connections in a loop
        while (_running)
        {
            try
            {
                var pipeServer = new NamedPipeServerStream(
                    PipeName,
                    PipeDirection.InOut,
                    NamedPipeServerStream.MaxAllowedServerInstances,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

                pipeServer.WaitForConnection();

                // Handle each client in a separate thread
                var clientThread = new Thread(() => HandleClient(pipeServer))
                {
                    IsBackground = true
                };
                clientThread.Start();
            }
            catch (Exception ex)
            {
                if (_running)
                    Console.Error.WriteLine($"[daemon] Accept error: {ex.Message}");
            }
        }
    }

    private void HandleClient(NamedPipeServerStream pipe)
    {
        try
        {
            using (pipe)
            {
                var utf8NoBom = new UTF8Encoding(false);
                var reader = new StreamReader(pipe, utf8NoBom);
                var writer = new StreamWriter(pipe, utf8NoBom) { AutoFlush = true };

                while (pipe.IsConnected)
                {
                    string? line;
                    try
                    {
                        line = reader.ReadLine();
                    }
                    catch
                    {
                        break;
                    }

                    if (line == null) break;
                    if (string.IsNullOrWhiteSpace(line)) continue;

                    RPCResponse response;
                    var request = ProtocolSerializer.ParseRequest(line);

                    if (request == null || string.IsNullOrEmpty(request.Method))
                    {
                        response = RPCResponse.FromError(0, ErrorCodes.InvalidRequest, "Invalid JSON-RPC request");
                    }
                    else
                    {
                        // Handle shutdown specially
                        if (request.Method == "shutdown")
                        {
                            response = RPCResponse.Success(request.Id, new { ok = true });
                            var json = ProtocolSerializer.Serialize(response);
                            try
                            {
                                writer.WriteLine(json);
                                writer.Flush();
                            }
                            catch { }

                            _running = false;
                            Cleanup();
                            Environment.Exit(0);
                            return;
                        }

                        response = _dispatcher.Dispatch(request);
                    }

                    try
                    {
                        var responseJson = ProtocolSerializer.Serialize(response);
                        writer.WriteLine(responseJson);
                    }
                    catch
                    {
                        break; // Client disconnected
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[daemon] Client error: {ex.Message}");
        }
    }

    public void Cleanup()
    {
        try { File.Delete(_daemonJsonPath); } catch { }
    }

    public void Stop()
    {
        _running = false;
        Cleanup();
    }
}
