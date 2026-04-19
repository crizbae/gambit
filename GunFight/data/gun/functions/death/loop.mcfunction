function gun:death/stuck_cleanup
function gun:death/detect
function gun:death/respawn_tick
execute unless score #mode mode_id matches -1 run schedule function gun:death/loop 1t
