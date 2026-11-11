title @a times 10 80 20
title @a title {"text":"MAVI TAKIM KAZANDI","color":"blue","bold":true}
title @a subtitle {"text":"BedWars","color":"gray"}
execute as @a at @s run playsound minecraft:ui.toast.challenge_complete player @s ~ ~ ~ 1 1
execute as @a[tag=bw_red] run function blokarena:hub
execute as @a[tag=bw_blue] run function blokarena:hub
function blokarena:bw_reset
