give @s minecraft:crossbow[minecraft:custom_name='{"text":"AK-47","color":"gold","italic":false}',minecraft:lore=['{"text":"Hizli ates","color":"gray","italic":false}','{"text":"Mermi: ok","color":"dark_gray","italic":false}'],minecraft:enchantments={levels:{"minecraft:quick_charge":3,"minecraft:unbreaking":3}}] 1
give @s minecraft:arrow 32
execute at @s run playsound minecraft:entity.arrow.shoot player @s ~ ~ ~ 0.8 1.2
title @s actionbar {"text":"AK-47 alindi (32 ok)","color":"gold"}
