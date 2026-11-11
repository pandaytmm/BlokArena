give @s minecraft:crossbow[minecraft:custom_name='{"text":"TABANCA","color":"yellow","italic":false}',minecraft:lore=['{"text":"Hizli ve hafif","color":"gray","italic":false}','{"text":"Mermi: ok","color":"dark_gray","italic":false}'],minecraft:enchantments={levels:{"minecraft:quick_charge":3,"minecraft:unbreaking":3}}] 1
give @s minecraft:arrow 16
execute at @s run playsound minecraft:entity.arrow.shoot player @s ~ ~ ~ 0.6 1.6
title @s actionbar {"text":"TABANCA alindi (16 ok)","color":"yellow"}
