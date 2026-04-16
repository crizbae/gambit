function gun:teams/randomize
scoreboard players set #map map_id 5
execute in minecraft:overworld run tp @a[tag=Red] 732.51 68.00 -734.47 -4949.67 -2.55
execute in minecraft:overworld run tp @a[tag=Blue] 588.58 68.00 -734.51 -4770.05 -0.30
function gun:tdm/init
function gun:starts/general
scoreboard objectives setdisplay sidebar tdm_kills
