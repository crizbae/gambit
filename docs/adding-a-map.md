# Adding a New Map to Gambit

This guide walks through every file you need to touch to register a new map into the `/setmap` + `/start` system. The next available map IDs are **4, 5, 6, ...** (IDs 1–3 are Forest, Forest 2, and Trenches; 99 is the debug slot).

---

## 1. Get the coordinates

You'll need three sets of coordinates from in-world. Stand at each position and run `F3` to copy them.

| What | Notes |
|---|---|
| **Red team spawn** | Where Red players TP at round start |
| **Blue team spawn** | Where Blue players TP at round start |
| **Spectator/observer point** | Where opted-out or dead players TP to watch — usually an elevated overview spot |

All TPs take the form `X Y Z YAW PITCH`. Yaw and pitch are the last two values in the F3 `Facing` line.

---

## 2. Create the start function

### Elimination map

Copy `GunFight/data/gun/functions/starts/foreststart.mcfunction` and save it as `starts/<yourname>start.mcfunction`.

```mcfunction
function gun:teams/randomize
scoreboard players set #mode mode_id 0
scoreboard players set #mode mode_respawns 0
scoreboard players set #map map_id <NEW_ID>
execute in minecraft:overworld run tp @a[tag=Red,gamemode=!spectator,gamemode=!creative] <RED_X> <RED_Y> <RED_Z> <RED_YAW> <RED_PITCH>
execute in minecraft:overworld run tp @a[tag=Blue,gamemode=!spectator,gamemode=!creative] <BLUE_X> <BLUE_Y> <BLUE_Z> <BLUE_YAW> <BLUE_PITCH>
function gun:starts/general
scoreboard objectives setdisplay sidebar teams
```

### TDM map

Copy `GunFight/data/gun/functions/starts/tdm/boilerplate.mcfunction` and save it as `starts/tdm/<yourname>start.mcfunction`. Remove the comment lines, then fill in coordinates and ID:

```mcfunction
function gun:teams/randomize
scoreboard players set #map map_id <NEW_ID>
execute in minecraft:overworld run tp @a[tag=Red,gamemode=!spectator,gamemode=!creative] <RED_X> <RED_Y> <RED_Z> <RED_YAW> <RED_PITCH>
execute in minecraft:overworld run tp @a[tag=Blue,gamemode=!spectator,gamemode=!creative] <BLUE_X> <BLUE_Y> <BLUE_Z> <BLUE_YAW> <BLUE_PITCH>
function gun:tdm/init
function gun:starts/general
scoreboard objectives setdisplay sidebar tdm_kills
```

---

## 3. `death/tpmap.mcfunction`

This file handles teleporting players to their team spawn mid-game (spectator TPs in Elimination, respawn TPs in TDM). Add two lines for the new ID:

```mcfunction
execute if score #map map_id matches <NEW_ID> if entity @s[tag=Red] run tp @s <RED_X> <RED_Y> <RED_Z> <RED_YAW> <RED_PITCH>
execute if score #map map_id matches <NEW_ID> if entity @s[tag=Blue] run tp @s <BLUE_X> <BLUE_Y> <BLUE_Z> <BLUE_YAW> <BLUE_PITCH>
```

Use the same Red/Blue spawn coordinates as the start function.

---

## 4. `starts/spectator_tpmap.mcfunction`

This file sends opted-out spectators to the observer point when a round starts. Add one line:

```mcfunction
execute if score #map map_id matches <NEW_ID> run execute in minecraft:overworld run tp @s <SPEC_X> <SPEC_Y> <SPEC_Z> <SPEC_YAW> <SPEC_PITCH>
```

---

## 5. `starts/staged.mcfunction`

This is the dispatcher file that `/start` calls. Add one line in the correct section:

**Elimination:**
```mcfunction
execute if score #nextmap nextmap_id matches <NEW_ID> unless score #nextmode nextmap_mode matches 1 run function gun:starts/<yourname>start
```

**TDM:**
```mcfunction
execute if score #nextmap nextmap_id matches <NEW_ID> if score #nextmode nextmap_mode matches 1 run function gun:starts/tdm/<yourname>start
```

---

## 6. `kubejs/server_scripts/gambit_utils.js`

Register the new preset in the `/setmap` command. Find the `.then(Commands.literal('tdm_forest')` block and add yours after it, inside the `event.register(Commands.literal('setmap')` chain:

**Elimination:**
```js
.then(Commands.literal('<preset_name>')
  .executes(function(ctx) {
    announceNextMap(ctx.source.server, <NEW_ID>, 0, 'Elimination', '<Display Name>', 'green', 'green');
    return 1;
  }))
```

**TDM:**
```js
.then(Commands.literal('<preset_name>')
  .executes(function(ctx) {
    announceNextMap(ctx.source.server, <NEW_ID>, 1, 'TDM', '<Display Name>', 'aqua', 'blue');
    return 1;
  }))
```

Also add the new preset to the header comment at the top of the file under the `/setmap` entry.

---

## Summary checklist

| # | File | What to add |
|---|---|---|
| 1 | `starts/<name>start.mcfunction` *(new file)* | Full start function with ID + coordinates |
| 2 | `death/tpmap.mcfunction` | 2 lines — Red + Blue spawn TPs |
| 3 | `starts/spectator_tpmap.mcfunction` | 1 line — spectator observer TP |
| 4 | `starts/staged.mcfunction` | 1 dispatch line |
| 5 | `tdm/spawnpoints.mcfunction` | 2 lines — Red + Blue spawnpoints *(TDM only)* |
| 6 | `kubejs/server_scripts/gambit_utils.js` | 1 `.then(Commands.literal(...))` block in `/setmap` |

After adding the map, reload the datapack with `/reload` and restart the KubeJS scripts with `/kubejs reload server_scripts`. The new preset will immediately be available via `/setmap <preset_name>`.
