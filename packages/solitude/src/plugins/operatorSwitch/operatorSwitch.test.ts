import { createControlInput } from "@solitude/engine/app/controlPorts";
import type { LoopPlugin } from "@solitude/engine/app/pluginPorts";
import type { FocusContext } from "@solitude/engine/app/runtimePorts";
import type {
  ControlledBody,
  World,
} from "@solitude/engine/domain/domainPorts";
import { localFrame } from "@solitude/engine/domain/localFrame";
import { mat3 } from "@solitude/engine/domain/mat3";
import { vec3 } from "@solitude/engine/domain/vec3";
import { describe, expect, it } from "vitest";
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
  enemy: ControlledBody;
  main: ControlledBody;
  mainFocus: FocusContext;
  world: World;
} {
  const main = createBody("ship:main");
  const enemy = createBody("ship:enemy");
  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [main, enemy],
    entities: [{ id: main.id }, { id: enemy.id }],
    entityIndex: new Map([
      [main.id, { id: main.id }],
      [enemy.id, { id: enemy.id }],
    ]),
    entityStates: [main, enemy],
    gravityMasses: [],
    lightEmitters: [],
  };
  return {
    enemy,
    main,
    mainFocus: {
      controlledBody: main,
      entityId: main.id,
    },
    world,
  };
}

function applyLoop(plugin: LoopPlugin, world: World, mainFocus: FocusContext) {
  plugin.updateLoopState?.({
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
  it("maps Tab to focus swapping and consumes repeat-safe key events", () => {
    const { enemy, mainFocus, world } = createWorld();
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
    applyLoop(plugin.loop!, world, mainFocus);
    expect(mainFocus.entityId).toBe("ship:main");

    expect(
      handler.handleKeyDown(__operatorSwitchTest.swapFocusAction, false),
    ).toBe(true);
    expect(controlInput.circleNow).toBe(false);
    expect(handler.handleKeyUp(__operatorSwitchTest.swapFocusAction)).toBe(
      true,
    );

    applyLoop(plugin.loop!, world, mainFocus);

    expect(mainFocus.entityId).toBe("ship:enemy");
    expect(mainFocus.controlledBody).toBe(enemy);
  });

  it("toggles from enemy back to main on the next request", () => {
    const { main, mainFocus, world } = createWorld();
    const controller = __operatorSwitchTest.createOperatorSwitchController([
      "ship:main",
      "ship:enemy",
    ]);

    controller.requestSwap();
    controller.applyPendingSwap(world, mainFocus);
    controller.requestSwap();
    controller.applyPendingSwap(world, mainFocus);

    expect(mainFocus.entityId).toBe("ship:main");
    expect(mainFocus.controlledBody).toBe(main);
  });

  it("fails clearly when a switch target is not controllable", () => {
    const { mainFocus, world } = createWorld();
    const controller = __operatorSwitchTest.createOperatorSwitchController([
      "ship:main",
      "ship:missing",
    ]);

    controller.requestSwap();

    expect(() => controller.applyPendingSwap(world, mainFocus)).toThrow(
      "Operator switch focus target is not controllable: ship:missing",
    );
  });
});
