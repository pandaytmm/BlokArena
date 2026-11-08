import * as THREE from '../vendor/three.module.js';
import { BLOCKS, blockTiles } from '../shared/config.js';
import { generateWorld, getBlock, setWorldBlock, voxelRay, mulberry32 } from '../shared/worldgen.js';

const CHUNK = 16;
const ATLAS_COLS = 4;
const TILE = 16;
const ATLAS = ATLAS_COLS * TILE;

function rgb(base, f) {
  const r = Math.max(0, Math.min(255, Math.round(base[0] * f)));
  const g = Math.max(0, Math.min(255, Math.round(base[1] * f)));
  const b = Math.max(0, Math.min(255, Math.round(base[2] * f)));
  return `rgb(${r},${g},${b})`;
}

function fillNoise(ctx, ox, oy, base, amount, rng) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const f = 1 + (rng() - 0.5) * amount;
      ctx.fillStyle = rgb(base, f);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function drawTile(ctx, ox, oy, index) {
  const rng = mulberry32(9001 + index * 733);
  ctx.fillStyle = '#000';
  ctx.fillRect(ox, oy, TILE, TILE);

  switch (index) {
    case 0: {
      fillNoise(ctx, ox, oy, [94, 158, 62], 0.32, rng);
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(rng() * TILE);
        const y = Math.floor(rng() * TILE);
        ctx.fillStyle = rng() < 0.5 ? 'rgba(50,110,40,0.55)' : 'rgba(140,200,90,0.5)';
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
      break;
    }
    case 1: {
      fillNoise(ctx, ox, oy, [122, 84, 51], 0.32, rng);
      for (let x = 0; x < TILE; x++) {
        const edge = 3 + Math.floor(rng() * 3);
        for (let y = 0; y < edge; y++) {
          const f = 0.85 + rng() * 0.35;
          ctx.fillStyle = rgb([92, 156, 60], f);
          ctx.fillRect(ox + x, oy + y, 1, 1);
        }
        if (rng() < 0.3) {
          ctx.fillStyle = 'rgba(80,140,52,0.7)';
          ctx.fillRect(ox + x, oy + edge, 1, 1);
        }
      }
      break;
    }
    case 2:
      fillNoise(ctx, ox, oy, [122, 84, 51], 0.38, rng);
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = 'rgba(80,55,32,0.45)';
        ctx.fillRect(ox + Math.floor(rng() * TILE), oy + Math.floor(rng() * TILE), 2, 1);
      }
      break;
    case 3: {
      fillNoise(ctx, ox, oy, [139, 139, 148], 0.25, rng);
      for (let i = 0; i < 5; i++) {
        let x = Math.floor(rng() * TILE);
        let y = Math.floor(rng() * TILE);
        for (let s = 0; s < 4; s++) {
          ctx.fillStyle = 'rgba(100,100,110,0.65)';
          ctx.fillRect(ox + x, oy + y, 1, 1);
          x = Math.max(0, Math.min(15, x + Math.floor(rng() * 3) - 1));
          y = Math.min(15, y + 1);
        }
      }
      break;
    }
    case 4:
      fillNoise(ctx, ox, oy, [220, 194, 122], 0.2, rng);
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = 'rgba(180,150,90,0.35)';
        ctx.fillRect(ox + Math.floor(rng() * TILE), oy + Math.floor(rng() * TILE), 1, 1);
      }
      break;
    case 5: {
      fillNoise(ctx, ox, oy, [111, 75, 42], 0.26, rng);
      for (let x = 0; x < TILE; x += 2) {
        if (rng() < 0.55) {
          ctx.fillStyle = `rgba(60,38,20,${0.25 + rng() * 0.35})`;
          ctx.fillRect(ox + x, oy, 1, TILE);
        }
      }
      break;
    }
    case 6: {
      fillNoise(ctx, ox, oy, [63, 122, 52], 0.3, rng);
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(rng() * TILE);
        const y = Math.floor(rng() * TILE);
        ctx.fillStyle = rng() < 0.55 ? 'rgba(24,58,22,0.8)' : 'rgba(100,160,70,0.55)';
        ctx.fillRect(ox + x, oy + y, 1 + (rng() < 0.2 ? 1 : 0), 1);
      }
      break;
    }
    case 7: {
      ctx.fillStyle = '#b7a894';
      ctx.fillRect(ox, oy, TILE, TILE);
      for (let row = 0; row < 4; row++) {
        const y = row * 4;
        const offset = row % 2 ? 4 : 0;
        for (let bx = -8; bx < TILE; bx += 8) {
          const x0 = bx + offset;
          for (let by = 0; by < 3; by++) {
            for (let bx2 = 0; bx2 < 7; bx2++) {
              const px = x0 + bx2;
              if (px < 0 || px >= TILE) continue;
              const f = 0.86 + rng() * 0.28;
              ctx.fillStyle = rgb([168, 70, 58], f);
              ctx.fillRect(ox + px, oy + y + by, 1, 1);
            }
          }
        }
      }
      break;
    }
    case 8: {
      for (let row = 0; row < 4; row++) {
        const f = 0.92 + rng() * 0.16;
        const y0 = row * 4;
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < TILE; x++) {
            const n = 0.9 + rng() * 0.2;
            ctx.fillStyle = rgb([[185, 138, 82], [172, 126, 72], [196, 148, 92], [178, 132, 78]][row], f * n);
            ctx.fillRect(ox + x, oy + y0 + y, 1, 1);
          }
        }
        ctx.fillStyle = 'rgba(96,64,30,0.8)';
        ctx.fillRect(ox, oy + y0, TILE, 1);
        ctx.fillRect(ox + Math.floor(rng() * TILE), oy + y0 + 1, 1, 3);
      }
      break;
    }
    case 9:
    case 10: {
      const base = index === 9 ? [255, 79, 184] : [57, 224, 232];
      fillNoise(ctx, ox, oy, base, 0.16, rng);
      for (let y = 0; y < TILE; y += 4) {
        for (let x = 0; x < TILE; x += 4) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(ox + x, oy + y, 1, 1);
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(ox + x + 2, oy + y + 2, 1, 1);
        }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.strokeRect(ox + 0.5, oy + 0.5, TILE - 1, TILE - 1);
      break;
    }
    case 11:
      fillNoise(ctx, ox, oy, [43, 47, 61], 0.3, rng);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = 'rgba(90,100,130,0.35)';
        ctx.fillRect(ox + Math.floor(rng() * TILE), oy + Math.floor(rng() * TILE), 1, 1);
      }
      break;
    case 12: {
      fillNoise(ctx, ox, oy, [187, 140, 76], 0.22, rng);
      ctx.strokeStyle = 'rgba(78,48,20,0.95)';
      ctx.strokeRect(ox + 0.5, oy + 0.5, TILE - 1, TILE - 1);
      for (let i = 0; i < TILE; i++) {
        ctx.fillStyle = 'rgba(78,48,20,0.85)';
        if (Math.abs(i - (TILE - 1 - i)) <= 1) {
          ctx.fillRect(ox + i, oy + i, 1, 1);
          ctx.fillRect(ox + i, oy + (TILE - 1 - i), 1, 1);
        }
      }
      ctx.fillStyle = 'rgba(255,235,180,0.35)';
      ctx.fillRect(ox + 2, oy + 2, 2, 1);
      break;
    }
    case 13: {
      fillNoise(ctx, ox, oy, [125, 138, 154], 0.18, rng);
      for (let i = 0; i < TILE; i++) {
        ctx.fillStyle = 'rgba(200,220,240,0.22)';
        ctx.fillRect(ox + i, oy + i, 1, 1);
      }
      for (const [cx, cy] of [[3, 3], [12, 3], [3, 12], [12, 12]]) {
        ctx.fillStyle = 'rgba(70,80,92,0.95)';
        ctx.fillRect(ox + cx, oy + cy, 2, 2);
        ctx.fillStyle = 'rgba(220,235,250,0.8)';
        ctx.fillRect(ox + cx, oy + cy, 1, 1);
      }
      break;
    }
    case 14: {
      fillNoise(ctx, ox, oy, [140, 96, 54], 0.2, rng);
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          if (Math.floor(d) % 3 === 0) {
            ctx.fillStyle = 'rgba(90,58,28,0.55)';
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        }
      }
      break;
    }
    default: {
      fillNoise(ctx, ox, oy, [57, 224, 232], 0.12, rng);
      break;
    }
  }
}

function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < 16; i++) {
    drawTile(ctx, (i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE, i);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeBlockGeometry(tiles) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.attributes.uv;
  const faceTiles = [tiles.side, tiles.side, tiles.top, tiles.bottom, tiles.side, tiles.side];
  for (let f = 0; f < 6; f++) {
    const tile = faceTiles[f] ?? 0;
    const tx = tile % ATLAS_COLS;
    const ty = Math.floor(tile / ATLAS_COLS);
    const u0 = (tx * TILE + 0.35) / ATLAS;
    const u1 = (tx * TILE + TILE - 0.35) / ATLAS;
    const v0 = 1 - (ty * TILE + TILE - 0.35) / ATLAS;
    const v1 = 1 - (ty * TILE + 0.35) / ATLAS;
    for (let i = 0; i < 4; i++) {
      const vi = f * 4 + i;
      const u = uv.getX(vi);
      const v = uv.getY(vi);
      uv.setXY(vi, u < 0.5 ? u0 : u1, v < 0.5 ? v0 : v1);
    }
  }
  uv.needsUpdate = true;

  const shades = [0.8, 0.8, 1.0, 0.52, 0.7, 0.7];
  const colors = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = (f * 4 + i) * 3;
      colors[k] = shades[f];
      colors[k + 1] = shades[f];
      colors[k + 2] = shades[f];
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

class Particles {
  constructor(scene) {
    this.max = 200;
    const geo = new THREE.BoxGeometry(0.085, 0.085, 0.085);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.items = Array.from({ length: this.max }, () => ({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
      size: 0.08
    }));
    for (let i = 0; i < this.max; i++) {
      this.dummy.position.set(0, -999, 0);
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color.set('#ffffff'));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  burst(point, color, count = 6, speed = 3) {
    let spawned = 0;
    for (let i = 0; i < this.max && spawned < count; i++) {
      const p = this.items[i];
      if (p.active) continue;
      p.active = true;
      p.pos.copy(point);
      p.vel.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.9,
        (Math.random() - 0.5) * speed
      );
      p.maxLife = 0.28 + Math.random() * 0.3;
      p.life = p.maxLife;
      p.size = 0.05 + Math.random() * 0.08;
      this.color.set(color);
      this.mesh.setColorAt(i, this.color);
      spawned++;
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    let changed = false;
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i];
      if (!p.active) continue;
      changed = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.setScalar(0);
      } else {
        p.vel.y -= 20 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const t = p.life / p.maxLife;
        this.dummy.position.copy(p.pos);
        this.dummy.scale.setScalar(p.size * (0.4 + t));
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}

class Tracers {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  spawn(from, to, color = '#ffd166') {
    let item = this.items.find((t) => !t.active);
    if (!item) {
      if (this.items.length >= 32) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      line.renderOrder = 6;
      this.scene.add(line);
      item = { line, geo, mat, active: false, life: 0, ttl: 0.08 };
      this.items.push(item);
    }
    const arr = item.geo.attributes.position.array;
    arr[0] = from.x; arr[1] = from.y; arr[2] = from.z;
    arr[3] = to.x; arr[4] = to.y; arr[5] = to.z;
    item.geo.attributes.position.needsUpdate = true;
    item.geo.computeBoundingSphere();
    item.mat.color.set(color);
    item.mat.opacity = 0.95;
    item.life = 0.075;
    item.ttl = 0.075;
    item.active = true;
    item.line.visible = true;
  }

  update(dt) {
    for (const item of this.items) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.line.visible = false;
      } else {
        item.mat.opacity = 0.95 * (item.life / item.ttl);
      }
    }
  }

  dispose(scene) {
    for (const item of this.items) {
      scene.remove(item.line);
      item.geo.dispose();
      item.mat.dispose();
    }
    this.items = [];
  }
}

const SKIES = {
  gun: {
    bg: 0x283b52, fogNear: 42, fogFar: 195,
    hemiSky: 0xb9d3f0, hemiGround: 0x3b3328, hemiIntensity: 1.25,
    sunColor: 0xffd7a3, sunIntensity: 1.9, sunPos: [-45, 90, 35],
    ambient: 0.15
  },
  box: {
    bg: 0x0c0718, fogNear: 34, fogFar: 170,
    hemiSky: 0x8a6cff, hemiGround: 0x150a28, hemiIntensity: 1.5,
    sunColor: 0xff7ad9, sunIntensity: 1.7, sunPos: [40, 80, -30],
    ambient: 0.25
  },
  smp: {
    bg: 0x8fcdf5, fogNear: 60, fogFar: 240,
    hemiSky: 0xd6ecff, hemiGround: 0x557a43, hemiIntensity: 1.35,
    sunColor: 0xfff2cf, sunIntensity: 2.1, sunPos: [-60, 110, 20],
    ambient: 0.15
  }
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      74,
      window.innerWidth / window.innerHeight,
      0.06,
      420
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.atlas = createAtlas();
    this.material = new THREE.MeshLambertMaterial({
      map: this.atlas,
      vertexColors: true
    });
    this.geometries = {};
    for (const id of Object.keys(BLOCKS)) {
      const tiles = blockTiles(Number(id));
      if (tiles) this.geometries[id] = makeBlockGeometry(tiles);
    }

    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);
    this.world = null;
    this.chunks = new Map();
    this.dirtyChunks = new Set();
    this.offset = { x: 0, z: 0 };
    this.tint = new THREE.Color();

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.8);
    this.scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(this.ambient);
    this.scene.background = new THREE.Color(0x1a2230);
    this.scene.fog = new THREE.Fog(0x1a2230, 45, 190);

    this.particles = new Particles(this.scene);
    this.tracers = new Tracers(this.scene);

    this.stars = null;
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.012, 1.012, 1.012)),
      new THREE.LineBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.95 })
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this._onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  setSky(mode) {
    const sky = SKIES[mode] || SKIES.gun;
    this.scene.background = new THREE.Color(sky.bg);
    this.scene.fog = new THREE.Fog(sky.bg, sky.fogNear, sky.fogFar);
    this.hemi.color.set(sky.hemiSky);
    this.hemi.groundColor.set(sky.hemiGround);
    this.hemi.intensity = sky.hemiIntensity;
    this.sun.color.set(sky.sunColor);
    this.sun.intensity = sky.sunIntensity;
    this.sun.position.set(...sky.sunPos);
    this.ambient.intensity = sky.ambient;

    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
      this.stars.material.dispose();
      this.stars = null;
    }
    if (mode === 'box') {
      const count = 700;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = 170 + Math.random() * 120;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.48;
        positions[i * 3] = Math.cos(theta) * Math.cos(phi) * r;
        positions[i * 3 + 1] = 25 + Math.sin(phi) * r;
        positions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xdcd4ff,
        size: 1.5,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      this.stars = new THREE.Points(geo, mat);
      this.stars.frustumCulled = false;
      this.scene.add(this.stars);
    }
  }

  buildWorld(mode, seed, edits = []) {
    this.disposeWorld();
    this.setSky(mode);
    this.world = generateWorld(mode, seed);
    for (const [x, y, z, id] of edits) {
      setWorldBlock(this.world, x, y, z, id);
    }
    this.offset.x = this.world.sx / 2;
    this.offset.z = this.world.sz / 2;
    const chunksX = Math.ceil(this.world.sx / CHUNK);
    const chunksZ = Math.ceil(this.world.sz / CHUNK);
    for (let cz = 0; cz < chunksZ; cz++) {
      for (let cx = 0; cx < chunksX; cx++) {
        this.rebuildChunk(cx, cz);
      }
    }
  }

  disposeWorld() {
    for (const chunk of this.chunks.values()) {
      this.removeChunkMeshes(chunk);
    }
    this.chunks.clear();
    this.dirtyChunks.clear();
    this.world = null;
    this.highlight.visible = false;
  }

  removeChunkMeshes(chunk) {
    for (const mesh of chunk.meshes) {
      this.worldGroup.remove(mesh);
      mesh.dispose();
    }
    chunk.meshes.length = 0;
  }

  isExposed(x, y, z) {
    const { sx, sy, sz } = this.world;
    if (x <= 0 || y <= 0 || z <= 0 || x >= sx - 1 || y >= sy - 1 || z >= sz - 1) return true;
    if (getBlock(this.world, x + 1, y, z) === 0) return true;
    if (getBlock(this.world, x - 1, y, z) === 0) return true;
    if (getBlock(this.world, x, y + 1, z) === 0) return true;
    if (getBlock(this.world, x, y - 1, z) === 0) return true;
    if (getBlock(this.world, x, y, z + 1) === 0) return true;
    if (getBlock(this.world, x, y, z - 1) === 0) return true;
    return false;
  }

  rebuildChunk(cx, cz) {
    if (!this.world) return;
    const key = `${cx},${cz}`;
    const old = this.chunks.get(key);
    if (old) {
      this.removeChunkMeshes(old);
    }

    const x0 = cx * CHUNK;
    const z0 = cz * CHUNK;
    const x1 = Math.min(this.world.sx, x0 + CHUNK);
    const z1 = Math.min(this.world.sz, z0 + CHUNK);
    const counts = new Map();
    const visible = [];

    for (let x = x0; x < x1; x++) {
      for (let z = z0; z < z1; z++) {
        for (let y = 0; y < this.world.sy; y++) {
          const id = getBlock(this.world, x, y, z);
          if (!id) continue;
          if (!this.isExposed(x, y, z)) continue;
          counts.set(id, (counts.get(id) || 0) + 1);
          visible.push(x, y, z, id);
        }
      }
    }

    const meshes = [];
    const meshByType = new Map();
    const cursor = new Map();
    for (const [id, count] of counts) {
      const geo = this.geometries[id];
      if (!geo) continue;
      const mesh = new THREE.InstancedMesh(geo, this.material, count);
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      meshByType.set(id, mesh);
      cursor.set(id, 0);
      meshes.push(mesh);
      this.worldGroup.add(mesh);
    }

    for (let i = 0; i < visible.length; i += 4) {
      const x = visible[i];
      const y = visible[i + 1];
      const z = visible[i + 2];
      const id = visible[i + 3];
      const mesh = meshByType.get(id);
      if (!mesh) continue;
      const index = cursor.get(id);
      const matrix = new THREE.Matrix4();
      matrix.makeTranslation(
        x + 0.5 - this.offset.x,
        y + 0.5,
        z + 0.5 - this.offset.z
      );
      mesh.setMatrixAt(index, matrix);
      const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453) % 1;
      const tint = 0.9 + h * 0.13;
      this.tint.setRGB(tint, tint, tint);
      mesh.setColorAt(index, this.tint);
      cursor.set(id, index + 1);
    }

    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }

    this.chunks.set(key, { meshes, cx, cz });
  }

  markChunkDirty(x, z) {
    if (!this.world) return;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    this.dirtyChunks.add(`${cx},${cz}`);
    if (x % CHUNK === 0) this.dirtyChunks.add(`${cx - 1},${cz}`);
    if (x % CHUNK === CHUNK - 1) this.dirtyChunks.add(`${cx + 1},${cz}`);
    if (z % CHUNK === 0) this.dirtyChunks.add(`${cx},${cz - 1}`);
    if (z % CHUNK === CHUNK - 1) this.dirtyChunks.add(`${cx},${cz + 1}`);
  }

  setBlock(x, y, z, id) {
    if (!this.world) return;
    setWorldBlock(this.world, x, y, z, id);
    this.markChunkDirty(x, z);
  }

  update(dt) {
    let rebuilt = 0;
    for (const key of this.dirtyChunks) {
      this.dirtyChunks.delete(key);
      const [cx, cz] = key.split(',').map(Number);
      if (cx < 0 || cz < 0) continue;
      if (cx * CHUNK >= this.world.sx || cz * CHUNK >= this.world.sz) continue;
      this.rebuildChunk(cx, cz);
      rebuilt++;
      if (rebuilt >= 3) break;
    }
    this.particles.update(dt);
    this.tracers.update(dt);
    if (this.stars) this.stars.rotation.y += dt * 0.003;
  }

  raycast(origin, dir, maxDist = 7) {
    if (!this.world) return { hit: false, t: maxDist };
    return voxelRay(
      this.world,
      origin.x, origin.y, origin.z,
      dir.x, dir.y, dir.z,
      maxDist
    );
  }

  setHighlight(hit) {
    if (!hit || !hit.hit) {
      this.highlight.visible = false;
      return;
    }
    this.highlight.visible = true;
    this.highlight.position.set(
      hit.x + 0.5 - this.offset.x,
      hit.y + 0.5,
      hit.z + 0.5 - this.offset.z
    );
  }

  toRender(x, y, z) {
    return new THREE.Vector3(x - this.offset.x, y, z - this.offset.z);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.disposeWorld();
    this.particles.dispose(this.scene);
    this.tracers.dispose(this.scene);
    this.highlight.geometry.dispose();
    this.highlight.material.dispose();
    for (const geo of Object.values(this.geometries)) geo.dispose();
    this.material.dispose();
    this.atlas.dispose();
    this.renderer.dispose();
  }
}
