bossbar set gun:tdm_red visible false
bossbar set gun:tdm_blue visible false
bossbar set gun:elim_red visible false
bossbar set gun:elim_blue visible false
revive @a
# Force any players still in spectator (waiting to respawn mid-TDM) back to adventure
# before the TP so they land correctly rather than staying stuck as spectators.
gamemode adventure @a[tag=gun_dead,gamemode=spectator]
scoreboard players set @a tdm_respawn_timer 0
tp @a[tag=Red] 0 101 0
tp @a[tag=Blue] 0 101 0
gamerule doImmediateRespawn false
execute as @a[gamemode=spectator] run execute in minecraft:overworld run tp @s 0 101 0
execute at @a[gamemode=spectator] as @a[gamemode=spectator] run gamemode adventure
tag @a remove gun_dead
tag @a remove gun_just_died
tag @a remove gun_spec_tp_pending
tag @a remove gun_in_match
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
spawnpoint @a 0 101 0
schedule clear gun:selectors/loop
schedule function gun:selectors/loop 1t
time set 18000
gambit_match_end