// 新着記事をThreadsに投稿する (ローカルのスケジュール実行から呼ばれる)
// 使い方: node scripts/post-threads.mjs articles/<slug>.md
// 認証情報は .secrets.json (自前が無ければ ai-news-daily のものを流用)。
// 未設定なら何もせず正常終了する。トークンの延長(60日期限)は自動で行う。
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSecrets, saveSecrets } from './secrets.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://graph.threads.net';

// bot判定を避けるため開始時刻にゆらぎを持たせる(THREADS_NO_DELAY=1で無効化)
const NO_DELAY = process.env.THREADS_NO_DELAY === '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isBlocked = (e) => /API access blocked|temporarily blocked|rate limit/i.test(String(e?.message));
const bailIfBlocked = (e) => {
  if (!isBlocked(e)) throw e;
  console.log('⚠️ ThreadsのAPIアクセスがMeta側でブロックされています。投稿をスキップしました。');
  console.log(`   (詳細: ${e.message})`);
  process.exit(0);
};

const secrets = loadSecrets();
if (!secrets) {
  console.log('.secrets.json が無いためThreads投稿をスキップします');
  process.exit(0);
}
const t = secrets.threads;
if (!t || !t.token || /ここに|PASTE/i.test(t.token)) {
  console.log('Threadsトークン未設定のためスキップします');
  process.exit(0);
}

const mdPath = process.argv[2];
if (!mdPath) { console.error('記事ファイルを指定してください'); process.exit(1); }

const save = () => saveSecrets(secrets);
const get = async (url) => {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(`${url.split('?')[0]} failed: ${JSON.stringify(j.error || j)}`);
  return j;
};

// ---- トークンを長期トークンとして維持する ----
const DAY = 24 * 60 * 60 * 1000;
async function ensureToken() {
  const age = t.refreshedAt ? Date.now() - new Date(t.refreshedAt).getTime() : Infinity;
  if (age < 7 * DAY) return;
  try {
    const j = await get(`${API}/refresh_access_token?grant_type=th_refresh_token&access_token=${t.token}`);
    t.token = j.access_token;
    t.refreshedAt = new Date().toISOString();
    save();
    console.log('トークンを延長しました(60日)');
  } catch (e) {
    if (t.appSecret && !/ここに/.test(t.appSecret)) {
      try {
        const j = await get(`${API}/access_token?grant_type=th_exchange_token&client_secret=${t.appSecret}&access_token=${t.token}`);
        t.token = j.access_token;
        t.refreshedAt = new Date().toISOString();
        save();
        console.log('短期トークンを長期トークン(60日)に交換しました');
      } catch {
        if (!t.refreshedAt) console.log('トークンをそのまま使用します(延長は後日自動実行)');
        else throw e;
      }
    } else if (!t.refreshedAt) {
      console.log('トークン延長は24時間経過後に自動実行します');
    } else {
      throw e;
    }
  }
}

try {
  await ensureToken();
  if (!t.userId) {
    const j = await get(`${API}/v1.0/me?fields=id,username&access_token=${t.token}`);
    t.userId = j.id;
    save();
    console.log(`Threadsユーザー確認: @${j.username}`);
  }
} catch (e) {
  bailIfBlocked(e);
}

// ---- 記事情報から投稿文を作る ----
const site = JSON.parse(readFileSync(join(ROOT, 'config', 'site.json'), 'utf8'));
const raw = readFileSync(join(ROOT, mdPath), 'utf8');
const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
const meta = {};
if (fm) for (const line of fm[1].split(/\r?\n/)) {
  const i = line.indexOf(':');
  if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const slug = basename(mdPath).replace(/\.md$/, '');
const url = `${site.url}/${slug}.html`;

let body = '';
const sidecarPath = join(ROOT, mdPath.replace(/\.md$/, '.sns.json'));
if (existsSync(sidecarPath)) {
  body = JSON.parse(readFileSync(sidecarPath, 'utf8')).ja || '';
}
if (!body) {
  let desc = meta.description || '';
  const fixedLen = `【${meta.title}】\n\n`.length;
  if (fixedLen + desc.length > 440) desc = desc.slice(0, 439 - fixedLen) + '…';
  body = `【${meta.title}】\n\n${desc}`;
}
body = body.trim();
if ([...body].length > 440) body = [...body].slice(0, 439).join('') + '…';
const text = `${body}\n${url}`;

if (process.env.SNS_DRY_RUN === '1') {
  console.log('[dry-run] Threadsに投稿する内容:\n---\n' + text + '\n---');
  process.exit(0);
}

// ---- 投稿(コンテナ作成 → 公開) ----
const post = async (path, params) => {
  const r = await fetch(`${API}/v1.0/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, access_token: t.token }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} failed: ${JSON.stringify(j.error || j)}`);
  return j;
};

if (!NO_DELAY) {
  const wait = Math.floor(Math.random() * 90_000);
  if (wait > 0) {
    console.log(`投稿時刻を毎回同じにしないため ${Math.round(wait / 1000)}秒 待機します`);
    await sleep(wait);
  }
}

try {
  const container = await post(`${t.userId}/threads`, { media_type: 'TEXT', text });
  let published;
  try {
    published = await post(`${t.userId}/threads_publish`, { creation_id: container.id });
  } catch (e) {
    if (isBlocked(e)) throw e;
    await sleep(5000);
    published = await post(`${t.userId}/threads_publish`, { creation_id: container.id });
  }
  try {
    const info = await get(`${API}/v1.0/${published.id}?fields=permalink&access_token=${t.token}`);
    console.log(`✅ Threadsに投稿しました: ${info.permalink}`);
  } catch {
    console.log(`✅ Threadsに投稿しました: media_id=${published.id}`);
  }
} catch (e) {
  bailIfBlocked(e);
}
