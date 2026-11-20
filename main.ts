import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

console.log('[make.fun] Starting release staging for Vice Coast 3D...');

mkdirSync(out, { recursive: true });

console.log('[make.fun] Staging game directory...');
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

const screenshotsDir = join(here, 'screenshots');
if (existsSync(screenshotsDir)) {
  console.log('[make.fun] Staging screenshots directory...');
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  cpSync(screenshotsDir, join(out, 'screenshots'), { recursive: true });
}

console.log('[make.fun] Generating game dossier...');
const dossier = await buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(out, 'dossier.json'), JSON.stringify(dossier, null, 2), 'utf8');

const timestamp = new Date().toISOString();
console.log(`[make.fun] [${timestamp}] Vice Coast 3D production release verified and successfully staged to: ${out}`);
