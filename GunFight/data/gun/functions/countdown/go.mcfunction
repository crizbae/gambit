title @a[tag=gun_in_match] title {"text":"Fight!","bold":true,"color":"red"}
execute if score #mode mode_respawns matches 1 run title @a[tag=gun_in_match] subtitle [{"text":"TDM: First to ","color":"yellow"},{"score":{"name":"#target","objective":"tdm_kill_target"},"color":"aqua"},{"text":" kills","color":"yellow"}]
execute unless score #mode mode_respawns matches 1 run title @a[tag=gun_in_match] subtitle {"text":"Elimination: Last team standing wins","color":"yellow"}
execute if score #mode mode_respawns matches 1 run bossbar set gun:tdm_red name [{"text":"● Red  ","color":"red"},{"score":{"name":"#Red","objective":"tdm_red_kills"},"color":"white"},{"text":" / ","color":"gray"},{"score":{"name":"#target","objective":"tdm_kill_target"},"color":"white"}]
execute if score #mode mode_respawns matches 1 run bossbar set gun:tdm_red players @a
execute if score #mode mode_respawns matches 1 run bossbar set gun:tdm_red visible true
execute if score #mode mode_respawns matches 1 run bossbar set gun:tdm_blue name [{"text":"● Blue  ","color":"aqua"},{"score":{"name":"#Blue","objective":"tdm_blue_kills"},"color":"white"},{"text":" / ","color":"gray"},{"score":{"name":"#target","objective":"tdm_kill_target"},"color":"white"}]
execute if score #mode mode_respawns matches 1 run bossbar set gun:tdm_blue players @a
execute if score #mode mode_respawns matches 1 run bossbar set gun:tdm_blue visible true
execute unless score #mode mode_respawns matches 1 run bossbar set gun:elim_red name [{"text":"● Red  ","color":"red"},{"score":{"name":"#Red","objective":"rcount"},"color":"white"}]
execute unless score #mode mode_respawns matches 1 run execute store result bossbar gun:elim_red max run scoreboard players get #Red rcount
execute unless score #mode mode_respawns matches 1 run execute store result bossbar gun:elim_red value run scoreboard players get #Red rcount
execute unless score #mode mode_respawns matches 1 run bossbar set gun:elim_red players @a
execute unless score #mode mode_respawns matches 1 run bossbar set gun:elim_red visible true
execute unless score #mode mode_respawns matches 1 run bossbar set gun:elim_blue name [{"text":"● Blue  ","color":"aqua"},{"score":{"name":"#Blue","objective":"bcount"},"color":"white"}]
execute unless score #mode mode_respawns matches 1 run execute store result bossbar gun:elim_blue max run scoreboard players get #Blue bcount
execute unless score #mode mode_respawns matches 1 run execute store result bossbar gun:elim_blue value run scoreboard players get #Blue bcount
execute unless score #mode mode_respawns matches 1 run bossbar set gun:elim_blue players @a
execute unless score #mode mode_respawns matches 1 run bossbar set gun:elim_blue visible true
execute unless score #mode mode_respawns matches 1 run scoreboard objectives modify pleft_sidebar displayname ["◄ ",{"text":"Elimination","color":"gold","bold":true}," ►"]
execute unless score #mode mode_respawns matches 1 run scoreboard players operation §cRed pleft_sidebar = #Red rcount
execute unless score #mode mode_respawns matches 1 run scoreboard players operation §bBlue pleft_sidebar = #Blue bcount
execute if score #mode mode_respawns matches 1 run scoreboard objectives setdisplay sidebar tdm_kills
execute unless score #mode mode_respawns matches 1 run scoreboard objectives setdisplay sidebar pleft_sidebar
scoreboard players set #match_started pleft_ui_timer 1
effect clear @a[tag=gun_in_match] blindness
effect clear @a[tag=gun_in_match] slowness
execute as @a[tag=gun_in_match] at @s run playsound minecraft:item.goat_horn.sound.1 player @a[tag=gun_in_match]
tag @a remove gun_in_match