function gun:pleft/bluecount
function gun:pleft/redcount
execute unless score #mode mode_respawns matches 1 unless score #mode mode_id matches -1 run execute store result bossbar gun:elim_red value run scoreboard players get #Red rcount
execute unless score #mode mode_respawns matches 1 unless score #mode mode_id matches -1 run bossbar set gun:elim_red name [{"text":"\u25cf Red  ","color":"red"},{"score":{"name":"#Red","objective":"rcount"},"color":"white"}]
execute unless score #mode mode_respawns matches 1 unless score #mode mode_id matches -1 run execute store result bossbar gun:elim_blue value run scoreboard players get #Blue bcount
execute unless score #mode mode_respawns matches 1 unless score #mode mode_id matches -1 run bossbar set gun:elim_blue name [{"text":"\u25cf Blue  ","color":"aqua"},{"score":{"name":"#Blue","objective":"bcount"},"color":"white"}]
execute unless score #mode mode_id matches -1 unless score #mode mode_respawns matches 1 run scoreboard players operation §cRed pleft_sidebar = #Red rcount
execute unless score #mode mode_id matches -1 unless score #mode mode_respawns matches 1 run scoreboard players operation §bBlue pleft_sidebar = #Blue bcount
execute unless score #mode mode_id matches -1 if score #mode mode_respawns matches 1 run scoreboard players operation §cRed tdm_kills = #Red tdm_red_kills
execute unless score #mode mode_id matches -1 if score #mode mode_respawns matches 1 run scoreboard players operation §bBlue tdm_kills = #Blue tdm_blue_kills
execute as @a[tag=gun_optout] run title @s actionbar [{"text":"Spectate Mode","color":"yellow","bold":true},{"text":" - use ","color":"gray"},{"text":"/play","color":"green"},{"text":" to queue","color":"gray"}]
execute unless score #mode mode_id matches -1 if score #mode mode_respawns matches 1 run function gun:tdm/win_check
execute unless score #mode mode_id matches -1 unless score #mode mode_respawns matches 1 if score #Blue bcount matches 0 unless score #Red rcount matches 0 run function gun:pleft/rwin
execute unless score #mode mode_id matches -1 unless score #mode mode_respawns matches 1 if score #Red rcount matches 0 unless score #Blue bcount matches 0 run function gun:pleft/bwin
execute unless score #mode mode_id matches -1 unless score #mode mode_respawns matches 1 if score #Red rcount matches 0 if score #Blue bcount matches 0 run function gun:pleft/tie
function gun:pleft/actionbar_status
execute unless score #mode mode_id matches -1 run schedule function gun:pleft/loop 20t