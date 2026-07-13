import type { Vec3 } from "@solitude/plugin-api/math";
import { mat3 } from "@solitude/plugin-api/math";
import type {
  ExternalEntityConfig,
  ExternalPolylineSceneObject,
  ExternalRgb,
  ExternalScene,
  ExternalScenePlugin,
  ExternalWorld,
  ExternalWorldAndSceneConfig,
} from "@solitude/plugin-api/plugin";
import { updateTrajectories } from "./logic";
import { bindTrajectoryPlanToScene } from "./trajectoryBind";
import {
  buildTrajectoryPlan,
  parseTrajectoryId,
  type TrajectoryPlan,
} from "./trajectoryPlan";
import type { Trajectory } from "./types";

export function createScenePlugin(): ExternalScenePlugin {
  let trajectoryList: Trajectory[] = [];

  return {
    initScene: ({ config, scene, world }) => {
      const trajectoryPlan = buildTrajectoryPlan(world, config.entities);
      addTrajectorySceneObjects(scene, world, config, trajectoryPlan);
      trajectoryList = bindTrajectoryPlanToScene(scene, trajectoryPlan);
    },
    updateScene: ({ dtSimMillis }) => {
      updateTrajectories(dtSimMillis, trajectoryList);
    },
  };
}

function addTrajectorySceneObjects(
  scene: ExternalScene,
  world: ExternalWorld,
  config: ExternalWorldAndSceneConfig,
  trajectoryPlan: TrajectoryPlan[],
): void {
  const existingIds = new Set(scene.objects.map((object) => object.id));

  for (const entry of trajectoryPlan) {
    if (existingIds.has(entry.pathId)) continue;
    const trajectoryTarget = parseTrajectoryId(entry.pathId);
    if (!trajectoryTarget) {
      throw new Error(`Unrecognized trajectory id: ${entry.pathId}`);
    }

    const targetId = trajectoryTarget.targetId;
    const targetBody = getById(world.entityStates, targetId, "Entity state");
    const color = getTrajectoryColor(config, targetId);
    scene.objects.push(
      createPolylineSceneObject(entry.pathId, targetBody.position, color),
    );
    existingIds.add(entry.pathId);
  }
}

function getTrajectoryColor(
  config: ExternalWorldAndSceneConfig,
  id: string,
): ExternalRgb {
  if (config.entities.length > 0) {
    return getEntityRenderConfig(config.entities, id).color;
  }
  return { r: 255, g: 255, b: 255 };
}

function getEntityRenderConfig(
  configs: readonly ExternalEntityConfig[],
  id: string,
): { color: ExternalRgb } {
  const config = configs.find((item) => item.id === id)?.components.renderable;
  if (!config) {
    throw new Error(`Entity render config not found: ${id}`);
  }
  return config;
}

function createPolylineSceneObject(
  id: string,
  position: Vec3,
  color: ExternalRgb,
): ExternalPolylineSceneObject {
  return {
    applyTransform: false,
    backFaceCulling: false,
    color,
    count: 0,
    id,
    kind: "polyline",
    lineWidth: 2,
    mesh: { faces: [], points: [] },
    meshLod: { kind: "none" },
    meshScale: 1,
    meshShading: { kind: "flat" },
    orientation: mat3.identity,
    position,
    tail: -1,
    wireframeOnly: true,
  };
}

function getById<T extends { id: string }>(
  list: readonly T[],
  id: string,
  typeName: string,
): T {
  const object = list.find((item) => item.id === id);
  if (!object) {
    throw new Error(`${typeName} not found: ${id}`);
  }
  return object;
}
