give @s minecraft:crossbow[minecraft:custom_name='{"text":"SHOTGUN","color":"aqua","italic":false}',minecraft:lore=['{"text":"3 ok ayni anda","color":"gray","italic":false}','{"text":"Yakin mesafe","color":"dark_gray","italic":false}'],minecraft:enchantments={levels:{"minecraft:multishot":1,"minecraft:quick_charge":2,"minecraft:unbreaking":3}}] 1
give @s minecraft:arrow 24
execute at @s run playsound minecraft:entity.arrow.shoot player @s ~ ~ ~ 0.9 1.0
title @s actionbar {"text":"SHOTGUN alindi (24 ok)","color":"aqua"}
