// Vrew용 대본 생성: node tools/make-vrew-script.js
// 한 줄 = 한 문장. 이 순서 그대로 녹음한 파일을 받아 무음 구간으로 잘라 파일 이름을 붙인다.
import { writeFileSync, mkdirSync } from 'node:fs';
import { ALL_CLIPS } from '../js/data/clips.js';
mkdirSync('scripts', { recursive: true });
const texts = ALL_CLIPS.map((c) => c.text);
if (new Set(ALL_CLIPS.map((c) => c.id)).size !== ALL_CLIPS.length) throw new Error('ID 중복');
if (texts.some((t) => /[{}]/.test(t))) throw new Error('빈칸이 남아 있음');
writeFileSync('scripts/굽신_Vrew대본.txt', texts.join('\n') + '\n');

let g = `굽신(GOOPSIN) Vrew 녹음 안내 (번호·연기 메모)
${'='.repeat(60)}
총 ${ALL_CLIPS.length}문장. "굽신_Vrew대본.txt"와 같은 순서입니다.
- 대본 파일은 한 줄에 한 문장만 들어 있어 Vrew에 그대로 붙여 넣으면 됩니다.
- 순서를 바꾸거나 문장을 빼지 마세요. 빼야 하면 번호를 알려 주세요.
- 문장 사이에 1.5초 이상 쉼, 배경음악 없이 목소리만 내보내 주세요.
- 한 번에 어렵다면 아래 구간별로 나눠서 여러 파일로 주셔도 됩니다.
- 구간마다 연기(감정)가 다릅니다. 목소리 설정을 구간별로 바꿀 수 있으면 메모를 참고하세요.

`;
let last = null;
ALL_CLIPS.forEach((c, i) => {
  if (c.group.label !== last) {
    last = c.group.label;
    g += `\n■ ${c.group.label}\n   연기: ${c.group.direction}\n`;
  }
  g += `${String(i + 1).padStart(3, '0')}  ${c.text}\n`;
});
writeFileSync('scripts/굽신_Vrew대본_안내.txt', g);
writeFileSync('audio/order.json', JSON.stringify(ALL_CLIPS.map((c) => c.id)) + '\n');
console.log(`${ALL_CLIPS.length}문장, ${texts.join('').length}자`);
