import {
  createErrorMessage,
  isSolitudeClientMessage,
  type SnapshotMessage,
  type SolitudeGameId,
  type SolitudeProtocolSequence,
  type SolitudeServerMessage,
} from "./protocol";
import {
  createSolitudeSessionManager,
  type SolitudeGameSummary,
  type SolitudeInputTimeWindow,
  type SolitudeSessionManager,
} from "./sessions";

export interface SolitudeInProcessTransport {
  readonly sessionManager: SolitudeSessionManager;
  receive: (
    payload: unknown,
    fallbackSequence: SolitudeProtocolSequence,
  ) => SolitudeServerMessage[];
  listGames: () => SolitudeGameSummary[];
  stepGame: (
    gameId: SolitudeGameId,
    dtMillis: number,
  ) => SnapshotMessage | null;
  stepGameWithInputWindow: (
    gameId: SolitudeGameId,
    dtMillis: number,
    inputTimeWindow: SolitudeInputTimeWindow,
  ) => SnapshotMessage | null;
}

export function createSolitudeInProcessTransport(
  sessionManager: SolitudeSessionManager = createSolitudeSessionManager(),
): SolitudeInProcessTransport {
  return {
    sessionManager,
    receive: (payload, fallbackSequence) => {
      if (!isSolitudeClientMessage(payload)) {
        return [
          createErrorMessage({
            code: "invalidMessage",
            message: "Invalid client message",
            sequence: fallbackSequence,
          }),
        ];
      }
      return sessionManager.handleMessage(payload);
    },
    listGames: () => sessionManager.listGames(),
    stepGame: (gameId, dtMillis) => sessionManager.stepGame(gameId, dtMillis),
    stepGameWithInputWindow: (gameId, dtMillis, inputTimeWindow) =>
      sessionManager.stepGameWithInputWindow(gameId, dtMillis, inputTimeWindow),
  };
}
