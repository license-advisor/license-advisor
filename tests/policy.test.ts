import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadProjectContext } from "../src/context.js";
import { loadLicenseScan } from "../src/licenses/index.js";
import { evaluatePolicy, runScan } from "../src/policy/index.js";
import {
  baseSaasContext,
  makeGraph,
  makeLicenseScan,
  makeNode,
  makeResolution,
  saasAgplFixture,
} from "./helpers.js";

describe("policy engine fixtures", () => {
  it("flags transitive AGPL under closed-source SaaS", () => {
    const fixture = saasAgplFixture();
    const context = loadProjectContext(fixture.dir, fixture.contextPath);
    assert.equal(context.ok, true);
    if (!context.ok) return;

    const { graph, licenses } = loadLicenseScan(
      fixture.dir,
      fixture.lockfilePath,
    );
    const result = evaluatePolicy({
      context: context.context,
      graph,
      licenses,
      contextPath: context.path,
    });

    assert.ok(result.summary.red_flag >= 1);
    assert.ok(result.summary.notice >= 1);
    assert.equal(result.summary.review_required, 0);

    const agpl = result.findings.find(
      (f) =>
        f.rule_id === "AGPL_NETWORK_001" && f.dependency.name === "agpl-lib",
    );
    assert.ok(agpl);
    assert.equal(agpl.outcome, "red_flag");
    assert.deepEqual(agpl.dependency.dependency_path, [
      "fixture-saas-agpl",
      "plugin-x",
      "agpl-lib",
    ]);
    assert.ok(agpl.assumptions.some((a) => a.includes("network_access=true")));
    assert.ok(
      agpl.limits.some((l) => l.includes("not a legal determination")),
    );
    assert.equal(result.exitHint.shouldWarn, true);
    assert.equal(result.exitHint.shouldFail, false);
  });

  it("does not raise AGPL network rule when network_access is false", () => {
    const fixture = saasAgplFixture();
    const context = loadProjectContext(fixture.dir, fixture.contextPath);
    assert.equal(context.ok, true);
    if (!context.ok) return;

    const { graph, licenses } = loadLicenseScan(
      fixture.dir,
      fixture.lockfilePath,
    );
    const internal = structuredClone(context.context);
    internal.project.network_access = false;
    internal.project.delivery = "internal_only";
    internal.project.commercial = "no";

    const result = evaluatePolicy({
      context: internal,
      graph,
      licenses,
      contextPath: context.path,
    });

    assert.equal(
      result.findings.some((f) => f.rule_id === "AGPL_NETWORK_001"),
      false,
    );
  });

  it("runScan integrates context + lockfile end to end", () => {
    const fixture = saasAgplFixture();
    const result = runScan({
      cwd: fixture.dir,
      contextPath: fixture.contextPath,
      lockfilePath: fixture.lockfilePath,
    });
    assert.equal(result.rootName, "fixture-saas-agpl");
    assert.ok(result.highestPriority.some((f) => f.outcome === "red_flag"));
  });
});

describe("policy engine synthetic scenarios", () => {
  it("flags GPL when closed-source project distributes binaries", () => {
    const node = makeNode({
      name: "gpl-lib",
      version: "1.0.0",
      license: "GPL-3.0-only",
    });
    const resolution = makeResolution({
      packageName: "gpl-lib",
      version: "1.0.0",
      status: "resolved",
      concluded: "GPL-3.0-only",
      spdxIds: ["GPL-3.0-only"],
    });

    const result = evaluatePolicy({
      context: baseSaasContext({
        delivery: "library_sdk",
        customer_distribution: "binaries",
        network_access: false,
      }),
      graph: makeGraph([node]),
      licenses: makeLicenseScan([resolution]),
    });

    const finding = result.findings.find(
      (f) => f.rule_id === "GPL_DISTRIBUTION_001",
    );
    assert.ok(finding);
    assert.equal(finding.outcome, "red_flag");
  });

  it("flags SSPL for hosted SaaS", () => {
    const node = makeNode({
      name: "sspl-db",
      version: "2.0.0",
      license: "SSPL-1.0",
    });
    const resolution = makeResolution({
      packageName: "sspl-db",
      version: "2.0.0",
      status: "resolved",
      concluded: "SSPL-1.0",
      spdxIds: ["SSPL-1.0"],
    });

    const result = evaluatePolicy({
      context: baseSaasContext(),
      graph: makeGraph([node]),
      licenses: makeLicenseScan([resolution]),
    });

    assert.ok(result.findings.some((f) => f.rule_id.startsWith("SSPL_")));
    assert.ok(result.summary.red_flag >= 1);
  });

  it("emits review_required for unresolved licenses", () => {
    const node = makeNode({ name: "mystery", version: "0.1.0" });
    const resolution = makeResolution({
      packageName: "mystery",
      version: "0.1.0",
      status: "unresolved",
      concluded: undefined,
      spdxIds: [],
      evidence: [],
    });

    const result = evaluatePolicy({
      context: baseSaasContext(),
      graph: makeGraph([node]),
      licenses: makeLicenseScan([resolution]),
    });

    const finding = result.findings.find(
      (f) => f.rule_id === "UNKNOWN_LICENSE_001",
    );
    assert.ok(finding);
    assert.equal(finding.outcome, "review_required");
  });

  it("emits review_required for conflicting evidence", () => {
    const node = makeNode({ name: "conflict-lib", version: "1.0.0" });
    const resolution = makeResolution({
      packageName: "conflict-lib",
      version: "1.0.0",
      status: "conflicting",
      concluded: undefined,
      spdxIds: ["MIT", "Apache-2.0"],
    });

    const result = evaluatePolicy({
      context: baseSaasContext(),
      graph: makeGraph([node]),
      licenses: makeLicenseScan([resolution]),
    });

    const finding = result.findings.find(
      (f) => f.rule_id === "CONFLICTING_EVIDENCE_001",
    );
    assert.ok(finding);
    assert.equal(finding.outcome, "review_required");
  });

  it("emits Apache notice for commercial projects", () => {
    const node = makeNode({
      name: "apache-helper",
      version: "1.0.0",
      license: "Apache-2.0",
    });
    const resolution = makeResolution({
      packageName: "apache-helper",
      version: "1.0.0",
      status: "resolved",
      concluded: "Apache-2.0",
      spdxIds: ["Apache-2.0"],
    });

    const result = evaluatePolicy({
      context: baseSaasContext({ commercial: "yes" }),
      graph: makeGraph([node]),
      licenses: makeLicenseScan([resolution]),
    });

    const finding = result.findings.find(
      (f) => f.rule_id === "APACHE_NOTICE_001",
    );
    assert.ok(finding);
    assert.equal(finding.outcome, "notice");
  });

  it("ignores development deps when scopes_in_scope is production only", () => {
    const node = makeNode({
      name: "agpl-devtool",
      version: "1.0.0",
      relationship: "direct",
      scopes: ["development"],
      license: "AGPL-3.0-only",
    });
    const resolution = makeResolution({
      packageName: "agpl-devtool",
      version: "1.0.0",
      status: "resolved",
      concluded: "AGPL-3.0-only",
      spdxIds: ["AGPL-3.0-only"],
    });

    const result = evaluatePolicy({
      context: baseSaasContext({
        dependency_scopes_in_scope: ["production"],
      }),
      graph: makeGraph([node]),
      licenses: makeLicenseScan([resolution]),
    });

    assert.equal(
      result.findings.some((f) => f.dependency.name === "agpl-devtool"),
      false,
    );
  });

  it("draft rules stay off by default and can be enabled", () => {
    const node = makeNode({
      name: "busl-lib",
      version: "1.0.0",
      license: "BUSL-1.1",
    });
    const resolution = makeResolution({
      packageName: "busl-lib",
      version: "1.0.0",
      status: "resolved",
      concluded: "BUSL-1.1",
      spdxIds: ["BUSL-1.1"],
    });

    const withoutDraft = evaluatePolicy({
      context: baseSaasContext({ commercial: "yes" }),
      graph: makeGraph([node]),
      licenses: makeLicenseScan([resolution]),
      includeDraft: false,
    });
    assert.equal(
      withoutDraft.findings.some((f) => f.rule_id === "BUSL_001"),
      false,
    );

    const withDraft = evaluatePolicy({
      context: baseSaasContext({ commercial: "yes" }),
      graph: makeGraph([node]),
      licenses: makeLicenseScan([resolution]),
      includeDraft: true,
    });
    assert.ok(withDraft.findings.some((f) => f.rule_id === "BUSL_001"));
  });
});
