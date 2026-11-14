// 굽신 서비스 워커: 앱 셸 캐시 (오프라인에서도 화면과 기본 굴복 모드 동작)
const CACHE = 'goopsin-v5';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './js/app.js', './js/SettingsManager.js', './js/ModeManager.js',
  './js/data/lines.js', './js/data/clips.js', './js/voice/ClipSpeechOutput.js',
  './js/voice/SpeechRecognition.js', './js/voice/SpeechOutput.js',
  './js/engine/EmotionAnalyzer.js', './js/engine/SubmissionEngine.js',
  './js/engine/ResponseGenerator.js', './js/engine/EmotionEngine.js',
  './js/engine/ConversationEngine.js', './js/engine/RetortGenerator.js', './js/data/retorts.js', './js/ui/Character.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 네트워크 우선, 실패하면 캐시 (개발 중 수정 사항이 바로 반영되도록)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
