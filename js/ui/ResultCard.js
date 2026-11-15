/**
 * ResultCard: 대화 결과를 한 장의 그림(1080x1350)으로 그린다. 저장·공유용.
 */
import { fmtTime } from '../engine/SessionStats.js';

const FONT = '"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

function loadSvg(svgText) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  });
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function fitText(ctx, text, maxW, size, weight = 900) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${FONT}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 20);
}

export async function drawResultCard(canvas, sum, charSvg) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#ff9a3c'); bg.addColorStop(1, '#ff6a1a');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);

  // 안쪽 카드
  c.fillStyle = '#fff6ea'; rr(c, 50, 50, W - 100, H - 100, 56); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';

  c.fillStyle = '#e05e00'; c.font = `900 64px ${FONT}`; c.fillText('굽신', W / 2 - 110, 160);
  c.fillStyle = '#7a6656'; c.font = `800 30px ${FONT}`; c.fillText('G O O P S I N', W / 2 + 90, 152);

  const img = charSvg && await loadSvg(charSvg);
  if (img) c.drawImage(img, W / 2 - 210, 190, 420, 420);

  // 칭호
  c.font = `900 40px ${FONT}`;
  const tw = c.measureText(sum.title).width + 90;
  c.fillStyle = '#2b1d14'; rr(c, W / 2 - tw / 2, 630, tw, 76, 38); c.fill();
  c.fillStyle = '#fff'; c.fillText(sum.title, W / 2, 683);

  // 큰 문구
  c.fillStyle = '#e5383b'; fitText(c, sum.headline, W - 220, 84); c.fillText(sum.headline, W / 2, 810);

  // 기록
  const rows = [];
  if (sum.mode === 'battle') {
    rows.push(['최고 굴복 단계', `${sum.peakStage}단계`]);
    rows.push(['주고받은 말', `${sum.turns}번`]);
    if (sum.topWord) rows.push(['가장 많이 쓴 말', `"${sum.topWord.word}" ${sum.topWord.count}번`]);
    else rows.push(['대화 시간', fmtTime(sum.durationSec)]);
    if (sum.rebounds) rows.push(['다시 기어오른 횟수', `${sum.rebounds}번`]);
  } else {
    rows.push(['받아낸 사죄', `${sum.turns}번`]);
    rows.push(['대화 시간', fmtTime(sum.durationSec)]);
  }
  let y = 880;
  for (const [k, v] of rows.slice(0, 4)) {
    c.fillStyle = '#fff'; rr(c, 130, y, W - 260, 78, 24); c.fill();
    c.textAlign = 'left'; c.fillStyle = '#7a6656'; c.font = `700 34px ${FONT}`; c.fillText(k, 165, y + 52);
    c.textAlign = 'right'; c.fillStyle = '#2b1d14'; c.font = `900 38px ${FONT}`; c.fillText(v, W - 165, y + 53);
    y += 92;
  }

  c.textAlign = 'center';
  c.fillStyle = '#e05e00'; c.font = `900 36px ${FONT}`; c.fillText('욕은 마음껏, 사죄는 무조건!', W / 2, H - 100);
  return canvas;
}

export function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
