function gun:teams/randomize
scoreboard players set #mode mode_id 0
scoreboard players set #mode mode_respawns 0
scoreboard players set #map map_id 4
execute in minecraft:overworld run tp @a[tag=Red] 930.47 30.00 -739.60 -1260.13 -0.90
execute in minecraft:overworld run tp @a[tag=Blue] 931.50 30.00 -884.48 -1800.10 -0.60
function gun:starts/general
scoreboard objectives setdisplay sidebar teams
