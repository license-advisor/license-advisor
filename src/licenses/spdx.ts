/**
 * Focused SPDX helpers for the v0 license set.
 * Prefer not inventing certainty for ambiguous aliases.
 */

/** SPDX ids we intentionally support well in v0 */
export const KNOWN_SPDX_IDS = [
  "MIT",
  "ISC",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "MPL-2.0",
  "LGPL-2.1-only",
  "LGPL-2.1-or-later",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "GPL-2.0-only",
  "GPL-2.0-or-later",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
  "EPL-1.0",
  "EPL-2.0",
  "SSPL-1.0",
  "BUSL-1.1",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
  "Python-2.0",
  "PSF-2.0",
  "MIT-CMU",
  "BlueOak-1.0.0",
  "WTFPL",
] as const;

export type KnownSpdxId = (typeof KNOWN_SPDX_IDS)[number];

const KNOWN_SET = new Set<string>(KNOWN_SPDX_IDS);

/** Exact / near-exact aliases → SPDX. Ambiguous values are omitted on purpose. */
const ALIASES: Record<string, string> = {
  mit: "MIT",
  "mit license": "MIT",
  "mit/x11": "MIT",
  isc: "ISC",
  "isc license": "ISC",
  "bsd-2-clause": "BSD-2-Clause",
  "bsd 2-clause": "BSD-2-Clause",
  "bsd-2": "BSD-2-Clause",
  freebsd: "BSD-2-Clause",
  "bsd-3-clause": "BSD-3-Clause",
  "bsd 3-clause": "BSD-3-Clause",
  "bsd-3": "BSD-3-Clause",
  "new bsd": "BSD-3-Clause",
  "modified bsd": "BSD-3-Clause",
  "apache-2.0": "Apache-2.0",
  "apache 2.0": "Apache-2.0",
  "apache2": "Apache-2.0",
  "apache-2": "Apache-2.0",
  "apache license 2.0": "Apache-2.0",
  "apache license, version 2.0": "Apache-2.0",
  "mpl-2.0": "MPL-2.0",
  "mozilla public license 2.0": "MPL-2.0",
  "gpl-2.0": "GPL-2.0-only",
  "gpl-2.0-only": "GPL-2.0-only",
  "gpl-2.0-or-later": "GPL-2.0-or-later",
  "gplv2": "GPL-2.0-only",
  "gpl-3.0": "GPL-3.0-only",
  "gpl-3.0-only": "GPL-3.0-only",
  "gpl-3.0-or-later": "GPL-3.0-or-later",
  "gplv3": "GPL-3.0-only",
  "agpl-3.0": "AGPL-3.0-only",
  "agpl-3.0-only": "AGPL-3.0-only",
  "agpl-3.0-or-later": "AGPL-3.0-or-later",
  "agplv3": "AGPL-3.0-only",
  "lgpl-2.1": "LGPL-2.1-only",
  "lgpl-3.0": "LGPL-3.0-only",
  "sspl-1.0": "SSPL-1.0",
  "server side public license": "SSPL-1.0",
  "busl-1.1": "BUSL-1.1",
  "business source license 1.1": "BUSL-1.1",
  unlicense: "Unlicense",
  "cc0-1.0": "CC0-1.0",
  wtfpl: "WTFPL",
  "0bsd": "0BSD",
  "blueoak-1.0.0": "BlueOak-1.0.0",
  "psf-2.0": "PSF-2.0",
  "psf": "PSF-2.0",
  "python software foundation license": "PSF-2.0",
  "mit-cmu": "MIT-CMU",
  "hpnd": "MIT-CMU",
};

export interface NormalizeResult {
  /** Normalized SPDX id or expression, if confidently obtained */
  value?: string;
  /** True when input looks like a multi-license SPDX expression */
  isExpression: boolean;
  /** True when we recognized a known id/alias */
  known: boolean;
  /** Why normalization failed or was partial */
  note?: string;
}

function cleanRaw(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
}

/**
 * Normalize a declared license string toward SPDX.
 * Does not invent licenses for ambiguous values like bare "BSD" or "GPL".
 */
export function normalizeToSpdx(raw: string): NormalizeResult {
  const cleaned = cleanRaw(raw);
  if (!cleaned) {
    return { isExpression: false, known: false, note: "empty license string" };
  }

  // Already exact known id
  if (KNOWN_SET.has(cleaned)) {
    return { value: cleaned, isExpression: false, known: true };
  }

  const lower = cleaned.toLowerCase();
  if (ALIASES[lower]) {
    return { value: ALIASES[lower], isExpression: false, known: true };
  }

  // SPDX expressions: keep as expression if tokens look plausible
  if (/(\s+OR\s+|\s+AND\s+|WITH\s+)/i.test(cleaned) || cleaned.includes("(")) {
    return {
      value: cleaned,
      isExpression: true,
      known: false,
      note: "treated as SPDX expression; policy matching may be limited in v0",
    };
  }

  // Case-insensitive exact match against known ids
  for (const id of KNOWN_SPDX_IDS) {
    if (id.toLowerCase() === lower) {
      return { value: id, isExpression: false, known: true };
    }
  }

  // Ambiguous bare families — do not guess
  if (["bsd", "gpl", "lgpl", "agpl", "apache", "mozilla"].includes(lower)) {
    return {
      isExpression: false,
      known: false,
      note: `ambiguous license label "${cleaned}" — not normalized`,
    };
  }

  // Pass through unknown-but-SPDX-looking tokens (e.g. future ids)
  if (/^[A-Za-z0-9][A-Za-z0-9.+_-]*$/.test(cleaned)) {
    return {
      value: cleaned,
      isExpression: false,
      known: false,
      note: "passed through without v0 alias match",
    };
  }

  return {
    isExpression: false,
    known: false,
    note: `unrecognized license string "${cleaned}"`,
  };
}

export function extractSpdxIds(normalized?: string): string[] {
  if (!normalized) return [];
  if (!/(\s+OR\s+|\s+AND\s+|WITH\s+|\(|\))/i.test(normalized)) {
    return [normalized];
  }

  // Naive token extraction for v0 policy matching
  const tokens = normalized
    .split(/(\s+OR\s+|\s+AND\s+|WITH\s+|\(|\))/i)
    .map((t) => t.trim())
    .filter((t) => t && !/^(OR|AND|WITH|\(|\))$/i.test(t));

  return [...new Set(tokens)];
}

/** Very small LICENSE file fingerprints — detection aids, not ScanCode. */
export function detectLicenseFromText(text: string): NormalizeResult {
  const sample = text.slice(0, 8000);
  const lower = sample.toLowerCase();

  if (
    lower.includes("gnu affero general public license") &&
    lower.includes("version 3")
  ) {
    return { value: "AGPL-3.0-only", isExpression: false, known: true };
  }
  if (
    lower.includes("gnu general public license") &&
    lower.includes("version 3") &&
    !lower.includes("affero") &&
    !lower.includes("lesser")
  ) {
    return { value: "GPL-3.0-only", isExpression: false, known: true };
  }
  if (
    lower.includes("gnu general public license") &&
    lower.includes("version 2") &&
    !lower.includes("affero") &&
    !lower.includes("lesser")
  ) {
    return { value: "GPL-2.0-only", isExpression: false, known: true };
  }
  if (
    lower.includes("apache license") &&
    (lower.includes("version 2.0") || lower.includes("version 2"))
  ) {
    return { value: "Apache-2.0", isExpression: false, known: true };
  }
  if (
    lower.includes("permission is hereby granted, free of charge") &&
    lower.includes("mit")
  ) {
    return { value: "MIT", isExpression: false, known: true };
  }
  if (
    lower.includes("permission to use, copy, modify, and/or distribute") &&
    lower.includes("isc")
  ) {
    return { value: "ISC", isExpression: false, known: true };
  }
  if (lower.includes("mozilla public license") && lower.includes("2.0")) {
    return { value: "MPL-2.0", isExpression: false, known: true };
  }
  if (lower.includes("server side public license")) {
    return { value: "SSPL-1.0", isExpression: false, known: true };
  }
  if (lower.includes("business source license")) {
    return { value: "BUSL-1.1", isExpression: false, known: true };
  }
  if (lower.includes("do whatever you want") || lower.includes("wtfpl")) {
    return { value: "WTFPL", isExpression: false, known: true };
  }

  return {
    isExpression: false,
    known: false,
    note: "LICENSE file present but no v0 fingerprint matched",
  };
}
