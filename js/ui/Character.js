/**
 * Character: 굽신 캐릭터 "굽신이" (SVG).
 * 굴복 단계에 따라 표정·자세가 바뀌고, 굴복 점수에 따라 몸이 점점 움츠러든다.
 *   set(expression, score)  expression: cocky|annoyed|nervous|timid|sob|panic|grovel
 *   setSpeaking(bool)       말하는 동안 입이 움직인다
 *   react('up'|'down')      단계가 바뀔 때 움찔/으쓱
 */

const INK = '#4a2408';

// 입 모양: 모두 같은 구조(M Q Q Z)라서 부드럽게 변형된다
const MOUTH = {
  smirk: 'M84 123 Q102 129 119 113 Q102 133 84 123 Z',
  frown: 'M86 127 Q100 116 114 127 Q100 121 86 127 Z',
  small: 'M91 122 Q100 117 109 122 Q100 131 91 122 Z',
  wobble: 'M89 127 Q100 120 111 127 Q100 124 89 127 Z',
  cry: 'M83 119 Q100 111 117 119 Q100 148 83 119 Z',
  gasp: 'M89 115 Q100 106 111 115 Q100 146 89 115 Z',
  flatter: 'M81 118 Q100 123 119 118 Q100 142 81 118 Z',
};

/**
 * 표정 정의
 * lid: 눈꺼풀이 덮는 비율(0~1) / pupil: [dx, dy, 반지름] / eye: 눈 크기 배율
 * closed: 감은 눈 모양('down' 울음, 'up' 아부 웃음) / brow: [왼쪽 각도, 오른쪽 각도, 왼쪽 dy, 오른쪽 dy]
 * hands: 손 위치 / tilt: 몸 기울기 / tuft: 머리 새싹 처짐 각도
 */
const EXPRESSIONS = {
  cocky: { lid: 0.42, pupil: [3, 1, 5.5], eye: 1, brow: [-6, -20, 1, -6], mouth: 'smirk', hands: 'hips', tilt: -5, tuft: -8, extras: [] },
  annoyed: { lid: 0.22, pupil: [0, 1, 5.5], eye: 1, brow: [20, -20, 4, 4], mouth: 'frown', hands: 'crossed', tilt: 0, tuft: 0, extras: ['anger'] },
  nervous: { lid: 0, pupil: [-4, 0, 4.5], eye: 1.05, brow: [-14, 14, -2, -2], mouth: 'small', hands: 'fidget', tilt: 2, tuft: 22, extras: ['sweat'] },
  timid: { lid: 0, pupil: [0, -2, 7.5], eye: 1.18, brow: [-24, 24, -3, -3], mouth: 'wobble', hands: 'pray', tilt: 0, tuft: 45, extras: ['tear', 'blush'] },
  sob: { lid: 0, pupil: [0, 0, 5], eye: 1, closed: 'down', brow: [-26, 26, -2, -2], mouth: 'cry', hands: 'pray', tilt: 0, tuft: 70, extras: ['streams', 'blush'] },
  panic: { lid: 0, pupil: [0, 0, 3], eye: 1.3, brow: [-10, 10, -10, -10], mouth: 'gasp', hands: 'up', tilt: 0, tuft: 30, extras: ['sweat', 'sweat2'] },
  grovel: { lid: 0, pupil: [0, 0, 5], eye: 1, closed: 'up', brow: [-22, 22, -1, -1], mouth: 'flatter', hands: 'rub', tilt: 0, tuft: 60, extras: ['sweat', 'blush'] },
};

const HANDS = {
  hips: [[36, 132], [164, 132]],
  crossed: [[84, 148], [116, 148]],
  fidget: [[90, 152], [110, 152]],
  pray: [[93, 146], [107, 146]],
  up: [[34, 78], [166, 78]],
  rub: [[92, 156], [108, 156]],
};

/** 단계·스타일 → 표정 이름 */
export function expressionFor(stage, style) {
  if (stage >= 5) return EXPRESSIONS[style] ? style : 'grovel';
  return ['cocky', 'cocky', 'annoyed', 'nervous', 'timid'][stage] || 'cocky';
}

const SVG = `
<svg class="goop" viewBox="0 0 200 200" role="img" aria-label="굽신이">
  <defs>
    <linearGradient id="g-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffb35c"/><stop offset="1" stop-color="#ff7a1a"/>
    </linearGradient>
    <clipPath id="g-eyeL"><ellipse cx="78" cy="92" rx="11" ry="13"/></clipPath>
    <clipPath id="g-eyeR"><ellipse cx="122" cy="92" rx="11" ry="13"/></clipPath>
  </defs>
  <ellipse class="g-shadow" cx="100" cy="184" rx="52" ry="7" fill="#000" opacity=".12"/>
  <g class="g-breath"><g class="g-figure">
    <g class="g-tuft">
      <path d="M100 44 C98 30 104 20 114 16 C113 28 108 38 100 44 Z" fill="#6cc04a"/>
      <path d="M100 44 C97 34 90 27 81 26 C84 36 91 42 100 44 Z" fill="#8ad65c"/>
    </g>
    <rect x="38" y="42" width="124" height="136" rx="58" fill="url(#g-body)"/>
    <ellipse cx="74" cy="66" rx="20" ry="9" fill="#fff" opacity=".28" transform="rotate(-24 74 66)"/>
    <g class="g-face">
      <ellipse class="g-blush" cx="60" cy="112" rx="11" ry="6.5" fill="#ff4d6d"/>
      <ellipse class="g-blush" cx="140" cy="112" rx="11" ry="6.5" fill="#ff4d6d"/>
      ${['L', 'R'].map((s) => {
        const cx = s === 'L' ? 78 : 122;
        return `
      <g class="g-eye g-eye${s}" style="transform-origin:${cx}px 92px">
        <g class="g-open" style="transform-origin:${cx}px 92px">
          <ellipse cx="${cx}" cy="92" rx="11" ry="13" fill="#fff"/>
          <g clip-path="url(#g-eye${s})">
            <g class="g-pupil"><circle class="g-pupil-c" cx="${cx}" cy="93" r="5.5" fill="${INK}"/><circle cx="${cx + 2}" cy="90.5" r="1.8" fill="#fff"/></g>
            <rect class="g-lid" x="${cx - 13}" y="53" width="26" height="26" fill="#ffa64d"/>
          </g>
        </g>
        <path class="g-closed g-closed-down" d="M${cx - 10} 90 Q${cx} 100 ${cx + 10} 90" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
        <path class="g-closed g-closed-up" d="M${cx - 10} 95 Q${cx} 85 ${cx + 10} 95" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
      </g>
      <line class="g-brow g-brow${s}" x1="${cx - 10}" y1="72" x2="${cx + 10}" y2="72" stroke="${INK}" stroke-width="4" stroke-linecap="round" style="transform-origin:${cx}px 72px"/>`;
      }).join('')}
      <g class="g-mouth-wrap"><path class="g-mouth" d="${MOUTH.smirk}" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>
      <g class="g-extra g-anger" stroke="#e5383b" stroke-width="3.5" stroke-linecap="round" fill="none">
        <path d="M138 56 q5 -1 5 -6 M149 50 q-1 5 4 6 M143 67 q0 -5 -5 -5 M154 62 q-5 0 -5 5"/>
      </g>
      <path class="g-extra g-sweat" d="M150 62 q7 11 0 16 q-7 -5 0 -16 Z" fill="#7cc8ff"/>
      <path class="g-extra g-sweat2" d="M48 66 q6 9 0 13 q-6 -4 0 -13 Z" fill="#7cc8ff"/>
      <path class="g-extra g-tear" d="M134 100 q5 8 0 11 q-5 -3 0 -11 Z" fill="#7cc8ff"/>
      <g class="g-extra g-streams" fill="#7cc8ff">
        <rect x="73" y="98" width="9" height="42" rx="4.5"/><rect x="118" y="98" width="9" height="42" rx="4.5"/>
      </g>
    </g>
    <g class="g-hand g-handL"><circle r="11" fill="#ffb35c" stroke="#e86a10" stroke-width="2.5"/></g>
    <g class="g-hand g-handR"><circle r="11" fill="#ffb35c" stroke="#e86a10" stroke-width="2.5"/></g>
  </g></g>
</svg>`;

let instanceCount = 0;

export class Character {
  constructor(container) {
    this.el = container;
    // 한 페이지에 캐릭터가 여러 개 있어도 그라데이션·클립 ID가 겹치지 않게 한다
    const uid = `g${++instanceCount}`;
    container.innerHTML = SVG.replace(/g-(body|eyeL|eyeR)(?=["\)])/g, `${uid}-$1`);
    this.q = (sel) => container.querySelector(sel);
    this.all = (sel) => [...container.querySelectorAll(sel)];
    this.current = null;
    this.set('cocky', 0);
  }

  set(name, score = null) {
    const e = EXPRESSIONS[name] || EXPRESSIONS.cocky;
    this.current = name;
    this.el.dataset.expr = name;

    // 눈
    this.all('.g-eye').forEach((g) => {
      g.style.transform = `scale(${e.eye})`;
      g.classList.toggle('is-closed-down', e.closed === 'down');
      g.classList.toggle('is-closed-up', e.closed === 'up');
    });
    this.all('.g-lid').forEach((r) => { r.style.transform = `translateY(${e.lid * 26}px)`; });
    this.all('.g-pupil').forEach((p) => { p.style.transform = `translate(${e.pupil[0]}px, ${e.pupil[1]}px)`; });
    this.all('.g-pupil-c').forEach((c) => c.setAttribute('r', e.pupil[2]));

    // 눈썹
    const [la, ra, ly, ry] = e.brow;
    this.q('.g-browL').style.transform = `translateY(${ly}px) rotate(${la}deg)`;
    this.q('.g-browR').style.transform = `translateY(${ry}px) rotate(${ra}deg)`;

    // 입 (Chrome은 d 속성 전환을 부드럽게 처리, 그 외 브라우저는 즉시 변경)
    const m = this.q('.g-mouth');
    m.setAttribute('d', MOUTH[e.mouth]);
    m.style.d = `path("${MOUTH[e.mouth]}")`;

    // 소품 (땀, 눈물, 화남 표시, 홍조)
    for (const x of ['anger', 'sweat', 'sweat2', 'tear', 'streams']) {
      this.q(`.g-${x}`).classList.toggle('on', e.extras.includes(x));
    }
    this.all('.g-blush').forEach((b) => { b.style.opacity = e.extras.includes('blush') ? 0.55 : 0.18; });

    // 손
    const [l, r] = HANDS[e.hands];
    this.q('.g-handL').style.transform = `translate(${l[0]}px, ${l[1]}px)`;
    this.q('.g-handR').style.transform = `translate(${r[0]}px, ${r[1]}px)`;
    this.el.dataset.hands = e.hands;

    // 머리 새싹: 기가 죽을수록 처진다
    this.q('.g-tuft').style.transform = `rotate(${e.tuft}deg)`;

    // 자세: 굴복 점수가 높을수록 움츠러들고 고개를 숙인다
    const base = { cocky: 5, annoyed: 25, nervous: 50, timid: 70, sob: 95, panic: 88, grovel: 100 }[name] ?? 0;
    const s = Math.min(100, Math.max(0, typeof score === 'number' ? Math.max(score, base - 15) : base)) / 100;
    const puff = name === 'cocky' ? 1.04 : 1;
    const sy = puff * (1 - 0.2 * s * s);
    const sx = puff * (1 + 0.08 * s * s);
    this.q('.g-figure').style.transform = `rotate(${e.tilt}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    this.q('.g-face').style.transform = `translateY(${(14 * s * s).toFixed(1)}px)`;
  }

  /** 듣는 중: 귀 기울이듯 살짝 기울인다 */
  setListening(on) { this.el.classList.toggle('listening', Boolean(on)); }

  /** 현재 표정을 그림 파일로 쓸 수 있는 SVG 문자열로 내보낸다 (결과 카드용) */
  toImageSVG(size = 400) {
    const svg = this.q('svg').cloneNode(true);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.textContent = `*{transform-box:view-box}.g-figure{transform-origin:100px 178px}.g-tuft{transform-origin:100px 44px}
      .g-extra{opacity:0}.g-extra.on{opacity:1}.g-closed{opacity:0}
      .is-closed-down .g-open,.is-closed-up .g-open{opacity:0}
      .is-closed-down .g-closed-down,.is-closed-up .g-closed-up{opacity:1}`;
    svg.insertBefore(st, svg.firstChild);
    return new XMLSerializer().serializeToString(svg);
  }

  setSpeaking(on) { this.el.classList.toggle('speaking', Boolean(on)); }

  react(direction) {
    this.el.classList.remove('react-up', 'react-down');
    if (direction !== 'up' && direction !== 'down') return;
    void this.el.offsetWidth; // 애니메이션 재시작
    this.el.classList.add(`react-${direction}`);
  }
}
