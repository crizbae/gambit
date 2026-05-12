bossbar set gun:tdm_red name [{"text":"● Red  ","color":"red"},{"score":{"name":"#Red","objective":"tdm_red_kills"},"color":"white"},{"text":" / ","color":"gray"},{"score":{"name":"#target","objective":"tdm_kill_target"},"color":"white"}]
execute store result bossbar gun:tdm_red value run scoreboard players get #Red tdm_red_kills
bossbar set gun:tdm_blue name [{"text":"● Blue  ","color":"aqua"},{"score":{"name":"#Blue","objective":"tdm_blue_kills"},"color":"white"},{"text":" / ","color":"gray"},{"score":{"name":"#target","objective":"tdm_kill_target"},"color":"white"}]
execute store result bossbar gun:tdm_blue value run scoreboard players get #Blue tdm_blue_kills
scoreboard players operation #RedLeft tdm_ui = #target tdm_kill_target
scoreboard players operation #RedLeft tdm_ui -= #Red tdm_red_kills
execute if score #RedLeft tdm_ui matches ..-1 run scoreboard players set #RedLeft tdm_ui 0
scoreboard players operation #BlueLeft tdm_ui = #target tdm_kill_target
scoreboard players operation #BlueLeft tdm_ui -= #Blue tdm_blue_kills
execute if score #BlueLeft tdm_ui matches ..-1 run scoreboard players set #BlueLeft tdm_ui 0
execute if score #RedWarn tdm_ui matches 0 if score #RedLeft tdm_ui matches ..5 run function gun:tdm/warn_red_match_point
execute if score #RedWarn tdm_ui matches 0 if score #RedLeft tdm_ui matches ..5 run scoreboard players set #RedWarn tdm_ui 1
execute if score #BlueWarn tdm_ui matches 0 if score #BlueLeft tdm_ui matches ..5 run function gun:tdm/warn_blue_match_point
execute if score #BlueWarn tdm_ui matches 0 if score #BlueLeft tdm_ui matches ..5 run scoreboard players set #BlueWarn tdm_ui 1
execute if score #Red tdm_red_kills >= #target tdm_kill_target if score #Blue tdm_blue_kills >= #target tdm_kill_target if score #Red tdm_red_kills = #Blue tdm_blue_kills run function gun:tdm/tie
execute if score #Red tdm_red_kills >= #target tdm_kill_target if score #Blue tdm_blue_kills >= #target tdm_kill_target if score #Red tdm_red_kills > #Blue tdm_blue_kills run function gun:tdm/rwin
execute if score #Red tdm_red_kills >= #target tdm_kill_target if score #Blue tdm_blue_kills >= #target tdm_kill_target if score #Blue tdm_blue_kills > #Red tdm_red_kills run function gun:tdm/bwin
execute if score #Red tdm_red_kills >= #target tdm_kill_target unless score #Blue tdm_blue_kills >= #target tdm_kill_target run function gun:tdm/rwin
execute if score #Blue tdm_blue_kills >= #target tdm_kill_target unless score #Red tdm_red_kills >= #target tdm_kill_target run function gun:tdm/bwin
