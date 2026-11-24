// Port Meridian entry program (Node 22, standard library only).
//
// It hands the game in: it validates game/ and screenshots/ against the
// gta6-01 caps, copies both trees into the output directory in a fixed
// deterministic order, then writes /output/dossier.json with buildDossier
// from the vendored make.fun library. The two grader runs must produce
// identical bytes, so nothing here depends on time, randomness or the
// environment beyond MAKEFUN_OUTPUT_DIR.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gta6-01 gate caps, checked here before anything is copied so a bad
// tree fails loudly in development instead of silently at grading time.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function listEntries(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listEntries(full, rel));
    else if (st.isFile()) out.push({ rel, bytes: st.size });
  }
  return out;
}

function checkGameTree(gameDir) {
  const files = listEntries(gameDir);
  if (files.length > CAPS.game_max_files) {
    throw new Error(`game/ has ${files.length} files, over the cap of ${CAPS.game_max_files}`);
  }
  const total = files.reduce((sum, f) => sum + f.bytes, 0);
  if (total > CAPS.game_max_bytes) {
    throw new Error(`game/ is ${total} bytes, over the cap of ${CAPS.game_max_bytes}`);
  }
  for (const f of files) {
    if (Buffer.byteLength(f.rel, 'utf8') > CAPS.game_path_max_bytes) {
      throw new Error(`game path too long: ${f.rel}`);
    }
  }
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('game/index.html is missing');
  }
  return { files: files.length, bytes: total };
}

function checkScreenshots(shotsDir) {
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing');
  const names = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
  if (names.length < 3 || names.length > CAPS.screenshots.max) {
    throw new Error(`screenshots/ holds ${names.length} images, need 3 to ${CAPS.screenshots.max}`);
  }
  for (const name of names) {
    const st = statSync(join(shotsDir, name));
    if (!st.isFile()) throw new Error(`screenshot is not a file: ${name}`);
    if (st.size > CAPS.screenshots.max_bytes) {
      throw new Error(`screenshot ${name} is ${st.size} bytes, over ${CAPS.screenshots.max_bytes}`);
    }
    if (!/\.(png|jpe?g)$/i.test(name)) throw new Error(`screenshot has an unsupported extension: ${name}`);
  }
  return names;
}

const gameDir = join(REPO_ROOT, 'game');
const shotsDir = join(REPO_ROOT, 'screenshots');

const gameInfo = checkGameTree(gameDir);
const shotNames = checkScreenshots(shotsDir);

// Start from a clean output directory so stale files can never leak in.
rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

cpSync(gameDir, join(OUTPUT_DIR, 'game'), { recursive: true });
cpSync(shotsDir, join(OUTPUT_DIR, 'screenshots'), { recursive: true });

const dossier = buildDossier(OUTPUT_DIR, CAPS);
writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);

const gameOut = join(OUTPUT_DIR, 'game');
const shotsOut = join(OUTPUT_DIR, 'screenshots');
console.log(`port-meridian: copied game/ (${gameInfo.files} files, ${gameInfo.bytes} bytes)`);
console.log(`port-meridian: copied screenshots/ (${shotNames.join(', ')})`);
console.log(`port-meridian: wrote ${relative(REPO_ROOT, join(OUTPUT_DIR, 'dossier.json'))} (${Buffer.byteLength(dossier, 'utf8')} bytes)`);
console.log(`port-meridian: output ready at ${OUTPUT_DIR} (${listEntries(gameOut).length + shotNames.length + 1} entries)`);
console.log(`port-meridian: caps ok — game ${gameInfo.files}/${CAPS.game_max_files} files, screenshots ${shotNames.length}/${CAPS.screenshots.max}, dossier ${Buffer.byteLength(dossier, 'utf8')} bytes`);
