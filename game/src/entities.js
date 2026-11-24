// The people and vehicles of Port Meridian: the player, traffic cars that
// drive the road grid, pedestrians on the sidewalks, police cruisers that
// chase, plus bullets and particles.

import {
  WORLD_W, WORLD_H, ROADS_X, ROADS_Y, CAR_MODELS, PED_NAMES,
  PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, CAR_ACCEL, CAR_MAX_SPEED,
  CAR_REVERSE_SPEED, CAR_TURN, CAR_BRAKE,
} from './config.js';
import { makeRng, range, rangeInt, pick, chance } from './random.js';
import { onRoad, nearestRoadX, nearestRoadY, collideBuildings, resolveBuildingCollision, clampToWorld, randomRoadPoint } from './world.js';

export function makePlayer(x, y) {
  return {
    kind: 'player', x, y, angle: -Math.PI / 2, speed: 0,
    health: 100, cash: 120, ammo: 24, inCar: null, onFoot: true,
    punchCooldown: 0, shootCooldown: 0, arrestTimer: 0, invuln: 0,
    moving: false, running: false,
  };
}

export function makeTrafficCar(world, rng, index) {
  const spot = randomRoadPoint(rng);
  const model = pick(rng, CAR_MODELS);
  const dir = chance(rng, 0.5) ? 1 : -1;
  const angle = spot.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  const lane = 16;
  return {
    kind: 'traffic', id: index, model: model.name, color: model.color,
    len: model.len, wid: model.wid,
    x: spot.vertical ? spot.x + (dir > 0 ? lane : -lane) : spot.x,
    y: spot.vertical ? spot.y : spot.y + (dir > 0 ? lane : -lane),
    angle, speed: range(rng, 55, 95), maxSpeed: range(rng, 70, 110),
    vertical: spot.vertical, dir, driver: true, health: 100,
    smoke: 0, brakeLight: false, turnAt: null,
  };
}

export function spawnTraffic(city, count, seed) {
  const rng = makeRng(seed + 101);
  const cars = [];
  for (let i = 0; i < count; i += 1) cars.push(makeTrafficCar(city, rng, i));
  return cars;
}

export function makePedestrian(city, rng, index) {
  const spot = randomRoadPoint(rng);
  return {
    kind: 'ped', id: index, name: pick(rng, PED_NAMES),
    x: spot.x + range(rng, -60, 60), y: spot.y + range(rng, -60, 60),
    angle: range(rng, 0, Math.PI * 2), speed: range(rng, 22, 42),
    color: pick(rng, ['#e86a6a', '#6aa8e8', '#e8d06a', '#8ae86a', '#c98ae8', '#e8e8e8', '#6ad8c9']),
    shirt: pick(rng, ['#d84a3a', '#3a6fd8', '#f2a93b', '#4a8a5d', '#e86a9a', '#7a4fd0']),
    fleeing: false, panic: 0, walkPhase: range(rng, 0, Math.PI * 2),
  };
}

export function spawnPedestrians(city, count, seed) {
  const rng = makeRng(seed + 202);
  const peds = [];
  for (let i = 0; i < count; i += 1) peds.push(makePedestrian(city, rng, i));
  return peds;
}

export function makePoliceCar(x, y, index) {
  return {
    kind: 'police', id: index, model: 'Interceptor cruiser', color: '#1c2733',
    len: 52, wid: 23, x, y, angle: 0, speed: 0, maxSpeed: 470,
    siren: true, health: 100, smoke: 0, ramCooldown: 0,
  };
}

export function updateTrafficCar(car, dt, rng) {
  const step = car.speed * dt;
  car.x += Math.cos(car.angle) * step;
  car.y += Math.sin(car.angle) * step;
  // At an intersection, sometimes turn onto the crossing road.
  const nearX = nearestRoadX(car.x);
  const nearY = nearestRoadY(car.y);
  const atJunction = Math.abs(car.x - nearX) < 14 && Math.abs(car.y - nearY) < 14;
  if (atJunction && chance(rng, 0.28)) {
    if (car.vertical && chance(rng, 0.5)) {
      car.vertical = false;
      car.dir = chance(rng, 0.5) ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      car.y = nearY + (car.dir > 0 ? 16 : -16);
    } else if (!car.vertical) {
      car.vertical = true;
      car.dir = chance(rng, 0.5) ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x = nearX + (car.dir > 0 ? 16 : -16);
    }
  }
  // Wrap around the city edge so traffic never runs out.
  if (car.x < -80) car.x = WORLD_W + 60;
  if (car.x > WORLD_W + 80) car.x = -60;
  if (car.y < -80) car.y = WORLD_H + 60;
  if (car.y > WORLD_H + 80) car.y = -60;
}

export function updatePedestrian(ped, dt, city, rng, threat) {
  ped.walkPhase += dt * 6;
  if (threat && Math.hypot(ped.x - threat.x, ped.y - threat.y) < 160) {
    ped.fleeing = true;
    ped.panic = 2.5;
    const away = Math.atan2(ped.y - threat.y, ped.x - threat.x);
    ped.angle = away;
  } else if (ped.panic > 0) {
    ped.panic -= dt;
    if (ped.panic <= 0) ped.fleeing = false;
  } else if (chance(rng, 0.004)) {
    ped.angle = range(rng, 0, Math.PI * 2);
  }
  const speed = ped.fleeing ? ped.speed * 2.6 : ped.speed;
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  if (collideBuildings(city, ped.x, ped.y, 10)) {
    ped.x -= Math.cos(ped.angle) * speed * dt;
    ped.y -= Math.sin(ped.angle) * speed * dt;
    ped.angle += Math.PI / 2;
  }
  clampToWorld(ped, 24);
}

export function updatePlayerOnFoot(player, input, dt, city) {
  let mx = 0;
  let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  player.moving = mx !== 0 || my !== 0;
  player.running = !!input.run && player.moving;
  if (player.moving) {
    const len = Math.hypot(mx, my);
    const speed = player.running ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
    player.angle = Math.atan2(my / len, mx / len);
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  resolveBuildingCollision(city, player, 13);
  clampToWorld(player, 20);
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.invuln > 0) player.invuln -= dt;
}

export function updatePlayerDriving(car, input, dt, city) {
  const forward = Math.cos(car.angle);
  const side = Math.sin(car.angle);
  if (input.up) car.speed += CAR_ACCEL * dt;
  else if (input.down) car.speed -= CAR_BRAKE * dt * 0.9;
  else car.speed *= Math.pow(0.35, dt);
  if (input.down && car.speed < 0) car.speed = Math.max(car.speed, -CAR_REVERSE_SPEED);
  car.speed = Math.max(-CAR_REVERSE_SPEED, Math.min(CAR_MAX_SPEED, car.speed));
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const steerFactor = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * CAR_TURN * steerFactor * dt * Math.sign(car.speed || 1);
  const nx = car.x + forward * car.speed * dt;
  const ny = car.y + side * car.speed * dt;
  if (collideBuildings(city, nx, ny, 20)) {
    car.speed *= -0.25;
    car.health -= Math.abs(car.speed) * 0.04 + 2;
    if (car.health < 40) car.smoke = 1;
    car.x += forward * car.speed * dt * 0.2;
    car.y += side * car.speed * dt * 0.2;
  } else {
    car.x = nx;
    car.y = ny;
  }
  clampToWorld(car, 30);
  car.brakeLight = !!input.down;
}

export function updatePoliceCar(cop, player, dt, city) {
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let diff = want - cop.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  cop.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
  const target = dist > 700 ? cop.maxSpeed : cop.maxSpeed * 0.92;
  cop.speed += (target - cop.speed) * Math.min(1, dt * 1.4);
  cop.x += Math.cos(cop.angle) * cop.speed * dt;
  cop.y += Math.sin(cop.angle) * cop.speed * dt;
  if (collideBuildings(city, cop.x, cop.y, 18)) {
    cop.speed *= 0.4;
    cop.x -= Math.cos(cop.angle) * 14;
    cop.y -= Math.sin(cop.angle) * 14;
  }
  clampToWorld(cop, 30);
  if (cop.ramCooldown > 0) cop.ramCooldown -= dt;
  return dist;
}

export function makeBullet(x, y, angle, fromPlayer) {
  return { x, y, angle, speed: 780, life: 0.55, fromPlayer };
}

export function updateBullets(bullets, dt, city) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (b.life <= 0 || collideBuildings(city, b.x, b.y, 2)) bullets.splice(i, 1);
  }
}

export function makeParticles(x, y, count, color, speed) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, max: 1, color, size: 2 + Math.random() * 3 });
  }
  return parts;
}

export function updateParticles(parts, dt) {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const p = parts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
}

export function carCorners(car) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hl = car.len / 2;
  const hw = car.wid / 2;
  return [
    { x: car.x + c * hl - s * hw, y: car.y + s * hl + c * hw },
    { x: car.x + c * hl + s * hw, y: car.y + s * hl - c * hw },
    { x: car.x - c * hl + s * hw, y: car.y - s * hl - c * hw },
    { x: car.x - c * hl - s * hw, y: car.y - s * hl + c * hw },
  ];
}

export function carsOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy) < (a.len + b.len) / 2 - 6;
}
