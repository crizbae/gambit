title @a[tag=gun_in_match] times 0.3s 1s 0.3s
title @a[tag=gun_in_match] title "Starting"
bossbar set gun:nextmap visible false
effect give @a[tag=gun_in_match] minecraft:blindness 15 0 true
effect give @a[tag=gun_in_match] minecraft:slowness 15 200 true
schedule function gun:countdown/3 1.5s