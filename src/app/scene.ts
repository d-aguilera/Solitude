import type { ControlledBody } from "../domain/domainPorts";
import { updateCameras, updateMainViewCameraOffset } from "./cameras";
import type { ControlInput } from "./controlPorts";
import { updateMainViewLook } from "./controls";
import type { SceneControlState } from "./scenePorts";
import type { SceneState } from "./viewPorts";

export function updateSceneGraph(
  dtMillis: number,
  sceneState: SceneState,
  sceneControlState: SceneControlState,
  mainControlledBody: ControlledBody,
  controlInput: ControlInput,
) {
  updateMainViewLook(
    dtMillis,
    controlInput,
    sceneControlState.mainViewLookState,
  );
  sceneControlState.pilotLookState = sceneControlState.mainViewLookState;
  updateMainViewCameraOffset(
    dtMillis,
    controlInput,
    sceneState.primaryView.cameraOffset,
  );

  updateCameras(
    mainControlledBody,
    sceneState.views,
    sceneControlState.mainViewLookState,
  );
}
