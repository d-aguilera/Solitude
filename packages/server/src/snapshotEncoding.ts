import type { RuntimeEntitySnapshot } from "@solitude/engine/runtime";

const POSITION_DECIMALS = 0;
const DYNAMIC_DECIMALS = 6;

export function compactSnapshotEntities(
  entities: readonly RuntimeEntitySnapshot[],
): RuntimeEntitySnapshot[] {
  return entities.map((entity) => ({
    id: entity.id,
    position: roundVector(entity.position, POSITION_DECIMALS),
    velocity: roundVector(entity.velocity, DYNAMIC_DECIMALS),
    orientation: roundMatrix(entity.orientation, DYNAMIC_DECIMALS),
    ...(entity.angularVelocity
      ? {
          angularVelocity: {
            pitch: roundNumber(entity.angularVelocity.pitch, DYNAMIC_DECIMALS),
            roll: roundNumber(entity.angularVelocity.roll, DYNAMIC_DECIMALS),
            yaw: roundNumber(entity.angularVelocity.yaw, DYNAMIC_DECIMALS),
          },
        }
      : {}),
    ...(entity.frame
      ? {
          frame: {
            forward: roundVector(entity.frame.forward, DYNAMIC_DECIMALS),
            right: roundVector(entity.frame.right, DYNAMIC_DECIMALS),
            up: roundVector(entity.frame.up, DYNAMIC_DECIMALS),
          },
        }
      : {}),
  }));
}

function roundVector(
  vector: RuntimeEntitySnapshot["position"],
  decimals: number,
): RuntimeEntitySnapshot["position"] {
  return {
    x: roundNumber(vector.x, decimals),
    y: roundNumber(vector.y, decimals),
    z: roundNumber(vector.z, decimals),
  };
}

function roundMatrix(
  matrix: RuntimeEntitySnapshot["orientation"],
  decimals: number,
): RuntimeEntitySnapshot["orientation"] {
  return [
    [
      roundNumber(matrix[0][0], decimals),
      roundNumber(matrix[0][1], decimals),
      roundNumber(matrix[0][2], decimals),
    ],
    [
      roundNumber(matrix[1][0], decimals),
      roundNumber(matrix[1][1], decimals),
      roundNumber(matrix[1][2], decimals),
    ],
    [
      roundNumber(matrix[2][0], decimals),
      roundNumber(matrix[2][1], decimals),
      roundNumber(matrix[2][2], decimals),
    ],
  ];
}

function roundNumber(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
