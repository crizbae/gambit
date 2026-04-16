execute if score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=!creative,scores={tdm_respawn_timer=1..}] run scoreboard players remove @s tdm_respawn_timer 1
execute if score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=spectator,scores={tdm_respawn_timer=1..}] run effect give @s minecraft:blindness 2 0 true
execute if score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=spectator,scores={tdm_respawn_timer=81..100}] run title @s actionbar {"text":"Respawning in 5...","color":"yellow"}
execute if score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=spectator,scores={tdm_respawn_timer=61..80}] run title @s actionbar {"text":"Respawning in 4...","color":"yellow"}
execute if score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=spectator,scores={tdm_respawn_timer=41..60}] run title @s actionbar {"text":"Respawning in 3...","color":"gold"}
execute if score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=spectator,scores={tdm_respawn_timer=21..40}] run title @s actionbar {"text":"Respawning in 2...","color":"gold"}
execute if score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=spectator,scores={tdm_respawn_timer=1..20}] run title @s actionbar {"text":"Respawning in 1...","color":"red"}
execute if score #mode mode_respawns matches 1 as @a[tag=gun_dead,gamemode=!creative,scores={tdm_respawn_timer=..0}] run function gun:death/respawn_player
