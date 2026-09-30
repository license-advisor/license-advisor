export type RuleStatus = "ready" | "draft";

export interface LicenseMatch {
  /** Match if any of these SPDX ids appear on the package */
  any?: string[];
  /** Match special resolution statuses */
  status_any?: Array<"resolved" | "unresolved" | "conflicting" | "expression">;
}

export interface RuleWhen {
  network_access?: boolean;
  source_visibility?: string | string[];
  customer_distribution?: string | string[];
  customer_distribution_not?: string | string[];
  delivery?: string | string[];
  commercial?: string | string[];
  modifies_dependencies?: string | string[];
  linking_model?: string | string[];
  /** If true, rule applies regardless of project fields (still needs license match) */
  always?: boolean;
}

export interface PolicyRule {
  id: string;
  status: RuleStatus;
  licenses: LicenseMatch;
  when: RuleWhen;
  outcome: import("../types.js").Outcome;
  reason: {
    short: string;
    detail?: string;
  };
  requires?: string[];
  references?: string[];
}

export interface EngineFinding {
  finding_id: string;
  dependency: {
    name: string;
    version: string;
    relationship: "direct" | "transitive";
    scope?: string;
    dependency_path: string[];
    introduced_by: string[];
  };
  license: {
    expression: string;
    spdx_ids: string[];
    declared?: string;
    detected?: string;
    concluded?: string;
    detection_confidence?: number;
  };
  outcome: import("../types.js").Outcome;
  rule_id: string;
  reason: {
    short: string;
    detail?: string;
  };
  assumptions: string[];
  evidence: Array<{
    type: string;
    value: string;
    source?: string;
    path?: string;
    confidence?: number;
  }>;
  limits: string[];
  next_questions: string[];
  engine: {
    ruleset_version: string;
    scanner_version: string;
    context_schema_version: string;
    scanned_at: string;
  };
}

export interface ScanSummary {
  dependencies: number;
  clear: number;
  notice: number;
  red_flag: number;
  insufficient_context: number;
  review_required: number;
  conflict: number;
  /** Packages with no alert-worthy finding (treated as clear under assumptions) */
  packages_without_alert: number;
}

export interface PolicyScanResult {
  rootName: string;
  lockfilePath: string;
  contextPath: string;
  rulesetVersion: string;
  scannedAt: string;
  summary: ScanSummary;
  findings: EngineFinding[];
  highestPriority: EngineFinding[];
  assumptions: string[];
  exitHint: {
    shouldFail: boolean;
    shouldWarn: boolean;
    failOn: string[];
    warnOn: string[];
  };
}
