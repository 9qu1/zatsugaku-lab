// shorts-factoryの台帳から公開済み動画のYouTube IDを拾い、
// 記事frontmatterの videoId を埋める(ローカル専用。push前に実行する)。
// 使い方: node tools/sync-videos.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = 'C:/Claude/shorts-factory/data/ledger.json';

if (!existsSync(LEDGER)) {
  console.log('台帳が見つからないのでスキップ:', LEDGER);
  process.exit(0);
}
const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
const items = ledger.items ?? ledger;
const byId = new Map(items.map(e => [e.id, e]));

let updated = 0;
for (const f of readdirSync(join(ROOT, 'articles')).filter(f => f.endsWith('.md'))) {
  const p = join(ROOT, 'articles', f);
  const raw = readFileSync(p, 'utf8');
  const ref = raw.match(/^videoRef:\s*(\S+)\s*$/m)?.[1];
  const cur = raw.match(/^videoId:\s*(\S*)\s*$/m)?.[1] ?? '';
  if (!ref || cur) continue;
  const entry = byId.get(ref);
  if (!entry?.shortVideoId) continue;
  const next = raw.replace(/^videoId:.*$/m, `videoId: ${entry.shortVideoId}`);
  writeFileSync(p, next, 'utf8');
  console.log(`${f}: videoId ← ${entry.shortVideoId}`);
  updated++;
}
console.log(updated ? `${updated}件更新。ビルドし直してpushしてください。` : '更新なし(全記事同期済みか、動画が未公開)');
