# Reset match state (objectives persist across matches)
scoreboard players set #Red rcount 0
scoreboard players set #Blue bcount 0
scoreboard players set Red teams 0
scoreboard players set Blue teams 0
scoreboard players set #mode mode_respawns 0
scoreboard players set #map map_id 0
scoreboard players set #Red tdm_red_kills 0
scoreboard players set #Blue tdm_blue_kills 0
scoreboard players set Red tdm_kills 0
scoreboard players set Blue tdm_kills 0
scoreboard players set #ui pleft_ui_timer 0
scoreboard players set #ration_mod ration_roll 4
scoreboard players set #warn_gap tdm_ui 5
scoreboard players set #RedWarn tdm_ui 0
scoreboard players set #BlueWarn tdm_ui 0
scoreboard players set #RedLeft tdm_ui 0
scoreboard players set #BlueLeft tdm_ui 0
scoreboard players set @a tdm_respawn_timer 0
scoreboard players set @a spec_respawn_timer 0
scoreboard players set #mode mode_id -1
scoreboard objectives setdisplay sidebar
schedule clear gun:pleft/loop
schedule clear gun:death/loop