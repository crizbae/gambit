function gun:selectors/clear_kits
tag @s add sentry
title @s actionbar [{"text":"Sentry Kit Selected","color":"light_purple"}]
playsound minecraft:entity.item.pickup player @s ~ ~ ~ 0.6 1.2
function gun:kits/clear_hotbar
execute if entity @s[team=red] run function gun:kits/single/sentry
execute if entity @s[team=blue] run function gun:kits/single/sentry
execute if entity @s[team=red] run function gun:rations/give_random_self
execute if entity @s[team=blue] run function gun:rations/give_random_self
