import type { EntityConfig, WorldAndSceneConfig } from "../app/configPorts";
import type {
  OrbitalBodySceneObject,
  Scene,
  SceneObject,
} from "../app/scenePorts";
import type {
  EntityLightEmitter,
  EntityMotionState,
  World,
} from "../domain/domainPorts";

export function createSceneFromWorld(
  world: World,
  config: WorldAndSceneConfig,
): Scene {
  const scene: Scene = {
    objects: [],
    lights: [],
  };

  addEntitySceneObjects(scene, world, config.entities);
  addLightsFromEmitters(scene, world.lightEmitters);
  return scene;
}

function addEntitySceneObjects(
  scene: Scene,
  world: World,
  entities: EntityConfig[],
): void {
  for (const entity of entities) {
    const renderable = entity.components.renderable;
    if (!renderable) continue;

    const state = getById(world.entityStates, entity.id, "Entity state");
    scene.objects.push(createEntitySceneObject(entity, state, world));
  }
}

function createEntitySceneObject(
  entity: EntityConfig,
  state: EntityMotionState,
  world: World,
): SceneObject {
  const renderable = entity.components.renderable;
  if (!renderable) {
    throw new Error(`Renderable entity config not found: ${entity.id}`);
  }

  const role = renderable.role;
  if (role === "controlledBody") {
    return {
      id: entity.id,
      kind: "controlledBody",
      mesh: renderable.mesh,
      position: state.position,
      orientation: state.orientation,
      color: renderable.color,
      lineWidth: 1,
      applyTransform: true,
      wireframeOnly: false,
      backFaceCulling: false,
    };
  }

  const body = createOrbitalBodySceneObject(entity, state);
  if (role === "lightEmitter") {
    return {
      ...body,
      kind: "lightEmitter",
      luminosity: getById(world.lightEmitters, entity.id, "Light emitter")
        .luminosity,
    };
  }
  if (role === "orbitalBody") {
    return {
      ...body,
      kind: "orbitalBody",
    };
  }

  throw new Error(`Renderable entity has unknown render role: ${entity.id}`);
}

function createOrbitalBodySceneObject(
  entity: EntityConfig,
  state: EntityMotionState,
): OrbitalBodySceneObject {
  const renderable = entity.components.renderable;
  if (!renderable) {
    throw new Error(`Renderable entity config not found: ${entity.id}`);
  }
  const entityState = entity.components.state;
  return {
    id: entity.id,
    kind: "orbitalBody",
    centralEntityId:
      entityState?.kind === "keplerian"
        ? entityState.centralEntityId
        : undefined,
    mesh: renderable.mesh,
    position: state.position,
    orientation: state.orientation,
    color: renderable.color,
    lineWidth: 1,
    applyTransform: true,
    wireframeOnly: false,
    backFaceCulling: true,
    velocity: state.velocity,
  };
}

function addLightsFromEmitters(
  scene: Scene,
  lightEmitters: EntityLightEmitter[],
): void {
  for (let i = 0; i < lightEmitters.length; i++) {
    const light = lightEmitters[i];
    scene.lights.push({
      position: light.state.position,
      intensity: light.luminosity,
    });
  }
}

function getById<T extends { id: string }>(
  list: T[],
  id: string,
  typeName: string,
): T {
  const obj = list.find((item) => item.id === id);
  if (!obj) {
    throw new Error(`${typeName} not found: ${id}`);
  }
  return obj;
}
