import type { ControlInput } from "@solitude/engine/plugin";
import type { RuntimeWorldSnapshot } from "@solitude/engine/runtime";
import type { EntityId } from "@solitude/engine/world";

export type SolitudeGameId = string;
export type SolitudeClientId = string;
export type SolitudeProtocolSequence = number;
export type SolitudeSimulationTick = number;

export type SolitudeClientMessage =
  | CreateGameMessage
  | JoinGameMessage
  | LeaveGameMessage
  | InputMessage;

export type SolitudeServerMessage =
  | GameCreatedMessage
  | JoinedGameMessage
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
  sequence: SolitudeProtocolSequence;
  controls: Partial<ControlInput>;
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

export interface SnapshotMessage {
  type: "snapshot";
  gameId: SolitudeGameId;
  sequence: SolitudeProtocolSequence;
  snapshot: RuntimeWorldSnapshot;
  tick: SolitudeSimulationTick;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
  sequence: SolitudeProtocolSequence;
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
        isFiniteNumber(value.sequence) &&
        isRecord(value.controls)
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
    case "snapshot":
      return (
        isString(value.gameId) &&
        isFiniteNumber(value.sequence) &&
        isRuntimeWorldSnapshot(value.snapshot) &&
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

function isRuntimeWorldSnapshot(value: unknown): value is RuntimeWorldSnapshot {
  return isRecord(value) && Array.isArray(value.entities);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
