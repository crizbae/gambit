// ============================================================
// Gambit Utility Commands
//
//   /spectate      - Opt out of queue immediately.
//                    If currently in a match, switch to spectator and teleport
//                    to the active map observer view. Otherwise stay adventure
//                    and spectate automatically at match start.
//
//   /play          - Opt back into queue for upcoming rounds.
//                    Does not force a gamemode change.
//
//   /queue         - Show current queue status.
//
//   /setgoal <n>   - Set the TDM kill target (OP only, 1–500).
//                    Broadcasts the new target to all players.
//
//   /setmap <preset> - Announce and stage the next map (OP only).
//                    Presets: forest, forest2, trenches, tdm_forest,
//                             training_grounds, tdm_training_grounds, tdm_mall
//                    Displays persistently in the lobby actionbar.
//
// Notes:
//   - Queue state is controlled by player tag: gun_optout
//   - Opted-out players are excluded from round-start team assignment.
// ============================================================

var OPT_OUT_TAG = 'gun_optout';
var IntegerArgumentType = Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType');

function hasTagSafe(player, tagName) {
  if (!player || !tagName) return false;
  try {
    if (player.hasTag) return player.hasTag(tagName);
  } catch (e) {
  }

  try {
    if (player.tags && player.tags.includes) return player.tags.includes(tagName);
  } catch (e) {
  }

  try {
    if (player.tags && player.tags.contains) return player.tags.contains(tagName);
  } catch (e) {
  }

  return false;
}

function runForPlayer(player, command) {
  if (!player || !player.server || !command) return;
  var name = player.name && player.name.string ? player.name.string : null;
  if (!name) return;
  player.server.runCommandSilent('execute as ' + name + ' run ' + command);
}

function setOptOutState(player, enabled) {
  if (!player) return false;

  if (enabled) {
    var wasInMatch = hasTagSafe(player, 'Red') || hasTagSafe(player, 'Blue');

    runForPlayer(player, 'tag @s add ' + OPT_OUT_TAG);
    runForPlayer(player, 'tag @s remove Red');
    runForPlayer(player, 'tag @s remove Blue');
    runForPlayer(player, 'team join lobby @s');
    if (wasInMatch) {
      runForPlayer(player, 'clear @s');
      runForPlayer(player, 'gamemode spectator');
      runForPlayer(player, 'function gun:starts/spectator_tpmap');
    } else {
      runForPlayer(player, 'gamemode adventure');
    }
    runForPlayer(player, 'tag @s remove gun_dead');
    runForPlayer(player, 'tag @s remove gun_just_died');
    runForPlayer(player, 'tag @s remove gun_spec_tp_pending');
    runForPlayer(player, 'scoreboard players set @s tdm_respawn_timer 0');
    runForPlayer(player, 'scoreboard players set @s spec_respawn_timer 0');
    return true;
  }

  runForPlayer(player, 'tag @s remove ' + OPT_OUT_TAG);
  runForPlayer(player, 'team join lobby @s');
  runForPlayer(player, 'scoreboard players set @s tdm_respawn_timer 0');
  runForPlayer(player, 'scoreboard players set @s spec_respawn_timer 0');
  return true;
}

function tellQueueStatus(player) {
  var optedOut = hasTagSafe(player, OPT_OUT_TAG);
  if (optedOut) {
    player.tell('§e[Gambit Queue] Spectate mode is enabled. You will not be placed in matches.');
    player.tell('§7Use §f/play §7to opt back in.');
    return;
  }

  player.tell('§a[Gambit Queue] You are in the match queue.');
  player.tell('§7Use §f/spectate §7to opt out.');
}

function announceNextMap(server, mapId, modeId, modeName, mapName, modeColor, bossbarColor) {
  server.runCommandSilent('scoreboard players set #nextmap nextmap_id ' + mapId);
  server.runCommandSilent('scoreboard players set #nextmode nextmap_mode ' + modeId);
  server.runCommandSilent(
    'bossbar set gun:nextmap name ["",{"text":"Destination: ","color":"gold"},{"text":"' + modeName + '","color":"' + modeColor + '"},{"text":" \u2014 ' + mapName + '","color":"white"}]'
  );
  server.runCommandSilent('bossbar set gun:nextmap color ' + bossbarColor);
  server.runCommandSilent('bossbar set gun:nextmap players @a');
  server.runCommandSilent('bossbar set gun:nextmap visible true');
}

ServerEvents.loaded(function(event) {
  event.server.runCommandSilent('scoreboard objectives add nextmap_id dummy');
  event.server.runCommandSilent('scoreboard objectives add nextmap_mode dummy');
  event.server.runCommandSilent('scoreboard objectives add tdm_kill_target dummy "Kill Target"');
  event.server.runCommandSilent('execute unless score #target tdm_kill_target matches 1.. run scoreboard players set #target tdm_kill_target 50');
  event.server.runCommandSilent('bossbar add gun:nextmap {"text":""}');
  event.server.runCommandSilent('bossbar set gun:nextmap visible false');
  event.server.runCommandSilent('bossbar set gun:nextmap max 1');
  event.server.runCommandSilent('bossbar set gun:nextmap value 1');
});

ServerEvents.commandRegistry(function(event) {
  var Commands = event.commands;

  event.register(
    Commands.literal('spectate')
      .executes(function(ctx) {
        var player = ctx.source.player;
        if (!player || !player.tell) return 1;

        if (hasTagSafe(player, OPT_OUT_TAG)) {
          player.tell('§e[Gambit Queue] Spectate mode is already enabled.');
          return 1;
        }

        setOptOutState(player, true);
        player.tell('§e[Gambit Queue] Spectate mode enabled. Use §f/play §eto rejoin the queue.');
        return 1;
      })
  );

  event.register(
    Commands.literal('play')
      .executes(function(ctx) {
        var player = ctx.source.player;
        if (!player || !player.tell) return 1;

        if (!hasTagSafe(player, OPT_OUT_TAG)) {
          player.tell('§e[Gambit Queue] You are already in the queue.');
          return 1;
        }

        setOptOutState(player, false);
        player.tell('§a[Gambit Queue] You are queued to play in the next match.');
        return 1;
      })
  );

  event.register(
    Commands.literal('queue')
      .executes(function(ctx) {
        var player = ctx.source.player;
        if (!player || !player.tell) return 1;
        tellQueueStatus(player);
        return 1;
      })
  );

  event.register(
    Commands.literal('setgoal')
      .requires(function(src) { return src.hasPermission(2); })
      .then(
        Commands.argument('kills', IntegerArgumentType.integer(1, 500))
          .executes(function(ctx) {
            var kills = IntegerArgumentType.getInteger(ctx, 'kills');
            ctx.source.server.runCommandSilent('scoreboard objectives add tdm_kill_target dummy "Kill Target"');
            ctx.source.server.runCommandSilent('scoreboard players set #target tdm_kill_target ' + kills);
            ctx.source.server.runCommandSilent(
              'tellraw @a ["[Gambit] ",{"text":"TDM kill target set to ","color":"yellow"},{"text":"' + kills + '","color":"aqua"},{"text":" kills.","color":"yellow"}]'
            );
            return 1;
          })
      )
  );

  event.register(
    Commands.literal('setmap')
      .requires(function(src) { return src.hasPermission(2); })
      .then(Commands.literal('forest')
        .executes(function(ctx) {
          announceNextMap(ctx.source.server, 1, 0, 'Elimination', 'Forest', 'green', 'green');
          return 1;
        }))
      .then(Commands.literal('forest2')
        .executes(function(ctx) {
          announceNextMap(ctx.source.server, 2, 0, 'Elimination', 'Forest 2', 'green', 'green');
          return 1;
        }))
      .then(Commands.literal('trenches')
        .executes(function(ctx) {
          announceNextMap(ctx.source.server, 3, 0, 'Elimination', 'Trenches', 'green', 'green');
          return 1;
        }))
      .then(Commands.literal('training_grounds')
        .executes(function(ctx) {
          announceNextMap(ctx.source.server, 4, 0, 'Elimination', 'Training Grounds', 'green', 'green');
          return 1;
        }))
      .then(Commands.literal('tdm_training_grounds')
        .executes(function(ctx) {
          announceNextMap(ctx.source.server, 4, 1, 'TDM', 'Training Grounds', 'aqua', 'blue');
          return 1;
        }))
      .then(Commands.literal('tdm_mall')
        .executes(function(ctx) {
          announceNextMap(ctx.source.server, 5, 1, 'TDM', 'Mall', 'aqua', 'blue');
          return 1;
        }))
  );

  event.register(
    Commands.literal('start')
      .requires(function(src) { return src.hasPermission(2); })
      .executes(function(ctx) {
        ctx.source.server.runCommandSilent('function gun:starts/staged');
        return 1;
      })
  );
});
