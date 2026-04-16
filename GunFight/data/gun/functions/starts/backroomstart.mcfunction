function shark:teamrandom
scoreboard players set #mode mode_id 0
scoreboard players set #mode mode_respawns 0
scoreboard players set #map map_id 1
execute in minecraft:overworld run tp @a[tag=Red] 996.01 96.00 -487.01 -629.79 -0.15
execute in minecraft:overworld run tp @a[tag=Blue] 818.81 96.00 -442.76 -450.07 0.29
function gun:starts/general
scoreboard objectives setdisplay sidebar teams