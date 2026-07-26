import type {
  ExternalHudContext,
  ExternalHudGrid,
  ExternalHudPanelProvider,
} from "@solitude/plugin-api/hud";
import {
  hudPanelCapability,
  isHudPanelProvider,
} from "@solitude/plugin-api/hud";
import {
  keyboardInputCapability,
  type ExternalKeyboardInputProvider,
} from "@solitude/plugin-api/input";
import type {
  ExternalLoopUpdateParams,
  ExternalLoopUpdateResult,
} from "@solitude/plugin-api/loop";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type {
  ExternalControlledBody,
  ExternalWorld,
} from "@solitude/plugin-api/world";
import { describe, expect, it } from "vitest";
import { createPlugin } from "../../pause/index";

const body: ExternalControlledBody = {
  angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
  frame: {
    forward: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  },
  id: "ship:test",
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
};
const world: ExternalWorld = {
  collisionSpheres: [],
  controllableBodies: [body],
  entityStates: [body],
  gravityMasses: [],
};

describe("pause plugin", () => {
  it("publishes localized input, loop, and HUD behavior", () => {
    const plugin = createPlugin({ locale: "fr" });
    const input = getKeyboardInput(plugin);
    const hud = getHudPanel(plugin);

    expect(plugin.id).toBe("pause");
    expect(input.actions).toEqual(["pauseToggle"]);
    expect(input.keyMap).toEqual({ KeyP: "pauseToggle" });

    expect(updateLoop(plugin, false)).toBeNull();
    expect(updateLoop(plugin, false)).toBeNull();

    const pausedA = updateLoop(plugin, true);
    const pausedB = updateLoop(plugin, true);
    expect(pausedB).toBe(pausedA);
    expect(pausedA?.framePolicy).toEqual({
      advancePresentation: true,
      advanceScene: false,
      advanceSim: false,
    });
    expect(writeHud(hud)).toEqual(["PAUSE"]);

    expect(updateLoop(plugin, false)).toBe(pausedA);
    expect(updateLoop(plugin, true)).toBe(pausedA);
    expect(updateLoop(plugin, false)).toBeNull();
    expect(writeHud(hud)).toEqual([]);

    const fixedTickPlugin = createPlugin({ locale: "en" });
    expect(updateLoop(fixedTickPlugin, true, 20)).toBeNull();
    expect(writeHud(getHudPanel(fixedTickPlugin))).toEqual(["PAUSED"]);
  });
});

function getKeyboardInput(
  plugin: ExternalPlugin,
): ExternalKeyboardInputProvider {
  const value = plugin.capabilities?.find(
    ({ id }) => id === keyboardInputCapability,
  )?.value;
  if (typeof value !== "object" || value === null) {
    throw new Error("Expected a keyboard input provider");
  }
  return value as ExternalKeyboardInputProvider;
}

function getHudPanel(plugin: ExternalPlugin): ExternalHudPanelProvider {
  const value = plugin.capabilities?.find(
    ({ id }) => id === hudPanelCapability,
  )?.value;
  if (!isHudPanelProvider(value)) {
    throw new Error("Expected a HUD panel provider");
  }
  return value;
}

function updateLoop(
  plugin: ExternalPlugin,
  pauseToggle: boolean,
  tickDtMillis?: number,
): ExternalLoopUpdateResult | null {
  const params: ExternalLoopUpdateParams = {
    controlInput: { pauseToggle },
    dtMillis: 16,
    focusEntity: () => undefined,
    mainFocus: { controlledBody: body, entityId: body.id },
    nowMs: 16,
    simTimeMillis: 16,
    state: {
      framePolicy: {
        advancePresentation: true,
        advanceScene: true,
        advanceSim: true,
        tickDtMillis,
      },
    },
    world,
  };
  return plugin.hooks?.loop?.updateLoopState?.(params) ?? null;
}

function writeHud(provider: ExternalHudPanelProvider): string[] {
  const texts: string[] = [];
  const grid: ExternalHudGrid = {
    addLine: (_column, _key, text) => texts.push(text),
    appendLine: (_column, _key, text) => texts.push(text),
  };
  const context: ExternalHudContext = {
    capabilityRegistry: { getAll: () => [] },
    controlInput: {},
    mainFocus: { controlledBody: body, entityId: body.id },
    nowMs: 0,
    simTimeMillis: 0,
    world,
  };
  provider.writeHud(grid, context);
  return texts;
}
