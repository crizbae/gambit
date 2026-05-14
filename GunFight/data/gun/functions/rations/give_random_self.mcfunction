execute store result score #ration_time ration_roll run time query gametime
execute store result score @s ration_roll run data get entity @s UUID[0]
scoreboard players operation @s ration_roll += #ration_time ration_roll
scoreboard players operation @s ration_roll %= #ration_mod ration_roll
execute if score @s ration_roll matches ..-1 run scoreboard players add @s ration_roll 4
scoreboard players add @s ration_roll 1
execute if score @s ration_roll matches 1 run item replace entity @s hotbar.5 with minecraft:cooked_beef{display:{Name:'{"text":"Rations","italic":false}'}} 16
execute if score @s ration_roll matches 2 run item replace entity @s hotbar.5 with minecraft:cooked_porkchop{display:{Name:'{"text":"Rations","italic":false}'}} 16
execute if score @s ration_roll matches 3 run item replace entity @s hotbar.5 with minecraft:cooked_chicken{display:{Name:'{"text":"Rations","italic":false}'}} 16
execute if score @s ration_roll matches 4 run item replace entity @s hotbar.5 with minecraft:baked_potato{display:{Name:'{"text":"Rations","italic":false}'}} 16
