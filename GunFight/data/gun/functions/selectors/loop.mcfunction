# Kit Selectors

execute as @a[tag=!marksman] at @s if block ~ ~-1 ~ blue_stained_glass if block ~ ~-2 ~ sea_lantern if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/marksman
execute as @a[tag=!breacher] at @s if block ~ ~-1 ~ orange_stained_glass if block ~ ~-2 ~ honeycomb_block if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/breacher
execute as @a[tag=!smg2] at @s if block ~ ~-1 ~ light_blue_stained_glass if block ~ ~-2 ~ prismarine if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/smg2
execute as @a[tag=!assault] at @s if block ~ ~-1 ~ red_stained_glass if block ~ ~-2 ~ shroomlight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/assault
execute as @a[tag=!sniper] at @s if block ~ ~-1 ~ purple_stained_glass if block ~ ~-2 ~ pearlescent_froglight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/sniper
execute as @a[tag=!ranger] at @s if block ~ ~-1 ~ lime_stained_glass if block ~ ~-2 ~ verdant_froglight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/ranger
execute as @a[tag=!burst] at @s if block ~ ~-1 ~ yellow_stained_glass if block ~ ~-2 ~ glowstone if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/burst

# Team Selectors

execute as @a[tag=gun_optout] run title @s actionbar [{"text":"Spectate Mode","color":"yellow","bold":true},{"text":" - use ","color":"gray"},{"text":"/play","color":"green"},{"text":" to queue","color":"gray"}]

# Join Lobby when leaving Sumo
execute as @a at @s if block ~ ~-1 ~ minecraft:diorite_stairs if block ~ ~-2 ~ minecraft:polished_diorite if block ~ ~-3 ~ minecraft:smooth_quartz unless entity @s[team=lobby] run team join lobby @s
execute if entity @a[x=26,y=-6,z=-6,dx=12,dy=13,dz=12,team=lobby] as @a[x=26,y=-6,z=-6,dx=12,dy=13,dz=12] unless entity @s[team=sumo] run team join sumo @s

effect give @a[team=lobby] saturation 16 1 true
execute as @a[team=lobby,gamemode=!creative] unless data entity @s Inventory[{id:"minecraft:written_book",tag:{title:"Gambit Field Manual"}}] run function gun:lobby/give_guide
effect give @a[team=sumo] saturation 16 1 true
effect give @a[team=sumo] regeneration 5 25 true

schedule function gun:selectors/loop 1t