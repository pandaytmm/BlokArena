export const WORLD_SIZES = {
  gun: { sx: 64, sy: 40, sz: 64 },
  box: { sx: 64, sy: 40, sz: 64 },
  smp: { sx: 96, sy: 48, sz: 96 }
};

const GRASS = 1;
const DIRT = 2;
const STONE = 3;
const SAND = 4;
const WOOD = 5;
const LEAVES = 6;
const BRICK = 7;
const PLANK = 8;
const NEON_PINK = 9;
const NEON_CYAN = 10;
const DARK = 11;
const CRATE = 12;
const METAL = 13;

const idxOf = (sx, sz) => (x, y, z) => (y * sz + z) * sx + x;

export function mulberry32(a) {
  let s = a >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed | 0, 69069);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, z, seed) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = smooth(xf);
  const v = smooth(zf);
  const a = hash2(xi, zi, seed);
  const b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed);
  const d = hash2(xi + 1, zi + 1, seed);
  const ab = a + (b - a) * u;
  const cd = c + (d - c) * u;
  return ab + (cd - ab) * v;
}

function fbm(x, z, seed, octaves = 4) {
  let sum = 0;
  let norm = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq, seed + i * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

export function getBlock(world, x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  if (xi < 0 || yi < 0 || zi < 0 || xi >= world.sx || yi >= world.sy || zi >= world.sz) return 0;
  return world.data[(yi * world.sz + zi) * world.sx + xi];
}

export function setWorldBlock(world, x, y, z, id) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  if (xi < 0 || yi < 0 || zi < 0 || xi >= world.sx || yi >= world.sy || zi >= world.sz) return false;
  world.data[(yi * world.sz + zi) * world.sx + xi] = id;
  return true;
}

export function isSolid(world, x, y, z) {
  return getBlock(world, x, y, z) > 0;
}

export function groundTop(world, x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  if (xi < 0 || zi < 0 || xi >= world.sx || zi >= world.sz) return -1;
  for (let y = world.sy - 1; y >= 0; y--) {
    if (world.data[(y * world.sz + zi) * world.sx + xi] > 0) return y;
  }
  return -1;
}

export function voxelRay(world, ox, oy, oz, dx, dy, dz, maxDist = 64) {
  const len = Math.hypot(dx, dy, dz) || 1;
  const rx = dx / len;
  const ry = dy / len;
  const rz = dz / len;

  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = rx > 0 ? 1 : rx < 0 ? -1 : 0;
  const stepY = ry > 0 ? 1 : ry < 0 ? -1 : 0;
  const stepZ = rz > 0 ? 1 : rz < 0 ? -1 : 0;

  const deltaX = rx !== 0 ? Math.abs(1 / rx) : Infinity;
  const deltaY = ry !== 0 ? Math.abs(1 / ry) : Infinity;
  const deltaZ = rz !== 0 ? Math.abs(1 / rz) : Infinity;

  let maxX = rx > 0 ? (x + 1 - ox) / rx : rx < 0 ? (ox - x) / -rx : Infinity;
  let maxY = ry > 0 ? (y + 1 - oy) / ry : ry < 0 ? (oy - y) / -ry : Infinity;
  let maxZ = rz > 0 ? (z + 1 - oz) / rz : rz < 0 ? (oz - z) / -rz : Infinity;

  let nx = 0, ny = 0, nz = 0;
  let t = 0;

  for (let i = 0; i < 640; i++) {
    if (x < 0 || y < 0 || z < 0 || x >= world.sx || y >= world.sy || z >= world.sz) {
      return { hit: false, t: maxDist, x, y, z, nx: 0, ny: 0, nz: 0, block: 0 };
    }
    const block = world.data[(y * world.sz + z) * world.sx + x];
    if (block > 0) {
      return { hit: true, t, x, y, z, nx, ny, nz, block };
    }
    if (t > maxDist) break;
    if (maxX < maxY && maxX < maxZ) {
      x += stepX;
      t = maxX;
      maxX += deltaX;
      nx = -stepX; ny = 0; nz = 0;
    } else if (maxY < maxZ) {
      y += stepY;
      t = maxY;
      maxY += deltaY;
      nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ;
      t = maxZ;
      maxZ += deltaZ;
      nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return { hit: false, t: maxDist, x, y, z, nx: 0, ny: 0, nz: 0, block: 0 };
}

function addBox(world, x0, y0, z0, w, h, d, id) {
  const { sx, sy, sz, data } = world;
  for (let x = x0; x < x0 + w; x++) {
    for (let z = z0; z < z0 + d; z++) {
      for (let y = y0; y < y0 + h; y++) {
        if (x < 0 || z < 0 || y < 0 || x >= sx || y >= sy || z >= sz) continue;
        data[(y * sz + z) * sx + x] = id;
      }
    }
  }
}

function localTop(world, x, z) {
  const { sx, sz, sy, data } = world;
  if (x < 0 || z < 0 || x >= sx || z >= sz) return -1;
  for (let y = sy - 1; y >= 0; y--) {
    if (data[(y * sz + z) * sx + x] > 0) return y;
  }
  return -1;
}

function addSpawn(world, spawns, x, z, y, cx, cz) {
  const yaw = Math.atan2(-(cx - x), -(cz - z));
  spawns.push({ x: x + 0.5, y, z: z + 0.5, yaw });
}

function generateGun(world, seed, spawns) {
  const { sx, sz, data } = world;
  const idx = idxOf(sx, sz);
  const cx = sx >> 1;
  const cz = sz >> 1;

  for (let x = 1; x < sx - 1; x++) {
    for (let z = 1; z < sz - 1; z++) {
      for (let y = 0; y <= 6; y++) {
        data[idx(x, y, z)] = y === 6 ? GRASS : y >= 4 ? DIRT : STONE;
      }
    }
  }

  for (let x = 0; x < sx; x++) {
    for (let z = 0; z < sz; z++) {
      if (x < 1 || x >= sx - 1 || z < 1 || z >= sz - 1) {
        for (let y = 7; y <= 10; y++) data[idx(x, y, z)] = BRICK;
      }
    }
  }

  // Merkez kule
  addBox(world, cx - 2, 7, cz - 2, 5, 4, 5, CRATE);

  // Simetrik siperler
  addBox(world, cx - 13, 7, cz - 9, 8, 3, 1, METAL);
  addBox(world, cx + 5, 7, cz - 9, 8, 3, 1, METAL);
  addBox(world, cx - 13, 7, cz + 9, 8, 3, 1, METAL);
  addBox(world, cx + 5, 7, cz + 9, 8, 3, 1, METAL);
  addBox(world, cx - 9, 7, cz - 13, 1, 3, 8, METAL);
  addBox(world, cx + 9, 7, cz + 5, 1, 3, 8, METAL);
  addBox(world, cx - 9, 7, cz + 5, 1, 3, 8, METAL);
  addBox(world, cx + 9, 7, cz - 13, 1, 3, 8, METAL);

  // Dağınık sandık/platform siperleri
  const rng = mulberry32(seed ^ 0xa5a5a5);
  for (let i = 0; i < 20; i++) {
    const w = 2 + Math.floor(rng() * 2);
    const d = 2 + Math.floor(rng() * 2);
    const h = 1 + Math.floor(rng() * 3);
    const x = 6 + Math.floor(rng() * (sx - 14 - w));
    const z = 6 + Math.floor(rng() * (sz - 14 - d));
    addBox(world, x, 7, z, w, h, d, rng() < 0.55 ? CRATE : PLANK);
  }

  // Basamaklı rampalar
  addBox(world, cx - 4, 7, cz + 4, 3, 1, 1, METAL);
  addBox(world, cx + 3, 7, cz - 4, 3, 1, 1, METAL);

  const spots = [
    [cx - 21, cz - 21], [cx, cz - 22], [cx + 21, cz - 21],
    [cx - 22, cz], [cx + 22, cz],
    [cx - 21, cz + 21], [cx, cz + 22], [cx + 21, cz + 21]
  ];
  for (const [x, z] of spots) {
    const top = localTop(world, x, z);
    if (top > 0) addSpawn(world, spawns, x, z, top + 1, cx, cz);
  }
}

function platform(world, x0, z0, x1, z1, top, borderId = NEON_PINK, topId = NEON_CYAN, undersideId = DARK) {
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      for (let y = top - 2; y <= top; y++) {
        if (y === top) setWorldBlock(world, x, y, z, edge ? borderId : topId);
        else setWorldBlock(world, x, y, z, undersideId);
      }
    }
  }
}

function generateBox(world, seed, spawns) {
  const { sx, sz } = world;
  const cx = sx >> 1;
  const cz = sz >> 1;

  platform(world, cx - 11, cz - 11, cx + 11, cz + 11, 18);

  platform(world, cx - 4, cz - 26, cx + 4, cz - 18, 18);
  platform(world, cx - 4, cz + 18, cx + 4, cz + 26, 18);
  platform(world, cx - 26, cz - 4, cx - 18, cz + 4, 18);
  platform(world, cx + 18, cz - 4, cx + 26, cz + 4, 18);

  // Köprüler
  addBox(world, cx - 1, 18, cz - 17, 3, 1, 6, NEON_CYAN);
  addBox(world, cx - 1, 18, cz + 12, 3, 1, 6, NEON_CYAN);
  addBox(world, cx - 17, 18, cz - 1, 6, 1, 3, NEON_CYAN);
  addBox(world, cx + 12, 18, cz - 1, 6, 1, 3, NEON_CYAN);

  // Merkez kapak sütunları
  addBox(world, cx - 9, 19, cz - 9, 2, 2, 2, DARK);
  addBox(world, cx + 8, 19, cz - 9, 2, 2, 2, DARK);
  addBox(world, cx - 9, 19, cz + 8, 2, 2, 2, DARK);
  addBox(world, cx + 8, 19, cz + 8, 2, 2, 2, DARK);

  // Uzak dekor adaları
  platform(world, 8, 8, 13, 13, 22);
  platform(world, sx - 14, 8, sx - 9, 13, 22);
  platform(world, 8, sz - 14, 13, sz - 9, 22);
  platform(world, sx - 14, sz - 14, sx - 9, sz - 9, 22);

  const spots = [
    [cx - 6, cz - 6], [cx + 6, cz - 6], [cx - 6, cz + 6], [cx + 6, cz + 6],
    [cx, cz - 22], [cx, cz + 22], [cx - 22, cz], [cx + 22, cz]
  ];
  for (const [x, z] of spots) {
    addSpawn(world, spawns, x, z, 19, cx, cz);
  }
}

function generateSmp(world, seed, spawns) {
  const { sx, sy, sz, data } = world;
  const idx = idxOf(sx, sz);
  const cx = sx >> 1;
  const cz = sz >> 1;
  const noiseSeed = (seed ^ 0x51ed270b) & 0x7fffffff;

  const heightAt = (x, z) => {
    const base = fbm(x * 0.045, z * 0.045, noiseSeed, 4);
    const detail = fbm(x * 0.14, z * 0.14, noiseSeed + 77, 2);
    return Math.floor(9 + base * 13 + detail * 2.5);
  };

  for (let x = 0; x < sx; x++) {
    for (let z = 0; z < sz; z++) {
      const h = Math.min(sy - 8, heightAt(x, z));
      const beach = h <= 11;
      for (let y = 0; y <= h; y++) {
        let id = STONE;
        if (y === h) id = beach ? SAND : GRASS;
        else if (y >= h - 3) id = beach ? SAND : DIRT;
        data[idx(x, y, z)] = id;
      }
    }
  }

  // Spawn noktaları (ağaçlardan önce)
  const candidate = [
    [cx - 10, cz], [cx + 10, cz], [cx, cz - 10], [cx, cz + 10],
    [cx - 16, cz - 16], [cx + 16, cz - 16], [cx - 16, cz + 16], [cx + 16, cz + 16]
  ];
  for (const [x, z] of candidate) {
    const top = localTop(world, x, z);
    if (top > 0 && top < sy - 8) spawns.push({ x: x + 0.5, y: top + 1, z: z + 0.5, yaw: 0 });
  }

  const rng = mulberry32((seed ^ 0x77aa11) >>> 0);
  let trees = 0;
  let attempts = 0;
  while (trees < 38 && attempts < 260) {
    attempts++;
    const x = 4 + Math.floor(rng() * (sx - 8));
    const z = 4 + Math.floor(rng() * (sz - 8));
    if (spawns.some((s) => Math.abs(s.x - x) < 5 && Math.abs(s.z - z) < 5)) continue;
    const top = localTop(world, x, z);
    if (top < 8 || top > sy - 12) continue;
    if (data[idx(x, top, z)] !== GRASS) continue;
    const trunk = 4 + Math.floor(rng() * 3);
    for (let i = 1; i <= trunk; i++) data[idx(x, top + i, z)] = WOOD;
    const crown = top + trunk;
    for (let dy = -1; dy <= 2; dy++) {
      const r = dy <= 0 ? 2 : dy === 1 ? 1 : 0;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > r + (dy <= 0 ? 1 : 0)) continue;
          const ly = crown + dy;
          if (ly >= sy) continue;
          const ix = x + dx;
          const iz = z + dz;
          if (ix < 0 || iz < 0 || ix >= sx || iz >= sz) continue;
          const cur = data[idx(ix, ly, iz)];
          if (cur === 0) data[idx(ix, ly, iz)] = LEAVES;
        }
      }
    }
    trees++;
  }

  // Kayalar
  for (let i = 0; i < 14; i++) {
    const x = 5 + Math.floor(rng() * (sx - 10));
    const z = 5 + Math.floor(rng() * (sz - 10));
    if (spawns.some((s) => Math.abs(s.x - x) < 4 && Math.abs(s.z - z) < 4)) continue;
    const top = localTop(world, x, z);
    if (top < 8 || data[idx(x, top, z)] !== GRASS) continue;
    addBox(world, x - 1, top - 1, z - 1, 3, 2 + (i % 2), 3, STONE);
  }

  // Merkezdeki spawn yönlerini merkeze çevir
  for (const s of spawns) {
    s.yaw = Math.atan2(-(cx - s.x), -(cz - s.z));
  }
}

export function generateWorld(mode, seed) {
  const size = WORLD_SIZES[mode] || WORLD_SIZES.gun;
  const world = {
    mode,
    seed,
    sx: size.sx,
    sy: size.sy,
    sz: size.sz,
    data: new Uint8Array(size.sx * size.sy * size.sz),
    spawns: []
  };
  if (mode === 'box') generateBox(world, seed, world.spawns);
  else if (mode === 'smp') generateSmp(world, seed, world.spawns);
  else generateGun(world, seed, world.spawns);
  return world;
}
