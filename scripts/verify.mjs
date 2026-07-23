/**
 * Nocturne Games verify (no npm / no bundler).
 *
 * Checks:
 *  1. smoke — critical files exist; SW precache paths resolve on disk
 *  2. test:unit — mahjong rule-tests headless
 *
 * Not applicable by design (see docs/04_decisions.md):
 *  - lint (no ESLint / npm)
 *  - typecheck (no TypeScript)
 *  - test:e2e (manual / localhost UI; tracked as TODO)
 *  - build (static GitHub Pages; smoke substitutes)
 *
 * Usage:
 *   node --import ./scripts/strip-query-loader.mjs ./scripts/verify.mjs
 *   # or: node ./scripts/verify.mjs   (auto-registers loader when supported)
 */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {spawnSync} from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const notes = [];

function existsRel(rel) {
  return fs.existsSync(path.join(root, rel));
}

function fail(msg) {
  failures.push(msg);
  console.error(`FAIL  ${msg}`);
}

function ok(msg) {
  console.log(`PASS  ${msg}`);
}

function section(title) {
  console.log("");
  console.log(`== ${title} ==`);
}

section("smoke: critical files");
const required = [
  "index.html",
  "manifest.webmanifest",
  "service-worker.js",
  "shared/pwa.js",
  "shared/base.css",
  "mahjong/index.html",
  "mahjong/game.js",
  "mahjong/render.js",
  "mahjong/hu.js",
  "mahjong/score.js",
  "mahjong/rule-tests.js",
  "mahjong/style.css",
  "chess/index.html",
  "docs/Nocturne_Games_Project_Guide.md",
  "docs/00_project_handoff.md",
  ".cursor/rules/nocturne-games-guide.mdc",
  ".cursor/rules/development-workflow.mdc"
];
for (const rel of required) {
  if (existsRel(rel)) ok(rel);
  else fail(`missing ${rel}`);
}

section("smoke: service-worker precache");
const swPath = path.join(root, "service-worker.js");
const swText = fs.readFileSync(swPath, "utf8");
const cacheMatch = swText.match(/const\s+CACHE\s*=\s*"([^"]+)"/);
if (cacheMatch) ok(`CACHE=${cacheMatch[1]}`);
else fail("service-worker.js missing CACHE constant");

const precacheBlock = swText.match(/const\s+PRECACHE\s*=\s*\[([\s\S]*?)\];/);
if (!precacheBlock) {
  fail("service-worker.js missing PRECACHE array");
} else {
  const entries = [...precacheBlock[1].matchAll(/"(\.\/[^"]+)"/g)].map((m) => m[1]);
  let missing = 0;
  for (const entry of entries) {
    const filePart = entry.replace(/^\.\//, "").replace(/\?.*$/, "");
    if (!existsRel(filePart)) {
      fail(`precache missing on disk: ${entry} -> ${filePart}`);
      missing++;
    }
  }
  if (missing === 0) ok(`precache files present (${entries.length})`);
}

section("skipped by design");
notes.push("lint: no ESLint (Guide forbids npm toolchain)");
notes.push("typecheck: no TypeScript (Guide forbids TS)");
notes.push("test:e2e: UI/layout/PWA still manual (localhost + device)");
notes.push("build: static site; smoke + unit substitute for CI gate");
for (const n of notes) console.log(`SKIP  ${n}`);

section("test:unit mahjong rule-tests");
const node = process.execPath;
const loader = path.join(root, "scripts", "strip-query-loader.mjs");
const runner = path.join(root, "scripts", "run-mahjong-rule-tests.mjs");
const run = spawnSync(
  node,
  [
    "--import",
    pathToFileURL(loader).href,
    "--import",
    pathToFileURL(path.join(root, "scripts", "node-dom-shim.mjs")).href,
    runner
  ],
  {cwd: root, encoding: "utf8"}
);
if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);
if (run.status !== 0) {
  fail(`mahjong rule-tests exited ${run.status}`);
} else {
  ok("mahjong rule-tests");
}

section("summary");
if (failures.length) {
  console.error(`VERIFY FAILED (${failures.length})`);
  for (const f of failures) console.error(` - ${f}`);
  process.exitCode = 1;
} else {
  console.log("VERIFY OK");
}
