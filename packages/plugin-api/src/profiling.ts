export interface ExternalProfilerControl {
  readonly check: () => void;
  readonly flush: () => void;
  readonly setEnabled: (enabled: boolean) => void;
  readonly setPaused: (paused: boolean) => void;
}
