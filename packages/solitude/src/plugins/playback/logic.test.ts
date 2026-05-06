import { createControlInput } from "@solitude/engine/app/controlPorts";
import { describe, expect, it } from "vitest";
import {
  applyCompiledPhaseControls,
  compilePlaybackScript,
  phaseForScriptTime,
} from "./logic";
import type { PlaybackScript } from "./types";

function createScript(): PlaybackScript {
  return {
    id: "moon-circle",
    snapshot: {
      metadata: {
        label: "moon-circle",
        capturedSimTimeMillis: 0,
        dominantBodyId: null,
        focusEntityId: "ship:test",
      },
      entities: [],
    },
    fixedDtMillis: 1000 / 60,
    timeScale: 32,
    endBehavior: "pause",
    metadata: {
      capturedSimTimeMillis: 0,
      recordingStartedRuntimeMs: 10,
      recordingEndedRuntimeMs: 30,
    },
    phases: [
      { durationMs: 1000, controls: {} },
      { durationMs: 2000, controls: { circleNow: true, thrustLevel: 4 } },
    ],
  };
}

describe("playback script logic", () => {
  it("compiles duration-only phases to cumulative ends", () => {
    const compiled = compilePlaybackScript(createScript());

    expect(compiled.phases.map((phase) => phase.endMs)).toEqual([1000, 3000]);
    expect(compiled.totalDurationMs).toBe(3000);
    expect(compiled.phases[1].trueActions).toEqual(["circleNow"]);
    expect(compiled.phases[1].thrustLevel).toBe(4);
  });

  it("advances phase lookup from a cursor", () => {
    const compiled = compilePlaybackScript(createScript());

    const first = phaseForScriptTime(compiled, 999, 0);
    const second = phaseForScriptTime(compiled, 1000, first);

    expect(first).toBe(0);
    expect(second).toBe(1);
  });

  it("clears and applies playback controls", () => {
    const compiled = compilePlaybackScript(createScript());
    const controlInput = createControlInput(["circleNow"]);
    controlInput.burnForward = true;

    applyCompiledPhaseControls(controlInput, compiled.phases[1]);

    expect(controlInput.burnForward).toBe(false);
    expect(controlInput.circleNow).toBe(true);
  });
});
