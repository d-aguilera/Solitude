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

Fixed in code; pending browser confirmation.

The bootstrap now schedules lifecycle callbacks through
`window.queueMicrotask(callback)`, preserving the receiver required by the browser.
The previous unbound function was called as a shell dependency method and threw
`Illegal invocation`. The regression test reproduces that error with the original
wiring and passes with the fix for Retry, Return to menu, and fatal-error cleanup.

Retest the same Spanish briefing → Volver al menú steps after reloading the updated
build. Confirm that the menu appears, then ALT-tab away/back and check that no new
errors appear. Also check Retry from the adventure pause menu, which uses the same
scheduler.
