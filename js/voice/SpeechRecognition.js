/**
 * VoiceInput / SpeechRecognition 모듈
 * - 엔진 교체가 가능하도록 공통 인터페이스를 둔다.
 *   start(), stop(), isSupported, 콜백: onInterim(text), onFinal(text), onError(code, msg), onStateChange(listening)
 * - 기본 구현: 브라우저 Web Speech API (Android Chrome 우선)
 */

const ERROR_MESSAGES = {
  'not-allowed': '마이크 권한이 거부됐어요. 브라우저 설정에서 마이크를 허용해 주세요.',
  'service-not-allowed': '이 환경에서는 음성 인식을 쓸 수 없어요. 아래 입력창을 이용해 주세요.',
  'no-speech': '말소리가 안 들렸어요. 다시 눌러서 말해 주세요.',
  'audio-capture': '마이크를 찾을 수 없어요.',
  'network': '음성 인식 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
  'aborted': '',
  'unsupported': '이 브라우저는 음성 인식을 지원하지 않아요. Android Chrome을 권장해요. 아래 입력창은 쓸 수 있어요.',
};

export class WebSpeechInput {
  constructor({ lang = 'ko-KR' } = {}) {
    const Ctor = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    this.isSupported = Boolean(Ctor);
    this.listening = false;
    this.onInterim = () => {};
    this.onFinal = () => {};
    this.onError = () => {};
    this.onStateChange = () => {};
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    this._gotFinal = false;

    rec.onstart = () => this._setListening(true);
    rec.onend = () => this._setListening(false);
    rec.onerror = (e) => {
      const msg = ERROR_MESSAGES[e.error] ?? `음성 인식 오류(${e.error}). 다시 시도해 주세요.`;
      if (msg) this.onError(e.error, msg);
    };
    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim) this.onInterim(interim.trim());
      if (final.trim()) {
        this._gotFinal = true;
        this.onFinal(final.trim());
      }
    };
    this._rec = rec;
  }

  _setListening(v) {
    if (this.listening === v) return;
    this.listening = v;
    this.onStateChange(v);
  }

  start() {
    if (!this.isSupported) {
      this.onError('unsupported', ERROR_MESSAGES.unsupported);
      return false;
    }
    if (this.listening) return true;
    try {
      this._gotFinal = false;
      this._rec.start();
      return true;
    } catch (err) {
      // 이미 시작된 상태 등에서 InvalidStateError 발생 가능 → 무시하고 재시도 안내
      this.onError('start-failed', '음성 인식을 시작하지 못했어요. 잠시 후 다시 눌러 주세요.');
      return false;
    }
  }

  stop() {
    if (this._rec && this.listening) {
      try { this._rec.abort(); } catch { /* noop */ }
    }
  }
}

export function createVoiceInput(opts) {
  // 추후 다른 STT 엔진(예: 서버 STT)으로 교체할 때 이 팩토리만 바꾸면 된다.
  return new WebSpeechInput(opts);
}
