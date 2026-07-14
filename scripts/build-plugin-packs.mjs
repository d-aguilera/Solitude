#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  collectPluginPackIds,
  readPluginPackTargetConfig,
} from "./plugin-pack-targets.mjs";

const targetKind = process.argv[2] ?? "all";
const configFilenames = {
  all: [
    "plugins/browser-plugin-packs.json",
    "plugins/server-plugin-packs.json",
  ],
  browser: ["plugins/browser-plugin-packs.json"],
  server: ["plugins/server-plugin-packs.json"],
}[targetKind];
if (!configFilenames) {
  throw new Error(`Unknown plugin pack build target: ${targetKind}`);
}
const configs = await Promise.all(
  configFilenames.map(readPluginPackTargetConfig),
);
const packIds = [...new Set(configs.flatMap(collectPluginPackIds))];

await Promise.all(packIds.map(buildPack));

async function buildPack(directory) {
  const packageJson = JSON.parse(
    await readFile(resolve("plugins", directory, "package.json"), "utf8"),
  );
  if (typeof packageJson.name !== "string" || packageJson.name.length === 0) {
    throw new Error(`Plugin pack ${directory} has no package name`);
  }
  await run("npm", ["run", "build", `--workspace=${packageJson.name}`]);
}

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else {
        rejectRun(
          new Error(
            `${command} ${args.join(" ")} failed with ${signal ?? code}`,
          ),
        );
      }
    });
  });
}
