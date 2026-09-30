import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDependencyGraphFromLockfile } from "../src/graph/npm-lockfile.js";
import { resolveLicensesForGraph } from "../src/licenses/index.js";
import { npmFixture } from "./helpers.js";

describe("license resolution", () => {
  it("resolves agreeing evidence as resolved", () => {
    const fixture = npmFixture();
    const graph = buildDependencyGraphFromLockfile(fixture.lockfilePath);
    const scan = resolveLicensesForGraph(graph);

    const express = scan.resolutions.find((r) => r.packageName === "express");
    assert.ok(express);
    assert.equal(express.status, "resolved");
    assert.equal(express.concluded, "MIT");
    assert.ok(express.evidence.some((e) => e.type === "lockfile"));
    assert.ok(express.evidence.some((e) => e.type === "package_metadata"));
    assert.ok(
      express.evidence.some((e) => e.type === "license_file_detection"),
    );
  });

  it("preserves conflicting evidence without flattening", () => {
    const fixture = npmFixture();
    const graph = buildDependencyGraphFromLockfile(fixture.lockfilePath);
    const scan = resolveLicensesForGraph(graph);

    const conflict = scan.resolutions.find(
      (r) => r.packageName === "conflict-lib",
    );
    assert.ok(conflict);
    assert.equal(conflict.status, "conflicting");
    assert.equal(conflict.concluded, undefined);
    assert.ok(conflict.spdxIds.includes("MIT"));
    assert.ok(conflict.spdxIds.includes("Apache-2.0"));
    assert.ok(
      conflict.notes.some((n) => n.includes("Conflicting license evidence")),
    );
  });

  it("reports aggregate stats", () => {
    const fixture = npmFixture();
    const graph = buildDependencyGraphFromLockfile(fixture.lockfilePath);
    const scan = resolveLicensesForGraph(graph);

    assert.equal(scan.stats.total, 9);
    assert.equal(scan.stats.resolved, 8);
    assert.equal(scan.stats.conflicting, 1);
    assert.equal(scan.stats.unresolved, 0);
  });
});
