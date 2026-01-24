import type {
  DomainCameraPose,
  PointLight,
  Scene,
  SceneObject,
} from "../app/appPorts.js";
import type { RGB, Vec3 } from "../domain/domainPorts.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import { ndcToScreen } from "./ndcToScreen.js";
import { ProjectionService } from "./ProjectionService.js";
import { toRenderable } from "./renderPrep.js";
import type {
  NdcPoint,
  RenderedFace,
  RenderSurface2D,
  ScreenPoint,
} from "./renderPorts.js";

// E = I / (4π r²) at 1 AU from the Sun.
const SUN_LUMINOSITY = 3.828e26; // W
const AU = 1.495978707e11; // m
const EARTH_ORBIT_RADIUS_2 = AU * AU;
const E_SUN_AT_EARTH = SUN_LUMINOSITY / (4 * Math.PI * EARTH_ORBIT_RADIUS_2);

export function renderFaces(
  scene: Scene,
  camera: DomainCameraPose,
  surface: RenderSurface2D,
): RenderedFace[] {
  const { width, height } = surface;
  const { objects, lights } = scene;

  const faceList = buildFaces(objects, camera, width, height, lights);

  faceList.sort((a, b) => b.depth - a.depth);

  const shadedFaces = shadeFaces(faceList);

  return shadedFaces;
}

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
  const projectionService = new ProjectionService(
    camera,
    canvasWidth,
    canvasHeight,
  );

  const faceList: FaceEntry[] = [];

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

function getWorldFaceNormalsForObject(
  obj: SceneObject,
  meshFaceNormals: Vec3[] | undefined,
): Vec3[] | undefined {
  if (!meshFaceNormals) return undefined;

  const nFaces = meshFaceNormals.length;
  const worldNormals = new Array<Vec3>(nFaces);
  const R = obj.orientation;

  for (let i = 0; i < nFaces; i++) {
    worldNormals[i] = mat3.mulVec3(R, meshFaceNormals[i]);
  }

  return worldNormals;
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

function shadeFaces(faceList: FaceEntry[]) {
  const shadedFaces = new Array<RenderedFace>(faceList.length);

  for (let i = 0; i < faceList.length; i++) {
    const face = faceList[i];
    const { p0, p1, p2, baseColor, intensity } = face;
    const { r: baseR, g: baseG, b: baseB } = baseColor;
    const k = 0.2 + 0.8 * intensity;
    const r = Math.round(baseR * k);
    const g = Math.round(baseG * k);
    const b = Math.round(baseB * k);
    shadedFaces[i] = {
      p0,
      p1,
      p2,
      color: { r, g, b },
    };
  }

  return shadedFaces;
}

interface FaceEntry {
  baseColor: RGB;
  depth: number;
  intensity: number;
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
}
