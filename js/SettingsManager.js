// SettingsManager: 사용자 설정을 Local Storage에 저장 (회원가입·서버 없음)
const KEY = 'goopsin.settings.v1';

export const DEFAULT_SETTINGS = {
  voiceURI: '',
  rate: 1.0,         // 단계별 속도에 곱해지는 배율
  pitch: 1.0,        // 단계별 음높이에 곱해지는 배율
  autoListen: true,  // AI가 말한 뒤 자동으로 다시 듣기
  sfx: true,         // 효과음과 진동
  seenGuide: false,  // 처음 사용 안내를 봤는지
  fullStages: false, // 5단계 전체 미리보기 (무료 버전 기본은 3단계)
};

export class SettingsManager {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.values = { ...DEFAULT_SETTINGS, ...this._load() };
    this.listeners = new Set();
  }
  _load() {
    try { return JSON.parse(this.storage?.getItem(KEY) || '{}'); } catch { return {}; }
  }
  get(k) { return this.values[k]; }
  set(k, v) {
    this.values[k] = v;
    try { this.storage?.setItem(KEY, JSON.stringify(this.values)); } catch { /* 저장 불가 환경 */ }
    this.listeners.forEach((fn) => fn(k, v));
  }
  onChange(fn) { this.listeners.add(fn); }
}
