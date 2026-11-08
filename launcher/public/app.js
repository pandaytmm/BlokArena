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

  const version = server.version || '1.16.5';
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
