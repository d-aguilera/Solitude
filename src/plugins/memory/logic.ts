export interface MemoryTelemetryController {
  updateEnabled: (togglePressed: boolean) => boolean;
  update: (nowMs: number) => void;
  isEnabled: () => boolean;
  getHudText: () => string;
}

const SAMPLE_INTERVAL_MS = 500;
const LOG_INTERVAL_MS = 5000;
const MAX_SAMPLES = 24;
const BYTES_PER_MB = 1024 * 1024;

type BrowserMemory = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

type PerformanceWithMemory = Performance & {
  memory?: BrowserMemory;
};

export function createMemoryTelemetryController(): MemoryTelemetryController {
  const usedSamplesMb = new Array<number>(MAX_SAMPLES);
  const timeSamplesMs = new Array<number>(MAX_SAMPLES);

  let enabled = false;
  let toggleKeyDown = false;
  let sampleCount = 0;
  let nextSampleIndex = 0;
  let lastSampleTimeMs = -Infinity;
  let lastLogTimeMs = -Infinity;
  let currentUsedMb = 0;
  let currentTotalMb = 0;
  let currentLimitMb = 0;
  let minUsedMb = 0;
  let maxUsedMb = 0;
  let rangeUsedMb = 0;
  let deltaPerSecMb = 0;
  let hudText = "Heap n/a";

  const updateEnabled = (togglePressed: boolean): boolean => {
    if (togglePressed) {
      if (!toggleKeyDown) {
        enabled = !enabled;
        toggleKeyDown = true;
        if (enabled) {
          resetSamples();
        }
      }
    } else if (toggleKeyDown) {
      toggleKeyDown = false;
    }

    return enabled;
  };

  const update = (nowMs: number): void => {
    if (!enabled) return;
    if (nowMs - lastSampleTimeMs < SAMPLE_INTERVAL_MS) return;

    lastSampleTimeMs = nowMs;

    const memory = getBrowserMemory();
    if (!memory) {
      hudText = "Heap n/a";
      return;
    }

    currentUsedMb = bytesToMb(memory.usedJSHeapSize);
    currentTotalMb = bytesToMb(memory.totalJSHeapSize);
    currentLimitMb = bytesToMb(memory.jsHeapSizeLimit);

    recordSample(nowMs, currentUsedMb);
    updateStats();
    hudText = formatHudText(currentUsedMb, rangeUsedMb, deltaPerSecMb);

    if (nowMs - lastLogTimeMs >= LOG_INTERVAL_MS) {
      lastLogTimeMs = nowMs;
      logSummary();
    }
  };

  const isEnabled = (): boolean => enabled;
  const getHudText = (): string => hudText;

  function resetSamples(): void {
    sampleCount = 0;
    nextSampleIndex = 0;
    lastSampleTimeMs = -Infinity;
    lastLogTimeMs = -Infinity;
    currentUsedMb = 0;
    currentTotalMb = 0;
    currentLimitMb = 0;
    minUsedMb = 0;
    maxUsedMb = 0;
    rangeUsedMb = 0;
    deltaPerSecMb = 0;
    hudText = getBrowserMemory() ? "Heap ..." : "Heap n/a";
  }

  function recordSample(nowMs: number, usedMb: number): void {
    usedSamplesMb[nextSampleIndex] = usedMb;
    timeSamplesMs[nextSampleIndex] = nowMs;
    nextSampleIndex = (nextSampleIndex + 1) % MAX_SAMPLES;
    if (sampleCount < MAX_SAMPLES) sampleCount++;
  }

  function updateStats(): void {
    if (sampleCount === 0) return;

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < sampleCount; i++) {
      const sample = usedSamplesMb[i];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    minUsedMb = min;
    maxUsedMb = max;
    rangeUsedMb = max - min;

    if (sampleCount < 2) {
      deltaPerSecMb = 0;
      return;
    }

    const newestIndex = (nextSampleIndex - 1 + MAX_SAMPLES) % MAX_SAMPLES;
    const oldestIndex = sampleCount === MAX_SAMPLES ? nextSampleIndex : 0;
    const dtSec =
      (timeSamplesMs[newestIndex] - timeSamplesMs[oldestIndex]) / 1000;
    deltaPerSecMb =
      dtSec > 0
        ? (usedSamplesMb[newestIndex] - usedSamplesMb[oldestIndex]) / dtSec
        : 0;
  }

  function logSummary(): void {
    console.log(
      "[mem] heap="
        .concat(formatMb(currentUsedMb), "MB range=")
        .concat(formatMb(rangeUsedMb), "MB dHeap=")
        .concat(formatSignedRate(deltaPerSecMb), "MB/s total=")
        .concat(formatMb(currentTotalMb), "MB limit=")
        .concat(formatMb(currentLimitMb), "MB min=")
        .concat(formatMb(minUsedMb), "MB max=")
        .concat(formatMb(maxUsedMb), "MB samples=")
        .concat(sampleCount.toString()),
    );
  }

  return { updateEnabled, update, isEnabled, getHudText };
}

function getBrowserMemory(): BrowserMemory | null {
  if (typeof performance === "undefined") return null;
  const perf = performance as PerformanceWithMemory;
  return perf.memory ?? null;
}

function bytesToMb(bytes: number): number {
  return bytes / BYTES_PER_MB;
}

function formatHudText(
  heapMb: number,
  rangeMb: number,
  deltaMbPerSec: number,
): string {
  return "Heap "
    .concat(formatMb(heapMb), "MB r")
    .concat(formatMb(rangeMb), " d")
    .concat(formatSignedRate(deltaMbPerSec), "/s");
}

function formatMb(value: number): string {
  return value.toFixed(1);
}

function formatSignedRate(value: number): string {
  const formatted = Math.abs(value).toFixed(1);
  if (value > 0) return "+".concat(formatted);
  if (value < 0) return "-".concat(formatted);
  return "+0.0";
}
