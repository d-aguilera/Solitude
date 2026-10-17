import type { AdventureSample } from "@solitude/plugin-api/my-first-orbit";
import { createOrbitObservation } from "@solitude/plugin-api/telemetry";
import { describe, expect, it, vi } from "vitest";
import { createSession } from "../adventure/composition";
import { createObjective } from "../adventure/objective";
import { prepareStartup } from "./startupFixture";

function sample(
  sequence: number,
  nowMs: number,
  patch: Partial<AdventureSample> = {},
): AdventureSample {
  return {
    ...createOrbitObservation(),
    generation: 3,
    sequence,
    nowMs,
    simTimeMillis: nowMs,
    entityId: "ship:first-orbit",
    primaryId: "planet:earth",
    orbitValid: true,
    isBound: true,
    periapsisAltitudeMeters: 150_000,
    apoapsisAltitudeMeters: 600_000,
    earthAltitudeMeters: 400_000,
    earthUpAlignmentCosine: 1,
    propulsionActive: false,
    ...patch,
  };
}
function ready() {
  const terminal = vi.fn();
  return { ...createObjective(3, terminal, () => true), terminal };
}
function coast(hold: ReturnType<typeof ready>, until = 4750) {
  for (let now = 0; now <= until; now += 250)
    hold.objective.sample(sample(now / 250 + 1, now));
}

describe("completed-frame adventure objective", () => {
  it("accepts inclusive orbit bounds and only completes at 5000ms, once", () => {
    const h = ready();
    coast(h);
    h.objective.sample(sample(21, 4999));
    expect(h.objective.coastMillis).toBe(4999);
    expect(h.terminal).not.toHaveBeenCalled();
    h.objective.sample(sample(22, 5000));
    expect(h.terminal).toHaveBeenCalledExactlyOnceWith("completed");
    expect(h.objective.terminalSequence).toBe(22);
    h.objective.sample(sample(23, 5010, { earthAltitudeMeters: 0 }));
    expect(h.objective.status).toBe("completed");
    expect(h.objective.safeOrbitConfirmed).toBe(1);
  });
  it.each([
    { propulsionActive: true },
    { propulsionActive: null },
    { orbitValid: false },
    { isBound: false, apoapsisAltitudeMeters: null },
    { primaryId: "star:sun" },
    { entityId: "ship:other" },
    { periapsisAltitudeMeters: 149999.999 },
    { apoapsisAltitudeMeters: 600000.001 },
    { periapsisAltitudeMeters: NaN },
    { generation: 2 },
  ])("resets the hold on an ineligible completing sample: %j", (patch) => {
    const h = ready();
    coast(h);
    h.objective.sample(sample(21, 5000, patch));
    expect(h.objective.coastMillis).toBe(0);
    expect(h.terminal).not.toHaveBeenCalled();
    h.objective.sample(sample(22, 5016));
    expect(h.objective.coastMillis).toBe(0);
  });
  it("does not credit the burn interval or duplicate samples", () => {
    const h = ready();
    h.objective.sample(sample(1, 100, { propulsionActive: true }));
    h.objective.sample(sample(2, 200));
    h.objective.sample(sample(2, 300));
    expect(h.objective.coastMillis).toBe(0);
    h.objective.sample(sample(3, 350));
    expect(h.objective.coastMillis).toBe(150);
    expect(h.objective.safeOrbitEntered).toBe(1);
  });
  it.each([[-1], [NaN], [5001]])(
    "resets on clock discontinuity (%s)",
    (now) => {
      const h = ready();
      coast(h);
      h.objective.sample(sample(21, now));
      expect(h.objective.coastMillis).toBe(0);
      expect(h.terminal).not.toHaveBeenCalled();
    },
  );
  it.each([true, false])(
    "gives actual Earth boundary failure precedence with orbitValid=%s",
    (orbitValid) => {
      const h = ready();
      coast(h);
      h.objective.sample(
        sample(21, 5000, {
          earthAltitudeMeters: 80_000,
          orbitValid,
          primaryId: orbitValid ? "planet:earth" : "star:sun",
        }),
      );
      expect(h.terminal).toHaveBeenCalledExactlyOnceWith("failed");
      h.objective.sample(sample(22, 5100));
      expect(h.objective.status).toBe("failed");
    },
  );
  it("never treats missing or nonfinite Earth distance as a boundary crossing", () => {
    const h = ready();
    h.objective.sample(
      sample(1, 100, {
        earthAltitudeMeters: null,
        earthUpAlignmentCosine: null,
        orbitValid: false,
      }),
    );
    h.objective.sample(
      sample(2, 200, { earthAltitudeMeters: NaN, orbitValid: false }),
    );
    expect(h.terminal).not.toHaveBeenCalled();
  });
  it("preserves explicit-pause progress, rebases resume, resets suspension, and blocks terminal ticks", () => {
    const c = createSession(3, "my-first-orbit", "en", () => true);
    prepareStartup(c);
    c.session.command("begin");
    c.updateFrame(0, 16);
    let sequence = 0;
    const advance = (now: number, patch: Partial<AdventureSample> = {}) => {
      c.updateFrame(now, 250);
      c.objective.sample(sample(++sequence, now, patch));
    };
    for (let now = 250; now <= 1250; now += 250) advance(now);
    expect(c.objective.coastMillis).toBe(1000);
    c.session.command("pause");
    c.objective.sample(sample(100, 10000));
    expect(c.objective.latestSequence).toBe(5);
    c.session.command("resume");
    c.updateFrame(20000, 19000);
    advance(20250);
    expect(c.objective.coastMillis).toBe(1000);
    advance(20500);
    expect(c.objective.coastMillis).toBe(1250);
    c.suspend();
    expect(c.objective.coastMillis).toBe(0);
    c.session.command("resume");
    c.updateFrame(30000, 16);
    advance(30250, { earthAltitudeMeters: 80_000 });
    expect(c.session.phase).toBe("failed");
    expect(c.canAdvance()).toBe(false);
    expect(c.session.getPresentation()?.actions.map((a) => a.command)).toEqual([
      "retry",
      "menu",
    ]);
    c.session.command("resume");
    expect(c.session.phase).toBe("failed");
    const fresh = createSession(4, "my-first-orbit", "en", () => true);
    prepareStartup(fresh);
    expect(fresh.objective.coastMillis).toBe(0);
    expect(fresh.objective.latestSequence).toBe(0);
    expect(fresh.session.phase).toBe("briefing");
  });
});
