// 굽신 앱 진입점: 화면, 음성 입출력, 엔진 연결
import { SettingsManager } from './SettingsManager.js';
import { ModeManager, MODES } from './ModeManager.js';
import { createVoiceInput } from './voice/SpeechRecognition.js';
import { createSpeechOutput } from './voice/SpeechOutput.js';
import { EmotionEngine } from './engine/EmotionEngine.js';

const $ = (id) => document.getElementById(id);

const settings = new SettingsManager();
const modes = new ModeManager(settings);
const tts = createSpeechOutput({ lang: 'ko-KR' });
const stt = createVoiceInput({ lang: 'ko-KR' });
const acting = new EmotionEngine();

let busy = false;        // AI가 말하는 중
let sessionId = 0;       // 대화 종료 후 늦게 도착한 콜백 무시용

// ---------------- 화면 전환 ----------------
function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === screenId));
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => startMode(btn.dataset.mode))
);

function startMode(mode) {
  sessionId++;
  const info = modes.start(mode);
  $('talk-mode-label').textContent = info.label;
  $('gauge-wrap').hidden = !info.showGauge;
  $('user-line').textContent = '…';
  $('user-line').classList.remove('interim');
  updateLock();
  show('screen-talk');
  const first = modes.conversation.opening();
  render(first);
  setGauge(0, 1);
  speakTurn(first);
  if (!stt.isSupported) setStatus('음성 인식 미지원 브라우저예요. 아래 입력창에 써 주세요.');
}

$('btn-end').addEventListener('click', endTalk);

function endTalk() {
  sessionId++;
  stt.stop();
  tts.cancel();
  busy = false;
  modes.end();
  setMic('idle');
  show('screen-home');
}

// ---------------- 렌더링 ----------------
function render(turn) {
  $('ai-line').textContent = turn.text;
  const face = $('char-face');
  face.textContent = turn.persona.face;
  $('char-state').textContent = turn.persona.label;
  face.classList.remove('pop', 'shake');
  void face.offsetWidth; // 애니메이션 재시작
  if (turn.direction === 'up') face.classList.add('shake');
  else if (turn.direction === 'down') face.classList.add('pop');
  if (typeof turn.score === 'number' && modes.mode === 'battle') setGauge(turn.score, turn.stage);
}

function setGauge(score, stage) {
  $('gauge-fill').style.width = `${score}%`;
  $('gauge').setAttribute('aria-valuenow', String(score));
  $('gauge-stage').textContent = `${stage}단계 · ${score}점`;
}

function updateLock() {
  $('gauge-lock').hidden = modes.maxStage >= 5;
}

function setStatus(msg) { $('status').textContent = msg; }

function setMic(state) {
  const b = $('btn-mic');
  b.classList.toggle('listening', state === 'listening');
  b.classList.toggle('busy', state === 'busy');
  b.querySelector('.mic-icon').textContent = state === 'listening' ? '⏹️' : state === 'busy' ? '🔊' : '🎤';
  b.setAttribute('aria-label', state === 'listening' ? '듣기 중지' : '말하기');
}

// ---------------- 음성 출력 ----------------
async function speakTurn(turn) {
  const mySession = sessionId;
  busy = true;
  stt.stop(); // 자기 목소리를 듣지 않도록
  setMic('busy');
  setStatus(tts.isSupported ? 'AI가 말하는 중…' : '이 기기에서는 음성 출력을 지원하지 않아요.');
  $('char-face').classList.add('speaking');
  const v = acting.voice(turn.voiceStage, turn.style, { rate: settings.get('rate'), pitch: settings.get('pitch') });
  await tts.speak(turn.text, v);
  if (mySession !== sessionId) return;
  $('char-face').classList.remove('speaking');
  busy = false;
  setMic('idle');
  setStatus(stt.isSupported ? '마이크를 누르고 말해 보세요' : '아래 입력창에 써 주세요');
  if (settings.get('autoListen') && stt.isSupported && modes.conversation) {
    listen();
  }
}

// ---------------- 음성 입력 ----------------
stt.onStateChange = (listening) => {
  if (busy) return;
  setMic(listening ? 'listening' : 'idle');
  if (listening) setStatus('듣고 있어요… 야단쳐 보세요!');
  else if ($('status').textContent.startsWith('듣고')) setStatus('마이크를 누르고 말해 보세요');
};
stt.onInterim = (text) => {
  $('user-line').textContent = text;
  $('user-line').classList.add('interim');
};
stt.onFinal = (text) => handleUser(text);
stt.onError = (code, msg) => {
  if (busy) return;
  setStatus(msg);
};

function listen() {
  if (busy || !modes.conversation) return;
  stt.start();
}

$('btn-mic').addEventListener('click', () => {
  if (busy) { // 말하는 중에 누르면 끊고 바로 듣기
    sessionId++;
    tts.cancel();
    busy = false;
    $('char-face').classList.remove('speaking');
    setMic('idle');
    const keep = sessionId;
    setTimeout(() => keep === sessionId && listen(), 120);
    return;
  }
  if (stt.listening) stt.stop();
  else listen();
});

$('text-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('text-input').value.trim();
  if (!v) return;
  $('text-input').value = '';
  handleUser(v);
});

function handleUser(text) {
  if (!modes.conversation) return;
  sessionId++;
  stt.stop();
  $('user-line').textContent = text;
  $('user-line').classList.remove('interim');
  const turn = modes.conversation.respond(text);
  render(turn);
  speakTurn(turn);
}

// ---------------- 설정 ----------------
const dlg = $('settings');
$('btn-settings').addEventListener('click', () => {
  fillVoices();
  $('set-rate').value = settings.get('rate');
  $('set-pitch').value = settings.get('pitch');
  $('out-rate').textContent = Number(settings.get('rate')).toFixed(2);
  $('out-pitch').textContent = Number(settings.get('pitch')).toFixed(2);
  $('set-auto').checked = settings.get('autoListen');
  $('set-full').checked = settings.get('fullStages');
  dlg.showModal();
});

function fillVoices() {
  const sel = $('set-voice');
  const voices = tts.listVoices();
  sel.innerHTML = '<option value="">기본 한국어 음성</option>' +
    voices.map((v) => `<option value="${escapeHtml(v.voiceURI)}">${escapeHtml(v.name)}</option>`).join('');
  sel.value = settings.get('voiceURI') || '';
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

$('set-voice').addEventListener('change', (e) => settings.set('voiceURI', e.target.value));
$('set-rate').addEventListener('input', (e) => { settings.set('rate', Number(e.target.value)); $('out-rate').textContent = Number(e.target.value).toFixed(2); });
$('set-pitch').addEventListener('input', (e) => { settings.set('pitch', Number(e.target.value)); $('out-pitch').textContent = Number(e.target.value).toFixed(2); });
$('set-auto').addEventListener('change', (e) => settings.set('autoListen', e.target.checked));
$('set-full').addEventListener('change', (e) => { settings.set('fullStages', e.target.checked); modes.refreshStageLimit(); updateLock(); });
$('btn-test-voice').addEventListener('click', () => {
  tts.speak('아이고! 정말 죄송합니다! 제가 잘못했습니다!', acting.voice(5, 'grovel', { rate: settings.get('rate'), pitch: settings.get('pitch') }));
});

tts.voiceURI = settings.get('voiceURI');
settings.onChange((k, v) => { if (k === 'voiceURI') tts.voiceURI = v; });

// 뒤로가기(안드로이드)로 대화 화면을 닫을 수 있게
window.addEventListener('popstate', () => { if (modes.mode) endTalk(); });
document.querySelectorAll('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => history.pushState({ talk: true }, ''))
);

// ---------------- PWA ----------------
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// 디버그/테스트용 훅
window.__goopsin = { modes, settings, tts, stt };
