#!/usr/bin/env node

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateBuiltPluginPack } from "./plugin-pack-artifacts.mjs";
import {
  collectPluginPackIds,
  readPluginPackTargetConfig,
} from "./plugin-pack-targets.mjs";

const config = await readPluginPackTargetConfig(
  "plugins/browser-plugin-packs.json",
);
const publicRoot = resolve("dist/plugin-public");

await rm(publicRoot, { force: true, recursive: true });
await mkdir(publicRoot, { recursive: true });

const targets = Object.entries(config.targets);
const packageRoots = new Map(
  await Promise.all(collectPluginPackIds(config).map(validateBuiltPack)),
);
await Promise.all(
  targets.map(([target, packs]) => assembleTarget(target, packs, packageRoots)),
);

async function validateBuiltPack(packId) {
  return [packId, await validateBuiltPluginPack(packId, "browser")];
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
  const relativeTarget = packId;
  await cp(packageRoot, resolve(pluginsRoot, relativeTarget), {
    recursive: true,
  });
  return `./${relativeTarget}/pack.json`;
}
