import { km } from "@solitude/engine/math";
import type { RuntimeOptions } from "@solitude/engine/plugin";
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
  celestialBodyProviderCapability,
  isCelestialBodyProvider,
  type CelestialBodyProvider,
} from "@solitude/sim/celestialBodies/provider";
import {
  controllableEntityProviderCapability,
  type ControllableEntityProvider,
  isControllableEntityProvider,
} from "@solitude/sim/controllableEntities/provider";
import { createPolyFighterPlugin } from "@solitude/sim/plugins/polyFighter";
import { createSolarSystemPlugin } from "@solitude/sim/plugins/solarSystem";
import { createOrbitingPlacement } from "@solitude/sim/spacecraft/orbitalPlacement";
import { createSolitudeServerGame } from "./runtime";

const DEFAULT_ASSIGNABLE_ENTITY_COUNT = 16;
const EARTH_ID = "planet:earth";
const POLY_FIGHTER_PROVIDER_ID = "polyFighter";
const SPACECRAFT_START_ALTITUDE_M = 100 * km;
const multiplayerSpacecraftColors = [
  { r: 64, g: 180, b: 255 },
  { r: 255, g: 80, b: 80 },
  { r: 255, g: 210, b: 64 },
  { r: 90, g: 220, b: 125 },
  { r: 190, g: 135, b: 255 },
  { r: 255, g: 145, b: 60 },
  { r: 255, g: 105, b: 190 },
  { r: 220, g: 240, b: 255 },
  { r: 80, g: 230, b: 215 },
  { r: 180, g: 235, b: 80 },
  { r: 120, g: 155, b: 255 },
  { r: 255, g: 180, b: 135 },
  { r: 155, g: 235, b: 255 },
  { r: 240, g: 150, b: 255 },
  { r: 210, g: 190, b: 150 },
  { r: 150, g: 255, b: 170 },
] as const;

export function createDefaultSolitudeInProcessTransport(
  runtimeOptions: RuntimeOptions = {},
): SolitudeInProcessTransport {
  return createSolitudeInProcessTransport(
    createDefaultSolitudeSessionManager(runtimeOptions),
  );
}

export function createDefaultSolitudeSessionManager(
  runtimeOptions: RuntimeOptions = {},
): SolitudeSessionManager {
  const assignableEntityIds = createDefaultAssignableEntityIds(
    DEFAULT_ASSIGNABLE_ENTITY_COUNT,
  );
  const spawnProviders = createDefaultMultiplayerSpawnProviders(runtimeOptions);
  return createSolitudeSessionManager({
    assignableEntityIds,
    createAssignableEntity: (id, index) =>
      createDefaultMultiplayerSpacecraftEntity({
        ...spawnProviders,
        entityCount: assignableEntityIds.length,
        id,
        index,
      }),
    createGame: (initialEntities) =>
      createSolitudeServerGame(initialEntities, runtimeOptions),
    nowMillis: Date.now,
    runtimeOptions,
  });
}

export interface DefaultMultiplayerSpawnProviders {
  celestialBodyProvider: CelestialBodyProvider;
  controllableEntityProvider: ControllableEntityProvider;
}

export function createDefaultMultiplayerSpawnProviders(
  runtimeOptions: RuntimeOptions,
): DefaultMultiplayerSpawnProviders {
  const plugins = createDefaultMultiplayerContentPlugins(runtimeOptions);
  const capabilityRegistry = createPluginCapabilityRegistry(
    plugins.flatMap((plugin) => plugin.capabilities ?? []),
  );
  const celestialBodyProvider = capabilityRegistry
    .getAll(celestialBodyProviderCapability)
    .find(isCelestialBodyProvider);
  if (!celestialBodyProvider) {
    throw new Error("Missing celestial body provider");
  }

  const controllableEntityProvider = capabilityRegistry
    .getAll(controllableEntityProviderCapability)
    .filter(isControllableEntityProvider)
    .find((item) => item.id === POLY_FIGHTER_PROVIDER_ID);
  if (!controllableEntityProvider) {
    throw new Error(
      `Missing controllable entity provider: ${POLY_FIGHTER_PROVIDER_ID}`,
    );
  }

  return {
    celestialBodyProvider,
    controllableEntityProvider,
  };
}

export function createDefaultMultiplayerSpacecraftEntity({
  celestialBodyProvider,
  controllableEntityProvider,
  entityCount,
  id,
  index,
}: {
  celestialBodyProvider: CelestialBodyProvider;
  controllableEntityProvider: ControllableEntityProvider;
  entityCount: number;
  id: EntityId;
  index: number;
}): EntityConfig {
  const earth = celestialBodyProvider.getCelestialBody(EARTH_ID);
  if (!earth) throw new Error(`Missing celestial body: ${EARTH_ID}`);
  const entity = controllableEntityProvider.createEntity({
    color: getMultiplayerSpacecraftColor(index),
    id,
    placement: createOrbitingPlacement({
      altitudeMeters: SPACECRAFT_START_ALTITUDE_M,
      anchorBody: earth,
      entityMass: controllableEntityProvider.mass,
      ringCount: entityCount,
      ringIndex: index,
    }),
  });
  return entity;
}

function createDefaultMultiplayerContentPlugins(runtimeOptions: RuntimeOptions) {
  return [createSolarSystemPlugin(runtimeOptions), createPolyFighterPlugin()];
}

function createDefaultAssignableEntityIds(count: number): EntityId[] {
  const ids = [];
  for (let index = ids.length; index < count; index++) {
    ids.push(`ship:${index + 1}`);
  }
  return ids;
}

function getMultiplayerSpacecraftColor(index: number) {
  return multiplayerSpacecraftColors[
    index % multiplayerSpacecraftColors.length
  ];
}
