execute unless score #mode mode_respawns matches 1 run schedule clear gun:tdm/spawnpoints

execute if score #mode mode_respawns matches 1 run gambit_set_spawnpoints

execute if score #mode mode_respawns matches 1 run schedule function gun:tdm/spawnpoints 20t