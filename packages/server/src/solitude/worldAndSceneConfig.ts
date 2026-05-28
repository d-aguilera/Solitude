import { vec3 } from "@solitude/engine/math";
import type { WorldAndSceneConfig } from "@solitude/engine/world";

export function buildWorldAndSceneConfig() {
  const config: WorldAndSceneConfig = {
    entities: [],
    mainFocusEntityId: "",
    render: {
      mainViewCameraOffset: vec3.create(0, 51000, 4850),
      mainViewLookState: { azimuth: 0, elevation: 0 },
    },
  };

  return config;
}
