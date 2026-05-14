function gun:selectors/clear_kits
tag @s add covert
title @s actionbar [{"text":"Covert Kit Selected","color":"dark_gray"}]
playsound minecraft:entity.item.pickup player @s ~ ~ ~ 0.6 1.2
function gun:kits/clear_hotbar
execute if entity @s[team=red] run function gun:kits/single/covert
execute if entity @s[team=blue] run function gun:kits/single/covert
execute if entity @s[team=red] run function gun:rations/give_random_self
execute if entity @s[team=blue] run function gun:rations/give_random_self
