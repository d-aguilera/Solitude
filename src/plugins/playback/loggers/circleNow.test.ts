import { describe, expect, it, vi } from "vitest";
import { createControlInput } from "../../../app/controlPorts";
import type { ShipBody, World } from "../../../domain/domainPorts";
import { mat3 } from "../../../domain/mat3";
import { vec3 } from "../../../domain/vec3";
import { parameters } from "../../../global/parameters";
import { compilePlaybackScript } from "../logic";
import type { PlaybackScript } from "../types";
import {
  circleNowSampleFields,
  createCircleNowLogger,
  type CircleNowLogReport,
} from "./circleNow";
import { createPlaybackLogger } from "./index";

function createScript(): ReturnType<typeof compilePlaybackScript> {
  const script: PlaybackScript = {
    id: "moon-circle-test",
    snapshot: {
      metadata: {
        label: "moon-circle-test",
        capturedSimTimeMillis: 0,
        dominantBodyId: null,
      },
      ships: [],
      planets: [],
      stars: [],
    },
    fixedDtMillis: 1000 / 60,
    timeScale: 32,
    phases: [{ durationMs: 1000, controls: { circleNow: true } }],
    endBehavior: "pause",
    metadata: {
      capturedSimTimeMillis: 0,
      recordingStartedRuntimeMs: 0,
      recordingEndedRuntimeMs: 1000,
    },
  };
  return compilePlaybackScript(script);
}

function createWorld(): { ship: ShipBody; world: World } {
  const frame = {
    right: vec3.create(0, 1, 0),
    forward: vec3.create(-1, 0, 0),
    up: vec3.create(0, 0, 1),
  };
  const ship: ShipBody = {
    id: "ship:test",
    position: vec3.create(10_000_000, 0, 0),
    velocity: vec3.create(0, 1500, 0),
    frame,
    orientation: mat3.zero(),
    angularVelocity: { roll: 1, pitch: 0.1, yaw: 0.2 },
  };
  const planet = {
    id: "planet:moon",
    position: vec3.zero(),
    velocity: vec3.zero(),
    orientation: mat3.zero(),
    rotationAxis: vec3.create(0, 0, 1),
    angularSpeedRadPerSec: 0,
  };
  mat3.copy(mat3.identity, ship.orientation);
  mat3.copy(mat3.identity, planet.orientation);

  return {
    ship,
    world: {
      ships: [ship],
      shipPhysics: [{ id: ship.id, density: 1, mass: 1 }],
      planets: [planet],
      planetPhysics: [
        {
          id: planet.id,
          density: 1,
          mass: 7.342e22,
          physicalRadius: 1_737_400,
        },
      ],
      stars: [],
      starPhysics: [],
    },
  };
}

function sampleValue(
  report: CircleNowLogReport,
  sampleIndex: number,
  field: (typeof circleNowSampleFields)[number],
): number {
  const fieldIndex = circleNowSampleFields.indexOf(field);
  expect(fieldIndex).toBeGreaterThanOrEqual(0);
  return report.samples[sampleIndex * report.sampleStride + fieldIndex];
}

describe("playback diagnostic loggers", () => {
  it("routes circle-now logging only when requested", () => {
    const script = createScript();

    expect(createPlaybackLogger(undefined, script)).toBeNull();
    expect(createPlaybackLogger("circle-now", script)).not.toBeNull();
  });
});

describe("circle-now playback logger", () => {
  it("samples only while circle-now is active", () => {
    const script = createScript();
    const logger = createCircleNowLogger(script);
    const { ship, world } = createWorld();
    const controlInput = createControlInput(["circleNow"]);

    logger.onPlaybackStart?.({
      controlInput,
      mainShip: ship,
      playbackElapsedMs: 0,
      script,
      simTimeMillis: 0,
      world,
    });
    logger.sampleAfterTick?.({
      controlInput,
      dtSimMillis: script.fixedDtMillis * script.timeScale,
      dtTickMillis: script.fixedDtMillis,
      mainShip: ship,
      playbackElapsedMs: script.fixedDtMillis,
      script,
      simTimeMillis: 100,
      world,
    });

    expect(logger.getReport().sampleCount).toBe(0);

    controlInput.circleNow = true;
    logger.sampleAfterTick?.({
      controlInput,
      dtSimMillis: script.fixedDtMillis * script.timeScale,
      dtTickMillis: script.fixedDtMillis,
      mainShip: ship,
      playbackElapsedMs: script.fixedDtMillis * 2,
      script,
      simTimeMillis: 200,
      world,
    });

    const report = logger.getReport();
    const primaryIndexOffset = circleNowSampleFields.indexOf("primaryIndex");
    const newFields = [
      "tangentialRollAlignmentRateDegPerSec",
      "projectedTangentBearingRateDegPerSec",
      "tangentialDirectionRateDegPerSec",
      "shipForwardDirectionRateDegPerSec",
      "tangentialForwardDot",
      "tangentialProjectionLength",
      "desiredAccelerationForwardDot",
      "desiredAccelerationRightDot",
      "desiredAccelerationUpDot",
    ] as const;

    expect(report.schemaVersion).toBe(3);
    expect(report.circleNowAlgorithmVersion).toBe("v5");
    expect(report.sampleCount).toBe(1);
    expect(report.samples.length).toBe(report.sampleStride);
    expect(report.sampleStride).toBe(circleNowSampleFields.length);
    for (const field of newFields) {
      expect(circleNowSampleFields).toContain(field);
    }
    expect(report.samples[primaryIndexOffset]).toBe(0);
    expect(report.primaryIds).toEqual(["planet:moon"]);
    expect(
      sampleValue(report, 0, "tangentialRollAlignmentRateDegPerSec"),
    ).toBeNaN();
    expect(
      sampleValue(report, 0, "projectedTangentBearingRateDegPerSec"),
    ).toBeNaN();
    expect(
      sampleValue(report, 0, "tangentialDirectionRateDegPerSec"),
    ).toBeNaN();
    expect(
      sampleValue(report, 0, "shipForwardDirectionRateDegPerSec"),
    ).toBeNaN();
    expect(sampleValue(report, 0, "tangentialForwardDot")).toBeCloseTo(0);
    expect(sampleValue(report, 0, "tangentialProjectionLength")).toBeCloseTo(1);
    expect(
      sampleValue(report, 0, "desiredAccelerationForwardDot"),
    ).toBeGreaterThanOrEqual(-1);
    expect(
      sampleValue(report, 0, "desiredAccelerationRightDot"),
    ).toBeGreaterThanOrEqual(-1);
    expect(
      sampleValue(report, 0, "desiredAccelerationUpDot"),
    ).toBeGreaterThanOrEqual(-1);
    expect(report.summary.activeDurationMs).toBeCloseTo(script.fixedDtMillis);
    expect(report.summary.activeSimDurationMs).toBeCloseTo(
      script.fixedDtMillis * script.timeScale,
    );
    expect(report.summary.totalAbsRollDeg).toBeGreaterThan(0);
  });

  it("records the selected circle-now algorithm version", () => {
    const script = createScript();
    const logger = createCircleNowLogger(script, {
      autopilot: "v1",
    });

    expect(logger.getReport().schemaVersion).toBe(3);
    expect(logger.getReport().circleNowAlgorithmVersion).toBe("v1");
  });

  it("records finite target-rate diagnostics after a previous valid sample", () => {
    const script = createScript();
    const logger = createCircleNowLogger(script);
    const { ship, world } = createWorld();
    const controlInput = createControlInput(["circleNow"]);
    controlInput.circleNow = true;

    logger.onPlaybackStart?.({
      controlInput,
      mainShip: ship,
      playbackElapsedMs: 0,
      script,
      simTimeMillis: 0,
      world,
    });

    logger.sampleAfterTick?.({
      controlInput,
      dtSimMillis: script.fixedDtMillis * script.timeScale,
      dtTickMillis: script.fixedDtMillis,
      mainShip: ship,
      playbackElapsedMs: script.fixedDtMillis,
      script,
      simTimeMillis: 100,
      world,
    });
    logger.sampleAfterTick?.({
      controlInput,
      dtSimMillis: script.fixedDtMillis * script.timeScale,
      dtTickMillis: script.fixedDtMillis,
      mainShip: ship,
      playbackElapsedMs: script.fixedDtMillis * 2,
      script,
      simTimeMillis: 200,
      world,
    });

    const report = logger.getReport();

    expect(report.sampleCount).toBe(2);
    expect(
      Number.isFinite(
        sampleValue(report, 1, "tangentialRollAlignmentRateDegPerSec"),
      ),
    ).toBe(true);
    expect(
      Number.isFinite(
        sampleValue(report, 1, "projectedTangentBearingRateDegPerSec"),
      ),
    ).toBe(true);
    expect(
      Number.isFinite(
        sampleValue(report, 1, "tangentialDirectionRateDegPerSec"),
      ),
    ).toBe(true);
    expect(
      Number.isFinite(
        sampleValue(report, 1, "shipForwardDirectionRateDegPerSec"),
      ),
    ).toBe(true);
    expect(
      Number.isFinite(sampleValue(report, 1, "desiredAccelerationForwardDot")),
    ).toBe(true);
    expect(
      Number.isFinite(sampleValue(report, 1, "desiredAccelerationRightDot")),
    ).toBe(true);
    expect(
      Number.isFinite(sampleValue(report, 1, "desiredAccelerationUpDot")),
    ).toBe(true);
  });

  it("reports eccentricity threshold crossings relative to active start", () => {
    const script = createScript();
    const logger = createCircleNowLogger(script);
    const { ship, world } = createWorld();
    const controlInput = createControlInput(["circleNow"]);
    const circularSpeed = Math.sqrt(
      (parameters.newtonG * world.planetPhysics[0].mass) /
        vec3.length(ship.position),
    );
    ship.velocity.y = circularSpeed;

    logger.onPlaybackStart?.({
      controlInput,
      mainShip: ship,
      playbackElapsedMs: 0,
      script,
      simTimeMillis: 0,
      world,
    });

    logger.sampleAfterTick?.({
      controlInput,
      dtSimMillis: script.fixedDtMillis * script.timeScale,
      dtTickMillis: script.fixedDtMillis,
      mainShip: ship,
      playbackElapsedMs: 1000,
      script,
      simTimeMillis: 1000,
      world,
    });

    controlInput.circleNow = true;
    logger.sampleAfterTick?.({
      controlInput,
      dtSimMillis: script.fixedDtMillis * script.timeScale,
      dtTickMillis: script.fixedDtMillis,
      mainShip: ship,
      playbackElapsedMs: 2000,
      script,
      simTimeMillis: 2000,
      world,
    });

    const summary = logger.getReport().summary;

    expect(summary.activeStartPlaybackElapsedMs).toBe(2000);
    expect(summary.firstBelowEccentricity["0.001"]).toBe(2000);
    expect(summary.firstBelowEccentricityActiveMs["0.001"]).toBe(0);
  });

  it("emits exactly once at playback end", () => {
    const script = createScript();
    const logger = createCircleNowLogger(script);
    const controlInput = createControlInput(["circleNow"]);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logger.onPlaybackEnd?.({
      controlInput,
      playbackElapsedMs: 1000,
      script,
      simTimeMillis: 1000,
    });
    logger.onPlaybackEnd?.({
      controlInput,
      playbackElapsedMs: 1000,
      script,
      simTimeMillis: 1000,
    });

    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0][0])).toContain(
      "Solitude diagnostic log: circle-now moon-circle-test",
    );

    info.mockRestore();
  });

  it("handles missing primary without throwing", () => {
    const script = createScript();
    const logger = createCircleNowLogger(script);
    const controlInput = createControlInput(["circleNow"]);
    controlInput.circleNow = true;

    expect(() => {
      logger.sampleAfterTick?.({
        controlInput,
        dtSimMillis: script.fixedDtMillis * script.timeScale,
        dtTickMillis: script.fixedDtMillis,
        playbackElapsedMs: script.fixedDtMillis,
        script,
        simTimeMillis: 100,
        world: {
          ships: [],
          shipPhysics: [],
          planets: [],
          planetPhysics: [],
          stars: [],
          starPhysics: [],
        },
      });
    }).not.toThrow();

    const report = logger.getReport();
    expect(report.sampleCount).toBe(1);
    expect(report.summary.initialEccentricity).toBeNull();
    expect(sampleValue(report, 0, "tangentialForwardDot")).toBeNaN();
    expect(sampleValue(report, 0, "tangentialProjectionLength")).toBeNaN();
    expect(
      sampleValue(report, 0, "tangentialRollAlignmentRateDegPerSec"),
    ).toBeNaN();
    expect(
      sampleValue(report, 0, "projectedTangentBearingRateDegPerSec"),
    ).toBeNaN();
    expect(
      sampleValue(report, 0, "tangentialDirectionRateDegPerSec"),
    ).toBeNaN();
    expect(
      sampleValue(report, 0, "shipForwardDirectionRateDegPerSec"),
    ).toBeNaN();
    expect(sampleValue(report, 0, "desiredAccelerationForwardDot")).toBeNaN();
    expect(sampleValue(report, 0, "desiredAccelerationRightDot")).toBeNaN();
    expect(sampleValue(report, 0, "desiredAccelerationUpDot")).toBeNaN();
  });
});
