export type LicenseEvidenceType =
  | "lockfile"
  | "package_metadata"
  | "license_file_detection"
  | "manual";

export interface LicenseEvidenceItem {
  type: LicenseEvidenceType;
  value: string;
  source: string;
  path?: string;
  confidence: number;
  normalized?: string;
}

export type LicenseResolutionStatus =
  | "resolved"
  | "unresolved"
  | "conflicting"
  | "expression";

export interface LicenseResolution {
  packageName: string;
  version: string;
  lockfileKey: string;
  /** Best-effort SPDX id or expression for policy matching */
  concluded?: string;
  /** Individual SPDX ids extracted when possible */
  spdxIds: string[];
  status: LicenseResolutionStatus;
  evidence: LicenseEvidenceItem[];
  notes: string[];
}

export interface LicenseScanResult {
  lockfilePath: string;
  rootName: string;
  resolutions: LicenseResolution[];
  stats: {
    total: number;
    resolved: number;
    unresolved: number;
    conflicting: number;
    expression: number;
  };
}
