function gun:selectors/clear_kits
tag @s add assault
title @s actionbar [{"text":"Assault Kit Selected","color":"red"}]
playsound minecraft:entity.item.pickup player @s ~ ~ ~ 0.6 1.2
execute if entity @s[gamemode=adventure] run function gun:kits/single/assault
