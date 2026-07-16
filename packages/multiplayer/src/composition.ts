import {
  controllableEntityProviderCapability,
  isControllableEntityProvider,
  type ControllableEntityProvider,
} from "@solitude/engine/controllable-entities";
import { km } from "@solitude/engine/math";
import { loadPlugins, type RuntimeOptions } from "@solitude/engine/plugin";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import type { EntityConfig, EntityId } from "@solitude/engine/world";
import {
  appendExternalPluginSet,
  type ExternalPluginSet,
} from "@solitude/plugin-runtime";
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
import { simPluginCatalog } from "@solitude/sim/plugins/catalog";
import { createOrbitingPlacement } from "@solitude/sim/spacecraft/orbitalPlacement";
import { createSolitudeServerGame } from "./runtime";

const DEFAULT_ASSIGNABLE_ENTITY_COUNT = 16;
const EARTH_ID = "planet:earth";
const SPACECRAFT_START_ALTITUDE_M = 25_000 * km;
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
  contentPlugins: DefaultMultiplayerContentPluginSet,
  runtimeOptions: RuntimeOptions,
): SolitudeInProcessTransport {
  return createSolitudeInProcessTransport(
    createDefaultSolitudeSessionManager(contentPlugins, runtimeOptions),
  );
}

export function createDefaultSolitudeSessionManager(
  contentPlugins: DefaultMultiplayerContentPluginSet,
  runtimeOptions: RuntimeOptions,
): SolitudeSessionManager {
  const assignableEntityIds = createDefaultAssignableEntityIds(
    DEFAULT_ASSIGNABLE_ENTITY_COUNT,
  );
  const spawnProviders = createDefaultMultiplayerSpawnProviders(
    contentPlugins,
    runtimeOptions,
  );
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

export type DefaultMultiplayerContentPluginSet = ExternalPluginSet;

export function createDefaultMultiplayerSpawnProviders(
  contentPlugins: DefaultMultiplayerContentPluginSet,
  runtimeOptions: RuntimeOptions,
): DefaultMultiplayerSpawnProviders {
  const plugins = createDefaultMultiplayerContentPlugins(
    contentPlugins,
    runtimeOptions,
  );
  const capabilityRegistry = createPluginCapabilityRegistry(plugins);
  const celestialBodyProvider = capabilityRegistry
    .getAll(celestialBodyProviderCapability)
    .find(isCelestialBodyProvider);
  if (!celestialBodyProvider) {
    throw new Error("Missing celestial body provider");
  }

  const controllableEntityProviders = capabilityRegistry
    .getAll(controllableEntityProviderCapability)
    .filter(isControllableEntityProvider);
  if (controllableEntityProviders.length > 1) {
    const providers = controllableEntityProviders.map((p) => p.id);
    throw new Error(
      `Expected exactly one controllable entity provider, found [${providers.join(", ")}]`,
    );
  } else if (controllableEntityProviders.length === 0) {
    throw new Error("Missing controllable entity provider");
  }
  const controllableEntityProvider = controllableEntityProviders[0];

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

function createDefaultMultiplayerContentPlugins(
  contentPlugins: DefaultMultiplayerContentPluginSet,
  runtimeOptions: RuntimeOptions,
) {
  const composed = appendExternalPluginSet(
    { solarSystem: simPluginCatalog.solarSystem },
    ["solarSystem"],
    contentPlugins,
  );
  return loadPlugins({
    catalog: composed.catalog,
    ids: composed.ids,
    runtimeOptions,
  });
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
