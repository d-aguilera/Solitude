import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadServerPlugin } from "./server";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("server plugin runtime", () => {
  it("loads a plugin from a contained module entry", async () => {
    const directory = await createTemporaryDirectory();
    const manifestPath = await writePlugin(directory, {
      source:
        'export function createPlugin() { return { id: "polyFighter", capabilities: [{ id: "test", value: 42 }] }; }\n',
    });

    const loaded = await loadServerPlugin(manifestPath);

    expect(loaded.ids).toEqual(["polyFighter"]);
    expect(loaded.catalog.polyFighter({}).capabilities).toEqual([
      { id: "test", value: 42 },
    ]);
  });

  it("rejects legacy per-plugin environment metadata", async () => {
    const directory = await createTemporaryDirectory();
    const manifestPath = await writePlugin(directory, {
      extraManifest: { environment: "universal" },
      source:
        'export function createPlugin() { return { id: "polyFighter" }; }\n',
    });

    await expect(loadServerPlugin(manifestPath)).rejects.toThrow(
      "Invalid plugin manifest",
    );
  });

  it("rejects module entries outside the manifest directory", async () => {
    const directory = await createTemporaryDirectory();
    const pluginDirectory = resolve(directory, "plugin");
    const manifestPath = await writePlugin(pluginDirectory, {
      entry: "../outside.mjs",
      source:
        'export function createPlugin() { return { id: "polyFighter" }; }\n',
    });
    await expect(loadServerPlugin(manifestPath)).rejects.toThrow(
      "escapes its manifest directory",
    );
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), "solitude-plugin-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writePlugin(
  directory: string,
  {
    entry = "index.mjs",
    extraManifest = {},
    source,
  }: {
    entry?: string;
    extraManifest?: Readonly<Record<string, unknown>>;
    source: string;
  },
): Promise<string> {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, entry), source);
  const manifestPath = resolve(directory, "plugin.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify({
      apiVersion: SOLITUDE_PLUGIN_API_VERSION,
      entry,
      id: "polyFighter",
      schemaVersion: 2,
      ...extraManifest,
    })}\n`,
  );
  return manifestPath;
}
