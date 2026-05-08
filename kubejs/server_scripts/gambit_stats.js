// ============================================================
// Gambit Stats Store
//
// In-memory stats store, disk/DB persistence, score formulas,
// leaderboard sorting, and the shared stat card display function.
//
// Depends on: gambit_db.js (gambitDb* functions, loads at g-d before g-s)
//
// Globals shared with other files: stats, roundStats, statsDirty
// ============================================================

var PD_DAMAGE          = 'gambit_stats_damage';
var PD_KILLS           = 'gambit_stats_kills';
var PD_DEATHS          = 'gambit_stats_deaths';
var PD_MATCHES         = 'gambit_stats_matches';
var PD_WINS            = 'gambit_stats_wins';
var PD_MVPS            = 'gambit_stats_mvps';
var PD_DOWNS           = 'gambit_downs';
var PD_ASSISTS         = 'gambit_stats_assists';
var PD_LONGEST_STREAK  = 'gambit_stats_longest_streak';
var PD_REVIVES         = 'gambit_stats_revives';
var PD_ELIM_SCORE      = 'gambit_stats_elim_score';
var PD_ELIM_MATCHES    = 'gambit_stats_elim_matches';
var PD_TDM_SCORE       = 'gambit_stats_tdm_score';
var PD_TDM_MATCHES     = 'gambit_stats_tdm_matches';

var LEADERBOARD_MIN_MATCHES_MODE = 3;
var LEADERBOARD_MIN_MATCHES      = 10;
var STATS_FLUSH_INTERVAL_TICKS   = 200;
var STATS_FILE_PATH              = 'kubejs/data/gambit_stats.json';

// ── In-memory stat store ─────────────────────────────────────
var stats     = {};
var roundStats = {};
var statsDirty = false;
var statsSaveTicker = 0;

// ── Stat tracking gate ───────────────────────────────────────
// When false, no lifetime stats are written or persisted.
// roundStats still accumulates so postgame displays work.
// Toggled by /gambitstats tracking on|off and by tournament mode.
var statsTrackingEnabled = true;

// ── Entry helpers ────────────────────────────────────────────
function makeDefaultEntry() {
  return { damage: 0.0, kills: 0, deaths: 0, matches: 0, wins: 0, mvps: 0, assists: 0, longest_streak: 0, revives: 0,
           elim_score_total: 0.0, elim_matches: 0, tdm_score_total: 0.0, tdm_matches: 0 };
}

function normalizeEntry(raw) {
  var base = makeDefaultEntry();
  if (!raw) return base;

  base.damage         = Number(raw.damage || 0.0);
  base.kills          = Math.floor(Number(raw.kills || 0));
  base.deaths         = Math.floor(Number(raw.deaths || 0));
  base.matches        = Math.floor(Number(raw.matches || 0));
  base.wins           = Math.floor(Number(raw.wins || 0));
  base.mvps           = Math.floor(Number(raw.mvps || 0));
  base.assists        = Math.floor(Number(raw.assists || 0));
  base.longest_streak = Math.floor(Number(raw.longest_streak || 0));
  base.revives        = Math.floor(Number(raw.revives || 0));

  if (Number.isNaN(base.damage))         base.damage = 0.0;
  if (Number.isNaN(base.kills))          base.kills = 0;
  if (Number.isNaN(base.deaths))         base.deaths = 0;
  if (Number.isNaN(base.matches))        base.matches = 0;
  if (Number.isNaN(base.wins))           base.wins = 0;
  if (Number.isNaN(base.mvps))           base.mvps = 0;
  if (Number.isNaN(base.assists))        base.assists = 0;
  if (Number.isNaN(base.longest_streak)) base.longest_streak = 0;
  if (Number.isNaN(base.revives))        base.revives = 0;

  base.elim_score_total = Number(raw.elim_score_total || 0.0);
  base.elim_matches     = Math.floor(Number(raw.elim_matches || 0));
  base.tdm_score_total  = Number(raw.tdm_score_total || 0.0);
  base.tdm_matches      = Math.floor(Number(raw.tdm_matches || 0));
  if (Number.isNaN(base.elim_score_total)) base.elim_score_total = 0.0;
  if (Number.isNaN(base.elim_matches))     base.elim_matches = 0;
  if (Number.isNaN(base.tdm_score_total))  base.tdm_score_total = 0.0;
  if (Number.isNaN(base.tdm_matches))      base.tdm_matches = 0;

  return base;
}

function markStatsDirty() {
  statsDirty = true;
}

function getEntry(playerName) {
  if (!stats[playerName]) stats[playerName] = makeDefaultEntry();
  return stats[playerName];
}

function getRoundEntry(playerName) {
  if (!roundStats[playerName]) roundStats[playerName] = { damage: 0.0, kills: 0, deaths: 0, assists: 0 };
  return roundStats[playerName];
}

function clearRoundStats() {
  roundStats = {};
}

// ── NBT tag I/O ──────────────────────────────────────────────
function readTagNumber(tag, key, fallback) {
  if (!tag) return fallback;
  try {
    if (tag.contains && tag.contains(key)) {
      if (tag.getDouble) return Number(tag.getDouble(key));
      if (tag.getFloat)  return Number(tag.getFloat(key));
      if (tag.getInt)    return Number(tag.getInt(key));
    }
  } catch (e) {}
  try {
    if (tag[key] !== undefined) return Number(tag[key]);
  } catch (e) {}
  return fallback;
}

function writeTagNumber(tag, key, value, integerOnly) {
  if (!tag) return;
  var n = Number(value);
  if (Number.isNaN(n)) n = 0;
  try {
    if (integerOnly && tag.putInt)    { tag.putInt(key, Math.floor(n)); return; }
    if (!integerOnly && tag.putDouble) { tag.putDouble(key, n); return; }
  } catch (e) {}
  try { tag[key] = integerOnly ? Math.floor(n) : n; } catch (e) {}
}

// ── Player ↔ NBT sync ────────────────────────────────────────
function loadEntryFromPlayer(player) {
  if (!player) return;
  var name = player.name && player.name.string ? player.name.string : null;
  if (!name) return;
  var tag   = player.persistentData;
  var entry = getEntry(name);
  entry.damage         = readTagNumber(tag, PD_DAMAGE, 0.0);
  entry.kills          = Math.floor(readTagNumber(tag, PD_KILLS, 0));
  entry.deaths         = Math.floor(readTagNumber(tag, PD_DEATHS, 0));
  entry.matches        = Math.floor(readTagNumber(tag, PD_MATCHES, 0));
  entry.wins           = Math.floor(readTagNumber(tag, PD_WINS, 0));
  entry.mvps           = Math.floor(readTagNumber(tag, PD_MVPS, 0));
  entry.assists        = Math.floor(readTagNumber(tag, PD_ASSISTS, 0));
  entry.longest_streak = Math.floor(readTagNumber(tag, PD_LONGEST_STREAK, 0));
  entry.revives        = Math.floor(readTagNumber(tag, PD_REVIVES, 0));
  entry.elim_score_total = readTagNumber(tag, PD_ELIM_SCORE, 0.0);
  entry.elim_matches     = Math.floor(readTagNumber(tag, PD_ELIM_MATCHES, 0));
  entry.tdm_score_total  = readTagNumber(tag, PD_TDM_SCORE, 0.0);
  entry.tdm_matches      = Math.floor(readTagNumber(tag, PD_TDM_MATCHES, 0));
}

function saveEntryToPlayer(player) {
  if (!player) return;
  var name = player.name && player.name.string ? player.name.string : null;
  if (!name) return;
  var tag   = player.persistentData;
  var entry = getEntry(name);
  writeTagNumber(tag, PD_DAMAGE,         entry.damage,                false);
  writeTagNumber(tag, PD_KILLS,          entry.kills,                 true);
  writeTagNumber(tag, PD_DEATHS,         entry.deaths,                true);
  writeTagNumber(tag, PD_MATCHES,        entry.matches,               true);
  writeTagNumber(tag, PD_WINS,           entry.wins,                  true);
  writeTagNumber(tag, PD_MVPS,           entry.mvps,                  true);
  writeTagNumber(tag, PD_ASSISTS,        entry.assists || 0,          true);
  writeTagNumber(tag, PD_LONGEST_STREAK, entry.longest_streak || 0,   true);
  writeTagNumber(tag, PD_REVIVES,        entry.revives || 0,          true);
  writeTagNumber(tag, PD_ELIM_SCORE,     entry.elim_score_total || 0.0, false);
  writeTagNumber(tag, PD_ELIM_MATCHES,   entry.elim_matches || 0,     true);
  writeTagNumber(tag, PD_TDM_SCORE,      entry.tdm_score_total || 0.0, false);
  writeTagNumber(tag, PD_TDM_MATCHES,    entry.tdm_matches || 0,      true);
  markStatsDirty();
}

function clearEntryForPlayer(player) {
  if (!player) return;
  var name = player.name && player.name.string ? player.name.string : null;
  if (!name) return;
  stats[name] = makeDefaultEntry();
  saveEntryToPlayer(player);
}

function loadOnlinePlayersIntoStats(server) {
  if (!server || !server.players) return;
  server.players.forEach(function(p) { loadEntryFromPlayer(p); });
}

// ── Score formulas ────────────────────────────────────────────
function getKD(e) {
  if (!e) return 0;
  return e.kills / Math.max(1, e.deaths);
}

function getWinPct(e) {
  if (!e) return 0;
  return (e.wins * 100) / Math.max(1, e.matches);
}

function getAvgDamagePerLife(e) {
  if (!e) return 0;
  return e.damage / Math.max(1, e.deaths);
}

function getCompositeScore(e) {
  if (!e) return 0;
  var kd           = getKD(e);
  var winRate      = getWinPct(e) / 100;
  var killsPerMatch = e.kills / Math.max(1, e.matches);
  var mvpsPerMatch  = (e.mvps || 0) / Math.max(1, e.matches);
  return (kd * 0.4) + (winRate * 0.3) + (killsPerMatch * 0.2) + (mvpsPerMatch * 0.1);
}

function getElimAvgScore(e) {
  if (!e || (e.elim_matches || 0) === 0) return 0;
  return e.elim_score_total / e.elim_matches;
}

function getTdmAvgScore(e) {
  if (!e || (e.tdm_matches || 0) === 0) return 0;
  return e.tdm_score_total / e.tdm_matches;
}

function getCombinedAvgScore(e) {
  if (!e) return 0;
  var totalMatches = (e.elim_matches || 0) + (e.tdm_matches || 0);
  if (totalMatches === 0) return 0;
  return ((e.elim_score_total || 0) + (e.tdm_score_total || 0)) / totalMatches;
}

// Score = (0.5 * damage) + (100 * kills) + (50 * assists) + (300 if MVP)
function calcElimMatchScore(rs, isMvp) {
  return (0.5 * (rs.damage || 0)) + (100 * (rs.kills || 0)) + (50 * (rs.assists || 0)) + (isMvp ? 300 : 0);
}

// Score = (0.25 * damage) + (100 * kills) + (50 * assists) - (100 * deaths) + (500 if MVP)
function calcTdmMatchScore(rs, isMvp) {
  return (0.25 * (rs.damage || 0)) + (100 * (rs.kills || 0)) + (50 * (rs.assists || 0)) - (100 * (rs.deaths || 0)) + (isMvp ? 500 : 0);
}

// ── Lookup helpers ────────────────────────────────────────────
function getOnlinePlayerByName(server, playerName) {
  if (!server || !server.players || !playerName) return null;
  var lower = String(playerName).toLowerCase();
  for (var i = 0; i < server.players.length; i++) {
    var p = server.players[i];
    var n = p && p.name && p.name.string ? String(p.name.string).toLowerCase() : '';
    if (n === lower) return p;
  }
  return null;
}

function getExistingStatName(name) {
  if (!name) return null;
  if (stats[name]) return name;
  var wanted = String(name).toLowerCase();
  var keys = Object.keys(stats);
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i]).toLowerCase() === wanted) return keys[i];
  }
  return null;
}

// ── Match result application (addmatch / addwin) ──────────────
function applyMatchResult(server, targetArg, addMatch, addWin) {
  if (!server || !targetArg) return { count: 0, mode: null };

  // Respect stat tracking gate — this is called automatically from win mcfunctions
  // (stats/match_all, stats/win_red, stats/win_blue) as well as by OP commands.
  if (typeof statsTrackingEnabled !== 'undefined' && !statsTrackingEnabled) return { count: 0, mode: null };

  var target = String(targetArg).toLowerCase();
  var mode = null;

  if (target === 'red' || target === 'blue' || target === 'all') {
    mode = target;
    var count = 0;
    server.players.forEach(function(p) {
      var onRed  = hasTagSafe(p, 'Red');
      var onBlue = hasTagSafe(p, 'Blue');
      if (target === 'red'  && !onRed)             return;
      if (target === 'blue' && !onBlue)            return;
      if (target === 'all'  && !(onRed || onBlue)) return;
      loadEntryFromPlayer(p);
      var e = getEntry(p.name.string);
      getRoundEntry(p.name.string);
      if (addMatch) e.matches += 1;
      if (addWin)   e.wins   += 1;
      saveEntryToPlayer(p);
      count += 1;
    });
    return { count: count, mode: mode };
  }

  var targetPlayer = getOnlinePlayerByName(server, targetArg);
  if (!targetPlayer) return { count: 0, mode: null };
  loadEntryFromPlayer(targetPlayer);
  var entry = getEntry(targetPlayer.name.string);
  getRoundEntry(targetPlayer.name.string);
  if (addMatch) entry.matches += 1;
  if (addWin)   entry.wins   += 1;
  saveEntryToPlayer(targetPlayer);
  return { count: 1, mode: 'player', playerName: targetPlayer.name.string, entry: entry };
}

// ── Metric helpers ────────────────────────────────────────────
function metricLabel(metric) {
  if (metric === 'kd')      return 'KD';
  if (metric === 'winpct')  return 'Win %';
  if (metric === 'damage')  return 'Damage';
  if (metric === 'kills')   return 'Kills';
  if (metric === 'deaths')  return 'Deaths';
  if (metric === 'wins')    return 'Wins';
  if (metric === 'matches') return 'Matches';
  if (metric === 'mvps')    return 'MVPs';
  if (metric === 'dpl')     return 'Damage per Life';
  if (metric === 'assists') return 'Assists';
  if (metric === 'streak')  return 'Longest Streak';
  if (metric === 'revives') return 'Revives';
  return null;
}

function metricValue(e, metric) {
  if (!e) return 0;
  if (metric === 'kd')      return getKD(e);
  if (metric === 'winpct')  return getWinPct(e);
  if (metric === 'damage')  return e.damage;
  if (metric === 'kills')   return e.kills;
  if (metric === 'deaths')  return e.deaths;
  if (metric === 'wins')    return e.wins;
  if (metric === 'matches') return e.matches;
  if (metric === 'mvps')    return e.mvps || 0;
  if (metric === 'dpl')     return getAvgDamagePerLife(e);
  if (metric === 'assists') return e.assists || 0;
  if (metric === 'streak')  return e.longest_streak || 0;
  if (metric === 'revives') return e.revives || 0;
  return NaN;
}

function formatMetricValue(value, metric) {
  if (metric === 'kd')     return Number(value).toFixed(2);
  if (metric === 'winpct') return Number(value).toFixed(1) + '%';
  if (metric === 'damage') return Number(value).toFixed(1);
  if (metric === 'dpl')    return Number(value).toFixed(1);
  return String(Math.floor(Number(value)));
}

// ── Sorted entry getters ──────────────────────────────────────
function getSortedEntriesByMetric(metric) {
  var keys = Object.keys(stats);
  var arr  = [];
  for (var i = 0; i < keys.length; i++) {
    if ((stats[keys[i]].matches || 0) >= LEADERBOARD_MIN_MATCHES) {
      arr.push([keys[i], stats[keys[i]]]);
    }
  }
  arr.sort(function(a, b) {
    var primary = metricValue(b[1], metric) - metricValue(a[1], metric);
    if (primary !== 0) return primary;
    var kdDiff = getKD(b[1]) - getKD(a[1]);
    if (kdDiff !== 0) return kdDiff;
    return b[1].damage - a[1].damage;
  });
  return arr;
}

function getSortedRoundEntries(metric) {
  var useMetric = metric || 'kills';
  var keys = Object.keys(roundStats);
  var arr  = [];
  for (var i = 0; i < keys.length; i++) {
    arr.push([keys[i], roundStats[keys[i]]]);
  }
  arr.sort(function(a, b) {
    if (useMetric === 'damage') {
      var primary = b[1].damage - a[1].damage;
      return primary !== 0 ? primary : b[1].kills - a[1].kills;
    }
    var primary = b[1].kills - a[1].kills;
    return primary !== 0 ? primary : b[1].damage - a[1].damage;
  });
  return arr;
}

function getSortedEntries() {
  var keys = Object.keys(stats);
  var arr  = [];
  for (var i = 0; i < keys.length; i++) {
    var _e = stats[keys[i]];
    if ((_e.elim_matches || 0) >= LEADERBOARD_MIN_MATCHES_MODE && (_e.tdm_matches || 0) >= LEADERBOARD_MIN_MATCHES_MODE) {
      arr.push([keys[i], _e]);
    }
  }
  arr.sort(function(a, b) {
    var scoreDiff = getCombinedAvgScore(b[1]) - getCombinedAvgScore(a[1]);
    if (scoreDiff !== 0) return scoreDiff;
    var kdDiff = getKD(b[1]) - getKD(a[1]);
    if (kdDiff !== 0) return kdDiff;
    return getAvgDamagePerLife(b[1]) - getAvgDamagePerLife(a[1]);
  });
  return arr;
}

function getSortedEntriesByElimScore() {
  var keys = Object.keys(stats);
  var arr  = [];
  for (var i = 0; i < keys.length; i++) {
    if ((stats[keys[i]].elim_matches || 0) >= LEADERBOARD_MIN_MATCHES_MODE) {
      arr.push([keys[i], stats[keys[i]]]);
    }
  }
  arr.sort(function(a, b) { return getElimAvgScore(b[1]) - getElimAvgScore(a[1]); });
  return arr;
}

function getSortedEntriesByTdmScore() {
  var keys = Object.keys(stats);
  var arr  = [];
  for (var i = 0; i < keys.length; i++) {
    if ((stats[keys[i]].tdm_matches || 0) >= LEADERBOARD_MIN_MATCHES_MODE) {
      arr.push([keys[i], stats[keys[i]]]);
    }
  }
  arr.sort(function(a, b) { return getTdmAvgScore(b[1]) - getTdmAvgScore(a[1]); });
  return arr;
}

function statsSize() {
  return Object.keys(stats).length;
}

// ── String formatters ─────────────────────────────────────────
function formatEntry(name, e) {
  return '§e' + name + '§r — §bKD: §f' + getKD(e).toFixed(2) + '§r | §aDPL: §f' + getAvgDamagePerLife(e).toFixed(1);
}

function formatRoundEntryForKills(name, e) {
  return '§e' + name + '§r — §4Kills: §f' + e.kills;
}

function formatRoundEntryForDamage(name, e) {
  return '§e' + name + '§r — §cDamage: §f' + e.damage.toFixed(1);
}

function tellAll(server, msg) {
  if (!server || !server.players) return;
  server.players.forEach(function(p) { p.tell(msg); });
}

// ── MVP helpers ───────────────────────────────────────────────
function getRoundMvpScore(e) {
  if (!e) return 0;
  return (e.kills * 100.0) + e.damage;
}

function getRoundMvp() {
  var keys = Object.keys(roundStats);
  if (keys.length === 0) return null;
  var bestName  = keys[0];
  var bestEntry = roundStats[bestName];
  var bestScore = getRoundMvpScore(bestEntry);
  for (var i = 1; i < keys.length; i++) {
    var name  = keys[i];
    var entry = roundStats[name];
    var score = getRoundMvpScore(entry);
    if (score > bestScore) { bestName = name; bestEntry = entry; bestScore = score; continue; }
    if (score === bestScore) {
      if (entry.kills > bestEntry.kills || (entry.kills === bestEntry.kills && entry.damage > bestEntry.damage)) {
        bestName = name; bestEntry = entry; bestScore = score;
      }
    }
  }
  return { name: bestName, entry: bestEntry, score: bestScore };
}

function awardMvpToLifetime(server, playerName) {
  if (!playerName) return playerName;
  var targetPlayer = getOnlinePlayerByName(server, playerName);
  if (targetPlayer) {
    loadEntryFromPlayer(targetPlayer);
    var onlineEntry = getEntry(targetPlayer.name.string);
    onlineEntry.mvps = (onlineEntry.mvps || 0) + 1;
    saveEntryToPlayer(targetPlayer);
    return targetPlayer.name.string;
  }
  var existing = getExistingStatName(playerName);
  var resolved = existing || playerName;
  var entry    = getEntry(resolved);
  entry.mvps   = (entry.mvps || 0) + 1;
  markStatsDirty();
  return resolved;
}

function broadcastPostGameScoreboard(server) {
  if (!server) return 0;

  // In tournament mode, use the compact per-player summary instead.
  if (typeof tournamentMode !== 'undefined' && tournamentMode) {
    if (typeof broadcastTournamentPostGame === 'function') broadcastTournamentPostGame(server);
    clearRoundStats();
    return 1;
  }

  var byKills  = getSortedRoundEntries('kills');
  if (byKills.length === 0) { tellAll(server, '§7[Gambit Stats] No stats recorded yet.'); return 0; }
  var byDamage     = getSortedRoundEntries('damage');
  var maxRowsKills  = Math.min(5, byKills.length);
  var maxRowsDamage = Math.min(5, byDamage.length);
  var mvp = getRoundMvp();

  tellAll(server, '§6§l=== Post-Game Top 5: Kills ===');
  for (var i = 0; i < maxRowsKills; i++) {
    tellAll(server, '§7' + (i + 1) + '. ' + formatRoundEntryForKills(byKills[i][0], byKills[i][1]));
  }
  tellAll(server, '§8§m-----------------------------------');
  tellAll(server, '§6§l=== Post-Game Top 5: Damage ===');
  for (var j = 0; j < maxRowsDamage; j++) {
    tellAll(server, '§7' + (j + 1) + '. ' + formatRoundEntryForDamage(byDamage[j][0], byDamage[j][1]));
  }
  tellAll(server, '§8§m-----------------------------------');
  if (mvp) {
    var awardedName = awardMvpToLifetime(server, mvp.name);
    tellAll(server, '§a§lMVP: §e' + awardedName + '§r §7(' + mvp.entry.kills + ' Kills, ' + mvp.entry.damage.toFixed(1) + ' Damage)');
  }
  tellAll(server, '§6§l===================================');
  clearRoundStats();
  return Math.max(maxRowsKills, maxRowsDamage);
}

// ── Stat card display (Item 2: single source of truth) ───────
// Used by /gambitstats me, /gambitstats player, and legacy alias.
function showStatsCard(viewer, name, e) {
  viewer.tell('§6§l── Gambit Stats: ' + name + ' ──');
  viewer.tell('  §cDamage per Life: §f' + getAvgDamagePerLife(e).toFixed(2));
  viewer.tell('  §4Kills: §f'           + e.kills);
  viewer.tell('  §8Deaths: §f'          + e.deaths);
  viewer.tell('  §bKD: §f'              + getKD(e).toFixed(2));
  viewer.tell('  §eAssists: §f'         + (e.assists || 0));
  viewer.tell('  §dLongest Streak: §f'  + (e.longest_streak || 0));
  viewer.tell('  §aRevives: §f'         + (e.revives || 0));
  viewer.tell('  §6Matches: §f'         + e.matches);
  viewer.tell('  §aWins: §f'            + e.wins);
  viewer.tell('  §dWin %: §f'           + getWinPct(e).toFixed(1) + '%');
  viewer.tell('  §6MVPs: §f'            + (e.mvps || 0));
  viewer.tell('§8§m----------------------------');
  viewer.tell('  §2Elim Score/Match: §f'    + getElimAvgScore(e).toFixed(0)    + ' §8(' + (e.elim_matches || 0) + ' matches)');
  viewer.tell('  §2TDM Score/Match:  §f'    + getTdmAvgScore(e).toFixed(0)     + ' §8(' + (e.tdm_matches  || 0) + ' matches)');
  viewer.tell('  §aCombined Score/Match: §f' + getCombinedAvgScore(e).toFixed(0) + ' §8(' + ((e.elim_matches || 0) + (e.tdm_matches || 0)) + ' total)');
  viewer.tell('§6§l──────────────────────');
}

// ── Persistence ───────────────────────────────────────────────
function loadStatsFromDisk() {
  // Try MySQL first when enabled
  if (typeof gambitDbIsEnabled === 'function' && gambitDbIsEnabled()) {
    var dbStats = gambitDbLoadAllStats();
    if (dbStats !== null) {
      var dbKeys = Object.keys(dbStats);
      if (dbKeys.length > 0) {
        var dbLoaded = {};
        for (var di = 0; di < dbKeys.length; di++) {
          dbLoaded[dbKeys[di]] = normalizeEntry(dbStats[dbKeys[di]]);
        }
        stats = dbLoaded;
        console.info('[Gambit Stats] Loaded ' + dbKeys.length + ' player(s) from MySQL.');
        return true;
      }
    }
  }

  // Fall back to JSON
  try {
    var parsed = JsonIO.read(STATS_FILE_PATH);
    if (!parsed) return false;
    var loaded = {};
    var keys   = Object.keys(parsed);
    for (var i = 0; i < keys.length; i++) {
      loaded[keys[i]] = normalizeEntry(parsed[keys[i]]);
    }
    stats = loaded;
    // Auto-migrate existing JSON data into MySQL on first run
    if (typeof gambitDbIsEnabled === 'function' && gambitDbIsEnabled() && keys.length > 0) {
      console.info('[Gambit Stats] Migrating ' + keys.length + ' player(s) from JSON to MySQL...');
      gambitDbSaveAllStats(stats);
    }
    return true;
  } catch (e) {
    console.error('[Gambit Stats] Failed to load stats file: ' + e);
    return false;
  }
}

function saveStatsToDisk() {
  try {
    // Re-read the existing file and merge any entries that are on disk but not in memory
    // before writing. This ensures a partial in-memory state never silently drops players.
    var existing = null;
    try { existing = JsonIO.read(STATS_FILE_PATH); } catch (readErr) {}
    if (existing) {
      var diskKeys = Object.keys(existing);
      for (var i = 0; i < diskKeys.length; i++) {
        if (!stats[diskKeys[i]]) stats[diskKeys[i]] = normalizeEntry(existing[diskKeys[i]]);
      }
      // Rolling backup of last known-good file
      try { JsonIO.write(STATS_FILE_PATH + '.bak', existing); } catch (bakErr) {}
    }

    // Persist to MySQL when enabled
    if (typeof gambitDbIsEnabled === 'function' && gambitDbIsEnabled()) {
      gambitDbSaveAllStats(stats);
    }

    // Always write JSON as a local backup
    JsonIO.write(STATS_FILE_PATH, stats);
    statsDirty    = false;
    statsSaveTicker = 0;
  } catch (e) {
    console.error('[Gambit Stats] Failed to save stats: ' + e);
  }
}

// Load stats immediately on script evaluation (runs on both server start and /reload)
loadStatsFromDisk();
