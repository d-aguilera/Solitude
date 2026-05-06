import type { WorldAndSceneConfig } from "@solitude/engine/app/configPorts";
import { vec3 } from "@solitude/engine/domain/vec3";

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
