export class SFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const length = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  noise(dur, vol, freq, type = 'lowpass', q = 1, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, vol), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  tone(freq, dur, vol, type = 'sine', slideTo = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  shoot(id, gain = 1) {
    if (!this.ctx) return;
    switch (id) {
      case 'rifle':
        this.noise(0.09, 0.3 * gain, 2600, 'lowpass', 0.8, 700);
        this.tone(150, 0.08, 0.14 * gain, 'square', 60);
        break;
      case 'smg':
        this.noise(0.06, 0.23 * gain, 3400, 'lowpass', 0.6, 900);
        this.tone(190, 0.05, 0.09 * gain, 'square', 80);
        break;
      case 'shotgun':
        this.noise(0.26, 0.48 * gain, 1500, 'lowpass', 0.5, 220);
        this.tone(90, 0.22, 0.24 * gain, 'sine', 38);
        break;
      case 'sniper':
        this.noise(0.34, 0.46 * gain, 4600, 'lowpass', 0.9, 320);
        this.tone(130, 0.3, 0.18 * gain, 'sawtooth', 42);
        break;
      default:
        this.noise(0.1, 0.25 * gain, 2200, 'lowpass', 0.7, 600);
    }
  }

  hit(headshot = false) {
    if (!this.ctx) return;
    this.tone(headshot ? 1500 : 1100, 0.045, 0.11, 'triangle', 1800);
    if (headshot) this.tone(2100, 0.08, 0.09, 'sine', 2500, 0.04);
  }

  hurt() {
    if (!this.ctx) return;
    this.noise(0.16, 0.18, 700, 'lowpass', 1, 160);
    this.tone(90, 0.2, 0.16, 'sawtooth', 45);
  }

  heal() {
    this.tone(520, 0.08, 0.05, 'sine', 780);
  }

  swing() {
    this.noise(0.12, 0.12, 1300, 'bandpass', 2.5, 500);
  }

  place() {
    this.tone(240, 0.05, 0.1, 'square', 170);
    this.noise(0.05, 0.08, 1000, 'lowpass');
  }

  breakBlock() {
    this.noise(0.12, 0.2, 1300, 'lowpass', 1, 380);
  }

  reload() {
    this.tone(520, 0.025, 0.06, 'square');
    this.tone(360, 0.03, 0.05, 'square', null, 0.12);
    this.tone(680, 0.025, 0.05, 'square', null, 0.26);
  }

  kill() {
    this.tone(660, 0.08, 0.12, 'triangle');
    this.tone(990, 0.14, 0.12, 'triangle', null, 0.09);
  }

  death() {
    this.tone(300, 0.4, 0.16, 'sawtooth', 60);
    this.noise(0.4, 0.12, 500, 'lowpass', 1, 100);
  }

  pickup() {
    this.tone(740, 0.06, 0.06, 'sine', 990);
  }
}
