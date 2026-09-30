import type { DependencyGraph, DependencyNode } from "../graph/types.js";
import type { LicenseResolution, LicenseScanResult } from "../licenses/types.js";
import type { Outcome, ProjectContext } from "../types.js";
import { RULESET_V0, RULESET_VERSION, SCANNER_VERSION } from "./ruleset-v0.js";
import type {
  EngineFinding,
  PolicyRule,
  PolicyScanResult,
  RuleWhen,
  ScanSummary,
} from "./types.js";

const OUTCOME_RANK: Record<Outcome, number> = {
  clear: 0,
  notice: 1,
  insufficient_context: 2,
  red_flag: 3,
  review_required: 4,
  conflict: 5,
};

function asArray(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

function matchesWhen(when: RuleWhen, context: ProjectContext): boolean {
  if (when.always) return true;

  const p = context.project;

  if (when.network_access !== undefined && p.network_access !== when.network_access) {
    return false;
  }

  const sourceVisibility = asArray(when.source_visibility);
  if (sourceVisibility && !sourceVisibility.includes(p.source_visibility)) {
    return false;
  }

  const customerDistribution = asArray(when.customer_distribution);
  if (
    customerDistribution &&
    !customerDistribution.includes(p.customer_distribution)
  ) {
    return false;
  }

  const customerDistributionNot = asArray(when.customer_distribution_not);
  if (
    customerDistributionNot &&
    customerDistributionNot.includes(p.customer_distribution)
  ) {
    return false;
  }

  const delivery = asArray(when.delivery);
  if (delivery && !delivery.includes(p.delivery)) {
    return false;
  }

  const commercial = asArray(when.commercial);
  if (commercial && !commercial.includes(p.commercial)) {
    return false;
  }

  const modifies = asArray(when.modifies_dependencies);
  if (
    modifies &&
    !modifies.includes(p.modifies_dependencies ?? "unknown")
  ) {
    return false;
  }

  const linking = asArray(when.linking_model);
  if (linking && !linking.includes(p.linking_model ?? "unknown")) {
    return false;
  }

  return true;
}

function matchesLicense(rule: PolicyRule, resolution: LicenseResolution): boolean {
  // Status-based rules are exclusive: match only the declared statuses.
  if (rule.licenses.status_any && rule.licenses.status_any.length > 0) {
    return rule.licenses.status_any.includes(resolution.status);
  }

  if (!rule.licenses.any || rule.licenses.any.length === 0) {
    return false;
  }

  const ids = new Set(
    resolution.spdxIds.length > 0
      ? resolution.spdxIds
      : resolution.concluded
        ? [resolution.concluded]
        : [],
  );

  return rule.licenses.any.some((id) => ids.has(id));
}

function buildAssumptions(context: ProjectContext): string[] {
  const p = context.project;
  return [
    `delivery=${p.delivery}`,
    `commercial=${p.commercial}`,
    `source_visibility=${p.source_visibility}`,
    `customer_distribution=${p.customer_distribution}`,
    `network_access=${p.network_access}`,
    `modifies_dependencies=${p.modifies_dependencies ?? "unknown"}`,
    `linking_model=${p.linking_model ?? "unknown"}`,
  ];
}

function inScope(
  node: DependencyNode,
  context: ProjectContext,
): boolean {
  const allowed = context.project.dependency_scopes_in_scope ?? ["production"];
  // If node has unknown scope only, include it conservatively
  if (node.scopes.length === 0 || node.scopes.includes("unknown")) {
    return true;
  }
  return node.scopes.some((scope) => allowed.includes(scope as never));
}

function evidenceFromResolution(resolution: LicenseResolution) {
  return resolution.evidence.map((e) => ({
    type: e.type,
    value: e.value,
    source: e.source,
    path: e.path,
    confidence: e.confidence,
  }));
}

function nextQuestionsFor(rule: PolicyRule): string[] {
  const map: Record<string, string> = {
    confirm_modification_status: "Is this dependency modified?",
    confirm_component_boundary:
      "Is this dependency isolated as a separate service/process?",
    confirm_linking_model:
      "How is this dependency linked or incorporated (dynamic, static, source)?",
  };
  return (rule.requires ?? []).map((key) => map[key] ?? key);
}

function limitsFor(outcome: Outcome): string[] {
  const base = [
    "This finding is an alert under stated assumptions, not a legal determination.",
  ];
  if (outcome === "clear") {
    return [
      "Clear means no relevant obligation was detected under current assumptions — not legal approval.",
    ];
  }
  return base;
}

function declaredFrom(resolution: LicenseResolution): string | undefined {
  return resolution.evidence.find((e) => e.type === "lockfile" || e.type === "package_metadata")
    ?.value;
}

function detectedFrom(resolution: LicenseResolution): string | undefined {
  return resolution.evidence.find((e) => e.type === "license_file_detection")
    ?.normalized;
}

function makeFinding(args: {
  index: number;
  node: DependencyNode;
  resolution: LicenseResolution;
  rule: PolicyRule;
  context: ProjectContext;
  scannedAt: string;
}): EngineFinding {
  const { index, node, resolution, rule, context, scannedAt } = args;
  const relationship =
    node.relationship === "direct" ? "direct" : "transitive";

  return {
    finding_id: `finding-${String(index).padStart(3, "0")}`,
    dependency: {
      name: node.name,
      version: node.version,
      relationship,
      scope: node.scopes[0],
      dependency_path: node.path,
      introduced_by: node.introducedBy,
    },
    license: {
      expression:
        resolution.concluded ??
        (resolution.spdxIds.length > 0
          ? resolution.spdxIds.join(" OR ")
          : "(unresolved)"),
      spdx_ids: resolution.spdxIds,
      declared: declaredFrom(resolution),
      detected: detectedFrom(resolution),
      concluded: resolution.concluded,
      detection_confidence:
        resolution.evidence.reduce((max, e) => Math.max(max, e.confidence), 0) ||
        undefined,
    },
    outcome: rule.outcome,
    rule_id: rule.id,
    reason: {
      short: rule.reason.short,
      detail: rule.reason.detail,
    },
    assumptions: buildAssumptions(context),
    evidence: [
      ...evidenceFromResolution(resolution),
      {
        type: "rule_reference",
        value: rule.id,
        source: `ruleset@${RULESET_VERSION}`,
      },
    ],
    limits: limitsFor(rule.outcome),
    next_questions: nextQuestionsFor(rule),
    engine: {
      ruleset_version: RULESET_VERSION,
      scanner_version: SCANNER_VERSION,
      context_schema_version: context.schema_version,
      scanned_at: scannedAt,
    },
  };
}

function emptySummary(): ScanSummary {
  return {
    dependencies: 0,
    clear: 0,
    notice: 0,
    red_flag: 0,
    insufficient_context: 0,
    review_required: 0,
    conflict: 0,
    packages_without_alert: 0,
  };
}

function bump(summary: ScanSummary, outcome: Outcome): void {
  summary[outcome] += 1;
}

export function evaluatePolicy(args: {
  context: ProjectContext;
  graph: DependencyGraph;
  licenses: LicenseScanResult;
  includeDraft?: boolean;
  contextPath?: string;
}): PolicyScanResult {
  const {
    context,
    graph,
    licenses,
    includeDraft = false,
    contextPath = "(memory)",
  } = args;

  const scannedAt = new Date().toISOString();
  const assumptions = buildAssumptions(context);
  const rules = RULESET_V0.filter(
    (rule) => includeDraft || rule.status === "ready",
  );

  const byKey = new Map(
    licenses.resolutions.map((r) => [r.lockfileKey, r] as const),
  );

  const findings: EngineFinding[] = [];
  const alertedPackages = new Set<string>();
  let findingIndex = 1;

  const scopedNodes = graph.nodes.filter((node) => inScope(node, context));

  for (const node of scopedNodes) {
    const resolution = byKey.get(node.lockfileKey);
    if (!resolution) continue;

    for (const rule of rules) {
      if (!matchesLicense(rule, resolution)) continue;
      if (!matchesWhen(rule.when, context)) continue;

      // Skip emitting permissive "clear" noise as per-package findings
      if (rule.outcome === "clear") continue;

      findings.push(
        makeFinding({
          index: findingIndex,
          node,
          resolution,
          rule,
          context,
          scannedAt,
        }),
      );
      findingIndex += 1;
      alertedPackages.add(node.lockfileKey);
    }
  }

  findings.sort(
    (a, b) =>
      OUTCOME_RANK[b.outcome] - OUTCOME_RANK[a.outcome] ||
      a.dependency.name.localeCompare(b.dependency.name),
  );

  // renumber after sort for stable highest-first ids
  findings.forEach((finding, idx) => {
    finding.finding_id = `finding-${String(idx + 1).padStart(3, "0")}`;
  });

  const summary = emptySummary();
  summary.dependencies = scopedNodes.length;
  for (const finding of findings) {
    bump(summary, finding.outcome);
  }
  summary.packages_without_alert = scopedNodes.length - alertedPackages.size;
  summary.clear += summary.packages_without_alert;

  const failOn = context.policy?.fail_on ?? ["conflict"];
  const warnOn = context.policy?.warn_on ?? ["red_flag", "review_required"];
  const outcomesPresent = new Set(findings.map((f) => f.outcome));

  const highestPriority = findings
    .filter((f) => f.outcome !== "notice" && f.outcome !== "clear")
    .slice(0, 10);

  return {
    rootName: graph.rootName,
    lockfilePath: graph.lockfilePath,
    contextPath,
    rulesetVersion: RULESET_VERSION,
    scannedAt,
    summary,
    findings,
    highestPriority,
    assumptions,
    exitHint: {
      shouldFail: failOn.some((o) => outcomesPresent.has(o as Outcome)),
      shouldWarn: warnOn.some((o) => outcomesPresent.has(o as Outcome)),
      failOn,
      warnOn,
    },
  };
}
