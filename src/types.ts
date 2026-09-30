export const OUTCOMES = [
  "clear",
  "notice",
  "red_flag",
  "insufficient_context",
  "review_required",
  "conflict",
] as const;

export type Outcome = (typeof OUTCOMES)[number];

export const DELIVERY_MODES = [
  "hosted_saas",
  "mobile_app",
  "desktop_app",
  "on_premise",
  "library_sdk",
  "cli_tool",
  "internal_only",
  "client_deliverable",
  "embedded_firmware",
  "open_source_project",
  "other",
] as const;

export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const COMMERCIAL_OPTIONS = ["yes", "no", "undecided"] as const;
export type CommercialOption = (typeof COMMERCIAL_OPTIONS)[number];

export const SOURCE_VISIBILITY = [
  "closed",
  "source_available",
  "open",
  "undecided",
] as const;
export type SourceVisibility = (typeof SOURCE_VISIBILITY)[number];

export const CUSTOMER_DISTRIBUTION = [
  "none",
  "binaries",
  "source",
  "binaries_and_source",
  "some_components",
  "unknown",
] as const;
export type CustomerDistribution = (typeof CUSTOMER_DISTRIBUTION)[number];

export const AUDIENCE_OPTIONS = [
  "self",
  "internal_team",
  "third_parties",
  "public",
  "mixed",
  "unknown",
] as const;
export type AudienceOption = (typeof AUDIENCE_OPTIONS)[number];

export const MODIFIES_DEPENDENCIES = ["yes", "no", "unknown"] as const;
export type ModifiesDependencies = (typeof MODIFIES_DEPENDENCIES)[number];

export const LINKING_MODELS = [
  "unknown",
  "separate_process",
  "dynamic_link",
  "static_link",
  "source_incorporation",
  "mixed",
] as const;
export type LinkingModel = (typeof LINKING_MODELS)[number];

export const TARGET_PLATFORMS = [
  "web",
  "ios",
  "android",
  "windows",
  "macos",
  "linux",
  "server",
  "embedded",
  "other",
] as const;
export type TargetPlatform = (typeof TARGET_PLATFORMS)[number];

export const DEPENDENCY_SCOPES = [
  "production",
  "development",
  "optional",
  "peer",
] as const;
export type DependencyScope = (typeof DEPENDENCY_SCOPES)[number];

export interface ProjectContextMeta {
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  notes?: string;
}

export interface ProjectIntent {
  name?: string;
  delivery: DeliveryMode;
  commercial: CommercialOption;
  audience?: AudienceOption;
  source_visibility: SourceVisibility;
  customer_distribution: CustomerDistribution;
  network_access: boolean;
  modifies_dependencies?: ModifiesDependencies;
  linking_model?: LinkingModel;
  target_platforms?: TargetPlatform[];
  dependency_scopes_in_scope?: DependencyScope[];
}

export interface ProjectPolicy {
  fail_on?: Outcome[];
  warn_on?: Outcome[];
}

export interface ProjectContext {
  schema_version: "0.1.0";
  meta?: ProjectContextMeta;
  project: ProjectIntent;
  policy?: ProjectPolicy;
}

export const SCHEMA_VERSION = "0.1.0" as const;
export const DEFAULT_CONTEXT_FILENAME = "project-context.yaml";

export const OUTCOME_HELP: Record<Outcome, string> = {
  clear: "No relevant obligation detected under current assumptions.",
  notice: "Manageable obligations (e.g. attribution). Track them.",
  red_flag: "Meaningful tension with stated shipping intent — review before shipping.",
  insufficient_context: "Cannot evaluate safely — missing intent or architecture answers.",
  review_required: "Automated analysis is insufficient — escalate to a human.",
  conflict: "Deterministic incompatibility with declared constraints.",
};
