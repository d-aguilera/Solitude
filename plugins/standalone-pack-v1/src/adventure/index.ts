import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import {
  isOrbitSegmentsState,
  orbitSegmentsStateCapability,
} from "@solitude/plugin-api/render";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import {
  adventureGuidanceCapability,
  adventureObjectiveCapability,
  isAdventure,
  standaloneGenerationOption,
  standaloneSessionCapability,
} from "@solitude/plugin-api/standalone-session";
import { validateAdventureSessionAssembly } from "./assembly";
import { createAdventureHudCapabilities } from "./hud";
import { createScenario } from "./scenario";
import { createSession } from "./session";

import { sanitizeAdventureInput } from "./policy";

export function createPlugin(options: ExternalRuntimeOptions): ExternalPlugin {
  const adventure = isAdventure(options);
  const generation = Number(options[standaloneGenerationOption] ?? 0);
  if (!Number.isSafeInteger(generation) || generation < 0)
    throw new Error("Invalid standalone run generation");
  const canFly = () =>
    document.visibilityState !== "hidden" && document.hasFocus();
  const controller = createSession(
    generation,
    adventure ? "my-first-orbit" : "free-flight",
    readLocaleRuntimeOption(options),
    canFly,
  );
  const { session } = controller;
  return {
    id: "standaloneSession",
    validateAssembly: adventure ? validateAdventureSessionAssembly : undefined,
    capabilities: [
      { id: standaloneSessionCapability, value: session },
      ...(adventure
        ? [
            { id: adventureObjectiveCapability, value: controller.objective },
            { id: adventureGuidanceCapability, value: controller.guidance },
            ...createAdventureHudCapabilities(controller.guidance.guidance),
          ]
        : []),
    ],
    hooks: adventure
      ? {
          worldModel: {
            contributeWorldModel: (registry, context) => {
              createScenario().contributeWorldModel!(registry, context);
              const states = context.capabilityRegistry
                .getAll(orbitSegmentsStateCapability)
                .filter(isOrbitSegmentsState);
              if (states.length > 1)
                throw new Error(
                  "Adventure requires at most one orbit-line state provider",
                );
              if (states.length === 1) controller.attachOrbitLine(states[0]);
            },
          },
          loop: {
            afterFrame: ({ nowMs, dtMillis }) =>
              controller.observeStartupFrame(nowMs, dtMillis),
            initLoop: () => {
              const suspend = controller.suspend;
              const visibility = () => {
                if (!canFly()) suspend();
                else controller.refresh();
              };
              document.addEventListener("visibilitychange", visibility);
              window.addEventListener("blur", suspend);
              window.addEventListener("focus", controller.refresh);
              return () => {
                document.removeEventListener("visibilitychange", visibility);
                window.removeEventListener("blur", suspend);
                window.removeEventListener("focus", controller.refresh);
              };
            },
            updateLoopState: ({ nowMs, dtMillis, controlInput }) => {
              if (controlInput.pauseToggle)
                session.command(
                  session.phase === "flying" ? "pause" : "resume",
                );
              sanitizeAdventureInput(controlInput, session.phase === "flying");
              controller.updateFrame(nowMs, dtMillis);
              return null;
            },
          },
        }
      : undefined,
  };
}
