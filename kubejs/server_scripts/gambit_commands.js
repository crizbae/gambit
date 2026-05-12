// ============================================================
// Gambit Commands
//
// All ServerEvents.commandRegistry registrations consolidated
// into a single block (Item 4).
//
//   /stats [subcommand]        — stats lookup and leaderboards
//   gambit_log_match <winner>  — log match result (internal)
//   /gambitboard <subcommand>  — manage leaderboard billboards (OP)
//   gambit_reset_downs         — reset down state for new match (internal)
//   gambit_set_downs <n>       — debug: set your down count (OP)
//   /gambitdb status|reconnect|testlog  — diagnose MySQL connection (OP)
//
// Depends on: gambit_stats.js, gambit_billboard.js, gambit_tracker.js
// (all loaded before commands dispatch at runtime regardless of file order)
// ============================================================

var StringArgumentType  = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');
var IntegerArgumentType = Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType');

// Suggestion provider helpers
function suggestPlayers(ctx, builder) {
  try { ctx.source.server.players.forEach(function(p) { builder.suggest(p.name.string); }); } catch(e) {}
  return builder.buildFuture();
}
function suggestTeamTargets(ctx, builder) {
  ['red', 'blue', 'all'].forEach(function(s) { builder.suggest(s); });
  try { ctx.source.server.players.forEach(function(p) { builder.suggest(p.name.string); }); } catch(e) {}
  return builder.buildFuture();
}
function suggestMetrics(ctx, builder) {
  ['kd','winpct','kills','deaths','damage','wins','matches','mvps','dpl','assists','streak','revives'].forEach(function(s) { builder.suggest(s); });
  return builder.buildFuture();
}
function suggestSessionMetrics(ctx, builder) {
  ['kd','winpct','kills','deaths','damage','wins','matches','mvps','dpl','assists','streak','revives'].forEach(function(s) { builder.suggest(s); });
  return builder.buildFuture();
}

function showElimGlobal(player) {
  if (!player || !player.tell) return;
  var sorted = getSortedEntriesByElimScore();
  var limit  = Math.min(10, sorted.length);
  player.tell('§6§l── Elim Leaderboard (Global) ──');
  player.tell('§7Score = (0.5×dmg) + (100×kills) + (50×assists) + (300 MVP) ÷ matches');
  for (var i = 0; i < limit; i++) {
    var _e = sorted[i][1];
    player.tell('§7' + (i + 1) + '. §e' + sorted[i][0] + '§r — §2Score: §f' + getElimAvgScore(_e).toFixed(0) + ' §8| §bKD: §f' + getElimKD(_e).toFixed(2));
  }
  if (limit === 0) player.tell('§7No players have played ' + LEADERBOARD_MIN_MATCHES_MODE + '+ elimination matches yet.');
  player.tell('§6§l────────────────────────────────');
}

function showTdmGlobal(player) {
  if (!player || !player.tell) return;
  var sorted = getSortedEntriesByTdmScore();
  var limit  = Math.min(10, sorted.length);
  player.tell('§6§l── TDM Leaderboard (Global) ──');
  player.tell('§7Score = (0.25×dmg) + (100×kills) + (50×assists) - (100×deaths) + (500 MVP) ÷ matches');
  for (var i = 0; i < limit; i++) {
    var _e = sorted[i][1];
    player.tell('§7' + (i + 1) + '. §e' + sorted[i][0] + '§r — §2Score: §f' + getTdmAvgScore(_e).toFixed(0) + ' §8| §bKD: §f' + getTdmKD(_e).toFixed(2));
  }
  if (limit === 0) player.tell('§7No players have played ' + LEADERBOARD_MIN_MATCHES_MODE + '+ TDM matches yet.');
  player.tell('§6§l───────────────────────');
}

function showCombinedGlobal(player) {
  if (!player || !player.tell) return;
  var sorted = getSortedEntries();
  var limit  = Math.min(10, sorted.length);
  player.tell('§6§l── Combined Leaderboard (Global) ──');
  if (limit === 0) {
    player.tell('§7No players with ' + LEADERBOARD_MIN_MATCHES_MODE + '+ elim and ' + LEADERBOARD_MIN_MATCHES_MODE + '+ TDM matches yet.');
  } else {
    for (var i = 0; i < limit; i++) {
      var e = sorted[i][1];
      player.tell('§7' + (i + 1) + '. §e' + sorted[i][0] + '§r — §bKD: §f' + getCombinedKD(e).toFixed(2) + '§r | §aDPL: §f' + getAvgDamagePerLife(e).toFixed(1));
    }
  }
  player.tell('§6§l──────────────────────────');
}

function showTopGlobal(ctx) {
  var player = ctx.source.player;
  if (!player || !player.tell) return 1;
  var metric = String(StringArgumentType.getString(ctx, 'metric')).toLowerCase();
  var label  = metricLabel(metric);
  if (!label) { player.tell('§e[Gambit Stats] Unknown metric "' + metric + '". Use: kd, winpct, damage, kills, deaths, wins, matches, mvps, dpl, assists, streak, revives.'); return 1; }
  if (statsSize() === 0) { player.tell('§7[Gambit Stats] No stats recorded yet.'); return 1; }
  var sorted = getSortedEntriesByMetric(metric);
  var limit  = Math.min(10, sorted.length);
  if (limit === 0) { player.tell('§7[Gambit Stats] No players with enough matches yet.'); return 1; }
  player.tell('§6§l── Top ' + limit + ' by ' + label + ' (Global) ──');
  for (var i = 0; i < limit; i++) {
    player.tell('§7' + (i + 1) + '. §e' + sorted[i][0] + '§r — §f' + formatMetricValue(metricValue(sorted[i][1], metric), metric));
  }
  player.tell('§6§l──────────────────────────────');
  return 1;
}

function showTopSession(ctx) {
  var player = ctx.source.player;
  if (!player || !player.tell) return 1;
  var metric = String(StringArgumentType.getString(ctx, 'metric')).toLowerCase();
  var label  = sessionMetricLabel(metric);
  if (!label) { player.tell('§e[Gambit Stats] Unknown metric "' + metric + '". Use: kd, winpct, kills, deaths, damage, wins, matches, mvps, dpl, assists, streak, revives.'); return 1; }
  var sorted = getSortedEntriesBySessionMetric(metric);
  var limit  = Math.min(10, sorted.length);
  if (limit === 0) { player.tell('§7[Gambit Stats] No session data for today yet.'); return 1; }
  player.tell('§6§l── Top ' + limit + ' by ' + label + ' (Today) ──');
  for (var i = 0; i < limit; i++) {
    player.tell('§7' + (i + 1) + '. §e' + sorted[i][0] + '§r — §f' + formatMetricValue(sessionMetricValue(sorted[i][1], metric), metric));
  }
  player.tell('§6§l──────────────────────────────');
  return 1;
}

function showSessionLeaderboard(player, mode) {
  if (!player || !player.tell) return;
  var sorted, scoreLabel, scoreFn, kdFn;
  if (mode === 'Elim') {
    sorted     = getSortedEntriesBySessionElimScore();
    scoreLabel = 'Elim Score';
    scoreFn    = function(s) { return ((0.5*(s.damage||0))+(100*(s.kills||0))+(50*(s.assists||0))+(300*(s.mvps||0)))/(s.matches||1); };
    kdFn       = function(s) { return (s.elim_kills||0) / Math.max(1, s.elim_deaths||0); };
  } else if (mode === 'TDM') {
    sorted     = getSortedEntriesBySessionTdmScore();
    scoreLabel = 'TDM Score';
    scoreFn    = function(s) { return ((0.25*(s.damage||0))+(100*(s.kills||0))+(50*(s.assists||0))-(100*(s.deaths||0))+(500*(s.mvps||0)))/(s.matches||1); };
    kdFn       = function(s) { return (s.tdm_kills||0) / Math.max(1, s.tdm_deaths||0); };
  } else {
    sorted     = getSortedEntriesBySessionCombinedScore();
    scoreLabel = 'Combined Score';
    scoreFn    = function(s) {
      var e = ((0.5*(s.damage||0))+(100*(s.kills||0))+(50*(s.assists||0))+(300*(s.mvps||0)))/(s.matches||1);
      var t = ((0.25*(s.damage||0))+(100*(s.kills||0))+(50*(s.assists||0))-(100*(s.deaths||0))+(500*(s.mvps||0)))/(s.matches||1);
      return (e + t) / 2;
    };
    kdFn = function(s) {
      var k = (s.elim_kills||0) + (s.tdm_kills||0);
      var d = (s.elim_deaths||0) + (s.tdm_deaths||0);
      return k / Math.max(1, d);
    };
  }
  var limit = Math.min(10, sorted.length);
  player.tell('§6§l── ' + mode + ' Leaderboard (Today) ──');
  for (var i = 0; i < limit; i++) {
    var s  = sorted[i][1];
    var kd = kdFn(s).toFixed(2);
    player.tell('§7' + (i + 1) + '. §e' + sorted[i][0] + '§r — §2' + scoreLabel + ': §f' + scoreFn(s).toFixed(0) + ' §8| §bKD: §f' + kd);
  }
  if (limit === 0) player.tell('§7No players have session data for today yet.');
  player.tell('§6§l──────────────────────────');
}

ServerEvents.commandRegistry(function(event) {
  var Commands = event.commands;

  // ── /stats ────────────────────────────────────────────────
  event.register(
    Commands.literal('stats')

      // /stats — usage help
      .executes(function(ctx) {
        var player = ctx.source.player;
        if (!player || !player.tell) return 1;
        player.tell('§6§l── Gambit Stats ──');
        player.tell('§e/stats session §7— your stats today');
        player.tell('§e/stats session <player> §7— another player\'s stats today');
        player.tell('§e/stats global §7— your all-time stats');
        player.tell('§e/stats global <player> §7— another player\'s all-time stats');
        player.tell('§e/stats history §7— your last 5 matches');
        player.tell('§e/stats history <player> §7— another player\'s last 5 matches');
        player.tell('§e/stats top <metric> §7— global top 10 by metric');
        player.tell('§e/stats top global <metric> §7— global top 10 by metric');
        player.tell('§e/stats top session <metric> §7— today\'s top 10 by metric');
        player.tell('§e/stats elim §7— all-time elimination leaderboard');
        player.tell('§e/stats elim global §7— all-time elimination leaderboard');
        player.tell('§e/stats elim session §7— today\'s elimination leaderboard');
        player.tell('§e/stats tdm §7— all-time TDM leaderboard');
        player.tell('§e/stats tdm global §7— all-time TDM leaderboard');
        player.tell('§e/stats tdm session §7— today\'s TDM leaderboard');
        player.tell('§e/stats combined §7— all-time combined leaderboard');
        player.tell('§e/stats combined global §7— all-time combined leaderboard');
        player.tell('§e/stats combined session §7— today\'s combined leaderboard');
        player.tell('§7Metrics: §fkd, winpct, kills, deaths, damage, wins, matches, mvps, dpl, assists, streak, revives');
        return 1;
      })

      // /stats session [playerName]
      .then(
        Commands.literal('session')
          .executes(function(ctx) {
            var player = ctx.source.player;
            var name   = player && player.name && player.name.string ? player.name.string : null;
            if (!name) { if (player && player.tell) player.tell('§c[Gambit Stats] Unable to resolve your player name.'); return 1; }
            loadEntryFromPlayer(player);
            showSessionCard(player, name, getEntry(name));
            return 1;
          })
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .suggests(suggestPlayers)
              .executes(function(ctx) {
                var caller = ctx.source.player;
                if (!caller || !caller.tell) return 1;
                var target = StringArgumentType.getString(ctx, 'playerName');
                var resolved = getExistingStatName(target);
                if (!resolved) { caller.tell('§c[Gambit Stats] No stats found for "' + target + '".'); return 1; }
                var targetPlayer = getOnlinePlayerByName(ctx.source.server, resolved);
                if (targetPlayer) loadEntryFromPlayer(targetPlayer);
                showSessionCard(caller, resolved, getEntry(resolved));
                return 1;
              })
          )
      )

      // /stats global [playerName]
      .then(
        Commands.literal('global')
          .executes(function(ctx) {
            var player = ctx.source.player;
            var name   = player && player.name && player.name.string ? player.name.string : null;
            if (!name) { if (player && player.tell) player.tell('§c[Gambit Stats] Unable to resolve your player name.'); return 1; }
            loadEntryFromPlayer(player);
            showStatsCard(player, name, getEntry(name));
            return 1;
          })
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .suggests(suggestPlayers)
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
                var targetOnline = getOnlinePlayerByName(ctx.source.server, target);
                if (targetOnline) loadEntryFromPlayer(targetOnline);
                showStatsCard(viewer, target, stats[target]);
                return 1;
              })
          )
      )

      // /stats history [playerName]
      .then(
        Commands.literal('history')
          .executes(function(ctx) {
            var player = ctx.source.player;
            var name   = player && player.name && player.name.string ? player.name.string : null;
            if (!name) { if (player && player.tell) player.tell('§c[Gambit Stats] Unable to resolve your player name.'); return 1; }
            loadEntryFromPlayer(player);
            showMatchHistory(player, name, getEntry(name));
            return 1;
          })
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .suggests(suggestPlayers)
              .executes(function(ctx) {
                var caller = ctx.source.player;
                if (!caller || !caller.tell) return 1;
                var target = StringArgumentType.getString(ctx, 'playerName');
                var resolved = getExistingStatName(target);
                if (!resolved) { caller.tell('§c[Gambit Stats] No stats found for "' + target + '".'); return 1; }
                var targetPlayer = getOnlinePlayerByName(ctx.source.server, resolved);
                if (targetPlayer) loadEntryFromPlayer(targetPlayer);
                showMatchHistory(caller, resolved, getEntry(resolved));
                return 1;
              })
          )
      )

      // /stats top [global|session] <metric>
      .then(
        Commands.literal('top')
          .then(
            Commands.literal('global')
              .then(
                Commands.argument('metric', StringArgumentType.word())
                  .suggests(suggestMetrics)
                  .executes(function(ctx) { return showTopGlobal(ctx); })
              )
          )
          .then(
            Commands.literal('session')
              .then(
                Commands.argument('metric', StringArgumentType.word())
                  .suggests(suggestSessionMetrics)
                  .executes(function(ctx) { return showTopSession(ctx); })
              )
          )
          .then(
            Commands.argument('metric', StringArgumentType.word())
              .suggests(suggestMetrics)
              .executes(function(ctx) { return showTopGlobal(ctx); })
          )
      )

      // /stats postgame
      .then(
        Commands.literal('postgame')
          .requires(function(src) { return src.hasPermission(2); })
          .executes(function(ctx) {
            broadcastPostGameScoreboard(ctx.source.server);
            return 1;
          })
      )

      // /stats tracking on|off
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

      // /stats addmatch <playerName|red|blue|all>
      .then(
        Commands.literal('addmatch')
          .requires(function(src) { return src.hasPermission(2); })
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .suggests(suggestTeamTargets)
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

      // /stats addwin <playerName|red|blue|all>
      .then(
        Commands.literal('addwin')
          .requires(function(src) { return src.hasPermission(2); })
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .suggests(suggestTeamTargets)
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

      // /stats elim [global|session]
      .then(
        Commands.literal('elim')
          .executes(function(ctx) {
            showElimGlobal(ctx.source.player);
            return 1;
          })
          .then(
            Commands.literal('global')
              .executes(function(ctx) {
                showElimGlobal(ctx.source.player);
                return 1;
              })
          )
          .then(
            Commands.literal('session')
              .executes(function(ctx) {
                showSessionLeaderboard(ctx.source.player, 'Elim');
                return 1;
              })
          )
      )

      // /stats tdm [global|session]
      .then(
        Commands.literal('tdm')
          .executes(function(ctx) {
            showTdmGlobal(ctx.source.player);
            return 1;
          })
          .then(
            Commands.literal('global')
              .executes(function(ctx) {
                showTdmGlobal(ctx.source.player);
                return 1;
              })
          )
          .then(
            Commands.literal('session')
              .executes(function(ctx) {
                showSessionLeaderboard(ctx.source.player, 'TDM');
                return 1;
              })
          )
      )

      // /stats combined [global|session]
      .then(
        Commands.literal('combined')
          .executes(function(ctx) {
            showCombinedGlobal(ctx.source.player);
            return 1;
          })
          .then(
            Commands.literal('global')
              .executes(function(ctx) {
                showCombinedGlobal(ctx.source.player);
                return 1;
              })
          )
          .then(
            Commands.literal('session')
              .executes(function(ctx) {
                showSessionLeaderboard(ctx.source.player, 'Combined');
                return 1;
              })
          )
      )

      // /stats reset all / reset <playerName>
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
              .suggests(suggestPlayers)
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
            if (caller && caller.tell) caller.tell('§e[Gambit Stats] Specify a target: §f/stats reset all §eor §f/stats reset <playerName>');
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
          .then(Commands.literal('combined_session').executes(function(ctx) { return setupBillboard(ctx, 'combined_session'); }))
          .then(Commands.literal('elim_session').executes(function(ctx) { return setupBillboard(ctx, 'elim_session'); }))
          .then(Commands.literal('tdm_session').executes(function(ctx) { return setupBillboard(ctx, 'tdm_session'); }))
      )
      .then(
        Commands.literal('remove')
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player || !player.tell) return 1;
            for (var mi = 0; mi < ALL_BILLBOARD_MODES.length; mi++) {
              var _m = ALL_BILLBOARD_MODES[mi];
              var oldPos = billboardPositions[_m];
              billboardPositions[_m] = null;
              ctx.source.server.runCommandSilent('execute in minecraft:overworld run kill @e[type=minecraft:text_display,tag=' + BILLBOARD_TAGS[_m] + ']');
              if (oldPos) ctx.source.server.runCommandSilent('execute in minecraft:overworld run forceload remove ' + oldPos.x + ' ' + oldPos.z);
            }
            saveBillboardPositions();
            player.tell('§a[Gambit Board] All billboards removed.');
            return 1;
          })
          .then(Commands.literal('combined').executes(function(ctx) { return removeBillboard(ctx, 'combined'); }))
          .then(Commands.literal('elim').executes(function(ctx) { return removeBillboard(ctx, 'elim'); }))
          .then(Commands.literal('tdm').executes(function(ctx) { return removeBillboard(ctx, 'tdm'); }))
          .then(Commands.literal('combined_session').executes(function(ctx) { return removeBillboard(ctx, 'combined_session'); }))
          .then(Commands.literal('elim_session').executes(function(ctx) { return removeBillboard(ctx, 'elim_session'); }))
          .then(Commands.literal('tdm_session').executes(function(ctx) { return removeBillboard(ctx, 'tdm_session'); }))
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

  // ── /gambitdb ─────────────────────────────────────────────
  // Diagnostics for the MySQL connection.
  //   /gambitdb status    — print connection state + row counts
  //   /gambitdb reconnect — close and re-open the connection
  //   /gambitdb testlog   — insert a dummy match row, then delete it
  event.register(
    Commands.literal('gambitdb')
      .requires(function(src) { return src.hasPermission(2); })

      // /gambitdb status
      .then(
        Commands.literal('status')
          .executes(function(ctx) {
            var player = ctx.source.player;
            var tell   = function(msg) { if (player && player.tell) player.tell(msg); else console.info(msg); };

            tell('§6§l── Gambit DB Status ──');

            if (typeof gambitDbIsEnabled !== 'function') {
              tell('§c gambit_db.js not loaded.');
              return 1;
            }

            tell('§7Driver loaded: ' + (_gambitDb.driverLoaded ? '§atrue' : '§cfalse'));
            tell('§7Enabled in config: ' + (_gambitDb.enabled ? '§atrue' : '§cfalse'));

            if (!gambitDbIsEnabled()) {
              tell('§cDB is disabled — check gambit_db_config.json and JDBC driver.');
              return 1;
            }

            var connected = gambitDbIsConnected();
            tell('§7Connection valid: ' + (connected ? '§atrue' : '§cfalse'));

            if (!connected) {
              tell('§eNot connected. Run §f/gambitdb reconnect§e to retry.');
              return 1;
            }

            // Row counts for all three tables
            var tables = ['gambit_match_history', 'gambit_match_players', 'gambit_player_stats'];
            for (var ti = 0; ti < tables.length; ti++) {
              try {
                var cStmt = _gambitDb.connection.createStatement();
                var cRs   = cStmt.executeQuery('SELECT COUNT(*) AS cnt FROM ' + tables[ti]);
                var cnt   = cRs.next() ? cRs.getLong('cnt') : -1;
                cRs.close(); cStmt.close();
                tell('§7' + tables[ti] + ': §f' + cnt + ' row(s)');
              } catch (e) {
                tell('§c' + tables[ti] + ': error — ' + e);
              }
            }

            tell('§6§l─────────────────────');
            return 1;
          })
      )

      // /gambitdb reconnect
      .then(
        Commands.literal('reconnect')
          .executes(function(ctx) {
            var player = ctx.source.player;
            var tell   = function(msg) { if (player && player.tell) player.tell(msg); else console.info(msg); };

            if (typeof gambitDbIsEnabled !== 'function' || !gambitDbIsEnabled()) {
              tell('§c[Gambit DB] DB is disabled — check config/driver first.');
              return 1;
            }

            gambitDbDisconnect();
            var ok = gambitDbConnect();
            if (ok) {
              tell('§a[Gambit DB] Reconnected successfully.');
            } else {
              tell('§c[Gambit DB] Reconnect failed — check server console for details.');
            }
            return 1;
          })
      )

      // /gambitdb testlog
      // Inserts a clearly-labelled dummy match and immediately deletes it.
      // On success you'll see "Test insert OK, match_id=X" in chat and console.
      .then(
        Commands.literal('testlog')
          .executes(function(ctx) {
            var player = ctx.source.player;
            var tell   = function(msg) { if (player && player.tell) player.tell(msg); else console.info(msg); };

            if (typeof gambitDbIsEnabled !== 'function' || !gambitDbIsEnabled()) {
              tell('§c[Gambit DB] DB is disabled.');
              return 1;
            }

            if (!gambitDbIsConnected() && !gambitDbConnect()) {
              tell('§c[Gambit DB] Cannot connect — check server console.');
              return 1;
            }

            // Insert a test row
            var testId = gambitDbInsertMatch('__db_test__', 0, 'test', 'red', 0);
            if (testId < 0) {
              tell('§c[Gambit DB] Test insert FAILED — check server console for the SQL error.');
              return 1;
            }

            // Immediately clean it up
            try {
              var delStmt = _gambitDb.connection.prepareStatement('DELETE FROM gambit_match_history WHERE match_id=?');
              delStmt.setInt(1, testId);
              delStmt.executeUpdate();
              delStmt.close();
              tell('§a[Gambit DB] Test insert OK (match_id=' + testId + ', cleaned up). DB writes are working.');
              console.info('[Gambit DB] testlog: insert + delete OK, match_id=' + testId);
            } catch (e) {
              tell('§e[Gambit DB] Insert succeeded (match_id=' + testId + ') but cleanup failed: ' + e);
            }
            return 1;
          })
      )

      // /gambitdb testdriver
      // Attempts Java.loadClass for both MySQL driver class names live and prints the actual exception.
      .then(
        Commands.literal('testdriver')
          .executes(function(ctx) {
            var player = ctx.source.player;
            var tell   = function(msg) { if (player && player.tell) player.tell(msg); else console.info(msg); };

            tell('§6§l── Gambit DB Driver Test ──');

            var classes = ['com.mysql.cj.jdbc.Driver', 'com.mysql.jdbc.Driver'];
            for (var ci = 0; ci < classes.length; ci++) {
              try {
                Java.loadClass(classes[ci]);
                tell('§a✔ ' + classes[ci] + ' loaded OK');
              } catch (e) {
                tell('§c✘ ' + classes[ci]);
                tell('§c  ' + e);
              }
            }

            tell('§6§l──────────────────────────');
            return 1;
          })
      )
  );

  // ── gambit_give_guide ─────────────────────────────────────
  // Called from gun:lobby/give_guide when a player lacks the field manual.
  // Builds the book in JS so pages are readable and \n escaping is handled
  // automatically by JSON.stringify.
  event.register(
    Commands.literal('gambit_give_guide')
      .executes(function(ctx) {
        // ctx.source.player is null when invoked via "execute as @a ... run function"
        // because the entity is set but KubeJS only fills .player for direct player invocations.
        // Fall back to ctx.source.entity, which is the @s entity set by execute.
        var player = ctx.source.player;
        if (!player) {
          try { player = ctx.source.entity; } catch (e) {}
        }
        if (!player || !player.give) return 1;

        // Build an SNBT single-quoted page string from a JS component array.
        // JSON.stringify converts JS newlines (\n char) to \\n (backslash + n) in the JSON.
        // However, Minecraft's SNBT parser treats \n in quoted strings as a real newline,
        // which would produce invalid JSON when the page is later parsed by the text component
        // system. Doubling all backslashes first ensures SNBT stores \n (backslash + n) as-is,
        // which JSON then correctly reads as a newline character.
        function page(components) {
          var json = JSON.stringify(components)
            .replace(/\\/g, '\\\\')   // double all backslashes so SNBT preserves them
            .replace(/'/g, "\\'");     // escape single quotes for SNBT single-quoted strings
          return "'" + json + "'";
        }

        var pages = [
          // ── Page 1: Cover ──
          page([
            { text: 'GAMBIT\nFIELD MANUAL\n', color: 'dark_blue',  bold: true },
            { text: 'Issued to all active operators.\n\n', color: 'dark_gray' },
            { text: 'Contents\n', color: 'dark_green', bold: true },
            { text: 'I.   Elimination\nII.  Team Deathmatch\nIII. Down System\nIV.  Deployment\nV.   Stats', color: 'black' }
          ]),

          // ── Page 2: Elimination ──
          page([
            { text: 'I. ELIMINATION\n', color: 'dark_red', bold: true },
            { text: '\nOne life per round.\nDead operators sit out until\nthe next round begins.\n\n', color: 'black' },
            { text: 'Objective\n', color: 'dark_green', bold: true },
            { text: 'Wipe the enemy team.\nLast team alive wins the round.\nFirst team to win enough\nrounds wins the match.', color: 'black' }
          ]),

          // ── Page 3: TDM ──
          page([
            { text: 'II. TEAM DEATHMATCH\n', color: 'dark_aqua', bold: true },
            { text: '\nOperators respawn on death.\nMatch ends when a team\nhits the kill target.\n\n', color: 'black' },
            { text: 'Objective\n', color: 'dark_green', bold: true },
            { text: 'Reach the kill target before\nthe enemy team.\n\nKill streaks give personal\nloot at 4, 8, and 12 kills.', color: 'black' }
          ]),

          // ── Page 4: Down system ──
          page([
            { text: 'III. DOWN SYSTEM\n', color: 'dark_red', bold: true },
            { text: '\nLethal hits down you instead\nof killing you outright.\nA downed operator can be\nrevived by a teammate\nwith a syringe.\n\nToo many downs in one life\nand the next hit is a real\nkill. No revive possible.', color: 'black' }
          ]),

          // ── Page 5: Deployment ──
          page([
            { text: 'IV. DEPLOYMENT\n', color: 'dark_green', bold: true },
            { text: '\n', color: 'black' },
            { text: '/play\n',      color: 'dark_blue' },
            { text: 'Join the match queue.\n\n', color: 'black' },
            { text: '/spectate\n',  color: 'dark_blue' },
            { text: 'Stand down and spectate.\n\n', color: 'black' },
            { text: '/queue\n',     color: 'dark_blue' },
            { text: 'Check your current status.', color: 'black' }
          ]),

          // ── Page 6: Stats — personal commands ──
          page([
            { text: 'V. STATS\n', color: 'dark_purple', bold: true },
            { text: '\n', color: 'black' },
            { text: '/stats\n',         color: 'dark_blue' },
            { text: 'Show all stat commands.\n\n', color: 'black' },
            { text: '/stats session\n', color: 'dark_blue' },
            { text: 'Your stats for today.\n\n', color: 'black' },
            { text: '/stats global\n',  color: 'dark_blue' },
            { text: 'Your all-time stats.\n\n', color: 'black' },
            { text: '/stats history\n', color: 'dark_blue' },
            { text: 'Your last 5 matches.', color: 'black' }
          ]),

          // ── Page 7: Stats — viewing others ──
          page([
            { text: 'V. STATS (cont.)\n', color: 'dark_purple', bold: true },
            { text: '\nAdd a player name to any\npersonal command to view\nanother operator:\n\n', color: 'black' },
            { text: '/stats session <name>\n', color: 'dark_blue' },
            { text: '/stats global <name>\n',  color: 'dark_blue' },
            { text: '/stats history <name>\n\n', color: 'dark_blue' },
            { text: 'Works for any player,\neven if offline.', color: 'black' }
          ]),

          // ── Page 8: Stats — leaderboards ──
          page([
            { text: 'V. STATS (cont.)\n', color: 'dark_purple', bold: true },
            { text: '\n', color: 'black' },
            { text: 'LEADERBOARDS\n', color: 'dark_green', bold: true },
            { text: '\n', color: 'black' },
            { text: '/stats elim\n',     color: 'dark_blue' },
            { text: 'All-time elim board.\n\n', color: 'black' },
            { text: '/stats tdm\n',      color: 'dark_blue' },
            { text: 'All-time TDM board.\n\n', color: 'black' },
            { text: '/stats combined\n', color: 'dark_blue' },
            { text: 'All-time combined board.\n\n', color: 'black' },
            { text: 'Append ', color: 'black' },
            { text: 'global', color: 'dark_blue' },
            { text: ' or ', color: 'black' },
            { text: 'session', color: 'dark_blue' },
            { text: ' after any for scoped results.', color: 'black' }
          ]),

          // ── Page 9: Stats — top 10 & metrics ──
          page([
            { text: 'V. STATS (cont.)\n', color: 'dark_purple', bold: true },
            { text: '\n', color: 'black' },
            { text: 'TOP 10\n', color: 'dark_green', bold: true },
            { text: '\n', color: 'black' },
            { text: '/stats top <metric>\n', color: 'dark_blue' },
            { text: 'Global top 10.\n\n', color: 'black' },
            { text: '/stats top session <metric>\n', color: 'dark_blue' },
            { text: "Today's top 10.\n\n", color: 'black' },
            { text: 'Metrics\n', color: 'dark_green', bold: true },
            { text: 'kd  winpct  kills\ndeaths  damage  wins\nmatches  mvps  dpl\nassists  streak  revives', color: 'black' }
          ])
        ];

        var displayName = '{"text":"Gambit Field Manual","color":"gold","italic":false,"bold":true}';
        var nbt = '{title:"Gambit Field Manual",author:"Gambit Command",pages:[' + pages.join(',') + '],display:{Name:\'' + displayName + '\'}}';
        // Use player.give() directly — avoids an extra command-string parsing layer
        // that could mis-handle escape sequences in the NBT.
        player.give(Item.of('minecraft:written_book', nbt));
        return 1;
      })
  );
});
