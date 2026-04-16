tag @a remove Red
tag @a remove Blue
function gun:teams/randomize/loop
tellraw @a[tag=Blue] ["[Lowell]  You're on the ",{"text":"Blue Team!","color":"aqua"}]
tellraw @a[tag=Red] ["[Lowell]  You're on the ",{"text":"Red Team!","color":"dark_red"}]
team join red @a[tag=Red]
team join blue @a[tag=Blue]
function gun:pleft/build
scoreboard objectives setdisplay sidebar teams
schedule function gun:pleft/loop 20t
