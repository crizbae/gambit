tag @r[gamemode=!creative,gamemode=!spectator,tag=!Red,tag=!Blue,tag=!gun_optout] add Blue
tag @r[gamemode=!creative,gamemode=!spectator,tag=!Red,tag=!Blue,tag=!gun_optout] add Red
execute if entity @a[gamemode=!creative,gamemode=!spectator,tag=!Red,tag=!Blue,tag=!gun_optout] run function gun:teams/randomize/loop
