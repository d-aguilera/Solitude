import type { SceneObject } from "../../renderPorts/scenePorts.js";
import type { Vec3 } from "../../domain/domainPorts.js";

// Renderer-side cache; may be attached to any SceneObject.
export type SceneObjectWithCache = SceneObject & {
  __worldPointsCache?: Vec3[];
  __cameraPointsCache?: Vec3[];
  __cameraCacheFrameId?: number;
  __worldFaceNormalsCache?: Vec3[];
  __faceNormalsFrameId?: number;
};
