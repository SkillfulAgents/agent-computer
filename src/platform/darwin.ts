import { join } from 'path';
import { homedir } from 'os';

export const AC_DIR = join(homedir(), '.ac');
export const SOCKET_PATH = join(AC_DIR, 'daemon.sock');
export const DAEMON_JSON_PATH = join(AC_DIR, 'daemon.json');
export const SNAPSHOTS_DIR = join(AC_DIR, 'snapshots');
