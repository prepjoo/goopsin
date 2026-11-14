/**
 * ResponseGenerator: 단계·흐름·연기 스타일에 맞는 대사를 고른다.
 * 현재는 대사 풀에서 선택(최근 사용 대사 회피). 추후 AI API 생성기로 교체 가능하도록
 * generate(context) 인터페이스를 유지한다.
 */
import { STAGE_LINES, REBOUND_LINES, BASIC_APOLOGIES, CAP_LINES, OPENING_LINES } from '../data/lines.js';

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
    this.rng = rng;
    this.picker = new PoolPicker(rng, 4);
    this.capCount = 0;
  }

  /**
   * @param {{stage:number, direction:'up'|'down'|'same', prevStage:number, style?:string}} ctx
   */
  generate(ctx) {
    const { stage, direction, prevStage, style, atCap, limited, kind } = ctx;
    // 크게 반전(2단계 이상 하락): "뭐야? 벌써 끝내는 거야?" 류의 기세등등 대사
    if (direction === 'down' && prevStage - stage >= 2) {
      return this.picker.pick(REBOUND_LINES[1]);
    }
    // 무료 버전 상한에서 계속 몰아붙이면 버티기 대사를 번갈아 섞는다
    if (limited && atCap && direction === 'same' && kind === 'pressure') {
      this.capCount++;
      if (this.capCount % 2 === 0) return this.picker.pick(CAP_LINES);
    } else {
      this.capCount = 0;
    }
    // 사용자가 부드러워져 단계가 내려가면 기세 회복 대사
    // (단계는 그대로여도 1~2단계에서 상대가 부드럽게 나오면 맞대응 대신 기세등등)
    const softened = (kind === 'soft' || kind === 'end') && direction === 'same' && stage <= 2;
    if (softened || (direction === 'down' && prevStage >= 2 && REBOUND_LINES[stage])) {
      return this.picker.pick(REBOUND_LINES[stage]);
    }
    if (stage === 5) {
      const pool = STAGE_LINES[5][style] || STAGE_LINES[5].grovel;
      return this.picker.pick(pool);
    }
    return this.picker.pick(STAGE_LINES[stage] || STAGE_LINES[1]);
  }
}

/** 시작 첫 마디: 빈정거리며 먼저 말 걸기 */
export function pickOpening(rng = Math.random) {
  return OPENING_LINES[Math.floor(rng() * OPENING_LINES.length)];
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
