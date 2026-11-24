// Keyboard input: held keys, plus edge-triggered "just pressed" actions so
// a single key tap steals a car, fires once, or opens a menu.

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'shoot',
  KeyF: 'punch',
  KeyE: 'interact',
  KeyM: 'phone',
  KeyP: 'pause', Escape: 'pause',
  KeyU: 'mute',
  Enter: 'confirm',
};

export class Input {
  constructor() {
    this.held = {};
    this.pressed = {};
    this.anyKey = false;
    this.onKeyDown = (e) => {
      const name = KEYMAP[e.code];
      if (!name) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.held[name]) this.pressed[name] = true;
      this.held[name] = true;
      this.anyKey = true;
    };
    this.onKeyUp = (e) => {
      const name = KEYMAP[e.code];
      if (!name) return;
      this.held[name] = false;
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  get up() { return !!this.held.up; }
  get down() { return !!this.held.down; }
  get left() { return !!this.held.left; }
  get right() { return !!this.held.right; }
  get run() { return !!this.held.run; }
  get shoot() { return !!this.held.shoot; }

  wasPressed(name) {
    return !!this.pressed[name];
  }

  endFrame() {
    this.pressed = {};
  }
}
