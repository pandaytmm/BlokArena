import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  MODES, WEAPONS, KITS, BLOCKS, MAX_HP, BOT_NAMES, BOT_SKINS, CHAT_LIMIT, getLoadout
} from './shared/config.js';
import {
  generateWorld, getBlock, setWorldBlock, groundTop, voxelRay
} from './shared/worldgen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const SHARED_DIR = path.join(__dirname, 'shared');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  if (pathname === '/') pathname = '/index.html';

  const isShared = pathname.startsWith('/shared/');
  const root = isShared ? SHARED_DIR : PUBLIC_DIR;
  const target = path.join(root, isShared ? pathname.slice('/shared/'.length) : pathname.slice(1));
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel) || target === root) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      if (pathname !== '/index.html' && !path.extname(pathname)) {
        fs.readFile(fallback, (err2, html) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
          res.end(html);
        });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bulunamadı');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') res.end();
    else res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
const rooms = new Map();
const sockets = new Set();
let nextPlayerId = 1;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function send(ws, msg) {
  if (ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // soket kapanmış olabilir
    }
  }
}

function broadcast(room, msg, exceptId = null) {
  const payload = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (p.id === exceptId) continue;
    if (p.ws.readyState === 1) {
      try {
        p.ws.send(payload);
      } catch {
        // yoksay
      }
    }
  }
}

function heldWeapon(p) {
  const slot = p.loadout && p.loadout[p.slot];
  if (!slot) return 'blocks';
  return slot.kind === 'blocks' ? 'blocks' : (slot.weapon || 'sword');
}

function playerWire(p) {
  return {
    id: p.id,
    name: p.name,
    pos: { ...p.pos },
    yaw: p.yaw,
    pitch: p.pitch,
    hp: p.hp,
    maxHp: p.maxHp,
    dead: p.dead,
    kills: p.kills,
    deaths: p.deaths,
    kit: p.kit,
    slot: p.slot,
    weapon: heldWeapon(p)
  };
}

function botWire(b) {
  return {
    id: b.id,
    name: b.name,
    pos: { ...b.pos },
    yaw: b.yaw,
    hp: b.hp,
    maxHp: b.maxHp,
    dead: b.dead,
    weapon: b.weapon,
    skin: b.skin,
    shirt: b.shirt,
    moving: b.moving
  };
}

function scoreEntries(room) {
  const out = [];
  for (const p of room.players.values()) {
    out.push({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths, isBot: false });
  }
  for (const b of room.bots) {
    out.push({ id: b.id, name: b.name, kills: b.kills, deaths: b.deaths, isBot: true });
  }
  return out;
}

function broadcastScores(room) {
  broadcast(room, { type: 'scores', entries: scoreEntries(room) });
}

function randomSpawn(room) {
  const list = room.world.spawns;
  if (!list.length) return { x: room.world.sx / 2, y: 20, z: room.world.sz / 2, yaw: 0 };
  return list[Math.floor(Math.random() * list.length)];
}

function getRoom(mode) {
  let room = rooms.get(mode);
  if (room) return room;
  const seed = (Math.random() * 1e9) | 0;
  const world = generateWorld(mode, seed);
  room = {
    mode,
    seed,
    world,
    players: new Map(),
    bots: [],
    edits: new Map(),
    placed: new Set()
  };
  room.bots = createBots(room);
  rooms.set(mode, room);
  console.log(`[oda] ${MODES[mode].name} oluşturuldu — seed ${seed}, ${room.bots.length} bot`);
  return room;
}

function createBots(room) {
  const count = MODES[room.mode].bots || 0;
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, count);
  const bots = [];
  for (let i = 0; i < count; i++) {
    const spawn = room.world.spawns[(i * 3 + 1) % room.world.spawns.length];
    const weapon = room.mode === 'gun'
      ? ['rifle', 'smg', 'shotgun'][i % 3]
      : room.mode === 'box'
        ? (i % 2 === 0 ? 'sword' : 'smg')
        : 'sword';
    const skin = BOT_SKINS[i % BOT_SKINS.length];
    const shirt = ['#7448ff', '#ff5c7a', '#25b8a8', '#e0a335', '#3f7bd6'][i % 5];
    bots.push({
      id: `bot${i + 1}`,
      name: names[i] || `BOT${i + 1}`,
      isBot: true,
      mode: room.mode,
      pos: { x: spawn.x, y: spawn.y, z: spawn.z },
      spawn: { ...spawn },
      yaw: spawn.yaw,
      pitch: 0,
      hp: MAX_HP,
      maxHp: MAX_HP,
      dead: false,
      respawnAt: 0,
      kills: 0,
      deaths: 0,
      weapon,
      skin,
      shirt,
      moving: false,
      lastAttack: 0,
      strafe: Math.random() < 0.5 ? 1 : -1,
      targetId: null
    });
  }
  return bots;
}

function findEntity(room, id) {
  for (const p of room.players.values()) if (p.id === id) return p;
  for (const b of room.bots) if (b.id === id) return b;
  return null;
}

function removePlayer(ws) {
  if (!ws.player) return;
  const p = ws.player;
  ws.player = null;
  const room = p.room;
  room.players.delete(p.id);
  broadcast(room, { type: 'playerleave', id: p.id, name: p.name });
  broadcast(room, { type: 'chat', name: 'SİSTEM', text: `${p.name} sunucudan ayrıldı.`, system: true });
  broadcastScores(room);
  console.log(`[ayrıldı] ${p.name} (${room.mode})`);
}

function cleanText(raw, maxLen) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

function handleJoin(ws, msg) {
  if (ws.player) return;
  const mode = MODES[msg.mode] ? msg.mode : 'gun';
  if (msg.mode && !MODES[msg.mode]) {
    send(ws, { type: 'error', message: 'Geçersiz mod.' });
    return;
  }
  const room = getRoom(mode);
  if (room.players.size >= 24) {
    send(ws, { type: 'error', message: 'Oda dolu.' });
    return;
  }
  const id = `p${nextPlayerId++}`;
  let name = cleanText(msg.name, 16) || `OYUNCU${id.slice(1)}`;
  const used = new Set([...room.players.values()].map((p) => p.name));
  if (used.has(name)) name = `${name}${id.slice(1)}`.slice(0, 18);
  const kit = mode === 'box' && KITS[msg.kit] ? msg.kit : 'warrior';
  const loadout = getLoadout(mode, kit);
  const spawn = randomSpawn(room);
  const player = {
    id,
    name,
    ws,
    room,
    mode,
    kit,
    loadout,
    pos: { x: spawn.x, y: spawn.y, z: spawn.z },
    yaw: spawn.yaw,
    pitch: 0,
    hp: MAX_HP,
    maxHp: MAX_HP,
    dead: false,
    respawnAt: 0,
    kills: 0,
    deaths: 0,
    slot: 0,
    lastShot: 0,
    lastMelee: 0,
    lastEdit: 0,
    lastHurt: 0,
    nextRegen: 0
  };
  ws.player = player;
  room.players.set(id, player);

  send(ws, {
    type: 'welcome',
    id,
    room: mode,
    mode,
    seed: room.seed,
    kit,
    spawn: { x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw },
    hp: player.hp,
    maxHp: player.maxHp,
    loadout,
    respawn: MODES[mode].respawn,
    players: [...room.players.values()].filter((p) => p.id !== id).map(playerWire),
    bots: room.bots.map(botWire),
    edits: [...room.edits.entries()].map(([key, block]) => {
      const [x, y, z] = key.split(',').map(Number);
      return [x, y, z, block];
    }),
    scores: scoreEntries(room)
  });

  broadcast(room, { type: 'playerjoin', player: playerWire(player) }, id);
  broadcast(room, { type: 'chat', name: 'SİSTEM', text: `${name} sunucuya katıldı.`, system: true }, id);
  broadcastScores(room);
  console.log(`[katıldı] ${name} (${mode})`);
}

function respawnPlayer(room, p) {
  const spawn = randomSpawn(room);
  p.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
  p.yaw = spawn.yaw;
  p.pitch = 0;
  p.hp = p.maxHp;
  p.dead = false;
  p.lastHurt = 0;
  p.nextRegen = 0;
  send(p.ws, { type: 'respawn', pos: { ...p.pos }, yaw: p.yaw, hp: p.hp });
  broadcast(room, {
    type: 'pstate',
    id: p.id,
    pos: { ...p.pos },
    yaw: p.yaw,
    pitch: 0,
    hp: p.hp,
    dead: false
  }, p.id);
}

function handleDeath(room, target, attacker, weaponId, headshot) {
  if (!target || target.dead) return;
  target.dead = true;
  target.hp = 0;
  target.deaths = (target.deaths || 0) + 1;
  target.respawnAt = Date.now() + (MODES[room.mode].respawn || 3) * 1000;
  if (attacker && attacker !== target) attacker.kills = (attacker.kills || 0) + 1;

  broadcast(room, {
    type: 'kill',
    killer: attacker ? attacker.name : null,
    killerId: attacker ? attacker.id : null,
    victim: target.name,
    victimId: target.id,
    weapon: weaponId || 'void',
    headshot: !!headshot,
    void: !attacker
  });

  if (target.ws) {
    send(target.ws, {
      type: 'died',
      by: attacker ? attacker.name : null,
      weapon: weaponId || 'void',
      respawnIn: MODES[room.mode].respawn || 3
    });
    broadcast(room, {
      type: 'pstate',
      id: target.id,
      pos: target.pos,
      yaw: target.yaw,
      pitch: target.pitch,
      hp: 0,
      dead: true
    }, target.id);
  }
  broadcastScores(room);
}

function applyDamage(room, target, amount, attacker, weaponId, headshot = false) {
  if (!target || target.dead) return;
  const dmg = Math.max(1, Math.round(amount));
  target.hp = Math.max(0, target.hp - dmg);
  target.lastHurt = Date.now();
  target.nextRegen = 0;
  if (target.ws) {
    send(target.ws, {
      type: 'hurt',
      hp: target.hp,
      dmg,
      by: attacker ? attacker.name : null,
      headshot: !!headshot
    });
  }
  if (target.hp <= 0) {
    handleDeath(room, target, attacker, weaponId, headshot);
  }
}

function rayAABB(ox, oy, oz, dx, dy, dz, minx, miny, minz, maxx, maxy, maxz, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  const axes = [
    [ox, dx, minx, maxx],
    [oy, dy, miny, maxy],
    [oz, dz, minz, maxz]
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

function raycastTargets(room, excludeId, origin, dir, maxDist) {
  let best = null;
  const check = (ent) => {
    if (!ent || ent.dead || ent.id === excludeId) return;
    const t = rayAABB(
      origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
      ent.pos.x - 0.35, ent.pos.y, ent.pos.z - 0.35,
      ent.pos.x + 0.35, ent.pos.y + 1.8, ent.pos.z + 0.35,
      maxDist
    );
    if (t !== null && (!best || t < best.t)) {
      best = {
        t,
        entity: ent,
        point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t }
      };
    }
  };
  for (const p of room.players.values()) check(p);
  for (const b of room.bots) check(b);
  return best;
}

function norm3(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
}

function spreadDir(dir, spread) {
  if (!spread) return dir;
  const v = norm3(dir.x, dir.y, dir.z);
  const up = Math.abs(v.y) < 0.98 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let rx = v.y * up.z - v.z * up.y;
  let ry = v.z * up.x - v.x * up.z;
  let rz = v.x * up.y - v.y * up.x;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  const ux = ry * v.z - rz * v.y;
  const uy = rz * v.x - rx * v.z;
  const uz = rx * v.y - ry * v.x;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * spread;
  return norm3(
    v.x + rx * Math.cos(a) * r + ux * Math.sin(a) * r,
    v.y + ry * Math.cos(a) * r + uy * Math.sin(a) * r,
    v.z + rz * Math.cos(a) * r + uz * Math.sin(a) * r
  );
}

function validOrigin(msg, p) {
  if (!msg || typeof msg !== 'object') return null;
  const x = Number(msg.x);
  const y = Number(msg.y);
  const z = Number(msg.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  const eye = { x: p.pos.x, y: p.pos.y + 1.62, z: p.pos.z };
  if (Math.hypot(x - eye.x, y - eye.y, z - eye.z) > 4) return null;
  return { x, y, z };
}

function validDir(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const x = Number(msg.x);
  const y = Number(msg.y);
  const z = Number(msg.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  const len = Math.hypot(x, y, z);
  if (len < 0.5) return null;
  return { x: x / len, y: y / len, z: z / len };
}

function handleShot(room, p, msg) {
  if (p.dead) return;
  const w = WEAPONS[msg.weapon];
  if (!w || w.kind !== 'gun') return;
  if (!p.loadout.some((s) => s.kind === 'weapon' && s.weapon === msg.weapon)) return;
  const now = Date.now();
  const interval = 60000 / w.rpm;
  if (now - p.lastShot < interval * 0.55) return;
  p.lastShot = now;

  const origin = validOrigin(msg.origin, p);
  const dir = validDir(msg.dir);
  if (!origin || !dir) return;

  broadcast(room, {
    type: 'shotfx',
    id: p.id,
    weapon: msg.weapon,
    from: origin,
    dir
  });

  const hits = new Map();
  for (let i = 0; i < w.pellets; i++) {
    const d = spreadDir(dir, w.spread);
    const blockHit = voxelRay(room.world, origin.x, origin.y, origin.z, d.x, d.y, d.z, w.range);
    const blockT = blockHit.hit ? blockHit.t : w.range;
    const target = raycastTargets(room, p.id, origin, d, Math.min(blockT, w.range));
    if (!target) continue;
    const headshot = target.point.y > target.entity.pos.y + 1.45;
    const dmg = w.dmg * (headshot ? w.headMult : 1);
    const prev = hits.get(target.entity.id) || { dmg: 0, head: false };
    prev.dmg += dmg;
    prev.head = prev.head || headshot;
    hits.set(target.entity.id, prev);
  }

  for (const [id, info] of hits) {
    const ent = findEntity(room, id);
    if (!ent) continue;
    applyDamage(room, ent, info.dmg, p, msg.weapon, info.head);
    send(p.ws, { type: 'hit', target: id, dmg: Math.round(info.dmg), headshot: info.head });
  }
}

function handleMelee(room, p, msg) {
  if (p.dead) return;
  const w = WEAPONS[msg.weapon];
  if (!w || w.kind !== 'melee') return;
  if (!p.loadout.some((s) => s.kind === 'weapon' && s.weapon === msg.weapon)) return;
  const now = Date.now();
  if (now - p.lastMelee < 380) return;
  p.lastMelee = now;

  const origin = validOrigin(msg.origin, p);
  const dir = validDir(msg.dir);
  if (!origin || !dir) return;

  const range = w.range + 0.4;
  const blockHit = voxelRay(room.world, origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, range);
  const maxDist = blockHit.hit ? Math.min(blockHit.t, range) : range;
  const target = raycastTargets(room, p.id, origin, dir, maxDist);

  broadcast(room, {
    type: 'meleefx',
    id: p.id,
    weapon: msg.weapon,
    from: origin,
    to: target ? target.point : { x: origin.x + dir.x * range, y: origin.y + dir.y * range, z: origin.z + dir.z * range },
    hit: !!target
  });

  if (target) {
    applyDamage(room, target.entity, w.dmg, p, msg.weapon, false);
    send(p.ws, { type: 'hit', target: target.entity.id, dmg: w.dmg, headshot: false });
  }
}

function handleEdit(room, p, msg) {
  if (p.dead || !MODES[room.mode].allowBuild) return;
  const x = Math.floor(Number(msg.x));
  const y = Math.floor(Number(msg.y));
  const z = Math.floor(Number(msg.z));
  if (![x, y, z].every(Number.isFinite)) return;
  if (x < 0 || y < 0 || z < 0 || x >= room.world.sx || y >= room.world.sy || z >= room.world.sz) return;

  const now = Date.now();
  if (now - p.lastEdit < 80) return;
  p.lastEdit = now;

  const eye = { x: p.pos.x, y: p.pos.y + 1.62, z: p.pos.z };
  if (Math.hypot(x + 0.5 - eye.x, y + 0.5 - eye.y, z + 0.5 - eye.z) > 9) return;

  const key = `${x},${y},${z}`;
  const blockId = Number(msg.block) | 0;
  const current = getBlock(room.world, x, y, z);

  if (blockId === 0) {
    if (current === 0) return;
    if (room.mode === 'box' && !room.placed.has(key)) return;
    setWorldBlock(room.world, x, y, z, 0);
    room.edits.set(key, 0);
    room.placed.delete(key);
    broadcast(room, { type: 'edit', x, y, z, block: 0, by: p.id });
    return;
  }

  if (!BLOCKS[blockId] || current !== 0) return;

  let adjacent = false;
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const [dx, dy, dz] of dirs) {
    if (getBlock(room.world, x + dx, y + dy, z + dz) > 0) {
      adjacent = true;
      break;
    }
  }
  if (!adjacent) return;

  for (const other of [...room.players.values(), ...room.bots]) {
    if (other.dead) continue;
    if (
      x + 0.5 > other.pos.x - 0.35 && x + 0.5 < other.pos.x + 0.35 &&
      z + 0.5 > other.pos.z - 0.35 && z + 0.5 < other.pos.z + 0.35 &&
      y >= Math.floor(other.pos.y) && y <= Math.floor(other.pos.y + 1.8)
    ) return;
  }

  setWorldBlock(room.world, x, y, z, blockId);
  room.edits.set(key, blockId);
  room.placed.add(key);
  broadcast(room, { type: 'edit', x, y, z, block: blockId, by: p.id });
}

function moveBot(room, bot, dx, dz) {
  const w = room.world;
  const nx = clamp(bot.pos.x + dx, 2, w.sx - 2);
  const nz = clamp(bot.pos.z + dz, 2, w.sz - 2);
  const curTop = groundTop(w, bot.pos.x, bot.pos.z);
  const nextTop = groundTop(w, nx, nz);
  if (nextTop < 0) return;
  if (Math.abs(nextTop - curTop) > 1) return;
  if (getBlock(w, nx, nextTop + 1, nz) > 0 || getBlock(w, nx, nextTop + 2, nz) > 0) return;
  bot.pos.x = nx;
  bot.pos.z = nz;
  bot.pos.y = nextTop + 1;
}

function botShoot(room, bot, target, dist) {
  const from = { x: bot.pos.x, y: bot.pos.y + 1.55, z: bot.pos.z };
  const aim = { x: target.pos.x, y: target.pos.y + 1.3, z: target.pos.z };
  let dx = aim.x - from.x;
  let dy = aim.y - from.y;
  let dz = aim.z - from.z;
  const eyeDist = Math.hypot(dx, dy, dz) || 1;
  dx /= eyeDist; dy /= eyeDist; dz /= eyeDist;
  const blockHit = voxelRay(room.world, from.x, from.y, from.z, dx, dy, dz, eyeDist + 1);
  const blocked = blockHit.hit && blockHit.t < eyeDist - 0.4;
  let chance = clamp(0.6 - dist * 0.0075, 0.16, 0.6);
  if (bot.weapon === 'shotgun') chance *= 0.85;
  const hit = !blocked && Math.random() < chance;
  const w = WEAPONS[bot.weapon] || WEAPONS.rifle;
  let to;
  let dmg = 0;
  if (hit) {
    to = aim;
    dmg = bot.weapon === 'shotgun' ? 26 : w.dmg;
    applyDamage(room, target, dmg, bot, bot.weapon, false);
  } else {
    to = {
      x: aim.x + (Math.random() - 0.5) * 3,
      y: aim.y + (Math.random() - 0.5) * 2,
      z: aim.z + (Math.random() - 0.5) * 3
    };
  }
  broadcast(room, {
    type: 'botshot',
    id: bot.id,
    from,
    to,
    weapon: bot.weapon,
    hit,
    blocked
  });
}

function botMelee(room, bot, target) {
  const from = { x: bot.pos.x, y: bot.pos.y + 1.4, z: bot.pos.z };
  const to = { x: target.pos.x, y: target.pos.y + 1.2, z: target.pos.z };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dy, dz) || 1;
  const blockHit = voxelRay(room.world, from.x, from.y, from.z, dx / dist, dy / dist, dz / dist, dist);
  const blocked = blockHit.hit && blockHit.t < dist - 0.4;
  broadcast(room, { type: 'meleefx', id: bot.id, weapon: 'sword', from, to, hit: !blocked });
  if (!blocked) applyDamage(room, target, room.mode === 'smp' ? 11 : 15, bot, 'sword', false);
}

function botTick(room) {
  const now = Date.now();
  for (const b of room.bots) {
    if (b.dead) {
      if (now >= b.respawnAt) {
        b.dead = false;
        b.hp = b.maxHp;
        b.pos = { x: b.spawn.x, y: b.spawn.y, z: b.spawn.z };
        b.yaw = b.spawn.yaw;
      }
      continue;
    }

    let target = null;
    let best = Infinity;
    for (const p of room.players.values()) {
      if (p.dead) continue;
      const d = Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
      if (d < best) {
        best = d;
        target = p;
      }
    }
    b.targetId = target ? target.id : null;
    b.moving = false;
    if (!target) continue;

    const dx = target.pos.x - b.pos.x;
    const dz = target.pos.z - b.pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    b.yaw = Math.atan2(-dx, -dz);
    b.pitch = 0;

    let mx = 0;
    let mz = 0;
    if (room.mode === 'gun') {
      if (best > 24) {
        mx = dx / dist; mz = dz / dist;
      } else if (best < 8) {
        mx = -dx / dist; mz = -dz / dist;
      } else {
        mx = (-dz / dist) * b.strafe;
        mz = (dx / dist) * b.strafe;
        if (Math.random() < 0.03) b.strafe *= -1;
      }
    } else if (best > 2.6) {
      mx = dx / dist; mz = dz / dist;
    }

    if (mx || mz) {
      const speed = room.mode === 'gun' ? 3.0 : 2.5;
      moveBot(room, b, mx * speed * 0.1, mz * speed * 0.1);
      b.moving = true;
    }

    if (room.mode === 'gun') {
      if (best < 55 && now - b.lastAttack > 950 + Math.random() * 650) {
        b.lastAttack = now;
        botShoot(room, b, target, best);
      }
    } else if (best < 3.4 && now - b.lastAttack > 850) {
      b.lastAttack = now;
      botMelee(room, b, target);
    }
  }

  if (room.players.size > 0) {
    broadcast(room, { type: 'bots', bots: room.bots.map(botWire) });
  }
}

function roomTick(room) {
  const now = Date.now();

  for (const p of room.players.values()) {
    if (!p.dead) {
      if (room.mode === 'box' && p.pos.y < 2) {
        handleDeath(room, p, null, 'void', false);
      } else if (room.mode === 'smp' && p.hp < p.maxHp && now - p.lastHurt > 7000) {
        if (now > p.nextRegen) {
          p.hp = Math.min(p.maxHp, p.hp + 4);
          p.nextRegen = now + 3000;
          send(p.ws, { type: 'heal', hp: p.hp });
        }
      }
    }
    if (p.dead && now >= p.respawnAt) respawnPlayer(room, p);
  }

  for (const b of room.bots) {
    if (!b.dead && room.mode === 'box' && b.pos.y < 2) {
      handleDeath(room, b, null, 'void', false);
    }
  }

  botTick(room);
}

function handleMessage(ws, msg) {
  if (!msg || typeof msg.type !== 'string') return;

  if (msg.type === 'join') {
    handleJoin(ws, msg);
    return;
  }
  if (msg.type === 'ping') {
    send(ws, { type: 'pong', t: Number(msg.t) || 0, now: Date.now() });
    return;
  }

  const p = ws.player;
  if (!p) return;
  const room = p.room;

  switch (msg.type) {
    case 'state': {
      if (p.dead || !msg.pos) return;
      const x = Number(msg.pos.x);
      const y = Number(msg.pos.y);
      const z = Number(msg.pos.z);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
      p.pos.x = clamp(x, 0, room.world.sx);
      p.pos.y = clamp(y, -8, room.world.sy);
      p.pos.z = clamp(z, 0, room.world.sz);
      p.yaw = Number.isFinite(Number(msg.yaw)) ? Number(msg.yaw) : p.yaw;
      p.pitch = Number.isFinite(Number(msg.pitch)) ? clamp(Number(msg.pitch), -1.55, 1.55) : p.pitch;
      p.slot = Number.isFinite(Number(msg.slot)) ? clamp(Number(msg.slot), 0, 8) : p.slot;
      broadcast(room, {
        type: 'pstate',
        id: p.id,
        pos: { ...p.pos },
        yaw: p.yaw,
        pitch: p.pitch,
        hp: p.hp,
        dead: p.dead,
        slot: p.slot,
        weapon: heldWeapon(p)
      }, p.id);
      break;
    }
    case 'shot':
      handleShot(room, p, msg);
      break;
    case 'melee':
      handleMelee(room, p, msg);
      break;
    case 'edit':
      handleEdit(room, p, msg);
      break;
    case 'chat': {
      const text = cleanText(msg.text, CHAT_LIMIT);
      if (!text) return;
      broadcast(room, { type: 'chat', id: p.id, name: p.name, text });
      break;
    }
    default:
      break;
  }
}

wss.on('connection', (ws) => {
  sockets.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    try {
      handleMessage(ws, msg);
    } catch (err) {
      console.error('[mesaj hatası]', err);
    }
  });
  ws.on('close', () => {
    sockets.delete(ws);
    removePlayer(ws);
  });
  ws.on('error', () => {});
});

setInterval(() => {
  for (const ws of sockets) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      // yoksay
    }
  }
}, 30000);

setInterval(() => {
  for (const room of rooms.values()) {
    try {
      roomTick(room);
    } catch (err) {
      console.error('[oda hatası]', err);
    }
  }
}, 100);

server.listen(PORT, () => {
  console.log('');
  console.log('  BLOKARENA sunucusu hazır');
  console.log(`  http://localhost:${PORT}`);
  console.log('  Modlar: SİLAH PVP · BOX PVP · SMP');
  console.log('');
});
