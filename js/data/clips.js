/**
 * 녹음 음성 파일 목록.
 * 각 대사에 고유 ID를 붙이고, audio/<ID>.mp3 파일이 있으면 그 파일을 재생한다.
 * (파일이 없으면 기기 내장 음성으로 읽는다.)
 * ※ 대사를 추가할 때는 각 목록의 "맨 끝"에 넣어야 기존 파일 이름이 바뀌지 않는다.
 *
 * direction: 연기 지시 (사람/AI 성우 공통)
 * typecast: 타입캐스트 권장 설정 (emotion: ssfm-v30 프리셋 normal|happy|sad|angry|whisper|toneup|tonedown)
 */
import { STAGE_LINES, REBOUND_LINES, OPENING_LINES, CAP_LINES } from './lines.js';

const GROUPS = [
  { prefix: 'open', lines: OPENING_LINES, label: '첫 마디 · 빈정거리며 먼저 말 걸기 (두 모드 공용)',
    direction: '귀찮다는 듯 빈정빈정. 존댓말인데 얄밉게, 말끝을 비꼬며 올리듯', typecast: { emotion: 'toneup', intensity: 1.2, tempo: 1.05, pitch: 0 } },
  { prefix: 's1', lines: STAGE_LINES[1], label: '1단계 · 무개념 반항',
    direction: '건방지고 뻔뻔하게. 자신만만하고 빠른 말투, 살짝 비꼬는 억양. 코웃음 치듯', typecast: { emotion: 'toneup', intensity: 1.3, tempo: 1.1, pitch: 0 } },
  { prefix: 's2', lines: STAGE_LINES[2], label: '2단계 · 적당한 맞대응',
    direction: '짜증 섞어 맞받아치듯. 당당하지만 신경은 쓰이는 느낌', typecast: { emotion: 'angry', intensity: 1.0, tempo: 1.05, pitch: 0 } },
  { prefix: 's3', lines: STAGE_LINES[3], label: '3단계 · 당황과 흔들림',
    direction: '자신감이 빠져 머뭇머뭇. 느려지고 말끝을 흐리며', typecast: { emotion: 'tonedown', intensity: 1.2, tempo: 0.9, pitch: 0 } },
  { prefix: 's4', lines: STAGE_LINES[4], label: '4단계 · 기세 꺾여 굽신',
    direction: '위축되어 눈치 보며 조심스럽게. 살짝 다급하게 달래듯', typecast: { emotion: 'sad', intensity: 0.9, tempo: 0.95, pitch: 1 } },
  { prefix: 's5_sob', lines: STAGE_LINES[5].sob, label: '5단계 · 울먹이며 사죄',
    direction: '울먹이며 애처롭게. 목이 메고 훌쩍이듯, 느리게', typecast: { emotion: 'sad', intensity: 2.0, tempo: 0.85, pitch: 1 } },
  { prefix: 's5_panic', lines: STAGE_LINES[5].panic, label: '5단계 · 다급하게 횡설수설',
    direction: '숨넘어갈 듯 다급하게, 말이 꼬일 만큼 빠르게 횡설수설', typecast: { emotion: 'toneup', intensity: 1.8, tempo: 1.3, pitch: 2 } },
  { prefix: 's5_grovel', lines: STAGE_LINES[5].grovel, label: '5단계 · 과장되게 비굴 (기본 굴복 모드와 공용)',
    direction: '과장되고 비굴하게, 아부하듯 연극조로 크게', typecast: { emotion: 'toneup', intensity: 1.5, tempo: 1.0, pitch: 1 } },
  { prefix: 'cap', lines: CAP_LINES, label: '무료 버전 3단계 버티기 (계속 몰아붙일 때)',
    direction: '쫄았지만 끝까지 버티는 척. 억울하고 비굴하게, 말끝 흐리며', typecast: { emotion: 'tonedown', intensity: 1.3, tempo: 0.92, pitch: 0 } },
  { prefix: 'rb1', lines: REBOUND_LINES[1], label: '기세 회복 → 1단계 (크게 반전할 때도 사용)',
    direction: '언제 쫄았냐는 듯 다시 기세등등, 얄밉게', typecast: { emotion: 'toneup', intensity: 1.2, tempo: 1.1, pitch: 0 } },
  { prefix: 'rb2', lines: REBOUND_LINES[2], label: '기세 회복 → 2단계',
    direction: '안도하면서 슬슬 다시 기어오르듯, 투덜투덜', typecast: { emotion: 'normal', intensity: 1.0, tempo: 1.0, pitch: 0 } },
  { prefix: 'rb3', lines: REBOUND_LINES[3], label: '기세 회복 → 3단계',
    direction: '아직 조심스럽지만 슬쩍 투덜대듯', typecast: { emotion: 'tonedown', intensity: 1.0, tempo: 0.95, pitch: 0 } },
  { prefix: 'rb4', lines: REBOUND_LINES[4], label: '기세 회복 → 4단계',
    direction: '안도하지만 아직 겁먹은 목소리로', typecast: { emotion: 'sad', intensity: 0.7, tempo: 0.95, pitch: 1 } },
];

const pad = (n) => String(n).padStart(2, '0');

/** [{id, text, group}] 전체 목록 */
export const CLIPS = GROUPS.flatMap((g) =>
  g.lines.map((text, i) => ({
    id: `${g.prefix}_${pad(i + 1)}`,
    text,
    group: g,
  }))
);

export const CLIP_GROUPS = GROUPS;

/** 대사 → 파일 ID (같은 대사는 같은 파일을 공유. 예: 기본 굴복 모드 사죄 = 5단계 비굴 대사) */
export const CLIP_ID_BY_TEXT = Object.fromEntries(CLIPS.map((c) => [c.text, c.id]));

// ---------------- 되받아치기 녹음 문장 (빈칸을 채운 완성 문장) ----------------
import { ADVERB_RETORTS, TOPICS } from './retorts.js';

const fillTpl = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

/** 녹음하는 빈도부사 5종 (그 외 빈도부사는 기기 내장 음성) */
export const RECORDED_ADVERBS = [
  { key: 'mannal', say: '맨날' },
  { key: 'hangsang', say: '항상' },
  { key: 'tto', say: '또' },
  { key: 'maebeon', say: '매번' },
  { key: 'jakku', say: '자꾸' },
];

const STAGE_DIRECTION = {
  1: GROUPS.find((g) => g.prefix === 's1'),
  2: GROUPS.find((g) => g.prefix === 's2'),
  3: GROUPS.find((g) => g.prefix === 's3'),
  4: GROUPS.find((g) => g.prefix === 's4'),
  5: GROUPS.find((g) => g.prefix === 's5_panic'),
};

/** 빈도부사 되받아치기: 5종 × 단계별 대사 = 70문장 */
export const ADVERB_CLIPS = RECORDED_ADVERBS.flatMap((a) =>
  [1, 2, 3, 4, 5].flatMap((s) =>
    ADVERB_RETORTS[s].map((tpl, i) => ({
      id: `adv_${a.key}_s${s}_${pad(i + 1)}`,
      text: fillTpl(tpl, { say: a.say, adv: a.say }),
      group: { label: `빈도부사 "${a.say}" · ${s}단계`, direction: STAGE_DIRECTION[s].direction, typecast: STAGE_DIRECTION[s].typecast },
    }))
  )
);

/** 주제 핑계(1~2단계): 주제 9종 × 2 = 18문장. 주제어는 대표 단어로 녹음 */
const TOPIC_KEYS = [
  ['late', '늦은 거'], ['promise', '약속'], ['contact', '연락'], ['lie', '거짓말'], ['money', '돈'],
  ['chore', '설거지'], ['game', '게임'], ['drink', '술'], ['study', '숙제'],
];
export const TOPIC_CLIPS = TOPICS.flatMap((t, ti) =>
  t.excuses.map((tpl, i) => ({
    id: `tp_${TOPIC_KEYS[ti][0]}_${pad(i + 1)}`,
    text: fillTpl(tpl, { t: TOPIC_KEYS[ti][1] }),
    group: { label: `주제 핑계 · ${TOPIC_KEYS[ti][1]}`, direction: '뻔뻔하게 핑계 대듯, 능청스럽고 빠르게', typecast: { emotion: 'toneup', intensity: 1.2, tempo: 1.1, pitch: 0 } },
  }))
);

import { personaExtraLines } from './personas.js';

const PERSONA_DIRECTION = {
  rude: '퉁명스럽고 무례하게. 사과도 건성으로, 귀찮다는 듯',
  teaser: '얄밉게 깐족대며. 말끝을 늘려 비꼬는 사과',
  humble: '공손하고 조심스럽게. 눈치 보며 작게',
};
/** 캐릭터 전용 대사 (첫 마디·건성 사과·비꼬는 사과) */
const counters = {};
export const PERSONA_CLIPS = personaExtraLines().map(({ persona, text }) => {
  counters[persona.key] = (counters[persona.key] || 0) + 1;
  return { id: `pc_${persona.key}_${pad(counters[persona.key])}`, text,
    group: { label: `캐릭터 전용 · ${persona.name}`, direction: PERSONA_DIRECTION[persona.key], typecast: { emotion: 'normal', intensity: 1, tempo: 1, pitch: 0 } } };
});

/** 녹음 대상 전체 (기본 대사 + 되받아치기 + 캐릭터 전용) : 한꺼번에 녹음할 때의 순서. 새 대사는 항상 맨 끝에 추가 */
export const ALL_CLIPS = [...CLIPS, ...ADVERB_CLIPS, ...TOPIC_CLIPS, ...PERSONA_CLIPS];
for (const c of [...ADVERB_CLIPS, ...TOPIC_CLIPS, ...PERSONA_CLIPS]) CLIP_ID_BY_TEXT[c.text] = c.id;
