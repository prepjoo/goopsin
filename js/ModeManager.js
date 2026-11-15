// ModeManager: 캐릭터(무례한·깐족이·겸손이·굽신이)와 대화 엔진 관리
import { BattleConversation, BasicConversation } from './engine/ConversationEngine.js';
import { PERSONAS } from './data/personas.js';

export class ModeManager {
  constructor(settings) {
    this.settings = settings;
    this.mode = null;
    this.info = null;
    this.conversation = null;
  }

  get maxStage() { return this.settings.get('fullStages') ? 5 : 3; }

  start(mode) {
    // 예전 주소·버튼 이름과의 호환
    const key = mode === 'battle' ? 'teaser' : mode === 'basic' ? 'goopsin' : mode;
    const p = PERSONAS[key] || PERSONAS.teaser;
    this.mode = p.key;
    this.info = { label: `${p.name} · ${p.level}`, name: p.name, level: p.level, showGauge: p.battle, persona: p };
    this.conversation = p.battle
      ? new BattleConversation({ maxStage: this.maxStage, persona: p })
      : new BasicConversation();
    return this.info;
  }

  refreshStageLimit() {
    if (this.info && this.info.showGauge) this.conversation.setMaxStage(this.maxStage);
  }

  end() {
    this.conversation?.reset();
    this.mode = null;
    this.info = null;
    this.conversation = null;
  }
}
