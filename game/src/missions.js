// The getaway-driver story: three chained missions for Mara Voss's crew in
// Port Meridian. Each mission has dialogue, staged objectives, a payout and
// fail states. The engine below drives them from the shared game state.

export const MISSIONS = [
  {
    id: 'm1',
    title: 'M1 — First Job',
    giver: 'Mara Voss',
    pay: 350,
    brief: 'Mara needs a driver she can trust. Pick up the parcel at the Old Harbour pier and bring it to the Canal Row garage. No sirens, no scratches.',
    intro: [
      { who: 'Mara Voss', text: 'You drive? Good. The crew lost its last driver to a parking ticket and a bad attitude.' },
      { who: 'Mara Voss', text: 'A parcel is waiting on Pier 4, Old Harbour. Bring it to my garage on Canal Row. Quietly.' },
      { who: 'Deke Okafor', text: 'And kid — if the harbour cops light you up, do NOT stop. Ever.' },
    ],
    stages: [
      { type: 'goto', label: 'Go to Pier 4, Old Harbour', x: 130, y: 300, radius: 70 },
      { type: 'pickup', label: 'Pick up the parcel (press E)', x: 130, y: 300, radius: 70 },
      { type: 'goto', label: 'Deliver to the Canal Row garage', x: 480, y: 800, radius: 80 },
    ],
    outro: [
      { who: 'Mara Voss', text: 'Clean run. The parcel was worth more than my first car. You are hired.' },
      { who: 'Mara Voss', text: 'Next job is bigger. Meet Deke at the bank on Meridian Blvd — and bring a fast car.' },
    ],
  },
  {
    id: 'm2',
    title: 'M2 — The Getaway',
    giver: 'Deke Okafor',
    pay: 800,
    brief: 'Deke is walking out of the Meridian Bank with a bag that is not his. Pick him up and lose the police before you reach the Midtown safehouse.',
    intro: [
      { who: 'Deke Okafor', text: 'Two minutes. That is how long the bank alarm gives us before the whole city wakes up.' },
      { who: 'Deke Okafor', text: 'Pick me up outside the bank, then drive like the harbour is on fire. Safehouse is in Midtown.' },
      { who: 'Luna Reyes', text: 'I am on the roof with the radio. Cops are already rolling from the north. Move!' },
    ],
    stages: [
      { type: 'goto', label: 'Reach the Meridian Bank', x: 1120, y: 480, radius: 80 },
      { type: 'pickup', label: 'Pick up Deke (press E near him)', x: 1120, y: 480, radius: 90 },
      { type: 'escape', label: 'Lose the police, then reach the Midtown safehouse', x: 1440, y: 1440, radius: 90, needWanted: 0 },
    ],
    outro: [
      { who: 'Deke Okafor', text: 'Ha! Did you see their faces? That was textbook, kid. Textbook!' },
      { who: 'Mara Voss', text: 'The bag buys us the harbour. One last job tonight — Ivan Kroll is moving in on our turf.' },
    ],
  },
  {
    id: 'm3',
    title: 'M3 — Harbour Lights',
    giver: 'Mara Voss',
    pay: 1500,
    brief: 'Ivan Kroll and his crew are taking the South Docks tonight. Hold the pier, drive them off, then get Mara to the lighthouse before dawn.',
    intro: [
      { who: 'Mara Voss', text: 'Kroll thinks the docks are his because he owns a boat and a bad suit. Prove him wrong.' },
      { who: 'Luna Reyes', text: 'Four of his crew on the pier, all armed. I counted. Well — I counted four, there might be five.' },
      { who: 'Mara Voss', text: 'Clear the pier, then drive me to the lighthouse. When the sun comes up, Port Meridian is ours.' },
    ],
    stages: [
      { type: 'goto', label: 'Reach the South Docks pier', x: 480, y: 1760, radius: 90 },
      { type: 'combat', label: 'Drive off Kroll’s crew (defeat all 4)', x: 480, y: 1760, radius: 200, enemies: 4 },
      { type: 'goto', label: 'Drive Mara to the lighthouse', x: 2400, y: 160, radius: 90 },
    ],
    outro: [
      { who: 'Mara Voss', text: 'The sun is up, the docks are ours, and Kroll is swimming home. You did that.' },
      { who: 'Mara Voss', text: 'Port Meridian remembers its drivers. Welcome to the crew — for good.' },
    ],
  },
];

export function missionByIndex(i) {
  return MISSIONS[i] || null;
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  state.missionIndex = index;
  state.mission = {
    def, stage: 0, active: true, failed: false, done: false,
    enemiesLeft: 0, pickedUp: false, escapeTimer: 0,
  };
  state.dialogue = { lines: def.intro.slice(), index: 0 };
  state.objective = def.stages[0].label;
  state.message = def.title + ' — ' + def.brief;
  state.messageTimer = 6;
  return true;
}

export function currentStage(state) {
  if (!state.mission || !state.mission.active) return null;
  return state.mission.def.stages[state.mission.stage] || null;
}

export function advanceStage(state) {
  const m = state.mission;
  if (!m) return;
  m.stage += 1;
  m.pickedUp = false;
  if (m.stage >= m.def.stages.length) {
    completeMission(state);
    return;
  }
  state.objective = m.def.stages[m.stage].label;
  state.message = 'Objective: ' + state.objective;
  state.messageTimer = 4;
}

export function completeMission(state) {
  const m = state.mission;
  if (!m) return;
  m.active = false;
  m.done = true;
  state.player.cash += m.def.pay;
  state.cashEarned = (state.cashEarned || 0) + m.def.pay;
  state.dialogue = { lines: m.def.outro.slice(), index: 0 };
  state.message = 'MISSION COMPLETE — earned $' + m.def.pay;
  state.messageTimer = 5;
  state.missionIndex += 1;
  state.mission = null;
  state.objective = state.missionIndex < MISSIONS.length
    ? 'Next job ready — press M to call Mara'
    : 'All jobs done — Port Meridian is yours. Free roam!';
  state.saveDirty = true;
}

export function failMission(state, reason) {
  const m = state.mission;
  if (!m) return;
  m.active = false;
  m.failed = true;
  state.dialogue = { lines: [{ who: 'Mara Voss', text: reason + ' The job is blown — call me when you are ready to try again.' }], index: 0 };
  state.message = 'MISSION FAILED — ' + reason;
  state.messageTimer = 5;
  state.mission = null;
  state.objective = 'Job failed — press M to retry the mission';
  state.saveDirty = true;
}

export function updateMission(state, dt) {
  const m = state.mission;
  if (!m || !m.active) return;
  const stage = currentStage(state);
  if (!stage) return;
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const dist = Math.hypot(px - stage.x, py - stage.y);

  if (stage.type === 'goto') {
    if (dist < stage.radius) advanceStage(state);
  } else if (stage.type === 'pickup') {
    if (dist < stage.radius && !m.pickedUp) {
      state.objective = stage.label + ' — press E';
      if (state.consumeInteract) {
        state.consumeInteract = false;
        m.pickedUp = true;
        state.message = 'Got it. Move!';
        state.messageTimer = 2.5;
        advanceStage(state);
      }
    }
  } else if (stage.type === 'escape') {
    if (dist < stage.radius && state.wanted === 0) advanceStage(state);
    else if (dist < stage.radius && state.wanted > 0) {
      state.objective = 'Lose the police first! (wanted: ' + state.wanted + '★)';
    } else {
      state.objective = stage.label;
    }
  } else if (stage.type === 'combat') {
    if (m.enemiesLeft <= 0 && state.enemies.length === 0) advanceStage(state);
  }
}

export function spawnMissionEnemies(state) {
  const stage = currentStage(state);
  if (!stage || stage.type !== 'combat') return;
  const count = stage.enemies || 4;
  state.mission.enemiesLeft = count;
  state.enemies = [];
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    state.enemies.push({
      kind: 'rival', name: 'Kroll crew',
      x: stage.x + Math.cos(a) * 110, y: stage.y + Math.sin(a) * 110,
      angle: 0, speed: 55, health: 68, shootCooldown: 1 + i * 0.4,
      color: '#7a4fd0', shirt: '#5a3aa0',
    });
  }
  state.message = 'Kroll’s crew is on the pier — take them down!';
  state.messageTimer = 4;
}
