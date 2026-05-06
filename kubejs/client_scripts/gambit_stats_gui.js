// ── Gambit Stats GUI (GuiJS client script) ────────────────────
// Opens when the player right-clicks a compass.

var gambitSearchName = "";

ItemEvents.rightClicked('minecraft:compass', event => {
    GuiJS.open("gambit_stats");
});

GUIEvents.createUI("gambit_stats", event => {
    event.background(true);
    event.pauseGame(true);

    const W  = Client.window.guiScaledWidth;
    const H  = Client.window.guiScaledHeight;
    const bW = 200;  // button width
    const bH = 20;   // button height
    const bX = Math.floor((W - bW) / 2);

    // Vertical layout — total height ~183px, centred
    const y0 = Math.floor((H - 183) / 2);

    // ── Title ────────────────────────────────────────────────
    event.label("", bX, y0)
        .setLabel("Gambit Stats", "#FFAA00");

    // ── My Stats ─────────────────────────────────────────────
    event.button("", bX, y0 + 16, bW, bH)
        .setLabel("My Stats", "#55FF55")
        .addTooltip("/gambitstats me", "#55FF55")
        .onClick(() => {
            GuiJS.close();
            Client.player.chat("/gambitstats me");
        });

    // ── Search Player ─────────────────────────────────────────
    event.label("", bX, y0 + 44)
        .setLabel("Search Player:", "#AAAAAA");

    const tbW = 156;
    event.textBox(bX, y0 + 55, tbW, bH)
        .setValue(gambitSearchName)
        .onTextChanged(text => { gambitSearchName = text; });

    event.button("", bX + tbW + 4, y0 + 55, bW - tbW - 4, bH)
        .setLabel("Go", "#FFFF55")
        .onClick(() => {
            var name = gambitSearchName ? gambitSearchName.trim() : "";
            if (name.length > 0) {
                GuiJS.close();
                Client.player.chat("/gambitstats player " + name);
            }
        });

    // ── Leaderboards ──────────────────────────────────────────
    event.button("", bX, y0 + 84, bW, bH)
        .setLabel("Elim Leaderboard", "#FF5555")
        .onClick(() => { GuiJS.close(); Client.player.chat("/gambitstats elim"); });

    event.button("", bX, y0 + 109, bW, bH)
        .setLabel("TDM Leaderboard", "#55FFFF")
        .onClick(() => { GuiJS.close(); Client.player.chat("/gambitstats tdm"); });

    event.button("", bX, y0 + 134, bW, bH)
        .setLabel("Combined Leaderboard", "#FFAA00")
        .onClick(() => { GuiJS.close(); Client.player.chat("/gambitstats combined"); });

    // ── Close ─────────────────────────────────────────────────
    event.button("", bX, y0 + 163, bW, bH)
        .setLabel("Close", "#FF5555")
        .onClick(() => { GuiJS.close(); });
});
