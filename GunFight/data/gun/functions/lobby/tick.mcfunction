# Lobby tick — effects, guide book, sumo handling
execute as @a[tag=gun_optout] run title @s actionbar [{"text":"Spectate Mode","color":"yellow","bold":true},{"text":" - use ","color":"gray"},{"text":"/play","color":"green"},{"text":" to queue","color":"gray"}]

# Join Lobby when leaving Sumo
execute as @a at @s if block ~ ~-1 ~ minecraft:diorite_stairs if block ~ ~-2 ~ minecraft:polished_diorite if block ~ ~-3 ~ minecraft:smooth_quartz unless entity @s[team=lobby] run team join lobby @s
execute if entity @a[x=26,y=-6,z=-6,dx=12,dy=13,dz=12,team=lobby] as @a[x=26,y=-6,z=-6,dx=12,dy=13,dz=12] unless entity @s[team=sumo] run team join sumo @s

effect give @a[team=lobby] saturation 16 1 true
execute as @a[team=lobby,gamemode=!creative] unless data entity @s Inventory[{id:"minecraft:written_book",tag:{title:"Gambit Field Manual"}}] run function gun:lobby/give_guide
effect give @a[team=sumo] saturation 16 1 true
effect give @a[team=sumo] regeneration 5 25 true