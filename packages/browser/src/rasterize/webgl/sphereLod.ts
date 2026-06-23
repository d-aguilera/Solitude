import type { Mesh, SceneObject } from "@solitude/engine/render";
import { createUnitIcosphereMesh } from "@solitude/engine/render/icosphere";
import { renderFocalLengthY } from "@solitude/engine/render/parameters";
import type { ProjectionService } from "@solitude/engine/render/projectionService";

const sphereLodMeshes = new Map<number, Mesh>();

const lodThresholds = [
  { maxProjectedDiameterPixels: 16, subdivisions: 0 },
  { maxProjectedDiameterPixels: 48, subdivisions: 1 },
  { maxProjectedDiameterPixels: 160, subdivisions: 2 },
  { maxProjectedDiameterPixels: 420, subdivisions: 3 },
  { maxProjectedDiameterPixels: 720, subdivisions: 4 },
] as const;

export function selectGpuMeshForObject(
  object: SceneObject,
  projectionService: ProjectionService,
  screenHeight: number,
): Mesh {
  if (object.meshLod.kind === "none") return object.mesh;

  const subdivisions = chooseUnitIcosphereSubdivisions(
    getProjectedUnitIcosphereDiameterPixels(
      object,
      projectionService,
      screenHeight,
    ),
    object.meshLod.maxSubdivisions,
  );
  if (subdivisions === object.meshLod.maxSubdivisions) return object.mesh;
  return getUnitIcosphereLodMesh(subdivisions);
}

export function chooseUnitIcosphereSubdivisions(
  projectedDiameterPixels: number,
  maxSubdivisions: number,
): number {
  if (
    !Number.isFinite(projectedDiameterPixels) ||
    projectedDiameterPixels <= 0
  ) {
    return maxSubdivisions;
  }

  for (const threshold of lodThresholds) {
    if (projectedDiameterPixels <= threshold.maxProjectedDiameterPixels) {
      return Math.min(threshold.subdivisions, maxSubdivisions);
    }
  }
  return maxSubdivisions;
}

function getProjectedUnitIcosphereDiameterPixels(
  object: SceneObject,
  projectionService: ProjectionService,
  screenHeight: number,
): number {
  const centerDepth = projectionService.getCameraDepthForWorldPoint(
    object.position,
  );
  if (!Number.isFinite(centerDepth) || centerDepth <= 0 || screenHeight <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (
    (2 * object.meshScale * renderFocalLengthY * screenHeight) / centerDepth
  );
}

function getUnitIcosphereLodMesh(subdivisions: number): Mesh {
  const existing = sphereLodMeshes.get(subdivisions);
  if (existing) return existing;

  const mesh = createUnitIcosphereMesh(subdivisions);
  sphereLodMeshes.set(subdivisions, mesh);
  return mesh;
}
