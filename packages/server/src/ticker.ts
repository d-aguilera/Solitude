import type {
  SnapshotMessage,
  SolitudeGameId,
} from "@solitude/protocol/protocol";
import type { SolitudeInProcessTransport } from "./transport";

export interface SolitudeGameTickRequest {
  dtMillis: number;
  gameId: SolitudeGameId;
  intervalMillis: number;
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
  transport: Pick<SolitudeInProcessTransport, "stepGameWithInputWindow">;
}

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
    const timer = clock.setInterval(() => {
      const inputWindowEndMillis = clock.nowMillis();
      const snapshot = stepGameForBroadcast(
        options.transport,
        request,
        inputWindowStartMillis,
        inputWindowEndMillis,
      );
      if (!snapshot) {
        pauseGame(request.gameId);
        return;
      }
      inputWindowStartMillis = inputWindowEndMillis;
      options.onSnapshot(snapshot);
    }, request.intervalMillis);
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
  inputWindowStartMillis: number,
  inputWindowEndMillis: number,
): SnapshotMessage | null {
  let remainingMillis = request.dtMillis;
  let snapshot: SnapshotMessage | null = null;
  let elapsedMillis = 0;
  const inputWindowDurationMillis =
    inputWindowEndMillis - inputWindowStartMillis;

  while (remainingMillis > 0) {
    const stepMillis = Math.min(request.simulationStepMillis, remainingMillis);
    const stepWindowStartMillis =
      inputWindowStartMillis +
      (elapsedMillis / request.dtMillis) * inputWindowDurationMillis;
    const stepWindowEndMillis =
      inputWindowStartMillis +
      ((elapsedMillis + stepMillis) / request.dtMillis) *
        inputWindowDurationMillis;
    snapshot = transport.stepGameWithInputWindow(request.gameId, stepMillis, {
      endMillis: Math.min(stepWindowEndMillis, inputWindowEndMillis),
      startMillis: Math.min(stepWindowStartMillis, inputWindowEndMillis),
    });
    if (!snapshot) return null;
    remainingMillis -= stepMillis;
    elapsedMillis += stepMillis;
  }

  return snapshot;
}
