import { createRemoteCanvasRenderer } from "@solitude/browser/remoteCanvasRenderer";
import { vec3 } from "@solitude/engine/math";
import type { ControlInput, GamePlugin } from "@solitude/engine/plugin";
import { formatSpeed } from "@solitude/engine/render";
import {
  createPluginCapabilityRegistry,
  type RuntimeWorldSnapshot,
} from "@solitude/engine/runtime";
import type { EntityConfig } from "@solitude/engine/world";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import { buildWorldAndSceneConfig } from "@solitude/sim/config/worldAndSceneConfig";
import {
  hudPanelCapability,
  isHudPanelProvider,
  type HudPanelProvider,
} from "solitude/plugins/hud/capabilities";
import { clearHudGrid, createHudGrid } from "solitude/plugins/hud/grid";
import { loadPlugins } from "solitude/plugins/index";
import { createRuntimeSnapshotInterpolationBuffer } from "./remoteSnapshotInterpolator";

const remoteRenderPluginIds = [
  "solarSystem",
  "spacecraftOperator",
  "orbitTelemetry",
  "bodyLabels",
  "axialViews",
  "trajectories",
  "velocitySegments",
];

export interface RemoteClientSnapshotMessage {
  snapshot: RuntimeWorldSnapshot;
  tick: number;
}

export interface SolitudeRemoteClientRendererOptions {
  canvas: HTMLCanvasElement;
  getFocusEntityId: () => string;
  hudElement: Element;
  statusElement: Element;
}

export interface SolitudeRemoteClientRenderer {
  pushSnapshotMessage: (
    message: RemoteClientSnapshotMessage,
    receivedAtMillis: number,
  ) => void;
  renderFrame: (nowMillis: number, dtMillis: number) => boolean;
  setModel: (entities: readonly EntityConfig[]) => void;
  setControlState: (controls: Partial<ControlInput>) => void;
}

export function createSolitudeRemoteClientRenderer({
  canvas,
  getFocusEntityId,
  hudElement,
  statusElement,
}: SolitudeRemoteClientRendererOptions): SolitudeRemoteClientRenderer {
  const plugins = loadPlugins(remoteRenderPluginIds, { ships: "dynamic" });
  const hudProviders = collectHudPanelProviders(plugins);
  const hudGrid = createHudGrid();
  const controlInput: ControlInput = {};
  let selectedThrustLevel = 0;
  let interpolationBuffer = createRuntimeSnapshotInterpolationBuffer();

  let renderer: ReturnType<typeof createRemoteCanvasRenderer> | null = null;

  return {
    pushSnapshotMessage: (message, receivedAtMillis) => {
      interpolationBuffer.push(
        message.snapshot,
        message.tick,
        receivedAtMillis,
      );
    },
    renderFrame: (nowMillis, dtMillis) => {
      const snapshot = interpolationBuffer.sample(nowMillis);
      if (!snapshot || !renderer) return false;
      const focusEntityId = getFocusEntityId();
      const focusChanged =
        focusEntityId.length > 0
          ? renderer.setFocusEntityId(focusEntityId)
          : false;
      const rendered = renderer.renderSnapshot(snapshot, {
        dtMillis,
        dtSimMillis: dtMillis,
      });
      if (!rendered) return false;
      renderHud(
        hudElement,
        hudGrid,
        hudProviders,
        {
          controlInput,
          nowMs: nowMillis,
          simTimeMillis: interpolationBuffer.latestTick,
          world: renderer.worldRenderer.mirror.world,
          mainFocus: renderer.worldRenderer.renderParams.mainFocus,
        },
        selectedThrustLevel,
      );

      statusElement.textContent =
        "engine rendered tick " +
        interpolationBuffer.latestTick +
        " | focus " +
        (focusChanged
          ? focusEntityId
          : renderer.worldRenderer.renderParams.mainFocus.entityId) +
        " | faces " +
        renderer.renderedView.faceCount +
        " | labels " +
        renderer.renderedView.sceneLabelCount +
        " | segments " +
        renderer.renderedView.segmentCount;
      return true;
    },
    setControlState: (controls) => {
      for (const [action, value] of Object.entries(controls)) {
        if (value !== undefined) controlInput[action] = value;
        if (value === true && action.startsWith("thrust")) {
          selectedThrustLevel = Number(action.slice("thrust".length));
        }
      }
    },
    setModel: (entities) => {
      renderer = createRenderer(plugins, entities);
      interpolationBuffer = createRuntimeSnapshotInterpolationBuffer();
    },
  };

  function createRenderer(
    plugins: ReturnType<typeof loadPlugins>,
    entities: readonly EntityConfig[],
  ) {
    const config = buildWorldAndSceneConfig();
    applyWorldModelPlugins(config, plugins);
    config.entities.push(...entities);
    const focusEntityId = getFocusEntityId();
    config.mainFocusEntityId =
      focusEntityId.length > 0 ? focusEntityId : (entities[0]?.id ?? "");
    return createRemoteCanvasRenderer({
      canvas,
      config,
      plugins,
    });
  }
}

function collectHudPanelProviders(plugins: readonly GamePlugin[]) {
  const capabilityRegistry = createPluginCapabilityRegistry(
    plugins.flatMap((plugin) => plugin.capabilities ?? []),
  );
  return capabilityRegistry
    .getAll(hudPanelCapability)
    .filter(isHudPanelProvider);
}

function renderHud(
  element: Element,
  grid: ReturnType<typeof createHudGrid>,
  providers: readonly HudPanelProvider[],
  context: Parameters<HudPanelProvider["writeHud"]>[1],
  selectedThrustLevel: number,
): void {
  clearHudGrid(grid);
  for (const provider of providers) {
    provider.writeHud(grid, context);
  }

  const lines: string[] = [];
  lines.push(
    "Ship: speed " +
      formatSpeed(vec3.length(context.mainFocus.controlledBody.velocity)) +
      " | thrust " +
      selectedThrustLevel +
      " | autopilot " +
      formatRemoteAutopilotMode(context.controlInput),
  );
  for (const row of grid) {
    const cells = row.filter(Boolean);
    if (cells.length > 0) lines.push(cells.join(" | "));
  }
  element.textContent = lines.length > 0 ? lines.join("\n") : "HUD waiting";
}

function formatRemoteAutopilotMode(controlInput: ControlInput): string {
  if (controlInput.circleNow) return "circle";
  if (controlInput.alignToBody) return "body";
  if (controlInput.alignToVelocity) return "velocity";
  return "off";
}
