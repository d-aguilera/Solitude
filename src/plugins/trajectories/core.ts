import type {
  PlanetRenderConfig,
  ShipRenderConfig,
  StarRenderConfig,
} from "../../app/configPorts";
import type { ScenePlugin } from "../../app/pluginPorts";
import type { Trajectory } from "../../app/runtimePorts";
import type { PolylineSceneObject, RGB, Scene } from "../../app/scenePorts";
import type { World } from "../../domain/domainPorts";
import { mat3 } from "../../domain/mat3";
import type { Vec3 } from "../../domain/vec3";
import { updateTrajectories } from "./logic";
import { bindTrajectoryPlanToScene } from "./trajectoryBind";
import {
  buildTrajectoryPlan,
  parseTrajectoryId,
  TRAJECTORY_ID_PREFIX,
  type TrajectoryPlan,
} from "./trajectoryPlan";

export function createScenePlugin(): ScenePlugin {
  let trajectoryList: Trajectory[] = [];

  return {
    initScene: ({ scene, world, config }) => {
      const trajectoryPlan = buildTrajectoryPlan(world, config.physics.planets);
      addTrajectorySceneObjects(
        scene,
        world,
        config.render.planets,
        config.render.ships,
        trajectoryPlan,
      );
      trajectoryList = bindTrajectoryPlanToScene(scene, trajectoryPlan);
    },
    updateScene: ({ dtSimMillis }) => {
      updateTrajectories(dtSimMillis, trajectoryList);
    },
    getViewObjectsFilter: ({ viewId }) => {
      if (viewId !== "top") return null;
      return (obj) =>
        obj.kind !== "polyline" || !obj.id.startsWith(TRAJECTORY_ID_PREFIX);
    },
  };
}

function addTrajectorySceneObjects(
  scene: Scene,
  world: World,
  planetConfigs: (PlanetRenderConfig | StarRenderConfig)[],
  shipConfigs: ShipRenderConfig[],
  trajectoryPlan: TrajectoryPlan[],
): void {
  const existingIds = new Set(scene.objects.map((obj) => obj.id));

  for (const entry of trajectoryPlan) {
    if (existingIds.has(entry.pathId)) continue;
    const trajectoryTarget = parseTrajectoryId(entry.pathId);
    if (!trajectoryTarget) {
      throw new Error(`Unrecognized trajectory id: ${entry.pathId}`);
    }

    if (trajectoryTarget.kind === "ship") {
      const shipId = trajectoryTarget.targetId;
      const shipBody = getById(world.ships, shipId, "Ship");
      const shipConfig = getShipRenderConfig(shipConfigs, shipId);
      scene.objects.push(
        createPolylineSceneObject(
          entry.pathId,
          shipBody.position,
          shipConfig.color,
        ),
      );
    } else {
      const planetId = trajectoryTarget.targetId;
      const planetBody = getById(world.planets, planetId, "Planet");
      const planetConfig = getPlanetRenderConfig(planetConfigs, planetId);
      scene.objects.push(
        createPolylineSceneObject(
          entry.pathId,
          planetBody.position,
          planetConfig.color,
        ),
      );
    }

    existingIds.add(entry.pathId);
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

function getShipRenderConfig(
  configs: ShipRenderConfig[],
  id: string,
): ShipRenderConfig {
  const cfg = configs.find((item) => item.id === id);
  if (!cfg) {
    throw new Error(`Ship render config not found: ${id}`);
  }
  return cfg;
}

function getPlanetRenderConfig(
  configs: (PlanetRenderConfig | StarRenderConfig)[],
  id: string,
): PlanetRenderConfig {
  const cfg = configs.find(
    (item) => item.kind === "planet" && item.id === id,
  ) as PlanetRenderConfig | undefined;
  if (!cfg) {
    throw new Error(`Planet render config not found: ${id}`);
  }
  return cfg;
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
