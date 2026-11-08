export const MAX_HP = 100;
export const CHAT_LIMIT = 120;

export const MODES = {
  gun: {
    id: 'gun',
    name: 'SİLAH PVP',
    tagline: 'REFLEKSİN KONUŞSUN',
    accent: '#ff8a3d',
    desc: 'Arena haritasında tüfek, pompalı ve sniper ile botlara ve diğer oyunculara karşı ölüm maçı.',
    features: ['3 BOT RAKİP', '3 FARKLI SİLAH', 'HIZLI RESPAWN'],
    bots: 3,
    allowBuild: false,
    respawn: 3,
    slots: ['rifle', 'shotgun', 'sniper'],
    blockId: 0
  },
  box: {
    id: 'box',
    name: 'BOX PVP',
    tagline: 'GÖKYÜZÜNDE HAYATTA KAL',
    accent: '#b06cff',
    desc: 'Void üstündeki platformlarda blok kırarak köprü kur, kitini seç, düşmemeye çalış.',
    features: ['VOID ARENA', 'BLOK KÖPRÜSÜ', '3 KİT'],
    bots: 2,
    allowBuild: true,
    respawn: 3,
    kits: ['warrior', 'gunner', 'ranger'],
    blockId: 10
  },
  smp: {
    id: 'smp',
    name: 'SMP',
    tagline: 'HAYATTA KAL VE İNŞA ET',
    accent: '#54d98c',
    desc: 'Açık dünyada blok topla, yapı inşa et ve zombilere karşı savaş. Değişiklikler sunucuda kalır.',
    features: ['AÇIK DÜNYA', 'KALICI İNŞA', 'ZOMBİ AVI'],
    bots: 3,
    allowBuild: true,
    respawn: 4,
    slots: ['sword', 'blocks'],
    blockId: 8
  }
};

export const WEAPONS = {
  rifle: {
    id: 'rifle', name: 'TÜFEK', kind: 'gun', dmg: 17, headMult: 2,
    rpm: 560, mag: 30, reload: 1.8, spread: 0.014, pellets: 1,
    range: 130, auto: true, recoil: 0.011, tracer: '#ffc46b', accent: '#ffb347'
  },
  smg: {
    id: 'smg', name: 'SMG', kind: 'gun', dmg: 12, headMult: 1.8,
    rpm: 820, mag: 32, reload: 1.55, spread: 0.028, pellets: 1,
    range: 85, auto: true, recoil: 0.008, tracer: '#8ef0ff', accent: '#63d8ff'
  },
  shotgun: {
    id: 'shotgun', name: 'POMPALI', kind: 'gun', dmg: 8, headMult: 1.5,
    rpm: 78, mag: 6, reload: 2.25, spread: 0.08, pellets: 8,
    range: 42, auto: false, recoil: 0.03, tracer: '#ffb36b', accent: '#ff8a3d'
  },
  sniper: {
    id: 'sniper', name: 'SNIPER', kind: 'gun', dmg: 82, headMult: 2.2,
    rpm: 42, mag: 5, reload: 2.9, spread: 0.0015, pellets: 1,
    range: 320, auto: false, recoil: 0.045, tracer: '#c9f3ff', accent: '#9fdcff', scope: true
  },
  sword: {
    id: 'sword', name: 'KILIÇ', kind: 'melee', dmg: 32,
    rpm: 135, range: 3.6, accent: '#d8e6f2'
  }
};

export const KITS = {
  warrior: {
    id: 'warrior', name: 'SAVAŞÇI', accent: '#ff5c7a',
    desc: 'Kılıç + 48 blok',
    slots: [
      { kind: 'weapon', weapon: 'sword' },
      { kind: 'blocks', count: 48, blockId: 9 }
    ]
  },
  gunner: {
    id: 'gunner', name: 'NİŞANCI', accent: '#63d8ff',
    desc: 'SMG + 24 blok',
    slots: [
      { kind: 'weapon', weapon: 'smg' },
      { kind: 'blocks', count: 24, blockId: 10 }
    ]
  },
  ranger: {
    id: 'ranger', name: 'AVCI', accent: '#ffb347',
    desc: 'Pompalı + 32 blok',
    slots: [
      { kind: 'weapon', weapon: 'shotgun' },
      { kind: 'blocks', count: 32, blockId: 8 }
    ]
  }
};

export const BLOCKS = {
  1: { id: 1, name: 'Çim', all: null, top: 0, side: 1, bottom: 2, color: '#6aa84f' },
  2: { id: 2, name: 'Toprak', all: 2, color: '#7b5836' },
  3: { id: 3, name: 'Taş', all: 3, color: '#8d8d94' },
  4: { id: 4, name: 'Kum', all: 4, color: '#dcc27a' },
  5: { id: 5, name: 'Kütük', all: 5, top: 14, bottom: 14, color: '#6f4b2a' },
  6: { id: 6, name: 'Yaprak', all: 6, color: '#3f7a34' },
  7: { id: 7, name: 'Tuğla', all: 7, color: '#a8463a' },
  8: { id: 8, name: 'Tahta', all: 8, color: '#b98a52' },
  9: { id: 9, name: 'Neon Pembe', all: 9, color: '#ff4fb8' },
  10: { id: 10, name: 'Neon Camgöbeği', all: 10, color: '#39e0e8' },
  11: { id: 11, name: 'Koyu Taş', all: 11, color: '#2b2f3d' },
  12: { id: 12, name: 'Sandık', all: 12, color: '#c49a58' },
  13: { id: 13, name: 'Metal', all: 13, color: '#7d8a9a' }
};

export function blockTiles(id) {
  const b = BLOCKS[id];
  if (!b) return null;
  return { top: b.top ?? b.all, side: b.side ?? b.all, bottom: b.bottom ?? b.all };
}

export const BOT_NAMES = [
  'KARANLIK', 'ŞİMŞEK', 'KURT', 'GÖLGE', 'TİTAN',
  'HAYALET', 'ÇELİK', 'VORTEKS', 'JACKAL', 'NOVA',
  'VEKTÖR', 'KIZIL', 'EFSANE', 'PUSU', 'FIRTINA'
];

export const BOT_SKINS = [
  '#ffcf9f', '#d79a6b', '#a86b46', '#f2c7a0', '#8a5a3b'
];

export function getLoadout(mode, kit) {
  if (mode === 'gun') {
    return MODES.gun.slots.map((id) => ({ kind: 'weapon', weapon: id }));
  }
  if (mode === 'box') {
    const k = KITS[kit] || KITS.warrior;
    return k.slots.map((s) => ({ ...s }));
  }
  return [
    { kind: 'weapon', weapon: 'sword' },
    { kind: 'blocks', count: 64, blockId: 8 }
  ];
}

export const SPAWN_YAW = {
  gun: 0,
  box: 0,
  smp: 0
};
