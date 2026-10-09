import {
  celestialBodyProviderCapability,
  isCelestialBodyProvider,
} from "@solitude/plugin-api/celestial-bodies";
import {
  controllableEntityProviderCapability,
  type ExternalDirectControllableEntityPlacement,
} from "@solitude/plugin-api/controllable-entities";
import type { ExternalLoopUpdateParams } from "@solitude/plugin-api/loop";
import type {
  ExternalPlugin,
  ExternalPluginContext,
} from "@solitude/plugin-api/module";
import type { ExternalSpacecraftPropulsionCommandParams } from "@solitude/plugin-api/spacecraft";
import { getSpacecraftPropulsionResolvers } from "@solitude/plugin-api/spacecraft";
import {
  isStandaloneSession,
  standaloneGenerationOption,
  standaloneModeOption,
  standaloneSessionCapability,
} from "@solitude/plugin-api/standalone-session";
import type {
  ExternalEntityConfig,
  ExternalWorldModelRegistry,
} from "@solitude/plugin-api/world-model";
import { describe, expect, it, vi } from "vitest";
import { createPlugin as createAdventure } from "../adventure";
import { createPlugin as createFinal } from "../adventure/final";
import { adventureEntityId } from "../adventure/scenario";
import { createPlugin as createSwitch } from "../operator-switch";
import { createPlugin as createPause } from "../pause";
import { createPlugin as createPlayback } from "../playback";
import { createPlugin as createShips } from "../ships";
import { createPlugin as createTimeScale } from "../time-scale";

function assemble(mode: "my-first-orbit" | "free-flight") {
  const options = {
    locale: "en",
    orbitalSpeedMultiplier: mode === "my-first-orbit" ? "1" : "20",
    [standaloneModeOption]: mode,
    [standaloneGenerationOption]: "7",
  };
  const earth = {
    id: "planet:earth",
    mass: 5.972802939487484e24,
    physicalRadius: 6_371_000,
    position: { x: 150_000_000_000, y: 20_000, z: 30_000 },
    velocity: { x: 30_000, y: 500, z: 200 },
  };
  const content: ExternalPlugin = {
    id: "testContent",
    capabilities: [
      {
        id: celestialBodyProviderCapability,
        value: {
          getCelestialBody: (id: string) => (id === earth.id ? earth : null),
        },
      },
      {
        id: controllableEntityProviderCapability,
        value: {
          id: "polyFighter",
          mass: 1.5168515625e17,
          createEntity: ({
            id,
            placement,
          }: {
            id: string;
            placement: ExternalDirectControllableEntityPlacement;
          }): ExternalEntityConfig => ({
            id,
            components: {
              controllable: { enabled: true },
              state: { kind: "direct", ...placement },
            },
          }),
        },
      },
    ],
  };
  const plugins = [
    content,
    { id: "testWorld" },
    createShips(options),
    createAdventure(options),
    createFinal(options),
  ];
  const capabilityRegistry = {
    getAll: (id: string) =>
      plugins
        .flatMap((plugin) => plugin.capabilities ?? [])
        .filter((provider) => provider.id === id)
        .map((provider) => provider.value),
  };
  const entities: ExternalEntityConfig[] = [];
  let focus = "";
  const registry: ExternalWorldModelRegistry = {
    addEntities: (added) => entities.push(...added),
    setMainFocusEntityId: (id) => {
      focus = id;
    },
  };
  for (const plugin of plugins)
    plugin.hooks?.worldModel?.contributeWorldModel(registry, {
      capabilityRegistry,
    });
  return {
    options,
    plugins,
    capabilityRegistry,
    entities,
    get focus() {
      return focus;
    },
  };
}

describe("standalone adventure assembly", () => {
  it("creates only the calibrated craft, facing Earth-relative prograde, with no sandbox craft", () => {
    const s = assemble("my-first-orbit");
    const craft = s.entities.filter((entity) => entity.components.controllable);
    expect(craft.map((entity) => entity.id)).toEqual([adventureEntityId]);
    expect(s.focus).toBe(adventureEntityId);
    const earth = s.capabilityRegistry
      .getAll(celestialBodyProviderCapability)
      .filter(isCelestialBodyProvider)[0]
      .getCelestialBody("planet:earth")!;
    const state = craft[0].components.state!;
    if (state.kind !== "direct")
      throw new Error("Expected direct scenario state");
    const radius = state.position.x - earth.position.x;
    const speed = state.velocity.y - earth.velocity.y;
    expect(radius - earth.physicalRadius).toBeCloseTo(400_000, 5);
    const mu = 6.6743e-11 * earth.mass;
    const a = 1 / (2 / radius - (speed * speed) / mu);
    expect(2 * a - radius - earth.physicalRadius).toBeCloseTo(-50_000, 4);
    expect(speed).toBeCloseTo(7539.984, 2);
    expect(state.frame?.forward).toEqual({ x: 0, y: 1, z: 0 });
    expect(state.angularVelocity).toEqual({ pitch: 0, roll: 0, yaw: 0 });
    const second = assemble("my-first-orbit");
    expect(
      second.entities.find((entity) => entity.id === adventureEntityId)
        ?.components.state,
    ).not.toBe(state);
  });
  it("retains sandbox ships exclusively in free flight and leaves its tuning intact", () => {
    const s = assemble("free-flight");
    expect(
      s.entities
        .filter((entity) => entity.components.controllable)
        .map((entity) => entity.id),
    ).toEqual(["ship:blue", "ship:red"]);
    expect(s.options.orbitalSpeedMultiplier).toBe("20");
    expect(s.plugins[4].hooks).toBeUndefined();
  });
  it("disables conflicting standalone behavior before diagnostic parsing or side effects", () => {
    const options = assemble("my-first-orbit").options;
    const incompatible = {
      ...options,
      diagnostic: "invalid",
      timeScale: "garbage",
    };
    const snapshots = new Proxy(
      {},
      {
        get: () => {
          throw new Error("Diagnostic service used");
        },
      },
    );
    for (const plugin of [
      createPause(incompatible),
      createTimeScale(incompatible),
      createSwitch(incompatible),
      createPlayback(incompatible, { snapshots } as ExternalPluginContext),
    ]) {
      expect(plugin.hooks).toBeUndefined();
      expect(plugin.capabilities).toBeUndefined();
    }
  });
  it("blocks briefing ticks and direct requests, then enforces 1x manual propulsion and suspends gaps", () => {
    vi.stubGlobal("document", {
      visibilityState: "visible",
      hasFocus: () => true,
    });
    try {
      const s = assemble("my-first-orbit");
      const session = s.capabilityRegistry
        .getAll(standaloneSessionCapability)
        .find(isStandaloneSession)!;
      const early = s.plugins[3].hooks!.loop!;
      const final = s.plugins[4].hooks!.loop!;
      const params = {
        nowMs: 100,
        dtMillis: 16,
        controlInput: {
          circleNow: true,
          thrust9: true,
          playbackCaptureToggle: true,
          timeScaleUp: true,
          operatorSwapFocus: true,
          burnForward: true,
        },
        state: {
          framePolicy: {
            advanceSim: true,
            advanceScene: true,
            advancePresentation: true,
            tickDtMillis: 1000,
            simDtMillis: 1000,
          },
        },
      } as unknown as ExternalLoopUpdateParams;
      early.updateLoopState!(params);
      expect(final.updateLoopState!(params)?.framePolicy?.advanceSim).toBe(
        false,
      );
      expect(Object.values(params.controlInput).some(Boolean)).toBe(false);
      session.command("begin");
      early.updateLoopState!(params);
      expect(final.updateLoopState!(params)?.framePolicy?.advanceSim).toBe(
        false,
      );
      params.nowMs = 116;
      params.controlInput.burnForward = true;
      params.controlInput.circleNow = true;
      early.updateLoopState!(params);
      expect(final.updateLoopState!(params)?.framePolicy).toMatchObject({
        advanceSim: true,
        simDtMillis: 16,
      });
      expect(params.state.framePolicy.tickDtMillis).toBeUndefined();
      const resolver = getSpacecraftPropulsionResolvers(
        s.capabilityRegistry,
      )[0];
      const propulsionParams = {
        controlledBody: { id: adventureEntityId },
        controlInput: params.controlInput,
        maxThrustAcceleration: 2000,
      } as ExternalSpacecraftPropulsionCommandParams;
      expect(resolver.resolvePropulsionCommand(propulsionParams)).toEqual({
        main: { forward: 0.005 },
        rcs: { right: 0 },
      });
      params.controlInput.burnBackwards = true;
      expect(
        resolver.resolvePropulsionCommand(propulsionParams).main.forward,
      ).toBe(0);
      params.nowMs = 500;
      early.updateLoopState!(params);
      expect(session.phase).toBe("suspended");
      expect(final.updateLoopState!(params)?.framePolicy?.advanceSim).toBe(
        false,
      );
      session.command("retry");
      expect(session.lifecycleRequest).toBe("retry");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
