import type {
  SnapshotMessage,
  SolitudeProtocolSequence,
  SolitudeServerMessage,
} from "@solitude/protocol/protocol";
import type { SolitudeGameSummary } from "./sessions";
import {
  DEFAULT_SOLITUDE_GAME_TICK_POLICY,
  createSolitudeGameTicker,
  type SolitudeGameTicker,
} from "./ticker";
import {
  createSolitudeInProcessTransport,
  type SolitudeInProcessTransport,
} from "./transport";

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
  onSnapshot: (snapshot: SnapshotMessage) => void;
}

export interface SolitudeGameRunnerOptions {
  ticker: SolitudeGameTicker;
  transport: SolitudeInProcessTransport;
}

export interface SolitudeRunningGameSummary extends SolitudeGameSummary {
  running: boolean;
}

export function createDefaultSolitudeGameRunner({
  onSnapshot,
}: SolitudeGameRunnerFactoryOptions): SolitudeGameRunner {
  const transport = createSolitudeInProcessTransport();
  return createSolitudeGameRunner({
    ticker: createSolitudeGameTicker({
      onSnapshot,
      policy: DEFAULT_SOLITUDE_GAME_TICK_POLICY,
      transport,
    }),
    transport,
  });
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
