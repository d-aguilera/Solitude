import type { EntityConfig, EntityId } from "./entityConfigPorts";

export interface EntityConfigIndex {
  axialSpinEntityIds: EntityId[];
  byId: Map<EntityId, EntityConfig>;
  collisionSphereEntityIds: EntityId[];
  controllableEntityIds: EntityId[];
  gravityMassEntityIds: EntityId[];
  lightEmitterEntityIds: EntityId[];
  renderableEntityIds: EntityId[];
}

export function buildEntityConfigIndex(
  entities: EntityConfig[],
): EntityConfigIndex {
  const index: EntityConfigIndex = {
    axialSpinEntityIds: [],
    byId: new Map(),
    collisionSphereEntityIds: [],
    controllableEntityIds: [],
    gravityMassEntityIds: [],
    lightEmitterEntityIds: [],
    renderableEntityIds: [],
  };

  for (const entity of entities) {
    if (!entity.id) {
      throw new Error("Entity config is missing id");
    }
    if (index.byId.has(entity.id)) {
      throw new Error(`Duplicate entity config id: ${entity.id}`);
    }

    index.byId.set(entity.id, entity);
    const components = entity.components;
    if (components.axialSpin) index.axialSpinEntityIds.push(entity.id);
    if (components.collisionSphere) {
      index.collisionSphereEntityIds.push(entity.id);
    }
    if (components.controllable) index.controllableEntityIds.push(entity.id);
    if (components.gravityMass) index.gravityMassEntityIds.push(entity.id);
    if (components.lightEmitter) index.lightEmitterEntityIds.push(entity.id);
    if (components.renderable) index.renderableEntityIds.push(entity.id);
  }

  return index;
}
