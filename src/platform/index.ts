import { join } from 'path';
import { homedir, platform } from 'os';

const os = platform();

export const AC_DIR = join(homedir(), '.ac');
export const DAEMON_JSON_PATH = join(AC_DIR, 'daemon.json');
export const SNAPSHOTS_DIR = join(AC_DIR, 'snapshots');

// macOS: Unix domain socket file on disk
// Windows: Named pipe (kernel object, no file on disk)
export const SOCKET_PATH = os === 'win32'
  ? '\\\\.\\pipe\\ac-daemon'
  : join(AC_DIR, 'daemon.sock');

// Named pipes don't exist as files — connection-based detection needed
export const IS_NAMED_PIPE = os === 'win32';
