import { readLocaleRuntimeOption } from "@solitude/plugin-api/localization";
import type { ExternalPlugin } from "@solitude/plugin-api/module";
import type { ExternalRuntimeOptions } from "@solitude/plugin-api/runtime";
import {
  adventureGuidanceCapability,
  adventureObjectiveCapability,
  isAdventure,
  standaloneGenerationOption,
  standaloneSessionCapability,
} from "@solitude/plugin-api/standalone-session";
import { adventureEntityId, createScenario } from "./scenario";
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
    capabilities: [
      { id: standaloneSessionCapability, value: session },
      ...(adventure
        ? [
            { id: adventureObjectiveCapability, value: controller.objective },
            { id: adventureGuidanceCapability, value: controller.guidance },
          ]
        : []),
    ],
    hooks: adventure
      ? {
          worldModel: createScenario(),
          loop: {
            initLoop: () => {
              const suspend = () => controller.suspend();
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
          simulation: {
            beforeVehicleDynamics: ({
              controlInput,
              controlInputsByEntityId,
            }) => {
              sanitizeAdventureInput(controlInput, session.phase === "flying");
              for (const [id, input] of controlInputsByEntityId)
                sanitizeAdventureInput(
                  input,
                  id === adventureEntityId && session.phase === "flying",
                );
            },
          },
        }
      : undefined,
  };
}
