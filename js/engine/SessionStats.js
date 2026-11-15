/**
 * SessionStats: 한 번의 대화 기록을 모아 결과 화면에 쓸 요약을 만든다.
 * (UI와 분리된 순수 로직이라 Node에서 테스트할 수 있다.)
 */
export class SessionStats {
  constructor(mode, now = Date.now(), opponent = null) {
    this.mode = mode;
    this.opponent = opponent; // 상대 캐릭터 이름
    this.startedAt = now;
    this.turns = 0;
    this.peakStage = 1;
    this.peakAt = now;
    this.peakStyle = null;
    this.rebounds = 0;
    this.words = {}; // 내가 쓴 빈도부사 횟수
  }

  record(turn, now = Date.now()) {
    this.turns++;
    const stage = turn.stage || 1;
    if (stage > this.peakStage) { this.peakStage = stage; this.peakAt = now; this.peakStyle = turn.style || null; }
    if (turn.direction === 'down') this.rebounds++;
    const say = turn.cues && turn.cues.adverb && turn.cues.adverb.say;
    if (say) this.words[say] = (this.words[say] || 0) + 1;
  }

  summary(now = Date.now()) {
    const durationSec = Math.max(1, Math.round((now - this.startedAt) / 1000));
    const toPeakSec = Math.max(1, Math.round((this.peakAt - this.startedAt) / 1000));
    const top = Object.entries(this.words).sort((a, b) => b[1] - a[1])[0] || null;
    const base = { mode: this.mode, opponent: this.opponent, turns: this.turns, durationSec, toPeakSec, peakStage: this.peakStage, peakStyle: this.peakStyle, rebounds: this.rebounds, topWord: top ? { word: top[0], count: top[1] } : null };
    if (this.mode === 'basic') {
      return { ...base, headline: `사죄 ${this.turns}번 받아냄!`, title: this.turns >= 10 ? '사죄 수집가' : this.turns >= 5 ? '호통 좀 치는 편' : '가볍게 한마디', expression: 'grovel' };
    }
    const p = this.peakStage;
    let title, headline, expression;
    if (p >= 5) {
      title = toPeakSec <= 60 ? '전설의 호통왕' : toPeakSec <= 120 ? '잔소리 9단' : '끈기의 승리자';
      headline = `${fmtTime(toPeakSec)} 만에 완전 굴복!`;
      expression = this.peakStyle || 'grovel';
    } else if (p === 4) { title = '기선 제압 성공'; headline = `${fmtTime(toPeakSec)} 만에 4단계 굽신!`; expression = 'timid'; }
    else if (p === 3) { title = '말발 좀 서는 편'; headline = `${fmtTime(toPeakSec)} 만에 3단계 당황!`; expression = 'nervous'; }
    else if (p === 2) { title = '아직은 순한 맛'; headline = '굽신이가 아직 말대꾸 중'; expression = 'annoyed'; }
    else { title = '천사표 인내심'; headline = '굽신이는 눈 하나 깜짝 안 함'; expression = 'cocky'; }
    return { ...base, headline, title, expression };
  }
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m}분 ${s}초` : `${s}초`;
}
