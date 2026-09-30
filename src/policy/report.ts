import type { PolicyScanResult } from "./types.js";

export function toScanJson(result: PolicyScanResult): string {
  return JSON.stringify(
    {
      root: result.rootName,
      lockfile: result.lockfilePath,
      context: result.contextPath,
      ruleset_version: result.rulesetVersion,
      scanned_at: result.scannedAt,
      summary: result.summary,
      assumptions: result.assumptions,
      highest_priority: result.highestPriority,
      findings: result.findings,
      exit: result.exitHint,
    },
    null,
    2,
  );
}

export function toScanMarkdown(result: PolicyScanResult): string {
  const lines: string[] = [];
  lines.push(`# License advisor scan`);
  lines.push("");
  lines.push(`- **Root:** ${result.rootName}`);
  lines.push(`- **Lockfile:** \`${result.lockfilePath}\``);
  lines.push(`- **Context:** \`${result.contextPath}\``);
  lines.push(`- **Ruleset:** ${result.rulesetVersion}`);
  lines.push(`- **Scanned at:** ${result.scannedAt}`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Outcome | Count |`);
  lines.push(`|---|---:|`);
  lines.push(`| dependencies in scope | ${result.summary.dependencies} |`);
  lines.push(`| clear (incl. no alert) | ${result.summary.clear} |`);
  lines.push(`| notice | ${result.summary.notice} |`);
  lines.push(`| red_flag | ${result.summary.red_flag} |`);
  lines.push(
    `| insufficient_context | ${result.summary.insufficient_context} |`,
  );
  lines.push(`| review_required | ${result.summary.review_required} |`);
  lines.push(`| conflict | ${result.summary.conflict} |`);
  lines.push("");
  lines.push(`## Assumptions`);
  lines.push("");
  for (const assumption of result.assumptions) {
    lines.push(`- \`${assumption}\``);
  }
  lines.push("");
  lines.push(
    `> This report alerts under stated assumptions. It is not legal advice and does not approve shipping.`,
  );
  lines.push("");

  if (result.highestPriority.length > 0) {
    lines.push(`## Highest priority`);
    lines.push("");
    for (const finding of result.highestPriority) {
      lines.push(
        `### ${finding.outcome} — ${finding.dependency.name}@${finding.dependency.version}`,
      );
      lines.push("");
      lines.push(`- **Rule:** \`${finding.rule_id}\``);
      lines.push(`- **License:** \`${finding.license.expression}\``);
      lines.push(
        `- **Path:** \`${finding.dependency.dependency_path.join(" → ")}\``,
      );
      lines.push(`- **Why:** ${finding.reason.short}`);
      if (finding.next_questions.length > 0) {
        lines.push(`- **Next questions:**`);
        for (const q of finding.next_questions) {
          lines.push(`  - ${q}`);
        }
      }
      lines.push("");
    }
  } else {
    lines.push(`## Highest priority`);
    lines.push("");
    lines.push(
      `No red_flag / review_required / conflict findings under current assumptions.`,
    );
    lines.push("");
  }

  if (result.findings.length > 0) {
    lines.push(`## All findings`);
    lines.push("");
    for (const finding of result.findings) {
      lines.push(
        `- **${finding.outcome}** \`${finding.dependency.name}@${finding.dependency.version}\` via \`${finding.rule_id}\` — ${finding.reason.short}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function printScanHuman(result: PolicyScanResult): void {
  console.log(`Scan: ${result.rootName}`);
  console.log(`Lockfile: ${result.lockfilePath}`);
  console.log(`Context:  ${result.contextPath}`);
  console.log(`Ruleset:  ${result.rulesetVersion}`);
  console.log("");
  console.log("Summary");
  console.log(`  dependencies:          ${result.summary.dependencies}`);
  console.log(`  clear (no alert):      ${result.summary.clear}`);
  console.log(`  notice:                ${result.summary.notice}`);
  console.log(`  red_flag:              ${result.summary.red_flag}`);
  console.log(`  insufficient_context:  ${result.summary.insufficient_context}`);
  console.log(`  review_required:       ${result.summary.review_required}`);
  console.log(`  conflict:              ${result.summary.conflict}`);
  console.log("");
  console.log("Assumptions");
  for (const assumption of result.assumptions) {
    console.log(`  - ${assumption}`);
  }
  console.log("");

  if (result.highestPriority.length === 0) {
    console.log(
      "No high-priority findings under stated assumptions. (Not a legal approval.)",
    );
  } else {
    console.log("Highest priority findings");
    for (const finding of result.highestPriority) {
      console.log("");
      console.log(
        `  [${finding.outcome}] ${finding.dependency.name}@${finding.dependency.version}`,
      );
      console.log(`    rule:    ${finding.rule_id}`);
      console.log(`    license: ${finding.license.expression}`);
      console.log(
        `    path:    ${finding.dependency.dependency_path.join(" → ")}`,
      );
      console.log(`    why:     ${finding.reason.short}`);
    }
  }

  console.log("");
  if (result.exitHint.shouldFail) {
    console.log(
      `Exit hint: FAIL (matched fail_on: ${result.exitHint.failOn.join(", ")})`,
    );
  } else if (result.exitHint.shouldWarn) {
    console.log(
      `Exit hint: WARN (matched warn_on: ${result.exitHint.warnOn.join(", ")})`,
    );
  } else {
    console.log("Exit hint: OK");
  }
}
