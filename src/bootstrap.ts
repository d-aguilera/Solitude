import { bootstrapDomApp } from "./infra/domCanvasBootstrap.js";

/**
 * Top‑level composition entry for the browser runtime.
 *
 * Delegates DOM/canvas wiring to an outer bootstrap module so that
 * the rest of the application can depend only on ports.
 */
function main(): void {
  bootstrapDomApp();
}

main();
