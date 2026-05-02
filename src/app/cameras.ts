import type { ControlledBody } from "../domain/domainPorts";
import { localFrame } from "../domain/localFrame";
import { type Vec3, vec3 } from "../domain/vec3";
import type { ControlInput } from "./controlPorts";
import type { FocusContext } from "./runtimePorts";
import type { DomainCameraPose, MainViewLookState } from "./scenePorts";
import type {
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
  viewFrameUpdateParamsScratch.pilotLookState = mainViewLookState;
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
): ViewDefinition {
  return {
    id: "primary",
    labelMode: "full",
    initialCameraOffset,
    layout: { kind: "primary" },
    updateFrame: updateMainViewFrame,
  };
}

export function updateMainViewFrame({
  frame,
  mainFocus,
  mainViewLookState,
}: ViewFrameUpdateParams): void {
  localFrame.copyInto(frame, mainFocus.controlledBody.frame);
  const { azimuth, elevation } = mainViewLookState;
  if (azimuth !== 0)
    localFrame.rotateAroundAxisInPlace(frame, frame.up, azimuth);
  if (elevation !== 0)
    localFrame.rotateAroundAxisInPlace(frame, frame.right, elevation);
}

/** @deprecated Use updateMainViewFrame. */
export const updatePilotViewFrame = updateMainViewFrame;

function setCameraRelativeToControlledBody(
  pose: DomainCameraPose,
  ship: ControlledBody,
  localOffset: Vec3,
): void {
  const { right, forward, up } = ship.frame;

  vec3.scaleInto(offsetRightScratch, localOffset.x, right);
  vec3.scaleInto(offsetForwardScratch, localOffset.y, forward);
  vec3.scaleInto(offsetUpScratch, localOffset.z, up);

  // worldOffsetScratch = offsetRightScratch + offsetForwardScratch + offsetUpScratch
  vec3.addInto(worldOffsetScratch, offsetRightScratch, offsetForwardScratch);
  vec3.addInto(worldOffsetScratch, worldOffsetScratch, offsetUpScratch);

  // pose.position = ship.position + worldOffsetScratch
  vec3.addInto(pose.position, ship.position, worldOffsetScratch);
}

export function updateMainViewCameraOffset(
  dtMillis: number,
  controlInput: ControlInput,
  mainViewCameraLocalOffset: Vec3,
): void {
  if (dtMillis === 0) return;

  const moveSpeed = 5;

  let dx = 0;
  let dy = 0;
  let dz = 0;

  if (controlInput.camForward) dy += moveSpeed;
  if (controlInput.camBackward) dy -= moveSpeed;
  if (controlInput.camUp) dz += moveSpeed;
  if (controlInput.camDown) dz -= moveSpeed;

  if (dx === 0 && dy === 0 && dz === 0) return;

  mainViewCameraLocalOffset.x += dx * dtMillis;
  mainViewCameraLocalOffset.y += dy * dtMillis;
  mainViewCameraLocalOffset.z += dz * dtMillis;
}

/** @deprecated Use updateMainViewCameraOffset. */
export const updatePilotCameraOffset = updateMainViewCameraOffset;
