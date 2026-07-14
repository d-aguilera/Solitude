import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function readPluginPackTargetConfig(filename) {
  const config = JSON.parse(await readFile(resolve(filename), "utf8"));
  validatePluginPackTargetConfig(config, filename);
  return config;
}

export function collectPluginPackIds(config) {
  return [...new Set(Object.values(config.targets).flat())];
}

function validatePluginPackTargetConfig(value, filename) {
  if (
    value.schemaVersion !== 2 ||
    typeof value.targets !== "object" ||
    value.targets === null ||
    Array.isArray(value.targets) ||
    Object.keys(value).some(
      (key) => key !== "schemaVersion" && key !== "targets",
    )
  ) {
    throw new Error(`Invalid plugin pack target configuration: ${filename}`);
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
    throw new Error(`Invalid plugin pack target configuration: ${filename}`);
  }
}
