execute unless score #mode mode_respawns matches 1 run schedule clear gun:tdm/spawnpoints

execute if score #mode mode_respawns matches 1 if score #map map_id matches 2 as @a[tag=Red,gamemode=!creative] run spawnpoint @s 1042 39 -110
execute if score #mode mode_respawns matches 1 if score #map map_id matches 2 as @a[tag=Blue,gamemode=!creative] run spawnpoint @s 879 39 -274
execute if score #mode mode_respawns matches 1 if score #map map_id matches 3 as @a[tag=Red,gamemode=!creative] run spawnpoint @s 110 15 -320
execute if score #mode mode_respawns matches 1 if score #map map_id matches 3 as @a[tag=Blue,gamemode=!creative] run spawnpoint @s -5 16 -177
execute if score #mode mode_respawns matches 1 if score #map map_id matches 99 as @a[tag=Red,gamemode=!creative] run spawnpoint @s 1000 64 1000
execute if score #mode mode_respawns matches 1 if score #map map_id matches 99 as @a[tag=Blue,gamemode=!creative] run spawnpoint @s 1020 64 1020
execute if score #mode mode_respawns matches 1 if score #map map_id matches 4 as @a[tag=Red,gamemode=!creative] run spawnpoint @s 930 36 -724
execute if score #mode mode_respawns matches 1 if score #map map_id matches 4 as @a[tag=Blue,gamemode=!creative] run spawnpoint @s 931 36 -899
execute if score #mode mode_respawns matches 1 if score #map map_id matches 5 as @a[tag=Red,gamemode=!creative] run spawnpoint @s 732 68 -734
execute if score #mode mode_respawns matches 1 if score #map map_id matches 5 as @a[tag=Blue,gamemode=!creative] run spawnpoint @s 588 68 -734

execute if score #mode mode_respawns matches 1 run schedule function gun:tdm/spawnpoints 20t