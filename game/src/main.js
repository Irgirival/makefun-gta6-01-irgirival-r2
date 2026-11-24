// Port Meridian — game loop and state machine: title, playing, paused,
// mission phone, busted/wasted, save/load, wanted heat, combat and camera.

import {
  WORLD_W, WORLD_H, SAVE_KEY, PLAYER_MAX_HEALTH,
  HEAT_PER_STAR, HEAT_DECAY_PER_SEC, HEAT_STEAL_CAR, HEAT_SHOOT,
  HEAT_HIT_PED, HEAT_RAM_POLICE, PISTOL_DAMAGE, PISTOL_RANGE,
  WANTED_MAX,
} from './config.js';
import { buildCity, onRoad, collideBuildings, clampToWorld } from './world.js';
import {
  makePlayer, spawnTraffic, spawnPedestrians, makePoliceCar, makeTrafficCar,
  updateTrafficCar, updatePedestrian, updatePlayerOnFoot,
  updatePlayerDriving, updatePoliceCar, makeBullet, updateBullets,
  makeParticles, updateParticles, carsOverlap,
} from './entities.js';
import {
  MISSIONS, missionByIndex, startMission, currentStage,
  updateMission, failMission, spawnMissionEnemies,
} from './missions.js';
import {
  drawCity, drawCar, drawPerson, drawBullets, drawParticles,
  drawObjectiveMarker, drawHeadlights, drawHud, drawTitle,
  drawHowTo, drawPause, drawEndScreen, drawMissionPhone,
} from './render.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { shotFromUrl, stageShot } from './shots.js';
import { makeRng, range } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function newState() {
  const city = buildCity(20261124);
  const player = makePlayer(480, 480);
  return {
    city,
    player,
    traffic: spawnTraffic(city, 16, 42),
    peds: spawnPedestrians(city, 26, 99),
    police: [],
    enemies: [],
    bullets: [],
    particles: [],
    ownedCars: [],
    mode: 'title',
    menuIndex: 0,
    menuItems: [],
    showHowTo: false,
    showPhone: false,
    hour: 10.2,
    time: 0,
    wanted: 0,
    heat: 0,
    missionIndex: 0,
    mission: null,
    objective: 'Press M — call Mara for your first job',
    dialogue: null,
    message: '',
    messageTimer: 0,
    camera: { x: 0, y: 0 },
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    cashEarned: 0,
    endKind: '',
    endSub: '',
    saveDirty: false,
    rng: makeRng(555),
    consumeInteract: false,
    shot: shotFromUrl(),
  };
}

const state = newState();
const input = new Input();
const audio = new AudioEngine();

window.addEventListener('resize', () => {
  fitCanvas();
  state.viewW = window.innerWidth;
  state.viewH = window.innerHeight;
});
fitCanvas();

canvas.addEventListener('mousedown', (e) => {
  audio.ensure();
  if (state.mode === 'title' && !state.showHowTo) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const items = state.menuItems || [];
    items.forEach((label, i) => {
      const y = window.innerHeight * 0.52 + i * 56;
      if (mx > window.innerWidth / 2 - 220 && mx < window.innerWidth / 2 + 220 && my > y - 26 && my < y + 18) {
        state.menuIndex = i;
        chooseMenuItem();
      }
    });
  }
});

function chooseMenuItem() {
  const label = (state.menuItems || [])[state.menuIndex] || '';
  audio.ensure();
  if (label.startsWith('CONTINUE')) {
    loadSave();
    state.mode = 'playing';
  } else if (label.startsWith('NEW GAME')) {
    resetRun();
    state.mode = 'playing';
  } else if (label.startsWith('HOW TO PLAY')) {
    state.showHowTo = true;
  }
}

function resetRun() {
  const keepShot = state.shot;
  const fresh = newState();
  fresh.shot = keepShot;
  Object.keys(fresh).forEach((k) => { state[k] = fresh[k]; });
  state.mode = 'playing';
}

function saveGame() {
  try {
    const p = state.player;
    const data = {
      x: p.inCar ? p.inCar.x : p.x,
      y: p.inCar ? p.inCar.y : p.y,
      cash: p.cash,
      health: p.health,
      ammo: p.ammo,
      hour: state.hour,
      missionIndex: state.missionIndex,
      cashEarned: state.cashEarned,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    state.saveDirty = false;
  } catch (err) {
    // Storage may be unavailable (private mode); the game still plays.
  }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.player.x = data.x || 480;
    state.player.y = data.y || 480;
    state.player.cash = data.cash || 120;
    state.player.health = data.health || PLAYER_MAX_HEALTH;
    state.player.ammo = data.ammo || 24;
    state.hour = data.hour || 10.2;
    state.missionIndex = data.missionIndex || 0;
    state.cashEarned = data.cashEarned || 0;
    state.objective = state.missionIndex < MISSIONS.length
      ? 'Press M — call Mara for job ' + (state.missionIndex + 1)
      : 'All jobs done — free roam!';
    return true;
  } catch (err) {
    return false;
  }
}

function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch (err) {
    return false;
  }
}

function addHeat(amount) {
  state.heat = Math.min(WANTED_MAX * HEAT_PER_STAR, state.heat + amount);
  state.wanted = Math.min(WANTED_MAX, Math.floor(state.heat / HEAT_PER_STAR));
}

function nearestCar(maxDist) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  let best = null;
  let bestD = maxDist;
  const all = state.traffic.concat(state.ownedCars);
  for (const car of all) {
    const d = Math.hypot(car.x - px, car.y - py);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function tryEnterCar() {
  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.speed = 0;
    state.message = 'On foot — press E near a car to drive it';
    state.messageTimer = 2.5;
    return;
  }
  const car = nearestCar(64);
  if (!car) return;
  p.inCar = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  car.speed = 0;
  if (car.kind === 'traffic') {
    // Stealing a car with a driver: the driver flees, the heat rises.
    car.kind = 'player-car';
    car.driver = false;
    state.traffic = state.traffic.filter((c) => c !== car);
    state.ownedCars.push(car);
    addHeat(HEAT_STEAL_CAR);
    state.message = 'You stole the ' + car.model + '! The driver ran for it.';
    state.messageTimer = 3;
    const ped = {
      kind: 'ped', id: Date.now(), name: 'Driver',
      x: car.x + 40, y: car.y + 30, angle: 0, speed: 60,
      color: '#e8d06a', shirt: '#d84a3a', fleeing: true, panic: 3, walkPhase: 0,
    };
    state.peds.push(ped);
    state.particles.push(...makeParticles(car.x, car.y, 10, '#ffd76a', 120));
    audio.pickup();
  } else {
    state.message = 'Driving the ' + car.model;
    state.messageTimer = 2;
  }
}

function shootPistol() {
  const p = state.player;
  if (p.onFoot === false || p.shootCooldown > 0 || p.ammo <= 0) return;
  p.shootCooldown = 0.28;
  p.ammo -= 1;
  const bx = p.x + Math.cos(p.angle) * 20;
  const by = p.y + Math.sin(p.angle) * 20;
  state.bullets.push(makeBullet(bx, by, p.angle, true));
  state.particles.push(...makeParticles(bx, by, 5, '#ffe066', 160));
  addHeat(HEAT_SHOOT);
  audio.shot();
  if (p.ammo === 0) {
    state.message = 'Out of ammo — find the blue ammo crate at the garage';
    state.messageTimer = 3;
  }
}

function punch() {
  const p = state.player;
  if (!p.onFoot || p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  const reach = 34;
  const tx = p.x + Math.cos(p.angle) * reach;
  const ty = p.y + Math.sin(p.angle) * reach;
  for (const e of state.enemies) {
    if (Math.hypot(e.x - tx, e.y - ty) < 30) {
      e.health -= 25;
      state.particles.push(...makeParticles(e.x, e.y, 8, '#ff8a7a', 140));
      audio.blip(140, 0.1, 'square', 0.12);
      if (e.health <= 0) removeEnemy(e);
    }
  }
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - tx, ped.y - ty) < 26) {
      ped.fleeing = true;
      ped.panic = 3;
      addHeat(HEAT_HIT_PED);
    }
  }
}

function removeEnemy(e) {
  state.enemies = state.enemies.filter((x) => x !== e);
  if (state.mission) state.mission.enemiesLeft = Math.max(0, state.mission.enemiesLeft - 1);
  state.particles.push(...makeParticles(e.x, e.y, 16, '#b48fd0', 180));
  state.player.cash += 25;
}

function updatePolice(dt) {
  const want = state.wanted;
  // Spawn cruisers up to the wanted level, despawn when the heat is gone.
  while (state.police.length < want) {
    const a = state.rng() * Math.PI * 2;
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const cop = makePoliceCar(
      Math.max(60, Math.min(WORLD_W - 60, px + Math.cos(a) * 520)),
      Math.max(60, Math.min(WORLD_H - 60, py + Math.sin(a) * 520)),
      state.police.length,
    );
    state.police.push(cop);
  }
  while (state.police.length > want) state.police.pop();
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const cop of state.police) {
    const dist = updatePoliceCar(cop, { x: px, y: py }, dt, state.city);
    if (dist < 46) {
      // Ram: damage the player or their car, and push.
      if (p.inCar) {
        p.inCar.health -= 14 * dt * 4;
        p.inCar.speed *= 0.94;
        if (cop.ramCooldown <= 0) {
          cop.ramCooldown = 1;
          addHeat(HEAT_RAM_POLICE);
          state.particles.push(...makeParticles(cop.x, cop.y, 8, '#ff5346', 150));
        }
        if (p.inCar.health <= 0) {
          state.particles.push(...makeParticles(p.inCar.x, p.inCar.y, 30, '#888', 220));
          state.message = 'Your car is wrecked — get out and run!';
          state.messageTimer = 3;
          p.inCar = null;
          p.onFoot = true;
        }
      } else {
        p.health -= 22 * dt;
        if (cop.ramCooldown <= 0) {
          cop.ramCooldown = 1;
          state.particles.push(...makeParticles(p.x, p.y, 8, '#ff5346', 150));
        }
      }
      // Arrest: caught on foot, slow, with a cop right on top of you.
      if (!p.inCar && Math.abs(p.speed) < 40) {
        p.arrestTimer += dt;
        if (p.arrestTimer > 1.6) endRun('busted');
      } else {
        p.arrestTimer = 0;
      }
    }
  }
  // Heat fades only when no cruiser is close.
  const nearest = state.police.reduce((m, c) => Math.min(m, Math.hypot(c.x - px, c.y - py)), Infinity);
  if (nearest > 420 && state.heat > 0) {
    state.heat = Math.max(0, state.heat - HEAT_DECAY_PER_SEC * dt);
    state.wanted = Math.min(WANTED_MAX, Math.floor(state.heat / HEAT_PER_STAR));
  }
  audio.setSiren(state.police.length > 0);
}

function updateEnemies(dt) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const e of state.enemies.slice()) {
    const dx = px - e.x;
    const dy = py - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    if (dist > 260) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (dist > 120) {
      e.x += Math.cos(e.angle) * e.speed * 0.5 * dt;
      e.y += Math.sin(e.angle) * e.speed * 0.5 * dt;
    }
    e.shootCooldown -= dt;
    if (e.shootCooldown <= 0 && dist < PISTOL_RANGE) {
      e.shootCooldown = 1.4 + state.rng() * 0.8;
      const spread = (state.rng() - 0.5) * 0.3;
      state.bullets.push(makeBullet(e.x, e.y, e.angle + spread, false));
      audio.blip(220, 0.07, 'square', 0.06);
    }
  }
  // Bullet hits.
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    if (b.fromPlayer) {
      for (const e of state.enemies.slice()) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < 18) {
          e.health -= PISTOL_DAMAGE;
          state.particles.push(...makeParticles(b.x, b.y, 6, '#ffe066', 140));
          state.bullets.splice(i, 1);
          if (e.health <= 0) removeEnemy(e);
          break;
        }
      }
      for (const cop of state.police) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 26) {
          state.bullets.splice(i, 1);
          addHeat(6);
          break;
        }
      }
    } else if (Math.hypot(px - b.x, py - b.y) < (p.inCar ? 24 : 15)) {
      state.bullets.splice(i, 1);
      if (p.inCar) p.inCar.health -= 8;
      else p.health -= 9;
      state.particles.push(...makeParticles(b.x, b.y, 6, '#ff5346', 140));
    }
  }
}

function updateTraffic(dt) {
  const rng = state.rng;
  for (const car of state.traffic) {
    updateTrafficCar(car, dt, rng);
  }
  // Player car vs traffic collisions.
  const p = state.player;
  if (p.inCar) {
    for (const car of state.traffic) {
      if (carsOverlap(p.inCar, car)) {
        const push = 60 * dt;
        car.x += Math.cos(p.inCar.angle) * push * 4;
        car.y += Math.sin(p.inCar.angle) * push * 4;
        p.inCar.speed *= 0.92;
        p.inCar.health -= 1.5;
        if (p.inCar.health < 40) p.inCar.smoke = 1;
        state.particles.push(...makeParticles(car.x, car.y, 4, '#ffb03a', 120));
      }
    }
    // Running over a pedestrian is a crime — and it is felt.
    for (const ped of state.peds) {
      if (Math.hypot(ped.x - p.inCar.x, ped.y - p.inCar.y) < 24) {
        ped.fleeing = true;
        ped.panic = 4;
        ped.x += (ped.x - p.inCar.x) * 0.4;
        ped.y += (ped.y - p.inCar.y) * 0.4;
        addHeat(HEAT_HIT_PED);
        state.particles.push(...makeParticles(ped.x, ped.y, 6, '#ff8a7a', 120));
      }
    }
  }
  // Keep traffic topped up.
  if (state.traffic.length < 14) {
    state.traffic.push(makeTrafficCar(state.city, state.rng, state.traffic.length));
  }
}

function updatePeds(dt) {
  const p = state.player;
  const threat = { x: p.inCar ? p.inCar.x : p.x, y: p.inCar ? p.inCar.y : p.y };
  for (const ped of state.peds) {
    updatePedestrian(ped, dt, state.city, state.rng, threat);
  }
}

function updateCamera(dt) {
  const p = state.player;
  const tx = (p.inCar ? p.inCar.x : p.x) - state.viewW / 2;
  const ty = (p.inCar ? p.inCar.y : p.y) - state.viewH / 2;
  state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
  state.camera.x = Math.max(-80, Math.min(WORLD_W - state.viewW + 80, state.camera.x));
  state.camera.y = Math.max(-80, Math.min(WORLD_H - state.viewH + 80, state.camera.y));
}

function endRun(kind) {
  const p = state.player;
  state.mode = 'end';
  state.endKind = kind;
  if (kind === 'busted') {
    state.endSub = 'The Port Meridian police took you in. Mara posts your bail — minus $100.';
    p.cash = Math.max(0, p.cash - 100);
    audio.fail();
  } else {
    state.endSub = 'You wake up in St. Anselm Hospital. The crew covers the bill — minus $80.';
    p.cash = Math.max(0, p.cash - 80);
    audio.fail();
  }
  if (state.mission) failMission(state, kind === 'busted' ? 'Busted by the police.' : 'You were knocked out.');
  state.saveDirty = true;
}

function respawn() {
  const p = state.player;
  p.health = PLAYER_MAX_HEALTH;
  p.x = 480; p.y = 480;
  p.inCar = null;
  p.onFoot = true;
  p.arrestTimer = 0;
  state.heat = 0;
  state.wanted = 0;
  state.police = [];
  state.mode = 'playing';
  state.message = 'Back on the streets of Port Meridian.';
  state.messageTimer = 3;
  saveGame();
}

function updatePlaying(dt) {
  const p = state.player;
  state.time += dt;
  state.hour += dt / 90;
  if (state.hour >= 24) state.hour -= 24;
  if (state.messageTimer > 0) state.messageTimer -= dt;

  // Dialogue advance.
  if (state.dialogue && state.dialogue.index < state.dialogue.lines.length) {
    if (input.wasPressed('interact') || input.wasPressed('confirm')) {
      state.dialogue.index += 1;
      if (state.dialogue.index >= state.dialogue.lines.length) state.dialogue = null;
      return;
    }
  }

  if (input.wasPressed('pause')) {
    state.mode = 'paused';
    saveGame();
    return;
  }
  if (input.wasPressed('phone')) {
    state.showPhone = true;
    state.mode = 'phone';
    return;
  }
  if (input.wasPressed('mute')) {
    const muted = audio.toggleMute();
    state.message = muted ? 'Sound muted' : 'Sound on';
    state.messageTimer = 1.5;
  }

  // Interact (steal car / pick up) is edge-triggered.
  if (input.wasPressed('interact')) {
    const stage = currentStage(state);
    if (state.mission && stage && stage.type === 'pickup') {
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      if (Math.hypot(px - stage.x, py - stage.y) < stage.radius) {
        state.consumeInteract = true;
      } else {
        tryEnterCar();
      }
    } else {
      tryEnterCar();
    }
  }

  if (p.inCar) {
    updatePlayerDriving(p.inCar, input, dt, state.city);
    p.x = p.inCar.x;
    p.y = p.inCar.y;
    audio.setEngine(p.inCar.speed, true);
    if (p.inCar.smoke > 0.4 && Math.random() < 0.3) {
      state.particles.push(...makeParticles(p.inCar.x - Math.cos(p.inCar.angle) * 20, p.inCar.y - Math.sin(p.inCar.angle) * 20, 1, '#888', 30));
    }
  } else {
    updatePlayerOnFoot(p, input, dt, state.city);
    audio.setEngine(0, false);
    if (input.wasPressed('shoot') || input.shoot) shootPistol();
    if (input.wasPressed('punch')) punch();
  }

  updateMission(state, dt);
  const stage = currentStage(state);
  if (stage && stage.type === 'combat' && state.enemies.length === 0 && state.mission && state.mission.enemiesLeft === 0 && !state.mission.combatSpawned) {
    state.mission.combatSpawned = true;
    spawnMissionEnemies(state);
  }
  updateEnemies(dt);
  updatePolice(dt);
  updateTraffic(dt);
  updatePeds(dt);
  updateBullets(state.bullets, dt, state.city);
  updateParticles(state.particles, dt);

  // Health regen when calm, death check.
  if (state.wanted === 0 && p.health < PLAYER_MAX_HEALTH) p.health = Math.min(PLAYER_MAX_HEALTH, p.health + 2.5 * dt);
  if (p.health <= 0) endRun('wasted');
  if (p.inCar && p.inCar.health <= 0) {
    state.particles.push(...makeParticles(p.inCar.x, p.inCar.y, 30, '#888', 220));
    p.inCar = null;
    p.onFoot = true;
  }
  updateCamera(dt);
  if (state.saveDirty) saveGame();
}

function updateTitle(dt) {
  state.time += dt;
  if (input.wasPressed('up')) state.menuIndex = Math.max(0, state.menuIndex - 1);
  if (input.wasPressed('down')) state.menuIndex = Math.min((state.menuItems || []).length - 1, state.menuIndex + 1);
  if (state.showHowTo) {
    if (input.wasPressed('confirm') || input.wasPressed('pause')) state.showHowTo = false;
    return;
  }
  if (input.wasPressed('confirm')) chooseMenuItem();
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (state.mode === 'title') updateTitle(dt);
  else if (state.mode === 'playing') updatePlaying(dt);
  else if (state.mode === 'paused') {
    if (input.wasPressed('pause')) state.mode = 'playing';
    if (input.held && input.wasPressed('confirm')) state.mode = 'playing';
  } else if (state.mode === 'phone') {
    if (input.wasPressed('phone') || input.wasPressed('pause')) {
      state.showPhone = false;
      state.mode = 'playing';
    } else if (input.wasPressed('confirm')) {
      const next = missionByIndex(state.missionIndex);
      if (next && !state.mission) {
        startMission(state, state.missionIndex);
        state.showPhone = false;
        state.mode = 'playing';
        audio.pickup();
      }
    }
  } else if (state.mode === 'end') {
    if (input.wasPressed('confirm')) respawn();
  }

  // ---- Render ----
  ctx.clearRect(0, 0, vw, vh);
  if (state.mode === 'title') {
    drawTitle(ctx, state, vw, vh, hasSave());
    if (state.showHowTo) drawHowTo(ctx, vw, vh);
  } else {
    drawCity(ctx, state.city, state.camera, vw, vh, state.hour, state.time);
    const stage = currentStage(state);
    if (stage) drawObjectiveMarker(ctx, stage, state.camera, state.time);
    for (const car of state.traffic) drawCar(ctx, car, state.camera, state.time);
    for (const car of state.ownedCars) drawCar(ctx, car, state.camera, state.time);
    for (const cop of state.police) drawCar(ctx, cop, state.camera, state.time);
    for (const ped of state.peds) drawPerson(ctx, ped, state.camera, false);
    for (const e of state.enemies) drawPerson(ctx, e, state.camera, false);
    if (state.player.onFoot) drawPerson(ctx, state.player, state.camera, true);
    drawBullets(ctx, state.bullets, state.camera);
    drawParticles(ctx, state.particles, state.camera);
    drawHeadlights(ctx, state.traffic.concat(state.ownedCars, state.police), state.player, state.camera, state.hour);
    drawHud(ctx, state, vw, vh);
    if (state.mode === 'paused') drawPause(ctx, state, vw, vh);
    else if (state.mode === 'phone') drawMissionPhone(ctx, state, vw, vh);
    else if (state.mode === 'end') {
      drawEndScreen(ctx, state.endKind === 'busted' ? 'BUSTED!' : 'WASTED', state.endSub, vw, vh);
    }
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

// Staged screenshot scenes start straight in the game, no title screen.
if (state.shot) {
  stageShot(state, state.shot);
}

requestAnimationFrame(frame);
