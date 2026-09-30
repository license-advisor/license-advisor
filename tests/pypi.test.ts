import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  discoverManifest,
  loadDependencyGraph,
  normalizePypiName,
  parseRequirementsTxt,
} from "../src/graph/index.js";
import { loadLicenseScan } from "../src/licenses/index.js";
import { runScan } from "../src/policy/index.js";
import { pypiFixture } from "./helpers.js";

describe("pypi graph + licenses", () => {
  it("normalizes PyPI names like packaging does", () => {
    assert.equal(normalizePypiName("PyYAML"), "pyyaml");
    assert.equal(normalizePypiName("agpl_tool"), "agpl-tool");
    assert.equal(normalizePypiName("Flask"), "flask");
  });

  it("parses requirements.txt pins", () => {
    const fixture = pypiFixture();
    const reqs = parseRequirementsTxt(fixture.requirementsPath);
    assert.equal(reqs.length, 2);
    assert.equal(reqs[0]?.name, "Flask");
    assert.equal(reqs[0]?.version, "3.0.3");
    assert.equal(reqs[1]?.name, "agpl-tool");
  });

  it("discovers requirements.txt + venv as pypi", () => {
    const fixture = pypiFixture();
    const manifest = discoverManifest(fixture.dir);
    assert.equal(manifest.packageManager, "pypi");
    assert.equal(manifest.sourceKind, "requirements.txt");
    assert.ok(manifest.venvPath);
  });

  it("builds direct/transitive graph from venv METADATA", () => {
    const fixture = pypiFixture();
    const graph = loadDependencyGraph(fixture.dir);

    assert.equal(graph.packageManager, "pypi");
    assert.equal(graph.stats.direct, 2);
    assert.ok(graph.stats.transitive >= 2);

    const flask = graph.nodes.find((n) => n.name === "Flask");
    assert.ok(flask);
    assert.equal(flask.relationship, "direct");
    assert.equal(flask.version, "3.0.3");

    const werkzeug = graph.nodes.find((n) => n.name === "Werkzeug");
    assert.ok(werkzeug);
    assert.equal(werkzeug.relationship, "transitive");
    assert.ok(werkzeug.path.includes("Flask"));

    const markup = graph.nodes.find((n) => n.name === "MarkupSafe");
    assert.ok(markup);
    assert.equal(markup.relationship, "transitive");
  });

  it("resolves SPDX licenses from METADATA License-Expression", () => {
    const fixture = pypiFixture();
    const { licenses } = loadLicenseScan(fixture.dir);

    const flask = licenses.resolutions.find((r) => r.packageName === "Flask");
    assert.ok(flask);
    assert.equal(flask.status, "resolved");
    assert.equal(flask.concluded, "BSD-3-Clause");

    const agpl = licenses.resolutions.find((r) => r.packageName === "agpl-tool");
    assert.ok(agpl);
    assert.equal(agpl.concluded, "AGPL-3.0-only");
  });

  it("raises AGPL red_flag under closed SaaS intent", () => {
    const fixture = pypiFixture();
    const result = runScan({
      cwd: fixture.dir,
      contextPath: fixture.contextPath,
    });

    const agplFinding = result.findings.find(
      (f) => f.dependency.name === "agpl-tool",
    );
    assert.ok(agplFinding);
    assert.equal(agplFinding.outcome, "red_flag");
  });

  it("fails clearly when requirements.txt exists without a venv", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "la-pypi-"));
    try {
      writeFileSync(join(dir, "requirements.txt"), "requests==2.32.0\n");
      assert.throws(
        () => discoverManifest(dir),
        /Found requirements\.txt but no local virtualenv/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
