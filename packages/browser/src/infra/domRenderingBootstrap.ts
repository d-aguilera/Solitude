import type { GamePlugin } from "@solitude/engine/plugin";
import type { WorldAndSceneConfig } from "@solitude/engine/world";
import { bootstrapWith } from "./domBootstrap";
import type { RenderFailure, RendererBackend } from "./rendererBackend";

export interface RendererDebugState {
  backend: RendererBackend;
  fatalError: RenderFailure["code"] | null;
}

declare global {
  interface Window {
    __solitudeRendererState?: RendererDebugState;
  }
}

export interface RenderingBootstrapOptions {
  backend: RendererBackend;
  config: WorldAndSceneConfig;
  onFatalError: (failure: RenderFailure) => void;
  plugins: GamePlugin[];
}

export function bootstrapRendering({
  backend,
  config,
  onFatalError,
  plugins,
}: RenderingBootstrapOptions): void {
  window.__solitudeRendererState = { backend, fatalError: null };
  bootstrapWith(config, plugins, backend, (failure) => {
    window.__solitudeRendererState = {
      backend,
      fatalError: failure.code,
    };
    onFatalError(failure);
  });
}
