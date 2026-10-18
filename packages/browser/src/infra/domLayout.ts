import type { ViewLayout } from "@solitude/engine/render";
import { pipAspectRatio, pipMargin, pipWidthRatio } from "./viewportLayout";

export interface LayoutView {
  element: HTMLElement;
  layout: ViewLayout;
  resize: (cssWidth: number, cssHeight: number, pixelRatio: number) => void;
}

export function initLayout(
  container: Element,
  views: LayoutView[],
): () => void {
  let removeDprListener: (() => void) | null = null;
  let disposed = false;
  const resize = () => {
    if (!disposed) resizeCanvases(container, views);
  };
  const updatePixelRatio = () => {
    if (disposed) return;
    removeDprListener?.();
    removeDprListener = null;
    resize();
    const media = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    media.addEventListener("change", updatePixelRatio);
    removeDprListener = () =>
      media.removeEventListener("change", updatePixelRatio);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("resize", resize);
    removeDprListener?.();
    removeDprListener = null;
  };
  try {
    updatePixelRatio();
    window.addEventListener("resize", resize);
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}

export function resizeLayout(container: Element, views: LayoutView[]): void {
  resizeCanvases(container, views);
}

function resizeViewToCssBox(
  view: LayoutView,
  cssWidth: number,
  cssHeight: number,
): void {
  view.element.style.width = `${cssWidth}px`;
  view.element.style.height = `${cssHeight}px`;
  const dpr = window.devicePixelRatio || 1;
  view.resize(cssWidth, cssHeight, dpr);
}

function resizeCanvases(container: Element, views: LayoutView[]): void {
  if (!container) return;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  const primaryWidth = containerWidth;
  const primaryHeight = containerHeight;

  const primaryView = views.find((view) => view.layout.kind === "primary");
  if (primaryView) {
    primaryView.element.style.left = "0";
    primaryView.element.style.right = "auto";
    primaryView.element.style.top = "0";
    primaryView.element.style.bottom = "auto";
    resizeViewToCssBox(primaryView, primaryWidth, primaryHeight);
  }

  // PiP views: 20% of container width, fixed aspect ratio.
  const pipWidth = containerWidth * pipWidthRatio;
  const pipHeight = pipWidth / pipAspectRatio;

  for (const view of views) {
    if (view.layout.kind !== "pip") continue;
    const element = view.element;
    const layout = view.layout;
    element.style.left = "auto";
    element.style.right = "auto";
    element.style.top = "auto";
    element.style.bottom = "auto";

    if (layout.horizontal === "left") {
      element.style.left = `${pipMargin}px`;
    } else {
      element.style.right = `${pipMargin}px`;
    }

    if (layout.vertical === "top") {
      element.style.top = `${pipMargin}px`;
    } else {
      element.style.bottom = `${pipMargin}px`;
    }

    resizeViewToCssBox(view, pipWidth, pipHeight);
  }
}
