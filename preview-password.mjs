// Sets the shared Team preview password for maintenance mode: `npm run preview-password`.
// Asks for the password twice (nothing is shown while typing), then writes preview-secret.json (gitignored) with a
// bcrypt hash made by PHP and a fresh random token. pack.mjs puts both into the upload zips. Run `npm run pack`
// afterwards and upload the update zip; every earlier preview pass stops working.
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

const ask = question => new Promise(resolve => {
  process.stdout.write(question);
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  let value = '';
  const onData = chunk => {
    for (const ch of chunk) {
      if (ch === '\r' || ch === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', onData); process.stdout.write('\n'); return resolve(value); }
      if (ch === '\u0003') { process.stdout.write('\n'); process.exit(1); }
      if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
      else value += ch;
    }
  };
  stdin.on('data', onData);
});

if (!process.stdin.isTTY) { console.error('Run this in a terminal: npm run preview-password'); process.exit(1); }
const password = await ask('New Team preview password (at least 12 characters): ');
if (password.length < 12) { console.error('Too short. Use at least 12 characters, for example three random words.'); process.exit(1); }
if (await ask('Type it again: ') !== password) { console.error('The two passwords do not match. Nothing was changed.'); process.exit(1); }

const hash = execFileSync('php', ['-r', 'echo password_hash(stream_get_contents(STDIN), PASSWORD_DEFAULT);'], { input: password }).toString().trim();
if (!hash.startsWith('$2y$') && !hash.startsWith('$argon')) { console.error('PHP could not hash the password. Nothing was changed.'); process.exit(1); }
const secretFile = path.join(root, 'preview-secret.json');
await writeFile(secretFile, JSON.stringify({ hash, token: randomBytes(32).toString('hex') }, null, 2) + '\n');
console.log(`Saved to ${secretFile}`);
console.log('Now run `npm run pack` and upload the update zip. Share the password privately with the team.');
