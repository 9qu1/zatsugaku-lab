// まだ記事にしていない動画トピックを一覧する。
// 使い方: node tools/next-topics.mjs [表示件数]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIDEOS = 'C:/Claude/shorts-factory/data/videos';
const limit = Number(process.argv[2] || 12);

// 既に記事にした動画IDを集める
const used = new Set();
for (const f of readdirSync(join(ROOT, 'articles')).filter(f => f.endsWith('.md'))) {
  const raw = readFileSync(join(ROOT, 'articles', f), 'utf8');
  const ref = raw.match(/^videoRef:\s*(\S+)\s*$/m)?.[1];
  if (ref) used.add(ref);
}

if (!existsSync(VIDEOS)) {
  console.error('動画台本のフォルダが見つかりません:', VIDEOS);
  process.exit(1);
}

// seriesスラッグ → 記事のcategory
// ここに無いseries(例:「身近なフシギ」)はサイトの守備範囲外なので候補に出さない
const CAT = {
  '認知バイアス': 'bias',
  '脳と習慣': 'brain',
  '人間関係': 'relations',
  '社会のしくみ': 'society',
  '組織': 'org',
  '自分と孤独': 'self',
};

const rows = [];
for (const f of readdirSync(VIDEOS).filter(f => f.endsWith('.json')).sort()) {
  const id = f.replace(/\.json$/, '');
  if (used.has(id)) continue;
  const s = JSON.parse(readFileSync(join(VIDEOS, f), 'utf8'));
  rows.push({ id, topic: s.topic, category: CAT[s.series] ?? 'bias', series: s.series ?? '(なし)' });
}

console.log(`未記事化の動画: ${rows.length}本 (記事化済み ${used.size}本)`);
console.log('--- 次に書く候補 ---');
for (const r of rows.slice(0, limit)) {
  console.log(`${r.id}\tcategory=${r.category}\t${r.topic}`);
}
