export interface SpacecraftOperatorTelemetry {
  currentThrustLevel: number;
  currentRcsLevel: number;
}

export function createSpacecraftOperatorTelemetry(): SpacecraftOperatorTelemetry {
  return {
    currentRcsLevel: 0,
    currentThrustLevel: 0,
  };
}
