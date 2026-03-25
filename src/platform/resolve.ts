import { platform, arch } from 'os';
import { join, dirname } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// ESM: use import.meta.url directly (CJS build patches this line — see scripts/fix-cjs-resolve.js)
// @ts-ignore — import.meta.url is valid in ESM; CJS tsconfig rejects it but post-build script fixes it
const _dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Find the package root by walking up from __dirname until we find a real package.json
 * (one with a "name" field, not just a CJS marker like {"type":"commonjs"}).
 * Works whether running from source (src/platform/) or compiled (dist/src/platform/).
 */
function findProjectRoot(): string {
  let dir = _dirname;
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name) return dir;
      } catch {
        // Ignore parse errors
      }
    }
    dir = dirname(dir);
  }
  return join(_dirname, '..', '..');
}

export function resolveBinary(): string {
  const os = platform();
  const cpu = arch();

  if (os !== 'darwin' && os !== 'win32') {
    throw new Error(`Unsupported platform: ${os}. agent-computer supports macOS and Windows.`);
  }

  const ext = os === 'win32' ? '.exe' : '';
  const key = `${os}-${cpu === 'arm64' ? 'arm64' : 'x64'}`;
  const projectRoot = findProjectRoot();

  // Bundled platform-specific binary (npm package)
  const bundledPath = join(projectRoot, 'bin', `ac-core-${key}${ext}`);
  if (existsSync(bundledPath)) {
    return bundledPath;
  }

  if (os === 'darwin') {
    // Development: locally-built Swift binary (release)
    const devBinaryPath = join(projectRoot, 'native', 'macos', '.build', 'release', 'ac-core');
    if (existsSync(devBinaryPath)) return devBinaryPath;

    // Development: Swift debug build
    const debugBinaryPath = join(projectRoot, 'native', 'macos', '.build', 'debug', 'ac-core');
    if (existsSync(debugBinaryPath)) return debugBinaryPath;
  }

  if (os === 'win32') {
    const rid = cpu === 'arm64' ? 'win-arm64' : 'win-x64';
    const tfms = ['net9.0-windows', 'net9.0'];
    const base = join(projectRoot, 'native', 'windows', 'ACCore', 'bin');

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

  const buildHint = os === 'win32'
    ? 'cd native/windows && dotnet build'
    : 'cd native/macos && swift build -c release';
  throw new Error(
    `Native binary not found for ${key}. ` +
    `Build from source: ${buildHint}`,
  );
}
