'use strict';

const state = {
  token: localStorage.getItem('blokarena.token') || '',
  user: null,
  hasUsers: false,
  statusBusy: false,
  consoleBusy: false,
  playBusy: false,
  playTimer: null,
  statusTimer: null,
  consoleTimer: null,
  lastPlayError: '',
  launchedToastAt: 0,
  mods: null,
  modUploadBusy: false,
  serverAddress: '127.0.0.1:25565',
};

const el = (id) => document.getElementById(id);

function toast(message, isError = false) {
  const node = el('toast');
  node.textContent = message;
  node.classList.toggle('error', isError);
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3800);
}

async function api(path, options = {}, isAuthCall = false) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch(path, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401 && !isAuthCall) {
    logout(true);
    throw new Error((data && data.error) || 'Oturum sona erdi.');
  }
  if (!res.ok) {
    const error = new Error((data && data.error) || 'İşlem başarısız.');
    error.status = res.status;
    throw error;
  }
  return data;
}

function setTab(tab) {
  const login = tab === 'login';
  el('tabLogin').classList.toggle('is-active', login);
  el('tabRegister').classList.toggle('is-active', !login);
  el('loginForm').classList.toggle('is-hidden', !login);
  el('registerForm').classList.toggle('is-hidden', login);
  el('authEyebrow').textContent = login ? 'HESABINA GİRİŞ YAP' : 'YENİ HESAP';
  el('authTitle').textContent = login ? 'Tekrar hoş geldin' : 'Hesap oluştur';
  el('authSub').textContent = login
    ? 'Kullanıcı adı ve şifrenle oturum aç.'
    : 'İlk girişte kayıt ol; sonraki girişlerde aynı bilgileri kullan.';
  el('loginError').textContent = '';
  el('registerError').textContent = '';
}

function setButtonBusy(button, busy, label) {
  button.disabled = busy;
  if (label) button.textContent = label;
}

async function submitAuth(mode) {
  const register = mode === 'register';
  const userInput = el(register ? 'regUser' : 'loginUser');
  const passInput = el(register ? 'regPass' : 'loginPass');
  const errorBox = el(register ? 'registerError' : 'loginError');
  const button = el(register ? 'registerBtn' : 'loginBtn');
  const username = userInput.value.trim();
  const password = passInput.value;
  errorBox.textContent = '';

  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
    errorBox.textContent = 'Kullanıcı adı 3-16 karakter olmalı; harf, rakam ve alt çizgi kullan.';
    return;
  }
  if (password.length < 6) {
    errorBox.textContent = 'Şifre en az 6 karakter olmalı.';
    return;
  }
  if (register && password !== el('regPass2').value) {
    errorBox.textContent = 'Şifreler birbiriyle uyuşmuyor.';
    return;
  }

  const label = button.textContent;
  setButtonBusy(button, true, register ? 'Kayıt yapılıyor…' : 'Giriş yapılıyor…');
  try {
    const data = await api('/api/' + mode, { method: 'POST', body: JSON.stringify({ username, password }) }, true);
    state.token = data.token;
    localStorage.setItem('blokarena.token', data.token);
    enterApp(data.user);
  } catch (err) {
    errorBox.textContent = err.message;
  } finally {
    setButtonBusy(button, false, label);
  }
}

function logout(silent = false) {
  localStorage.removeItem('blokarena.token');
  state.token = '';
  state.user = null;
  if (silent) {
    location.reload();
    return;
  }
  location.reload();
}

function enterApp(user) {
  state.user = user;
  el('authView').classList.add('is-hidden');
  el('mainView').classList.remove('is-hidden');
  el('userName').textContent = user.username;
  el('userAvatar').textContent = user.username.charAt(0).toUpperCase();

  refreshStatus();
  refreshConsole();
  refreshMods();

  clearInterval(state.statusTimer);
  clearInterval(state.consoleTimer);
  state.statusTimer = setInterval(refreshStatus, 2500);
  state.consoleTimer = setInterval(refreshConsole, 5000);

  api('/api/play/status')
    .then((play) => {
      if (play && play.state !== 'idle') renderPlay(play, false);
    })
    .catch(() => {});
}

function setBadge(online) {
  const badge = el('serverBadge');
  badge.classList.toggle('online', online);
  badge.classList.toggle('offline', !online);
  el('serverBadgeText').textContent = online ? 'SUNUCU ÇEVRİMİÇİ' : 'SUNUCU KAPALI';
}

function renderStatus(data) {
  if (!data || !data.server) return;
  const server = data.server;
  const online = Boolean(server.online);
  setBadge(online);

  const version = server.version || '1.21.1';
  el('versionChip').textContent = 'PAPER ' + version;
  el('statVersion').textContent = version;
  el('rowVersion').textContent = 'Paper ' + version;

  if (online) {
    const players = Number.isFinite(server.players) ? server.players : 0;
    const max = Number.isFinite(server.max) ? server.max : 20;
    el('statPlayers').textContent = players + ' / ' + max;
    el('statPing').textContent = (server.ping || 0) + ' ms';
    el('rowStatus').textContent = 'Çevrimiçi';
    el('rowStatus').className = 'value-on';
    el('rowPlayers').textContent = players + ' / ' + max;
    el('rowPing').textContent = (server.ping || 0) + ' ms';
    el('serverMotd').textContent = server.motd || 'BlokArena SMP & PvP';
  } else {
    el('statPlayers').textContent = '0 / 20';
    el('statPing').textContent = '-- ms';
    el('rowStatus').textContent = 'Kapalı';
    el('rowStatus').className = 'value-off';
    el('rowPlayers').textContent = '0 / 20';
    el('rowPing').textContent = '--';
    el('serverMotd').textContent = "Sunucu şu anda kapalı. OYNA'ya basınca otomatik başlar.";
  }

  const lan = server.lanIp || '-';
  el('rowLan').textContent = lan === '-' ? '-' : lan + ':25565';
  el('serverAddress').textContent = state.serverAddress;
}

function renderConsole(lines) {
  const body = el('consoleBody');
  if (!Array.isArray(lines) || lines.length === 0) {
    body.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'console-line muted';
    p.textContent = 'Henüz konsol kaydı yok. Sunucu başladığında burada görünür.';
    body.appendChild(p);
    return;
  }
  const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 48;
  const fragment = document.createDocumentFragment();
  for (const line of lines) {
    const p = document.createElement('p');
    let cls = 'console-line';
    if (/\bWARN\b/.test(line)) cls += ' warn';
    else if (/\bERROR\b|\bSEVERE\b/.test(line)) cls += ' error';
    else if (/\bINFO\b/.test(line)) cls += ' info';
    p.className = cls;
    p.textContent = line;
    fragment.appendChild(p);
  }
  body.innerHTML = '';
  body.appendChild(fragment);
  if (nearBottom) body.scrollTop = body.scrollHeight;
}

function setPlayButton(label, busy) {
  const button = el('playBtn');
  el('playLabel').textContent = label;
  button.classList.toggle('is-busy', Boolean(busy));
  button.disabled = Boolean(busy);
}

function setProgress(percent, show) {
  el('playProgressWrap').classList.toggle('is-hidden', !show);
  el('playProgress').style.width = Math.max(0, Math.min(100, percent || 0)) + '%';
}

function renderPlay(play, notify = true) {
  if (!play) return;
  const labelMap = {
    preparing: 'DOSYALAR HAZIRLANIYOR',
    server: 'SUNUCU BAŞLATILIYOR',
    launching: 'MINECRAFT AÇILIYOR',
    launched: 'OYUN AÇILDI',
    error: 'TEKRAR DENE',
    idle: 'OYNA',
  };
  const busyStates = ['preparing', 'server', 'launching'];
  const busy = busyStates.includes(play.state);
  setPlayButton(labelMap[play.state] || 'OYNA', busy);
  state.playBusy = busy;

  if (busy) {
    setProgress(play.progress || 0, true);
    let hint = play.message || 'Hazırlanıyor…';
    if (play.state === 'preparing' && play.prep && play.prep.current) {
      hint = play.prep.current + (play.prep.progress ? ' · %' + play.prep.progress : '');
    }
    el('playHint').textContent = hint;
  } else if (play.state === 'launched') {
    const recent = play.launchedAt && Date.now() - play.launchedAt < 9000;
    if (recent) {
      setPlayButton('OYUN AÇILDI', true);
      state.playBusy = true;
      setProgress(100, true);
      el('playHint').textContent = 'Minecraft açıldı; sunucuya bağlanılıyor.';
      if (notify && state.launchedToastAt !== play.launchedAt) {
        state.launchedToastAt = play.launchedAt;
        toast('Minecraft açıldı. İyi oyunlar!');
      }
    } else {
      setPlayButton('OYNA', false);
      state.playBusy = false;
      setProgress(0, false);
      el('playHint').textContent = 'Sunucu açıkken yeniden bağlanmak için OYNA’ya bas.';
    }
  } else if (play.state === 'error') {
    setProgress(0, false);
    el('playHint').textContent = play.error || 'Başlatma başarısız oldu.';
    if (notify && play.error && play.error !== state.lastPlayError) {
      state.lastPlayError = play.error;
      toast(play.error, true);
    }
    state.playBusy = false;
  } else {
    setProgress(0, false);
    el('playHint').textContent = 'Sunucu kapalıysa otomatik başlatılır.';
    state.playBusy = false;
  }
}

async function refreshStatus() {
  if (state.statusBusy || !state.user) return;
  state.statusBusy = true;
  try {
    const data = await api('/api/status');
    renderStatus(data);
    if (data.play) renderPlay(data.play, false);
  } catch {
    // connection errors are shown by the next successful poll
  } finally {
    state.statusBusy = false;
  }
}

async function refreshConsole() {
  if (state.consoleBusy || !state.user) return;
  state.consoleBusy = true;
  try {
    const data = await api('/api/console');
    renderConsole(data.lines);
  } catch {
    // ignore
  } finally {
    state.consoleBusy = false;
  }
}

function formatSize(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' MB';
  if (value >= 1024) return Math.round(value / 1024) + ' KB';
  return value + ' B';
}

function fillModList(listId, countId, files, emptyText, type) {
  const list = el(listId);
  el(countId).textContent = files.length;
  list.innerHTML = '';
  if (!files.length) {
    const empty = document.createElement('li');
    empty.className = 'mod-empty';
    empty.textContent = emptyText;
    list.appendChild(empty);
    return;
  }
  for (const file of files) {
    const item = document.createElement('li');
    item.className = 'mod-item';
    const name = document.createElement('span');
    name.className = 'mod-name';
    name.textContent = file.name;
    name.title = file.name;
    const size = document.createElement('span');
    size.className = 'mod-size';
    size.textContent = formatSize(file.size);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mod-del';
    remove.dataset.name = file.name;
    remove.dataset.type = type;
    remove.textContent = 'Sil';
    item.append(name, size, remove);
    list.appendChild(item);
  }
}

function renderMods(data) {
  if (!data || !data.fabric) return;
  state.mods = data;
  const fabric = data.fabric;
  const badge = el('fabricState');
  badge.textContent = fabric.installed
    ? fabric.enabled
      ? 'Fabric aktif'
      : 'Fabric kurulu · kapalı'
    : 'Fabric kurulu değil';
  badge.classList.toggle('on', Boolean(fabric.installed && fabric.enabled));
  el('fabricInstall').textContent = fabric.installed ? 'Yeniden kur' : 'Shader desteğini kur';
  const toggle = el('fabricToggle');
  toggle.disabled = !fabric.installed;
  toggle.checked = Boolean(fabric.enabled);
  fillModList('modList', 'modCount', data.mods || [], 'Henüz mod yok.', 'mod');
  fillModList('shaderList', 'shaderCount', data.shaders || [], 'Henüz shader paketi yok.', 'shader');
  const paths = data.paths || {};
  el('modPath').textContent = 'Mod klasörü: ' + (paths.mods || '…');
  el('modPath').title = 'Modlar: ' + (paths.mods || '-') + '\nShaderlar: ' + (paths.shaders || '-');
  el('modHint').textContent = fabric.installed
    ? 'Dosyalar doğrudan mod/shader klasörüne kopyalanır. Klasöre elle attığın dosyalar için “Yenile”ye bas. Shaderlar oyun içinde Video Ayarları → Shaderlar bölümünden seçilir.'
    : 'Dosyalar doğrudan mod/shader klasörüne kopyalanır. Shader kullanmak için önce “Shader desteğini kur” ile Fabric + Iris kur.';
}

async function refreshMods() {
  if (!state.user) return;
  try {
    const data = await api('/api/mods');
    renderMods(data);
  } catch {
    // bir sonraki yenilemede tekrar denenir
  }
}

async function installFabric() {
  const button = el('fabricInstall');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Kuruluyor…';
  try {
    const data = await api('/api/mods/fabric/install', { method: 'POST' });
    renderMods(data);
    toast('Fabric + Iris + Sodium kuruldu. Modlu istemci açık.');
  } catch (err) {
    button.textContent = label;
    toast(err.message, true);
  } finally {
    button.disabled = false;
  }
}

async function toggleFabric(enabled) {
  try {
    const data = await api('/api/mods/fabric', { method: 'POST', body: JSON.stringify({ enabled }) });
    renderMods(data);
    toast(enabled ? 'Modlu istemci (Fabric) açık.' : 'Vanilla istemci kullanılacak.');
  } catch (err) {
    el('fabricToggle').checked = !enabled;
    toast(err.message, true);
  }
}

async function uploadModFile(file) {
  const res = await fetch('/api/mods/upload?name=' + encodeURIComponent(file.name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
    },
    body: file,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401) {
    logout(true);
    throw new Error('Oturum sona erdi.');
  }
  if (!res.ok) throw new Error((data && data.error) || 'Dosya eklenemedi.');
  return data;
}

async function uploadModFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => /\.(jar|zip)$/i.test(file.name));
  if (!files.length) {
    toast('Sadece .jar (mod) veya .zip (shader) dosyası ekleyebilirsin.', true);
    return;
  }
  if (state.modUploadBusy) return;
  state.modUploadBusy = true;
  const drop = el('modDrop');
  drop.classList.add('is-busy');
  let added = 0;
  const errors = [];
  for (const file of files) {
    try {
      const data = await uploadModFile(file);
      if (data.state) renderMods(data.state);
      added += 1;
    } catch (err) {
      errors.push(file.name + ': ' + err.message);
    }
  }
  state.modUploadBusy = false;
  drop.classList.remove('is-busy');
  el('modFiles').value = '';
  if (added) toast(added + ' dosya eklendi.');
  if (errors.length) toast(errors[0], true);
}

async function openModFolder(type) {
  try {
    const data = await api('/api/mods/folder', { method: 'POST', body: JSON.stringify({ type }) });
    toast('Klasör açıldı: ' + data.path);
  } catch (err) {
    toast(err.message, true);
  }
}

function bindModDrop() {
  const drop = el('modDrop');
  const input = el('modFiles');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => uploadModFiles(input.files));
  ['dragenter', 'dragover'].forEach((name) =>
    drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.add('is-drag');
    })
  );
  ['dragleave', 'drop'].forEach((name) =>
    drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.remove('is-drag');
    })
  );
  drop.addEventListener('drop', (event) => {
    if (event.dataTransfer) uploadModFiles(event.dataTransfer.files);
  });
  el('refreshMods').addEventListener('click', refreshMods);
  el('openModFolder').addEventListener('click', () => openModFolder('mod'));
  el('openShaderFolder').addEventListener('click', () => openModFolder('shader'));
}

async function removeMod(type, name) {
  try {
    const data = await api('/api/mods/delete', {
      method: 'POST',
      body: JSON.stringify({ type, name }),
    });
    if (data.state) renderMods(data.state);
    toast('Silindi: ' + name);
  } catch (err) {
    toast(err.message, true);
  }
}

function pollPlay() {
  clearInterval(state.playTimer);
  state.playTimer = setInterval(async () => {
    try {
      const play = await api('/api/play/status');
      renderPlay(play);
      if (play.state === 'launched' || play.state === 'error') {
        clearInterval(state.playTimer);
        state.playTimer = null;
      }
    } catch {
      clearInterval(state.playTimer);
      state.playTimer = null;
      state.playBusy = false;
    }
  }, 900);
}

async function startPlay() {
  if (state.playBusy) return;
  state.playBusy = true;
  setPlayButton('BAŞLATILIYOR', true);
  el('playHint').textContent = 'İstek gönderiliyor…';
  setProgress(0, true);
  try {
    await api('/api/play', { method: 'POST' });
    pollPlay();
  } catch (err) {
    state.playBusy = false;
    setPlayButton('OYNA', false);
    setProgress(0, false);
    el('playHint').textContent = err.message;
    toast(err.message, true);
  }
}

async function copyAddress() {
  const text = state.serverAddress;
  try {
    await navigator.clipboard.writeText(text);
    toast('Sunucu adresi kopyalandı: ' + text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      toast('Sunucu adresi kopyalandı: ' + text);
    } catch {
      toast('Adres: ' + text);
    }
    area.remove();
  }
}

async function init() {
  el('tabLogin').addEventListener('click', () => setTab('login'));
  el('tabRegister').addEventListener('click', () => setTab('register'));
  el('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuth('login');
  });
  el('registerForm').addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuth('register');
  });
  el('playBtn').addEventListener('click', startPlay);
  el('copyIp').addEventListener('click', copyAddress);
  el('refreshBtn').addEventListener('click', async () => {
    await refreshStatus();
    await refreshConsole();
    toast('Sunucu durumu yenilendi.');
  });
  el('logoutBtn').addEventListener('click', () => logout(false));
  bindModDrop();
  window.addEventListener('focus', refreshMods);
  el('fabricInstall').addEventListener('click', installFabric);
  el('fabricToggle').addEventListener('change', (event) => toggleFabric(event.target.checked));
  el('modList').addEventListener('click', (event) => {
    const button = event.target.closest('.mod-del');
    if (button) removeMod('mod', button.dataset.name);
  });
  el('shaderList').addEventListener('click', (event) => {
    const button = event.target.closest('.mod-del');
    if (button) removeMod('shader', button.dataset.name);
  });

  let bootstrap = null;
  try {
    bootstrap = await (await fetch('/api/bootstrap')).json();
  } catch {
    bootstrap = null;
  }
  state.hasUsers = Boolean(bootstrap && bootstrap.hasUsers);
  setTab(state.hasUsers ? 'login' : 'register');

  if (state.token) {
    try {
      const data = await api('/api/me');
      if (data && data.user) {
        enterApp(data.user);
        return;
      }
    } catch {
      localStorage.removeItem('blokarena.token');
      state.token = '';
    }
  }
  el('authView').classList.remove('is-hidden');
  el('mainView').classList.add('is-hidden');
}

init();
