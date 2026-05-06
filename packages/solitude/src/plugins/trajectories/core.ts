import type {
  EntityConfig,
  WorldAndSceneConfig,
} from "@solitude/engine/app/configPorts";
import type { ScenePlugin } from "@solitude/engine/app/pluginPorts";
import type {
  PolylineSceneObject,
  RGB,
  Scene,
} from "@solitude/engine/app/scenePorts";
import type { World } from "@solitude/engine/domain/domainPorts";
import { mat3 } from "@solitude/engine/domain/mat3";
import type { Vec3 } from "@solitude/engine/domain/vec3";
import { updateTrajectories } from "./logic";
import { bindTrajectoryPlanToScene } from "./trajectoryBind";
import {
  buildTrajectoryPlan,
  parseTrajectoryId,
  type TrajectoryPlan,
} from "./trajectoryPlan";
import type { Trajectory } from "./types";

export function createScenePlugin(): ScenePlugin {
  let trajectoryList: Trajectory[] = [];

  return {
    initScene: (params) => {
      const trajectoryPlan = buildTrajectoryPlan(
        params.world,
        params.config.entities,
      );
      addTrajectorySceneObjects(
        params.scene,
        params.world,
        params.config,
        trajectoryPlan,
      );
      trajectoryList = bindTrajectoryPlanToScene(params.scene, trajectoryPlan);
    },
    updateScene: (params) => {
      updateTrajectories(params.dtSimMillis, trajectoryList);
    },
  };
}

function addTrajectorySceneObjects(
  scene: Scene,
  world: World,
  config: WorldAndSceneConfig,
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
      const shipBody = getById(world.entityStates, shipId, "Entity state");
      const color = getTrajectoryColor(config, shipId, trajectoryTarget.kind);
      scene.objects.push(
        createPolylineSceneObject(entry.pathId, shipBody.position, color),
      );
    } else {
      const planetId = trajectoryTarget.targetId;
      const planetBody = getById(world.entityStates, planetId, "Entity state");
      const color = getTrajectoryColor(config, planetId, trajectoryTarget.kind);
      scene.objects.push(
        createPolylineSceneObject(entry.pathId, planetBody.position, color),
      );
    }

    existingIds.add(entry.pathId);
  }
}

function getTrajectoryColor(
  config: WorldAndSceneConfig,
  id: string,
  _kind: "planet" | "ship",
): RGB {
  if (config.entities.length > 0) {
    return getEntityRenderConfig(config.entities, id).color;
  }
  return { r: 255, g: 255, b: 255 };
}

function getEntityRenderConfig(configs: EntityConfig[], id: string) {
  const cfg = configs.find((item) => item.id === id)?.components.renderable;
  if (!cfg) {
    throw new Error(`Entity render config not found: ${id}`);
  }
  return cfg;
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
