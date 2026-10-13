import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSharedInstaller } from "../src/sharedTool.mjs";

const release = JSON.parse(readFileSync(new URL("../contracts/shared-installer-release.json", import.meta.url)));
const installed = resolve(dirname(fileURLToPath(import.meta.resolve("@foss-earth/dev-installer"))), "..");
const fixtureRoot = fileURLToPath(new URL(`../build/shared-tool-fixture-${Date.now()}/`, import.meta.url));

function copyFixture(label) {
  const root = join(fixtureRoot, label);
  for (const file of release.runtimeFiles) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(join(installed, file), join(root, file));
  }
  return root;
}

test("the exact installed public CLI imports after its full seal passes", async () => {
  const shared = await loadSharedInstaller();
  assert.equal(typeof shared.runCli, "function");
});

for (const file of ["src/paths.mjs", "src/choices.mjs"]) {
  test(`tampered transitive ${file} prevents the public import`, async () => {
    const root = copyFixture(file.replaceAll("/", "-"));
    const transitive = join(root, file);
    writeFileSync(transitive, readFileSync(transitive, "utf8") + "\n// altered transitive executable\n");
    let imports = 0;
    await assert.rejects(loadSharedInstaller({
      resolvePublicEntry: () => join(root, "src/cli.mjs"),
      importPublicEntry: async () => { imports++; throw new Error("must not import"); },
    }), error => error.message.includes(`executable seal differs: ${file}`));
    assert.equal(imports, 0);
  });
}

test("a source checkout cannot substitute for the installed archive", async () => {
  const root = copyFixture("source-marker");
  writeFileSync(join(root, ".git"), "retained synthetic source marker\n");
  let imports = 0;
  await assert.rejects(loadSharedInstaller({
    resolvePublicEntry: () => join(root, "src/cli.mjs"),
    importPublicEntry: async () => { imports++; throw new Error("must not import"); },
  }), /installed shared installer archive, not a source checkout/);
  assert.equal(imports, 0);
});
