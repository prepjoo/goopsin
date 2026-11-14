// audio 폴더의 mp3 파일 목록으로 audio/manifest.json 생성: node tools/make-manifest.js
import { readdirSync, writeFileSync } from 'node:fs';
import { CLIPS } from '../js/data/clips.js';
const files = new Set(readdirSync('audio').filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)));
const known = CLIPS.map((c) => c.id);
const ids = known.filter((id) => files.has(id));
writeFileSync('audio/manifest.json', JSON.stringify(ids, null, 0) + '\n');
const missing = known.filter((id) => !files.has(id));
const unknown = [...files].filter((f) => !known.includes(f));
console.log(`등록 ${ids.length}/${known.length}개`);
if (missing.length) console.log('없는 파일:', missing.join(', '));
if (unknown.length) console.log('대본에 없는 파일(이름 확인 필요):', unknown.join(', '));
