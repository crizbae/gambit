# Kit selector tick — detect players standing on kit selection blocks (in-match only)
execute as @a[tag=!marksman,team=red] at @s if block ~ ~-1 ~ blue_stained_glass if block ~ ~-2 ~ sea_lantern if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/marksman
execute as @a[tag=!marksman,team=blue] at @s if block ~ ~-1 ~ blue_stained_glass if block ~ ~-2 ~ sea_lantern if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/marksman
execute as @a[tag=!breacher,team=red] at @s if block ~ ~-1 ~ orange_stained_glass if block ~ ~-2 ~ honeycomb_block if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/breacher
execute as @a[tag=!breacher,team=blue] at @s if block ~ ~-1 ~ orange_stained_glass if block ~ ~-2 ~ honeycomb_block if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/breacher
execute as @a[tag=!flanker,team=red] at @s if block ~ ~-1 ~ light_blue_stained_glass if block ~ ~-2 ~ prismarine if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/flanker
execute as @a[tag=!flanker,team=blue] at @s if block ~ ~-1 ~ light_blue_stained_glass if block ~ ~-2 ~ prismarine if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/flanker
execute as @a[tag=!assault,team=red] at @s if block ~ ~-1 ~ red_stained_glass if block ~ ~-2 ~ shroomlight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/assault
execute as @a[tag=!assault,team=blue] at @s if block ~ ~-1 ~ red_stained_glass if block ~ ~-2 ~ shroomlight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/assault
execute as @a[tag=!sniper,team=red] at @s if block ~ ~-1 ~ purple_stained_glass if block ~ ~-2 ~ pearlescent_froglight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/sniper
execute as @a[tag=!sniper,team=blue] at @s if block ~ ~-1 ~ purple_stained_glass if block ~ ~-2 ~ pearlescent_froglight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/sniper
execute as @a[tag=!ranger,team=red] at @s if block ~ ~-1 ~ lime_stained_glass if block ~ ~-2 ~ verdant_froglight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/ranger
execute as @a[tag=!ranger,team=blue] at @s if block ~ ~-1 ~ lime_stained_glass if block ~ ~-2 ~ verdant_froglight if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/ranger
execute as @a[tag=!burst,team=red] at @s if block ~ ~-1 ~ yellow_stained_glass if block ~ ~-2 ~ glowstone if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/burst
execute as @a[tag=!burst,team=blue] at @s if block ~ ~-1 ~ yellow_stained_glass if block ~ ~-2 ~ glowstone if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/burst
execute as @a[tag=!sentry,team=red] at @s if block ~ ~-1 ~ pink_stained_glass if block ~ ~-2 ~ pink_glazed_terracotta if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/sentry
execute as @a[tag=!sentry,team=blue] at @s if block ~ ~-1 ~ pink_stained_glass if block ~ ~-2 ~ pink_glazed_terracotta if block ~ ~-3 ~ dried_kelp_block run function gun:selectors/sentry