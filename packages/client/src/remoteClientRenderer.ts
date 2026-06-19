import {
  initLayout,
  resizeLayout,
  type LayoutView,
} from "@solitude/browser/dom/layout";
import { applyBrowserOverlayProviders } from "@solitude/browser/dom/overlayPorts";
import {
  resolveRendererBackend,
  type RendererBackend,
  type RenderFailure,
} from "@solitude/browser/dom/rendererBackend";
import {
  getOrCreateDomViewLayers,
  orderViewDefinitionsPrimaryFirst,
  removeExtraDomViews,
} from "@solitude/browser/dom/view";
import { createBrowserViewPresenter } from "@solitude/browser/dom/viewPresenter";
import {
  createRemoteViewPresenterRenderer,
  type RemoteViewPresenterRenderer,
} from "@solitude/browser/remoteViewPresenter";
import { mat3, vec3 } from "@solitude/engine/math";
import {
  type ControlInput,
  type FramePolicy,
  type GamePlugin,
  type RuntimeOptions,
} from "@solitude/engine/plugin";
import { buildViewDefinitions } from "@solitude/engine/render";
import {
  type RuntimeEntitySnapshot,
  type RuntimeWorldSnapshot,
} from "@solitude/engine/runtime";
import type {
  ControlledBody,
  EntityConfig,
  EntityId,
  World,
} from "@solitude/engine/world";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import type { SolitudeInputSequence } from "@solitude/protocol/protocol";
import { buildWorldAndSceneConfig } from "@solitude/sim/config/worldAndSceneConfig";
import type { LocalEntityPredictionProvider } from "@solitude/sim/localPrediction";
import { createRemoteClientComposition } from "./composition";
import {
  acknowledgeLocalInputs,
  createLocalPredictionState,
  hasActiveLocalPrediction,
  recordLocalInput,
} from "./localPrediction";
import {
  applyLocalVisualCorrection,
  captureLocalShipVisualState,
  copyLocalPredictionErrorMetrics,
  createLocalReconciliationState,
  reconcileLocalShipVisualState,
  restoreLocalShipVisualState,
  type LocalPredictionErrorMetrics,
  type LocalShipVisualState,
} from "./localReconciliation";
import {
  copyRuntimeEntitySnapshotInto,
  copyRuntimeSnapshotInterpolationMetrics,
  createRuntimeSnapshotInterpolationBuffer,
  type RuntimeSnapshotInterpolationMetrics,
} from "./remoteSnapshotInterpolator";

declare global {
  interface Window {
    __solitudeInterpolationMetrics?: RuntimeSnapshotInterpolationMetrics;
    __solitudePredictionMetrics?: LocalPredictionErrorMetrics;
    __solitudeRemoteRenderState?: SolitudeRemoteRenderDebugState;
  }
}

export interface RemoteClientSnapshotMessage {
  entities: RuntimeWorldSnapshot["entities"];
  lastProcessedInputSequences: Record<EntityId, SolitudeInputSequence>;
  modelVersion: number;
  simulationMillisPerWallMillis?: number;
  simulationTimeMillis: number;
  tick: number;
}

export interface SolitudeRemoteClientRendererOptions {
  container: Element;
  getFocusEntityId: () => string;
  onFatalError: (failure: RenderFailure) => void;
  plugins: GamePlugin[];
  runtimeOptions: RuntimeOptions;
}

export interface SolitudeRemoteClientRenderer {
  getDebugState: () => SolitudeRemoteRenderDebugState;
  pushSnapshotMessage: (message: RemoteClientSnapshotMessage) => void;
  renderFrame: (nowMillis: number, dtMillis: number) => boolean;
  setModel: (entities: readonly EntityConfig[], modelVersion: number) => void;
  setControlState: (
    controls: Partial<ControlInput>,
    inputSequence: SolitudeInputSequence,
  ) => void;
  toggleInterpolation: () => boolean;
  togglePrediction: () => boolean;
}

export interface SolitudeRemoteRenderDebugState {
  backend: RendererBackend;
  fatalError: RenderFailure["code"] | null;
  interpolationEnabled: boolean;
  predictionEnabled: boolean;
}

const maxPredictionMillis = 250;
const interpolationRuntimeOption = "interpolation";
const predictionRuntimeOption = "prediction";

export function createSolitudeRemoteClientRenderer({
  container,
  getFocusEntityId,
  onFatalError,
  plugins: clientPlugins,
  runtimeOptions,
}: SolitudeRemoteClientRendererOptions): SolitudeRemoteClientRenderer {
  const backend = resolveRendererBackend(runtimeOptions);
  const {
    capabilityRegistry,
    localPredictionProviders,
    overlayProviders,
    plugins,
  } = createRemoteClientComposition({
    clientPlugins,
    runtimeOptions,
  });
  const predictionState = createLocalPredictionState();
  const framePolicy: FramePolicy = {
    advanceOverlay: true,
    advanceScene: true,
    advanceSim: false,
  };
  let latestSnapshot: RuntimeWorldSnapshot | null = null;
  let latestSnapshotReceivedAtMillis = 0;
  let messageSimulationTimeMillis = 0;
  let modelVersion = 0;
  let interpolateRemoteSnapshots =
    shouldUseRemoteSnapshotInterpolation(runtimeOptions);
  let predictLocalShip = shouldUseLocalPrediction(runtimeOptions);
  let interpolationBuffer = createRuntimeSnapshotInterpolationBuffer();
  const mixedSnapshot: RuntimeWorldSnapshot = { entities: [] };

  let renderer: RemoteViewPresenterRenderer | null = null;
  let fatalError: RenderFailure["code"] | null = null;
  const layoutViews: LayoutView[] = [];
  let layoutInitialized = false;
  const reconciliationState = createLocalReconciliationState();
  let lastPredictedLocalState: LocalShipVisualState | null = null;
  let lastRenderedLocalState: LocalShipVisualState | null = null;

  publishRemoteRenderDebugState();

  return {
    getDebugState: () => createRemoteRenderDebugState(),
    pushSnapshotMessage: (message) => {
      if (message.modelVersion !== modelVersion) return;
      const nowMillis = performance.now();
      latestSnapshot = { entities: message.entities };
      latestSnapshotReceivedAtMillis = nowMillis;
      messageSimulationTimeMillis = message.simulationTimeMillis;
      interpolationBuffer.push(
        latestSnapshot,
        message.tick,
        message.simulationTimeMillis,
        nowMillis,
        message.simulationMillisPerWallMillis,
      );
      const focusEntityId = getFocusEntityId();
      if (focusEntityId.length > 0) {
        acknowledgeLocalInputs(
          predictionState,
          focusEntityId,
          message.lastProcessedInputSequences,
        );
        const authoritativeState = findSnapshotEntity(
          message.entities,
          focusEntityId,
        );
        if (predictLocalShip && authoritativeState) {
          reconcileLocalShipVisualState(
            reconciliationState,
            lastPredictedLocalState,
            lastRenderedLocalState,
            authoritativeState,
            nowMillis,
          );
          publishPredictionMetrics();
        }
      }
    },
    renderFrame: (nowMillis, dtMillis) => {
      if (!latestSnapshot || !renderer) return false;
      renderer.resizeToDisplaySize(window.devicePixelRatio || 1);
      const focusEntityId = getFocusEntityId();
      if (focusEntityId.length > 0) {
        renderer.setFocusEntityId(focusEntityId);
      }
      const predictionMillis = getPredictionMillis(nowMillis);
      const interpolatedSnapshot = interpolateRemoteSnapshots
        ? (interpolationBuffer.sample(
            messageSimulationTimeMillis,
            latestSnapshotReceivedAtMillis,
            nowMillis,
          ) ?? latestSnapshot)
        : latestSnapshot;
      if (interpolateRemoteSnapshots) publishInterpolationMetrics();
      const renderSnapshot = createRenderSnapshot(
        renderer,
        interpolatedSnapshot,
        latestSnapshot,
        focusEntityId,
      );
      const rendered = renderPredictedSnapshot(
        renderer,
        renderSnapshot,
        focusEntityId,
        predictionMillis,
        dtMillis,
        nowMillis,
      );
      if (!rendered) return false;
      applyBrowserOverlayProviders(
        overlayProviders,
        {
          advanceOverlay: true,
          controlInput: predictionState.controlInput,
          framePolicy,
          mainFocus: renderer.worldRenderer.primaryView.renderParams.mainFocus,
          nowMs: nowMillis,
          primaryOverlayRasterizer: renderer.overlayRasterizer,
          simTimeMillis: messageSimulationTimeMillis + predictionMillis,
          world: renderer.worldRenderer.mirror.world,
        },
        capabilityRegistry,
      );
      return true;
    },
    setControlState: (controls, inputSequence) => {
      recordLocalInput(predictionState, controls, inputSequence);
    },
    setModel: (entities, nextModelVersion) => {
      modelVersion = nextModelVersion;
      renderer?.dispose();
      renderer = createRenderer(plugins, entities);
      latestSnapshot = null;
      latestSnapshotReceivedAtMillis = 0;
      messageSimulationTimeMillis = 0;
      interpolationBuffer = createRuntimeSnapshotInterpolationBuffer();
      predictionState.pendingInputs.splice(
        0,
        predictionState.pendingInputs.length,
      );
      predictionState.controlInput = {};
      resetLocalPredictionProviders(localPredictionProviders);
      reconciliationState.correction.active = false;
      lastPredictedLocalState = null;
      lastRenderedLocalState = null;
    },
    toggleInterpolation: () => {
      interpolateRemoteSnapshots = !interpolateRemoteSnapshots;
      publishRemoteRenderDebugState();
      return interpolateRemoteSnapshots;
    },
    togglePrediction: () => {
      predictLocalShip = !predictLocalShip;
      if (!predictLocalShip) {
        reconciliationState.correction.active = false;
        lastPredictedLocalState = null;
        lastRenderedLocalState = null;
      }
      publishRemoteRenderDebugState();
      return predictLocalShip;
    },
  };

  function renderPredictedSnapshot(
    renderer: RemoteViewPresenterRenderer,
    snapshot: RuntimeWorldSnapshot,
    focusEntityId: string,
    predictionMillis: number,
    dtMillis: number,
    nowMillis: number,
  ): boolean {
    if (
      focusEntityId.length === 0 ||
      !shouldUseLocalRenderPath(predictionMillis)
    ) {
      return renderer.renderSnapshot(snapshot, {
        dtMillis,
        dtSimMillis: dtMillis,
      });
    }

    if (!renderer.worldRenderer.mirror.applySnapshot(snapshot)) return false;
    const controlledBody = findControlledBody(renderer, focusEntityId);
    if (!controlledBody) {
      return renderer.renderSnapshot(snapshot, {
        dtMillis,
        dtSimMillis: dtMillis,
      });
    }

    if (shouldPredictLocalShip(predictionMillis)) {
      applyLocalPrediction(renderer, controlledBody, predictionMillis);
    }
    lastPredictedLocalState = captureLocalShipVisualState(
      lastPredictedLocalState,
      controlledBody,
    );
    applyLocalVisualCorrection(reconciliationState, controlledBody, nowMillis);
    lastRenderedLocalState = captureLocalShipVisualState(
      lastRenderedLocalState,
      controlledBody,
    );
    renderer.renderCurrent({
      dtMillis,
      dtSimMillis: predictionMillis,
    });
    restoreLocalShipVisualState(controlledBody, lastPredictedLocalState);
    return true;
  }

  function createRenderSnapshot(
    renderer: RemoteViewPresenterRenderer,
    remoteSnapshot: RuntimeWorldSnapshot,
    authoritativeSnapshot: RuntimeWorldSnapshot,
    focusEntityId: string,
  ): RuntimeWorldSnapshot {
    if (focusEntityId.length === 0) return remoteSnapshot;
    const authoritativeEntity = findSnapshotEntity(
      authoritativeSnapshot.entities,
      focusEntityId,
    );
    if (!authoritativeEntity) return remoteSnapshot;

    mixedSnapshot.entities.length = remoteSnapshot.entities.length;
    let found = false;
    for (let i = 0; i < remoteSnapshot.entities.length; i++) {
      const remoteEntity = remoteSnapshot.entities[i];
      const authoritativeSource =
        remoteEntity.id === focusEntityId
          ? authoritativeEntity
          : findSnapshotEntity(authoritativeSnapshot.entities, remoteEntity.id);
      const source = shouldInterpolateRemoteEntity(
        renderer,
        remoteEntity.id,
        focusEntityId,
      )
        ? remoteEntity
        : (authoritativeSource ?? remoteEntity);
      if (source.id === focusEntityId) found = true;
      mixedSnapshot.entities[i] = copyRuntimeEntitySnapshotInto(
        mixedSnapshot.entities[i] ?? createRuntimeEntitySnapshotStorage(),
        source,
      );
    }
    if (!found) {
      mixedSnapshot.entities.push(
        copyRuntimeEntitySnapshotInto(
          createRuntimeEntitySnapshotStorage(),
          authoritativeEntity,
        ),
      );
    }
    return mixedSnapshot;
  }

  function shouldInterpolateRemoteEntity(
    renderer: RemoteViewPresenterRenderer,
    entityId: EntityId,
    focusEntityId: EntityId,
  ): boolean {
    return (
      entityId !== focusEntityId &&
      renderer.worldRenderer.mirror.world.controllableBodies.some(
        (body) => body.id === entityId,
      )
    );
  }

  function applyLocalPrediction(
    renderer: RemoteViewPresenterRenderer,
    controlledBody: ControlledBody,
    predictionMillis: number,
  ): void {
    const world = renderer.worldRenderer.mirror.world;
    const provider = findLocalPredictionProvider(
      localPredictionProviders,
      controlledBody,
      world,
    );
    if (!provider) return;
    provider.predictEntity({
      controlInput: predictionState.controlInput,
      controlledBody,
      dtMillis: predictionMillis,
      world,
    });
  }

  function shouldUseLocalRenderPath(predictionMillis: number): boolean {
    return (
      predictLocalShip &&
      (shouldPredictLocalShip(predictionMillis) ||
        reconciliationState.correction.active)
    );
  }

  function shouldPredictLocalShip(predictionMillis: number): boolean {
    return (
      predictLocalShip &&
      predictionMillis > 0 &&
      hasActiveLocalPrediction(predictionState)
    );
  }

  function findControlledBody(
    renderer: RemoteViewPresenterRenderer,
    focusEntityId: string,
  ) {
    return renderer.worldRenderer.mirror.world.controllableBodies.find(
      (body) => body.id === focusEntityId,
    );
  }

  function findSnapshotEntity(
    entities: readonly RuntimeEntitySnapshot[],
    entityId: EntityId,
  ): RuntimeEntitySnapshot | undefined {
    return entities.find((entity) => entity.id === entityId);
  }

  function createRuntimeEntitySnapshotStorage(): RuntimeEntitySnapshot {
    return {
      id: "",
      orientation: mat3.zero(),
      position: vec3.zero(),
      velocity: vec3.zero(),
    };
  }

  function publishPredictionMetrics(): void {
    window.__solitudePredictionMetrics = copyLocalPredictionErrorMetrics(
      reconciliationState.metrics,
    );
  }

  function publishInterpolationMetrics(): void {
    window.__solitudeInterpolationMetrics =
      copyRuntimeSnapshotInterpolationMetrics(interpolationBuffer.metrics);
  }

  function publishRemoteRenderDebugState(): void {
    window.__solitudeRemoteRenderState = createRemoteRenderDebugState();
  }

  function createRemoteRenderDebugState(): SolitudeRemoteRenderDebugState {
    return {
      backend,
      fatalError,
      interpolationEnabled: interpolateRemoteSnapshots,
      predictionEnabled: predictLocalShip,
    };
  }

  function getPredictionMillis(nowMillis: number): number {
    if (latestSnapshotReceivedAtMillis <= 0) return 0;
    return Math.min(
      maxPredictionMillis,
      Math.max(0, nowMillis - latestSnapshotReceivedAtMillis),
    );
  }

  function createRenderer(
    plugins: GamePlugin[],
    entities: readonly EntityConfig[],
  ) {
    const config = buildWorldAndSceneConfig();
    applyWorldModelPlugins(config, plugins);
    config.entities.push(...entities);
    const focusEntityId = getFocusEntityId();
    config.mainFocusEntityId =
      focusEntityId.length > 0 ? focusEntityId : (entities[0]?.id ?? "");
    const viewDefinitions = buildViewDefinitions(config, plugins);
    const presentedViews = orderViewDefinitionsPrimaryFirst(
      viewDefinitions,
    ).map((definition, index) => {
      const layers = getOrCreateDomViewLayers(container, index, definition);
      const presenter = createBrowserViewPresenter({
        backend,
        labelMode: definition.labelMode,
        onFatalError: handleFatalError,
        overlayCanvas: layers.overlayCanvas,
        sceneCanvas: layers.sceneCanvas,
      });
      return { definition, layers, presenter };
    });
    removeExtraDomViews(container, presentedViews.length);
    replaceLayoutViews(
      layoutViews,
      presentedViews.map(({ definition, layers, presenter }) => ({
        element: layers.element,
        layout: definition.layout,
        resize: presenter.resize,
      })),
    );
    if (layoutInitialized) {
      resizeLayout(container, layoutViews);
    } else {
      initLayout(container, layoutViews);
      layoutInitialized = true;
    }
    return createRemoteViewPresenterRenderer({
      config,
      plugins,
      views: presentedViews.map(({ definition, presenter }) => ({
        presenter,
        viewId: definition.id,
      })),
    });
  }

  function handleFatalError(failure: RenderFailure): void {
    fatalError = failure.code;
    publishRemoteRenderDebugState();
    onFatalError(failure);
  }
}

export function shouldUseRemoteSnapshotInterpolation(
  runtimeOptions: RuntimeOptions = {},
): boolean {
  return isRuntimeOptionEnabled(runtimeOptions[interpolationRuntimeOption]);
}

export function shouldUseLocalPrediction(
  runtimeOptions: RuntimeOptions = {},
): boolean {
  return isRuntimeOptionEnabledDefaultOff(
    runtimeOptions[predictionRuntimeOption],
  );
}

function isRuntimeOptionEnabled(value: string | undefined): boolean {
  const normalized = value?.toLowerCase();
  return normalized !== "off" && normalized !== "false" && normalized !== "0";
}

function isRuntimeOptionEnabledDefaultOff(value: string | undefined): boolean {
  const normalized = value?.toLowerCase();
  return normalized === "on" || normalized === "true" || normalized === "1";
}

function findLocalPredictionProvider(
  providers: readonly LocalEntityPredictionProvider[],
  controlledBody: ControlledBody,
  world: World,
): LocalEntityPredictionProvider | null {
  for (const provider of providers) {
    if (provider.canPredictEntity(controlledBody, world)) return provider;
  }
  return null;
}

function resetLocalPredictionProviders(
  providers: readonly LocalEntityPredictionProvider[],
): void {
  for (const provider of providers) {
    provider.resetPrediction();
  }
}

function replaceLayoutViews(
  into: LayoutView[],
  views: readonly LayoutView[],
): void {
  into.length = 0;
  into.push(...views);
}
