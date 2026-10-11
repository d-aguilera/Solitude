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
