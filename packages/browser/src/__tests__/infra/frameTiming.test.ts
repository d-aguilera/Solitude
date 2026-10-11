import { describe, expect, it, vi } from "vitest";
import { createFrameTiming } from "../../infra/frameTiming";

describe("opt-in frame-gap timing", () => {
  function fixture() {
    let time = 0;
    const report = vi.fn();
    const timing = createFrameTiming(() => time, report);
    const frame = (
      now: number,
      dt: number,
      pipeline: number,
      render: number,
      advance: boolean,
    ) => {
      time = now;
      timing.begin(now, dt, now);
      time += 1;
      timing.stage("presentationMillis");
      time += pipeline;
      timing.stage("pipelineMillis");
      timing.policy(advance, advance);
      time += render;
      timing.stage("renderMillis");
      time += 2;
      timing.stage("rasterizeMillis");
      time += 3;
      timing.stage("overlayMillis");
      time += 4;
      timing.stage("afterFrameMillis");
      timing.end();
    };
    return { timing, report, frame, setTime: (now: number) => (time = now) };
  }

  it.each(["pipelineMillis", "renderMillis"] as const)(
    "identifies a stalled completed frame in %s without changing frame time or policy",
    (stage) => {
      const f = fixture();
      f.frame(
        0,
        16,
        stage === "pipelineMillis" ? 450 : 1,
        stage === "renderMillis" ? 450 : 1,
        true,
      );
      f.frame(466.6, 466.6, 1, 1, false);
      const gap = f.report.mock.calls[0][0];
      expect(gap).toMatchObject({
        nowMs: 466.6,
        dtMillis: 466.6,
        callbackDelayMillis: 0,
        previousFrames: [
          {
            nowMs: 0,
            advanceSim: true,
            advanceScene: true,
            [stage]: 450,
            callbackStartMs: 0,
            callbackEndMs: 461,
          },
        ],
      });
      expect(gap.outsideCallbackMillis).toBeCloseTo(5.6);
    },
  );

  it("distinguishes a delay outside completed callbacks from slow game work", () => {
    const f = fixture();
    f.frame(0, 16, 1, 1, false);
    f.setTime(510);
    f.timing.begin(500, 500, 500);
    expect(f.report.mock.calls[0][0]).toMatchObject({
      callbackDelayMillis: 10,
      outsideCallbackMillis: 498,
      previousFrames: [{ callbackEndMs: 12, advanceSim: false }],
    });
  });
  it("retains the supplied timestamp separately from actual callback time", () => {
    const f = fixture();
    f.frame(0, 16, 1, 1, false);
    f.setTime(510);
    f.timing.begin(500, 500, 16);
    expect(f.report.mock.calls[0][0]).toMatchObject({
      nowMs: 500,
      dtMillis: 500,
      animationFrameTimeMs: 16,
      callbackDelayMillis: 494,
      outsideCallbackMillis: 498,
    });
  });

  it("keeps six ordered completed frames and independent gap snapshots across reuse", () => {
    const f = fixture();
    for (let i = 0; i < 10; i++) f.frame(i * 16, 16, 1, 1, false);
    f.frame(644, 500, 1, 1, false);
    const first = f.report.mock.calls[0][0];
    expect(
      first.previousFrames.map((frame: { nowMs: number }) => frame.nowMs),
    ).toEqual([64, 80, 96, 112, 128, 144]);
    for (let i = 1; i <= 10; i++) f.frame(644 + i * 16, 16, 1, 1, true);
    f.frame(1304, 500, 1, 1, false);
    expect(f.report).toHaveBeenCalledTimes(2);
    expect(
      first.previousFrames.map((frame: { nowMs: number }) => frame.nowMs),
    ).toEqual([64, 80, 96, 112, 128, 144]);
    expect(
      first.previousFrames.every(
        (frame: { advanceSim: boolean }) => !frame.advanceSim,
      ),
    ).toBe(true);
  });
});
