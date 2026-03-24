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

  const ext = os === 'win32' ? '.exe' : '';

  // Bundled binary (release package)
  const bundledPath = join(__dirname, '..', '..', 'bin', `ac-core${ext}`);
  if (existsSync(bundledPath)) {
    return bundledPath;
  }

  if (os === 'darwin') {
    // Development: locally-built Swift binary (release)
    const devBinaryPath = join(__dirname, '..', '..', 'native', 'macos', '.build', 'release', 'ac-core');
    if (existsSync(devBinaryPath)) return devBinaryPath;

    // Development: Swift debug build
    const debugBinaryPath = join(__dirname, '..', '..', 'native', 'macos', '.build', 'debug', 'ac-core');
    if (existsSync(debugBinaryPath)) return debugBinaryPath;
  }

  if (os === 'win32') {
    const rid = cpu === 'arm64' ? 'win-arm64' : 'win-x64';
    const tfms = ['net9.0-windows', 'net9.0'];
    const base = join(__dirname, '..', '..', 'native', 'windows', 'ACCore', 'bin');

    for (const tfm of tfms) {
      // Development: self-contained release publish
      const publishPath = join(base, 'Release', tfm, rid, 'publish', 'ac-core.exe');
      if (existsSync(publishPath)) return publishPath;

      // Development: release build (framework-dependent)
      const releasePath = join(base, 'Release', tfm, 'ac-core.exe');
      if (existsSync(releasePath)) return releasePath;

      // Development: debug build (framework-dependent)
      const debugPath = join(base, 'Debug', tfm, 'ac-core.exe');
      if (existsSync(debugPath)) return debugPath;
    }
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
    return join(dirname(pkgDir), 'bin', `ac-core${ext}`);
  } catch {
    const buildHint = os === 'win32'
      ? 'cd native/windows && dotnet build'
      : 'cd native/macos && swift build -c release';
    throw new Error(
      `Native binary not found for ${key}. ` +
      `Run: npm install ${pkg}\n` +
      `Or build from source: ${buildHint}`,
    );
  }
}
