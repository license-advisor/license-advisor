import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectContext } from "../context.js";
import { loadLicenseScan } from "../licenses/index.js";
import { evaluatePolicy } from "./engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, "../../fixtures/saas-agpl");

const contextResult = loadProjectContext(
  fixtureDir,
  join(fixtureDir, "project-context.yaml"),
);
assert.equal(contextResult.ok, true);
if (!contextResult.ok) throw new Error("context invalid");

const { graph, licenses } = loadLicenseScan(
  fixtureDir,
  join(fixtureDir, "package-lock.json"),
);

const result = evaluatePolicy({
  context: contextResult.context,
  graph,
  licenses,
  contextPath: contextResult.path,
});

assert.ok(result.summary.red_flag >= 1);
assert.ok(result.summary.notice >= 1);
assert.equal(result.summary.review_required, 0);
assert.equal(result.summary.conflict, 0);
assert.ok(result.summary.clear >= 2);

const agpl = result.findings.find(
  (f) => f.rule_id === "AGPL_NETWORK_001" && f.dependency.name === "agpl-lib",
);
assert.ok(agpl);
assert.equal(agpl.outcome, "red_flag");
assert.deepEqual(agpl.dependency.dependency_path, [
  "fixture-saas-agpl",
  "plugin-x",
  "agpl-lib",
]);
assert.ok(agpl.assumptions.some((a) => a.includes("network_access=true")));
assert.ok(agpl.limits.some((l) => l.includes("not a legal determination")));

const apache = result.findings.find(
  (f) => f.rule_id === "APACHE_NOTICE_001" && f.dependency.name === "apache-helper",
);
assert.ok(apache);
assert.equal(apache.outcome, "notice");

assert.equal(result.exitHint.shouldWarn, true);
assert.equal(result.exitHint.shouldFail, false);

// Internal context should not raise AGPL network red flag the same way if network false + not closed? 
// Actually AGPL rule needs network_access=true AND source_visibility=closed.
const internal = structuredClone(contextResult.context);
internal.project.delivery = "internal_only";
internal.project.network_access = false;
internal.project.commercial = "no";

const internalResult = evaluatePolicy({
  context: internal,
  graph,
  licenses,
  contextPath: contextResult.path,
});

assert.equal(
  internalResult.findings.some((f) => f.rule_id === "AGPL_NETWORK_001"),
  false,
);

console.log("policy fixture checks passed");
console.log(
  JSON.stringify(
    {
      summary: result.summary,
      highest: result.highestPriority.map((f) => ({
        outcome: f.outcome,
        pkg: `${f.dependency.name}@${f.dependency.version}`,
        rule: f.rule_id,
        path: f.dependency.dependency_path.join(" → "),
      })),
      exit: result.exitHint,
    },
    null,
    2,
  ),
);
