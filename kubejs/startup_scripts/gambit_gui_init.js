// ── Gambit GUI registrations ──────────────────────────────────
// Must be in startup_scripts so GUI types are registered before world load.

GUIEvents.registerUI(event => {
    event.gui("gambit_stats");
    event.gui("gambit_kits");
});
