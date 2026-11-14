/**
 * SpeechOutput (TTS) 모듈
 * 공통 인터페이스: speak(text, {rate, pitch, volume}) → Promise(끝나면 resolve), cancel(), isSupported, listVoices()
 * 기본 구현: 기기 내장 음성(Web Speech Synthesis). 추후 감정형 외부 TTS로 교체 가능.
 */

export class WebSpeechOutput {
  constructor({ lang = 'ko-KR' } = {}) {
    this.lang = lang;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.isSupported = Boolean(this.synth && window.SpeechSynthesisUtterance);
    this.voiceURI = '';
    this._voices = [];
    this._token = 0;
    if (this.isSupported) {
      this._loadVoices();
      this.synth.addEventListener?.('voiceschanged', () => this._loadVoices());
    }
  }

  _loadVoices() {
    this._voices = this.synth.getVoices();
  }

  /** 한국어 음성 목록 */
  listVoices() {
    if (!this.isSupported) return [];
    if (!this._voices.length) this._loadVoices();
    return this._voices.filter((v) => (v.lang || '').toLowerCase().replace('_', '-').startsWith('ko'));
  }

  _pickVoice() {
    const ko = this.listVoices();
    return ko.find((v) => v.voiceURI === this.voiceURI) || ko.find((v) => v.localService) || ko[0] || null;
  }

  get speaking() {
    return this.isSupported && (this.synth.speaking || this.synth.pending);
  }

  cancel() {
    if (!this.isSupported) return;
    this._token++;
    this.synth.cancel();
  }

  /**
   * 대사를 말한다. 이전 음성은 끊고(중복 재생 방지) 새로 말한다.
   * @returns {Promise<void>} 말하기가 끝나거나 끊기면 resolve
   */
  speak(text, { rate = 1, pitch = 1, volume = 1 } = {}) {
    if (!this.isSupported || !text) return Promise.resolve();
    this.cancel();
    const token = this._token;
    return new Promise((resolve) => {
      // Chrome: cancel 직후 바로 speak하면 무시되는 경우가 있어 약간 지연
      setTimeout(() => {
        if (token !== this._token) return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = this.lang;
        const voice = this._pickVoice();
        if (voice) u.voice = voice;
        u.rate = clamp(rate, 0.5, 2);
        u.pitch = clamp(pitch, 0, 2);
        u.volume = clamp(volume, 0, 1);
        let done = false;
        const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
        u.onend = finish;
        u.onerror = finish;
        // 일부 기기에서 onend가 오지 않는 문제 대비 안전 타이머
        const guard = setTimeout(finish, 2500 + text.length * 260 / u.rate);
        this.synth.speak(u);
      }, 60);
    });
  }
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

export function createSpeechOutput(opts) {
  // 추후 감정형 TTS 엔진 교체 지점
  return new WebSpeechOutput(opts);
}
