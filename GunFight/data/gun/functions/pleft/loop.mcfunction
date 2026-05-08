function gun:pleft/bluecount
function gun:pleft/redcount
execute as @a[tag=gun_optout] run title @s actionbar [{"text":"Spectate Mode","color":"yellow","bold":true},{"text":" - use ","color":"gray"},{"text":"/play","color":"green"},{"text":" to queue","color":"gray"}]
execute unless score #mode mode_id matches -1 if score #mode mode_respawns matches 1 run function gun:tdm/win_check
execute unless score #mode mode_id matches -1 unless score #mode mode_respawns matches 1 if score #Blue bcount matches 0 unless score #Red rcount matches 0 run function gun:pleft/rwin
execute unless score #mode mode_id matches -1 unless score #mode mode_respawns matches 1 if score #Red rcount matches 0 unless score #Blue bcount matches 0 run function gun:pleft/bwin
execute unless score #mode mode_id matches -1 unless score #mode mode_respawns matches 1 if score #Red rcount matches 0 if score #Blue bcount matches 0 run function gun:pleft/tie
function gun:pleft/actionbar_status
execute unless score #mode mode_id matches -1 run schedule function gun:pleft/loop 20t