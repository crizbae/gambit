title @a[gamemode=!creative,gamemode=!spectator] actionbar [{"text":"Match Point! ","color":"gold","bold":true},{"text":"Red needs ","color":"red"},{"score":{"name":"#RedLeft","objective":"tdm_ui"},"color":"white"},{"text":" more kill(s)","color":"red"}]
execute as @a[gamemode=!creative,gamemode=!spectator] run playsound minecraft:block.note_block.bell master @s ~ ~ ~ 0.8 1.0
