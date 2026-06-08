import { km } from "@solitude/engine/math";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import type { EntityConfig, EntityId } from "@solitude/engine/world";
import {
  createSolitudeSessionManager,
  type SolitudeSessionManager,
} from "@solitude/server/sessions";
import {
  createSolitudeInProcessTransport,
  type SolitudeInProcessTransport,
} from "@solitude/server/transport";
import {
  controllableEntityProviderCapability,
  isControllableEntityProvider,
} from "@solitude/sim/controllableEntities/provider";
import { createPolyFighterPlugin } from "@solitude/sim/plugins/polyFighter";
import { createSolarSystemCelestialBodyProvider } from "@solitude/sim/plugins/solarSystem/celestialBodyProvider";
import { createOrbitingPlacement } from "@solitude/sim/spacecraft/orbitalPlacement";
import { createSolitudeServerGame } from "./runtime";

const DEFAULT_ASSIGNABLE_ENTITY_COUNT = 16;
const EARTH_ID = "planet:earth";
const POLY_FIGHTER_PROVIDER_ID = "polyFighter";
const SPACECRAFT_START_ALTITUDE_M = 100 * km;
const defaultCelestialBodyProvider = createSolarSystemCelestialBodyProvider();
const defaultControllableEntityProvider =
  createDefaultControllableEntityProvider();

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
  return defaultControllableEntityProvider.createEntity({
    color: getMultiplayerSpacecraftColor(index),
    id,
    placement: createOrbitingPlacement({
      altitudeMeters: SPACECRAFT_START_ALTITUDE_M,
      anchorBody: earth,
      entityMass: defaultControllableEntityProvider.mass,
      ringCount: entityCount,
      ringIndex: index,
    }),
  });
}

function createDefaultControllableEntityProvider() {
  const plugins = [createPolyFighterPlugin()];
  const capabilityRegistry = createPluginCapabilityRegistry(
    plugins.flatMap((plugin) => plugin.capabilities ?? []),
  );
  const provider = capabilityRegistry
    .getAll(controllableEntityProviderCapability)
    .filter(isControllableEntityProvider)
    .find((item) => item.id === POLY_FIGHTER_PROVIDER_ID);
  if (!provider) {
    throw new Error(
      `Missing controllable entity provider: ${POLY_FIGHTER_PROVIDER_ID}`,
    );
  }
  return provider;
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
