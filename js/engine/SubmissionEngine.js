/**
 * SubmissionEngine: 역동적 굴복 시스템(DSS, Dynamic Submission System)
 *
 * - 굴복 점수 0~100, 단계 1~5 (0~19:1, 20~39:2, 40~59:3, 60~79:4, 80~100:5)
 * - 사용자가 강하게 나오면 점수 상승, 부드러워지면 하락 → 굴복과 반항이 반복된다.
 * - 한 번의 발화로 급격히 변하지 않도록 1회 변화량을 제한하고, 단계 전환에 히스테리시스를 둔다.
 * - 연속 압박(대화 흐름상 지속적 압박)은 가중치를 올린다. 연속 완화도 마찬가지.
 * - 오래 말이 없으면 점수가 서서히 줄고, 일정 시간이 지나면 초기 상태로 돌아간다.
 * - maxStage로 무료(3단계)/유료(5단계) 범위를 제한한다. 내부 구조는 항상 5단계.
 */

export const STAGE_BOUNDS = [0, 20, 40, 60, 80]; // 각 단계의 시작 점수 (index = stage-1)

export const DEFAULTS = {
  maxStage: 3,
  maxUpPerTurn: 22,        // 1회 최대 상승폭
  maxDownPerTurn: 35,      // 1회 최대 하락폭 (대화 종료 의사는 크게 반영)
  hysteresisUp: 2,         // 올라갈 때: 경계 + 2 이상이어야 단계 상승
  hysteresisDown: 4,       // 내려갈 때: 경계 - 4 미만이어야 단계 하락
  idleDecayAfterMs: 30_000,  // 30초 이상 조용하면 감쇠 시작
  idleDecayPerSec: 0.5,
  resetAfterMs: 120_000,     // 2분 이상 조용하면 초기화
  neutralDrift: -3,          // 중립 발화는 살짝 기세 회복
  endReboundRatio: 0.7,      // 굴복 상태(40점+)에서 '그만하자/용서할게' 류 → 현재 점수의 70%를 한 번에 회복(반전)
  endReboundMax: 75,
};

export function rawStage(score) {
  let s = 1;
  for (let i = 0; i < STAGE_BOUNDS.length; i++) if (score >= STAGE_BOUNDS[i]) s = i + 1;
  return s;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class SubmissionEngine {
  constructor(opts = {}) {
    this.opts = { ...DEFAULTS, ...opts };
    this.reset();
  }

  setMaxStage(n) {
    this.opts.maxStage = clamp(n, 1, 5);
    this.score = Math.min(this.score, this.maxScore);
    this.stage = Math.min(this.stage, this.opts.maxStage);
  }

  get maxScore() {
    return this.opts.maxStage >= 5 ? 100 : STAGE_BOUNDS[this.opts.maxStage] - 1;
  }

  reset() {
    this.score = 0;
    this.stage = 1;
    this.pressureStreak = 0;
    this.calmStreak = 0;
    this.lastAt = null;
    this.peakStage = 1;
  }

  /** 시간 경과 반영 (조용하면 감쇠, 오래 조용하면 초기화) */
  applyIdle(now) {
    if (this.lastAt == null) return;
    const gap = now - this.lastAt;
    if (gap >= this.opts.resetAfterMs) {
      this.reset();
      return;
    }
    if (gap > this.opts.idleDecayAfterMs) {
      const sec = (gap - this.opts.idleDecayAfterMs) / 1000;
      this.score = clamp(this.score - sec * this.opts.idleDecayPerSec, 0, this.maxScore);
      this.stage = this._stableStage(this.score, this.stage, true);
    }
  }

  /**
   * 분석 결과를 반영한다.
   * @param {{delta:number, kind:string}} analysis EmotionAnalyzer 결과
   * @param {number} now 타임스탬프(ms)
   */
  update(analysis, now = Date.now()) {
    this.applyIdle(now);
    const prevStage = this.stage;
    const prevScore = this.score;
    let delta = analysis.delta;

    if (analysis.kind === 'pressure') {
      this.pressureStreak++;
      this.calmStreak = 0;
      // 지속적 압박 가중치: 2연속 1.25배, 3연속 1.5배 ... 최대 1.75배
      delta *= 1 + Math.min(this.pressureStreak - 1, 3) * 0.25;
      // 반항(1~2단계)에 대한 강한 대응: AI가 대든 직후 계속 몰아붙이면 추가 점수
      if (prevStage <= 2 && this.pressureStreak >= 2) delta += 4;
    } else if (analysis.kind === 'soft' || analysis.kind === 'end') {
      this.calmStreak++;
      this.pressureStreak = 0;
      delta *= 1 + Math.min(this.calmStreak - 1, 2) * 0.2;
    } else {
      // 중립: 압박이 끊기면 서서히 기세 회복
      this.pressureStreak = 0;
      this.calmStreak = 0;
      delta = Math.min(delta, 0) + this.opts.neutralDrift;
    }

    let maxDown = this.opts.maxDownPerTurn;
    // 기세 반전: 굴복해 있던 AI가 상대가 물러서는 순간 확 기세등등해진다 (기획서 2-2 예시)
    if (analysis.kind === 'end' && prevScore >= 40) {
      const rebound = Math.min(prevScore * this.opts.endReboundRatio, this.opts.endReboundMax);
      delta = Math.min(delta, -rebound);
      maxDown = this.opts.endReboundMax;
    }
    delta = clamp(delta, -maxDown, this.opts.maxUpPerTurn);
    this.score = clamp(Math.round(prevScore + delta), 0, this.maxScore);

    let next = this._stableStage(this.score, prevStage, false);
    // 올라갈 때는 한 번에 한 단계씩
    if (next > prevStage + 1) next = prevStage + 1;
    this.stage = Math.min(next, this.opts.maxStage);
    this.peakStage = Math.max(this.peakStage, this.stage);
    this.lastAt = now;

    return {
      score: this.score,
      stage: this.stage,
      prevStage,
      direction: this.stage > prevStage ? 'up' : this.stage < prevStage ? 'down' : 'same',
      delta: this.score - prevScore,
      atCap: this.stage === this.opts.maxStage && this.score >= this.maxScore - 1,
      limited: this.opts.maxStage < 5,
      kind: analysis.kind,
    };
  }

  /** 히스테리시스를 적용한 단계 계산 */
  _stableStage(score, current, allowMultiDown) {
    const raw = rawStage(score);
    if (raw > current) {
      // 상승: 다음 경계를 약간 넘어야 인정
      let s = current;
      while (s < raw && score >= STAGE_BOUNDS[s] + this.opts.hysteresisUp) s++;
      // 경계 바로 위(0~1점)에서 멈춘 경우에도 점수가 최대치면 상승 인정
      if (s === current && score >= this.maxScore && raw > current) s = raw;
      return s;
    }
    if (raw < current) {
      let s = current;
      while (s > raw && score < STAGE_BOUNDS[s - 1] - this.opts.hysteresisDown) {
        s--;
        if (!allowMultiDown && s <= raw) break;
      }
      // 경계 근처에서 흔들리면 현재 단계 유지, 크게 떨어지면 raw까지
      return Math.max(s, raw);
    }
    return current;
  }
}
