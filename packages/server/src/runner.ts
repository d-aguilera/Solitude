import type {
  SnapshotMessage,
  SolitudeProtocolSequence,
  SolitudeServerMessage,
} from "@solitude/protocol/protocol";
import type { SolitudeServerMetrics } from "./metrics";
import type { SolitudeGameSummary } from "./sessions";
import type { SolitudeGameTicker } from "./ticker";
import type { SolitudeInProcessTransport } from "./transport";

export interface SolitudeGameRunner {
  close: () => void;
  listGames: () => SolitudeRunningGameSummary[];
  receive: (
    payload: unknown,
    fallbackSequence: SolitudeProtocolSequence,
  ) => SolitudeServerMessage[];
}

export interface SolitudeGameRunnerFactory {
  (options: SolitudeGameRunnerFactoryOptions): SolitudeGameRunner;
}

export interface SolitudeGameRunnerFactoryOptions {
  metrics: SolitudeServerMetrics;
  onSnapshot: (snapshot: SnapshotMessage) => void;
}

export interface SolitudeGameRunnerOptions {
  ticker: SolitudeGameTicker;
  transport: SolitudeInProcessTransport;
}

export interface SolitudeRunningGameSummary extends SolitudeGameSummary {
  running: boolean;
}

export function createSolitudeGameRunner({
  ticker,
  transport,
}: SolitudeGameRunnerOptions): SolitudeGameRunner {
  const stopCleanedUpGames = (): void => {
    for (const gameId of transport.cleanupGames()) {
      ticker.stopGame(gameId);
    }
  };

  const runCreatedGames = (
    messages: readonly SolitudeServerMessage[],
  ): void => {
    for (const message of messages) {
      if (message.type === "gameCreated") {
        ticker.runGame({ gameId: message.gameId });
      }
    }
  };

  return {
    close: () => {
      ticker.stopAll();
    },
    listGames: () => {
      stopCleanedUpGames();
      return transport.listGames().map((game) => ({
        ...game,
        running: ticker.isRunning(game.gameId),
      }));
    },
    receive: (payload, fallbackSequence) => {
      const messages = transport.receive(payload, fallbackSequence);
      runCreatedGames(messages);
      stopCleanedUpGames();
      return messages;
    },
  };
}
