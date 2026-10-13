// SPDX-License-Identifier: AGPL-3.0-only
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DESCRIPTOR_SHA256 = "6b593cfed9709a8bf8597a9d9bc6687ee631d6e0fd95768d34ae460f2131ce4e";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const descriptorUrl = new URL("../contracts/shared-installer-release.json", import.meta.url);
const archiveUrl = new URL("../deps/foss-earth-dev-installer-0.1.0-fa8f021.tgz", import.meta.url);

/** Caller trust bootstrap only: no archive parsing, checkout or installer implementation. */
export function verifySharedInstaller(publicEntryPath) {
  const descriptorBytes = readFileSync(descriptorUrl);
  if (digest(descriptorBytes) !== DESCRIPTOR_SHA256) throw new Error("Flight shared installer descriptor differs from its reviewed seal");
  const release = JSON.parse(descriptorBytes);
  const archiveBytes = readFileSync(archiveUrl);
  if (archiveBytes.length !== release.sizeBytes || digest(archiveBytes) !== release.artifactSha256) throw new Error("Flight shared installer archive differs from its reviewed seal");
  const root = resolve(dirname(publicEntryPath), "..");
  if (publicEntryPath !== join(root, "src/cli.mjs")) throw new Error("Shared public CLI resolved outside its declared entry");
  const rootInfo = lstatSync(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error("Linked or missing shared installer root");
  for (let path = root; ; path = dirname(path)) {
    const info = lstatSync(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Linked shared installer directory ancestry");
    if (dirname(path) === path) break;
  }
  if (lstatSync(join(root, ".git"), { throwIfNoEntry: false })) throw new Error("Use the installed shared installer archive, not a source checkout");
  for (const file of release.runtimeFiles) {
    const parts = file.split("/");
    let path = root;
    for (const [index, part] of parts.entries()) {
      path = join(path, part);
      const info = lstatSync(path);
      if (info.isSymbolicLink() || (index < parts.length - 1 ? !info.isDirectory() : !info.isFile() || info.nlink !== 1)) throw new Error("Linked or special shared installer executable input");
    }
    if (digest(readFileSync(path)) !== release.files[file]) throw new Error(`Shared installer executable seal differs: ${file}`);
  }
  const installed = JSON.parse(readFileSync(join(root, "package.json")));
  if (installed.name !== release.package || installed.version !== release.version || installed.exports?.["."] !== "./src/cli.mjs") throw new Error("Shared installer public CLI identity differs");
  return release;
}

/** Public import happens only after the complete executable closure is verified. */
export async function loadSharedInstaller({
  resolvePublicEntry = () => fileURLToPath(import.meta.resolve("@foss-earth/dev-installer")),
  importPublicEntry = () => import("@foss-earth/dev-installer"),
} = {}) {
  verifySharedInstaller(resolvePublicEntry());
  return importPublicEntry();
}
