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
