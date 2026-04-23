//  Commands:
//    /gambitstats                         — show leaderboard (any player)
//    /gambitstats me                      — show your stats (any player)
//    /gambitstats player <playerName>     — inspect one player (any player)
//    /gambitstats top <metric>            — show top players by metric (any player)
//      metrics: kd, winpct, damage, kills, deaths, wins, matches, mvps, dpl, assists, streak, revives
//    /gambitstats postgame                — broadcast post-game top 5 kills, top 5 damage, and MVP (ops/functions)
//    /gambitstats <playerName>            — inspect one player (ops only, legacy alias)
//
//    /gambitstats addmatch <player|red|blue|all> — add 1 match (ops only)
//    /gambitstats addwin <player|red|blue|all>   — add 1 win (ops only)
//
//    /gambitstats reset <playerName>      — reset one player's stats (ops only, offline-safe)
//    /gambitstats reset all               — reset all players' stats (ops only)
//    /gambitstats reset                   — shows reset usage/help (ops only)
//
//    /gambitboard setup                   — spawn a text_display billboard at your feet (ops only)
//    /gambitboard remove                  — kill the nearest billboard text_display (ops only)
//    /gambitboard refresh                 — force-update the billboard now (ops only)
//
//    gambit_log_match <red|blue|tie>      — log match result (called from win mcfunctions)
// ============================================================

var StringArgumentType = Java.loadClass('com.mojang.brigadier.arguments.StringArgumentType');

var PD_DAMAGE = 'gambit_stats_damage';
var PD_KILLS = 'gambit_stats_kills';
var PD_DEATHS = 'gambit_stats_deaths';
var PD_MATCHES = 'gambit_stats_matches';
var PD_WINS = 'gambit_stats_wins';
var PD_MVPS = 'gambit_stats_mvps';
var PD_DOWNS = 'gambit_downs';
var PD_ASSISTS = 'gambit_stats_assists';
var PD_LONGEST_STREAK = 'gambit_stats_longest_streak';
var PD_REVIVES = 'gambit_stats_revives';
var DOWNS_CONFIG_FILE = 'kubejs/data/gambit_downs_config.json';
var LAST_TACZ_ATTACK_TTL_MS = 15000;
var ATTACKER_CACHE_CLEANUP_INTERVAL_TICKS = 200;
var STATS_FLUSH_INTERVAL_TICKS = 200;
var STATS_FILE_PATH = 'kubejs/data/gambit_stats.json';
var BILLBOARD_TAG = 'gambit_billboard';
var BILLBOARD_UPDATE_INTERVAL_TICKS = 100;
var BILLBOARD_POS_FILE = 'kubejs/data/gambit_billboard_pos.json';
var LEADERBOARD_MIN_MATCHES = 10;

// ── In-memory stat store ─────────────────────────────────────
var stats = {};
var roundStats = {};
var recentPlayerAttackers = {};
var currentStreaks = {}; // { playerName: number } — reset on death, not persisted
var downerNames = {}; // { deadPlayerName: downerName } — most recent downer, used for bleed-out kill credit
var firstDownerNames = {}; // { deadPlayerName: downerName } — first downer this life, never overwritten, used for assist credit
var pendingExecutions = []; // { victimName, killerName } — deferred to next tick to avoid hurt-event re-entrancy
var syringeCounts = {};    // { playerName: syringe count last poll } — for revive tracking
var recentlyDowned = {};   // { playerName: expiresAtMs } — windows during which a syringe decrease counts as a revive
var reviveCheckTicker = 0;
var attackerCacheCleanupTicker = 0;
var statsSaveTicker = 0;
var statsDirty = false;
var billboardUpdateTicker = 0;
var billboardPos = null; // {x, y, z} — persisted spawn position of the billboard entity

// ── Down limit config ────────────────────────────────────────
// max_downs: how many times a player can be downed before the next hit kills instantly.
// bypass_source_types: getMsgId() strings that skip tracking entirely (fall, fire, etc.)
var downsConfig = { enabled: true, max_downs: 2, bypass_source_types: [] };

function loadDownsConfig() {
  try {
    var raw = JsonIO.read(DOWNS_CONFIG_FILE);
    if (!raw) return;
    if (typeof raw.enabled === 'boolean') downsConfig.enabled = raw.enabled;
    if (typeof raw.max_downs === 'number') downsConfig.max_downs = Math.max(1, Math.floor(raw.max_downs));
    if (raw.bypass_source_types) {
      var list = [];
      for (var i = 0; i < raw.bypass_source_types.length; i++) {
        list.push(String(raw.bypass_source_types[i]));
      }
      downsConfig.bypass_source_types = list;
    }
  } catch (e) {
    console.error('[Gambit Downs] Failed to load downs config: ' + e);
  }
}

// Load stats from disk immediately on script evaluation.
// This runs on both server start AND /reload, ensuring offline players
// are always present in the leaderboard after a script reload.
loadStatsFromDisk();
loadBillboardPos();
loadDownsConfig();

function makeDefaultEntry() {
  return { damage: 0.0, kills: 0, deaths: 0, matches: 0, wins: 0, mvps: 0, assists: 0, longest_streak: 0, revives: 0 };
}

function normalizeEntry(raw) {
  var base = makeDefaultEntry();
  if (!raw) return base;

  base.damage = Number(raw.damage || 0.0);
  base.kills = Math.floor(Number(raw.kills || 0));
  base.deaths = Math.floor(Number(raw.deaths || 0));
  base.matches = Math.floor(Number(raw.matches || 0));
  base.wins = Math.floor(Number(raw.wins || 0));
  base.mvps = Math.floor(Number(raw.mvps || 0));
  base.assists = Math.floor(Number(raw.assists || 0));
  base.longest_streak = Math.floor(Number(raw.longest_streak || 0));
  base.revives = Math.floor(Number(raw.revives || 0));

  if (Number.isNaN(base.damage)) base.damage = 0.0;
  if (Number.isNaN(base.kills)) base.kills = 0;
  if (Number.isNaN(base.deaths)) base.deaths = 0;
  if (Number.isNaN(base.matches)) base.matches = 0;
  if (Number.isNaN(base.wins)) base.wins = 0;
  if (Number.isNaN(base.mvps)) base.mvps = 0;
  if (Number.isNaN(base.assists)) base.assists = 0;
  if (Number.isNaN(base.longest_streak)) base.longest_streak = 0;
  if (Number.isNaN(base.revives)) base.revives = 0;

  return base;
}

function markStatsDirty() {
  statsDirty = true;
}

// ── Billboard helpers ────────────────────────────────────────
function loadBillboardPos() {
  try {
    var pos = JsonIO.read(BILLBOARD_POS_FILE);
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number' && typeof pos.z === 'number') {
      billboardPos = {x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z)};
    }
  } catch (e) {}
}

function saveBillboardPos(x, y, z) {
  billboardPos = {x: x, y: y, z: z};
  try { JsonIO.write(BILLBOARD_POS_FILE, billboardPos); } catch (e) {}
}

function buildBillboardText() {
  var sorted = getSortedEntries();
  var limit = Math.min(10, sorted.length);
  // nl: JS '\\\\n' → command \\n → SNBT parser outputs \n → JSON parser → newline
  var nl = '\\\\n';
  var sep = ' \u2502 '; // │ — column divider between KD and D/L

  var components = [];
  components.push('{"text":"\u2550\u2550 Gambit Leaderboard \u2550\u2550' + nl + '","color":"aqua","bold":true}');

  if (limit === 0) {
    components.push('{"text":"No stats yet","color":"gray"}');
  } else {
    for (var i = 0; i < limit; i++) {
      var name = sorted[i][0].replace(/\\/g, '').replace(/"/g, '').replace(/'/g, '');
      var e = sorted[i][1];
      var prefix, color;
      if (i === 0)      { prefix = '\u2605 '; color = 'red'; }
      else if (i === 1) { prefix = '\u2605 '; color = 'gold'; }
      else if (i === 2) { prefix = '\u2605 '; color = 'yellow'; }
      else              { prefix = (i + 1) + '. '; color = 'white'; }
      var line = prefix + name + '  KD:' + getKD(e).toFixed(2) + sep + 'D/L:' + getAvgDamagePerLife(e).toFixed(1);
      var suffix = i < limit - 1 ? nl : '';
      components.push('{"text":"' + line + suffix + '","color":"' + color + '"}');
    }
  }

  var total = statsSize();
  components.push('{"text":"' + nl + '\u2500\u2500 ' + total + ' operators tracked \u2500\u2500","color":"dark_gray"}');

  return '[' + components.join(',') + ']';
}

function updateBillboard(server) {
  if (!server) return;
  var textJson = buildBillboardText();
  // Wrap in 'execute in overworld' so @e has a world context on Forge 1.20.1.
  server.runCommandSilent(
    'execute in minecraft:overworld run data modify entity @e[type=minecraft:text_display,tag=' + BILLBOARD_TAG + ',limit=1] text set value \'' + textJson + '\''
  );
}

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
    var keys = Object.keys(parsed);
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
    // Re-read the existing file and merge any entries that are on disk but not
    // in memory before writing. This ensures a partial in-memory state (e.g.
    // after a script reload before all players log back in) never silently
    // drops persisted players from the JSON.
    var existing = null;
    try { existing = JsonIO.read(STATS_FILE_PATH); } catch (readErr) {}
    if (existing) {
      var diskKeys = Object.keys(existing);
      for (var i = 0; i < diskKeys.length; i++) {
        if (!stats[diskKeys[i]]) {
          stats[diskKeys[i]] = normalizeEntry(existing[diskKeys[i]]);
        }
      }
      // Keep a rolling backup of the last known-good file.
      try { JsonIO.write(STATS_FILE_PATH + '.bak', existing); } catch (bakErr) {}
    }

    // Persist to MySQL when enabled
    if (typeof gambitDbIsEnabled === 'function' && gambitDbIsEnabled()) {
      gambitDbSaveAllStats(stats);
    }

    // Always write JSON as a local backup
    JsonIO.write(STATS_FILE_PATH, stats);
    statsDirty = false;
    statsSaveTicker = 0;
  } catch (e) {
    console.error('[Gambit Stats] Failed to save stats: ' + e);
  }
}

function getPlayerId(player) {
  if (!player) return null;

  try {
    if (player.uuid) return String(player.uuid);
  } catch (e) {
  }

  var name = player.name && player.name.string ? player.name.string : null;
  return name ? String(name) : null;
}

function rememberRecentAttacker(victim, attacker) {
  var victimId = getPlayerId(victim);
  var attackerName = attacker && attacker.name && attacker.name.string ? attacker.name.string : null;
  if (!victimId || !attackerName) return;

  var entry = recentPlayerAttackers[victimId];
  if (!entry || !entry.all) {
    entry = { last: attackerName, all: {} };
    recentPlayerAttackers[victimId] = entry;
  }
  entry.last = attackerName;
  entry.all[attackerName] = Date.now() + LAST_TACZ_ATTACK_TTL_MS;
}

// Returns { killerName, assistNames[] } — killerName is the last attacker,
// assistNames are all other players who hit the victim within the TTL window.
function consumeRecentAttackInfo(victim) {
  var victimId = getPlayerId(victim);
  if (!victimId) return { killerName: null, assistNames: [] };

  var entry = recentPlayerAttackers[victimId];
  delete recentPlayerAttackers[victimId];
  if (!entry) return { killerName: null, assistNames: [] };

  var now = Date.now();
  var killerName = entry.last || null;
  var assistNames = [];

  if (!entry.all) return { killerName: killerName, assistNames: [] };

  // Verify killer entry hasn't expired.
  if (killerName && entry.all[killerName] && now > entry.all[killerName]) {
    killerName = null;
  }

  var names = Object.keys(entry.all);
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    if (n === killerName) continue;
    if (now <= entry.all[n]) assistNames.push(n);
  }

  return { killerName: killerName, assistNames: assistNames };
}

function cleanupExpiredAttackerCache() {
  var now = Date.now();
  var victimIds = Object.keys(recentPlayerAttackers);

  for (var i = 0; i < victimIds.length; i++) {
    var vid = victimIds[i];
    var entry = recentPlayerAttackers[vid];
    if (!entry) { delete recentPlayerAttackers[vid]; continue; }

    if (!entry.all) {
      // Should not occur, but guard anyway.
      delete recentPlayerAttackers[vid];
      continue;
    }

    var names = Object.keys(entry.all);
    for (var j = 0; j < names.length; j++) {
      if (now > entry.all[names[j]]) delete entry.all[names[j]];
    }
    if (Object.keys(entry.all).length === 0) delete recentPlayerAttackers[vid];
  }
}

function getEntry(playerName) {
  if (!stats[playerName]) {
    stats[playerName] = makeDefaultEntry();
  }
  return stats[playerName];
}

function getRoundEntry(playerName) {
  if (!roundStats[playerName]) {
    roundStats[playerName] = { damage: 0.0, kills: 0, deaths: 0 };
  }
  return roundStats[playerName];
}

function clearRoundStats() {
  roundStats = {};
}

function readTagNumber(tag, key, fallback) {
  if (!tag) return fallback;
  try {
    if (tag.contains && tag.contains(key)) {
      if (tag.getDouble) return Number(tag.getDouble(key));
      if (tag.getFloat) return Number(tag.getFloat(key));
      if (tag.getInt) return Number(tag.getInt(key));
    }
  } catch (e) {
  }

  try {
    if (tag[key] !== undefined) return Number(tag[key]);
  } catch (e) {
  }

  return fallback;
}

function writeTagNumber(tag, key, value, integerOnly) {
  if (!tag) return;
  var n = Number(value);
  if (Number.isNaN(n)) n = 0;

  try {
    if (integerOnly && tag.putInt) {
      tag.putInt(key, Math.floor(n));
      return;
    }
    if (!integerOnly && tag.putDouble) {
      tag.putDouble(key, n);
      return;
    }
  } catch (e) {
  }

  try {
    tag[key] = integerOnly ? Math.floor(n) : n;
  } catch (e) {
  }
}

function loadEntryFromPlayer(player) {
  if (!player) return;
  var name = player.name && player.name.string ? player.name.string : null;
  if (!name) return;

  var tag = player.persistentData;
  var entry = getEntry(name);
  entry.damage = readTagNumber(tag, PD_DAMAGE, 0.0);
  entry.kills = Math.floor(readTagNumber(tag, PD_KILLS, 0));
  entry.deaths = Math.floor(readTagNumber(tag, PD_DEATHS, 0));
  entry.matches = Math.floor(readTagNumber(tag, PD_MATCHES, 0));
  entry.wins = Math.floor(readTagNumber(tag, PD_WINS, 0));
  entry.mvps = Math.floor(readTagNumber(tag, PD_MVPS, 0));
  entry.assists = Math.floor(readTagNumber(tag, PD_ASSISTS, 0));
  entry.longest_streak = Math.floor(readTagNumber(tag, PD_LONGEST_STREAK, 0));
  entry.revives = Math.floor(readTagNumber(tag, PD_REVIVES, 0));
}

function saveEntryToPlayer(player) {
  if (!player) return;
  var name = player.name && player.name.string ? player.name.string : null;
  if (!name) return;

  var tag = player.persistentData;
  var entry = getEntry(name);
  writeTagNumber(tag, PD_DAMAGE, entry.damage, false);
  writeTagNumber(tag, PD_KILLS, entry.kills, true);
  writeTagNumber(tag, PD_DEATHS, entry.deaths, true);
  writeTagNumber(tag, PD_MATCHES, entry.matches, true);
  writeTagNumber(tag, PD_WINS, entry.wins, true);
  writeTagNumber(tag, PD_MVPS, entry.mvps, true);
  writeTagNumber(tag, PD_ASSISTS, entry.assists || 0, true);
  writeTagNumber(tag, PD_LONGEST_STREAK, entry.longest_streak || 0, true);
  writeTagNumber(tag, PD_REVIVES, entry.revives || 0, true);
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
  server.players.forEach(function(p) {
    loadEntryFromPlayer(p);
  });
}

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

// Combined leaderboard score: all four components are on comparable scales so
// no single metric dominates. KD and win rate are already 0-N ratios; kills
// per match normalises raw kill counts; MVPs per match is on the same scale.
// Composite score: (KD × 0.4) + (Win Rate × 0.3) + (Kills per match × 0.2) + (MVPs per match × 0.1)
function getCompositeScore(e) {
  if (!e) return 0;
  var kd = getKD(e); // kills/deaths ratio
  var winRate = getWinPct(e) / 100; // 0-1
  var killsPerMatch = e.kills / Math.max(1, e.matches); // normalised kill rate
  var mvpsPerMatch = (e.mvps || 0) / Math.max(1, e.matches); // normalised MVP rate
  return (kd * 0.4) + (winRate * 0.3) + (killsPerMatch * 0.2) + (mvpsPerMatch * 0.1);
}

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

// Uses hasTagSafe() from gambit_helpers.js

function applyMatchResult(server, targetArg, addMatch, addWin) {
  if (!server || !targetArg) return { count: 0, mode: null };

  var target = String(targetArg).toLowerCase();
  var mode = null;

  if (target === 'red' || target === 'blue' || target === 'all') {
    mode = target;
    var count = 0;

    server.players.forEach(function(p) {
      var onRed = hasTagSafe(p, 'Red');
      var onBlue = hasTagSafe(p, 'Blue');

      if (target === 'red' && !onRed) return;
      if (target === 'blue' && !onBlue) return;
      if (target === 'all' && !(onRed || onBlue)) return;

      loadEntryFromPlayer(p);
      var e = getEntry(p.name.string);
      getRoundEntry(p.name.string);
      if (addMatch) e.matches += 1;
      if (addWin) e.wins += 1;
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
  if (addWin) entry.wins += 1;
  saveEntryToPlayer(targetPlayer);

  return { count: 1, mode: 'player', playerName: targetPlayer.name.string, entry: entry };
}

function formatEntry(name, e) {
  return '§e' + name + '§r — §bKD: §f' + getKD(e).toFixed(2)
    + '§r | §cD/L: §f' + getAvgDamagePerLife(e).toFixed(1);
}

function metricLabel(metric) {
  if (metric === 'kd') return 'KD';
  if (metric === 'winpct') return 'Win %';
  if (metric === 'damage') return 'Damage';
  if (metric === 'kills') return 'Kills';
  if (metric === 'deaths') return 'Deaths';
  if (metric === 'wins') return 'Wins';
  if (metric === 'matches') return 'Matches';
  if (metric === 'mvps') return 'MVPs';
  if (metric === 'dpl') return 'Damage per Life';
  if (metric === 'assists') return 'Assists';
  if (metric === 'streak') return 'Longest Streak';
  if (metric === 'revives') return 'Revives';
  return null;
}

function metricValue(e, metric) {
  if (!e) return 0;
  if (metric === 'kd') return getKD(e);
  if (metric === 'winpct') return getWinPct(e);
  if (metric === 'damage') return e.damage;
  if (metric === 'kills') return e.kills;
  if (metric === 'deaths') return e.deaths;
  if (metric === 'wins') return e.wins;
  if (metric === 'matches') return e.matches;
  if (metric === 'mvps') return e.mvps || 0;
  if (metric === 'dpl') return getAvgDamagePerLife(e);
  if (metric === 'assists') return e.assists || 0;
  if (metric === 'streak') return e.longest_streak || 0;
  if (metric === 'revives') return e.revives || 0;
  return NaN;
}

function formatMetricValue(value, metric) {
  if (metric === 'kd') return Number(value).toFixed(2);
  if (metric === 'winpct') return Number(value).toFixed(1) + '%';
  if (metric === 'damage') return Number(value).toFixed(1);
  if (metric === 'dpl') return Number(value).toFixed(1);
  return String(Math.floor(Number(value)));
}

function getSortedEntriesByMetric(metric) {
  var keys = Object.keys(stats);
  var arr = [];
  for (var i = 0; i < keys.length; i++) {
    if ((stats[keys[i]].matches || 0) >= LEADERBOARD_MIN_MATCHES) {
      arr.push([keys[i], stats[keys[i]]]);
    }
  }

  arr.sort(function(a, b) {
    var vb = metricValue(b[1], metric);
    var va = metricValue(a[1], metric);
    var primary = vb - va;
    if (primary !== 0) return primary;

    // Stable tie-breakers keep rankings predictable.
    var kdDiff = getKD(b[1]) - getKD(a[1]);
    if (kdDiff !== 0) return kdDiff;

    return b[1].damage - a[1].damage;
  });

  return arr;
}

function getSortedRoundEntries(metric) {
  var useMetric = metric || 'kills';
  var keys = Object.keys(roundStats);
  var arr = [];
  for (var i = 0; i < keys.length; i++) {
    arr.push([keys[i], roundStats[keys[i]]]);
  }

  arr.sort(function(a, b) {
    var primary = 0;
    if (useMetric === 'damage') {
      primary = b[1].damage - a[1].damage;
      if (primary !== 0) return primary;
      return b[1].kills - a[1].kills;
    }

    primary = b[1].kills - a[1].kills;
    if (primary !== 0) return primary;
    return b[1].damage - a[1].damage;
  });

  return arr;
}

function formatRoundEntryForKills(name, e) {
  return '§e' + name + '§r — §4Kills: §f' + e.kills;
}

function formatRoundEntryForDamage(name, e) {
  return '§e' + name + '§r — §cDamage: §f' + e.damage.toFixed(1);
}

function tellAll(server, msg) {
  if (!server || !server.players) return;
  server.players.forEach(function(p) {
    p.tell(msg);
  });
}

function getRoundMvpScore(e) {
  if (!e) return 0;
  // Combined performance score: kills are primary, damage still matters.
  return (e.kills * 100.0) + e.damage;
}

function getRoundMvp() {
  var keys = Object.keys(roundStats);
  if (keys.length === 0) return null;

  var bestName = keys[0];
  var bestEntry = roundStats[bestName];
  var bestScore = getRoundMvpScore(bestEntry);

  for (var i = 1; i < keys.length; i++) {
    var name = keys[i];
    var entry = roundStats[name];
    var score = getRoundMvpScore(entry);

    if (score > bestScore) {
      bestName = name;
      bestEntry = entry;
      bestScore = score;
      continue;
    }

    if (score === bestScore) {
      if (entry.kills > bestEntry.kills || (entry.kills === bestEntry.kills && entry.damage > bestEntry.damage)) {
        bestName = name;
        bestEntry = entry;
        bestScore = score;
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
  var entry = getEntry(resolved);
  entry.mvps = (entry.mvps || 0) + 1;
  markStatsDirty();
  return resolved;
}

function broadcastPostGameScoreboard(server) {
  if (!server) return 0;
  var byKills = getSortedRoundEntries('kills');
  if (byKills.length === 0) {
    tellAll(server, '§7[Gambit Stats] No stats recorded yet.');
    return 0;
  }

  var byDamage = getSortedRoundEntries('damage');
  var maxRowsKills = Math.min(5, byKills.length);
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

function getSortedEntries() {
  var keys = Object.keys(stats);
  var arr = [];
  for (var i = 0; i < keys.length; i++) {
    if ((stats[keys[i]].matches || 0) >= LEADERBOARD_MIN_MATCHES) {
      arr.push([keys[i], stats[keys[i]]]);
    }
  }
  arr.sort(function(a, b) {
    var scoreDiff = getCompositeScore(b[1]) - getCompositeScore(a[1]);
    if (scoreDiff !== 0) return scoreDiff;
    var kdDiff = getKD(b[1]) - getKD(a[1]);
    if (kdDiff !== 0) return kdDiff;
    return getAvgDamagePerLife(b[1]) - getAvgDamagePerLife(a[1]);
  });
  return arr;
}

function statsSize() {
  return Object.keys(stats).length;
}

ServerEvents.loaded(function(event) {
  // Initialize MySQL connection if configured
  if (typeof gambitDbIsEnabled === 'function' && gambitDbIsEnabled()) {
    gambitDbConnect();
    gambitDbInitTables();
  }

  var loaded = loadStatsFromDisk();
  loadBillboardPos();
  // Push authoritative disk stats to online players' NBT.
  // Pulling FROM players here could overwrite clean JSON data with zeroed NBT
  // (e.g. after a /reload that clears persistentData).
  if (event.server && event.server.players) {
    event.server.players.forEach(function(p) {
      if (!p) return;
      var name = p.name && p.name.string ? p.name.string : null;
      if (!name) return;
      if (stats[name]) {
        saveEntryToPlayer(p);
      } else {
        loadEntryFromPlayer(p);
      }
    });
  }
  if (loaded) {
    saveStatsToDisk();
  }
});

PlayerEvents.loggedIn(function(event) {
  var player = event.player;
  var name = player && player.name && player.name.string ? player.name.string : null;
  if (!name) return;

  // Reset down counter on join so a disconnect/reconnect between matches starts clean.
  writeTagNumber(player.persistentData, PD_DOWNS, 0, true);
  player.server.runCommandSilent('scoreboard players set ' + name + ' gun_downs 0');

  if (stats[name]) {
    saveEntryToPlayer(player);
    return;
  }

  loadEntryFromPlayer(player);
  markStatsDirty();
});

EntityEvents.spawned('minecraft:player', function(event) {
  // Reset PD_DOWNS on every spawn/respawn (covers TDM respawns where EntityEvents.death
  // may have already fired but persistent data can get reloaded with stale values).
  // EntityEvents.spawned fires on initial login AND respawn (new entity instance each time).
  var player = event.entity;
  var name = player && player.name && player.name.string ? player.name.string : null;
  if (!name) return;
  writeTagNumber(player.persistentData, PD_DOWNS, 0, true);
  // Scoreboard is also reset in respawn_player.mcfunction, but belt-and-suspenders.
  player.server.runCommandSilent('scoreboard players set ' + name + ' gun_downs 0');
});

PlayerEvents.loggedOut(function(event) {
  var player = event.player;
  var name = player && player.name && player.name.string ? player.name.string : null;
  if (!name) return;

  // Strip all in-match tags so the player rejoins clean.
  // Without this, Red/Blue tags persist on the offline entity and reappear on reconnect.
  var server = player.server;
  server.runCommandSilent('tag ' + name + ' remove Red');
  server.runCommandSilent('tag ' + name + ' remove Blue');
  server.runCommandSilent('tag ' + name + ' remove gun_dead');
  server.runCommandSilent('tag ' + name + ' remove gun_just_died');
  server.runCommandSilent('tag ' + name + ' remove gun_spec_tp_pending');
  server.runCommandSilent('team join lobby ' + name);

  // Clear in-memory tracking state for this player.
  delete currentStreaks[name];
  delete syringeCounts[name];
  delete recentlyDowned[name];
  delete downerNames[name];
  delete firstDownerNames[name];

  // If this player was a pending reviver for someone else, nothing to clean up
  // under the syringe-based system.
});

ServerEvents.tick(function(event) {
  // ── Deferred executions ──────────────────────────────────
  // Processed first each tick so the kill fires as soon as possible after the
  // hurt event that queued it, but outside that event's dispatch cycle.
  if (pendingExecutions.length > 0) {
    var toExecute = pendingExecutions.slice(0);
    pendingExecutions = [];
    for (var _ei = 0; _ei < toExecute.length; _ei++) {
      var pe = toExecute[_ei];
      if (!pe.victimName) continue;
      var peTarget = getOnlinePlayerByName(event.server, pe.victimName);
      if (peTarget) {
        // Clear the hurt cooldown so the execution damage isn't blocked.
        try { peTarget.invulnerableTime = 0; } catch (_ie) {}
        // Reset downs here — EntityEvents.death may not fire reliably for
        // players already in PlayerRevive's bleeding state.
        writeTagNumber(peTarget.persistentData, PD_DOWNS, 0, true);
      }
      // Reset scoreboard regardless (works by name even if entity ref is stale).
      event.server.runCommandSilent('scoreboard players set ' + pe.victimName + ' gun_downs 0');
      // Close the downed window — this player is being executed, not revived.
      delete recentlyDowned[pe.victimName];
      if (pe.killerName) {
        var killerLookup = getOnlinePlayerByName(event.server, pe.killerName);
        var execKillerTeam = killerLookup
          ? (hasTagSafe(killerLookup, 'Red') ? 'Red' : (hasTagSafe(killerLookup, 'Blue') ? 'Blue' : null))
          : null;
        var vTeam = pe.victimTeam || null;
        var kTeam = execKillerTeam;
        var vColor = vTeam === 'Red' ? 'red' : (vTeam === 'Blue' ? 'aqua' : 'white');
        var kColor = kTeam === 'Red' ? 'red' : (kTeam === 'Blue' ? 'aqua' : 'white');
        var tellrawParts = ['""'];
        if (vTeam) tellrawParts.push('{"text":"[' + vTeam + '] ","color":"' + vColor + '"}');
        tellrawParts.push('{"text":"' + pe.victimName + '","color":"' + vColor + '"}');
        tellrawParts.push('{"text":" was shot by ","color":"white"}');
        if (kTeam) tellrawParts.push('{"text":"[' + kTeam + '] ","color":"' + kColor + '"}');
        tellrawParts.push('{"text":"' + pe.killerName + '","color":"' + kColor + '"}');
        event.server.runCommandSilent('tellraw @a [' + tellrawParts.join(',') + ']');
      }

      event.server.runCommandSilent('gamerule showDeathMessages false');
      event.server.runCommandSilent('damage ' + pe.victimName + ' 1000 gambit:execution');
      event.server.runCommandSilent('gamerule showDeathMessages true');
    }
  }

  attackerCacheCleanupTicker += 1;
  if (attackerCacheCleanupTicker >= ATTACKER_CACHE_CLEANUP_INTERVAL_TICKS) {
    attackerCacheCleanupTicker = 0;
    cleanupExpiredAttackerCache();
    statsSaveTicker += ATTACKER_CACHE_CLEANUP_INTERVAL_TICKS;
    if (statsDirty && statsSaveTicker >= STATS_FLUSH_INTERVAL_TICKS) {
      saveStatsToDisk();
    }
  }

  billboardUpdateTicker += 1;
  if (billboardUpdateTicker >= BILLBOARD_UPDATE_INTERVAL_TICKS) {
    billboardUpdateTicker = 0;
    updateBillboard(event.server);
  }

  // Revive tracking: poll syringe counts every 10 ticks for in-match players.
  // marbledsfirstaid:syringe is consumed on use. Any decrease in count while the
  // player has a Red or Blue tag means they revived a teammate.
  reviveCheckTicker += 1;
  if (reviveCheckTicker >= 10) {
    reviveCheckTicker = 0;
    if (event.server && event.server.players) {
      event.server.players.forEach(function(p) {
        if (!p) return;
        var pName = p.name && p.name.string ? p.name.string : null;
        if (!pName) return;
        if (!hasTagSafe(p, 'Red') && !hasTagSafe(p, 'Blue')) return;

        var currentCount = 0;
        try {
          var inv = p.inventory;
          var invSize = inv.getContainerSize ? inv.getContainerSize() : 41;
          for (var _si = 0; _si < invSize; _si++) {
            var _stack = inv.getItem(_si);
            if (_stack && !_stack.isEmpty() && String(_stack.id) === 'marbledsfirstaid:syringe') {
              currentCount += _stack.getCount();
            }
          }
        } catch (_se) {}

        var prevCount = syringeCounts[pName];
        if (typeof prevCount === 'number' && currentCount < prevCount) {
          // Only credit when a downed player is within 4 blocks of the reviver.
          // This prevents false credits from moving syringes while nobody nearby is bleeding.
          var _now = Date.now();
          var _rdKeys = Object.keys(recentlyDowned);
          var _creditedRdName = null;
          for (var _ri = _rdKeys.length - 1; _ri >= 0; _ri--) {
            var _rdName = _rdKeys[_ri];
            if (_now >= recentlyDowned[_rdName]) { delete recentlyDowned[_rdName]; continue; }
            var _downedP = getOnlinePlayerByName(event.server, _rdName);
            if (!_downedP) continue;
            var _dx = _downedP.x - p.x;
            var _dy = _downedP.y - p.y;
            var _dz = _downedP.z - p.z;
            if ((_dx*_dx + _dy*_dy + _dz*_dz) <= 16) { _creditedRdName = _rdName; break; } // 4 blocks
          }
          if (_creditedRdName) {
            var used = 1; // cap at 1 per poll — a real revive consumes exactly 1 syringe
            loadEntryFromPlayer(p);
            var reviverEntry = getEntry(pName);
            reviverEntry.revives = (reviverEntry.revives || 0) + used;
            markStatsDirty();
            saveEntryToPlayer(p);
            // Consume the downed window so no second syringe use near the (now alive) player
            // causes a duplicate revive credit for the same down event.
            delete recentlyDowned[_creditedRdName];
          }
        }
        syringeCounts[pName] = currentCount;
      });
    }
  }

});

// ── Damage event ─────────────────────────────────────────────
// source.immediate = the EntityKineticBullet (type: tacz:bullet)
// source.player    = the player who fired the gun
EntityEvents.hurt(function(event) {
  var entity = event.entity;
  var source = event.source;
  var damage = event.damage;

  // Guard: skip re-entry from our own /kill execution command.
  var _srcMsgId = '';
  try { _srcMsgId = String(source.getMsgId()); } catch (e) {}
  // Check both the message_id form (gambit.execution) and the registry-key form
  // (gambit:execution) — KubeJS/Rhino may return either depending on the version.
  if (_srcMsgId === 'gambit.execution' || _srcMsgId === 'gambit:execution'
      || _srcMsgId === 'generic_kill' || _srcMsgId === 'outOfWorld') return;

  // ── TACZ stats tracking ───────────────────────────────────
  var bullet = source.immediate;
  var isTaczBullet = bullet && bullet.type.toString().indexOf('tacz') !== -1;
  if (isTaczBullet) {
    var shooter = source.player;
    if (shooter) {
      var shooterName = shooter.name.string;
      var entry = getEntry(shooterName);
      var roundEntry = getRoundEntry(shooterName);

      // Cap to remaining health to avoid overkill inflation
      var actualDamage = Math.min(damage, entity.health);
      entry.damage += actualDamage;
      roundEntry.damage += actualDamage;

      // Track last TACZ attacker for kill credit on death.
      if (entity && entity.player) {
        rememberRecentAttacker(entity, shooter);
      }

      saveEntryToPlayer(shooter);
    }
  }

  // ── Down limit (both modes) ───────────────────────────────
  // Counts how many times a player has been downed (revived from PlayerRevive).
  // On a lethal hit:
  //   - If downs < max_downs: let it through untouched. PlayerRevive will down
  //     the player normally. We increment the counter on the *next* real death
  //     event via the gun_deaths scoreboard (handled in detect.mcfunction).
  //   - If downs >= max_downs: absorb the hit (prevent PlayerRevive from
  //     catching it) then immediately kill the player for real.
  if (downsConfig.enabled
      && entity && entity.player
      && (hasTagSafe(entity, 'Red') || hasTagSafe(entity, 'Blue'))
      && !hasTagSafe(entity, 'gun_just_died')
      && damage >= entity.health) {

    var srcMsgId = '';
    try { srcMsgId = String(source.getMsgId()); } catch (e) {}
    var isBypassed = downsConfig.bypass_source_types.indexOf(srcMsgId) !== -1;
    // Belt-and-suspenders: also skip execution here in case the top-level guard
    // failed to match (e.g. getMsgId returns the registry key instead of message_id).
    if (isBypassed || srcMsgId === 'gambit.execution' || srcMsgId === 'gambit:execution') return;

    var victimName = getPlayerName(entity);
    var currentDowns = Math.floor(readTagNumber(entity.persistentData, PD_DOWNS, 0));

    // Peek at attacker cache (don't consume — EntityEvents.death still needs it).
    var victimId = getPlayerId(entity);
    var downerCached = victimId ? recentPlayerAttackers[victimId] : null;
    var downerNameHurt = downerCached ? (downerCached.last || null) : null;

    // Store downer for bleed-out kill credit (always updated to most recent downer).
    // firstDownerNames is set once per life and never overwritten — survives revives for
    // assist credit even if a different player later delivers the killing blow.
    if (downerNameHurt && victimName && downerNameHurt !== victimName) {
      downerNames[victimName] = downerNameHurt;
      if (!firstDownerNames[victimName]) {
        firstDownerNames[victimName] = downerNameHurt;
      }
    }
    // Being downed resets the victim's kill streak.
    if (victimName) currentStreaks[victimName] = 0;

    // Always let the hit through — PlayerRevive will down the player normally.
    // Increment the down counter on every lethal hit.
    var newDowns = currentDowns + 1;
    writeTagNumber(entity.persistentData, PD_DOWNS, newDowns, true);
    if (victimName) {
      event.server.runCommandSilent('scoreboard players set ' + victimName + ' gun_downs ' + newDowns);
      // Open a 15-second window during which a reviver's syringe decrease gets credited.
      recentlyDowned[victimName] = Date.now() + 15000;
    }

    // If they were already at their down limit, queue an execution for next tick.
    // PlayerRevive will down them briefly, then gambit:execution kills them for real.

    if (currentDowns >= downsConfig.max_downs && victimName) {
      var _alreadyQueued = false;
      for (var _pei = 0; _pei < pendingExecutions.length; _pei++) {
        if (pendingExecutions[_pei].victimName === victimName) { _alreadyQueued = true; break; }
      }
      if (!_alreadyQueued) {
        var execVictimTeam = hasTagSafe(entity, 'Red') ? 'Red' : (hasTagSafe(entity, 'Blue') ? 'Blue' : null);
        pendingExecutions.push({ victimName: victimName, killerName: downerNameHurt || null, victimTeam: execVictimTeam });
      }
    }
  }

});

// ── Death event ──────────────────────────────────────────────
// Track player deaths for KD calculations
EntityEvents.death(function(event) {
  var dead = event.entity;
  if (!dead || !dead.player) return;

  var deadName = dead.name && dead.name.string ? dead.name.string : null;
  if (!deadName) return;

  // PlayerRevive cancels LivingDeathEvent (HIGH priority) before KubeJS sees it,
  // so this handler only fires for true final deaths: gambit:execution and bled_to_death.
  // Down tracking (PD_DOWNS, downerNames, streak reset) is handled in EntityEvents.hurt.
  var sourceId = '';
  try { sourceId = String(event.source.getMsgId()); } catch (e) {}
  var isBleedOut = (sourceId === 'bled_to_death');

  // Consume attacker cache — killerName is the last shooter; assistNames are
  // all others who hit within the TTL, but assist credit uses firstDowner instead.
  var _attackInfo = consumeRecentAttackInfo(dead);
  var killerName = _attackInfo.killerName;

  // Reset victim streak on final death.
  currentStreaks[deadName] = 0;
  // Close the downed window — player is truly dead, no revive possible.
  delete recentlyDowned[deadName];

  // Cancel any queued execution — they're already dead.
  for (var _pi = pendingExecutions.length - 1; _pi >= 0; _pi--) {
    if (pendingExecutions[_pi].victimName === deadName) {
      pendingExecutions.splice(_pi, 1);
    }
  }

  // Reset down counter so the next life starts clean.
  writeTagNumber(dead.persistentData, PD_DOWNS, 0, true);
  event.server.runCommandSilent('scoreboard players set ' + deadName + ' gun_downs 0');

  // Final death — count the death stat.
  var entry = getEntry(deadName);
  entry.deaths += 1;
  var deadRoundEntry = getRoundEntry(deadName);
  deadRoundEntry.deaths = (deadRoundEntry.deaths || 0) + 1;
  saveEntryToPlayer(dead);

  // For bleed-outs the attacker cache has almost certainly expired (bleed timer is 60s,
  // cache TTL is 15s). Fall back to the stored downer as the kill credit.
  if ((!killerName || killerName === deadName) && isBleedOut) {
    killerName = downerNames[deadName] || null;
  }

  // Consume both downer trackers.
  // downerNames = most recent downer (already used for bleed-out kill credit above).
  // firstDownerNames = first person to down them this life (persists through revives) — used for assist.
  delete downerNames[deadName];
  var firstDowner = firstDownerNames[deadName];
  delete firstDownerNames[deadName];

  if (!killerName || killerName === deadName) {
    return;
  }

  var killerPlayer = getOnlinePlayerByName(event.server, killerName);
  if (killerPlayer) loadEntryFromPlayer(killerPlayer);

  var killerEntry = getEntry(killerName);
  var killerRoundEntry = getRoundEntry(killerName);
  killerEntry.kills += 1;
  killerRoundEntry.kills += 1;

  // Kill streak tracking.
  currentStreaks[killerName] = (currentStreaks[killerName] || 0) + 1;
  var streak = currentStreaks[killerName];
  if (streak > (killerEntry.longest_streak || 0)) {
    killerEntry.longest_streak = streak;
  }

  markStatsDirty();
  if (killerPlayer) saveEntryToPlayer(killerPlayer);

  // Assists: only credit the first player who downed the victim this life.
  // This persists through revives — if A downs B, B gets revived, then C kills B,
  // A still gets the assist regardless of timing.
  var _assistSet = {};
  if (firstDowner && firstDowner !== killerName && firstDowner !== deadName) {
    _assistSet[firstDowner] = true;
  }

  var _assistList = Object.keys(_assistSet);
  for (var _aci = 0; _aci < _assistList.length; _aci++) {
    var _assistorName = _assistList[_aci];
    var _assistorPlayer = getOnlinePlayerByName(event.server, _assistorName);
    if (_assistorPlayer) loadEntryFromPlayer(_assistorPlayer);
    var _assistorEntry = getEntry(_assistorName);
    _assistorEntry.assists = (_assistorEntry.assists || 0) + 1;
    markStatsDirty();
    if (_assistorPlayer) {
      saveEntryToPlayer(_assistorPlayer);
      _assistorPlayer.tell('§7[§eAssist§7] You helped take down §c' + deadName + '§7, finished by §c' + killerName + '§7.');
    }
  }
});

// ── Commands ─────────────────────────────────────────────────
ServerEvents.commandRegistry(function(event) {
  var Commands = event.commands;

  event.register(
    Commands.literal('gambitstats')

      // /gambitstats — leaderboard
      .executes(function(ctx) {
        var player = ctx.source.player;
        if (!player || !player.tell) return 1;

        if (statsSize() === 0) {
          player.tell('§7[Gambit Stats] No stats recorded yet for this round.');
          return 1;
        }

        var sorted = getSortedEntries();
        var limit = Math.min(10, sorted.length);
        player.tell('§6§l── Gambit Leaderboard ──');
        for (var i = 0; i < limit; i++) {
          player.tell('§7' + (i + 1) + '. ' + formatEntry(sorted[i][0], sorted[i][1]));
        }
        player.tell('§6§l──────────────────────');
        return 1;
      })

      // /gambitstats me
      .then(
        Commands.literal('me')
          .executes(function(ctx) {
            var player = ctx.source.player;
            var name = player && player.name && player.name.string ? player.name.string : null;
            if (!name) {
              if (player && player.tell) player.tell('§c[Gambit Stats] Unable to resolve your player name.');
              return 1;
            }

            loadEntryFromPlayer(player);
            var e = getEntry(name);

            player.tell('§6§l── Gambit Stats: ' + name + ' ──');
            player.tell('  §cDamage per Life: §f' + getAvgDamagePerLife(e).toFixed(2));
            player.tell('  §4Kills: §f' + e.kills);
            player.tell('  §8Deaths: §f' + e.deaths);
            player.tell('  §bKD: §f' + getKD(e).toFixed(2));
            player.tell('  §eAssists: §f' + (e.assists || 0));
            player.tell('  §dLongest Streak: §f' + (e.longest_streak || 0));
            player.tell('  §aRevives: §f' + (e.revives || 0));
            player.tell('  §6Matches: §f' + e.matches);
            player.tell('  §aWins: §f' + e.wins);
            player.tell('  §dWin %: §f' + getWinPct(e).toFixed(1) + '%');
            player.tell('  §6MVPs: §f' + (e.mvps || 0));
            player.tell('§6§l──────────────────────');
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
                var label = metricLabel(metric);
                if (!label) {
                  player.tell('§e[Gambit Stats] Unknown metric "' + metric + '". Use: kd, winpct, damage, kills, deaths, wins, matches, mvps, dpl, assists, streak, revives.');
                  return 1;
                }

                if (statsSize() === 0) {
                  player.tell('§7[Gambit Stats] No stats recorded yet.');
                  return 1;
                }

                var sorted = getSortedEntriesByMetric(metric);
                var limit = Math.min(10, sorted.length);

                player.tell('§6§l── Gambit Top ' + limit + ' by ' + label + ' ──');
                for (var i = 0; i < limit; i++) {
                  var name = sorted[i][0];
                  var e = sorted[i][1];
                  var val = formatMetricValue(metricValue(e, metric), metric);
                  player.tell('§7' + (i + 1) + '. §e' + name + '§r — §f' + val);
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

                if (result.count <= 0) {
                  if (caller && caller.tell) caller.tell('§c[Gambit Stats] No valid online target for addmatch: "' + target + '".');
                  return 1;
                }

                if (caller && caller.tell) {
                  if (result.mode === 'player') {
                    caller.tell('§a[Gambit Stats] Added match for ' + result.playerName + '. Matches: ' + result.entry.matches + ', W%: ' + getWinPct(result.entry).toFixed(1) + '%.');
                  } else {
                    caller.tell('§a[Gambit Stats] Added match for ' + result.count + ' player(s) in target "' + result.mode + '".');
                  }
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

                if (result.count <= 0) {
                  if (caller && caller.tell) caller.tell('§c[Gambit Stats] No valid online target for addwin: "' + target + '".');
                  return 1;
                }

                if (caller && caller.tell) {
                  if (result.mode === 'player') {
                    caller.tell('§a[Gambit Stats] Added win for ' + result.playerName + '. Wins: ' + result.entry.wins + ', Matches: ' + result.entry.matches + ', W%: ' + getWinPct(result.entry).toFixed(1) + '%.');
                  } else {
                    caller.tell('§a[Gambit Stats] Added wins for ' + result.count + ' player(s) in target "' + result.mode + '".');
                  }
                }
                return 1;
              })
          )
      )

      // /gambitstats player <playerName>
      .then(
        Commands.literal('player')
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .executes(function(ctx) {
                var viewer = ctx.source.player;
                if (!viewer || !viewer.tell) return 1;

                var targetInput = StringArgumentType.getString(ctx, 'playerName');

                var target = getExistingStatName(targetInput);
                if (!target) {
                  var tp = getOnlinePlayerByName(ctx.source.server, targetInput);
                  target = tp && tp.name && tp.name.string ? tp.name.string : null;
                }

                if (!target || !stats[target]) {
                  viewer.tell('§c[Gambit Stats] No stats found for "' + targetInput + '".');
                  return 1;
                }

                // Sync from NBT if the target is currently online.
                var targetOnlineV = getOnlinePlayerByName(ctx.source.server, target);
                if (targetOnlineV) loadEntryFromPlayer(targetOnlineV);

                var e = stats[target];
                viewer.tell('§6§l── Gambit Stats: ' + target + ' ──');
                viewer.tell('  §cDamage per Life: §f' + getAvgDamagePerLife(e).toFixed(2));
                viewer.tell('  §4Kills: §f' + e.kills);
                viewer.tell('  §8Deaths: §f' + e.deaths);
                viewer.tell('  §bKD: §f' + getKD(e).toFixed(2));
                viewer.tell('  §eAssists: §f' + (e.assists || 0));
                viewer.tell('  §dLongest Streak: §f' + (e.longest_streak || 0));
                viewer.tell('  §aRevives: §f' + (e.revives || 0));
                viewer.tell('  §6Matches: §f' + e.matches);
                viewer.tell('  §aWins: §f' + e.wins);
                viewer.tell('  §dWin %: §f' + getWinPct(e).toFixed(1) + '%');
                viewer.tell('  §6MVPs: §f' + (e.mvps || 0));
                viewer.tell('§6§l──────────────────────');
                return 1;
              })
          )
      )

      // /gambitstats reset all
      // /gambitstats reset <playerName>
      .then(
        Commands.literal('reset')
          .requires(function(src) { return src.hasPermission(2); })
          .then(
            Commands.literal('all')
              .executes(function(ctx) {
                var player = ctx.source.player;
                var actorName = player && player.name && player.name.string ? player.name.string : 'Server Console';
                var count = statsSize();

                var keys = Object.keys(stats);
                for (var i = 0; i < keys.length; i++) {
                  stats[keys[i]] = makeDefaultEntry();
                }

                ctx.source.server.players.forEach(function(p) {
                  clearEntryForPlayer(p);
                });
                saveStatsToDisk();
                gambitDbResetAll();
                updateBillboard(ctx.source.server);

                if (player && player.tell) player.tell('§a[Gambit Stats] Cleared stats for ' + count + ' player(s).');
                ctx.source.server.players.forEach(function(p) {
                  if (!player || p.uuid !== player.uuid) {
                    p.tell('§a[Gambit Stats] Round stats have been reset by ' + actorName + '.');
                  }
                });
                return 1;
              })
          )
          .then(
            Commands.argument('playerName', StringArgumentType.word())
              .executes(function(ctx) {
                var caller = ctx.source.player;
                var targetInput = StringArgumentType.getString(ctx, 'playerName');

                // Try online first so we can also clear their NBT.
                var targetPlayer = getOnlinePlayerByName(ctx.source.server, targetInput);
                if (targetPlayer) {
                  clearEntryForPlayer(targetPlayer);
                  saveStatsToDisk();
                  gambitDbResetPlayer(targetPlayer.name.string);
                  if (caller && caller.tell) {
                    caller.tell('§a[Gambit Stats] Reset stats for ' + targetPlayer.name.string + '.');
                    if (caller.uuid !== targetPlayer.uuid) {
                      targetPlayer.tell('§a[Gambit Stats] Your stats were reset by ' + caller.name.string + '.');
                    }
                  }
                  return 1;
                }

                // Offline fallback: zero the JSON entry directly.
                var resolvedName = getExistingStatName(targetInput);
                if (!resolvedName) {
                  if (caller && caller.tell) caller.tell('§c[Gambit Stats] No stats found for "' + targetInput + '".');
                  return 1;
                }

                stats[resolvedName] = makeDefaultEntry();
                saveStatsToDisk();
                gambitDbResetPlayer(resolvedName);
                if (caller && caller.tell) caller.tell('§a[Gambit Stats] Reset stats for ' + resolvedName + ' (offline).');
                return 1;
              })
          )
          .executes(function(ctx) {
            var caller = ctx.source.player;
            if (caller && caller.tell) {
              caller.tell('§e[Gambit Stats] Specify a target: §f/gambitstats reset all §eor §f/gambitstats reset <playerName>');
            }
            return 1;
          })
      )

      // /gambitstats <playerName>
      .then(
        Commands.argument('playerName', StringArgumentType.word())
          .requires(function(src) { return src.hasPermission(2); })
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player || !player.tell) return 1;

            var targetInput = StringArgumentType.getString(ctx, 'playerName');

            var target = getExistingStatName(targetInput);
            if (!target) {
              var tp = getOnlinePlayerByName(ctx.source.server, targetInput);
              target = tp && tp.name && tp.name.string ? tp.name.string : null;
            }

            if (!target || !stats[target]) {
              player.tell('§c[Gambit Stats] No stats found for "' + targetInput + '".');
              return 1;
            }

            // Sync from NBT if the target is currently online.
            var targetOnline = getOnlinePlayerByName(ctx.source.server, target);
            if (targetOnline) loadEntryFromPlayer(targetOnline);

            var e = stats[target];
            player.tell('§6§l── Gambit Stats: ' + target + ' ──');
            player.tell('  §cDamage per Life: §f' + getAvgDamagePerLife(e).toFixed(2));
            player.tell('  §4Kills: §f' + e.kills);
            player.tell('  §8Deaths: §f' + e.deaths);
            player.tell('  §bKD: §f' + getKD(e).toFixed(2));
            player.tell('  §eAssists: §f' + (e.assists || 0));
            player.tell('  §dLongest Streak: §f' + (e.longest_streak || 0));
            player.tell('  §aRevives: §f' + (e.revives || 0));
            player.tell('  §6Matches: §f' + e.matches);
            player.tell('  §aWins: §f' + e.wins);
            player.tell('  §dWin %: §f' + getWinPct(e).toFixed(1) + '%');
            player.tell('  §6MVPs: §f' + (e.mvps || 0));
            player.tell('§6§l──────────────────────');
            return 1;
          })
      )
  );
});

// ── gambit_log_match command ─────────────────────────────────
// Called from win/tie mcfunctions: gambit_log_match red|blue|tie
ServerEvents.commandRegistry(function(event) {
  var Commands = event.commands;

  event.register(
    Commands.literal('gambit_log_match')
      .requires(function(src) { return src.hasPermission(2); })
      .then(
        Commands.argument('winner', StringArgumentType.word())
          .executes(function(ctx) {
            var server = ctx.source.server;
            var winner = String(StringArgumentType.getString(ctx, 'winner')).toLowerCase();

            if (winner !== 'red' && winner !== 'blue' && winner !== 'tie') return 0;

            // Build player details for match logging
            var playerDetails = [];
            if (server && server.players) {
              server.players.forEach(function(p) {
                var isRed = hasTagSafe(p, 'Red');
                var isBlue = hasTagSafe(p, 'Blue');
                if (!isRed && !isBlue) return;
                var name = p.name && p.name.string ? p.name.string : null;
                if (!name) return;
                var rs = roundStats[name] || { damage: 0, kills: 0, deaths: 0 };
                playerDetails.push({
                  name: name,
                  team: isRed ? 'red' : 'blue',
                  kills: rs.kills || 0,
                  deaths: rs.deaths || 0,
                  damage: rs.damage || 0
                });
              });
            }

            // Log match to MySQL if enabled
            if (typeof gambitDbIsEnabled === 'function' && gambitDbIsEnabled()) {
              // Resolve map info from JS globals set by gambit_maps.js
              var mapId = typeof currentMapId !== 'undefined' ? currentMapId : 0;
              var modeId = typeof currentModeId !== 'undefined' ? currentModeId : 0;
              var mapName = 'Unknown';

              if (mapId > 0 && typeof getMapById === 'function') {
                var mapObj = getMapById(mapId);
                if (mapObj && mapObj.name) mapName = mapObj.name;
              }

              var modeName = modeId === 1 ? 'tdm' : 'elimination';

              // Duration from match start time tracked in gambit_maps.js
              var durationSec = 0;
              if (typeof matchStartTime !== 'undefined' && matchStartTime > 0) {
                durationSec = Math.floor((Date.now() - matchStartTime) / 1000);
              }

              var dbMatchId = gambitDbInsertMatch(mapName, mapId, modeName, winner, durationSec);
              if (dbMatchId >= 0 && playerDetails.length > 0) {
                gambitDbInsertMatchPlayers(dbMatchId, playerDetails);
              }

              if (dbMatchId >= 0) {
                console.info('[Gambit Stats] Match #' + dbMatchId + ' logged: ' + mapName + ' ' + modeName + ' → ' + winner + ' (' + durationSec + 's, ' + playerDetails.length + ' players)');
              }
            }

            markStatsDirty();
            return 1;
          })
      )
  );
});

// ── /gambitboard command ──────────────────────────────────────
ServerEvents.commandRegistry(function(event) {
  var Commands = event.commands;

  event.register(
    Commands.literal('gambitboard')
      .requires(function(src) { return src.hasPermission(2); })

      // /gambitboard setup — store player position and spawn the billboard there
      .then(
        Commands.literal('setup')
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player || !player.tell) return 1;
            var playerName = player.name && player.name.string ? player.name.string : null;
            if (!playerName) return 1;
            var x = Math.floor(player.x);
            var y = Math.floor(player.y) + 1;
            var z = Math.floor(player.z);
            saveBillboardPos(x, y, z);
            // Kill any previous billboard first.
            ctx.source.server.runCommandSilent('execute in minecraft:overworld run kill @e[type=minecraft:text_display,tag=' + BILLBOARD_TAG + ']');
            var textJson = buildBillboardText();
            var nbt = '{Tags:["' + BILLBOARD_TAG + '"],billboard:"fixed",background:0,line_width:300,text:\'' + textJson + '\'}';
            // Use 'in minecraft:overworld' explicitly — don't inherit player's current
            // dimension via 'at @s', which would place the entity in the wrong world
            // if the player is not in the overworld.
            ctx.source.server.runCommandSilent(
              'execute as ' + playerName + ' in minecraft:overworld run summon minecraft:text_display ' + x + ' ' + y + ' ' + z + ' ' + nbt
            );
            player.tell('§a[Gambit Board] Billboard placed at ' + x + ' ' + y + ' ' + z + '.');
            return 1;
          })
      )

      // /gambitboard remove — clear stored position and kill all billboard entities
      .then(
        Commands.literal('remove')
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player || !player.tell) return 1;
            billboardPos = null;
            try { JsonIO.write(BILLBOARD_POS_FILE, {}); } catch (e) {}
            ctx.source.server.runCommandSilent(
              'execute in minecraft:overworld run kill @e[type=minecraft:text_display,tag=' + BILLBOARD_TAG + ']'
            );
            player.tell('§a[Gambit Board] Billboard removed.');
            return 1;
          })
      )

      // /gambitboard refresh — force update now
      .then(
        Commands.literal('refresh')
          .executes(function(ctx) {
            var player = ctx.source.player;
            updateBillboard(ctx.source.server);
            if (player && player.tell) player.tell('§a[Gambit Board] Billboard updated.');
            return 1;
          })
      )
  );
});

// ── gambit_reset_downs ────────────────────────────────────────
// Called from gun:starts/general at match start.
// Resets each online player's persistent down counter and syncs the scoreboard.
ServerEvents.commandRegistry(function(event) {
  var Commands = event.commands;
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
        // Clear in-match streak, assist, and revive tracking state for a clean round.
        currentStreaks = {};
        downerNames = {};
        firstDownerNames = {};
        pendingExecutions = [];  // prevent stale executions from firing at start of next match
        syringeCounts = {};      // force clean syringe baseline so first poll doesn't false-credit
        recentlyDowned = {};     // discard any downed windows that bled over from last match
        roundStats = {};         // clear per-round kill/damage tallies so postgame shows only this match
        return 1;
      })
  );
});

// ── gambit_set_downs (DEBUG) ──────────────────────────────────
// Temporarily useful for solo testing the down/execution path.
// Usage: /gambit_set_downs <count>
ServerEvents.commandRegistry(function(event) {
  var Commands = event.commands;
  var IntegerArgumentType = Java.loadClass('com.mojang.brigadier.arguments.IntegerArgumentType');
  event.register(
    Commands.literal('gambit_set_downs')
      .requires(function(src) { return src.hasPermission(2); })
      .then(
        Commands.argument('count', IntegerArgumentType.integer(0, 10))
          .executes(function(ctx) {
            var player = ctx.source.player;
            if (!player) return 0;
            var count = IntegerArgumentType.getInteger(ctx, 'count');
            var name = getPlayerName(player);
            writeTagNumber(player.persistentData, PD_DOWNS, count, true);
            ctx.source.server.runCommandSilent('scoreboard players set ' + name + ' gun_downs ' + count);
            player.tell('§a[Gambit Debug] Down count set to ' + count + ' (max: ' + downsConfig.max_downs + ').');
            return 1;
          })
      )
  );
});


