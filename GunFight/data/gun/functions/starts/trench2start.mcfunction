function shark:teamrandom
scoreboard players set #mode mode_id 0
scoreboard players set #mode mode_respawns 0
scoreboard players set #map map_id 3
execute in minecraft:overworld run tp @a[tag=Red,gamemode=!spectator,gamemode=!creative] 13.46 27.00 -405.02 186.82 -3.88
execute in minecraft:overworld run tp @a[tag=Blue,gamemode=!spectator,gamemode=!creative] 152.56 27.00 -473.59 402.81 2.21
function gun:starts/general
scoreboard objectives setdisplay sidebar teams