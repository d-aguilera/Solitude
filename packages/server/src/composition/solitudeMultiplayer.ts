import { km } from "@solitude/engine/math";
import type { EntityConfig, EntityId } from "@solitude/engine/world";
import { createSolarSystemCelestialBodyProvider } from "@solitude/sim/plugins/solarSystem/celestialBodyProvider";
import { createOrbitingSpacecraftEntity } from "@solitude/sim/spacecraft/entityFactory";
import { createSolitudeServerGame } from "../runtime";
import {
  createSolitudeSessionManager,
  type SolitudeSessionManager,
} from "../sessions";
import {
  createSolitudeInProcessTransport,
  type SolitudeInProcessTransport,
} from "../transport";

const DEFAULT_ASSIGNABLE_ENTITY_COUNT = 16;
const EARTH_ID = "planet:earth";
const SPACECRAFT_DENSITY_KG_PER_M3 = 2700;
const SPACECRAFT_START_ALTITUDE_M = 100 * km;
const SPACECRAFT_MESH_SCALE = 150_000;
const defaultCelestialBodyProvider = createSolarSystemCelestialBodyProvider();

export function createDefaultSolitudeInProcessTransport(): SolitudeInProcessTransport {
  return createSolitudeInProcessTransport(
    createDefaultSolitudeSessionManager(),
  );
}

export function createDefaultSolitudeSessionManager(): SolitudeSessionManager {
  const assignableEntityIds = createDefaultAssignableEntityIds(
    DEFAULT_ASSIGNABLE_ENTITY_COUNT,
  );
  return createSolitudeSessionManager({
    assignableEntityIds,
    createAssignableEntity: (id, index) =>
      createDefaultMultiplayerSpacecraftEntity({
        entityCount: assignableEntityIds.length,
        id,
        index,
      }),
    createGame: createSolitudeServerGame,
    nowMillis: Date.now,
  });
}

export function createDefaultMultiplayerSpacecraftEntity({
  entityCount,
  id,
  index,
}: {
  entityCount: number;
  id: EntityId;
  index: number;
}): EntityConfig {
  const earth = defaultCelestialBodyProvider.getCelestialBody(EARTH_ID);
  if (!earth) throw new Error(`Missing celestial body: ${EARTH_ID}`);
  return createOrbitingSpacecraftEntity({
    altitudeMeters: SPACECRAFT_START_ALTITUDE_M,
    anchorBody: earth,
    color: getMultiplayerSpacecraftColor(index),
    densityKgPerM3: SPACECRAFT_DENSITY_KG_PER_M3,
    id,
    meshScale: SPACECRAFT_MESH_SCALE,
    ringCount: entityCount,
    ringIndex: index,
  });
}

function createDefaultAssignableEntityIds(count: number): EntityId[] {
  const ids = ["ship:blue", "ship:red"];
  for (let index = ids.length; index < count; index++) {
    ids.push(`ship:${index + 1}`);
  }
  return ids;
}

function getMultiplayerSpacecraftColor(index: number) {
  if (index === 0) return { r: 0, g: 255, b: 255 };
  if (index === 1) return { r: 255, g: 64, b: 64 };
  return { r: 0, g: 255, b: 255 };
}
