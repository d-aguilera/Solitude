import type { Mat3, Vec3 } from "./math";
import type {
  ExternalAngularVelocity,
  ExternalLocalFrame,
  ExternalWorld,
} from "./world";

export interface ExternalRuntimeEntitySnapshot {
  angularVelocity?: ExternalAngularVelocity;
  frame?: ExternalLocalFrame;
  id: string;
  orientation: Mat3;
  position: Vec3;
  velocity: Vec3;
}

export interface ExternalRuntimeWorldSnapshot {
  entities: ExternalRuntimeEntitySnapshot[];
}

export interface ExternalRuntimeSnapshotService {
  apply: (
    snapshot: ExternalRuntimeWorldSnapshot,
    world: ExternalWorld,
  ) => boolean;
  capture: (world: ExternalWorld) => ExternalRuntimeWorldSnapshot;
}
