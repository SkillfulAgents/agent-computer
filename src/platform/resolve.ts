import { platform, arch } from 'os';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function resolveBinary(): string {
  const os = platform();
  const cpu = arch();

  if (os !== 'darwin' && os !== 'win32') {
    throw new Error(`Unsupported platform: ${os}. ac supports macOS and Windows.`);
  }

  // In development: look for the locally-built binary
  const devBinaryPath = join(__dirname, '..', '..', 'native', 'macos', '.build', 'release', 'ac-core');
  if (existsSync(devBinaryPath)) {
    return devBinaryPath;
  }

  // Also check debug build
  const debugBinaryPath = join(__dirname, '..', '..', 'native', 'macos', '.build', 'debug', 'ac-core');
  if (existsSync(debugBinaryPath)) {
    return debugBinaryPath;
  }

  // In production: look for the npm optional dependency
  const key = `${os}-${cpu === 'arm64' ? 'arm64' : 'x64'}`;
  const PLATFORM_MAP: Record<string, string> = {
    'darwin-arm64': '@datawizz/ac-darwin-arm64',
    'darwin-x64': '@datawizz/ac-darwin-x64',
    'win32-x64': '@datawizz/ac-win32-x64',
    'win32-arm64': '@datawizz/ac-win32-arm64',
  };

  const pkg = PLATFORM_MAP[key];
  if (!pkg) {
    throw new Error(`Unsupported platform/arch: ${key}`);
  }

  try {
    const require = createRequire(import.meta.url);
    const pkgDir = require.resolve(`${pkg}/package.json`);
    const ext = os === 'win32' ? '.exe' : '';
    return join(dirname(pkgDir), 'bin', `ac-core${ext}`);
  } catch {
    throw new Error(
      `Native binary not found for ${key}. ` +
      `Run: npm install ${pkg}\n` +
      `Or build from source: cd native/macos && swift build -c release`,
    );
  }
}
