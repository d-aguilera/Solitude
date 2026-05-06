import type { ControlInput } from "@solitude/engine/app/controlPorts";
import type {
  ControlledBody,
  World,
} from "@solitude/engine/domain/domainPorts";
import type { CompiledPlaybackScript } from "../types";

export interface PlaybackLogger {
  onPlaybackStart?: (context: PlaybackLoggerLifecycleContext) => void;
  sampleAfterTick?: (context: PlaybackLoggerTickContext) => void;
  onPlaybackEnd?: (context: PlaybackLoggerLifecycleContext) => void;
}

export interface PlaybackLoggerLifecycleContext {
  controlInput: ControlInput;
  controlledBody?: ControlledBody;
  playbackElapsedMs: number;
  script: CompiledPlaybackScript;
  simTimeMillis: number;
  world?: World;
}

export interface PlaybackLoggerTickContext extends PlaybackLoggerLifecycleContext {
  dtSimMillis: number;
  dtTickMillis: number;
}
