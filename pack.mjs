// Creates digital-mom-upload.zip from site/ (without README.md) for cPanel File Manager. Windows PowerShell.
// Copies to a temp folder first so a running preview server cannot lock files during zipping.
import { rm, cp, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const zip = path.join(root, 'digital-mom-upload.zip');
const stage = await mkdtemp(path.join(tmpdir(), 'dm-pack-'));
await cp(path.join(root, 'site'), stage, { recursive: true, filter: src => path.basename(src) !== 'README.md' });
await rm(zip, { force: true });
try {
  // Windows' bsdtar writes forward-slash zip paths (PowerShell 5.1 Compress-Archive writes backslashes, which break on Linux hosts).
  execFileSync(path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe'), ['-a', '-c', '-f', zip, '-C', stage, '.'], { stdio: 'inherit' });
} finally {
  await rm(stage, { recursive: true, force: true });
}
console.log('created', zip);
