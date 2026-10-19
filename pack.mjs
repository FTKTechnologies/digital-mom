// Creates the upload zips for cPanel File Manager from site/ (without README.md). Windows.
// Both go in upload/:
//   digital-mom-upload.zip  the whole site
//   digital-mom-update.zip  only the files that differ from what is live (listed in upload-manifest.json)
// After uploading, run `npm run pack -- --uploaded` so the next update zip is measured from the new live state.
// Copies to a temp folder first so a running preview server cannot lock files during zipping.
import { rm, cp, mkdtemp, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
await cp(path.join(root, 'site'), stage, { recursive: true, filter: src => path.basename(src) !== 'README.md' });
try {
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
