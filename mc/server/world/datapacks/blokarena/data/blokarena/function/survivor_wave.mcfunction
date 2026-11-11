scoreboard players set #wave survivor 0
execute if entity @a[x=-220,y=100,z=-20,dx=40,dy=30,dz=40,gamemode=survival] unless entity @e[tag=surv_zombie] run summon minecraft:zombie -214 112 -12 {Tags:["surv_zombie"]}
execute if entity @a[x=-220,y=100,z=-20,dx=40,dy=30,dz=40,gamemode=survival] unless entity @e[tag=surv_skeleton] run summon minecraft:skeleton -186 112 12 {Tags:["surv_skeleton"]}
execute if entity @a[x=-220,y=100,z=-20,dx=40,dy=30,dz=40,gamemode=survival] unless entity @e[tag=surv_spider] run summon minecraft:spider -200 112 -16 {Tags:["surv_spider"]}
title @a[x=-220,y=100,z=-20,dx=40,dy=30,dz=40,gamemode=survival] title {"text":"MOB DALGASI","color":"red","bold":true}
title @a[x=-220,y=100,z=-20,dx=40,dy=30,dz=40,gamemode=survival] subtitle {"text":"Adada dusmanlar var","color":"gray"}
execute as @a[x=-220,y=100,z=-20,dx=40,dy=30,dz=40,gamemode=survival] at @s run playsound minecraft:entity.zombie.ambient player @s ~ ~ ~ 0.9 0.6
