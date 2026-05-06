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
    red_spawn: '480.17 6.00 -986.60 1169.63 -10.79',
    blue_spawn: '317.70 6.00 -982.48 990.08 -7.94',
    spectator: '395.02 31.75 -967.84 1259.64 34.81'
  },
  {
    id: 4,
    name: 'Training Grounds',
    preset: 'training_grounds',
    modes: ['tdm'],
    red_spawn: '930.54 36.00 -724.58 179.83 -0.15',
    blue_spawn: '931.52 36.00 -899.48 -0.19 1.20',
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
    red_spawn: '-126.56 23.00 -444.50 -293.31 -0.30',
    blue_spawn: '-211.57 23.00 -440.43 -98.86 -0.60',
    spectator: '-164.89 46.62 -457.58 -361.05 52.65'
  }
  
];

// ── Match state — JS is source of truth; scoreboard mirrors for mcfunction ──
var stagedMapId = 0;
var stagedModeId = 0; // 0 = elimination, 1 = TDM
var currentMapId = 0;
var currentModeId = 0;
var matchStartTime = 0; // Date.now() when /start runs — used by gambit_log_match for duration

// ── Autostart state ──────────────────────────────────────────
var AUTOSTART_DELAY_TICKS = 1200; // 60 seconds (20 ticks/s)
var autostartTicksLeft = 0;       // 0 = not scheduled
var autostartLastSecondsLeft = -1; // track last displayed second to avoid redundant bossbar updates

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

function _announceNextMap(server, mapId, modeId, modeName, mapName, modeColor, bossbarColor) {
  server.runCommandSilent('scoreboard players set #nextmap nextmap_id ' + mapId);
  server.runCommandSilent('scoreboard players set #nextmode nextmap_mode ' + modeId);
  server.runCommandSilent(
    'bossbar set gun:nextmap name ["",{"text":"Destination: ","color":"gold"},{"text":"' + modeName + '","color":"' + modeColor + '"},{"text":" \u2014 ' + mapName + '","color":"white"},{"text":" \u2014 Starting in ' + Math.ceil(AUTOSTART_DELAY_TICKS / 20) + 's","color":"yellow"}]'
  );
  server.runCommandSilent('bossbar set gun:nextmap color ' + bossbarColor);
  server.runCommandSilent('bossbar set gun:nextmap players @a');
  server.runCommandSilent('bossbar set gun:nextmap visible true');
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

  server.runCommandSilent('function gun:teams/randomize');
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

  server.runCommandSilent('function gun:starts/general');

  if (isTdm) {
    server.runCommandSilent('scoreboard objectives setdisplay sidebar tdm_kills');
  } else {
    server.runCommandSilent('scoreboard objectives setdisplay sidebar teams');
  }
}

// ── Hide bossbar on reload (autostartTicksLeft resets to 0, bossbar would get stuck) ──
ServerEvents.loaded(function(event) {
  event.server.runCommandSilent('bossbar set gun:nextmap visible false');
});

// ── Autostart tick ───────────────────────────────────────────
ServerEvents.tick(function(event) {
  if (autostartTicksLeft <= 0) return;

  autostartTicksLeft -= 1;

  if (autostartTicksLeft <= 0) {
    autostartTicksLeft = 0;
    autostartLastSecondsLeft = -1;
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
        currentMapId = 0;
        currentModeId = 0;
        matchStartTime = 0;
        autostartTicksLeft = 0;
        autostartLastSecondsLeft = -1;
        return 1;
      })
  );
});
