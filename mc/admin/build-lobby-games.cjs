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

const items = (list) =>
  list
    .map((it, i) => {
      const parts = [`Slot:${i}b`, `id:"minecraft:${it.id}"`, `count:${it.count || 1}`];
      return `{${parts.join(',')}}`;
    })
    .join(',');

const chest = (x, y, z, list, facing = 'north') =>
  `setblock ${x} ${y} ${z} minecraft:chest[facing=${facing}]{Items:[${items(list)}]}`;

const STATIONS = [
  { x: -13, fn: 'pvp', color: 'red', carpet: 'red', title: 'PVP', sub: 'Son kalan kazanir' },
  { x: -8, fn: 'guns', color: 'aqua', glass: 'cyan', carpet: 'cyan', title: 'GUNS PVP', sub: 'Silah savasi' },
  { x: -3, fn: 'survivor', color: 'green', carpet: 'lime', title: 'SURVIVOR', sub: 'Ada hayatta kal' },
  { x: 2, fn: 'random', color: 'light_purple', glass: 'magenta', carpet: 'purple', title: 'RANDOM ITEM', sub: '4sn rastgele item' },
  { x: 7, fn: 'bw_join_red', color: 'red', carpet: 'red', title: 'BEDWARS', sub: 'Kirmizi takim' },
  { x: 12, fn: 'bw_join_blue', color: 'blue', carpet: 'blue', title: 'BEDWARS', sub: 'Mavi takim' },
];

const commands = [
  // --- chunk loading -------------------------------------------------------
  'forceload add -20 -20 20 32',
  'forceload add 284 -24 376 24',
  'forceload add -20 284 20 316',

  // --- datapack + scoreboards ---------------------------------------------
  'reload confirm',
  'datapack enable "file/blokarena"',
  'scoreboard objectives add menu trigger',
  'scoreboard objectives add bw_deaths deathCount',
  'scoreboard objectives add bw_state dummy',
  'scoreboard objectives add bw_joined dummy',
  'scoreboard objectives add kills playerKillCount',
  'scoreboard objectives setdisplay sidebar kills',
  'setworldspawn 0 140 0',
  'gamerule spawnRadius 0',
  'gamerule keepInventory false',
  'gamerule doImmediateRespawn false',
  'time set day',
  'weather clear',

  // --- lobby: temizlik + zemin --------------------------------------------
  'fill -17 133 -17 17 149 17 minecraft:air',
  'fill -16 133 -16 16 137 16 minecraft:stone_bricks',
  'fill -16 138 -16 16 138 16 minecraft:smooth_quartz',
  'fill -16 139 -16 16 139 16 minecraft:polished_andesite',
  'fill -16 139 -16 16 139 -16 minecraft:smooth_quartz',
  'fill -16 139 16 16 139 16 minecraft:smooth_quartz',
  'fill -16 139 -16 -16 139 16 minecraft:smooth_quartz',
  'fill 16 139 -16 16 139 16 minecraft:smooth_quartz',

  // --- lobby: orta madalyon ------------------------------------------------
  'setblock 0 139 0 minecraft:chiseled_quartz_block',
  'setblock -1 139 0 minecraft:smooth_quartz',
  'setblock 1 139 0 minecraft:smooth_quartz',
  'setblock 0 139 -1 minecraft:smooth_quartz',
  'setblock 0 139 1 minecraft:smooth_quartz',
  'setblock -2 139 0 minecraft:sea_lantern',
  'setblock 2 139 0 minecraft:sea_lantern',
  'setblock 0 139 -2 minecraft:sea_lantern',
  'setblock 0 139 2 minecraft:sea_lantern',
  'setblock -1 139 -1 minecraft:smooth_quartz',
  'setblock 1 139 -1 minecraft:smooth_quartz',
  'setblock -1 139 1 minecraft:smooth_quartz',
  'setblock 1 139 1 minecraft:smooth_quartz',

  // --- lobby: border isiklari ---------------------------------------------
  'setblock -8 139 -16 minecraft:sea_lantern',
  'setblock 8 139 -16 minecraft:sea_lantern',
  'setblock -8 139 16 minecraft:sea_lantern',
  'setblock 8 139 16 minecraft:sea_lantern',
  'setblock -16 139 -8 minecraft:sea_lantern',
  'setblock -16 139 8 minecraft:sea_lantern',
  'setblock 16 139 -8 minecraft:sea_lantern',
  'setblock 16 139 8 minecraft:sea_lantern',

  // --- lobby: cit ve sutunlar ---------------------------------------------
  'fill -16 140 -16 16 141 -16 minecraft:light_blue_stained_glass_pane',
  'fill -16 140 16 -5 141 16 minecraft:light_blue_stained_glass_pane',
  'fill 5 140 16 16 141 16 minecraft:light_blue_stained_glass_pane',
  'fill 16 140 -16 16 141 16 minecraft:light_blue_stained_glass_pane',
  'fill -16 140 -16 -16 141 16 minecraft:light_blue_stained_glass_pane',
  'fill 16 140 16 16 142 16 minecraft:smooth_quartz',
  'setblock 16 143 16 minecraft:sea_lantern',
  'fill -16 140 16 -16 142 16 minecraft:smooth_quartz',
  'setblock -16 143 16 minecraft:sea_lantern',
  'fill 16 140 -16 16 142 -16 minecraft:smooth_quartz',
  'setblock 16 143 -16 minecraft:sea_lantern',
  'fill -16 140 -16 -16 142 -16 minecraft:smooth_quartz',
  'setblock -16 143 -16 minecraft:sea_lantern',
  'fill 16 140 0 16 142 0 minecraft:smooth_quartz',
  'setblock 16 143 0 minecraft:sea_lantern',
  'fill -16 140 0 -16 142 0 minecraft:smooth_quartz',
  'setblock -16 143 0 minecraft:sea_lantern',

  // --- lobby: giris kemeri (guney) ----------------------------------------
  'fill -4 140 16 -4 145 16 minecraft:smooth_quartz',
  'fill 4 140 16 4 145 16 minecraft:smooth_quartz',
  'fill -4 146 16 4 146 16 minecraft:smooth_quartz',
  'setblock 0 145 16 minecraft:lantern[hanging=true]',
  'setblock -2 145 16 minecraft:lantern[hanging=true]',
  'setblock 2 145 16 minecraft:lantern[hanging=true]',
  sign(0, 140, 15, 'BLOKARENA', 'Giris alani', 'gold', 8),
  sign(-3, 140, 16, 'HOS GELDIN', 'Iyi oyunlar', 'aqua', 0),
  sign(3, 140, 16, 'HOS GELDIN', 'Iyi oyunlar', 'aqua', 0),
  'fill -3 139 17 3 139 23 minecraft:smooth_quartz',
  'fill -5 139 24 5 139 28 minecraft:smooth_quartz',
  'fill -3 140 17 -3 141 23 minecraft:light_blue_stained_glass_pane',
  'fill 3 140 17 3 141 23 minecraft:light_blue_stained_glass_pane',
  'fill -5 140 28 5 141 28 minecraft:light_blue_stained_glass_pane',
  'fill -5 140 24 -5 141 28 minecraft:light_blue_stained_glass_pane',
  'fill 5 140 24 5 141 28 minecraft:light_blue_stained_glass_pane',
  'setblock -5 140 24 minecraft:sea_lantern',
  'setblock 5 140 24 minecraft:sea_lantern',
  'setblock -5 142 28 minecraft:sea_lantern',
  'setblock 5 142 28 minecraft:sea_lantern',

  // --- lobby: agaclar -------------------------------------------------------
  'fill -11 140 11 -11 142 11 minecraft:oak_log',
  'fill -13 143 9 -9 143 13 minecraft:oak_leaves',
  'fill -12 144 10 -10 144 12 minecraft:oak_leaves',
  'setblock -11 145 11 minecraft:oak_leaves',
  'fill 11 140 11 11 142 11 minecraft:oak_log',
  'fill 9 143 9 13 143 13 minecraft:oak_leaves',
  'fill 10 144 10 12 144 12 minecraft:oak_leaves',
  'setblock 11 145 11 minecraft:oak_leaves',

  // --- lobby: mod istasyonlari --------------------------------------------
  ...STATIONS.flatMap(({ x, fn, color, glass, carpet, title, sub }) => [
    `fill ${x - 2} 140 -15 ${x - 2} 144 -15 minecraft:smooth_quartz`,
    `fill ${x + 2} 140 -15 ${x + 2} 144 -15 minecraft:smooth_quartz`,
    `fill ${x - 2} 145 -15 ${x + 2} 145 -15 minecraft:smooth_quartz`,
    `fill ${x - 1} 140 -15 ${x + 1} 144 -15 minecraft:${glass || color}_stained_glass_pane`,
    `setblock ${x} 145 -15 minecraft:sea_lantern`,
    `fill ${x} 140 -11 ${x} 140 -3 minecraft:${carpet}_carpet`,
    cmdBlock(x, 139, -13, `execute as @p run function blokarena:${fn}`),
    plate(x, 140, -13),
    sign(x + 1, 140, -13, title, sub, color),
  ]),

  // --- lobby: menu kiosku ---------------------------------------------------
  cmdBlock(0, 139, -5, 'execute as @p run function blokarena:menu'),
  plate(0, 140, -5),
  sign(1, 140, -5, 'MOD MENUSU', 'Bas ve mod sec', 'gold'),

  // --- bedwars: kirmizi ada ------------------------------------------------
  'fill 292 118 -8 308 118 8 minecraft:stone',
  'fill 292 119 -8 308 119 8 minecraft:stone_bricks',
  'fill 292 119 -8 308 119 -8 minecraft:red_concrete',
  'fill 292 119 8 308 119 8 minecraft:red_concrete',
  'fill 292 119 -8 292 119 8 minecraft:red_concrete',
  'fill 308 119 -8 308 119 8 minecraft:red_concrete',
  'fill 293 120 -7 293 122 -7 minecraft:red_wool',
  'fill 307 120 -7 307 122 -7 minecraft:red_wool',
  'fill 293 120 7 293 122 7 minecraft:red_wool',
  'fill 307 120 7 307 122 7 minecraft:red_wool',
  'setblock 300 119 0 minecraft:chiseled_quartz_block',
  'fill 299 120 3 301 120 6 minecraft:red_carpet',
  'setblock 300 120 4 minecraft:red_bed[part=foot,facing=south]',
  'setblock 300 120 5 minecraft:red_bed[part=head,facing=south]',
  cmdBlock(304, 119, 0, 'execute as @p run function blokarena:hub'),
  plate(304, 120, 0),
  sign(305, 120, 0, 'HUBA DON', 'BedWars', 'gray'),

  // --- bedwars: mavi ada ---------------------------------------------------
  'fill 352 118 -8 368 118 8 minecraft:stone',
  'fill 352 119 -8 368 119 8 minecraft:stone_bricks',
  'fill 352 119 -8 368 119 -8 minecraft:blue_concrete',
  'fill 352 119 8 368 119 8 minecraft:blue_concrete',
  'fill 352 119 -8 352 119 8 minecraft:blue_concrete',
  'fill 368 119 -8 368 119 8 minecraft:blue_concrete',
  'fill 353 120 -7 353 122 -7 minecraft:blue_wool',
  'fill 367 120 -7 367 122 -7 minecraft:blue_wool',
  'fill 353 120 7 353 122 7 minecraft:blue_wool',
  'fill 367 120 7 367 122 7 minecraft:blue_wool',
  'setblock 360 119 0 minecraft:chiseled_quartz_block',
  'fill 359 120 3 361 120 6 minecraft:blue_carpet',
  'setblock 360 120 4 minecraft:blue_bed[part=foot,facing=south]',
  'setblock 360 120 5 minecraft:blue_bed[part=head,facing=south]',
  cmdBlock(356, 119, 0, 'execute as @p run function blokarena:hub'),
  plate(356, 120, 0),
  sign(357, 120, 0, 'HUBA DON', 'BedWars', 'gray'),

  // --- bedwars: orta ada + kopruler ---------------------------------------
  'fill 326 118 -4 334 118 4 minecraft:stone',
  'fill 326 119 -4 334 119 4 minecraft:polished_andesite',
  'fill 326 119 -4 334 119 -4 minecraft:smooth_quartz',
  'fill 326 119 4 334 119 4 minecraft:smooth_quartz',
  'fill 326 119 -4 326 119 4 minecraft:smooth_quartz',
  'fill 334 119 -4 334 119 4 minecraft:smooth_quartz',
  'setblock 330 119 0 minecraft:sea_lantern',
  chest(328, 120, -2, [
    { id: 'cobblestone', count: 32 },
    { id: 'oak_planks', count: 16 },
    { id: 'golden_apple', count: 2 },
  ]),
  chest(332, 120, 2, [
    { id: 'cobblestone', count: 32 },
    { id: 'oak_planks', count: 16 },
    { id: 'golden_apple', count: 2 },
  ]),
  sign(330, 120, 3, 'ORTA ADA', 'Kaynak sandigi', 'yellow'),
  'fill 309 119 -1 325 119 1 minecraft:stone_bricks',
  'fill 335 119 -1 351 119 1 minecraft:stone_bricks',

  // --- bedwars: elenenler alani -------------------------------------------
  'fill 326 129 -2 334 129 2 minecraft:smooth_quartz',
  'fill 326 130 -2 334 130 -2 minecraft:light_blue_stained_glass_pane',
  'fill 326 130 2 334 130 2 minecraft:light_blue_stained_glass_pane',
  'fill 326 130 -2 326 130 2 minecraft:light_blue_stained_glass_pane',
  'fill 334 130 -2 334 130 2 minecraft:light_blue_stained_glass_pane',
  'setblock 330 129 0 minecraft:chiseled_quartz_block',
  sign(332, 130, 0, 'ELENENLER', 'Izleme alani', 'gray'),

  // --- random item arenasi -------------------------------------------------
  'fill -15 118 288 15 118 312 minecraft:stone',
  'fill -15 119 288 15 119 312 minecraft:smooth_stone',
  'fill -15 119 288 15 119 288 minecraft:purple_concrete',
  'fill -15 119 312 15 119 312 minecraft:purple_concrete',
  'fill -15 119 288 -15 119 312 minecraft:purple_concrete',
  'fill 15 119 288 15 119 312 minecraft:purple_concrete',
  'fill -15 120 288 15 122 288 minecraft:light_blue_stained_glass_pane',
  'fill -15 120 312 15 122 312 minecraft:light_blue_stained_glass_pane',
  'fill -15 120 288 -15 122 312 minecraft:light_blue_stained_glass_pane',
  'fill 15 120 288 15 122 312 minecraft:light_blue_stained_glass_pane',
  'setblock -15 120 288 minecraft:sea_lantern',
  'setblock 15 120 288 minecraft:sea_lantern',
  'setblock -15 120 312 minecraft:sea_lantern',
  'setblock 15 120 312 minecraft:sea_lantern',
  'fill -8 120 296 -8 122 296 minecraft:smooth_quartz',
  'setblock -8 123 296 minecraft:sea_lantern',
  'fill 8 120 296 8 122 296 minecraft:smooth_quartz',
  'setblock 8 123 296 minecraft:sea_lantern',
  'fill -8 120 304 -8 122 304 minecraft:smooth_quartz',
  'setblock -8 123 304 minecraft:sea_lantern',
  'fill 8 120 304 8 122 304 minecraft:smooth_quartz',
  'setblock 8 123 304 minecraft:sea_lantern',
  'setblock 0 119 300 minecraft:chiseled_quartz_block',
  cmdBlock(0, 119, 293, 'execute as @p run function blokarena:hub'),
  plate(0, 120, 293),
  sign(1, 120, 293, 'HUBA DON', 'Random Item', 'gray'),
];

(async () => {
  const before = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;
  let failed = 0;
  console.log(`[lobby] ${commands.length} komut gonderiliyor...`);
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    try {
      // Yatak yarilari arasina hava koymak diger yariyi siliyor: yataklarda atla.
      if (/^setblock \S+ \S+ \S+ .*[\[{]/.test(command) && !/_bed\[/.test(command)) {
        const [, x, y, z] = command.split(' ');
        await send(`setblock ${x} ${y} ${z} minecraft:air`);
        await sleep(60);
      }
      await send(command);
    } catch (err) {
      failed++;
      console.error(`[lobby] ${i + 1} HATA: ${err.message}`);
    }
    if ((i + 1) % 25 === 0) console.log(`[lobby] ${i + 1}/${commands.length}`);
    await sleep(110);
  }
  await sleep(3000);
  console.log('--- sunucu cikisi ---');
  console.log(fs.readFileSync(LOG, 'utf8').slice(before));
  console.log(`[lobby] bitti. http hatasi: ${failed}`);
})();
