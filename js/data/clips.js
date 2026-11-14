/**
 * 녹음 음성 파일 목록.
 * 각 대사에 고유 ID를 붙이고, audio/<ID>.mp3 파일이 있으면 그 파일을 재생한다.
 * (파일이 없으면 기기 내장 음성으로 읽는다.)
 * ※ 대사를 추가할 때는 각 목록의 "맨 끝"에 넣어야 기존 파일 이름이 바뀌지 않는다.
 *
 * direction: 연기 지시 (사람/AI 성우 공통)
 * typecast: 타입캐스트 권장 설정 (emotion: ssfm-v30 프리셋 normal|happy|sad|angry|whisper|toneup|tonedown)
 */
import { STAGE_LINES, REBOUND_LINES } from './lines.js';

export const OPENINGS = {
  battle: '뭐야, 왜 불렀어? 할 말 있으면 해 봐.',
  basic: '네! 무엇이든 말씀만 하십시오!',
};

const GROUPS = [
  { prefix: 'open_battle', lines: [OPENINGS.battle], label: 'AI 대결 모드 첫 마디',
    direction: '귀찮다는 듯 건방지게, 심드렁하고 빠르게', typecast: { emotion: 'toneup', intensity: 1.0, tempo: 1.1, pitch: 0 } },
  { prefix: 'open_basic', lines: [OPENINGS.basic], label: '기본 굴복 모드 첫 마디',
    direction: '잔뜩 긴장해서 과하게 공손하게, 군기 바짝 든 목소리로', typecast: { emotion: 'toneup', intensity: 1.3, tempo: 1.1, pitch: 1 } },
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
  { prefix: 'rb1', lines: REBOUND_LINES[1], label: '기세 회복 → 1단계',
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
    id: g.lines.length === 1 && g.prefix.startsWith('open') ? g.prefix : `${g.prefix}_${pad(i + 1)}`,
    text,
    group: g,
  }))
);

export const CLIP_GROUPS = GROUPS;

/** 대사 → 파일 ID (같은 대사는 같은 파일을 공유. 예: 기본 굴복 모드 사죄 = 5단계 비굴 대사) */
export const CLIP_ID_BY_TEXT = Object.fromEntries(CLIPS.map((c) => [c.text, c.id]));
