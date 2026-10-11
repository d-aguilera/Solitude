/** Opt-in investigation of frame gaps; the normal loop does not read this clock. */
export interface CompletedFrameTiming {
  nowMs: number;
  dtMillis: number;
  callbackStartMs: number;
  callbackEndMs: number;
  advanceSim: boolean;
  advanceScene: boolean;
  presentationMillis: number;
  pipelineMillis: number;
  renderMillis: number;
  rasterizeMillis: number;
  overlayMillis: number;
  afterFrameMillis: number;
}

export interface FrameGapTiming {
  nowMs: number;
  dtMillis: number;
  callbackDelayMillis: number;
  outsideCallbackMillis: number | null;
  previousFrames: CompletedFrameTiming[];
}

type Stage =
  | "presentationMillis"
  | "pipelineMillis"
  | "renderMillis"
  | "rasterizeMillis"
  | "overlayMillis"
  | "afterFrameMillis";

export function createFrameTiming(
  clock: () => number,
  report: (gap: FrameGapTiming) => void,
) {
  const frames: CompletedFrameTiming[] = Array.from({ length: 6 }, () => ({
    nowMs: 0,
    dtMillis: 0,
    callbackStartMs: 0,
    callbackEndMs: 0,
    advanceSim: false,
    advanceScene: false,
    presentationMillis: 0,
    pipelineMillis: 0,
    renderMillis: 0,
    rasterizeMillis: 0,
    overlayMillis: 0,
    afterFrameMillis: 0,
  }));
  let next = 0;
  let count = 0;
  let stageStart = 0;
  let current = frames[0];
  return {
    begin: (nowMs: number, dtMillis: number) => {
      const started = clock();
      if (dtMillis > 250) {
        const previousFrames: CompletedFrameTiming[] = [];
        for (let i = 0; i < count; i++)
          previousFrames.push({
            ...frames[(next - count + i + frames.length) % frames.length],
          });
        report({
          nowMs,
          dtMillis,
          callbackDelayMillis: started - nowMs,
          outsideCallbackMillis: count
            ? started - previousFrames[count - 1].callbackEndMs
            : null,
          previousFrames,
        });
      }
      current = frames[next];
      current.nowMs = nowMs;
      current.dtMillis = dtMillis;
      current.callbackStartMs = started;
      stageStart = started;
    },
    stage: (stage: Stage) => {
      const ended = clock();
      current[stage] = ended - stageStart;
      stageStart = ended;
    },
    policy: (advanceSim: boolean, advanceScene: boolean) => {
      current.advanceSim = advanceSim;
      current.advanceScene = advanceScene;
    },
    end: () => {
      current.callbackEndMs = stageStart;
      next = (next + 1) % frames.length;
      count = Math.min(count + 1, frames.length);
    },
  };
}
