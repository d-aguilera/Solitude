import {
  createKeyboardInputCapability,
  type ExternalControlInput,
} from "@solitude/plugin-api/input";
import type {
  ExternalLoopPlugin,
  ExternalLoopUpdateResult,
} from "@solitude/plugin-api/loop";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { createOperatorSwitchController } from "./core";

const swapFocusAction = "operatorSwapFocus";
const defaultFocusTargets = ["ship:blue", "ship:red"] as const;
const autopilotActions = ["alignToVelocity", "alignToBody", "circleNow"];
const FOCUS_SWAP_LOOP_UPDATE: ExternalLoopUpdateResult = {
  framePolicy: {
    advanceScene: true,
    advancePresentation: true,
  },
};

export function createPlugin(
  _runtimeOptions: ExternalRuntimeOptions,
): ExternalPlugin {
  const controller = createOperatorSwitchController(defaultFocusTargets);
  return {
    id: "operatorSwitch",
    capabilities: [
      createKeyboardInputCapability({
        actions: [swapFocusAction],
        keyMap: { Tab: swapFocusAction },
        unlockedActions: [swapFocusAction],
        createKeyHandler: (controlInput) => ({
          handleKeyDown: (action, isRepeat) => {
            if (action !== swapFocusAction) return false;
            if (!isRepeat) {
              clearAutopilotActions(controlInput);
              controller.requestSwap();
            }
            return true;
          },
          handleKeyUp: (action) => action === swapFocusAction,
        }),
      }),
    ],
    hooks: { loop: createOperatorSwitchLoop(controller) },
  };
}

function createOperatorSwitchLoop(
  controller: ReturnType<typeof createOperatorSwitchController>,
): ExternalLoopPlugin {
  return {
    updateLoopState: ({ focusEntity, mainFocus, world }) => {
      if (!world) return null;
      return controller.applyPendingSwap(world, mainFocus, focusEntity)
        ? FOCUS_SWAP_LOOP_UPDATE
        : null;
    },
  };
}

function clearAutopilotActions(controlInput: ExternalControlInput): void {
  for (const action of autopilotActions) {
    controlInput[action] = false;
  }
}
