import type { ExternalMutableControlState } from "@solitude/plugin-api/controls";
import type { ExternalControlInput } from "@solitude/plugin-api/input";
import type {
  ExternalLoopPlugin,
  ExternalLoopUpdateParams,
} from "@solitude/plugin-api/loop";
import type { ExternalSimulationPhaseParams } from "@solitude/plugin-api/simulation";
import type { ExternalRuntimeSnapshotService } from "@solitude/plugin-api/snapshots";
import type {
  ExternalControlledBody,
  ExternalWorld,
} from "@solitude/plugin-api/world";
import { createPlaybackLogger } from "./loggers/index";
import type { PlaybackLogger } from "./loggers/types";
import {
  applyCompiledPhaseControls,
  clearPlaybackControls,
  clonePlaybackControlState,
  compilePlaybackScript,
  phaseForScriptTime,
  playbackControlsEqual,
  readPlaybackControlState,
} from "./logic";
import type { DiagnosticRuntimeOptions } from "./options";
import { getPlaybackScript } from "./scripts/index";
import { formatPlaybackScriptModule } from "./serialize";
import { applyPlaybackSnapshot, capturePlaybackSnapshot } from "./snapshot";
import type {
  CompiledPlaybackScript,
  PlaybackControlState,
  PlaybackPhase,
  PlaybackScenarioId,
  PlaybackScript,
  PlaybackSnapshot,
  PlaybackStatus,
  ThrustLevel,
} from "./types";

const fixedDtMillis = 1000 / 60;
const playbackTimeScale = 32;

interface RecorderState {
  snapshot: PlaybackSnapshot;
  phases: PlaybackPhase[];
  phaseStartRuntimeMs: number;
  previousFocusEntityId: string;
  previousControls: PlaybackControlState;
  recordingStartedRuntimeMs: number;
  capturedSimTimeMillis: number;
  timeScale: number;
  timeScaleChanged: boolean;
}

export interface PlaybackController {
  afterFrame: (params?: ExternalLoopUpdateParams) => void;
  applySceneSnapshot: (world: ExternalWorld) => void;
  beforeVehicleDynamics: (params: ExternalSimulationPhaseParams) => void;
  afterVehicleDynamics: (params: ExternalSimulationPhaseParams) => void;
  getEffectiveTimeScale: () => number | null;
  getInitialSimTimeMillis: () => number | null;
  getStatus: () => PlaybackStatus;
  getStatusText: () => string;
  handleCaptureToggle: () => void;
  handlePause: () => void;
  isInputLocked: () => boolean;
  updateControlState: (
    controlInput: ExternalControlInput,
    controlState: ExternalMutableControlState,
  ) => void;
  updateLoop: (
    controlInput: ExternalControlInput,
    world: ExternalWorld | undefined,
    controlledBody: ExternalControlledBody | undefined,
    focusedEntityId: string | undefined,
    nowMs: number,
    simTimeMillis: number,
    effectiveTimeScale?: number,
  ) => ReturnType<NonNullable<ExternalLoopPlugin["updateLoopState"]>>;
}

export function createPlaybackController(
  diagnostic: DiagnosticRuntimeOptions | undefined,
  snapshots: ExternalRuntimeSnapshotService,
  warning?: string,
  scriptProvider: (
    scenario: PlaybackScenarioId,
  ) => PlaybackScript | null = getPlaybackScript,
): PlaybackController {
  const scenario = diagnostic?.scenario ?? "moon-circle";
  const script =
    diagnostic?.mode === "playback"
      ? compileConfiguredScript(scenario, scriptProvider)
      : null;
  const logger =
    diagnostic?.mode === "playback" && script
      ? createPlaybackLogger(diagnostic.log, script)
      : null;

  let status: PlaybackStatus = getInitialStatus(diagnostic, warning, script);
  let statusText = getInitialStatusText(diagnostic, warning, script);
  let captureToggleRequested = false;
  let pauseRequested = false;
  let scriptTimeMs = 0;
  let phaseIndex = 0;
  let currentPhaseThrustLevel: ThrustLevel | null = null;
  let currentPhaseFocusEntityId: string | null = null;
  let latestThrustLevel = 1;
  let recorder: RecorderState | null = null;
  let sceneSnapshotApplied = false;
  let playbackHasStarted = false;
  let restoredFocusEntityId: string | null = null;

  if (statusText && (status === "warning" || status === "missing")) {
    console.warn(statusText);
  }

  const playbackFramePolicy = {
    advanceSim: false,
    advanceScene: false,
    advancePresentation: true,
    tickDtMillis: fixedDtMillis,
    simDtMillis: fixedDtMillis * playbackTimeScale,
  };
  const updateLoop: PlaybackController["updateLoop"] = (
    controlInput,
    world,
    controlledBody,
    focusedEntityId,
    nowMs,
    simTimeMillis,
    effectiveTimeScale = playbackTimeScale,
  ) => {
    processCaptureToggle(
      world,
      controlledBody,
      nowMs,
      simTimeMillis,
      effectiveTimeScale,
      controlInput,
      focusedEntityId,
    );
    processPause(controlInput);
    updateRecording(controlInput, focusedEntityId, nowMs, effectiveTimeScale);

    if (status === "playing" && script && !playbackHasStarted) {
      playbackHasStarted = true;
      logger?.onPlaybackStart?.(
        createLoggerLifecycleContext(
          controlInput,
          world,
          controlledBody,
          scriptTimeMs,
          simTimeMillis,
          script,
        ),
      );
    }

    if (status === "playing" && script) {
      if (scriptTimeMs >= script.totalDurationMs) {
        finishPlayback(controlInput);
      } else {
        applyPlaybackAtCurrentTime(controlInput, script);
        playbackFramePolicy.advanceSim = true;
        playbackFramePolicy.advanceScene = true;
        playbackFramePolicy.tickDtMillis = script.fixedDtMillis;
        playbackFramePolicy.simDtMillis =
          script.fixedDtMillis * script.timeScale;
        return { framePolicy: playbackFramePolicy };
      }
    }

    if (
      status === "waiting" ||
      status === "paused" ||
      status === "done" ||
      status === "missing"
    ) {
      clearPlaybackControls(controlInput);
      currentPhaseThrustLevel = null;
      currentPhaseFocusEntityId = null;
      playbackFramePolicy.advanceSim = false;
      playbackFramePolicy.advanceScene = false;
      if (script) {
        playbackFramePolicy.tickDtMillis = script.fixedDtMillis;
        playbackFramePolicy.simDtMillis =
          script.fixedDtMillis * script.timeScale;
      }
      return { framePolicy: playbackFramePolicy };
    }

    return null;
  };

  const afterFrame = (params?: ExternalLoopUpdateParams): void => {
    if (status === "playing" && script) {
      sampleLoggerAfterTick(
        logger,
        params,
        script,
        scriptTimeMs + script.fixedDtMillis,
        currentPhaseFocusEntityId,
      );
      scriptTimeMs += script.fixedDtMillis;
      return;
    }

    if (status === "done" && script) {
      logger?.onPlaybackEnd?.(
        createLoggerLifecycleContext(
          params?.controlInput,
          params?.world,
          getPlaybackControlledBody(params, currentPhaseFocusEntityId),
          scriptTimeMs,
          params?.simTimeMillis ?? 0,
          script,
        ),
      );
    }
  };

  const updateControlState: PlaybackController["updateControlState"] = (
    _controlInput,
    controlState,
  ) => {
    latestThrustLevel = readSpacecraftThrustLevel(controlState);
    if (status === "playing" && currentPhaseThrustLevel != null) {
      controlState.thrustLevel = currentPhaseThrustLevel;
    }
  };

  function beforeVehicleDynamics(params: ExternalSimulationPhaseParams): void {
    restoredFocusEntityId = null;
    if (status !== "playing" || !currentPhaseFocusEntityId) return;
    if (params.mainFocus.entityId === currentPhaseFocusEntityId) return;
    restoredFocusEntityId = params.mainFocus.entityId;
    params.focusEntity(currentPhaseFocusEntityId);
  }

  function afterVehicleDynamics(params: ExternalSimulationPhaseParams): void {
    if (!restoredFocusEntityId) return;
    const entityId = restoredFocusEntityId;
    restoredFocusEntityId = null;
    params.focusEntity(entityId);
  }

  function readSpacecraftThrustLevel(
    controlState: ExternalMutableControlState,
  ): ThrustLevel {
    return isThrustLevelValue(controlState.thrustLevel)
      ? controlState.thrustLevel
      : 1;
  }

  function isThrustLevelValue(value: unknown): value is ThrustLevel {
    return (
      value === 0 ||
      value === 1 ||
      value === 2 ||
      value === 3 ||
      value === 4 ||
      value === 5 ||
      value === 6 ||
      value === 7 ||
      value === 8 ||
      value === 9
    );
  }

  function applySceneSnapshot(world: ExternalWorld): void {
    if (diagnostic?.mode !== "playback" || !script || sceneSnapshotApplied) {
      return;
    }
    sceneSnapshotApplied = true;
    const applied = applyPlaybackSnapshot(snapshots, script.snapshot, world);
    if (!applied) {
      status = "missing";
      statusText = "PLAYBACK: snapshot mismatch";
      console.warn(statusText);
    }
  }

  function getInitialSimTimeMillis(): number | null {
    return script?.metadata.capturedSimTimeMillis ?? null;
  }

  function getEffectiveTimeScale(): number | null {
    if (!script || diagnostic?.mode !== "playback" || status === "released") {
      return null;
    }
    return script.timeScale;
  }

  function handleCaptureToggle(): void {
    captureToggleRequested = true;
  }

  function handlePause(): void {
    pauseRequested = true;
  }

  function isInputLocked(): boolean {
    return (
      status === "waiting" ||
      status === "playing" ||
      status === "paused" ||
      status === "done" ||
      status === "missing"
    );
  }

  function getStatus(): PlaybackStatus {
    return status;
  }

  function getStatusText(): string {
    return statusText;
  }

  function processCaptureToggle(
    world: ExternalWorld | undefined,
    controlledBody: ExternalControlledBody | undefined,
    nowMs: number,
    simTimeMillis: number,
    effectiveTimeScale: number,
    controlInput: ExternalControlInput,
    focusedEntityId: string | undefined,
  ): void {
    if (!captureToggleRequested) return;
    captureToggleRequested = false;
    if (diagnostic?.mode !== "capture") return;

    if (recorder) {
      stopRecording(nowMs, effectiveTimeScale, controlInput, focusedEntityId);
      return;
    }

    if (!world || !controlledBody) {
      statusText = "CAPTURE: missing world";
      console.warn(statusText);
      return;
    }

    const controls = readPlaybackControlState(controlInput, latestThrustLevel);
    recorder = {
      snapshot: capturePlaybackSnapshot(
        snapshots,
        world,
        controlledBody,
        diagnostic.scenario,
        simTimeMillis,
      ),
      phases: [],
      phaseStartRuntimeMs: nowMs,
      previousFocusEntityId: controlledBody.id,
      previousControls: clonePlaybackControlState(controls),
      recordingStartedRuntimeMs: nowMs,
      capturedSimTimeMillis: simTimeMillis,
      timeScale: effectiveTimeScale,
      timeScaleChanged: false,
    };
    status = "capture-recording";
    statusText = "CAPTURE: recording";
    console.info("Solitude capture started:", diagnostic.scenario);
  }

  function processPause(controlInput: ExternalControlInput): void {
    if (!pauseRequested) return;
    pauseRequested = false;

    if (status === "waiting") {
      status = "playing";
      statusText = "PLAYBACK: playing";
      controlInput.pauseToggle = false;
      return;
    }

    if (status === "playing") {
      status = "paused";
      statusText = "PLAYBACK: paused";
      clearPlaybackControls(controlInput);
      controlInput.pauseToggle = false;
      return;
    }

    if (status === "paused") {
      status = "playing";
      statusText = "PLAYBACK: playing";
      controlInput.pauseToggle = false;
      return;
    }

    if (status === "done" || status === "missing") {
      status = "released";
      statusText = "";
      clearPlaybackControls(controlInput);
      controlInput.pauseToggle = false;
    }
  }

  function updateRecording(
    controlInput: ExternalControlInput,
    focusedEntityId: string | undefined,
    nowMs: number,
    effectiveTimeScale: number,
  ): void {
    if (!recorder) return;

    if (Math.abs(effectiveTimeScale - recorder.timeScale) > 0.001) {
      recorder.timeScaleChanged = true;
    }

    const controls = readPlaybackControlState(controlInput, latestThrustLevel);
    const nextFocusEntityId = focusedEntityId ?? recorder.previousFocusEntityId;
    if (
      playbackControlsEqual(controls, recorder.previousControls) &&
      nextFocusEntityId === recorder.previousFocusEntityId
    ) {
      return;
    }

    pushRecordedPhase(recorder, nowMs);
    recorder.phaseStartRuntimeMs = nowMs;
    recorder.previousFocusEntityId = nextFocusEntityId;
    recorder.previousControls = clonePlaybackControlState(controls);
  }

  function stopRecording(
    nowMs: number,
    effectiveTimeScale: number,
    controlInput: ExternalControlInput,
    focusedEntityId: string | undefined,
  ): void {
    if (!recorder) return;

    updateRecording(controlInput, focusedEntityId, nowMs, effectiveTimeScale);
    pushRecordedPhase(recorder, nowMs);

    const output: PlaybackScript = {
      id: diagnostic?.scenario ?? "moon-circle",
      snapshot: recorder.snapshot,
      fixedDtMillis,
      timeScale: recorder.timeScale,
      phases: recorder.phases,
      endBehavior: "pause",
      metadata: {
        capturedSimTimeMillis: recorder.capturedSimTimeMillis,
        recordingStartedRuntimeMs: recorder.recordingStartedRuntimeMs,
        recordingEndedRuntimeMs: nowMs,
      },
    };

    console.info(formatPlaybackScriptModule(output));
    if (recorder.timeScaleChanged) {
      console.warn(
        "CAPTURE: time scale changed during recording; dumped script uses the scale from recording start.",
      );
    }
    recorder = null;
    status = "capture-idle";
    statusText = "CAPTURE: dumped script";
  }

  function pushRecordedPhase(state: RecorderState, nowMs: number): void {
    const durationMs = Math.max(0, nowMs - state.phaseStartRuntimeMs);
    if (durationMs === 0) return;
    state.phases.push({
      durationMs,
      controls: clonePlaybackControlState(state.previousControls),
      focusEntityId: state.previousFocusEntityId,
    });
  }

  function applyPlaybackAtCurrentTime(
    controlInput: ExternalControlInput,
    compiled: CompiledPlaybackScript,
  ): void {
    phaseIndex = phaseForScriptTime(compiled, scriptTimeMs, phaseIndex);
    const phase = compiled.phases[phaseIndex] ?? null;
    applyCompiledPhaseControls(controlInput, phase);
    currentPhaseThrustLevel = phase?.thrustLevel ?? null;
    currentPhaseFocusEntityId = phase?.focusEntityId ?? null;
  }

  function finishPlayback(controlInput: ExternalControlInput): void {
    status = "done";
    statusText = "PLAYBACK: done";
    clearPlaybackControls(controlInput);
    currentPhaseThrustLevel = null;
    currentPhaseFocusEntityId = null;
  }

  return {
    afterFrame,
    afterVehicleDynamics,
    applySceneSnapshot,
    beforeVehicleDynamics,
    getEffectiveTimeScale,
    getInitialSimTimeMillis,
    getStatus,
    getStatusText,
    handleCaptureToggle,
    handlePause,
    isInputLocked,
    updateControlState,
    updateLoop,
  };
}

function compileConfiguredScript(
  scenario: PlaybackScenarioId,
  scriptProvider: (scenario: PlaybackScenarioId) => PlaybackScript | null,
): CompiledPlaybackScript | null {
  const script = scriptProvider(scenario);
  return script ? compilePlaybackScript(script) : null;
}

function getInitialStatus(
  diagnostic: DiagnosticRuntimeOptions | undefined,
  warning: string | undefined,
  script: CompiledPlaybackScript | null,
): PlaybackStatus {
  if (warning) return "warning";
  if (!diagnostic) return "inactive";
  if (diagnostic.mode === "capture") return "capture-idle";
  return script ? "waiting" : "missing";
}

function getInitialStatusText(
  diagnostic: DiagnosticRuntimeOptions | undefined,
  warning: string | undefined,
  script: CompiledPlaybackScript | null,
): string {
  if (warning) return "DIAG: ".concat(warning);
  if (!diagnostic) return "";
  if (diagnostic.mode === "capture") return "CAPTURE: idle";
  return script ? "PLAYBACK: waiting" : "PLAYBACK: missing script";
}

function sampleLoggerAfterTick(
  logger: PlaybackLogger | null,
  params: ExternalLoopUpdateParams | undefined,
  script: CompiledPlaybackScript,
  playbackElapsedMs: number,
  focusEntityId: string | null,
): void {
  if (!logger?.sampleAfterTick || !params) return;

  const dtTickMillis = params.state.framePolicy.tickDtMillis ?? params.dtMillis;
  const dtSimMillis = params.state.framePolicy.simDtMillis ?? dtTickMillis;
  logger.sampleAfterTick({
    controlInput: params.controlInput,
    controlledBody: getPlaybackControlledBody(params, focusEntityId),
    dtSimMillis,
    dtTickMillis,
    playbackElapsedMs,
    script,
    simTimeMillis: params.simTimeMillis ?? 0,
    world: params.world,
  });
}

function createLoggerLifecycleContext(
  controlInput: ExternalControlInput | undefined,
  world: ExternalWorld | undefined,
  controlledBody: ExternalControlledBody | undefined,
  playbackElapsedMs: number,
  simTimeMillis: number,
  script: CompiledPlaybackScript,
) {
  return {
    controlInput: controlInput ?? ({} as ExternalControlInput),
    controlledBody,
    playbackElapsedMs,
    script,
    simTimeMillis,
    world,
  };
}

function getPlaybackControlledBody(
  params: ExternalLoopUpdateParams | undefined,
  entityId: string | null,
): ExternalControlledBody | undefined {
  if (!entityId || !params?.world) return getLoopControlledBody(params);
  for (const body of params.world.controllableBodies) {
    if (body.id === entityId) return body;
  }
  return getLoopControlledBody(params);
}

function getLoopControlledBody(
  params: ExternalLoopUpdateParams | undefined,
): ExternalControlledBody | undefined {
  return params?.mainFocus.controlledBody;
}
