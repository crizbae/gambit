// ============================================================
// Gambit Trapdoor Lock
//
//   /trapdoor off  — prevent all non-OP players from interacting with trapdoors
//   /trapdoor on   — restore trapdoor interaction for all players
//
// State resets to unlocked (on) on server reload.
// ============================================================

var trapdoorLocked = false;

BlockEvents.rightClicked(function (event) {
  if (!trapdoorLocked) return;
  if (event.block.id.indexOf('trapdoor') === -1) return;
  event.cancel();
});

ServerEvents.commandRegistry(function (event) {
  var Commands = event.commands;

  event.register(
    Commands.literal('trapdoor')
      .requires(function (src) { return src.hasPermission(2); })
      .then(
        Commands.literal('off')
          .executes(function (ctx) {
            trapdoorLocked = true;
            ctx.source.server.players.forEach(function (p) {
              if (p.hasPermission(2)) p.tell('§6[Gambit] §eTrapdoor interaction has been §cdisabled§e.');
            });
            return 1;
          })
      )
      .then(
        Commands.literal('on')
          .executes(function (ctx) {
            trapdoorLocked = false;
            ctx.source.server.players.forEach(function (p) {
              if (p.hasPermission(2)) p.tell('§6[Gambit] §eTrapdoor interaction has been §aenabled§e.');
            });
            return 1;
          })
      )
  );
});
