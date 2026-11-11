give @s minecraft:crossbow[minecraft:custom_name='{"text":"SMG","color":"light_purple","italic":false}',minecraft:lore=['{"text":"Seri ates, delip gecer","color":"gray","italic":false}','{"text":"Mermi: ok","color":"dark_gray","italic":false}'],minecraft:enchantments={levels:{"minecraft:quick_charge":3,"minecraft:piercing":3,"minecraft:unbreaking":3}}] 1
give @s minecraft:arrow 64
execute at @s run playsound minecraft:entity.arrow.shoot player @s ~ ~ ~ 0.7 1.4
title @s actionbar {"text":"SMG alindi (64 ok)","color":"light_purple"}
