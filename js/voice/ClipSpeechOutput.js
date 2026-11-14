/**
 * ClipSpeechOutput: 녹음된 음성 파일 우선 재생 + 기기 내장 TTS 대체.
 * SpeechOutput과 같은 인터페이스(speak, cancel, isSupported, listVoices, voiceURI)를 따른다.
 * - audio/<ID>.mp3 가 있으면 그 파일을 재생 (감정 연기된 녹음)
 * - 없거나 재생 실패하면 기존 TTS로 읽음. 실패한 파일은 다시 시도하지 않는다.
 */
import { CLIP_ID_BY_TEXT } from '../data/clips.js';

export class ClipSpeechOutput {
  constructor(fallback, { basePath = 'audio/', ext = 'mp3', idMap = CLIP_ID_BY_TEXT } = {}) {
    this.fallback = fallback;
    this.basePath = basePath;
    this.ext = ext;
    this.idMap = idMap;
    this.missing = new Set();
    this.audio = typeof Audio !== 'undefined' ? new Audio() : null;
    this._token = 0;
    this._resolve = null;
    this.useClips = true;
    this.available = new Set(); // audio/manifest.json 에 적힌 ID만 재생 (없는 파일 요청으로 인한 지연 방지)
  }

  /** audio/manifest.json (예: ["s1_01","s1_02"]) 을 읽어 재생 가능한 파일 목록을 준비 */
  async load() {
    try {
      const res = await fetch(`${this.basePath}manifest.json`, { cache: 'no-cache' });
      if (res.ok) this.available = new Set(await res.json());
    } catch { /* 목록이 없으면 전부 내장 음성 */ }
    return this.available.size;
  }

  get isSupported() { return Boolean(this.audio) || this.fallback.isSupported; }
  get voiceURI() { return this.fallback.voiceURI; }
  set voiceURI(v) { this.fallback.voiceURI = v; }
  listVoices() { return this.fallback.listVoices(); }

  cancel() {
    this._token++;
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); }
    if (this._resolve) { this._resolve(); this._resolve = null; }
    this.fallback.cancel();
  }

  speak(text, opts = {}) {
    this.cancel();
    const id = this.idMap[text];
    if (!this.useClips || !this.audio || !id || !this.available.has(id) || this.missing.has(id)) return this.fallback.speak(text, opts);
    const token = this._token;
    const a = this.audio;
    return new Promise((resolve) => {
      this._resolve = resolve;
      const done = () => { cleanup(); if (this._resolve === resolve) this._resolve = null; resolve(); };
      const fail = () => {
        cleanup();
        this.missing.add(id);
        if (this._resolve === resolve) this._resolve = null;
        if (token !== this._token) return resolve();
        this.fallback.speak(text, opts).then(resolve);
      };
      const cleanup = () => { a.onended = null; a.onerror = null; };
      a.onended = done;
      a.onerror = fail;
      a.src = `${this.basePath}${id}.${this.ext}`;
      a.playbackRate = 1;
      a.volume = 1;
      const p = a.play();
      if (p && p.catch) p.catch((err) => {
        // 자동재생 정책 등으로 막힌 경우: 파일 문제는 아니므로 missing 처리하지 않고 TTS로 대체
        if (err && err.name === 'NotAllowedError') {
          cleanup();
          if (this._resolve === resolve) this._resolve = null;
          if (token !== this._token) return resolve();
          this.fallback.speak(text, opts).then(resolve);
        } else if (a.onerror) fail();
      });
    });
  }
}
