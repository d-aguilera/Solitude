# GPU Polylines And Depth-Tested Lines

## Purpose

- Move trajectory-style 3D line visualizations from always-on-top Canvas overlays into WebGL passes that participate in scene depth.
- Preserve renderer-neutral engine contracts while keeping WebGL resource ownership in `@solitude/browser`.
- Use one browser-owned screen-space ribbon path for scene-object trajectory polylines and plugin-contributed world segments.

## Delivered State

- Complete in code: WebGL-backed views render `PolylineSceneObject` trajectories and `WorldSegment`s through `GpuLineRenderer`.
- `GpuSceneRenderer` clears the frame, renders solid meshes through `GpuMeshRenderer`, then renders line ribbons through `GpuLineRenderer` with depth testing enabled and depth writes disabled.
- Trajectories and world segments now occlude against rendered planets, stars, and ships. Planet-center trajectory starts are hidden until they emerge from the visible surface.
- Canvas scene overlays no longer draw trajectories or world segments. `CanvasSceneOverlayRasterizer` draws projected labels and markers only; HUD remains a separate Canvas overlay.
- The engine still owns renderer-neutral trajectory objects and world-segment/marker provider contracts. Browser WebGL owns the GPU buffers, shaders, and draw calls.
- Ship trajectory sampling records every 2 simulated minutes with the same 720-point capacity, so piloted craft accumulate visible history much sooner than the former 20-minute cadence.

## Current Architecture

```txt
shared world + scene + camera
  -> browser WebGL presenter
       -> GpuSceneRenderer
            -> GpuMeshRenderer        depth-writing solid meshes
            -> GpuLineRenderer        depth-tested, non-depth-writing ribbons
       -> engine SceneOverlayRenderer
            -> CanvasSceneOverlayRasterizer for labels + markers
       -> browser Canvas HUD overlay
```

## Line Model

- Native wide `gl.LINES` is not used because browser/driver support for widths above 1px is not portable.
- `GpuLineRibbonBuilder` expands each visible segment into a screen-space ribbon: one quad made from two triangles.
- Ribbon width is visual, not physical. `lineWidth` remains a pixel-width presentation control, so distant lines stay readable as long as they project into the view.
- Depth remains world/camera based. Ribbon fragments compare against the depth buffer written by solid bodies and use the same logarithmic depth convention as solid meshes.
- The line pass uses dynamic buffer uploads with reusable typed-array workspace growth, so trajectory ring buffers and plugin segments can change every frame without per-segment object churn.

## Inputs

- Trajectories remain `PolylineSceneObject`s with world-space `mesh.points`, `count`, `tail`, `lineWidth`, and RGB color.
- `WorldSegment`s remain renderer-neutral plugin contributions with world-space `start`/`end`, RGB color, and `lineWidth`.
- The line builder honors `ViewRenderParams.objectsFilter` for trajectory scene objects.
- `renderPolylines` and `renderSegments` remain independent debug/render switches; both feed the WebGL line pass.

## Canvas Overlay State

- Removed from Canvas scene overlay:
  - projected trajectory polyline drawing;
  - projected world-segment drawing;
  - `RenderedPolyline` and Canvas `drawPolylines`;
  - Canvas `drawSegments`.
- Still Canvas-backed:
  - scene labels;
  - world markers;
  - HUD panels and browser overlay providers.

## Tests And Verification

- Unit coverage exists for:
  - trajectory ring traversal beyond the live-to-tail segment;
  - visible segment ribbon emission;
  - screen-space width behavior;
  - near-plane/frustum clipping;
  - empty/invalid/filtered/zero-width trajectory skipping;
  - world segment ribbon emission;
  - independent `renderPolylines`/`renderSegments` gating;
  - WebGL pass ordering, dynamic uploads, disposal, context loss, and object filtering.
- Manual browser validation performed during the effort:
  - planets visibly occlude trajectories;
  - planet-center trajectory starts are hidden by planet surfaces;
  - ship trajectories accumulate visible multi-segment history after the sampling cadence fix.

## Closure

- This depth-tested line-rendering effort is complete and archived.
- World markers intentionally remain Canvas overlay primitives and are not currently in the GPU line roadmap.
- Styling remains intentionally simple: hard opaque ribbons. There is no active styling follow-up in this memory record.
- Long line segments crossing large depth ranges may need adaptive subdivision only if future measured artifacts justify it. Existing trajectory sampling is acceptable for the current visual checks.
- GPU-side ribbon expansion could replace CPU-expanded quads only if future profiling justifies it; the current CPU builder is simple, covered, and adequate.
