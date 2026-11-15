/**
 * Sfx: 효과음(직접 합성, 파일 없음)과 진동.
 * play('up'|'down'|'max'|'send'|'result')
 */
const VIBE = { up: 30, down: [15, 40, 15], max: [60, 40, 120], result: [30, 30, 30, 30, 80] };

export class Sfx {
  constructor() { this.enabled = true; this.ctx = null; }

  _ctx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  _tone(freq, start, dur, { type = 'sine', gain = 0.16, to = null } = {}) {
    const c = this.ctx, t = c.currentTime + start;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.enabled) return;
    try {
      if (navigator.vibrate && VIBE[name]) navigator.vibrate(VIBE[name]);
      if (!this._ctx()) return;
      if (name === 'up') { this._tone(520, 0, 0.09, { type: 'triangle' }); this._tone(780, 0.08, 0.14, { type: 'triangle' }); }
      else if (name === 'down') { this._tone(620, 0, 0.1, { type: 'triangle' }); this._tone(410, 0.09, 0.16, { type: 'triangle' }); }
      else if (name === 'max') { this._tone(160, 0, 0.35, { type: 'sine', gain: 0.3, to: 50 }); this._tone(660, 0.12, 0.1, { type: 'triangle' }); this._tone(880, 0.22, 0.1, { type: 'triangle' }); this._tone(1320, 0.32, 0.25, { type: 'triangle' }); }
      else if (name === 'send') { this._tone(740, 0, 0.06, { gain: 0.08 }); }
      else if (name === 'result') { [523, 659, 784, 1047].forEach((f, i) => this._tone(f, i * 0.11, 0.2, { type: 'triangle' })); }
    } catch { /* 소리를 낼 수 없는 환경 */ }
  }
}
