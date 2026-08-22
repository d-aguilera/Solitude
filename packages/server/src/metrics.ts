import type { SolitudeGameId } from "@solitude/protocol/protocol";
import { monitorEventLoopDelay } from "node:perf_hooks";
import type { SolitudeRunningGameSummary } from "./runner";

export interface SolitudeServerMetrics {
  close: () => void;
  createReport: (
    options: SolitudeServerMetricsReportOptions,
  ) => SolitudeServerMetricsReport;
  recordSnapshotBroadcast: (sample: SnapshotBroadcastSample) => void;
  recordSnapshotStep: (sample: SnapshotStepSample) => void;
}

export interface SolitudeServerMetricsOptions {
  cpuUsage?: () => SolitudeProcessCpuUsage;
  eventLoopDelayMonitor?: SolitudeEventLoopDelayMonitor;
  memoryUsage?: () => SolitudeProcessMemoryUsage;
  nowMillis: () => number;
  windowMillis: number;
}

export interface SolitudeEventLoopDelayMonitor {
  readonly max: number;
  readonly mean: number;
  disable: () => void;
  enable: () => void;
  percentile: (percentile: number) => number;
  reset: () => void;
}

export interface SolitudeProcessCpuUsage {
  system: number;
  user: number;
}

export interface SolitudeProcessMemoryUsage {
  arrayBuffers: number;
  external: number;
  heapTotal: number;
  heapUsed: number;
  rss: number;
}

export interface SolitudeServerMetricsReportOptions {
  connectedSockets: number;
  games: readonly SolitudeRunningGameSummary[];
  getClientCount: (gameId: SolitudeGameId) => number;
}

export interface SolitudeServerMetricsReport {
  eventLoop: SolitudeDurationMetricsReport;
  games: SolitudeGameMetricsReport[];
  process: {
    arrayBuffersBytes: number;
    cpuSystemMillis: number;
    cpuTotalMillis: number;
    cpuUserMillis: number;
    cpuUtilizationPercent: number;
    cpuWindowMillis: number;
    externalBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    rssBytes: number;
  };
  sockets: {
    connected: number;
  };
  windowMillis: number;
}

export interface SolitudeDurationMetricsReport {
  avg: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface SolitudeGameMetricsReport {
  clients: number;
  entityCountAvg: number;
  gameId: SolitudeGameId;
  running: boolean;
  snapshotPayloadBytesAvg: number;
  snapshotRateHz: number;
  snapshotSerializeDurationMillisAvg: number;
  snapshotSerializeDurationMillisMax: number;
  snapshotSerializeDurationMillisP50: number;
  snapshotSerializeDurationMillisP95: number;
  snapshotSerializeDurationMillisP99: number;
  snapshotStepDurationMillisAvg: number;
  snapshotStepDurationMillisMax: number;
  snapshotStepDurationMillisP50: number;
  snapshotStepDurationMillisP95: number;
  snapshotStepDurationMillisP99: number;
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

interface GameMetricWindows {
  entityCounts: RollingScalarWindow;
  snapshotBroadcastBytes: RollingScalarWindow;
  snapshotBroadcastSerializeDurations: RollingDurationWindow;
  snapshotBroadcastWireBytes: RollingScalarWindow;
  snapshotStepDurations: RollingDurationWindow;
}

interface ScalarSummary {
  count: number;
  max: number;
  sum: number;
}

interface DurationSummary extends ScalarSummary {
  p50: number;
  p95: number;
  p99: number;
}

const ROLLING_WINDOW_SLICE_COUNT = 10;
const DURATION_BUCKET_COUNT = 2022;
const EVENT_LOOP_DELAY_RESOLUTION_MILLIS = 10;
const NANOSECONDS_PER_MILLISECOND = 1_000_000;
const MICROSECONDS_PER_MILLISECOND = 1000;

export const DEFAULT_SOLITUDE_METRICS_WINDOW_MILLIS = 5000;

export function createSolitudeServerMetrics({
  cpuUsage = process.cpuUsage,
  eventLoopDelayMonitor = monitorEventLoopDelay({
    resolution: EVENT_LOOP_DELAY_RESOLUTION_MILLIS,
  }),
  memoryUsage = process.memoryUsage,
  nowMillis,
  windowMillis,
}: SolitudeServerMetricsOptions): SolitudeServerMetrics {
  if (!Number.isFinite(windowMillis) || windowMillis <= 0) {
    throw new Error("Metrics window must be a positive finite number");
  }

  const windowsByGameId = new Map<SolitudeGameId, GameMetricWindows>();
  let previousCpuUsage = cpuUsage();
  let previousCpuTimeMillis = nowMillis();
  eventLoopDelayMonitor.enable();

  const getWindows = (gameId: SolitudeGameId): GameMetricWindows => {
    let windows = windowsByGameId.get(gameId);
    if (!windows) {
      windows = {
        entityCounts: new RollingScalarWindow(windowMillis),
        snapshotBroadcastBytes: new RollingScalarWindow(windowMillis),
        snapshotBroadcastSerializeDurations: new RollingDurationWindow(
          windowMillis,
        ),
        snapshotBroadcastWireBytes: new RollingScalarWindow(windowMillis),
        snapshotStepDurations: new RollingDurationWindow(windowMillis),
      };
      windowsByGameId.set(gameId, windows);
    }
    return windows;
  };

  return {
    close: () => {
      eventLoopDelayMonitor.disable();
    },
    createReport: ({ connectedSockets, games, getClientCount }) => {
      const now = nowMillis();
      const memory = memoryUsage();
      const currentCpuUsage = cpuUsage();
      const cpuWindowMillis = Math.max(0, now - previousCpuTimeMillis);
      const cpuUserMillis = Math.max(
        0,
        (currentCpuUsage.user - previousCpuUsage.user) /
          MICROSECONDS_PER_MILLISECOND,
      );
      const cpuSystemMillis = Math.max(
        0,
        (currentCpuUsage.system - previousCpuUsage.system) /
          MICROSECONDS_PER_MILLISECOND,
      );
      const cpuTotalMillis = cpuUserMillis + cpuSystemMillis;
      previousCpuUsage = currentCpuUsage;
      previousCpuTimeMillis = now;

      const eventLoop = readEventLoopDelay(eventLoopDelayMonitor);
      eventLoopDelayMonitor.reset();

      return {
        eventLoop,
        games: games.map((game) => {
          const windows = getWindows(game.gameId);
          const payloadBytes = windows.snapshotBroadcastBytes.read(now);
          const serializeDuration =
            windows.snapshotBroadcastSerializeDurations.read(now);
          const stepDuration = windows.snapshotStepDurations.read(now);
          const wireBytes = windows.snapshotBroadcastWireBytes.read(now);
          return {
            clients: getClientCount(game.gameId),
            entityCountAvg: getAverage(windows.entityCounts.read(now)),
            gameId: game.gameId,
            running: game.running,
            snapshotPayloadBytesAvg: getAverage(payloadBytes),
            snapshotRateHz: (payloadBytes.count * 1000) / windowMillis,
            snapshotSerializeDurationMillisAvg: getAverage(serializeDuration),
            snapshotSerializeDurationMillisMax: serializeDuration.max,
            snapshotSerializeDurationMillisP50: serializeDuration.p50,
            snapshotSerializeDurationMillisP95: serializeDuration.p95,
            snapshotSerializeDurationMillisP99: serializeDuration.p99,
            snapshotStepDurationMillisAvg: getAverage(stepDuration),
            snapshotStepDurationMillisMax: stepDuration.max,
            snapshotStepDurationMillisP50: stepDuration.p50,
            snapshotStepDurationMillisP95: stepDuration.p95,
            snapshotStepDurationMillisP99: stepDuration.p99,
            snapshotWireBytesPerSecond: (wireBytes.sum * 1000) / windowMillis,
            tick: game.tick,
          };
        }),
        process: {
          arrayBuffersBytes: memory.arrayBuffers,
          cpuSystemMillis,
          cpuTotalMillis,
          cpuUserMillis,
          cpuUtilizationPercent:
            cpuWindowMillis > 0 ? (cpuTotalMillis * 100) / cpuWindowMillis : 0,
          cpuWindowMillis,
          externalBytes: memory.external,
          heapTotalBytes: memory.heapTotal,
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
      windows.snapshotBroadcastBytes.record(now, byteLength);
      windows.snapshotBroadcastSerializeDurations.record(
        now,
        serializeDurationMillis,
      );
      windows.snapshotBroadcastWireBytes.record(now, byteLength * clientCount);
    },
    recordSnapshotStep: ({ durationMillis, entityCount, gameId }) => {
      const now = nowMillis();
      const windows = getWindows(gameId);
      windows.entityCounts.record(now, entityCount);
      windows.snapshotStepDurations.record(now, durationMillis);
    },
  };
}

export function createNoopSolitudeServerMetrics(): SolitudeServerMetrics {
  return {
    close: () => {},
    createReport: ({ connectedSockets, games, getClientCount }) => ({
      eventLoop: createEmptyDurationReport(),
      games: games.map((game) => ({
        clients: getClientCount(game.gameId),
        entityCountAvg: 0,
        gameId: game.gameId,
        running: game.running,
        snapshotPayloadBytesAvg: 0,
        snapshotRateHz: 0,
        snapshotSerializeDurationMillisAvg: 0,
        snapshotSerializeDurationMillisMax: 0,
        snapshotSerializeDurationMillisP50: 0,
        snapshotSerializeDurationMillisP95: 0,
        snapshotSerializeDurationMillisP99: 0,
        snapshotStepDurationMillisAvg: 0,
        snapshotStepDurationMillisMax: 0,
        snapshotStepDurationMillisP50: 0,
        snapshotStepDurationMillisP95: 0,
        snapshotStepDurationMillisP99: 0,
        snapshotWireBytesPerSecond: 0,
        tick: game.tick,
      })),
      process: {
        arrayBuffersBytes: 0,
        cpuSystemMillis: 0,
        cpuTotalMillis: 0,
        cpuUserMillis: 0,
        cpuUtilizationPercent: 0,
        cpuWindowMillis: 0,
        externalBytes: 0,
        heapTotalBytes: 0,
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

class RollingScalarWindow {
  protected readonly counts: Float64Array;
  protected readonly epochs: Float64Array;
  protected readonly maxima: Float64Array;
  protected readonly slotCount = ROLLING_WINDOW_SLICE_COUNT + 1;
  protected readonly sliceMillis: number;
  protected readonly sums: Float64Array;

  constructor(windowMillis: number) {
    this.sliceMillis = windowMillis / ROLLING_WINDOW_SLICE_COUNT;
    this.counts = new Float64Array(this.slotCount);
    this.epochs = new Float64Array(this.slotCount);
    this.epochs.fill(Number.NaN);
    this.maxima = new Float64Array(this.slotCount);
    this.sums = new Float64Array(this.slotCount);
  }

  record(nowMillis: number, value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    const epoch = this.getEpoch(nowMillis);
    const slot = this.prepareSlot(epoch);
    this.counts[slot]++;
    this.sums[slot] += value;
    if (value > this.maxima[slot]) this.maxima[slot] = value;
  }

  read(nowMillis: number): ScalarSummary {
    const currentEpoch = this.getEpoch(nowMillis);
    const oldestEpoch = currentEpoch - ROLLING_WINDOW_SLICE_COUNT;
    let count = 0;
    let max = 0;
    let sum = 0;
    for (let slot = 0; slot < this.slotCount; slot++) {
      const epoch = this.epochs[slot];
      if (epoch < oldestEpoch || epoch > currentEpoch) continue;
      count += this.counts[slot];
      sum += this.sums[slot];
      if (this.maxima[slot] > max) max = this.maxima[slot];
    }
    return { count, max, sum };
  }

  protected clearSlot(slot: number): void {
    this.counts[slot] = 0;
    this.maxima[slot] = 0;
    this.sums[slot] = 0;
  }

  protected getEpoch(nowMillis: number): number {
    return Math.floor(nowMillis / this.sliceMillis);
  }

  protected prepareSlot(epoch: number): number {
    const slot = positiveModulo(epoch, this.slotCount);
    if (this.epochs[slot] !== epoch) {
      this.clearSlot(slot);
      this.epochs[slot] = epoch;
    }
    return slot;
  }
}

class RollingDurationWindow extends RollingScalarWindow {
  private readonly bucketCounts = new Uint32Array(
    this.slotCount * DURATION_BUCKET_COUNT,
  );
  private readonly mergedBucketCounts = new Uint32Array(DURATION_BUCKET_COUNT);

  override record(nowMillis: number, value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    const epoch = this.getEpoch(nowMillis);
    const slot = this.prepareSlot(epoch);
    this.counts[slot]++;
    this.sums[slot] += value;
    if (value > this.maxima[slot]) this.maxima[slot] = value;
    const bucket = getDurationBucket(value);
    this.bucketCounts[slot * DURATION_BUCKET_COUNT + bucket]++;
  }

  override read(nowMillis: number): DurationSummary {
    const summary = super.read(nowMillis);
    if (summary.count === 0) {
      return { ...summary, p50: 0, p95: 0, p99: 0 };
    }

    this.mergedBucketCounts.fill(0);
    const currentEpoch = this.getEpoch(nowMillis);
    const oldestEpoch = currentEpoch - ROLLING_WINDOW_SLICE_COUNT;
    for (let slot = 0; slot < this.slotCount; slot++) {
      const epoch = this.epochs[slot];
      if (epoch < oldestEpoch || epoch > currentEpoch) continue;
      const offset = slot * DURATION_BUCKET_COUNT;
      for (let bucket = 0; bucket < DURATION_BUCKET_COUNT; bucket++) {
        this.mergedBucketCounts[bucket] += this.bucketCounts[offset + bucket];
      }
    }

    return {
      ...summary,
      p50: readDurationPercentile(
        this.mergedBucketCounts,
        summary.count,
        0.5,
        summary.max,
      ),
      p95: readDurationPercentile(
        this.mergedBucketCounts,
        summary.count,
        0.95,
        summary.max,
      ),
      p99: readDurationPercentile(
        this.mergedBucketCounts,
        summary.count,
        0.99,
        summary.max,
      ),
    };
  }

  protected override clearSlot(slot: number): void {
    super.clearSlot(slot);
    this.bucketCounts.fill(
      0,
      slot * DURATION_BUCKET_COUNT,
      (slot + 1) * DURATION_BUCKET_COUNT,
    );
  }
}

function getAverage(summary: ScalarSummary): number {
  return summary.count > 0 ? summary.sum / summary.count : 0;
}

function createEmptyDurationReport(): SolitudeDurationMetricsReport {
  return { avg: 0, max: 0, p50: 0, p95: 0, p99: 0 };
}

function readEventLoopDelay(
  monitor: SolitudeEventLoopDelayMonitor,
): SolitudeDurationMetricsReport {
  const mean = nanosecondsToMillis(monitor.mean);
  return {
    avg: Number.isFinite(mean) ? mean : 0,
    max: nanosecondsToMillis(monitor.max),
    p50: nanosecondsToMillis(monitor.percentile(50)),
    p95: nanosecondsToMillis(monitor.percentile(95)),
    p99: nanosecondsToMillis(monitor.percentile(99)),
  };
}

function nanosecondsToMillis(nanoseconds: number): number {
  return Math.max(0, nanoseconds / NANOSECONDS_PER_MILLISECOND);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function getDurationBucket(durationMillis: number): number {
  if (durationMillis <= 5) return Math.ceil(durationMillis * 100);
  if (durationMillis <= 20) {
    return 500 + Math.ceil((durationMillis - 5) * 20);
  }
  if (durationMillis <= 100) {
    return 800 + Math.ceil((durationMillis - 20) * 4);
  }
  if (durationMillis <= 1000) {
    return 1120 + Math.ceil((durationMillis - 100) / 2);
  }
  if (durationMillis <= 10_000) {
    return 1570 + Math.ceil((durationMillis - 1000) / 20);
  }
  return DURATION_BUCKET_COUNT - 1;
}

function getDurationBucketUpperBound(bucket: number): number {
  if (bucket <= 500) return bucket / 100;
  if (bucket <= 800) return 5 + (bucket - 500) / 20;
  if (bucket <= 1120) return 20 + (bucket - 800) / 4;
  if (bucket <= 1570) return 100 + (bucket - 1120) * 2;
  return 1000 + (bucket - 1570) * 20;
}

function readDurationPercentile(
  bucketCounts: Uint32Array,
  sampleCount: number,
  percentile: number,
  max: number,
): number {
  const targetCount = Math.ceil(sampleCount * percentile);
  let cumulativeCount = 0;
  for (let bucket = 0; bucket < bucketCounts.length; bucket++) {
    cumulativeCount += bucketCounts[bucket];
    if (cumulativeCount >= targetCount) {
      return bucket === DURATION_BUCKET_COUNT - 1
        ? max
        : getDurationBucketUpperBound(bucket);
    }
  }
  return max;
}
