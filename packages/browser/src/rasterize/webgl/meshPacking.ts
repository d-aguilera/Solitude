import { vec3 } from "@solitude/engine/math";
import type { Mesh } from "@solitude/engine/render";

const floatsPerVertex = 9;

export interface PackedGpuMesh {
  boundingRadius: number;
  data: Float32Array;
  triangleCount: number;
  vertexCount: number;
}

const packedMeshes = new WeakMap<Mesh, PackedGpuMesh>();

export function getPackedGpuMesh(mesh: Mesh): PackedGpuMesh {
  const cached = packedMeshes.get(mesh);
  if (cached) return cached;

  const packed = packGpuMesh(mesh);
  packedMeshes.set(mesh, packed);
  return packed;
}

export function packGpuMesh(mesh: Mesh): PackedGpuMesh {
  const triangleCount = mesh.faces.length;
  const vertexCount = triangleCount * 3;
  const data = new Float32Array(vertexCount * floatsPerVertex);
  const edge1 = vec3.zero();
  const edge2 = vec3.zero();
  const normal = vec3.zero();
  let boundingRadiusSquared = 0;
  let offset = 0;

  for (let pointIndex = 0; pointIndex < mesh.points.length; pointIndex++) {
    const point = mesh.points[pointIndex];
    boundingRadiusSquared = Math.max(
      boundingRadiusSquared,
      point.x * point.x + point.y * point.y + point.z * point.z,
    );
  }

  for (let faceIndex = 0; faceIndex < triangleCount; faceIndex++) {
    const face = mesh.faces[faceIndex];
    const p0 = mesh.points[face[0]];
    const p1 = mesh.points[face[1]];
    const p2 = mesh.points[face[2]];
    const faceNormal = mesh.faceNormals?.[faceIndex];
    if (faceNormal) {
      vec3.copyInto(normal, faceNormal);
    } else {
      vec3.subInto(edge1, p1, p0);
      vec3.subInto(edge2, p2, p0);
      vec3.crossInto(normal, edge1, edge2);
      vec3.normalizeInto(normal);
    }

    offset = writeVertex(data, offset, p0, normal, p0);
    offset = writeVertex(data, offset, p1, normal, p0);
    offset = writeVertex(data, offset, p2, normal, p0);
  }

  return {
    boundingRadius: Math.sqrt(boundingRadiusSquared),
    data,
    triangleCount,
    vertexCount,
  };
}

function writeVertex(
  data: Float32Array,
  offset: number,
  position: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  faceAnchor: { x: number; y: number; z: number },
): number {
  data[offset++] = position.x;
  data[offset++] = position.y;
  data[offset++] = position.z;
  data[offset++] = normal.x;
  data[offset++] = normal.y;
  data[offset++] = normal.z;
  data[offset++] = faceAnchor.x;
  data[offset++] = faceAnchor.y;
  data[offset++] = faceAnchor.z;
  return offset;
}
