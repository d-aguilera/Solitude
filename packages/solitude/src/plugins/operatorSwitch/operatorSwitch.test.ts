import type { FocusContext } from "@solitude/engine/app/runtimePorts";
import type {
  ControlledBody,
  World,
} from "@solitude/engine/domain/domainPorts";
import { localFrame } from "@solitude/engine/domain/localFrame";
import { mat3 } from "@solitude/engine/domain/mat3";
import { vec3 } from "@solitude/engine/domain/vec3";
import type { LoopPlugin } from "@solitude/engine/plugin";
import { createControlInput } from "@solitude/engine/plugin";
import { describe, expect, it } from "vitest";
import { defaultPluginIds } from "../index";
import { __operatorSwitchTest, createOperatorSwitchPlugin } from "./index";

function createBody(id: string): ControlledBody {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id,
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
}

function createWorld(): {
  red: ControlledBody;
  blue: ControlledBody;
  mainFocus: FocusContext;
  world: World;
} {
  const blue = createBody("ship:blue");
  const red = createBody("ship:red");
  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [blue, red],
    entities: [{ id: blue.id }, { id: red.id }],
    entityIndex: new Map([
      [blue.id, { id: blue.id }],
      [red.id, { id: red.id }],
    ]),
    entityStates: [blue, red],
    gravityMasses: [],
    lightEmitters: [],
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

function applyLoop(plugin: LoopPlugin, world: World, mainFocus: FocusContext) {
  return plugin.updateLoopState?.({
    controlInput: createControlInput(),
    dtMillis: 16,
    mainFocus,
    nowMs: 16,
    simTimeMillis: 0,
    state: {
      framePolicy: {
        advanceOverlay: true,
        advanceScene: true,
        advanceSim: true,
      },
    },
    world,
  });
}

describe("operator switch plugin", () => {
  it("runs after playback in the default loop order so paused focus swaps refresh the scene", () => {
    expect(defaultPluginIds.indexOf("operatorSwitch")).toBeGreaterThan(
      defaultPluginIds.indexOf("playback"),
    );
  });

  it("maps Tab to focus swapping and consumes repeat-safe key events", () => {
    const { red, mainFocus, world } = createWorld();
    const controlInput = createControlInput([
      "alignToVelocity",
      "alignToBody",
      "circleNow",
    ]);
    controlInput.circleNow = true;
    const plugin = createOperatorSwitchPlugin();
    const handler = plugin.input!.createKeyHandler!(controlInput);

    expect(plugin.input!.keyMap!.Tab).toBe(
      __operatorSwitchTest.swapFocusAction,
    );
    expect(
      handler.handleKeyDown(__operatorSwitchTest.swapFocusAction, true),
    ).toBe(true);
    const repeatResult = applyLoop(plugin.loop!, world, mainFocus);
    expect(mainFocus.entityId).toBe("ship:blue");
    expect(repeatResult).toBeNull();

    expect(
      handler.handleKeyDown(__operatorSwitchTest.swapFocusAction, false),
    ).toBe(true);
    expect(controlInput.circleNow).toBe(false);
    expect(handler.handleKeyUp(__operatorSwitchTest.swapFocusAction)).toBe(
      true,
    );

    const swapResult = applyLoop(plugin.loop!, world, mainFocus);

    expect(mainFocus.entityId).toBe("ship:red");
    expect(mainFocus.controlledBody).toBe(red);
    expect(swapResult?.framePolicy).toEqual({
      advanceOverlay: true,
      advanceScene: true,
    });
  });

  it("toggles from red back to blue on the next request", () => {
    const { blue, mainFocus, world } = createWorld();
    const controller = __operatorSwitchTest.createOperatorSwitchController([
      "ship:blue",
      "ship:red",
    ]);

    controller.requestSwap();
    controller.applyPendingSwap(world, mainFocus);
    controller.requestSwap();
    controller.applyPendingSwap(world, mainFocus);

    expect(mainFocus.entityId).toBe("ship:blue");
    expect(mainFocus.controlledBody).toBe(blue);
  });

  it("fails clearly when a switch target is not controllable", () => {
    const { mainFocus, world } = createWorld();
    const controller = __operatorSwitchTest.createOperatorSwitchController([
      "ship:blue",
      "ship:missing",
    ]);

    controller.requestSwap();

    expect(() => controller.applyPendingSwap(world, mainFocus)).toThrow(
      "Operator switch focus target is not controllable: ship:missing",
    );
  });
});
