import type { ControlledBody } from "../domain/domainPorts";
import { type Vec3, vec3 } from "../domain/vec3";
import type { FocusContext } from "./runtimePorts";
import type { DomainCameraPose, MainViewLookState } from "./scenePorts";
import type {
  MainViewCameraRig,
  SceneViewState,
  ViewDefinition,
  ViewFrameUpdateParams,
} from "./viewPorts";

// Scratch
const offsetRightScratch: Vec3 = vec3.zero();
const offsetForwardScratch: Vec3 = vec3.zero();
const offsetUpScratch: Vec3 = vec3.zero();
const worldOffsetScratch: Vec3 = vec3.zero();
const viewFrameUpdateParamsScratch = {} as ViewFrameUpdateParams;

/**
 * Update all camera positions / orientations.
 */
export function updateCameras(
  mainFocus: FocusContext,
  views: SceneViewState[],
  mainViewLookState: MainViewLookState,
): void {
  const focusedBody = mainFocus.controlledBody;
  viewFrameUpdateParamsScratch.mainFocus = mainFocus;
  viewFrameUpdateParamsScratch.mainViewLookState = mainViewLookState;
  for (const view of views) {
    setCameraRelativeToControlledBody(
      view.camera,
      focusedBody,
      view.cameraOffset,
    );
    viewFrameUpdateParamsScratch.frame = view.camera.frame;
    view.definition.updateFrame(viewFrameUpdateParamsScratch);
  }
}

export function createPrimaryViewDefinition(
  initialCameraOffset: Vec3,
  cameraRig: MainViewCameraRig,
): ViewDefinition {
  return {
    id: "primary",
    labelMode: "full",
    initialCameraOffset,
    layout: { kind: "primary" },
    updateFrame: cameraRig.updateFrame,
  };
}

function setCameraRelativeToControlledBody(
  pose: DomainCameraPose,
  controlledBody: ControlledBody,
  localOffset: Vec3,
): void {
  const frame = controlledBody.frame;

  vec3.scaleInto(offsetRightScratch, localOffset.x, frame.right);
  vec3.scaleInto(offsetForwardScratch, localOffset.y, frame.forward);
  vec3.scaleInto(offsetUpScratch, localOffset.z, frame.up);

  // worldOffsetScratch = offsetRightScratch + offsetForwardScratch + offsetUpScratch
  vec3.addInto(worldOffsetScratch, offsetRightScratch, offsetForwardScratch);
  vec3.addInto(worldOffsetScratch, worldOffsetScratch, offsetUpScratch);

  vec3.addInto(pose.position, controlledBody.position, worldOffsetScratch);
}
