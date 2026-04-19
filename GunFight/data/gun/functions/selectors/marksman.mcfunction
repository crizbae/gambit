function gun:selectors/clear_kits
tag @s add marksman
title @s actionbar [{"text":"Marksman Kit Selected","color":"blue"}]
playsound minecraft:entity.item.pickup player @s ~ ~ ~ 0.6 1.2
