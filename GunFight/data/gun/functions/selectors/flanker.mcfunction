function gun:selectors/clear_kits
tag @s add flanker
title @s actionbar [{"text":"Flanker Kit Selected","color":"aqua"}]
playsound minecraft:entity.item.pickup player @s ~ ~ ~ 0.6 1.2
execute if entity @s[gamemode=adventure] run function gun:kits/single/flanker
