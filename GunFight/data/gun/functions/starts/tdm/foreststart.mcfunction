function gun:teams/randomize
scoreboard players set #map map_id 1
execute in minecraft:overworld run tp @a[tag=Red] 303.63 38.00 -38.84 -58.03 9.75
execute in minecraft:overworld run tp @a[tag=Blue] 308.43 34.00 156.65 628.82 -0.15
function gun:tdm/init
function gun:starts/general
scoreboard objectives setdisplay sidebar tdm_kills
