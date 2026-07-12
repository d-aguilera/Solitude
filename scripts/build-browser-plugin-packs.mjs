#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const config = JSON.parse(
  await readFile(resolve("plugins/browser-plugin-packs.json"), "utf8"),
);

if (
  config.schemaVersion !== 1 ||
  !Array.isArray(config.packs) ||
  !config.packs.every((id) => typeof id === "string" && id.length > 0)
) {
  throw new Error("Invalid browser plugin pack build configuration");
}

await Promise.all(config.packs.map(buildPack));

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
