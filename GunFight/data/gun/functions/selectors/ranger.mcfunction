function gun:selectors/clear_kits
tag @s add ranger
title @s actionbar [{"text":"Ranger Kit Selected","color":"green"}]
playsound minecraft:entity.item.pickup player @s ~ ~ ~ 0.6 1.2
execute if entity @s[gamemode=adventure] run function gun:kits/single/ranger
