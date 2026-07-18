import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import { describe, expect, it } from "vitest";
import {
  collectRenderTextureSources,
  renderTextureSourcesCapability,
} from "../../infra/renderTextureSources";

describe("render texture sources", () => {
  it("collects texture sources from plugin capabilities", () => {
    expect(
      collectRenderTextureSources(
        createPluginCapabilityRegistry([
          createTextureSourceCapability({ "texture:a": "/a.jpg" }),
          createTextureSourceCapability({ "texture:b": "/b.jpg" }),
        ]),
      ),
    ).toEqual({
      "texture:a": "/a.jpg",
      "texture:b": "/b.jpg",
    });
  });

  it("allows capabilities to repeat the same texture source", () => {
    expect(
      collectRenderTextureSources(
        createPluginCapabilityRegistry([
          createTextureSourceCapability({ "texture:shared": "/shared.jpg" }),
          createTextureSourceCapability({ "texture:shared": "/shared.jpg" }),
        ]),
      ),
    ).toEqual({
      "texture:shared": "/shared.jpg",
    });
  });

  it("rejects conflicting texture sources", () => {
    expect(() =>
      collectRenderTextureSources(
        createPluginCapabilityRegistry([
          createTextureSourceCapability({ "texture:shared": "/a.jpg" }),
          createTextureSourceCapability({ "texture:shared": "/b.jpg" }),
        ]),
      ),
    ).toThrow(
      'Texture source "texture:shared" is provided by multiple render texture source providers',
    );
  });
});

function createTextureSourceCapability(textureSources: Record<string, string>) {
  return {
    id: renderTextureSourcesCapability,
    value: { textureSources },
  };
}
