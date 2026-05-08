title @a[tag=gun_in_match] title {"text":"Fight!","bold":true,"color":"red"}
execute if score #mode mode_respawns matches 1 run title @a[tag=gun_in_match] subtitle [{"text":"TDM: First to ","color":"yellow"},{"score":{"name":"#target","objective":"tdm_kill_target"},"color":"aqua"},{"text":" kills","color":"yellow"}]
execute unless score #mode mode_respawns matches 1 run title @a[tag=gun_in_match] subtitle {"text":"Elimination: Last team standing wins","color":"yellow"}
effect clear @a[tag=gun_in_match] blindness
effect clear @a[tag=gun_in_match] slowness
execute as @a[tag=gun_in_match] at @s run playsound minecraft:item.goat_horn.sound.1 player @a[tag=gun_in_match]
tag @a remove gun_in_match