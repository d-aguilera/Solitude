# GPU Polylines And Depth-Tested Overlays

## Purpose

- Move trajectory-style 3D line visualizations from always-on-top Canvas overlays into WebGL passes that can participate in scene depth.
- Start with trajectory `PolylineSceneObject`s, then expand deliberately to world segments and markers if the same occlusion behavior is useful.
- Preserve renderer-neutral engine contracts while keeping WebGL resource ownership in `@solitude/browser`.

## Current Problem

- Trajectories are `PolylineSceneObject`s backed by sampled 3D world points, but the current WebGL view still sends them through `SceneOverlayRenderer` and `CanvasSceneOverlayRasterizer`.
- Because the Canvas overlay is painted after the WebGL scene, trajectories are never occluded by planets, stars, or ships.
- This is especially visible where a planet trajectory starts at the body center and draws through the visible surface instead of disappearing until it emerges at the limb/surface.

## Scope

### First Slice

- Promote scene-object polylines from Canvas overlay drawing into a browser-owned WebGL pass.
- Keep labels, HUD, markers, and world segments on Canvas.
- Draw solid meshes first, then draw trajectory ribbons with depth testing enabled and depth writes disabled.
- Preserve the existing render-debug polyline switch as the single on/off control.

### Likely Later Slices

- Move `worldSegments` to WebGL when they need scene occlusion, especially targeting and guide lines.
- Move selected `worldMarkers` to WebGL if surface/occlusion behavior matters.
- Add styling once correctness is established: antialiasing, opacity, fades, dashed lines, or glow.

## Non-Goals

- Do not introduce WebGL resources into engine world models, scene contracts, or protocol messages.
- Do not add CPU sphere clipping as the main occlusion strategy.
- Do not move labels or HUD into WebGL as part of this effort.
- Do not rely on native wide `gl.LINES`.

## Design

### Engine Contract

- Keep the engine contract renderer-neutral.
- Trajectories remain `PolylineSceneObject`s with world-space `mesh.points`, `count`, `tail`, `lineWidth`, and RGB color.
- The first WebGL pass should honor `params.objectsFilter`.
- The pass should skip non-polyline objects and invalid/empty rings using the same semantics as `renderPolylinesInto`.

### Ribbon Model

- Do not rely on native `gl.LINES` for trajectory width. Browser/driver support for line widths above 1px is not portable.
- Render each visible segment as a screen-space ribbon: a quad made from two triangles, expanded perpendicular to the segment in post-projection screen space.
- Ribbon width is visual, not physical. `PolylineSceneObject.lineWidth` remains a pixel-width presentation control, so distant trajectories stay readable as long as they project into the view.
- Depth remains world/camera based. Ribbon fragments compare against the WebGL depth buffer written by solid bodies, so planets hide the center-to-surface part of their own trajectories.

### Depth And Projection

- The trajectory shader must match the solid mesh projection conventions:
  - camera-relative world positions are computed in JavaScript doubles before upload;
  - camera axes and focal lengths are supplied as uniforms;
  - near-plane behavior uses `renderNearDepth`;
  - fragment depth uses the same logarithmic mapping and per-frame far range as `solidMesh.frag.glsl`.
- Reuse or share the far-depth calculation used by `GpuSceneRenderer` so solids and trajectories agree on `uLogDepthRange`.
- Avoid a camera-facing depth bias in the first implementation. If surface-adjacent z-fighting appears later, add an explicit tiny bias only after measuring the artifact.
- Long segments crossing large depth ranges may need subdivision for better occlusion near body silhouettes. Existing time-sampled trajectories may be dense enough; verify before adding CPU subdivision.

### GPU Pass Shape

- Add a browser-owned `GpuPolylineRenderer` under `packages/browser/src/rasterize/webgl/`.
- `GpuSceneRenderer` owns and disposes the polyline renderer, so one WebGL view/context owns one set of trajectory GPU resources.
- `GpuSceneRenderer.render(params)` should:
  1. clear color/depth;
  2. render solid mesh objects as today;
  3. if `params.renderPolylines` is true, render depth-tested trajectory ribbons;
  4. leave Canvas overlay projection to labels, markers, and world segments.

### Buffer Strategy

- Trajectories are dynamic ring buffers, so use a reusable typed-array workspace and upload the active ribbon vertices each frame with dynamic buffer usage.
- First implementation can build expanded ribbon vertices on the CPU to keep the shader simple and make width/clipping behavior explicit.
- The CPU builder should transform segment endpoints to camera space, clip them against the frustum, project them to NDC/screen, expand to the requested pixel width, and upload two triangles per visible segment.
- Keep allocations stable: grow typed arrays geometrically when capacity is exceeded, then reuse them across frames.
- A later optimization can move expansion into the vertex shader by uploading endpoints plus a side/corner attribute, but that is not required for the first correct implementation.

### Canvas Overlay Interaction

- Once WebGL owns polylines, WebGL-backed views should not also draw `RenderedPolyline`s on Canvas.
- Prefer making `WebGLViewRenderer` pass `renderPolylines: false` or otherwise suppress polyline overlay generation after `GpuSceneRenderer` has drawn them, while preserving the existing `renderPolylines` debug flag as the single on/off switch.
- Standalone and remote paths both call the same `ViewRenderer.renderInto` and `rasterizeSceneOverlay` flow, so the suppression must work for both.
- Existing Canvas overlay rasterizer remains unchanged for labels, markers, and segments.

## Tests And Verification

- Unit-test the CPU ribbon builder separately from WebGL where possible:
  - skips empty/invalid polyline rings;
  - respects ring `count`/`tail` order;
  - clips segments crossing the near plane/frustum;
  - emits stable vertex counts for simple polylines;
  - applies pixel width in NDC according to surface size.
- Extend the recording WebGL tests enough to confirm:
  - solid meshes draw before trajectory ribbons;
  - polyline rendering is gated by `renderPolylines`;
  - buffers/programs are disposed;
  - `objectsFilter` applies to polylines.
- Manual browser checks:
  - a planet trajectory starting at body center is hidden until it emerges at the visible surface;
  - far orbital trails remain visible at their configured pixel width;
  - primary and PiP views both render trajectories;
  - labels/HUD still draw above everything;
  - disabling `__solitudeRenderDebug.passes.polylines` hides WebGL trajectories too.

## Open Questions

- Are existing trajectory sample intervals dense enough for convincing silhouette occlusion, or do long segments need adaptive subdivision before upload?
- Should future world segments share the same ribbon builder, or use a separate path because they are not ring-buffered scene objects?
- Should depth-tested markers be true world-space impostors, screen-space quads with depth, or a mix depending on marker type?
- What visual styling is appropriate once correctness lands: hard opaque strokes first, then antialiasing/opacity/fade?

## Deferred

- Move `worldSegments` and `worldMarkers` to depth-tested WebGL. Targeting guides may benefit from the same treatment, but trajectory occlusion is the first slice.
- Fancy styling: antialiasing, gradients, opacity, dashed lines, age fading, and glow.
- GPU-side ribbon expansion and persistent per-trajectory buffers.
- CPU sphere clipping as a fallback; this should not be necessary while WebGL solid bodies populate the depth buffer.
