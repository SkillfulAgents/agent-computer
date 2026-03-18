// Daemon lifecycle management — stub for Phase 0
// Full implementation in Phase 2

export class DaemonManager {
  async start(): Promise<void> {
    throw new Error('Not implemented yet');
  }

  async stop(): Promise<void> {
    throw new Error('Not implemented yet');
  }

  async status(): Promise<{ running: boolean; pid?: number; uptime_ms?: number }> {
    throw new Error('Not implemented yet');
  }

  async restart(): Promise<void> {
    throw new Error('Not implemented yet');
  }
}
