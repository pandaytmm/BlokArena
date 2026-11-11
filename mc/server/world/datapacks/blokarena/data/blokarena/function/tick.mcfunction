# --- lobby korumasi ---
execute as @a[x=-17,y=139,z=-17,dx=34,dy=10,dz=34,gamemode=survival] run gamemode adventure @s
execute as @a[tag=bw_red,x=-17,y=139,z=-17,dx=34,dy=10,dz=34] run function blokarena:bw_leave
execute as @a[tag=bw_blue,x=-17,y=139,z=-17,dx=34,dy=10,dz=34] run function blokarena:bw_leave

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
execute as @a[scores={menu=7}] run function blokarena:spleef
execute as @a[scores={menu=8}] run function blokarena:kitpvp
execute as @a[scores={menu=9}] run function blokarena:hub
scoreboard players reset @a menu
scoreboard players enable @a menu

# --- bedwars yatak kontrolu ---
execute if score #match bw_state matches 1 if entity @a[tag=bw_red,tag=!bw_red_nobed] unless block 300 120 4 minecraft:red_bed run function blokarena:bw_bed_lost_red
execute if score #match bw_state matches 1 if entity @a[tag=bw_blue,tag=!bw_blue_nobed] unless block 360 120 4 minecraft:blue_bed run function blokarena:bw_bed_lost_blue

# --- bedwars olum / yeniden dogma ---
execute as @a[tag=bw_red,scores={bw_deaths=1..}] unless block 300 120 4 minecraft:red_bed run function blokarena:bw_elim_red
execute as @a[tag=bw_blue,scores={bw_deaths=1..}] unless block 360 120 4 minecraft:blue_bed run function blokarena:bw_elim_blue
execute as @a[tag=bw_red,scores={bw_deaths=1..},nbt={Health:1.0f..}] if block 300 120 4 minecraft:red_bed run function blokarena:bw_respawn_red
execute as @a[tag=bw_blue,scores={bw_deaths=1..},nbt={Health:1.0f..}] if block 360 120 4 minecraft:blue_bed run function blokarena:bw_respawn_blue

# --- bedwars kazanan ---
execute if score #match bw_state matches 1 if score #red bw_joined matches 1.. if score #blue bw_joined matches 1.. if entity @a[tag=bw_blue,tag=!bw_eliminated] unless entity @a[tag=bw_red,tag=!bw_eliminated] run function blokarena:bw_win_blue
execute if score #match bw_state matches 1 if score #red bw_joined matches 1.. if score #blue bw_joined matches 1.. if entity @a[tag=bw_red,tag=!bw_eliminated] unless entity @a[tag=bw_blue,tag=!bw_eliminated] run function blokarena:bw_win_red
execute if score #match bw_state matches 1 unless entity @a[tag=bw_red] unless entity @a[tag=bw_blue] run function blokarena:bw_reset

# --- spleef ---
execute as @a[tag=spleef] unless entity @s[x=498,y=117,z=-14,dx=28,dy=14,dz=28] run function blokarena:spleef_out
scoreboard players set #spleef spleef_alive 0
execute as @a[tag=spleef] run scoreboard players add #spleef spleef_alive 1
execute if score #spleef_started spleef_state matches 1 if score #spleef_joined spleef_state matches 2.. if score #spleef spleef_alive matches 1 as @a[tag=spleef] run function blokarena:spleef_win
execute if score #spleef_started spleef_state matches 1 unless entity @a[tag=spleef] unless entity @a[tag=spleef_out] run function blokarena:spleef_reset_state

# --- kitpvp ---
execute as @a[tag=kitpvp,scores={bw_deaths=1..}] run function blokarena:kitpvp_respawn
