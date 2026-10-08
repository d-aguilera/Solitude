import type { GamePlugin } from "@solitude/engine/plugin";
import type { WorldAndSceneConfig } from "@solitude/engine/world";
import { bootstrapWith, type BrowserRuntimeHandle } from "./domBootstrap";
import type { BrowserKeyboardHost } from "./domKeyboardInput";
import type { RenderFailure } from "./renderFailure";

export interface RendererDebugState {
  backend: "webgl";
  fatalError: RenderFailure["code"] | null;
}

declare global {
  interface Window {
    __solitudeRendererState?: RendererDebugState;
  }
}

export interface RenderingBootstrapOptions {
  config: WorldAndSceneConfig;
  keyboardHost: BrowserKeyboardHost;
  onFatalError: (failure: RenderFailure) => void;
  plugins: GamePlugin[];
}

export function bootstrapRendering({
  config,
  keyboardHost,
  onFatalError,
  plugins,
}: RenderingBootstrapOptions): BrowserRuntimeHandle {
  window.__solitudeRendererState = { backend: "webgl", fatalError: null };
  return bootstrapWith(
    config,
    plugins,
    (failure) => {
      window.__solitudeRendererState = {
        backend: "webgl",
        fatalError: failure.code,
      };
      onFatalError(failure);
    },
    keyboardHost,
  );
}
