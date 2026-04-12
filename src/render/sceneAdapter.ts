import type {
  PlanetRenderConfig,
  ShipRenderConfig,
  StarRenderConfig,
} from "../app/configPorts";
import type {
  PlanetSceneObject,
  Scene,
  ShipSceneObject,
  StarSceneObject,
} from "../app/scenePorts";
import type { World } from "../domain/domainPorts";

export function createSceneFromWorld(
  world: World,
  planetConfigs: (PlanetRenderConfig | StarRenderConfig)[],
  shipConfigs: ShipRenderConfig[],
): Scene {
  const scene: Scene = {
    objects: [],
    lights: [],
  };

  addPlanetsAndStarsSceneObjects(scene, world, planetConfigs);
  addShipSceneObjects(scene, world, shipConfigs);
  addLightsFromStars(scene, world);

  return scene;
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
