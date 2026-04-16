tellraw @a ["[Lowell] Red reached ",{"score":{"name":"#target","objective":"tdm_kill_target"}}," kills"]
title @a times 1s 3s 1s
title @a title ["",{"text":"Red","bold":true,"color":"red"},{"text":" Wins"}]
function gun:stats/match_all
function gun:stats/win_red
gambitstats postgame
function gun:pleft/close
schedule function gun:gameend 5s
