import type {
  DomainCameraPose,
  PointLight,
  RGB,
  Scene,
  SceneObject,
} from "../app/scenePorts";
import { AU } from "../domain/units";
import { type Vec3, vec3 } from "../domain/vec3";
import { alloc } from "../global/allocProfiler";
import { isBodyAtOrBeyondOnePixelThreshold } from "./bodyLod";
import { type NdcPoint, ndc } from "./ndc";
import { ProjectionService } from "./ProjectionService";
import type { RenderFrameCache } from "./renderFrameCache";
import {
  getCachedWorldFaceNormals,
  getCachedWorldPoints,
} from "./renderFrameCache";
import type { RenderedFace } from "./renderPorts";
import { type ScreenPoint, scrn } from "./scrn";
import { sortRangeInPlace } from "./sortRange";

// E = I / (4π r²) at 1 AU from the Sun.
const SUN_LUMINOSITY = 3.828e26; // W
const EARTH_ORBIT_RADIUS_2 = AU * AU;
const E_SUN_AT_EARTH = SUN_LUMINOSITY / (4 * Math.PI * EARTH_ORBIT_RADIUS_2);

export function renderFacesInto(
  into: RenderedFace[],
  scene: Scene,
  camera: DomainCameraPose,
  screenWidth: number,
  screenHeight: number,
  renderCache: RenderFrameCache,
  objectsFilter?: (obj: SceneObject) => boolean,
  sortFaces: boolean = true,
  projectionService?: ProjectionService,
): number {
  const projection =
    projectionService ??
    new ProjectionService(camera, screenWidth, screenHeight);

  const faceList = buildFaces(
    scene.objects,
    camera,
    screenWidth,
    screenHeight,
    scene.lights,
    renderCache,
    projection,
    objectsFilter,
  );

  if (sortFaces) {
    sortRangeInPlace(faceEntryScratch, faceList, compareFaceDepthDesc);
  }

  shadeFacesInto(into, faceList);

  return faceList;
}

// shared scratch for fallback normals
const e1Scratch: Vec3 = vec3.zero();
const e2Scratch: Vec3 = vec3.zero();
const normalScratch: Vec3 = vec3.zero();
const toCameraScratch: Vec3 = vec3.zero();

const clipped: [
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
] = [
  [vec3.zero(), vec3.zero(), vec3.zero()],
  [vec3.zero(), vec3.zero(), vec3.zero()],
  [vec3.zero(), vec3.zero(), vec3.zero()],
  [vec3.zero(), vec3.zero(), vec3.zero()],
  [vec3.zero(), vec3.zero(), vec3.zero()],
  [vec3.zero(), vec3.zero(), vec3.zero()],
];

// Grow-only scratch buffer for face entries across frames.
const faceEntryScratch: FaceEntry[] = [];

const p0 = scrn.zero();
const p1 = scrn.zero();
const p2 = scrn.zero();

const ndc0: NdcPoint = ndc.zero();
const ndc1: NdcPoint = ndc.zero();
const ndc2: NdcPoint = ndc.zero();

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
  renderCache: RenderFrameCache,
  projectionService: ProjectionService,
  objectsFilter?: (obj: SceneObject) => boolean,
): number {
  return alloc.withName(buildFaces.name, () => {
    // Reuse a grow-only scratch buffer instead of allocating a fresh array.
    let faceCount = 0;

    for (let oi = 0; oi < objects.length; oi++) {
      const obj = objects[oi];
      if (obj.wireframeOnly) continue;
      if (objectsFilter && !objectsFilter(obj)) continue;
      if (
        isBodyAtOrBeyondOnePixelThreshold(obj, projectionService, canvasHeight)
      )
        continue;

      const mesh = obj.mesh;
      const baseColor = obj.color;
      const worldPoints = obj.applyTransform
        ? getCachedWorldPoints(renderCache, obj)
        : mesh.points;
      const cameraPoints =
        projectionService.worldPointsToCameraPointsNoClip(worldPoints);
      const faces = mesh.faces;
      const worldFaceNormals = getCachedWorldFaceNormals(renderCache, obj);

      const facesLength = faces.length;
      let face: number[];
      let i0: number, i1: number, i2: number;
      let v0: Vec3, v1: Vec3, v2: Vec3;
      for (let fi = 0; fi < facesLength; fi++) {
        face = faces[fi];
        i0 = face[0];
        i1 = face[1];
        i2 = face[2];
        v0 = worldPoints[i0];
        v1 = worldPoints[i1];
        v2 = worldPoints[i2];

        let n: Vec3;

        if (worldFaceNormals) {
          // Use precomputed world-space face normal
          n = worldFaceNormals[fi];
        } else {
          // Fallback for meshes without precomputed normals.
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

        const code0 = projectionService.computeOutCode(c0);
        const code1 = projectionService.computeOutCode(c1);
        const code2 = projectionService.computeOutCode(c2);
        if ((code0 & code1 & code2) !== 0) {
          continue;
        }

        const intensity =
          obj.kind === "lightEmitter"
            ? 1
            : toneMapIrradiance(computeIrradianceAtPoint(v0, n, lights));

        if ((code0 | code1 | code2) === 0) {
          projectionService.projectCameraPointToNdcInto(ndc0, c0);
          projectionService.projectCameraPointToNdcInto(ndc1, c1);
          projectionService.projectCameraPointToNdcInto(ndc2, c2);

          ndc.toScreenInto(p0, ndc0, canvasWidth, canvasHeight);
          ndc.toScreenInto(p1, ndc1, canvasWidth, canvasHeight);
          ndc.toScreenInto(p2, ndc2, canvasWidth, canvasHeight);

          const avgDepth = (p0.depth + p1.depth + p2.depth) / 3;

          let entry = faceEntryScratch[faceCount];
          if (!entry) {
            // Growing --> append a new element.
            entry = {
              baseColor,
              depth: avgDepth,
              intensity,
              p0: scrn.copy(p0, scrn.zero()),
              p1: scrn.copy(p1, scrn.zero()),
              p2: scrn.copy(p2, scrn.zero()),
            };
            faceEntryScratch[faceCount] = entry;
          } else {
            // Reuse existing entry
            entry.baseColor = baseColor;
            entry.depth = avgDepth;
            entry.intensity = intensity;
            scrn.copy(p0, entry.p0);
            scrn.copy(p1, entry.p1);
            scrn.copy(p2, entry.p2);
          }

          faceCount++;
        } else {
          const clipCount = projectionService.clipTriangleAgainstFrustumCamera(
            clipped,
            c0,
            c1,
            c2,
          );
          if (clipCount === 0) continue;

          for (let i = 0; i < clipCount; i++) {
            const tri = clipped[i];
            const A = tri[0];
            const B = tri[1];
            const C = tri[2];
            projectionService.projectCameraPointToNdcInto(ndc0, A);
            projectionService.projectCameraPointToNdcInto(ndc1, B);
            projectionService.projectCameraPointToNdcInto(ndc2, C);

            ndc.toScreenInto(p0, ndc0, canvasWidth, canvasHeight);
            ndc.toScreenInto(p1, ndc1, canvasWidth, canvasHeight);
            ndc.toScreenInto(p2, ndc2, canvasWidth, canvasHeight);

            const avgDepth = (p0.depth + p1.depth + p2.depth) / 3;

            let entry = faceEntryScratch[faceCount];
            if (!entry) {
              // Growing --> append a new element.
              entry = {
                baseColor,
                depth: avgDepth,
                intensity,
                p0: scrn.copy(p0, scrn.zero()),
                p1: scrn.copy(p1, scrn.zero()),
                p2: scrn.copy(p2, scrn.zero()),
              };
              faceEntryScratch[faceCount] = entry;
            } else {
              // Reuse existing entry
              entry.baseColor = baseColor;
              entry.depth = avgDepth;
              entry.intensity = intensity;
              scrn.copy(p0, entry.p0);
              scrn.copy(p1, entry.p1);
              scrn.copy(p2, entry.p2);
            }

            faceCount++;
          }
        }
      }
    }

    return faceCount;
  });
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

  for (let i = 0; i < lights.length; i++) {
    const light = lights[i];
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
function shadeFacesInto(into: RenderedFace[], count: number): void {
  const n = count;

  if (into.length < n) {
    into.length = n; // grow only
  }

  let baseColor: RGB;

  for (let i = 0; i < n; i++) {
    const face = faceEntryScratch[i];
    baseColor = face.baseColor;
    const k = 0.2 + 0.8 * face.intensity;
    const r = Math.round(baseColor.r * k);
    const g = Math.round(baseColor.g * k);
    const b = Math.round(baseColor.b * k);

    let entry = into[i];
    if (!entry) {
      entry = {
        p0: scrn.copy(face.p0, scrn.zero()),
        p1: scrn.copy(face.p1, scrn.zero()),
        p2: scrn.copy(face.p2, scrn.zero()),
        color: { r, g, b },
      };
      into[i] = entry;
    } else {
      scrn.copy(face.p0, entry.p0);
      scrn.copy(face.p1, entry.p1);
      scrn.copy(face.p2, entry.p2);
      entry.color.r = r;
      entry.color.g = g;
      entry.color.b = b;
    }
  }
}

function compareFaceDepthDesc(a: FaceEntry, b: FaceEntry): number {
  return b.depth - a.depth;
}

interface FaceEntry {
  baseColor: RGB;
  depth: number;
  intensity: number;
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
}
