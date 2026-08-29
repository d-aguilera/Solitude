#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  compareServerBaselines,
  renderServerBaselineComparisonMarkdown,
  selectReferenceEntry,
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
  const candidatePath = resolve(options.candidate);
  const candidate = await readJson(candidatePath, "candidate");
  const referencePath = options.reference
    ? resolve(options.reference)
    : await resolveReferencePath(candidate, options.referenceTopology);
  const reference = await readJson(referencePath, "reference");
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
      "reference-topology": { type: "string" },
    },
  });
  if (!values.candidate) {
    throw new Error("--candidate is required");
  }
  return { ...values, referenceTopology: values["reference-topology"] };
}

async function resolveReferencePath(candidate, topology) {
  const pointer = await readJson(defaultReferencePointer, "reference pointer");
  const entry = selectReferenceEntry({
    candidate,
    pointer,
    pointerPath: displayPath(defaultReferencePointer),
    topology,
  });
  return resolve(dirname(defaultReferencePointer), entry.result);
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
