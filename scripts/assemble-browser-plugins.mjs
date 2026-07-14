#!/usr/bin/env node

import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const config = JSON.parse(
  await readFile(resolve("plugins/browser-plugin-packs.json"), "utf8"),
);
const publicRoot = resolve("dist/plugin-public");

validateBuildConfig(config);
await rm(publicRoot, { force: true, recursive: true });
await mkdir(publicRoot, { recursive: true });

const targets = Object.entries(config.targets);
const packIds = [...new Set(targets.flatMap(([, packs]) => packs))];
const packageRoots = new Map(await Promise.all(packIds.map(validateBuiltPack)));
await Promise.all(
  targets.map(([target, packs]) => assembleTarget(target, packs, packageRoots)),
);

async function validateBuiltPack(packId) {
  const packageRoot = resolve("dist/plugin-packages", packId);
  const packManifest = JSON.parse(
    await readFile(resolve(packageRoot, "pack.json"), "utf8"),
  );
  validatePackManifest(packManifest, packId);
  await assertPackModulesAreSelfContained(packageRoot);
  return [packId, packageRoot];
}

async function assembleTarget(target, packs, packageRoots) {
  const pluginsRoot = resolve(publicRoot, target, "plugins");
  await mkdir(pluginsRoot, { recursive: true });
  const packManifestUrls = await Promise.all(
    packs.map((packId) => assemblePack(packId, pluginsRoot, packageRoots)),
  );
  await writeFile(
    resolve(pluginsRoot, "loader.json"),
    `${JSON.stringify(
      {
        allowedOrigins: ["self"],
        pluginSet: "./plugin-set.json",
        schemaVersion: 1,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    resolve(pluginsRoot, "plugin-set.json"),
    `${JSON.stringify(
      {
        packs: packManifestUrls,
        schemaVersion: 1,
      },
      null,
      2,
    )}\n`,
  );
}

async function assemblePack(packId, pluginsRoot, packageRoots) {
  const packageRoot = packageRoots.get(packId);
  if (!packageRoot) throw new Error(`Plugin pack was not built: ${packId}`);
  const relativeTarget = `packs/${packId}`;
  await cp(packageRoot, resolve(pluginsRoot, relativeTarget), {
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
    value.schemaVersion !== 2 ||
    typeof value.targets !== "object" ||
    value.targets === null ||
    Array.isArray(value.targets)
  ) {
    throw new Error("Invalid browser plugin pack build configuration");
  }

  const targets = Object.entries(value.targets);
  if (
    targets.length === 0 ||
    !targets.every(
      ([target, packs]) =>
        /^[a-z][a-z0-9-]*$/.test(target) &&
        Array.isArray(packs) &&
        packs.length > 0 &&
        packs.every(
          (id) => typeof id === "string" && /^[a-z][a-z0-9-]*$/.test(id),
        ) &&
        new Set(packs).size === packs.length,
    )
  ) {
    throw new Error("Invalid browser plugin pack build configuration");
  }
}

function validatePackManifest(value, expectedId) {
  if (
    value.schemaVersion !== 2 ||
    !Array.isArray(value.hosts) ||
    !value.hosts.includes("browser") ||
    value.id !== expectedId ||
    !Array.isArray(value.plugins) ||
    !value.plugins.every(
      (manifest) => typeof manifest === "string" && manifest.length > 0,
    )
  ) {
    throw new Error(`Invalid built plugin pack manifest: ${expectedId}`);
  }
}
