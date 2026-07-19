import {
  keyboardInputCapability,
  type ExternalControlInput,
  type ExternalKeyboardInputProvider,
} from "@solitude/plugin-api/input";
import type { ExternalLoopPlugin } from "@solitude/plugin-api/loop";
import type {
  ExternalControlledBody,
  ExternalFocusContext,
  ExternalWorld,
} from "@solitude/plugin-api/world";
import { describe, expect, it } from "vitest";
import { createOperatorSwitchController } from "../../operator-switch/core";
import { createPlugin } from "../../operator-switch/index";

function createBody(id: string): ExternalControlledBody {
  return {
    frame: {
      forward: { x: 0, y: 1, z: 0 },
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 0, z: 1 },
    },
    id,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
  };
}

function createWorld(): {
  red: ExternalControlledBody;
  blue: ExternalControlledBody;
  mainFocus: ExternalFocusContext;
  world: ExternalWorld;
} {
  const blue = createBody("ship:blue");
  const red = createBody("ship:red");
  const world: ExternalWorld = {
    collisionSpheres: [],
    controllableBodies: [blue, red],
    entityStates: [blue, red],
    gravityMasses: [],
  };
  return {
    red,
    blue,
    mainFocus: {
      controlledBody: blue,
      entityId: blue.id,
    },
    world,
  };
}

function applyLoop(
  plugin: ExternalLoopPlugin,
  world: ExternalWorld,
  mainFocus: ExternalFocusContext,
) {
  return plugin.updateLoopState?.({
    controlInput: {},
    dtMillis: 16,
    focusEntity: (id) => {
      const body = world.controllableBodies.find((item) => item.id === id);
      if (!body) throw new Error(`Controlled entity not found: ${id}`);
      mainFocus.entityId = id;
      mainFocus.controlledBody = body;
    },
    mainFocus,
    nowMs: 16,
    simTimeMillis: 0,
    state: {
      framePolicy: {
        advancePresentation: true,
        advanceScene: true,
        advanceSim: true,
      },
    },
    world,
  });
}

describe("operator switch plugin", () => {
  it("maps Tab to focus swapping and consumes repeat-safe key events", () => {
    const { red, mainFocus, world } = createWorld();
    const controlInput: ExternalControlInput = {
      alignToBody: false,
      alignToVelocity: false,
      circleNow: true,
    };
    const plugin = createPlugin({});
    const input = plugin.capabilities?.find(
      ({ id }) => id === keyboardInputCapability,
    )?.value as ExternalKeyboardInputProvider;
    const handler = input.createKeyHandler?.(controlInput, {
      unlockedActions: new Set(input.unlockedActions),
    });
    const swapFocusAction = input.keyMap?.Tab;
    if (!swapFocusAction) throw new Error("Expected focus swap action");

    expect(swapFocusAction).toBe("operatorSwapFocus");
    expect(input.unlockedActions).toEqual([swapFocusAction]);
    expect(handler?.handleKeyDown(swapFocusAction, true)).toBe(true);
    const repeatResult = applyLoop(plugin.hooks?.loop ?? {}, world, mainFocus);
    expect(mainFocus.entityId).toBe("ship:blue");
    expect(repeatResult).toBeNull();

    expect(handler?.handleKeyDown(swapFocusAction, false)).toBe(true);
    expect(controlInput.circleNow).toBe(false);
    expect(handler?.handleKeyUp(swapFocusAction)).toBe(true);

    const swapResult = applyLoop(plugin.hooks?.loop ?? {}, world, mainFocus);

    expect(mainFocus.entityId).toBe("ship:red");
    expect(mainFocus.controlledBody).toBe(red);
    expect(swapResult?.framePolicy).toEqual({
      advancePresentation: true,
      advanceScene: true,
    });
  });

  it("toggles from red back to blue on the next request", () => {
    const { blue, mainFocus, world } = createWorld();
    const controller = createOperatorSwitchController([
      "ship:blue",
      "ship:red",
    ]);
    const focusEntity = (id: string) => {
      const body = world.controllableBodies.find((item) => item.id === id);
      if (!body) throw new Error(`Controlled entity not found: ${id}`);
      mainFocus.entityId = id;
      mainFocus.controlledBody = body;
    };

    controller.requestSwap();
    controller.applyPendingSwap(world, mainFocus, focusEntity);
    controller.requestSwap();
    controller.applyPendingSwap(world, mainFocus, focusEntity);

    expect(mainFocus.entityId).toBe("ship:blue");
    expect(mainFocus.controlledBody).toBe(blue);
  });

  it("fails clearly when a switch target is not controllable", () => {
    const { mainFocus, world } = createWorld();
    const controller = createOperatorSwitchController([
      "ship:blue",
      "ship:missing",
    ]);

    controller.requestSwap();

    expect(() =>
      controller.applyPendingSwap(world, mainFocus, () => undefined),
    ).toThrow("Operator switch focus target is not controllable: ship:missing");
  });
});
