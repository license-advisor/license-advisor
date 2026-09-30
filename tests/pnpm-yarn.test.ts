import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDependencyGraphFromPnpmLock,
  buildDependencyGraphFromYarnLock,
  discoverManifest,
  parsePnpmPackageKey,
  yarnDescriptorName,
} from "../src/graph/index.js";
import { fixturesRoot } from "./helpers.js";
import { join } from "node:path";

describe("pnpm + yarn lockfiles", () => {
  it("parses pnpm package keys", () => {
    assert.deepEqual(parsePnpmPackageKey("/express@4.18.2"), {
      name: "express",
      version: "4.18.2",
    });
    assert.deepEqual(parsePnpmPackageKey("@scope/name@1.2.3"), {
      name: "@scope/name",
      version: "1.2.3",
    });
    assert.deepEqual(parsePnpmPackageKey("left-pad@1.3.0(peer@1)"), {
      name: "left-pad",
      version: "1.3.0",
    });
  });

  it("parses yarn descriptor names", () => {
    assert.equal(yarnDescriptorName("express@^4.18.2"), "express");
    assert.equal(yarnDescriptorName("@scope/name@^1.0.0"), "@scope/name");
  });

  it("builds graph from pnpm-lock.yaml fixture", () => {
    const lockfile = join(fixturesRoot, "pnpm", "pnpm-lock.yaml");
    const graph = buildDependencyGraphFromPnpmLock(lockfile);
    assert.equal(graph.packageManager, "pnpm");
    assert.equal(graph.rootName, "fixture-app");
    assert.equal(graph.stats.direct, 3);
    assert.ok(graph.stats.transitive >= 5);

    const express = graph.nodes.find((n) => n.name === "express");
    assert.ok(express);
    assert.equal(express.relationship, "direct");

    const mimeDb = graph.nodes.find((n) => n.name === "mime-db");
    assert.ok(mimeDb);
    assert.equal(mimeDb.relationship, "transitive");
  });

  it("builds graph from yarn.lock v1 fixture", () => {
    const lockfile = join(fixturesRoot, "yarn", "yarn.lock");
    const graph = buildDependencyGraphFromYarnLock(lockfile);
    assert.equal(graph.packageManager, "yarn");
    assert.equal(graph.rootName, "fixture-app");
    assert.equal(graph.stats.direct, 3);

    const leftPad = graph.nodes.find((n) => n.name === "left-pad");
    assert.ok(leftPad);
    assert.equal(leftPad.relationship, "direct");
    assert.ok(leftPad.scopes.includes("development"));
  });

  it("discovers pnpm when no package-lock.json is present", () => {
    const dir = join(fixturesRoot, "pnpm");
    const manifest = discoverManifest(dir);
    assert.equal(manifest.packageManager, "pnpm");
    assert.equal(manifest.sourceKind, "pnpm-lock.yaml");
  });

  it("discovers yarn when only yarn.lock is present", () => {
    const dir = join(fixturesRoot, "yarn");
    const manifest = discoverManifest(dir);
    assert.equal(manifest.packageManager, "yarn");
    assert.equal(manifest.sourceKind, "yarn.lock");
  });
});
