import type { LocalFrame, ShipBody, Vec3 } from "../domain/domainPorts.js";
import { localFrame } from "../domain/localFrame.js";
import { vec3 } from "../domain/vec3.js";
import type {
  ControlInput,
  DomainCameraPose,
  SceneControlState,
} from "./appPorts.js";

// Scratch
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
    (frame) => {
      localFrame.copyInto(frame, mainShip.frame);
      const { azimuth, elevation } = sceneControlState.look;
      if (azimuth !== 0)
        localFrame.rotateAroundAxisInPlace(frame, frame.up, azimuth);
      if (elevation !== 0)
        localFrame.rotateAroundAxisInPlace(frame, frame.right, elevation);
    },
  );

  setCameraRelativeToShip(
    topCamera,
    mainShip,
    sceneControlState.topCameraLocalOffset,
    (frame) => {
      const { right, forward, up } = mainShip.frame;
      vec3.copyInto(frame.right, right);
      vec3.scaleInto(frame.forward, -1, up); // forward = -up
      vec3.copyInto(frame.up, forward); // up = forward
    },
  );
}

function setCameraRelativeToShip(
  pose: DomainCameraPose,
  ship: ShipBody,
  localOffset: Vec3,
  updateFrameFromShip: (frame: LocalFrame) => void,
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

  updateFrameFromShip(pose.frame);
}

export function updatePilotCameraOffset(
  dtMillis: number,
  controlInput: ControlInput,
  pilotCameraLocalOffset: Vec3,
): void {
  if (dtMillis === 0) return;

  const moveSpeed = 0.0005;

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
