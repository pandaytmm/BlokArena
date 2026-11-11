scoreboard players set #red_alive bw_alive 0
scoreboard players set #blue_alive bw_alive 0
execute as @a[tag=bw_red,tag=!bw_eliminated] run scoreboard players add #red_alive bw_alive 1
execute as @a[tag=bw_blue,tag=!bw_eliminated] run scoreboard players add #blue_alive bw_alive 1
title @a[tag=bw_red] actionbar {"text":"","extra":[{"text":"KIRMIZI ","color":"red","bold":true},{"score":{"name":"#red_alive","objective":"bw_alive"}},{"text":"  |  ","color":"dark_gray"},{"text":"MAVI ","color":"blue","bold":true},{"score":{"name":"#blue_alive","objective":"bw_alive"}}]}
title @a[tag=bw_blue] actionbar {"text":"","extra":[{"text":"KIRMIZI ","color":"red","bold":true},{"score":{"name":"#red_alive","objective":"bw_alive"}},{"text":"  |  ","color":"dark_gray"},{"text":"MAVI ","color":"blue","bold":true},{"score":{"name":"#blue_alive","objective":"bw_alive"}}]}
execute if score #match bw_state matches 1 run schedule function blokarena:bw_hud 1s
