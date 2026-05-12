# Reset match state (objectives are created once at server load via KubeJS)
scoreboard players set #Red rcount 0
scoreboard players set #Blue bcount 0
scoreboard players set Red teams 0
scoreboard players set Blue teams 0
scoreboard players set #mode mode_id 0
scoreboard players set #mode mode_respawns 0
scoreboard players set #map map_id 0
scoreboard players set #Red tdm_red_kills 0
scoreboard players set #Blue tdm_blue_kills 0
scoreboard players set #ui pleft_ui_timer 0
scoreboard players set #match_started pleft_ui_timer 0
scoreboard players set @a life_kills 0
scoreboard players set @a life_dmg 0
scoreboard players reset Red pleft_sidebar
scoreboard players reset Blue pleft_sidebar
scoreboard players reset Goal pleft_sidebar
scoreboard players set #ration_mod ration_roll 4
scoreboard players set #warn_gap tdm_ui 5
scoreboard players set #RedWarn tdm_ui 0
scoreboard players set #BlueWarn tdm_ui 0
scoreboard players set #RedLeft tdm_ui 0
scoreboard players set #BlueLeft tdm_ui 0
scoreboard players set @a tdm_respawn_timer 0
scoreboard players set @a spec_respawn_timer 0
execute unless score #target tdm_kill_target matches 1.. run scoreboard players set #target tdm_kill_target 50