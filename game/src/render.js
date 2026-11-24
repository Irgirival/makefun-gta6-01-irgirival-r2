// All drawing for Port Meridian: the city, vehicles, people, particles,
// day/night light, the HUD with its live minimap, dialogue and menus.

import {
  WORLD_W, WORLD_H, ROAD_W, ROADS_X, ROADS_Y, COLORS, DISTRICTS,
  PLAYER_MAX_HEALTH,
} from './config.js';
import { districtAt, streetAt } from './world.js';

export function daylightFactor(hour) {
  // 1.0 at noon, 0.25 deep at night.
  if (hour >= 7 && hour <= 17) return 1.0;
  if (hour >= 18 && hour <= 19) return 0.55;
  if (hour >= 5 && hour < 7) return 0.6;
  if (hour >= 20 || hour < 5) return 0.28;
  return 0.8;
}

export function drawCity(ctx, city, cam, vw, vh, hour, time) {
  const light = daylightFactor(hour);
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(cam.x, cam.y, vw, vh);
  // District tint washes.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.tint + '22';
    ctx.fillRect(d.x0 - cam.x, d.y0 - cam.y, d.x1 - d.x0, d.y1 - d.y0);
  }
  drawWater(ctx, cam);
  drawParks(ctx, city, cam);
  drawRoads(ctx, cam, vw, vh);
  drawBuildings(ctx, city, cam, light);
  drawTrees(ctx, city, cam);
  drawLamps(ctx, city, cam, light, time);
  drawBoats(ctx, city, cam, time);
  drawHydrants(ctx, city, cam);
  if (light < 0.6) {
    ctx.fillStyle = `rgba(8, 12, 34, ${(0.6 - light) * 0.75})`;
    ctx.fillRect(cam.x, cam.y, vw, vh);
  }
}

function drawWater(ctx, cam) {
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(-cam.x, -cam.y, 96, WORLD_H);
  ctx.fillStyle = COLORS.waterDeep;
  ctx.fillRect(78 - cam.x, -cam.y, 18, WORLD_H);
  ctx.fillStyle = '#c9b489';
  ctx.fillRect(96 - cam.x, -cam.y, 10, WORLD_H);
  // Piers jutting into the harbour.
  for (let i = 0; i < 4; i += 1) {
    const y = 300 + i * 420;
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-cam.x, y - cam.y, 96, 26);
  }
}

function drawParks(ctx, city, cam) {
  for (const p of city.parks) {
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
    ctx.strokeStyle = '#3d6b30';
    ctx.lineWidth = 3;
    ctx.strokeRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
    ctx.fillStyle = '#7fb069';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2 - cam.x, p.y + p.h / 2 - cam.y, p.w * 0.22, p.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoads(ctx, cam, vw, vh) {
  ctx.fillStyle = COLORS.road;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD_H);
  for (const ry of ROADS_Y) ctx.fillRect(-cam.x, ry - ROAD_W / 2 - cam.y, WORLD_W, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = COLORS.sidewalk;
  for (const rx of ROADS_X) {
    ctx.fillRect(rx - ROAD_W / 2 - 10 - cam.x, -cam.y, 10, WORLD_H);
    ctx.fillRect(rx + ROAD_W / 2 - cam.x, -cam.y, 10, WORLD_H);
  }
  for (const ry of ROADS_Y) {
    ctx.fillRect(-cam.x, ry - ROAD_W / 2 - 10 - cam.y, WORLD_W, 10);
    ctx.fillRect(-cam.x, ry + ROAD_W / 2 - cam.y, WORLD_W, 10);
  }
  // Centre dashes.
  ctx.fillStyle = COLORS.roadLine;
  for (const rx of ROADS_X) {
    for (let y = 0; y < WORLD_H; y += 64) {
      if (isJunction(rx, y)) continue;
      ctx.fillRect(rx - 2 - cam.x, y - cam.y, 4, 30);
    }
  }
  for (const ry of ROADS_Y) {
    for (let x = 0; x < WORLD_W; x += 64) {
      if (isJunction(x, ry)) continue;
      ctx.fillRect(x - cam.x, ry - 2 - cam.y, 30, 4);
    }
  }
  // Crosswalks at junctions.
  ctx.fillStyle = 'rgba(240,240,235,0.85)';
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(rx + i * 10 - 3 - cam.x, ry - ROAD_W / 2 - 8 - cam.y, 6, 10);
        ctx.fillRect(rx + i * 10 - 3 - cam.x, ry + ROAD_W / 2 - 2 - cam.y, 6, 10);
      }
    }
  }
}

function isJunction(x, y) {
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      if (Math.abs(x - rx) < 40 && Math.abs(y - ry) < 40) return true;
    }
  }
  return false;
}

function drawBuildings(ctx, city, cam, light) {
  for (const b of city.buildings) {
    const sx = b.x - cam.x;
    const sy = b.y - cam.y;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(sx + 6, sy + 8, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(sx, sy, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(sx + 4, sy + 4, b.w - 8, b.h - 8);
    // Windows.
    ctx.fillStyle = light < 0.6 ? '#ffd76a' : COLORS.glass;
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if ((c * 7 + r * 3 + b.floors) % 3 === 0) continue;
        ctx.fillRect(sx + 8 + c * ((b.w - 16) / cols), sy + 8 + r * ((b.h - 16) / rows), 10, 8);
      }
    }
    if (b.label) {
      ctx.fillStyle = '#20242c';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, sx + b.w / 2, sy + b.h / 2 + 4);
    }
    if (b.kind === 'tower') {
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      ctx.beginPath();
      ctx.arc(sx + b.w / 2, sy + 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTrees(ctx, city, cam) {
  for (const t of city.trees) {
    ctx.fillStyle = '#2f6b2f';
    ctx.beginPath();
    ctx.arc(t.x - cam.x, t.y - cam.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a8a3f';
    ctx.beginPath();
    ctx.arc(t.x - cam.x - 3, t.y - cam.y - 3, t.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLamps(ctx, city, cam, light, time) {
  for (const l of city.lamps) {
    ctx.fillStyle = '#3c4048';
    ctx.fillRect(l.x - cam.x - 2, l.y - cam.y - 2, 4, 4);
    if (light < 0.6) {
      const glow = 0.5 + 0.2 * Math.sin(time * 2 + l.x);
      ctx.fillStyle = `rgba(255, 214, 110, ${glow})`;
      ctx.beginPath();
      ctx.arc(l.x - cam.x, l.y - cam.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBoats(ctx, city, cam, time) {
  for (const b of city.boats) {
    const bob = Math.sin(time * 0.8 + b.y) * 3;
    ctx.fillStyle = '#e8e4d8';
    ctx.fillRect(b.x - cam.x, b.y + bob - cam.y, b.len, 14);
    ctx.fillStyle = '#d84a3a';
    ctx.fillRect(b.x + 8 - cam.x, b.y + bob - 8 - cam.y, 18, 8);
  }
}

function drawHydrants(ctx, city, cam) {
  for (const h of city.hydrants) {
    ctx.fillStyle = '#d83a2e';
    ctx.fillRect(h.x - cam.x - 3, h.y - cam.y - 5, 6, 10);
  }
}

export function drawCar(ctx, car, cam, time) {
  const sx = car.x - cam.x;
  const sy = car.y - cam.y;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 7);
  ctx.fill();
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(-car.len * 0.18, -car.wid / 2 + 3, car.len * 0.34, car.wid - 6);
  ctx.fillStyle = 'rgba(160,220,240,0.7)';
  ctx.fillRect(-car.len * 0.14, -car.wid / 2 + 4, car.len * 0.12, car.wid - 8);
  ctx.fillStyle = car.brakeLight ? '#ff2e2e' : '#a33';
  ctx.fillRect(-car.len / 2, -car.wid / 2 + 2, 3, 5);
  ctx.fillRect(-car.len / 2, car.wid / 2 - 7, 3, 5);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(car.len / 2 - 3, -car.wid / 2 + 2, 3, 5);
  ctx.fillRect(car.len / 2 - 3, car.wid / 2 - 7, 3, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-car.len * 0.28, -car.wid / 2, car.len * 0.22, car.wid);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2f6df6';
    ctx.beginPath();
    ctx.arc(-4, -car.wid / 2 - 1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#2f6df6' : '#ff2e2e';
    ctx.beginPath();
    ctx.arc(4, -car.wid / 2 - 1, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.smoke > 0.4) {
    ctx.fillStyle = 'rgba(120,120,120,0.6)';
    ctx.beginPath();
    ctx.arc(-car.len / 2 - 6, 0, 6 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPerson(ctx, p, cam, isPlayer) {
  const sx = p.x - cam.x;
  const sy = p.y - cam.y;
  const bob = p.moving ? Math.sin((p.walkPhase || 0)) * 1.5 : 0;
  ctx.save();
  ctx.translate(sx, sy + bob);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 9, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.strokeStyle = '#2c3240';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-4, 10);
  ctx.moveTo(0, 2);
  ctx.lineTo(4, 10);
  ctx.stroke();
  // Body.
  ctx.fillStyle = isPlayer ? '#e8b23a' : (p.shirt || '#888');
  ctx.beginPath();
  ctx.arc(0, -2, 9, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, -14, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isPlayer ? '#20242c' : '#3a2c1c';
  ctx.beginPath();
  ctx.arc(0, -16, 6, Math.PI, 0);
  ctx.fill();
  // Facing gun / punch arm.
  if (isPlayer) {
    ctx.strokeStyle = '#e8b98a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(Math.cos(p.angle) * 14, -4 + Math.sin(p.angle) * 14);
    ctx.stroke();
  }
  ctx.restore();
  if (isPlayer) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', sx, sy - 26);
  }
}

export function drawBullets(ctx, bullets, cam) {
  ctx.fillStyle = '#ffe066';
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawParticles(ctx, parts, cam) {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cam.x, p.y - cam.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawObjectiveMarker(ctx, stage, cam, time) {
  if (!stage) return;
  const sx = stage.x - cam.x;
  const sy = stage.y - cam.y;
  const pulse = 1 + 0.15 * Math.sin(time * 4);
  ctx.strokeStyle = '#ffcf3f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(sx, sy, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffcf3f';
  ctx.beginPath();
  ctx.moveTo(sx, sy - 34 * pulse);
  ctx.lineTo(sx - 8, sy - 20);
  ctx.lineTo(sx + 8, sy - 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffcf3f';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('▼ OBJECTIVE', sx, sy - 44);
}

export function drawHeadlights(ctx, cars, player, cam, hour) {
  if (daylightFactor(hour) >= 0.6) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const all = cars.slice();
  if (player.inCar) all.push(player.inCar);
  for (const car of all) {
    const sx = car.x - cam.x;
    const sy = car.y - cam.y;
    const grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, 130);
    grad.addColorStop(0, 'rgba(255, 230, 150, 0.20)');
    grad.addColorStop(1, 'rgba(255, 230, 150, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx + Math.cos(car.angle) * 60, sy + Math.sin(car.angle) * 60, 130, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHud(ctx, state, vw, vh) {
  const p = state.player;
  // Top-left status panel.
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('PORT MERIDIAN', 24, 34);
  ctx.font = '13px Arial';
  ctx.fillStyle = '#9fb3c8';
  const district = districtAt(p.inCar ? p.inCar.x : p.x, p.inCar ? p.inCar.y : p.y);
  const street = streetAt(p.inCar ? p.inCar.x : p.x, p.inCar ? p.inCar.y : p.y);
  ctx.fillText(district.name + ' • ' + street, 24, 52);
  // Health bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 60, 150, 12);
  ctx.fillStyle = p.health > 50 ? '#4ade80' : p.health > 25 ? '#f2a93b' : '#ff5346';
  ctx.fillRect(24, 60, 150 * Math.max(0, p.health / PLAYER_MAX_HEALTH), 12);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 12px Arial';
  ctx.fillText(Math.ceil(p.health) + ' HP', 182, 70);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('$' + p.cash, 24, 92);
  ctx.fillStyle = '#c9c9cf';
  ctx.font = '12px Arial';
  ctx.fillText('Ammo ' + p.ammo + (p.inCar ? '   •   DRIVING ' + (p.inCar.model || '') : '   •   ON FOOT'), 74, 92);

  // Wanted stars, top centre.
  const cx = vw / 2;
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, cx - 130, 12, 260, 44, 10);
  ctx.fill();
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.wanted ? '#ffcf3f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', cx - 88 + i * 44, 42);
  }
  if (state.wanted > 0) {
    ctx.fillStyle = '#ff8a7a';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(state.wanted >= 3 ? 'POLICE HUNTING YOU' : 'WANTED — LAY LOW', cx, 72);
  }

  // Clock + day/night, top right next to minimap.
  const hh = Math.floor(state.hour);
  const mm = Math.floor((state.hour - hh) * 60);
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, vw - 232, 12, 90, 44, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), vw - 187, 32);
  ctx.font = '11px Arial';
  ctx.fillStyle = '#9fb3c8';
  ctx.fillText(daylightFactor(state.hour) >= 0.6 ? '☀ DAY' : '☾ NIGHT', vw - 187, 48);

  drawMinimap(ctx, state, vw, vh);

  // Objective banner (pushed below the wanted label when the heat is on).
  if (state.objective) {
    const bannerY = state.wanted > 0 ? 100 : 66;
    ctx.fillStyle = 'rgba(12,16,24,0.78)';
    const w = Math.min(560, ctx.measureText(state.objective).width + 120);
    roundRect(ctx, cx - w / 2, bannerY, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffcf3f';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('◆ ' + state.objective, cx, bannerY + 22);
  }

  // Message toast.
  if (state.message && state.messageTimer > 0) {
    ctx.globalAlpha = Math.min(1, state.messageTimer);
    ctx.fillStyle = 'rgba(12,16,24,0.85)';
    const w = Math.min(640, ctx.measureText(state.message).width + 40);
    roundRect(ctx, cx - w / 2, vh - 96, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, cx, vh - 74);
    ctx.globalAlpha = 1;
  }

  // Speedometer when driving.
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.55);
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, vw - 132, vh - 84, 120, 60, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(kmh), vw - 72, vh - 48);
    ctx.font = '11px Arial';
    ctx.fillStyle = '#9fb3c8';
    ctx.fillText('km/h  •  ' + (p.inCar.health > 40 ? 'CAR OK' : 'CAR SMOKING'), vw - 72, vh - 30);
  }

  // Controls hint, bottom left.
  ctx.fillStyle = 'rgba(12,16,24,0.55)';
  roundRect(ctx, 12, vh - 66, 300, 54, 8);
  ctx.fill();
  ctx.fillStyle = '#c9c9cf';
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move/drive   •   E steal car   •   SPACE shoot', 22, vh - 44);
  ctx.fillText('F punch   •   P pause   •   M missions   •   U mute', 22, vh - 26);

  // Dialogue box.
  if (state.dialogue && state.dialogue.index < state.dialogue.lines.length) {
    const line = state.dialogue.lines[state.dialogue.index];
    ctx.fillStyle = 'rgba(10,12,20,0.88)';
    roundRect(ctx, vw / 2 - 330, vh - 178, 660, 66, 10);
    ctx.fill();
    ctx.strokeStyle = '#ffcf3f';
    ctx.lineWidth = 2;
    ctx.strokeRect(vw / 2 - 330, vh - 178, 660, 66);
    ctx.fillStyle = '#ffcf3f';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(line.who.toUpperCase(), vw / 2 - 314, vh - 152);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '14px Arial';
    wrapText(ctx, line.text, vw / 2 - 314, vh - 132, 628, 18);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '11px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('E / ENTER to continue', vw / 2 + 318, vh - 120);
  }
}

function drawMinimap(ctx, state, vw, vh) {
  const mw = 200;
  const mh = 150;
  const mx = vw - mw - 12;
  const my = 68;
  ctx.fillStyle = 'rgba(10,14,22,0.8)';
  roundRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#23301f';
  ctx.fillRect(mx, my, mw, mh);
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.strokeStyle = COLORS.minimapRoad;
  ctx.lineWidth = 2;
  for (const rx of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + mh);
    ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
    ctx.stroke();
  }
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(mx, my, 8, mh);
  const stage = state.mission && state.mission.active
    ? state.mission.def.stages[state.mission.stage] : null;
  if (stage) {
    ctx.fillStyle = '#ffcf3f';
    ctx.beginPath();
    ctx.arc(mx + stage.x * sx, my + stage.y * sy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (const cop of state.police) {
    ctx.fillStyle = '#ff5346';
    ctx.beginPath();
    ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + px * sx, my + py * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffcf3f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#c9c9cf';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('MINIMAP — PORT MERIDIAN', mx, my + mh + 18);
}

export function drawTitle(ctx, state, vw, vh, hasSave) {
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#1b2a4a');
  grad.addColorStop(0.55, '#c96a3a');
  grad.addColorStop(1, '#2a1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);
  // Sun + skyline silhouette.
  ctx.fillStyle = '#ffcf6a';
  ctx.beginPath();
  ctx.arc(vw * 0.88, vh * 0.16, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#141824';
  let x = 0;
  const skyline = [150, 220, 180, 260, 200, 300, 170, 240, 190, 280, 160];
  skyline.forEach((h, i) => {
    ctx.fillRect(x, vh - 190 - h * 0.5, 130, 190 + h * 0.5);
    x += 130;
  });
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 64px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PORT MERIDIAN', vw / 2, vh * 0.3);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px Arial';
  ctx.fillText('— A GETAWAY STORY —', vw / 2, vh * 0.3 + 44);
  ctx.font = '16px Arial';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText('Steal cars. Outrun the police. Run three jobs for Mara Voss’s crew.', vw / 2, vh * 0.3 + 76);
  ctx.fillText('Explore the harbour city on foot and by car — every street is open.', vw / 2, vh * 0.3 + 100);

  const items = [];
  if (hasSave) items.push('CONTINUE  (saved game)');
  items.push('NEW GAME');
  items.push('HOW TO PLAY');
  state.menuItems = items;
  items.forEach((label, i) => {
    const y = vh * 0.52 + i * 56;
    const selected = state.menuIndex === i;
    ctx.fillStyle = selected ? '#ffcf3f' : 'rgba(12,16,24,0.75)';
    roundRect(ctx, vw / 2 - 220, y - 26, 440, 44, 10);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(vw / 2 - 220, y - 26, 440, 44);
    }
    ctx.fillStyle = selected ? '#141824' : '#f2ead8';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(label, vw / 2, y + 6);
  });
  ctx.fillStyle = '#c9c9cf';
  ctx.font = '13px Arial';
  ctx.fillText('↑ ↓ choose  •  ENTER select  •  click a button', vw / 2, vh * 0.52 + items.length * 56 + 8);
  ctx.fillText('An original open-world crime game. No real city, no real gang — all fiction.', vw / 2, vh - 24);
}

export function drawHowTo(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,18,0.92)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffcf3f';
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('HOW TO PLAY', vw / 2, 90);
  const lines = [
    'You are a getaway driver new to Port Meridian. Mara Voss’s crew has three jobs for you.',
    '',
    'WASD / Arrows — walk or drive      SHIFT — run',
    'E — steal the nearest car / get out      SPACE — shoot your pistol',
    'F — punch      M — call Mara / mission phone      P — pause & save',
    '',
    'WANTED STARS rise when you steal cars, shoot, or hit pedestrians.',
    'Police cruisers chase you. Lose them, lay low, and the heat fades.',
    'Get arrested or knocked out and the job fails — you keep your cash.',
    '',
    'Missions pay cash. Finish all three jobs to own the city.',
    'Your game saves automatically after every job — and whenever you pause.',
  ];
  ctx.fillStyle = '#f2ead8';
  ctx.font = '16px Arial';
  lines.forEach((l, i) => ctx.fillText(l, vw / 2, 140 + i * 30));
  ctx.fillStyle = '#ffcf3f';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('Press ENTER or ESC to go back', vw / 2, 140 + lines.length * 30 + 20);
}

export function drawPause(ctx, state, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffcf3f';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 70);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '16px Arial';
  ctx.fillText('Game saved. Cash $' + state.player.cash + '  •  Jobs done: ' + state.missionIndex + ' / 3', vw / 2, vh / 2 - 30);
  ctx.fillText('P / ESC — resume      •      R — restart from save', vw / 2, vh / 2 + 6);
  ctx.fillText('M — mission phone      •      U — mute sound', vw / 2, vh / 2 + 36);
}

export function drawEndScreen(ctx, title, sub, vw, vh) {
  ctx.fillStyle = 'rgba(10,8,14,0.82)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = title === 'BUSTED!' ? '#5aa2ff' : '#ff5346';
  ctx.font = 'bold 54px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, vw / 2, vh / 2 - 30);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '18px Arial';
  ctx.fillText(sub, vw / 2, vh / 2 + 14);
  ctx.fillStyle = '#ffcf3f';
  ctx.font = 'bold 16px Arial';
  ctx.fillText('Press ENTER to keep playing — you wake up at the hospital', vw / 2, vh / 2 + 56);
}

export function drawMissionPhone(ctx, state, vw, vh) {
  ctx.fillStyle = 'rgba(8,10,18,0.8)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#141824';
  roundRect(ctx, vw / 2 - 260, 90, 520, 480, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffcf3f';
  ctx.lineWidth = 2;
  ctx.strokeRect(vw / 2 - 260, 90, 520, 480);
  ctx.fillStyle = '#ffcf3f';
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('📱 MARA’S CREW — JOBS', vw / 2 - 236, 130);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '15px Arial';
  const rows = [
    'M1 — First Job  •  $350  •  ' + (state.missionIndex > 0 ? 'DONE ✓' : state.missionIndex === 0 ? 'READY' : 'LOCKED'),
    'M2 — The Getaway  •  $800  •  ' + (state.missionIndex > 1 ? 'DONE ✓' : state.missionIndex === 1 ? 'READY' : 'LOCKED'),
    'M3 — Harbour Lights  •  $1500  •  ' + (state.missionIndex > 2 ? 'DONE ✓' : state.missionIndex === 2 ? 'READY' : 'LOCKED'),
    '',
    'Cash: $' + state.player.cash + '   •   Jobs done: ' + state.missionIndex + ' / 3',
    'Wanted: ' + state.wanted + '★   •   Health: ' + Math.ceil(state.player.health),
    '',
    'Press ENTER to start the next ready job.',
    'Press M or ESC to close the phone.',
  ];
  rows.forEach((r, i) => ctx.fillText(r, vw / 2 - 236, 170 + i * 30));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
