import type {
  DomainCameraPose,
  PointLight,
  RGB,
  Scene,
  SceneObject,
} from "../app/scenePorts";
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
import {
  renderAmbientFactor,
  renderDiffuseFactor,
  renderExposure,
  renderGamma,
} from "./renderParameters";
import type { RenderedFace } from "./renderPorts";
import { type ScreenPoint, scrn } from "./scrn";

export type ClippedTriangleScratch = [
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
  [Vec3, Vec3, Vec3],
];

export interface RenderFacesWorkspace {
  clipped: ClippedTriangleScratch;
  e1Scratch: Vec3;
  e2Scratch: Vec3;
  Lscratch: Vec3;
  ndc0: NdcPoint;
  ndc1: NdcPoint;
  ndc2: NdcPoint;
  normalScratch: Vec3;
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
  sortStackHi: number[];
  sortStackLo: number[];
  toCameraScratch: Vec3;
  toLightScratch: Vec3;
}

export function createRenderFacesWorkspace(): RenderFacesWorkspace {
  return {
    clipped: [
      [vec3.zero(), vec3.zero(), vec3.zero()],
      [vec3.zero(), vec3.zero(), vec3.zero()],
      [vec3.zero(), vec3.zero(), vec3.zero()],
      [vec3.zero(), vec3.zero(), vec3.zero()],
      [vec3.zero(), vec3.zero(), vec3.zero()],
      [vec3.zero(), vec3.zero(), vec3.zero()],
    ],
    e1Scratch: vec3.zero(),
    e2Scratch: vec3.zero(),
    Lscratch: vec3.zero(),
    ndc0: ndc.zero(),
    ndc1: ndc.zero(),
    ndc2: ndc.zero(),
    normalScratch: vec3.zero(),
    p0: scrn.zero(),
    p1: scrn.zero(),
    p2: scrn.zero(),
    sortStackHi: [],
    sortStackLo: [],
    toCameraScratch: vec3.zero(),
    toLightScratch: vec3.zero(),
  };
}

export function renderFacesInto(
  into: RenderedFace[],
  scene: Scene,
  camera: DomainCameraPose,
  screenWidth: number,
  screenHeight: number,
  renderCache: RenderFrameCache,
  projectionService: ProjectionService,
  workspace: RenderFacesWorkspace,
  objectsFilter: ((obj: SceneObject) => boolean) | undefined,
  sortFaces: boolean,
): number {
  const faceCount = buildFaces(
    into,
    scene.objects,
    camera,
    screenWidth,
    screenHeight,
    scene.lights,
    renderCache,
    projectionService,
    workspace,
    objectsFilter,
  );

  if (sortFaces) {
    sortFacesByDepthDesc(into, faceCount, workspace);
  }

  return faceCount;
}

/**
 * Build the list of shaded triangle faces (with depth and lighting information)
 * for all non-wireframe objects in the scene.
 */
function buildFaces(
  into: RenderedFace[],
  objects: SceneObject[],
  camera: DomainCameraPose,
  canvasWidth: number,
  canvasHeight: number,
  lights: PointLight[],
  renderCache: RenderFrameCache,
  projectionService: ProjectionService,
  workspace: RenderFacesWorkspace,
  objectsFilter: ((obj: SceneObject) => boolean) | undefined,
): number {
  alloc.pushName(buildFaces.name);
  try {
    const clipped = workspace.clipped;
    const e1Scratch = workspace.e1Scratch;
    const e2Scratch = workspace.e2Scratch;
    const ndc0 = workspace.ndc0;
    const ndc1 = workspace.ndc1;
    const ndc2 = workspace.ndc2;
    const normalScratch = workspace.normalScratch;
    const p0 = workspace.p0;
    const p1 = workspace.p1;
    const p2 = workspace.p2;
    const toCameraScratch = workspace.toCameraScratch;
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
            : toneMapIrradiance(
                computeIrradianceAtPoint(v0, n, lights, workspace),
              );

        if ((code0 | code1 | code2) === 0) {
          projectionService.projectCameraPointToNdcInto(ndc0, c0);
          projectionService.projectCameraPointToNdcInto(ndc1, c1);
          projectionService.projectCameraPointToNdcInto(ndc2, c2);

          ndc.toScreenInto(p0, ndc0, canvasWidth, canvasHeight);
          ndc.toScreenInto(p1, ndc1, canvasWidth, canvasHeight);
          ndc.toScreenInto(p2, ndc2, canvasWidth, canvasHeight);

          const avgDepth = (p0.depth + p1.depth + p2.depth) / 3;

          writeFaceInto(
            into,
            faceCount,
            baseColor,
            intensity,
            avgDepth,
            p0,
            p1,
            p2,
          );

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

            writeFaceInto(
              into,
              faceCount,
              baseColor,
              intensity,
              avgDepth,
              p0,
              p1,
              p2,
            );

            faceCount++;
          }
        }
      }
    }

    return faceCount;
  } finally {
    alloc.popName();
  }
}

function writeFaceInto(
  into: RenderedFace[],
  index: number,
  baseColor: RGB,
  intensity: number,
  depth: number,
  p0: ScreenPoint,
  p1: ScreenPoint,
  p2: ScreenPoint,
): void {
  const k = renderAmbientFactor + renderDiffuseFactor * intensity;
  const r = Math.round(baseColor.r * k);
  const g = Math.round(baseColor.g * k);
  const b = Math.round(baseColor.b * k);

  let entry = into[index];
  if (!entry) {
    entry = {
      p0: scrn.copy(p0, scrn.zero()),
      p1: scrn.copy(p1, scrn.zero()),
      p2: scrn.copy(p2, scrn.zero()),
      color: { r, g, b },
      depth,
    };
    into[index] = entry;
    return;
  }

  scrn.copy(p0, entry.p0);
  scrn.copy(p1, entry.p1);
  scrn.copy(p2, entry.p2);
  entry.color.r = r;
  entry.color.g = g;
  entry.color.b = b;
  entry.depth = depth;
}

function computeIrradianceAtPoint(
  p: Vec3,
  n: Vec3,
  lights: PointLight[],
  workspace: RenderFacesWorkspace,
): number {
  if (lights.length === 0) return 0;
  const Lscratch = workspace.Lscratch;
  const toLightScratch = workspace.toLightScratch;

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
function toneMapIrradiance(E: number): number {
  const hdr = renderExposure * E;
  const mapped = hdr / (1 + hdr); // Reinhard

  // Mild gamma to lift darks
  const ldr = Math.pow(mapped, renderGamma);

  return Math.max(0, Math.min(1, ldr));
}

function sortFacesByDepthDesc(
  array: RenderedFace[],
  count: number,
  workspace: RenderFacesWorkspace,
): void {
  if (count <= 1) return;

  const stackLo = workspace.sortStackLo;
  const stackHi = workspace.sortStackHi;
  stackLo.length = 0;
  stackHi.length = 0;
  stackLo.push(0);
  stackHi.push(count - 1);

  const insertionThreshold = 16;

  while (stackLo.length > 0) {
    const lo = stackLo.pop() as number;
    const hi = stackHi.pop() as number;
    if (hi - lo <= insertionThreshold) continue;

    const pivotDepth = array[(lo + hi) >> 1].depth;
    let i = lo;
    let j = hi;

    while (i <= j) {
      while (array[i].depth > pivotDepth) i++;
      while (array[j].depth < pivotDepth) j--;
      if (i <= j) {
        const tmp = array[i];
        array[i] = array[j];
        array[j] = tmp;
        i++;
        j--;
      }
    }

    if (lo < j) {
      stackLo.push(lo);
      stackHi.push(j);
    }
    if (i < hi) {
      stackLo.push(i);
      stackHi.push(hi);
    }
  }

  for (let i = 1; i < count; i++) {
    const item = array[i];
    const itemDepth = item.depth;
    let j = i - 1;
    while (j >= 0 && array[j].depth < itemDepth) {
      array[j + 1] = array[j];
      j--;
    }
    array[j + 1] = item;
  }
}
