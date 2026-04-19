effect clear @a[gamemode=!creative,gamemode=!spectator,tag=!gun_optout]
clear @a[gamemode=!creative,gamemode=!spectator,tag=!gun_optout]
gamerule doImmediateRespawn true
tag @a remove gun_dead
tag @a remove gun_just_died
tag @a remove gun_spec_tp_pending
scoreboard players set @a tdm_respawn_timer 0
scoreboard players set @a spec_respawn_timer 0
execute as @a[gamemode=!creative] run scoreboard players operation @s gun_deaths_prev = @s gun_deaths
execute as @a[gamemode=!creative] run scoreboard players operation @s tdm_deaths_counted = @s gun_deaths
execute as @a[tag=gun_optout,gamemode=!creative] run gamemode spectator @s
execute as @a[tag=!marksman,tag=!breacher,tag=!smg2,tag=!assault,tag=!sniper,tag=!ranger,tag=!burst,gamemode=!creative,gamemode=!spectator,tag=!gun_optout] run tag @s add assault
function gun:kits/armor
function gun:kits/equip
execute as @a[gamemode=!creative,gamemode=!spectator,tag=!gun_optout] run function gun:rations/give_random_self
execute as @a[tag=gun_optout,gamemode=spectator] run function gun:starts/spectator_tpmap
function gun:countdown/start
team join red @a[tag=Red,tag=!gun_optout]
team join blue @a[tag=Blue,tag=!gun_optout]
schedule clear gun:selectors/loop
execute if score #mode mode_respawns matches 1 run schedule function gun:selectors/loop 1t
schedule function gun:death/loop 1t