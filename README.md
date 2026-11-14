# 굽신 (GOOPSIN) — AI가 굽신대는 사과 앱

욕은 마음껏, 사죄는 무조건! 무료 MVP (PWA, 서버·유료 API 없음)

## 실행
- PC: `python3 -m http.server 8080` → http://localhost:8080
- 테스트: `npm test` (엔진 단위 테스트, Node 18+)

## 휴대폰(Android Chrome)에서 음성으로 쓰려면
마이크와 앱 설치는 **HTTPS 주소**에서만 동작합니다. 무료 호스팅 중 하나에 이 폴더를 그대로 올리세요.
- **Netlify Drop**: PC에서 https://app.netlify.com/drop 에 `goopsin` 폴더를 끌어다 놓기 → 나온 주소를 폰에서 열기
- **GitHub Pages**: 저장소에 올린 뒤 Settings → Pages → Branch: main / root

폰 Chrome에서 열고 메뉴 → "홈 화면에 추가"하면 앱처럼 설치됩니다.

## 구조
```
index.html, css/style.css, manifest.json, sw.js, icons/
js/app.js                     화면·음성·엔진 연결
js/ModeManager.js             모드 관리
js/SettingsManager.js         설정(Local Storage)
js/voice/SpeechRecognition.js STT (Web Speech, 교체형 팩토리)
js/voice/SpeechOutput.js      TTS (기기 내장 음성, 교체형 팩토리)
js/engine/EmotionAnalyzer.js  사용자 태도 분석 (규칙 기반)
js/engine/SubmissionEngine.js 역동적 굴복 시스템(DSS): 점수 0~100, 5단계
js/engine/ResponseGenerator.js 대사 선택
js/engine/EmotionEngine.js    단계별 연기(속도·음높이), 5단계 3가지 스타일
js/engine/ConversationEngine.js 대화 흐름
js/data/lines.js              모든 대사 (여기만 고치면 대사 확장)
tests/engine.test.js          단위 테스트
```

## DSS 요약
- 질책·명령·사죄 요구·욕설(상한 있음)·강도 → 점수 상승 / 부드러운 말·수용·종료·중립 → 하락
- 연속 압박 가중(최대 1.75배), 반항 단계에서 몰아붙이면 추가 점수
- 1회 변화 상한(+22/−35), 상승은 한 번에 한 단계, 경계 히스테리시스(+2/−4)
- 30초 이상 조용하면 감쇠, 2분이면 초기화
- 무료: 3단계 상한 (설정의 "5단계 미리보기"로 전체 확인 가능)
