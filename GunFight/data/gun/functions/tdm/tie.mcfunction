tellraw @a ["[Lowell] TDM tie at ",{"score":{"name":"#target","objective":"tdm_kill_target"}}," kills"]
title @a times 1s 3s 1s
title @a title [{"text":"Tie","bold":true,"color":"gold"}]
function gun:stats/match_all
gambitstats postgame
function gun:pleft/close
schedule function gun:gameend 5s
