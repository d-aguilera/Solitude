import type { ControlInput } from "@solitude/engine/plugin";
import type { EntityConfig, EntityId } from "@solitude/engine/world";
import {
  createErrorMessage,
  createGameCreatedMessage,
  createGameModelMessage,
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
} from "@solitude/protocol/protocol";
import { buildSolarSystemShipEntity } from "@solitude/sim/plugins/solarSystem";
import { buildDefaultSolarSystemConfigs } from "@solitude/sim/plugins/solarSystem/solarSystem";
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
  createGame: (initialEntities: readonly EntityConfig[]) => SolitudeServerGame;
  createShipEntity: (id: EntityId, index: number) => EntityConfig;
  nowMillis: () => number;
}

const DEFAULT_SESSION_MANAGER_OPTIONS: SolitudeSessionManagerOptions = {
  assignableEntityIds: DEFAULT_ASSIGNABLE_ENTITY_IDS,
  createGame: createSolitudeServerGame,
  createShipEntity: createDefaultShipEntity,
  nowMillis: Date.now,
};

export interface SolitudeInputTimeWindow {
  endMillis: number;
  startMillis: number;
}

export interface SolitudeSessionManager {
  cleanupGames: () => SolitudeGameId[];
  handleMessage: (message: SolitudeClientMessage) => SolitudeServerMessage[];
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

export interface SolitudeGameSummary {
  assignedEntityIds: EntityId[];
  availableEntityIds: EntityId[];
  gameId: SolitudeGameId;
  maxClients: number;
  tick: number;
}

interface ServerGameSession {
  assignedEntityByClientId: Map<SolitudeClientId, EntityId>;
  emptySinceMillis: number | null;
  game: SolitudeServerGame;
  heldControlInputsByEntityId: Map<EntityId, Partial<ControlInput>>;
  id: SolitudeGameId;
  inputEvents: QueuedInputEvent[];
  nextSequence: SolitudeProtocolSequence;
  pendingPressedControlInputsByEntityId: Map<EntityId, Partial<ControlInput>>;
  steppedControlInputsByEntityId: Map<EntityId, Partial<ControlInput>>;
  tick: number;
}

interface QueuedInputEvent {
  controls: Partial<ControlInput>;
  entityId: EntityId;
  receivedAtMillis: number;
}

export function createSolitudeSessionManager(
  sessionOptions: Partial<SolitudeSessionManagerOptions> = {},
): SolitudeSessionManager {
  const options: SolitudeSessionManagerOptions = {
    ...DEFAULT_SESSION_MANAGER_OPTIONS,
    ...sessionOptions,
  };
  const gamesById = new Map<SolitudeGameId, ServerGameSession>();
  let nextGameNumber = 1;

  const createGame = (
    clientId: SolitudeClientId,
    sequence: SolitudeProtocolSequence,
  ): SolitudeServerMessage[] => {
    const gameId = createGameId(nextGameNumber);
    nextGameNumber++;
    const entityId = options.assignableEntityIds[0];
    const entity = options.createShipEntity(entityId, 0);
    const session: ServerGameSession = {
      assignedEntityByClientId: new Map(),
      emptySinceMillis: null,
      game: options.createGame([entity]),
      heldControlInputsByEntityId: new Map(),
      id: gameId,
      inputEvents: [],
      nextSequence: sequence + 1,
      pendingPressedControlInputsByEntityId: new Map(),
      steppedControlInputsByEntityId: new Map(),
      tick: 0,
    };
    gamesById.set(gameId, session);
    return [
      createGameCreatedMessage({
        clientId,
        gameId,
        sequence,
      }),
      createGameModel(session),
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
    return joinExistingGame(session, message.clientId, message.sequence);
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
      session.game.removeEntity(assignedEntityId);
      session.heldControlInputsByEntityId.delete(assignedEntityId);
      session.pendingPressedControlInputsByEntityId.delete(assignedEntityId);
      session.steppedControlInputsByEntityId.delete(assignedEntityId);
      removeQueuedInputEventsForEntity(session.inputEvents, assignedEntityId);
    }
    if (session.assignedEntityByClientId.size === 0) {
      session.emptySinceMillis = options.nowMillis();
    }
    return [createGameModel(session)];
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
    session.inputEvents.push({
      controls: message.controls,
      entityId: message.entityId,
      receivedAtMillis: options.nowMillis(),
    });
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
    session.steppedControlInputsByEntityId = cloneControlInputMap(
      session.heldControlInputsByEntityId,
    );
    session.inputEvents.length = 0;
    return createNextSnapshotMessage(session, gameId, snapshot);
  };

  const stepGameWithInputWindow = (
    gameId: SolitudeGameId,
    dtMillis: number,
    inputTimeWindow: SolitudeInputTimeWindow,
  ): SnapshotMessage | null => {
    const session = gamesById.get(gameId);
    if (!session) return null;
    const snapshot = stepSessionGameWithInputWindow(
      session,
      dtMillis,
      inputTimeWindow,
    );
    session.pendingPressedControlInputsByEntityId.clear();
    return createNextSnapshotMessage(session, gameId, snapshot);
  };

  const createNextSnapshotMessage = (
    session: ServerGameSession,
    gameId: SolitudeGameId,
    snapshot: ReturnType<SolitudeServerGame["step"]>,
  ): SnapshotMessage => {
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
  ): SolitudeServerMessage[] => {
    const existingEntityId = session.assignedEntityByClientId.get(clientId);
    if (existingEntityId) {
      return [
        createJoinedGameMessage({
          clientId,
          entityId: existingEntityId,
          gameId: session.id,
          sequence,
        }),
        createGameModel(session),
      ];
    }
    const entityId = findAvailableEntityId(
      options.assignableEntityIds,
      session.assignedEntityByClientId,
    );
    if (!entityId) {
      return [
        createErrorMessage({
          code: "gameFull",
          message: `Game is full: ${session.id}`,
          sequence,
        }),
      ];
    }
    ensureEntityExists(session, entityId, options);
    session.assignedEntityByClientId.set(clientId, entityId);
    session.emptySinceMillis = null;
    return [
      createJoinedGameMessage({
        clientId,
        entityId,
        gameId: session.id,
        sequence,
      }),
      createGameModel(session),
    ];
  };

  const listGames = (): SolitudeGameSummary[] => {
    const summaries: SolitudeGameSummary[] = [];
    for (const session of gamesById.values()) {
      const assignedEntityIds = Array.from(
        session.assignedEntityByClientId.values(),
      );
      summaries.push({
        assignedEntityIds,
        availableEntityIds: options.assignableEntityIds.filter(
          (entityId) => !assignedEntityIds.includes(entityId),
        ),
        gameId: session.id,
        maxClients: options.assignableEntityIds.length,
        tick: session.tick,
      });
    }
    return summaries;
  };

  const cleanupGames = (): SolitudeGameId[] => {
    const removedGameIds: SolitudeGameId[] = [];
    for (const session of gamesById.values()) {
      if (session.emptySinceMillis === null) continue;
      gamesById.delete(session.id);
      removedGameIds.push(session.id);
    }
    return removedGameIds;
  };

  return {
    cleanupGames,
    handleMessage,
    listGames,
    stepGame,
    stepGameWithInputWindow,
  };
}

function ensureEntityExists(
  session: ServerGameSession,
  entityId: EntityId,
  options: SolitudeSessionManagerOptions,
): void {
  if (session.game.entityConfigs.some((entity) => entity.id === entityId)) {
    return;
  }
  const entity = options.createShipEntity(
    entityId,
    options.assignableEntityIds.indexOf(entityId),
  );
  session.game.addEntity(entity);
}

function createGameModel(session: ServerGameSession): SolitudeServerMessage {
  const sequence = session.nextSequence;
  session.nextSequence++;
  const assignedEntityIds = new Set(session.assignedEntityByClientId.values());
  return createGameModelMessage({
    entities: session.game.entityConfigs.filter((entity) =>
      assignedEntityIds.has(entity.id),
    ),
    gameId: session.id,
    sequence,
  });
}

function createDefaultShipEntity(id: EntityId, index: number): EntityConfig {
  return buildSolarSystemShipEntity(
    buildDefaultSolarSystemConfigs().physics,
    id,
    index,
  );
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

function findAvailableEntityId(
  assignableEntityIds: readonly EntityId[],
  assignedEntityByClientId: ReadonlyMap<SolitudeClientId, EntityId>,
): EntityId | undefined {
  const assignedEntityIds = new Set(assignedEntityByClientId.values());
  return assignableEntityIds.find(
    (entityId) => !assignedEntityIds.has(entityId),
  );
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

function stepSessionGameWithInputWindow(
  session: ServerGameSession,
  dtMillis: number,
  inputTimeWindow: SolitudeInputTimeWindow,
): ReturnType<SolitudeServerGame["step"]> {
  const events = takeInputEventsThrough(
    session.inputEvents,
    inputTimeWindow.endMillis,
  );
  if (
    events.length === 0 ||
    inputTimeWindow.endMillis <= inputTimeWindow.startMillis
  ) {
    return session.game.step(dtMillis, session.steppedControlInputsByEntityId);
  }

  const controlsByEntityId = cloneControlInputMap(
    session.steppedControlInputsByEntityId,
  );
  let elapsedSimMillis = 0;
  let snapshot: ReturnType<SolitudeServerGame["step"]> | null = null;

  for (const event of events) {
    const eventMillis = clamp(
      event.receivedAtMillis,
      inputTimeWindow.startMillis,
      inputTimeWindow.endMillis,
    );
    const nextElapsedSimMillis = wallMillisToSimMillis(
      eventMillis - inputTimeWindow.startMillis,
      inputTimeWindow,
      dtMillis,
    );
    const segmentDtMillis = nextElapsedSimMillis - elapsedSimMillis;
    if (segmentDtMillis > 0) {
      snapshot = session.game.step(segmentDtMillis, controlsByEntityId);
      elapsedSimMillis = nextElapsedSimMillis;
    }
    applyInputPatchForTimedStep(controlsByEntityId, event);
  }

  const remainingDtMillis = dtMillis - elapsedSimMillis;
  if (remainingDtMillis > 0 || !snapshot) {
    snapshot = session.game.step(remainingDtMillis, controlsByEntityId);
  }

  session.steppedControlInputsByEntityId = controlsByEntityId;
  return snapshot;
}

function wallMillisToSimMillis(
  wallOffsetMillis: number,
  inputTimeWindow: SolitudeInputTimeWindow,
  dtMillis: number,
): number {
  const wallDurationMillis =
    inputTimeWindow.endMillis - inputTimeWindow.startMillis;
  return (wallOffsetMillis / wallDurationMillis) * dtMillis;
}

function applyInputPatchForTimedStep(
  controlsByEntityId: Map<EntityId, Partial<ControlInput>>,
  event: QueuedInputEvent,
): void {
  const controls = controlsByEntityId.get(event.entityId) ?? {};
  applyInputPatch(controls, {}, event.controls);
  controlsByEntityId.set(event.entityId, controls);
}

function takeInputEventsThrough(
  inputEvents: QueuedInputEvent[],
  endMillis: number,
): QueuedInputEvent[] {
  const taken: QueuedInputEvent[] = [];
  let writeIndex = 0;

  for (let readIndex = 0; readIndex < inputEvents.length; readIndex++) {
    const event = inputEvents[readIndex];
    if (event.receivedAtMillis <= endMillis) {
      taken.push(event);
    } else {
      inputEvents[writeIndex] = event;
      writeIndex++;
    }
  }

  inputEvents.length = writeIndex;
  taken.sort((left, right) => left.receivedAtMillis - right.receivedAtMillis);
  return taken;
}

function removeQueuedInputEventsForEntity(
  inputEvents: QueuedInputEvent[],
  entityId: EntityId,
): void {
  let writeIndex = 0;
  for (let readIndex = 0; readIndex < inputEvents.length; readIndex++) {
    const event = inputEvents[readIndex];
    if (event.entityId !== entityId) {
      inputEvents[writeIndex] = event;
      writeIndex++;
    }
  }
  inputEvents.length = writeIndex;
}

function cloneControlInputMap(
  source: ReadonlyMap<EntityId, Partial<ControlInput>>,
): Map<EntityId, Partial<ControlInput>> {
  const result = new Map<EntityId, Partial<ControlInput>>();
  for (const [entityId, controls] of source) {
    result.set(entityId, { ...controls });
  }
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
