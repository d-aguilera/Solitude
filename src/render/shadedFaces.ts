import type { DomainCameraPose } from "../app/appPorts.js";
import type { PointLight, SceneObject } from "../appScene/appScenePorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { CameraService } from "../scene/CameraService.js";
import { ProjectionService } from "../scene/ProjectionService.js";
import { toRenderable } from "../scene/renderPrep.js";
import type { SceneObjectWithCache } from "../scene/sceneInternals.js";
import type { NdcPoint } from "../scene/scenePorts.js";
import { ndcToScreen } from "./ndcToScreen.js";
import type { FaceEntry } from "./renderPorts.js";

// E = I / (4π r²) at 1 AU from the Sun.
const SUN_LUMINOSITY = 3.828e26; // W
const AU = 1.495978707e11; // m
const EARTH_ORBIT_RADIUS_2 = AU * AU;
const E_SUN_AT_EARTH = SUN_LUMINOSITY / (4 * Math.PI * EARTH_ORBIT_RADIUS_2);

/**
 * Build the list of shaded triangle faces (with depth and lighting information)
 * for all non-wireframe objects in the scene.
 */
export function buildShadedFaces(params: {
  objects: SceneObject[];
  camera: DomainCameraPose;
  canvasWidth: number;
  canvasHeight: number;
  lights: PointLight[];
  frameId: number;
}): FaceEntry[] {
  const { objects, camera, canvasWidth, canvasHeight, lights, frameId } =
    params;

  const projectionService = new ProjectionService(
    camera,
    canvasWidth,
    canvasHeight,
  );

  const cameraService = new CameraService(camera, frameId);

  const faceList: FaceEntry[] = [];

  objects.forEach((obj) => {
    if (obj.wireframeOnly) return;

    const { mesh, worldPoints, baseColor } = toRenderable(obj);
    const { faces, faceNormals } = mesh;

    // Prepare camera-space cache once per object & frame
    const cameraPoints = cameraService.getCameraPointsForObject(
      obj,
      worldPoints,
    );

    const worldFaceNormals = getWorldFaceNormalsForObject(
      obj,
      faceNormals,
      frameId,
    );

    for (let fi = 0; fi < faces.length; fi++) {
      const [i0, i1, i2] = faces[fi];
      const v0 = worldPoints[i0];
      const v1 = worldPoints[i1];
      const v2 = worldPoints[i2];

      let n: Vec3;

      if (worldFaceNormals) {
        // Use precomputed world-space face normal
        n = worldFaceNormals[fi];
      } else {
        // Fallback for meshes without precomputed normals (ship)
        const e1 = vec3.sub(v1, v0);
        const e2 = vec3.sub(v2, v0);
        n = vec3.normalize(vec3.cross(e1, e2));
      }

      if (obj.backFaceCulling) {
        const toCamera = vec3.sub(camera.position, v0);
        const facing = vec3.dot(n, toCamera);
        if (facing <= 0) continue;
      }

      // Camera-space vertices
      const c0 = cameraPoints[i0];
      const c1 = cameraPoints[i1];
      const c2 = cameraPoints[i2];

      const clipped = cameraService.clipTriangleAgainstNearPlaneCamera(
        c0,
        c1,
        c2,
      );
      if (clipped.length === 0) continue;

      const isStar = obj.kind === "star";

      for (const [A, B, C] of clipped) {
        const ndc0 = projectionFromCamera(projectionService, A);
        const ndc1 = projectionFromCamera(projectionService, B);
        const ndc2 = projectionFromCamera(projectionService, C);

        const p0 = ndcToScreen(ndc0, canvasWidth, canvasHeight);
        const p1 = ndcToScreen(ndc1, canvasWidth, canvasHeight);
        const p2 = ndcToScreen(ndc2, canvasWidth, canvasHeight);

        const d0 = p0.depth;
        const d1 = p1.depth;
        const d2 = p2.depth;
        const avgDepth = (d0 + d1 + d2) / 3;

        const intensity = isStar
          ? 1
          : toneMapIrradiance(computeIrradianceAtPoint(v0, n, lights));

        faceList.push({
          intensity,
          depth: avgDepth,
          p0,
          p1,
          p2,
          baseColor,
        });
      }
    }
  });

  return faceList;
}

function projectionFromCamera(
  projectionService: ProjectionService,
  cameraPoint: Vec3,
): NdcPoint {
  return projectionService.projectCameraPointToNdc(cameraPoint);
}

function getWorldFaceNormalsForObject(
  obj: SceneObject,
  meshFaceNormals: Vec3[] | undefined,
  frameId: number,
): Vec3[] | undefined {
  if (!meshFaceNormals) return undefined;

  const cachedObj = obj as SceneObjectWithCache;

  if (
    cachedObj.__worldFaceNormalsCache &&
    cachedObj.__faceNormalsFrameId === frameId
  ) {
    return cachedObj.__worldFaceNormalsCache;
  }

  const nFaces = meshFaceNormals.length;
  let cache = cachedObj.__worldFaceNormalsCache;
  if (!cache || cache.length !== nFaces) {
    cache = new Array<Vec3>(nFaces);
    for (let i = 0; i < nFaces; i++) {
      cache[i] = { x: 0, y: 0, z: 0 };
    }
    cachedObj.__worldFaceNormalsCache = cache;
  }

  const R = obj.orientation;
  const r00 = R[0][0],
    r01 = R[0][1],
    r02 = R[0][2];
  const r10 = R[1][0],
    r11 = R[1][1],
    r12 = R[1][2];
  const r20 = R[2][0],
    r21 = R[2][1],
    r22 = R[2][2];

  for (let i = 0; i < nFaces; i++) {
    const m = meshFaceNormals[i];
    const out = cache[i];
    const nx = m.x,
      ny = m.y,
      nz = m.z;

    out.x = r00 * nx + r01 * ny + r02 * nz;
    out.y = r10 * nx + r11 * ny + r12 * nz;
    out.z = r20 * nx + r21 * ny + r22 * nz;
  }

  cachedObj.__faceNormalsFrameId = frameId;
  return cache;
}

function computeIrradianceAtPoint(
  p: Vec3,
  n: Vec3,
  lights: PointLight[],
): number {
  if (lights.length === 0) return 0;

  let E = 0;

  // Very simple Lambertian irradiance from point lights:
  //   E = Σ (I / (4π r²)) * max(0, cosθ)
  // Here, I is luminosity-like (W or scaled W), r is distance in meters,
  // and n·L = cosθ is the Lambertian term.
  for (const light of lights) {
    const toLight = vec3.sub(light.position, p);
    const r2 = vec3.dot(toLight, toLight);
    if (r2 === 0) continue;

    const r = Math.sqrt(r2);
    const invR = 1 / r;
    const L = vec3.scale(toLight, invR);
    const ndotl = vec3.dot(n, L);
    if (ndotl <= 0) continue;

    const I = light.intensity; // luminosity-like
    const Ei = (I / (4 * Math.PI * r2)) * ndotl;
    E += Ei;
  }

  return E; // in arbitrary W/m^2-like units
}

// Simple exposure/tone-mapping constants.
const EXPOSURE = 10 / E_SUN_AT_EARTH;

function toneMapIrradiance(E: number): number {
  const hdr = EXPOSURE * E;
  const mapped = hdr / (1 + hdr); // Reinhard

  // Mild gamma to lift darks
  const gamma = 1.0 / 1.3;
  const ldr = Math.pow(mapped, gamma);

  return Math.max(0, Math.min(1, ldr));
}
