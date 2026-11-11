'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const KEY = fs.readFileSync(path.join(ROOT, 'launcher', 'data', 'admin.key'), 'utf8').trim();
const LOG = path.join(ROOT, 'mc', 'server', 'console.log');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function send(command) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ command });
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 3010,
        path: '/api/admin/command',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-admin-key': KEY,
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => (res.statusCode === 200 ? resolve() : reject(new Error(res.statusCode + ' ' + d))));
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

function sign(x, y, z, title, sub, color = 'gold', rotation = 0) {
  const line = (obj) => `'${JSON.stringify(obj)}'`;
  const messages = [
    line({ text: title, color, bold: true }),
    sub ? line({ text: sub, color: 'gray' }) : `'{"text":""}'`,
    `'{"text":""}'`,
    `'{"text":""}'`,
  ].join(',');
  return `setblock ${x} ${y} ${z} minecraft:oak_sign[rotation=${rotation},waterlogged=false]{front_text:{messages:[${messages}],color:"black",has_glowing_text:0b},is_waxed:0b}`;
}

const cmdBlock = (x, y, z, command) =>
  `setblock ${x} ${y} ${z} minecraft:command_block{Command:'${command}',auto:0b,powered:0b,conditionMet:0b,TrackOutput:0b}`;

const plate = (x, y, z) => `setblock ${x} ${y} ${z} minecraft:stone_pressure_plate[powered=false]`;

const button = (x, y, z) => `setblock ${x} ${y} ${z} minecraft:oak_button[face=floor,facing=north,powered=false]`;

const commands = [
  // --- yeni bolgeleri yukle -------------------------------------------------
  'forceload add 496 -16 528 16',
  'forceload add 556 -16 588 16',
  'forceload add -20 184 24 216',
  'forceload add -224 -24 -176 24',
  '__wait__',
  'reload confirm',
  'datapack enable "file/blokarena"',
  '__wait__',
  '__wait__',

  // --- scoreboard -----------------------------------------------------------
  'scoreboard objectives add menu trigger',
  'scoreboard objectives add bw_deaths deathCount',
  'scoreboard objectives add bw_state dummy',
  'scoreboard objectives add bw_joined dummy',
  'scoreboard objectives add bw_alive dummy',
  'scoreboard objectives add spleef_state dummy',
  'scoreboard objectives add spleef_alive dummy',
  'scoreboard objectives add kit dummy',
  'scoreboard objectives add survivor dummy',
  'scoreboard objectives add kills playerKillCount',

  // --- guns: yeni silah istasyonlari ---------------------------------------
  cmdBlock(-18, 120, 189, 'execute as @p run function blokarena:gun_pistol'),
  button(-18, 121, 189),
  sign(-18, 120, 190, 'TABANCA', 'Hizli ates', 'yellow'),
  cmdBlock(18, 120, 189, 'execute as @p run function blokarena:gun_smg'),
  button(18, 121, 189),
  sign(18, 120, 190, 'SMG', 'Seri ates', 'light_purple'),

  // --- survivor: erzak sandigi ---------------------------------------------
  'setblock -202 112 2 minecraft:chest',
  'loot replace block -202 112 2 container.0 loot blokarena:survivor_drop',
  'loot replace block -202 112 2 container.1 loot blokarena:survivor_drop',
  'loot replace block -202 112 2 container.2 loot blokarena:survivor_drop',
  'loot replace block -202 112 2 container.3 loot blokarena:survivor_drop',
  'loot replace block -202 112 2 container.4 loot blokarena:survivor_drop',
  'loot replace block -202 112 2 container.5 loot blokarena:survivor_drop',
  sign(-201, 112, 2, 'ERZAK', '60sn yenilenir', 'green'),

  // --- spleef arenasi -------------------------------------------------------
  'fill 495 110 -17 529 125 17 minecraft:air',
  'fill 495 126 -17 529 140 17 minecraft:air',
  'fill 500 119 -12 524 119 12 minecraft:snow_block',
  'fill 500 120 -12 500 124 12 minecraft:barrier',
  'fill 524 120 -12 524 124 12 minecraft:barrier',
  'fill 500 120 -12 524 124 -12 minecraft:barrier',
  'fill 500 120 12 524 124 12 minecraft:barrier',
  'fill 499 120 -13 499 125 13 minecraft:light_blue_stained_glass_pane',
  'fill 525 120 -13 525 125 13 minecraft:light_blue_stained_glass_pane',
  'fill 499 120 -13 525 125 -13 minecraft:light_blue_stained_glass_pane',
  'fill 499 120 13 525 125 13 minecraft:light_blue_stained_glass_pane',
  'setblock 499 126 -13 minecraft:sea_lantern',
  'setblock 525 126 -13 minecraft:sea_lantern',
  'setblock 499 126 13 minecraft:sea_lantern',
  'setblock 525 126 13 minecraft:sea_lantern',
  'fill 508 127 -2 516 127 2 minecraft:smooth_quartz',
  'fill 508 128 -2 516 128 -2 minecraft:light_blue_stained_glass_pane',
  'fill 508 128 2 516 128 2 minecraft:light_blue_stained_glass_pane',
  'fill 508 128 -2 508 128 2 minecraft:light_blue_stained_glass_pane',
  'fill 516 128 -2 516 128 2 minecraft:light_blue_stained_glass_pane',
  cmdBlock(503, 120, -10, 'execute as @p run function blokarena:hub'),
  button(503, 121, -10),
  sign(504, 120, -10, 'CIKIS', 'Spleef', 'gray'),

  // --- kitpvp arenasi -------------------------------------------------------
  'fill 555 110 -17 589 125 17 minecraft:air',
  'fill 555 126 -17 589 140 17 minecraft:air',
  'fill 560 117 -12 584 117 12 minecraft:stone',
  'fill 560 118 -12 584 118 12 minecraft:stone',
  'fill 560 119 -12 584 119 12 minecraft:smooth_stone',
  'fill 560 119 -12 584 119 -12 minecraft:polished_andesite',
  'fill 560 119 12 584 119 12 minecraft:polished_andesite',
  'fill 560 119 -12 560 119 12 minecraft:polished_andesite',
  'fill 584 119 -12 584 119 12 minecraft:polished_andesite',
  'fill 560 120 -12 560 124 12 minecraft:barrier',
  'fill 584 120 -12 584 124 12 minecraft:barrier',
  'fill 560 120 -12 584 124 -12 minecraft:barrier',
  'fill 560 120 12 584 124 12 minecraft:barrier',
  'fill 559 120 -13 559 125 13 minecraft:light_blue_stained_glass_pane',
  'fill 585 120 -13 585 125 13 minecraft:light_blue_stained_glass_pane',
  'fill 559 120 -13 585 125 -13 minecraft:light_blue_stained_glass_pane',
  'fill 559 120 13 585 125 13 minecraft:light_blue_stained_glass_pane',
  'setblock 559 126 -13 minecraft:sea_lantern',
  'setblock 585 126 -13 minecraft:sea_lantern',
  'setblock 559 126 13 minecraft:sea_lantern',
  'setblock 585 126 13 minecraft:sea_lantern',
  'setblock 572 119 0 minecraft:chiseled_quartz_block',
  cmdBlock(566, 120, 0, 'execute as @p run function blokarena:hub'),
  button(566, 121, 0),
  sign(567, 120, 0, 'CIKIS', 'KitPvP', 'gray'),

  // --- lobi: yeni mod kiosklari --------------------------------------------
  'fill -8 140 10 -4 143 14 minecraft:air',
  'fill 4 140 10 8 143 14 minecraft:air',
  cmdBlock(-6, 139, 12, 'execute as @p run function blokarena:spleef'),
  plate(-6, 140, 12),
  sign(-5, 140, 12, 'SPLEEF', 'Kari kir, dusur', 'aqua'),
  cmdBlock(6, 139, 12, 'execute as @p run function blokarena:kitpvp'),
  plate(6, 140, 12),
  sign(7, 140, 12, 'KITPVP', 'Donen kitler', 'gold'),

  // --- dogrulama ------------------------------------------------------------
  'execute if block 512 119 0 minecraft:snow_block run say K1_SPLEEF_ZEMIN_OK',
  'execute if block 500 120 0 minecraft:barrier run say K2_SPLEEF_DUVAR_OK',
  'execute if block 512 127 0 minecraft:smooth_quartz run say K3_SPLEEF_IZLEME_OK',
  'execute if block 572 119 0 minecraft:chiseled_quartz_block run say K4_KITPVP_ZEMIN_OK',
  'execute if block 566 120 0 minecraft:command_block run say K5_KITPVP_CIKIS_OK',
  'execute if block -18 120 189 minecraft:command_block run say K6_TABANCA_OK',
  'execute if block 18 120 189 minecraft:command_block run say K7_SMG_OK',
  'execute if block -202 112 2 minecraft:chest run say K8_ERZAK_OK',
  'execute if block -6 139 12 minecraft:command_block run say K9_LOBI_SPLEEF_OK',
  'execute if block 6 139 12 minecraft:command_block run say K10_LOBI_KITPVP_OK',
  'forceload query',
  'execute if block 328 120 -2 minecraft:chest run say K11_BW_SANDIK_OK',
  'execute if block 560 117 0 minecraft:stone run say K12_KITPVP_TABAN_OK',
  'data get block -202 112 2 Items',
  'function blokarena:bw_refill',
  'data get block 328 120 -2 Items',
  'function blokarena:survivor_tick',
  'data get block -202 112 2 Items',
  'scoreboard objectives list',
];

(async () => {
  const before = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;
  let failed = 0;
  console.log(`[yeni] ${commands.length} komut gonderiliyor...`);
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    if (command === '__wait__') {
      await sleep(4000);
      continue;
    }
    try {
      if (/^setblock \S+ \S+ \S+ .*[\[{]/.test(command) && !/_bed\[/.test(command)) {
        const [, x, y, z] = command.split(' ');
        await send(`setblock ${x} ${y} ${z} minecraft:air`);
        await sleep(60);
      }
      await send(command);
    } catch (err) {
      failed++;
      console.error(`[yeni] ${i + 1} HATA: ${err.message}`);
    }
    if ((i + 1) % 20 === 0) console.log(`[yeni] ${i + 1}/${commands.length}`);
    await sleep(110);
  }
  await sleep(3000);
  const out = fs.readFileSync(LOG, 'utf8').slice(before);
  console.log('--- sunucu cikisi ---');
  console.log(out);
  console.log(`[yeni] bitti. http hatasi: ${failed}`);
})();
