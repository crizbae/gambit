function gun:teams/randomize
scoreboard players set #mode mode_id 0
scoreboard players set #mode mode_respawns 0
scoreboard players set #map map_id 2
execute in minecraft:overworld run tp @a[tag=Red] 1041.66 39.00 -110.46 129.62 0.90
execute in minecraft:overworld run tp @a[tag=Blue] 879.45 39.00 -274.27 310.52 3.75
function gun:starts/general
scoreboard objectives setdisplay sidebar teams