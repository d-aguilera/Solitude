import {
  createCanvasRendererHref,
  showRenderFailurePanel,
} from "@solitude/browser/dom/renderFailurePanel";
import type { RenderFailure } from "@solitude/browser/dom/rendererBackend";
import { parseRuntimeOptionsFromSearch } from "@solitude/browser/dom/runtimeOptions";
import type { ControlInput } from "@solitude/engine/plugin";
import type {
  SolitudeGameId,
  SolitudeServerMessage,
} from "@solitude/protocol/protocol";
import {
  createRuntimeOptionsWithResolvedLocale,
  resolveSolitudeLocale,
} from "@solitude/sim/localization";
import {
  createKeyboardInputPatcher,
  createSolitudeWebSocketClient,
  solitudeSpacecraftKeyMap,
} from "./client";
import { createClientLocalization } from "./localization";
import {
  createSocketUrl,
  queryElement,
  queryInput,
  readClientId,
  readServerBaseUrl,
} from "./pageShared";
import { createSolitudeRemoteClientRenderer } from "./remoteClientRenderer";
import { createRemoteIdentityHudPlugin } from "./remoteIdentityHud";
import { createRemoteRuntimeTelemetryHudPlugin } from "./remoteRuntimeTelemetryHud";

const fields = {
  clientId: queryInput("#clientId"),
  entityId: queryInput("#entityId"),
  gameId: queryInput("#gameId"),
};
fields.clientId.value = readClientId(fields.clientId.value);

const canvasContainer = queryElement(".canvas-container");
const searchParams = new URLSearchParams(window.location.search);
const serverBaseUrl = readServerBaseUrl(searchParams);
const initialGameId = searchParams.get("gameId");
const runtimeOptions = createRuntimeOptionsWithResolvedLocale(
  parseRuntimeOptionsFromSearch(window.location.search),
  navigator.languages,
);
const localization = createClientLocalization(
  resolveSolitudeLocale(runtimeOptions),
);
document.documentElement.lang = localization.htmlLang;
const remoteRuntimeTelemetryHud =
  createRemoteRuntimeTelemetryHudPlugin(localization);

const engineRenderer = createSolitudeRemoteClientRenderer({
  container: canvasContainer,
  getFocusEntityId: () => fields.entityId.value,
  onFatalError: showFatalRenderError,
  runtimeOptions,
  plugins: [
    createRemoteIdentityHudPlugin({
      getEntityId: () => fields.entityId.value,
      getGameId: () => fields.gameId.value,
      localization,
    }),
    remoteRuntimeTelemetryHud.plugin,
  ],
});

function showFatalRenderError(failure: RenderFailure): void {
  const messages = localization.rendererFailure;
  const message =
    failure.code === "webgl-context-lost"
      ? messages.contextLost
      : failure.code === "webgl2-unavailable"
        ? messages.unavailable
        : messages.program;
  showRenderFailurePanel({
    canvasHref: createCanvasRendererHref(window.location),
    container: canvasContainer,
    message,
    recoveryLabel: messages.recovery,
    title: messages.title,
  });
}

let client = createClient();
let activeAutopilotAction: string | null = null;
let lastFrameMillis = performance.now();
let serverSimulationRate = 1;

const minServerSimulationRate = 1;
const maxServerSimulationRate = 1024;

const remoteAutopilotKeyMap: Readonly<Record<string, string>> = {
  KeyC: "alignToBody",
  KeyV: "alignToVelocity",
  KeyX: "circleNow",
};

const remoteDebugKeyMap: Readonly<
  Record<
    string,
    | "decreaseSimulationRate"
    | "increaseSimulationRate"
    | "interpolation"
    | "prediction"
  >
> = {
  BracketLeft: "decreaseSimulationRate",
  BracketRight: "increaseSimulationRate",
  KeyI: "interpolation",
  KeyP: "prediction",
};

const keyboard = createKeyboardInputPatcher({
  keyMap: solitudeSpacecraftKeyMap,
  sendInputPatch,
});

window.addEventListener(
  "keydown",
  (event) => {
    void handleKeyboardInput(event, true);
  },
  { capture: true },
);

window.addEventListener(
  "keyup",
  (event) => {
    void handleKeyboardInput(event, false);
  },
  { capture: true },
);

if (initialGameId) {
  fields.gameId.value = initialGameId;
  void joinGame(initialGameId);
}
requestAnimationFrame(renderRemoteFrame);

function createClient() {
  return createSolitudeWebSocketClient({
    clientId: fields.clientId.value,
    createWebSocket: (url) => new WebSocket(url),
    url: createSocketUrl(serverBaseUrl),
  });
}

async function joinGame(gameId: SolitudeGameId): Promise<void> {
  resetClientForCurrentIdentity();
  try {
    handleMessages(await client.joinGame(gameId), true);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Join failed");
  }
}

function resetClientForCurrentIdentity(): void {
  if (client.clientId === fields.clientId.value) return;
  client.close();
  client = createClient();
}

async function handleKeyboardInput(
  event: KeyboardEvent,
  isDown: boolean,
): Promise<void> {
  if (isTextInputTarget(event.target)) return;
  if (handleRemoteDebugKey(event, isDown)) return;
  const isSpacecraftKey = Boolean(solitudeSpacecraftKeyMap[event.code]);
  const isAutopilotKey = Boolean(remoteAutopilotKeyMap[event.code]);
  if (!isSpacecraftKey && !isAutopilotKey) return;
  event.preventDefault();
  event.stopPropagation();
  if (!client.state.gameId || !client.state.entityId) {
    return;
  }
  if (isAutopilotKey) {
    if (handleAutopilotKey(event.code, isDown, event.repeat)) return;
  }
  const handled = await keyboard.handleKey(event.code, isDown, event.repeat);
  if (!handled) return;
}

async function sendInputPatch(
  controls: Partial<ControlInput>,
): Promise<SolitudeServerMessage[]> {
  const inputSequence = client.state.nextInputSequence;
  engineRenderer.setControlState(controls, inputSequence);
  const messages = await client.sendInputPatch(controls);
  handleMessages(messages, false);
  return messages;
}

function handleAutopilotKey(
  code: string,
  isDown: boolean,
  repeat: boolean,
): boolean {
  const action = remoteAutopilotKeyMap[code];
  if (!action) return false;
  if (!isDown || repeat) return true;
  activeAutopilotAction = activeAutopilotAction === action ? null : action;
  const controls: Partial<ControlInput> = {
    alignToBody: activeAutopilotAction === "alignToBody",
    alignToVelocity: activeAutopilotAction === "alignToVelocity",
    circleNow: activeAutopilotAction === "circleNow",
  };
  void sendInputPatch(controls);
  return true;
}

function handleRemoteDebugKey(event: KeyboardEvent, isDown: boolean): boolean {
  const action = remoteDebugKeyMap[event.code];
  if (!action) return false;
  event.preventDefault();
  event.stopPropagation();
  if (!isDown || event.repeat) return true;

  const enabled =
    action === "interpolation"
      ? engineRenderer.toggleInterpolation()
      : action === "prediction"
        ? engineRenderer.togglePrediction()
        : null;
  if (enabled !== null) {
    console.info(`Remote ${action} ${enabled ? "on" : "off"}`);
    return true;
  }

  const nextRate =
    action === "increaseSimulationRate"
      ? Math.min(maxServerSimulationRate, serverSimulationRate * 2)
      : Math.max(minServerSimulationRate, serverSimulationRate / 2);
  if (nextRate !== serverSimulationRate) {
    serverSimulationRate = nextRate;
    if (client.state.gameId) {
      void client.setSimulationRate(nextRate);
    }
  }
  console.info(`Remote simulation rate x${serverSimulationRate}`);
  return true;
}

function renderRemoteFrame(nowMillis: number): void {
  const dtMillis = Math.max(0, nowMillis - lastFrameMillis);
  lastFrameMillis = nowMillis;
  remoteRuntimeTelemetryHud.updateFps(dtMillis);
  engineRenderer.renderFrame(nowMillis, dtMillis);
  requestAnimationFrame(renderRemoteFrame);
}

function connectEvents(): void {
  if (!client.state.gameId) {
    return;
  }

  void client.connect({
    onError: () => {
      console.error("WebSocket error");
    },
    onMessage: (message) => {
      handleMessages([message], false);
    },
  });
}

function handleMessages(
  messages: readonly SolitudeServerMessage[],
  connectAfterJoin: boolean,
): void {
  for (const message of messages) {
    switch (message.type) {
      case "gameCreated":
        fields.gameId.value = message.gameId;
        break;
      case "joined":
        fields.gameId.value = message.gameId;
        fields.entityId.value = message.entityId;
        if (connectAfterJoin) connectEvents();
        break;
      case "gameModel":
        engineRenderer.setModel(message.entities, message.modelVersion);
        break;
      case "snapshot":
        serverSimulationRate =
          message.simulationMillisPerWallMillis ?? serverSimulationRate;
        engineRenderer.pushSnapshotMessage(message);
        break;
      case "error":
        console.error(message.message);
        break;
    }
  }
}

function isTextInputTarget(value: EventTarget | null): boolean {
  return (
    value instanceof HTMLInputElement ||
    value instanceof HTMLTextAreaElement ||
    value instanceof HTMLSelectElement
  );
}
