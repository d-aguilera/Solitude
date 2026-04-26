import type {
  EntityConfig,
  PlanetRenderConfig,
  ShipRenderConfig,
  StarRenderConfig,
  WorldAndSceneConfig,
} from "../app/configPorts";
import type {
  CelestialBodySceneObject,
  PlanetSceneObject,
  Scene,
  SceneObject,
  ShipSceneObject,
  StarSceneObject,
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

  if (config.entities.length > 0) {
    addEntitySceneObjects(scene, world, config.entities);
    addLightsFromEmitters(scene, world.lightEmitters);
    return scene;
  }

  addPlanetsAndStarsSceneObjects(scene, world, config.render.planets);
  addShipSceneObjects(scene, world, config.render.ships);
  addLightsFromStars(scene, world);

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

  const kind = entity.metadata?.legacyKind;
  if (kind === "ship") {
    return {
      id: entity.id,
      kind: "ship",
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

  const celestial = createCelestialSceneObject(entity, state);
  if (kind === "star") {
    return {
      ...celestial,
      kind: "star",
      luminosity: getById(world.lightEmitters, entity.id, "Light emitter")
        .luminosity,
    };
  }
  if (kind === "planet") {
    return {
      ...celestial,
      kind: "planet",
    };
  }

  throw new Error(
    `Renderable entity is missing legacy render kind: ${entity.id}`,
  );
}

function createCelestialSceneObject(
  entity: EntityConfig,
  state: EntityMotionState,
): CelestialBodySceneObject {
  const renderable = entity.components.renderable;
  if (!renderable) {
    throw new Error(`Renderable entity config not found: ${entity.id}`);
  }
  const entityState = entity.components.state;
  return {
    id: entity.id,
    kind: "planet",
    centralBodyId:
      entityState?.kind === "keplerian" ? entityState.centralBodyId : undefined,
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

function addPlanetsAndStarsSceneObjects(
  scene: Scene,
  world: World,
  configs: (PlanetRenderConfig | StarRenderConfig)[],
): void {
  for (const cfg of configs) {
    if (cfg.kind === "star") {
      const starBody = getById(world.stars, cfg.id, "Star");
      const starPhysics = getById(world.starPhysics, cfg.id, "Star physics");
      const sceneObj: StarSceneObject = {
        id: cfg.id,
        kind: "star",
        centralBodyId: cfg.centralBodyId,
        mesh: cfg.mesh,
        position: starBody.position, // alias
        orientation: starBody.orientation, // alias
        color: cfg.color,
        lineWidth: 1,
        applyTransform: true,
        wireframeOnly: false,
        backFaceCulling: true,
        velocity: starBody.velocity, // alias
        luminosity: starPhysics.luminosity,
      };
      scene.objects.push(sceneObj);
    } else {
      const planetBody = getById(world.planets, cfg.id, "Planet");
      const sceneObj: PlanetSceneObject = {
        id: cfg.id,
        kind: "planet",
        centralBodyId: cfg.centralBodyId,
        mesh: cfg.mesh,
        position: planetBody.position, // alias
        orientation: planetBody.orientation, // alias
        color: cfg.color,
        lineWidth: 1,
        applyTransform: true,
        wireframeOnly: false,
        backFaceCulling: true,
        velocity: planetBody.velocity, // alias
      };
      scene.objects.push(sceneObj);
    }
  }
}

function addShipSceneObjects(
  scene: Scene,
  world: World,
  configs: ShipRenderConfig[],
): void {
  for (const cfg of configs) {
    const shipBody = getById(world.ships, cfg.id, "Ship");
    const sceneObj: ShipSceneObject = {
      id: shipBody.id,
      kind: "ship",
      mesh: cfg.mesh,
      position: shipBody.position, // alias
      orientation: shipBody.orientation, // alias
      color: cfg.color,
      lineWidth: 1,
      applyTransform: true,
      wireframeOnly: false,
      backFaceCulling: false,
    };
    scene.objects.push(sceneObj);
  }
}

function addLightsFromStars(scene: Scene, world: World): void {
  const count = world.stars.length;
  for (let i = 0; i < count; i++) {
    const starBody = world.stars[i];
    const starPhysics = world.starPhysics[i];
    scene.lights.push({
      position: starBody.position, // alias
      intensity: starPhysics.luminosity,
    });
  }
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
