// ── Gambit Kit Selector GUI (GuiJS client script) ─────────────
// Opens when the player right-clicks an iron sword.
// Clicking a kit runs /gambitkit <name> which fires the selector
// mcfunction, same as stepping on the coloured glass block.

ItemEvents.rightClicked('minecraft:iron_sword', event => {
    GuiJS.open("gambit_kits");
});

GUIEvents.createUI("gambit_kits", event => {
    event.background(true);
    event.pauseGame(true);

    const W = Client.window.guiScaledWidth;
    const H = Client.window.guiScaledHeight;

    // ── Panel ──────────────────────────────────────────────────
    const panelW = 260;
    const panelH = 136;
    const panelX = Math.floor((W - panelW) / 2);
    const panelY = Math.floor((H - panelH) / 2);

    event.setBackground("minecraft:textures/gui/demo_background.png", panelX, panelY, panelW, panelH);

    // ── Title ──────────────────────────────────────────────────
    event.label("", panelX + 12, panelY + 8)
        .setLabel("Select Kit", "#FFAA00");

    // ── Two-column grid (4 left, 3 right + close) ─────────────
    const rowY0  = panelY + 24;
    const rowGap = 26;
    const colW   = 110;
    const colH   = 20;
    const col1X  = panelX + 12;
    const col2X  = panelX + 138;

    const leftKits = [
        { label: "Assault",  color: "#FF5555", kit: "assault",  tip: "FN FAL (Auto) + M1911"       },
        { label: "Breacher", color: "#FFAA00", kit: "breacher", tip: "M870 Shotgun + CZ75"          },
        { label: "Burst",    color: "#FFFF55", kit: "burst",    tip: "QBZ-95 (Burst) + M1911"       },
        { label: "Marksman", color: "#5555FF", kit: "marksman", tip: "SKS Tactical (Semi) + M1911"  },
    ];

    const rightKits = [
        { label: "Ranger",  color: "#55FF55", kit: "ranger",  tip: "QBZ-191 (Suppressed) + M1911" },
        { label: "Flanker", color: "#55FFFF", kit: "flanker", tip: "Vector .45 (SMG) + M1911"      },
        { label: "Sniper",  color: "#AA00AA", kit: "sniper",  tip: "AI AWP (8x) + Deagle Gold"    },
    ];

    for (var i = 0; i < leftKits.length; i++) {
        (function(kit, row) {
            event.button("", col1X, rowY0 + row * rowGap, colW, colH)
                .setLabel(kit.label, kit.color)
                .addTooltip(kit.tip, "#AAAAAA")
                .onClick((function(k) {
                    return function() { GuiJS.close(); Client.player.chat("/gambitkit " + k); };
                })(kit.kit));
        })(leftKits[i], i);
    }

    for (var j = 0; j < rightKits.length; j++) {
        (function(kit, row) {
            event.button("", col2X, rowY0 + row * rowGap, colW, colH)
                .setLabel(kit.label, kit.color)
                .addTooltip(kit.tip, "#AAAAAA")
                .onClick((function(k) {
                    return function() { GuiJS.close(); Client.player.chat("/gambitkit " + k); };
                })(kit.kit));
        })(rightKits[j], j);
    }

    // Close fills the 4th row of the right column
    event.button("", col2X, rowY0 + 3 * rowGap, colW, colH)
        .setLabel("Close", "#FF5555")
        .onClick(() => { GuiJS.close(); });
});
