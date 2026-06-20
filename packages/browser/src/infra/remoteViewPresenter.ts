import type { GamePlugin } from "@solitude/engine/plugin";
import type { RuntimeWorldSnapshot } from "@solitude/engine/runtime";
import type { WorldAndSceneConfig } from "@solitude/engine/world";
import type { OverlayRasterizer } from "./overlayPorts";
import {
  createRemoteWorldMultiRenderer,
  rasterizeSceneOverlay,
  type RemoteWorldMultiRenderer,
  type RemoteWorldRenderedView,
  type RemoteWorldRenderOptions,
} from "./remoteWorldRenderer";
import type { BrowserViewPresenter } from "./viewPresenter";

export interface RemotePresentedView {
  presenter: BrowserViewPresenter;
  renderedView: RemoteWorldRenderedView;
}

export interface RemoteViewPresenterRenderer {
  readonly overlayRasterizer: OverlayRasterizer;
  readonly primaryView: RemotePresentedView;
  readonly views: readonly RemotePresentedView[];
  readonly worldRenderer: RemoteWorldMultiRenderer;
  dispose: () => void;
  renderCurrent: (options: RemoteWorldRenderOptions) => void;
  renderSnapshot: (
    snapshot: RuntimeWorldSnapshot,
    options: RemoteWorldRenderOptions,
  ) => boolean;
  resizeToDisplaySize: (pixelRatio: number) => void;
  setFocusEntityId: (entityId: string) => boolean;
}

export interface RemoteViewPresenterRendererOptions {
  config: WorldAndSceneConfig;
  plugins: GamePlugin[];
  views: {
    presenter: BrowserViewPresenter;
    viewId: string;
  }[];
}

export function createRemoteViewPresenterRenderer({
  config,
  plugins,
  views,
}: RemoteViewPresenterRendererOptions): RemoteViewPresenterRenderer {
  if (views.length === 0)
    throw new Error("At least one remote view is required");
  const worldRenderer = createRemoteWorldMultiRenderer({
    config,
    plugins,
    views: views.map(({ presenter, viewId }) => ({
      renderer: presenter,
      surface: presenter.surface,
      viewId,
    })),
  });
  const presentedViews = worldRenderer.views.map((renderedView, index) => ({
    presenter: views[index].presenter,
    renderedView,
  }));
  const primaryView = presentedViews.find(
    (view) => view.renderedView.viewId === worldRenderer.primaryView.viewId,
  );
  if (!primaryView) throw new Error("Required primary remote view not found");

  const rasterizeCurrent = () => {
    for (const view of presentedViews) {
      rasterizeSceneOverlay(
        view.renderedView.renderedView,
        view.presenter.sceneOverlayRasterizer,
      );
    }
  };

  return {
    dispose: () => {
      for (const view of presentedViews) view.presenter.dispose();
    },
    overlayRasterizer: primaryView.presenter.overlayRasterizer,
    primaryView,
    renderCurrent: (options) => {
      primaryView.presenter.overlayRasterizer.beginFrame();
      worldRenderer.renderCurrent(options);
      rasterizeCurrent();
    },
    renderSnapshot: (snapshot, options) => {
      primaryView.presenter.overlayRasterizer.beginFrame();
      if (!worldRenderer.renderSnapshot(snapshot, options)) return false;
      rasterizeCurrent();
      return true;
    },
    resizeToDisplaySize: (pixelRatio) => {
      for (const view of presentedViews) {
        view.presenter.resizeToDisplaySize(pixelRatio);
      }
    },
    setFocusEntityId: (entityId) => worldRenderer.setFocusEntityId(entityId),
    views: presentedViews,
    worldRenderer,
  };
}
