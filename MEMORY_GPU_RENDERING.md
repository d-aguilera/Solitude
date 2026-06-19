# GPU-Native Rendering

## Purpose

- Add a true WebGL2 scene renderer for standalone and remote play.
- Keep the authoritative protocol renderer-neutral: game models provide static meshes and snapshots provide changing state.
- Preserve the Canvas renderer as an explicit `?renderer=canvas` comparison and recovery backend.

## Non-negotiables

- Preserve strict onion layering: engine contracts remain generic, browser owns DOM/WebGL infrastructure, and product packages own composition and localized UX.
- Avoid optional parameters unless absence is semantically meaningful.
- Avoid convenience re-exports; consumers import directly from owning package subpaths.
- Keep WebGL resources out of engine world models and protocol messages.
- Performance is paramount, but the first release gate is visual and functional parity rather than a fixed frame target.

## Decisions

- WebGL is the default for standalone and remote play; only `renderer=canvas` selects Canvas.
- GPU failures are visible and never silently fall back. The failure UI links to the Canvas override.
- Solid meshes use native WebGL2 projection, lighting, clipping, depth testing, and rasterization.
- Lines, trajectories, scene labels, and HUD remain on a transparent Canvas overlay initially.
- Each view owns its WebGL context and GPU buffers; packed CPU mesh data is shared across views.
- Camera-relative translations are calculated in JavaScript doubles before upload to preserve astronomical precision.
- Solid meshes write logarithmic fragment depth over a visible-scene range so nearby and orbital-scale bodies occlude correctly without sacrificing the existing near-plane clipping behavior.

## Target Shape

```txt
shared world + scene + camera
  -> Canvas presenter
       -> DefaultViewRenderer
       -> Canvas scene + Canvas HUD overlay
  -> WebGL presenter
       -> GPU-native solid mesh renderer
       -> Canvas lines/labels/HUD overlay
```

## Milestones

1. Complete: shared layered browser views and presenter contract.
2. Complete: persistent GPU mesh packing/buffers and native faces/lighting.
3. Complete: remote-client integration without protocol, interpolation, prediction, or reconciliation changes.
4. Complete: standalone integration, WebGL default selection, and explicit Canvas override.
5. Complete in code: localized fatal GPU UX, diagnostics, automated parity seams, and removal of the screen-space WebGL rasterizer.

## Delivered State

- Browser presentation owns layered DOM views, synchronized device-pixel sizing, backend selection, rendering, overlays, and disposal.
- The native renderer uploads packed object-local triangles once per mesh/context and sends only camera-relative transforms, lights, and uniforms per frame.
- GPU shaders perform object transforms, camera projection, near clipping, flat lighting, tone mapping, and logarithmic depth-tested rasterization using a conservative per-frame far range derived from object bounds.
- Vertex and fragment shader sources live in dedicated `.vert.glsl` and `.frag.glsl` assets imported as raw text by the browser adapter.
- The CPU `DefaultViewRenderer` remains responsible for Canvas rendering and WebGL line/label overlays.
- Standalone and remote compositions default to WebGL; `?renderer=canvas` selects the retained Canvas path.
- WebGL initialization/program/context-loss failures publish diagnostics and show localized recovery UI without silent fallback.
- Unit coverage includes backend resolution, mesh packing/cache reuse, one-time GPU uploads, disposal, context loss, and existing remote-render behavior.
- Typecheck, package boundaries, unit tests, and all production builds pass. Interactive browser visual-parity verification remains a hands-on follow-up.

## Acceptance

- Primary and PiP views preserve faces, lighting, occlusion, labels, trajectories, segments, and HUD.
- Remote interpolation and local prediction/reconciliation remain behavior-compatible.
- Unchanged mesh geometry uploads once per WebGL context and is disposed with its presenter.
- Large orbital coordinates remain visually stable through camera-relative GPU inputs.
- `?renderer=canvas` retains the current Canvas presentation.
- WebGL initialization, program, and context-loss failures stop rendering and show a visible recovery link.

## Current Next Step

- Run interactive standalone and remote parity checks on real WebGL2 hardware, especially Earth/Moon lighting, near-plane intersections, PiP overlays, context loss, and large-coordinate stability; fix only measured discrepancies.
