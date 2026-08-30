#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { reanalyzeBaselineResult } from "./server-baseline-helpers.mjs";

const root = process.cwd();

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

async function main() {
  const { values } = parseArgs({
    options: { baseline: { type: "string" }, check: { type: "boolean" } },
  });
  if (!values.baseline) throw new Error("--baseline is required");
  const path = resolve(values.baseline);
  const before = JSON.parse(await readFile(path, "utf8"));
  const beforeSummaries = summarize(before);
  const after = reanalyzeBaselineResult(JSON.parse(JSON.stringify(before)));
  const afterSummaries = summarize(after);

  const changes = [];
  for (const [name, wasSaturated] of beforeSummaries) {
    const nowSaturated = afterSummaries.get(name);
    if (wasSaturated !== nowSaturated) {
      changes.push(
        `${name}: confirmedSaturation ${wasSaturated} -> ${nowSaturated}`,
      );
    }
  }
  for (const change of changes) process.stdout.write(`${change}\n`);
  process.stdout.write(
    `${changes.length} workload verdict(s) changed in ${relative(root, path)}\n`,
  );
  if (values.check) {
    if (changes.length > 0) process.exitCode = 1;
    return;
  }
  await writeFile(path, `${JSON.stringify(after, null, 2)}\n`, "utf8");
  process.stdout.write("rewritten\n");
}

function summarize(baseline) {
  return new Map(
    [...baseline.scenarios, ...baseline.capacitySweep].map((workload) => [
      workload.scenario.name,
      Boolean(workload.summary.confirmedSaturation),
    ]),
  );
}
