#!/usr/bin/env node

import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const config = JSON.parse(
  await readFile(resolve("plugins/browser-plugin-packs.json"), "utf8"),
);
const publicRoot = resolve("dist/plugin-public/plugins");

validateBuildConfig(config);
await rm(publicRoot, { force: true, recursive: true });
await mkdir(publicRoot, { recursive: true });

const packManifestUrls = await Promise.all(config.packs.map(assemblePack));
await writeFile(
  resolve(publicRoot, "plugin-set.json"),
  `${JSON.stringify(
    {
      packs: packManifestUrls,
      schemaVersion: 1,
    },
    null,
    2,
  )}\n`,
);

async function assemblePack(packId) {
  const packageRoot = resolve("dist/plugin-packages", packId);
  const packManifest = JSON.parse(
    await readFile(resolve(packageRoot, "pack.json"), "utf8"),
  );
  validatePackManifest(packManifest, packId);
  await assertPackModulesAreSelfContained(packageRoot);

  const relativeTarget = `packs/${packId}`;
  await cp(packageRoot, resolve(publicRoot, relativeTarget), {
    recursive: true,
  });
  return `./${relativeTarget}/pack.json`;
}

async function assertPackModulesAreSelfContained(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const filename = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await assertPackModulesAreSelfContained(filename);
      } else if (entry.name.endsWith(".js")) {
        await assertSelfContainedModule(filename);
      }
    }),
  );
}

async function assertSelfContainedModule(filename) {
  const source = await readFile(filename, "utf8");
  const bareImport = source.match(
    /(?:from\s*|import\s*\()\s*["'](?![./]|https?:|data:)([^"']+)/,
  );
  if (bareImport) {
    throw new Error(
      `External plugin artifact contains a bare import: ${bareImport[1]}`,
    );
  }
}

function validateBuildConfig(value) {
  if (
    value.schemaVersion !== 1 ||
    !Array.isArray(value.packs) ||
    !value.packs.every(
      (id) => typeof id === "string" && /^[a-z][a-z0-9-]*$/.test(id),
    ) ||
    new Set(value.packs).size !== value.packs.length
  ) {
    throw new Error("Invalid browser plugin pack build configuration");
  }
}

function validatePackManifest(value, expectedId) {
  if (
    value.schemaVersion !== 1 ||
    value.id !== expectedId ||
    !Array.isArray(value.plugins) ||
    !value.plugins.every(
      (manifest) => typeof manifest === "string" && manifest.length > 0,
    )
  ) {
    throw new Error(`Invalid built plugin pack manifest: ${expectedId}`);
  }
}
