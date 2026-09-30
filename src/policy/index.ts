import { loadProjectContext } from "../context.js";
import { loadLicenseScan } from "../licenses/index.js";
import { evaluatePolicy } from "./engine.js";
import type { PolicyScanResult } from "./types.js";

export function runScan(args: {
  cwd?: string;
  contextPath?: string;
  lockfilePath?: string;
  includeDraft?: boolean;
}): PolicyScanResult {
  const cwd = args.cwd ?? process.cwd();
  const contextResult = loadProjectContext(cwd, args.contextPath);
  if (!contextResult.ok) {
    const details = contextResult.errors.join("; ");
    throw new Error(
      `Invalid project context (${contextResult.path}): ${details}`,
    );
  }

  const { graph, licenses } = loadLicenseScan(cwd, args.lockfilePath);
  return evaluatePolicy({
    context: contextResult.context,
    graph,
    licenses,
    includeDraft: args.includeDraft,
    contextPath: contextResult.path,
  });
}

export { evaluatePolicy } from "./engine.js";
export { toScanJson, toScanMarkdown, printScanHuman } from "./report.js";
export { RULESET_V0, RULESET_VERSION } from "./ruleset-v0.js";
export type {
  EngineFinding,
  PolicyRule,
  PolicyScanResult,
  ScanSummary,
} from "./types.js";
