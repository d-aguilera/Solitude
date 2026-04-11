import type { ShipBody } from "../domain/domainPorts";
import { updateCameras, updatePilotCameraOffset } from "./cameras";
import type { ControlInput } from "./controlPorts";
import { updatePilotLook } from "./controls";
import type { SceneControlState, SceneState } from "./scenePorts";

export function updateSceneGraph(
  dtMillis: number,
  sceneState: SceneState,
  sceneControlState: SceneControlState,
  mainShip: ShipBody,
  controlInput: ControlInput,
) {
  const { pilotCamera, topCamera } = sceneState;

  updatePilotLook(dtMillis, controlInput, sceneControlState.pilotLookState);
  updatePilotCameraOffset(
    dtMillis,
    controlInput,
    sceneControlState.pilotCameraOffset,
  );

  updateCameras(mainShip, pilotCamera, topCamera, sceneControlState);
}
