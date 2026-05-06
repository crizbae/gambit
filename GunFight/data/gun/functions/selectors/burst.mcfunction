function gun:selectors/clear_kits
tag @s add burst
title @s actionbar [{"text":"Burst Kit Selected","color":"yellow"}]
playsound minecraft:entity.item.pickup player @s ~ ~ ~ 0.6 1.2
execute if entity @s[gamemode=adventure] run function gun:kits/single/burst
