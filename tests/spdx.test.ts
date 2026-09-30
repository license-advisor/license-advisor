import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectLicenseFromText,
  extractSpdxIds,
  normalizeToSpdx,
} from "../src/licenses/spdx.js";

describe("normalizeToSpdx", () => {
  it("normalizes common aliases", () => {
    assert.equal(normalizeToSpdx("MIT").value, "MIT");
    assert.equal(normalizeToSpdx("mit").value, "MIT");
    assert.equal(normalizeToSpdx("Apache License 2.0").value, "Apache-2.0");
    assert.equal(normalizeToSpdx("AGPL-3.0").value, "AGPL-3.0-only");
    assert.equal(normalizeToSpdx("gplv3").value, "GPL-3.0-only");
    assert.equal(normalizeToSpdx("WTFPL").value, "WTFPL");
  });

  it("refuses ambiguous bare families", () => {
    const bsd = normalizeToSpdx("bsd");
    assert.equal(bsd.value, undefined);
    assert.ok(bsd.note?.includes("ambiguous"));

    const gpl = normalizeToSpdx("GPL");
    assert.equal(gpl.value, undefined);
    assert.ok(gpl.note?.includes("ambiguous"));
  });

  it("keeps SPDX expressions", () => {
    const result = normalizeToSpdx("MIT OR Apache-2.0");
    assert.equal(result.isExpression, true);
    assert.equal(result.value, "MIT OR Apache-2.0");
    assert.deepEqual(extractSpdxIds(result.value), ["MIT", "Apache-2.0"]);
  });

  it("handles empty input", () => {
    const result = normalizeToSpdx("   ");
    assert.equal(result.value, undefined);
    assert.ok(result.note);
  });
});

describe("detectLicenseFromText", () => {
  it("detects Apache-2.0 fingerprint", () => {
    const result = detectLicenseFromText(
      "Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/",
    );
    assert.equal(result.value, "Apache-2.0");
  });

  it("detects AGPL-3 fingerprint", () => {
    const result = detectLicenseFromText(
      "GNU Affero General Public License\nVersion 3, 19 November 2007",
    );
    assert.equal(result.value, "AGPL-3.0-only");
  });

  it("does not invent a match for unrelated text", () => {
    const result = detectLicenseFromText("hello world custom terms");
    assert.equal(result.value, undefined);
  });
});
