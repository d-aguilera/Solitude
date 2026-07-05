import type { GamePlugin } from "@solitude/engine/plugin";
import type { RenderMaterial, SceneObject } from "@solitude/engine/render";
import {
  earthCloudTextureId,
  earthDayTextureId,
  moonDayTextureId,
} from "./textureIds";

const earthId = "planet:earth";
const moonId = "planet:moon";

const earthMaterial: RenderMaterial = {
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

const moonMaterial: RenderMaterial = {
  kind: "sphericalTexture",
  textureId: moonDayTextureId,
};

export function createSolarSystemMaterialsPlugin(): GamePlugin {
  return {
    id: "solarSystemMaterials",
    scene: {
      initScene: ({ scene }) => {
        applySolarSystemMaterials(scene.objects);
      },
    },
  };
}

function applySolarSystemMaterials(objects: SceneObject[]): void {
  for (const object of objects) {
    if (object.id === earthId) {
      object.material = earthMaterial;
    } else if (object.id === moonId) {
      object.material = moonMaterial;
    }
  }
}
