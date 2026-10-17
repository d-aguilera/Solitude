import type { ExternalLocale } from "@solitude/plugin-api/localization";
import type {
  AdventureInstrument,
  AdventureInstrumentId,
  AdventureObjective,
  AdventureSample,
} from "@solitude/plugin-api/my-first-orbit";
import {
  adventureEarthId,
  coastConfirmationMillis,
  failureAltitudeMeters,
  maximumSafeApoapsisAltitudeMeters,
  minimumSafePeriapsisAltitudeMeters,
} from "./definition";
import type { createGuidanceDirector } from "./guidanceDirector";
import en from "./locales/guidance.en.json";
import es from "./locales/guidance.es.json";
import fr from "./locales/guidance.fr.json";
type MutableInstrument = {
  -readonly [K in keyof AdventureInstrument]: AdventureInstrument[K];
};
type Decisions = Readonly<ReturnType<typeof createGuidanceDirector>["state"]>;
const finite = (value: number | null) =>
  value !== null && Number.isFinite(value);

/** Retained localized projection; instrument identity is independent of display order. */
export function createGuidancePresentation(
  generation: number,
  locale: ExternalLocale,
) {
  const bundle: typeof en = { en, es, fr }[locale];
  const messages = { ...bundle };
  const ruleNumberFormat = new Intl.NumberFormat(locale, {
    useGrouping: false,
  });
  const parameters = {
    minimumPeriapsisKm: minimumSafePeriapsisAltitudeMeters / 1000,
    maximumApoapsisKm: maximumSafeApoapsisAltitudeMeters / 1000,
    failureAltitudeKm: failureAltitudeMeters / 1000,
    coastSeconds: coastConfirmationMillis / 1000,
  };
  for (const key of Object.keys(messages) as (keyof typeof messages)[]) {
    messages[key] = messages[key].replace(
      /\{(\w+)\}/g,
      (_, name: keyof typeof parameters) =>
        ruleNumberFormat.format(parameters[name]),
    );
  }
  const numberFormat = new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const listeners = new Set<() => void>();
  let dirty = false;
  const instruments: MutableInstrument[] = [];
  const addInstrument = (
    id: AdventureInstrumentId,
    label: string,
    unit: AdventureInstrument["unit"],
  ) =>
    instruments.push({
      id,
      label,
      unit,
      value: null,
      text: messages.awaiting,
      emphasized: false,
    });
  addInstrument("adventure.orbit.primary", messages.primaryLabel, null);
  addInstrument(
    "adventure.orbit.periapsisAltitude",
    messages.periapsisLabel,
    "m",
  );
  addInstrument(
    "adventure.orbit.apoapsisAltitude",
    messages.apoapsisLabel,
    "m",
  );
  addInstrument("adventure.earth.altitude", messages.altitudeLabel, "m");
  addInstrument(
    "adventure.flight.progradeAlignment",
    messages.alignmentLabel,
    null,
  );
  addInstrument("adventure.flight.propulsion", messages.propulsionLabel, null);
  addInstrument("adventure.objective.coast", messages.coastLabel, "ms");
  const byId = Object.fromEntries(
    instruments.map((instrument) => [instrument.id, instrument]),
  ) as Record<AdventureInstrumentId, MutableInstrument>;
  const displayedNumbers = new Map<AdventureInstrumentId, number | null>(
    instruments.map((instrument) => [instrument.id, null]),
  );
  const coastSuffix = ` / ${ruleNumberFormat.format(coastConfirmationMillis / 1000)} s`;
  let primaryName = "";
  let primaryBound: boolean | null = null;
  const view = {
    generation,
    revision: 0,
    visible: false,
    cueText: "",
    warningText: "",
    acknowledgmentText: "",
    objectiveText: messages.objective,
    hintText: "",
    hintsEnabled: false,
    hintToggleLabel: messages.showHints,
    instruments,
  };
  const text = (
    field: "cueText" | "warningText" | "acknowledgmentText" | "hintText",
    value: string,
  ) => {
    if (view[field] !== value) {
      view[field] = value;
      dirty = true;
    }
  };
  const flush = () => {
    if (!dirty) return;
    dirty = false;
    view.revision++;
    for (const listener of listeners) listener();
  };
  const instrumentText = (id: AdventureInstrumentId, value: string) => {
    if (byId[id].text !== value) {
      byId[id].text = value;
      dirty = true;
    }
  };
  const numberText = (
    id: AdventureInstrumentId,
    value: number | null,
    coast = false,
  ) => {
    byId[id].value = finite(value) ? value : null;
    const rounded =
      value !== null && Number.isFinite(value)
        ? coast
          ? Math.min(
              Math.ceil(coastConfirmationMillis / 100) - 1,
              Math.floor(value / 100),
            ) / 10
          : Math.round(value / 100) / 10
        : null;
    // The first real unavailable value replaces the initial awaiting placeholder.
    if (rounded === null) {
      displayedNumbers.set(id, null);
      instrumentText(id, messages.unavailableValue);
      return;
    }
    if (
      rounded === displayedNumbers.get(id) &&
      byId[id].text !== messages.awaiting
    )
      return;
    displayedNumbers.set(id, rounded);
    instrumentText(
      id,
      numberFormat.format(rounded).concat(coast ? coastSuffix : " km"),
    );
  };
  const clearInstruments = () => {
    for (const instrument of instruments) {
      instrument.value = null;
      displayedNumbers.set(instrument.id, null);
      instrumentText(instrument.id, messages.unavailableValue);
    }
    primaryName = "";
    primaryBound = null;
  };
  const updateInstruments = (
    sample: AdventureSample,
    primaryDisplayName: string,
    objective: AdventureObjective,
    decisions: Decisions,
  ) => {
    const earthOrbit =
      sample.orbitValid && sample.primaryId === adventureEarthId;
    byId["adventure.orbit.primary"].value = sample.orbitValid
      ? sample.primaryId
      : null;
    if (!sample.orbitValid || sample.primaryId === null) {
      primaryName = "";
      primaryBound = null;
      instrumentText("adventure.orbit.primary", messages.unavailableValue);
    } else if (
      primaryName !== primaryDisplayName ||
      primaryBound !== sample.isBound
    ) {
      primaryName = primaryDisplayName;
      primaryBound = sample.isBound;
      instrumentText(
        "adventure.orbit.primary",
        primaryDisplayName.concat(
          " (",
          sample.isBound ? messages.bound : messages.escapeType,
          ")",
        ),
      );
    }
    numberText(
      "adventure.orbit.periapsisAltitude",
      earthOrbit ? sample.periapsisAltitudeMeters : null,
    );
    if (earthOrbit && !sample.isBound) {
      byId["adventure.orbit.apoapsisAltitude"].value = null;
      displayedNumbers.set("adventure.orbit.apoapsisAltitude", null);
      instrumentText("adventure.orbit.apoapsisAltitude", messages.escapeValue);
    } else
      numberText(
        "adventure.orbit.apoapsisAltitude",
        earthOrbit ? sample.apoapsisAltitudeMeters : null,
      );
    numberText("adventure.earth.altitude", sample.earthAltitudeMeters);
    byId["adventure.flight.progradeAlignment"].value =
      earthOrbit &&
      finite(sample.progradeAlignmentCosine) &&
      Math.abs(sample.progradeAlignmentCosine!) <= 1
        ? decisions.aligned
          ? "aligned"
          : "misaligned"
        : null;
    instrumentText(
      "adventure.flight.progradeAlignment",
      earthOrbit &&
        sample.progradeAlignmentCosine !== null &&
        Number.isFinite(sample.progradeAlignmentCosine) &&
        Math.abs(sample.progradeAlignmentCosine) <= 1
        ? decisions.aligned
          ? messages.aligned
          : messages.misaligned
        : messages.unavailableValue,
    );
    instrumentText(
      "adventure.flight.propulsion",
      sample.propulsionActive === null
        ? messages.unavailableValue
        : sample.propulsionActive
          ? messages.active
          : messages.off,
    );
    byId["adventure.flight.propulsion"].value = sample.propulsionActive;
    if (objective.status === "confirming")
      numberText("adventure.objective.coast", objective.coastMillis, true);
    else {
      byId["adventure.objective.coast"].value = null;
      displayedNumbers.set("adventure.objective.coast", null);
      instrumentText("adventure.objective.coast", messages.recoveryRequired);
    }
  };
  return {
    view,
    updateInstruments,
    clearInstruments,
    project: (decisions: Decisions) => {
      const next = decisions.cue;
      if (
        view.visible !== decisions.visible ||
        view.hintsEnabled !== decisions.hintsEnabled
      )
        dirty = true;
      view.visible = decisions.visible;
      view.hintsEnabled = decisions.hintsEnabled;
      view.hintToggleLabel = decisions.hintsEnabled
        ? messages.hideHints
        : messages.showHints;
      text("cueText", next ? messages[next] : "");
      text("warningText", decisions.warning ? messages[decisions.warning] : "");
      text(
        "acknowledgmentText",
        decisions.acknowledgment ? messages[decisions.acknowledgment] : "",
      );
      text("hintText", decisions.hint ? messages[decisions.hint] : "");
      if (next !== null) {
        for (const instrument of instruments) {
          const emphasized =
            next === "unavailable"
              ? instrument.text === messages.unavailableValue
              : next === "primaryChanged" || next === "escape"
                ? instrument.id === "adventure.orbit.primary"
                : next === "highApoapsis"
                  ? instrument.id === "adventure.orbit.periapsisAltitude" ||
                    instrument.id === "adventure.orbit.apoapsisAltitude"
                  : next === "release"
                    ? instrument.id === "adventure.orbit.periapsisAltitude" ||
                      instrument.id === "adventure.orbit.apoapsisAltitude" ||
                      instrument.id === "adventure.flight.propulsion" ||
                      instrument.id === "adventure.objective.coast"
                    : next === "coast"
                      ? instrument.id === "adventure.objective.coast"
                      : next === "align" || next === "orientOrbit"
                        ? instrument.id === "adventure.flight.progradeAlignment"
                        : instrument.id ===
                            "adventure.orbit.periapsisAltitude" ||
                          instrument.id === "adventure.orbit.apoapsisAltitude";
          if (instrument.emphasized !== emphasized) {
            instrument.emphasized = emphasized;
            dirty = true;
          }
        }
      }
      flush();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
