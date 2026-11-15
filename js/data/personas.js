// 캐릭터(성격) 설정: 출발점과 버티는 정도가 다르다. 끝까지 몰아붙이면 누구든 5단계에서 제대로 굴복한다.
import { OPENING_LINES } from './lines.js';

/**
 * gain: 야단맞을 때 굴복 점수가 오르는 배율 (작을수록 잘 버팀)
 * softGain: 부드러운 말에 기세를 회복하는 배율 (클수록 잘 기어오름)
 * startScore: 시작 굴복 점수
 * lines: 단계별 전용 대사 (그 단계에서 60% 확률로 사용) / voice: 전용 대사를 읽을 때의 말투 단계
 */
export const PERSONAS = {
  rude: {
    key: 'rude', name: '무례한', level: '어려움', emoji: '😤', face: 'annoyed',
    sub: '좀처럼 안 굽히는 강적', battle: true,
    gain: 0.7, softGain: 1.25, startScore: 0,
    openings: ['뭐. 왜 불러.', '아, 왜 또. 바쁘다고.', '할 말 있으면 빨리 해.'],
    lines: {
      3: ['아, 미안. 됐지?', '알았다고. 미안하다고 하면 되잖아.', '사과하면 될 거 아니야. 미안.'],
      4: ['…죄송합니다. 이제 됐어요?'],
    },
    voice: { 3: 2, 4: 3 },
  },
  teaser: {
    key: 'teaser', name: '깐족이', level: '보통', emoji: '😏', face: 'cocky',
    sub: '얄밉게 깐족대다 결국 굽신', battle: true,
    gain: 0.85, softGain: 1, startScore: 0,
    openings: OPENING_LINES,
    lines: {
      3: ['아이고~ 죄송하게 됐네요~', '네네~ 제가 다 잘못했네요~', '어이쿠, 무서워라~ 죄송합니다~'],
    },
    voice: { 3: 1 },
  },
  humble: {
    key: 'humble', name: '겸손이', level: '쉬움', emoji: '😰', face: 'nervous',
    sub: '금방 수그러들지만 슬쩍 기어올라요', battle: true,
    gain: 1.3, softGain: 0.6, startScore: 25,
    openings: ['네… 부르셨어요?', '저, 제가 뭐 잘못했나요…?', '아, 네! 말씀하세요…'],
    openingVoice: 3,
    lines: {},
    voice: {},
  },
  goopsin: {
    key: 'goopsin', name: '굽신이', level: '아주 쉬움', emoji: '🙇', face: 'grovel',
    sub: '무슨 말을 해도 무조건 사죄', battle: false,
    openings: OPENING_LINES,
  },
};

export const PERSONA_ORDER = ['rude', 'teaser', 'humble', 'goopsin'];

/** 캐릭터 전용 대사 전체 (녹음 대본용) */
export function personaExtraLines() {
  const out = [];
  for (const key of PERSONA_ORDER) {
    const p = PERSONAS[key];
    const own = p.openings === OPENING_LINES ? [] : p.openings;
    for (const text of [...own, ...Object.values(p.lines || {}).flat()]) out.push({ persona: p, text });
  }
  return out;
}
