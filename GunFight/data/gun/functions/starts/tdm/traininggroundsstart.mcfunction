function gun:teams/randomize
scoreboard players set #map map_id 4
execute in minecraft:overworld run tp @a[tag=Red] 930.54 36.00 -724.58 179.83 -0.15
execute in minecraft:overworld run tp @a[tag=Blue] 931.52 36.00 -899.48 -0.19 1.20
function gun:tdm/init
function gun:starts/general
scoreboard objectives setdisplay sidebar tdm_kills
