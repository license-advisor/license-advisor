import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDependencyGraphFromLockfile } from "../graph/npm-lockfile.js";
import {
  detectLicenseFromText,
  normalizeToSpdx,
  resolveLicensesForGraph,
} from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
const lockfile = join(here, "../../fixtures/npm/package-lock.json");

// --- normalize ---
assert.equal(normalizeToSpdx("MIT").value, "MIT");
assert.equal(normalizeToSpdx("mit").value, "MIT");
assert.equal(normalizeToSpdx("Apache License 2.0").value, "Apache-2.0");
assert.equal(normalizeToSpdx("AGPL-3.0").value, "AGPL-3.0-only");
assert.equal(normalizeToSpdx("bsd").value, undefined);
assert.ok(normalizeToSpdx("bsd").note?.includes("ambiguous"));

const expression = normalizeToSpdx("MIT OR Apache-2.0");
assert.equal(expression.isExpression, true);
assert.equal(expression.value, "MIT OR Apache-2.0");

assert.equal(
  detectLicenseFromText(
    "Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/",
  ).value,
  "Apache-2.0",
);

// --- resolve against fixture ---
const graph = buildDependencyGraphFromLockfile(lockfile);
const scan = resolveLicensesForGraph(graph);

assert.equal(scan.stats.total, 9);

const express = scan.resolutions.find((r) => r.packageName === "express");
assert.ok(express);
assert.equal(express.status, "resolved");
assert.equal(express.concluded, "MIT");
assert.ok(express.evidence.some((e) => e.type === "lockfile"));
assert.ok(express.evidence.some((e) => e.type === "package_metadata"));
assert.ok(express.evidence.some((e) => e.type === "license_file_detection"));

const conflict = scan.resolutions.find((r) => r.packageName === "conflict-lib");
assert.ok(conflict);
assert.equal(conflict.status, "conflicting");
assert.equal(conflict.concluded, undefined);
assert.ok(conflict.spdxIds.includes("MIT"));
assert.ok(conflict.spdxIds.includes("Apache-2.0"));

const leftPad = scan.resolutions.find((r) => r.packageName === "left-pad");
assert.ok(leftPad);
assert.equal(leftPad.concluded, "WTFPL");

console.log("license fixture checks passed");
console.log(
  JSON.stringify(
    {
      stats: scan.stats,
      express: {
        status: express.status,
        concluded: express.concluded,
        evidenceTypes: express.evidence.map((e) => e.type),
      },
      conflict: {
        status: conflict.status,
        spdxIds: conflict.spdxIds,
        notes: conflict.notes,
      },
    },
    null,
    2,
  ),
);
