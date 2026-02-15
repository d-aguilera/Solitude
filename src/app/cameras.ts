import type { LocalFrame, ShipBody, Vec3 } from "../domain/domainPorts.js";
import { localFrame } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import type {
  ControlInput,
  DomainCameraPose,
  SceneControlState,
} from "./appPorts.js";

// Reusable scratch frames to avoid per‑frame allocations
const pilotFrameScratch: LocalFrame = {
  right: vec3.zero(),
  forward: vec3.zero(),
  up: vec3.zero(),
};

const topFrameScratch: LocalFrame = {
  right: vec3.zero(),
  forward: vec3.zero(),
  up: vec3.zero(),
};

const offsetRightScratch: Vec3 = vec3.zero();
const offsetForwardScratch: Vec3 = vec3.zero();
const offsetUpScratch: Vec3 = vec3.zero();
const worldOffsetScratch: Vec3 = vec3.zero();

/**
 * Update all camera positions / orientations.
 */
export function updateCameras(
  mainShip: ShipBody,
  pilotCamera: DomainCameraPose,
  topCamera: DomainCameraPose,
  sceneControlState: SceneControlState,
): void {
  setCameraRelativeToShip(
    pilotCamera,
    mainShip,
    sceneControlState.pilotCameraLocalOffset,
    sceneControlState,
    frameFromShipForPilot,
  );

  setCameraRelativeToShip(
    topCamera,
    mainShip,
    sceneControlState.topCameraLocalOffset,
    sceneControlState,
    frameFromShipForTop,
  );
}

function frameFromShipForPilot(
  ship: ShipBody,
  sceneControlState: SceneControlState,
): LocalFrame {
  const base = ship.frame;
  const { azimuth, elevation } = sceneControlState.look;

  // Copy ship frame into scratch without allocating
  vec3.copyInto(pilotFrameScratch.right, base.right);
  vec3.copyInto(pilotFrameScratch.forward, base.forward);
  vec3.copyInto(pilotFrameScratch.up, base.up);

  let frame = pilotFrameScratch;

  if (azimuth !== 0) {
    frame = localFrame.rotateAroundAxis(frame, frame.up, azimuth);
  }
  if (elevation !== 0) {
    frame = localFrame.rotateAroundAxis(frame, frame.right, elevation);
  }

  return frame;
}

function frameFromShipForTop(
  ship: ShipBody,
  sceneControlState: SceneControlState,
): LocalFrame {
  void sceneControlState;
  const { right, forward, up } = ship.frame;

  vec3.copyInto(topFrameScratch.right, right);
  vec3.copyInto(topFrameScratch.forward, up);
  vec3.copyInto(topFrameScratch.up, forward);

  // forward = -up
  vec3.scaleInto(topFrameScratch.forward, -1, topFrameScratch.forward);

  return topFrameScratch;
}

function setCameraRelativeToShip(
  pose: DomainCameraPose,
  ship: ShipBody,
  localOffset: Vec3,
  sceneControlState: SceneControlState,
  frameFromShip: (
    ship: ShipBody,
    controlState: SceneControlState,
  ) => LocalFrame,
): void {
  const { right, forward, up } = ship.frame;

  // offsetRightScratch = right * localOffset.x
  vec3.scaleInto(offsetRightScratch, localOffset.x, right);
  // offsetForwardScratch = forward * localOffset.y
  vec3.scaleInto(offsetForwardScratch, localOffset.y, forward);
  // offsetUpScratch = up * localOffset.z
  vec3.scaleInto(offsetUpScratch, localOffset.z, up);

  // worldOffsetScratch = offsetRightScratch + offsetForwardScratch + offsetUpScratch
  vec3.addInto(worldOffsetScratch, offsetRightScratch, offsetForwardScratch);
  vec3.addInto(worldOffsetScratch, worldOffsetScratch, offsetUpScratch);

  // pose.position = ship.position + worldOffsetScratch
  vec3.addInto(pose.position, ship.position, worldOffsetScratch);

  pose.frame = frameFromShip(ship, sceneControlState);
}

export function updatePilotCameraOffset(
  dtSeconds: number,
  controlInput: ControlInput,
  pilotCameraLocalOffset: Vec3,
): void {
  if (dtSeconds <= 0) return;

  const moveSpeed = 0.5;

  let dx = 0;
  let dy = 0;
  let dz = 0;

  if (controlInput.camForward) dy += moveSpeed;
  if (controlInput.camBackward) dy -= moveSpeed;
  if (controlInput.camUp) dz += moveSpeed;
  if (controlInput.camDown) dz -= moveSpeed;

  if (dx === 0 && dy === 0 && dz === 0) return;

  pilotCameraLocalOffset.x += dx * dtSeconds;
  pilotCameraLocalOffset.y += dy * dtSeconds;
  pilotCameraLocalOffset.z += dz * dtSeconds;
}
