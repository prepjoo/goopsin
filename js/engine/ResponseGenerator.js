/**
 * ResponseGenerator: 단계·흐름·연기 스타일에 맞는 대사를 고른다.
 * 현재는 대사 풀에서 선택(최근 사용 대사 회피). 추후 AI API 생성기로 교체 가능하도록
 * generate(context) 인터페이스를 유지한다.
 */
import { STAGE_LINES, REBOUND_LINES, BASIC_APOLOGIES } from '../data/lines.js';

export class PoolPicker {
  constructor(rng = Math.random, memory = 3) {
    this.rng = rng;
    this.memory = memory;
    this.recent = [];
  }
  pick(pool) {
    if (!pool || !pool.length) return '';
    const fresh = pool.filter((l) => !this.recent.includes(l));
    const candidates = fresh.length ? fresh : pool;
    const line = candidates[Math.floor(this.rng() * candidates.length)];
    this.recent.push(line);
    if (this.recent.length > this.memory) this.recent.shift();
    return line;
  }
}

export class ResponseGenerator {
  constructor({ rng = Math.random } = {}) {
    this.picker = new PoolPicker(rng, 4);
  }

  /**
   * @param {{stage:number, direction:'up'|'down'|'same', prevStage:number, style?:string}} ctx
   */
  generate(ctx) {
    const { stage, direction, prevStage, style } = ctx;
    // 사용자가 부드러워져 단계가 내려가면 기세 회복 대사
    if (direction === 'down' && prevStage >= 2 && REBOUND_LINES[stage]) {
      return this.picker.pick(REBOUND_LINES[stage]);
    }
    if (stage === 5) {
      const pool = STAGE_LINES[5][style] || STAGE_LINES[5].grovel;
      return this.picker.pick(pool);
    }
    return this.picker.pick(STAGE_LINES[stage] || STAGE_LINES[1]);
  }
}

/** 기본 굴복 모드용: 무조건 사죄 (직전 문구는 반복하지 않음) */
export class BasicApologyGenerator {
  constructor({ rng = Math.random, lines = BASIC_APOLOGIES } = {}) {
    this.lines = lines;
    this.picker = new PoolPicker(rng, 1);
  }
  generate() {
    return this.picker.pick(this.lines);
  }
}
