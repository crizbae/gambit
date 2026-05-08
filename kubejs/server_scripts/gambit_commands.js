// ============================================================
// Gambit Commands
//
// All ServerEvents.commandRegistry registrations consolidated
// into a single block (Item 4).
//
//   /gambitstats [subcommand]  — stats lookup and leaderboards
//   gambit_log_match <winner>  — log match result (internal)
//   /gambitkit <kit>           — switch kit
//   /gambitboard <subcommand>  — manage leaderboard billboards (OP)
//   gambit_reset_downs         — reset down state for new match (internal)
//   gambit_set_downs <n>       — debug: set your down count (OP)
//
// Depends on: gambit_stats.js, gambit_billboard.js, gambit_tracker.js
// (all loaded before commands dispatch at runtime regardless of file order)
// ============================================================

var StringArgumentType  = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');
var IntegerArgumentType = Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType');

ServerEvents.commandRegistry(function(event) {
  var Commands = event.commands;

  // ── /gambitstats ──────────────────────────────────────────
  event.register(
    Commands.literal('gambitstats')

      // /gambitstats — usage help
      .executes(function(ctx) {
        var player = ctx.source.player;
        if (!player || !player.tell) return 1;
        player.tell('§6§l── Gambit Stats ──');
        player.tell('§e/gambitstats me §7— your stats');
        player.tell('§e/gambitstats player <name> §7— another player\'s stats');
        player.tell('§e/gambitstats combined §7— combined leaderboard');
        player.tell('§e/gambitstats elim §7— elimination leaderboard');
        player.tell('§e/gambitstats tdm §7— TDM leaderboard');
        player.tell('§e/gambitstats top <metric> §7— top 10 by metric');
        player.tell('§7Metrics: §fkd, winpct, kills, deaths, damage, wins, matches, mvps, dpl, assists, streak, revives');
        return 1;
      })

      // /gambitstats me
      .then(
        Commands.literal('me')
          .executes(function(ctx) {
            var player = ctx.source.player;
            var name   = player && player.name && player.name.string ? player.name.string : null;
            if (!name) { if (player && player.tell) player.tell('§c[Gambit Stats] Unable to resolve your player name.'); return 1; }
            loadEntryFromPlayer(player);
            showStatsCard(player, name, getEntry(name));
            return 1;
          })
      )

      // /gambitstats top <metric>
      .then(
        Commands.literal('top')
          .then(
            Commands.argument('metric', StringArgumentType.word())
              .executes(function(ctx) {
                var player = ctx.source.player;
                if (!player || !player.tell) return 1;
                var metric = String(StringArgumentType.getString(ctx, 'metric')).toLowerCase();
                var label  = metricLabel(metric);
                if (!label) { player.tell('§e[Gambit Stats] Unknown metric "' + metric + '". Use: kd, winpct, damage, kills, deaths, wins, matches, mvps, dpl, assists, streak, revives.'); return 1; }
                if (statsSize() === 0) { player.tell('§7[Gambit Stats] No stats recorded yet.'); return 1; }
                var sorted = getSortedEntriesByMetric(metric);
                var limit  = Math.min(10, sorted.length);
                player.tell('§6§l── Gambit Top ' + limit + ' by ' + label + ' ──');
                for (var i = 0; i < limit; i++) {
                  player.tell('§7' + (i + 1) + '. §e' + sorted[i][0] + '§r — §f' + formatMetricValue(metricValue(sorted[i][1], metric), metric));
                }
                player.tell('§6§l──────────────────────────────');
                return 1;
              })
          )
      )

      // /gambitstats postgame
      .then(
        Commands.literal('postgame')
          .requires(function(src) { return src.hasPermission(2); })
          .executes(function(ctx) {
            broadcastPostGameScoreboard(ctx.source.server);
            return 1;
          })
      )

      // /gambitstats tracking on|off
      .then(
        Commands.literal('tracking')
          .requires(function(src) { return src.hasPermission(2); })
          .then(
            Commands.literal('on')
              .executes(function(ctx) {
                statsTrackingEnabled = true;
                ctx.source.server.runCommandSilent(
                  'tellraw @a ["",{"text":"[Gambit] ","color":"gray"},{"text":"Stat tracking enabled.","color":"green"}]'
                );
                return 1;
              })
          )
          .then(
            Commands.literal('off')
              .executes(function(ctx) {
                statsTrackingEnabled = false;
                ctx.source.server.runCommandSilent(
                  'tellraw @a ["",{"text":"[Gambit] ","color":"gray"},{"text":"Stat tracking disabled.","color":"red"}]'
                );
                return 1;
              })
          )
      )

      // /gambitstats addmatch <playerName|red|blue|all>
      .then(
        Commands.literal('addmatch')
          .requires(function(src) { return src.hasPermission(2); })
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .executes(function(ctx) {
                var target = StringArgumentType.getString(ctx, 'playerName');
                var caller = ctx.source.player;
                var result = applyMatchResult(ctx.source.server, target, true, false);
                if (result.count <= 0) { if (caller && caller.tell) caller.tell('§c[Gambit Stats] No valid online target for addmatch: "' + target + '".'); return 1; }
                if (caller && caller.tell) {
                  if (result.mode === 'player') { caller.tell('§a[Gambit Stats] Added match for ' + result.playerName + '. Matches: ' + result.entry.matches + ', W%: ' + getWinPct(result.entry).toFixed(1) + '%.'); }
                  else { caller.tell('§a[Gambit Stats] Added match for ' + result.count + ' player(s) in target "' + result.mode + '".'); }
                }
                return 1;
              })
          )
      )

      // /gambitstats addwin <playerName|red|blue|all>
      .then(
        Commands.literal('addwin')
          .requires(function(src) { return src.hasPermission(2); })
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .executes(function(ctx) {
                var target = StringArgumentType.getString(ctx, 'playerName');
                var caller = ctx.source.player;
                var result = applyMatchResult(ctx.source.server, target, false, true);
                if (result.count <= 0) { if (caller && caller.tell) caller.tell('§c[Gambit Stats] No valid online target for addwin: "' + target + '".'); return 1; }
                if (caller && caller.tell) {
                  if (result.mode === 'player') { caller.tell('§a[Gambit Stats] Added win for ' + result.playerName + '. Wins: ' + result.entry.wins + ', Matches: ' + result.entry.matches + ', W%: ' + getWinPct(result.entry).toFixed(1) + '%.'); }
                  else { caller.tell('§a[Gambit Stats] Added wins for ' + result.count + ' player(s) in target "' + result.mode + '".'); }
                }
                return 1;
              })
          )
      )

      // /gambitstats elim
      .then(
        Commands.literal('elim')
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player || !player.tell) return 1;
            var sorted = getSortedEntriesByElimScore();
            var limit  = Math.min(10, sorted.length);
            player.tell('§6§l── Gambit Elimination Leaderboard ──');
            player.tell('§7Score = (0.5×dmg) + (100×kills) + (50×assists) + (300 MVP) ÷ matches');
            for (var i = 0; i < limit; i++) {
              var _e = sorted[i][1];
              player.tell('§7' + (i + 1) + '. §e' + sorted[i][0] + '§r — §2Score: §f' + getElimAvgScore(_e).toFixed(0) + ' §8(' + (_e.elim_matches || 0) + ' matches)');
            }
            if (limit === 0) player.tell('§7No players have played ' + LEADERBOARD_MIN_MATCHES_MODE + '+ elimination matches yet.');
            player.tell('§6§l────────────────────────────────');
            return 1;
          })
      )

      // /gambitstats tdm
      .then(
        Commands.literal('tdm')
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player || !player.tell) return 1;
            var sorted = getSortedEntriesByTdmScore();
            var limit  = Math.min(10, sorted.length);
            player.tell('§6§l── Gambit TDM Leaderboard ──');
            player.tell('§7Score = (0.25×dmg) + (100×kills) + (50×assists) - (100×deaths) + (500 MVP) ÷ matches');
            for (var i = 0; i < limit; i++) {
              var _e = sorted[i][1];
              player.tell('§7' + (i + 1) + '. §e' + sorted[i][0] + '§r — §2Score: §f' + getTdmAvgScore(_e).toFixed(0) + ' §8(' + (_e.tdm_matches || 0) + ' matches)');
            }
            if (limit === 0) player.tell('§7No players have played ' + LEADERBOARD_MIN_MATCHES_MODE + '+ TDM matches yet.');
            player.tell('§6§l───────────────────────');
            return 1;
          })
      )

      // /gambitstats combined
      .then(
        Commands.literal('combined')
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player || !player.tell) return 1;
            var sorted = getSortedEntries();
            var limit  = Math.min(10, sorted.length);
            player.tell('§6§l── Combined Leaderboard ──');
            if (limit === 0) {
              player.tell('§7No players with ' + LEADERBOARD_MIN_MATCHES_MODE + '+ elim and ' + LEADERBOARD_MIN_MATCHES_MODE + '+ TDM matches yet.');
            } else {
              for (var i = 0; i < limit; i++) {
                var e = sorted[i][1];
                player.tell('§7' + (i + 1) + '. §e' + sorted[i][0] + '§r — §bKD: §f' + getKD(e).toFixed(2) + '§r | §aDPL: §f' + getAvgDamagePerLife(e).toFixed(1));
              }
            }
            player.tell('§6§l──────────────────────────');
            return 1;
          })
      )

      // /gambitstats player <playerName>
      .then(
        Commands.literal('player')
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .executes(function(ctx) {
                var viewer      = ctx.source.player;
                if (!viewer || !viewer.tell) return 1;
                var targetInput = StringArgumentType.getString(ctx, 'playerName');
                var target      = getExistingStatName(targetInput);
                if (!target) {
                  var tp = getOnlinePlayerByName(ctx.source.server, targetInput);
                  target = tp && tp.name && tp.name.string ? tp.name.string : null;
                }
                if (!target || !stats[target]) { viewer.tell('§c[Gambit Stats] No stats found for "' + targetInput + '".'); return 1; }
                var targetOnlineV = getOnlinePlayerByName(ctx.source.server, target);
                if (targetOnlineV) loadEntryFromPlayer(targetOnlineV);
                showStatsCard(viewer, target, stats[target]);
                return 1;
              })
          )
      )

      // /gambitstats reset all / reset <playerName>
      .then(
        Commands.literal('reset')
          .requires(function(src) { return src.hasPermission(2); })
          .then(
            Commands.literal('all')
              .executes(function(ctx) {
                var player    = ctx.source.player;
                var actorName = player && player.name && player.name.string ? player.name.string : 'Server Console';
                var count     = statsSize();
                var keys      = Object.keys(stats);
                for (var i = 0; i < keys.length; i++) stats[keys[i]] = makeDefaultEntry();
                ctx.source.server.players.forEach(function(p) { clearEntryForPlayer(p); });
                saveStatsToDisk();
                gambitDbResetAll();
                updateBillboard(ctx.source.server);
                if (player && player.tell) player.tell('§a[Gambit Stats] Cleared stats for ' + count + ' player(s).');
                ctx.source.server.players.forEach(function(p) {
                  if (!player || p.uuid !== player.uuid) p.tell('§a[Gambit Stats] Round stats have been reset by ' + actorName + '.');
                });
                return 1;
              })
          )
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .executes(function(ctx) {
                var caller      = ctx.source.player;
                var targetInput = StringArgumentType.getString(ctx, 'playerName');
                var targetPlayer = getOnlinePlayerByName(ctx.source.server, targetInput);
                if (targetPlayer) {
                  clearEntryForPlayer(targetPlayer);
                  saveStatsToDisk();
                  gambitDbResetPlayer(targetPlayer.name.string);
                  if (caller && caller.tell) {
                    caller.tell('§a[Gambit Stats] Reset stats for ' + targetPlayer.name.string + '.');
                    if (caller.uuid !== targetPlayer.uuid) targetPlayer.tell('§a[Gambit Stats] Your stats were reset by ' + caller.name.string + '.');
                  }
                  return 1;
                }
                var resolvedName = getExistingStatName(targetInput);
                if (!resolvedName) { if (caller && caller.tell) caller.tell('§c[Gambit Stats] No stats found for "' + targetInput + '".'); return 1; }
                stats[resolvedName] = makeDefaultEntry();
                saveStatsToDisk();
                gambitDbResetPlayer(resolvedName);
                if (caller && caller.tell) caller.tell('§a[Gambit Stats] Reset stats for ' + resolvedName + ' (offline).');
                return 1;
              })
          )
          .executes(function(ctx) {
            var caller = ctx.source.player;
            if (caller && caller.tell) caller.tell('§e[Gambit Stats] Specify a target: §f/gambitstats reset all §eor §f/gambitstats reset <playerName>');
            return 1;
          })
      )

      // /gambitstats <playerName> — OP-only legacy alias
      .then(
        Commands.argument('playerName', StringArgumentType.word())
          .requires(function(src) { return src.hasPermission(2); })
          .executes(function(ctx) {
            var player      = ctx.source.player;
            if (!player || !player.tell) return 1;
            var targetInput = StringArgumentType.getString(ctx, 'playerName');
            var target      = getExistingStatName(targetInput);
            if (!target) {
              var tp = getOnlinePlayerByName(ctx.source.server, targetInput);
              target = tp && tp.name && tp.name.string ? tp.name.string : null;
            }
            if (!target || !stats[target]) { player.tell('§c[Gambit Stats] No stats found for "' + targetInput + '".'); return 1; }
            var targetOnline = getOnlinePlayerByName(ctx.source.server, target);
            if (targetOnline) loadEntryFromPlayer(targetOnline);
            showStatsCard(player, target, stats[target]);
            return 1;
          })
      )
  );

  // ── gambit_log_match ──────────────────────────────────────
  // Called from win/tie mcfunctions: gambit_log_match red|blue|tie
  event.register(
    Commands.literal('gambit_log_match')
      .requires(function(src) { return src.hasPermission(2); })
      .then(
        Commands.argument('winner', StringArgumentType.word())
          .executes(function(ctx) {
            var server = ctx.source.server;
            var winner = String(StringArgumentType.getString(ctx, 'winner')).toLowerCase();
            if (winner !== 'red' && winner !== 'blue' && winner !== 'tie') return 0;

            // Skip all stat recording when tracking is disabled.
            if (typeof statsTrackingEnabled !== 'undefined' && !statsTrackingEnabled) return 1;

            var modeId  = typeof currentModeId !== 'undefined' ? currentModeId : 0;
            var isTdm   = modeId === 1;
            var mvpResult = getRoundMvp();
            var mvpName   = mvpResult ? mvpResult.name : null;

            var playerDetails = [];
            if (server && server.players) {
              server.players.forEach(function(p) {
                var isRed  = hasTagSafe(p, 'Red');
                var isBlue = hasTagSafe(p, 'Blue');
                if (!isRed && !isBlue) return;
                var name = p.name && p.name.string ? p.name.string : null;
                if (!name) return;
                var rs       = roundStats[name] || { damage: 0, kills: 0, deaths: 0, assists: 0 };
                var isMvp    = (name === mvpName);
                var matchScore = isTdm ? calcTdmMatchScore(rs, isMvp) : calcElimMatchScore(rs, isMvp);
                playerDetails.push({ name: name, team: isRed ? 'red' : 'blue', kills: rs.kills || 0, deaths: rs.deaths || 0, damage: rs.damage || 0, assists: rs.assists || 0, match_score: matchScore });
                // Accumulate per-mode score into lifetime stats
                loadEntryFromPlayer(p);
                var e = getEntry(name);
                if (isTdm) { e.tdm_score_total = (e.tdm_score_total || 0) + matchScore; e.tdm_matches = (e.tdm_matches || 0) + 1; }
                else       { e.elim_score_total = (e.elim_score_total || 0) + matchScore; e.elim_matches = (e.elim_matches || 0) + 1; }
                saveEntryToPlayer(p);
              });
            }

            if (typeof gambitDbIsEnabled === 'function' && gambitDbIsEnabled()) {
              var mapId    = typeof currentMapId !== 'undefined' ? currentMapId : 0;
              var mapName  = 'Unknown';
              if (mapId > 0 && typeof getMapById === 'function') {
                var mapObj = getMapById(mapId);
                if (mapObj && mapObj.name) mapName = mapObj.name;
              }
              var modeName   = modeId === 1 ? 'tdm' : 'elimination';
              var durationSec = 0;
              if (typeof matchStartTime !== 'undefined' && matchStartTime > 0) {
                durationSec = Math.floor((Date.now() - matchStartTime) / 1000);
              }
              var dbMatchId = gambitDbInsertMatch(mapName, mapId, modeName, winner, durationSec);
              if (dbMatchId >= 0 && playerDetails.length > 0) gambitDbInsertMatchPlayers(dbMatchId, playerDetails);
              if (dbMatchId >= 0) console.info('[Gambit Stats] Match #' + dbMatchId + ' logged: ' + mapName + ' ' + modeName + ' → ' + winner + ' (' + durationSec + 's, ' + playerDetails.length + ' players)');
            }

            markStatsDirty();
            return 1;
          })
      )
  );

  // ── /gambitkit ────────────────────────────────────────────
  // Usable by all players. Runs the kit selector mcfunction as
  // the calling player, identical to stepping on the glass block.
  event.register(
    Commands.literal('gambitkit')
      .then(
        Commands.argument('kit', StringArgumentType.word())
          .suggests(function(ctx, builder) {
            for (var _ki = 0; _ki < VALID_KITS.length; _ki++) {
              builder.suggest(VALID_KITS[_ki]);
            }
            return builder.buildFuture();
          })
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var kit = String(StringArgumentType.getString(ctx, 'kit')).toLowerCase();
            if (VALID_KITS.indexOf(kit) === -1) {
              player.tell('§c[Gambit] Unknown kit "' + kit + '". Valid kits: ' + VALID_KITS.join(', '));
              return 0;
            }
            var name = player.name.string;
            ctx.source.server.runCommandSilent('execute as ' + name + ' at ' + name + ' run function gun:selectors/' + kit);
            return 1;
          })
      )
  );

  // ── /gambitboard ──────────────────────────────────────────
  function setupBillboard(ctx, mode) {
    var player     = ctx.source.player;
    if (!player || !player.tell) return 1;
    var playerName = player.name && player.name.string ? player.name.string : null;
    if (!playerName) return 1;
    var x = Math.floor(player.x);
    var y = Math.floor(player.y) + 1;
    var z = Math.floor(player.z);
    var tag = BILLBOARD_TAGS[mode];
    ctx.source.server.runCommandSilent('execute in minecraft:overworld run kill @e[type=minecraft:text_display,tag=' + tag + ']');
    billboardPositions[mode] = { x: x, y: y, z: z };
    saveBillboardPositions();
    var textJson = buildBillboardText(mode);
    var rotation = (typeof BILLBOARD_ROTATION !== 'undefined' && BILLBOARD_ROTATION[mode]) ? BILLBOARD_ROTATION[mode] : '0f,0f,0f,1f';
    var nbt      = '{Tags:["' + tag + '"],billboard:"fixed",background:0,line_width:300,transformation:{left_rotation:[' + rotation + '],right_rotation:[0f,0f,0f,1f],translation:[0f,0f,0f],scale:[1f,1f,1f]},text:\'' + textJson + '\'}'; 
    ctx.source.server.runCommandSilent(
      'execute as ' + playerName + ' in minecraft:overworld run summon minecraft:text_display ' + x + ' ' + y + ' ' + z + ' ' + nbt
    );
    ctx.source.server.runCommandSilent('execute in minecraft:overworld run forceload add ' + x + ' ' + z);
    player.tell('§a[Gambit Board] ' + mode.charAt(0).toUpperCase() + mode.slice(1) + ' billboard placed at ' + x + ' ' + y + ' ' + z + '.');
    return 1;
  }

  function removeBillboard(ctx, mode) {
    var player = ctx.source.player;
    if (!player || !player.tell) return 1;
    var tag    = BILLBOARD_TAGS[mode];
    var oldPos = billboardPositions[mode];
    billboardPositions[mode] = null;
    saveBillboardPositions();
    ctx.source.server.runCommandSilent('execute in minecraft:overworld run kill @e[type=minecraft:text_display,tag=' + tag + ']');
    if (oldPos) ctx.source.server.runCommandSilent('execute in minecraft:overworld run forceload remove ' + oldPos.x + ' ' + oldPos.z);
    player.tell('§a[Gambit Board] ' + mode.charAt(0).toUpperCase() + mode.slice(1) + ' billboard removed.');
    return 1;
  }

  event.register(
    Commands.literal('gambitboard')
      .requires(function(src) { return src.hasPermission(2); })
      .then(
        Commands.literal('setup')
          .then(Commands.literal('combined').executes(function(ctx) { return setupBillboard(ctx, 'combined'); }))
          .then(Commands.literal('elim').executes(function(ctx) { return setupBillboard(ctx, 'elim'); }))
          .then(Commands.literal('tdm').executes(function(ctx) { return setupBillboard(ctx, 'tdm'); }))
      )
      .then(
        Commands.literal('remove')
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player || !player.tell) return 1;
            var modes  = ['combined', 'elim', 'tdm'];
            for (var mi = 0; mi < modes.length; mi++) {
              var oldPos = billboardPositions[modes[mi]];
              billboardPositions[modes[mi]] = null;
              ctx.source.server.runCommandSilent('execute in minecraft:overworld run kill @e[type=minecraft:text_display,tag=' + BILLBOARD_TAGS[modes[mi]] + ']');
              if (oldPos) ctx.source.server.runCommandSilent('execute in minecraft:overworld run forceload remove ' + oldPos.x + ' ' + oldPos.z);
            }
            saveBillboardPositions();
            player.tell('§a[Gambit Board] All billboards removed.');
            return 1;
          })
          .then(Commands.literal('combined').executes(function(ctx) { return removeBillboard(ctx, 'combined'); }))
          .then(Commands.literal('elim').executes(function(ctx) { return removeBillboard(ctx, 'elim'); }))
          .then(Commands.literal('tdm').executes(function(ctx) { return removeBillboard(ctx, 'tdm'); }))
      )
      .then(
        Commands.literal('refresh')
          .executes(function(ctx) {
            updateBillboard(ctx.source.server);
            if (ctx.source.player && ctx.source.player.tell) ctx.source.player.tell('§a[Gambit Board] All billboards updated.');
            return 1;
          })
      )
  );

  // ── gambit_reset_downs ────────────────────────────────────
  // Called from gun:starts/general at match start.
  // Resets each online player's persistent down counter and syncs the scoreboard.
  // Also clears all in-match tracking state for a clean round.
  event.register(
    Commands.literal('gambit_reset_downs')
      .requires(function(src) { return src.hasPermission(2); })
      .executes(function(ctx) {
        ctx.source.server.players.forEach(function(p) {
          var name = getPlayerName(p);
          if (!name) return;
          writeTagNumber(p.persistentData, PD_DOWNS, 0, true);
          ctx.source.server.runCommandSilent('scoreboard players set ' + name + ' gun_downs 0');
        });
        currentStreaks    = {};
        downerNames       = {};
        firstDownerNames  = {};
        pendingExecutions = [];
        syringeCounts     = {};
        recentlyDowned    = {};
        roundStats        = {};
        firstBloodDone    = false; // Item 1: reset for new match
        return 1;
      })
  );

  // ── gambit_set_downs (debug) ──────────────────────────────
  // Usage: /gambit_set_downs <count>
  event.register(
    Commands.literal('gambit_set_downs')
      .requires(function(src) { return src.hasPermission(2); })
      .then(
        Commands.argument('count', IntegerArgumentType.integer(0, 10))
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var count = IntegerArgumentType.getInteger(ctx, 'count');
            var name  = getPlayerName(player);
            writeTagNumber(player.persistentData, PD_DOWNS, count, true);
            ctx.source.server.runCommandSilent('scoreboard players set ' + name + ' gun_downs ' + count);
            player.tell('§a[Gambit Debug] Down count set to ' + count + ' (max: ' + downsConfig.max_downs + ').');
            return 1;
          })
      )
  );
});
