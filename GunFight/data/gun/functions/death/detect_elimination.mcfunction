execute as @a[tag=gun_just_died,gamemode=!creative,gamemode=!spectator] run gamemode spectator @s
execute as @a[tag=gun_just_died] run tag @s add gun_spec_tp_pending
execute as @a[tag=gun_just_died] run scoreboard players set @s spec_respawn_timer 3
execute as @a[tag=gun_just_died] run tag @s remove gun_just_died

execute as @a[tag=gun_spec_tp_pending,scores={spec_respawn_timer=1..}] run scoreboard players remove @s spec_respawn_timer 1
execute as @a[tag=gun_spec_tp_pending,gamemode=spectator,scores={spec_respawn_timer=..0}] run gambit_tp_spectator

execute as @a[tag=gun_spec_tp_pending,gamemode=spectator,scores={spec_respawn_timer=..0}] run tag @s add gun_dead
execute as @a[tag=gun_spec_tp_pending,gamemode=spectator,scores={spec_respawn_timer=..0}] run tag @s remove gun_spec_tp_pending
execute as @a[tag=gun_spec_tp_pending,gamemode=spectator,scores={spec_respawn_timer=..0}] run scoreboard players set @s spec_respawn_timer 0

execute as @a[tag=gun_dead,gamemode=!spectator] run tag @s remove gun_dead
execute as @a[tag=gun_spec_tp_pending,gamemode=!spectator] run tag @s remove gun_spec_tp_pending
scoreboard players set @a[gamemode=!spectator] tdm_respawn_timer 0
scoreboard players set @a[gamemode=!spectator] spec_respawn_timer 0