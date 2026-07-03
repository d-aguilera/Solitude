import type { ControlAction, GamePlugin } from "@solitude/engine/plugin";
import type { MainViewLookState } from "@solitude/engine/render";
import { createKeyboardInputProvider } from "@solitude/input/keyboard";

const lookSpeed = 0.0015;

const lookaroundActions = [
  "lookLeft",
  "lookRight",
  "lookUp",
  "lookDown",
  "lookReset",
] as const;

type LookaroundAction = (typeof lookaroundActions)[number];

const lookaroundKeys: Readonly<Record<string, LookaroundAction>> = {
  ArrowDown: "lookDown",
  ArrowLeft: "lookLeft",
  ArrowRight: "lookRight",
  ArrowUp: "lookUp",
  KeyR: "lookReset",
};

const lookaroundActionSet = new Set<ControlAction>(lookaroundActions);

export function createRemoteLookaroundPlugin(): GamePlugin {
  return {
    id: "remoteLookaround",
    capabilities: [
      createKeyboardInputProvider({
        actions: lookaroundActions,
        keyMap: lookaroundKeys,
        createKeyHandler: (controlInput) => ({
          handleKeyDown: (action) => {
            if (!lookaroundActionSet.has(action)) return false;
            controlInput[action] = true;
            return true;
          },
          handleKeyUp: (action) => {
            if (!lookaroundActionSet.has(action)) return false;
            controlInput[action] = false;
            return true;
          },
        }),
      }),
    ],
    viewControls: {
      updateViewControls: ({ controlInput, dtMillis, sceneControlState }) => {
        updateLookState(
          dtMillis,
          controlInput,
          sceneControlState.mainViewLookState,
        );
      },
    },
  };
}

function updateLookState(
  dtMillis: number,
  controlInput: Record<string, boolean>,
  lookState: MainViewLookState,
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
