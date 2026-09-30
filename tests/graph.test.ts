import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDependencyGraphFromLockfile } from "../src/graph/npm-lockfile.js";
import { npmFixture } from "./helpers.js";

describe("npm lockfile graph", () => {
  it("parses fixture lockfile with direct and transitive deps", () => {
    const fixture = npmFixture();
    const graph = buildDependencyGraphFromLockfile(fixture.lockfilePath);

    assert.equal(graph.rootName, "fixture-app");
    assert.equal(graph.lockfileVersion, 3);
    assert.equal(graph.stats.direct, 3);
    assert.ok(graph.stats.transitive >= 5);

    const express = graph.nodes.find((n) => n.name === "express");
    assert.ok(express);
    assert.equal(express.relationship, "direct");
    assert.ok(express.scopes.includes("production"));
    assert.deepEqual(express.path, ["fixture-app", "express"]);

    const mimeDb = graph.nodes.find((n) => n.name === "mime-db");
    assert.ok(mimeDb);
    assert.equal(mimeDb.relationship, "transitive");
    assert.ok(mimeDb.path.includes("express"));
    assert.ok(mimeDb.path.includes("mime-db"));

    const leftPad = graph.nodes.find((n) => n.name === "left-pad");
    assert.ok(leftPad);
    assert.equal(leftPad.relationship, "direct");
    assert.ok(leftPad.scopes.includes("development"));
  });

  it("preserves a path for nested transitive packages", () => {
    const fixture = npmFixture();
    const graph = buildDependencyGraphFromLockfile(fixture.lockfilePath);
    const ms = graph.nodes.find((n) => n.name === "ms");
    assert.ok(ms);
    assert.deepEqual(ms.path.slice(0, 3), ["fixture-app", "express", "debug"]);
  });
});
