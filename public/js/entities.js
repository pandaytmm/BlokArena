import * as THREE from '../vendor/three.module.js';
import { WEAPONS } from '../shared/config.js';

const SKINS = ['#ffcf9f', '#e0ac7f', '#c68b5c', '#8d5b3c', '#f5d0aa'];
const SHIRTS = ['#e45757', '#4f8fe8', '#7a4dff', '#2fb6a8', '#e0a335', '#d05ca0', '#49b36b'];
const PANTS = ['#3b4b63', '#5a4630', '#3d3d4d', '#2e5b55'];

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

function heldItem(weaponId) {
  const group = new THREE.Group();
  const w = WEAPONS[weaponId];
  if (w && w.kind === 'gun') {
    const dark = new THREE.MeshLambertMaterial({ color: 0x242a35 });
    const accent = new THREE.MeshLambertMaterial({ color: new THREE.Color(w.accent || '#ffb347') });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.52), dark);
    body.position.z = -0.08;
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.34), dark);
    barrel.position.set(0, 0.02, -0.44);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.1), dark);
    mag.position.set(0, -0.15, -0.02);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.08), accent);
    tip.position.set(0, 0.04, -0.16);
    group.add(body, barrel, mag, tip);
  } else if (w && w.kind === 'melee') {
    const steel = new THREE.MeshLambertMaterial({ color: 0xd8e6f2 });
    const handle = new THREE.MeshLambertMaterial({ color: 0x5a3b22 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.78, 0.1), steel);
    blade.position.y = 0.32;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.12), new THREE.MeshLambertMaterial({ color: 0xc9a24a }));
    guard.position.y = -0.08;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.08), handle);
    grip.position.y = -0.2;
    group.add(blade, guard, grip);
  } else {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      new THREE.MeshLambertMaterial({ color: 0xb98a52 })
    );
    group.add(block);
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = true;
    }
  });
  return group;
}

export class EntityView {
  constructor(scene, engine, data, mode) {
    this.scene = scene;
    this.engine = engine;
    this.id = data.id;
    this.mode = mode;
    this.isBot = !!data.isBot;
    this.name = data.name || 'OYUNCU';
    this.hp = Number.isFinite(data.hp) ? data.hp : 100;
    this.maxHp = Number.isFinite(data.maxHp) ? data.maxHp : 100;
    this.dead = !!data.dead;
    this.weapon = data.weapon || (mode === 'gun' ? 'rifle' : mode === 'smp' ? 'sword' : 'sword');
    this.yaw = Number.isFinite(data.yaw) ? data.yaw : 0;
    this.targetYaw = this.yaw;
    this.walkPhase = Math.random() * 6;
    this.walkAmount = 0;
    this.swing = 0;
    this.snapNext = true;
    this.target = new THREE.Vector3();
    this.lastGroupPos = new THREE.Vector3();
    this.lastAnimPos = null;
    this.group = new THREE.Group();
    this.materials = [];
    this.geometries = [];

    const hash = hashStr(this.name + this.id);
    const zombie = this.isBot && mode === 'smp';
    this.skinColor = zombie ? '#6a9e4a' : data.skin || SKINS[hash % SKINS.length];
    const shirt = data.shirt || SHIRTS[(hash >> 3) % SHIRTS.length];
    const pants = PANTS[(hash >> 5) % PANTS.length];

    this.buildModel(shirt, pants, zombie);
    this.buildTag();

    this.group.visible = !this.dead;
    this.scene.add(this.group);

    if (data.pos) this.applyNet(data, true);
  }

  buildModel(shirtColor, pantsColor, zombie) {
    const skinMat = new THREE.MeshLambertMaterial({ color: this.skinColor });
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: pantsColor });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1d2028 });
    this.materials.push(skinMat, shirtMat, pantsMat, darkMat);

    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const torsoGeo = new THREE.BoxGeometry(0.52, 0.7, 0.3);
    const limbGeo = new THREE.BoxGeometry(0.18, 0.62, 0.18);
    const legGeo = new THREE.BoxGeometry(0.2, 0.72, 0.2);
    this.geometries.push(headGeo, torsoGeo, limbGeo, legGeo);

    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.65;
    this.group.add(head);

    const eyeGeo = new THREE.BoxGeometry(0.07, 0.06, 0.02);
    this.geometries.push(eyeGeo);
    const eyeMat = new THREE.MeshLambertMaterial({ color: zombie ? 0x18200f : 0x252a33 });
    this.materials.push(eyeMat);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.11, 1.7, -0.255);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.11, 1.7, -0.255);
    this.group.add(eyeL, eyeR);

    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.05;
    this.group.add(torso);

    const armL = new THREE.Mesh(limbGeo, shirtMat);
    const armR = new THREE.Mesh(limbGeo, shirtMat);
    this.armLPivot = new THREE.Group();
    this.armRPivot = new THREE.Group();
    this.armLPivot.position.set(-0.36, 1.33, 0);
    this.armRPivot.position.set(0.36, 1.33, 0);
    armL.position.y = -0.3;
    armR.position.y = -0.3;
    this.armLPivot.add(armL);
    this.armRPivot.add(armR);
    this.group.add(this.armLPivot, this.armRPivot);

    const legL = new THREE.Mesh(legGeo, pantsMat);
    const legR = new THREE.Mesh(legGeo, pantsMat);
    this.legLPivot = new THREE.Group();
    this.legRPivot = new THREE.Group();
    this.legLPivot.position.set(-0.14, 0.78, 0);
    this.legRPivot.position.set(0.14, 0.78, 0);
    legL.position.y = -0.39;
    legR.position.y = -0.39;
    this.legLPivot.add(legL);
    this.legRPivot.add(legR);
    this.group.add(this.legLPivot, this.legRPivot);

    this.headMesh = head;
    this.isZombie = zombie;
    this.setWeapon(this.weapon);

    const shadowGeo = new THREE.CircleGeometry(0.42, 18);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    });
    this.geometries.push(shadowGeo);
    this.materials.push(shadowMat);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    this.group.add(shadow);

    if (zombie) {
      this.armLPivot.rotation.x = -1.35;
      this.armRPivot.rotation.x = -1.35;
    }
  }

  setWeapon(weaponId) {
    if (this.weapon === weaponId && this.held) return;
    this.weapon = weaponId;
    if (this.held) {
      this.armRPivot.remove(this.held);
      this.disposeObject(this.held);
      this.held = null;
    }
    if (!weaponId) return;
    const item = heldItem(weaponId);
    item.position.set(0, -0.58, -0.16);
    if (weaponId !== 'blocks') item.rotation.x = Math.PI / 2.2;
    this.armRPivot.add(item);
    this.held = item;
  }

  buildTag() {
    this.tagCanvas = document.createElement('canvas');
    this.tagCanvas.width = 512;
    this.tagCanvas.height = 128;
    this.tagCtx = this.tagCanvas.getContext('2d');
    this.tagTexture = new THREE.CanvasTexture(this.tagCanvas);
    this.tagTexture.colorSpace = THREE.SRGBColorSpace;
    this.tagMaterial = new THREE.SpriteMaterial({
      map: this.tagTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    this.tagSprite = new THREE.Sprite(this.tagMaterial);
    this.tagSprite.scale.set(3.0, 0.75, 1);
    this.tagSprite.position.y = 2.28;
    this.tagSprite.renderOrder = 30;
    this.group.add(this.tagSprite);
    this.drawTag();
  }

  drawTag() {
    const ctx = this.tagCtx;
    const w = this.tagCanvas.width;
    const h = this.tagCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 40px "Segoe UI", Arial, sans-serif';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(this.name, w / 2, 36);
    ctx.fillStyle = this.isBot ? '#ffb06b' : '#ffffff';
    ctx.fillText(this.name, w / 2, 36);

    const barW = 340;
    const barH = 16;
    const x = (w - barW) / 2;
    const y = 74;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - 3, y - 3, barW + 6, barH + 6);
    ctx.fillStyle = 'rgba(70,80,95,0.9)';
    ctx.fillRect(x, y, barW, barH);
    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    const grad = ctx.createLinearGradient(x, 0, x + barW, 0);
    if (ratio > 0.5) {
      grad.addColorStop(0, '#54d98c');
      grad.addColorStop(1, '#a4f06a');
    } else if (ratio > 0.25) {
      grad.addColorStop(0, '#ffb347');
      grad.addColorStop(1, '#ffd166');
    } else {
      grad.addColorStop(0, '#ff5c5c');
      grad.addColorStop(1, '#ff8a6b');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barW * ratio, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barW, barH);
    this.tagTexture.needsUpdate = true;
  }

  applyNet(data, immediate = false) {
    if (!data || !data.pos) return;
    const px = data.pos.x - this.engine.offset.x;
    const py = data.pos.y;
    const pz = data.pos.z - this.engine.offset.z;
    const moved = Math.hypot(px - this.target.x, py - this.target.y, pz - this.target.z);
    this.target.set(px, py, pz);
    if (immediate || !this.hasTarget || moved > 9 || (this.dead && !data.dead)) {
      this.group.position.set(px, py, pz);
      this.hasTarget = true;
      this.lastAnimPos = null;
    }
    if (Number.isFinite(data.yaw)) {
      this.yaw = this.targetYaw = data.yaw;
    }
    if (Number.isFinite(data.hp) && data.hp !== this.hp) {
      this.hp = data.hp;
      this.drawTag();
    }
    if (Number.isFinite(data.maxHp)) this.maxHp = data.maxHp;
    if (data.weapon && data.weapon !== this.weapon) this.setWeapon(data.weapon);
    const wasDead = this.dead;
    this.dead = !!data.dead;
    this.group.visible = !this.dead;
    if (wasDead && !this.dead) {
      this.group.position.set(px, py, pz);
      this.hp = data.hp ?? this.maxHp;
      this.drawTag();
    }
  }

  triggerSwing() {
    this.swing = 0.28;
  }

  update(dt) {
    if (!this.hasTarget || this.dead) return;
    const lerp = 1 - Math.exp(-16 * dt);
    this.group.position.lerp(this.target, lerp);

    let diff = ((this.targetYaw - this.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.group.rotation.y += diff * Math.min(1, 14 * dt);

    if (this.lastAnimPos) {
      const dx = this.group.position.x - this.lastAnimPos.x;
      const dz = this.group.position.z - this.lastAnimPos.z;
      const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);
      const targetWalk = Math.min(1, speed / 3.2);
      this.walkAmount += (targetWalk - this.walkAmount) * Math.min(1, 10 * dt);
    }
    this.lastAnimPos = this.group.position.clone();
    this.walkPhase += dt * (4 + this.walkAmount * 8);

    const swing = Math.sin(this.walkPhase) * 0.65 * this.walkAmount;
    if (this.isZombie) {
      this.armLPivot.rotation.x = -1.35 + Math.sin(this.walkPhase) * 0.08;
      this.armRPivot.rotation.x = -1.35 - Math.sin(this.walkPhase) * 0.08;
    } else {
      this.armLPivot.rotation.x = swing;
      if (this.swing > 0) {
        this.swing -= dt;
        this.armRPivot.rotation.x = -1.7 + (0.28 - Math.max(0, this.swing)) * 5;
      } else {
        this.armRPivot.rotation.x = -swing * 0.8 - (this.weapon ? 0.2 : 0);
      }
    }
    this.legLPivot.rotation.x = -swing * 0.9;
    this.legRPivot.rotation.x = swing * 0.9;

    if (this.headMesh) {
      this.headMesh.position.y = 1.65 + Math.abs(Math.sin(this.walkPhase * 0.5)) * 0.012 * this.walkAmount;
    }
  }

  disposeObject(obj) {
    obj.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      }
    });
  }

  dispose() {
    this.scene.remove(this.group);
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    if (this.held) this.disposeObject(this.held);
    this.tagTexture.dispose();
    this.tagMaterial.dispose();
  }
}
