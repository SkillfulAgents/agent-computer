#!/usr/bin/env node

// Verify the bundled binary matches the current platform/arch
import { platform, arch } from 'os';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binaryPath = join(__dirname, '..', 'bin', 'ac-core');

if (!existsSync(binaryPath)) {
  // No bundled binary — user will need to build from source
  if (platform() === 'darwin') {
    console.log('\n⚠️  ac: No pre-built binary found.');
    console.log('   Build from source: cd native/macos && swift build -c release\n');
  }
  process.exit(0);
}

// Verify the binary runs on this machine
try {
  execFileSync(binaryPath, ['--version'], { timeout: 5000, stdio: 'pipe' });
} catch (err) {
  if (platform() !== 'darwin') {
    console.log('\n⚠️  ac: This package only supports macOS.\n');
  } else {
    console.log(`\n⚠️  ac: Bundled binary may not match your architecture (${arch()}).`);
    console.log('   Rebuild from source: cd native/macos && swift build -c release\n');
  }
}
