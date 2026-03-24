/**
 * Post-build script: patch the CJS resolve.js to use __dirname instead of import.meta.url.
 * The ESM build uses import.meta.url directly, but CJS can't parse it.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '..', 'dist-cjs', 'src', 'platform', 'resolve.js');

let content = readFileSync(filePath, 'utf-8');

// Replace the ESM __dirname computation with the CJS global
content = content.replace(
  /const _dirname = .*fileURLToPath.*import\.meta\.url.*\);/,
  'const _dirname = __dirname;'
);

// Remove the url import since we no longer need fileURLToPath
content = content.replace(
  /const url_1 = require\("url"\);\n?/,
  ''
);

writeFileSync(filePath, content);
console.log('Patched dist-cjs/src/platform/resolve.js for CJS compatibility');
