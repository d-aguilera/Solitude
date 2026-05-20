import { updateFocusContext } from "@solitude/engine/app/focus";
import type { FocusContext } from "@solitude/engine/app/runtimePorts";
import type { World } from "@solitude/engine/domain/domainPorts";
import type {
  GamePlugin,
  LoopPlugin,
  LoopUpdateResult,
  RuntimeOptions,
} from "@solitude/engine/plugin";

const swapFocusAction = "operatorSwapFocus";
const defaultFocusTargets = ["ship:blue", "ship:red"] as const;
const autopilotActions = ["alignToVelocity", "alignToBody", "circleNow"];
const FOCUS_SWAP_LOOP_UPDATE: LoopUpdateResult = {
  framePolicy: {
    advanceScene: true,
    advanceOverlay: true,
  },
};

export function createOperatorSwitchPlugin(
  _runtimeOptions: RuntimeOptions = {},
): GamePlugin {
  const controller = createOperatorSwitchController(defaultFocusTargets);
  return {
    id: "operatorSwitch",
    input: {
      actions: [swapFocusAction],
      keyMap: { Tab: swapFocusAction },
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
    },
    loop: createOperatorSwitchLoop(controller),
  };
}

export function createOperatorSwitchController(
  targetEntityIds: readonly string[],
): {
  applyPendingSwap: (world: World, mainFocus: FocusContext) => boolean;
  requestSwap: () => void;
  validateTargets: (world: World) => void;
} {
  let swapRequested = false;
  let targetsValidated = false;

  return {
    applyPendingSwap: (world, mainFocus) => {
      if (!targetsValidated) {
        validateFocusTargets(world, targetEntityIds);
        targetsValidated = true;
      }
      if (!swapRequested) return false;
      swapRequested = false;
      const nextEntityId = getNextFocusTarget(
        targetEntityIds,
        mainFocus.entityId,
      );
      updateFocusContext(world, mainFocus, nextEntityId);
      return true;
    },
    requestSwap: () => {
      swapRequested = true;
    },
    validateTargets: (world) => validateFocusTargets(world, targetEntityIds),
  };
}

function createOperatorSwitchLoop(
  controller: ReturnType<typeof createOperatorSwitchController>,
): LoopPlugin {
  return {
    updateLoopState: ({ mainFocus, world }) => {
      if (!world) return null;
      return controller.applyPendingSwap(world, mainFocus)
        ? FOCUS_SWAP_LOOP_UPDATE
        : null;
    },
  };
}

function clearAutopilotActions(controlInput: Record<string, boolean>): void {
  for (const action of autopilotActions) {
    controlInput[action] = false;
  }
}

function getNextFocusTarget(
  targetEntityIds: readonly string[],
  currentEntityId: string,
): string {
  if (targetEntityIds.length === 0) {
    throw new Error(
      "Operator switch plugin requires at least one focus target",
    );
  }
  const currentIndex = targetEntityIds.indexOf(currentEntityId);
  if (currentIndex < 0) return targetEntityIds[0];
  return targetEntityIds[(currentIndex + 1) % targetEntityIds.length];
}

function validateFocusTargets(
  world: World,
  targetEntityIds: readonly string[],
): void {
  if (targetEntityIds.length === 0) {
    throw new Error(
      "Operator switch plugin requires at least one focus target",
    );
  }
  for (const targetEntityId of targetEntityIds) {
    const found = world.controllableBodies.some(
      (body) => body.id === targetEntityId,
    );
    if (!found) {
      throw new Error(
        `Operator switch focus target is not controllable: ${targetEntityId}`,
      );
    }
  }
}

export const __operatorSwitchTest = {
  autopilotActions,
  createOperatorSwitchController,
  swapFocusAction,
};
