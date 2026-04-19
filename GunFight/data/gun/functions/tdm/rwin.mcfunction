tellraw @a ["[Lowell] Red reached ",{"score":{"name":"#target","objective":"tdm_kill_target"}}," kills"]
title @a times 1s 3s 1s
title @a title ["",{"text":"Red","bold":true,"color":"red"},{"text":" Wins"}]
function gun:stats/win_red
gambit_log_match red
function gun:win_common
