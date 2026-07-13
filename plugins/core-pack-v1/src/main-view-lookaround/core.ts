import type { Vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalControlInput,
  ExternalMainViewLookState,
  ExternalViewControlPlugin,
} from "@solitude/plugin-api/plugin";

const lookSpeed = 0.0015;
const cameraOffsetMoveSpeed = 5;

export function createViewControlPlugin(): ExternalViewControlPlugin {
  return {
    updateViewControls: ({
      controlInput,
      dtMillis,
      sceneControlState,
      sceneState,
    }) => {
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
    },
  };
}

function updateMainViewLook(
  dtMillis: number,
  controlInput: ExternalControlInput,
  lookState: ExternalMainViewLookState,
): void {
  if (controlInput.lookReset) {
    lookState.azimuth = 0;
    lookState.elevation = 0;
  }

  if (controlInput.lookLeft) lookState.azimuth += lookSpeed * dtMillis;
  if (controlInput.lookRight) lookState.azimuth -= lookSpeed * dtMillis;
  if (controlInput.lookUp) lookState.elevation += lookSpeed * dtMillis;
  if (controlInput.lookDown) lookState.elevation -= lookSpeed * dtMillis;
}

function updateMainViewCameraOffset(
  dtMillis: number,
  controlInput: ExternalControlInput,
  mainViewCameraLocalOffset: Vec3,
): void {
  if (dtMillis === 0) return;

  let dy = 0;
  let dz = 0;

  if (controlInput.camForward) dy += cameraOffsetMoveSpeed;
  if (controlInput.camBackward) dy -= cameraOffsetMoveSpeed;
  if (controlInput.camUp) dz += cameraOffsetMoveSpeed;
  if (controlInput.camDown) dz -= cameraOffsetMoveSpeed;

  if (dy === 0 && dz === 0) return;

  mainViewCameraLocalOffset.y += dy * dtMillis;
  mainViewCameraLocalOffset.z += dz * dtMillis;
}
