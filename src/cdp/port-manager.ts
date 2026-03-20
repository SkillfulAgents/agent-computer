import * as net from 'net';

const PORT_RANGE_START = 19200;
const PORT_RANGE_END = 19299;

/** Find a free port in the CDP range by probing for one not in use. */
export async function findFreePort(): Promise<number> {
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available CDP ports in range ${PORT_RANGE_START}-${PORT_RANGE_END}`);
}

/** Check if a port is available by attempting a TCP connection */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);

    socket.on('connect', () => {
      socket.destroy();
      resolve(false); // Port is in use
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(true); // Timeout = nothing listening = available
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(true); // Connection refused = available
    });

    socket.connect(port, '127.0.0.1');
  });
}
