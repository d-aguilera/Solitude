import type { SnapshotMessage, SolitudeGameId } from "./protocol";
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
  setInterval: (callback: () => void, intervalMillis: number) => Timer;
}

export interface SolitudeGameTickerOptions<Timer> {
  clock?: SolitudeGameTickerClock<Timer>;
  onSnapshot: (snapshot: SnapshotMessage) => void;
  transport: Pick<SolitudeInProcessTransport, "stepGame">;
}

export function createSolitudeGameTicker<
  Timer = ReturnType<typeof setInterval>,
>(options: SolitudeGameTickerOptions<Timer>): SolitudeGameTicker {
  const clock =
    options.clock ??
    ({
      clearInterval,
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
    const timer = clock.setInterval(() => {
      const snapshot = stepGameForBroadcast(options.transport, request);
      if (!snapshot) {
        pauseGame(request.gameId);
        return;
      }
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
  transport: Pick<SolitudeInProcessTransport, "stepGame">,
  request: SolitudeGameTickRequest,
): SnapshotMessage | null {
  let remainingMillis = request.dtMillis;
  let snapshot: SnapshotMessage | null = null;

  while (remainingMillis > 0) {
    const stepMillis = Math.min(request.simulationStepMillis, remainingMillis);
    snapshot = transport.stepGame(request.gameId, stepMillis);
    if (!snapshot) return null;
    remainingMillis -= stepMillis;
  }

  return snapshot;
}
