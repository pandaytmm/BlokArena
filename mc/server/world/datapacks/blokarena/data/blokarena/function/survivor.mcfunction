function blokarena:bw_leave
gamemode survival @s
effect clear @s
clear @s
tp @s -200.5 112 0.5 0 0
give @s minecraft:stone_sword 1
give @s minecraft:stone_pickaxe 1
give @s minecraft:stone_axe 1
give @s minecraft:iron_ingot 8
give @s minecraft:fishing_rod 1
give @s minecraft:water_bucket 1
give @s minecraft:wheat_seeds 8
give @s minecraft:bread 8
give @s minecraft:oak_planks 32
give @s minecraft:torch 16
give @s minecraft:crafting_table 1
title @s title {"text":"SURVIVOR","color":"green","bold":true}
title @s subtitle {"text":"Ada senin, hayatta kal","color":"gray"}
title @s actionbar {"text":"Erzak sandigi 60 saniyede yenilenir","color":"yellow"}
schedule function blokarena:survivor_tick 60s
