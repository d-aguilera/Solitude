import type { ExternalPluginCapabilityRegistry } from "@solitude/plugin-api/capabilities";
import { formatEntityName } from "@solitude/plugin-api/entity-names";
import {
  createKeyboardInputCapability,
  type ExternalKeyboardInputProvider,
} from "@solitude/plugin-api/input";
import { vec3 } from "@solitude/plugin-api/math";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import {
  adventureGuidanceCapability,
  adventureObjectiveCapability,
  isAdventureGuidanceProvider,
  isAdventureObjective,
  type AdventureGuidanceProvider,
  type AdventureObjective,
  type AdventureSample,
} from "@solitude/plugin-api/my-first-orbit";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import {
  createSpacecraftPropulsionResolverProvider,
  getSpacecraftPropulsionResolvers,
  spacecraftVelocityReferenceCapability,
  type ExternalSpacecraftPropulsionCommandParams,
} from "@solitude/plugin-api/spacecraft";
import {
  isStandaloneEntrySession,
  type StandaloneEntrySession,
} from "@solitude/plugin-api/standalone-entry";
import { standaloneSessionCapability } from "@solitude/plugin-api/standalone-session";
import {
  createOrbitObservation,
  isOrbitObservationProvider,
  orbitObservationCapability,
  type ExternalOrbitObservationProvider,
} from "@solitude/plugin-api/telemetry";
import type {
  ExternalControlledBody,
  ExternalEntityCollisionSphere,
} from "@solitude/plugin-api/world";
import { isFirstOrbit } from "../composition/runSelection";
import { createAdventureAssemblyValidator } from "./assembly";
import { adventureEarthId, adventureEntityId } from "./definition";
import { flightActions, sanitizeAdventureInput, viewActions } from "./policy";

export function createPlugin(options: ExternalRuntimeOptions): ExternalPlugin {
  if (!isFirstOrbit(options)) return { id: "adventureFinalPolicy" };
  let session: StandaloneEntrySession;
  let objective: AdventureObjective;
  let observer: ExternalOrbitObservationProvider;
  let guidance: AdventureGuidanceProvider;
  let capabilities: ExternalPluginCapabilityRegistry;
  let primaryNameId: string | null = null;
  let primaryName = "";
  let earth: ExternalEntityCollisionSphere | undefined;
  let craft: ExternalControlledBody | undefined;
  let propulsionActive: boolean | null = null;
  let lastCompletedSimTime: number | null = null;
  const towardEarth = vec3.zero();
  const sample: AdventureSample = {
    ...createOrbitObservation(),
    generation: 0,
    sequence: 0,
    simTimeMillis: 0,
    nowMs: 0,
    earthAltitudeMeters: null,
    earthUpAlignmentCosine: null,
    propulsionActive: null,
  };
  const policy = {
    framePolicy: {
      advanceSim: false,
      advanceScene: false,
      advancePresentation: true,
      simDtMillis: 0,
    },
  };
  const command = { main: { forward: 0 }, rcs: { right: 0 } };
  const resolver = {
    resolvePropulsionCommand: ({
      controlInput,
      controlledBody,
      maxThrustAcceleration,
    }: ExternalSpacecraftPropulsionCommandParams) => {
      const signed =
        Number(!!controlInput.burnForward) -
        Number(!!controlInput.burnBackwards);
      command.main.forward =
        session.phase === "flying" &&
        controlledBody.id === adventureEntityId &&
        Number.isFinite(maxThrustAcceleration) &&
        maxThrustAcceleration > 0
          ? (signed * 10) / maxThrustAcceleration
          : 0;
      if (controlledBody.id === adventureEntityId)
        propulsionActive =
          propulsionActive === true ||
          command.main.forward !== 0 ||
          command.rcs.right !== 0;
      return command;
    },
  };
  const keyboard: ExternalKeyboardInputProvider = {
    actions: ["pauseToggle"],
    keyMap: { KeyP: "pauseToggle" },
    createKeyHandler: () => ({
      handleKeyDown: (action, repeat) => {
        if (action === "pauseToggle") {
          if (!repeat)
            session.command(session.phase === "flying" ? "pause" : "resume");
          return true;
        }
        return !(
          session.phase === "flying" &&
          (flightActions.has(action) || viewActions.has(action))
        );
      },
      handleKeyUp: (action) =>
        action === "pauseToggle" ||
        !(flightActions.has(action) || viewActions.has(action)),
    }),
  };
  return {
    id: "adventureFinalPolicy",
    validateAssembly: createAdventureAssemblyValidator(keyboard, resolver),
    capabilities: [
      {
        id: spacecraftVelocityReferenceCapability,
        value: {
          getReferenceEntityId: (id: string) =>
            id === adventureEntityId ? adventureEarthId : null,
        },
      },
      createKeyboardInputCapability(keyboard),
      createSpacecraftPropulsionResolverProvider(resolver),
    ],
    hooks: {
      simulation: {
        beforeVehicleDynamics: ({ controlInput, controlInputsByEntityId }) => {
          sanitizeAdventureInput(controlInput, session.phase === "flying");
          for (const [id, input] of controlInputsByEntityId)
            sanitizeAdventureInput(
              input,
              id === adventureEntityId && session.phase === "flying",
            );
          propulsionActive = null;
        },
      },
      scene: {
        initScene: ({ world }) => {
          earth = world.collisionSpheres.find(
            (body) => body.id === adventureEarthId,
          );
          craft = world.controllableBodies.find(
            (body) => body.id === adventureEntityId,
          );
          if (!earth || !Number.isFinite(earth.radius) || earth.radius <= 0)
            throw new Error("Adventure requires Earth's physical sphere");
          if (
            world.controllableBodies.length !== 1 ||
            world.controllableBodies[0].id !== adventureEntityId
          )
            throw new Error(
              "My First Orbit requires exactly one scenario craft",
            );
        },
      },
      worldModel: {
        contributeWorldModel: (_registry, { capabilityRegistry }) => {
          const sessions = capabilityRegistry
            .getAll(standaloneSessionCapability)
            .filter(isStandaloneEntrySession);
          if (sessions.length !== 1)
            throw new Error("Adventure requires one standalone session");
          session = sessions[0];
          sample.generation = session.generation;
          capabilities = capabilityRegistry;
          const guides = capabilityRegistry
            .getAll(adventureGuidanceCapability)
            .filter(isAdventureGuidanceProvider);
          if (
            guides.length !== 1 ||
            guides[0].guidance.generation !== session.generation
          )
            throw new Error(
              "Adventure requires one current-generation guidance provider",
            );
          guidance = guides[0];
          const objectives = capabilityRegistry
            .getAll(adventureObjectiveCapability)
            .filter(isAdventureObjective);
          const observers = capabilityRegistry
            .getAll(orbitObservationCapability)
            .filter(isOrbitObservationProvider);
          if (objectives.length !== 1 || observers.length !== 1)
            throw new Error(
              "Adventure requires one objective and orbit observer",
            );
          objective = objectives[0];
          observer = observers[0];
          const resolvers =
            getSpacecraftPropulsionResolvers(capabilityRegistry);
          if (resolvers[resolvers.length - 1] !== resolver)
            throw new Error("Adventure propulsion resolver must be last");
        },
      },
      loop: {
        afterFrame: ({ state, world, nowMs, simTimeMillis }) => {
          if (
            !session.advanceSimulation ||
            !state.framePolicy.advanceSim ||
            !(state.framePolicy.simDtMillis! > 0) ||
            !world ||
            !Number.isFinite(simTimeMillis) ||
            (lastCompletedSimTime !== null &&
              simTimeMillis! <= lastCompletedSimTime)
          )
            return;
          lastCompletedSimTime = simTimeMillis!;
          // One completed-frame sample, evaluated by objective before guidance.
          observer.sampleInto(sample, world, adventureEntityId);
          sample.sequence++;
          sample.nowMs = nowMs;
          sample.simTimeMillis = simTimeMillis!;
          const altitude =
            earth &&
            craft &&
            world.entityStates.includes(craft) &&
            world.entityStates.includes(earth.state)
              ? Math.sqrt(vec3.distSq(craft.position, earth.state.position)) -
                earth.radius
              : NaN;
          sample.earthAltitudeMeters = Number.isFinite(altitude)
            ? altitude
            : null;
          sample.earthUpAlignmentCosine = null;
          if (sample.earthAltitudeMeters !== null && earth && craft) {
            vec3.subInto(towardEarth, earth.state.position, craft.position);
            const denominator =
              (altitude + earth.radius) *
              Math.sqrt(vec3.lengthSq(craft.frame.up));
            const cosine =
              denominator > 0
                ? vec3.dot(towardEarth, craft.frame.up) / denominator
                : NaN;
            if (Number.isFinite(cosine))
              sample.earthUpAlignmentCosine = Math.max(-1, Math.min(1, cosine));
          }
          sample.propulsionActive = propulsionActive;
          objective.sample(sample);
          if (sample.primaryId !== primaryNameId) {
            primaryNameId = sample.primaryId;
            primaryName =
              primaryNameId === null
                ? ""
                : formatEntityName(capabilities, primaryNameId, undefined);
          }
          guidance.sample(sample, primaryName);
        },
        updateLoopState: ({ dtMillis, state }) => {
          delete state.framePolicy.tickDtMillis;
          policy.framePolicy.advanceSim = session.advanceSimulation;
          policy.framePolicy.advanceScene = session.advanceSimulation;
          policy.framePolicy.simDtMillis = session.advanceSimulation
            ? dtMillis
            : 0;
          return policy;
        },
      },
    },
  };
}
