export interface RenderFailurePanelOptions {
  canvasHref: string;
  container: Element;
  message: string;
  recoveryLabel: string;
  title: string;
}

export function showRenderFailurePanel({
  canvasHref,
  container,
  message,
  recoveryLabel,
  title,
}: RenderFailurePanelOptions): void {
  container.replaceChildren();
  const panel = document.createElement("section");
  panel.setAttribute("role", "alert");
  panel.style.position = "absolute";
  panel.style.inset = "0";
  panel.style.display = "grid";
  panel.style.placeContent = "center";
  panel.style.gap = "12px";
  panel.style.padding = "24px";
  panel.style.color = "white";
  panel.style.background = "#080b0a";
  panel.style.font = "16px system-ui, sans-serif";
  panel.style.textAlign = "center";

  const heading = document.createElement("h1");
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.textContent = message;
  const recovery = document.createElement("a");
  recovery.href = canvasHref;
  recovery.textContent = recoveryLabel;
  recovery.style.color = "#9fe6c0";
  panel.append(heading, detail, recovery);
  container.appendChild(panel);
}

export function createCanvasRendererHref(location: Location): string {
  const url = new URL(location.href);
  url.searchParams.set("renderer", "canvas");
  return url.toString();
}
