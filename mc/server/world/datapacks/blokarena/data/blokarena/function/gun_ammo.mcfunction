give @s minecraft:arrow 64
give @s minecraft:firework_rocket[minecraft:custom_name='{"text":"ROKET","color":"red","italic":false}',minecraft:fireworks={flight_duration:1,explosions:[{shape:"large_ball",colors:[I;11743532],has_trail:1b,has_twinkle:1b}]}] 4
execute at @s run playsound minecraft:entity.item.pickup player @s ~ ~ ~ 0.7 1.3
title @s actionbar {"text":"64 ok + 4 roket alindi","color":"yellow"}
