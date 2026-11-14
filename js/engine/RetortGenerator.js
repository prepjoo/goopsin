/**
 * RetortGenerator: 사용자 말 속 단어를 짚어서 되받아친다 (규칙 기반, 무료).
 * 우선순위: 빈도부사(맨날·항상·또…) > 주제어(늦음·연락·설거지…) > 말 그대로 되받기
 * - 빈도부사: 굽신이 가장 예민한 말. 1~3단계에선 항상, 4~5단계에선 70% 확률로 반응
 * - 주제어: 60% 확률
 * - 되받기: 25% 확률, 두 번 연속 금지 (앵무새처럼 들리지 않게)
 * 추후 AI API 기반 생성기로 교체할 수 있도록 extract/generate를 분리했다.
 */
import { FREQ_ADVERBS, ADVERB_RETORTS, TOPICS, TOPIC_RETORTS, ECHO_RETORTS, PROFANITY_STANDIN } from '../data/retorts.js';
import { hasProfanity, normalize } from './EmotionAnalyzer.js';

/** 사용자 말에서 되받아칠 단서 추출 */
export function extractCues(rawText) {
  const text = normalize(rawText);
  let adverb = null;
  for (const a of FREQ_ADVERBS) {
    if (a.re.test(text)) { adverb = { say: a.say, adv: a.adv }; break; }
  }
  let topic = null;
  for (const t of TOPICS) {
    const m = text.match(t.re);
    if (m) { topic = { word: t.word(m), excuses: t.excuses }; break; }
  }
  return { adverb, topic, quote: makeQuote(text) };
}

/** 인용할 말: 문장부호 제거, 길면 뒤쪽 어절만 (최대 14자), 욕설이면 대체 표현 */
export function makeQuote(text) {
  if (!text) return null;
  if (hasProfanity(text)) return PROFANITY_STANDIN;
  const clean = text.replace(/[!?.,~…]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  if (clean.length <= 14) return clean;
  const words = clean.split(' ');
  let out = '';
  for (let i = words.length - 1; i >= 0; i--) {
    const next = out ? `${words[i]} ${out}` : words[i];
    if (next.length > 14) break;
    out = next;
  }
  return out || null;
}

const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

export class RetortGenerator {
  constructor({ rng = Math.random, pick } = {}) {
    this.rng = rng;
    this.pick = pick || ((pool) => pool[Math.floor(this.rng() * pool.length)]);
    this.lastWasEcho = false;
  }

  /**
   * @returns {{text:string, type:'adverb'|'topic'|'echo'}|null}
   */
  generate(stage, cues, kind) {
    if (!cues || (kind !== 'pressure' && kind !== 'neutral')) { this.lastWasEcho = false; return null; }
    const s = Math.min(Math.max(stage, 1), 5);

    if (cues.adverb && (s <= 3 || this.rng() < 0.7)) {
      this.lastWasEcho = false;
      return { type: 'adverb', text: fill(this.pick(ADVERB_RETORTS[s]), cues.adverb) };
    }
    if (kind !== 'pressure') { this.lastWasEcho = false; return null; }

    if (cues.topic && this.rng() < 0.6) {
      this.lastWasEcho = false;
      const pool = s <= 2 ? cues.topic.excuses : TOPIC_RETORTS[s];
      return { type: 'topic', text: fill(this.pick(pool), { t: cues.topic.word }) };
    }
    if (cues.quote && !this.lastWasEcho && this.rng() < 0.25) {
      this.lastWasEcho = true;
      return { type: 'echo', text: fill(this.pick(ECHO_RETORTS[s]), { q: cues.quote }) };
    }
    this.lastWasEcho = false;
    return null;
  }
}
