'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const KEY = fs.readFileSync(path.join(ROOT, 'launcher', 'data', 'admin.key'), 'utf8').trim();

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
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode === 200) return resolve();
          reject(new Error(res.statusCode + ' ' + data));
        });
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

const text = (value, color, bold = false) =>
  JSON.stringify({ text: value, color, bold, italic: false });

function sign(x, y, z, lines) {
  const parts = lines.slice(0, 4).map((line, i) => `Text${i + 1}:'${line}'`);
  return `setblock ${x} ${y} ${z} minecraft:oak_sign{${parts.join(',')}}`;
}

function label(x, y, z, title, sub, color = 'gold') {
  return sign(x, y, z, [text(title, color, true), sub ? text(sub, 'gray') : '""']);
}

function button(x, y, z) {
  return `setblock ${x} ${y} ${z} minecraft:oak_button[face=floor,facing=north,powered=false]`;
}

function commandBlock(x, y, z, command) {
  if (command.includes("'")) throw new Error('Command contains a single quote: ' + command);
  return `setblock ${x} ${y} ${z} minecraft:command_block{Command:'${command}',TrackOutput:0b,auto:0b,conditionMet:0b,powered:0b}`;
}

const item = (slot, id, count, tag) =>
  `{Slot:${slot}b,id:"minecraft:${id}",Count:${count}b${tag ? ',tag:' + tag : ''}}`;

const enchant = (id, lvl) => `{id:"minecraft:${id}",lvl:${lvl}s}`;

const BOX_KIT = [
  item(0, 'iron_sword', 1, `{Enchantments:[${enchant('sharpness', 3)}]}`),
  item(1, 'iron_helmet', 1),
  item(2, 'iron_chestplate', 1),
  item(3, 'iron_leggings', 1),
  item(4, 'iron_boots', 1),
  item(5, 'bow', 1),
  item(6, 'arrow', 16),
  item(7, 'golden_apple', 4),
  item(8, 'shield', 1),
  item(9, 'cooked_beef', 8),
];

const GUN_KIT = [
  item(0, 'iron_helmet', 1),
  item(1, 'iron_chestplate', 1),
  item(2, 'iron_leggings', 1),
  item(3, 'iron_boots', 1),
  item(4, 'shield', 1),
  item(5, 'golden_apple', 4),
  item(6, 'cooked_beef', 8),
  item(7, 'arrow', 32),
];

const boxChest = (x, y, z) => `setblock ${x} ${y} ${z} minecraft:chest{Items:[${BOX_KIT.join(',')}]}`;
const gunChest = (x, y, z) => `setblock ${x} ${y} ${z} minecraft:chest{Items:[${GUN_KIT.join(',')}]}`;

const AK47 =
  'give @p minecraft:crossbow{Enchantments:[{id:"minecraft:quick_charge",lvl:3s},{id:"minecraft:unbreaking",lvl:3s}]} 1';
const SHOTGUN =
  'give @p minecraft:crossbow{Enchantments:[{id:"minecraft:quick_charge",lvl:2s},{id:"minecraft:multishot",lvl:1s},{id:"minecraft:unbreaking",lvl:3s}]} 1';
const SNIPER =
  'give @p minecraft:bow{Enchantments:[{id:"minecraft:power",lvl:5s},{id:"minecraft:punch",lvl:2s},{id:"minecraft:unbreaking",lvl:3s}]} 1';
const RPG =
  'give @p minecraft:firework_rocket{Fireworks:{Flight:1b,Explosions:[{Type:1b,Colors:[I;11743532]}]}} 8';
const AMMO = 'give @p minecraft:arrow 64';

const HUB = '0.5 140 0.5';

const commands = [
  // world setup
  'difficulty normal',
  'gamerule pvp true',
  'gamerule keepInventory false',
  'gamerule spawnRadius 2',
  'gamerule doFireTick false',
  'time set day',
  'weather clear',

  // hub platform
  'fill -7 139 -7 7 139 7 minecraft:polished_andesite',
  'fill -7 140 -7 -7 142 7 minecraft:glass',
  'fill 7 140 -7 7 142 7 minecraft:glass',
  'fill -6 140 -7 6 142 -7 minecraft:glass',
  'fill -6 140 7 6 142 7 minecraft:glass',
  'fill -7 143 -7 7 143 7 minecraft:glass',
  'setblock -5 139 -5 minecraft:sea_lantern',
  'setblock 5 139 -5 minecraft:sea_lantern',
  'setblock -5 139 5 minecraft:sea_lantern',
  'setblock 5 139 5 minecraft:sea_lantern',

  // hub teleport pads
  commandBlock(-4, 140, -6, 'tp @p 200.5 120 0.5'),
  button(-4, 141, -6),
  label(-3, 140, -6, 'BOX PVP', 'Herkese acik PvP', 'gold'),
  commandBlock(0, 140, -6, 'tp @p 0.5 120 200.5'),
  button(0, 141, -6),
  label(1, 140, -6, 'GUNS PVP', 'Silahli PvP', 'aqua'),
  commandBlock(4, 140, -6, 'spreadplayers -169 97 1 30 false @p'),
  button(4, 141, -6),
  label(5, 140, -6, 'DUNYA / SMP', 'Rastgele guvenli yer', 'green'),
  label(0, 139 + 1, 5, 'BLOKARENA HUB', 'Butonlara bas ve isinlan', 'white'),
  'setworldspawn 0 140 0',

  // boxpvp shell
  'fill 188 118 -12 212 118 12 minecraft:barrier',
  'fill 188 119 -12 212 119 12 minecraft:smooth_stone',
  'fill 188 120 -12 188 122 12 minecraft:barrier',
  'fill 212 120 -12 212 122 12 minecraft:barrier',
  'fill 188 120 -12 212 122 -12 minecraft:barrier',
  'fill 188 120 12 212 122 12 minecraft:barrier',
  'fill 188 123 -12 212 123 12 minecraft:barrier',
  'setblock 200 119 -8 minecraft:sea_lantern',
  'setblock 200 119 8 minecraft:sea_lantern',
  'setblock 192 119 0 minecraft:sea_lantern',
  'setblock 208 119 0 minecraft:sea_lantern',
  'fill 194 120 -4 206 121 -4 minecraft:white_concrete',
  'fill 194 120 4 206 121 4 minecraft:white_concrete',
  'fill 194 120 -1 194 122 1 minecraft:white_concrete',
  'fill 206 120 -1 206 122 1 minecraft:white_concrete',
  label(200, 120, -10, 'BOX PVP', 'PvP herkese acik', 'gold'),
  boxChest(200, 120, 8),
  label(200, 120, 9, 'KIT SANDIGI', 'Zirh + kilic + yay', 'yellow'),
  commandBlock(204, 120, 8, boxChest(200, 120, 8)),
  button(204, 121, 8),
  label(205, 120, 8, 'KIT YENILE', 'Sandigi doldur', 'yellow'),
  commandBlock(196, 120, 8, `tp @p ${HUB}`),
  button(196, 121, 8),
  label(197, 120, 8, 'HUBA DON', 'Spawn alani', 'gray'),

  // gunspvp shell
  'fill -20 118 188 20 118 212 minecraft:barrier',
  'fill -20 119 188 20 119 212 minecraft:smooth_stone',
  'fill -20 120 188 -20 122 212 minecraft:barrier',
  'fill 20 120 188 20 122 212 minecraft:barrier',
  'fill -20 120 188 20 122 188 minecraft:barrier',
  'fill -20 120 212 20 122 212 minecraft:barrier',
  'fill -20 123 188 20 123 212 minecraft:barrier',
  'fill -8 120 196 -6 122 198 minecraft:gray_concrete',
  'fill 6 120 196 8 122 198 minecraft:gray_concrete',
  'fill -8 120 203 -6 122 205 minecraft:gray_concrete',
  'fill 6 120 203 8 122 205 minecraft:gray_concrete',
  'fill -3 120 200 3 121 200 minecraft:gray_concrete',
  label(0, 120, 211, 'GUNS PVP', 'PvP herkese acik', 'aqua'),

  // weapon stations
  commandBlock(-12, 120, 189, AK47),
  button(-12, 121, 189),
  label(-12, 120, 190, 'AK-47', 'Hizli ates', 'gold'),
  commandBlock(-6, 120, 189, SHOTGUN),
  button(-6, 121, 189),
  label(-6, 120, 190, 'SHOTGUN', 'Yakin mesafe', 'aqua'),
  commandBlock(0, 120, 189, SNIPER),
  button(0, 121, 189),
  label(0, 120, 190, 'SNIPER', 'Uzak mesafe', 'red'),
  commandBlock(6, 120, 189, RPG),
  button(6, 121, 189),
  label(6, 120, 190, 'RPG', 'Patlayici', 'dark_red'),
  commandBlock(12, 120, 189, AMMO),
  button(12, 121, 189),
  label(12, 120, 190, 'MERMI', '64 ok', 'yellow'),

  // gun arena chest and return
  gunChest(0, 120, 205),
  label(0, 120, 206, 'ZIRH SANDIGI', 'Herkese acik', 'yellow'),
  commandBlock(4, 120, 205, gunChest(0, 120, 205)),
  button(4, 121, 205),
  label(5, 120, 205, 'ZIRH YENILE', 'Sandigi doldur', 'yellow'),
  commandBlock(-16, 120, 205, `tp @p ${HUB}`),
  button(-16, 121, 205),
  label(-15, 120, 205, 'HUBA DON', 'Spawn alani', 'gray'),
];

(async () => {
  console.log(`[arena] ${commands.length} komut gonderiliyor...`);
  let failed = 0;
  for (let i = 0; i < commands.length; i++) {
    try {
      await send(commands[i]);
    } catch (err) {
      failed++;
      console.error(`[arena] ${i + 1} HATA: ${err.message}`);
    }
    if ((i + 1) % 10 === 0) console.log(`[arena] ${i + 1}/${commands.length}`);
    await sleep(120);
  }
  console.log(`[arena] bitti. hata: ${failed}`);
})();
