tellraw @a "[Lowell] Red has 0 Players Remaining"
title @a times 1s 3s 1s
title @a title ["",{"text":"Blue","bold":true,"color":"aqua"},{"text":" Wins"}]
function gun:stats/win_blue
gambit_log_match blue
function gun:win_common