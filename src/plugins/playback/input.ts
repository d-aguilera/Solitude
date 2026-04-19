import type { ControlAction } from "../../app/controlPorts";
import type { InputPlugin, KeyHandler } from "../../app/pluginPorts";
import type { DiagnosticRuntimeOptions } from "../../app/runtimeOptions";
import type { PlaybackController } from "./core";

const captureToggleAction: ControlAction = "playbackCaptureToggle";
const pauseToggleAction: ControlAction = "pauseToggle";

export function createInputPlugin(
  diagnostic: DiagnosticRuntimeOptions | undefined,
  controller: PlaybackController,
): InputPlugin {
  if (diagnostic?.mode === "capture") {
    return {
      actions: [captureToggleAction],
      keyMap: { KeyL: captureToggleAction },
      createKeyHandler: () => createCaptureKeyHandler(controller),
    };
  }

  if (diagnostic?.mode === "playback") {
    return {
      keyMap: { KeyP: pauseToggleAction },
      createKeyHandler: () => createPlaybackKeyHandler(controller),
    };
  }

  return {};
}

function createCaptureKeyHandler(controller: PlaybackController): KeyHandler {
  return {
    handleKeyDown: (action, isRepeat) => {
      if (action !== captureToggleAction) return false;
      if (!isRepeat) controller.handleCaptureToggle();
      return true;
    },
    handleKeyUp: (action) => action === captureToggleAction,
  };
}

function createPlaybackKeyHandler(controller: PlaybackController): KeyHandler {
  return {
    handleKeyDown: (action, isRepeat) => {
      if (!controller.isInputLocked()) return false;
      if (action === pauseToggleAction && !isRepeat) {
        controller.handlePause();
      }
      return true;
    },
    handleKeyUp: () => controller.isInputLocked(),
  };
}
