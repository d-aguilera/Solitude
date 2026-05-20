import { updateCameras } from "./cameras";
import type { FocusContext } from "./runtimePorts";
import type { MainViewLookState } from "./scenePorts";
import type { SceneState } from "./viewPorts";

export function updateSceneViewCameras(
  sceneState: SceneState,
  mainFocus: FocusContext,
  mainViewLookState: MainViewLookState,
) {
  updateCameras(mainFocus, sceneState.views, mainViewLookState);
}
