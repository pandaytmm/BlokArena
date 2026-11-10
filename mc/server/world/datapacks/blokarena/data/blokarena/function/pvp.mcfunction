function blokarena:bw_leave
gamemode survival @s
effect clear @s
clear @s
tp @s 200.5 120 0.5 90 0
give @s minecraft:iron_helmet 1
give @s minecraft:iron_chestplate 1
give @s minecraft:iron_leggings 1
give @s minecraft:iron_boots 1
give @s minecraft:iron_sword[minecraft:enchantments={levels:{"minecraft:sharpness":3}}] 1
give @s minecraft:bow[minecraft:enchantments={levels:{"minecraft:power":2}}] 1
give @s minecraft:arrow 24
give @s minecraft:shield 1
give @s minecraft:golden_apple 4
give @s minecraft:cooked_beef 8
title @s title {"text":"PVP ARENASI","color":"red","bold":true}
title @s subtitle {"text":"Son kalan kazanir","color":"gray"}
