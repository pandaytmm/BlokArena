'use strict';

const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MC_DIR = path.join(ROOT, 'mc');
const SERVER_DIR = path.join(MC_DIR, 'server');
const CLIENT_DIR = path.join(MC_DIR, 'client');
const RUNTIME_DIR = path.join(MC_DIR, 'runtime', 'jre21');
const SERVER_JAR = path.join(SERVER_DIR, 'paper-1.21.1-133.jar');
const SERVER_LOG = path.join(SERVER_DIR, 'console.log');
const JAVA = path.join(RUNTIME_DIR, 'bin', 'java.exe');
const JAVAW = path.join(RUNTIME_DIR, 'bin', 'javaw.exe');
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SECRET_FILE = path.join(DATA_DIR, 'secret.txt');
const PUBLIC_DIR = path.join(__dirname, 'public');

const APP_PORT = Number(process.env.LAUNCHER_PORT) || 3010;
const YGG_PORT = Number(process.env.YGGDRASIL_PORT) || 3011;
const AUTHLIB_INJECTOR = path.join(__dirname, 'libs', 'authlib-injector.jar');
const MC_PORT = 25565;
const MC_VERSION = '1.21.1';
const MC_HOME = path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');
const VERSION_DIR = path.join(MC_HOME, 'versions', MC_VERSION);
const VERSION_JSON = path.join(VERSION_DIR, MC_VERSION + '.json');
const VERSION_JAR = path.join(VERSION_DIR, MC_VERSION + '.jar');
const LIB_DIR = path.join(MC_HOME, 'libraries');
const ASSETS_DIR = path.join(MC_HOME, 'assets');
const NATIVES_DIR = path.join(CLIENT_DIR, 'natives');
const MODS_DIR = path.join(CLIENT_DIR, 'mods');
const SHADERS_DIR = path.join(CLIENT_DIR, 'shaderpacks');
const FABRIC_LOADER_VERSION = '0.20.1';
const FABRIC_ID = 'fabric-loader-' + FABRIC_LOADER_VERSION + '-' + MC_VERSION;
const FABRIC_JSON = path.join(MC_HOME, 'versions', FABRIC_ID, FABRIC_ID + '.json');
const CLIENT_SETTINGS_FILE = path.join(DATA_DIR, 'client-settings.json');

/* ---------------- helpers ---------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function stripAnsi(text) {
  return String(text).replace(/\x1b\[[0-9;]*m/g, '');
}

function flattenMotd(desc) {
  if (desc == null) return '';
  if (typeof desc === 'string') return stripAnsi(desc);
  let out = typeof desc.text === 'string' ? desc.text : '';
  if (Array.isArray(desc.extra)) {
    for (const part of desc.extra) out += flattenMotd(part);
  }
  return stripAnsi(out).trim();
}

/* ---------------- auth ---------------- */

ensureDir(DATA_DIR);

function loadUsers() {
  const data = readJson(USERS_FILE, { users: [] });
  return Array.isArray(data.users) ? data.users : [];
}

function saveUsers(users) {
  writeJson(USERS_FILE, { users });
}

function loadSecret() {
  ensureDir(DATA_DIR);
  try {
    const s = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (s.length >= 32) return s;
  } catch {
    // generate below
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, secret);
  return secret;
}

const TOKEN_SECRET = loadSecret();
const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;

function signToken(username) {
  const payload = base64url(JSON.stringify({ u: username, exp: Date.now() + TOKEN_TTL }));
  const sig = base64url(crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest());
  return payload + '.' + sig;
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest();
  let given;
  try {
    given = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  } catch {
    return null;
  }
  if (given.length !== expect.length || !crypto.timingSafeEqual(given, expect)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data.u !== 'string' || !(data.exp > Date.now())) return null;
  return data.u;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

const loginFails = new Map();

function rateLimited(key) {
  const now = Date.now();
  const entry = loginFails.get(key);
  if (!entry) return false;
  if (now - entry.first > 10 * 60 * 1000) {
    loginFails.delete(key);
    return false;
  }
  return entry.count >= 8;
}

function noteLoginFail(key) {
  const now = Date.now();
  const entry = loginFails.get(key);
  if (!entry || now - entry.first > 10 * 60 * 1000) {
    loginFails.set(key, { first: now, count: 1 });
  } else {
    entry.count += 1;
  }
}

function userExists(username) {
  return loadUsers().some((u) => u.username.toLowerCase() === username.toLowerCase());
}

/* ---------------- Minecraft status ping ---------------- */

function varInt(value) {
  const bytes = [];
  let n = value >>> 0;
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    bytes.push(b);
  } while (n);
  return Buffer.from(bytes);
}

function mcString(str) {
  const body = Buffer.from(str, 'utf8');
  return Buffer.concat([varInt(body.length), body]);
}

function decodeVarInt(buf, offset) {
  let value = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos++];
    value |= (byte & 0x7f) << shift;
    shift += 7;
    if (!(byte & 0x80)) return { value: value >>> 0, size: pos - offset };
    if (shift > 35) return null;
  }
  return null;
}

let pingCache = { at: 0, value: null };

function pingServer(timeout = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: MC_PORT });
    let settled = false;
    let buffer = Buffer.alloc(0);
    const started = Date.now();

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(value);
    };

    const timer = setTimeout(() => finish({ online: false }), timeout);
    socket.on('error', () => finish({ online: false }));

    socket.on('connect', () => {
      const handshake = Buffer.concat([
        varInt(0x00),
        varInt(754),
        mcString('127.0.0.1'),
        Buffer.from([(MC_PORT >> 8) & 0xff, MC_PORT & 0xff]),
        varInt(1),
      ]);
      const handshakePacket = Buffer.concat([varInt(handshake.length), handshake]);
      const request = Buffer.from([0x01, 0x00]);
      socket.write(Buffer.concat([handshakePacket, request]));
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length > 0) {
        const len = decodeVarInt(buffer, 0);
        if (!len) return;
        if (buffer.length < len.size + len.value) return;
        const packet = buffer.subarray(len.size, len.size + len.value);
        buffer = buffer.subarray(len.size + len.value);
        const id = decodeVarInt(packet, 0);
        if (!id || id.value !== 0x00) continue;
        const strLen = decodeVarInt(packet, id.size);
        if (!strLen) continue;
        const jsonBuf = packet.subarray(id.size + strLen.size, id.size + strLen.size + strLen.value);
        try {
          const info = JSON.parse(jsonBuf.toString('utf8'));
          finish({
            online: true,
            version: info.version ? info.version.name : null,
            protocol: info.version ? info.version.protocol : null,
            players: info.players ? info.players.online : null,
            max: info.players ? info.players.max : null,
            sample: info.players && Array.isArray(info.players.sample) ? info.players.sample.map((p) => p.name) : [],
            motd: flattenMotd(info.description),
            ping: Date.now() - started,
          });
          return;
        } catch {
          return;
        }
      }
    });
  });
}

async function serverStatus(force = false) {
  if (!force && pingCache.value && Date.now() - pingCache.at < 1000) return pingCache.value;
  const value = await pingServer();
  pingCache = { at: Date.now(), value };
  return value;
}

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const info of list || []) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  return null;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(700);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/* ---------------- MC server process ---------------- */

const serverState = {
  child: null,
  starting: false,
  stopping: false,
  autoRestart: true,
  restarts: 0,
  lastStart: 0,
  lastExit: null,
};

function logToFile(line) {
  try {
    ensureDir(SERVER_DIR);
    fs.appendFileSync(SERVER_LOG, stripAnsi(line) + '\n');
  } catch {
    // ignore log write failures
  }
}

async function startServer() {
  if (serverState.child || serverState.starting) return false;
  if (await isPortOpen(MC_PORT)) return false;
  if (!fs.existsSync(SERVER_JAR)) throw new Error('Sunucu dosyası bulunamadı (Paper jar).');
  if (!fs.existsSync(JAVA)) throw new Error('Java 21 çalışma zamanı bulunamadı.');

  serverState.starting = true;
  ensureDir(SERVER_DIR);

  const out = fs.createWriteStream(SERVER_LOG, { flags: 'a' });
  out.write('\n===== BlokArena MC baslatiliyor (' + new Date().toLocaleString('tr-TR') + ') =====\n');

  const child = spawn(JAVA, ['-Xms1G', '-Xmx3G', '-jar', path.basename(SERVER_JAR), 'nogui'], {
    cwd: SERVER_DIR,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  serverState.child = child;
  serverState.starting = false;
  serverState.lastStart = Date.now();

  child.stdout.pipe(out, { end: false });
  child.stderr.pipe(out, { end: false });

  child.on('exit', (code) => {
    serverState.child = null;
    serverState.lastExit = { code, at: Date.now() };
    out.end();
    pingCache = { at: 0, value: null };
    if (!serverState.stopping && serverState.autoRestart) {
      serverState.restarts += 1;
      setTimeout(() => {
        startServer().catch((err) => logToFile('[launcher] yeniden baslatma hatasi: ' + err.message));
      }, 5000);
    }
  });

  return true;
}

async function waitForServer(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(MC_PORT)) {
      const st = await pingServer(1200);
      if (st.online) return st;
    }
    await sleep(1000);
  }
  throw new Error('Sunucu zaman aşımına uğradı. Konsol kayıtlarını kontrol et.');
}

function tailLog(lines = 32) {
  try {
    const stat = fs.statSync(SERVER_LOG);
    const start = Math.max(0, stat.size - 24000);
    const length = stat.size - start;
    const fd = fs.openSync(SERVER_LOG, 'r');
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, start);
    fs.closeSync(fd);
    return stripAnsi(buf.toString('utf8')).split(/\r?\n/).filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

/* ---------------- client preparation & launch ---------------- */

function libraryAllowed(lib) {
  if (!Array.isArray(lib.rules)) return true;
  let allowed = false;
  for (const rule of lib.rules) {
    if (!ruleApplies(rule)) continue;
    allowed = rule.action === 'allow';
  }
  return allowed;
}

function ruleApplies(rule) {
  if (rule.os) {
    if (rule.os.name && rule.os.name !== 'windows') return false;
    if (rule.os.arch) {
      if (rule.os.arch === 'x86' && process.arch !== 'ia32') return false;
      if (rule.os.arch === 'x86_64' && process.arch !== 'x64') return false;
    }
    if (rule.os.version) {
      try {
        if (!new RegExp(rule.os.version).test(os.release())) return false;
      } catch {
        return false;
      }
    }
  }
  if (rule.features) {
    for (const [key, value] of Object.entries(rule.features)) {
      const actual = key === 'is_demo_user' ? false : key === 'has_custom_resolution' ? true : false;
      if (Boolean(actual) !== Boolean(value)) return false;
    }
  }
  return true;
}

function sha1File(file) {
  const hash = crypto.createHash('sha1');
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1024 * 1024);
  try {
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function downloadHttps(url, tmp, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error('Çok fazla yönlendirme: ' + url));
    const req = https.get(
      url,
      { family: 4, timeout: 60000, headers: { 'User-Agent': 'BlokArenaMC' } },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          const next = new URL(res.headers.location, url).href;
          downloadHttps(next, tmp, redirects + 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          return reject(new Error('İndirme başarısız (' + status + '): ' + url));
        }
        const out = fs.createWriteStream(tmp);
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve()));
        out.on('error', reject);
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error('İndirme zaman aşımına uğradı: ' + url)));
    req.on('error', reject);
  });
}

async function downloadFile(url, dest, expectedSha1) {
  ensureDir(path.dirname(dest));
  const tmp = dest + '.part';
  await downloadHttps(url, tmp);
  if (expectedSha1) {
    const actual = sha1File(tmp);
    if (actual.toLowerCase() !== expectedSha1.toLowerCase()) {
      await fsp.unlink(tmp).catch(() => {});
      throw new Error('Dosya doğrulaması başarısız: ' + path.basename(dest));
    }
  }
  if (fs.existsSync(dest)) await fsp.unlink(dest).catch(() => {});
  await fsp.rename(tmp, dest);
}

function extractZip(zip, dest) {
  ensureDir(dest);
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  if (fs.existsSync(tar)) {
    try {
      execFileSync(tar, ['-xf', zip, '-C', dest], { windowsHide: true, stdio: 'ignore' });
      return;
    } catch {
      // fall through to PowerShell
    }
  }
  const ps = [
    'Add-Type -AssemblyName System.IO.Compression.FileSystem;',
    "[IO.Compression.ZipFile]::ExtractToDirectory('" + zip.replace(/'/g, "''") + "','" + dest.replace(/'/g, "''") + "',$true)",
  ].join(' ');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, stdio: 'ignore' });
}

const clientPrep = {
  promise: null,
  progress: 0,
  total: 0,
  current: '',
  ready: false,
  error: null,
};

/* ---------------- mods & shaders ---------------- */

const SHADER_STACK = [
  {
    name: 'fabric-api-0.116.17+1.21.1.jar',
    label: 'Fabric API 0.116.17',
    url: 'https://cdn.modrinth.com/data/P7dR8mSH/versions/Mys3P7lK/fabric-api-0.116.17%2B1.21.1.jar',
    sha1: '810b2b0195371a012906241d8b85a32a1d6de53c',
  },
  {
    name: 'sodium-fabric-0.6.13+mc1.21.1.jar',
    label: 'Sodium 0.6.13',
    url: 'https://cdn.modrinth.com/data/AANobbMI/versions/u1OEbNKx/sodium-fabric-0.6.13%2Bmc1.21.1.jar',
    sha1: '928a2598178c3a58b0638bab842f467d2e49251a',
  },
  {
    name: 'iris-fabric-1.8.8+mc1.21.1.jar',
    label: 'Iris 1.8.8',
    url: 'https://cdn.modrinth.com/data/YL57xq9U/versions/zsoi0dso/iris-fabric-1.8.8%2Bmc1.21.1.jar',
    sha1: '4e0df4011503b4b36ba69877ea7247c1a47fea00',
  },
  {
    name: 'modmenu-11.0.5.jar',
    label: 'Mod Menu 11.0.5',
    url: 'https://cdn.modrinth.com/data/mOgUt4GM/versions/6lgOkclV/modmenu-11.0.5.jar',
    sha1: '2321d890a25b5985eba576d7cd8fe9a9c136e33d',
  },
];

function loadClientSettings() {
  const settings = readJson(CLIENT_SETTINGS_FILE, {});
  return { fabric: Boolean(settings && settings.fabric) };
}

function saveClientSettings(settings) {
  writeJson(CLIENT_SETTINGS_FILE, settings);
}

function mavenPath(name) {
  const parts = String(name || '').split(':');
  if (parts.length < 3) return '';
  const [group, artifact, version, classifier] = parts;
  const file = artifact + '-' + version + (classifier ? '-' + classifier : '') + '.jar';
  return group.replace(/\./g, '/') + '/' + artifact + '/' + version + '/' + file;
}

function fabricProfile() {
  const profile = readJson(FABRIC_JSON, null);
  return profile && profile.mainClass && Array.isArray(profile.libraries) ? profile : null;
}

function fabricInstalled() {
  const profile = fabricProfile();
  if (!profile) return false;
  for (const lib of profile.libraries) {
    const rel = mavenPath(lib.name);
    if (rel && !fs.existsSync(path.join(LIB_DIR, rel))) return false;
  }
  for (const mod of SHADER_STACK) {
    if (!fs.existsSync(path.join(MODS_DIR, mod.name))) return false;
  }
  return true;
}

let fabricJob = null;

function installFabric() {
  if (fabricJob) return fabricJob;
  fabricJob = (async () => {
    const res = await fetch(
      'https://meta.fabricmc.net/v2/versions/loader/' + MC_VERSION + '/' + FABRIC_LOADER_VERSION + '/profile/json'
    );
    if (!res.ok) throw new Error('Fabric profili alınamadı (' + res.status + ').');
    const profile = await res.json();
    ensureDir(path.dirname(FABRIC_JSON));
    writeJson(FABRIC_JSON, profile);

    for (const lib of profile.libraries || []) {
      const rel = mavenPath(lib.name);
      if (!rel) continue;
      const file = path.join(LIB_DIR, rel);
      if (fs.existsSync(file)) continue;
      const base = String(lib.url || 'https://maven.fabricmc.net/').replace(/\/?$/, '/');
      await downloadFile(base + rel, file, lib.sha1);
    }

    ensureDir(MODS_DIR);
    for (const mod of SHADER_STACK) {
      const file = path.join(MODS_DIR, mod.name);
      if (fs.existsSync(file)) continue;
      await downloadFile(mod.url, file, mod.sha1);
    }

    const settings = loadClientSettings();
    settings.fabric = true;
    saveClientSettings(settings);
    return true;
  })().finally(() => {
    fabricJob = null;
  });
  return fabricJob;
}

function listClientFiles(dir, ext) {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name.toLowerCase().endsWith(ext) && fs.existsSync(path.join(dir, name)))
      .map((name) => {
        let size = 0;
        try {
          size = fs.statSync(path.join(dir, name)).size;
        } catch {
          size = 0;
        }
        return { name, size };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function detectFileType(name, requested) {
  if (requested === 'mod' || requested === 'shader') return requested;
  if (/\.jar$/i.test(name)) return 'mod';
  if (/\.zip$/i.test(name)) return 'shader';
  throw new Error('Dosya türü anlaşılamadı; .jar (mod) veya .zip (shader) olmalı.');
}

function safeBaseName(name, type) {
  const base = path.basename(String(name || '')).replace(/[^\w.\-+() ]+/g, '_').slice(0, 120);
  if (!base || base.startsWith('.')) throw new Error('Geçersiz dosya adı.');
  if (type === 'mod' && !/\.jar$/i.test(base)) throw new Error('Mod dosyası .jar olmalı.');
  if (type === 'shader' && !/\.zip$/i.test(base)) throw new Error('Shader paketi .zip olmalı.');
  return base;
}

function assetScore(name, type) {
  let score = 0;
  if (/1\.16\.5/.test(name)) score += 4;
  if (/fabric/i.test(name)) score += 2;
  if (type === 'mod' && /\.jar$/i.test(name)) score += 2;
  if (type === 'shader' && /\.zip$/i.test(name)) score += 2;
  if (/(sources|javadoc|-dev|installer|slim|api)/i.test(name)) score -= 6;
  return score;
}

function isPrivateHost(host) {
  if (!host || host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}

function fetchGithubJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        family: 4,
        timeout: 20000,
        headers: { 'User-Agent': 'BlokArenaMC', Accept: 'application/vnd.github+json' },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          if (res.statusCode === 403) return reject(new Error('GitHub istek sınırı aşıldı; biraz sonra tekrar dene.'));
          if (res.statusCode !== 200) return reject(new Error('GitHub yanıtı: ' + res.statusCode));
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            reject(new Error('GitHub yanıtı okunamadı.'));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('GitHub isteği zaman aşımına uğradı.')));
    req.on('error', reject);
  });
}

async function resolveSource(rawUrl, requested) {
  let url;
  try {
    url = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('Geçerli bir bağlantı gir.');
  }
  if (url.protocol !== 'https:') throw new Error('Güvenlik için https bağlantısı kullan.');
  if (isPrivateHost(url.hostname.toLowerCase())) throw new Error('Yerel ağ adreslerinden indirme yapılamaz.');

  const host = url.hostname.toLowerCase();
  if (host === 'github.com' || host === 'www.github.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const owner = parts[0];
    const repo = (parts[1] || '').replace(/\.git$/i, '');
    if (!owner || !repo) throw new Error('GitHub bağlantısı eksik görünüyor.');
    if (parts[2] === 'releases' && parts[3] === 'download') {
      return { url: url.href, filename: decodeURIComponent(parts[parts.length - 1]) };
    }
    let api = 'https://api.github.com/repos/' + owner + '/' + repo + '/releases/latest';
    if (parts[2] === 'releases' && parts[3] === 'tag' && parts[4]) {
      api = 'https://api.github.com/repos/' + owner + '/' + repo + '/releases/tags/' + encodeURIComponent(parts[4]);
    }
    let release;
    try {
      release = await fetchGithubJson(api);
    } catch (err) {
      if (/404/.test(err.message)) throw new Error('GitHub deposu veya sürümü bulunamadı.');
      throw new Error('GitHub sürüm bilgisi alınamadı: ' + err.message);
    }
    const assets = (release.assets || []).filter((asset) => /\.(jar|zip)$/i.test(asset.name));
    const preferred = assets.filter((asset) =>
      requested === 'mod' ? /\.jar$/i.test(asset.name) : requested === 'shader' ? /\.zip$/i.test(asset.name) : true
    );
    const pool = preferred.length ? preferred : assets;
    if (!pool.length) throw new Error('Son sürümde indirilebilir .jar/.zip dosyası yok.');
    let best = pool[0];
    for (const asset of pool) {
      if (assetScore(asset.name, requested) >= assetScore(best.name, requested)) best = asset;
    }
    return { url: best.browser_download_url, filename: best.name };
  }

  const filename = decodeURIComponent(url.pathname.split('/').pop() || '');
  if (!/\.(jar|zip)$/i.test(filename)) throw new Error('Bağlantı .jar veya .zip dosyasına işaret etmeli.');
  return { url: url.href, filename };
}

async function installClientFile(rawUrl, requested) {
  const source = await resolveSource(rawUrl, requested);
  const type = detectFileType(source.filename, requested);
  const dir = type === 'mod' ? MODS_DIR : SHADERS_DIR;
  ensureDir(dir);
  const name = safeBaseName(source.filename, type);
  const dest = path.join(dir, name);
  await downloadFile(source.url, dest);
  return { type, name, size: fs.statSync(dest).size };
}

function deleteClientFile(type, name) {
  if (type !== 'mod' && type !== 'shader') throw new Error('Geçersiz tür.');
  const raw = String(name || '');
  const base = path.basename(raw);
  if (!base || base !== raw) throw new Error('Geçersiz dosya adı.');
  const file = path.join(type === 'mod' ? MODS_DIR : SHADERS_DIR, base);
  if (!fs.existsSync(file)) throw new Error('Dosya bulunamadı.');
  fs.unlinkSync(file);
}

function modsSnapshot() {
  const settings = loadClientSettings();
  const installed = fabricInstalled();
  return {
    fabric: {
      installed,
      enabled: installed && settings.fabric,
      loader: FABRIC_LOADER_VERSION,
      stack: installed ? ['Fabric Loader ' + FABRIC_LOADER_VERSION, ...SHADER_STACK.map((mod) => mod.label)] : [],
      installing: Boolean(fabricJob),
    },
    mods: listClientFiles(MODS_DIR, '.jar'),
    shaders: listClientFiles(SHADERS_DIR, '.zip'),
  };
}

function buildClientManifest(version) {
  const items = [];
  const client = version.downloads && version.downloads.client;
  if (client) {
    items.push({ file: VERSION_JAR, url: client.url, sha1: client.sha1, label: 'Minecraft istemcisi' });
  }
  for (const lib of version.libraries || []) {
    if (!libraryAllowed(lib)) continue;
    const artifact = lib.downloads && lib.downloads.artifact;
    if (artifact && artifact.path) {
      items.push({
        file: path.join(LIB_DIR, artifact.path),
        url: artifact.url,
        sha1: artifact.sha1,
        label: path.basename(artifact.path),
      });
    }
    const nativesKey = lib.natives && lib.natives.windows;
    if (nativesKey && lib.downloads && lib.downloads.classifiers && lib.downloads.classifiers[nativesKey]) {
      const cls = lib.downloads.classifiers[nativesKey];
      items.push({
        file: path.join(LIB_DIR, cls.path),
        url: cls.url,
        sha1: cls.sha1,
        label: path.basename(cls.path),
        native: true,
      });
    }
  }
  if (version.logging && version.logging.client && version.logging.client.file) {
    const logFile = version.logging.client.file;
    items.push({
      file: path.join(ASSETS_DIR, 'log_configs', logFile.id),
      url: logFile.url,
      sha1: logFile.sha1,
      label: 'log4j yapılandırması',
    });
  }
  if (version.assetIndex && version.assetIndex.id) {
    items.push({
      file: path.join(ASSETS_DIR, 'indexes', version.assetIndex.id + '.json'),
      url: version.assetIndex.url,
      sha1: version.assetIndex.sha1,
      label: 'asset indeksi',
    });
  }
  return items;
}

async function prepareClient() {
  if (clientPrep.ready) return;
  if (clientPrep.promise) return clientPrep.promise;

  clientPrep.promise = (async () => {
    clientPrep.error = null;
    clientPrep.progress = 0;
    ensureDir(CLIENT_DIR);
    ensureDir(NATIVES_DIR);
    ensureDir(MODS_DIR);
    ensureDir(SHADERS_DIR);

    const version = readJson(VERSION_JSON, null);
    if (!version) throw new Error('Minecraft ' + MC_VERSION + ' sürüm dosyası bulunamadı.');

    const items = buildClientManifest(version);
    clientPrep.total = items.length;
    clientPrep.current = 'Dosyalar kontrol ediliyor';

    const failed = [];
    for (const item of items) {
      clientPrep.current = item.label;
      try {
        if (!fs.existsSync(item.file)) {
          await downloadFile(item.url, item.file, item.sha1);
        }
        item.done = true;
      } catch (err) {
        item.done = false;
        item.error = err.message;
        failed.push(item.label);
      }
      clientPrep.progress += 1;
    }
    clientPrep.current = 'Asset kontrolü';
    if (version.assetIndex && version.assetIndex.id) {
      const indexFile = path.join(ASSETS_DIR, 'indexes', version.assetIndex.id + '.json');
      const index = readJson(indexFile, null);
      if (index && index.objects) {
        const missing = [];
        for (const name of Object.keys(index.objects)) {
          const entry = index.objects[name];
          const file = path.join(ASSETS_DIR, 'objects', entry.hash.slice(0, 2), entry.hash);
          if (!fs.existsSync(file)) missing.push({ file, hash: entry.hash, size: entry.size });
        }
        for (let i = 0; i < missing.length; i += 1) {
          const entry = missing[i];
          clientPrep.current = 'Asset ' + (i + 1) + '/' + missing.length;
          await downloadFile(
            'https://resources.download.minecraft.net/' + entry.hash.slice(0, 2) + '/' + entry.hash,
            entry.file
          );
        }
      }
    }

    clientPrep.current = 'Natives hazırlanıyor';
    const tlNatives = path.join(VERSION_DIR, 'natives');
    if (fs.existsSync(tlNatives)) {
      try {
        fs.cpSync(tlNatives, NATIVES_DIR, { recursive: true });
      } catch {
        // extraction below covers the required dlls
      }
    }
    for (const item of items) {
      if (item.native && fs.existsSync(item.file)) extractZip(item.file, NATIVES_DIR);
    }

    if (failed.length > 0) {
      throw new Error('Bazı istemci dosyaları indirilemedi: ' + failed.slice(0, 4).join(', '));
    }

    clientPrep.current = '';
    clientPrep.progress = clientPrep.total;
    clientPrep.ready = true;
  })()
    .catch((err) => {
      clientPrep.error = err.message;
      clientPrep.ready = false;
      throw err;
    })
    .finally(() => {
      clientPrep.promise = null;
    });

  return clientPrep.promise;
}

function offlineUuid(name) {
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + name, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

function substitute(value, map) {
  return String(value).replace(/\$\{([a-z_]+)\}/gi, (all, key) => (key in map ? map[key] : all));
}

function collectJvmArgs(version, map, classpath) {
  const args = [];
  for (const entry of version.arguments && version.arguments.jvm ? version.arguments.jvm : []) {
    if (typeof entry === 'string') {
      args.push(entry);
    } else if (entry && entry.rules) {
      if (entry.rules.every(ruleApplies)) {
        if (Array.isArray(entry.value)) args.push(...entry.value);
        else if (entry.value) args.push(entry.value);
      }
    }
  }
  return args.map((a) => substitute(a, { ...map, classpath }));
}

function collectGameArgs(version, map) {
  const args = [];
  for (const entry of version.arguments && version.arguments.game ? version.arguments.game : []) {
    if (typeof entry === 'string') {
      args.push(entry);
    } else if (entry && entry.rules) {
      if (entry.rules.every(ruleApplies)) {
        if (Array.isArray(entry.value)) args.push(...entry.value);
        else if (entry.value) args.push(entry.value);
      }
    }
  }
  return args.map((a) => substitute(a, map));
}

function clientVersion() {
  const base = readJson(VERSION_JSON, null);
  if (!base) throw new Error('Sürüm dosyası okunamadı.');
  const settings = loadClientSettings();
  if (!settings.fabric) return base;
  const profile = fabricProfile();
  if (!profile || !fabricInstalled()) return base;
  const baseArgs = base.arguments || {};
  const fabricArgs = profile.arguments || {};
  return {
    ...base,
    mainClass: profile.mainClass || base.mainClass,
    arguments: {
      jvm: [...(baseArgs.jvm || []), ...(fabricArgs.jvm || [])],
      game: [...(baseArgs.game || []), ...(fabricArgs.game || [])],
    },
    libraries: [...(base.libraries || []), ...profile.libraries],
  };
}

function buildLaunch(username) {
  const version = clientVersion();
  if (!fs.existsSync(VERSION_JAR)) throw new Error('Minecraft istemci jar bulunamadı.');
  const expected = version.assetIndex ? version.assetIndex.id : '1.21';

  const classpathParts = [];
  for (const lib of version.libraries || []) {
    if (!libraryAllowed(lib)) continue;
    const artifact = lib.downloads && lib.downloads.artifact;
    if (artifact && artifact.path) {
      const file = path.join(LIB_DIR, artifact.path);
      if (fs.existsSync(file)) classpathParts.push(file);
      continue;
    }
    const rel = mavenPath(lib.name);
    if (!rel) continue;
    const file = path.join(LIB_DIR, rel);
    if (fs.existsSync(file)) classpathParts.push(file);
  }
  classpathParts.push(VERSION_JAR);

  const map = {
    auth_player_name: username,
    version_name: MC_VERSION,
    game_directory: CLIENT_DIR,
    assets_root: ASSETS_DIR,
    assets_index_name: expected,
    auth_uuid: offlineUuid(username),
    auth_access_token: '0',
    user_type: 'legacy',
    version_type: 'release',
    natives_directory: NATIVES_DIR,
    launcher_name: 'BlokArenaMC',
    launcher_version: '1.0.0',
    resolution_width: '1280',
    resolution_height: '720',
    classpath: classpathParts.join(path.delimiter),
  };

  const jvmArgs = [
    '-Xms512M',
    '-Xmx2G',
    '-XX:+UseG1GC',
    ...collectJvmArgs(version, map, map.classpath),
  ];
  if (fs.existsSync(AUTHLIB_INJECTOR)) {
    jvmArgs.push('-javaagent:' + AUTHLIB_INJECTOR + '=http://127.0.0.1:' + YGG_PORT);
  }

  const gameArgs = collectGameArgs(version, map);
  gameArgs.push('--server', '127.0.0.1', '--port', String(MC_PORT));
  gameArgs.push('--quickPlayMultiplayer', '127.0.0.1:' + MC_PORT);
  gameArgs.push('--width', '1280', '--height', '720');

  return { mainClass: version.mainClass, jvmArgs, gameArgs };
}

let lastLaunch = { at: 0, pid: null, username: null };

function launchClient(username) {
  if (Date.now() - lastLaunch.at < 8000) {
    return { skipped: true, reason: 'Minecraft zaten yeni açıldı.' };
  }
  if (!fs.existsSync(JAVAW)) throw new Error('javaw.exe bulunamadı.');
  const launch = buildLaunch(username);
  const child = spawn(JAVAW, [...launch.jvmArgs, launch.mainClass, ...launch.gameArgs], {
    cwd: CLIENT_DIR,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();
  lastLaunch = { at: Date.now(), pid: child.pid, username };
  yggProfiles.set(username, { id: offlineUuid(username).replace(/-/g, '') });
  return { skipped: false, pid: child.pid };
}

/* ---------------- play pipeline ---------------- */

const playState = {
  state: 'idle',
  message: '',
  progress: 0,
  error: null,
  startedAt: 0,
  launchedAt: 0,
  username: null,
};

let playJob = null;

function snapshotPlay() {
  return {
    state: playState.state,
    message: playState.message,
    progress: playState.progress,
    error: playState.error,
    launchedAt: playState.launchedAt,
    username: playState.username,
    prep: {
      ready: clientPrep.ready,
      progress: clientPrep.total ? Math.round((clientPrep.progress / clientPrep.total) * 100) : 0,
      current: clientPrep.current,
      error: clientPrep.error,
      total: clientPrep.total,
    },
    lastLaunch,
  };
}

function runPlay(username) {
  if (playJob) return playJob;
  playState.state = 'preparing';
  playState.message = 'İstemci dosyaları kontrol ediliyor';
  playState.progress = 0;
  playState.error = null;
  playState.startedAt = Date.now();
  playState.launchedAt = 0;
  playState.username = username;

  playJob = (async () => {
    try {
      await prepareClient();
      playState.progress = 35;
      playState.state = 'server';
      playState.message = 'Sunucu başlatılıyor';
      await startServer();
      playState.progress = 60;
      playState.message = 'Sunucu hazır olması bekleniyor';
      await waitForServer(90000);
      playState.progress = 85;
      playState.state = 'launching';
      playState.message = 'Minecraft açılıyor';
      launchClient(username);
      playState.progress = 100;
      playState.state = 'launched';
      playState.message = 'Minecraft açıldı, sunucuya bağlanılıyor';
      playState.launchedAt = Date.now();
    } catch (err) {
      playState.state = 'error';
      playState.error = err.message;
      playState.message = 'Başlatılamadı';
    } finally {
      setTimeout(() => {
        playJob = null;
      }, 5000);
    }
  })();

  return playJob;
}

/* ---------------- HTTP ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function readBody(req, limit = 20000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('İstek çok büyük.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Geçersiz istek.'));
      }
    });
    req.on('error', reject);
  });
}

function authUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const username = verifyToken(token);
  if (!username) return null;
  const user = loadUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  return user || null;
}

/* ---------------- local yggdrasil api (authlib-injector) ---------------- */

const yggProfiles = new Map();

function startYggdrasil() {
  const ygg = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname.replace(/\/+$/, '') || '/';
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (pathname === '/') {
      return json(200, {
        meta: {
          serverName: 'BlokArena',
          implementationName: 'BlokArena Launcher',
          implementationVersion: '1.0.0',
          feature: { non_email_login: true },
        },
        skinDomains: ['127.0.0.1', 'localhost'],
      });
    }
    if (pathname === '/minecraftservices/privileges') {
      return json(200, {
        privileges: {
          onlineChat: { enabled: true },
          multiplayerServer: { enabled: true },
          multiplayerRealms: { enabled: true },
        },
      });
    }
    if (pathname === '/minecraftservices/privacy/blocklist') {
      return json(200, { blockedProfiles: [] });
    }
    if (pathname === '/minecraftservices/publickeys') {
      return json(200, { profilePropertyKeys: [], playerCertificateKeys: [] });
    }
    if (pathname === '/authserver/validate') {
      res.writeHead(204);
      return res.end();
    }
    if (pathname.startsWith('/sessionserver/session/minecraft/profile/')) {
      const id = pathname.split('/').pop().replace(/-/g, '');
      for (const [name, profile] of yggProfiles) {
        if (profile.id === id) return json(200, { id, name, properties: [] });
      }
      return json(404, { error: 'ProfileNotFound', errorMessage: 'Profile not found.' });
    }
    return json(404, { error: 'NotFound', errorMessage: 'Not found.' });
  });
  ygg.on('error', (err) => {
    console.error('[yggdrasil] ' + (err.code === 'EADDRINUSE' ? YGG_PORT + ' portu kullanımda.' : err.message));
  });
  ygg.listen(YGG_PORT, '127.0.0.1', () => {
    console.log('[yggdrasil] http://127.0.0.1:' + YGG_PORT);
  });
}

/* ---------------- web app ---------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith('/api/')) {
      if (req.method === 'GET' && pathname === '/api/bootstrap') {
        return sendJson(res, 200, { hasUsers: loadUsers().length > 0, version: MC_VERSION, port: MC_PORT });
      }

      if (req.method === 'POST' && (pathname === '/api/register' || pathname === '/api/login')) {
        const body = await readBody(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
          return sendJson(res, 400, { error: 'Kullanıcı adı 3-16 karakter olmalı; harf, rakam ve alt çizgi kullan.' });
        }
        if (password.length < 6 || password.length > 100) {
          return sendJson(res, 400, { error: 'Şifre en az 6 karakter olmalı.' });
        }

        const users = loadUsers();
        if (pathname === '/api/register') {
          if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
            return sendJson(res, 409, { error: 'Bu kullanıcı adı zaten kayıtlı.' });
          }
          const salt = crypto.randomBytes(16).toString('hex');
          users.push({
            username,
            salt,
            hash: hashPassword(password, salt),
            createdAt: new Date().toISOString(),
          });
          saveUsers(users);
          return sendJson(res, 200, { token: signToken(username), user: { username } });
        }

        const key = (req.socket.remoteAddress || '') + ':' + username.toLowerCase();
        if (rateLimited(key)) {
          return sendJson(res, 429, { error: 'Çok fazla hatalı deneme. Bir süre sonra tekrar dene.' });
        }
        const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
        if (!user) {
          noteLoginFail(key);
          return sendJson(res, 401, { error: 'Kullanıcı adı veya şifre hatalı.' });
        }
        const expected = Buffer.from(user.hash, 'hex');
        const actual = Buffer.from(hashPassword(password, user.salt), 'hex');
        if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
          noteLoginFail(key);
          return sendJson(res, 401, { error: 'Kullanıcı adı veya şifre hatalı.' });
        }
        loginFails.delete(key);
        return sendJson(res, 200, { token: signToken(user.username), user: { username: user.username } });
      }

      if (req.method === 'GET' && pathname === '/api/status') {
        const mc = await serverStatus();
        return sendJson(res, 200, {
          server: {
            ...mc,
            lanIp: lanAddress(),
            owned: Boolean(serverState.child),
            restarts: serverState.restarts,
            lastStart: serverState.lastStart,
            lastExit: serverState.lastExit,
          },
          preparation: {
            ready: clientPrep.ready,
            progress: clientPrep.total ? Math.round((clientPrep.progress / clientPrep.total) * 100) : 0,
            current: clientPrep.current,
            error: clientPrep.error,
          },
          play: snapshotPlay(),
          java: fs.existsSync(JAVA),
          serverJar: fs.existsSync(SERVER_JAR),
        });
      }

      if (req.method === 'POST' && pathname === '/api/admin/command') {
        const key = String(req.headers['x-admin-key'] || '');
        let expected = '';
        try {
          expected = fs.readFileSync(path.join(DATA_DIR, 'admin.key'), 'utf8').trim();
        } catch {
          expected = '';
        }
        if (!expected || key !== expected) return sendJson(res, 403, { error: 'Yetkisiz.' });
        if (!serverState.child) return sendJson(res, 409, { error: 'Sunucu bu backend tarafından yönetilmiyor.' });
        const body = await readBody(req);
        const command = String(body.command || '').replace(/[\r\n]/g, '').trim();
        if (!command) return sendJson(res, 400, { error: 'Komut gerekli.' });
        serverState.child.stdin.write(command + '\n');
        return sendJson(res, 200, { ok: true });
      }

      const user = authUser(req);
      if (!user) return sendJson(res, 401, { error: 'Oturum geçersiz. Tekrar giriş yap.' });

      if (req.method === 'GET' && pathname === '/api/me') {
        return sendJson(res, 200, { user: { username: user.username } });
      }

      if (req.method === 'GET' && pathname === '/api/mods') {
        return sendJson(res, 200, modsSnapshot());
      }

      if (req.method === 'POST' && pathname === '/api/mods/fabric/install') {
        try {
          await installFabric();
        } catch (err) {
          return sendJson(res, 502, { error: err.message || 'Fabric kurulamadı.' });
        }
        return sendJson(res, 200, modsSnapshot());
      }

      if (req.method === 'POST' && pathname === '/api/mods/fabric') {
        const body = await readBody(req);
        const enabled = Boolean(body.enabled);
        if (enabled && !fabricInstalled()) {
          return sendJson(res, 409, { error: 'Fabric henüz kurulu değil.' });
        }
        const settings = loadClientSettings();
        settings.fabric = enabled;
        saveClientSettings(settings);
        return sendJson(res, 200, modsSnapshot());
      }

      if (req.method === 'POST' && pathname === '/api/mods/install') {
        const body = await readBody(req);
        try {
          const requested = body.type === 'mod' || body.type === 'shader' ? body.type : 'auto';
          const result = await installClientFile(body.url, requested);
          return sendJson(res, 200, { ok: true, ...result, state: modsSnapshot() });
        } catch (err) {
          return sendJson(res, 400, { error: err.message || 'Dosya eklenemedi.' });
        }
      }

      if (req.method === 'POST' && pathname === '/api/mods/delete') {
        const body = await readBody(req);
        try {
          deleteClientFile(String(body.type || ''), String(body.name || ''));
          return sendJson(res, 200, { ok: true, state: modsSnapshot() });
        } catch (err) {
          return sendJson(res, 404, { error: err.message || 'Dosya silinemedi.' });
        }
      }

      if (req.method === 'POST' && pathname === '/api/play') {
        if (playJob) {
          return sendJson(res, 202, { ok: true, play: snapshotPlay() });
        }
        runPlay(user.username);
        return sendJson(res, 202, { ok: true, play: snapshotPlay() });
      }

      if (req.method === 'GET' && pathname === '/api/play/status') {
        return sendJson(res, 200, snapshotPlay());
      }

      if (req.method === 'GET' && pathname === '/api/console') {
        return sendJson(res, 200, { lines: tailLog(32) });
      }

      if (req.method === 'POST' && pathname === '/api/server/start') {
        await startServer();
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 404, { error: 'Bilinmeyen işlem.' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end('Method Not Allowed');
    }

    let filePath = pathname === '/' ? '/index.html' : pathname;
    const resolved = path.resolve(PUBLIC_DIR, '.' + filePath);
    if (!resolved.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    let stat;
    try {
      stat = fs.statSync(resolved);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Bulunamadı');
    }
    if (!stat.isFile()) {
      res.writeHead(404);
      return res.end('Bulunamadı');
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'",
    });
    return fs.createReadStream(resolved).pipe(res);
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Sunucu hatası.' });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('[launcher] 3010 portu zaten kullanımda, mevcut örnek çalışıyor.');
    process.exit(0);
  }
  console.error('[launcher] http hatası:', err.message);
});

server.listen(APP_PORT, '127.0.0.1', () => {
  console.log('[launcher] http://127.0.0.1:' + APP_PORT);
  startYggdrasil();
  console.log('[launcher] Minecraft sunucusu otomatik başlatılıyor...');
  startServer()
    .then((started) => {
      if (!started) console.log('[launcher] Minecraft sunucusu zaten çalışıyor.');
    })
    .catch((err) => console.error('[launcher] sunucu başlatılamadı:', err.message));
});

process.on('SIGINT', () => {
  if (serverState.child) {
    serverState.stopping = true;
    try {
      serverState.child.stdin.write('stop\n');
    } catch {
      serverState.child.kill();
    }
  }
  setTimeout(() => process.exit(0), 1500);
});
