tag @a remove bw_red
tag @a remove bw_blue
tag @a remove bw_red_nobed
tag @a remove bw_blue_nobed
tag @a remove bw_eliminated
team leave @a
scoreboard players set #match bw_state 0
scoreboard players set #red bw_joined 0
scoreboard players set #blue bw_joined 0
scoreboard players set #red_alive bw_alive 0
scoreboard players set #blue_alive bw_alive 0
schedule clear blokarena:bw_hud
schedule clear blokarena:bw_refill
function blokarena:bw_beds_reset
