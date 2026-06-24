import type { ViewLayout } from "@solitude/engine/render";

let remove: (() => void) | null = null;

export interface LayoutView {
  element: HTMLElement;
  layout: ViewLayout;
  resize: (cssWidth: number, cssHeight: number, pixelRatio: number) => void;
}

export function initLayout(container: Element, views: LayoutView[]) {
  updatePixelRatio(container, views);

  window.addEventListener("resize", () => {
    resizeCanvases(container, views);
  });
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
  const aspectRatio = 16 / 9;

  let primaryWidth = containerWidth;
  let primaryHeight = containerHeight;

  const primaryView = views.find((view) => view.layout.kind === "primary");
  if (primaryView) {
    primaryView.element.style.left = "0";
    primaryView.element.style.right = "auto";
    primaryView.element.style.top = "0";
    primaryView.element.style.bottom = "auto";
    resizeViewToCssBox(primaryView, primaryWidth, primaryHeight);
  }

  // PiP views: 20% of container width, fixed aspect ratio.
  const pipWidth = containerWidth * 0.2;
  const pipHeight = pipWidth / aspectRatio;
  const pipMargin = 16;
  // Reserve vertical space so top PiP views sit below the HUD block.
  const hudTopInset = 130;

  for (const view of views) {
    if (view.layout.kind !== "pip") continue;
    const element = view.element;
    const layout = view.layout;
    element.style.left = "auto";
    element.style.right = "auto";
    element.style.top = "auto";
    element.style.bottom = "auto";

    const verticalInset =
      layout.vertical === "top" && layout.avoidHud
        ? hudTopInset + pipMargin
        : pipMargin;

    if (layout.horizontal === "left") {
      element.style.left = `${pipMargin}px`;
    } else {
      element.style.right = `${pipMargin}px`;
    }

    if (layout.vertical === "top") {
      element.style.top = `${verticalInset}px`;
    } else {
      element.style.bottom = `${verticalInset}px`;
    }

    resizeViewToCssBox(view, pipWidth, pipHeight);
  }
}

function updatePixelRatio(container: Element, views: LayoutView[]) {
  // Remove current DPR listener
  remove?.();

  resizeCanvases(container, views);

  // Add new DPR listener
  const mqString = `(resolution: ${window.devicePixelRatio}dppx)`;
  const media = matchMedia(mqString);
  const listener = () => updatePixelRatio(container, views);
  media.addEventListener("change", listener);
  remove = () => {
    media.removeEventListener("change", listener);
  };
}
