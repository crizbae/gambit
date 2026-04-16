function gun:teams/randomize
scoreboard players set #mode mode_id 0
scoreboard players set #mode mode_respawns 0
scoreboard players set #map map_id 3
execute in minecraft:overworld run tp @a[tag=Red,gamemode=!spectator,gamemode=!creative] 13.48 27.00 -405.49 -3012.76 -5.39
execute in minecraft:overworld run tp @a[tag=Blue,gamemode=!spectator,gamemode=!creative] 152.43 27.00 -473.45 -3549.53 -5.10
function gun:starts/general
scoreboard objectives setdisplay sidebar teams