#!/usr/bin/env node

// Verify a bundled binary exists for the current platform/arch
import { platform, arch } from 'os';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const os = platform();
const cpu = arch() === 'arm64' ? 'arm64' : 'x64';
const ext = os === 'win32' ? '.exe' : '';
const key = `${os}-${cpu}`;
const binaryPath = join(__dirname, '..', 'bin', `ac-core-${key}${ext}`);

if (!existsSync(binaryPath)) {
  const buildHint = os === 'win32'
    ? 'cd native/windows && dotnet build'
    : 'cd native/macos && swift build -c release';
  console.log(`\n⚠️  ac: No pre-built binary found for ${key}.`);
  console.log(`   Build from source: ${buildHint}\n`);
} else {
  // Verify the binary runs on this machine
  try {
    execFileSync(binaryPath, ['--version'], { timeout: 5000, stdio: 'pipe' });
  } catch (err) {
    console.log(`\n⚠️  ac: Bundled binary for ${key} failed to execute.`);
    const buildHint = os === 'win32'
      ? 'cd native/windows && dotnet build'
      : 'cd native/macos && swift build -c release';
    console.log(`   Rebuild from source: ${buildHint}\n`);
  }
}

// Install shell completions
try {
  const acJs = join(__dirname, '..', 'dist', 'bin', 'ac.js');
  if (existsSync(acJs)) {
    execFileSync(process.execPath, [acJs, 'completion', 'install'],
      { timeout: 5000, stdio: 'inherit' });
  }
} catch {}

