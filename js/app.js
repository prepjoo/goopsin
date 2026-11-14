// 굽신 앱 진입점: 화면, 음성 입출력, 엔진 연결
import { SettingsManager } from './SettingsManager.js';
import { ModeManager, MODES } from './ModeManager.js';
import { createVoiceInput } from './voice/SpeechRecognition.js';
import { createSpeechOutput } from './voice/SpeechOutput.js';
import { ClipSpeechOutput } from './voice/ClipSpeechOutput.js';
import { EmotionEngine } from './engine/EmotionEngine.js';
import { Character, expressionFor } from './ui/Character.js';

const $ = (id) => document.getElementById(id);

const settings = new SettingsManager();
const modes = new ModeManager(settings);
// 녹음 파일(audio/*.mp3)이 있으면 우선 재생, 없으면 기기 내장 음성
const tts = new ClipSpeechOutput(createSpeechOutput({ lang: 'ko-KR' }));
tts.load();
const stt = createVoiceInput({ lang: 'ko-KR' });
const acting = new EmotionEngine();

const character = new Character($('char-face'));
const homeChar = new Character($('home-char'));
// 메인 화면: 건방 → 굽신을 번갈아 보여 주는 로고 캐릭터
const HOME_LOOP = ['cocky', 'annoyed', 'nervous', 'timid', 'grovel'];
let homeIdx = 0;
setInterval(() => {
  if (modes.mode || document.hidden) return;
  homeIdx = (homeIdx + 1) % HOME_LOOP.length;
  homeChar.set(HOME_LOOP[homeIdx]);
}, 1600);

let busy = false;        // AI가 말하는 중
let handsFree = false;   // 자동으로 계속 듣기 (말하면 바로 인식)
let quickFails = 0;      // 듣기가 곧바로 끊기는 횟수 (무한 재시작 방지)
let listenStartedAt = 0;
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
  handsFree = Boolean(settings.get('autoListen')) && stt.isSupported;
  quickFails = 0;
  const first = modes.conversation.opening();
  render(first);
  setGauge(0, 1);
  speakTurn(first);
  if (!stt.isSupported) setStatus('음성 인식 미지원 브라우저예요. 아래 입력창에 써 주세요.');
}

$('btn-end').addEventListener('click', endTalk);

function endTalk() {
  sessionId++;
  handsFree = false;
  stt.stop();
  tts.cancel();
  busy = false;
  character.setSpeaking(false);
  modes.end();
  setMic('idle');
  show('screen-home');
}

// ---------------- 렌더링 ----------------
function render(turn) {
  $('ai-line').textContent = turn.text;
  // 굴복 게이지(단계·점수)에 맞춰 표정과 자세를 바꾼다
  character.set(expressionFor(turn.stage, turn.style), typeof turn.score === 'number' ? turn.score : null);
  character.react(turn.direction);
  $('char-state').textContent = turn.persona.label;
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
  const paused = state === 'idle' && modes.conversation && stt.isSupported && !handsFree && settings.get('autoListen');
  b.classList.toggle('listening', state === 'listening');
  b.classList.toggle('busy', state === 'busy');
  b.classList.toggle('paused', Boolean(paused));
  b.querySelector('.mic-icon').textContent = state === 'listening' ? '👂' : state === 'busy' ? '🔊' : paused ? '🔇' : '🎤';
  b.setAttribute('aria-label', state === 'listening' ? '듣기 멈춤' : '듣기 시작');
}

function idleStatus() {
  if (!stt.isSupported) return '아래 입력창에 써 주세요';
  return handsFree ? '듣고 있어요… 야단쳐 보세요!' : '마이크를 누르면 다시 들어요';
}

// ---------------- 음성 출력 ----------------
async function speakTurn(turn) {
  const mySession = sessionId;
  busy = true;
  stt.stop(); // 자기 목소리를 듣지 않도록
  setMic('busy');
  setStatus(tts.isSupported ? 'AI가 말하는 중…' : '이 기기에서는 음성 출력을 지원하지 않아요.');
  character.setSpeaking(true);
  const v = acting.voice(turn.voiceStage, turn.style, { rate: settings.get('rate'), pitch: settings.get('pitch') });
  await tts.speak(turn.text, v);
  if (mySession !== sessionId) return;
  character.setSpeaking(false);
  busy = false;
  setMic('idle');
  setStatus(idleStatus());
  if (handsFree) listen();
}

// ---------------- 음성 입력 (자동으로 계속 듣기) ----------------
// 브라우저 음성 인식은 한 문장을 듣거나 조용하면 스스로 끝난다.
// 그래서 끝날 때마다 다시 시작해, 마이크를 누르지 않아도 말하면 바로 인식되게 한다.
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'unsupported']);

stt.onStateChange = (listening) => {
  if (busy) return;
  if (listening) {
    listenStartedAt = Date.now();
    setMic('listening');
    setStatus('듣고 있어요… 야단쳐 보세요!');
    return;
  }
  setMic('idle');
  if (!handsFree || !modes.conversation) { setStatus(idleStatus()); return; }
  // 시작하자마자 끊기는 일이 계속되면 멈춘다 (권한·기기 문제로 인한 무한 반복 방지)
  quickFails = Date.now() - listenStartedAt < 700 ? quickFails + 1 : 0;
  if (quickFails >= 5) {
    handsFree = false;
    setMic('idle');
    setStatus('음성 인식이 계속 끊겨요. 마이크를 눌러 다시 시작해 주세요.');
    return;
  }
  const keep = sessionId;
  setTimeout(() => { if (keep === sessionId && handsFree && !busy) listen(); }, 250);
};
stt.onInterim = (text) => {
  $('user-line').textContent = text;
  $('user-line').classList.add('interim');
};
stt.onFinal = (text) => { quickFails = 0; handleUser(text); };
stt.onError = (code, msg) => {
  if (busy) return;
  if (FATAL.has(code)) {
    handsFree = false;
    setMic('idle');
    setStatus(msg);
  } else if (!handsFree) {
    setStatus(msg);
  }
  // 그 외(말소리 없음 등)는 자동으로 다시 듣는다
};

function listen() {
  if (busy || !modes.conversation) return;
  stt.start();
}

// 다른 앱으로 가거나 화면이 꺼지면 듣기를 멈추고, 돌아오면 다시 듣는다
document.addEventListener('visibilitychange', () => {
  if (!modes.conversation) return;
  if (document.hidden) stt.stop();
  else if (handsFree && !busy) listen();
});

$('btn-mic').addEventListener('click', () => {
  if (busy) { // 말하는 중에 누르면 끊고 바로 듣기
    sessionId++;
    tts.cancel();
    busy = false;
    character.setSpeaking(false);
    handsFree = Boolean(settings.get('autoListen')) && stt.isSupported;
    quickFails = 0;
    setMic('idle');
    const keep = sessionId;
    setTimeout(() => keep === sessionId && listen(), 120);
    return;
  }
  if (stt.listening) { // 듣는 중에 누르면 일시 정지
    handsFree = false;
    stt.stop();
    setMic('idle');
    setStatus(idleStatus());
  } else {
    handsFree = Boolean(settings.get('autoListen')) && stt.isSupported;
    quickFails = 0;
    listen();
  }
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
window.__goopsin = { modes, settings, tts, stt, character };
