// Port Meridian city generation: a road grid, blocks full of buildings,
// parks, a harbour strip, district lookup and collision helpers.

import {
  WORLD_W, WORLD_H, ROAD_W, ROADS_X, ROADS_Y, DISTRICTS,
  STREET_NAMES_X, STREET_NAMES_Y,
} from './config.js';
import { makeRng, range, rangeInt, pick, chance } from './random.js';

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const lamps = [];
  const hydrants = [];

  for (let ix = 0; ix < ROADS_X.length - 1; ix += 1) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy += 1) {
      const x0 = ROADS_X[ix] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[ix + 1] - ROAD_W / 2 - 14;
      const y0 = ROADS_Y[iy] + ROAD_W / 2 + 14;
      const y1 = ROADS_Y[iy + 1] - ROAD_W / 2 - 14;
      if (chance(rng, 0.16)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 9, 15) });
        }
        continue;
      }
      const cols = rangeInt(rng, 1, 2);
      const rows = rangeInt(rng, 1, 2);
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const pad = 12;
          const bw = cw - pad * 2 - range(rng, 0, 26);
          const bh = ch - pad * 2 - range(rng, 0, 26);
          const bx = x0 + c * cw + pad + range(rng, 0, 10);
          const by = y0 + r * ch + pad + range(rng, 0, 10);
          const kind = pick(rng, ['shop', 'house', 'tower', 'house', 'shop']);
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            kind,
            roof: pick(rng, ['#b08954', '#7d8aa0', '#9c6b52', '#6a7d5a', '#a08a6a']),
            wall: pick(rng, ['#cbb28a', '#d8c9a8', '#b8a88e', '#c9b8a0']),
            floors: kind === 'tower' ? rangeInt(rng, 4, 7) : rangeInt(rng, 1, 2),
            label: kind === 'shop' ? pick(rng, ['CAFE', 'MARKET', 'GARAGE', 'PIZZA', 'LAUNDRY', 'BAR', 'TACKLE', 'BOOKS']) : '',
          });
        }
      }
      if (chance(rng, 0.7)) {
        trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), r: range(rng, 9, 14) });
      }
    }
  }

  // Street lamps along every road, hydrants near corners.
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      lamps.push({ x: rx + ROAD_W / 2 + 6, y: ry - ROAD_W / 2 - 6 });
      lamps.push({ x: rx - ROAD_W / 2 - 6, y: ry + ROAD_W / 2 + 6 });
    }
  }
  for (let i = 0; i < 26; i += 1) {
    hydrants.push({
      x: pick(rng, ROADS_X) + (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 8),
      y: pick(rng, ROADS_Y) + range(rng, -140, 140),
    });
  }

  // The harbour: water along the west edge with piers and boats.
  const boats = [];
  for (let i = 0; i < 6; i += 1) {
    boats.push({ x: range(rng, 18, 62), y: 220 + i * 260 + range(rng, -40, 40), len: range(rng, 46, 70) });
  }

  return { seed, buildings, parks, trees, lamps, hydrants, boats };
}

export function onRoad(x, y) {
  const half = ROAD_W / 2;
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= half) return true;
  return false;
}

export function nearestRoadX(x) {
  let best = ROADS_X[0];
  for (const rx of ROADS_X) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}

export function nearestRoadY(y) {
  let best = ROADS_Y[0];
  for (const ry of ROADS_Y) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[4];
}

export function streetAt(x, y) {
  let xi = 0;
  let best = Infinity;
  ROADS_X.forEach((rx, i) => {
    const d = Math.abs(rx - x);
    if (d < best) { best = d; xi = i; }
  });
  let yi = 0;
  best = Infinity;
  ROADS_Y.forEach((ry, i) => {
    const d = Math.abs(ry - y);
    if (d < best) { best = d; yi = i; }
  });
  const vertical = Math.abs(ROADS_X[xi] - x) <= Math.abs(ROADS_Y[yi] - y);
  return vertical ? STREET_NAMES_X[xi] : STREET_NAMES_Y[yi];
}

export function collideBuildings(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) {
      return b;
    }
  }
  return null;
}

export function resolveBuildingCollision(city, pos, radius) {
  const b = collideBuildings(city, pos.x, pos.y, radius);
  if (!b) return;
  const left = pos.x - (b.x - radius);
  const right = (b.x + b.w + radius) - pos.x;
  const top = pos.y - (b.y - radius);
  const bottom = (b.y + b.h + radius) - pos.y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) pos.x = b.x - radius;
  else if (min === right) pos.x = b.x + b.w + radius;
  else if (min === top) pos.y = b.y - radius;
  else pos.y = b.y + b.h + radius;
}

export function clampToWorld(pos, margin) {
  pos.x = Math.max(margin, Math.min(WORLD_W - margin, pos.x));
  pos.y = Math.max(margin, Math.min(WORLD_H - margin, pos.y));
}

export function randomRoadPoint(rng) {
  if (chance(rng, 0.5)) {
    return { x: pick(rng, ROADS_X), y: range(rng, 120, WORLD_H - 120), vertical: true };
  }
  return { x: range(rng, 120, WORLD_W - 120), y: pick(rng, ROADS_Y), vertical: false };
}
