execute as @a[scores={tdm_respawn_timer=..-1}] run scoreboard players set @s tdm_respawn_timer 0
execute as @a[scores={spec_respawn_timer=..-1}] run scoreboard players set @s spec_respawn_timer 0

execute if score #mode mode_respawns matches 1 as @a[tag=gun_spec_tp_pending] run tag @s remove gun_spec_tp_pending
execute if score #mode mode_respawns matches 1 run scoreboard players set @a spec_respawn_timer 0
execute if score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=!creative,scores={tdm_respawn_timer=..0}] run function gun:death/respawn_player

execute unless score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=!creative,gamemode=!spectator] run gamemode spectator @s
execute unless score #mode mode_respawns matches 1 as @a[tag=gun_spec_tp_pending,gamemode=!creative,gamemode=!spectator] run gamemode spectator @s
