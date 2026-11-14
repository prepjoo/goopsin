// ModeManager: 모드(기본 굴복 / AI 대결)와 화면 전환 관리
import { BattleConversation, BasicConversation } from './engine/ConversationEngine.js';

export const MODES = {
  basic: { label: '기본 굴복 모드', showGauge: false },
  battle: { label: 'AI 대결 모드', showGauge: true },
};

export class ModeManager {
  constructor(settings) {
    this.settings = settings;
    this.mode = null;
    this.conversation = null;
  }

  get maxStage() { return this.settings.get('fullStages') ? 5 : 3; }

  start(mode) {
    this.mode = mode;
    this.conversation = mode === 'battle'
      ? new BattleConversation({ maxStage: this.maxStage })
      : new BasicConversation();
    return MODES[mode];
  }

  refreshStageLimit() {
    if (this.mode === 'battle') this.conversation.setMaxStage(this.maxStage);
  }

  end() {
    this.conversation?.reset();
    this.mode = null;
    this.conversation = null;
  }
}
