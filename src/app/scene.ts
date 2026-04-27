import type { ControlledBody } from "../domain/domainPorts";
import { updateCameras, updatePilotCameraOffset } from "./cameras";
import type { ControlInput } from "./controlPorts";
import { updatePilotLook } from "./controls";
import type { SceneControlState } from "./scenePorts";
import type { SceneState } from "./viewPorts";

export function updateSceneGraph(
  dtMillis: number,
  sceneState: SceneState,
  sceneControlState: SceneControlState,
  mainControlledBody: ControlledBody,
  controlInput: ControlInput,
) {
  updatePilotLook(dtMillis, controlInput, sceneControlState.pilotLookState);
  updatePilotCameraOffset(
    dtMillis,
    controlInput,
    sceneState.primaryView.cameraOffset,
  );

  updateCameras(
    mainControlledBody,
    sceneState.views,
    sceneControlState.pilotLookState,
  );
}
