import {
  createRenderTextureSourcesCapability,
  type ExternalPlugin,
  type ExternalRenderMaterial,
  type ExternalRuntimeOptions,
  type ExternalSceneObject,
} from "@solitude/plugin-api";
import {
  earthCloudTextureId,
  earthDayTextureId,
  moonDayTextureId,
} from "./textureIds";
import { createSolarSystemMaterialTextureSources } from "./textures";

const earthId = "planet:earth";
const moonId = "planet:moon";

const earthMaterial: ExternalRenderMaterial = {
  atmosphere: {
    color: { r: 85, g: 205, b: 255 },
    opacity: 1,
    scale: 1.008,
  },
  cloudOpacity: 0.42,
  cloudScale: 1.002,
  cloudTextureId: earthCloudTextureId,
  kind: "sphericalTexture",
  textureId: earthDayTextureId,
};

const moonMaterial: ExternalRenderMaterial = {
  kind: "sphericalTexture",
  textureId: moonDayTextureId,
};

const textureSources = createSolarSystemMaterialTextureSources(import.meta.url);

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  return {
    capabilities: [createRenderTextureSourcesCapability(textureSources)],
    id: "solarSystemMaterials",
    scene: {
      initScene: ({ scene }) => {
        applySolarSystemMaterials(scene.objects);
      },
    },
  };
}

function applySolarSystemMaterials(objects: ExternalSceneObject[]): void {
  for (const object of objects) {
    if (object.id === earthId) {
      object.material = earthMaterial;
    } else if (object.id === moonId) {
      object.material = moonMaterial;
    }
  }
}
