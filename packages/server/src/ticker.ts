import type {
  SnapshotMessage,
  SolitudeGameId,
} from "@solitude/protocol/protocol";
import type { SolitudeServerMetrics } from "./metrics";
import type { SolitudeInProcessTransport } from "./transport";

export interface SolitudeGameTickRequest {
  gameId: SolitudeGameId;
}

export interface SolitudeGameTickPolicy {
  broadcastIntervalMillis: number;
  simulationMillisPerWallMillis: number;
  simulationStepMillis: number;
}

export interface SolitudeGameTicker {
  isRunning: (gameId: SolitudeGameId) => boolean;
  runGame: (request: SolitudeGameTickRequest) => void;
  stopAll: () => void;
  stopGame: (gameId: SolitudeGameId) => void;
}

export interface SolitudeGameTickerClock<Timer> {
  clearInterval: (timer: Timer) => void;
  nowMillis: () => number;
  setInterval: (callback: () => void, intervalMillis: number) => Timer;
}

export interface SolitudeGameTickerOptions<Timer> {
  clock?: SolitudeGameTickerClock<Timer>;
  metrics: Pick<SolitudeServerMetrics, "recordSnapshotStep">;
  onSnapshot: (snapshot: SnapshotMessage) => void;
  policy: SolitudeGameTickPolicy;
  transport: Pick<SolitudeInProcessTransport, "stepGameWithInputWindow">;
}

export const DEFAULT_SOLITUDE_GAME_TICK_POLICY: SolitudeGameTickPolicy = {
  broadcastIntervalMillis: 1000 / 60,
  simulationMillisPerWallMillis: 1,
  simulationStepMillis: 1000 / 60,
};

export function createSolitudeGameTicker<
  Timer = ReturnType<typeof setInterval>,
>(options: SolitudeGameTickerOptions<Timer>): SolitudeGameTicker {
  const clock =
    options.clock ??
    ({
      clearInterval,
      nowMillis: Date.now,
      setInterval,
    } as unknown as SolitudeGameTickerClock<Timer>);
  const timersByGameId = new Map<SolitudeGameId, Timer>();

  const stopGame = (gameId: SolitudeGameId): void => {
    const timer = timersByGameId.get(gameId);
    if (!timer) return;
    clock.clearInterval(timer);
    timersByGameId.delete(gameId);
  };

  const runGame = (request: SolitudeGameTickRequest): void => {
    stopGame(request.gameId);
    let inputWindowStartMillis = clock.nowMillis();
    let lastObservedWallMillis = inputWindowStartMillis;
    let accumulatedSimulationMillis = 0;
    const timer = clock.setInterval(() => {
      const inputWindowEndMillis = clock.nowMillis();
      const elapsedWallMillis = inputWindowEndMillis - lastObservedWallMillis;
      lastObservedWallMillis = inputWindowEndMillis;
      if (elapsedWallMillis <= 0) {
        return;
      }

      accumulatedSimulationMillis +=
        elapsedWallMillis * options.policy.simulationMillisPerWallMillis;

      const result = stepGameForBroadcast(
        options.transport,
        request,
        options.policy,
        options.metrics,
        accumulatedSimulationMillis,
        inputWindowStartMillis,
        inputWindowEndMillis,
        clock.nowMillis,
      );
      if (!result.gameExists) {
        stopGame(request.gameId);
        return;
      }
      inputWindowStartMillis = result.inputWindowStartMillis;
      accumulatedSimulationMillis = result.remainingSimulationMillis;
      if (result.snapshot) {
        options.onSnapshot(result.snapshot);
      }
    }, options.policy.broadcastIntervalMillis);
    timersByGameId.set(request.gameId, timer);
  };

  const stopAll = (): void => {
    for (const gameId of timersByGameId.keys()) {
      stopGame(gameId);
    }
  };

  return {
    isRunning: (gameId) => timersByGameId.has(gameId),
    runGame,
    stopAll,
    stopGame,
  };
}

function stepGameForBroadcast(
  transport: Pick<SolitudeInProcessTransport, "stepGameWithInputWindow">,
  request: SolitudeGameTickRequest,
  policy: SolitudeGameTickPolicy,
  metrics: Pick<SolitudeServerMetrics, "recordSnapshotStep">,
  accumulatedSimulationMillis: number,
  inputWindowStartMillis: number,
  inputWindowEndMillis: number,
  nowMillis: () => number,
): {
  gameExists: boolean;
  inputWindowStartMillis: number;
  remainingSimulationMillis: number;
  snapshot: SnapshotMessage | null;
} {
  let remainingMillis = accumulatedSimulationMillis;
  let snapshot: SnapshotMessage | null = null;

  while (remainingMillis >= policy.simulationStepMillis) {
    const stepMillis = policy.simulationStepMillis;
    const stepWindowStartMillis = inputWindowStartMillis;
    const stepWindowEndMillis = Math.min(
      inputWindowStartMillis +
        stepMillis / policy.simulationMillisPerWallMillis,
      inputWindowEndMillis,
    );
    const controlDurationMillis = Math.min(
      stepMillis,
      stepWindowEndMillis - stepWindowStartMillis,
    );
    const stepStartMillis = nowMillis();
    snapshot = transport.stepGameWithInputWindow(request.gameId, stepMillis, {
      controlDurationMillis,
      endMillis: stepWindowEndMillis,
      simulationMillisPerWallMillis: policy.simulationMillisPerWallMillis,
      startMillis: stepWindowStartMillis,
    });
    if (!snapshot) {
      return {
        gameExists: false,
        inputWindowStartMillis,
        remainingSimulationMillis: remainingMillis,
        snapshot: null,
      };
    }
    metrics.recordSnapshotStep({
      durationMillis: Math.max(0, nowMillis() - stepStartMillis),
      entityCount: snapshot.entities.length,
      gameId: request.gameId,
    });
    inputWindowStartMillis = stepWindowEndMillis;
    remainingMillis -= stepMillis;
  }

  return {
    gameExists: true,
    inputWindowStartMillis,
    remainingSimulationMillis: remainingMillis,
    snapshot,
  };
}
