import { describe, expect, it } from "vitest";
import type { GamePlugin } from "../pluginPorts";
import { collectPluginTextureSources } from "../pluginRenderAssets";

describe("plugin render assets", () => {
  it("collects texture sources from plugins", () => {
    expect(
      collectPluginTextureSources([
        createTexturePlugin("a", { "texture:a": "/a.jpg" }),
        createTexturePlugin("b", { "texture:b": "/b.jpg" }),
      ]),
    ).toEqual({
      "texture:a": "/a.jpg",
      "texture:b": "/b.jpg",
    });
  });

  it("allows plugins to repeat the same texture source", () => {
    expect(
      collectPluginTextureSources([
        createTexturePlugin("a", { "texture:shared": "/shared.jpg" }),
        createTexturePlugin("b", { "texture:shared": "/shared.jpg" }),
      ]),
    ).toEqual({
      "texture:shared": "/shared.jpg",
    });
  });

  it("rejects conflicting plugin texture sources", () => {
    expect(() =>
      collectPluginTextureSources([
        createTexturePlugin("a", { "texture:shared": "/a.jpg" }),
        createTexturePlugin("b", { "texture:shared": "/b.jpg" }),
      ]),
    ).toThrow(
      'Texture source "texture:shared" is provided by both "a" and "b"',
    );
  });

  it("lets explicit texture sources override plugin sources", () => {
    expect(
      collectPluginTextureSources(
        [createTexturePlugin("a", { "texture:a": "/plugin.jpg" })],
        { "texture:a": "/explicit.jpg" },
      ),
    ).toEqual({
      "texture:a": "/explicit.jpg",
    });
  });
});

function createTexturePlugin(
  id: string,
  textureSources: Record<string, string>,
): GamePlugin {
  return {
    id,
    renderAssets: {
      textureSources,
    },
  };
}
