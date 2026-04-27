import type { WorldAndSceneConfig } from "../app/configPorts";
import { vec3 } from "../domain/vec3";

export function buildWorldAndSceneConfig() {
  const config: WorldAndSceneConfig = {
    entities: [],
    mainControlledEntityId: "",
    mainShipId: "",
    thrustLevel: 1,
    physics: {
      planets: [],
      shipInitialStates: [],
      ships: [],
    },
    render: {
      pilotCameraOffset: vec3.create(0, 51000, 4850),
      pilotLookState: { azimuth: 0, elevation: 0 },
    },
  };

  return config;
}
