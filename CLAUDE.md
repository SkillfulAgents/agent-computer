# Agent Computer

## Build & Test (macOS)

After making changes to Swift code in `native/macos/`:

```bash
# Rebuild
cd native/macos && swift build -c release

# Restart daemon (kill old, start new)
kill $(python3 -c "import json; print(json.load(open('$HOME/.ac/daemon.json'))['pid'])")
sleep 1
./native/macos/.build/release/ac-core --daemon &disown
```

The daemon listens on `~/.ac/daemon.sock` and writes its PID to `~/.ac/daemon.json`.
