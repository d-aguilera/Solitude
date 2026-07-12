#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageRoot = resolve("dist/plugin-packages/targeting-laser");
const publicRoot = resolve("dist/plugin-public/plugins");
const targetRoot = resolve(publicRoot, "targeting-laser");

await assertSelfContainedModule(resolve(packageRoot, "index.js"));
await rm(publicRoot, { force: true, recursive: true });
await mkdir(publicRoot, { recursive: true });
await cp(packageRoot, targetRoot, { recursive: true });
await writeFile(
  resolve(publicRoot, "plugin-set.json"),
  `${JSON.stringify(
    {
      plugins: ["./targeting-laser/plugin.json"],
      schemaVersion: 1,
    },
    null,
    2,
  )}\n`,
);

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
