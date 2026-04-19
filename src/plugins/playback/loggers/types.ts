import type { ControlInput } from "../../../app/controlPorts";
import type { ShipBody, World } from "../../../domain/domainPorts";
import type { CompiledPlaybackScript } from "../types";

export interface PlaybackLogger {
  onPlaybackStart?: (context: PlaybackLoggerLifecycleContext) => void;
  sampleAfterTick?: (context: PlaybackLoggerTickContext) => void;
  onPlaybackEnd?: (context: PlaybackLoggerLifecycleContext) => void;
}

export interface PlaybackLoggerLifecycleContext {
  controlInput: ControlInput;
  mainShip?: ShipBody;
  playbackElapsedMs: number;
  script: CompiledPlaybackScript;
  simTimeMillis: number;
  world?: World;
}

export interface PlaybackLoggerTickContext extends PlaybackLoggerLifecycleContext {
  dtSimMillis: number;
  dtTickMillis: number;
}
