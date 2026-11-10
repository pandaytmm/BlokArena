# --- lobby korumasi ---
execute as @a[x=-17,y=139,z=-17,dx=34,dy=10,dz=34,gamemode=survival] run gamemode adventure @s

# --- giris menusu ---
execute as @a[tag=!lobby_seen,x=-17,y=139,z=-17,dx=34,dy=10,dz=34] run function blokarena:menu_join
execute as @a[tag=lobby_seen] unless entity @s[x=-17,y=139,z=-17,dx=34,dy=10,dz=34] run tag @s remove lobby_seen

# --- menu tetikleyicileri ---
execute as @a[scores={menu=1}] run function blokarena:pvp
execute as @a[scores={menu=2}] run function blokarena:guns
execute as @a[scores={menu=3}] run function blokarena:survivor
execute as @a[scores={menu=4}] run function blokarena:random
execute as @a[scores={menu=5}] run function blokarena:bw_join_red
execute as @a[scores={menu=6}] run function blokarena:bw_join_blue
scoreboard players reset @a menu
scoreboard players enable @a menu

# --- bedwars yatak kontrolu ---
execute as @a[tag=bw_red,tag=!bw_red_nobed] unless block 300 120 4 minecraft:red_bed run function blokarena:bw_bed_lost_red
execute as @a[tag=bw_blue,tag=!bw_blue_nobed] unless block 360 120 4 minecraft:blue_bed run function blokarena:bw_bed_lost_blue

# --- bedwars olum / yeniden dogma ---
execute as @a[tag=bw_red,scores={bw_deaths=1..}] unless block 300 120 4 minecraft:red_bed run function blokarena:bw_elim_red
execute as @a[tag=bw_blue,scores={bw_deaths=1..}] unless block 360 120 4 minecraft:blue_bed run function blokarena:bw_elim_blue
execute as @a[tag=bw_red,scores={bw_deaths=1..},nbt={Health:1.0f..}] if block 300 120 4 minecraft:red_bed run function blokarena:bw_respawn_red
execute as @a[tag=bw_blue,scores={bw_deaths=1..},nbt={Health:1.0f..}] if block 360 120 4 minecraft:blue_bed run function blokarena:bw_respawn_blue

# --- bedwars kazanan ---
execute if score #match bw_state matches 1 if score #red bw_joined matches 1.. if score #blue bw_joined matches 1.. if entity @a[tag=bw_blue,tag=!bw_eliminated] unless entity @a[tag=bw_red,tag=!bw_eliminated] run function blokarena:bw_win_blue
execute if score #match bw_state matches 1 if score #red bw_joined matches 1.. if score #blue bw_joined matches 1.. if entity @a[tag=bw_red,tag=!bw_eliminated] unless entity @a[tag=bw_blue,tag=!bw_eliminated] run function blokarena:bw_win_red
execute if score #match bw_state matches 1 unless entity @a[tag=bw_red] unless entity @a[tag=bw_blue] run function blokarena:bw_reset
