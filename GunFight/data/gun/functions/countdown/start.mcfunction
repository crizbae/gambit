title @a times 0.3s 1s 0.3s
title @a title "Starting"
bossbar set gun:nextmap visible false
effect give @a[gamemode=!creative,gamemode=!spectator] minecraft:blindness 15 0 true
effect give @a[gamemode=!creative,gamemode=!spectator] minecraft:slowness 15 200 true
schedule function gun:countdown/3 1.5s