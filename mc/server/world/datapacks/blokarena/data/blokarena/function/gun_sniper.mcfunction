give @s minecraft:bow[minecraft:custom_name='{"text":"SNIPER","color":"red","italic":false}',minecraft:lore=['{"text":"Uzak mesafe, yuksek hasar","color":"gray","italic":false}','{"text":"Mermi: ok","color":"dark_gray","italic":false}'],minecraft:enchantments={levels:{"minecraft:power":5,"minecraft:punch":2,"minecraft:unbreaking":3}}] 1
give @s minecraft:arrow 16
execute at @s run playsound minecraft:entity.arrow.shoot player @s ~ ~ ~ 1 0.8
title @s actionbar {"text":"SNIPER alindi (16 ok)","color":"red"}
