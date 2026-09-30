import type { PolicyRule } from "./types.js";

export const RULESET_VERSION = "0.1.0";
export const SCANNER_VERSION = "0.0.1-dev";

/**
 * Deterministic v0 rules. Ready rules are evaluated by default.
 * Draft rules are skipped unless includeDraft=true.
 */
export const RULESET_V0: PolicyRule[] = [
  {
    id: "UNKNOWN_LICENSE_001",
    status: "ready",
    licenses: { status_any: ["unresolved"] },
    when: { always: true },
    outcome: "review_required",
    reason: {
      short:
        "No confident SPDX license could be resolved for this dependency. Automated analysis cannot clear it.",
    },
    references: ["methodology:unknown-license"],
  },
  {
    id: "CONFLICTING_EVIDENCE_001",
    status: "ready",
    licenses: { status_any: ["conflicting"] },
    when: { always: true },
    outcome: "review_required",
    reason: {
      short:
        "License evidence sources disagree. Conflicting values were preserved and not flattened.",
    },
    references: ["methodology:conflicting-evidence"],
  },
  {
    id: "AGPL_NETWORK_001",
    status: "ready",
    licenses: {
      any: ["AGPL-3.0-only", "AGPL-3.0-or-later"],
    },
    when: {
      network_access: true,
      source_visibility: "closed",
    },
    outcome: "red_flag",
    reason: {
      short:
        "Under a closed-source network-accessible model, AGPL's network-interaction condition deserves attention before shipping.",
      detail:
        "This is a red flag for review under the stated intent — not a legal determination. Architecture details may change the analysis.",
    },
    requires: ["confirm_modification_status", "confirm_component_boundary"],
    references: ["SPDX:AGPL-3.0-only"],
  },
  {
    id: "AGPL_NETWORK_002",
    status: "draft",
    licenses: {
      any: ["AGPL-3.0-only", "AGPL-3.0-or-later"],
    },
    when: {
      network_access: true,
      modifies_dependencies: "unknown",
    },
    outcome: "review_required",
    reason: {
      short:
        "AGPL is present and dependency modification status is unknown. Automated analysis needs clearer architecture context.",
    },
    requires: ["confirm_modification_status", "confirm_component_boundary"],
    references: ["SPDX:AGPL-3.0-only"],
  },
  {
    id: "GPL_DISTRIBUTION_001",
    status: "ready",
    licenses: {
      any: [
        "GPL-2.0-only",
        "GPL-2.0-or-later",
        "GPL-3.0-only",
        "GPL-3.0-or-later",
      ],
    },
    when: {
      customer_distribution: [
        "binaries",
        "source",
        "binaries_and_source",
        "some_components",
      ],
      source_visibility: "closed",
    },
    outcome: "red_flag",
    reason: {
      short:
        "GPL-family code appears in a closed-source project that distributes binaries or source to customers. Review before shipping.",
    },
    references: ["SPDX:GPL-3.0-only"],
  },
  {
    id: "GPL_INTERNAL_001",
    status: "draft",
    licenses: {
      any: [
        "GPL-2.0-only",
        "GPL-2.0-or-later",
        "GPL-3.0-only",
        "GPL-3.0-or-later",
      ],
    },
    when: {
      delivery: "internal_only",
      customer_distribution: "none",
    },
    outcome: "notice",
    reason: {
      short:
        "GPL-family dependency in an internal-only context with no customer distribution. No automatic distribution conflict under stated assumptions — monitor if delivery changes.",
    },
  },
  {
    id: "LGPL_LINKING_001",
    status: "draft",
    licenses: {
      any: [
        "LGPL-2.1-only",
        "LGPL-2.1-or-later",
        "LGPL-3.0-only",
        "LGPL-3.0-or-later",
      ],
    },
    when: {
      customer_distribution_not: "none",
      linking_model: "unknown",
    },
    outcome: "insufficient_context",
    reason: {
      short:
        "LGPL obligations can depend on linking and modification details. Linking model is unknown — provide more context.",
    },
    requires: ["confirm_linking_model", "confirm_modification_status"],
  },
  {
    id: "MPL_FILE_001",
    status: "draft",
    licenses: { any: ["MPL-2.0"] },
    when: {
      modifies_dependencies: "yes",
      customer_distribution_not: "none",
    },
    outcome: "notice",
    reason: {
      short:
        "MPL-2.0 is file-level copyleft. Modified files may carry source obligations when distributed.",
    },
  },
  {
    id: "APACHE_NOTICE_001",
    status: "ready",
    licenses: { any: ["Apache-2.0"] },
    when: {
      commercial: ["yes", "undecided"],
    },
    outcome: "notice",
    reason: {
      short:
        "Apache-2.0 typically requires preserving copyright, license, and NOTICE attributions for distributed components.",
    },
    references: ["SPDX:Apache-2.0"],
  },
  {
    id: "SSPL_001",
    status: "ready",
    licenses: { any: ["SSPL-1.0"] },
    when: {
      delivery: ["hosted_saas", "on_premise"],
    },
    outcome: "red_flag",
    reason: {
      short:
        "SSPL is source-available and often incompatible with closed-source service assumptions. Review before shipping.",
    },
    references: ["SPDX:SSPL-1.0"],
  },
  {
    id: "SSPL_NETWORK_001",
    status: "ready",
    licenses: { any: ["SSPL-1.0"] },
    when: {
      network_access: true,
    },
    outcome: "red_flag",
    reason: {
      short:
        "SSPL appears in a network-accessible project context. Treat as a red flag under stated intent.",
    },
    references: ["SPDX:SSPL-1.0"],
  },
  {
    id: "BUSL_001",
    status: "draft",
    licenses: { any: ["BUSL-1.1"] },
    when: {
      commercial: "yes",
    },
    outcome: "red_flag",
    reason: {
      short:
        "Business Source License terms are use-restricted and often need human reading of additional grants / change dates.",
    },
  },
];
