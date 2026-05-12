// ============================================================
// Gambit Map Registry
//
// To add a new map:
//   1. Add an entry to the MAPS array below
//   2. Run /kubejs reload server_scripts
//   3. The map is immediately available via /setmap
//
// Fields:
//   id              - Unique integer map ID
//   name            - Display name shown in /setmap announcements
//   preset          - Command literal for /setmap (no spaces, lowercase)
//   modes           - Array of supported modes: 'elimination', 'tdm', or both
//   red_spawn       - "X Y Z YAW PITCH" — Red team spawn (respawn + TDM start)
//   blue_spawn      - "X Y Z YAW PITCH" — Blue team spawn (respawn + TDM start)
//   spectator       - "X Y Z YAW PITCH" — spectator/observer TP
//   elim_start_red  - (Optional) override Red spawn for elimination round start
//   elim_start_blue - (Optional) override Blue spawn for elimination round start
//   noVote          - (Optional) true to exclude this map from the vote pool
//
// Commands provided:
//   /setmap <preset>        — stage next map (OP, auto-generated from MAPS)
//   /start                  — start match with staged map (OP)
//   gambit_tp_respawn       — TP @s to team spawn (internal, called from mcfunction)
//   gambit_tp_spectator     — TP @s to spectator view (internal, called from mcfunction)
//   gambit_set_spawnpoints  — set TDM spawnpoints for both teams (internal)
//   gambit_match_end        — reset JS map state on match end (internal)
// ============================================================

// ── Map definitions ──────────────────────────────────────────
var MAPS = [
  {
    id: 2,
    name: 'Pine Crossing',
    preset: 'pinecrossing',
    modes: ['elimination'],
    red_spawn: '1041.66 39.00 -110.46 129.62 0.90',
    blue_spawn: '879.45 39.00 -274.27 310.52 3.75',
    spectator: '960.55 47.00 -192.37 180.00 12.00'
  },
  {
    id: 3,
    name: 'Trenches',
    preset: 'trenches',
    modes: ['elimination'],
    red_spawn: '146.50 28.00 -554.49 -1349.87 -1.05',
    blue_spawn: '18.54 28.00 -550.51 -1889.91 -3.58',
    spectator: '82.35 53.78 -592.15 -1440.33 51.74'
  },
  {
    id: 4,
    name: 'Training Grounds',
    preset: 'training_grounds',
    modes: ['tdm'],
    red_spawn: '930.44 36.00 -718.63 180.81 4.01',
    blue_spawn: '930.49 36.00 -905.42 720.93 4.31',
    spectator: '930.47 48.15 -813.14 -89.11 89.25'
  },
  {
    id: 5,
    name: 'Mall',
    preset: 'mall',
    modes: ['tdm'],
    red_spawn: '732.45 58.00 -734.48 90.18 -0.00',
    blue_spawn: '588.45 58.00 -734.49 -89.89 -0.16',
    spectator: '656.50 73.15 -720.71 -4859.61 14.40'
  },
  {
    id: 6,
    name: 'CryoLab',
    preset: 'cryolab',
    modes: ['elimination'],
    red_spawn: '584.5 57.50 -570.5 -90 0',
    blue_spawn: '802.5 57.5 -570.5 90 0',
    spectator: '693 62.00 -570 0 0'
  },
  {
    id: 7,
    name: 'Yuritopia',
    preset: 'yuritopia',
    modes: ['tdm'],
    red_spawn: '9.5 45.5 -2069.5 -1320 0',
    blue_spawn: '-212.5 45.5 -2177.5 -1140 0',
    spectator: '-103.97 75.03 -2081.76 -1259.31 36.67'
  },
  {
    id: 8,
    name: 'Canopy',
    preset: 'canopy',
    modes: ['elimination'],
    red_spawn: '345.5 47.50 -381.5 180 0',
    blue_spawn: '345.5 47.50 -519.5 360 0',
    spectator: '400 63 -449.5 450 25'
  },
  {
    id: 10,
    name: 'Neopolitan',
    preset: 'neopolitan',
    noVote: true,
    modes: ['tdm'],
    red_spawn: '797.39 71.00 -11.44 71.69 3.54',
    blue_spawn: '709.78 71.00 133.37 258.93 1.80',
    spectator: '777.07 104.66 60.02 82.83 42.41'
  },
  {
    id: 11,
    name: 'Vivian Station',
    preset: 'vivianstation',
    modes: ['elimination'],
    red_spawn: '507.59 92.00 -605.40 -181.56 1.49',
    blue_spawn: '507.49 93.00 -764.40 2880.38 54.51',
    spectator: '507.38 104.20 -693.67 2874.55 0.81'
  },
  {
    id: 12,
    name: 'de_Solace',
    preset: 'solace',
    modes: ['elimination'],
    red_spawn: '-123.56 23.00 -444.50 -293.31 -0.30',
    blue_spawn: '-211.57 23.00 -440.43 -98.86 -0.60',
    spectator: '-164.89 46.62 -457.58 -361.05 52.65'
  },
  {
    id: 13,
    name: 'Arena',
    preset: 'arena1',
    noVote: true,
    modes: ['elimination'],
    red_spawn: '-155.48 84.00 -2392.52 -10799.89 0.15',
    blue_spawn: '-155.58 84.00 -2320.57 -10619.28 0.30',
    spectator: '-167.26 106.03 -2356.22 -10530.17 62.55',
    time: 18000
  },
  {
    id: 14,
    name: 'Arena',
    preset: 'arena2',
    noVote: true,
    modes: ['elimination'],
    red_spawn: '-41.49 84.00 -2322.47 -3420.10 -0.30',
    blue_spawn: '-41.50 84.00 -2394.55 -3600.09 -1.35',
    spectator: '-23.30 104.49 -2357.96 -3509.07 54.30'
  }
  
];

// ── Match state — JS is source of truth; scoreboard mirrors for mcfunction ──
var stagedMapId = 0;
var stagedModeId = 0; // 0 = elimination, 1 = TDM
var currentMapId = 0;
var currentModeId = 0;
var matchStartTime = 0; // Date.now() when /start runs — used by gambit_log_match for duration
var matchActive = false; // true from /start until pleft/close (win declared) — gates stat tracking

// ── Autostart state ──────────────────────────────────────────
var AUTOSTART_DELAY_TICKS = 1200; // 60 seconds (20 ticks/s)
var autostartTicksLeft = 0;       // 0 = not scheduled
var autostartLastSecondsLeft = -1; // track last displayed second to avoid redundant bossbar updates

// ── Vote state ───────────────────────────────────────────────
var VOTE_DURATION_TICKS        = 600; // 30 seconds
var VOTE_AUTOSTART_DELAY_TICKS = 600; // 30s kit-select window after vote resolves
var voteActive                 = false;
var voteOptions                = []; // [{mapId, modeId, name, modeName, modeColor, bossbarColor}] — index 3 is the Random sentinel
var voteChoices                = {}; // { playerName: optionIndex (0|1|2|3) }
var voteTicksLeft              = 0;
var voteLastSecondsLeft        = -1;
var voteExcludeMapId           = 0;  // map just played — excluded from random pick

// ── Helpers ──────────────────────────────────────────────────
function getMapById(id) {
  for (var i = 0; i < MAPS.length; i++) {
    if (MAPS[i].id === id) return MAPS[i];
  }
  return null;
}

function parseSpawnXYZ(spawnStr) {
  var parts = spawnStr.split(' ');
  return Math.floor(parseFloat(parts[0])) + ' '
       + Math.floor(parseFloat(parts[1])) + ' '
       + Math.floor(parseFloat(parts[2]));
}

function getScoreValue(server, playerName, objectiveName) {
  try {
    var sb = server.getScoreboard ? server.getScoreboard() : server.scoreboard;
    if (!sb) return 0;
    var obj = sb.getObjective(objectiveName);
    if (!obj) return 0;
    return sb.getOrCreatePlayerScore(playerName, obj).getScore();
  } catch (e) {
    return 0;
  }
}

function resolveMapId(server) {
  if (currentMapId > 0) return currentMapId;
  // Fallback: read from scoreboard (handles manual starts / script reload mid-match)
  return getScoreValue(server, '#map', 'map_id');
}

// ── Vote helpers ─────────────────────────────────────────────

function _pickVoteOptions(excludeMapId) {
  var pool = [];
  for (var i = 0; i < MAPS.length; i++) {
    var m = MAPS[i];
    if (m.id === excludeMapId) continue;
    if (m.noVote) continue;
    for (var j = 0; j < m.modes.length; j++) {
      var isTdm = m.modes[j] === 'tdm';
      pool.push({
        mapId:        m.id,
        modeId:       isTdm ? 1 : 0,
        name:         m.name,
        modeName:     isTdm ? 'TDM' : 'Elimination',
        modeColor:    isTdm ? 'aqua' : 'green',
        bossbarColor: isTdm ? 'blue' : 'green'
      });
    }
  }
  // Fisher-Yates shuffle
  for (var k = pool.length - 1; k > 0; k--) {
    var r = Math.floor(Math.random() * (k + 1));
    var tmp = pool[k]; pool[k] = pool[r]; pool[r] = tmp;
  }
  return pool.slice(0, 3);
}

function _broadcastVoteOptions(server) {
  server.runCommandSilent('tellraw @a {"text":"·················································","color":"dark_gray","strikethrough":true}');
  server.runCommandSilent('tellraw @a ["",{"text":"  Vote for the Next Map!","color":"gold","bold":true},{"text":"  (30 seconds)","color":"gray"}]');
  // Options 1-3: real maps
  for (var i = 0; i < 3 && i < voteOptions.length; i++) {
    var opt = voteOptions[i];
    var num = i + 1;
    server.runCommandSilent(
      'tellraw @a ["",{"text":"  [' + num + '] ","color":"yellow","bold":true,' +
        '"clickEvent":{"action":"run_command","value":"/gambitvote ' + num + '"},' +
        '"hoverEvent":{"action":"show_text","contents":{"text":"Click to vote","color":"gray"}}},' +
        '{"text":"' + opt.name.replace(/"/g, '') + '  ","color":"white"},' +
        '{"text":"' + opt.modeName + '","color":"' + opt.modeColor + '"}]'
    );
  }
  // Option 4: Random
  server.runCommandSilent(
    'tellraw @a ["",{"text":"  [4] ","color":"light_purple","bold":true,' +
      '"clickEvent":{"action":"run_command","value":"/gambitvote 4"},' +
      '"hoverEvent":{"action":"show_text","contents":{"text":"Click to vote for a random map","color":"gray"}}},' +
      '{"text":"Random Map","color":"gray","italic":true}]'
  );
  server.runCommandSilent('tellraw @a {"text":"·················································","color":"dark_gray","strikethrough":true}');
}

function _updateVoteBossbar(server, secondsLeft) {
  server.runCommandSilent(
    'bossbar set gun:nextmap name ["",{"text":"Vote for Next Map — ","color":"gold"},{"text":"' + secondsLeft + 's remaining","color":"yellow"}]'
  );
  server.runCommandSilent('bossbar set gun:nextmap color yellow');
  server.runCommandSilent('bossbar set gun:nextmap players @a');
  server.runCommandSilent('bossbar set gun:nextmap visible true');
}

function _resolveVote(server) {
  if (voteOptions.length === 0) return;

  // Tally (4 slots: 3 real maps + random)
  var tallies = [0, 0, 0, 0];
  var voters = Object.keys(voteChoices);
  for (var i = 0; i < voters.length; i++) {
    var c = voteChoices[voters[i]];
    if (c >= 0 && c <= 3) tallies[c]++;
  }

  // Find highest vote count, then pick randomly among ties
  var maxVotes = 0;
  for (var j = 0; j <= 3; j++) {
    if (tallies[j] > maxVotes) maxVotes = tallies[j];
  }
  var tied = [];
  for (var k = 0; k <= 3; k++) {
    if (tallies[k] === maxVotes) tied.push(k);
  }
  var winIdx = tied[Math.floor(Math.random() * tied.length)];
  var voteCount = tallies[winIdx];

  // Reset vote state before staging so tick handler doesn't fire again
  var savedExclude = voteExcludeMapId;
  var savedOptions = voteOptions.slice(0, 3);
  voteActive = false;
  voteOptions = [];
  voteChoices = {};
  voteTicksLeft = 0;
  voteLastSecondsLeft = -1;
  voteExcludeMapId = 0;

  var winner;
  if (winIdx === 3) {
    // Random option won — pick any map excluding the just-played one and the 3 shown options
    var shownIds = {};
    shownIds[savedExclude] = true;
    for (var si = 0; si < savedOptions.length; si++) shownIds[savedOptions[si].mapId] = true;
    var randomPool = [];
    for (var ri = 0; ri < MAPS.length; ri++) {
      var rm = MAPS[ri];
      if (shownIds[rm.id]) continue;
      for (var rj = 0; rj < rm.modes.length; rj++) {
        var risTdm = rm.modes[rj] === 'tdm';
        randomPool.push({
          mapId:        rm.id,
          modeId:       risTdm ? 1 : 0,
          name:         rm.name,
          modeName:     risTdm ? 'TDM' : 'Elimination',
          modeColor:    risTdm ? 'aqua' : 'green',
          bossbarColor: risTdm ? 'blue' : 'green'
        });
      }
    }
    // Fallback: if all maps were shown, just exclude the last-played map
    if (randomPool.length === 0) {
      for (var fi = 0; fi < MAPS.length; fi++) {
        var fm = MAPS[fi];
        if (fm.id === savedExclude) continue;
        for (var fj = 0; fj < fm.modes.length; fj++) {
          var fisTdm = fm.modes[fj] === 'tdm';
          randomPool.push({
            mapId: fm.id, modeId: fisTdm ? 1 : 0, name: fm.name,
            modeName: fisTdm ? 'TDM' : 'Elimination',
            modeColor: fisTdm ? 'aqua' : 'green', bossbarColor: fisTdm ? 'blue' : 'green'
          });
        }
      }
    }
    winner = randomPool[Math.floor(Math.random() * randomPool.length)];
    server.runCommandSilent(
      'tellraw @a ["",{"text":"[Vote] ","color":"gold","bold":true},' +
      '{"text":"Random Map","color":"light_purple","italic":true},' +
      '{"text":" won! (' + voteCount + ' vote' + (voteCount !== 1 ? 's' : '') + ') — ","color":"gray"},' +
      '{"text":"' + winner.name.replace(/"/g, '') + '  ","color":"white","bold":true},' +
      '{"text":"' + winner.modeName + '","color":"' + winner.modeColor + '"}]'
    );
  } else {
    winner = savedOptions[winIdx];
    server.runCommandSilent(
      'tellraw @a ["",{"text":"[Vote] ","color":"gold","bold":true},' +
      '{"text":"' + winner.name.replace(/"/g, '') + '  ","color":"white","bold":true},' +
      '{"text":"' + winner.modeName + '","color":"' + winner.modeColor + '"},' +
      '{"text":" won! (' + voteCount + ' vote' + (voteCount !== 1 ? 's' : '') + ')","color":"gray"}]'
    );
  }

  // Stage and kick off autostart
  stagedMapId = winner.mapId;
  stagedModeId = winner.modeId;
  autostartTicksLeft = VOTE_AUTOSTART_DELAY_TICKS;
  autostartLastSecondsLeft = -1;
  _announceNextMap(server, winner.mapId, winner.modeId, winner.modeName, winner.name, winner.modeColor, winner.bossbarColor);
}

function _startVote(server, excludeMapId) {
  voteOptions = _pickVoteOptions(excludeMapId);
  if (voteOptions.length === 0) return; // no maps available — shouldn't happen
  voteExcludeMapId = excludeMapId;
  voteChoices = {};
  voteTicksLeft = VOTE_DURATION_TICKS;
  voteLastSecondsLeft = -1;
  voteActive = true;
  // Show bossbar immediately
  server.runCommandSilent('bossbar set gun:nextmap visible true');
  _updateVoteBossbar(server, Math.ceil(VOTE_DURATION_TICKS / 20));
  _broadcastVoteOptions(server);
}

function _castVote(ctx, optionIndex) {
  if (!voteActive) {
    try { ctx.source.player.tell('§7No vote is currently active.'); } catch(e) {}
    return 0;
  }
  if (optionIndex < 0 || optionIndex > 3) return 0;
  var player = ctx.source.player;
  if (!player) return 0;
  var playerName = getPlayerName(player);
  if (!playerName) return 0;
  voteChoices[playerName] = optionIndex;
  if (optionIndex === 3) {
    player.tell('§7You voted for §5Random Map');
  } else {
    var opt = voteOptions[optionIndex];
    player.tell('§7You voted for §f' + opt.name + ' §7— §' + (opt.modeId === 1 ? 'b' : 'a') + opt.modeName);
  }
  return 1;
}

function _announceNextMap(server, mapId, modeId, modeName, mapName, modeColor, bossbarColor) {
  server.runCommandSilent('scoreboard players set #nextmap nextmap_id ' + mapId);
  server.runCommandSilent('scoreboard players set #nextmode nextmap_mode ' + modeId);
  server.runCommandSilent(
    'bossbar set gun:nextmap name ["",{"text":"Destination: ","color":"gold"},{"text":"' + modeName + '","color":"' + modeColor + '"},{"text":" \u2014 ' + mapName + '","color":"white"},{"text":" \u2014 Starting in ' + Math.ceil(AUTOSTART_DELAY_TICKS / 20) + 's","color":"yellow"}]'
  );
  server.runCommandSilent('bossbar set gun:nextmap color ' + bossbarColor);
  server.runCommandSilent('bossbar set gun:nextmap players @a');
  server.runCommandSilent('bossbar set gun:nextmap visible true');
  server.runCommandSilent('title @a times 10 60 20');
  server.runCommandSilent(
    'title @a title ["",{"text":"Next Map","color":"gold","bold":true}]'
  );
  server.runCommandSilent(
    'title @a subtitle ["",{"text":"' + mapName + '  ","color":"white","bold":true},{"text":"\u2014  ","color":"gray"},{"text":"' + modeName + '","color":"' + modeColor + '","bold":true}]'
  );
}

function _updateAutostartBossbar(server, secondsLeft) {
  var map = getMapById(stagedMapId);
  if (!map) return;
  var isTdm = stagedModeId === 1;
  var modeName = isTdm ? 'TDM' : 'Elimination';
  var modeColor = isTdm ? 'aqua' : 'green';
  server.runCommandSilent(
    'bossbar set gun:nextmap name ["",{"text":"Destination: ","color":"gold"},{"text":"' + modeName + '","color":"' + modeColor + '"},{"text":" \u2014 ' + map.name + '","color":"white"},{"text":" \u2014 Starting in ' + secondsLeft + 's","color":"yellow"}]'
  );
}

function _executeStart(server) {
  if (stagedMapId === 0) {
    server.runCommandSilent(
      'tellraw @a ["",{"text":"[Gambit] ","color":"gray"},{"text":"No map staged. Run ","color":"red"},{"text":"/setmap <preset>","color":"yellow"},{"text":" first.","color":"red"}]'
    );
    return;
  }

  var map = getMapById(stagedMapId);
  if (!map) {
    server.runCommandSilent(
      'tellraw @a ["",{"text":"[Gambit] ","color":"gray"},{"text":"Invalid map ID.","color":"red"}]'
    );
    return;
  }

  var isTdm = stagedModeId === 1;

  currentMapId = stagedMapId;
  currentModeId = stagedModeId;
  matchStartTime = Date.now();
  matchActive = true;

  // In tournament mode, skip random assignment and use pre-assigned rosters.
  // Read the JS variable directly (shared Rhino scope) — avoids the scoreboard
  // being reset to 0 by ServerEvents.loaded on any /kubejs reload server_scripts.
  var tournamentActive = typeof tournamentMode !== 'undefined' && tournamentMode;
  if (tournamentActive) {
    // Validate rosters here before continuing — _applyTournamentRosters returning early
    // would not stop the rest of _executeStart from running (countdown, death/loop, etc.).
    var tRed  = typeof tournamentRedRoster  !== 'undefined' ? tournamentRedRoster  : [];
    var tBlue = typeof tournamentBlueRoster !== 'undefined' ? tournamentBlueRoster : [];
    if (tRed.length === 0 || tBlue.length === 0) {
      server.runCommandSilent(
        'tellraw @a ["",{"text":"[Tournament] ","color":"gold"},{"text":"Cannot start — both rosters must have at least one player. Use /tournament red and /tournament blue.","color":"red"}]'
      );
      // Roll back state set above so a subsequent /start works cleanly.
      currentMapId    = 0;
      currentModeId   = 0;
      matchStartTime  = 0;
      return;
    }
    server.runCommandSilent('gambit_tournament_apply');
  } else {
    server.runCommandSilent('function gun:teams/randomize');
  }
  server.runCommandSilent('scoreboard players set #map map_id ' + map.id);

  var redCoords = isTdm ? map.red_spawn : (map.elim_start_red || map.red_spawn);
  var blueCoords = isTdm ? map.blue_spawn : (map.elim_start_blue || map.blue_spawn);

  server.runCommandSilent('execute in minecraft:overworld run tp @a[tag=Red,gamemode=!spectator,gamemode=!creative] ' + redCoords);
  server.runCommandSilent('execute in minecraft:overworld run tp @a[tag=Blue,gamemode=!spectator,gamemode=!creative] ' + blueCoords);

  if (isTdm) {
    server.runCommandSilent('function gun:tdm/init');
  } else {
    server.runCommandSilent('scoreboard players set #mode mode_id 0');
    server.runCommandSilent('scoreboard players set #mode mode_respawns 0');
  }

  // Tournament mode uses a separate mcfunction that scopes all player commands to Red/Blue only,
  // leaving everyone else completely untouched.
  if (tournamentActive) {
    server.runCommandSilent('function gun:starts/tournament_general');
  } else {
    server.runCommandSilent('function gun:starts/general');
  }

  // Apply per-map time override (starts/general and tournament_general both set time 6000 by default).
  if (map.time !== undefined && map.time !== null) {
    server.runCommandSilent('time set ' + Math.floor(map.time));
  }

  // Non-tournament: put gun_optout players into spectator and TP them to the map view.
  if (!tournamentActive) {
    server.runCommandSilent('execute as @a[tag=gun_optout,gamemode=!creative] run gamemode spectator @s');
    server.runCommandSilent('execute as @a[tag=gun_optout,gamemode=spectator] run function gun:starts/spectator_tpmap');
  }

  // Tournament: TP non-participant spectators (forced by tournament_general) to the map view.
  if (tournamentActive) {
    server.runCommandSilent('execute as @a[gamemode=spectator,tag=!Red,tag=!Blue] run function gun:starts/spectator_tpmap');
  }

  // Tournament mode: strip syringes after kits have been fully applied.
  if (tournamentActive) {
    server.runCommandSilent('item replace entity @a[tag=Red,gamemode=!creative,gamemode=!spectator] hotbar.7 with minecraft:air');
    server.runCommandSilent('item replace entity @a[tag=Blue,gamemode=!creative,gamemode=!spectator] hotbar.7 with minecraft:air');
  }


}

// ── Hide bossbar on reload (autostartTicksLeft resets to 0, bossbar would get stuck) ──
ServerEvents.loaded(function(event) {
  event.server.runCommandSilent('bossbar set gun:nextmap visible false');
  // Restore matchActive from scoreboard after a /kubejs reload mid-match.
  matchActive = getScoreValue(event.server, '#map', 'map_id') > 0;
  // Clear any stale vote state from before the reload.
  voteActive = false;
  voteOptions = [];
  voteChoices = {};
  voteTicksLeft = 0;
  voteLastSecondsLeft = -1;
  voteExcludeMapId = 0;
});

// ── Autostart tick ───────────────────────────────────────────
ServerEvents.tick(function(event) {
  // ── Vote phase ───────────────────────────────────────────
  if (voteActive) {
    voteTicksLeft -= 1;
    if (voteTicksLeft <= 0) {
      voteTicksLeft = 0;
      _resolveVote(event.server);
      return;
    }
    var vSeconds = Math.ceil(voteTicksLeft / 20);
    if (vSeconds !== voteLastSecondsLeft) {
      voteLastSecondsLeft = vSeconds;
      _updateVoteBossbar(event.server, vSeconds);
    }
    return;
  }

  if (autostartTicksLeft <= 0) return;

  autostartTicksLeft -= 1;

  if (autostartTicksLeft <= 0) {
    autostartTicksLeft = 0;
    autostartLastSecondsLeft = -1;
    event.server.runCommandSilent('execute as @a at @s run playsound minecraft:block.note_block.pling master @s ~ ~ ~ 1 2');
    _executeStart(event.server);
    return;
  }

  var secondsLeft = Math.ceil(autostartTicksLeft / 20);
  if (secondsLeft !== autostartLastSecondsLeft) {
    autostartLastSecondsLeft = secondsLeft;
    _updateAutostartBossbar(event.server, secondsLeft);

    // Title warning at 10 seconds
    if (secondsLeft === 10) {
      event.server.runCommandSilent('title @a times 10 40 10');
      event.server.runCommandSilent('title @a subtitle {"text":"Pick your kit!","color":"yellow"}');
      event.server.runCommandSilent('title @a title {"text":"Match starting in 10s","color":"red","bold":true}');
    }

    // Countdown beeps: 5, 4, 3, 2 — low click; 1 — higher pitch
    if (secondsLeft >= 2 && secondsLeft <= 5) {
      event.server.runCommandSilent('execute as @a at @s run playsound minecraft:block.note_block.hat master @s ~ ~ ~ 1 1');
    } else if (secondsLeft === 1) {
      event.server.runCommandSilent('execute as @a at @s run playsound minecraft:block.note_block.hat master @s ~ ~ ~ 1 1.5');
    }
  }
});


ServerEvents.commandRegistry(function (event) {
  var Commands = event.commands;

  // ── /setmap <preset> — dynamically generated from MAPS ──
  var setmapCmd = Commands.literal('setmap')
    .requires(function (src) { return src.hasPermission(2); });

  for (var i = 0; i < MAPS.length; i++) {
    (function (map) {
      for (var m = 0; m < map.modes.length; m++) {
        (function (mode) {
          var presetName = mode === 'tdm' ? 'tdm_' + map.preset : map.preset;
          var modeId = mode === 'tdm' ? 1 : 0;
          var modeName = mode === 'tdm' ? 'TDM' : 'Elimination';
          var modeColor = mode === 'tdm' ? 'aqua' : 'green';
          var bossbarColor = mode === 'tdm' ? 'blue' : 'green';

          setmapCmd = setmapCmd.then(
            Commands.literal(presetName)
              .executes(function (ctx) {
                // Cancel any active vote
                if (voteActive) {
                  voteActive = false;
                  voteOptions = [];
                  voteChoices = {};
                  voteTicksLeft = 0;
                  voteLastSecondsLeft = -1;
                  voteExcludeMapId = 0;
                }
                stagedMapId = map.id;
                stagedModeId = modeId;
                autostartTicksLeft = AUTOSTART_DELAY_TICKS;
                autostartLastSecondsLeft = -1;
                _announceNextMap(ctx.source.server, map.id, modeId, modeName, map.name, modeColor, bossbarColor);
                return 1;
              })
          );
        })(map.modes[m]);
      }
    })(MAPS[i]);
  }

  event.register(setmapCmd);

  // ── /start — start match with staged map ──
  event.register(
    Commands.literal('start')
      .requires(function (src) { return src.hasPermission(2); })
      .executes(function (ctx) {
        autostartTicksLeft = 0; // cancel any pending autostart
        autostartLastSecondsLeft = -1;
        _executeStart(ctx.source.server);
        return 1;
      })
  );

  // ── gambit_tp_respawn — TP @s to team spawn ──
  // Called from death/tpmap.mcfunction via execute as <player>
  event.register(
    Commands.literal('gambit_tp_respawn')
      .requires(function (src) { return src.hasPermission(2); })
      .executes(function (ctx) {
        var server = ctx.source.server;
        var mapId = resolveMapId(server);
        if (mapId === 0) return 0;

        var map = getMapById(mapId);
        if (!map) return 0;

        var player = ctx.source.player;
        if (!player) return 0;

        var name = getPlayerName(player);
        if (!name) return 0;

        var coords = hasTagSafe(player, 'Red') ? map.red_spawn : map.blue_spawn;
        server.runCommandSilent('execute in minecraft:overworld run tp ' + name + ' ' + coords);
        return 1;
      })
  );

  // ── gambit_tp_spectator — TP @s to spectator view ──
  // Called from starts/spectator_tpmap.mcfunction via execute as <player>
  event.register(
    Commands.literal('gambit_tp_spectator')
      .requires(function (src) { return src.hasPermission(2); })
      .executes(function (ctx) {
        var server = ctx.source.server;
        var mapId = resolveMapId(server);
        if (mapId === 0) return 0;

        var map = getMapById(mapId);
        if (!map) return 0;

        var player = ctx.source.player;
        if (!player) return 0;

        var name = getPlayerName(player);
        if (!name) return 0;

        server.runCommandSilent('execute in minecraft:overworld run tp ' + name + ' ' + map.spectator);
        return 1;
      })
  );

  // ── gambit_set_spawnpoints — set TDM spawnpoints for both teams ──
  // Called from tdm/spawnpoints.mcfunction on a 20t schedule
  event.register(
    Commands.literal('gambit_set_spawnpoints')
      .requires(function (src) { return src.hasPermission(2); })
      .executes(function (ctx) {
        var server = ctx.source.server;
        var mapId = resolveMapId(server);
        if (mapId === 0) return 0;

        var map = getMapById(mapId);
        if (!map) return 0;

        var redXYZ = parseSpawnXYZ(map.red_spawn);
        var blueXYZ = parseSpawnXYZ(map.blue_spawn);

        server.runCommandSilent('execute as @a[tag=Red,gamemode=!creative] run spawnpoint @s ' + redXYZ);
        server.runCommandSilent('execute as @a[tag=Blue,gamemode=!creative] run spawnpoint @s ' + blueXYZ);
        return 1;
      })
  );

  // ── gambit_match_end — reset JS map state ──
  // Called from gameend.mcfunction
  event.register(
    Commands.literal('gambit_match_end')
      .requires(function (src) { return src.hasPermission(2); })
      .executes(function (ctx) {
        var lastMapId = currentMapId;
        currentMapId = 0;
        currentModeId = 0;
        matchStartTime = 0;
        matchActive = false;
        firstBloodDone = false; // belt-and-suspenders reset (also done in gambit_reset_downs)
        autostartTicksLeft = 0;
        autostartLastSecondsLeft = -1;
        // Don't start a vote in tournament mode — OP controls map selection there.
        var tournamentActive = typeof tournamentMode !== 'undefined' && tournamentMode;
        if (!tournamentActive) {
          _startVote(ctx.source.server, lastMapId);
        }
        return 1;
      })
  );

  // ── gambit_match_closing — stops stat tracking and clears pending executions ──
  // Called from pleft/close.mcfunction the moment a win condition fires.
  event.register(
    Commands.literal('gambit_match_closing')
      .requires(function (src) { return src.hasPermission(2); })
      .executes(function (ctx) {
        matchActive = false;
        // Drain any queued executions — nobody should be executed during postgame.
        if (typeof pendingExecutions !== 'undefined') pendingExecutions = [];
        return 1;
      })
  );

  // ── /gambitvote <1|2|3|4|stop|start> ──
  event.register(
    Commands.literal('gambitvote')
      .requires(function (src) { return true; })
      .then(Commands.literal('1').executes(function (ctx) { return _castVote(ctx, 0); }))
      .then(Commands.literal('2').executes(function (ctx) { return _castVote(ctx, 1); }))
      .then(Commands.literal('3').executes(function (ctx) { return _castVote(ctx, 2); }))
      .then(Commands.literal('4').executes(function (ctx) { return _castVote(ctx, 3); }))
      .then(
        Commands.literal('stop')
          .requires(function (src) { return src.hasPermission(2); })
          .executes(function (ctx) {
            voteActive = false;
            voteOptions = [];
            voteChoices = {};
            voteTicksLeft = 0;
            voteLastSecondsLeft = -1;
            voteExcludeMapId = 0;
            autostartTicksLeft = 0;
            autostartLastSecondsLeft = -1;
            ctx.source.server.runCommandSilent('bossbar set gun:nextmap visible false');
            ctx.source.server.runCommandSilent(
              'tellraw @a ["",{"text":"[Gambit] ","color":"gray"},{"text":"Map vote cancelled.","color":"red"}]'
            );
            return 1;
          })
      )
      .then(
        Commands.literal('start')
          .requires(function (src) { return src.hasPermission(2); })
          .executes(function (ctx) {
            if (voteActive) {
              try { ctx.source.player.tell('§cA vote is already active. Run /gambitvote stop first.'); } catch(e) {}
              return 0;
            }
            _startVote(ctx.source.server, currentMapId);
            return 1;
          })
      )
  );
});
