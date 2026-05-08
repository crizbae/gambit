effect clear @a[gamemode=!creative,gamemode=!spectator,tag=!gun_optout]
clear @a[gamemode=!creative,gamemode=!spectator,tag=!gun_optout]
yawp global add flag item-drop Denied
gamerule keepInventory true
trapdoor off
gamerule reducedDebugInfo true
gamerule announceAdvancements false
gamerule doDaylightCycle false
time set 6000
gamerule doWeatherCycle false
weather clear
gamerule doImmediateRespawn true
tag @a remove gun_dead
tag @a remove gun_just_died
tag @a remove gun_spec_tp_pending
tag @a remove gun_in_match
scoreboard players set @a tdm_respawn_timer 0
scoreboard players set @a spec_respawn_timer 0
scoreboard players set @a gun_downs 0
gambit_reset_downs
execute as @a[gamemode=!creative] run scoreboard players operation @s gun_deaths_prev = @s gun_deaths
execute as @a[gamemode=!creative] run scoreboard players operation @s tdm_deaths_counted = @s gun_deaths
execute as @a[tag=!marksman,tag=!breacher,tag=!flanker,tag=!assault,tag=!sniper,tag=!ranger,tag=!burst,tag=!sentry,gamemode=!creative,gamemode=!spectator,tag=!gun_optout] run tag @s add assault
function gun:kits/armor
function gun:kits/equip
effect give @a[gamemode=!creative,gamemode=!spectator,tag=!gun_optout] minecraft:regeneration 5 255 true
execute as @a[gamemode=!creative,gamemode=!spectator,tag=!gun_optout] run function gun:rations/give_random_self
tag @a[gamemode=!creative,gamemode=!spectator,tag=!gun_optout] add gun_in_match
function gun:countdown/start
team join red @a[tag=Red,tag=!gun_optout]
team join blue @a[tag=Blue,tag=!gun_optout]
schedule clear gun:selectors/loop
execute if score #mode mode_respawns matches 1 run schedule function gun:selectors/loop 1t
schedule function gun:death/loop 1t