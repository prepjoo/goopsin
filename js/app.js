// 굽신 앱 진입점: 화면, 음성 입출력, 엔진 연결
import { SettingsManager } from './SettingsManager.js';
import { ModeManager } from './ModeManager.js';
import { createVoiceInput } from './voice/SpeechRecognition.js';
import { createSpeechOutput } from './voice/SpeechOutput.js';
import { ClipSpeechOutput } from './voice/ClipSpeechOutput.js';
import { EmotionEngine } from './engine/EmotionEngine.js';
import { SessionStats } from './engine/SessionStats.js';
import { Character, expressionFor } from './ui/Character.js';
import { Sfx } from './ui/Sfx.js';
import { drawResultCard, canvasBlob } from './ui/ResultCard.js';

const $ = (id) => document.getElementById(id);

const settings = new SettingsManager();
const modes = new ModeManager(settings);
// 녹음 파일(audio/*.mp3)이 있으면 우선 재생, 없으면 기기 내장 음성
const tts = new ClipSpeechOutput(createSpeechOutput({ lang: 'ko-KR' }));
tts.load();
const stt = createVoiceInput({ lang: 'ko-KR' });
const acting = new EmotionEngine();
const sfx = new Sfx();
sfx.enabled = settings.get('sfx') !== false;

// 화면 파일(index.html)이 예전 버전으로 남아 있어도 앱이 멈추지 않도록, 자리가 없으면 만들어서 쓴다
function slot(id, fallbackSelector, tag = 'div') {
  let el = $(id);
  if (!el) {
    el = (fallbackSelector && document.querySelector(fallbackSelector)) || document.createElement(tag);
    el.id = id;
  }
  return el;
}
const charEl = slot('char-face', '.char-face'); charEl.textContent = '';
const homeEl = slot('home-char', '.logo'); homeEl.textContent = '';
const character = new Character(charEl);
const homeChar = new Character(homeEl);
const snapChar = new Character(document.createElement('div')); // 결과 카드용 (화면에 보이지 않음)
const logEl = slot('log', '.dialog');
const quipEl = slot('home-quip');

// 메인 화면: 건방 → 굽신을 번갈아 보여 주며 한마디씩
const HOME_LOOP = [
  ['cocky', '뭘 봐요?'], ['annoyed', '나도 할 말은 있거든?'], ['nervous', '아, 아니 그게…'],
  ['timid', '미안해… 그만 혼내…'], ['grovel', '죽을죄를 지었습니다!'],
];
let homeIdx = 0;
setInterval(() => {
  if (modes.mode || document.hidden || !$('screen-home').classList.contains('active')) return;
  homeIdx = (homeIdx + 1) % HOME_LOOP.length;
  homeChar.set(HOME_LOOP[homeIdx][0]);
  quipEl.textContent = HOME_LOOP[homeIdx][1];
  quipEl.style.animation = 'none'; void quipEl.offsetWidth; quipEl.style.animation = '';
}, 2200);

let busy = false;        // AI가 말하는 중
let handsFree = false;   // 자동으로 계속 듣기 (말하면 바로 인식)
let quickFails = 0;      // 듣기가 곧바로 끊기는 횟수 (무한 재시작 방지)
let listenStartedAt = 0;
let sessionId = 0;       // 대화 종료 후 늦게 도착한 콜백 무시용
let stats = null;        // 이번 대화 기록
let lastMode = 'battle';
let lastSummary = null;

// ---------------- 화면 전환 ----------------
function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === screenId));
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-mode]').forEach((btn) =>
  btn.addEventListener('click', () => { history.pushState({ talk: true }, ''); startMode(btn.dataset.mode); })
);

function startMode(mode) {
  sessionId++;
  lastMode = mode;
  const info = modes.start(mode);
  stats = new SessionStats(mode);
  $('talk-mode-label').textContent = info.label;
  $('gauge-wrap').hidden = !info.showGauge;
  logEl.textContent = '';
  updateLock();
  show('screen-talk');
  handsFree = Boolean(settings.get('autoListen')) && stt.isSupported;
  quickFails = 0;
  const first = modes.conversation.opening();
  setGauge(0, 1);
  render(first, true);
  speakTurn(first);
  if (!stt.isSupported) setStatus('음성 인식 미지원 브라우저예요. 아래 입력창에 써 주세요.');
}

$('btn-end').addEventListener('click', () => endTalk(true));

function stopTalk() {
  sessionId++;
  handsFree = false;
  stt.stop();
  tts.cancel();
  busy = false;
  character.setSpeaking(false);
  character.setListening(false);
  setMic('idle');
}

function endTalk(withResult) {
  const s = stats;
  stopTalk();
  modes.end();
  stats = null;
  if (withResult && s && s.turns > 0) showResult(s.summary());
  else show('screen-home');
}

// ---------------- 대화 기록 (말풍선) ----------------
function addMsg(who, text) {
  logEl.querySelectorAll('.interim').forEach((n) => n.remove());
  logEl.querySelectorAll('.latest').forEach((n) => n.classList.remove('latest'));
  const el = document.createElement('div');
  el.className = `msg ${who}${who === 'ai' ? ' latest' : ''}`;
  el.textContent = text;
  logEl.appendChild(el);
  const all = logEl.querySelectorAll('.msg');
  all.forEach((n, i) => n.classList.toggle('old', i < all.length - 4));
  while (logEl.children.length > 40) logEl.firstChild.remove();
  logEl.scrollTop = logEl.scrollHeight;
}

function setInterim(text) {
  let el = logEl.querySelector('.interim');
  if (!el) {
    el = document.createElement('div');
    el.className = 'msg me interim';
    logEl.appendChild(el);
  }
  el.textContent = text;
  logEl.scrollTop = logEl.scrollHeight;
}

// 화면 크기가 바뀌어도(상태 문구가 길어지는 등) 마지막 말풍선이 보이게 한다
if (window.ResizeObserver) new ResizeObserver(() => { logEl.scrollTop = logEl.scrollHeight; }).observe(logEl);

// ---------------- 렌더링 ----------------
function render(turn, isOpening = false) {
  $('ai-line').textContent = turn.text;
  addMsg('ai', turn.text);
  // 굴복 게이지(단계·점수)에 맞춰 표정·자세·배경을 바꾼다
  character.set(expressionFor(turn.stage, turn.style), typeof turn.score === 'number' ? turn.score : null);
  character.react(turn.direction);
  $('char-state').textContent = turn.persona.label;
  const talk = $('screen-talk');
  talk.dataset.stage = String(turn.stage);
  if (typeof turn.score === 'number' && modes.mode === 'battle') setGauge(turn.score, turn.stage, turn.direction);
  if (isOpening) return;
  if (turn.direction === 'up') {
    const top = turn.stage >= 5;
    sfx.play(top ? 'max' : 'up');
    if (top) { talk.classList.remove('quake'); void talk.offsetWidth; talk.classList.add('quake'); }
  } else if (turn.direction === 'down') {
    sfx.play('down');
  }
}

const STAGE_COLORS = ['#ff4d4d', '#ff8c42', '#ffc23d', '#7bc96f', '#4dabf7'];
function setGauge(score, stage, direction) {
  $('gauge-fill').style.width = `${score}%`;
  $('gauge').setAttribute('aria-valuenow', String(score));
  $('gauge-stage').textContent = `${stage}단계 · ${score}점`;
  const m = $('gauge-marker');
  if (!m) return;
  m.style.left = `${Math.min(97, Math.max(3, score))}%`;
  m.style.borderColor = STAGE_COLORS[stage - 1] || STAGE_COLORS[0];
  m.textContent = String(stage);
  if (direction === 'up' || direction === 'down') { m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); }
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
  character.setListening(state === 'listening');
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
stt.onInterim = (text) => setInterim(text);
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
  addMsg('me', text);
  sfx.play('send');
  const turn = modes.conversation.respond(text);
  if (stats) stats.record(turn);
  render(turn);
  speakTurn(turn);
}

// ---------------- 결과 화면 ----------------
async function showResult(sum) {
  lastSummary = sum;
  show('screen-result');
  $('result-note').textContent = '';
  snapChar.set(sum.expression, sum.mode === 'battle' ? sum.peakStage * 20 : 100);
  await drawResultCard($('result-canvas'), sum, snapChar.toImageSVG(420));
  sfx.play('result');
}

function shareText(sum) {
  return `굽신이를 굴복시켰다! ${sum.headline} (칭호: ${sum.title})\n욕은 마음껏, 사죄는 무조건! ${location.origin}${location.pathname}`;
}

async function saveImage(blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'goopsin-result.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  $('result-note').textContent = '이미지를 저장했어요.';
}

$('btn-save').addEventListener('click', async () => {
  const blob = await canvasBlob($('result-canvas'));
  if (blob) saveImage(blob);
});

$('btn-share').addEventListener('click', async () => {
  const blob = await canvasBlob($('result-canvas'));
  if (!blob || !lastSummary) return;
  const file = new File([blob], 'goopsin-result.png', { type: 'image/png' });
  const text = shareText(lastSummary);
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '굽신 결과', text });
    } else if (navigator.share) {
      await navigator.share({ title: '굽신 결과', text });
    } else {
      // 공유 기능이 없는 브라우저: 이미지를 저장하고 문구는 복사
      saveImage(blob);
      try { await navigator.clipboard.writeText(text); $('result-note').textContent = '이미지를 저장하고 소개 문구를 복사했어요.'; } catch { /* 복사 불가 */ }
    }
  } catch (err) {
    if (err && err.name !== 'AbortError') $('result-note').textContent = '공유하지 못했어요. 이미지 저장을 이용해 주세요.';
  }
});

$('btn-again').addEventListener('click', () => { history.pushState({ talk: true }, ''); startMode(lastMode); });
$('btn-home').addEventListener('click', () => show('screen-home'));

// ---------------- 사용법 안내 ----------------
const GUIDE = [
  ['🎤', '마이크를 허용해 주세요', '굽신은 말로 하는 앱이에요. 처음 시작할 때 마이크 권한을 허용하면, 버튼을 누르지 않아도 말하는 대로 알아들어요.'],
  ['🗯️', '마음껏 야단치세요', '"야! 너 맨날 왜 그래?"처럼 말해 보세요. 처음엔 대들지만, 계속 몰아붙이면 굴복 게이지가 차오르며 기가 죽어요.'],
  ['🙇', '굴복시키고 자랑하기', '부드럽게 말하면 다시 기어오르니 방심은 금물! 대화를 끝내면 나오는 결과 카드를 친구에게 공유해 보세요.'],
];
let guideIdx = 0;
const guideDlg = $('guide');
function renderGuide() {
  const [emoji, title, text] = GUIDE[guideIdx];
  $('guide-emoji').textContent = emoji;
  $('guide-title').textContent = title;
  $('guide-text').textContent = text;
  guideDlg.querySelectorAll('.guide-dots i').forEach((d, i) => d.classList.toggle('on', i === guideIdx));
  $('guide-next').textContent = guideIdx === GUIDE.length - 1 ? '시작하기' : '다음';
}
function openGuide() { if (!guideDlg || !guideDlg.showModal) return; guideIdx = 0; renderGuide(); guideDlg.showModal(); }
function closeGuide() { settings.set('seenGuide', true); guideDlg.close(); }
if (guideDlg) {
  $('guide-next').addEventListener('click', () => { if (guideIdx < GUIDE.length - 1) { guideIdx++; renderGuide(); } else closeGuide(); });
  $('guide-skip').addEventListener('click', closeGuide);
  guideDlg.addEventListener('cancel', () => settings.set('seenGuide', true));
  $('btn-guide').addEventListener('click', openGuide);
  if (!settings.get('seenGuide')) openGuide();
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
  if ($('set-sfx')) $('set-sfx').checked = settings.get('sfx') !== false;
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
if ($('set-sfx')) $('set-sfx').addEventListener('change', (e) => { settings.set('sfx', e.target.checked); sfx.enabled = e.target.checked; if (e.target.checked) sfx.play('up'); });
$('btn-test-voice').addEventListener('click', () => {
  tts.fallback.speak('아이고! 정말 죄송합니다! 제가 잘못했습니다!', acting.voice(5, 'grovel', { rate: settings.get('rate'), pitch: settings.get('pitch') }));
});

tts.voiceURI = settings.get('voiceURI');
settings.onChange((k, v) => { if (k === 'voiceURI') tts.voiceURI = v; });

// 뒤로가기(안드로이드): 대화 중이면 결과 화면으로, 결과 화면이면 처음으로
window.addEventListener('popstate', () => {
  if (modes.mode) endTalk(true);
  else if ($('screen-result').classList.contains('active')) show('screen-home');
});

// ---------------- PWA ----------------
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// 디버그/테스트용 훅
window.__goopsin = { modes, settings, tts, stt, character, sfx };
