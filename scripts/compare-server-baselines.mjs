#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  compareServerBaselines,
  renderServerBaselineComparisonMarkdown,
} from "./server-baseline-comparison.mjs";

const root = process.cwd();
const defaultReferencePointer = resolve(
  root,
  "benchmarks/server/reference-baseline.json",
);

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});

async function main() {
  const options = parseOptions();
  const referencePath = options.reference
    ? resolve(options.reference)
    : await readDefaultReferencePath();
  const candidatePath = resolve(options.candidate);
  const [reference, candidate] = await Promise.all([
    readJson(referencePath, "reference"),
    readJson(candidatePath, "candidate"),
  ]);
  const comparison = compareServerBaselines({
    candidate,
    candidatePath: displayPath(candidatePath),
    reference,
    referencePath: displayPath(referencePath),
  });
  const serialized = options.json
    ? JSON.stringify(comparison, null, 2)
    : renderServerBaselineComparisonMarkdown(comparison);
  if (options.output) {
    const outputPath = resolve(options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${serialized}\n`, "utf8");
  }
  process.stdout.write(`${serialized}\n`);
}

function parseOptions() {
  const { values } = parseArgs({
    options: {
      candidate: { type: "string" },
      json: { default: false, type: "boolean" },
      output: { type: "string" },
      reference: { type: "string" },
    },
  });
  if (!values.candidate) {
    throw new Error("--candidate is required");
  }
  return values;
}

async function readDefaultReferencePath() {
  const pointer = await readJson(defaultReferencePointer, "reference pointer");
  if (pointer.schemaVersion !== 1 || typeof pointer.result !== "string") {
    throw new Error("Reference pointer has an unexpected shape");
  }
  return resolve(dirname(defaultReferencePointer), pointer.result);
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${label} JSON at ${displayPath(path)}`, {
      cause: error,
    });
  }
}

function displayPath(path) {
  const displayed = relative(root, path);
  return displayed.startsWith("..") ? path : displayed;
}
