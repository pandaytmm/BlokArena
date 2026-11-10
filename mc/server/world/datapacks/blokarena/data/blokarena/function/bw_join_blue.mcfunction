execute unless score #match bw_state matches 1 run function blokarena:bw_start
team join bw_blue @s
tag @s remove bw_red
tag @s remove bw_eliminated
tag @s remove bw_red_nobed
tag @s remove bw_blue_nobed
tag @s add bw_blue
execute unless block 360 120 4 minecraft:blue_bed run tag @s add bw_blue_nobed
spawnpoint @s 360 120 0
scoreboard players set @s bw_deaths 0
scoreboard players add #blue bw_joined 1
gamemode survival @s
tp @s 360.5 120 0.5 270 0
function blokarena:bw_kit_blue
title @s title {"text":"MAVI TAKIM","color":"blue","bold":true}
title @s subtitle {"text":"Yatagini koru, rakip yatagi kir","color":"gray"}
