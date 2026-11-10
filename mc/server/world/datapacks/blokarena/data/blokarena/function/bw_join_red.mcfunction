execute unless score #match bw_state matches 1 run function blokarena:bw_start
team join bw_red @s
tag @s remove bw_blue
tag @s remove bw_eliminated
tag @s remove bw_blue_nobed
tag @s remove bw_red_nobed
tag @s add bw_red
execute unless block 300 120 4 minecraft:red_bed run tag @s add bw_red_nobed
spawnpoint @s 300 120 0
scoreboard players set @s bw_deaths 0
scoreboard players add #red bw_joined 1
gamemode survival @s
tp @s 300.5 120 0.5 90 0
function blokarena:bw_kit_red
title @s title {"text":"KIRMIZI TAKIM","color":"red","bold":true}
title @s subtitle {"text":"Yatagini koru, rakip yatagi kir","color":"gray"}
