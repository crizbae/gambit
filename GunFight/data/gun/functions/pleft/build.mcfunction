scoreboard objectives add rcount dummy
scoreboard objectives add bcount dummy
scoreboard objectives add teams dummy "Players Left"
scoreboard objectives add mode_id dummy
scoreboard objectives add mode_respawns dummy
scoreboard objectives add map_id dummy
scoreboard objectives add tdm_red_kills dummy
scoreboard objectives add tdm_blue_kills dummy
scoreboard objectives add tdm_kill_target dummy "Kill Target"
execute unless score #target tdm_kill_target matches 1.. run scoreboard players set #target tdm_kill_target 50
scoreboard objectives add tdm_respawn_timer dummy
scoreboard objectives add spec_respawn_timer dummy
scoreboard objectives add tdm_kills dummy "TDM Kills"
scoreboard objectives add tdm_deaths_counted dummy
scoreboard objectives add gun_deaths deathCount
scoreboard objectives add gun_deaths_prev dummy
scoreboard objectives add ration_roll dummy
scoreboard objectives add pleft_ui_timer dummy
scoreboard objectives add tdm_ui dummy
scoreboard players set #ration_mod ration_roll 4
scoreboard players set #ui pleft_ui_timer 0
scoreboard players set #warn_gap tdm_ui 5
scoreboard players set #RedWarn tdm_ui 0
scoreboard players set #BlueWarn tdm_ui 0
scoreboard players set #RedLeft tdm_ui 0
scoreboard players set #BlueLeft tdm_ui 0
scoreboard players set #mode mode_id 0
scoreboard players set #mode mode_respawns 0
scoreboard players set #map map_id 0
scoreboard players set #Red tdm_red_kills 0
scoreboard players set #Blue tdm_blue_kills 0
scoreboard players set Red tdm_kills 0
scoreboard players set Blue tdm_kills 0