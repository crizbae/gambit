function gun:selectors/clear_kits
tag @s add marksman
title @s actionbar [{"text":"Marksman Kit Selected","color":"blue"}]
playsound minecraft:entity.item.pickup player @s ~ ~ ~ 0.6 1.2
function gun:kits/clear_hotbar
execute if entity @s[team=red] run function gun:kits/single/marksman
execute if entity @s[team=blue] run function gun:kits/single/marksman
execute if entity @s[team=red] run function gun:rations/give_random_self
execute if entity @s[team=blue] run function gun:rations/give_random_self
