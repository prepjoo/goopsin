import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../js/engine/EmotionAnalyzer.js';
import { SubmissionEngine, rawStage } from '../js/engine/SubmissionEngine.js';
import { BattleConversation, BasicConversation } from '../js/engine/ConversationEngine.js';
import { BASIC_APOLOGIES } from '../js/data/lines.js';

const T0 = 1_000_000;
const seq = (arr) => { let i = 0; return () => arr[i++ % arr.length]; };

test('분석: 질책/명령/사죄 요구는 압박', () => {
  for (const s of ['야! 너 왜 그래?', '말대꾸하지 마! 정신 안 차려?', '똑바로 사과해!', '아직도 말대꾸야?', '무릎 꿇고 빌어']) {
    const a = analyze(s);
    assert.equal(a.kind, 'pressure', `${s} → ${JSON.stringify(a)}`);
  }
});

test('분석: 부드러운 말/수용/종료는 하락', () => {
  for (const s of ['그래, 알았어. 그만하자.', '괜찮아 용서해 줄게', '고마워', '미안해']) {
    const a = analyze(s);
    assert.ok(a.delta < 0, `${s} → ${JSON.stringify(a)}`);
  }
  assert.equal(analyze('그래, 알았어. 그만하자.').kind, 'end');
});

test('분석: 욕설 개수만으로 점수가 폭주하지 않음', () => {
  const one = analyze('바보');
  const many = analyze('바보 멍청이 바보 멍청이 등신 머저리 얼간이');
  assert.ok(many.delta <= 14 + 6, `많은 욕설도 상한 적용: ${many.delta}`);
  assert.ok(one.delta > 0);
});

test('분석: 압박과 수용이 섞이면 압박 우선', () => {
  assert.equal(analyze('알았으면 똑바로 사과해').kind, 'pressure');
});

test('점수-단계 매핑', () => {
  assert.deepEqual([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(rawStage), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('DSS: 한 번의 발화로 급격히 바뀌지 않음', () => {
  const e = new SubmissionEngine({ maxStage: 5 });
  const r = e.update({ delta: 999, kind: 'pressure' }, T0);
  assert.ok(r.score <= 22);
  assert.ok(r.stage <= 2);
});

test('DSS: 계속 압박하면 5단계까지 굴복, 부드러워지면 다시 반항, 다시 야단치면 또 굴복', () => {
  const e = new SubmissionEngine({ maxStage: 5 });
  let t = T0;
  const stages = [];
  for (let i = 0; i < 8; i++) stages.push(e.update(analyze('말대꾸하지 마! 똑바로 사과해!'), (t += 3000)).stage);
  assert.equal(e.stage, 5, `압박 단계 흐름: ${stages}`);
  // 단계가 줄지 않고 한 번에 한 단계씩 상승
  for (let i = 1; i < stages.length; i++) assert.ok(stages[i] - stages[i - 1] <= 1 && stages[i] >= stages[i - 1]);

  const r1 = e.update(analyze('그래, 알았어. 그만하자.'), (t += 3000));
  assert.equal(r1.direction, 'down');
  e.update(analyze('괜찮아 용서해 줄게'), (t += 3000));
  e.update(analyze('고마워'), (t += 3000));
  assert.ok(e.stage <= 2, `부드러워진 뒤 단계: ${e.stage}`);

  for (let i = 0; i < 8; i++) e.update(analyze('아직도 정신 못 차렸어? 사과해!'), (t += 3000));
  assert.equal(e.stage, 5);
});

test('DSS: 무료 버전은 3단계 상한', () => {
  const e = new SubmissionEngine({ maxStage: 3 });
  let t = T0;
  for (let i = 0; i < 10; i++) e.update(analyze('똑바로 사과해! 무릎 꿇어!'), (t += 2000));
  assert.equal(e.stage, 3);
  assert.ok(e.score <= 59);
  e.setMaxStage(5);
  for (let i = 0; i < 4; i++) e.update(analyze('똑바로 사과해! 무릎 꿇어!'), (t += 2000));
  assert.ok(e.stage >= 4);
});

test('DSS: 경계 근처에서 단계가 깜빡이지 않음(히스테리시스)', () => {
  const e = new SubmissionEngine({ maxStage: 5 });
  e.score = 42; e.stage = 3; e.lastAt = T0;
  const r = e.update({ delta: -3, kind: 'neutral' }, T0 + 1000); // 42 → 36 (raw 2, 하지만 40-4=36 미만 아님)
  assert.equal(r.stage, 3);
});

test('DSS: 오래 조용하면 초기화', () => {
  const e = new SubmissionEngine({ maxStage: 5 });
  e.score = 70; e.stage = 4; e.lastAt = T0;
  const r = e.update({ delta: 0, kind: 'neutral' }, T0 + 130_000);
  assert.equal(r.stage, 1);
  assert.ok(r.score <= 3);
});

test('대화: 기획서 예시 흐름 재현 (반항 → 굴복 → 기세 회복)', () => {
  const c = new BattleConversation({ maxStage: 5, rng: seq([0.1, 0.5, 0.9]) });
  let t = T0;
  const lines = ['야! 너 왜 그래?', '말대꾸하지 마! 정신 안 차려?', '아직도 말대꾸야?', '똑바로 사과해!', '사과 똑바로 안 해? 무릎 꿇고 빌어!', '빌라고! 잘못했다고 해!', '그래, 알았어. 그만하자.'];
  const out = lines.map((l) => c.respond(l, (t += 4000)));
  assert.equal(out[0].stage, 1);
  assert.ok(out[5].stage >= 4, `압박 후 단계: ${out.map((o) => o.stage)}`);
  const last = out.at(-1);
  assert.equal(last.direction, 'down');
  assert.ok(last.text.length > 0);
  for (const o of out) assert.ok(o.text, '모든 턴에 대사 존재');
});

test('대화: 5단계 연기 스타일이 연속으로 같지 않음', () => {
  const c = new BattleConversation({ maxStage: 5 });
  let t = T0;
  const styles = [];
  for (let i = 0; i < 14; i++) {
    const r = c.respond('똑바로 사과해! 무릎 꿇고 빌어!', (t += 2000));
    if (r.stage === 5) styles.push(r.style);
  }
  assert.ok(styles.length >= 3);
  for (let i = 1; i < styles.length; i++) assert.notEqual(styles[i], styles[i - 1]);
});

test('기본 굴복 모드: 무조건 사죄, 같은 문구 연속 반복 없음', () => {
  const b = new BasicConversation();
  let prev = '';
  for (let i = 0; i < 20; i++) {
    const r = b.respond('야!');
    assert.ok(BASIC_APOLOGIES.includes(r.text));
    assert.notEqual(r.text, prev);
    prev = r.text;
  }
});

test('첫 마디: 두 모드 모두 빈정거리는 대사로 먼저 말을 건다', async () => {
  const { OPENING_LINES } = await import('../js/data/lines.js');
  assert.ok(OPENING_LINES.includes(new BattleConversation().opening().text));
  assert.ok(OPENING_LINES.includes(new BasicConversation().opening().text));
});

test('기세 반전: 5단계에서 "그만하자" 한마디에 크게 기세등등 (2단계 이하 + 반전 대사)', async () => {
  const { REBOUND_LINES } = await import('../js/data/lines.js');
  const c = new BattleConversation({ maxStage: 5 });
  let t = T0;
  for (let i = 0; i < 8; i++) c.respond('똑바로 사과해! 무릎 꿇고 빌어!', (t += 3000));
  assert.equal(c.submission.stage, 5);
  const r = c.respond('그래, 알았어. 그만하자.', (t += 3000));
  assert.ok(r.stage <= 2, `반전 후 단계 ${r.stage}`);
  assert.ok(REBOUND_LINES[1].includes(r.text), r.text);
});

test('무료 상한: 3단계에서 계속 몰아붙이면 버티기 대사가 섞인다', async () => {
  const { CAP_LINES } = await import('../js/data/lines.js');
  const c = new BattleConversation({ maxStage: 3 });
  let t = T0;
  const texts = [];
  for (let i = 0; i < 10; i++) texts.push(c.respond('똑바로 사과해! 무릎 꿇고 빌어!', (t += 3000)).text);
  assert.ok(texts.some((x) => CAP_LINES.includes(x)));
  const c5 = new BattleConversation({ maxStage: 5 });
  for (let i = 0; i < 12; i++) assert.ok(!CAP_LINES.includes(c5.respond('똑바로 사과해! 무릎 꿇고 빌어!', (t += 3000)).text));
});

test('녹음 파일 ID: 모든 대사에 고유 ID, 기본 모드 사죄 문구도 파일 공유', async () => {
  const { CLIPS, CLIP_ID_BY_TEXT } = await import('../js/data/clips.js');
  const ids = CLIPS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of BASIC_APOLOGIES) assert.ok(CLIP_ID_BY_TEXT[t], t);
});

test('되받아치기: 빈도부사를 짚어서 대꾸 (1~3단계는 항상)', async () => {
  const { extractCues } = await import('../js/engine/RetortGenerator.js');
  assert.equal(extractCues('너는 맨날 늦잖아!').adverb.say, '맨날');
  assert.equal(extractCues('항상 이런 식이야').adverb.say, '항상');
  assert.equal(extractCues('또 그러냐?').adverb.say, '또');
  assert.equal(extractCues('이게 몇 번째야').adverb.adv, '또');
  assert.equal(extractCues('또라이 같은').adverb, null); // '또라이'의 '또'는 빈도부사 아님
  assert.equal(extractCues('하늘이 늘어진다').adverb, null);
  for (const seed of [0.01, 0.5, 0.99]) {
    const c = new BattleConversation({ maxStage: 5, rng: () => seed });
    const r = c.respond('너는 맨날 이런 식이야!', T0);
    assert.equal(r.responseType, 'adverb', `${seed}: ${r.text}`);
    assert.match(r.text, /맨날/);
  }
});

test('되받아치기: 빈도부사가 들어가면 압박 점수가 더 오른다', () => {
  assert.ok(analyze('왜 맨날 그래!').delta > analyze('왜 그래!').delta);
});

test('되받아치기: 주제어와 말 되받기, 욕설은 따라 하지 않음', async () => {
  const { extractCues, makeQuote } = await import('../js/engine/RetortGenerator.js');
  assert.equal(extractCues('설거지 안 했잖아!').topic.word, '설거지');
  assert.equal(extractCues('왜 연락을 안 받아?').topic.word, '연락');
  assert.equal(makeQuote('바보야 정신 차려'), '그런 험한 말');
  assert.ok(makeQuote('도대체 너는 생각이 있는 거야 없는 거야').length <= 14);
  const c = new BattleConversation({ maxStage: 5, rng: () => 0.1 });
  const r = c.respond('설거지 안 했잖아! 똑바로 해!', T0);
  assert.equal(r.responseType, 'topic');
  for (const x of ['바보 멍청이 정신 차려!', '이 미친 진짜 사과해!']) {
    const c2 = new BattleConversation({ maxStage: 5, rng: () => 0.1 });
    const t = c2.respond(x, T0).text;
    assert.ok(!/바보|멍청|미친/.test(t), t);
  }
});

test('결과 요약: 최고 단계·걸린 시간·가장 많이 쓴 말·칭호', async () => {
  const { SessionStats, fmtTime } = await import('../js/engine/SessionStats.js');
  const s = new SessionStats('battle', T0);
  const c = new BattleConversation({ maxStage: 5 });
  let t = T0;
  for (let i = 0; i < 8; i++) { t += 5000; s.record(c.respond('너 맨날 왜 그래! 똑바로 사과해!', t), t); }
  t += 5000; s.record(c.respond('그래, 알았어. 그만하자.', t), t);
  const r = s.summary(t);
  assert.equal(r.peakStage, 5);
  assert.equal(r.topWord.word, '맨날');
  assert.equal(r.topWord.count, 8);
  assert.equal(r.rebounds, 1);
  assert.equal(r.title, '전설의 호통왕');
  assert.match(r.headline, /만에 완전 굴복!/);
  assert.equal(fmtTime(134), '2분 14초');
  const b = new SessionStats('basic', T0); b.record({ stage: 5 }, T0 + 1000);
  assert.match(b.summary(T0 + 3000).headline, /사죄 1번/);
  const quiet = new SessionStats('battle', T0); quiet.record({ stage: 1 }, T0 + 1000);
  assert.equal(quiet.summary(T0 + 2000).expression, 'cocky');
});

test('캐릭터: 무례한은 버티고 겸손이는 금방 수그러들지만, 끝까지 몰면 모두 5단계', async () => {
  const { PERSONAS } = await import('../js/data/personas.js');
  const turnsTo5 = (key) => {
    const c = new BattleConversation({ maxStage: 5, persona: PERSONAS[key], rng: () => 0.9 });
    let t = T0;
    for (let i = 1; i <= 30; i++) if (c.respond('말대꾸하지 마! 똑바로 사과해!', (t += 3000)).stage === 5) return i;
    return Infinity;
  };
  const [r, m, h] = ['rude', 'teaser', 'humble'].map(turnsTo5);
  assert.ok(r > m && m > h, `무례한 ${r} > 깐족이 ${m} > 겸손이 ${h}`);
  assert.ok(r < 20);
  const hc = new BattleConversation({ maxStage: 5, persona: PERSONAS.humble });
  assert.equal(hc.opening().stage, 2);
  assert.ok(PERSONAS.humble.openings.includes(hc.opening().text));
});

test('캐릭터: 전용 대사(건성·비꼬는 사과)는 중간 단계에서만, 5단계는 진짜 사죄', async () => {
  const { PERSONAS } = await import('../js/data/personas.js');
  const { STAGE_LINES } = await import('../js/data/lines.js');
  const c = new BattleConversation({ maxStage: 5, persona: PERSONAS.teaser, rng: () => 0.2 });
  let t = T0; const seen = [];
  for (let i = 0; i < 20; i++) seen.push(c.respond('아직도 정신 못 차렸어? 무릎 꿇어!', (t += 3000)));
  assert.ok(seen.some((x) => x.responseType === 'persona' && x.stage === 3));
  const all5 = Object.values(STAGE_LINES[5]).flat();
  for (const x of seen.filter((y) => y.stage === 5)) assert.ok(x.responseType !== 'persona' && (all5.includes(x.text) || x.responseType !== 'line'), x.text);
});
