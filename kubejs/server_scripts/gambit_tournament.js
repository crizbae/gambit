// ============================================================
// Gambit Tournament
//
// Small-format tournament support (2v2, 3v3, etc.).
// Teams are manually assigned by an OP; the match is started
// normally via /setmap + /start. Everyone not on a roster is
// forced to spectator for the duration of the match.
//
// Rosters persist across matches — clear or reassign as needed
// between rounds. Tournament mode must be turned on before /start.
//
//   /tournament on               — enable tournament mode
//   /tournament off              — disable tournament mode and clear rosters
//   /tournament status           — show mode state and current rosters
//   /tournament red <player>     — add player to Red roster
//   /tournament blue <player>    — add player to Blue roster
//   /tournament remove <player>  — remove player from whichever roster they're on
//   /tournament clear            — clear all rosters (mode stays on)
//   /tournament swap             — swap Red and Blue rosters
//
// Integration with gambit_maps.js:
//   _executeStart reads scoreboard #tournament tournament_mode.
//   If 1, it calls `gambit_tournament_apply` (registered here) instead
//   of `function gun:teams/randomize`. This applies the rosters, forces
//   spectator on everyone else, and mirrors the post-randomize state so
//   the rest of _executeStart (TPs, starts/general, etc.) works normally.
// ============================================================

var StringArgumentType_T = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');

// ── State ─────────────────────────────────────────────────────
var tournamentMode       = false;
var tournamentRedRoster  = []; // player name strings
var tournamentBlueRoster = [];

// ── Helpers ───────────────────────────────────────────────────
function _syncTournamentMode(server) {
  server.runCommandSilent(
    'scoreboard players set #tournament tournament_mode ' + (tournamentMode ? 1 : 0)
  );
}

function _rosterContains(roster, name) {
  var lower = name.toLowerCase();
  for (var i = 0; i < roster.length; i++) {
    if (roster[i].toLowerCase() === lower) return true;
  }
  return false;
}

function _rosterRemove(roster, name) {
  var lower = name.toLowerCase();
  var out = [];
  for (var i = 0; i < roster.length; i++) {
    if (roster[i].toLowerCase() !== lower) out.push(roster[i]);
  }
  return out;
}

function _printStatus(player) {
  var redList  = tournamentRedRoster.length  === 0 ? '§8(empty)' : tournamentRedRoster.join(', ');
  var blueList = tournamentBlueRoster.length === 0 ? '§8(empty)' : tournamentBlueRoster.join(', ');
  player.tell('§6§l── Tournament Mode ──');
  player.tell('§7Status: ' + (tournamentMode ? '§aON' : '§cOFF'));
  player.tell('§c  Red:  §r' + redList);
  player.tell('§b  Blue: §r' + blueList);
  player.tell('§6§l─────────────────────');
}

// ── Apply rosters (called via gambit_tournament_apply command) ─
// Replaces gun:teams/randomize when tournament mode is active.
// Must mirror everything randomize does so that the rest of
// _executeStart (TPs, starts/general, pleft) works unchanged.
function _applyTournamentRosters(server) {
  if (tournamentRedRoster.length === 0 || tournamentBlueRoster.length === 0) {
    server.runCommandSilent(
      'tellraw @a ["",{"text":"[Tournament] ","color":"gold"},{"text":"Both rosters must have at least one player — aborting. Use /tournament red and /tournament blue to assign players.","color":"red"}]'
    );
    return;
  }

  // Clear team tags from everyone — no other changes to non-roster players.
  server.runCommandSilent('tag @a remove Red');
  server.runCommandSilent('tag @a remove Blue');

  // Apply Red roster
  for (var ri = 0; ri < tournamentRedRoster.length; ri++) {
    var rp = tournamentRedRoster[ri];
    // Clear gun_optout only for active participants so they enter the match correctly.
    server.runCommandSilent('tag ' + rp + ' remove gun_optout');
    server.runCommandSilent('tag ' + rp + ' add Red');
  }

  // Apply Blue roster
  for (var bi = 0; bi < tournamentBlueRoster.length; bi++) {
    var bp = tournamentBlueRoster[bi];
    server.runCommandSilent('tag ' + bp + ' remove gun_optout');
    server.runCommandSilent('tag ' + bp + ' add Blue');
  }

  // Announce rosters
  var redNames  = tournamentRedRoster.length  > 0 ? tournamentRedRoster.join(', ')  : '(none)';
  var blueNames = tournamentBlueRoster.length > 0 ? tournamentBlueRoster.join(', ') : '(none)';
  server.runCommandSilent(
    'tellraw @a ["",{"text":"[Tournament] ","color":"gold"},{"text":"Red: ","color":"dark_red"},{"text":"' + redNames + '","color":"white"}]'
  );
  server.runCommandSilent(
    'tellraw @a ["",{"text":"[Tournament] ","color":"gold"},{"text":"Blue: ","color":"aqua"},{"text":"' + blueNames + '","color":"white"}]'
  );

  // Mirror what gun:teams/randomize does post-assignment
  server.runCommandSilent('team join red @a[tag=Red]');
  server.runCommandSilent('team join blue @a[tag=Blue]');
  server.runCommandSilent('function gun:pleft/build');
  server.runCommandSilent('scoreboard objectives setdisplay sidebar teams');
  server.runCommandSilent('schedule function gun:pleft/loop 20t');
}

// ── Tournament postgame display ──────────────────────────────
// Called instead of the normal top-5 board when tournament mode is active.
// Shows every participant, one row per player grouped by team, with remaining
// HP for survivors (dead players are shown as 0 HP).
function broadcastTournamentPostGame(server) {
  if (!server) return;

  // Collect all roster names (union of both teams).
  var allNames = [];
  var seen = {};
  var ri, bi;
  for (ri = 0; ri < tournamentRedRoster.length; ri++) {
    var rn = tournamentRedRoster[ri];
    if (!seen[rn.toLowerCase()]) { seen[rn.toLowerCase()] = true; allNames.push({ name: rn, team: 'Red' }); }
  }
  for (bi = 0; bi < tournamentBlueRoster.length; bi++) {
    var bn = tournamentBlueRoster[bi];
    if (!seen[bn.toLowerCase()]) { seen[bn.toLowerCase()] = true; allNames.push({ name: bn, team: 'Blue' }); }
  }

  if (allNames.length === 0) return; // no rosters — fall through to normal board

  // Read remaining HP for online players.
  // Dead players are in spectator mode by the time postgame runs (doImmediateRespawn
  // gives them full HP on respawn, so p.health is always 20 for dead players —
  // spectator check is the only reliable way to distinguish them).
  function getHp(name) {
    var p = getOnlinePlayerByName(server, name);
    if (!p) return 0;
    try {
      if (p.isSpectator()) return 0;
      var hp = parseFloat(String(p.health));
      return isNaN(hp) ? 0 : hp;
    } catch (e) { return 0; }
  }

  // Separator line.
  tellAll(server, '§8§m───────────────────────────────────');
  tellAll(server, '§6§l        Tournament Round Summary');
  tellAll(server, '§8§m───────────────────────────────────');

  var teams = ['Red', 'Blue'];
  for (var ti = 0; ti < teams.length; ti++) {
    var teamName  = teams[ti];
    var teamColor = teamName === 'Red' ? '§c' : '§b';
    var teamLabel = teamColor + '§l' + teamName + ' Team';
    tellAll(server, teamLabel);

    for (var pi = 0; pi < allNames.length; pi++) {
      var entry = allNames[pi];
      if (entry.team !== teamName) continue;

      var rs   = typeof roundStats !== 'undefined' && roundStats[entry.name]
                   ? roundStats[entry.name]
                   : { kills: 0, damage: 0.0, deaths: 0 };
      var hp   = getHp(entry.name);
      var dead = hp <= 0;
      var hpStr = dead
        ? '§c0 HP'
        : '§a' + hp.toFixed(1) + ' HP';

      tellAll(server,
        '  §7' + entry.name +
        '  §4' + rs.kills + 'K' +
        '  §6' + rs.damage.toFixed(1) + ' dmg' +
        '  ' + hpStr
      );
    }
  }

  tellAll(server, '§8§m───────────────────────────────────');
}

// ── Server load ───────────────────────────────────────────────
ServerEvents.loaded(function(event) {
  event.server.runCommandSilent('scoreboard objectives add tournament_mode dummy');
  event.server.runCommandSilent('scoreboard players set #tournament tournament_mode 0');
});

// ── Commands ──────────────────────────────────────────────────
ServerEvents.commandRegistry(function(event) {
  var Commands = event.commands;

  // Internal: gambit_tournament_apply
  // Called from gambit_maps.js _executeStart when tournament_mode == 1.
  event.register(
    Commands.literal('gambit_tournament_apply')
      .requires(function(src) { return src.hasPermission(2); })
      .executes(function(ctx) {
        _applyTournamentRosters(ctx.source.server);
        return 1;
      })
  );

  // /tournament
  var cmd = Commands.literal('tournament')
    .requires(function(src) { return src.hasPermission(2); });

  // /tournament on
  cmd = cmd.then(
    Commands.literal('on')
      .executes(function(ctx) {
        tournamentMode = true;
        if (typeof statsTrackingEnabled !== 'undefined') statsTrackingEnabled = false;
        _syncTournamentMode(ctx.source.server);
        ctx.source.server.runCommandSilent(
          'tellraw @a ["",{"text":"[Gambit] ","color":"gray"},{"text":"Tournament mode enabled.","color":"gold"}]'
        );
        var player = ctx.source.player;
        if (player && player.tell) _printStatus(player);
        return 1;
      })
  );

  // /tournament off
  cmd = cmd.then(
    Commands.literal('off')
      .executes(function(ctx) {
        tournamentMode = false;
        if (typeof statsTrackingEnabled !== 'undefined') statsTrackingEnabled = true;
        tournamentRedRoster  = [];
        tournamentBlueRoster = [];
        _syncTournamentMode(ctx.source.server);
        // Remove forced gun_optout from everyone so players don't need to /play manually.
        // Players who voluntarily spectated before the tournament will also be cleared,
        // but that is acceptable — they can /spectate again if needed.
        ctx.source.server.runCommandSilent('tag @a remove gun_optout');
        ctx.source.server.runCommandSilent('execute as @a[gamemode=spectator,tag=!gun_optout] in minecraft:overworld run tp @s 0 0 0');
        ctx.source.server.runCommandSilent('gamemode adventure @a[gamemode=spectator,tag=!gun_optout]');
        ctx.source.server.runCommandSilent(
          'tellraw @a ["",{"text":"[Gambit] ","color":"gray"},{"text":"Tournament mode disabled. Rosters cleared. All players returned to queue.","color":"yellow"}]'
        );
        return 1;
      })
  );

  // /tournament status
  cmd = cmd.then(
    Commands.literal('status')
      .executes(function(ctx) {
        var player = ctx.source.player;
        if (!player || !player.tell) return 1;
        _printStatus(player);
        return 1;
      })
  );

  // /tournament clear
  cmd = cmd.then(
    Commands.literal('clear')
      .executes(function(ctx) {
        tournamentRedRoster  = [];
        tournamentBlueRoster = [];
        var player = ctx.source.player;
        if (player && player.tell) player.tell('§e[Tournament] Both rosters cleared.');
        return 1;
      })
  );

  // /tournament swap
  cmd = cmd.then(
    Commands.literal('swap')
      .executes(function(ctx) {
        var tmp = tournamentRedRoster;
        tournamentRedRoster  = tournamentBlueRoster;
        tournamentBlueRoster = tmp;
        var player = ctx.source.player;
        if (player && player.tell) {
          player.tell('§e[Tournament] Rosters swapped.');
          _printStatus(player);
        }
        return 1;
      })
  );

  // /tournament red <player>
  cmd = cmd.then(
    Commands.literal('red')
      .then(
        Commands.argument('player', StringArgumentType_T.word())
          .suggests(function(ctx, builder) {
            var players = ctx.source.server.players;
            for (var _si = 0; _si < players.length; _si++) {
              var _sp = players[_si];
              var _sn = _sp && _sp.name && _sp.name.string ? String(_sp.name.string) : null;
              if (_sn) builder.suggest(_sn);
            }
            return builder.buildFuture();
          })
          .executes(function(ctx) {
            var player = ctx.source.player;
            var name   = String(StringArgumentType_T.getString(ctx, 'player'));

            if (!getOnlinePlayerByName(ctx.source.server, name)) {
              if (player && player.tell) player.tell('§c[Tournament] ' + name + ' is not online.');
              return 0;
            }

            // Move from blue if already there
            tournamentBlueRoster = _rosterRemove(tournamentBlueRoster, name);

            if (_rosterContains(tournamentRedRoster, name)) {
              if (player && player.tell) player.tell('§e[Tournament] ' + name + ' is already on Red.');
              return 1;
            }

            tournamentRedRoster.push(name);
            ctx.source.server.runCommandSilent(
              'tellraw @a ["",{"text":"[Tournament] ","color":"gold"},{"text":"' + name + '","color":"dark_red"},{"text":" \u2192 Red","color":"gray"}]'
            );
            return 1;
          })
      )
  );

  // /tournament blue <player>
  cmd = cmd.then(
    Commands.literal('blue')
      .then(
        Commands.argument('player', StringArgumentType_T.word())
          .suggests(function(ctx, builder) {
            var players = ctx.source.server.players;
            for (var _si = 0; _si < players.length; _si++) {
              var _sp = players[_si];
              var _sn = _sp && _sp.name && _sp.name.string ? String(_sp.name.string) : null;
              if (_sn) builder.suggest(_sn);
            }
            return builder.buildFuture();
          })
          .executes(function(ctx) {
            var player = ctx.source.player;
            var name   = String(StringArgumentType_T.getString(ctx, 'player'));

            if (!getOnlinePlayerByName(ctx.source.server, name)) {
              if (player && player.tell) player.tell('§c[Tournament] ' + name + ' is not online.');
              return 0;
            }

            // Move from red if already there
            tournamentRedRoster = _rosterRemove(tournamentRedRoster, name);

            if (_rosterContains(tournamentBlueRoster, name)) {
              if (player && player.tell) player.tell('§e[Tournament] ' + name + ' is already on Blue.');
              return 1;
            }

            tournamentBlueRoster.push(name);
            ctx.source.server.runCommandSilent(
              'tellraw @a ["",{"text":"[Tournament] ","color":"gold"},{"text":"' + name + '","color":"aqua"},{"text":" \u2192 Blue","color":"gray"}]'
            );
            return 1;
          })
      )
  );

  // /tournament remove <player>
  cmd = cmd.then(
    Commands.literal('remove')
      .then(
        Commands.argument('player', StringArgumentType_T.word())
          .suggests(function(ctx, builder) {
            var allRostered = tournamentRedRoster.concat(tournamentBlueRoster);
            for (var _ri = 0; _ri < allRostered.length; _ri++) {
              builder.suggest(allRostered[_ri]);
            }
            return builder.buildFuture();
          })
          .executes(function(ctx) {
            var player = ctx.source.player;
            var name   = String(StringArgumentType_T.getString(ctx, 'player'));
            tournamentRedRoster  = _rosterRemove(tournamentRedRoster,  name);
            tournamentBlueRoster = _rosterRemove(tournamentBlueRoster, name);
            if (player && player.tell) player.tell('§e[Tournament] ' + name + ' removed from rosters.');
            return 1;
          })
      )
  );

  event.register(cmd);
});
