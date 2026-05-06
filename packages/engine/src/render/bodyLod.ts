import type {
  BodySceneObject,
  LightEmitterSceneObject,
  SceneObject,
} from "../app/scenePorts";
import { ProjectionService } from "./ProjectionService";
import { getBodyDiameterWorld } from "./bodyDiameterCache";

const onePixelDepthScratch = new WeakMap<
  BodySceneObject | LightEmitterSceneObject,
  { screenHeight: number; depth: number }
>();

export function isBodyAtOrBeyondOnePixelThreshold(
  obj: SceneObject,
  projectionService: ProjectionService,
  screenHeight: number,
): boolean {
  if (obj.kind !== "orbitalBody" && obj.kind !== "lightEmitter") return false;

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
  obj: BodySceneObject | LightEmitterSceneObject,
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
