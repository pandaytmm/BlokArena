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

function sign(x, y, z, title, sub, color = 'gold') {
  const line = (obj) => `'${JSON.stringify(obj)}'`;
  const messages = [
    line({ text: title, color, bold: true }),
    sub ? line({ text: sub, color: 'gray' }) : `'{"text":""}'`,
    `'{"text":""}'`,
    `'{"text":""}'`,
  ].join(',');
  return `setblock ${x} ${y} ${z} minecraft:oak_sign[rotation=0,waterlogged=false]{front_text:{messages:[${messages}],color:"black",has_glowing_text:0b},is_waxed:0b}`;
}

const button = (x, y, z) => `setblock ${x} ${y} ${z} minecraft:oak_button[face=floor,facing=north,powered=false]`;

const cmdBlock = (x, y, z, command) =>
  `setblock ${x} ${y} ${z} minecraft:command_block{Command:'${command}',auto:0b,powered:0b,conditionMet:0b,TrackOutput:0b}`;

const items = (list) =>
  list
    .map((it, i) => {
      const parts = [`Slot:${i}b`, `id:"minecraft:${it.id}"`, `count:${it.count || 1}`];
      if (it.comp) parts.push(`components:${it.comp}`);
      return `{${parts.join(',')}}`;
    })
    .join(',');

const chest = (x, y, z, list, facing = 'north') =>
  `setblock ${x} ${y} ${z} minecraft:chest[facing=${facing}]{Items:[${items(list)}]}`;

const BOX_KIT = [
  { id: 'iron_sword', comp: '{"minecraft:enchantments":{levels:{"minecraft:sharpness":3}}}' },
  { id: 'iron_helmet' },
  { id: 'iron_chestplate' },
  { id: 'iron_leggings' },
  { id: 'iron_boots' },
  { id: 'bow', comp: '{"minecraft:enchantments":{levels:{"minecraft:power":2}}}' },
  { id: 'arrow', count: 16 },
  { id: 'golden_apple', count: 4 },
  { id: 'shield' },
  { id: 'cooked_beef', count: 8 },
];

const GUN_KIT = [
  { id: 'iron_helmet' },
  { id: 'iron_chestplate' },
  { id: 'iron_leggings' },
  { id: 'iron_boots' },
  { id: 'shield' },
  { id: 'golden_apple', count: 4 },
  { id: 'cooked_beef', count: 8 },
  { id: 'arrow', count: 32 },
];

const SURVIVOR_KIT = [
  { id: 'stone_sword' },
  { id: 'stone_pickaxe' },
  { id: 'stone_axe' },
  { id: 'bread', count: 8 },
  { id: 'oak_planks', count: 16 },
  { id: 'torch', count: 12 },
  { id: 'crafting_table' },
];

const commands = [
  // --- chunk loading -------------------------------------------------------
  'forceload add 184 -16 216 16',
  'forceload add -24 184 24 216',
  'forceload add -224 -24 -176 24',

  // --- datapack ------------------------------------------------------------
  'reload',
  'datapack enable "file/blokarena"',
  'datapack list',

  // --- world rules ---------------------------------------------------------
  'setworldspawn 0 140 0',
  'gamerule spawnRadius 0',
  'gamerule keepInventory false',
  'gamerule doImmediateRespawn false',
  'scoreboard objectives add kills playerKillCount',
  'scoreboard objectives setdisplay sidebar kills',
  'time set day',
  'weather clear',

  // --- hub mode stations ---------------------------------------------------
  'fill -7 140 -6 7 142 -6 air',
  cmdBlock(-4, 140, -6, 'execute as @p run function blokarena:pvp'),
  button(-4, 141, -6),
  sign(-3, 140, -6, 'PVP', 'Son kalan kazanir', 'red'),
  'setblock -4 139 -5 minecraft:gold_block',
  cmdBlock(0, 140, -6, 'execute as @p run function blokarena:guns'),
  button(0, 141, -6),
  sign(1, 140, -6, 'GUNS PVP', 'Silah savasi', 'aqua'),
  'setblock 0 139 -5 minecraft:cyan_concrete',
  cmdBlock(4, 140, -6, 'execute as @p run function blokarena:survivor'),
  button(4, 141, -6),
  sign(5, 140, -6, 'SURVIVOR', 'Ada hayatta kal', 'green'),
  'setblock 4 139 -5 minecraft:emerald_block',
  sign(0, 140, 5, 'BLOKARENA HUB', 'Butona bas ve mod sec', 'white'),

  // --- pvp arena -----------------------------------------------------------
  'setblock 200 119 0 minecraft:gold_block',
  cmdBlock(196, 120, 8, 'execute as @p run function blokarena:hub'),
  button(196, 121, 8),
  sign(197, 120, 8, 'HUBA DON', 'Sag tik ile', 'gray'),
  cmdBlock(204, 120, 8, 'execute as @p run function blokarena:pvp_kit'),
  button(204, 121, 8),
  sign(205, 120, 8, 'KIT YENILE', 'Sag tik ile', 'yellow'),
  chest(200, 120, 8, BOX_KIT),

  // --- guns arena ----------------------------------------------------------
  'setblock 0 119 202 minecraft:cyan_concrete',
  cmdBlock(-16, 120, 205, 'execute as @p run function blokarena:hub'),
  button(-16, 121, 205),
  sign(-15, 120, 205, 'HUBA DON', 'Sag tik ile', 'gray'),
  cmdBlock(4, 120, 205, 'execute as @p run function blokarena:guns_kit'),
  button(4, 121, 205),
  sign(5, 120, 205, 'KIT YENILE', 'Sag tik ile', 'yellow'),
  chest(0, 120, 205, GUN_KIT),

  // weapon stations
  cmdBlock(-12, 120, 189, 'execute as @p run function blokarena:gun_ak'),
  button(-12, 121, 189),
  sign(-12, 120, 190, 'AK-47', 'Hizli ates', 'gold'),
  cmdBlock(-6, 120, 189, 'execute as @p run function blokarena:gun_shotgun'),
  button(-6, 121, 189),
  sign(-6, 120, 190, 'SHOTGUN', 'Yakin mesafe', 'aqua'),
  cmdBlock(0, 120, 189, 'execute as @p run function blokarena:gun_sniper'),
  button(0, 121, 189),
  sign(0, 120, 190, 'SNIPER', 'Uzak mesafe', 'red'),
  cmdBlock(6, 120, 189, 'execute as @p run function blokarena:gun_rpg'),
  button(6, 121, 189),
  sign(6, 120, 190, 'RPG', 'Patlayici', 'dark_red'),
  cmdBlock(12, 120, 189, 'execute as @p run function blokarena:gun_ammo'),
  button(12, 121, 189),
  sign(12, 120, 190, 'MERMI', '64 ok', 'yellow'),

  // --- survivor island -----------------------------------------------------
  'fill -220 112 -20 -180 126 20 air',
  'fill -220 127 -20 -180 140 20 air',
  'fill -218 104 -18 -182 105 18 minecraft:stone',
  'fill -216 102 -16 -184 103 16 minecraft:stone',
  'fill -214 100 -14 -186 101 14 minecraft:stone',
  'fill -220 106 -20 -180 108 20 minecraft:stone',
  'fill -220 109 -20 -180 110 20 minecraft:dirt',
  'fill -220 111 -20 -180 111 20 minecraft:grass_block',
  'fill -220 111 -20 -220 111 20 minecraft:sand',
  'fill -180 111 -20 -180 111 20 minecraft:sand',
  'fill -220 111 -20 -180 111 -20 minecraft:sand',
  'fill -220 111 20 -180 111 20 minecraft:sand',

  // house
  'fill -212 111 4 -204 111 12 minecraft:oak_planks',
  'fill -212 112 4 -204 114 4 minecraft:oak_planks',
  'fill -212 112 12 -204 114 12 minecraft:oak_planks',
  'fill -212 112 5 -212 114 11 minecraft:oak_planks',
  'fill -204 112 5 -204 114 11 minecraft:oak_planks',
  'setblock -208 112 4 minecraft:air',
  'setblock -208 113 4 minecraft:air',
  'setblock -210 113 4 minecraft:air',
  'setblock -206 113 4 minecraft:air',
  'setblock -212 113 8 minecraft:air',
  'setblock -204 113 8 minecraft:air',
  'fill -213 115 3 -203 115 13 minecraft:oak_planks',
  'setblock -208 114 8 minecraft:lantern[hanging=true]',
  chest(-210, 112, 10, SURVIVOR_KIT),
  'setblock -206 112 9 minecraft:red_bed[part=foot,facing=south]',
  'setblock -206 112 10 minecraft:red_bed[part=head,facing=south]',
  'setblock -211 111 11 minecraft:barrel[facing=up]',

  // farm
  'fill -202 111 -14 -196 111 -8 minecraft:farmland[moisture=7]',
  'fill -199 111 -14 -199 111 -8 minecraft:water',
  'fill -202 112 -14 -200 112 -8 minecraft:wheat[age=7]',
  'fill -198 112 -14 -196 112 -8 minecraft:wheat[age=7]',
  'fill -202 111 -15 -196 111 -15 minecraft:oak_fence',
  'fill -202 111 -7 -196 111 -7 minecraft:oak_fence',
  'fill -203 111 -15 -203 111 -7 minecraft:oak_fence',
  'fill -195 111 -15 -195 111 -7 minecraft:oak_fence',

  // campfire and decoration
  'setblock -213 112 6 minecraft:campfire[lit=true]',
  'fill -214 111 6 -214 111 7 minecraft:oak_log',
  'setblock -213 111 7 minecraft:oak_log',
  'setblock -201 112 1 minecraft:torch',
  'setblock -199 112 1 minecraft:torch',
  'setblock -211 112 3 minecraft:torch',
  'setblock -205 112 3 minecraft:torch',
  'setblock -211 112 13 minecraft:torch',
  'setblock -205 112 13 minecraft:torch',

  // trees
  'fill -217 112 -15 -217 115 -15 minecraft:oak_log',
  'fill -219 114 -17 -215 115 -13 minecraft:oak_leaves',
  'fill -218 116 -16 -216 116 -14 minecraft:oak_leaves',
  'fill -187 112 10 -187 115 10 minecraft:oak_log',
  'fill -189 114 8 -185 115 12 minecraft:oak_leaves',
  'fill -188 116 9 -186 116 11 minecraft:oak_leaves',

  // path and return station
  'fill -208 111 0 -200 111 0 minecraft:coarse_dirt',
  'fill -208 111 1 -208 111 3 minecraft:coarse_dirt',
  cmdBlock(-200, 112, -4, 'execute as @p run function blokarena:hub'),
  button(-200, 113, -4),
  sign(-199, 112, -4, 'HUBA DON', 'Sag tik ile', 'gray'),
  'setblock -200 111 -4 minecraft:oak_planks',
  'setblock -204 111 -4 minecraft:oak_planks',
  'setblock -196 111 -4 minecraft:oak_planks',
];

(async () => {
  const before = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;
  let failed = 0;
  console.log(`[modes] ${commands.length} komut gonderiliyor...`);
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    try {
      // Ayni tur blok degisimi bazen "Could not set the block" veriyor:
      // once havaya cevir, sonra hedef blogu yerlestir.
      if (/^setblock \S+ \S+ \S+ .*[\[{]/.test(command)) {
        const [, x, y, z] = command.split(' ');
        await send(`setblock ${x} ${y} ${z} minecraft:air`);
        await sleep(60);
      }
      await send(command);
    } catch (err) {
      failed++;
      console.error(`[modes] ${i + 1} HATA: ${err.message}`);
    }
    if ((i + 1) % 20 === 0) console.log(`[modes] ${i + 1}/${commands.length}`);
    await sleep(110);
  }
  await sleep(2500);
  const out = fs.readFileSync(LOG, 'utf8').slice(before);
  console.log('--- sunucu cikisi ---');
  console.log(out);
  console.log(`[modes] bitti. http hatasi: ${failed}`);
})();
