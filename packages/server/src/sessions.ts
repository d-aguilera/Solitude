import type { ControlInput } from "@solitude/engine/plugin";
import type { EntityId } from "@solitude/engine/world";
import {
  createErrorMessage,
  createGameCreatedMessage,
  createJoinedGameMessage,
  createSnapshotMessage,
  type InputMessage,
  type JoinGameMessage,
  type LeaveGameMessage,
  type SnapshotMessage,
  type SolitudeClientId,
  type SolitudeClientMessage,
  type SolitudeGameId,
  type SolitudeProtocolSequence,
  type SolitudeServerMessage,
} from "./protocol";
import { createSolitudeServerGame, type SolitudeServerGame } from "./runtime";

const DEFAULT_ASSIGNABLE_ENTITY_IDS = ["ship:blue", "ship:red"] as const;
const THRUST_CONTROL_IDS = [
  "thrust0",
  "thrust1",
  "thrust2",
  "thrust3",
  "thrust4",
  "thrust5",
  "thrust6",
  "thrust7",
  "thrust8",
  "thrust9",
] as const;

export interface SolitudeSessionManagerOptions {
  assignableEntityIds: readonly EntityId[];
  createGame: () => SolitudeServerGame;
}

const DEFAULT_SESSION_MANAGER_OPTIONS: SolitudeSessionManagerOptions = {
  assignableEntityIds: DEFAULT_ASSIGNABLE_ENTITY_IDS,
  createGame: createSolitudeServerGame,
};

export interface SolitudeSessionManager {
  handleMessage: (message: SolitudeClientMessage) => SolitudeServerMessage[];
  listGames: () => SolitudeGameSummary[];
  stepGame: (
    gameId: SolitudeGameId,
    dtMillis: number,
  ) => SnapshotMessage | null;
}

export interface SolitudeGameSummary {
  assignedEntityIds: EntityId[];
  availableEntityIds: EntityId[];
  gameId: SolitudeGameId;
  maxClients: number;
  tick: number;
}

interface ServerGameSession {
  assignedEntityByClientId: Map<SolitudeClientId, EntityId>;
  game: SolitudeServerGame;
  heldControlInputsByEntityId: Map<EntityId, Partial<ControlInput>>;
  id: SolitudeGameId;
  nextEntityIndex: number;
  nextSequence: SolitudeProtocolSequence;
  pendingPressedControlInputsByEntityId: Map<EntityId, Partial<ControlInput>>;
  tick: number;
}

export function createSolitudeSessionManager(
  options: SolitudeSessionManagerOptions = DEFAULT_SESSION_MANAGER_OPTIONS,
): SolitudeSessionManager {
  const gamesById = new Map<SolitudeGameId, ServerGameSession>();
  let nextGameNumber = 1;

  const createGame = (
    clientId: SolitudeClientId,
    sequence: SolitudeProtocolSequence,
  ): SolitudeServerMessage[] => {
    const gameId = createGameId(nextGameNumber);
    nextGameNumber++;
    const session: ServerGameSession = {
      assignedEntityByClientId: new Map(),
      game: options.createGame(),
      heldControlInputsByEntityId: new Map(),
      id: gameId,
      nextEntityIndex: 0,
      nextSequence: sequence + 2,
      pendingPressedControlInputsByEntityId: new Map(),
      tick: 0,
    };
    gamesById.set(gameId, session);
    return [
      createGameCreatedMessage({
        clientId,
        gameId,
        sequence,
      }),
      joinExistingGame(session, clientId, sequence + 1),
    ];
  };

  const handleMessage = (
    message: SolitudeClientMessage,
  ): SolitudeServerMessage[] => {
    switch (message.type) {
      case "createGame":
        return createGame(message.clientId, message.sequence);
      case "joinGame":
        return handleJoinGame(message);
      case "leaveGame":
        return handleLeaveGame(message);
      case "input":
        return handleInput(message);
    }
  };

  const getGame = (
    gameId: SolitudeGameId,
    sequence: SolitudeProtocolSequence,
  ): ServerGameSession | SolitudeServerMessage => {
    const session = gamesById.get(gameId);
    if (session) return session;
    return createErrorMessage({
      code: "gameNotFound",
      message: `Game not found: ${gameId}`,
      sequence,
    });
  };

  const handleJoinGame = (
    message: JoinGameMessage,
  ): SolitudeServerMessage[] => {
    const session = getGame(message.gameId, message.sequence);
    if (!isSession(session)) return [session];
    return [joinExistingGame(session, message.clientId, message.sequence)];
  };

  const handleLeaveGame = (
    message: LeaveGameMessage,
  ): SolitudeServerMessage[] => {
    const session = getGame(message.gameId, message.sequence);
    if (!isSession(session)) return [session];
    const assignedEntityId = session.assignedEntityByClientId.get(
      message.clientId,
    );
    session.assignedEntityByClientId.delete(message.clientId);
    if (assignedEntityId) {
      session.heldControlInputsByEntityId.delete(assignedEntityId);
      session.pendingPressedControlInputsByEntityId.delete(assignedEntityId);
    }
    return [];
  };

  const handleInput = (message: InputMessage): SolitudeServerMessage[] => {
    const session = getGame(message.gameId, message.sequence);
    if (!isSession(session)) return [session];
    const assignedEntityId = session.assignedEntityByClientId.get(
      message.clientId,
    );
    if (assignedEntityId !== message.entityId) {
      return [
        createErrorMessage({
          code: "entityNotAssigned",
          message: `Entity is not assigned to client: ${message.entityId}`,
          sequence: message.sequence,
        }),
      ];
    }
    const heldControls =
      session.heldControlInputsByEntityId.get(message.entityId) ?? {};
    const pendingPressedControls =
      session.pendingPressedControlInputsByEntityId.get(message.entityId) ?? {};
    applyInputPatch(heldControls, pendingPressedControls, message.controls);
    session.heldControlInputsByEntityId.set(message.entityId, heldControls);
    if (hasControlInputs(pendingPressedControls)) {
      session.pendingPressedControlInputsByEntityId.set(
        message.entityId,
        pendingPressedControls,
      );
    }
    return [];
  };

  const stepGame = (
    gameId: SolitudeGameId,
    dtMillis: number,
  ): SnapshotMessage | null => {
    const session = gamesById.get(gameId);
    if (!session) return null;
    const controlInputsByEntityId = getStepControlInputs(session);
    const snapshot = session.game.step(dtMillis, controlInputsByEntityId);
    session.pendingPressedControlInputsByEntityId.clear();
    session.tick++;
    const sequence = session.nextSequence;
    session.nextSequence++;
    return createSnapshotMessage({
      gameId,
      sequence,
      snapshot,
      tick: session.tick,
    });
  };

  const joinExistingGame = (
    session: ServerGameSession,
    clientId: SolitudeClientId,
    sequence: SolitudeProtocolSequence,
  ): SolitudeServerMessage => {
    const existingEntityId = session.assignedEntityByClientId.get(clientId);
    if (existingEntityId) {
      return createJoinedGameMessage({
        clientId,
        entityId: existingEntityId,
        gameId: session.id,
        sequence,
      });
    }
    const entityId = options.assignableEntityIds[session.nextEntityIndex];
    if (!entityId) {
      return createErrorMessage({
        code: "gameFull",
        message: `Game is full: ${session.id}`,
        sequence,
      });
    }
    session.nextEntityIndex++;
    session.assignedEntityByClientId.set(clientId, entityId);
    return createJoinedGameMessage({
      clientId,
      entityId,
      gameId: session.id,
      sequence,
    });
  };

  const listGames = (): SolitudeGameSummary[] => {
    const summaries: SolitudeGameSummary[] = [];
    for (const session of gamesById.values()) {
      summaries.push({
        assignedEntityIds: Array.from(
          session.assignedEntityByClientId.values(),
        ),
        availableEntityIds: options.assignableEntityIds.slice(
          session.nextEntityIndex,
        ),
        gameId: session.id,
        maxClients: options.assignableEntityIds.length,
        tick: session.tick,
      });
    }
    return summaries;
  };

  return { handleMessage, listGames, stepGame };
}

function applyInputPatch(
  heldControls: Partial<ControlInput>,
  pendingPressedControls: Partial<ControlInput>,
  patch: Partial<ControlInput>,
): void {
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (isThrustControlId(key)) {
      if (value) {
        clearThrustControls(heldControls);
        heldControls[key] = true;
      }
      continue;
    }
    heldControls[key] = value;
    if (value) {
      pendingPressedControls[key] = true;
    }
  }
}

function getStepControlInputs(
  session: ServerGameSession,
): ReadonlyMap<EntityId, Partial<ControlInput>> {
  if (session.pendingPressedControlInputsByEntityId.size === 0) {
    return session.heldControlInputsByEntityId;
  }

  const controlInputsByEntityId = new Map<EntityId, Partial<ControlInput>>(
    session.heldControlInputsByEntityId,
  );
  for (const [
    entityId,
    pendingPressedControls,
  ] of session.pendingPressedControlInputsByEntityId) {
    controlInputsByEntityId.set(entityId, {
      ...controlInputsByEntityId.get(entityId),
      ...pendingPressedControls,
    });
  }
  return controlInputsByEntityId;
}

function hasControlInputs(controls: Partial<ControlInput>): boolean {
  for (const key of Object.keys(controls)) {
    if (controls[key] !== undefined) return true;
  }
  return false;
}

function clearThrustControls(heldControls: Partial<ControlInput>): void {
  for (const key of THRUST_CONTROL_IDS) {
    delete heldControls[key];
  }
}

function isThrustControlId(
  value: string,
): value is (typeof THRUST_CONTROL_IDS)[number] {
  return (THRUST_CONTROL_IDS as readonly string[]).includes(value);
}

function createGameId(value: number): SolitudeGameId {
  return `game:${value}`;
}

function isSession(
  value: ServerGameSession | SolitudeServerMessage,
): value is ServerGameSession {
  return "game" in value;
}
