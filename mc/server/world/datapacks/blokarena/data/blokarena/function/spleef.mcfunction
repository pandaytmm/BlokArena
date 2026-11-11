function blokarena:bw_leave
execute unless entity @a[tag=spleef] unless entity @a[tag=spleef_out] run fill 500 119 -12 524 119 12 minecraft:snow_block
tag @s add spleef
tag @s remove spleef_out
scoreboard players add #spleef_joined spleef_state 1
scoreboard players set #spleef_started spleef_state 1
gamemode survival @s
effect clear @s
clear @s
tp @s 512.5 120 0.5 0 0
give @s minecraft:iron_shovel[minecraft:unbreakable={show_in_tooltip:false},minecraft:custom_name='{"text":"SPLEEF KUREGI","color":"aqua","italic":false}'] 1
give @s minecraft:snowball 16
title @s title {"text":"SPLEEF","color":"aqua","bold":true}
title @s subtitle {"text":"Altindaki kari kir, dusme","color":"gray"}
title @s actionbar {"text":"Kurek ile kar kir","color":"yellow"}
