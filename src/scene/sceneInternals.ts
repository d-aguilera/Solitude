import { Vec3 } from "../domain/domainPorts.js";
import { SceneObject } from "../render/scenePorts.js";

// Renderer-side cache; may be attached to any SceneObject.
export type SceneObjectWithCache = SceneObject & {
  __worldPointsCache?: Vec3[];
  __cameraPointsCache?: Vec3[];
  __cameraCacheFrameId?: number;
  __worldFaceNormalsCache?: Vec3[];
  __faceNormalsFrameId?: number;
};
