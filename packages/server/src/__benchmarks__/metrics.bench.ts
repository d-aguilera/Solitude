import { bench, describe } from "vitest";
import {
  createSolitudeServerMetrics,
  type SolitudeEventLoopDelayMonitor,
} from "../metrics";

const windowMillis = 5000;
let nowMillis = 0;
const productionMetrics = createSolitudeServerMetrics({
  cpuUsage: () => ({ system: 0, user: 0 }),
  eventLoopDelayMonitor: createNoopEventLoopDelayMonitor(),
  memoryUsage: () => ({
    arrayBuffers: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0,
    rss: 0,
  }),
  nowMillis: () => nowMillis,
  windowMillis,
});
const legacyMetrics = createLegacyTimedObjectMetrics();

describe("server metric hot-path recording", () => {
  bench("legacy timed-object rolling arrays", () => {
    nowMillis += 1000 / 60;
    legacyMetrics.record(nowMillis, 0.25, 6500, 8);
  });

  bench("production rotating typed-array windows", () => {
    nowMillis += 1000 / 60;
    productionMetrics.recordSnapshotStep({
      durationMillis: 0.25,
      entityCount: 20,
      gameId: "game:1",
    });
    productionMetrics.recordSnapshotBroadcast({
      byteLength: 6500,
      clientCount: 8,
      gameId: "game:1",
      serializeDurationMillis: 0.1,
    });
  });
});

function createLegacyTimedObjectMetrics() {
  const stepSamples: Array<{ timeMillis: number; value: number }> = [];
  const payloadSamples: Array<{ timeMillis: number; value: number }> = [];
  const wireSamples: Array<{ timeMillis: number; value: number }> = [];

  return {
    record: (
      sampleTimeMillis: number,
      stepDurationMillis: number,
      payloadBytes: number,
      clients: number,
    ) => {
      stepSamples.push({
        timeMillis: sampleTimeMillis,
        value: stepDurationMillis,
      });
      payloadSamples.push({
        timeMillis: sampleTimeMillis,
        value: payloadBytes,
      });
      wireSamples.push({
        timeMillis: sampleTimeMillis,
        value: payloadBytes * clients,
      });
      prune(stepSamples, sampleTimeMillis);
      prune(payloadSamples, sampleTimeMillis);
      prune(wireSamples, sampleTimeMillis);
    },
  };
}

function prune(
  samples: Array<{ timeMillis: number; value: number }>,
  sampleTimeMillis: number,
): void {
  const oldestTimeMillis = sampleTimeMillis - windowMillis;
  let readIndex = 0;
  while (
    readIndex < samples.length &&
    samples[readIndex].timeMillis < oldestTimeMillis
  ) {
    readIndex++;
  }
  if (readIndex > 0) samples.splice(0, readIndex);
}

function createNoopEventLoopDelayMonitor(): SolitudeEventLoopDelayMonitor {
  return {
    disable: () => {},
    enable: () => {},
    max: 0,
    mean: 0,
    percentile: () => 0,
    reset: () => {},
  };
}
