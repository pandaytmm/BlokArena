scoreboard players set @s bw_deaths 0
tag @s add bw_eliminated
spawnpoint @s 330 130 0
gamemode spectator @s
effect clear @s
clear @s
tp @s 330.5 130 0.5 0 0
title @s title {"text":"ELENDIN","color":"dark_blue","bold":true}
title @s subtitle {"text":"Yatagin yoktu","color":"gray"}
tellraw @s [{"text":"Izlemek icin kal veya ","color":"gray"},{"text":"[ HUBA DON ]","color":"gold","bold":true,"clickEvent":{"action":"run_command","value":"/trigger menu set 9"}}]
