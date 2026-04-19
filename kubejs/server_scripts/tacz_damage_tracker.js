//  Commands:
//    /gambitstats                         — show leaderboard (any player)
//    /gambitstats me                      — show your stats (any player)
//    /gambitstats player <playerName>     — inspect one player (any player)
//    /gambitstats top <metric>            — show top players by metric (any player)
//      metrics: kd, winpct, damage, kills, deaths, wins, matches, mvps, dpl
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
var attackerCacheCleanupTicker = 0;
var statsSaveTicker = 0;
var statsDirty = false;
var billboardUpdateTicker = 0;
var billboardPos = null; // {x, y, z} — persisted spawn position of the billboard entity

// Load stats from disk immediately on script evaluation.
// This runs on both server start AND /reload, ensuring offline players
// are always present in the leaderboard after a script reload.
loadStatsFromDisk();
loadBillboardPos();

function makeDefaultEntry() {
  return { damage: 0.0, kills: 0, deaths: 0, matches: 0, wins: 0, mvps: 0 };
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

  if (Number.isNaN(base.damage)) base.damage = 0.0;
  if (Number.isNaN(base.kills)) base.kills = 0;
  if (Number.isNaN(base.deaths)) base.deaths = 0;
  if (Number.isNaN(base.matches)) base.matches = 0;
  if (Number.isNaN(base.wins)) base.wins = 0;
  if (Number.isNaN(base.mvps)) base.mvps = 0;

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

  recentPlayerAttackers[victimId] = {
    attackerName: attackerName,
    expiresAt: Date.now() + LAST_TACZ_ATTACK_TTL_MS
  };
}

function consumeRecentAttackerName(victim) {
  var victimId = getPlayerId(victim);
  if (!victimId) return null;

  var cached = recentPlayerAttackers[victimId];
  delete recentPlayerAttackers[victimId];
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) return null;
  return cached.attackerName || null;
}

function cleanupExpiredAttackerCache() {
  var now = Date.now();
  var keys = Object.keys(recentPlayerAttackers);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var cached = recentPlayerAttackers[key];
    if (!cached || now > cached.expiresAt) {
      delete recentPlayerAttackers[key];
    }
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

// Combined leaderboard score: rewards players who are strong in both KD and
// damage output. Neither metric alone is sufficient — this penalises stat-padding
// in either direction.
// Composite score: (KD × 0.4) + (Win Rate × 0.3) + (Kills per match × 0.2) + (MVPs × 0.1)
function getCompositeScore(e) {
  if (!e) return 0;
  var kd = getKD(e); // ratio
  var winRate = getWinPct(e) / 100; // convert percent to 0-1
  var dpl = getAvgDamagePerLife(e); // damage per life
  var mvps = e.mvps || 0;
  return (kd * 0.4) + (winRate * 0.3) + (dpl * 0.2) + (mvps * 0.1);
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

  if (stats[name]) {
    saveEntryToPlayer(player);
    return;
  }

  loadEntryFromPlayer(player);
  markStatsDirty();
});

ServerEvents.tick(function(event) {
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

});

// ── Damage event ─────────────────────────────────────────────
// source.immediate = the EntityKineticBullet (type: tacz:bullet)
// source.player    = the player who fired the gun
EntityEvents.hurt(function(event) {
  var entity = event.entity;
  var source = event.source;
  var damage = event.damage;

  // Must be a TACZ bullet hit
  var bullet = source.immediate;
  if (!bullet) return;
  if (bullet.type.toString().indexOf('tacz') === -1) return;

  // Must have been fired by a player
  var player = source.player;
  if (!player) return;

  var playerName = player.name.string;
  var entry = getEntry(playerName);
  var roundEntry = getRoundEntry(playerName);

  // Cap to remaining health to avoid overkill inflation
  var actualDamage = Math.min(damage, entity.health);
  entry.damage += actualDamage;
  roundEntry.damage += actualDamage;

  // Track last TACZ attacker for players so kill credit happens once on death.
  if (entity && entity.player) {
    rememberRecentAttacker(entity, player);
  }

  saveEntryToPlayer(player);
});


// ── Death event ──────────────────────────────────────────────
// Track player deaths for KD calculations
EntityEvents.death(function(event) {
  var dead = event.entity;
  if (!dead || !dead.player) return;

  var deadName = dead.name && dead.name.string ? dead.name.string : null;
  if (!deadName) return;

  var entry = getEntry(deadName);
  entry.deaths += 1;
  var deadRoundEntry = getRoundEntry(deadName);
  deadRoundEntry.deaths = (deadRoundEntry.deaths || 0) + 1;
  saveEntryToPlayer(dead);

  // Credit the kill to the last TACZ attacker.
  var killerName = consumeRecentAttackerName(dead);

  if (!killerName || killerName === deadName) return;

  var killerPlayer = getOnlinePlayerByName(event.server, killerName);
  if (killerPlayer) loadEntryFromPlayer(killerPlayer);

  var killerEntry = getEntry(killerName);
  var killerRoundEntry = getRoundEntry(killerName);
  killerEntry.kills += 1;
  killerRoundEntry.kills += 1;
  markStatsDirty();

  if (killerPlayer) saveEntryToPlayer(killerPlayer);
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
                  player.tell('§e[Gambit Stats] Unknown metric "' + metric + '". Use: kd, winpct, damage, kills, deaths, wins, matches, mvps, dpl.');
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

                var e = stats[target];
                viewer.tell('§6§l── Gambit Stats: ' + target + ' ──');
                viewer.tell('  §cDamage dealt: §f' + e.damage.toFixed(2));
                viewer.tell('  §4Kills: §f' + e.kills);
                viewer.tell('  §8Deaths: §f' + e.deaths);
                viewer.tell('  §bKD: §f' + getKD(e).toFixed(2));
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

            var e = stats[target];
            player.tell('§6§l── Gambit Stats: ' + target + ' ──');
            player.tell('  §cDamage dealt: §f' + e.damage.toFixed(2));
            player.tell('  §4Kills: §f' + e.kills);
            player.tell('  §8Deaths: §f' + e.deaths);
            player.tell('  §bKD: §f' + getKD(e).toFixed(2));
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
