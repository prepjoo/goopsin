// 되받아치기 대본 생성: node tools/make-retort-script.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { FREQ_ADVERBS, ADVERB_RETORTS, TOPICS, TOPIC_RETORTS, ECHO_RETORTS, PROFANITY_STANDIN } from '../js/data/retorts.js';
import { STAGES } from '../js/data/lines.js';

const LINE = '='.repeat(60), thin = '-'.repeat(60);
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const stageName = (s) => `${s}단계 · ${STAGES[s].name}`;
mkdirSync('scripts', { recursive: true });

let o = `굽신(GOOPSIN) 되받아치기 대본 - 내 말에 반응하는 대사
${LINE}
사용자가 한 말 속 단어를 짚어서 대꾸하는 대사 모음입니다.

[읽는 법]
  {say} = 사용자가 실제로 쓴 빈도부사 (예: 맨날, 항상, 또)
  {adv} = "~ 그랬다" 앞에 붙는 형태 (대부분 {say}와 같고, "몇 번째"는 "또")
  {t}   = 사용자가 말한 불만 주제 (예: 설거지, 연락)
  {q}   = 사용자 말을 그대로 따온 부분 (최대 14자)
  각 대사 아래 "예)" 줄은 실제로 들리는 문장입니다.

[반응 우선순위]
  1. 빈도부사  → 1~3단계는 들릴 때마다 반드시, 4~5단계는 10번 중 7번
  2. 불만 주제 → 10번 중 6번
  3. 말 되받기 → 10번 중 2~3번 (두 번 연속 금지)
  해당 없으면 기본 대사(녹음 대본의 대사)로 대답합니다.

[목소리] 이 대사들은 사용자가 한 단어가 그때그때 들어가서 미리 녹음할 수 없습니다.
         기기 기본 음성으로 나옵니다. (녹음 대본과는 별개)

[고치고 싶을 때] 이 파일에 직접 고쳐서 보내 주시면 앱에 그대로 반영합니다.
                 대사 추가·삭제, 새 빈도부사, 새 주제 모두 가능합니다.

`;

o += `${LINE}\n1. 빈도부사 (가장 예민하게 반응)\n${LINE}\n\n[알아듣는 빈도부사 ${FREQ_ADVERBS.length}종]\n`;
const says = [...new Set(FREQ_ADVERBS.map((a) => a.say))];
o += `  ${says.join(', ')}\n  ※ 비슷한 말도 함께 알아듣습니다: 만날→맨날, 번번이→매번, 날마다·매일→허구한 날,\n     "한두 번이 아니야"→몇 번째\n  ※ "또라이"의 "또", "늘어진다"의 "늘"은 빈도부사로 치지 않습니다.\n\n`;
for (const s of [1, 2, 3, 4, 5]) {
  o += `■ ${stageName(s)}\n${thin}\n`;
  ADVERB_RETORTS[s].forEach((t, i) => {
    const ex = says[(s + i) % 5];
    o += `  ${t}\n     예) ${fill(t, { say: ex, adv: ex })}\n`;
  });
  o += '\n';
}

o += `${LINE}\n2. 불만 주제 (${TOPICS.length}종)\n${LINE}\n\n`;
o += `[1~2단계: 주제별 핑계]\n${thin}\n`;
const samples = ['늦은 거', '약속', '연락', '거짓말', '돈', '설거지', '게임', '술', '숙제'];
const hear = ['늦었어, 늦잠, 지각', '약속', '연락, 답장, 전화, 카톡, 문자', '거짓말, 뻥', '돈, 카드, 용돈, 쇼핑, 택배', '설거지, 청소, 빨래, 정리, 분리수거, 쓰레기', '게임, 유튜브, 핸드폰, 휴대폰', '술, 회식, 취해', '숙제, 공부, 시험'];
TOPICS.forEach((t, i) => {
  o += `■ ${samples[i]}  (알아듣는 말: ${hear[i]})\n`;
  for (const e of t.excuses) o += `  ${fill(e, { t: samples[i] })}\n`;
  o += '\n';
});
o += `[3~5단계: 모든 주제 공통]\n${thin}\n`;
for (const s of [3, 4, 5]) {
  o += `■ ${stageName(s)}\n`;
  for (const t of TOPIC_RETORTS[s]) o += `  ${t}\n     예) ${fill(t, { t: '설거지' })}\n`;
  o += '\n';
}

o += `${LINE}\n3. 말 그대로 되받기\n${LINE}\n\n`;
for (const s of [1, 2, 3, 4, 5]) {
  o += `■ ${stageName(s)}\n`;
  for (const t of ECHO_RETORTS[s]) o += `  ${t}\n     예) ${fill(t, { q: '설거지 안 했잖아' })}\n`;
  o += '\n';
}
o += `※ 욕설이 섞인 말은 따라 하지 않고 "${PROFANITY_STANDIN}"로 바꿔서 받습니다.\n   예) ${fill(ECHO_RETORTS[2][0], { q: PROFANITY_STANDIN })}\n\n${LINE}\n끝.\n`;
writeFileSync('scripts/굽신_되받아치기대본.txt', o);
console.log('ok', o.length);
