import type { ExternalLocale } from "@solitude/plugin-api/localization";
import type {
  AdventureCue,
  AdventureGuidance,
  AdventureGuidanceProvider,
  AdventureInstrument,
  AdventureInstrumentId,
  AdventureObjective,
  StandalonePhase,
} from "@solitude/plugin-api/standalone-session";
import en from "./locales/guidance.en.json";
import es from "./locales/guidance.es.json";
import fr from "./locales/guidance.fr.json";
import { adventureEarthId, adventureEntityId } from "./scenario";

const alignedEnter = Math.cos((8 * Math.PI) / 180);
const alignedExit = Math.cos((10 * Math.PI) / 180);
const finite = (value: number | null) =>
  value !== null && Number.isFinite(value);
type MutableInstrument = {
  -readonly [K in keyof AdventureInstrument]: AdventureInstrument[K];
};

/** One retained director per run. Only completed samples advance its clocks. */
export function createGuidance(
  generation: number,
  locale: ExternalLocale,
  objective: AdventureObjective,
  orbitLineEnabled: () => boolean,
) {
  const messages: typeof en = { en, es, fr }[locale];
  const numberFormat = new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const listeners = new Set<() => void>();
  let dirty = false;
  let phase: StandalonePhase = "briefing";
  let blocked = false;
  let sequence = 0;
  let lastNow: number | null = null;
  let lastSim: number | null = null;
  let activeMillis = 0;
  let aligned = true;
  let orbitLineSeen = false;
  let orbitAttitudeSeen = false;
  let previousSafe = false;
  let resetCounter = 0;
  let cue: AdventureCue | null = null;
  let acknowledgment:
    "safeEntered" | "resetBurn" | "resetUnsafe" | "resetUnknown" | null = null;
  let acknowledgmentUntil = 0;
  let lastSafeAck = -Infinity;
  let lastResetAck = -Infinity;
  let stallBaseline: number | null = null;
  let stallSince = 0;
  let lastStall = -Infinity;
  let stallUntil = 0;
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
  const displayedNumbers: (number | null)[] = [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];
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
  const instrumentText = (index: number, value: string) => {
    if (instruments[index].text !== value) {
      instruments[index].text = value;
      dirty = true;
    }
  };
  const numberText = (index: number, value: number | null, coast = false) => {
    instruments[index].value = finite(value) ? value : null;
    const rounded =
      value !== null && Number.isFinite(value)
        ? coast
          ? Math.min(49, Math.floor(value / 100)) / 10
          : Math.round(value / 100) / 10
        : null;
    // The first real unavailable value replaces the initial awaiting placeholder.
    if (rounded === null) {
      displayedNumbers[index] = null;
      instrumentText(index, messages.unavailableValue);
      return;
    }
    if (
      rounded === displayedNumbers[index] &&
      instruments[index].text !== messages.awaiting
    )
      return;
    displayedNumbers[index] = rounded;
    instrumentText(
      index,
      numberFormat.format(rounded).concat(coast ? " / 5 s" : " km"),
    );
  };
  const clearStall = () => {
    stallBaseline = null;
    stallUntil = 0;
    stallSince = activeMillis;
  };
  const clearTransient = () => {
    clearStall();
    acknowledgment = null;
    text("acknowledgmentText", "");
    previousSafe = objective.safeOrbit;
    resetCounter = objective.confirmationReset;
  };
  const updateHint = () => {
    let hint = "";
    if (view.hintsEnabled && cue !== null) {
      if (cue === "recover")
        hint =
          stallUntil > activeMillis ? messages.hintStall : messages.hintRecover;
      else if (cue === "showOrbit") hint = messages.hintOrbit;
      else if (cue === "orientOrbit") hint = messages.hintOrientOrbit;
      else if (cue === "align") hint = messages.hintAlign;
      else if (cue === "release" || cue === "coast") hint = messages.hintCoast;
      else if (cue === "escape" || cue === "highApoapsis")
        hint = messages.hintCorrection;
      else hint = messages.hintUnavailable;
    }
    text("hintText", hint);
  };
  const select = (next: AdventureCue) => {
    if (cue !== next) {
      cue = next;
      dirty = true;
      clearStall();
    }
    text("cueText", messages[next]);
    for (let i = 0; i < instruments.length; i++) {
      const emphasized =
        next === "unavailable"
          ? instruments[i].text === messages.unavailableValue
          : next === "primaryChanged" || next === "escape"
            ? i === 0
            : next === "highApoapsis"
              ? i === 1 || i === 2
              : next === "release"
                ? i === 1 || i === 2 || i === 5 || i === 6
                : next === "coast"
                  ? i === 6
                  : next === "align" || next === "orientOrbit"
                    ? i === 4
                    : i === 1 || i === 2;
      if (instruments[i].emphasized !== emphasized) {
        instruments[i].emphasized = emphasized;
        dirty = true;
      }
    }
  };
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
      return view.visible ? cue : null;
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
    instruments,
    setHintsEnabled: (requestedGeneration, enabled) => {
      if (
        requestedGeneration !== generation ||
        blocked ||
        phase === "completed" ||
        phase === "failed" ||
        view.hintsEnabled === enabled
      )
        return;
      view.hintsEnabled = enabled;
      view.hintToggleLabel = enabled ? messages.hideHints : messages.showHints;
      dirty = true;
      clearStall();
      if (
        enabled &&
        cue === "recover" &&
        typeof instruments[1].value === "number"
      )
        stallBaseline = instruments[1].value;
      updateHint();
      flush();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  const provider: AdventureGuidanceProvider = {
    guidance,
    sample: (sample, primaryDisplayName) => {
      if (blocked || phase !== "flying") return;
      if (sample.generation !== generation || sample.sequence <= sequence)
        return;
      sequence = sample.sequence;
      if (
        sample.entityId !== adventureEntityId ||
        !Number.isFinite(sample.nowMs) ||
        !Number.isFinite(sample.simTimeMillis) ||
        (lastNow !== null &&
          (sample.nowMs <= lastNow || sample.nowMs - lastNow > 250)) ||
        (lastSim !== null && sample.simTimeMillis <= lastSim)
      ) {
        lastNow = null;
        lastSim = null;
        clearTransient();
        for (let i = 0; i < instruments.length; i++) {
          instruments[i].value = null;
          displayedNumbers[i] = null;
          instrumentText(i, messages.unavailableValue);
        }
        primaryName = "";
        primaryBound = null;
        select("unavailable");
        text("warningText", "");
        if (!view.visible) {
          view.visible = true;
          dirty = true;
        }
        updateHint();
        flush();
        return;
      }
      if (lastNow !== null) activeMillis += sample.nowMs - lastNow;
      lastNow = sample.nowMs;
      lastSim = sample.simTimeMillis;
      const earthOrbit =
        sample.orbitValid && sample.primaryId === adventureEarthId;
      instruments[0].value = sample.orbitValid ? sample.primaryId : null;
      if (
        sample.progradeAlignmentCosine !== null &&
        Number.isFinite(sample.progradeAlignmentCosine) &&
        Math.abs(sample.progradeAlignmentCosine) <= 1
      )
        aligned =
          sample.progradeAlignmentCosine >=
          (aligned ? alignedExit : alignedEnter);
      else aligned = false;
      if (!sample.orbitValid || sample.primaryId === null) {
        primaryName = "";
        primaryBound = null;
        instrumentText(0, messages.unavailableValue);
      } else if (
        primaryName !== primaryDisplayName ||
        primaryBound !== sample.isBound
      ) {
        primaryName = primaryDisplayName;
        primaryBound = sample.isBound;
        instrumentText(
          0,
          primaryDisplayName.concat(
            " (",
            sample.isBound ? messages.bound : messages.escapeType,
            ")",
          ),
        );
      }
      numberText(1, earthOrbit ? sample.periapsisAltitudeMeters : null);
      if (earthOrbit && !sample.isBound) {
        instruments[2].value = null;
        displayedNumbers[2] = null;
        instrumentText(2, messages.escapeValue);
      } else numberText(2, earthOrbit ? sample.apoapsisAltitudeMeters : null);
      numberText(3, sample.earthAltitudeMeters);
      instruments[4].value =
        earthOrbit &&
        finite(sample.progradeAlignmentCosine) &&
        Math.abs(sample.progradeAlignmentCosine!) <= 1
          ? aligned
            ? "aligned"
            : "misaligned"
          : null;
      instrumentText(
        4,
        earthOrbit &&
          sample.progradeAlignmentCosine !== null &&
          Number.isFinite(sample.progradeAlignmentCosine) &&
          Math.abs(sample.progradeAlignmentCosine) <= 1
          ? aligned
            ? messages.aligned
            : messages.misaligned
          : messages.unavailableValue,
      );
      instrumentText(
        5,
        sample.propulsionActive === null
          ? messages.unavailableValue
          : sample.propulsionActive
            ? messages.active
            : messages.off,
      );
      instruments[5].value = sample.propulsionActive;
      if (objective.status === "confirming")
        numberText(6, objective.coastMillis, true);
      else {
        instruments[6].value = null;
        displayedNumbers[6] = null;
        instrumentText(6, messages.recoveryRequired);
      }
      let next: AdventureCue;
      if (orbitLineEnabled()) orbitLineSeen = true;
      if (
        orbitLineSeen &&
        sample.progradeAlignmentCosine !== null &&
        Number.isFinite(sample.progradeAlignmentCosine) &&
        sample.progradeAlignmentCosine >= alignedEnter &&
        sample.earthUpAlignmentCosine !== null &&
        Number.isFinite(sample.earthUpAlignmentCosine) &&
        sample.earthUpAlignmentCosine >= alignedEnter
      )
        orbitAttitudeSeen = true;
      if (
        !finite(sample.earthAltitudeMeters) ||
        !sample.orbitValid ||
        !finite(sample.periapsisAltitudeMeters) ||
        (sample.isBound && !finite(sample.apoapsisAltitudeMeters)) ||
        sample.propulsionActive === null
      )
        next = "unavailable";
      else if (sample.primaryId !== adventureEarthId) next = "primaryChanged";
      else if (!sample.isBound) next = "escape";
      else if (sample.apoapsisAltitudeMeters! > 600_000) next = "highApoapsis";
      else if (objective.safeOrbit && sample.propulsionActive) next = "release";
      else if (objective.status === "confirming") next = "coast";
      else if (!orbitLineSeen) next = "showOrbit";
      else if (!orbitAttitudeSeen) next = "orientOrbit";
      else if (sample.periapsisAltitudeMeters! < 150_000)
        next = aligned ? "recover" : "align";
      else next = "unavailable";
      select(next);
      if (!view.visible) {
        view.visible = true;
        dirty = true;
      }
      text(
        "warningText",
        next === "showOrbit" ||
          next === "orientOrbit" ||
          next === "recover" ||
          next === "align"
          ? sample.periapsisAltitudeMeters! < 0
            ? messages.intersection
            : messages.belowTarget
          : "",
      );
      // Consume transitions even when higher-priority feedback suppresses them.
      const reset = objective.confirmationReset !== resetCounter;
      const entered = objective.safeOrbit && !previousSafe;
      resetCounter = objective.confirmationReset;
      previousSafe = objective.safeOrbit;
      if (
        acknowledgment &&
        (activeMillis >= acknowledgmentUntil ||
          (acknowledgment === "safeEntered"
            ? !objective.safeOrbit
            : objective.status === "confirming") ||
          next === "unavailable" ||
          next === "primaryChanged" ||
          next === "escape" ||
          next === "highApoapsis")
      )
        acknowledgment = null;
      if (
        reset &&
        (next === "release" || next === "recover" || next === "align") &&
        activeMillis - lastResetAck >= 8000
      ) {
        acknowledgment =
          sample.propulsionActive === true
            ? "resetBurn"
            : !objective.safeOrbit
              ? "resetUnsafe"
              : "resetUnknown";
        lastResetAck = activeMillis;
        acknowledgmentUntil = activeMillis + 3000;
      } else if (
        entered &&
        (next === "release" || next === "coast") &&
        activeMillis - lastSafeAck >= 8000
      ) {
        acknowledgment = "safeEntered";
        lastSafeAck = activeMillis;
        acknowledgmentUntil = activeMillis + 3000;
      }
      text(
        "acknowledgmentText",
        acknowledgment ? messages[acknowledgment] : "",
      );
      if (next === "recover" && view.hintsEnabled) {
        const periapsis = sample.periapsisAltitudeMeters!;
        if (stallBaseline === null || periapsis - stallBaseline >= 1000) {
          stallBaseline = periapsis;
          stallSince = activeMillis;
          stallUntil = 0;
        } else if (
          activeMillis - stallSince >= 8000 &&
          activeMillis - lastStall >= 20000
        ) {
          lastStall = activeMillis;
          stallUntil = activeMillis + 5000;
        }
      }
      updateHint();
      flush();
    },
  };
  return {
    provider,
    setPhase: (next: StandalonePhase, replacementPending = false) => {
      phase = next;
      blocked = replacementPending;
      lastNow = null;
      lastSim = null;
      // Paused acknowledgments/cooldowns freeze; suspension clears transient advice.
      if (
        next === "suspended" ||
        next === "completed" ||
        next === "failed" ||
        blocked
      ) {
        clearTransient();
        updateHint();
      }
      previousSafe = objective.safeOrbit;
      resetCounter = objective.confirmationReset;
      if (view.visible) {
        view.visible = false;
        dirty = true;
      }
      flush();
    },
  };
}
