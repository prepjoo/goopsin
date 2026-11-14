/**
 * EmotionEngine: 단계별 감정 연기를 결정한다.
 * - 5단계에서는 세 가지 연기 스타일(울먹/다급/비굴)을 섞어 매번 다르게 한다.
 * - 결과는 TTS 엔진 독립적인 "연기 지시"(rate, pitch, volume, mood)로 내보낸다.
 *   감정형 외부 TTS로 교체할 때는 mood/style 값을 그 엔진의 감정 파라미터로 매핑하면 된다.
 */
import { STAGES, STAGE5_STYLES } from '../data/lines.js';

export const VOICE_BY_STAGE = {
  1: { rate: 1.15, pitch: 1.10, volume: 1.0, mood: 'cocky' },     // 당당·빠름·비꼼
  2: { rate: 1.05, pitch: 1.00, volume: 1.0, mood: 'annoyed' },   // 짜증
  3: { rate: 0.85, pitch: 0.95, volume: 0.9, mood: 'hesitant' },  // 머뭇·느려짐
  4: { rate: 0.92, pitch: 1.08, volume: 0.85, mood: 'timid' },    // 위축·조심
};

export const VOICE_STAGE5 = {
  sob: { rate: 0.8, pitch: 1.3, volume: 0.85, mood: 'sob' },
  panic: { rate: 1.35, pitch: 1.2, volume: 1.0, mood: 'panic' },
  grovel: { rate: 1.0, pitch: 1.15, volume: 1.0, mood: 'grovel' },
};

const STYLE_KEYS = Object.keys(VOICE_STAGE5);

export class EmotionEngine {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
    this.lastStyle = null;
  }

  /** 5단계 연기 스타일 선택: 직전과 다른 스타일 */
  pickStyle(stage) {
    if (stage !== 5) return null;
    const options = STYLE_KEYS.filter((k) => k !== this.lastStyle);
    const style = options[Math.floor(this.rng() * options.length)];
    this.lastStyle = style;
    return style;
  }

  /** 연기 지시: 사용자 설정(속도·음높이 배율)을 곱해 최종 TTS 파라미터 생성 */
  voice(stage, style, userPrefs = {}) {
    const base = stage === 5 ? VOICE_STAGE5[style] || VOICE_STAGE5.grovel : VOICE_BY_STAGE[stage] || VOICE_BY_STAGE[1];
    return {
      ...base,
      rate: base.rate * (userPrefs.rate ?? 1),
      pitch: base.pitch * (userPrefs.pitch ?? 1),
    };
  }

  /** 화면 표시용 캐릭터 상태 */
  persona(stage, style) {
    if (stage === 5 && style) {
      return { face: STAGE5_STYLES[style].face, label: `${STAGES[5].name} (${STAGE5_STYLES[style].name})` };
    }
    return { face: STAGES[stage].face, label: STAGES[stage].name };
  }
}
