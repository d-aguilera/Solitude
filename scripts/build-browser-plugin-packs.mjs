#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const config = JSON.parse(
  await readFile(resolve("plugins/browser-plugin-packs.json"), "utf8"),
);

const packIds = collectPackIds(config);

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

function collectPackIds(value) {
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

  return [...new Set(targets.flatMap(([, packs]) => packs))];
}
