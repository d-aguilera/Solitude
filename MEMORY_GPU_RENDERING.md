# GPU-Native Rendering

## Purpose

- Add a true WebGL2 scene renderer for standalone and remote play.
- Keep the authoritative protocol renderer-neutral: game models provide static meshes and snapshots provide changing state.
- Use WebGL2 as the sole solid-mesh renderer and as the renderer for depth-tested line ribbons. Canvas is reserved for scene labels, markers, and HUD.

## Non-negotiables

- Preserve strict onion layering: engine contracts remain generic, browser owns DOM/WebGL infrastructure, and product packages own composition and localized UX.
- Avoid optional parameters unless absence is semantically meaningful.
- Avoid convenience re-exports; consumers import directly from owning package subpaths.
- Keep WebGL resources out of engine world models and protocol messages.
- Performance is paramount, but the first release gate is visual and functional parity rather than a fixed frame target.

## Decisions

- WebGL is required for standalone and remote play; there is no Canvas solid-mesh backend or renderer-selection option.
- GPU failures are visible and never silently fall back. The failure UI links to the Canvas override.
- Solid meshes use native WebGL2 projection, lighting, clipping, depth testing, and rasterization.
- Scene labels, markers, and HUD remain on transparent Canvas overlays.
- Each view owns its WebGL context and GPU buffers; packed CPU mesh data is shared across views.
- Camera-relative translations are calculated in JavaScript doubles before upload to preserve astronomical precision.
- Solid meshes write logarithmic fragment depth over a visible-scene range so nearby and orbital-scale bodies occlude correctly without sacrificing the existing near-plane clipping behavior.
- Solid scene objects carry an explicit renderer-neutral uniform `meshScale`; solar-system bodies share one subdivision-4 unit sphere mesh and render at their physical radii through this scale.
- Adaptive GPU sphere LOD is selected from projected screen diameter. LOD-capable objects declare renderer-neutral `meshLod`; solar-system bodies use shared unit icospheres up to subdivision 4, while ships and polylines opt out with `meshLod: { kind: "none" }`.
- Solar-system bodies use explicit renderer-neutral smooth-sphere shading so LOD changes do not pop flat face lighting; ships and polylines keep flat shading.

## Target Shape

```txt
shared world + scene + camera
  -> browser WebGL presenter
       -> GPU-native solid mesh renderer
       -> GPU-native trajectory/world-segment line renderer
       -> engine SceneOverlayRenderer
            -> browser CanvasSceneOverlayRasterizer
       -> browser Canvas HUD overlay
```

## Milestones

1. Complete: shared layered browser views and presenter contract.
2. Complete: persistent GPU mesh packing/buffers and native faces/lighting.
3. Complete: remote-client integration without protocol, interpolation, prediction, or reconciliation changes.
4. Complete: standalone integration, WebGL default selection, and explicit Canvas override.
5. Complete in code: localized fatal GPU UX, diagnostics, automated parity seams, and removal of the screen-space WebGL rasterizer.
6. Complete: WebGL-only presentation, removal of the engine CPU-face pipeline, and explicit scene-overlay naming.

## Delivered State

- Browser presentation owns layered DOM views, synchronized device-pixel sizing, WebGL rendering, Canvas overlays, and disposal.
- The native renderer uploads packed object-local triangles once per mesh/context and sends only camera-relative transforms, lights, and uniforms per frame.
- Shared mesh identities are preserved across differently scaled objects; WebGL uploads one buffer per mesh/context and applies `meshScale` in the shader.
- Browser WebGL scene rendering is split into a frame coordinator plus dedicated mesh and line renderers; `GpuMeshRenderer` owns the solid-mesh program, VAO, mesh buffers, LOD-aware far-depth calculation, and solid draw calls.
- `GpuLineRenderer` batches trajectory polylines and world segments into screen-width WebGL ribbons. Canvas trajectory and segment drawing has been removed; trajectories and world segments are WebGL-only in browser views.
- Sphere LOD meshes are shared per browser context and lower subdivision levels are used only when the projected diameter is small enough that detail is not visible.
- WebGL flat shading uses packed face normals; smooth-sphere shading uses normalized object-local vertex position as the lighting normal.
- GPU shaders perform object transforms, camera projection, near clipping, flat lighting, tone mapping, and logarithmic depth-tested rasterization using a conservative per-frame far range derived from object bounds.
- Vertex and fragment shader sources live in dedicated `.vert.glsl` and `.frag.glsl` assets imported as raw text by the browser adapter.
- The engine `SceneOverlayRenderer` handles renderer-neutral scene overlay projection; browser Canvas scene overlays draw labels and markers. Trajectories and world segments are rendered by `GpuLineRenderer`.
- The engine no longer generates, clips, sorts, caches, or exposes CPU-rendered triangle faces.
- Standalone and remote compositions require WebGL2. Unknown `renderer` query values, including the former `renderer=canvas`, have no rendering effect.
- WebGL initialization/program/context-loss failures publish diagnostics and show localized fatal UI without advertising a fallback backend.
- Unit coverage includes mesh packing/cache reuse, one-time GPU uploads, disposal, context loss, scene overlays, and existing remote-render behavior.
- Typecheck, package boundaries, unit tests, and all production builds pass. Interactive browser verification remains a hands-on follow-up.
- Removing the CPU-face/Canvas backend reduced the production standalone JavaScript bundle from 201.05 kB to 191.93 kB and the remote game bundle from 126.86 kB to 118.21 kB in the validating build.

## Acceptance

- Primary and PiP views preserve faces, lighting, occlusion, labels, trajectories, segments, and HUD.
- Remote interpolation and local prediction/reconciliation remain behavior-compatible.
- Unchanged mesh geometry uploads once per WebGL context and is disposed with its presenter.
- Large orbital coordinates remain visually stable through camera-relative GPU inputs.
- WebGL initialization, program, and context-loss failures stop rendering and show a visible WebGL-required error.

## Current Next Step

- Keep WebGL2 rendering stable while active work shifts elsewhere. Future marker depth/styling work should start from `MEMORY_GPU_POLYLINES.md`.

## Related Follow-Up

- Depth-tested WebGL trajectory/world-segment ribbons and future marker/styling overlay work live in `MEMORY_GPU_POLYLINES.md`.
