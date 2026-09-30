import type { EngineFinding, PolicyScanResult } from "../policy/types.js";
import { OUTCOME_HELP, type Outcome } from "../types.js";

/**
 * Deterministic explanation package for agents.
 * The LLM should present this calmly — not invent legal conclusions.
 */
export function explainFindingText(finding: EngineFinding): string {
  const lines: string[] = [];

  lines.push(
    `[${finding.outcome}] ${finding.dependency.name}@${finding.dependency.version}`,
  );
  lines.push(`Rule: ${finding.rule_id}`);
  lines.push(`License: ${finding.license.expression}`);
  lines.push(
    `Relationship: ${finding.dependency.relationship}` +
      (finding.dependency.scope ? ` / scope=${finding.dependency.scope}` : ""),
  );
  lines.push(`Path: ${finding.dependency.dependency_path.join(" → ")}`);
  lines.push("");
  lines.push(`Why it matters under stated intent:`);
  lines.push(finding.reason.short);
  if (finding.reason.detail) {
    lines.push(finding.reason.detail);
  }
  lines.push("");
  lines.push("Assumptions used:");
  for (const assumption of finding.assumptions) {
    lines.push(`- ${assumption}`);
  }
  lines.push("");
  lines.push("Evidence:");
  for (const item of finding.evidence) {
    lines.push(`- [${item.type}] ${item.value}`);
  }
  if (finding.next_questions.length > 0) {
    lines.push("");
    lines.push("Useful follow-up questions:");
    for (const q of finding.next_questions) {
      lines.push(`- ${q}`);
    }
  }
  lines.push("");
  lines.push("Limits:");
  for (const limit of finding.limits) {
    lines.push(`- ${limit}`);
  }
  lines.push("");
  lines.push(
    "Agent guidance: alert and explain. Do not sentence. Do not invent alternatives. Do not claim legal approval.",
  );

  return lines.join("\n");
}

export function explainScanOverview(result: PolicyScanResult): string {
  const lines: string[] = [];
  lines.push(`License advisor scan for ${result.rootName}`);
  lines.push(`Ruleset ${result.rulesetVersion} @ ${result.scannedAt}`);
  lines.push("");
  lines.push("Summary:");
  const outcomes: Outcome[] = [
    "clear",
    "notice",
    "red_flag",
    "insufficient_context",
    "review_required",
    "conflict",
  ];
  for (const outcome of outcomes) {
    const count = result.summary[outcome];
    if (count > 0 || outcome === "clear") {
      lines.push(`- ${outcome}: ${count} — ${OUTCOME_HELP[outcome]}`);
    }
  }
  lines.push("");
  lines.push("Assumptions:");
  for (const assumption of result.assumptions) {
    lines.push(`- ${assumption}`);
  }
  lines.push("");

  if (result.highestPriority.length === 0) {
    lines.push(
      "No high-priority findings under stated assumptions. This is not legal approval.",
    );
  } else {
    lines.push("Highest-priority findings:");
    for (const finding of result.highestPriority) {
      lines.push(
        `- [${finding.outcome}] ${finding.dependency.name}@${finding.dependency.version} (${finding.rule_id})`,
      );
      lines.push(`  ${finding.reason.short}`);
      lines.push(
        `  path: ${finding.dependency.dependency_path.join(" → ")}`,
      );
    }
  }

  lines.push("");
  lines.push(
    "Agent guidance: present alerts calmly with evidence and assumptions. Do not invent package replacements or legal verdicts.",
  );

  return lines.join("\n");
}
