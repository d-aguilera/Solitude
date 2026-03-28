import type {
  PlanetRenderConfig,
  ShipRenderConfig,
  StarRenderConfig,
} from "../app/renderConfigPorts.js";
import type {
  PlanetSceneObject,
  PolylineSceneObject,
  RGB,
  Scene,
  ShipSceneObject,
  StarSceneObject,
} from "../app/scenePorts.js";
import type { World } from "../domain/domainPorts.js";
import { mat3 } from "../domain/mat3.js";
import type { Vec3 } from "../domain/vec3.js";

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

      if (cfg.pathId) {
        scene.objects.push(
          createPolylineSceneObject(cfg.pathId, planetBody.position, cfg.color),
        );
      }
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

    const pathId = "path:" + shipBody.id;
    scene.objects.push(
      createPolylineSceneObject(pathId, shipBody.position, cfg.color),
    );
  }
}

function createPolylineSceneObject(
  id: string,
  position: Vec3,
  color: RGB,
): PolylineSceneObject {
  return {
    id,
    kind: "polyline",
    mesh: { points: [], faces: [] },
    position, // alias
    orientation: mat3.identity,
    color,
    lineWidth: 2,
    wireframeOnly: true,
    applyTransform: false, // polylines are already in world space
    backFaceCulling: false,
    count: 0,
    tail: -1,
  };
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
