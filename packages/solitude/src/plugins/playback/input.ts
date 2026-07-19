import type { ControlAction } from "@solitude/engine/plugin";
import type {
  KeyboardInputProvider,
  KeyHandler,
} from "@solitude/input/keyboard";
import type { PlaybackController } from "./core";
import type { DiagnosticRuntimeOptions } from "./options";

const captureToggleAction: ControlAction = "playbackCaptureToggle";
const pauseToggleAction: ControlAction = "pauseToggle";

export function createInputPlugin(
  diagnostic: DiagnosticRuntimeOptions | undefined,
  controller: PlaybackController,
): KeyboardInputProvider {
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
      createKeyHandler: (_controlInput, { unlockedActions }) =>
        createPlaybackKeyHandler(controller, unlockedActions),
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

function createPlaybackKeyHandler(
  controller: PlaybackController,
  unlockedActions: ReadonlySet<ControlAction>,
): KeyHandler {
  return {
    handleKeyDown: (action, isRepeat) => {
      if (unlockedActions.has(action)) return false;
      if (!controller.isInputLocked()) return false;
      if (action === pauseToggleAction && !isRepeat) {
        controller.handlePause();
      }
      return true;
    },
    handleKeyUp: (action) => {
      if (unlockedActions.has(action)) return false;
      return controller.isInputLocked();
    },
  };
}
