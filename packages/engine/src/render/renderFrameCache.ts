import type { Scene, SceneObject } from "../app/scenePorts";
import { mat3 } from "../domain/mat3";
import { type Vec3, vec3 } from "../domain/vec3";
import { profiler } from "../global/profiling";

export interface RenderFrameCache {
  frameId: number;
  entries: WeakMap<SceneObject, RenderCacheEntry>;
}

interface RenderCacheEntry {
  worldPoints: Vec3[];
  worldFaceNormals?: Vec3[];
  pointsFrameId: number;
  normalsFrameId: number;
}

export function createRenderFrameCache(): RenderFrameCache {
  return {
    frameId: 0,
    entries: new WeakMap(),
  };
}

export function updateRenderFrameCache(
  cache: RenderFrameCache,
  _scene: Scene,
): void {
  // Transform caches are populated lazily by render passes after this frame tick.
  cache.frameId++;
}

export function getCachedWorldPoints(
  cache: RenderFrameCache,
  obj: SceneObject,
): Vec3[] {
  if (!obj.applyTransform) return obj.mesh.points;
  return ensureWorldPoints(cache, obj);
}

export function getCachedWorldFaceNormals(
  cache: RenderFrameCache,
  obj: SceneObject,
): Vec3[] | undefined {
  const srcNormals = obj.mesh.faceNormals;
  if (!srcNormals) return undefined;
  if (!obj.applyTransform) return srcNormals;
  return ensureWorldFaceNormals(cache, obj);
}

function ensureWorldPoints(cache: RenderFrameCache, obj: SceneObject): Vec3[] {
  const entry = getOrCreateEntry(cache, obj);
  if (entry.pointsFrameId === cache.frameId) {
    return entry.worldPoints;
  }

  const srcPoints = obj.mesh.points;
  const dst = ensureVec3ArrayCapacity(entry.worldPoints, srcPoints.length);

  const orientation = obj.orientation;
  const position = obj.position;
  for (let i = 0; i < srcPoints.length; i++) {
    const wp = dst[i];
    mat3.mulVec3Into(wp, orientation, srcPoints[i]);
    vec3.addInto(wp, wp, position);
  }

  profiler.increment("renderCache", "objectsTransformed");
  profiler.increment("renderCache", "worldPointTransforms", srcPoints.length);

  entry.pointsFrameId = cache.frameId;
  return dst;
}

function ensureWorldFaceNormals(
  cache: RenderFrameCache,
  obj: SceneObject,
): Vec3[] | undefined {
  const srcNormals = obj.mesh.faceNormals;
  if (!srcNormals) return undefined;

  const entry = getOrCreateEntry(cache, obj);
  if (entry.normalsFrameId === cache.frameId && entry.worldFaceNormals) {
    return entry.worldFaceNormals;
  }

  const dst = ensureVec3ArrayCapacity(
    entry.worldFaceNormals ?? [],
    srcNormals.length,
  );
  const R = obj.orientation;
  for (let i = 0; i < srcNormals.length; i++) {
    mat3.mulVec3Into(dst[i], R, srcNormals[i]);
  }

  profiler.increment("renderCache", "worldNormalTransforms", srcNormals.length);

  entry.worldFaceNormals = dst;
  entry.normalsFrameId = cache.frameId;
  return dst;
}

function getOrCreateEntry(
  cache: RenderFrameCache,
  obj: SceneObject,
): RenderCacheEntry {
  let entry = cache.entries.get(obj);
  if (!entry) {
    entry = {
      worldPoints: [],
      pointsFrameId: -1,
      normalsFrameId: -1,
    };
    cache.entries.set(obj, entry);
  }
  return entry;
}

function ensureVec3ArrayCapacity(dst: Vec3[], n: number): Vec3[] {
  for (let i = dst.length; i < n; i++) {
    dst[i] = vec3.zero();
  }
  return dst;
}
