import type {
  SnapshotMessage,
  SolitudeGameId,
} from "@solitude/protocol/protocol";
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
  pauseAll: () => void;
  pauseGame: (gameId: SolitudeGameId) => void;
  runGame: (request: SolitudeGameTickRequest) => void;
}

export interface SolitudeGameTickerClock<Timer> {
  clearInterval: (timer: Timer) => void;
  nowMillis: () => number;
  setInterval: (callback: () => void, intervalMillis: number) => Timer;
}

export interface SolitudeGameTickerOptions<Timer> {
  clock?: SolitudeGameTickerClock<Timer>;
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

  const pauseGame = (gameId: SolitudeGameId): void => {
    const timer = timersByGameId.get(gameId);
    if (!timer) return;
    clock.clearInterval(timer);
    timersByGameId.delete(gameId);
  };

  const runGame = (request: SolitudeGameTickRequest): void => {
    pauseGame(request.gameId);
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
        accumulatedSimulationMillis,
        inputWindowStartMillis,
        inputWindowEndMillis,
      );
      if (!result.gameExists) {
        pauseGame(request.gameId);
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

  const pauseAll = (): void => {
    for (const gameId of timersByGameId.keys()) {
      pauseGame(gameId);
    }
  };

  return {
    isRunning: (gameId) => timersByGameId.has(gameId),
    pauseAll,
    pauseGame,
    runGame,
  };
}

function stepGameForBroadcast(
  transport: Pick<SolitudeInProcessTransport, "stepGameWithInputWindow">,
  request: SolitudeGameTickRequest,
  policy: SolitudeGameTickPolicy,
  accumulatedSimulationMillis: number,
  inputWindowStartMillis: number,
  inputWindowEndMillis: number,
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
    snapshot = transport.stepGameWithInputWindow(request.gameId, stepMillis, {
      endMillis: stepWindowEndMillis,
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
