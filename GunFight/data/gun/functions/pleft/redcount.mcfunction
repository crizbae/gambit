scoreboard players set #Red rcount 0
execute as @a[tag=Red,gamemode=!creative,gamemode=!spectator] run scoreboard players add #Red rcount 1
scoreboard players operation Red teams = #Red rcount