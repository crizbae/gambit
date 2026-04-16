execute as @a[gamemode=!creative,tag=!gun_dead,tag=!gun_just_died] if score @s gun_deaths > @s gun_deaths_prev run tag @s add gun_just_died

execute unless score #mode mode_respawns matches 1 as @a[tag=gun_just_died,gamemode=!creative,gamemode=!spectator] run gamemode spectator @s
execute unless score #mode mode_respawns matches 1 as @a[tag=gun_just_died] run tag @s add gun_spec_tp_pending
execute unless score #mode mode_respawns matches 1 as @a[tag=gun_just_died] run scoreboard players set @s spec_respawn_timer 3
execute unless score #mode mode_respawns matches 1 as @a[tag=gun_just_died] run tag @s remove gun_just_died

execute unless score #mode mode_respawns matches 1 as @a[tag=gun_spec_tp_pending,scores={spec_respawn_timer=1..}] run scoreboard players remove @s spec_respawn_timer 1
execute unless score #mode mode_respawns matches 1 as @a[tag=gun_spec_tp_pending,gamemode=spectator,scores={spec_respawn_timer=..0}] run function gun:death/tpmap

execute unless score #mode mode_respawns matches 1 as @a[tag=gun_spec_tp_pending,gamemode=spectator,scores={spec_respawn_timer=..0}] run tag @s add gun_dead
execute unless score #mode mode_respawns matches 1 as @a[tag=gun_spec_tp_pending,gamemode=spectator,scores={spec_respawn_timer=..0}] run tag @s remove gun_spec_tp_pending
execute unless score #mode mode_respawns matches 1 as @a[tag=gun_spec_tp_pending,gamemode=spectator,scores={spec_respawn_timer=..0}] run scoreboard players set @s spec_respawn_timer 0

execute if score #mode mode_respawns matches 1 as @a[tag=gun_just_died,gamemode=!creative,gamemode=!spectator] run gamemode spectator @s
execute if score #mode mode_respawns matches 1 as @a[tag=gun_just_died,gamemode=!creative] run tag @s add gun_dead
execute if score #mode mode_respawns matches 1 as @a[tag=Red,tag=gun_just_died] if score @s gun_deaths > @s tdm_deaths_counted run scoreboard players add #Blue tdm_blue_kills 1
execute if score #mode mode_respawns matches 1 as @a[tag=Blue,tag=gun_just_died] if score @s gun_deaths > @s tdm_deaths_counted run scoreboard players add #Red tdm_red_kills 1
execute if score #mode mode_respawns matches 1 as @a[tag=gun_just_died] if score @s gun_deaths > @s tdm_deaths_counted run scoreboard players set @s tdm_respawn_timer 100
execute if score #mode mode_respawns matches 1 as @a[tag=gun_just_died] if score @s gun_deaths > @s tdm_deaths_counted run scoreboard players operation @s tdm_deaths_counted = @s gun_deaths
execute if score #mode mode_respawns matches 1 as @a[tag=gun_just_died] run tag @s remove gun_just_died

execute unless score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=!spectator] run tag @s remove gun_dead
execute unless score #mode mode_respawns matches 1 as @a[tag=gun_spec_tp_pending,gamemode=!spectator] run tag @s remove gun_spec_tp_pending
execute unless score #mode mode_respawns matches 1 run scoreboard players set @a[gamemode=!spectator] tdm_respawn_timer 0
execute unless score #mode mode_respawns matches 1 run scoreboard players set @a[gamemode=!spectator] spec_respawn_timer 0

execute as @a[gamemode=!creative] run scoreboard players operation @s gun_deaths_prev = @s gun_deaths
