import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadServerPluginSet } from "./server";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe(loadServerPluginSet.name, () => {
  it("discovers every plugin in pack order", async () => {
    const root = await createTemporaryDirectory();
    await writePlugin(root, "content", "poly-fighter", "polyFighter", 42);
    await writePlugin(root, "content", "second", "secondPlugin", 7);
    await writePack(root, "content", [
      "./poly-fighter/plugin.json",
      "./second/plugin.json",
    ]);
    const pluginSetPath = await writePluginSet(root, [
      "./packs/content/pack.json",
    ]);

    const loaded = await loadServerPluginSet(pluginSetPath);

    expect(loaded.ids).toEqual(["polyFighter", "secondPlugin"]);
    expect(loaded.catalog.polyFighter({}).capabilities).toEqual([
      { id: "test", value: 42 },
    ]);
    expect(loaded.catalog.secondPlugin({}).capabilities).toEqual([
      { id: "test", value: 7 },
    ]);
  });

  it("rejects a browser-only pack before importing its plugins", async () => {
    const root = await createTemporaryDirectory();
    await writePlugin(root, "content", "poly-fighter", "polyFighter", 42);
    await writePack(
      root,
      "content",
      ["./poly-fighter/plugin.json"],
      ["browser"],
    );
    const pluginSetPath = await writePluginSet(root, [
      "./packs/content/pack.json",
    ]);

    await expect(loadServerPluginSet(pluginSetPath)).rejects.toThrow(
      "content does not support host server",
    );
  });

  it("rejects plugin manifests that escape their pack directory", async () => {
    const root = await createTemporaryDirectory();
    await writePlugin(root, "outside", "poly-fighter", "polyFighter", 42);
    await writePack(root, "content", ["../outside/poly-fighter/plugin.json"]);
    const pluginSetPath = await writePluginSet(root, [
      "./packs/content/pack.json",
    ]);

    await expect(loadServerPluginSet(pluginSetPath)).rejects.toThrow(
      "Plugin manifest escapes its pack directory",
    );
  });

  it("rejects module entries that escape their plugin directory", async () => {
    const root = await createTemporaryDirectory();
    const pluginDirectory = resolve(root, "packs/content/poly-fighter");
    await mkdir(pluginDirectory, { recursive: true });
    await writeFile(
      resolve(root, "packs/content/outside.mjs"),
      'export function createPlugin() { return { id: "polyFighter" }; }\n',
    );
    await writeFile(
      resolve(pluginDirectory, "plugin.json"),
      `${JSON.stringify({
        apiVersion: SOLITUDE_PLUGIN_API_VERSION,
        entry: "../outside.mjs",
        id: "polyFighter",
        schemaVersion: 2,
      })}\n`,
    );
    await writePack(root, "content", ["./poly-fighter/plugin.json"]);
    const pluginSetPath = await writePluginSet(root, [
      "./packs/content/pack.json",
    ]);

    await expect(loadServerPluginSet(pluginSetPath)).rejects.toThrow(
      "escapes its plugin directory",
    );
  });

  it("rejects symlinked pack documents outside the plugin root", async () => {
    const root = await createTemporaryDirectory();
    const outside = await createTemporaryDirectory();
    await writePlugin(outside, "content", "poly-fighter", "polyFighter", 42);
    await writePack(outside, "content", ["./poly-fighter/plugin.json"]);
    await mkdir(resolve(root, "packs"), { recursive: true });
    await symlink(
      resolve(outside, "packs/content"),
      resolve(root, "packs/content"),
      "dir",
    );
    const pluginSetPath = await writePluginSet(root, [
      "./packs/content/pack.json",
    ]);

    await expect(loadServerPluginSet(pluginSetPath)).rejects.toThrow(
      "escapes plugin root",
    );
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), "solitude-plugin-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writePlugin(
  root: string,
  packId: string,
  directory: string,
  id: string,
  value: number,
): Promise<void> {
  const pluginDirectory = resolve(root, "packs", packId, directory);
  await mkdir(pluginDirectory, { recursive: true });
  await writeFile(
    resolve(pluginDirectory, "index.mjs"),
    `export function createPlugin() { return { id: ${JSON.stringify(id)}, capabilities: [{ id: "test", value: ${value} }] }; }\n`,
  );
  await writeFile(
    resolve(pluginDirectory, "plugin.json"),
    `${JSON.stringify({
      apiVersion: SOLITUDE_PLUGIN_API_VERSION,
      entry: "./index.mjs",
      id,
      schemaVersion: 2,
    })}\n`,
  );
}

async function writePack(
  root: string,
  id: string,
  plugins: readonly string[],
  hosts: readonly string[] = ["browser", "server"],
): Promise<void> {
  const filename = resolve(root, "packs", id, "pack.json");
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(
    filename,
    `${JSON.stringify({ hosts, id, plugins, schemaVersion: 2 })}\n`,
  );
}

async function writePluginSet(
  root: string,
  packs: readonly string[],
): Promise<string> {
  const filename = resolve(root, "plugin-set.json");
  await writeFile(filename, `${JSON.stringify({ packs, schemaVersion: 1 })}\n`);
  return filename;
}
