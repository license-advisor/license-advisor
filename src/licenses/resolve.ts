import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { DependencyGraph, DependencyNode } from "../graph/types.js";
import { loadDependencyGraph } from "../graph/load.js";
import { parseDistInfo } from "../graph/pypi.js";
import {
  detectLicenseFromText,
  extractSpdxIds,
  normalizeToSpdx,
} from "./spdx.js";
import type {
  LicenseEvidenceItem,
  LicenseResolution,
  LicenseScanResult,
  LicenseResolutionStatus,
} from "./types.js";

interface PackageJsonLicense {
  license?: string | { type?: string; url?: string };
  licenses?: Array<string | { type?: string; url?: string }>;
}

/** Map common trove classifiers to SPDX when unambiguous. */
const CLASSIFIER_TO_SPDX: Record<string, string> = {
  "License :: OSI Approved :: MIT License": "MIT",
  "License :: OSI Approved :: Apache Software License": "Apache-2.0",
  "License :: OSI Approved :: BSD License": "BSD-3-Clause",
  "License :: OSI Approved :: ISC License (ISCL)": "ISC",
  "License :: OSI Approved :: Mozilla Public License 2.0 (MPL 2.0)": "MPL-2.0",
  "License :: OSI Approved :: GNU Affero General Public License v3":
    "AGPL-3.0-only",
  "License :: OSI Approved :: GNU Affero General Public License v3 or later (AGPLv3+)":
    "AGPL-3.0-or-later",
  "License :: OSI Approved :: GNU General Public License v3 (GPLv3)":
    "GPL-3.0-only",
  "License :: OSI Approved :: GNU General Public License v3 or later (GPLv3+)":
    "GPL-3.0-or-later",
  "License :: OSI Approved :: GNU General Public License v2 (GPLv2)":
    "GPL-2.0-only",
  "License :: OSI Approved :: GNU Lesser General Public License v3 (LGPLv3)":
    "LGPL-3.0-only",
  "License :: OSI Approved :: Python Software Foundation License": "PSF-2.0",
  "License :: OSI Approved :: The Unlicense (Unlicense)": "Unlicense",
  "License :: OSI Approved :: CC0 1.0 Universal (CC0 1.0) Public Domain Dedication":
    "CC0-1.0",
};

function packageDirFromLockfileKey(
  lockfilePath: string,
  lockfileKey: string,
): string {
  const projectRoot = dirname(resolve(lockfilePath));
  return join(projectRoot, lockfileKey);
}

function resolvePackagePath(
  graph: DependencyGraph,
  node: DependencyNode,
): string | undefined {
  if (graph.packageManager === "pypi") {
    if (node.lockfileKey.startsWith("pypi:")) return undefined;
    // lockfileKey is relative to project cwd (parent of requirements or project root)
    // For pypi, lockfilePath may be requirements.txt — project root is its dirname
    // or the cwd used when building. Prefer resolving relative to lockfile dir,
    // then parent if needed.
    const fromLockDir = resolve(dirname(graph.lockfilePath), node.lockfileKey);
    if (existsSync(fromLockDir)) return fromLockDir;
    const fromParent = resolve(
      dirname(dirname(graph.lockfilePath)),
      node.lockfileKey,
    );
    if (existsSync(fromParent)) return fromParent;
    // Absolute-ish relative from process roots: try as-is from dirname of lockfile's project
    return fromLockDir;
  }

  return packageDirFromLockfileKey(graph.lockfilePath, node.lockfileKey);
}

function readPackageJsonLicense(
  packageDir: string,
): { raw?: string; path: string } {
  const pkgPath = join(packageDir, "package.json");
  if (!existsSync(pkgPath)) {
    return { path: pkgPath };
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJsonLicense;

    if (typeof pkg.license === "string") {
      return { raw: pkg.license, path: pkgPath };
    }
    if (pkg.license && typeof pkg.license === "object" && pkg.license.type) {
      return { raw: pkg.license.type, path: pkgPath };
    }
    if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
      const parts = pkg.licenses
        .map((item) => (typeof item === "string" ? item : item.type))
        .filter((v): v is string => Boolean(v));
      if (parts.length === 1) return { raw: parts[0], path: pkgPath };
      if (parts.length > 1) {
        return { raw: parts.join(" OR "), path: pkgPath };
      }
    }
  } catch {
    return { path: pkgPath };
  }

  return { path: pkgPath };
}

const LICENSE_FILE_CANDIDATES = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "LICENCE",
  "LICENCE.md",
  "COPYING",
  "COPYING.md",
];

function readLicenseFile(searchRoots: string[]): {
  text?: string;
  path?: string;
} {
  for (const root of searchRoots) {
    if (!existsSync(root)) continue;

    for (const name of LICENSE_FILE_CANDIDATES) {
      const filePath = join(root, name);
      if (!existsSync(filePath)) continue;
      try {
        const text = readFileSync(filePath, "utf8");
        return { text, path: filePath };
      } catch {
        continue;
      }
    }

    const licensesDir = join(root, "licenses");
    if (existsSync(licensesDir)) {
      try {
        for (const entry of readdirSync(licensesDir)) {
          const filePath = join(licensesDir, entry);
          try {
            const text = readFileSync(filePath, "utf8");
            return { text, path: filePath };
          } catch {
            continue;
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return {};
}

function concludeFromEvidence(evidence: LicenseEvidenceItem[]): {
  status: LicenseResolutionStatus;
  concluded?: string;
  spdxIds: string[];
  notes: string[];
} {
  const notes: string[] = [];
  const normalizedValues = evidence
    .map((e) => e.normalized)
    .filter((v): v is string => Boolean(v));

  if (normalizedValues.length === 0) {
    notes.push("No confident SPDX license could be resolved.");
    return { status: "unresolved", spdxIds: [], notes };
  }

  const unique = [...new Set(normalizedValues)];
  const hasExpression = evidence.some((e) =>
    Boolean(e.normalized && extractSpdxIds(e.normalized).length > 1),
  );

  if (unique.length === 1) {
    const concluded = unique[0];
    const spdxIds = extractSpdxIds(concluded);
    if (hasExpression || spdxIds.length > 1) {
      notes.push(
        "License expression preserved; policy matching uses extracted ids.",
      );
      return { status: "expression", concluded, spdxIds, notes };
    }
    return { status: "resolved", concluded, spdxIds, notes };
  }

  notes.push(
    `Conflicting license evidence: ${unique.join(" vs ")}. Not flattened.`,
  );
  return {
    status: "conflicting",
    concluded: undefined,
    spdxIds: [...new Set(unique.flatMap((v) => extractSpdxIds(v)))],
    notes,
  };
}

function pushNormalizedEvidence(
  evidence: LicenseEvidenceItem[],
  item: Omit<LicenseEvidenceItem, "normalized"> & { normalized?: string },
): void {
  const normalized =
    item.normalized ??
    (item.value ? normalizeToSpdx(item.value).value : undefined);
  evidence.push({ ...item, normalized });
}

function collectNpmEvidence(
  node: DependencyNode,
  packageDir: string,
  lockfilePath: string,
  evidence: LicenseEvidenceItem[],
): void {
  if (node.license) {
    pushNormalizedEvidence(evidence, {
      type: "lockfile",
      value: node.license,
      source: "package-lock.json packages[].license",
      path: lockfilePath,
      confidence: 0.9,
    });
  }

  const pkgMeta = readPackageJsonLicense(packageDir);
  if (pkgMeta.raw) {
    pushNormalizedEvidence(evidence, {
      type: "package_metadata",
      value: pkgMeta.raw,
      source: "package.json license",
      path: pkgMeta.path,
      confidence: 0.95,
    });
  }

  const licenseFile = readLicenseFile([packageDir]);
  if (licenseFile.text && licenseFile.path) {
    const detected = detectLicenseFromText(licenseFile.text);
    if (detected.value) {
      evidence.push({
        type: "license_file_detection",
        value: detected.value,
        source: "LICENSE file fingerprint",
        path: licenseFile.path,
        confidence: detected.known ? 0.85 : 0.2,
        normalized: detected.value,
      });
    } else {
      evidence.push({
        type: "license_file_detection",
        value: "(present, unmatched fingerprint)",
        source: "LICENSE file fingerprint",
        path: licenseFile.path,
        confidence: 0.1,
      });
    }
  }
}

function collectPypiEvidence(
  node: DependencyNode,
  distInfoPath: string | undefined,
  lockfilePath: string,
  evidence: LicenseEvidenceItem[],
): void {
  if (!distInfoPath || !existsSync(distInfoPath)) {
    // Lockfile-only / no installed METADATA: keep opportunistic field if present
    if (node.license && !node.license.startsWith("License ::")) {
      pushNormalizedEvidence(evidence, {
        type: "lockfile",
        value: node.license,
        source: "lock snapshot (no local METADATA)",
        path: lockfilePath,
        confidence: 0.5,
      });
    }
    return;
  }

  const parsed = parseDistInfo(distInfoPath);
  if (!parsed) return;

  const metadataPath = join(distInfoPath, "METADATA");

  // Priority: License-Expression > License field > classifiers > LICENSE file.
  // Mixing all sources caused false conflicts (e.g. MIT-CMU expression vs MIT fingerprint).
  if (parsed.licenseExpression) {
    pushNormalizedEvidence(evidence, {
      type: "package_metadata",
      value: parsed.licenseExpression,
      source: "METADATA License-Expression",
      path: metadataPath,
      confidence: 0.98,
    });
    return;
  }

  if (parsed.license && parsed.license.toUpperCase() !== "UNKNOWN") {
    pushNormalizedEvidence(evidence, {
      type: "package_metadata",
      value: parsed.license,
      source: "METADATA License",
      path: metadataPath,
      confidence: 0.9,
    });
    return;
  }

  for (const classifier of parsed.licenseClassifiers) {
    const mapped = CLASSIFIER_TO_SPDX[classifier];
    if (mapped) {
      evidence.push({
        type: "package_metadata",
        value: mapped,
        source: `METADATA Classifier (${classifier})`,
        path: metadataPath,
        confidence: 0.75,
        normalized: mapped,
      });
      return;
    }
  }

  const packageRoot = dirname(distInfoPath);
  const licenseFile = readLicenseFile([distInfoPath, packageRoot]);
  if (licenseFile.text && licenseFile.path) {
    const detected = detectLicenseFromText(licenseFile.text);
    if (detected.value) {
      evidence.push({
        type: "license_file_detection",
        value: detected.value,
        source: "LICENSE file fingerprint",
        path: licenseFile.path,
        confidence: detected.known ? 0.85 : 0.2,
        normalized: detected.value,
      });
    } else {
      evidence.push({
        type: "license_file_detection",
        value: "(present, unmatched fingerprint)",
        source: "LICENSE file fingerprint",
        path: licenseFile.path,
        confidence: 0.1,
      });
    }
  }
}

export function resolveNodeLicense(
  node: DependencyNode,
  graph: DependencyGraph,
): LicenseResolution {
  const evidence: LicenseEvidenceItem[] = [];
  const packagePath = resolvePackagePath(graph, node);

  if (graph.packageManager === "pypi") {
    collectPypiEvidence(node, packagePath, graph.lockfilePath, evidence);
  } else {
    collectNpmEvidence(
      node,
      packagePath ?? packageDirFromLockfileKey(graph.lockfilePath, node.lockfileKey),
      graph.lockfilePath,
      evidence,
    );
  }

  const conclusion = concludeFromEvidence(evidence);

  for (const item of evidence) {
    if (!item.normalized) {
      const n = normalizeToSpdx(item.value);
      if (n.note) conclusion.notes.push(`${item.type}: ${n.note}`);
    }
  }

  return {
    packageName: node.name,
    version: node.version,
    lockfileKey: node.lockfileKey,
    concluded: conclusion.concluded,
    spdxIds: conclusion.spdxIds,
    status: conclusion.status,
    evidence,
    notes: conclusion.notes,
  };
}

export function resolveLicensesForGraph(
  graph: DependencyGraph,
): LicenseScanResult {
  const resolutions = graph.nodes.map((node) => resolveNodeLicense(node, graph));

  return {
    lockfilePath: graph.lockfilePath,
    rootName: graph.rootName,
    resolutions,
    stats: {
      total: resolutions.length,
      resolved: resolutions.filter((r) => r.status === "resolved").length,
      unresolved: resolutions.filter((r) => r.status === "unresolved").length,
      conflicting: resolutions.filter((r) => r.status === "conflicting").length,
      expression: resolutions.filter((r) => r.status === "expression").length,
    },
  };
}

export function loadLicenseScan(
  cwd = process.cwd(),
  explicitLockfile?: string,
): { graph: DependencyGraph; licenses: LicenseScanResult } {
  const graph = loadDependencyGraph(cwd, explicitLockfile);
  return { graph, licenses: resolveLicensesForGraph(graph) };
}
