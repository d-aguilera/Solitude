import { updateCameras, updateMainViewCameraOffset } from "./cameras";
import type { ControlInput } from "./controlPorts";
import { updateMainViewLook } from "./mainViewControls";
import type { FocusContext } from "./runtimePorts";
import type { SceneControlState } from "./scenePorts";
import type { SceneState } from "./viewPorts";

export function updateSceneGraph(
  dtMillis: number,
  sceneState: SceneState,
  sceneControlState: SceneControlState,
  mainFocus: FocusContext,
  controlInput: ControlInput,
) {
  updateMainViewLook(
    dtMillis,
    controlInput,
    sceneControlState.mainViewLookState,
  );
  updateMainViewCameraOffset(
    dtMillis,
    controlInput,
    sceneState.primaryView.cameraOffset,
  );

  updateCameras(
    mainFocus,
    sceneState.views,
    sceneControlState.mainViewLookState,
  );
}
