import type { ControlInput } from "@solitude/engine/plugin";
import type { RuntimeEntitySnapshot } from "@solitude/engine/runtime";
import type { EntityConfig, EntityId } from "@solitude/engine/world";

export type SolitudeGameId = string;
export type SolitudeClientId = string;
export type SolitudeModelVersion = number;
export type SolitudeInputSequence = number;
export type SolitudeProtocolSequence = number;
export type SolitudeSimulationTimeMillis = number;
export type SolitudeSimulationTick = number;

export type SolitudeClientMessage =
  | CreateGameMessage
  | JoinGameMessage
  | LeaveGameMessage
  | InputMessage
  | SetSimulationRateMessage;

export type SolitudeSocketClientMessage =
  | ClientMessageSocketRequest
  | ClientMessageSocketEvent;

export type SolitudeSocketServerMessage =
  | MessagesSocketResponse
  | ServerMessageSocketEvent
  | ReadySocketEvent;

export type SolitudeServerMessage =
  | GameCreatedMessage
  | JoinedGameMessage
  | GameModelMessage
  | SnapshotMessage
  | ErrorMessage;

export interface CreateGameMessage {
  type: "createGame";
  clientId: SolitudeClientId;
  sequence: SolitudeProtocolSequence;
}

export interface JoinGameMessage {
  type: "joinGame";
  clientId: SolitudeClientId;
  gameId: SolitudeGameId;
  sequence: SolitudeProtocolSequence;
}

export interface LeaveGameMessage {
  type: "leaveGame";
  clientId: SolitudeClientId;
  gameId: SolitudeGameId;
  sequence: SolitudeProtocolSequence;
}

export interface InputMessage {
  type: "input";
  clientId: SolitudeClientId;
  gameId: SolitudeGameId;
  entityId: EntityId;
  inputSequence: SolitudeInputSequence;
  sequence: SolitudeProtocolSequence;
  controls: Partial<ControlInput>;
}

export interface SetSimulationRateMessage {
  type: "setSimulationRate";
  clientId: SolitudeClientId;
  gameId: SolitudeGameId;
  sequence: SolitudeProtocolSequence;
  simulationMillisPerWallMillis: number;
}

export interface ClientMessageSocketRequest {
  type: "clientMessage";
  requestId: SolitudeProtocolSequence;
  message: SolitudeClientMessage;
}

export interface ClientMessageSocketEvent {
  type: "clientMessageEvent";
  message: SolitudeClientMessage;
}

export interface GameCreatedMessage {
  type: "gameCreated";
  clientId: SolitudeClientId;
  gameId: SolitudeGameId;
  sequence: SolitudeProtocolSequence;
}

export interface JoinedGameMessage {
  type: "joined";
  clientId: SolitudeClientId;
  entityId: EntityId;
  gameId: SolitudeGameId;
  sequence: SolitudeProtocolSequence;
}

export interface GameModelMessage {
  type: "gameModel";
  entities: EntityConfig[];
  gameId: SolitudeGameId;
  modelVersion: SolitudeModelVersion;
  runtimeOptions: Record<string, string>;
  sequence: SolitudeProtocolSequence;
}

export interface SnapshotMessage {
  type: "snapshot";
  entities: RuntimeEntitySnapshot[];
  gameId: SolitudeGameId;
  lastProcessedInputSequences: Record<EntityId, SolitudeInputSequence>;
  modelVersion: SolitudeModelVersion;
  sequence: SolitudeProtocolSequence;
  simulationMillisPerWallMillis?: number;
  simulationTimeMillis: SolitudeSimulationTimeMillis;
  tick: SolitudeSimulationTick;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
  sequence: SolitudeProtocolSequence;
}

export interface MessagesSocketResponse {
  type: "messages";
  requestId: SolitudeProtocolSequence;
  messages: SolitudeServerMessage[];
}

export interface ServerMessageSocketEvent {
  type: "serverMessage";
  message: SolitudeServerMessage;
}

export interface ReadySocketEvent {
  type: "ready";
}

export function createGameCreatedMessage(
  params: Omit<GameCreatedMessage, "type">,
): GameCreatedMessage {
  return { type: "gameCreated", ...params };
}

export function createJoinedGameMessage(
  params: Omit<JoinedGameMessage, "type">,
): JoinedGameMessage {
  return { type: "joined", ...params };
}

export function createGameModelMessage(
  params: Omit<GameModelMessage, "type">,
): GameModelMessage {
  return { type: "gameModel", ...params };
}

export function createSnapshotMessage(
  params: Omit<SnapshotMessage, "type">,
): SnapshotMessage {
  return { type: "snapshot", ...params };
}

export function createErrorMessage(
  params: Omit<ErrorMessage, "type">,
): ErrorMessage {
  return { type: "error", ...params };
}

export function isSolitudeClientMessage(
  value: unknown,
): value is SolitudeClientMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "createGame":
      return isString(value.clientId) && isFiniteNumber(value.sequence);
    case "joinGame":
    case "leaveGame":
      return (
        isString(value.clientId) &&
        isString(value.gameId) &&
        isFiniteNumber(value.sequence)
      );
    case "input":
      return (
        isString(value.clientId) &&
        isString(value.gameId) &&
        isString(value.entityId) &&
        isFiniteNumber(value.inputSequence) &&
        isFiniteNumber(value.sequence) &&
        isRecord(value.controls)
      );
    case "setSimulationRate":
      return (
        isString(value.clientId) &&
        isString(value.gameId) &&
        isFiniteNumber(value.sequence) &&
        isFiniteNumber(value.simulationMillisPerWallMillis) &&
        value.simulationMillisPerWallMillis > 0
      );
    default:
      return false;
  }
}

export function isSolitudeServerMessage(
  value: unknown,
): value is SolitudeServerMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "gameCreated":
      return (
        isString(value.clientId) &&
        isString(value.gameId) &&
        isFiniteNumber(value.sequence)
      );
    case "joined":
      return (
        isString(value.clientId) &&
        isString(value.entityId) &&
        isString(value.gameId) &&
        isFiniteNumber(value.sequence)
      );
    case "gameModel":
      return (
        Array.isArray(value.entities) &&
        isString(value.gameId) &&
        isFiniteNumber(value.modelVersion) &&
        isStringRecord(value.runtimeOptions) &&
        isFiniteNumber(value.sequence)
      );
    case "snapshot":
      return (
        Array.isArray(value.entities) &&
        isString(value.gameId) &&
        isInputSequenceRecord(value.lastProcessedInputSequences) &&
        isFiniteNumber(value.modelVersion) &&
        isFiniteNumber(value.sequence) &&
        (value.simulationMillisPerWallMillis === undefined ||
          isFiniteNumber(value.simulationMillisPerWallMillis)) &&
        isFiniteNumber(value.simulationTimeMillis) &&
        isFiniteNumber(value.tick)
      );
    case "error":
      return (
        isString(value.code) &&
        isString(value.message) &&
        isFiniteNumber(value.sequence)
      );
    default:
      return false;
  }
}

export function isSolitudeSocketClientMessage(
  value: unknown,
): value is SolitudeSocketClientMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "clientMessage":
      return (
        isFiniteNumber(value.requestId) &&
        isSolitudeClientMessage(value.message)
      );
    case "clientMessageEvent":
      return isSolitudeClientMessage(value.message);
    default:
      return false;
  }
}

export function isSolitudeSocketServerMessage(
  value: unknown,
): value is SolitudeSocketServerMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "messages":
      return (
        isFiniteNumber(value.requestId) &&
        Array.isArray(value.messages) &&
        value.messages.every(isSolitudeServerMessage)
      );
    case "serverMessage":
      return isSolitudeServerMessage(value.message);
    case "ready":
      return true;
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInputSequenceRecord(
  value: unknown,
): value is Record<string, number> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isFiniteNumber);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isString);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
