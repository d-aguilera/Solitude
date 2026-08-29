#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { captureServerMetadata } from "./server-baseline-environment.mjs";

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

async function main() {
  const { values } = parseArgs({
    options: {
      "cpu-affinity": { default: "not-pinned", type: "string" },
      machine: { type: "string" },
      output: { type: "string" },
    },
  });
  const machine = values.machine?.trim();
  if (!machine) throw new Error("--machine is required");
  const cpuAffinity = values["cpu-affinity"].trim();
  if (!cpuAffinity) throw new Error("--cpu-affinity must not be empty");
  const metadata = await captureServerMetadata({ cpuAffinity, machine });
  const serialized = `${JSON.stringify(metadata, null, 2)}\n`;
  if (values.output) {
    const outputPath = resolve(values.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serialized, "utf8");
  }
  process.stdout.write(serialized);
}
