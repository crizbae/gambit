function gun:kits/armor_self
function gun:kits/single/equip
function gun:rations/give_random_self
execute if score #tournament tournament_mode matches 1 run item replace entity @s hotbar.2 from entity @s hotbar.3
execute if score #tournament tournament_mode matches 1 run item replace entity @s hotbar.3 from entity @s hotbar.4
execute if score #tournament tournament_mode matches 1 run item replace entity @s hotbar.4 with minecraft:air
effect give @s minecraft:regeneration 5 255 true
