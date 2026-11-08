import { getBlock } from '../shared/worldgen.js';

const RADIUS = 0.3;
const HEIGHT = 1.8;
const GRAVITY = 27;
const JUMP = 8.35;

export class LocalPlayer {
  constructor(spawn, mode) {
    this.mode = mode;
    this.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = Number.isFinite(spawn.yaw) ? spawn.yaw : 0;
    this.pitch = 0;
    this.onGround = false;
    this.radius = RADIUS;
    this.height = HEIGHT;
    this.walkTime = 0;
    this.fallSpeed = 0;
  }

  teleport(spawn) {
    this.pos.x = spawn.x;
    this.pos.y = spawn.y;
    this.pos.z = spawn.z;
    this.vel.x = 0;
    this.vel.y = 0;
    this.vel.z = 0;
    if (Number.isFinite(spawn.yaw)) this.yaw = spawn.yaw;
    this.pitch = 0;
    this.onGround = false;
  }

  collides(world) {
    const { x, y, z } = this.pos;
    const minX = Math.floor(x - RADIUS + 0.0001);
    const maxX = Math.floor(x + RADIUS - 0.0001);
    const minY = Math.floor(y + 0.0001);
    const maxY = Math.floor(y + HEIGHT - 0.0001);
    const minZ = Math.floor(z - RADIUS + 0.0001);
    const maxZ = Math.floor(z + RADIUS - 0.0001);
    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          if (getBlock(world, bx, by, bz) > 0) return true;
        }
      }
    }
    return false;
  }

  moveAxis(world, axis, amount) {
    if (amount === 0) return;
    this.pos[axis] += amount;
    if (this.collides(world)) {
      this.pos[axis] -= amount;
      if (axis === 'y') {
        if (amount < 0) {
          this.onGround = true;
          this.fallSpeed = 0;
        }
        this.vel.y = 0;
      } else {
        this.vel[axis] = 0;
      }
    }
  }

  update(dt, input, world) {
    const sprint = input.sprint && input.moveZ > 0;
    const speed = sprint ? 8.2 : 5.5;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let mx = input.moveX;
    let mz = input.moveZ;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const wx = -sin * mz + cos * mx;
    const wz = -cos * mz - sin * mx;
    const targetX = wx * speed;
    const targetZ = wz * speed;
    const accel = this.onGround ? 16 : 5;
    const blend = Math.min(1, accel * dt);
    this.vel.x += (targetX - this.vel.x) * blend;
    this.vel.z += (targetZ - this.vel.z) * blend;

    if (input.jump && this.onGround) {
      this.vel.y = JUMP;
      this.onGround = false;
    }

    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -55) this.vel.y = -55;
    this.fallSpeed = Math.min(this.fallSpeed, this.vel.y);

    this.onGround = false;
    this.moveAxis(world, 'x', this.vel.x * dt);
    this.moveAxis(world, 'z', this.vel.z * dt);
    this.moveAxis(world, 'y', this.vel.y * dt);

    this.pos.x = Math.max(1.2, Math.min(world.sx - 1.2, this.pos.x));
    this.pos.z = Math.max(1.2, Math.min(world.sz - 1.2, this.pos.z));

    const horizonSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && horizonSpeed > 0.5) {
      this.walkTime += dt * (2 + horizonSpeed * 0.55);
    } else {
      this.walkTime += dt * 0.6;
    }
  }
}
