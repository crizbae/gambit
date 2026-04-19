tellraw @a ["[Lowell] TDM tie at ",{"score":{"name":"#target","objective":"tdm_kill_target"}}," kills"]
title @a times 1s 3s 1s
title @a title [{"text":"Tie","bold":true,"color":"gold"}]
gambit_log_match tie
function gun:win_common
