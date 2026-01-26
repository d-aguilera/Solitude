import type { LocalFrame, ShipBody, Vec3 } from "../domain/domainPorts.js";
import { rotateFrameAroundAxis } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import type { ControlState } from "./appInternals.js";
import type { ControlInput, DomainCameraPose } from "./appPorts.js";

/**
 * Update all camera positions / orientations.
 */
export function updateCameras(
  mainShip: ShipBody,
  pilotCamera: DomainCameraPose,
  topCamera: DomainCameraPose,
  controlState: ControlState,
): void {
  setCameraRelativeToShip(
    pilotCamera,
    mainShip,
    controlState.pilotCameraLocalOffset,
    controlState,
    frameFromShipForPilot,
  );

  setCameraRelativeToShip(
    topCamera,
    mainShip,
    { x: 0, y: 0, z: 50 },
    controlState,
    frameFromShipForTop,
  );
}

function frameFromShipForPilot(
  ship: ShipBody,
  controlState: ControlState,
): LocalFrame {
  const base = ship.frame;
  const { azimuth, elevation } = controlState.look;

  let frame: LocalFrame = {
    right: vec3.clone(base.right),
    forward: vec3.clone(base.forward),
    up: vec3.clone(base.up),
  };

  if (azimuth !== 0) {
    frame = rotateFrameAroundAxis(frame, frame.up, azimuth);
  }
  if (elevation !== 0) {
    frame = rotateFrameAroundAxis(frame, frame.right, elevation);
  }

  return frame;
}

function frameFromShipForTop(
  ship: ShipBody,
  controlState: ControlState,
): LocalFrame {
  void controlState;
  const { right, forward, up } = ship.frame;
  return {
    right: vec3.clone(right),
    forward: vec3.scale(up, -1),
    up: vec3.clone(forward),
  };
}

function setCameraRelativeToShip(
  pose: DomainCameraPose,
  ship: ShipBody,
  localOffset: Vec3,
  controlState: ControlState,
  frameFromShip: (ship: ShipBody, controlState: ControlState) => LocalFrame,
): void {
  const { right, forward, up } = ship.frame;

  const worldOffset = vec3.add3(
    vec3.scale(right, localOffset.x),
    vec3.scale(forward, localOffset.y),
    vec3.scale(up, localOffset.z),
  );

  pose.position = vec3.add(ship.position, worldOffset);
  pose.frame = frameFromShip(ship, controlState);
}

export function updatePilotCameraOffset(
  dtSeconds: number,
  input: ControlInput,
  pilotCameraLocalOffset: Vec3,
): void {
  if (dtSeconds <= 0) return;

  const moveSpeed = 0.5;

  let dx = 0;
  let dy = 0;
  let dz = 0;

  if (input.camForward) dy += moveSpeed;
  if (input.camBackward) dy -= moveSpeed;
  if (input.camUp) dz += moveSpeed;
  if (input.camDown) dz -= moveSpeed;

  if (dx === 0 && dy === 0 && dz === 0) return;

  pilotCameraLocalOffset.x += dx * dtSeconds;
  pilotCameraLocalOffset.y += dy * dtSeconds;
  pilotCameraLocalOffset.z += dz * dtSeconds;
}
