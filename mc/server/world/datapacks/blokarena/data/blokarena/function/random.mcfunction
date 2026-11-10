function blokarena:bw_leave
gamemode survival @s
effect clear @s
clear @s
tp @s 0.5 120 300.5 180 0
give @s minecraft:stone_sword 1
give @s minecraft:bread 8
title @s title {"text":"RANDOM ITEM","color":"light_purple","bold":true}
title @s subtitle {"text":"Her 4 saniyede rastgele item","color":"gray"}
schedule function blokarena:random_tick 4s
