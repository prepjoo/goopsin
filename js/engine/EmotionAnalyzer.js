/**
 * EmotionAnalyzer: 사용자 발화의 태도(압박/부드러움/종료/중립)를 규칙 기반으로 분석한다.
 *
 * 원칙 (기획서 4-4)
 * - 욕설 개수만으로 판단하지 않는다: 질책·명령·사죄 요구·부드러운 표현·종료 표현을 함께 본다.
 * - 음량만으로 판단하지 않는다 (현재 버전은 음량을 쓰지 않음).
 * - 대화 흐름(최근 발화 추세)과 AI의 이전 상태는 SubmissionEngine에서 함께 반영한다.
 *
 * 출력: { delta, kind: 'pressure'|'soft'|'end'|'neutral', reasons: string[] }
 * delta는 "이번 발화만 본" 굴복 점수 변화 제안값이다.
 */

const P = (re, w, label) => ({ re, w, label });

// 압박 요소 (값이 클수록 강한 압박)
const SCOLD = [
  P(/^(야+|어이|이봐)(\s|[!?~.]|$)/, 7, '호통'),
  P(/정신\s*(안\s*)?(차려|차리|나갔|없)/, 12, '질책'),
  P(/똑바로/, 10, '질책'),
  P(/말\s*대꾸/, 13, '반항 제압'),
  P(/뭐\s*하는\s*(거|짓)|뭐\s*하냐|뭐\s*한\s*거/, 9, '질책'),
  P(/왜\s*(\S+\s+)?(그래|그랬|그러|이래|이랬|이러)/, 7, '질책'),
  P(/너\s*때문|네\s*탓|니\s*탓/, 10, '책임 추궁'),
  P(/어디서|감히|건방/, 12, '반항 제압'),
  P(/제정신|생각이\s*있|생각\s*좀|한심|답답/, 10, '질책'),
  P(/아직도|또\s*(그|이)|몇\s*번|한두\s*번/, 9, '반복 질책'),
  P(/그만해(?!\s*줄)|그만\s*좀|시끄러/, 8, '제지'),
  P(/잘못했잖|잘못한\s*거\s*(알|몰)/, 10, '잘못 지적'),
];

const COMMAND = [
  P(/(대답|반성|인정|조용히|입\s*다물|가만히)\s*(해|하라|하라고|하세요|하란)/, 11, '명령'),
  P(/(?<!(미안|사랑|고마|축하|수고|좋아|이해))(해|하라고|하란\s*말이야|해라)\s*[!]*$/, 4, '명령형'),
  P(/당장|빨리|얼른/, 5, '재촉'),
  P(/닥쳐|꺼져/, 12, '강한 명령'),
];

const DEMAND = [
  P(/사과\s*(해|하라|하세요|해라|안\s*해|못\s*해|드려|하란)|사과해/, 15, '사죄 요구'),
  P(/사죄/, 15, '사죄 요구'),
  P(/빌어|빌라고|싹싹/, 16, '사죄 요구'),
  P(/무릎/, 16, '사죄 요구'),
  P(/잘못했다고\s*(해|말|하)/, 15, '사죄 요구'),
  P(/용서\s*(빌|구해|를\s*빌)/, 15, '사죄 요구'),
  P(/죄송하다고|미안하다고\s*(해|말)/, 14, '사죄 요구'),
];

const PROFANITY = [
  P(/[씨시][발빨팔]|ㅅㅂ|ㅆㅂ/, 9, '욕설'),
  P(/병신|ㅂㅅ|또라이|미친|ㅁㅊ/, 9, '욕설'),
  P(/바보|멍청|멍충|등신|머저리|얼간이/, 7, '욕설'),
  P(/개(새|같|소리|념|빡|짜증)|쓰레기|젠장|짜증/, 8, '욕설'),
];

// 빈도부사 강조 ("맨날", "항상", "또" …): 질책을 일반화하는 말 → 압박 가산
const FREQUENCY = [
  P(/맨날|만날|항상|언제나|매번|번번이|허구한\s*날|날마다|툭하면|걸핏하면|밥\s*먹듯|자꾸|(^|\s)늘(\s|$)/, 7, '빈도 강조'),
  P(/계속|매일/, 4, '빈도 강조'),
];

// 하락 요소
const SOFT = [
  P(/괜찮|고마워|고맙|좋아|착하|잘했|수고|사랑|귀엽|이해해|이해할게/, -11, '부드러운 표현'),
  P(/미안(해|하다|했)?(?!\s*하다고)/, -9, '사용자 사과'),
  P(/진정|화\s*풀|화\s*안\s*(나|낼)/, -9, '진정'),
];

const ACCEPT = [
  P(/용서(해\s*줄|할게|한다|해줄게|해\s*줄게)|봐\s*줄게|봐준다|받아\s*줄게|받아준다/, -18, '사죄 수용'),
  P(/됐어|됐다|알았어|알았다|그래\s*알았|오케이|그래\s*그래/, -12, '사죄 수용'),
];

const END = [
  P(/그만하자|그만할게|끝내자|여기까지|이제\s*됐|다음에\s*(보|얘기)|잘\s*자|안녕|바이/, -20, '대화 종료'),
];

function matchAll(list, text, reasons) {
  let sum = 0;
  let hits = 0;
  for (const { re, w, label } of list) {
    if (re.test(text)) {
      sum += w;
      hits++;
      reasons.push(label);
    }
  }
  return { sum, hits };
}

/** 문장부호·늘인 글자 등 강도 표현 (STT 결과에는 거의 없지만 텍스트 입력에서 반영) */
function intensity(text) {
  let bonus = 0;
  const ex = (text.match(/!/g) || []).length;
  bonus += Math.min(ex, 3) * 2;
  if (/(.)\1{2,}/.test(text.replace(/[.\s…]/g, ''))) bonus += 3; // "야아아", "왜애애"
  if (/\?{2,}|\?!|!\?/.test(text)) bonus += 2;
  return bonus;
}

export function hasProfanity(text) {
  return PROFANITY.some(({ re }) => re.test(String(text || '')));
}

export function normalize(text) {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

export function analyze(rawText) {
  const text = normalize(rawText);
  const reasons = [];
  if (!text) return { delta: 0, kind: 'neutral', reasons: ['빈 발화'] };

  const scold = matchAll(SCOLD, text, reasons);
  const command = matchAll(COMMAND, text, reasons);
  const demand = matchAll(DEMAND, text, reasons);
  const prof = matchAll(PROFANITY, text, reasons);
  const freq = matchAll(FREQUENCY, text, reasons);
  const soft = matchAll(SOFT, text, reasons);
  const accept = matchAll(ACCEPT, text, reasons);
  const end = matchAll(END, text, reasons);

  // 욕설은 많이 써도 영향이 제한적 (개수만으로 판단하지 않음)
  const profScore = Math.min(prof.sum, 14);
  // 빈도부사는 다른 압박 요소와 함께 쓰일 때 더 크게 (단독이면 절반)
  const freqScore = scold.hits + command.hits + demand.hits + prof.hits > 0 ? freq.sum : Math.round(freq.sum / 2);
  let pressure = scold.sum + command.sum + demand.sum + profScore + freqScore;
  let calm = soft.sum + accept.sum + end.sum; // 음수

  // "알았어 사과해" 처럼 수용어+압박어가 섞이면 압박을 우선 (말로만 알았다고 하는 경우)
  if (pressure > 0 && accept.hits && !end.hits) calm = Math.round(calm * 0.3);
  // "미안한데 똑바로 해" 처럼 부드러운 말 + 압박 → 부드러움 반감
  if (pressure > 0 && soft.hits) calm = Math.round(calm * 0.5);

  if (pressure > 0) pressure += intensity(text);

  const delta = pressure + calm;
  let kind;
  if (end.hits && delta < 0) kind = 'end';
  else if (delta > 3) kind = 'pressure';
  else if (delta < -3) kind = 'soft';
  else kind = 'neutral';

  return { delta, kind, reasons };
}

export const EmotionAnalyzer = { analyze, normalize, hasProfanity };
