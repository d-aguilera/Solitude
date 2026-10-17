import type { ExternalLocale } from "@solitude/plugin-api/localization";
import type {
  AdventureGuidance,
  AdventureGuidanceProvider,
  AdventureObjective,
  StandalonePhase,
} from "@solitude/plugin-api/standalone-session";
import { createGuidanceDirector } from "./guidanceDirector";
import { createGuidancePresentation } from "./guidancePresentation";

/** Compose the run's retained decisions and localized read-only presentation. */
export function createGuidance(
  generation: number,
  locale: ExternalLocale,
  objective: AdventureObjective,
  orbitLineEnabled: () => boolean,
) {
  const director = createGuidanceDirector(
    generation,
    objective,
    orbitLineEnabled,
  );
  const presentation = createGuidancePresentation(generation, locale);
  const { view } = presentation;
  const guidance: AdventureGuidance = {
    get generation() {
      return generation;
    },
    get revision() {
      return view.revision;
    },
    get visible() {
      return view.visible;
    },
    get cue() {
      return view.visible ? director.state.cue : null;
    },
    get cueText() {
      return view.visible ? view.cueText : "";
    },
    get warningText() {
      return view.visible ? view.warningText : "";
    },
    get acknowledgmentText() {
      return view.visible ? view.acknowledgmentText : "";
    },
    get objectiveText() {
      return view.objectiveText;
    },
    get hintText() {
      return view.hintText;
    },
    get hintsEnabled() {
      return view.hintsEnabled;
    },
    get hintToggleLabel() {
      return view.hintToggleLabel;
    },
    instruments: view.instruments,
    setHintsEnabled: (requestedGeneration, enabled) => {
      director.setHintsEnabled(requestedGeneration, enabled);
      presentation.project(director.state);
    },
    subscribe: presentation.subscribe,
  };
  const provider: AdventureGuidanceProvider = {
    guidance,
    sample: (sample, primaryDisplayName) => {
      const result = director.sample(sample);
      if (!result) return;
      if (result === "unavailable") presentation.clearInstruments();
      else
        presentation.updateInstruments(
          sample,
          primaryDisplayName,
          objective,
          director.state,
        );
      presentation.project(director.state);
    },
  };
  return {
    provider,
    setPhase: (next: StandalonePhase, replacementPending = false) => {
      director.setPhase(next, replacementPending);
      presentation.project(director.state);
    },
  };
}
