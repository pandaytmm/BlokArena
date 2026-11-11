function blokarena:bw_leave
tag @s add kitpvp
gamemode survival @s
effect clear @s
clear @s
spawnpoint @s 572 120 0
tp @s 572.5 120 0.5 90 0
function blokarena:kitpvp_loadout
title @s title {"text":"KITPVP","color":"gold","bold":true}
title @s subtitle {"text":"Her dogusta yeni kit","color":"gray"}
