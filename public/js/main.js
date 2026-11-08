import * as THREE from '../vendor/three.module.js';
import { MODES, KITS, WEAPONS, BLOCKS } from '../shared/config.js';
import { getBlock } from '../shared/worldgen.js';
import { Engine } from './engine.js';
import { EntityView } from './entities.js';
import { LocalPlayer } from './player.js';
import { SFX } from './sfx.js';

const $ = (id) => document.getElementById(id);

const dom = {
  canvas: $('game'),
  menu: $('menu'),
  modeGrid: $('modeGrid'),
  kitRow: $('kitRow'),
  kitChips: $('kitChips'),
  nameInput: $('nameInput'),
  playBtn: $('playBtn'),
  hud: $('hud'),
  hudMode: $('hudMode'),
  hudRoom: $('hudRoom'),
  statKills: $('statKills'),
  statDeaths: $('statDeaths'),
  statPing: $('statPing'),
  killfeed: $('killfeed'),
  chatlog: $('chatlog'),
  hitmarker: $('hitmarker'),
  hitNumber: $('hitNumber'),
  scope: $('scope'),
  hpText: $('hpText'),
  hpFill: $('hpFill'),
  modeHint: $('modeHint'),
  hotbar: $('hotbar'),
  weaponName: $('weaponName'),
  ammoCount: $('ammoCount'),
  ammoUnit: $('ammoUnit'),
  reloadText: $('reloadText'),
  ammoPanel: $('ammoPanel'),
  hintLine: $('hintLine'),
  scoreboard: $('scoreboard'),
  scoreModeLabel: $('scoreModeLabel'),
  scoreList: $('scoreList'),
  chatInputWrap: $('chatInputWrap'),
  chatInput: $('chatInput'),
  toasts: $('toasts'),
  death: $('death'),
  deathKiller: $('deathKiller'),
  deathWeapon: $('deathWeapon'),
  respawnCount: $('respawnCount'),
  deathBarFill: $('deathBarFill'),
  pause: $('pause'),
  resumeBtn: $('resumeBtn'),
  leaveBtn: $('leaveBtn'),
  sensitivity: $('sensitivity'),
  sensValue: $('sensValue'),
  loading: $('loading'),
  loadingTitle: $('loadingTitle'),
  loadingText: $('loadingText'),
  loadingTip: $('loadingTip'),
  disconnect: $('disconnect'),
  reconnectBtn: $('reconnectBtn'),
  backMenuBtn: $('backMenuBtn'),
  clickHint: $('clickHint'),
  fatal: $('fatal'),
  fatalText: $('fatalText'),
  fatalBackBtn: $('fatalBackBtn'),
  damageFlash: $('damageFlash')
};

const sfx = new SFX();
const keys = new Set();
const state = {
  mode: 'gun',
  kit: 'warrior',
  name: '',
  ws: null,
  id: null,
  seed: 0,
  started: false,
  connected: false,
  leaving: false,
  engine: null,
  local: null,
  dead: false,
  locked: false,
  chatOpen: false,
  pauseOpen: false,
  loadout: [],
  inventory: [],
  slot: 0,
  hp: 100,
  maxHp: 100,
  scores: new Map(),
  players: new Map(),
  bots: new Map(),
  views: new Map(),
  placed: new Set(),
  mouseLeft: false,
  scoped: false,
  sens: 0.0022,
  baseFov: 74,
  lastState: 0,
  lastPing: 0,
  ping: null,
  respawnDeadline: 0,
  respawnTotal: 3,
  meleeAnim: 0,
  nextMelee: 0,
  nextBlock: 0,
  muzzleUntil: 0,
  recoil: 0,
  bobTime: 0,
  shake: 0,
  viewmodels: {},
  viewmodelRoot: null,
  flashLight: null,
  justLocked: 0,
  hitTimer: 0,
  auto: false
};

const GUN_POS = {
  rifle: { pos: [0.31, -0.27, -0.5], rot: [0.03, -0.08, 0] },
  smg: { pos: [0.3, -0.28, -0.46], rot: [0.03, -0.08, 0] },
  shotgun: { pos: [0.32, -0.27, -0.48], rot: [0.03, -0.06, 0] },
  sniper: { pos: [0.29, -0.28, -0.46], rot: [0.02, -0.06, 0] }
};

const MODE_HINTS = {
  gun: 'ARENA · BLOK KIRMA KAPALI · HIZLI RESPAWN',
  box: 'VOID · KÖPRÜ KUR · DÜŞME',
  smp: 'SURVIVAL · 64 BLOK · ZOMBİLER'
};

const MODE_CONTROLS = {
  gun: 'SOL TIK ateş · SAĞ TIK sniper nişanı · R şarjör · 1/2/3 silah',
  box: 'SOL TIK saldır/kır · SAĞ TIK blok koy · 1 silah · 2 blok',
  smp: 'SOL TIK saldır/kır · SAĞ TIK blok koy · 1 kılıç · 2 blok'
};

const LOADING = {
  gun: ['ARENA HAZIRLANIYOR', 'Siperler ve sandıklar diziliyor…'],
  box: ['VOID PLATFORMLARI KURULUYOR', 'Neon bloklar yerleştiriliyor…'],
  smp: ['DÜNYA ÜRETİLİYOR', 'Arazi, ağaçlar ve zombiler hazırlanıyor…']
};

const TIPS = [
  'İPUCU: Kafadan vuruşlar iki kat hasar verir.',
  'İPUCU: BoxPvP’de yalnızca oyuncuların koyduğu bloklar kırılabilir.',
  'İPUCU: SMP’de 8 saniye hasar almazsan canın yenilenir.',
  'İPUCU: Sniper’da sağ tık yakınlaştırır.',
  'İPUCU: Köprü kurarken blok sayını takip et.',
  'İPUCU: Aynı adresi arkadaşlarınla paylaş, aynı odaya düşersiniz.'
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nextFrame = () => new Promise((resolve) => {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    resolve();
  };
  requestAnimationFrame(finish);
  // Arka plandaki sekmede rAF durur; başlangıç yine de tamamlansın.
  setTimeout(finish, 80);
});

function send(obj) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(obj));
  }
}

function toast(text, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  dom.toasts.append(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 320);
  }, ms);
}

/* ---------------- MENU ---------------- */

function buildModeCards() {
  dom.modeGrid.innerHTML = '';
  Object.values(MODES).forEach((mode, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mode-card';
    card.dataset.mode = mode.id;
    card.style.setProperty('--accent', mode.accent);
    card.innerHTML = `
      <div class="mode-top">
        <span class="mode-index">0${i + 1}</span>
        <span class="mode-live">${mode.bots} BOT</span>
      </div>
      <h3>${mode.name}</h3>
      <p class="mode-tag">${mode.tagline}</p>
      <p class="mode-desc">${mode.desc}</p>
      <ul class="mode-features">${mode.features.map((f) => `<li>${f}</li>`).join('')}</ul>
      <span class="mode-cta">SEÇ VE OYNA</span>
    `;
    card.addEventListener('click', () => {
      sfx.unlock();
      selectMode(mode.id);
    });
    dom.modeGrid.append(card);
  });
}

function selectMode(modeId) {
  if (state.started) return;
  state.mode = modeId;
  document.querySelectorAll('.mode-card').forEach((c) => {
    c.classList.toggle('selected', c.dataset.mode === modeId);
  });
  document.documentElement.style.setProperty('--accent', MODES[modeId].accent);
  document.body.style.setProperty('--accent', MODES[modeId].accent);
  const showKits = modeId === 'box';
  dom.kitRow.classList.toggle('hidden', !showKits);
  if (showKits) renderKits();
}

function renderKits() {
  dom.kitChips.innerHTML = '';
  Object.values(KITS).forEach((kit) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kit-chip' + (state.kit === kit.id ? ' selected' : '');
    btn.innerHTML = `<b>${kit.name}</b><i>${kit.desc}</i>`;
    btn.addEventListener('click', () => {
      state.kit = kit.id;
      renderKits();
      sfx.unlock();
    });
    dom.kitChips.append(btn);
  });
}

function initSensitivity() {
  const stored = Number(localStorage.getItem('blokarena.sens') || 11);
  const value = Number.isFinite(stored) ? clamp(stored, 4, 30) : 11;
  dom.sensitivity.value = String(value);
  dom.sensValue.textContent = String(value);
  state.sens = value * 0.0002;
  dom.sensitivity.addEventListener('input', () => {
    const v = Number(dom.sensitivity.value);
    dom.sensValue.textContent = String(v);
    state.sens = v * 0.0002;
    localStorage.setItem('blokarena.sens', String(v));
  });
}

function startFromMenu() {
  if (state.started) return;
  sfx.unlock();
  const raw = dom.nameInput.value.trim().replace(/[<>]/g, '').slice(0, 16);
  state.name = raw || `OYUNCU${Math.floor(10 + Math.random() * 90)}`;
  localStorage.setItem('blokarena.name', state.name);
  startConnect(state.mode, state.kit);
}

function goMenu() {
  state.leaving = true;
  try {
    state.ws?.close();
  } catch {
    // yoksay
  }
  const suffix = `?mode=${state.mode}${state.mode === 'box' ? `&kit=${state.kit}` : ''}`;
  window.location.href = window.location.pathname + suffix;
}

function startConnect(mode, kit) {
  if (state.ws) {
    try {
      state.ws.close();
    } catch {
      // yoksay
    }
  }
  state.mode = mode;
  state.kit = kit;
  state.started = false;
  state.connected = false;
  state.leaving = false;
  state.dead = false;
  state.scoped = false;
  state.chatOpen = false;
  state.pauseOpen = false;
  state.mouseLeft = false;
  keys.clear();

  dom.menu.classList.add('hidden');
  dom.fatal.classList.add('hidden');
  dom.death.classList.add('hidden');
  dom.pause.classList.add('hidden');
  dom.disconnect.classList.add('hidden');
  dom.clickHint.classList.add('hidden');
  dom.hud.classList.add('hidden');
  dom.loading.classList.remove('hidden');
  dom.loadingTitle.textContent = LOADING[mode][0];
  dom.loadingText.textContent = LOADING[mode][1];
  dom.loadingTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  let ws;
  try {
    ws = new WebSocket(`${proto}://${window.location.host}`);
  } catch {
    showConnectFailure();
    return;
  }
  state.ws = ws;

  ws.addEventListener('open', () => {
    send({ type: 'join', name: state.name, mode, kit });
  });
  ws.addEventListener('message', onSocketMessage);
  ws.addEventListener('close', () => {
    state.connected = false;
    if (state.leaving) return;
    if (state.started) {
      dom.disconnect.classList.remove('hidden');
      dom.clickHint.classList.add('hidden');
      try {
        document.exitPointerLock();
      } catch {
        // yoksay
      }
    } else {
      showConnectFailure();
    }
  });
  ws.addEventListener('error', () => {
    if (!state.started) showConnectFailure();
  });
}

function showConnectFailure() {
  dom.loading.classList.add('hidden');
  dom.menu.classList.remove('hidden');
  dom.disconnect.classList.add('hidden');
  toast('Sunucuya bağlanılamadı. Terminalde "npm start" çalışıyor mu?', 6000);
}

/* ---------------- SOCKET ---------------- */

function onSocketMessage(event) {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }
  switch (msg.type) {
    case 'welcome':
      initGame(msg);
      break;
    case 'playerjoin':
      if (msg.player && msg.player.id !== state.id) addPlayer(msg.player);
      break;
    case 'playerleave':
      removePlayer(msg.id);
      break;
    case 'pstate':
      updatePlayerState(msg);
      break;
    case 'bots':
      updateBots(msg.bots || []);
      break;
    case 'shotfx':
      showShotFx(msg);
      break;
    case 'botshot':
      showBotShot(msg);
      break;
    case 'meleefx':
      showMeleeFx(msg);
      break;
    case 'hit':
      onHit(msg);
      break;
    case 'hurt':
      onHurt(msg);
      break;
    case 'heal':
      state.hp = msg.hp;
      updateHp();
      sfx.heal();
      break;
    case 'kill':
      onKill(msg);
      break;
    case 'died':
      onDied(msg);
      break;
    case 'respawn':
      onRespawn(msg);
      break;
    case 'scores':
      updateScores(msg.entries || []);
      break;
    case 'chat':
      addChat(msg);
      break;
    case 'edit':
      onEdit(msg);
      break;
    case 'pong':
      state.ping = Math.round(performance.now() - msg.t);
      dom.statPing.textContent = String(state.ping);
      break;
    case 'error':
      toast(msg.message || 'Sunucu hatası', 4200);
      if (!state.started) {
        try {
          state.ws?.close();
        } catch {
          // yoksay
        }
      }
      break;
    default:
      break;
  }
}

async function initGame(msg) {
  state.id = msg.id;
  state.seed = msg.seed;
  state.mode = msg.mode;
  state.kit = msg.kit;
  state.connected = true;
  state.loadout = msg.loadout;
  state.inventory = buildInventory(msg.loadout);
  state.slot = 0;
  state.hp = msg.hp;
  state.maxHp = msg.maxHp;
  state.dead = false;
  state.scoped = false;
  state.chatOpen = false;
  state.pauseOpen = false;
  state.scores = new Map((msg.scores || []).map((e) => [e.id, e]));
  state.players.clear();
  state.bots.clear();
  state.views.clear();
  state.placed.clear();
  state.leaving = false;
  state.mouseLeft = false;

  dom.loadingText.textContent = 'Bloklar render ediliyor…';
  await nextFrame();

  try {
    state.engine = new Engine(dom.canvas);
    state.engine.buildWorld(msg.mode, msg.seed, msg.edits || []);
  } catch (err) {
    console.error('[blokarena] motor hatası', err);
    dom.loading.classList.add('hidden');
    dom.fatalText.textContent = 'WebGL başlatılamadı: ' + (err && err.message ? err.message : String(err));
    dom.fatal.classList.remove('hidden');
    try {
      state.ws?.close();
    } catch {
      // yoksay
    }
    return;
  }

  for (const [x, y, z, block] of msg.edits || []) {
    if (block > 0) state.placed.add(`${x},${y},${z}`);
  }

  state.local = new LocalPlayer(msg.spawn, msg.mode);
  buildViewmodels();
  for (const p of msg.players || []) addPlayer(p);
  for (const b of msg.bots || []) addBot(b);
  // Yükleme sırasında gelen oyuncu/bot mesajları için görünümleri tamamla.
  for (const p of state.players.values()) addPlayer(p);
  for (const b of state.bots.values()) addBot(b);

  dom.loading.classList.add('hidden');
  dom.menu.classList.add('hidden');
  dom.hud.classList.remove('hidden');
  dom.killfeed.innerHTML = '';
  dom.chatlog.innerHTML = '';
  dom.hudMode.textContent = MODES[msg.mode].name;
  dom.scoreModeLabel.textContent = MODES[msg.mode].name;
  dom.hudRoom.textContent = `ODA ${String(msg.seed).slice(-5)}`;
  dom.modeHint.textContent = MODE_HINTS[msg.mode];
  dom.hintLine.textContent = MODE_CONTROLS[msg.mode];
  dom.statPing.textContent = '—';
  document.documentElement.style.setProperty('--accent', MODES[msg.mode].accent);
  document.body.style.setProperty('--accent', MODES[msg.mode].accent);
  document.body.classList.remove('lowhp', 'scoped');
  dom.death.classList.add('hidden');
  dom.pause.classList.add('hidden');
  dom.disconnect.classList.add('hidden');

  buildHotbar();
  updateHud();
  renderScoreboard();
  selectSlot(0);
  state.started = true;

  state.engine.camera.position.set(
    state.local.pos.x - state.engine.offset.x,
    state.local.pos.y + 1.62,
    state.local.pos.z - state.engine.offset.z
  );
  state.engine.camera.rotation.set(0, state.local.yaw, 0, 'YXZ');

  updateClickHint();
  toast(`${MODES[msg.mode].name} odasına hoş geldin, ${state.name}.`, 3200);
  console.log('[blokarena] bağlantı kuruldu', msg.id, msg.mode, `seed=${msg.seed}`);
}

/* ---------------- PLAYER / BOT VIEWS ---------------- */

function addPlayer(p) {
  if (!p || p.id === state.id) return;
  state.players.set(p.id, p);
  if (state.engine && !state.views.has(p.id)) {
    state.views.set(p.id, new EntityView(state.engine.scene, state.engine, p, state.mode));
  }
}

function removePlayer(id) {
  const view = state.views.get(id);
  if (view) {
    view.dispose();
    state.views.delete(id);
  }
  state.players.delete(id);
}

function addBot(b) {
  const data = { ...b, isBot: true };
  state.bots.set(data.id, data);
  if (state.engine && !state.views.has(data.id)) {
    state.views.set(data.id, new EntityView(state.engine.scene, state.engine, data, state.mode));
  }
}

function updatePlayerState(msg) {
  if (msg.id === state.id) return;
  const data = state.players.get(msg.id);
  if (!data) return;
  data.pos = msg.pos;
  data.yaw = msg.yaw;
  if (Number.isFinite(msg.hp)) data.hp = msg.hp;
  data.dead = !!msg.dead;
  if (Number.isFinite(msg.slot)) data.slot = msg.slot;
  if (msg.weapon) data.weapon = msg.weapon;
  const view = state.views.get(msg.id);
  if (view) view.applyNet(data);
}

function updateBots(list) {
  for (const b of list) {
    const existing = state.bots.get(b.id);
    if (existing) {
      Object.assign(existing, b);
      const view = state.views.get(b.id);
      if (view) view.applyNet(existing);
    } else {
      addBot(b);
    }
  }
}

/* ---------------- FX ---------------- */

function showShotFx(msg) {
  if (msg.id === state.id || !state.engine) return;
  const w = WEAPONS[msg.weapon];
  const range = w ? w.range : 120;
  const from = state.engine.toRender(msg.from.x, msg.from.y, msg.from.z);
  const hit = state.engine.raycast(msg.from, msg.dir, range);
  const t = hit.hit ? hit.t : range;
  const to = state.engine.toRender(
    msg.from.x + msg.dir.x * t,
    msg.from.y + msg.dir.y * t,
    msg.from.z + msg.dir.z * t
  );
  state.engine.tracers.spawn(from, to, w ? w.tracer : '#ffd166');
  state.engine.particles.burst(from, '#ffd27a', 2, 2);
  const dist = from.distanceTo(state.engine.camera.position);
  if (dist < 90) sfx.shoot(msg.weapon, clamp(0.65 - dist / 140, 0.04, 0.55));
}

function showBotShot(msg) {
  if (!state.engine) return;
  const w = WEAPONS[msg.weapon];
  const from = state.engine.toRender(msg.from.x, msg.from.y, msg.from.z);
  const to = state.engine.toRender(msg.to.x, msg.to.y, msg.to.z);
  state.engine.tracers.spawn(from, to, w ? w.tracer : '#ffb36b');
  state.engine.particles.burst(from, '#ffd27a', 2, 2);
  if (msg.hit) state.engine.particles.burst(to, '#ff8a6b', 5, 2.6);
  const dist = from.distanceTo(state.engine.camera.position);
  if (dist < 90) sfx.shoot(msg.weapon, clamp(0.55 - dist / 150, 0.03, 0.45));
}

function showMeleeFx(msg) {
  if (!state.engine) return;
  const view = state.views.get(msg.id);
  if (view) view.triggerSwing();
  if (msg.id === state.id) return;
  const to = state.engine.toRender(msg.to.x, msg.to.y, msg.to.z);
  if (msg.hit) state.engine.particles.burst(to, '#ffb3b3', 4, 2.2);
  const dist = to.distanceTo(state.engine.camera.position);
  if (dist < 18) sfx.swing();
}

function onHit(msg) {
  sfx.hit(!!msg.headshot);
  dom.hitmarker.classList.remove('show', 'head', 'kill');
  void dom.hitmarker.offsetWidth;
  if (msg.headshot) dom.hitmarker.classList.add('head');
  dom.hitmarker.classList.add('show');

  dom.hitNumber.textContent = `${msg.headshot ? 'KAFADAN ' : ''}${msg.dmg} HASAR`;
  dom.hitNumber.classList.remove('show', 'head', 'kill');
  void dom.hitNumber.offsetWidth;
  if (msg.headshot) dom.hitNumber.classList.add('head');
  dom.hitNumber.classList.add('show');

  clearTimeout(state.hitTimer);
  state.hitTimer = setTimeout(() => dom.hitmarker.classList.remove('show'), 180);
}

function onHurt(msg) {
  state.hp = Math.max(0, Number(msg.hp) || 0);
  updateHp();
  sfx.hurt();
  state.shake = Math.max(state.shake, 0.28);
  dom.damageFlash.classList.remove('flash');
  void dom.damageFlash.offsetWidth;
  dom.damageFlash.classList.add('flash');
}

function onKill(msg) {
  addKillFeed(msg);
  if (msg.killerId === state.id) {
    sfx.kill();
    dom.hitmarker.classList.remove('show', 'head', 'kill');
    void dom.hitmarker.offsetWidth;
    dom.hitmarker.classList.add('kill', 'show');
    dom.hitNumber.textContent = 'ELENDİ';
    dom.hitNumber.classList.remove('show', 'head', 'kill');
    void dom.hitNumber.offsetWidth;
    dom.hitNumber.classList.add('kill', 'show');
    clearTimeout(state.hitTimer);
    state.hitTimer = setTimeout(() => {
      dom.hitmarker.classList.remove('show', 'kill');
      dom.hitNumber.classList.remove('show', 'kill');
    }, 700);
  }
}

function onDied(msg) {
  state.dead = true;
  state.hp = 0;
  state.mouseLeft = false;
  state.scoped = false;
  updateScope();
  updateHp();
  state.respawnTotal = Math.max(1, Number(msg.respawnIn) || 3);
  state.respawnDeadline = performance.now() + state.respawnTotal * 1000;
  dom.deathKiller.textContent = msg.by ? `${String(msg.by).toUpperCase()} SENİ ELEDİ` : 'VOID SENİ YUTTU';
  dom.deathWeapon.textContent = msg.weapon === 'void'
    ? 'BOŞLUĞA DÜŞTÜN'
    : `${(WEAPONS[msg.weapon]?.name || String(msg.weapon || 'SİLAH')).toUpperCase()} İLE`;
  dom.death.classList.remove('hidden');
  dom.clickHint.classList.add('hidden');
  dom.pause.classList.add('hidden');
  state.pauseOpen = false;
  sfx.death();
  try {
    document.exitPointerLock();
  } catch {
    // yoksay
  }
  updateDeathCountdown(performance.now());
}

function onRespawn(msg) {
  state.dead = false;
  state.hp = Number(msg.hp) || state.maxHp;
  state.local.teleport({
    x: msg.pos.x,
    y: msg.pos.y,
    z: msg.pos.z,
    yaw: msg.yaw
  });
  state.local.pitch = 0;
  resetInventory();
  updateHp();
  dom.death.classList.add('hidden');
  document.body.classList.remove('lowhp');
  state.respawnDeadline = 0;
  updateClickHint();
  sfx.pickup();
}

function updateScores(entries) {
  state.scores = new Map(entries.map((e) => [e.id, e]));
  updateStats();
  if (!dom.scoreboard.classList.contains('hidden')) renderScoreboard();
}

/* ---------------- CHAT / SCOREBOARD ---------------- */

function addChat(msg) {
  const line = document.createElement('div');
  line.className = 'chat-line' + (msg.system ? ' system' : '');
  const name = document.createElement('b');
  name.textContent = msg.name || 'SİSTEM';
  line.append(name, document.createTextNode(msg.text || ''));
  dom.chatlog.append(line);
  while (dom.chatlog.children.length > 7) dom.chatlog.firstElementChild.remove();
  const fade = setTimeout(() => {
    line.style.opacity = '0';
    line.style.transition = 'opacity 0.6s';
    setTimeout(() => line.remove(), 650);
  }, 16000);
  line.addEventListener('animationend', () => clearTimeout(fade), { once: true });
}

function openChat() {
  if (!state.started || state.dead) return;
  state.chatOpen = true;
  dom.chatInputWrap.classList.remove('hidden');
  dom.chatInput.value = '';
  dom.chatInput.focus();
  updateClickHint();
}

function closeChat() {
  state.chatOpen = false;
  dom.chatInputWrap.classList.add('hidden');
  dom.chatInput.blur();
  updateClickHint();
}

function onChatKey(e) {
  e.stopPropagation();
  if (e.key === 'Enter') {
    const text = dom.chatInput.value.trim();
    if (text) send({ type: 'chat', text });
    closeChat();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    closeChat();
    e.preventDefault();
  }
}

function showScoreboard() {
  if (!state.started) return;
  renderScoreboard();
  dom.scoreboard.classList.remove('hidden');
}

function hideScoreboard() {
  dom.scoreboard.classList.add('hidden');
}

function renderScoreboard() {
  const list = [...state.scores.values()].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  dom.scoreList.innerHTML = '';
  list.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    if (entry.id === state.id) row.classList.add('me');
    if (entry.isBot) row.classList.add('bot');
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = String(i + 1).padStart(2, '0');
    const pname = document.createElement('span');
    pname.className = 'pname';
    pname.textContent = entry.name;
    if (entry.isBot) {
      const tag = document.createElement('em');
      tag.textContent = 'BOT';
      pname.append(tag);
    }
    if (entry.id === state.id) {
      const tag = document.createElement('em');
      tag.textContent = 'SEN';
      pname.append(tag);
    }
    const kills = document.createElement('span');
    kills.className = 'pval';
    kills.textContent = String(entry.kills);
    const deaths = document.createElement('span');
    deaths.className = 'pval';
    deaths.textContent = String(entry.deaths);
    row.append(rank, pname, kills, deaths);
    dom.scoreList.append(row);
  });
}

function addKillFeed(msg) {
  const row = document.createElement('div');
  row.className = 'kill-row';
  if (msg.killerId === state.id) row.classList.add('mine');
  if (msg.victimId === state.id) row.classList.add('on-me');
  const killer = document.createElement('b');
  killer.className = 'killer';
  killer.textContent = msg.killer || 'VOID';
  const weapon = document.createElement('span');
  weapon.className = 'kill-weapon';
  weapon.textContent = msg.weapon === 'void'
    ? 'VOID'
    : (WEAPONS[msg.weapon]?.name || String(msg.weapon || '').toUpperCase());
  const victim = document.createElement('b');
  victim.className = 'victim';
  victim.textContent = msg.victim || '—';
  row.append(killer, weapon, victim);
  dom.killfeed.prepend(row);
  while (dom.killfeed.children.length > 5) dom.killfeed.lastElementChild.remove();
  setTimeout(() => {
    row.style.opacity = '0';
    row.style.transition = 'opacity 0.5s';
    setTimeout(() => row.remove(), 520);
  }, 6000);
}

/* ---------------- HUD ---------------- */

function buildInventory(loadout) {
  return loadout.map((slot) => {
    if (slot.kind === 'weapon') {
      const w = WEAPONS[slot.weapon];
      return {
        kind: 'weapon',
        weapon: slot.weapon,
        ammo: w.mag || 0,
        reloading: false,
        reloadEnd: 0,
        nextShot: 0
      };
    }
    return {
      kind: 'blocks',
      count: slot.count || 0,
      blockId: slot.blockId || 8
    };
  });
}

function buildHotbar() {
  dom.hotbar.innerHTML = '';
  state.inventory.forEach((slot, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'slot';
    el.dataset.index = String(i);
    const isBlock = slot.kind === 'blocks';
    if (isBlock) el.classList.add('block-slot');
    const accent = slot.kind === 'weapon' ? WEAPONS[slot.weapon].accent : '#6ad0ff';
    const blockColor = isBlock ? (BLOCKS[slot.blockId]?.color || '#6ad0ff') : '';
    el.style.setProperty('--slot-accent', accent);
    if (isBlock) el.style.setProperty('--block-color', blockColor);
    el.innerHTML = `
      <span class="slot-key">${i + 1}</span>
      <span class="slot-icon"></span>
      <span class="slot-name"></span>
      <span class="slot-sub"></span>
    `;
    el.querySelector('.slot-name').textContent = slot.kind === 'weapon'
      ? WEAPONS[slot.weapon].name
      : (BLOCKS[slot.blockId]?.name || 'BLOK').toUpperCase();
    el.addEventListener('click', () => selectSlot(i));
    dom.hotbar.append(el);
  });
  updateHotbar();
}

function updateHotbar() {
  [...dom.hotbar.children].forEach((el, i) => {
    el.classList.toggle('active', i === state.slot);
    const slot = state.inventory[i];
    const sub = el.querySelector('.slot-sub');
    if (!slot || !sub) return;
    if (slot.kind === 'weapon') {
      const w = WEAPONS[slot.weapon];
      sub.textContent = w.kind === 'gun' ? `${slot.ammo}/${w.mag}` : 'YAKIN';
    } else {
      sub.textContent = `×${slot.count}`;
    }
  });
}

function selectSlot(i) {
  if (i < 0 || i >= state.inventory.length || state.dead) return;
  state.slot = i;
  state.scoped = false;
  updateScope();
  updateHotbar();
  updateWeaponPanel();
}

function updateWeaponPanel() {
  const slot = state.inventory[state.slot];
  if (!slot) {
    dom.weaponName.textContent = '—';
    dom.ammoCount.textContent = '0';
    dom.ammoUnit.textContent = '';
    dom.reloadText.textContent = '';
    return;
  }
  if (slot.kind === 'weapon') {
    const w = WEAPONS[slot.weapon];
    dom.weaponName.textContent = w.name;
    if (w.kind === 'gun') {
      dom.ammoCount.textContent = String(slot.ammo);
      dom.ammoUnit.textContent = 'MERMİ';
      dom.reloadText.textContent = slot.reloading ? 'ŞARJÖR…' : '';
    } else {
      dom.ammoCount.textContent = '∞';
      dom.ammoUnit.textContent = 'YAKIN DÖVÜŞ';
      dom.reloadText.textContent = '';
    }
  } else {
    dom.weaponName.textContent = (BLOCKS[slot.blockId]?.name || 'BLOK').toUpperCase();
    dom.ammoCount.textContent = String(slot.count);
    dom.ammoUnit.textContent = 'BLOK';
    dom.reloadText.textContent = '';
  }
  updateHotbar();
}

function updateHp() {
  const ratio = clamp(state.hp / state.maxHp, 0, 1);
  dom.hpFill.style.width = `${ratio * 100}%`;
  dom.hpText.textContent = String(Math.max(0, Math.round(state.hp)));
  dom.hpFill.classList.toggle('danger', ratio <= 0.32);
  document.body.classList.toggle('lowhp', ratio <= 0.32 && !state.dead);
}

function updateHud() {
  updateHp();
  updateStats();
  updateWeaponPanel();
}

function updateStats() {
  const me = state.scores.get(state.id);
  if (me) {
    dom.statKills.textContent = String(me.kills);
    dom.statDeaths.textContent = String(me.deaths);
  }
}

function updateDeathCountdown(now) {
  if (!state.dead) return;
  const left = Math.max(0, state.respawnDeadline - now);
  dom.respawnCount.textContent = String(Math.ceil(left / 1000));
  dom.deathBarFill.style.width = `${(left / (state.respawnTotal * 1000)) * 100}%`;
}

function resetInventory() {
  state.inventory = buildInventory(state.loadout);
  state.slot = 0;
  buildHotbar();
  updateWeaponPanel();
}

function updateScope() {
  dom.scope.classList.toggle('hidden', !state.scoped);
  document.body.classList.toggle('scoped', state.scoped);
}

function updateClickHint() {
  const show = state.started
    && !state.dead
    && !state.locked
    && !state.pauseOpen
    && !state.chatOpen
    && !state.leaving;
  dom.clickHint.classList.toggle('hidden', !show);
}

/* ---------------- VIEWMODEL ---------------- */

function vmMat(color) {
  return new THREE.MeshLambertMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    fog: false
  });
}

function makeGunModel(id) {
  const w = WEAPONS[id];
  const spec = {
    rifle: { body: 0.5, barrel: 0.34, width: 0.11, height: 0.13 },
    smg: { body: 0.34, barrel: 0.22, width: 0.1, height: 0.12 },
    shotgun: { body: 0.48, barrel: 0.42, width: 0.12, height: 0.14 },
    sniper: { body: 0.62, barrel: 0.5, width: 0.1, height: 0.12 }
  }[id] || { body: 0.5, barrel: 0.34, width: 0.11, height: 0.13 };
  const g = new THREE.Group();
  const dark = vmMat(0x252c38);
  const metal = vmMat(0x7d8b9c);
  const accent = vmMat(w.accent);

  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height, spec.body), dark);
  body.position.z = -0.02;
  g.add(body);

  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, spec.barrel), metal);
  barrel.position.set(0, 0.02, -(spec.body / 2 + spec.barrel / 2 - 0.06));
  g.add(barrel);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.9, 0.09, 0.2), dark);
  stock.position.set(0, -0.01, spec.body / 2 + 0.08);
  g.add(stock);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.18, 0.1), dark);
  mag.position.set(0, -0.14, -0.05);
  g.add(mag);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), dark);
  grip.position.set(0, -0.12, 0.16);
  g.add(grip);

  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.06), accent);
  tip.position.set(0, 0.02, -(spec.body / 2 + spec.barrel - 0.06));
  g.add(tip);

  if (spec.scope || id === 'sniper') {
    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.24), metal);
    scope.position.set(0, 0.11, -0.02);
    g.add(scope);
  }

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false
  });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), flashMat);
  flash.position.set(0, 0.02, -(spec.body / 2 + spec.barrel - 0.02));
  flash.visible = false;
  flash.renderOrder = 110;
  g.add(flash);
  g.userData.flash = flash;

  const pos = GUN_POS[id] || GUN_POS.rifle;
  g.position.set(...pos.pos);
  g.rotation.set(...pos.rot);
  g.traverse((o) => {
    if (o.isMesh) o.renderOrder = 100;
  });
  return g;
}

function makeSwordModel() {
  const g = new THREE.Group();
  const steel = vmMat(0xdce9f5);
  const dark = vmMat(0x4b3422);
  const gold = vmMat(0xd3ab55);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.1), steel);
  blade.position.y = 0.28;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 4), steel);
  tip.position.y = 0.72;
  tip.rotation.y = Math.PI / 4;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.11), gold);
  guard.position.y = -0.1;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.08), dark);
  grip.position.y = -0.24;
  g.add(blade, tip, guard, grip);
  g.scale.setScalar(0.72);
  g.position.set(0.42, -0.4, -0.72);
  g.rotation.set(-0.32, 0.2, 0.24);
  g.userData.flash = null;
  g.traverse((o) => {
    if (o.isMesh) o.renderOrder = 100;
  });
  return g;
}

function makeBlockModel(blockId) {
  const color = BLOCKS[blockId]?.color || '#63d8ff';
  const mat = vmMat(new THREE.Color(color));
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat);
  mesh.rotation.set(0.42, 0.5, 0.2);
  mesh.renderOrder = 100;
  const g = new THREE.Group();
  g.add(mesh);
  g.position.set(0.38, -0.34, -0.58);
  g.userData.flash = null;
  return g;
}

function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material?.dispose();
    }
  });
}

function buildViewmodels() {
  if (!state.engine) return;
  if (state.viewmodelRoot) {
    state.engine.camera.remove(state.viewmodelRoot);
    disposeObject(state.viewmodelRoot);
  }
  if (state.flashLight) {
    state.engine.camera.remove(state.flashLight);
    state.flashLight = null;
  }
  const root = new THREE.Group();
  state.engine.camera.add(root);
  state.viewmodelRoot = root;
  state.viewmodels = {};

  state.inventory.forEach((slot, i) => {
    const model = slot.kind === 'weapon'
      ? (WEAPONS[slot.weapon].kind === 'melee' ? makeSwordModel() : makeGunModel(slot.weapon))
      : makeBlockModel(slot.blockId);
    model.visible = false;
    model.userData.basePos = model.position.clone();
    model.userData.baseRot = model.rotation.clone();
    root.add(model);
    state.viewmodels[i] = model;
  });

  const light = new THREE.PointLight(0xffb45e, 0, 4);
  light.position.set(0.3, -0.1, -0.8);
  state.engine.camera.add(light);
  state.flashLight = light;
}

function updateViewmodel(dt, now) {
  if (!state.viewmodelRoot) return;
  Object.entries(state.viewmodels).forEach(([i, model]) => {
    model.visible = Number(i) === state.slot && !state.scoped;
  });
  const slot = state.inventory[state.slot];
  const model = state.viewmodels[state.slot];
  if (!slot || !model) {
    if (state.flashLight) state.flashLight.intensity = 0;
    return;
  }
  const basePos = model.userData.basePos;
  const baseRot = model.userData.baseRot;
  const speed = Math.hypot(state.local.vel.x, state.local.vel.z);
  const bobAmp = clamp(speed / 8, 0, 0.9);
  const px = basePos.x + Math.sin(state.bobTime) * 0.009 * bobAmp;
  let py = basePos.y - Math.abs(Math.sin(state.bobTime * 2)) * 0.008 * bobAmp;
  let pz = basePos.z + state.recoil * 0.4;
  let rx = baseRot.x + state.recoil * 1.7;
  let ry = baseRot.y;
  let rz = baseRot.z;

  if (slot.reloading) {
    py -= 0.13;
    rx -= 0.5;
  }
  if (state.meleeAnim > 0) {
    state.meleeAnim = Math.max(0, state.meleeAnim - dt);
    const t = 1 - state.meleeAnim / 0.28;
    rx -= Math.sin(t * Math.PI) * 1.15;
    rz += Math.sin(t * Math.PI) * 0.5;
  }

  model.position.set(px, py, pz);
  model.rotation.set(rx, ry, rz);

  if (state.flashLight) {
    const firing = now < state.muzzleUntil && !state.scoped;
    state.flashLight.intensity = firing ? 2.2 : 0;
  }
  const flash = model.userData.flash;
  if (flash) flash.visible = now < state.muzzleUntil && !state.scoped;
}

/* ---------------- COMBAT ---------------- */

function canAct() {
  return state.started && !state.dead && state.locked && !state.chatOpen && !state.pauseOpen;
}

function eyePos() {
  return {
    x: state.local.pos.x,
    y: state.local.pos.y + 1.62,
    z: state.local.pos.z
  };
}

function aimDir() {
  const cp = Math.cos(state.local.pitch);
  return {
    x: -Math.sin(state.local.yaw) * cp,
    y: Math.sin(state.local.pitch),
    z: -Math.cos(state.local.yaw) * cp
  };
}

function muzzlePoint() {
  const cam = state.engine.camera;
  cam.updateMatrixWorld();
  return new THREE.Vector3(0.28, -0.15, -1.0).applyMatrix4(cam.matrixWorld);
}

function blockColor(id) {
  return BLOCKS[id]?.color || '#9aa3b2';
}

function spreadDir(dir, spread) {
  if (!spread) return dir;
  const v = new THREE.Vector3(dir.x, dir.y, dir.z);
  const up = Math.abs(v.y) < 0.98
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const right = new THREE.Vector3().crossVectors(v, up).normalize();
  const up2 = new THREE.Vector3().crossVectors(right, v).normalize();
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * spread;
  v.addScaledVector(right, Math.cos(a) * r).addScaledVector(up2, Math.sin(a) * r).normalize();
  return { x: v.x, y: v.y, z: v.z };
}

function rayAABB(ox, oy, oz, dx, dy, dz, minx, miny, minz, maxx, maxy, maxz) {
  let tmin = 0;
  let tmax = 1e9;
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
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

function raycastEntities(origin, dir, maxDist) {
  let best = null;
  const check = (ent) => {
    if (!ent || ent.dead) return;
    const t = rayAABB(
      origin.x, origin.y, origin.z, dir.x, dir.y, dir.z,
      ent.pos.x - 0.35, ent.pos.y, ent.pos.z - 0.35,
      ent.pos.x + 0.35, ent.pos.y + 1.8, ent.pos.z + 0.35
    );
    if (t !== null && t <= maxDist && (!best || t < best.t)) {
      best = {
        t,
        entity: ent,
        point: {
          x: origin.x + dir.x * t,
          y: origin.y + dir.y * t,
          z: origin.z + dir.z * t
        }
      };
    }
  };
  for (const p of state.players.values()) {
    if (p.id !== state.id) check(p);
  }
  for (const b of state.bots.values()) check(b);
  return best;
}

function primaryAction(now) {
  if (!canAct()) return;
  const slot = state.inventory[state.slot];
  if (!slot) return;
  if (slot.kind === 'weapon') tryFire(now);
  else if (slot.kind === 'blocks') breakBlock(now);
}

function tryFire(now) {
  if (!canAct()) return;
  const slot = state.inventory[state.slot];
  if (!slot || slot.kind !== 'weapon') return;
  const w = WEAPONS[slot.weapon];
  if (w.kind === 'melee') {
    meleeAttack(now, w);
    return;
  }
  if (slot.reloading) return;
  if (slot.ammo <= 0) {
    startReload();
    return;
  }
  if (now < slot.nextShot) return;
  slot.nextShot = now + 60000 / w.rpm;
  slot.ammo--;

  const eye = eyePos();
  const baseDir = aimDir();
  state.recoil = Math.min(0.5, state.recoil + w.recoil * 1.8);
  state.muzzleUntil = now + 45;
  state.local.pitch = clamp(state.local.pitch + w.recoil * 0.28, -1.5, 1.5);
  state.local.yaw += (Math.random() - 0.5) * w.recoil * 0.22;

  for (let i = 0; i < w.pellets; i++) {
    const dir = spreadDir(baseDir, w.spread);
    const blockHit = state.engine.raycast(eye, dir, w.range);
    const blockT = blockHit.hit ? blockHit.t : w.range;
    const ent = raycastEntities(eye, dir, Math.min(blockT, w.range));
    const t = ent ? ent.t : blockT;
    const point = {
      x: eye.x + dir.x * t,
      y: eye.y + dir.y * t,
      z: eye.z + dir.z * t
    };
    const to = state.engine.toRender(point.x, point.y, point.z);
    state.engine.tracers.spawn(muzzlePoint(), to, w.tracer || '#ffd166');
    if (ent) {
      state.engine.particles.burst(to, '#ff8a6b', 4, 2.6);
    } else if (blockHit.hit) {
      state.engine.particles.burst(to, blockColor(blockHit.block), 4, 2.1);
    }
  }

  sfx.shoot(slot.weapon);
  send({ type: 'shot', weapon: slot.weapon, origin: eye, dir: baseDir });
  if (slot.ammo === 0) startReload();
  updateWeaponPanel();
}

function meleeAttack(now, w) {
  if (now < state.nextMelee) return;
  state.nextMelee = now + Math.max(300, 60000 / w.rpm);
  state.meleeAnim = 0.28;
  sfx.swing();

  const eye = eyePos();
  const dir = aimDir();
  const hit = state.engine.raycast(eye, dir, w.range);
  const maxT = hit.hit ? Math.min(hit.t, w.range) : w.range;
  const ent = raycastEntities(eye, dir, maxT);
  if (ent) {
    state.engine.particles.burst(
      state.engine.toRender(ent.point.x, ent.point.y, ent.point.z),
      '#ffb3b3',
      4,
      2.2
    );
  }
  send({ type: 'melee', weapon: w.id, origin: eye, dir });
}

function startReload() {
  const slot = state.inventory[state.slot];
  if (!slot || slot.kind !== 'weapon') return;
  const w = WEAPONS[slot.weapon];
  if (w.kind !== 'gun' || slot.reloading || slot.ammo >= w.mag) return;
  slot.reloading = true;
  slot.reloadEnd = performance.now() + w.reload * 1000;
  sfx.reload();
  updateWeaponPanel();
}

function updateReloads(now) {
  state.inventory.forEach((slot, i) => {
    if (slot.kind !== 'weapon') return;
    const w = WEAPONS[slot.weapon];
    if (w.kind !== 'gun' || !slot.reloading) return;
    if (now >= slot.reloadEnd) {
      slot.ammo = w.mag;
      slot.reloading = false;
      if (i === state.slot) updateWeaponPanel();
    }
  });
}

function breakBlock(now) {
  if (!MODES[state.mode].allowBuild) return;
  if (now < state.nextBlock) return;
  const eye = eyePos();
  const dir = aimDir();
  const hit = state.engine.raycast(eye, dir, 7);
  if (!hit.hit) return;
  const key = `${hit.x},${hit.y},${hit.z}`;
  if (state.mode === 'box' && !state.placed.has(key)) {
    state.nextBlock = now + 500;
    toast('BoxPvP: yalnızca oyuncuların koyduğu bloklar kırılabilir.', 2200);
    return;
  }
  state.nextBlock = now + 150;
  const point = state.engine.toRender(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  state.engine.particles.burst(point, blockColor(hit.block), 6, 2.1);
  sfx.breakBlock();
  send({ type: 'edit', x: hit.x, y: hit.y, z: hit.z, block: 0 });
}

function placeBlock() {
  if (!MODES[state.mode].allowBuild || !canAct()) return;
  const slot = state.inventory[state.slot];
  if (!slot || slot.kind !== 'blocks' || slot.count <= 0) return;
  const eye = eyePos();
  const dir = aimDir();
  const hit = state.engine.raycast(eye, dir, 7);
  if (!hit.hit) return;
  const tx = hit.x + hit.nx;
  const ty = hit.y + hit.ny;
  const tz = hit.z + hit.nz;
  if (!hit.nx && !hit.ny && !hit.nz) return;
  if (getBlock(state.engine.world, tx, ty, tz) !== 0) return;

  const p = state.local.pos;
  if (
    tx + 1 > p.x - 0.3 && tx < p.x + 0.3 &&
    tz + 1 > p.z - 0.3 && tz < p.z + 0.3 &&
    ty + 1 > p.y && ty < p.y + 1.8
  ) return;

  send({ type: 'edit', x: tx, y: ty, z: tz, block: slot.blockId });
  slot.count = Math.max(0, slot.count - 1);
  sfx.place();
  updateWeaponPanel();
}

function onEdit(msg) {
  if (!state.engine?.world) return;
  state.engine.setBlock(msg.x, msg.y, msg.z, msg.block);
  const key = `${msg.x},${msg.y},${msg.z}`;
  if (msg.block > 0) state.placed.add(key);
  else state.placed.delete(key);

  if (msg.by === state.id) {
    if (msg.block === 0) {
      const slot = state.inventory.find((s) => s.kind === 'blocks');
      if (slot) slot.count = Math.min(999, slot.count + 1);
      updateWeaponPanel();
    }
    return;
  }

  const point = state.engine.toRender(msg.x + 0.5, msg.y + 0.5, msg.z + 0.5);
  const color = msg.block > 0 ? blockColor(msg.block) : '#9aa3b2';
  state.engine.particles.burst(point, color, msg.block > 0 ? 3 : 5, 1.8);
  const dist = point.distanceTo(state.engine.camera.position);
  if (dist < 26) {
    if (msg.block > 0) sfx.place();
    else sfx.breakBlock();
  }
}

/* ---------------- INPUT ---------------- */

function requestLock() {
  if (!state.started || state.dead) return;
  if (document.pointerLockElement === dom.canvas) return;
  try {
    const result = dom.canvas.requestPointerLock();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    // yoksay
  }
}

function onLockChange() {
  const locked = document.pointerLockElement === dom.canvas;
  state.locked = locked;
  if (locked) {
    state.justLocked = performance.now();
    if (state.pauseOpen) {
      state.pauseOpen = false;
      dom.pause.classList.add('hidden');
    }
  } else {
    state.mouseLeft = false;
    state.scoped = false;
    updateScope();
    if (state.started && !state.dead && !state.chatOpen && !state.leaving && !state.disconnectOpen) {
      state.pauseOpen = true;
      dom.pause.classList.remove('hidden');
    }
  }
  updateClickHint();
}

function onKeyDown(e) {
  if (!state.started) return;
  if (state.chatOpen) {
    if (e.code === 'Escape') {
      closeChat();
      e.preventDefault();
    }
    return;
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    if (!state.dead) showScoreboard();
    return;
  }
  if (e.code === 'KeyT' && !e.repeat) {
    e.preventDefault();
    openChat();
    return;
  }
  if (e.code === 'Escape') {
    state.scoped = false;
    updateScope();
    return;
  }
  if (state.dead || !state.locked) return;
  if (e.code === 'KeyR') {
    startReload();
    return;
  }
  if (/^Digit[1-9]$/.test(e.code)) {
    const n = Number(e.code.slice(5));
    selectSlot(n - 1);
    return;
  }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
  }
}

function onKeyUp(e) {
  keys.delete(e.code);
  if (e.code === 'Tab') hideScoreboard();
}

function onMouseDown(e) {
  if (!state.started) return;
  if (e.target.closest && (e.target.closest('.slot') || e.target.closest('.chat-input-wrap'))) return;
  if (!state.locked) {
    if (e.target === dom.canvas || e.target === dom.hud) requestLock();
    return;
  }
  if (state.chatOpen || state.dead || state.pauseOpen) return;
  if (performance.now() - state.justLocked < 120) return;

  if (e.button === 0) {
    state.mouseLeft = true;
    primaryAction(performance.now());
  } else if (e.button === 2) {
    const slot = state.inventory[state.slot];
    if (slot?.kind === 'weapon' && WEAPONS[slot.weapon].scope && state.mode === 'gun') {
      state.scoped = true;
      updateScope();
    } else if (slot?.kind === 'blocks') {
      placeBlock();
    }
  }
}

function onMouseUp(e) {
  if (e.button === 0) state.mouseLeft = false;
  if (e.button === 2) {
    state.scoped = false;
    updateScope();
  }
}

function onMouseMove(e) {
  if (!state.started || !state.locked || state.dead || state.chatOpen) return;
  let sens = state.sens;
  if (state.scoped) sens *= 0.35;
  state.local.yaw -= e.movementX * sens;
  state.local.pitch = clamp(state.local.pitch - e.movementY * sens, -1.52, 1.52);
}

function updateHighlight(active) {
  const slot = state.inventory[state.slot];
  if (active && MODES[state.mode].allowBuild && slot?.kind === 'blocks') {
    const hit = state.engine.raycast(eyePos(), aimDir(), 7);
    state.engine.setHighlight(hit);
  } else {
    state.engine.setHighlight(null);
  }
}

/* ---------------- LOOP ---------------- */

let lastFrame = performance.now();

function loop(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  if (state.started && state.engine && state.local) {
    updateGame(dt, now);
  }
  requestAnimationFrame(loop);
}

function updateGame(dt, now) {
  const eng = state.engine;
  const local = state.local;
  const active = canAct();

  const targetFov = state.scoped ? 26 : state.baseFov;
  if (Math.abs(eng.camera.fov - targetFov) > 0.02) {
    eng.camera.fov += (targetFov - eng.camera.fov) * Math.min(1, dt * 12);
    eng.camera.updateProjectionMatrix();
  }

  const input = { moveX: 0, moveZ: 0, jump: false, sprint: false };
  if (active) {
    if (keys.has('KeyW')) input.moveZ += 1;
    if (keys.has('KeyS')) input.moveZ -= 1;
    if (keys.has('KeyD')) input.moveX += 1;
    if (keys.has('KeyA')) input.moveX -= 1;
    if (keys.has('Space')) input.jump = true;
    input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    if (state.mouseLeft) {
      const slot = state.inventory[state.slot];
      if (slot?.kind === 'weapon') {
        const w = WEAPONS[slot.weapon];
        if (w.kind === 'gun' && w.auto) tryFire(now);
      }
    }
  }
  if (!state.dead) local.update(dt, input, eng.world);

  if (local.onGround && Math.hypot(local.vel.x, local.vel.z) > 0.4) {
    state.bobTime += dt * Math.hypot(local.vel.x, local.vel.z) * 1.1;
  }
  const speed = Math.hypot(local.vel.x, local.vel.z);
  const bob = local.onGround && speed > 0.4
    ? Math.sin(state.bobTime * 2) * 0.018 * Math.min(1, speed / 6)
    : 0;
  const cam = eng.camera;
  cam.position.set(
    local.pos.x - eng.offset.x,
    local.pos.y + 1.62 + bob,
    local.pos.z - eng.offset.z
  );
  if (state.shake > 0) {
    state.shake = Math.max(0, state.shake - dt);
    cam.position.x += (Math.random() - 0.5) * state.shake * 0.12;
    cam.position.y += (Math.random() - 0.5) * state.shake * 0.08;
  }
  cam.rotation.set(local.pitch, local.yaw, 0, 'YXZ');

  updateReloads(now);
  updateViewmodel(dt, now);
  updateHighlight(active);

  for (const view of state.views.values()) view.update(dt);

  eng.update(dt);
  eng.render();

  if (now - state.lastState > 80) {
    state.lastState = now;
    send({
      type: 'state',
      pos: { x: local.pos.x, y: local.pos.y, z: local.pos.z },
      yaw: local.yaw,
      pitch: local.pitch,
      slot: state.slot
    });
  }
  if (now - state.lastPing > 3000) {
    state.lastPing = now;
    send({ type: 'ping', t: performance.now() });
  }

  updateDeathCountdown(now);

  const reloadingSlot = state.inventory[state.slot];
  if (reloadingSlot?.kind === 'weapon' && WEAPONS[reloadingSlot.weapon].kind === 'gun' && reloadingSlot.reloading) {
    const text = `ŞARJÖR ${Math.max(0, (reloadingSlot.reloadEnd - now) / 1000).toFixed(1)}s`;
    if (dom.reloadText.textContent !== text) dom.reloadText.textContent = text;
  } else if (dom.reloadText.textContent) {
    dom.reloadText.textContent = '';
  }
}

/* ---------------- BOOT ---------------- */

function init() {
  const params = new URLSearchParams(window.location.search);
  const savedName = localStorage.getItem('blokarena.name') || '';
  state.name = (params.get('name') || savedName).slice(0, 16);
  if (MODES[params.get('mode')]) state.mode = params.get('mode');
  if (KITS[params.get('kit')]) state.kit = params.get('kit');
  state.auto = params.get('auto') === '1';

  dom.nameInput.value = state.name;
  buildModeCards();
  renderKits();
  selectMode(state.mode);
  initSensitivity();

  dom.nameInput.addEventListener('input', () => {
    if (dom.nameInput.value.length > 16) dom.nameInput.value = dom.nameInput.value.slice(0, 16);
  });
  dom.nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startFromMenu();
  });
  dom.playBtn.addEventListener('click', startFromMenu);
  dom.resumeBtn.addEventListener('click', () => {
    sfx.unlock();
    requestLock();
  });
  dom.leaveBtn.addEventListener('click', goMenu);
  dom.reconnectBtn.addEventListener('click', () => window.location.reload());
  dom.backMenuBtn.addEventListener('click', goMenu);
  dom.fatalBackBtn.addEventListener('click', () => {
    window.location.href = window.location.pathname;
  });
  dom.chatInput.addEventListener('keydown', onChatKey);

  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('pointerlockerror', () => toast('Fare kilidi reddedildi. Tekrar tıkla.', 2200));
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    keys.clear();
    hideScoreboard();
    state.mouseLeft = false;
  });
  dom.canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousemove', onMouseMove);
  dom.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('beforeunload', () => {
    try {
      state.ws?.close();
    } catch {
      // yoksay
    }
  });

  requestAnimationFrame(loop);

  window.__blokarena = {
    state,
    MODES,
    KITS,
    WEAPONS,
    toast,
    startConnect,
    primaryAction,
    tryFire,
    requestLock
  };

  if (state.auto) {
    setTimeout(() => {
      if (!state.started) {
        if (!dom.nameInput.value) dom.nameInput.value = 'TEST';
        startFromMenu();
      }
    }, 400);
  }
}

init();
