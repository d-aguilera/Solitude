import type {
  SnapshotMessage,
  SolitudeGameId,
} from "@solitude/protocol/protocol";
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
  snapshotEncodingBytesAvg: SnapshotEncodingByteLengths;
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
  encodingByteLengths: SnapshotEncodingByteLengths;
  gameId: SolitudeGameId;
  serializeDurationMillis: number;
}

export interface SnapshotEncodingByteLengths {
  current: number;
  omitAngularVelocity: number;
  omitFrame: number;
  quantized6: number;
  shortKeys: number;
  tuple: number;
}

interface TimedValue {
  timeMillis: number;
  value: number;
}

interface GameMetricWindows {
  entityCounts: TimedValue[];
  snapshotBroadcastBytes: TimedValue[];
  snapshotEncodingBytes: Record<
    keyof SnapshotEncodingByteLengths,
    TimedValue[]
  >;
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
        snapshotEncodingBytes: createSnapshotEncodingWindows(),
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
      pruneSnapshotEncodingWindows(
        windows.snapshotEncodingBytes,
        now,
        windowMillis,
      );
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
            snapshotEncodingBytesAvg: averageSnapshotEncodingWindows(
              windows.snapshotEncodingBytes,
            ),
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
      encodingByteLengths,
      gameId,
      serializeDurationMillis,
    }) => {
      const now = nowMillis();
      const windows = getWindows(gameId);
      pushSample(windows.snapshotBroadcastBytes, now, byteLength);
      pushSnapshotEncodingSample(
        windows.snapshotEncodingBytes,
        now,
        encodingByteLengths,
      );
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
      pruneSnapshotEncodingWindows(
        windows.snapshotEncodingBytes,
        now,
        windowMillis,
      );
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
        snapshotEncodingBytesAvg: createEmptySnapshotEncodingByteLengths(),
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

export function measureSnapshotEncodingByteLengths(
  snapshot: SnapshotMessage,
  currentByteLength: number,
): SnapshotEncodingByteLengths {
  return {
    current: currentByteLength,
    omitAngularVelocity: measureSnapshotEvent({
      ...snapshot,
      entities: snapshot.entities.map(
        ({ angularVelocity: _unused, ...entity }) => entity,
      ),
    }),
    omitFrame: measureSnapshotEvent({
      ...snapshot,
      entities: snapshot.entities.map(
        ({ frame: _unused, ...entity }) => entity,
      ),
    }),
    quantized6: measureSnapshotEvent(quantizeNumbers(snapshot, 6)),
    shortKeys: measureShortKeySnapshotEvent(snapshot),
    tuple: measureTupleSnapshotEvent(snapshot),
  };
}

function pushSample(
  samples: TimedValue[],
  timeMillis: number,
  value: number,
): void {
  samples.push({ timeMillis, value });
}

function pushSnapshotEncodingSample(
  samples: Record<keyof SnapshotEncodingByteLengths, TimedValue[]>,
  timeMillis: number,
  values: SnapshotEncodingByteLengths,
): void {
  for (const key of snapshotEncodingKeys) {
    pushSample(samples[key], timeMillis, values[key]);
  }
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

function pruneSnapshotEncodingWindows(
  samples: Record<keyof SnapshotEncodingByteLengths, TimedValue[]>,
  now: number,
  windowMillis: number,
): void {
  for (const key of snapshotEncodingKeys) {
    prune(samples[key], now, windowMillis);
  }
}

function average(samples: readonly TimedValue[]): number {
  if (samples.length === 0) return 0;
  return sum(samples) / samples.length;
}

function averageSnapshotEncodingWindows(
  samples: Record<keyof SnapshotEncodingByteLengths, TimedValue[]>,
): SnapshotEncodingByteLengths {
  return {
    current: average(samples.current),
    omitAngularVelocity: average(samples.omitAngularVelocity),
    omitFrame: average(samples.omitFrame),
    quantized6: average(samples.quantized6),
    shortKeys: average(samples.shortKeys),
    tuple: average(samples.tuple),
  };
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

const snapshotEncodingKeys = [
  "current",
  "omitAngularVelocity",
  "omitFrame",
  "quantized6",
  "shortKeys",
  "tuple",
] as const satisfies readonly (keyof SnapshotEncodingByteLengths)[];

function createSnapshotEncodingWindows(): Record<
  keyof SnapshotEncodingByteLengths,
  TimedValue[]
> {
  return {
    current: [],
    omitAngularVelocity: [],
    omitFrame: [],
    quantized6: [],
    shortKeys: [],
    tuple: [],
  };
}

function createEmptySnapshotEncodingByteLengths(): SnapshotEncodingByteLengths {
  return {
    current: 0,
    omitAngularVelocity: 0,
    omitFrame: 0,
    quantized6: 0,
    shortKeys: 0,
    tuple: 0,
  };
}

function measureSnapshotEvent(snapshot: unknown): number {
  return Buffer.byteLength(
    JSON.stringify({ message: snapshot, type: "serverMessage" }),
  );
}

function measureShortKeySnapshotEvent(snapshot: SnapshotMessage): number {
  return Buffer.byteLength(
    JSON.stringify({
      m: {
        e: snapshot.entities.map((entity) => ({
          a: entity.angularVelocity,
          f: entity.frame,
          i: entity.id,
          o: entity.orientation,
          p: entity.position,
          v: entity.velocity,
        })),
        g: snapshot.gameId,
        m: snapshot.modelVersion,
        q: snapshot.sequence,
        s: snapshot.simulationTimeMillis,
        t: snapshot.tick,
        y: "snapshot",
      },
      t: "serverMessage",
    }),
  );
}

function measureTupleSnapshotEvent(snapshot: SnapshotMessage): number {
  return Buffer.byteLength(
    JSON.stringify({
      m: [
        snapshot.gameId,
        snapshot.modelVersion,
        snapshot.sequence,
        snapshot.simulationTimeMillis,
        snapshot.tick,
        snapshot.entities.map((entity) => [
          entity.id,
          vectorTuple(entity.position),
          vectorTuple(entity.velocity),
          entity.orientation.flat(),
          entity.frame
            ? [
                ...vectorTuple(entity.frame.forward),
                ...vectorTuple(entity.frame.right),
                ...vectorTuple(entity.frame.up),
              ]
            : null,
          entity.angularVelocity
            ? [
                entity.angularVelocity.pitch,
                entity.angularVelocity.roll,
                entity.angularVelocity.yaw,
              ]
            : null,
        ]),
      ],
      t: "s",
    }),
  );
}

function vectorTuple(vector: { x: number; y: number; z: number }): number[] {
  return [vector.x, vector.y, vector.z];
}

function quantizeNumbers(value: unknown, decimals: number): unknown {
  if (typeof value === "number") return quantizeNumber(value, decimals);
  if (Array.isArray(value))
    return value.map((item) => quantizeNumbers(item, decimals));
  if (value && typeof value === "object") {
    const record: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      record[key] = quantizeNumbers(item, decimals);
    }
    return record;
  }
  return value;
}

function quantizeNumber(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
