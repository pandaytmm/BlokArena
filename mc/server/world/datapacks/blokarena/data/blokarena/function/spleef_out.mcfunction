tag @s remove spleef
tag @s add spleef_out
gamemode spectator @s
effect clear @s
clear @s
tp @s 512.5 128 0.5 0 0
title @s title {"text":"ELENDIN","color":"red","bold":true}
title @s subtitle {"text":"Arenadan dustun","color":"gray"}
tellraw @s [{"text":"[ HUBA DON ]","color":"gold","bold":true,"clickEvent":{"action":"run_command","value":"/trigger menu set 9"}}]
execute at @s run playsound minecraft:entity.player.hurt player @s ~ ~ ~ 1 0.8
