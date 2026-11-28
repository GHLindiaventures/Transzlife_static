// `npm run dev:api`: runs server/index.js and restarts it when a file in server/ changes.
//
// Why not `node --watch`: on Windows it also restarted on changes outside server/ (node_modules,
// even the local database folder data/pglite) and it kills the server outright. A local PGlite
// database that is killed mid-write often cannot be opened again. This script asks the server to
// close the database first (IPC "shutdown"), waits for it to exit, then starts it again.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DIR = join(ROOT, 'server');
const ARGS = ['--env-file-if-exists=.env', '--env-file-if-exists=.env.local', 'server/index.js'];
const WATCHED = /\.(js|mjs|cjs|json|sql)$/i;

let child = null;
let restarting = false;
let quitting = false;
let timer = null;

function start() {
  child = spawn(process.execPath, ARGS, { cwd: ROOT, stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
  child.on('exit', (code) => {
    child = null;
    if (quitting) process.exit(code ?? 0);
    if (restarting) { restarting = false; start(); return; }
    console.log(`[dev-api] server exited (code ${code}). Waiting for a change in server/ to start it again.`);
  });
}

// ask the server to close cleanly; kill it only if it does not exit in time
function stop() {
  if (!child) return;
  const c = child;
  try { c.send('shutdown'); } catch { c.kill(); }
  setTimeout(() => { if (child === c) c.kill(); }, 10000).unref();
}

function restart(file) {
  console.log(`[dev-api] ${file} changed, restarting the server...`);
  if (!child) { start(); return; }
  restarting = true;
  stop();
}

watch(SERVER_DIR, { recursive: true }, (_event, file) => {
  if (!file || !WATCHED.test(file)) return;
  clearTimeout(timer);
  timer = setTimeout(() => restart(join('server', file)), 300);
});

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(sig, () => {
    quitting = true;
    if (!child) process.exit(0);
    stop();
  });
}

start();
