"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBinary = resolveBinary;
const os_1 = require("os");
const path_1 = require("path");
const fs_1 = require("fs");
// ESM: use import.meta.url directly (CJS build patches this line — see scripts/fix-cjs-resolve.js)
// @ts-ignore — import.meta.url is valid in ESM; CJS tsconfig rejects it but post-build script fixes it
const _dirname = __dirname;
/**
 * Find the package root by walking up from __dirname until we find a real package.json
 * (one with a "name" field, not just a CJS marker like {"type":"commonjs"}).
 * Works whether running from source (src/platform/) or compiled (dist/src/platform/).
 */
function findProjectRoot() {
    let dir = _dirname;
    for (let i = 0; i < 10; i++) {
        const pkgPath = (0, path_1.join)(dir, 'package.json');
        if ((0, fs_1.existsSync)(pkgPath)) {
            try {
                const pkg = JSON.parse((0, fs_1.readFileSync)(pkgPath, 'utf-8'));
                if (pkg.name)
                    return dir;
            }
            catch {
                // Ignore parse errors
            }
        }
        dir = (0, path_1.dirname)(dir);
    }
    return (0, path_1.join)(_dirname, '..', '..');
}
function resolveBinary() {
    const os = (0, os_1.platform)();
    const cpu = (0, os_1.arch)();
    if (os !== 'darwin' && os !== 'win32') {
        throw new Error(`Unsupported platform: ${os}. agent-computer supports macOS and Windows.`);
    }
    const ext = os === 'win32' ? '.exe' : '';
    const key = `${os}-${cpu === 'arm64' ? 'arm64' : 'x64'}`;
    const projectRoot = findProjectRoot();
    // Bundled platform-specific binary (npm package)
    const bundledPath = (0, path_1.join)(projectRoot, 'bin', `ac-core-${key}${ext}`);
    if ((0, fs_1.existsSync)(bundledPath)) {
        return bundledPath;
    }
    if (os === 'darwin') {
        // Development: locally-built Swift binary (release)
        const devBinaryPath = (0, path_1.join)(projectRoot, 'native', 'macos', '.build', 'release', 'ac-core');
        if ((0, fs_1.existsSync)(devBinaryPath))
            return devBinaryPath;
        // Development: Swift debug build
        const debugBinaryPath = (0, path_1.join)(projectRoot, 'native', 'macos', '.build', 'debug', 'ac-core');
        if ((0, fs_1.existsSync)(debugBinaryPath))
            return debugBinaryPath;
    }
    if (os === 'win32') {
        const rid = cpu === 'arm64' ? 'win-arm64' : 'win-x64';
        const tfms = ['net9.0-windows', 'net9.0'];
        const base = (0, path_1.join)(projectRoot, 'native', 'windows', 'ACCore', 'bin');
        for (const tfm of tfms) {
            // Development: self-contained release publish
            const publishPath = (0, path_1.join)(base, 'Release', tfm, rid, 'publish', 'ac-core.exe');
            if ((0, fs_1.existsSync)(publishPath))
                return publishPath;
            // Development: release build (framework-dependent)
            const releasePath = (0, path_1.join)(base, 'Release', tfm, 'ac-core.exe');
            if ((0, fs_1.existsSync)(releasePath))
                return releasePath;
            // Development: debug build (framework-dependent)
            const debugPath = (0, path_1.join)(base, 'Debug', tfm, 'ac-core.exe');
            if ((0, fs_1.existsSync)(debugPath))
                return debugPath;
        }
    }
    const buildHint = os === 'win32'
        ? 'cd native/windows && dotnet build'
        : 'cd native/macos && swift build -c release';
    throw new Error(`Native binary not found for ${key}. ` +
        `Build from source: ${buildHint}`);
}
