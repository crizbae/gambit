# Boilerplate TDM start for a new map.
# Replace map_id and all coordinates before using this function live.

function gun:teams/randomize
scoreboard players set #map map_id 99

# Replace these with real map spawn coordinates.
execute in minecraft:overworld run tp @a[tag=Red,gamemode=!spectator,gamemode=!creative] 1000.00 64.00 1000.00 180.00 0.00
execute in minecraft:overworld run tp @a[tag=Blue,gamemode=!spectator,gamemode=!creative] 1020.00 64.00 1020.00 0.00 0.00

function gun:tdm/init
function gun:starts/general
scoreboard objectives setdisplay sidebar tdm_kills
