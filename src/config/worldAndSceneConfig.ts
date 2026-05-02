import type { WorldAndSceneConfig } from "../app/configPorts";
import { vec3 } from "../domain/vec3";

export function buildWorldAndSceneConfig() {
  const config: WorldAndSceneConfig = {
    entities: [],
    mainFocusEntityId: "",
    mainControlledEntityId: "",
    thrustLevel: 1,
    render: {
      mainViewCameraOffset: vec3.create(0, 51000, 4850),
      mainViewLookState: { azimuth: 0, elevation: 0 },
    },
  };

  return config;
}
