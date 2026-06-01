import type { SolitudeGameId } from "@solitude/protocol/protocol";
import type { SolitudeRunningGameSummary } from "./runner";

export interface SolitudeServerMetrics {
  createReport: (
    options: SolitudeServerMetricsReportOptions,
  ) => SolitudeServerMetricsReport;
  recordSnapshotBroadcast: (sample: SnapshotBroadcastSample) => void;
  recordSnapshotStep: (sample: SnapshotStepSample) => void;
}

export interface SolitudeServerMetricsOptions {
  nowMillis: () => number;
  windowMillis: number;
}

export interface SolitudeServerMetricsReportOptions {
  connectedSockets: number;
  games: readonly SolitudeRunningGameSummary[];
  getClientCount: (gameId: SolitudeGameId) => number;
}

export interface SolitudeServerMetricsReport {
  games: SolitudeGameMetricsReport[];
  process: {
    heapUsedBytes: number;
    rssBytes: number;
  };
  sockets: {
    connected: number;
  };
  windowMillis: number;
}

export interface SolitudeGameMetricsReport {
  clients: number;
  entityCountAvg: number;
  gameId: SolitudeGameId;
  running: boolean;
  snapshotPayloadBytesAvg: number;
  snapshotRateHz: number;
  snapshotSerializeDurationMillisAvg: number;
  snapshotSerializeDurationMillisP95: number;
  snapshotStepDurationMillisAvg: number;
  snapshotStepDurationMillisP95: number;
  snapshotWireBytesPerSecond: number;
  tick: number;
}

interface SnapshotStepSample {
  durationMillis: number;
  entityCount: number;
  gameId: SolitudeGameId;
}

interface SnapshotBroadcastSample {
  byteLength: number;
  clientCount: number;
  gameId: SolitudeGameId;
  serializeDurationMillis: number;
}

interface TimedValue {
  timeMillis: number;
  value: number;
}

interface GameMetricWindows {
  entityCounts: TimedValue[];
  snapshotBroadcastBytes: TimedValue[];
  snapshotBroadcastSerializeDurations: TimedValue[];
  snapshotBroadcastWireBytes: TimedValue[];
  snapshotStepDurations: TimedValue[];
}

export const DEFAULT_SOLITUDE_METRICS_WINDOW_MILLIS = 5000;

export function createSolitudeServerMetrics({
  nowMillis,
  windowMillis,
}: SolitudeServerMetricsOptions): SolitudeServerMetrics {
  const windowsByGameId = new Map<SolitudeGameId, GameMetricWindows>();

  const getWindows = (gameId: SolitudeGameId): GameMetricWindows => {
    let windows = windowsByGameId.get(gameId);
    if (!windows) {
      windows = {
        entityCounts: [],
        snapshotBroadcastBytes: [],
        snapshotBroadcastSerializeDurations: [],
        snapshotBroadcastWireBytes: [],
        snapshotStepDurations: [],
      };
      windowsByGameId.set(gameId, windows);
    }
    return windows;
  };

  const pruneAll = (now: number): void => {
    for (const windows of windowsByGameId.values()) {
      prune(windows.entityCounts, now, windowMillis);
      prune(windows.snapshotBroadcastBytes, now, windowMillis);
      prune(windows.snapshotBroadcastSerializeDurations, now, windowMillis);
      prune(windows.snapshotBroadcastWireBytes, now, windowMillis);
      prune(windows.snapshotStepDurations, now, windowMillis);
    }
  };

  return {
    createReport: ({ connectedSockets, games, getClientCount }) => {
      const now = nowMillis();
      pruneAll(now);
      const memory = process.memoryUsage();
      return {
        games: games.map((game) => {
          const windows = getWindows(game.gameId);
          return {
            clients: getClientCount(game.gameId),
            entityCountAvg: average(windows.entityCounts),
            gameId: game.gameId,
            running: game.running,
            snapshotPayloadBytesAvg: average(windows.snapshotBroadcastBytes),
            snapshotRateHz:
              (windows.snapshotBroadcastBytes.length * 1000) / windowMillis,
            snapshotSerializeDurationMillisAvg: average(
              windows.snapshotBroadcastSerializeDurations,
            ),
            snapshotSerializeDurationMillisP95: percentile(
              windows.snapshotBroadcastSerializeDurations,
              0.95,
            ),
            snapshotStepDurationMillisAvg: average(
              windows.snapshotStepDurations,
            ),
            snapshotStepDurationMillisP95: percentile(
              windows.snapshotStepDurations,
              0.95,
            ),
            snapshotWireBytesPerSecond:
              (sum(windows.snapshotBroadcastWireBytes) * 1000) / windowMillis,
            tick: game.tick,
          };
        }),
        process: {
          heapUsedBytes: memory.heapUsed,
          rssBytes: memory.rss,
        },
        sockets: {
          connected: connectedSockets,
        },
        windowMillis,
      };
    },
    recordSnapshotBroadcast: ({
      byteLength,
      clientCount,
      gameId,
      serializeDurationMillis,
    }) => {
      const now = nowMillis();
      const windows = getWindows(gameId);
      pushSample(windows.snapshotBroadcastBytes, now, byteLength);
      pushSample(
        windows.snapshotBroadcastSerializeDurations,
        now,
        serializeDurationMillis,
      );
      pushSample(
        windows.snapshotBroadcastWireBytes,
        now,
        byteLength * clientCount,
      );
      prune(windows.snapshotBroadcastBytes, now, windowMillis);
      prune(windows.snapshotBroadcastSerializeDurations, now, windowMillis);
      prune(windows.snapshotBroadcastWireBytes, now, windowMillis);
    },
    recordSnapshotStep: ({ durationMillis, entityCount, gameId }) => {
      const now = nowMillis();
      const windows = getWindows(gameId);
      pushSample(windows.entityCounts, now, entityCount);
      pushSample(windows.snapshotStepDurations, now, durationMillis);
      prune(windows.entityCounts, now, windowMillis);
      prune(windows.snapshotStepDurations, now, windowMillis);
    },
  };
}

export function createNoopSolitudeServerMetrics(): SolitudeServerMetrics {
  return {
    createReport: ({ connectedSockets, games, getClientCount }) => ({
      games: games.map((game) => ({
        clients: getClientCount(game.gameId),
        entityCountAvg: 0,
        gameId: game.gameId,
        running: game.running,
        snapshotPayloadBytesAvg: 0,
        snapshotRateHz: 0,
        snapshotSerializeDurationMillisAvg: 0,
        snapshotSerializeDurationMillisP95: 0,
        snapshotStepDurationMillisAvg: 0,
        snapshotStepDurationMillisP95: 0,
        snapshotWireBytesPerSecond: 0,
        tick: game.tick,
      })),
      process: {
        heapUsedBytes: 0,
        rssBytes: 0,
      },
      sockets: {
        connected: connectedSockets,
      },
      windowMillis: 0,
    }),
    recordSnapshotBroadcast: () => {},
    recordSnapshotStep: () => {},
  };
}

function pushSample(
  samples: TimedValue[],
  timeMillis: number,
  value: number,
): void {
  samples.push({ timeMillis, value });
}

function prune(samples: TimedValue[], now: number, windowMillis: number): void {
  const oldestTimeMillis = now - windowMillis;
  let readIndex = 0;
  while (
    readIndex < samples.length &&
    samples[readIndex].timeMillis < oldestTimeMillis
  ) {
    readIndex++;
  }
  if (readIndex > 0) samples.splice(0, readIndex);
}

function average(samples: readonly TimedValue[]): number {
  if (samples.length === 0) return 0;
  return sum(samples) / samples.length;
}

function sum(samples: readonly TimedValue[]): number {
  let total = 0;
  for (const sample of samples) total += sample.value;
  return total;
}

function percentile(
  samples: readonly TimedValue[],
  percentileRank: number,
): number {
  if (samples.length === 0) return 0;
  const values = samples.map((sample) => sample.value).sort((a, b) => a - b);
  const index = Math.min(
    values.length - 1,
    Math.ceil(values.length * percentileRank) - 1,
  );
  return values[index];
}
