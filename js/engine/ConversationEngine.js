/**
 * ConversationEngine: 대화 흐름 관리.
 * 발화 → 분석(EmotionAnalyzer) → 굴복 점수/단계(SubmissionEngine)
 *      → 연기 스타일(EmotionEngine) → 대사(ResponseGenerator) → 결과 반환
 * UI·음성과 분리되어 있어 Node에서도 단위 테스트할 수 있다.
 */
import { analyze } from './EmotionAnalyzer.js';
import { SubmissionEngine } from './SubmissionEngine.js';
import { ResponseGenerator, BasicApologyGenerator } from './ResponseGenerator.js';
import { EmotionEngine } from './EmotionEngine.js';
import { STAGES } from '../data/lines.js';

export class BattleConversation {
  constructor({ maxStage = 3, rng = Math.random, analyzer = analyze } = {}) {
    this.analyzer = analyzer; // 추후 AI API 기반 분석기로 교체 가능
    this.submission = new SubmissionEngine({ maxStage });
    this.responder = new ResponseGenerator({ rng });
    this.emotion = new EmotionEngine({ rng });
    this.history = [];
  }

  setMaxStage(n) { this.submission.setMaxStage(n); }

  reset() {
    this.submission.reset();
    this.history = [];
  }

  /** 대화 시작 시 첫 마디 */
  opening() {
    return {
      text: '뭐야, 왜 불렀어? 할 말 있으면 해 봐.',
      stage: 1, score: 0,
      persona: this.emotion.persona(1),
      voiceStage: 1, style: null,
    };
  }

  respond(userText, now = Date.now()) {
    const analysis = this.analyzer(userText, this.history);
    const state = this.submission.update(analysis, now);
    const style = this.emotion.pickStyle(state.stage);
    const text = this.responder.generate({ ...state, style });
    const turn = {
      user: userText,
      text,
      analysis,
      ...state,
      style,
      stageName: STAGES[state.stage].name,
      persona: this.emotion.persona(state.stage, style),
      voiceStage: state.stage,
    };
    this.history.push(turn);
    if (this.history.length > 20) this.history.shift();
    return turn;
  }
}

export class BasicConversation {
  constructor({ rng = Math.random } = {}) {
    this.gen = new BasicApologyGenerator({ rng });
    this.emotion = new EmotionEngine({ rng });
  }
  reset() {}
  opening() {
    return { text: '네! 무엇이든 말씀만 하십시오!', stage: 5, persona: { face: '🙇', label: '무조건 굴복' }, voiceStage: 5, style: 'grovel' };
  }
  respond(userText) {
    const style = this.emotion.pickStyle(5);
    return {
      user: userText,
      text: this.gen.generate(),
      stage: 5,
      style,
      persona: { face: '🙇', label: '무조건 굴복' },
      voiceStage: 5,
    };
  }
}
