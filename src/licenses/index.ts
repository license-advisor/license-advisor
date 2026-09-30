export type {
  LicenseEvidenceItem,
  LicenseEvidenceType,
  LicenseResolution,
  LicenseResolutionStatus,
  LicenseScanResult,
} from "./types.js";

export {
  detectLicenseFromText,
  extractSpdxIds,
  KNOWN_SPDX_IDS,
  normalizeToSpdx,
} from "./spdx.js";

export {
  loadLicenseScan,
  resolveLicensesForGraph,
  resolveNodeLicense,
} from "./resolve.js";
