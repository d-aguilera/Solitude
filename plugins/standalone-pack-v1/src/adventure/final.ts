import { createKeyboardInputCapability } from "@solitude/plugin-api/input";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import { createSpacecraftPropulsionResolverProvider } from "@solitude/plugin-api/spacecraft";
import {
  isAdventure,
  isStandaloneSession,
  standaloneSessionCapability,
  type StandaloneSession,
} from "@solitude/plugin-api/standalone-session";
import { flightActions, viewActions } from "./policy";
import { adventureEntityId } from "./scenario";

export function createPlugin(options: ExternalRuntimeOptions): ExternalPlugin {
  if (!isAdventure(options)) return { id: "adventureFinalPolicy" };
  let session: StandaloneSession;
  const policy = {
    framePolicy: {
      advanceSim: false,
      advanceScene: false,
      advancePresentation: true,
      simDtMillis: 0,
    },
  };
  const command = { main: { forward: 0 }, rcs: { right: 0 } };
  return {
    id: "adventureFinalPolicy",
    capabilities: [
      createKeyboardInputCapability({
        actions: ["pauseToggle"],
        keyMap: { KeyP: "pauseToggle" },
        createKeyHandler: () => ({
          handleKeyDown: (action, repeat) => {
            if (action === "pauseToggle") {
              if (!repeat)
                session.command(
                  session.phase === "flying" ? "pause" : "resume",
                );
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
      }),
      createSpacecraftPropulsionResolverProvider({
        resolvePropulsionCommand: ({
          controlInput,
          controlledBody,
          maxThrustAcceleration,
        }) => {
          const signed =
            Number(!!controlInput.burnForward) -
            Number(!!controlInput.burnBackwards);
          command.main.forward =
            session.phase === "flying" &&
            controlledBody.id === adventureEntityId &&
            maxThrustAcceleration > 0
              ? (signed * 10) / maxThrustAcceleration
              : 0;
          return command;
        },
      }),
    ],
    hooks: {
      scene: {
        initScene: ({ world }) => {
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
            .filter(isStandaloneSession);
          if (sessions.length !== 1)
            throw new Error("Adventure requires one standalone session");
          session = sessions[0];
        },
      },
      loop: {
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
