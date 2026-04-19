execute as @a[tag=gun_just_died,gamemode=!creative,gamemode=!spectator] run gamemode spectator @s
execute as @a[tag=gun_just_died,gamemode=!creative] run tag @s add gun_dead
execute as @a[tag=Red,tag=gun_just_died] if score @s gun_deaths > @s tdm_deaths_counted run scoreboard players add #Blue tdm_blue_kills 1
execute as @a[tag=Blue,tag=gun_just_died] if score @s gun_deaths > @s tdm_deaths_counted run scoreboard players add #Red tdm_red_kills 1
execute as @a[tag=gun_just_died] if score @s gun_deaths > @s tdm_deaths_counted run scoreboard players set @s tdm_respawn_timer 100
execute as @a[tag=gun_just_died] if score @s gun_deaths > @s tdm_deaths_counted run scoreboard players operation @s tdm_deaths_counted = @s gun_deaths
execute as @a[tag=gun_just_died] run tag @s remove gun_just_died