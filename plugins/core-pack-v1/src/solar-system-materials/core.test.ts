import {
  renderTextureSourcesCapability,
  type ExternalRenderTextureSourcesProvider,
  type ExternalScene,
} from "@solitude/plugin-api";
import { describe, expect, it } from "vitest";
import { createPlugin } from "./index";
import {
  earthCloudTextureId,
  earthDayTextureId,
  moonDayTextureId,
} from "./textureIds";

describe("solar system materials plugin", () => {
  it("contributes pack-relative texture sources through a capability", () => {
    const textureCapability = createPlugin({}).capabilities?.[0];
    const textureProvider = textureCapability?.value as
      | ExternalRenderTextureSourcesProvider
      | undefined;

    expect(textureCapability?.id).toBe(renderTextureSourcesCapability);
    expect(textureProvider?.textureSources[earthDayTextureId]).toMatch(
      /\/assets\/earth-blue-marble-land-ocean-ice-8192\.jpg$/,
    );
    expect(textureProvider?.textureSources[earthCloudTextureId]).toMatch(
      /\/assets\/earth-blue-marble-clouds-2048\.jpg$/,
    );
    expect(textureProvider?.textureSources[moonDayTextureId]).toMatch(
      /\/assets\/moon-lro-lroc-color-4096\.jpg$/,
    );
  });

  it("assigns texture materials to Earth and the Moon", () => {
    const scene: ExternalScene = {
      objects: [
        { id: "planet:earth" },
        { id: "planet:moon" },
        { id: "planet:mars" },
      ],
    };

    createPlugin({}).scene?.initScene?.({ scene });

    expect(scene.objects[0].material).toEqual(
      expect.objectContaining({
        cloudTextureId: earthCloudTextureId,
        kind: "sphericalTexture",
        textureId: earthDayTextureId,
      }),
    );
    expect(scene.objects[1].material).toEqual({
      kind: "sphericalTexture",
      textureId: moonDayTextureId,
    });
    expect(scene.objects[2].material).toBeUndefined();
  });
});
