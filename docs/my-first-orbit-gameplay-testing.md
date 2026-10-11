# Gameplay Testing

## Test case 1

### Repro steps

- Solitude starts and presents menu
- Click on "Mi primera órbita" (I see the UI in Spanish)
- Game loads, "Mi primera órbita" menu is shown
- Click on "Volver al menú"

### Outcome

Nothing happens. The browser console shows the following error:

```
standaloneShell.ts:61 Uncaught TypeError: Illegal invocation
    at standaloneShell.ts:61:24
    at notify (index.js:641:37)
    at Object.command (index.js:675:6)
    at command (standalonePresentation.ts:187:19)
    at standalonePresentation.ts:198:19
    at HTMLButtonElement.<anonymous> (standalonePresentation.ts:39:22)
```

Then, ALT-tabbing away and back to Solitude adds additional similar errors:

```
standaloneShell.ts:61 Uncaught TypeError: Illegal invocation
    at standaloneShell.ts:61:24
    at notify (index.js:641:37)
(anonymous) @ standaloneShell.ts:61
notify @ index.js:641
standaloneShell.ts:61 Uncaught TypeError: Illegal invocation
    at standaloneShell.ts:61:24
    at notify (index.js:641:37)
    at Object.suspend (index.js:735:5)
    at suspend (index.js:786:39)
(anonymous) @ standaloneShell.ts:61
notify @ index.js:641
suspend @ index.js:735
suspend @ index.js:786
standaloneShell.ts:61 Uncaught TypeError: Illegal invocation
    at standaloneShell.ts:61:24
    at notify (index.js:641:37)
(anonymous) @ standaloneShell.ts:61
notify @ index.js:641
standaloneShell.ts:61 Uncaught TypeError: Illegal invocation
    at standaloneShell.ts:61:24
    at notify (index.js:641:37)
    at Object.suspend (index.js:735:5)
    at suspend (index.js:786:39)
(anonymous) @ standaloneShell.ts:61
notify @ index.js:641
suspend @ index.js:735
suspend @ index.js:786
standaloneShell.ts:61 Uncaught TypeError: Illegal invocation
    at standaloneShell.ts:61:24
    at notify (index.js:641:37)
(anonymous) @ standaloneShell.ts:61
notify @ index.js:641
standaloneShell.ts:61 Uncaught TypeError: Illegal invocation
    at standaloneShell.ts:61:24
    at notify (index.js:641:37)
    at Object.suspend (index.js:735:5)
    at suspend (index.js:786:39)
(anonymous) @ standaloneShell.ts:61
notify @ index.js:641
suspend @ index.js:735
suspend @ index.js:786
standaloneShell.ts:61 Uncaught TypeError: Illegal invocation
    at standaloneShell.ts:61:24
    at notify (index.js:641:37)
(anonymous) @ standaloneShell.ts:61
notify @ index.js:641
standaloneShell.ts:61 Uncaught TypeError: Illegal invocation
    at standaloneShell.ts:61:24
    at notify (index.js:641:37)
    at Object.suspend (index.js:735:5)
    at suspend (index.js:786:39)
(anonymous) @ standaloneShell.ts:61
notify @ index.js:641
suspend @ index.js:735
suspend @ index.js:786
```

### Status

PASS — fix confirmed in browser. All menu options work as expected, and clicking
buttons or ALT-tabbing produces no console errors.

The bootstrap now schedules lifecycle callbacks through
`window.queueMicrotask(callback)`, preserving the receiver required by the browser.
The previous unbound function was called as a shell dependency method and threw
`Illegal invocation`. The regression test reproduces that error with the original
wiring and passes with the fix for Retry, Return to menu, and fatal-error cleanup.

Browser confirmation covers menu actions and ALT-tab transitions. No further
retest is required for this issue.

## Test case 2

### Repro steps

- Solitude starts and presents menu
- Click on "Mi primera órbita"
- Game loads, "Mi primera órbita" menu is shown
- Click on "Comenzar"
- Guide panel is shown at the top-right
- Click on "Mostrar pistas"
- Clues are displayed
- The "El punto más bajo está por debajo del objetivo de seguridad" message is displayed
- Hold Space key to burn
- The "Punto más bajo sobre la Tierra (≥150 km)" value increases
- The "Propulsión aplicada" value changes from "Apagada" to "Activa"
- Lift Space key
- The "Punto más bajo sobre la Tierra (≥150 km)" value stops increasing
- The "Propulsión aplicada" value changes from "Activa" to "Apagada"
- Hold Space again to burn until altitude reaches 150 km
- "Vuelo seguro sin propulsión" time count starts
- After 5 seconds the success "Órbita recuperada" menu is displayed
- Both "Reintentar" and "Volver al menú" buttons work.

### Outcome

PASS

## Test case 3

### Repro steps

- Solitude starts and presents menu
- Click on "Mi primera órbita"
- Game loads, "Mi primera órbita" menu is shown
- Click on "Comenzar"
- Guide panel is shown at the top-right
- Hold Space to burn until altitude reaches 601 km
- The following message is shown: "El punto más alto es demasiado alto. Suelta los controles de propulsión. Alinea en sentido progrado con V y usa impulsos cortos hacia atrás con B observando el punto más alto."
- Hold B until altitude is 600 km or less
- Message above disappears
- "Vuelo seguro sin propulsión" time count starts
- After 5 seconds the success "Órbita recuperada" menu is displayed

### Outcome

PASS

## Test case 4

### Repro steps

- Solitude starts and presents menu
- Click on "Mi primera órbita"
- Game loads, "Mi primera órbita" menu is shown
- Click on "Comenzar"
- Press ALT+TAB to switch to another application
- "Vuelo suspendido" menu is shown with "Continuar", "Reintentar", "Volver al menú" and "Mostrar pistas" buttons
- The "Continuar" button is disabled
- Press ALT+TAB again to go back to Solitude
- The "Continuar" button is now enabled
- All menu buttons do what they are supposed to do

### Outcome

PASS

## Test case 5

### Repro steps

- Solitude starts and presents menu
- Click on "Mi primera órbita"
- Game loads, "Mi primera órbita" menu is shown
- Click on "Comenzar"
- Press ALT+TAB to switch to another application
- "Vuelo suspendido" menu is shown
- Press ALT+TAB again to go back to Solitude
- Hold the Space key down
- Click on "Continuar"
- Menu is dismissed
- The "Punto más bajo sobre la Tierra (≥150 km)" value does not increase or decrease
- Lift Space and hold it down again
- The "Punto más bajo sobre la Tierra (≥150 km)" value increases
- Press P to pause
- "Vuelo en pausa" menu is shown with "Continuar", "Reintentar", "Volver al menú" and "Mostrar pistas" buttons
- All menu buttons do what they are supposed to do

### Outcome

PASS

## Test case 6 — Pause during coast

### Repro steps

- Start "Mi primera órbita" and click "Comenzar".
- Hold Space until the lowest point is about 175 km, then release.
- When "Vuelo seguro sin propulsión" reaches 1–2 seconds, press P.
- Wait 6 seconds, then click "Continuar".

### Expected result

The countdown keeps its previous progress. Completion takes only the remaining
coast time; the paused time does not count.

### Outcome

PASS

## Test case 7 — ALT-tab during coast

### Repro steps

- Start "Mi primera órbita" and click "Comenzar".
- Hold Space until the lowest point is about 175 km, then release.
- When "Vuelo seguro sin propulsión" reaches 1–2 seconds, ALT-tab away.
- Wait 6 seconds, then ALT-tab back.
- Click "Continuar".

### Expected result

Flight stays suspended until "Continuar". The countdown starts again from zero
and needs 5 new seconds to complete.

### Outcome

PASS

## Test case 8 — Retry while holding Space

### Repro steps

- Start "Mi primera órbita" and click "Comenzar".
- Hold Space and keep it held through the next steps.
- Press P, then click "Reintentar".
- In the new briefing, click "Comenzar".
- Release Space, then press it again.

### Expected result

Retry restores the starting orbit. No thrust occurs after "Comenzar" until Space
is released and pressed again. The new press raises the lowest point.

### Outcome

PASS

## Test case 9 — Burn during coast

### Repro steps

- Start "Mi primera órbita" and click "Comenzar".
- Hold Space until the lowest point is about 175 km, then release.
- When "Vuelo seguro sin propulsión" reaches 1–2 seconds, press and release Space.

### Expected result

The countdown resets.

### Outcome

PASS

## Test case 10 — Retry from pause unexpectedly suspends

### Repro steps

- Start "Mi primera órbita" and click "Comenzar".
- Wait for 3 seconds and press P to pause.
- Choose "Reintentar"
- Click "Comenzar"

### Expected result

The adventure restarts.

### Outcome

The "Vuelo suspendido" popup shows up instead. Clicking on "Continuar" resumes the game without further issues. Only ALT-Tabbing away and back while in "Mi primera órbita" seems to reset this behavior.

### Status

Clock correction implemented; pending Chrome confirmation. The
[raw timing log](my-first-orbit-gameplay-testing-case10-03.log) captured the
unexpected generation-2 suspension: supplied frame timestamps advanced
499.8 ms, but callback execution advanced only 1.8 ms. The preceding callback
used a timestamp about 502 ms old. Measured frame work stayed below 2.1 ms.
The log also contains real delays outside callbacks; their cause is unproven.

The browser loop now samples `performance.now()` at callback entry and uses
that same time and delta for physics, readiness, objectives, and guidance.
The supplied animation-frame timestamp remains available only for diagnostics.
Actual gaps over 250 ms still suspend; Begin/Resume still rebase without a tick.
Both console messages remain stringified. Timing is off by default.

### Next check

- Reload with Chrome's console closed.
- Start, wait 3 seconds, then press P.
- Click “Reintentar”, then “Comenzar” as soon as it enables.
- Repeat 5 times. Flight should start without “Vuelo suspendido”.
- ALT-tab away and back once. Flight should still require “Continuar”.
- Open Free Flight once and check that movement and controls work normally.

### Only if it still fails

Enable timing in the console, then click back into the game and retry:

```js
Object.assign(window.__solitudeRenderDebug, { timing: true, frameGaps: [] });
```

After suspension, copy the retained reports:

```js
copy(JSON.stringify(window.__solitudeRenderDebug.frameGaps, null, 2));
```

Save the clipboard as `docs/my-first-orbit-gameplay-testing-case10-04.json`.
Raw console text is also useful. `copy(...)` returning `undefined` is normal:
it writes to the clipboard. Timing stays on across Retry; reloading turns it off.
