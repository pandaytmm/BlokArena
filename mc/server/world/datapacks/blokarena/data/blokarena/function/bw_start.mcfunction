team add bw_red
team modify bw_red color red
team modify bw_red friendlyFire false
team modify bw_red prefix {"text":"[K] ","color":"red"}
team add bw_blue
team modify bw_blue color blue
team modify bw_blue friendlyFire false
team modify bw_blue prefix {"text":"[M] ","color":"blue"}
tag @a remove bw_red
tag @a remove bw_blue
tag @a remove bw_red_nobed
tag @a remove bw_blue_nobed
tag @a remove bw_eliminated
scoreboard players set #red bw_joined 0
scoreboard players set #blue bw_joined 0
function blokarena:bw_beds_reset
scoreboard players set #match bw_state 1
title @a title {"text":"BEDWARS BASLADI","color":"gold","bold":true}
title @a subtitle {"text":"Yatagini koru, rakibinkini kir","color":"gray"}
