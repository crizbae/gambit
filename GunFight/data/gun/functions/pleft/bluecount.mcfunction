scoreboard players set #Blue bcount 0
execute as @a[tag=Blue,gamemode=!creative,gamemode=!spectator] run scoreboard players add #Blue bcount 1
scoreboard players operation Blue teams = #Blue bcount