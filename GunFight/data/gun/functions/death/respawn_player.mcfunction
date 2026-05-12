clear @s
gamemode adventure @s
function gun:death/loadout_self
execute if score #mode mode_respawns matches 1 run title @s actionbar [{"text":"Objective: First to ","color":"gold"},{"score":{"name":"#target","objective":"tdm_kill_target"},"color":"aqua"},{"text":" kills","color":"gold"}]

function gun:death/tpmap

title @s actionbar {"text":""}
effect give @s minecraft:blindness 1 0 true
execute at @s run playsound minecraft:block.respawn_anchor.set_spawn master @s ~ ~ ~ 0.9 1.0

scoreboard players set @s gun_downs 0
scoreboard players set @s tdm_respawn_timer 0
execute if score #mode mode_respawns matches 1 run scoreboard players set @s life_kills 0
execute if score #mode mode_respawns matches 1 run scoreboard players set @s life_dmg 0
tag @s remove gun_dead
