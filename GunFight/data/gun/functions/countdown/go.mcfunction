title @a title {"text":"Fight!","bold":true,"color":"red"}
execute if score #mode mode_respawns matches 1 run title @a subtitle [{"text":"TDM: First to ","color":"yellow"},{"score":{"name":"#target","objective":"tdm_kill_target"},"color":"aqua"},{"text":" kills","color":"yellow"}]
execute unless score #mode mode_respawns matches 1 run title @a subtitle {"text":"Elimination: Last team standing wins","color":"yellow"}
effect clear @a blindness
effect clear @a slowness
execute as @a at @s run playsound minecraft:item.goat_horn.sound.1 player @a