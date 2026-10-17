import type {
  AdventureInstrumentId,
  AdventureSample,
} from "@solitude/plugin-api/standalone-session";
import { createOrbitObservation } from "@solitude/plugin-api/telemetry";
import { expect, it, vi } from "vitest";
import { createGuidance } from "../adventure/guidance";
import { createGuidanceDirector } from "../adventure/guidanceDirector";
import { createGuidancePresentation } from "../adventure/guidancePresentation";
import { createObjective } from "../adventure/objective";

// Deliberately different rules catch literals in decisions, text, and progress.
vi.mock("../adventure/definition", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../adventure/definition")>()),
  minimumSafePeriapsisAltitudeMeters: 175_000,
  maximumSafeApoapsisAltitudeMeters: 550_000,
  coastConfirmationMillis: 6_500,
  failureAltitudeMeters: 90_000,
}));

function sample(): AdventureSample {
  return {
    ...createOrbitObservation(),
    generation: 7,
    sequence: 1,
    nowMs: 250,
    simTimeMillis: 250,
    entityId: "ship:first-orbit",
    primaryId: "planet:earth",
    orbitValid: true,
    isBound: true,
    periapsisAltitudeMeters: 174_999,
    apoapsisAltitudeMeters: 550_000,
    earthAltitudeMeters: 400_000,
    earthUpAlignmentCosine: 1,
    progradeAlignmentCosine: 1,
    propulsionActive: false,
  };
}

it("runs the director independently of instruments and localization with authoritative rules", () => {
  const { objective } = createObjective(
    7,
    () => {},
    () => true,
  );
  const director = createGuidanceDirector(7, objective, () => true);
  const state = director.state;
  const record = sample();
  director.setPhase("flying");
  const advance = () => {
    objective.sample(record);
    director.sample(record);
    record.sequence++;
    record.nowMs += 250;
    record.simTimeMillis += 250;
  };
  advance();
  expect(state.cue).toBe("recover");
  expect(objective.safeOrbit).toBe(false);
  record.periapsisAltitudeMeters = 175_000;
  record.propulsionActive = true;
  advance();
  expect(state.cue).toBe("release");
  record.apoapsisAltitudeMeters = 550_001;
  advance();
  expect(state.cue).toBe("highApoapsis");
  expect(director.state).toBe(state);
});

it.each(["en", "es", "fr"] as const)(
  "projects tuned rules and coast progress consistently in %s",
  (locale) => {
    const terminal = vi.fn();
    const { objective } = createObjective(7, terminal, () => true);
    const controller = createGuidance(7, locale, objective, () => true);
    const guidance = controller.provider.guidance;
    controller.setPhase("flying");
    const record = sample();
    const advance = () => {
      objective.sample(record);
      controller.provider.sample(record, "Earth");
      record.sequence++;
      record.nowMs += 250;
      record.simTimeMillis += 250;
    };
    advance();
    guidance.setHintsEnabled(7, true);
    const instrument = (id: AdventureInstrumentId) =>
      guidance.instruments.find((value) => value.id === id)!;
    for (const text of [
      guidance.objectiveText,
      guidance.cueText,
      guidance.hintText,
    ]) {
      expect(text).toContain("175 km");
      expect(text).toContain("550 km");
      expect(text).not.toMatch(/\{\w+\}/);
    }
    expect(instrument("adventure.earth.altitude").label).toContain("90 km");
    record.periapsisAltitudeMeters = 175_000;
    advance();
    for (let i = 0; i < 25; i++) advance();
    expect(objective.coastMillis).toBe(6250);
    expect(terminal).not.toHaveBeenCalled();
    const decimal = locale === "en" ? "." : ",";
    expect(instrument("adventure.objective.coast").text).toBe(
      `6${decimal}2 / 6${decimal}5 s`,
    );
    expect(guidance.hintText).toContain(`6${decimal}5`);
    advance();
    expect(terminal).toHaveBeenCalledExactlyOnceWith("completed");
  },
);

it("updates and emphasizes retained instruments by identity after display reordering", () => {
  const { objective } = createObjective(
    7,
    () => {},
    () => true,
  );
  const director = createGuidanceDirector(7, objective, () => true);
  const presentation = createGuidancePresentation(7, "en");
  const instruments = presentation.view.instruments;
  const originals = new Map(instruments.map((value) => [value.id, value]));
  instruments.reverse();
  const record = sample();
  record.periapsisAltitudeMeters = 175_000;
  record.propulsionActive = true;
  director.setPhase("flying");
  objective.sample(record);
  director.sample(record);
  presentation.updateInstruments(record, "Earth", objective, director.state);
  presentation.project(director.state);
  expect(director.state.cue).toBe("release");
  expect(originals.get("adventure.orbit.periapsisAltitude")).toMatchObject({
    value: 175_000,
    text: "175.0 km",
    emphasized: true,
  });
  expect(originals.get("adventure.flight.propulsion")).toMatchObject({
    value: true,
    text: "Active",
    emphasized: true,
  });
  expect(originals.get("adventure.earth.altitude")).toMatchObject({
    value: 400_000,
    text: "400.0 km",
    emphasized: false,
  });
  for (const instrument of instruments)
    expect(instrument).toBe(originals.get(instrument.id));
  presentation.clearInstruments();
  record.propulsionActive = false;
  record.sequence++;
  record.nowMs += 250;
  record.simTimeMillis += 250;
  objective.sample(record);
  director.sample(record);
  presentation.updateInstruments(record, "Earth", objective, director.state);
  presentation.project(director.state);
  expect(originals.get("adventure.objective.coast")).toMatchObject({
    value: 0,
    text: "0.0 / 6.5 s",
    emphasized: true,
  });
  expect(
    instruments.filter((value) => value.emphasized).map((value) => value.id),
  ).toEqual(["adventure.objective.coast"]);
});
