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
    disc: 'minecraft:music_disc_far',
    red_spawn: '587.49 111.00 -410.55 -585.07 2.10',
    blue_spawn: '425.47 111.00 -574.54 -761.96 2.25',
    spectator: '491.94 146.16 -468.34 -498.36 40.95'
  },
  {
    id: 3,
    name: 'Trenches',
    preset: 'trenches',
    modes: ['elimination'],
    disc: 'minecraft:music_disc_stal',
    red_spawn: '1057.47 120.00 -496.49 -268.99 -0.45',
    blue_spawn: '929.53 120.00 -492.53 -449.58 -2.10',
    spectator: '990.29 141.98 -532.33 -363.93 36.60'
  },
  {
    id: 4,
    name: 'Training Grounds',
    preset: 'training_grounds',
    modes: ['tdm'],
    disc: 'minecraft:music_disc_blocks',
    red_spawn: '494.47 99.00 -904.45 -179.57 0.30',
    blue_spawn: '494.47 99.00 -1091.44 -0.32 0.45',
    spectator: '513.66 114.04 -999.56 89.98 39.45'
  },
  {
    id: 5,
    name: 'Mall',
    preset: 'mall',
    modes: ['tdm'],
    disc: 'minecraft:music_disc_mall',
    red_spawn: '-423.51 98.00 493.52 -270.09 -1.95',
    blue_spawn: '-567.53 98.00 493.53 -449.64 -1.50',
    spectator: '-499.48 114.66 507.54 -540.09 34.83'
  },
  {
    id: 6,
    name: 'CryoLab',
    preset: 'cryolab',
    modes: ['elimination'],
    disc: 'minecraft:music_disc_13',
    red_spawn: '390.54 104.00 1000.53 -90.25 -0.30',
    blue_spawn: '608.49 104.00 1000.51 89.75 -1.35',
    spectator: '497.99 109.34 1020.95 180.35 16.05'
  },
  {
    id: 7,
    name: 'Yuritopia',
    preset: 'yuritopia',
    modes: ['tdm'],
    disc: 'minecraft:music_disc_cat',
    red_spawn: '-388.55 94.00 1054.45 495.55 0.30',
    blue_spawn: '-610.52 94.00 946.48 675.26 0.00',
    spectator: '-508.27 117.54 1024.64 553.00 31.65'
  },
  {
    id: 8,
    name: 'Canopy',
    preset: 'canopy',
    modes: ['elimination'],
    disc: 'minecraft:music_disc_chirp',
    red_spawn: '1000.51 94.00 569.38 -179.96 -5.10',
    blue_spawn: '1000.51 94.00 431.54 0.49 -2.55',
    spectator: '1060.56 120.78 500.47 90.34 19.71'
  },
  {
    id: 10,
    name: 'Neapolitan',
    preset: 'neapolitan',
    noVote: true,
    modes: ['tdm'],
    red_spawn: '1045.49 83.00 -1073.50 -300.87 1.35',
    blue_spawn: '957.54 83.00 -922.50 -110.22 0.15',
    spectator: '958.85 110.29 -997.42 -89.70 37.58'
  },
  {
    id: 11,
    name: 'Vivian Station',
    preset: 'vivianstation',
    modes: ['elimination'],
    disc: 'minecraft:music_disc_wait',
    red_spawn: '-999.51 106.00 588.46 -1620.47 2.55',
    blue_spawn: '-999.53 107.00 429.58 -1799.45 1.50',
    spectator: '-1009.90 118.03 501.71 -1891.24 33.30'
  },
  {
    id: 12,
    name: 'de_Solace',
    preset: 'solace',
    modes: ['elimination'],
    disc: 'minecraft:music_disc_otherside',
    red_spawn: '536.43 119.00 513.51 90.05 1.50',
    blue_spawn: '448.53 119.00 517.54 -450.40 0.45',
    spectator: '484.95 140.66 492.27 -363.10 54.75'
  },
  {
    id: 13,
    name: 'Arena',
    preset: 'arena1',
    noVote: true,
    modes: ['elimination'],
    red_spawn: '-111.49 91.00 -35.51 -33840.06 0.45',
    blue_spawn: '-111.51 91.00 36.51 -33660.08 0.45',
    spectator: '-93.31 102.00 0.75 -33749.50 29.47',
  },
  {
    id: 14,
    name: 'Arena',
    preset: 'arena2',
    noVote: true,
    modes: ['elimination'],
    red_spawn: '-189.51 91.00 36.51 -33659.96 -0.60',
    blue_spawn: '-189.53 91.00 -35.50 -34560.19 0.45',
    spectator: '-167.62 96.00 0.48 -44550.13 10.20',
  },
  {
    id: 15,
    name: 'Arena',
    preset: 'arena3',
    noVote: true,
    modes: ['elimination'],
    red_spawn: '-266.50 91.00 36.42 -2339.95 0.30',
    blue_spawn: '-266.47 91.00 -35.45 -2159.97 0.60',
    spectator: '-244.60 96.00 0.53 -2428.75 10.20'
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
        bossbarColor: isTdm ? 'blue' : 'green',
        disc:         m.disc || 'minecraft:music_disc_13'
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

function _giveVotePapers(server) {
  var opts = voteOptions;
  server.players.forEach(function(player) {
    if (player.isCreative() || player.isSpectator()) return;
    for (var i = 0; i < 3; i++) {
      if (!opts[i]) continue;
      var opt = opts[i];
      var modeCol = opt.modeId === 1 ? 'aqua' : 'green';
      var nameJson = '[{"text":"' + opt.name + '","color":"white","italic":false},{"text":" \u2014 ' + opt.modeName + '","color":"' + modeCol + '","italic":false}]';
      var lore1 = '{"text":"Right-click to vote","color":"gray","italic":true}';
      var nbt = "{display:{Name:'" + nameJson + "',Lore:['" + lore1 + "']},GambitVote:" + (i + 1) + "b}";
      player.give(Item.of(opt.disc, nbt));
    }
    // Option 4: Random
    var randomName = '{"text":"Random Map","color":"light_purple","italic":false}';
    var randomLore = '{"text":"Right-click to vote","color":"gray","italic":true}';
    var randomNbt = "{display:{Name:'" + randomName + "',Lore:['" + randomLore + "']},GambitVote:4b}";
    player.give(Item.of('minecraft:music_disc_pigstep', randomNbt));
  });
}

function _removeVotePapers(server) {
  for (var i = 0; i < _VOTE_DISC_TYPES.length; i++) {
    server.runCommandSilent('clear @a ' + _VOTE_DISC_TYPES[i] + '{GambitVote:1b}');
    server.runCommandSilent('clear @a ' + _VOTE_DISC_TYPES[i] + '{GambitVote:2b}');
    server.runCommandSilent('clear @a ' + _VOTE_DISC_TYPES[i] + '{GambitVote:3b}');
    server.runCommandSilent('clear @a ' + _VOTE_DISC_TYPES[i] + '{GambitVote:4b}');
  }
}

// (kept as fallback — primary voting is now via inventory papers)
function _broadcastVoteOptions_unused(server) {
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
  _removeVotePapers(server);

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
      if (rm.noVote) continue;
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
        if (fm.noVote) continue;
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
  // Title screen
  server.runCommandSilent('title @a times 10 60 20');
  server.runCommandSilent('title @a title ["",{"text":"Vote for Next Map","color":"gold","bold":true}]');
  server.runCommandSilent('title @a subtitle {"text":"Check your inventory!","color":"yellow"}');
  // Brief chat notice
  server.runCommandSilent('tellraw @a ["",{"text":"[Vote] ","color":"gold","bold":true},{"text":"Right-click your vote discs to choose the next map.","color":"yellow"}]');
  // Give vote papers to all online players
  _giveVotePapers(server);
}

function _castVoteForPlayer(player, server, optionIndex) {
  if (!voteActive) return;
  if (optionIndex < 0 || optionIndex > 3) return;
  var playerName = getPlayerName(player);
  if (!playerName) return;
  voteChoices[playerName] = optionIndex;
  if (optionIndex === 3) {
    player.tell('§7You voted for §5Random Map');
  } else if (voteOptions[optionIndex]) {
    var opt = voteOptions[optionIndex];
    player.tell('§7You voted for §f' + opt.name + ' §7— §' + (opt.modeId === 1 ? 'b' : 'a') + opt.modeName);
  }
  // Ding sound
  server.runCommandSilent('execute as ' + playerName + ' at @s run playsound minecraft:block.note_block.pling master @s ~ ~ ~ 1 2');
}

function _castVote(ctx, optionIndex) {
  if (!voteActive) {
    try { ctx.source.player.tell('§7No vote is currently active.'); } catch(e) {}
    return 0;
  }
  if (optionIndex < 0 || optionIndex > 3) return 0;
  var player = ctx.source.player;
  if (!player) return 0;
  _castVoteForPlayer(player, ctx.source.server, optionIndex);
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
    var _tdmPlayerCount = server.players ? server.players.size() : 0;
    var _tdmTarget = Math.max(10, _tdmPlayerCount * 2);
    server.runCommandSilent('scoreboard players set #target tdm_kill_target ' + _tdmTarget);
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

  // Tournament: TP non-participants to the map spectator view, then put them in adventure
  // so they can walk around the stands rather than being locked in spectator mode.
  if (tournamentActive) {
    server.runCommandSilent('execute as @a[tag=!Red,tag=!Blue,gamemode=!creative] run function gun:starts/spectator_tpmap');
    server.runCommandSilent('gamemode adventure @a[tag=!Red,tag=!Blue,gamemode=!creative]');
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
  _removeVotePapers(event.server);
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
                  _removeVotePapers(ctx.source.server);
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
            _removeVotePapers(ctx.source.server);
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

// ── Vote disc right-click handlers ──────────────────────────
var _VOTE_DISC_TYPES = [
  'minecraft:music_disc_far',    // Pine Crossing
  'minecraft:music_disc_stal',   // Trenches
  'minecraft:music_disc_blocks', // Training Grounds
  'minecraft:music_disc_mall',   // Mall
  'minecraft:music_disc_13',     // CryoLab
  'minecraft:music_disc_cat',    // Yuritopia
  'minecraft:music_disc_chirp',  // Canopy
  'minecraft:music_disc_wait',   // Vivian Station
  'minecraft:music_disc_otherside', // de_Solace
  'minecraft:music_disc_pigstep'    // Random
];
_VOTE_DISC_TYPES.forEach(function(discType) {
  ItemEvents.rightClicked(discType, function(event) {
    if (!voteActive) return;
    var nbt = event.item.nbt;
    if (!nbt || !nbt.contains('GambitVote')) return;
    var voteIdx = nbt.getInt('GambitVote') - 1; // tags are 1–4, options are 0–3
    _castVoteForPlayer(event.player, event.player.server, voteIdx);
    event.cancel();
  });
});
