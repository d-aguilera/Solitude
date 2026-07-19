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
import type { ExternalLoopUpdateParams } from "@solitude/plugin-api/loop";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type {
  ExternalControlledBody,
  ExternalWorld,
} from "@solitude/plugin-api/world";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlugin } from "../../memory/index";

const MB = 1024 * 1024;
const body: ExternalControlledBody = {
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("memory plugin", () => {
  it("publishes its existing keyboard, loop, and HUD behavior", () => {
    const memory = {
      jsHeapSizeLimit: 100 * MB,
      totalJSHeapSize: 20 * MB,
      usedJSHeapSize: 10 * MB,
    };
    vi.stubGlobal("performance", { memory });
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const plugin = createPlugin({});
    const input = getKeyboardInput(plugin);
    const hud = getHudPanel(plugin);

    expect(plugin.id).toBe("memory");
    expect(input.actions).toEqual(["profilingToggle"]);
    expect(input.keyMap).toEqual({ KeyO: "profilingToggle" });

    updateLoop(plugin, true, 0);
    expect(writeHud(hud)).toEqual(["Heap 10.0MB r0.0 d+0.0/s"]);

    memory.usedJSHeapSize = 12 * MB;
    updateLoop(plugin, false, 500);
    expect(writeHud(hud)).toEqual(["Heap 12.0MB r2.0 d+4.0/s"]);

    updateLoop(plugin, true, 1000);
    expect(writeHud(hud)).toEqual([]);
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
  profilingToggle: boolean,
  nowMs: number,
): void {
  const params: ExternalLoopUpdateParams = {
    controlInput: { profilingToggle },
    dtMillis: 16,
    focusEntity: () => undefined,
    mainFocus: { controlledBody: body, entityId: body.id },
    nowMs,
    simTimeMillis: nowMs,
    state: {
      framePolicy: {
        advancePresentation: true,
        advanceScene: true,
        advanceSim: true,
      },
    },
    world,
  };
  plugin.hooks?.loop?.updateLoopState?.(params);
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
