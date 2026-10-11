# My First Orbit validation

## Reproducible production-physics checks

Run `npx vitest run scripts/my-first-orbit-physics.test.mjs`. The suite loads
source factories through the production browser plugin adapter, constructs the
normal solar system and actual poly-fighter, and advances the production headless
loop with the real Newtonian gravity, spacecraft operator, autopilot, orbit
observer, session, final manual propulsion policy, objective, and director.
Transport uses in-memory manifests. Document focus is stubbed as visible/focused.
Rendering, browser input dispatch, and shell generation replacement are absent;
separate adapter/lifecycle tests cover their logic.

A frame runs the adapted loop policies, advances physics only when permitted,
and invokes completed-frame sampling. The harness completes the briefing
presentation-readiness gate with simulation time still zero before Begin, which
rebases without a tick. Tests use
synthetic monotonic frame time at 1×, so long descents run quickly without
changing adventure time scale or relaxing its discontinuity rules.

The suite verifies:

- Immediate recovery at 30, 60, and 120 Hz takes 6.0–6.2 seconds of forward thrust.
  The last burn frame cannot earn coast credit; five seconds of released-engine
  coast completes and prevents the next physics tick.
- With no intervention, actual Earth altitude reaches the 80 km boundary after
  approximately 1,709.417 simulated seconds. Failure hides guidance and blocks
  the next tick.
- After 180 or 600 seconds of waiting, ten seconds of Earth-relative `V`
  alignment followed by forward thrust recovers the orbit. Measured burns are
  approximately 6.200 and 7.767 seconds respectively. The harness maintains the
  alignment input while enabled, as the browser's toggle handler does.
- After 1,200 seconds of waiting and ten seconds of alignment, prograde thrust
  reaches the periapsis target with apoapsis above 600 km. The director correctly
  warns about high apoapsis and the objective does not complete. This case does
  not establish that every late orbit is unrecoverable; simple prograde advice
  alone is insufficient for this trajectory.
- After 1,680 seconds of waiting and ten seconds of alignment, continued forward
  thrust still reaches the actual failure boundary. Safe confirmation never
  latches.
- An immediate 20-second forward burn overshoots apoapsis. Reverse thrust brings
  the orbit back within both targets and released-engine coast completes.
- A newly constructed retry generation restores the unsafe starting orbit,
  zero simulation time, independent sample/objective state, and no propulsion.
  This verifies fresh production instances; the shell's Retry action and held-key
  gate still need browser testing.

## Browser clock regression

Run `npx vitest run scripts/my-first-orbit-clock.test.mjs`. It connects the actual
browser animation loop to the adventure session and replays timestamps from
`my-first-orbit-gameplay-testing-case10-03.log`. Begin rebases the delayed
callback without flight credit; the next callback runs 1.8 ms later and remains
flying despite a 499.8 ms jump in the supplied frame timestamp. A later actual
474.4 ms callback gap still suspends. This verifies the clock correction against
the captured sequence; Chrome gameplay validation confirms the Retry issue is resolved.

## Texture preparation and upload regression

The case-10 Chrome trace records five main-thread image-load handlers lasting
515–587 ms, including 243–280 ms of JPEG decoding. Browser texture tests now
cover shared asynchronous bitmap preparation, disposal while decoding, error
recovery, bounded original-resolution 8K transfers, and visibility only after all
rows upload. Each view allocates storage on one frame and submits at most 2 MiB
of pixel data per subsequent frame; decoded images close after the last upload
finishes or is cancelled. CPU preparation is shared across simultaneous views.
These checks validate scheduling and resource ownership, not a universal GPU
timing guarantee. Chrome gameplay validation confirms no unexpected suspension, correct/faster
texture loading, and correct ALT-tab behavior.

The row-transfer mechanism follows WebGL2's
[TexImageSource subrectangle rules](https://registry.khronos.org/webgl/specs/latest/2.0/).

## Local runtime-cost sample

Run
`FIRST_ORBIT_MEASURE=1 npx vitest run scripts/my-first-orbit-physics.test.mjs --reporter=verbose`
to print timing and delayed-burn measurements. Timing covers loop policy updates
and completed-frame observation/objective/director hooks; production simulation
is timed separately. The first 1,000 frames are excluded for warmup. Instrumentation
uses `performance.now()` and therefore includes clock/read/dispatch overhead.
Measurements are descriptive, with no hardware-sensitive test assertion.

On the current Linux x64 development host (Intel Core i7-7700HQ at 2.80 GHz,
eight logical CPUs, Node 22.23.1), a 60 Hz unattended descent
measures 101,567 frames: approximately **6.66 µs/frame** for policy and completed-frame
hooks, and **11.31 µs/frame** for simulation. These correspond to roughly
0.040% and 0.068% of a 16.67 ms frame budget. This is a headless CPU sample,
not a browser performance or allocation guarantee. It excludes rendering,
DOM subscriptions/layout, and keyboard dispatch. GC behavior and browser frame
cost remain unmeasured.

## Hands-on browser acceptance pass

Start `npm run dev`, select My First Orbit, or open `?mode=my-first-orbit&locale=en`.
Repeat the presentation checks with `locale=es` and `locale=fr`.

1. Begin with default guidance. Check that the initially negative lowest-point
   altitude is understandable. Hold Space until the release cue, then release;
   completion should follow about five seconds later. Check cue timing and whether
   the instruments make the effect of the burn clear. Rounded values alone must
   not cause completion.
2. Retry and burn for about 20 seconds. Check the high-apoapsis warning; use `B`
   to correct it, release, and confirm completion. Try a manual attitude change
   and `V` before thrust to assess alignment assistance and advice.
3. During burn/coast, pause with `P`, Resume, then switch tabs and return. Pause
   preserves coast progress; tab suspension clears it and requires Resume.
   No hidden time should count. Retry while Space is held; the fresh briefing
   must prevent thrust until the key is released and pressed again. Return to
   menu, then launch both adventure and Free Flight.
4. Use only Tab, Enter, and Space to reach hint controls in flight and pause.
   Activating a button must not fire the engine. Focus should stay on the button
   through numeric updates. Retry resets hint preferences.
5. With a screen reader, check that primary cue changes are announced once,
   without continuously announcing numbers. Check narrow/mobile-width layouts
   and all three languages for clipped instruments, warnings, or buttons.
6. On the intended device/browser, watch frame smoothness through burn/coast,
   hint toggles, pause, and retry. A browser profile is still needed to assess
   allocations/GC and rendering/DOM cost.

Record browser/device, locale, actions, observed cue/altitudes, and any confusing
or late feedback. An unattended failure takes about 28.5 minutes; the automated
suite covers it, so this is optional in the manual pass. There is no need to wait
20–28 minutes manually to reproduce the late-recovery cases above.

## Next task

Collect the browser acceptance results, then tune presentation or guidance only
from observed issues. Preserve the physical success/failure thresholds and plugin
boundaries. The late-recovery limitation is recorded; a broader maneuver tutorial
is outside this pilot.
