# Kit selector tick — detect players standing on kit selection blocks
execute as @a[tag=!marksman] at @s if block ~ ~-1 ~ blue_stained_glass if block ~ ~-2 ~ sea_lantern if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/marksman
execute as @a[tag=!breacher] at @s if block ~ ~-1 ~ orange_stained_glass if block ~ ~-2 ~ honeycomb_block if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/breacher
execute as @a[tag=!smg2] at @s if block ~ ~-1 ~ light_blue_stained_glass if block ~ ~-2 ~ prismarine if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/smg2
execute as @a[tag=!assault] at @s if block ~ ~-1 ~ red_stained_glass if block ~ ~-2 ~ shroomlight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/assault
execute as @a[tag=!sniper] at @s if block ~ ~-1 ~ purple_stained_glass if block ~ ~-2 ~ pearlescent_froglight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/sniper
execute as @a[tag=!ranger] at @s if block ~ ~-1 ~ lime_stained_glass if block ~ ~-2 ~ verdant_froglight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/ranger
execute as @a[tag=!burst] at @s if block ~ ~-1 ~ yellow_stained_glass if block ~ ~-2 ~ glowstone if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/burst