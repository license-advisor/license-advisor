import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  handleCheckDependency,
  handleExplainFinding,
  handleGetDependencyPath,
  handleGetProjectContext,
  handleScanProject,
} from "./tools.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "../../fixtures/saas-agpl");

function parsePayload(result: {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}) {
  assert.equal(result.isError, undefined);
  return JSON.parse(result.content[0]?.text ?? "{}") as Record<string, unknown>;
}

const scan = await handleScanProject({
  project_root: fixtureRoot,
  context_path: join(fixtureRoot, "project-context.yaml"),
  lockfile_path: join(fixtureRoot, "package-lock.json"),
});
const scanPayload = parsePayload(scan);
const summary = scanPayload.summary as {
  red_flag: number;
  notice: number;
};
assert.ok(summary.red_flag >= 1);
assert.ok(summary.notice >= 1);

const explained = await handleExplainFinding({
  project_root: fixtureRoot,
  context_path: join(fixtureRoot, "project-context.yaml"),
  lockfile_path: join(fixtureRoot, "package-lock.json"),
  package_name: "agpl-lib",
});
const explainedPayload = parsePayload(explained);
const explanations = explainedPayload.explanations as Array<{ text: string }>;
assert.ok(explanations.length >= 1);
assert.ok(explanations[0]?.text.includes("AGPL"));
assert.ok(explanations[0]?.text.includes("not invent"));

const pathResult = await handleGetDependencyPath({
  project_root: fixtureRoot,
  lockfile_path: join(fixtureRoot, "package-lock.json"),
  package_name: "agpl-lib",
});
const pathPayload = parsePayload(pathResult);
const matches = pathPayload.matches as Array<{ path: string[] }>;
assert.deepEqual(matches[0]?.path, [
  "fixture-saas-agpl",
  "plugin-x",
  "agpl-lib",
]);

const check = await handleCheckDependency({
  project_root: fixtureRoot,
  context_path: join(fixtureRoot, "project-context.yaml"),
  lockfile_path: join(fixtureRoot, "package-lock.json"),
  package_name: "agpl-lib",
});
const checkPayload = parsePayload(check);
const findings = checkPayload.findings as unknown[];
assert.ok(findings.length >= 1);

const context = await handleGetProjectContext({
  project_root: fixtureRoot,
  context_path: join(fixtureRoot, "project-context.yaml"),
});
const contextPayload = parsePayload(context);
assert.ok(contextPayload.context);

console.log("mcp tool checks passed");
console.log(
  JSON.stringify(
    {
      summary,
      explainedPreview: explanations[0]?.text.split("\n").slice(0, 6),
      path: matches[0]?.path,
    },
    null,
    2,
  ),
);
