import {
  hudHighlightCapability,
  isHudHighlightProvider,
} from "@solitude/plugin-api/hud";
import type { ExternalLocale } from "@solitude/plugin-api/localization";
import type { AdventureSample } from "@solitude/plugin-api/standalone-session";
import { createOrbitObservation } from "@solitude/plugin-api/telemetry";
import { describe, expect, it, vi } from "vitest";
import { createSession } from "../adventure/composition";
import { createAdventureHudCapabilities } from "../adventure/hud";
import { prepareStartup } from "./startupFixture";

function ready(locale: ExternalLocale = "en", generation = 3) {
  const c = createSession(generation, "my-first-orbit", locale, () => true);
  prepareStartup(c);
  const g = c.guidance.guidance;
  // Match the producer: overwrite the same record each completed frame.
  const retained: AdventureSample = {
    ...createOrbitObservation(),
    generation,
    sequence: 0,
    nowMs: 0,
    simTimeMillis: 0,
    earthAltitudeMeters: null,
    earthUpAlignmentCosine: null,
    propulsionActive: null,
  };
  let now = 0;
  let sequence = 0;
  c.session.command("begin");
  c.updateFrame(0, 16);
  const frame = (patch: Partial<AdventureSample> = {}, dt = 250) => {
    now += dt;
    c.updateFrame(now, dt);
    if (!c.canAdvance()) return;
    Object.assign(
      retained,
      createOrbitObservation(),
      {
        generation,
        sequence: ++sequence,
        nowMs: now,
        simTimeMillis: now,
        entityId: "ship:first-orbit",
        primaryId: "planet:earth",
        orbitValid: true,
        isBound: true,
        periapsisAltitudeMeters: -50000,
        apoapsisAltitudeMeters: 400000,
        earthAltitudeMeters: 400000,
        earthUpAlignmentCosine: 1,
        propulsionActive: false,
        progradeAlignmentCosine: 1,
      },
      patch,
    );
    c.objective.sample(retained);
    c.guidance.sample(
      retained,
      retained.primaryId === "planet:earth" ? "Earth" : "Sun",
    );
  };
  const frames = (count: number, patch: Partial<AdventureSample> = {}) => {
    for (let i = 0; i < count; i++) frame(patch);
  };
  return {
    c,
    g,
    frame,
    frames,
    retained,
    get now() {
      return now;
    },
  };
}
const safe = {
  periapsisAltitudeMeters: 150000,
  apoapsisAltitudeMeters: 600000,
};

it("starts with the actual orbit-line state, then offers velocity alignment and burn advice", () => {
  const r = ready("en");
  let enabled = false;
  r.c.attachOrbitLine({
    get enabled() {
      return enabled;
    },
  });
  r.frame();
  expect(r.g.cue).toBe("showOrbit");
  expect(r.g.cueText).toContain("Press G");
  expect(r.g.warningText).toContain("intersects Earth");
  r.g.setHintsEnabled(r.c.session.generation, true);
  expect(r.g.hintText).toContain("Z");
  r.frame({ progradeAlignmentCosine: 0 });
  expect(r.g.cue).toBe("showOrbit");
  enabled = true;
  r.frame({ progradeAlignmentCosine: 0 });
  expect(r.g.cue).toBe("orientOrbit");
  r.frame();
  expect(r.g.cue).toBe("recover");
  expect(r.g.cueText).toContain("Z");
  enabled = false;
  r.frame();
  expect(r.g.cue).toBe("recover");
  const retry = ready("en", 4);
  retry.c.attachOrbitLine({ enabled: false });
  retry.frame();
  expect(retry.g.cue).toBe("showOrbit");
});

it("keeps safety and release cues ahead of the orbit-line preparation step", () => {
  const r = ready("en");
  r.c.attachOrbitLine({ enabled: false });
  r.frame({ apoapsisAltitudeMeters: 700000 });
  expect(r.g.cue).toBe("highApoapsis");
  r.frame({ ...safe, propulsionActive: true });
  expect(r.g.cue).toBe("release");
});

it("waits for the measured nose and Earth-up alignment after G before offering the burn", () => {
  const r = ready();
  let enabled = false;
  r.c.attachOrbitLine({
    get enabled() {
      return enabled;
    },
  });
  r.frame({ earthUpAlignmentCosine: 0 });
  expect(r.g.cue).toBe("showOrbit");
  enabled = true;
  r.frame({ earthUpAlignmentCosine: 0 });
  expect(r.g.cue).toBe("orientOrbit");
  expect(r.g.cueText).toContain("Press Z");
  r.frame({ earthUpAlignmentCosine: null });
  expect(r.g.cue).toBe("orientOrbit");
  const cosine = (degrees: number) => Math.cos((degrees * Math.PI) / 180);
  r.frame({ earthUpAlignmentCosine: cosine(9) });
  expect(r.g.cue).toBe("orientOrbit");
  r.frame({ earthUpAlignmentCosine: 1, progradeAlignmentCosine: cosine(9) });
  expect(r.g.cue).toBe("orientOrbit");
  r.frame({
    earthUpAlignmentCosine: cosine(8),
    progradeAlignmentCosine: cosine(8),
  });
  expect(r.g.cue).toBe("recover");
  r.frame({ earthUpAlignmentCosine: 0 });
  expect(r.g.cue).toBe("recover");
  const retry = ready("en", 4);
  retry.frame({ earthUpAlignmentCosine: 0 });
  expect(retry.g.cue).toBe("orientOrbit");
});

describe("adventure guidance director", () => {
  it("starts without data, teaches negative-periapsis recovery, and retains semantic instruments", () => {
    const r = ready();
    expect(r.g.hintsEnabled).toBe(false);
    expect(r.g.visible).toBe(false);
    expect(
      r.g.instruments.every((i) => i.text === "Awaiting flight data"),
    ).toBe(true);
    const instruments = r.g.instruments;
    r.frame();
    expect(r.g.cue).toBe("recover");
    expect(r.g.cueText).toContain("Hold Space");
    expect(r.g.warningText).toBe("Predicted path intersects Earth.");
    expect(r.g.hintText).toBe("");
    expect(instruments[1]).toMatchObject({
      id: "adventure.orbit.periapsisAltitude",
      value: -50000,
      unit: "m",
      text: "-50.0 km",
      emphasized: true,
    });
    r.frame({ periapsisAltitudeMeters: 100000 });
    expect(r.g.instruments).toBe(instruments);
    expect(r.g.warningText).toContain("below the safety target");
  });
  it("releases immediately at inclusive limits, coasts at any attitude, and uses objective time", () => {
    const r = ready();
    r.frame({ ...safe, propulsionActive: true });
    expect(r.g.cue).toBe("release");
    expect(r.g.instruments[5].value).toBe(true);
    r.frame({ ...safe, progradeAlignmentCosine: -1 });
    expect(r.g.cue).toBe("coast");
    expect(r.g.instruments[6].text).toBe("0.0 / 5 s");
    r.frames(19, safe);
    r.frame(safe, 249);
    expect(r.g.instruments[6].text).toBe("4.9 / 5 s");
    const cues: (string | null)[] = [];
    r.g.subscribe(() => cues.push(r.g.cue));
    r.frame(safe, 1);
    expect(r.c.session.phase).toBe("completed");
    expect(r.g.visible).toBe(false);
    expect(cues).toEqual([null]);
  });
  it("keeps exact physical limits despite rounded displays and gives actual failure precedence", () => {
    const r = ready();
    r.frame({ periapsisAltitudeMeters: 149999 });
    expect(r.g.instruments[1].text).toBe("150.0 km");
    expect(r.g.cue).toBe("recover");
    r.frame({ ...safe, earthAltitudeMeters: 80000 });
    expect(r.c.session.phase).toBe("failed");
    expect(r.g.cue).toBeNull();
    expect(r.g.cueText).toBe("");
  });
  it("prioritizes high apoapsis over low periapsis and explains prograde reverse corrections", () => {
    const r = ready();
    r.frame({ apoapsisAltitudeMeters: 600001 });
    expect(r.g.cue).toBe("highApoapsis");
    expect(r.g.cueText).toContain("align prograde with Z");
    expect(r.g.cueText).toContain("reverse burns with B");
    expect(r.g.instruments[2].emphasized).toBe(true);
    r.frame({ isBound: false, apoapsisAltitudeMeters: null });
    expect(r.g.cue).toBe("escape");
    expect(r.g.instruments[2].text).toBe("No highest point (escape)");
    r.frame({ apoapsisAltitudeMeters: null });
    expect(r.g.cue).toBe("unavailable");
    expect(r.g.instruments[2].text).toBe("Unavailable");
    r.frame();
    expect(r.g.cue).toBe("recover");
  });
  it.each([
    { orbitValid: false },
    { earthAltitudeMeters: null },
    { earthAltitudeMeters: NaN },
    { periapsisAltitudeMeters: null },
    { apoapsisAltitudeMeters: Infinity },
    { propulsionActive: null },
  ])("removes stale burn advice for unavailable data: %j", (patch) => {
    const r = ready();
    r.frame();
    r.frame(patch);
    expect(r.g.cue).toBe("unavailable");
    expect(r.g.cueText).toContain("Release thrust");
    expect(r.g.warningText).toBe("");
    r.frame();
    expect(r.g.cue).toBe("recover");
  });
  it("does not present another primary's apsides as Earth altitudes", () => {
    const r = ready();
    r.frame({ primaryId: "star:sun" });
    expect(r.g.cue).toBe("primaryChanged");
    expect(r.g.instruments[0].value).toBe("star:sun");
    expect(r.g.instruments[1].value).toBeNull();
    expect(r.g.instruments[2].text).toBe("Unavailable");
    expect(r.g.instruments[3].value).toBe(400000);
  });
  it("uses a 10/8 degree deadband only for attitude advice, never for safety", () => {
    const r = ready();
    const cosine = (degrees: number) => Math.cos((degrees * Math.PI) / 180);
    r.frame(); // Complete the initial orbit-attitude step before testing correction advice.
    r.frame({ progradeAlignmentCosine: cosine(11) });
    expect(r.g.cue).toBe("align");
    r.frame({ progradeAlignmentCosine: cosine(9) });
    expect(r.g.cue).toBe("align");
    r.frame({ progradeAlignmentCosine: cosine(8) });
    expect(r.g.cue).toBe("recover");
    r.frame({ progradeAlignmentCosine: cosine(10) });
    expect(r.g.cue).toBe("recover");
    r.frame({ progradeAlignmentCosine: null });
    expect(r.g.cue).toBe("align");
    r.frame({ ...safe, propulsionActive: true, progradeAlignmentCosine: null });
    expect(r.g.cue).toBe("release");
  });
  it("acknowledges safe edges once across repeated propelled frames and obeys cooldowns", () => {
    const r = ready();
    r.frame({ ...safe, propulsionActive: true });
    expect(r.g.acknowledgmentText).toContain("Safe orbit prediction");
    r.frames(13, { ...safe, propulsionActive: true });
    expect(r.c.objective.safeOrbitEntered).toBe(1);
    expect(r.g.acknowledgmentText).toBe("");
    r.frame();
    r.frame({ ...safe, propulsionActive: true });
    expect(r.g.cue).toBe("release");
    expect(r.g.acknowledgmentText).toBe("");
    r.frames(20);
    r.frame({ ...safe, propulsionActive: true });
    expect(r.g.acknowledgmentText).toContain("Safe orbit prediction");
  });
  it("explains confirmation reset from final propulsion while preserving immediate warnings", () => {
    const r = ready();
    r.frame(safe);
    r.frame({ ...safe, propulsionActive: true });
    expect(r.g.acknowledgmentText).toContain("propulsion was applied");
    expect(r.g.cue).toBe("release");
    r.frame({ primaryId: "star:sun" });
    expect(r.g.acknowledgmentText).toBe("");
    expect(r.g.cue).toBe("primaryChanged");
  });
  it("shows opt-in hints immediately and times stall reminders, duration, cooldown, and progress", () => {
    const r = ready();
    r.frame();
    r.g.setHintsEnabled(3, true);
    expect(r.g.hintText).toContain("Pe alt is the predicted lowest point");
    r.frames(31);
    expect(r.g.hintText).not.toContain("rather than tapping");
    r.frame();
    expect(r.g.hintText).toContain("rather than tapping");
    r.frames(20);
    expect(r.g.hintText).not.toContain("rather than tapping");
    r.frames(59);
    expect(r.g.hintText).not.toContain("rather than tapping");
    r.frame();
    expect(r.g.hintText).toContain("rather than tapping");
    r.frame({ periapsisAltitudeMeters: -49000 });
    expect(r.g.hintText).not.toContain("rather than tapping");
    r.g.setHintsEnabled(3, false);
    expect(r.g.hintText).toBe("");
    r.frames(100);
    r.g.setHintsEnabled(3, true);
    expect(r.g.hintText).not.toContain("rather than tapping");
  });
  it("freezes pause timers, rebases Resume, and clears suspension dwell without changing preference", () => {
    const r = ready();
    r.frame();
    r.g.setHintsEnabled(3, true);
    r.frames(20);
    r.c.session.command("pause");
    r.frames(100);
    expect(r.g.cue).toBeNull();
    r.g.setHintsEnabled(3, false);
    r.g.setHintsEnabled(3, true);
    expect(r.c.session.phase).toBe("paused");
    r.c.session.command("resume");
    r.frame(); // session clock baseline only
    r.frame(); // guidance baseline only
    r.frames(31);
    expect(r.g.hintText).not.toContain("rather than tapping");
    r.frame();
    expect(r.g.hintText).toContain("rather than tapping");
    r.c.suspend();
    expect(r.g.hintsEnabled).toBe(true);
    expect(r.g.hintText).not.toContain("rather than tapping");
    r.c.session.command("resume");
    r.frame();
    r.frame();
    r.frames(31);
    expect(r.g.hintText).not.toContain("rather than tapping");
  });
  it("rejects stale commands/samples, duplicate clocks, and blocks guidance during replacement", () => {
    const r = ready();
    r.frame();
    const revision = r.g.revision;
    r.g.setHintsEnabled(2, true);
    r.c.guidance.sample(
      { ...r.retained, generation: 2, sequence: 1000 },
      "Earth",
    );
    r.c.guidance.sample(r.retained, "Earth");
    expect(r.g.revision).toBe(revision);
    r.c.guidance.sample({ ...r.retained, sequence: 2, nowMs: 0 }, "Earth");
    expect(r.g.cue).toBe("unavailable");
    expect(r.g.instruments.every((i) => i.value === null)).toBe(true);
    r.c.session.command("retry");
    const stoppedRevision = r.g.revision;
    r.g.setHintsEnabled(3, true);
    r.frames(20);
    expect(r.g.revision).toBe(stoppedRevision);
    expect(r.g.visible).toBe(false);
    const fresh = ready("en", 4);
    expect(fresh.g.hintsEnabled).toBe(false);
    expect(fresh.g.instruments.every((i) => i.value === null)).toBe(true);
  });
  it("preserves earned coast time through pause without guidance or objective pause credit", () => {
    const r = ready();
    r.frame(safe);
    r.frames(4, safe);
    expect(r.c.objective.coastMillis).toBe(1000);
    r.c.session.command("pause");
    r.frames(80, safe);
    expect(r.c.objective.coastMillis).toBe(1000);
    r.c.session.command("resume");
    r.frame(safe);
    r.frame(safe);
    expect(r.g.instruments[6].text).toBe("1.0 / 5 s");
    r.frame(safe);
    expect(r.g.instruments[6].value).toBe(1250);
  });
  it("freezes acknowledgments during pause and expires them on active time only", () => {
    const r = ready();
    const burning = { ...safe, propulsionActive: true };
    r.frame(burning);
    r.frames(4, burning);
    r.c.session.command("pause");
    r.frames(80, burning);
    expect(r.g.acknowledgmentText).toBe("");
    r.c.session.command("resume");
    r.frame(burning);
    r.frame(burning);
    expect(r.g.acknowledgmentText).toContain("Safe orbit prediction");
    r.frames(7, burning);
    expect(r.g.acknowledgmentText).toContain("Safe orbit prediction");
    r.frame(burning);
    expect(r.g.acknowledgmentText).toBe("");
  });
  it("clears stall hints immediately for release and warnings, and does not reset on falling periapsis", () => {
    const r = ready();
    r.frame();
    r.g.setHintsEnabled(3, true);
    r.frames(32, { periapsisAltitudeMeters: -51000 });
    expect(r.g.hintText).toContain("rather than tapping");
    r.frame({ ...safe, propulsionActive: true });
    expect(r.g.hintText).toContain("Safe prediction alone");
    r.frame({ orbitValid: false });
    expect(r.g.hintText).toContain("Unavailable values");
    r.frame();
    expect(r.g.hintText).toContain("Pe alt is the predicted lowest point");
  });
  it.each([
    { nowMs: NaN },
    { simTimeMillis: NaN },
    { simTimeMillis: 0 },
    { nowMs: 501 },
    { entityId: "ship:other" },
  ])(
    "invalidates transient advice rather than earning time from a bad sample: %j",
    (patch) => {
      const r = ready();
      r.frame();
      r.g.setHintsEnabled(3, true);
      r.frames(30);
      r.c.guidance.sample({ ...r.retained, sequence: 1000, ...patch }, "Earth");
      expect(r.g.cue).toBe("unavailable");
      expect(r.g.instruments.every((i) => i.value === null)).toBe(true);
      expect(r.g.hintText).not.toContain("rather than tapping");
    },
  );
  it("notifies only visible changes and leaves presentation reads and objective time untouched", () => {
    const r = ready();
    r.frame();
    const listener = vi.fn();
    const unsubscribe = r.g.subscribe(listener);
    const revision = r.g.revision;
    const coast = r.c.objective.coastMillis;
    r.frames(20, { periapsisAltitudeMeters: -49999 });
    expect(r.g.instruments[1].value).toBe(-49999);
    expect(r.g.revision).toBe(revision);
    for (let i = 0; i < 20; i++) {
      void r.g.cueText;
      void r.g.hintText;
      void r.g.instruments;
    }
    expect(r.c.objective.coastMillis).toBe(coast);
    expect(listener).not.toHaveBeenCalled();
    r.frame({ periapsisAltitudeMeters: -48000 });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    r.frame();
    expect(listener).toHaveBeenCalledOnce();
  });
  it.each(["en", "es", "fr"] as const)(
    "localizes cues, hints, negative/unavailable/escape instruments in %s",
    (locale) => {
      const r = ready(locale);
      r.frame();
      const initialText = r.g.cueText;
      r.g.setHintsEnabled(3, true);
      expect(r.g.hintText.length).toBeGreaterThan(20);
      expect(r.g.instruments[1].text).toBe(
        locale === "en" ? "-50.0 km" : "-50,0 km",
      );
      r.frame({ isBound: false, apoapsisAltitudeMeters: null });
      expect(r.g.cue).toBe("escape");
      expect(r.g.cueText).not.toBe(initialText);
      expect(r.g.instruments[2].value).toBeNull();
      expect(r.g.instruments[2].text.length).toBeGreaterThan(10);
      r.frame({ orbitValid: false });
      expect(r.g.instruments[1].text).toBe(
        locale === "en"
          ? "Unavailable"
          : locale === "es"
            ? "No disponible"
            : "Indisponible",
      );
    },
  );
});

it("highlights mission HUD rows by stage and clears emphasis on pause, terminal state, and retry", () => {
  const r = ready();
  const provider = createAdventureHudCapabilities(r.g).find(
    (c) => c.id === hudHighlightCapability,
  )!.value;
  if (!isHudHighlightProvider(provider))
    throw new Error("Missing highlight provider");
  r.frame({ progradeAlignmentCosine: 0, earthUpAlignmentCosine: 0 });
  expect(provider.isHighlighted("autopilot.mode")).toBe(true);
  expect(provider.isHighlighted("adventure.alignment")).toBe(true);
  expect(provider.isHighlighted("orbit.periapsisAltitude")).toBe(false);
  r.frame();
  expect(provider.isHighlighted("autopilot.mode")).toBe(false);
  expect(provider.isHighlighted("orbit.periapsisAltitude")).toBe(true);
  expect(provider.isHighlighted("orbit.apoapsisAltitude")).toBe(true);
  r.frame({ ...safe, propulsionActive: true });
  expect(provider.isHighlighted("adventure.propulsion")).toBe(true);
  r.frame(safe);
  expect(provider.isHighlighted("adventure.coast")).toBe(true);
  expect(provider.isHighlighted("orbit.periapsisAltitude")).toBe(false);
  r.c.session.command("pause");
  expect(provider.isHighlighted("adventure.coast")).toBe(false);
  r.c.session.command("resume");
  r.frame({ ...safe, earthAltitudeMeters: 80000 });
  expect(provider.isHighlighted("adventure.coast")).toBe(false);
  const retry = ready("en", 4);
  const fresh = createAdventureHudCapabilities(retry.g).find(
    (c) => c.id === hudHighlightCapability,
  )!.value;
  if (!isHudHighlightProvider(fresh))
    throw new Error("Missing fresh highlight provider");
  expect(fresh.isHighlighted("orbit.periapsisAltitude")).toBe(false);
});
