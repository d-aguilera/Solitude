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
import type { ExternalProfilerControl } from "@solitude/plugin-api/profiling";
import type {
  ExternalControlledBody,
  ExternalWorld,
} from "@solitude/plugin-api/world";
import { describe, expect, it, vi } from "vitest";
import { createPlugin } from "../../profiling/index";

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

describe("profiling plugin", () => {
  it("controls the host profiler and publishes localized input and HUD behavior", () => {
    const profiler: ExternalProfilerControl = {
      check: vi.fn(),
      flush: vi.fn(),
      setEnabled: vi.fn(),
      setPaused: vi.fn(),
    };
    const plugin = createPlugin({ locale: "fr" }, { profiler });
    const input = getKeyboardInput(plugin);
    const hud = getHudPanel(plugin);

    expect(plugin.id).toBe("profiling");
    expect(input.actions).toEqual(["profilingToggle"]);
    expect(input.keyMap).toEqual({ KeyO: "profilingToggle" });
    expect(input.unlockedActions).toEqual(["profilingToggle"]);

    const params = updateLoop(plugin, true, false);

    expect(profiler.setEnabled).toHaveBeenLastCalledWith(true);
    expect(profiler.setPaused).toHaveBeenLastCalledWith(true);
    expect(profiler.check).toHaveBeenCalledOnce();
    expect(writeHud(hud)).toEqual(["PROFILAGE"]);

    plugin.hooks?.loop?.afterFrame?.(params);
    expect(profiler.flush).toHaveBeenCalledOnce();

    updateLoop(plugin, false, true);
    updateLoop(plugin, true, true);
    expect(profiler.setEnabled).toHaveBeenLastCalledWith(false);
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
  advanceSim: boolean,
): ExternalLoopUpdateParams {
  const params: ExternalLoopUpdateParams = {
    controlInput: { profilingToggle },
    dtMillis: 16,
    focusEntity: () => undefined,
    mainFocus: { controlledBody: body, entityId: body.id },
    nowMs: 16,
    simTimeMillis: 16,
    state: {
      framePolicy: {
        advancePresentation: true,
        advanceScene: true,
        advanceSim,
      },
    },
    world,
  };
  plugin.hooks?.loop?.updateLoopState?.(params);
  return params;
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
