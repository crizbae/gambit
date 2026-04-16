title @a[gamemode=!creative,gamemode=!spectator] title {"text":"TDM Objective","color":"gold","bold":true}
title @a[gamemode=!creative,gamemode=!spectator] subtitle [{"text":"First team to ","color":"yellow"},{"score":{"name":"#target","objective":"tdm_kill_target"},"color":"aqua"},{"text":" kills wins","color":"yellow"}]
execute as @a[gamemode=!creative,gamemode=!spectator] run playsound minecraft:block.note_block.pling master @s ~ ~ ~ 0.8 1.2
