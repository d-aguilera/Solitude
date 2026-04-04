# Project Memory

## At-a-glance
- **App**: Solitude — browser-based spaceflight + orbital mechanics sandbox with pilot and top-down views.
- **Core value**: real-ish Newtonian gravity and a controllable ship, rendered in 2D/3D projections.
- **Primary user**: someone exploring orbital dynamics and spacecraft controls.

## Current focus
- Split the architecture to support a future headless simulation server.

## Next steps
- Not specified yet. Add 3–7 concrete tasks once a goal is set.

## Non-negotiables and exceptions
- **Onion layering**: domain core → app logic → infra adapters. Outer layers depend inward, even if it costs performance.
- **Known exception**: `src/global/` is a deliberate carve-out and may violate onion rules. Do not treat it as a layering issue.
- **Physics**: Newtonian N-body with leapfrog integration for stability.
- **Solar system data**: use real-ish values (AU, km, approximate J2000 elements) for plausibility.
- **Rendering**: default Canvas 2D for portability; WebGL path exists if needed.

## Architecture map
- `src/domain/`: math + physics primitives (vec/mat, orbit, collisions, gravity state).
- `src/app/`: app/game logic (controls, autopilot, scene updates).
- `src/infra/`: DOM input, layout, game loop, gravity engine.
- `src/render/`: projection + render staging (faces, polylines, HUD).
- `src/rasterize/`: Canvas2D + WebGL rasterizers.
- `src/setup/`: world/scene construction + trajectories.
- `src/config/`: solar system and ship configs (OBJ meshes, colors, constants).
- `src/global/`: cross-cutting globals (allowed onion exception).

## Runtime flow
- `src/bootstrap.ts` builds config, then bootstraps the DOM runtime.
- `src/infra/domBootstrap.ts` wires input, layout, renderers, loop, and gravity engine.
- `src/infra/domGameLoop.ts` runs the frame loop and orchestrates physics + rendering.
- `src/app/game.ts` is the per-tick simulation core.

## Key files
- `src/infra/NewtonianGravityEngine.ts`: N-body gravity (leapfrog).
- `src/app/controls.ts`: input mapping to thrust/attitude/autopilot.
- `src/app/autoPilot.ts`: align-to-velocity/body and “circle now”.
- `src/setup/sceneSetup.ts`: scene graph + trajectory setup.
- `src/config/solarSystem.ts`: solar system data and Keplerian elements.
- `src/config/ships.ts`: ship geometry, mass, and initial placement.
- `src/render/DefaultViewRenderer.ts`: projection + draw list assembly.

## Controls quick reference
- Look: `Arrow keys`, reset with `R`.
- Thrust level: `0–9` set magnitude (used by `Space`/`B`).
- Main engine: `Space` forward, `B` backward.
- RCS translation: `N` left, `M` right.
- Attitude: `W/S` pitch, `Q/E` roll, `A/D` yaw.
- Autopilot: `V` align to velocity, `C` align to dominant body, `X` circle now.
- Camera offset: `U/J` forward/back, `I/K` up/down.
- Time scale: `[` decrease, `]` increase.
- Pause: `P`.
- Profiling HUD toggle: `O`.

## Local dev workflow
- `npm run dev` (runs `typecheck` + `vitest run` first, then `vite --host`).
- `npm run test` (Vitest watch).
- `npm run typecheck` (TS no-emit).
- `npm run build` / `npm run preview` for production.
- After code changes: run `npm run typecheck` and `npm run test`.

## Current state
- Core loop is working: input → physics → scene update → render → HUD.
- Ships, planets, and stars are configured from static config data.
- Default runtime uses Canvas 2D; WebGL renderer exists but is not wired by default.
- Tests cover geometry/mesh parsing and projection clipping.

## Recent changes (last 1–2 weeks)
- Not specified yet. Add notable edits here to help re-orient quickly.

## Open questions / risks
- Gravity uses fixed sub-steps for stability; high time scales can still destabilize.
- WebGL path is present but not wired in the default entry; decide if/when to switch.
- Controls are keyboard-only with no in-app help; consider a help overlay or onboarding prompt.
