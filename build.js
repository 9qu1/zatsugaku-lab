// ずんだ雑学ラボ 静的サイトジェネレーター
// articles/*.md と pages/*.md を dist/ のフラットなHTMLに変換する。
// 内部リンクはすべて相対パス。github.io サブパスでも独自ドメイン(9qu1.com)でも動く。
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const site = JSON.parse(readFileSync(join(ROOT, 'config', 'site.json'), 'utf8'));
const ads = JSON.parse(readFileSync(join(ROOT, 'config', 'ads.json'), 'utf8'));

marked.setOptions({ gfm: true });

// カテゴリ: slug → 表示名・色クラス。動画側のseries名と対応している
const CATEGORY = {
  bias: { label: '認知バイアス', cls: 'cat-bias' },
  brain: { label: '脳と習慣', cls: 'cat-brain' },
  relations: { label: '人間関係', cls: 'cat-relations' },
  society: { label: '社会のしくみ', cls: 'cat-society' },
  org: { label: '組織のふしぎ', cls: 'cat-org' },
  self: { label: '自分と孤独', cls: 'cat-self' },
};

const esc = (s = '') =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

function loadDir(dir) {
  const full = join(ROOT, dir);
  let files = [];
  try { files = readdirSync(full).filter(f => f.endsWith('.md')); } catch { return []; }
  return files.map(f => {
    const { meta, body } = parseFrontmatter(readFileSync(join(full, f), 'utf8'));
    const html = marked.parse(body);
    const plain = html.replace(/<[^>]+>/g, '');
    return {
      slug: f.replace(/\.md$/, ''),
      title: meta.title || f,
      date: meta.date || '',
      category: meta.category || 'bias',
      description: meta.description || '',
      tags: (meta.tags || '').split(',').map(t => t.trim()).filter(Boolean),
      videoId: meta.videoId || '',
      videoRef: meta.videoRef || '',
      minutes: Math.max(2, Math.round(plain.length / 550)),
      html,
    };
  });
}

const articles = loadDir('articles').sort((a, b) => (a.date === b.date ? (a.slug < b.slug ? 1 : -1) : a.date < b.date ? 1 : -1));
const pages = loadDir('pages');
const url = slug => `${site.url}/${slug}.html`;

const FAVICON =
  'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2255%22 r=%2238%22 fill=%22%238fd14f%22/><circle cx=%2238%22 cy=%2246%22 r=%226%22 fill=%22%232b2a26%22/><circle cx=%2262%22 cy=%2246%22 r=%226%22 fill=%22%232b2a26%22/><path d=%22M40 64 Q50 72 60 64%22 stroke=%22%232b2a26%22 stroke-width=%225%22 fill=%22none%22 stroke-linecap=%22round%22/></svg>';

// 豆のロゴ(インラインSVG)
const BEAN = `<svg class="bean" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="26" r="18" fill="#8fd14f"/><circle cx="18" cy="22" r="2.8" fill="#2b2a26"/><circle cx="30" cy="22" r="2.8" fill="#2b2a26"/><path d="M19 31 Q24 35 29 31" stroke="#2b2a26" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M24 8 Q22 3 27 2" stroke="#5d8a3a" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;

function adSlot(html) {
  if (!html || !html.trim()) return '';
  return `<aside class="ad-slot"><span class="ad-label">スポンサーリンク</span>${html}</aside>`;
}

function layout({ title, description, pageUrl, body, jsonld = '', ogType = 'website' }) {
  return `<!DOCTYPE html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${ogType}">
<meta property="og:url" content="${pageUrl}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${FAVICON}">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="./feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="./styles.css">
${site.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${site.adsenseClient}" crossorigin="anonymous"></script>` : ''}
${jsonld}
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="./index.html">${BEAN}<span class="brand-text">${esc(site.title)}<small>${esc(site.tagline)}</small></span></a>
    <nav class="nav">
      <a href="./index.html">ホーム</a>
      <a href="./articles.html">記事さくいん</a>
      <a href="./about.html">このラボについて</a>
    </nav>
  </div>
</header>
<main class="wrap">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-cols">
      <nav class="footer-nav">
        <a href="./about.html">このラボについて</a>
        <a href="./privacy.html">プライバシーポリシー</a>
        <a href="./contact.html">お問い合わせ</a>
        <a href="./feed.xml">RSS</a>
      </nav>
      <nav class="footer-friends">
        <span class="friends-label">なかまのサイト:</span>
        <a href="${site.youtube}" target="_blank" rel="noopener">YouTubeちゃんねる</a>
        <a href="https://9qu1.github.io/ai-news-daily/" target="_blank" rel="noopener">AIデイリー</a>
        <a href="https://9qu1.github.io/invest-daily/" target="_blank" rel="noopener">投資デイリー</a>
      </nav>
    </div>
    <p class="copyright">© 2026 ${esc(site.title)}</p>
  </div>
</footer>
</body>
</html>`;
}

function chip(catSlug) {
  const cat = CATEGORY[catSlug] || CATEGORY.bias;
  return `<span class="chip ${cat.cls}">${cat.label}</span>`;
}

function card(a) {
  return `<a class="card" href="./${a.slug}.html">
  <div class="card-meta">${chip(a.category)}<span class="minutes">約${a.minutes}分</span></div>
  <h3 class="card-title">${esc(a.title)}</h3>
  <p class="card-desc">${esc(a.description)}</p>
  <span class="card-more">よみもの →</span>
</a>`;
}

function videoBox(a) {
  if (!a.videoId) return '';
  return `<section class="video-sec">
  <h2>この話、1分の動画にもしてあります</h2>
  <p class="video-note">文字より耳がいい日は、こちらでどうぞ。</p>
  <div class="video-box"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${a.videoId}" title="${esc(a.title)}(動画版)" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
</section>`;
}

// 「## 参考にした資料」の見出し+リストを枠で包む
function decorateSources(html) {
  return html.replace(
    /(<h2[^>]*>参考にした資料<\/h2>)\s*(<ul>[\s\S]*?<\/ul>)/,
    '<div class="sources">$1$2</div>'
  );
}

function articlePage(a) {
  const related = articles.filter(x => x.category === a.category && x.slug !== a.slug).slice(0, 3);
  const share = encodeURIComponent(`${a.title} | ${site.title}`);
  const shareUrl = encodeURIComponent(url(a.slug));
  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    inLanguage: 'ja',
    author: { '@type': 'Organization', name: site.author },
    mainEntityOfPage: url(a.slug),
  })}</script>`;
  const body = `<article class="article">
  <div class="card-meta">${chip(a.category)}<span class="minutes">読むのに約${a.minutes}分</span></div>
  <h1>${esc(a.title)}</h1>
  <div class="article-body">
${decorateSources(a.html)}
  </div>
  ${videoBox(a)}
  ${adSlot(ads.article_bottom)}
  ${adSlot(ads.article_click)}
  <div class="share">
    <span>おすそわけ:</span>
    <a rel="nofollow noopener" target="_blank" href="https://twitter.com/intent/tweet?text=${share}&url=${shareUrl}">X</a>
    <a rel="nofollow noopener" target="_blank" href="https://bsky.app/intent/compose?text=${share}%20${shareUrl}">Bluesky</a>
    <a rel="nofollow noopener" target="_blank" href="https://b.hatena.ne.jp/entry/${url(a.slug).replace(/^https?:\/\//, '')}">はてブ</a>
    <a rel="nofollow noopener" target="_blank" href="https://social-plugins.line.me/lineit/share?url=${shareUrl}">LINE</a>
  </div>
  ${related.length ? `<nav class="related"><h2>つづけて読むなら</h2><div class="grid">${related.map(card).join('\n')}</div></nav>` : ''}
</article>`;
  return layout({ title: `${a.title} | ${site.title}`, description: a.description, pageUrl: url(a.slug), body, jsonld, ogType: 'article' });
}

function catNav(active = '') {
  return `<nav class="cat-nav">${Object.entries(CATEGORY)
    .map(([slug, c]) => `<a class="chip ${c.cls}${active === slug ? ' chip-on' : ''}" href="./cat-${slug}.html">${c.label}</a>`)
    .join('')}</nav>`;
}

function listPage({ slug, heading, lead, items, active = '' }) {
  const body = `<section class="list-page">
  <h1>${esc(heading)}</h1>
  <p class="lead">${esc(lead)}</p>
  ${catNav(active)}
  <div class="grid">${items.map(card).join('\n')}</div>
</section>`;
  return layout({ title: `${heading} | ${site.title}`, description: lead, pageUrl: url(slug), body });
}

function indexPage() {
  const latest = articles.slice(0, 9);
  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.title,
    description: site.description,
    url: site.url,
    inLanguage: 'ja',
  })}</script>`;
  const body = `<section class="hero">
  <h1>日常の「なぜ」を、<br>心理学でほどく。</h1>
  <p class="lead">${esc(site.description)}</p>
  ${catNav()}
</section>
<section>
  <h2 class="sec-title">新しいノート</h2>
  <div class="grid">${latest.map(card).join('\n')}</div>
  <p class="more"><a href="./articles.html">ぜんぶの記事をみる →</a></p>
</section>
<section class="lab-note">
  <h2 class="sec-title">このラボのやりかた</h2>
  <p>ひとつの記事で、ひとつの現象だけを扱います。元になった実験を年号と数字つきでたどって、「どこまで確かめられている話なのか」まで書くのがルールです。うのみにしない雑学、が目標です。<a href="./about.html">くわしくはこちら</a>。</p>
</section>`;
  return layout({ title: `${site.title} — ${site.tagline}`, description: site.description, pageUrl: `${site.url}/`, body, jsonld });
}

function staticPage(p) {
  const body = `<article class="article"><h1>${esc(p.title)}</h1><div class="article-body">${p.html}</div></article>`;
  return layout({ title: `${p.title} | ${site.title}`, description: p.description || site.description, pageUrl: url(p.slug), body });
}

function rss() {
  const items = articles.slice(0, 20).map(a => `  <item>
    <title>${esc(a.title)}</title>
    <link>${url(a.slug)}</link>
    <guid>${url(a.slug)}</guid>
    <pubDate>${new Date(a.date + 'T07:00:00+09:00').toUTCString()}</pubDate>
    <description>${esc(a.description)}</description>
  </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${esc(site.title)}</title>
  <link>${site.url}/</link>
  <description>${esc(site.description)}</description>
  <language>ja</language>
${items}
</channel></rss>`;
}

function sitemap() {
  const urls = [
    `${site.url}/`,
    ...['articles', 'about', 'privacy', 'contact'].map(s => url(s)),
    ...Object.keys(CATEGORY).map(s => url(`cat-${s}`)),
    ...articles.map(a => url(a.slug)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;
}

// ---- 出力 ----
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
copyFileSync(join(ROOT, 'src', 'styles.css'), join(DIST, 'styles.css'));
try {
  readdirSync(join(ROOT, 'static')).forEach(f => copyFileSync(join(ROOT, 'static', f), join(DIST, f)));
} catch {}

writeFileSync(join(DIST, 'index.html'), indexPage());
writeFileSync(join(DIST, 'articles.html'), listPage({
  slug: 'articles',
  heading: '記事さくいん',
  lead: 'いままでに書いたノートの一覧です。気になる現象からどうぞ。',
  items: articles,
}));
for (const [slug, c] of Object.entries(CATEGORY)) {
  const items = articles.filter(a => a.category === slug);
  writeFileSync(join(DIST, `cat-${slug}.html`), listPage({
    slug: `cat-${slug}`,
    heading: c.label,
    lead: `「${c.label}」のノート ${items.length}冊。`,
    items,
    active: slug,
  }));
}
articles.forEach(a => writeFileSync(join(DIST, `${a.slug}.html`), articlePage(a)));
pages.forEach(p => writeFileSync(join(DIST, `${p.slug}.html`), staticPage(p)));
writeFileSync(join(DIST, 'feed.xml'), rss());
writeFileSync(join(DIST, 'sitemap.xml'), sitemap());
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
// 404には旧URL転送スクリプトを仕込む（9qu1.comをこのサイトに付け替えた後に効く。それまでは発火しない）
// ・/ai-news-daily/* /invest-daily/* → github.ioの同パスへ（切替前のSNS投稿リンク救済）
// ・/zatsugaku-lab/* → 接頭辞を外してルートへ（サブパス時代のリンク救済）
const legacyRedirect = '<script>(function(){var p=location.pathname;if(/^\\/(ai-news-daily|invest-daily)(\\/|$)/.test(p)){location.replace("https://9qu1.github.io"+p+location.search);}else if(/^\\/zatsugaku-lab(\\/|$)/.test(p)){location.replace(p.replace(/^\\/zatsugaku-lab/,"")+location.search||"/");}})();</script>';
writeFileSync(join(DIST, '404.html'), layout({
  title: `ページが見つかりません | ${site.title}`,
  description: site.description,
  pageUrl: site.url,
  body: legacyRedirect + '<section class="hero"><h1>404</h1><p class="lead">そのノートは見つかりませんでした。棚を整理したのかもしれません。<a href="./index.html">入口へ戻る</a></p></section>',
}));

console.log(`✅ build完了: 記事${articles.length}本 / 固定ページ${pages.length}本 → dist/`);
