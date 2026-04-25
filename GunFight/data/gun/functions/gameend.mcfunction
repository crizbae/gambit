revive @a
# Force any players still in spectator (waiting to respawn mid-TDM) back to adventure
# before the TP so they land correctly rather than staying stuck as spectators.
gamemode adventure @a[tag=gun_dead,gamemode=spectator]
scoreboard players set @a tdm_respawn_timer 0
tp @a[tag=Red] -7.84 0.00 0.52 -1529.49 1.46
tp @a[tag=Blue] 6.74 0.00 0.54 -1349.64 2.36
gamerule doImmediateRespawn false
execute as @a[gamemode=spectator] run execute in minecraft:overworld run tp @s 0.43 0.00 0.43 -1260.08 3.15
execute at @a[gamemode=spectator] as @a[gamemode=spectator] run gamemode adventure
tag @a remove gun_dead
tag @a remove gun_just_died
tag @a remove gun_spec_tp_pending
scoreboard players set @a spec_respawn_timer 0
scoreboard players set @a gun_downs 0
execute as @a[tag=Red] run clear @s
execute as @a[tag=Blue] run clear @s
tag @a remove Blue
tag @a remove Red
effect clear @a minecraft:glowing
effect give @a regeneration 60 4 true
effect give @a saturation 1800 0 true
team join lobby @a[team=red]
team join lobby @a[team=blue]
schedule clear gun:tdm/spawnpoints
spawnpoint @a 0 0 0
schedule function gun:selectors/loop 1t
gambit_match_end