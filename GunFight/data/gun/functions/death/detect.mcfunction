execute as @a[gamemode=!creative,tag=!gun_dead,tag=!gun_just_died] if score @s gun_deaths > @s gun_deaths_prev run tag @s add gun_just_died

execute unless score #mode mode_respawns matches 1 run function gun:death/detect_elimination
execute if score #mode mode_respawns matches 1 run function gun:death/detect_tdm

execute as @a[gamemode=!creative] run scoreboard players operation @s gun_deaths_prev = @s gun_deaths
