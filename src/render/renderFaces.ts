import type {
  DomainCameraPose,
  PointLight,
  Scene,
  SceneObject,
} from "../app/appPorts.js";
import type { RGB, Vec3 } from "../domain/domainPorts.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import { ndcToScreen } from "./ndcToScreen.js";
import { ProjectionService } from "./ProjectionService.js";
import type { NdcPoint, RenderedFace, ScreenPoint } from "./renderPorts.js";
import { toRenderable } from "./renderPrep.js";

// E = I / (4π r²) at 1 AU from the Sun.
const SUN_LUMINOSITY = 3.828e26; // W
const AU = 1.495978707e11; // m
const EARTH_ORBIT_RADIUS_2 = AU * AU;
const E_SUN_AT_EARTH = SUN_LUMINOSITY / (4 * Math.PI * EARTH_ORBIT_RADIUS_2);

export function renderFaces(
  scene: Scene,
  camera: DomainCameraPose,
  screenWidth: number,
  screenHeight: number,
  shadedFaceBuffer: RenderedFace[],
): RenderedFace[] {
  const { objects, lights } = scene;

  const faceList = buildFaces(
    objects,
    camera,
    screenWidth,
    screenHeight,
    lights,
  );

  faceList.sort((a, b) => b.depth - a.depth);

  const shadedFaces = shadeFaces(faceList, shadedFaceBuffer);

  return shadedFaces;
}

// shared scratch for fallback normals
const e1Scratch: Vec3 = vec3.zero();
const e2Scratch: Vec3 = vec3.zero();
const normalScratch: Vec3 = vec3.zero();
const toCameraScratch: Vec3 = vec3.zero();

// Grow-only scratch buffer for face entries across frames.
const faceEntryScratch: FaceEntry[] = [];

/**
 * Build the list of shaded triangle faces (with depth and lighting information)
 * for all non-wireframe objects in the scene.
 */
function buildFaces(
  objects: SceneObject[],
  camera: DomainCameraPose,
  canvasWidth: number,
  canvasHeight: number,
  lights: PointLight[],
): FaceEntry[] {
  return alloc.withName(buildFaces.name, () => {
    const projectionService = new ProjectionService(
      camera,
      canvasWidth,
      canvasHeight,
    );

    // Reuse a grow-only scratch buffer instead of allocating a fresh array.
    let faceCount = 0;

    objects.forEach((obj) => {
      if (obj.wireframeOnly) return;

      const { mesh, worldPoints, baseColor } = toRenderable(obj);
      const cameraPoints =
        projectionService.worldPointsToCameraPointsNoClip(worldPoints);
      const { faces, faceNormals } = mesh;
      const worldFaceNormals = getWorldFaceNormalsForObject(obj, faceNormals);

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
          vec3.subInto(e1Scratch, v1, v0);
          vec3.subInto(e2Scratch, v2, v0);
          vec3.crossInto(normalScratch, e1Scratch, e2Scratch);
          n = vec3.normalizeInto(normalScratch);
        }

        if (obj.backFaceCulling) {
          // toCamera = camera.position - v0
          vec3.subInto(toCameraScratch, camera.position, v0);
          const facing = vec3.dot(n, toCameraScratch);
          if (facing <= 0) continue;
        }

        // Camera-space vertices
        const c0 = cameraPoints[i0];
        const c1 = cameraPoints[i1];
        const c2 = cameraPoints[i2];

        const clipped = projectionService.clipTriangleAgainstNearPlaneCamera(
          c0,
          c1,
          c2,
        );
        if (clipped.length === 0) continue;

        const isStar = obj.kind === "star";

        for (const [A, B, C] of clipped) {
          const ndc0: NdcPoint = projectionService.projectCameraPointToNdc(A);
          const ndc1: NdcPoint = projectionService.projectCameraPointToNdc(B);
          const ndc2: NdcPoint = projectionService.projectCameraPointToNdc(C);

          const p0: ScreenPoint = ndcToScreen(ndc0, canvasWidth, canvasHeight);
          const p1: ScreenPoint = ndcToScreen(ndc1, canvasWidth, canvasHeight);
          const p2: ScreenPoint = ndcToScreen(ndc2, canvasWidth, canvasHeight);

          const d0 = p0.depth;
          const d1 = p1.depth;
          const d2 = p2.depth;
          const avgDepth = (d0 + d1 + d2) / 3;

          const intensity = isStar
            ? 1
            : toneMapIrradiance(computeIrradianceAtPoint(v0, n, lights));

          let entry = faceEntryScratch[faceCount];
          if (!entry) {
            // Growing --> append a new element.
            entry = {
              baseColor,
              depth: avgDepth,
              intensity,
              p0,
              p1,
              p2,
            };
            faceEntryScratch[faceCount] = entry;
          } else {
            // Reuse existing entry
            entry.baseColor = baseColor;
            entry.depth = avgDepth;
            entry.intensity = intensity;
            entry.p0 = p0;
            entry.p1 = p1;
            entry.p2 = p2;
          }

          faceCount++;
        }
      }
    });

    return faceEntryScratch.slice(0, faceCount);
  });
}

const objectWorldNormalScratch = new WeakMap<SceneObject, Vec3[]>();

function getWorldFaceNormalsForObject(
  obj: SceneObject,
  meshFaceNormals: Vec3[] | undefined,
): Vec3[] | undefined {
  if (!meshFaceNormals) return undefined;

  const nFaces = meshFaceNormals.length;
  let dst = objectWorldNormalScratch.get(obj);
  if (!dst || dst.length < nFaces) {
    dst = ensureNormalScratchCapacity(dst ?? [], nFaces);
    objectWorldNormalScratch.set(obj, dst);
  }

  const R = obj.orientation;
  for (let i = 0; i < nFaces; i++) {
    // reuse Vec3 slots
    mat3.mulVec3Into(dst[i], R, meshFaceNormals[i]);
  }

  return dst;
}

function ensureNormalScratchCapacity(dst: Vec3[], n: number): Vec3[] {
  for (let i = dst.length; i < n; i++) {
    dst[i] = vec3.zero();
  }
  return dst;
}

const toLightScratch: Vec3 = vec3.zero();
const Lscratch: Vec3 = vec3.zero();

function computeIrradianceAtPoint(
  p: Vec3,
  n: Vec3,
  lights: PointLight[],
): number {
  if (lights.length === 0) return 0;

  let E = 0;

  for (const light of lights) {
    // toLight = light.position - p
    vec3.subInto(toLightScratch, light.position, p);
    const r2 = vec3.dot(toLightScratch, toLightScratch);
    if (r2 === 0) continue;

    const r = Math.sqrt(r2);
    const invR = 1 / r;
    // L = toLight * invR
    vec3.scaleInto(Lscratch, invR, toLightScratch);
    const ndotl = vec3.dot(n, Lscratch);
    if (ndotl <= 0) continue;

    const I = light.intensity;
    const Ei = (I / (4 * Math.PI * r2)) * ndotl;
    E += Ei;
  }

  return E;
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

/**
 * Shade the given face list into a caller-provided grow-only scratch buffer.
 */
function shadeFaces(
  faceList: FaceEntry[],
  shadedFaceScratch: RenderedFace[],
): RenderedFace[] {
  const n = faceList.length;

  if (shadedFaceScratch.length < n) {
    shadedFaceScratch.length = n;
  }

  for (let i = 0; i < n; i++) {
    const face = faceList[i];
    const { p0, p1, p2, baseColor, intensity } = face;
    const { r: baseR, g: baseG, b: baseB } = baseColor;
    const k = 0.2 + 0.8 * intensity;
    const r = Math.round(baseR * k);
    const g = Math.round(baseG * k);
    const b = Math.round(baseB * k);

    let shaded = shadedFaceScratch[i];
    if (!shaded) {
      shaded = {
        p0,
        p1,
        p2,
        color: { r, g, b },
      };
      shadedFaceScratch[i] = shaded;
    } else {
      shaded.p0 = p0;
      shaded.p1 = p1;
      shaded.p2 = p2;
      shaded.color.r = r;
      shaded.color.g = g;
      shaded.color.b = b;
    }
  }

  return shadedFaceScratch.slice(0, n);
}

interface FaceEntry {
  baseColor: RGB;
  depth: number;
  intensity: number;
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
}
