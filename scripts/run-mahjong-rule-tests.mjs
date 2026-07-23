/**
 * Headless runner for mahjong/rule-tests.js (no real DOM; uses node-dom-shim).
 * Usage:
 *   node --import ./scripts/strip-query-loader.mjs --import ./scripts/node-dom-shim.mjs ./scripts/run-mahjong-rule-tests.mjs
 */
import "./node-dom-shim.mjs";
import {pathToFileURL} from "node:url";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ruleTestsUrl = pathToFileURL(path.join(root, "mahjong", "rule-tests.js")).href;

const {runRuleTests} = await import(ruleTestsUrl);
const result = runRuleTests();

for (const line of result.lines) {
  console.log(line);
}

console.log("");
console.log(
  `Mahjong rule-tests: passed=${result.passed} failed=${result.failed} blocked=${result.blocked} ok=${result.ok}`
);

if (!result.ok) {
  process.exitCode = 1;
}
