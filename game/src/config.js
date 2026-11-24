// Port Meridian — shared tuning, names and palette for the whole game.
// Everything here is original fiction: a made-up harbour city, its districts,
// streets, people and cars. Nothing is borrowed from any commercial game.

export const WORLD_W = 2560;
export const WORLD_H = 1920;
export const ROAD_W = 72;
export const BLOCK = 320;

// Vertical and horizontal road centre lines across the city grid.
export const ROADS_X = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];
export const ROADS_Y = [160, 480, 800, 1120, 1440, 1760];

export const PLAYER_WALK_SPEED = 165;
export const PLAYER_RUN_SPEED = 250;
export const PLAYER_RADIUS = 13;
export const PLAYER_MAX_HEALTH = 100;
export const PISTOL_DAMAGE = 34;
export const PISTOL_RANGE = 420;
export const PISTOL_AMMO_START = 24;

export const CAR_ACCEL = 420;
export const CAR_MAX_SPEED = 430;
export const CAR_REVERSE_SPEED = 160;
export const CAR_TURN = 2.6;
export const CAR_BRAKE = 620;

export const WANTED_MAX = 5;
export const HEAT_PER_STAR = 20;
export const HEAT_DECAY_PER_SEC = 1.6;
export const HEAT_STEAL_CAR = 22;
export const HEAT_SHOOT = 14;
export const HEAT_HIT_PED = 18;
export const HEAT_RAM_POLICE = 12;

export const SAVE_KEY = 'port-meridian-save-v1';

// Colour palette: sun-soaked harbour city, warm asphalt, teal water.
export const COLORS = {
  grass: '#5d8a4a',
  grassDark: '#527c41',
  park: '#4f7d3d',
  sand: '#c9b489',
  water: '#2e7f9e',
  waterDeep: '#256b87',
  road: '#3a3a40',
  roadLine: '#d8c95a',
  sidewalk: '#8d8d94',
  curb: '#6f6f76',
  buildingRoof: '#b08954',
  buildingRoof2: '#7d8aa0',
  buildingRoof3: '#9c6b52',
  buildingWall: '#cbb28a',
  glass: '#9fd8e8',
  hudBg: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f2ead8',
  accent: '#ffcf3f',
  danger: '#ff5346',
  police: '#2f6df6',
  minimapRoad: '#c9c9cf',
};

export const DISTRICTS = [
  { name: 'Old Harbour', x0: 0, y0: 0, x1: 960, y1: 640, tint: '#7fb3c8' },
  { name: 'Downtown', x0: 960, y0: 0, x1: 1760, y1: 960, tint: '#e8c46a' },
  { name: 'North Market', x0: 1760, y0: 0, x1: 2560, y1: 640, tint: '#d98a6a' },
  { name: 'Canal Row', x0: 0, y0: 640, x1: 960, y1: 1280, tint: '#8fc7a0' },
  { name: 'Midtown', x0: 960, y0: 960, x1: 1760, y1: 1920, tint: '#b48fd0' },
  { name: 'South Docks', x0: 0, y0: 1280, x1: 960, y1: 1920, tint: '#6a9fd8' },
  { name: 'The Lanes', x0: 1760, y0: 640, x1: 2560, y1: 1920, tint: '#e0a0b8' },
];

export const STREET_NAMES_X = [
  'Harbour Ave', 'Anchor St', 'Gull St', 'Meridian Blvd',
  'Cobalt Ave', 'Palm Row', 'Foundry St', 'Beacon Ave',
];
export const STREET_NAMES_Y = [
  'Pier Rd', 'Canal St', 'Market Ln', 'Juniper Ave',
  'Sable St', 'Lighthouse Rd',
];

export const CAR_MODELS = [
  { name: 'Plover hatchback', color: '#d84a3a', len: 44, wid: 22 },
  { name: 'Meridian sedan', color: '#3a6fd8', len: 50, wid: 23 },
  { name: 'Dockside van', color: '#e8e4d8', len: 56, wid: 25 },
  { name: 'Sunset coupe', color: '#f2a93b', len: 48, wid: 22 },
  { name: 'Harbour taxi', color: '#f2d13b', len: 50, wid: 23 },
  { name: 'Night taxi', color: '#22242a', len: 48, wid: 22 },
  { name: 'Coral convertible', color: '#e86a9a', len: 47, wid: 22 },
  { name: 'Bay pickup', color: '#4a8a5d', len: 54, wid: 24 },
];

export const PED_NAMES = [
  'Rosa', 'Ben', 'Aiko', 'Sam', 'Lena', 'Marco', 'Priya', 'Tom',
  'Nadia', 'Cole', 'Iris', 'Hugo', 'Maya', 'Felix', 'June', 'Omar',
];

export const CREW = {
  mara: { name: 'Mara Voss', role: 'crew boss', color: '#c94f7c' },
  deke: { name: 'Deke Okafor', role: 'getaway driver', color: '#3f8f6a' },
  luna: { name: 'Luna Reyes', role: 'lookout', color: '#e8b23a' },
  ivan: { name: 'Ivan Kroll', role: 'rival fixer', color: '#7a4fd0' },
};

export const CONTROLS_TEXT = [
  'WASD / Arrows — move / drive',
  'SHIFT — run',
  'E — steal / enter / exit car',
  'SPACE — shoot (on foot)',
  'F — punch',
  'M — mission phone',
  'P / ESC — pause',
  'U — mute sound',
];
