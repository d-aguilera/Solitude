#!/usr/bin/env node

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateBuiltPluginPack } from "./plugin-pack-artifacts.mjs";
import {
  collectPluginPackIds,
  readPluginPackTargetConfig,
} from "./plugin-pack-targets.mjs";

const config = await readPluginPackTargetConfig(
  "plugins/server-plugin-packs.json",
);
const serverRoot = resolve("dist/server-plugins");

await rm(serverRoot, { force: true, recursive: true });
await mkdir(serverRoot, { recursive: true });

const targets = Object.entries(config.targets);
const packageRoots = new Map(
  await Promise.all(collectPluginPackIds(config).map(validateBuiltPack)),
);
await Promise.all(
  targets.map(([target, packs]) => assembleTarget(target, packs, packageRoots)),
);

async function validateBuiltPack(packId) {
  return [packId, await validateBuiltPluginPack(packId, "server")];
}

async function assembleTarget(target, packs, packageRoots) {
  const targetRoot = resolve(serverRoot, target);
  await mkdir(targetRoot, { recursive: true });
  const packManifestPaths = await Promise.all(
    packs.map((packId) => assemblePack(packId, targetRoot, packageRoots)),
  );
  await writeFile(
    resolve(targetRoot, "plugin-set.json"),
    `${JSON.stringify(
      {
        packs: packManifestPaths,
        schemaVersion: 1,
      },
      null,
      2,
    )}\n`,
  );
}

async function assemblePack(packId, targetRoot, packageRoots) {
  const packageRoot = packageRoots.get(packId);
  if (!packageRoot) throw new Error(`Plugin pack was not built: ${packId}`);
  const relativeTarget = packId;
  await cp(packageRoot, resolve(targetRoot, relativeTarget), {
    recursive: true,
  });
  return `./${relativeTarget}/pack.json`;
}
