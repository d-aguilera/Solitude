import type { LocalFrame, ShipBody, Vec3 } from "../domain/domainPorts.js";
import { rotateFrameAroundAxis } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import type {
  ControlInput,
  DomainCameraPose,
  SceneControlState,
} from "./appPorts.js";

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
    { x: 0, y: 0, z: 50 },
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
  sceneControlState: SceneControlState,
): LocalFrame {
  void sceneControlState;
  const { right, forward, up } = ship.frame;
  const rightClone = vec3.clone(right);
  const forwardClone = vec3.clone(up);
  const upClone = vec3.clone(forward);
  return {
    right: rightClone,
    forward: vec3.scaleInto(forwardClone, -1, forwardClone),
    up: upClone,
  };
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

  const worldOffset = vec3.add3(
    vec3.scale(right, localOffset.x),
    vec3.scale(forward, localOffset.y),
    vec3.scale(up, localOffset.z),
  );

  vec3.addInto(pose.position, ship.position, worldOffset);
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
