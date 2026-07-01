import type { GamePlugin } from "@solitude/engine/plugin";
import type { WorldAndSceneConfig } from "@solitude/engine/world";
import { bootstrapWith } from "./domBootstrap";
import type { RenderFailure } from "./renderFailure";
import type { TextureSourceCatalog } from "./viewPresenter";

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
  onFatalError: (failure: RenderFailure) => void;
  plugins: GamePlugin[];
  textureSources?: TextureSourceCatalog;
}

export function bootstrapRendering({
  config,
  onFatalError,
  plugins,
  textureSources,
}: RenderingBootstrapOptions): void {
  window.__solitudeRendererState = { backend: "webgl", fatalError: null };
  bootstrapWith(
    config,
    plugins,
    (failure) => {
      window.__solitudeRendererState = {
        backend: "webgl",
        fatalError: failure.code,
      };
      onFatalError(failure);
    },
    textureSources,
  );
}
