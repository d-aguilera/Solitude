import type { ViewController } from "../projection/ViewController";

/**
 * Core configuration and controller for rendering a scene from a particular
 * viewpoint.
 *
 * Owns the underlying ViewController and exposes only the projection
 * helpers and debug overlay used by renderers.
 */

export class ViewConfig {
  constructor(private readonly controller: ViewController) {}

  getController(): ViewController {
    return this.controller;
  }
}
