import { Mesh, RGB, Vec3 } from "../../world/domain";
import { SceneObject } from "../../world/types";

export interface Renderable {
  mesh: Mesh;
  worldPoints: Vec3[];
  lineWidth: number;
  baseColor: RGB;
}

// Renderer-side cache; may be attached to any SceneObject.
export type SceneObjectWithCache = SceneObject & {
  __worldPointsCache?: Vec3[];
  __cameraPointsCache?: Vec3[];
  __cameraCacheFrameId?: number;
  __worldFaceNormalsCache?: Vec3[];
  __faceNormalsFrameId?: number;
};
