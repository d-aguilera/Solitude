import type {
  PlanetSceneObject,
  SceneObject,
  StarSceneObject,
} from "../app/scenePorts.js";
import { ProjectionService } from "./ProjectionService.js";
import { getBodyDiameterWorld } from "./bodyDiameterCache.js";

const onePixelDepthScratch = new WeakMap<
  PlanetSceneObject | StarSceneObject,
  { screenHeight: number; depth: number }
>();

export function isBodyAtOrBeyondOnePixelThreshold(
  obj: SceneObject,
  projectionService: ProjectionService,
  screenHeight: number,
): boolean {
  if (obj.kind !== "planet" && obj.kind !== "star") return false;

  const centerDepth = projectionService.getCameraDepthForWorldPoint(
    obj.position,
  );
  if (!Number.isFinite(centerDepth) || centerDepth <= 0) return false;

  return (
    centerDepth >=
    getOnePixelDepthForObject(obj, projectionService, screenHeight)
  );
}

function getOnePixelDepthForObject(
  obj: PlanetSceneObject | StarSceneObject,
  projectionService: ProjectionService,
  screenHeight: number,
): number {
  const cached = onePixelDepthScratch.get(obj);
  if (cached && cached.screenHeight === screenHeight) {
    return cached.depth;
  }

  const diameterWorld = getBodyDiameterWorld(obj);
  const depth = projectionService.depthForProjectedDiameterPixels(
    diameterWorld,
    1,
    screenHeight,
  );

  onePixelDepthScratch.set(obj, { screenHeight, depth });
  return depth;
}
