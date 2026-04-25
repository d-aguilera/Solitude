import type { ShipBody } from "../domain/domainPorts";
import { type LocalFrame, localFrame } from "../domain/localFrame";
import { type Vec3, vec3 } from "../domain/vec3";
import type { ControlInput } from "./controlPorts";
import type { DomainCameraPose, PilotLookState } from "./scenePorts";
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
  mainShip: ShipBody,
  views: SceneViewState[],
  pilotLookState: PilotLookState,
): void {
  viewFrameUpdateParamsScratch.mainShip = mainShip;
  viewFrameUpdateParamsScratch.pilotLookState = pilotLookState;
  for (const view of views) {
    setCameraRelativeToShip(view.camera, mainShip, view.cameraOffset);
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
    updateFrame: updatePilotViewFrame,
  };
}

export function updatePilotViewFrame({
  frame,
  mainShip,
  pilotLookState,
}: {
  frame: LocalFrame;
  mainShip: ShipBody;
  pilotLookState: PilotLookState;
}): void {
  localFrame.copyInto(frame, mainShip.frame);
  const { azimuth, elevation } = pilotLookState;
  if (azimuth !== 0)
    localFrame.rotateAroundAxisInPlace(frame, frame.up, azimuth);
  if (elevation !== 0)
    localFrame.rotateAroundAxisInPlace(frame, frame.right, elevation);
}

function setCameraRelativeToShip(
  pose: DomainCameraPose,
  ship: ShipBody,
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

export function updatePilotCameraOffset(
  dtMillis: number,
  controlInput: ControlInput,
  pilotCameraLocalOffset: Vec3,
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

  pilotCameraLocalOffset.x += dx * dtMillis;
  pilotCameraLocalOffset.y += dy * dtMillis;
  pilotCameraLocalOffset.z += dz * dtMillis;
}
