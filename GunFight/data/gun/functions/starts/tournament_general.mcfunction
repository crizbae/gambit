effect clear @a[tag=Red,gamemode=!creative,gamemode=!spectator]
effect clear @a[tag=Blue,gamemode=!creative,gamemode=!spectator]
clear @a[tag=Red,gamemode=!creative,gamemode=!spectator]
clear @a[tag=Blue,gamemode=!creative,gamemode=!spectator]
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
gamemode spectator @a[gamemode=adventure,tag=!Red,tag=!Blue]
tag @a remove gun_dead
tag @a remove gun_just_died
tag @a remove gun_spec_tp_pending
tag @a remove gun_in_match
scoreboard players set @a[tag=Red] tdm_respawn_timer 0
scoreboard players set @a[tag=Blue] tdm_respawn_timer 0
scoreboard players set @a[tag=Red] spec_respawn_timer 0
scoreboard players set @a[tag=Blue] spec_respawn_timer 0
scoreboard players set @a[tag=Red] gun_downs 0
scoreboard players set @a[tag=Blue] gun_downs 0
gambit_reset_downs
execute as @a[tag=Red,gamemode=!creative] run scoreboard players operation @s gun_deaths_prev = @s gun_deaths
execute as @a[tag=Blue,gamemode=!creative] run scoreboard players operation @s gun_deaths_prev = @s gun_deaths
execute as @a[tag=Red,gamemode=!creative] run scoreboard players operation @s tdm_deaths_counted = @s gun_deaths
execute as @a[tag=Blue,gamemode=!creative] run scoreboard players operation @s tdm_deaths_counted = @s gun_deaths
execute as @a[tag=Red,tag=!marksman,tag=!breacher,tag=!flanker,tag=!assault,tag=!sniper,tag=!ranger,tag=!burst,tag=!sentry,gamemode=!creative,gamemode=!spectator] run tag @s add assault
execute as @a[tag=Blue,tag=!marksman,tag=!breacher,tag=!flanker,tag=!assault,tag=!sniper,tag=!ranger,tag=!burst,tag=!sentry,gamemode=!creative,gamemode=!spectator] run tag @s add assault
execute as @a[tag=Red,gamemode=!creative,gamemode=!spectator] run function gun:kits/armor_self
execute as @a[tag=Blue,gamemode=!creative,gamemode=!spectator] run function gun:kits/armor_self
execute as @a[tag=Red,tag=marksman,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/marksman
execute as @a[tag=Blue,tag=marksman,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/marksman
execute as @a[tag=Red,tag=breacher,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/breacher
execute as @a[tag=Blue,tag=breacher,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/breacher
execute as @a[tag=Red,tag=flanker,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/flanker
execute as @a[tag=Blue,tag=flanker,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/flanker
execute as @a[tag=Red,tag=assault,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/assault
execute as @a[tag=Blue,tag=assault,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/assault
execute as @a[tag=Red,tag=sniper,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/sniper
execute as @a[tag=Blue,tag=sniper,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/sniper
execute as @a[tag=Red,tag=ranger,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/ranger
execute as @a[tag=Blue,tag=ranger,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/ranger
execute as @a[tag=Red,tag=burst,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/burst
execute as @a[tag=Blue,tag=burst,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/burst
execute as @a[tag=Red,tag=sentry,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/sentry
execute as @a[tag=Blue,tag=sentry,gamemode=!creative,gamemode=!spectator] run function gun:kits/single/sentry
effect give @a[tag=Red,gamemode=!creative,gamemode=!spectator] minecraft:regeneration 5 255 true
effect give @a[tag=Blue,gamemode=!creative,gamemode=!spectator] minecraft:regeneration 5 255 true
execute as @a[tag=Red,gamemode=!creative,gamemode=!spectator] run function gun:rations/give_random_self
execute as @a[tag=Blue,gamemode=!creative,gamemode=!spectator] run function gun:rations/give_random_self
tag @a[tag=Red,gamemode=!creative,gamemode=!spectator] add gun_in_match
tag @a[tag=Blue,gamemode=!creative,gamemode=!spectator] add gun_in_match
function gun:countdown/start
team join red @a[tag=Red]
team join blue @a[tag=Blue]
schedule clear gun:selectors/loop
schedule function gun:death/loop 1t
