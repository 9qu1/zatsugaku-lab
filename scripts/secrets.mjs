// SNS認証情報の読み込み。
// 自前の .secrets.json を優先し、無ければ ai-news-daily のものを流用する
// (Bluesky/Threadsのアカウントは3サイト共用というユーザーの方針のため)。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWN = join(ROOT, '.secrets.json');
const SHARED = 'C:/Claude/ai-news-daily/.secrets.json';

/** 使う秘密情報ファイルのパス。無ければ null */
export function secretsPath() {
  if (existsSync(OWN)) return OWN;
  if (existsSync(SHARED)) return SHARED;
  return null;
}

export function loadSecrets() {
  const p = secretsPath();
  if (!p) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Threadsのトークン延長結果などを書き戻す */
export function saveSecrets(obj) {
  const p = secretsPath();
  if (!p) return;
  writeFileSync(p, JSON.stringify(obj, null, 2));
}
