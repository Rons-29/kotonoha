import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const readJson = async (name) => JSON.parse(await readFile(resolve(root, name), "utf8"));

const manifest = await readJson("manifest.json");
const packageJson = await readJson("package.json");
const versions = await readJson("versions.json");
const releaseTag = process.argv[2] || process.env.GITHUB_REF_NAME || "";

assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
if (releaseTag) {
  assert.equal(releaseTag, manifest.version, "release tag must match manifest.json version");
}
assert.equal(packageJson.version, manifest.version, "package.json and manifest.json versions must match");
assert.equal(versions[manifest.version], manifest.minAppVersion, "versions.json must map the release to minAppVersion");
assert.ok(manifest.id && !manifest.id.includes("obsidian"));
assert.equal(manifest.id, "kotonoha");
assert.ok(manifest.description.length <= 250 && manifest.description.endsWith("."));

for (const asset of ["main.js", "manifest.json", "styles.css", "README.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md"]) {
  await access(resolve(root, asset), constants.R_OK);
}

const buildScript = await readFile(resolve(root, "esbuild.mjs"), "utf8");
assert.ok(!buildScript.includes("/Users/"), "esbuild.mjs must not contain a personal absolute path");

console.log(`Release checks passed for ${manifest.id} ${manifest.version}.`);
