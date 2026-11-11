scoreboard players set @s bw_deaths 0
gamemode survival @s
tp @s 300.5 120 0.5 90 0
function blokarena:bw_kit_red
effect give @s minecraft:resistance 5 1 true
effect give @s minecraft:regeneration 5 1 true
title @s title {"text":"YENIDEN DOGDUN","color":"red","bold":true}
title @s actionbar {"text":"5sn yeniden dogma korumasi","color":"gray"}
execute at @s run playsound minecraft:block.note_block.pling player @s ~ ~ ~ 0.8 1.4
