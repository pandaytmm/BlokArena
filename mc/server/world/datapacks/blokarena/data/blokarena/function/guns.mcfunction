function blokarena:bw_leave
gamemode survival @s
effect clear @s
clear @s
tp @s 0.5 120 202.5 180 0
give @s minecraft:iron_helmet 1
give @s minecraft:iron_chestplate 1
give @s minecraft:iron_leggings 1
give @s minecraft:iron_boots 1
give @s minecraft:shield 1
give @s minecraft:crossbow[minecraft:enchantments={levels:{"minecraft:quick_charge":3,"minecraft:unbreaking":3}}] 1
give @s minecraft:crossbow[minecraft:enchantments={levels:{"minecraft:multishot":1,"minecraft:quick_charge":2,"minecraft:unbreaking":3}}] 1
give @s minecraft:bow[minecraft:enchantments={levels:{"minecraft:power":5,"minecraft:punch":2,"minecraft:unbreaking":3}}] 1
give @s minecraft:arrow 64
give @s minecraft:golden_apple 4
give @s minecraft:cooked_beef 8
title @s title {"text":"GUNS PVP","color":"aqua","bold":true}
title @s subtitle {"text":"Sag tik ile ates et","color":"gray"}
title @s actionbar {"text":"AK-47 / SHOTGUN / SNIPER envanterinde","color":"yellow"}
