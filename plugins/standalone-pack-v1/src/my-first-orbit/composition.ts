import type { ExternalLocale } from "@solitude/plugin-api/localization";
import type { ExternalOrbitSegmentsState } from "@solitude/plugin-api/render";
import type { StandaloneMode } from "@solitude/plugin-api/standalone-entry";
import { createSessionClock } from "./clock";
import { createGuidance } from "./guidance";
import { createObjective } from "./objective";
import { createSessionPresentation } from "./presentation";
import { createSessionLifecycle } from "./session";

/** Assemble one fresh run; lifecycle owns no scenario-rule construction. */
export function createSession(
  generation: number,
  mode: StandaloneMode,
  locale: ExternalLocale,
  canFly: () => boolean,
) {
  let orbitLine: ExternalOrbitSegmentsState | null = null;
  const controller = createSessionLifecycle(
    generation,
    mode,
    canFly,
    createSessionClock(mode !== "my-first-orbit"),
    createSessionPresentation(locale),
    {
      changePhase: (phase) => {
        if (phase === "suspended") hold.reset();
        hold.pause();
        director.setPhase(phase);
      },
      block: (phase) => director.setPhase(phase, true),
    },
  );
  const hold = createObjective(
    generation,
    controller.changePhase,
    controller.canAdvance,
  );
  const director = createGuidance(
    generation,
    locale,
    hold.objective,
    // Headless composition has no orbit-line presentation to enable.
    () => orbitLine === null || orbitLine.enabled,
  );
  return {
    session: controller.session,
    refresh: controller.refresh,
    observeStartupFrame: controller.observeStartupFrame,
    suspend: controller.suspend,
    updateFrame: controller.updateFrame,
    canAdvance: controller.canAdvance,
    attachOrbitLine: (state: ExternalOrbitSegmentsState) => {
      orbitLine = state;
    },
    objective: hold.objective,
    guidance: director.provider,
  };
}
