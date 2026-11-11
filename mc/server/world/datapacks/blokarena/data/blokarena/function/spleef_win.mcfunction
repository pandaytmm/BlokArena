title @a times 10 60 20
title @a title {"text":"SPLEEF KAZANANI","color":"gold","bold":true}
title @a subtitle [{"text":"Kazanan: ","color":"gray"},{"selector":"@s","color":"aqua","bold":true}]
execute as @a at @s run playsound minecraft:ui.toast.challenge_complete player @s ~ ~ ~ 1 1
scoreboard players set #spleef_started spleef_state 0
schedule function blokarena:spleef_end 5s
