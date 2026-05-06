function gun:selectors/clear_kits
tag @s add sniper
title @s actionbar [{"text":"Sniper Kit Selected","color":"dark_purple"}]
playsound minecraft:entity.item.pickup player @s ~ ~ ~ 0.6 1.2
execute if entity @s[gamemode=adventure] run function gun:kits/single/sniper
