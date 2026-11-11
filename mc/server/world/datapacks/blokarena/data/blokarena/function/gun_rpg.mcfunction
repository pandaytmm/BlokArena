give @s minecraft:crossbow[minecraft:custom_name='{"text":"RPG","color":"dark_red","italic":false}',minecraft:lore=['{"text":"Patlayici roket","color":"gray","italic":false}','{"text":"Mermi: roket","color":"dark_gray","italic":false}'],minecraft:enchantments={levels:{"minecraft:quick_charge":3,"minecraft:unbreaking":3}}] 1
give @s minecraft:firework_rocket[minecraft:custom_name='{"text":"ROKET","color":"red","italic":false}',minecraft:fireworks={flight_duration:1,explosions:[{shape:"large_ball",colors:[I;11743532],has_trail:1b,has_twinkle:1b}]}] 8
execute at @s run playsound minecraft:entity.arrow.shoot player @s ~ ~ ~ 1 0.7
title @s actionbar {"text":"RPG alindi (8 roket)","color":"dark_red"}
