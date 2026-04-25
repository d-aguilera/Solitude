import type { ControlAction } from "../../app/controlPorts";
import type { InputPlugin, KeyHandler } from "../../app/pluginPorts";
import type { PlaybackController } from "./core";
import type { DiagnosticRuntimeOptions } from "./options";

const captureToggleAction: ControlAction = "playbackCaptureToggle";
const pauseToggleAction: ControlAction = "pauseToggle";
const profilingToggleAction: ControlAction = "profilingToggle";

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
      if (action === profilingToggleAction) return false;
      if (!controller.isInputLocked()) return false;
      if (action === pauseToggleAction && !isRepeat) {
        controller.handlePause();
      }
      return true;
    },
    handleKeyUp: (action) => {
      if (action === profilingToggleAction) return false;
      return controller.isInputLocked();
    },
  };
}
