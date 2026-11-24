// Synthesized sound for Port Meridian: engine hum, police siren, gunshots,
// pickups and a looping bass-led street groove. Everything is generated with
// WebAudio oscillators — no audio files, no network.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
      this.startMusic();
      this.started = true;
      return true;
    } catch (err) {
      this.ctx = null;
      return false;
    }
  }

  setEngine(speed, driving) {
    if (!this.ctx || this.muted) return;
    const target = driving ? 0.045 + Math.min(0.09, Math.abs(speed) / 430 * 0.09) : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    this.engineOsc.frequency.setTargetAtTime(52 + Math.abs(speed) * 0.22, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenOn = on;
    const target = on && !this.muted ? 0.035 : 0;
    this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
    if (on) this.wailSiren();
  }

  wailSiren() {
    if (!this.ctx || !this.sirenOn) return;
    const now = this.ctx.currentTime;
    this.sirenOsc.frequency.cancelScheduledValues(now);
    this.sirenOsc.frequency.setValueAtTime(660, now);
    this.sirenOsc.frequency.linearRampToValueAtTime(920, now + 0.45);
    this.sirenOsc.frequency.linearRampToValueAtTime(660, now + 0.9);
    setTimeout(() => this.wailSiren(), 900);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  shot() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = 0.14;
    const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.22;
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t);
    this.blip(180, 0.08, 'square', 0.1);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.1);
    setTimeout(() => this.blip(990, 0.12, 'sine', 0.1), 90);
  }

  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.16, 'triangle', 0.12), i * 110));
  }

  fail() {
    const notes = [392, 330, 262];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'sawtooth', 0.08), i * 150));
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      this.engineGain.gain.value = 0;
      this.sirenGain.gain.value = 0;
    }
    return this.muted;
  }

  // A slow street groove: bass line + soft hats, scheduled step by step.
  startMusic() {
    if (this.musicTimer) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const note = bass[this.musicStep % bass.length];
      this.musicStep += 1;
      if (note > 0) this.blip(note, 0.22, 'triangle', 0.05);
      if (this.musicStep % 2 === 0) this.blip(6000, 0.03, 'square', 0.012);
    }, 210);
  }
}
