// Creates the upload zips for cPanel File Manager from site/ (without README.md). Windows.
// Both go in upload/:
//   digital-mom-upload.zip  the whole site
//   digital-mom-update.zip  only the files that differ from what is live (listed in upload-manifest.json)
// After uploading, run `npm run pack -- --uploaded` so the next update zip is measured from the new live state.
// Copies to a temp folder first so a running preview server cannot lock files during zipping.
import { rm, cp, mkdtemp, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(root, 'upload'); // ready-to-upload zips live here
await mkdir(uploadDir, { recursive: true });
const zip = path.join(uploadDir, 'digital-mom-upload.zip');
const updateZip = path.join(uploadDir, 'digital-mom-update.zip');
const manifestFile = path.join(root, 'upload-manifest.json');
const tar = path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe');
// Windows' bsdtar writes forward-slash zip paths (PowerShell 5.1 Compress-Archive writes backslashes, which break on Linux hosts).
const makeZip = (target, dir, entries = ['.']) => execFileSync(tar, ['-a', '-c', '-f', target, '-C', dir, ...entries], { stdio: 'inherit' });

const stage = await mkdtemp(path.join(tmpdir(), 'dm-pack-'));
await cp(path.join(root, 'site'), stage, { recursive: true, filter: src => path.basename(src) !== 'README.md' && !['preview-config.php', 'sheet-config.php'].includes(path.basename(src)) });
try {
  // Team preview (maintenance mode): the password hash and token from preview-secret.json (gitignored) go into the
  // zips only, never into site/ or git. See preview-password.mjs.
  const site = JSON.parse(await readFile(path.join(root, 'src', 'site.json'), 'utf8'));
  let secret = null;
  try { secret = JSON.parse(await readFile(path.join(root, 'preview-secret.json'), 'utf8')); } catch { /* no password set yet */ }
  if (secret && !(/^\$(2y|argon2)[\w$./+=,-]+$/.test(secret.hash) && /^[0-9a-f]{64}$/.test(secret.token))) throw new Error('preview-secret.json is damaged: run `npm run preview-password` again.');
  if (site.maintenance && !secret) throw new Error('Maintenance mode is on but no Team preview password is set: run `npm run preview-password` first.');
  const htaccess = path.join(stage, '.htaccess');
  await writeFile(htaccess, (await readFile(htaccess, 'utf8')).replace('{{preview_token}}', secret ? secret.token : randomBytes(32).toString('hex')));
  // Enquiry Sheet (google/enquiries.gs): the web app link and key from sheet-secret.json (gitignored), zip only.
  let sheet = null;
  try { sheet = JSON.parse(await readFile(path.join(root, 'sheet-secret.json'), 'utf8')); } catch { /* not set up: enquiries are emailed only */ }
  if (sheet?.url) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(sheet.url) || !/^[0-9a-f]{64}$/.test(sheet.key)) throw new Error('sheet-secret.json is damaged: it needs the Apps Script /exec link and the 64-character key.');
    await writeFile(path.join(stage, 'sheet-config.php'),
      `<?php\n// Enquiry Sheet settings, written by pack.mjs from sheet-secret.json. See google/enquiries.gs.\nreturn ['url' => '${sheet.url}', 'key' => '${sheet.key}'];\n`);
  }
  if (secret) await writeFile(path.join(stage, 'preview-config.php'),
    `<?php\n// Team preview login settings, written by pack.mjs. Change with \`npm run preview-password\`.\nreturn ['hash' => '${secret.hash}', 'token' => '${secret.token}'];\n`);

  const files = (await readdir(stage, { recursive: true, withFileTypes: true })).filter(e => e.isFile())
    .map(e => path.relative(stage, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join('/')).sort();
  const current = {};
  for (const f of files) current[f] = createHash('sha1').update(await readFile(path.join(stage, f))).digest('hex');

  await rm(zip, { force: true });
  makeZip(zip, stage);
  console.log('created', zip);

  if (process.argv.includes('--uploaded')) {
    await writeFile(manifestFile, JSON.stringify(current, null, 2) + '\n');
    console.log('marked as live: the next update zip starts from here');
  } else {
    let live = null;
    try { live = JSON.parse(await readFile(manifestFile, 'utf8')); } catch { /* no record yet: everything counts as changed */ }
    const changed = files.filter(f => !live || live[f] !== current[f]);
    const removed = live ? Object.keys(live).filter(f => !(f in current)) : [];
    await rm(updateZip, { force: true });
    if (changed.length) {
      const upd = await mkdtemp(path.join(tmpdir(), 'dm-update-'));
      try {
        for (const f of changed) { await mkdir(path.dirname(path.join(upd, f)), { recursive: true }); await cp(path.join(stage, f), path.join(upd, f)); }
        makeZip(updateZip, upd);
      } finally { await rm(upd, { recursive: true, force: true }); }
      console.log(`created ${updateZip} with ${changed.length} changed file(s):`);
      for (const f of changed) console.log('  ' + f);
    } else console.log('nothing changed since the last upload: no update zip');
    if (removed.length) { console.log('no longer used on the site (you can delete these on the server):'); for (const f of removed) console.log('  ' + f); }
  }
} finally {
  await rm(stage, { recursive: true, force: true });
}
