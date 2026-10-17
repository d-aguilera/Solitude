import {
  celestialBodyProviderCapability,
  isCelestialBodyProvider,
} from "@solitude/plugin-api/celestial-bodies";
import {
  controllableEntityProviderCapability,
  type ExternalDirectControllableEntityPlacement,
} from "@solitude/plugin-api/controllable-entities";
import {
  keyboardInputCapability,
  type ExternalKeyboardInputProvider,
} from "@solitude/plugin-api/input";
import type { ExternalLoopUpdateParams } from "@solitude/plugin-api/loop";
import { mat3, vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalPlugin,
  ExternalPluginContext,
} from "@solitude/plugin-api/module";
import {
  adventureGuidanceCapability,
  adventureObjectiveCapability,
  isAdventureGuidanceProvider,
  isAdventureObjective,
} from "@solitude/plugin-api/my-first-orbit";
import {
  orbitSegmentsStateCapability,
  type ExternalOrbitSegmentsState,
} from "@solitude/plugin-api/render";
import type { ExternalScenePlugin } from "@solitude/plugin-api/scene";
import type { ExternalSimulationPlugin } from "@solitude/plugin-api/simulation";
import type { ExternalSpacecraftPropulsionCommandParams } from "@solitude/plugin-api/spacecraft";
import { getSpacecraftPropulsionResolvers } from "@solitude/plugin-api/spacecraft";
import {
  isStandaloneEntrySession,
  standaloneModeOption,
} from "@solitude/plugin-api/standalone-entry";
import {
  standaloneGenerationOption,
  standaloneSessionCapability,
} from "@solitude/plugin-api/standalone-session";
import {
  createOrbitObservation,
  orbitObservationCapability,
  type ExternalOrbitObservation,
} from "@solitude/plugin-api/telemetry";
import type { ExternalWorld } from "@solitude/plugin-api/world";
import type {
  ExternalEntityConfig,
  ExternalWorldModelRegistry,
} from "@solitude/plugin-api/world-model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlugin as createSwitch } from "../composition/operator-switch";
import { createPlugin as createPause } from "../composition/pause";
import { createPlugin as createPlayback } from "../composition/playback";
import { createPlugin as createShips } from "../composition/ships";
import { createPlugin as createTimeScale } from "../composition/time-scale";
import { createPlugin as createAdventure } from "../my-first-orbit";
import { adventureEntityId } from "../my-first-orbit/definition";
import { createPlugin as createFinal } from "../my-first-orbit/final";

afterEach(() => vi.unstubAllGlobals());

function assemble(
  mode: "my-first-orbit" | "free-flight",
  orbitLine: ExternalOrbitSegmentsState | null = null,
) {
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
      ...(orbitLine
        ? [{ id: orbitSegmentsStateCapability, value: orbitLine }]
        : []),
      {
        id: orbitObservationCapability,
        value: {
          sampleInto: (
            out: ExternalOrbitObservation,
            _world: ExternalWorld,
            entityId: string,
          ) => {
            Object.assign(out, {
              entityId,
              primaryId: "planet:earth",
              orbitValid: true,
              isBound: true,
              altitudeMeters: 400000,
              periapsisAltitudeMeters: 400000,
              apoapsisAltitudeMeters: 400000,
              radialSpeedMetersPerSecond: 0,
              progradeAlignmentCosine: 1,
            });
          },
        },
      },
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
  it("lets Z reach the orbit autopilot only during flight and keeps circularization blocked", () => {
    vi.stubGlobal("document", {
      visibilityState: "visible",
      hasFocus: () => true,
    });
    const s = assemble("my-first-orbit");
    const session = s.capabilityRegistry
      .getAll(standaloneSessionCapability)
      .find(isStandaloneEntrySession)!;
    const input = s.plugins[4].capabilities!.find(
      ({ id }) => id === keyboardInputCapability,
    )!.value as ExternalKeyboardInputProvider;
    const guard = input.createKeyHandler!({}, { unlockedActions: new Set() });
    expect(guard.handleKeyDown("orbit", false)).toBe(true);
    for (let i = 0; i <= 30; i++)
      s.plugins[3].hooks!.loop!.afterFrame!({
        nowMs: (i * 1000) / 60,
        dtMillis: 1000 / 60,
      } as ExternalLoopUpdateParams);
    session.command("begin");
    expect(guard.handleKeyDown("orbit", false)).toBe(false);
    expect(guard.handleKeyDown("circleNow", false)).toBe(true);
    expect(guard.handleKeyDown("alignToBody", false)).toBe(true);
    session.command("pause");
    expect(guard.handleKeyDown("orbit", false)).toBe(true);
  });
  it("binds orbit-line guidance to the discovered provider state", () => {
    vi.stubGlobal("document", {
      visibilityState: "visible",
      hasFocus: () => true,
    });
    let enabled = false;
    const s = assemble("my-first-orbit", {
      get enabled() {
        return enabled;
      },
    });
    const session = s.capabilityRegistry
      .getAll(standaloneSessionCapability)
      .find(isStandaloneEntrySession)!;
    const guidance = s.capabilityRegistry
      .getAll(adventureGuidanceCapability)
      .find(isAdventureGuidanceProvider)!;
    const objective = s.capabilityRegistry
      .getAll(adventureObjectiveCapability)
      .find(isAdventureObjective)!;
    const early = s.plugins[3].hooks!.loop!;
    for (let i = 0; i <= 30; i++)
      early.afterFrame!({
        nowMs: (i * 1000) / 60,
        dtMillis: 1000 / 60,
      } as ExternalLoopUpdateParams);
    session.command("begin");
    early.updateLoopState!({
      nowMs: 100,
      dtMillis: 16,
      controlInput: {},
    } as ExternalLoopUpdateParams);
    const sample = {
      ...createOrbitObservation(),
      generation: 7,
      sequence: 0,
      nowMs: 0,
      simTimeMillis: 0,
      entityId: adventureEntityId,
      primaryId: "planet:earth",
      orbitValid: true,
      isBound: true,
      periapsisAltitudeMeters: -50000,
      apoapsisAltitudeMeters: 400000,
      earthAltitudeMeters: 400000,
      earthUpAlignmentCosine: 1,
      propulsionActive: false,
      progradeAlignmentCosine: 1,
    };
    for (let i = 1; i <= 2; i++) {
      early.updateLoopState!({
        nowMs: 100 + i * 16,
        dtMillis: 16,
        controlInput: {},
      } as ExternalLoopUpdateParams);
      sample.sequence = i;
      sample.nowMs = 100 + i * 16;
      sample.simTimeMillis = i * 16;
      objective.sample(sample);
      guidance.sample(sample, "Earth");
      expect(guidance.guidance.cue).toBe(i === 1 ? "showOrbit" : "recover");
      enabled = true;
    }
  });
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
    const toEarth = vec3.subInto(vec3.zero(), earth.position, state.position);
    expect(vec3.dot(toEarth, state.frame!.right)).toBeCloseTo(-radius, 5);
    expect(vec3.dot(toEarth, state.frame!.forward)).toBeCloseTo(0, 5);
    expect(vec3.dot(toEarth, state.frame!.up)).toBeCloseTo(0, 5);
    const renderedUp = vec3.zero();
    mat3.mulVec3Into(renderedUp, state.orientation!, vec3.create(0, 0, 1));
    expect(renderedUp).toEqual(state.frame!.up);
    expect(state.angularVelocity).toEqual({ pitch: 0, roll: 0, yaw: 0 });
    const second = assemble("my-first-orbit");
    const retryState = second.entities.find(
      (entity) => entity.id === adventureEntityId,
    )!.components.state!;
    if (retryState.kind !== "direct")
      throw new Error("Expected direct retry state");
    expect(retryState.frame).toEqual(state.frame);
    expect(retryState.orientation).toEqual(state.orientation);
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
    expect(s.capabilityRegistry.getAll(adventureGuidanceCapability)).toEqual(
      [],
    );
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
        .find(isStandaloneEntrySession)!;
      const early = s.plugins[3].hooks!.loop!;
      const final = s.plugins[4].hooks!.loop!;
      const params = {
        nowMs: 100,
        dtMillis: 16,
        controlInput: {
          circleNow: true,
          orbit: true,
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
      for (let i = 0; i <= 30; i++)
        early.afterFrame!({
          nowMs: (i * 1000) / 60,
          dtMillis: 1000 / 60,
        } as ExternalLoopUpdateParams);
      session.command("begin");
      early.updateLoopState!(params);
      expect(final.updateLoopState!(params)?.framePolicy?.advanceSim).toBe(
        false,
      );
      params.nowMs = 116;
      params.controlInput.burnForward = true;
      params.controlInput.circleNow = true;
      params.controlInput.orbit = true;
      early.updateLoopState!(params);
      expect(params.controlInput.orbit).toBe(true);
      expect(params.controlInput.circleNow).toBe(false);
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
  it("samples completed advancing frames once, observes final propulsion, and freezes success before the next tick", () => {
    vi.stubGlobal("document", {
      visibilityState: "visible",
      hasFocus: () => true,
    });
    try {
      const s = assemble("my-first-orbit");
      const session = s.capabilityRegistry
        .getAll(standaloneSessionCapability)
        .find(isStandaloneEntrySession)!;
      const objective = s.capabilityRegistry
        .getAll(adventureObjectiveCapability)
        .find(isAdventureObjective)!;
      const guidance = s.capabilityRegistry
        .getAll(adventureGuidanceCapability)
        .find(isAdventureGuidanceProvider)!.guidance;
      const earth = {
        id: "planet:earth",
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 30000, y: 0, z: 0 },
      };
      const radius = 6371000;
      const craft = {
        id: adventureEntityId,
        position: { x: radius + 400000, y: 0, z: 0 },
        velocity: {
          x: 30000,
          y: Math.sqrt((6.6743e-11 * 5.972802939487484e24) / (radius + 400000)),
          z: 0,
        },
        angularVelocity: { pitch: 0, yaw: 0, roll: 0 },
        frame: {
          forward: { x: 0, y: 1, z: 0 },
          right: { x: 1, y: 0, z: 0 },
          up: { x: 0, y: 0, z: 1 },
        },
      };
      const world: ExternalWorld = {
        controllableBodies: [craft],
        entityStates: [craft, earth],
        collisionSpheres: [{ id: earth.id, radius, state: earth }],
        gravityMasses: [
          { id: earth.id, mass: 5.972802939487484e24, state: earth },
        ],
      };
      const early = s.plugins[3].hooks!.loop!;
      const final = s.plugins[4].hooks!.loop!;
      const sim = s.plugins[4].hooks!.simulation as ExternalSimulationPlugin;
      const scene = s.plugins[4].hooks!.scene!;
      scene.initScene!({ world } as Parameters<
        NonNullable<ExternalScenePlugin["initScene"]>
      >[0]);
      const params = {
        nowMs: 0,
        dtMillis: 250,
        simTimeMillis: 0,
        world,
        mainFocus: { entityId: craft.id, controlledBody: craft },
        controlInput: {},
        state: {
          framePolicy: {
            advanceSim: true,
            advanceScene: true,
            advancePresentation: true,
          },
        },
      } as ExternalLoopUpdateParams;
      const resolver = getSpacecraftPropulsionResolvers(
        s.capabilityRegistry,
      )[0];
      const frame = (now: number, burn: boolean, observe = true) => {
        params.nowMs = now;
        params.controlInput.burnForward = burn;
        early.updateLoopState!(params);
        Object.assign(
          params.state.framePolicy,
          final.updateLoopState!(params)?.framePolicy,
        );
        if (params.state.framePolicy.advanceSim) {
          sim.beforeVehicleDynamics!({
            controlInput: params.controlInput,
            controlInputsByEntityId: new Map(),
            dtMillis: 250,
            dtMillisSim: 250,
            focusEntity: () => {
              throw new Error("Unexpected focus switch");
            },
            mainFocus: params.mainFocus,
            world,
          });
          if (observe)
            resolver.resolvePropulsionCommand({
              controlInput: params.controlInput,
              controlledBody: craft,
              maxThrustAcceleration: 1000000,
            } as ExternalSpacecraftPropulsionCommandParams);
          params.simTimeMillis! += 250;
        }
        final.afterFrame!(params);
      };
      for (let i = 0; i <= 30; i++)
        early.afterFrame!({
          nowMs: (i * 1000) / 60,
          dtMillis: 1000 / 60,
        } as ExternalLoopUpdateParams);
      session.command("begin");
      frame(0, false);
      expect(objective.latestSequence).toBe(0);
      frame(250, true);
      expect(guidance.cue).toBe("release");
      expect(objective.latestSample?.propulsionActive).toBe(true);
      expect(objective.status).toBe("recovering");
      frame(500, false, false);
      expect(guidance.cue).toBe("unavailable");
      expect(objective.latestSample?.propulsionActive).toBeNull();
      frame(750, false);
      expect(guidance.cue).toBe("coast");
      expect(objective.status).toBe("confirming");
      expect(objective.coastMillis).toBe(0);
      final.afterFrame!(params);
      expect(objective.latestSequence).toBe(3);
      for (let now = 1000; now <= 5750; now += 250) frame(now, false);
      expect(session.phase).toBe("completed");
      expect(guidance.visible).toBe(false);
      expect(session.getPresentation()?.actions.map((a) => a.command)).toEqual([
        "retry",
        "menu",
      ]);
      const completedTime = params.simTimeMillis;
      frame(6000, true);
      expect(params.simTimeMillis).toBe(completedTime);
      expect(objective.safeOrbitConfirmed).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("rejects a later propulsion resolver instead of treating its overwritten command as final", () => {
    const s = assemble("my-first-orbit");
    const registry = {
      getAll: (id: string) =>
        id === "spacecraft.propulsionResolver.v1"
          ? [
              ...s.capabilityRegistry.getAll(id),
              {
                resolvePropulsionCommand: () => ({
                  main: { forward: 1 },
                  rcs: { right: 0 },
                }),
              },
            ]
          : s.capabilityRegistry.getAll(id),
    };
    expect(() =>
      s.plugins[4].hooks!.worldModel!.contributeWorldModel(
        { addEntities: () => {}, setMainFocusEntityId: () => {} },
        { capabilityRegistry: registry },
      ),
    ).toThrow("must be last");
  });
  it.each(["missing", "duplicate", "retired"] as const)(
    "rejects %s guidance providers at assembly",
    (kind) => {
      const s = assemble("my-first-orbit");
      const original = s.capabilityRegistry.getAll(
        adventureGuidanceCapability,
      )[0];
      const registry = {
        getAll: (id: string) => {
          if (id !== adventureGuidanceCapability)
            return s.capabilityRegistry.getAll(id);
          if (kind === "missing") return [];
          if (kind === "duplicate") return [original, original];
          if (!isAdventureGuidanceProvider(original))
            throw new Error("Missing test guidance");
          return [
            { ...original, guidance: { ...original.guidance, generation: 6 } },
          ];
        },
      };
      expect(() =>
        s.plugins[4].hooks!.worldModel!.contributeWorldModel(
          { addEntities: () => {}, setMainFocusEntityId: () => {} },
          { capabilityRegistry: registry },
        ),
      ).toThrow("one current-generation guidance provider");
    },
  );
});
