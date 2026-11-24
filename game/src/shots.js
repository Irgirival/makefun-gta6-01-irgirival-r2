// Screenshot staging: ?shot=chase|drive|mission|night puts the game into a
// fixed, busy, deterministic scene so the screenshots show the open world
// at its best — HUD, minimap, wanted stars, traffic and missions included.

import { makePoliceCar, makeTrafficCar, makePedestrian } from './entities.js';
import { makeRng } from './random.js';
import { startMission, spawnMissionEnemies } from './missions.js';

export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot') || '';
}

export function stageShot(state, shot) {
  const p = state.player;
  state.mode = 'playing';
  state.dialogue = null;
  state.messageTimer = 0;

  if (shot === 'chase') {
    // Dusk police chase downtown: 3 stars, cruisers closing in, traffic ahead.
    state.hour = 18.4;
    p.x = 1120; p.y = 800; p.angle = 0;
    stealStagedCar(state, 1120, 800, 0, '#f2a93b', 'Sunset coupe');
    state.wanted = 3;
    state.heat = 64;
    state.police = [
      makePoliceCar(980, 800, 0),
      makePoliceCar(1260, 720, 1),
      makePoliceCar(1120, 620, 2),
    ];
    state.police[0].angle = 0;
    state.police[1].angle = Math.PI;
    state.police[2].angle = Math.PI / 2;
    state.objective = 'M2 — The Getaway: lose the police, reach Midtown';
    state.message = 'WANTED ★★★ — lose the cruisers!';
    state.messageTimer = 99;
    state.traffic = state.traffic.slice(0, 10);
    state.traffic.forEach((c, i) => { c.x = 800 + i * 160; c.y = 800 + (i % 2 ? 16 : -16); c.angle = 0; });
  } else if (shot === 'drive') {
    // Midday drive through Downtown in traffic, pedestrians on the sidewalks.
    state.hour = 11.2;
    p.x = 800; p.y = 480; p.angle = 0;
    stealStagedCar(state, 800, 480, 0, '#3a6fd8', 'Meridian sedan');
    state.wanted = 0;
    state.heat = 0;
    state.police = [];
    state.objective = 'Free roam — explore Port Meridian';
    state.message = 'Cruising the city — press E to leave the car';
    state.messageTimer = 99;
    const rng = makeRng(7);
    state.traffic = [];
    for (let i = 0; i < 12; i += 1) {
      const c = makeTrafficCar(state.city, rng, i);
      c.x = 480 + i * 170;
      c.y = 480 + (i % 2 ? 16 : -16);
      c.angle = i % 2 ? Math.PI : 0;
      c.speed = 70;
      state.traffic.push(c);
    }
    state.peds = [];
    for (let i = 0; i < 10; i += 1) {
      const ped = makePedestrian(state.city, rng, i);
      ped.x = 560 + i * 150;
      ped.y = 480 + (i % 2 ? 60 : -60);
      state.peds.push(ped);
    }
  } else if (shot === 'mission') {
    // On foot at the South Docks pier: Mara's dialogue + Kroll's crew + objective.
    state.hour = 16.5;
    p.x = 480; p.y = 1620; p.angle = -Math.PI / 2;
    p.inCar = null;
    p.onFoot = true;
    state.wanted = 1;
    state.heat = 24;
    state.police = [makePoliceCar(800, 1440, 0)];
    startMission(state, 2);
    state.mission.stage = 1;
    state.objective = 'M3 — Harbour Lights: drive off Kroll’s crew (defeat all 4)';
    state.dialogue = {
      lines: [{ who: 'Mara Voss', text: 'Kroll thinks the docks are his because he owns a boat and a bad suit. Prove him wrong.' }],
      index: 0,
    };
    state.message = 'MISSION M3 — clear the pier!';
    state.messageTimer = 99;
    spawnMissionEnemies(state);
    state.enemies.forEach((e, i) => {
      e.x = 420 + i * 60;
      e.y = 1760 - (i % 2) * 40;
    });
    state.traffic = state.traffic.slice(0, 6);
  } else if (shot === 'night') {
    // Night city: neon windows, headlights, 2 stars, rain of light on wet roads.
    state.hour = 22.3;
    p.x = 1440; p.y = 1120; p.angle = Math.PI / 2;
    stealStagedCar(state, 1440, 1120, Math.PI / 2, '#e86a9a', 'Coral convertible');
    state.wanted = 2;
    state.heat = 44;
    state.police = [makePoliceCar(1440, 880, 0), makePoliceCar(1680, 1120, 1)];
    state.police[0].angle = Math.PI / 2;
    state.police[1].angle = Math.PI;
    state.objective = 'Night run — reach the lighthouse, lose the heat';
    state.message = 'NIGHT — headlights on, neon city';
    state.messageTimer = 99;
    const rng = makeRng(21);
    state.traffic = [];
    for (let i = 0; i < 9; i += 1) {
      const c = makeTrafficCar(state.city, rng, i);
      c.x = 1440 + (i % 3 - 1) * 320;
      c.y = 800 + i * 90;
      c.angle = Math.PI / 2;
      state.traffic.push(c);
    }
  }
  // Settle the camera on the player right away.
  state.camera.x = (p.inCar ? p.inCar.x : p.x) - state.viewW / 2;
  state.camera.y = (p.inCar ? p.inCar.y : p.y) - state.viewH / 2;
}

function stealStagedCar(state, x, y, angle, color, model) {
  const car = {
    kind: 'player-car', id: 'staged', model, color,
    len: 50, wid: 23, x, y, angle, speed: 120, maxSpeed: 430,
    health: 92, smoke: 0, brakeLight: false, driver: false,
  };
  state.player.inCar = car;
  state.player.onFoot = false;
  state.player.x = x;
  state.player.y = y;
  state.ownedCars = [car];
}
