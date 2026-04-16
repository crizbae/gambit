# Starts the match using whatever map was staged with /setmap.
# If no map has been staged, notifies all players and aborts.

execute unless score #nextmap nextmap_id matches 1.. run tellraw @a ["",{"text":"[Gambit] ","color":"gray"},{"text":"No map staged. Run ","color":"red"},{"text":"/setmap <preset>","color":"yellow"},{"text":" first.","color":"red"}]

# Elimination maps
execute if score #nextmap nextmap_id matches 1 unless score #nextmode nextmap_mode matches 1 run function gun:starts/foreststart
execute if score #nextmap nextmap_id matches 2 unless score #nextmode nextmap_mode matches 1 run function gun:starts/forest2start
execute if score #nextmap nextmap_id matches 3 unless score #nextmode nextmap_mode matches 1 run function gun:starts/trenchstart

# TDM maps
execute if score #nextmap nextmap_id matches 4 if score #nextmode nextmap_mode matches 1 run function gun:starts/tdm/traininggroundsstart
execute if score #nextmap nextmap_id matches 5 if score #nextmode nextmap_mode matches 1 run function gun:starts/tdm/mallstart

# Elimination maps (continued)
execute if score #nextmap nextmap_id matches 4 unless score #nextmode nextmap_mode matches 1 run function gun:starts/traininggroundsstart
