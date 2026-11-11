execute if block 328 120 -2 minecraft:chest run loot replace block 328 120 -2 container.0 loot blokarena:bw_center
execute if block 328 120 -2 minecraft:chest run loot replace block 328 120 -2 container.1 loot blokarena:bw_center
execute if block 328 120 -2 minecraft:chest run loot replace block 328 120 -2 container.2 loot blokarena:bw_center
execute if block 328 120 -2 minecraft:chest run loot replace block 328 120 -2 container.3 loot blokarena:bw_center
execute if block 332 120 2 minecraft:chest run loot replace block 332 120 2 container.0 loot blokarena:bw_center
execute if block 332 120 2 minecraft:chest run loot replace block 332 120 2 container.1 loot blokarena:bw_center
execute if block 332 120 2 minecraft:chest run loot replace block 332 120 2 container.2 loot blokarena:bw_center
execute if block 332 120 2 minecraft:chest run loot replace block 332 120 2 container.3 loot blokarena:bw_center
title @a[tag=bw_red] actionbar {"text":"Orta ada sandigi yenilendi","color":"yellow"}
title @a[tag=bw_blue] actionbar {"text":"Orta ada sandigi yenilendi","color":"yellow"}
execute as @a at @s run playsound minecraft:block.chest.open player @s ~ ~ ~ 0.6 1.2
execute if score #match bw_state matches 1 run schedule function blokarena:bw_refill 30s
