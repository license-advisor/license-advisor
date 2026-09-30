import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  handleCheckDependency,
  handleExplainFinding,
  handleGetDependencyPath,
  handleGetProjectContext,
  handleListOutcomes,
  handleScanProject,
} from "../src/mcp/tools.js";
import { saasAgplFixture } from "./helpers.js";

function parsePayload(result: {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}) {
  assert.notEqual(result.isError, true);
  return JSON.parse(result.content[0]?.text ?? "{}") as Record<string, unknown>;
}

describe("MCP tool handlers", () => {
  const fixture = saasAgplFixture();

  it("scan_project returns summary and red flags", async () => {
    const result = await handleScanProject({
      project_root: fixture.dir,
      context_path: fixture.contextPath,
      lockfile_path: fixture.lockfilePath,
    });
    const payload = parsePayload(result);
    const summary = payload.summary as { red_flag: number; notice: number };
    assert.ok(summary.red_flag >= 1);
    assert.ok(summary.notice >= 1);
    assert.ok(typeof payload.overview === "string");
  });

  it("explain_finding returns calm text for agpl-lib", async () => {
    const result = await handleExplainFinding({
      project_root: fixture.dir,
      context_path: fixture.contextPath,
      lockfile_path: fixture.lockfilePath,
      package_name: "agpl-lib",
    });
    const payload = parsePayload(result);
    const explanations = payload.explanations as Array<{ text: string }>;
    assert.ok(explanations.length >= 1);
    assert.ok(explanations[0]?.text.includes("AGPL"));
    assert.ok(explanations[0]?.text.includes("Assumptions used"));
  });

  it("get_dependency_path returns transitive path", async () => {
    const result = await handleGetDependencyPath({
      project_root: fixture.dir,
      lockfile_path: fixture.lockfilePath,
      package_name: "agpl-lib",
    });
    const payload = parsePayload(result);
    const matches = payload.matches as Array<{ path: string[] }>;
    assert.deepEqual(matches[0]?.path, [
      "fixture-saas-agpl",
      "plugin-x",
      "agpl-lib",
    ]);
  });

  it("check_dependency returns findings for agpl-lib", async () => {
    const result = await handleCheckDependency({
      project_root: fixture.dir,
      context_path: fixture.contextPath,
      lockfile_path: fixture.lockfilePath,
      package_name: "agpl-lib",
    });
    const payload = parsePayload(result);
    const findings = payload.findings as unknown[];
    assert.ok(findings.length >= 1);
  });

  it("get_project_context reads fixture intent", async () => {
    const result = await handleGetProjectContext({
      project_root: fixture.dir,
      context_path: fixture.contextPath,
    });
    const payload = parsePayload(result);
    const context = payload.context as {
      project: { delivery: string };
    };
    assert.equal(context.project.delivery, "hosted_saas");
  });

  it("list_outcomes returns taxonomy", async () => {
    const result = await handleListOutcomes();
    const payload = parsePayload(result);
    const outcomes = payload.outcomes as Record<string, string>;
    assert.ok(outcomes.clear);
    assert.ok(outcomes.red_flag);
  });

  it("scan_project errors on missing lockfile", async () => {
    const result = await handleScanProject({
      project_root: fixture.dir,
      context_path: fixture.contextPath,
      lockfile_path: "does-not-exist.json",
    });
    assert.equal(result.isError, true);
  });
});
