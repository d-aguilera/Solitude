import type { ControlInput, SimControlState } from "../../app/controlPorts";
import type { LoopPlugin, LoopUpdateParams } from "../../app/pluginPorts";
import type { ShipBody, World } from "../../domain/domainPorts";
import { createPlaybackLogger, type PlaybackLogger } from "./loggers/index";
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
  previousControls: PlaybackControlState;
  recordingStartedRuntimeMs: number;
  capturedSimTimeMillis: number;
  timeScale: number;
  timeScaleChanged: boolean;
}

export interface PlaybackController {
  afterFrame: (params?: LoopUpdateParams) => void;
  applySceneSnapshot: (world: World) => void;
  getEffectiveTimeScale: () => number | null;
  getInitialSimTimeMillis: () => number | null;
  getStatus: () => PlaybackStatus;
  getStatusText: () => string;
  handleCaptureToggle: () => void;
  handlePause: () => void;
  isInputLocked: () => boolean;
  updateControlState: (
    controlInput: ControlInput,
    controlState: SimControlState,
  ) => void;
  updateLoop: (
    controlInput: ControlInput,
    world: World | undefined,
    controlledBody: ShipBody | undefined,
    nowMs: number,
    simTimeMillis: number,
    effectiveTimeScale?: number,
  ) => ReturnType<NonNullable<LoopPlugin["updateLoopState"]>>;
}

export function createPlaybackController(
  diagnostic: DiagnosticRuntimeOptions | undefined,
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
  let latestThrustLevel = 1;
  let recorder: RecorderState | null = null;
  let sceneSnapshotApplied = false;
  let playbackHasStarted = false;

  if (statusText && (status === "warning" || status === "missing")) {
    console.warn(statusText);
  }

  const playbackFramePolicy = {
    advanceSim: false,
    advanceScene: false,
    advanceHud: true,
    tickDtMillis: fixedDtMillis,
    simDtMillis: fixedDtMillis * playbackTimeScale,
  };
  const updateLoop: PlaybackController["updateLoop"] = (
    controlInput,
    world,
    controlledBody,
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
    );
    processPause(controlInput);
    updateRecording(controlInput, nowMs, effectiveTimeScale);

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

  const afterFrame = (params?: LoopUpdateParams): void => {
    if (status === "playing" && script) {
      sampleLoggerAfterTick(
        logger,
        params,
        script,
        scriptTimeMs + script.fixedDtMillis,
      );
      scriptTimeMs += script.fixedDtMillis;
      return;
    }

    if (status === "done" && script) {
      logger?.onPlaybackEnd?.(
        createLoggerLifecycleContext(
          params?.controlInput,
          params?.world,
          getLoopControlledBody(params),
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
    latestThrustLevel = controlState.thrustLevel;
    if (status === "playing" && currentPhaseThrustLevel != null) {
      controlState.thrustLevel = currentPhaseThrustLevel;
    }
  };

  function applySceneSnapshot(world: World): void {
    if (diagnostic?.mode !== "playback" || !script || sceneSnapshotApplied) {
      return;
    }
    sceneSnapshotApplied = true;
    const applied = applyPlaybackSnapshot(script.snapshot, world);
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
    world: World | undefined,
    controlledBody: ShipBody | undefined,
    nowMs: number,
    simTimeMillis: number,
    effectiveTimeScale: number,
    controlInput: ControlInput,
  ): void {
    if (!captureToggleRequested) return;
    captureToggleRequested = false;
    if (diagnostic?.mode !== "capture") return;

    if (recorder) {
      stopRecording(nowMs, effectiveTimeScale, controlInput);
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
        world,
        controlledBody,
        diagnostic.scenario,
        simTimeMillis,
      ),
      phases: [],
      phaseStartRuntimeMs: nowMs,
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

  function processPause(controlInput: ControlInput): void {
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
    controlInput: ControlInput,
    nowMs: number,
    effectiveTimeScale: number,
  ): void {
    if (!recorder) return;

    if (Math.abs(effectiveTimeScale - recorder.timeScale) > 0.001) {
      recorder.timeScaleChanged = true;
    }

    const controls = readPlaybackControlState(controlInput, latestThrustLevel);
    if (playbackControlsEqual(controls, recorder.previousControls)) return;

    pushRecordedPhase(recorder, nowMs);
    recorder.phaseStartRuntimeMs = nowMs;
    recorder.previousControls = clonePlaybackControlState(controls);
  }

  function stopRecording(
    nowMs: number,
    effectiveTimeScale: number,
    controlInput: ControlInput,
  ): void {
    if (!recorder) return;

    updateRecording(controlInput, nowMs, effectiveTimeScale);
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
    });
  }

  function applyPlaybackAtCurrentTime(
    controlInput: ControlInput,
    compiled: CompiledPlaybackScript,
  ): void {
    phaseIndex = phaseForScriptTime(compiled, scriptTimeMs, phaseIndex);
    const phase = compiled.phases[phaseIndex] ?? null;
    applyCompiledPhaseControls(controlInput, phase);
    currentPhaseThrustLevel = phase?.thrustLevel ?? null;
  }

  function finishPlayback(controlInput: ControlInput): void {
    status = "done";
    statusText = "PLAYBACK: done";
    clearPlaybackControls(controlInput);
    currentPhaseThrustLevel = null;
  }

  return {
    afterFrame,
    applySceneSnapshot,
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
  params: LoopUpdateParams | undefined,
  script: CompiledPlaybackScript,
  playbackElapsedMs: number,
): void {
  if (!logger?.sampleAfterTick || !params) return;

  const dtTickMillis = params.state.framePolicy.tickDtMillis ?? params.dtMillis;
  const dtSimMillis = params.state.framePolicy.simDtMillis ?? dtTickMillis;
  logger.sampleAfterTick({
    controlInput: params.controlInput,
    controlledBody: getLoopControlledBody(params),
    dtSimMillis,
    dtTickMillis,
    mainControlledBody: getLoopControlledBody(params),
    playbackElapsedMs,
    script,
    simTimeMillis: params.simTimeMillis ?? 0,
    world: params.world,
  });
}

function createLoggerLifecycleContext(
  controlInput: ControlInput | undefined,
  world: World | undefined,
  controlledBody: ShipBody | undefined,
  playbackElapsedMs: number,
  simTimeMillis: number,
  script: CompiledPlaybackScript,
) {
  return {
    controlInput: controlInput ?? ({} as ControlInput),
    controlledBody,
    mainControlledBody: controlledBody,
    playbackElapsedMs,
    script,
    simTimeMillis,
    world,
  };
}

function getLoopControlledBody(
  params: LoopUpdateParams | undefined,
): ShipBody | undefined {
  return params?.mainFocus.controlledBody;
}
