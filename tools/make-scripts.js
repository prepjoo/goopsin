// 녹음 대본 생성기: node tools/make-scripts.js
// js/data/clips.js 의 대사·연기 지시로 기본 대본과 타입캐스트용 대본을 만든다.
import { writeFileSync, mkdirSync } from 'node:fs';
import { CLIPS, CLIP_GROUPS } from '../js/data/clips.js';

const EMO_KO = { normal: '평범', happy: '기쁨', sad: '슬픔', angry: '화남', whisper: '속삭임', toneup: '톤업', tonedown: '톤다운' };
const LINE = '='.repeat(60);
const thin = '-'.repeat(60);
const groups = CLIP_GROUPS.map((g) => ({ g, clips: CLIPS.filter((c) => c.group === g) }));
mkdirSync('scripts', { recursive: true });

// ---------------- 1. 기본 대본 ----------------
let a = `굽신(GOOPSIN) 녹음 대본 - 기본판
${LINE}
총 ${CLIPS.length}개 대사 · 어떤 성우·AI 음성·직접 녹음에도 쓸 수 있는 공통 대본

[녹음 규칙]
1. 한 줄 = 파일 하나. 파일 이름은 [파일명] 그대로, 확장자 .mp3
   예) s1_01.mp3
2. 같은 캐릭터(한 사람 목소리)로 전부 녹음합니다.
3. 앞뒤 무음은 0.2초 이내로 짧게 잘라 주세요. (반응 속도)
4. 대사 글자는 바꾸지 마세요. 앱이 글자로 파일을 찾습니다.
   (말투상 바꾸고 싶으면 알려 주세요. 앱 대사도 같이 고칩니다.)
5. 완성된 파일은 앱의 audio 폴더에 넣으면 자동으로 재생됩니다.
   파일이 없는 대사는 지금처럼 기기 내장 음성으로 읽습니다.

[캐릭터 설정]
- 평소엔 무개념에 건방진 친구. 야단맞을수록 점점 쫄다가 결국 비굴하게 사죄.
- 코믹한 과장 연기 환영. 진지한 사과가 아니라 "웃긴 굴복"이 목표입니다.
- 같은 사람이 1단계(건방)부터 5단계(울먹·다급·비굴)까지 연기 폭을 넓게.

`;
for (const { g, clips } of groups) {
  a += `${LINE}\n■ ${g.label}\n  연기: ${g.direction}\n${thin}\n`;
  for (const c of clips) a += `[${c.id}]  ${c.text}\n`;
  a += '\n';
}
a += `${LINE}\n끝. 수고하셨습니다! (총 ${CLIPS.length}개 파일)\n`;
writeFileSync('scripts/굽신_녹음대본_기본.txt', a);

// ---------------- 2. 타입캐스트 대본 ----------------
const totalChars = CLIPS.reduce((n, c) => n + c.text.length, 0);
let b = `굽신(GOOPSIN) 녹음 대본 - 타입캐스트(Typecast) 무료 플랜용
${LINE}
총 ${CLIPS.length}개 대사 · 약 ${totalChars}자 · 예상 길이 약 2~3분
→ 무료 플랜 월 다운로드 5분 안에 들어갑니다. (재생성·시험 듣기를 고려해도 여유)
  ※ 요금·한도는 바뀔 수 있으니 시작 전에 타입캐스트 요금 페이지를 한 번 확인하세요.

[준비]
1. typecast.ai 가입 (무료 플랜, 카드 등록 없음)
2. 새 프로젝트 → 캐릭터 고르기
   - 20~30대 남성 또는 여성의 "대화체/캐주얼" 캐릭터 추천
   - 캐릭터마다 지원 감정이 다릅니다. 감정 목록에 [화남]·[슬픔]·[톤업]이 있는 캐릭터를 고르세요.
   - 고르기 전 시험 문장 2개로 들어 보세요:
       · 뭐? 내가 뭘 잘못했는데?          (감정: 톤업, 빠르게)
       · 흐윽… 정말 죄송합니다… 제가 다 잘못했습니다…   (감정: 슬픔, 강도 최대)
     → 두 문장의 차이가 확실한 캐릭터가 좋습니다.
3. 전부 같은 캐릭터로 만듭니다.

[설정 읽는 법]
  감정 = 타입캐스트 감정 이름 (괄호 안은 API 값)
  강도 = 감정 강도 (스튜디오에서는 슬라이더. 0.5 약하게 / 1.0 보통 / 2.0 최대)
  속도 = 말하기 속도 배율 (1.0 = 기본)
  톤   = 음높이 조절 (0 = 기본, +1·+2 = 조금씩 높게)
  ※ 캐릭터에 해당 감정이 없으면 가장 비슷한 것으로:
     톤업 없음 → 기쁨 / 톤다운 없음 → 평범 + 속도 0.9 / 화남 없음 → 톤업
  ※ "스마트 이모션"(자동 감정)은 쓰지 마세요. 단계별 연기 차이가 뭉개집니다.

[감정을 더 살리는 팁]
- 3단계 "…", 5단계 울먹 대사의 "…" 위치에 쉼(0.3~0.5초)을 넣으면 머뭇거림이 살아납니다.
- 5단계 다급 대사는 쉼을 빼고 속도를 올려 숨넘어가게.
- 마음에 안 들면 같은 설정으로 "다시 생성"을 2~3번 해 보세요. 매번 조금씩 다릅니다.
- 대사 글자는 바꾸지 마세요. 앱이 글자로 파일을 찾습니다.

[내보내기]
- 문장마다 따로 다운로드 (형식: MP3)
- 파일 이름을 [파일명]으로 바꿔 주세요.  예) s1_01.mp3
- 다 모이면 압축해서 보내 주시면 제가 앱에 넣고 다시 배포합니다.

`;
for (const { g, clips } of groups) {
  const t = g.typecast;
  const emo = `${EMO_KO[t.emotion]}(${t.emotion})`;
  const tone = t.pitch > 0 ? `+${t.pitch}` : String(t.pitch);
  b += `${LINE}\n■ ${g.label}\n  감정 ${emo} · 강도 ${t.intensity.toFixed(1)} · 속도 ${t.tempo.toFixed(2)} · 톤 ${tone}\n  연기 메모: ${g.direction}\n${thin}\n`;
  for (const c of clips) b += `[${c.id}]  ${c.text}\n`;
  b += '\n';
}
b += `${LINE}\n[확인 목록] 아래 ${CLIPS.length}개 파일이 모두 있으면 완성입니다.\n`;
b += CLIPS.map((c) => `${c.id}.mp3`).join('\n') + '\n';
writeFileSync('scripts/굽신_녹음대본_타입캐스트.txt', b);

console.log(`대본 생성 완료: ${CLIPS.length}개 대사, ${totalChars}자`);
