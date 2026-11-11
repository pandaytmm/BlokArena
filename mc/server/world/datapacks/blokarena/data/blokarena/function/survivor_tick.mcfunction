execute if block -202 112 2 minecraft:chest run loot replace block -202 112 2 container.0 loot blokarena:survivor_drop
execute if block -202 112 2 minecraft:chest run loot replace block -202 112 2 container.1 loot blokarena:survivor_drop
execute if block -202 112 2 minecraft:chest run loot replace block -202 112 2 container.2 loot blokarena:survivor_drop
execute if block -202 112 2 minecraft:chest run loot replace block -202 112 2 container.3 loot blokarena:survivor_drop
execute if block -202 112 2 minecraft:chest run loot replace block -202 112 2 container.4 loot blokarena:survivor_drop
execute if block -202 112 2 minecraft:chest run loot replace block -202 112 2 container.5 loot blokarena:survivor_drop
title @a[x=-220,y=100,z=-20,dx=40,dy=30,dz=40,gamemode=survival] actionbar {"text":"Erzak sandigi dolduruldu","color":"green"}
execute as @a[x=-220,y=100,z=-20,dx=40,dy=30,dz=40,gamemode=survival] at @s run playsound minecraft:block.chest.open player @s ~ ~ ~ 0.6 1
scoreboard players add #wave survivor 1
execute if score #wave survivor matches 3.. run function blokarena:survivor_wave
execute if entity @a[x=-220,y=100,z=-20,dx=40,dy=30,dz=40,gamemode=survival] run schedule function blokarena:survivor_tick 60s
