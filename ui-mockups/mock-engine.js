/* mock-engine.js — shared interaction core for ui-mockups (style-a / style-b / style-c)
 * Pure vanilla JS, no deps. Each style supplies its own markup + skin and uses these hooks:
 *   ids:  #q #unitChips #tree #stage #speaker #txt #txtSub #choices #hudLine #hudFps #hudBgm #hudRec
 *         #epStrip #timeline #bgm #importModal #drop #fileIn #dirIn #preview #localList #backlogModal #backlogList
 *   attrs: data-seg="group|sort|type|lang|speed" (+data-v) · data-act="…" · data-bind="jp|cn|ep|…" · .js-bg
 * External control: window.MOCK.openImport() / openBacklog(), postMessage({cmd:'import'|'backlog'|'close'}), #import / #backlog hash.
 */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ───────────── data ───────────── */
const UNITS = [
  { id: 'ill', name: 'illumination STARS', short: 'イルミネ', color: '#ffbe42', idols: ['櫻木真乃', '風野灯織', '八宮めぐる'] },
  { id: 'ant', name: "L'Antica", short: 'アンティーカ', color: '#9c49d1', idols: ['月岡恋鐘', '田中摩美々', '白瀬咲耶', '三峰結華', '幽谷霧子'] },
  { id: 'hok', name: '放課後CLIMAXGIRLS', short: '放クラ', color: '#ff6b2b', idols: ['小宮果穂', '園田智代子', '西城樹里', '杜野凛世', '有栖川夏葉'] },
  { id: 'als', name: 'ALSTROEMERIA', short: 'アルスト', color: '#ff598c', idols: ['大崎甘奈', '大崎甜花', '桑山千雪'] },
  { id: 'str', name: 'Straylight', short: 'ストレイ', color: '#e0243d', idols: ['芹沢あさひ', '黛冬優子', '和泉愛依'] },
  { id: 'noc', name: 'noctchill', short: 'ノクチル', color: '#3865d6', idols: ['浅倉透', '樋口円香', '福丸小糸', '市川雛菜'] },
  { id: 'shh', name: 'SHHis', short: 'シーズ', color: '#17a87c', idols: ['七草にちか', '緋田美琴'] },
  { id: 'com', name: 'CoMETIK', short: 'コメティック', color: '#22242b', idols: ['斑鳩ルカ', '鈴木羽那', '郁田はるき'] },
];
const UMAP = Object.fromEntries(UNITS.map(u => [u.id, u]));
const IDOL_UNIT = {}; UNITS.forEach(u => u.idols.forEach(n => (IDOL_UNIT[n] = u.id)));
const colorOf = n => (UMAP[IDOL_UNIT[n]] || {}).color || '#8a94a6';
const TYPES = { main: '主线', event: '活动', produce: '培育', idol: '个人', local: '本地导入' };
const TYPE_IC = { main: '📖', event: '🎪', produce: '🌱', idol: '💠' };
const KIND = { scproj: '.scproj.json', yaml: '.scs.yaml', json: '.json', scpack: '.scpack' };
const EP_T = ['オープニング', '夜明け前', '約束', 'すれ違い', '雨のち晴れ', 'ステージへ', '光の中で', 'エンディング'];
const EP_C = ['序幕', '黎明之前', '约定', '擦肩而过', '雨过天晴', '走向舞台', '光芒之中', '终幕'];
const BGS = ['/bg/00009.jpg', '/bg/00004.jpg'];

const CH = [
  { id: 'm1', type: 'main', part: '第1部「はじまりの空」', unit: 'ill', idol: '櫻木真乃', jp: 'ひかりの空へ', cn: '向着光之天空', date: '2018-04-24', eps: 6, read: 2, ord: 1 },
  { id: 'm2', type: 'main', part: '第1部「はじまりの空」', unit: 'ant', idol: '白瀬咲耶', jp: '283プロ、始動', cn: '283事务所，启动', date: '2018-05-15', eps: 5, read: 5, ord: 2 },
  { id: 'm3', type: 'main', part: '第2部「光の果てに」', unit: 'shh', idol: '七草にちか', jp: 'ふたりの約束', cn: '两个人的约定', date: '2021-04-08', eps: 8, read: 1, ord: 3 },
  { id: 'e1', type: 'event', part: '2019 イベントコミュ', unit: 'str', idol: '芹沢あさひ', jp: 'Straylight.run()', cn: 'Straylight.run()', date: '2019-06-30', eps: 7, read: 7, ord: 10 },
  { id: 'e2', type: 'event', part: '2019 イベントコミュ', unit: 'als', idol: '大崎甘奈', jp: '薄桃色にこんがらがって', cn: '缠绕于淡桃色之中', date: '2019-09-12', eps: 7, read: 3, ord: 11 },
  { id: 'e3', type: 'event', part: '2020 イベントコミュ', unit: 'noc', idol: '浅倉透', jp: '天塵', cn: '天尘', date: '2020-03-31', eps: 8, read: 5, ord: 12 },
  { id: 'e4', type: 'event', part: '2020 イベントコミュ', unit: 'ant', idol: '月岡恋鐘', jp: 'バベルシティ・グレイス', cn: '巴别城的恩典', date: '2020-08-14', eps: 8, read: 0, ord: 13 },
  { id: 'e5', type: 'event', part: '2021 イベントコミュ', unit: 'shh', idol: '緋田美琴', jp: 'OO-ct. ――ノー・カラット', cn: 'OO-ct. ——无克拉', date: '2021-07-14', eps: 8, read: 2, ord: 14 },
  { id: 'e6', type: 'event', part: '2021 イベントコミュ', unit: 'hok', idol: '小宮果穂', jp: '夢咲きAfter school', cn: '梦绽放学后', date: '2021-10-20', eps: 6, read: 0, ord: 15 },
  { id: 'e7', type: 'event', part: '2023 イベントコミュ', unit: 'com', idol: '斑鳩ルカ', jp: '彗星のはじまり', cn: '彗星的起点', date: '2023-12-05', eps: 7, read: 0, ord: 16 },
  { id: 'p1', type: 'produce', part: 'W.I.N.G. 編', unit: 'ill', idol: '風野灯織', jp: 'W.I.N.G.：ひとりの夜に', cn: 'W.I.N.G.：一个人的夜里', date: '2018-04-24', eps: 5, read: 5, ord: 20 },
  { id: 'p2', type: 'produce', part: 'G.R.A.D. 編', unit: 'noc', idol: '樋口円香', jp: 'G.R.A.D.：線の向こう', cn: 'G.R.A.D.：线的另一端', date: '2020-11-30', eps: 6, read: 2, ord: 21 },
  { id: 'p3', type: 'produce', part: 'Landing Point', unit: 'str', idol: '黛冬優子', jp: 'Landing Point：ふゆの選択', cn: 'Landing Point：冬优子的选择', date: '2022-03-01', eps: 4, read: 0, ord: 22 },
  { id: 'i1', type: 'idol', part: 'Pカード コミュ', unit: 'als', idol: '桑山千雪', jp: '【アルストロメリアの花束】桑山千雪', cn: '【六出花的花束】桑山千雪', date: '2019-05-01', eps: 3, read: 3, ord: 30 },
  { id: 'i2', type: 'idol', part: 'Pカード コミュ', unit: 'hok', idol: '杜野凛世', jp: '【凛世花伝】杜野凛世', cn: '【凛世花传】杜野凛世', date: '2018-11-15', eps: 3, read: 1, ord: 31 },
];

const LINES = [
  { s: '櫻木真乃', jp: 'プロデューサーさん、おはようございます……！', cn: '制作人先生，早上好……！' },
  { s: '風野灯織', jp: '今日のレッスン、少し早めに来てしまいました', cn: '今天的课程，我稍微来早了一些' },
  { s: '八宮めぐる', jp: 'ねえねえ！ 見て見て、空がすっごく青いよ〜！', cn: '呐呐！快看快看，天空超——蓝的哦！' },
  { s: 'プロデューサー', jp: '（窓の外には、雲ひとつない空が広がっている）', cn: '（窗外，是一片万里无云的晴空）' },
  { choice: 1, s: '選択肢', q: { jp: 'どう答える？', cn: '要怎么回答？' }, opts: [
    { jp: 'ああ、いい天気だな', cn: '是啊，天气真好' },
    { jp: 'レッスンに集中しよう', cn: '先专心上课吧' },
    { jp: 'みんなで屋上に行こうか', cn: '大家一起去天台看看吧' }] },
  { s: '櫻木真乃', jp: 'ほわっ……ひかりが、きらきらしてますね', cn: '哇……阳光，亮晶晶的呢' },
  { s: '風野灯織', jp: '……こういう日は、少しだけ、歌いたくなります', cn: '……这样的日子，会让人有点想唱歌' },
  { s: '八宮めぐる', jp: 'じゃあさ、三人で歌おうよ！ プロデューサーも聴いてて！', cn: '那我们三个人一起唱吧！制作人也要听哦！' },
  { s: 'プロデューサー', jp: 'ああ。特等席で聴かせてもらうよ', cn: '好啊。我就坐在特等席上听' },
  { s: '櫻木真乃', jp: 'えへへ……がんばりますっ。むんっ', cn: '嘿嘿……我会加油的。嗯！' },
  { choice: 1, s: '選択肢', q: { jp: '最初の一曲は？', cn: '第一首歌是？' }, opts: [
    { jp: '「Spread the Wings!!」', cn: '就唱《Spread the Wings!!》' },
    { jp: '「ヒカリのdestination」', cn: '唱《ヒカリのdestination》' }] },
  { s: '風野灯織', jp: 'では……いきます。せーの', cn: '那么……要开始了。预备——' },
  { s: '', jp: '（三人の声が、青い空に溶けていく）', cn: '（三人的歌声，渐渐融进了蓝天里）' },
  { s: 'プロデューサー', jp: '……いいユニットになったな、イルミネーションスターズ', cn: '……真是成长为一支好组合了啊，illumination STARS' },
];
const ILL = ['櫻木真乃', '風野灯織', '八宮めぐる'];
const DEMO = { title: '夏葉と、星を数える夜', kind: 'scproj', lines: 86, chars: ['有栖川夏葉', '小宮果穂', '西城樹里', '杜野凛世'], ooc: 0, size: 48213 };

const st = {
  type: 'all', group: 'type', sort: 'story', q: '', units: new Set(), closed: new Set(), openCh: new Set(['m1']),
  chId: 'm1', ep: 3, line: 6, picks: { 4: 0 }, lang: 'both', speed: 1, auto: false, merged: false,
  rec: false, recT: 0, bubble: false, motion: true, hidden: false, bgm: 60, playLocal: null, pending: null,
  local: [
    { id: 'lp1', title: '夏葉と、星を数える夜', kind: 'scproj', lines: 86, chars: ['有栖川夏葉', '小宮果穂', '西城樹里'], ooc: 0, date: '2026-11-10' },
    { id: 'lp2', title: '灯織・夜の稽古場', kind: 'scpack', lines: 142, chars: ['風野灯織', '櫻木真乃', '八宮めぐる'], ooc: 0, date: '2026-11-08', files: 12 },
    { id: 'lp3', title: '円香と、海沿いの帰り道', kind: 'yaml', lines: 54, chars: ['樋口円香', '浅倉透'], ooc: 1, date: '2026-11-02' },
  ],
};

/* ───────────── helpers ───────────── */
const avatars = (chars, max = 3) => `<span class="avs">${chars.slice(0, max).map(n => `<span class="av" style="--c:${colorOf(n)}" title="${esc(n)}">${esc(n.slice(0, 1))}</span>`).join('')}${chars.length > max ? `<span class="av more">+${chars.length - max}</span>` : ''}</span>`;
const oocBadge = (n, big) => `<span class="ooc ${n ? 'warn' : 'ok'} ${big ? 'big' : ''}">${n ? '⚠ ' + n + ' OOC' : '✓ 0 OOC'}</span>`;
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(1) + ' KB';
const mmss = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const today = () => new Date().toISOString().slice(0, 10);

function cur() {
  if (st.playLocal) {
    const p = st.local.find(x => x.id === st.playLocal);
    if (p) return { id: 'local:' + p.id, type: 'local', part: '本地导入', unit: IDOL_UNIT[p.chars[0]] || 'ill', idol: p.chars[0] || '—', jp: p.title, cn: '二创工程 · ' + KIND[p.kind], date: p.date, eps: 1, read: 0, local: p };
    st.playLocal = null;
  }
  return CH.find(c => c.id === st.chId) || CH[0];
}
function lines() {
  const c = cur();
  const cast = c.local ? (c.local.chars.length ? c.local.chars : ILL) : UMAP[c.unit].idols;
  if (!c.local && c.unit === 'ill') return LINES;
  return LINES.map(L => { const k = ILL.indexOf(L.s); return k < 0 ? L : { ...L, s: cast[k % cast.length] }; });
}

/* ───────────── sidebar ───────────── */
function filtered() {
  const q = st.q.trim().toLowerCase();
  return CH.filter(c => (st.type === 'all' || c.type === st.type) && (!st.units.size || st.units.has(c.unit)) &&
    (!q || [c.jp, c.cn, c.id, c.idol, c.part, UMAP[c.unit].name, UMAP[c.unit].short].join(' ').toLowerCase().includes(q)));
}
function sorted(l) {
  l = [...l];
  if (st.sort === 'story') l.sort((a, b) => a.ord - b.ord);
  else if (st.sort === 'chapter') l.sort((a, b) => a.part.localeCompare(b.part, 'ja') || a.jp.localeCompare(b.jp, 'ja'));
  else l.sort((a, b) => b.date.localeCompare(a.date));
  return l;
}
function groupOf(c) {
  if (st.group === 'unit') { const u = UMAP[c.unit]; return { k: 'u:' + u.id, t: u.name, c: u.color }; }
  if (st.group === 'idol') return { k: 'i:' + c.idol, t: c.idol, c: UMAP[c.unit].color };
  return { k: 't:' + c.type + c.part, t: TYPES[c.type] + ' · ' + c.part, ic: TYPE_IC[c.type] };
}
function chHTML(c) {
  const u = UMAP[c.unit], open = st.openCh.has(c.id), active = !st.playLocal && st.chId === c.id;
  const pct = Math.round(c.read / c.eps * 100), done = c.read >= c.eps;
  const eps = Array.from({ length: c.eps }, (_, i) => {
    const n = i + 1, rd = n <= c.read;
    return `<button class="ep ${rd ? 'read' : ''} ${active && st.ep === n ? 'cur' : ''}" data-ep="${n}" data-chid="${c.id}"><span class="ep-n">第${n}话</span><span class="ep-t">${EP_T[i % 8]}<em>${EP_C[i % 8]}</em></span>${rd ? '<span class="ep-ok">✓</span>' : ''}</button>`;
  }).join('');
  return `<div class="ch ${open ? 'open' : ''} ${active ? 'active' : ''}" style="--c:${u.color}">
<div class="ch-h"><button class="ch-t" data-ch="${c.id}"><span class="caret"></span><span class="ch-bar"></span><span class="ch-titles"><b class="jp">${esc(c.jp)}</b><i class="cn">${esc(c.cn)}</i></span><span class="ch-meta"><span class="ch-type t-${c.type}">${TYPES[c.type]}</span><span class="ch-unit">${esc(u.short)}</span><time>${c.date}</time><span class="prog ${done ? 'done' : c.read ? 'part' : ''}" style="--p:${pct}%">${done ? '✓ 已读' : c.read + '/' + c.eps}</span></span></button><button class="ch-merge" data-merge="${c.id}" title="合并本章：连续播放全部 ${c.eps} 话">⧉<span> 合并本章</span></button></div>
<div class="ch-eps">${eps}</div></div>`;
}
function renderTree() {
  const el = $('#tree'); if (!el) return;
  let html = '';
  const groups = new Map();
  sorted(filtered()).forEach(c => { const g = groupOf(c); if (!groups.has(g.k)) groups.set(g.k, { ...g, items: [] }); groups.get(g.k).items.push(c); });
  if (!groups.size) html += `<div class="empty">没有匹配的剧情 · <button class="linkbtn" data-act="resetFilter">清空筛选</button></div>`;
  groups.forEach(g => {
    html += `<section class="grp ${st.closed.has(g.k) ? '' : 'open'}"${g.c ? ` style="--gc:${g.c}"` : ''}><button class="grp-h" data-grp="${esc(g.k)}"><span class="caret"></span>${g.c ? '<span class="grp-dot"></span>' : `<span class="grp-ic">${g.ic}</span>`}<span class="grp-t">${esc(g.t)}</span><span class="cnt">${g.items.length}</span></button><div class="grp-b">${g.items.map(chHTML).join('')}</div></section>`;
  });
  el.innerHTML = html;
}
function renderUnits() {
  const el = $('#unitChips'); if (!el) return;
  el.innerHTML = UNITS.map(u => `<button class="uchip ${st.units.has(u.id) ? 'on' : ''}" data-unit="${u.id}" style="--c:${u.color}" title="${esc(u.name)}"><i></i>${esc(u.short)}</button>`).join('') +
    (st.units.size ? '<button class="uchip clear" data-unit="*">✕ 清除</button>' : '');
}
function renderCounts() {
  $$('[data-seg="type"]').forEach(b => { const n = b.querySelector('.n'); if (!n) return; const v = b.dataset.v; n.textContent = v === 'all' ? CH.length : CH.filter(c => c.type === v).length; });
  $$('[data-bind="localCount"]').forEach(e => (e.textContent = st.local.length));
}

/* ───────────── now-playing / episodes ───────────── */
function renderNow() {
  const c = cur(), u = UMAP[c.unit], i = (st.ep - 1) % 8;
  const map = { jp: c.jp, cn: c.cn, ep: c.local ? '全篇' : `第${st.ep}话`, epT: c.local ? KIND[c.local.kind] : `${EP_T[i]} · ${EP_C[i]}`, type: TYPES[c.type], unit: u.name, date: c.date, idol: c.idol, part: c.part, progress: c.local ? '本地' : `${c.read}/${c.eps}`, eps: c.eps, fileNo: (c.local ? 'L-' : c.id.toUpperCase() + '-') + String(st.ep).padStart(2, '0') };
  $$('[data-bind]').forEach(e => { const k = e.dataset.bind; if (k in map) e.textContent = map[k]; });
  document.documentElement.style.setProperty('--unit', u.color);
  const cast = $('#cast'); if (cast) cast.innerHTML = [...new Set(lines().map(L => L.s).filter(s => s && s !== '選択肢'))].map(n => `<span class="cast-i" style="--c:${colorOf(n)}"><span class="av">${esc(n.slice(0, 1))}</span>${esc(n)}</span>`).join('');
}
function renderEps() {
  const el = $('#epStrip'), c = cur();
  if (el) {
    el.innerHTML = Array.from({ length: c.eps }, (_, i) => { const n = i + 1; return `<button class="ep-pill ${st.ep === n ? 'cur' : ''} ${n <= c.read ? 'read' : ''} ${st.merged ? 'merged' : ''}" data-ep-strip="${n}"><span class="ep-thumb" style="background-image:url(${BGS[i % 2]})"></span><span class="ep-no">${c.local ? '全篇' : '第' + n + '话'}</span><span class="ep-name">${c.local ? esc(c.jp) : EP_T[i % 8]}</span>${n <= c.read ? '<span class="ep-ok">✓</span>' : ''}</button>`; }).join('');
    const curEl = el.querySelector('.cur'); curEl && curEl.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  $$('[data-act="prevEp"]').forEach(b => (b.disabled = st.ep <= 1));
  $$('[data-act="nextEp"]').forEach(b => (b.disabled = st.ep >= c.eps));
}
function setBg() { const url = `url(${BGS[(st.ep - 1) % 2]})`; $$('.js-bg').forEach(e => (e.style.backgroundImage = url)); }
function renderTimeline() {
  const el = $('#timeline'), Ls = lines(); if (!el) return;
  const key = cur().id + ':' + Ls.length;
  if (el.dataset.k !== key) { el.dataset.k = key; el.innerHTML = Ls.map((L, i) => `<button class="tl-seg ${L.choice ? 'is-choice' : ''}" data-line="${i}" title="#${i + 1} ${esc(L.s || '旁白')}：${esc(L.cn || L.q.cn)}"></button>`).join(''); }
  $$('.tl-seg', el).forEach((b, i) => { b.classList.toggle('past', i < st.line); b.classList.toggle('cur', i === st.line); });
}

/* ───────────── stage / dialogue ───────────── */
let typer = 0, autoT = 0, typing = false, finishType = () => {}, acted = false, ac = null;
function blip() {
  if (!acted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = 'triangle'; o.frequency.value = 760 + Math.random() * 220;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.08);
  } catch (e) { /* ignore */ }
}
function typeOut(el, s, instant, done) {
  clearInterval(typer); let i = 0; typing = true;
  finishType = () => { clearInterval(typer); el.textContent = s; typing = false; done && done(); };
  if (instant || !s) return finishType();
  el.textContent = '';
  typer = setInterval(() => { i++; el.textContent = s.slice(0, i); if (st.bubble && i % 3 === 1) blip(); if (i >= s.length) finishType(); }, Math.max(10, 34 / st.speed));
}
function scheduleAuto(s) { clearTimeout(autoT); if (st.auto) autoT = setTimeout(next, (900 + s.length * 55) / st.speed); }
function showLine(instant) {
  const Ls = lines(); st.line = Math.max(0, Math.min(st.line, Ls.length - 1));
  const L = Ls[st.line]; clearTimeout(autoT);
  const sp = $('#speaker'), tx = $('#txt'), sub = $('#txtSub'), ch = $('#choices'), stage = $('#stage');
  $$('#hudLine').forEach(e => (e.textContent = `${st.line + 1} / ${Ls.length}`));
  $$('[data-bind="line"]').forEach(e => (e.textContent = `${st.line + 1} / ${Ls.length}`));
  document.documentElement.style.setProperty('--lp', ((st.line + 1) / Ls.length * 100).toFixed(1) + '%');
  renderTimeline();
  if (!sp || !tx) return;
  if (L.choice) {
    clearInterval(typer); typing = false;
    sp.textContent = '選択肢'; sp.style.setProperty('--spk', '#8a94a6'); stage && stage.classList.remove('no-name');
    tx.textContent = st.lang === 'jp' ? L.q.jp : L.q.cn; sub.textContent = st.lang === 'both' ? L.q.jp : ''; sub.classList.add('show');
    ch.innerHTML = L.opts.map((o, i) => `<button class="choice ${st.picks[st.line] === i ? 'picked' : ''}" data-choice="${i}" style="--d:${i * 70}ms"><span class="cj">${esc(st.lang === 'cn' ? o.cn : o.jp)}</span>${st.lang === 'both' ? `<span class="cc">${esc(o.cn)}</span>` : ''}</button>`).join('');
    ch.classList.add('show');
    if (st.auto) autoT = setTimeout(() => pick(st.picks[st.line] ?? 0), 2400 / st.speed);
    return;
  }
  ch.classList.remove('show'); ch.innerHTML = '';
  sp.textContent = L.s; sp.style.setProperty('--spk', colorOf(L.s)); stage && stage.classList.toggle('no-name', !L.s);
  const main = st.lang === 'jp' ? L.jp : L.cn;
  tx.classList.toggle('is-jp', st.lang === 'jp');
  sub.textContent = st.lang === 'both' ? L.jp : ''; sub.classList.remove('show');
  typeOut(tx, main, instant, () => { sub.classList.add('show'); scheduleAuto(main); });
}
function next() {
  if (typing) return finishType();
  const Ls = lines(), L = Ls[st.line];
  if (L.choice && st.picks[st.line] == null) { const ch = $('#choices'); ch && (ch.classList.remove('nudge'), void ch.offsetWidth, ch.classList.add('nudge')); return toast('请先选择一个选项'); }
  if (st.line < Ls.length - 1) { st.line++; showLine(); } else endOfEp();
}
function prev() { if (st.line > 0) { st.line--; showLine(true); } else toast('已是本话第一句'); }
function pick(i) { st.picks[st.line] = i; st.line++; showLine(); }
function markRead() { const c = cur(); if (!c.local && c.read < st.ep) { c.read = st.ep; renderTree(); renderEps(); renderNow(); } }
function endOfEp() {
  const c = cur(); markRead();
  if (st.ep < c.eps && (st.merged || st.auto)) { gotoEp(st.ep + 1); toast(`${st.merged ? '⧉ 合并路线' : '▶ 自动'} · 进入第${st.ep}话`); return; }
  st.auto = false; syncToggles();
  toast(st.ep < c.eps ? `第${st.ep}话 完 · 点「下一话 ›」继续` : `「${c.jp}」全章完 ✓`);
}
function gotoEp(n, o = {}) {
  const c = cur(); st.ep = Math.max(1, Math.min(n, c.eps)); st.line = o.line || 0; if (!o.keepPicks) st.picks = {};
  setBg(); renderNow(); renderEps(); renderTree(); showLine(o.instant);
  const s = $('#stage'); if (s && !o.instant) { s.classList.remove('fade'); void s.offsetWidth; s.classList.add('fade'); }
}
function playCh(id, ep = 1) { st.playLocal = null; st.chId = id; st.openCh.add(id); gotoEp(ep); }
function playLocal(id) {
  const p = st.local.find(x => x.id === id); if (!p) return;
  st.playLocal = id; st.merged = false; syncToggles(); closeModal('#importModal'); gotoEp(1); renderLocalList();
  toast(`▶ 播放本地工程「${p.title}」`);
}

/* ───────────── toggles ───────────── */
function syncSeg() { $$('[data-seg]').forEach(b => { const v = String(st[b.dataset.seg]); if (b.tagName === 'SELECT') b.value = v; else b.classList.toggle('on', v === b.dataset.v); }); }
function syncToggles() {
  const on = { auto: st.auto, rec: st.rec, bubble: st.bubble, motion: st.motion, hide: st.hidden, mergeRoute: st.merged };
  Object.entries(on).forEach(([k, v]) => $$(`[data-act="${k}"]`).forEach(b => { b.classList.toggle('on', v); b.setAttribute('aria-pressed', v); }));
  const s = $('#stage'); if (s) { s.classList.toggle('motion', st.motion); s.classList.toggle('ui-hidden', st.hidden); s.classList.toggle('is-rec', st.rec); s.classList.toggle('is-auto', st.auto); }
  document.body.classList.toggle('is-rec', st.rec);
}
function setSeg(k, v) {
  if (k === 'speed') st.speed = parseFloat(v); else st[k] = v;
  syncSeg();
  if (k === 'type' || k === 'group' || k === 'sort') renderTree();
  if (k === 'lang') showLine(true);
  if (k === 'speed') toast(`播放速度 ${st.speed}×`);
}
function toggleAuto() {
  st.auto = !st.auto; syncToggles(); toast(st.auto ? '▶ 自动播放 开' : '⏸ 自动播放 关');
  if (st.auto && !typing) { lines()[st.line].choice ? showLine(true) : (autoT = setTimeout(next, 600 / st.speed)); } else if (!st.auto) clearTimeout(autoT);
}
function toggleFull() { const s = $('#stage'); if (!s) return; if (document.fullscreenElement) document.exitFullscreen(); else (s.requestFullscreen ? s.requestFullscreen() : Promise.reject()).catch(() => toast('浏览器拒绝了全屏请求')); }
function toggleHide() { st.hidden = !st.hidden; syncToggles(); }
function toggleRec() {
  st.rec = !st.rec; syncToggles();
  if (st.rec) { st.recT = 0; toast('🎬 开始录制（模拟）· 1136×640 · 60fps · WebM'); }
  else toast(`录制完成 · ${cur().jp}_第${st.ep}话_${mmss(st.recT).replace(':', 'm')}s.webm`);
  updRec();
}
function updRec() { $$('#hudRec').forEach(e => (e.textContent = '● REC ' + mmss(st.recT))); }

/* ───────────── modals ───────────── */
function openModal(sel) { const m = typeof sel === 'string' ? $(sel) : sel; if (!m) return; m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); clearTimeout(autoT); }
function closeModal(sel) { const m = typeof sel === 'string' ? $(sel) : sel; if (!m || !m.classList.contains('open')) return; m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); if (st.auto && !typing) scheduleAuto(''); }
function openImport() { closeModal('#backlogModal'); renderPreview(st.pending); renderLocalList(); openModal('#importModal'); }
function openBacklog() {
  closeModal('#importModal');
  const el = $('#backlogList'); if (!el) return;
  const Ls = lines();
  el.innerHTML = Ls.slice(0, st.line + 1).map((L, i) => {
    if (L.choice) {
      const p = st.picks[i];
      return `<div class="bl-item bl-choice"><div class="bl-sp">◆ 分支选择 <span class="bl-no">#${i + 1}</span><span class="bl-q">${esc(L.q.jp)} · ${esc(L.q.cn)}</span></div><div class="bl-opts">${L.opts.map((o, j) => `<button class="bl-opt ${p === j ? 'picked' : ''}" data-branch="${i}:${j}"><b>${p === j ? '✓ ' : ''}${esc(o.jp)}</b><i>${esc(o.cn)}</i><span class="bl-tag ${p === j ? '' : 'alt'}">${p === j ? '当前路线' : p == null ? '选择此项' : '↳ 改走这条分支'}</span></button>`).join('')}</div></div>`;
    }
    return `<button class="bl-item ${i === st.line ? 'cur' : ''}" data-jump="${i}" style="--spk:${colorOf(L.s)}"><span class="bl-sp">${esc(L.s || '旁白')} <span class="bl-no">#${i + 1}</span></span><span class="bl-cn">${esc(L.cn)}</span><span class="bl-jp">${esc(L.jp)}</span><span class="bl-go">↺ 从这里重播</span></button>`;
  }).join('');
  const meta = $('#backlogMeta'); if (meta) { const nC = Ls.slice(0, st.line + 1).filter(L => L.choice).length; meta.textContent = `${cur().jp} · 第${st.ep}话 · ${st.line + 1} 句 · ${nC} 个分支点`; }
  openModal('#backlogModal');
  requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
}

/* ───────────── import ───────────── */
function parseYamlLite(t) {
  const title = (t.match(/^\s*title:\s*["']?(.+?)["']?\s*$/m) || [])[1];
  const sp = [...t.matchAll(/^\s*-?\s*(?:speaker|name|char|s):\s*["']?(.+?)["']?\s*$/gm)].map(m => m[1]);
  const oocM = t.match(/^\s*ooc:\s*(\d+)/m);
  return { title, lines: sp.map(s => ({ speaker: s })), lineCount: sp.length || (t.match(/^\s*-\s/gm) || []).length, ooc: oocM ? +oocM[1] : undefined };
}
function fromData(d, fallback, kind) {
  d = d || {}; const meta = d.meta || d.project || d.manifest || {};
  const title = meta.title || meta.name || d.title || d.name || fallback || '未命名剧本';
  let arr = d.lines || d.script || d.events || d.dialogues || d.dialogue || (Array.isArray(d.scenes) ? d.scenes.flatMap(s => s.lines || s.events || s.script || []) : null) || (Array.isArray(d) ? d : []);
  if (!Array.isArray(arr)) arr = [];
  const spk = [...new Set(arr.map(x => x && (x.speaker || x.name || x.char || x.s)).filter(n => typeof n === 'string' && n && !/^(選択肢|ナレーション|narration)$/i.test(n)))];
  let chars = meta.characters || d.characters || d.cast || spk;
  chars = (Array.isArray(chars) ? chars : []).map(x => typeof x === 'string' ? x : (x.name || x.id || '')).filter(Boolean).slice(0, 10);
  const ooc = d.ooc ?? meta.ooc ?? (d.audit && d.audit.ooc) ?? (d.polish && d.polish.ooc) ?? 0;
  return { title, kind, lines: d.lineCount || arr.length, chars, ooc: Array.isArray(ooc) ? ooc.length : +ooc || 0 };
}
async function readEntries(entries) {
  const out = [];
  const walk = async (en, path) => {
    if (en.isFile) { const f = await new Promise((res, rej) => en.file(res, rej)); try { Object.defineProperty(f, '_path', { value: path + f.name }); } catch (e) { /* noop */ } out.push(f); }
    else if (en.isDirectory) { const rd = en.createReader(); let b; do { b = await new Promise((res, rej) => rd.readEntries(res, rej)); for (const c of b) await walk(c, path + en.name + '/'); } while (b.length); }
  };
  for (const en of entries) await walk(en, '');
  return out;
}
async function handleFiles(fl, isDir, rootName) {
  const files = [...fl]; if (!files.length) return;
  const pv = $('#preview'); pv && (pv.innerHTML = '<div class="pv-loading"><span class="spin"></span>正在解析剧本…</div>');
  try {
    let info;
    if (isDir || files.some(f => f.webkitRelativePath)) {
      const pathOf = f => f._path || f.webkitRelativePath || f.name;
      const root = rootName || pathOf(files[0]).split('/')[0] || '未命名工程';
      const man = files.find(f => /(^|\/)(manifest|project|pack)\.json$/i.test(pathOf(f))) || files.find(f => /\.scproj\.json$/i.test(f.name));
      let data = null; if (man) { try { data = JSON.parse(await man.text()); } catch (e) { /* noop */ } }
      const scripts = files.filter(f => /\.(scs\.ya?ml|ya?ml|scproj\.json|json)$/i.test(f.name) && f !== man);
      info = fromData(data, root.replace(/\.scpack$/i, ''), 'scpack'); info.files = files.length; info.scripts = scripts.length;
      if (!info.lines) {
        let n = 0; const cs = new Set(info.chars);
        for (const f of scripts.slice(0, 30)) {
          const t = await f.text(); let r;
          try { r = /\.ya?ml$/i.test(f.name) ? (() => { const y = parseYamlLite(t); return { lines: y.lineCount, chars: fromData(y).chars }; })() : fromData(JSON.parse(t), '', 'json'); } catch (e) { r = { lines: 0, chars: [] }; }
          n += r.lines; r.chars.forEach(c => cs.add(c));
        }
        info.lines = n; info.chars = [...cs].slice(0, 10);
      }
    } else {
      const f = files[0], name = f.name;
      const kind = /\.scproj\.json$/i.test(name) ? 'scproj' : /\.ya?ml$/i.test(name) ? 'yaml' : /\.json$/i.test(name) ? 'json' : /\.scpack$/i.test(name) ? 'scpack' : null;
      if (!kind) throw new Error(`不支持「${name}」· 请使用 .scproj.json / .scs.yaml / .json / .scpack`);
      if (kind === 'scpack') info = { title: name.replace(/\.scpack$/i, ''), kind, lines: 0, chars: [], ooc: 0, note: '打包工程将在导入时解包并经 polisher-core 校验' };
      else { const t = await f.text(); const data = kind === 'yaml' ? parseYamlLite(t) : JSON.parse(t); info = fromData(data, name.replace(/(\.scproj)?\.json$|(\.scs)?\.ya?ml$/i, ''), kind); }
      info.size = f.size;
    }
    st.pending = info; renderPreview(info);
  } catch (e) { pv && (pv.innerHTML = `<div class="pv-err">✕ 解析失败：${esc(e.message)}</div>`); }
}
function renderPreview(p) {
  const pv = $('#preview'); if (!pv) return;
  if (!p) { pv.innerHTML = '<div class="pv-empty"><b>尚未选择文件</b><span>解析后在此预览：标题 · 角色头像 · 台词数 · OOC 校验</span><button class="linkbtn" data-act="demoImport">✨ 用示例工程试一下</button></div>'; return; }
  pv.innerHTML = `<div class="pv-card"><div class="pv-top"><span class="li-kind k-${p.kind}">${KIND[p.kind]}</span>${p.files ? `<span class="pv-files">${p.files} 个文件 · ${p.scripts || 0} 个剧本</span>` : ''}${p.size ? `<span class="pv-files">${fmtSize(p.size)}</span>` : ''}<span class="pv-detect">已识别</span></div>
<h4 class="pv-title">${esc(p.title)}</h4>
<div class="pv-chars">${p.chars.length ? p.chars.map(n => `<span class="pv-char" style="--c:${colorOf(n)}"><span class="av">${esc(n.slice(0, 1))}</span>${esc(n)}</span>`).join('') : '<span class="muted">未识别到角色</span>'}</div>
<div class="pv-stats"><div><b>${p.lines || '—'}</b><span>台词</span></div><div><b>${p.chars.length}</b><span>角色</span></div><div>${oocBadge(p.ooc, true)}<span>polisher-core</span></div></div>
${p.note ? `<p class="pv-note">${esc(p.note)}</p>` : ''}
<div class="pv-actions"><button class="btn ghost" data-act="addImport">＋ 加入本地库</button><button class="btn primary" data-act="playImport">▶ 导入并播放</button></div></div>`;
}
function addImport() {
  const p = st.pending; if (!p) return null;
  const item = { id: 'lp' + Date.now(), title: p.title, kind: p.kind, lines: p.lines || 0, chars: p.chars, ooc: p.ooc, date: today(), files: p.files };
  st.local.unshift(item); st.pending = null; refreshLocal(); renderPreview(null);
  toast(`已加入「📥 本地工程库」· ${item.title}`); return item.id;
}
function renderLocalList() {
  const el = $('#localList'); if (!el) return;
  el.innerHTML = st.local.length ? st.local.map(p => `<div class="ll-row ${st.playLocal === p.id ? 'cur' : ''}"><div class="ll-main"><b>${esc(p.title)}</b><span><span class="li-kind k-${p.kind}">${KIND[p.kind]}</span>${avatars(p.chars, 4)}${oocBadge(p.ooc)}</span><em>${p.lines} 句 · ${p.date}${p.files ? ' · ' + p.files + ' 个文件' : ''}</em></div><button class="li-btn play" data-local-play="${p.id}" title="立即播放">▶ 立即播放</button><button class="li-btn del" data-local-del="${p.id}" title="移除">✕</button></div>`).join('') : '<div class="empty">还没有导入任何剧本</div>';
}
function refreshLocal() { renderTree(); renderLocalList(); renderCounts(); }
function delLocal(id) {
  const i = st.local.findIndex(p => p.id === id); if (i < 0) return;
  const [p] = st.local.splice(i, 1);
  if (st.playLocal === id) { st.playLocal = null; gotoEp(st.ep); }
  refreshLocal();
  toast(`已移除「${p.title}」`, { label: '撤销', fn: () => { st.local.splice(i, 0, p); refreshLocal(); } });
}

/* ───────────── toast ───────────── */
function toast(msg, act) {
  let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(msg)}</span>${act ? `<button class="toast-act">${esc(act.label)}</button>` : ''}`;
  if (act) el.querySelector('.toast-act').onclick = () => { act.fn(); el.classList.remove('show'); };
  el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), act ? 4500 : 2200);
}

/* ───────────── events ───────────── */
const ACTS = {
  next, prev, replay: () => showLine(), backlog: openBacklog, import: openImport, auto: toggleAuto, rec: toggleRec, full: toggleFull, hide: toggleHide,
  bubble: () => { st.bubble = !st.bubble; acted = true; syncToggles(); toast(st.bubble ? '💬 气泡音 开' : '气泡音 关'); },
  motion: () => { st.motion = !st.motion; syncToggles(); toast(st.motion ? '✦ 微动 开（背景呼吸 / 文本框浮动）' : '微动 关'); },
  prevEp: () => (st.ep > 1 ? gotoEp(st.ep - 1) : toast('已是第一话')),
  nextEp: () => { const c = cur(); markRead(); st.ep < c.eps ? gotoEp(st.ep + 1) : toast('已是最后一话'); },
  mergeRoute: () => { st.merged = !st.merged; syncToggles(); renderEps(); toast(st.merged ? `⧉ 合并路线：连续播放「${cur().jp}」全部 ${cur().eps} 话` : '已退出合并路线'); },
  sidebar: () => document.body.classList.toggle('sb-collapsed'),
  close: (t) => closeModal(t.closest('.modal')),
  demoImport: () => { st.pending = { ...DEMO }; renderPreview(st.pending); },
  addImport, playImport: () => { const id = addImport(); id && playLocal(id); },
  pickFile: () => $('#fileIn') && $('#fileIn').click(), pickDir: () => $('#dirIn') && $('#dirIn').click(),
  clearQ: () => { const q = $('#q'); if (q) { q.value = ''; st.q = ''; renderTree(); q.focus(); } },
  resetFilter: () => { st.q = ''; st.units.clear(); st.type = 'all'; const q = $('#q'); q && (q.value = ''); syncSeg(); renderUnits(); renderTree(); },
  expandAll: () => { st.closed.clear(); renderTree(); }, collapseAll: () => { $$('#tree [data-grp]').forEach(b => st.closed.add(b.dataset.grp)); renderTree(); },
};
document.addEventListener('pointerdown', () => (acted = true), { once: true });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-seg],[data-unit],[data-grp],[data-ch],[data-ep],[data-merge],[data-ep-strip],[data-local-play],[data-local-del],[data-choice],[data-jump],[data-branch],[data-line]');
  if (!t) {
    const s = e.target.closest('#stage');
    if (s && !e.target.closest('button,input,select,a')) { st.hidden ? toggleHide() : next(); }
    else if (e.target.classList && e.target.classList.contains('modal')) closeModal(e.target);
    return;
  }
  if (t.tagName === 'SELECT' || t.tagName === 'INPUT') return;
  const d = t.dataset;
  if (d.act) { ACTS[d.act] ? ACTS[d.act](t) : toast(`「${t.textContent.trim()}」（mockup）`); return; }
  if (d.seg) return setSeg(d.seg, d.v);
  if (d.unit) { if (d.unit === '*') st.units.clear(); else st.units.has(d.unit) ? st.units.delete(d.unit) : st.units.add(d.unit); renderUnits(); renderTree(); return; }
  if (d.grp) { st.closed.has(d.grp) ? st.closed.delete(d.grp) : st.closed.add(d.grp); t.parentElement.classList.toggle('open'); return; }
  if (d.ch) { const open = st.openCh.has(d.ch); open ? st.openCh.delete(d.ch) : st.openCh.add(d.ch); t.closest('.ch').classList.toggle('open', !open); return; }
  if (d.ep) return playCh(d.chid, +d.ep);
  if (d.merge) { playCh(d.merge, 1); st.merged = true; syncToggles(); renderEps(); return toast(`⧉ 合并本章：「${cur().jp}」第1–${cur().eps}话连续播放`); }
  if (d.epStrip) return gotoEp(+d.epStrip);
  if (d.localPlay) return playLocal(d.localPlay);
  if (d.localDel) return delLocal(d.localDel);
  if (d.choice) return pick(+d.choice);
  if (d.line) { st.line = +d.line; return showLine(true); }
  if (d.jump) { st.line = +d.jump; closeModal('#backlogModal'); showLine(); return toast(`↺ 从第 ${st.line + 1} 句重播`); }
  if (d.branch) {
    const [i, j] = d.branch.split(':').map(Number), L = lines()[i];
    const changed = st.picks[i] !== j; st.picks[i] = j;
    Object.keys(st.picks).forEach(k => { if (+k > i) delete st.picks[k]; });
    st.line = i + 1; closeModal('#backlogModal'); showLine();
    return toast(changed ? `↳ 已切换分支 →「${L.opts[j].cn}」` : `继续当前路线「${L.opts[j].cn}」`);
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches('select[data-seg]')) setSeg(t.dataset.seg, t.value);
  if (t.id === 'fileIn') { handleFiles(t.files); t.value = ''; }
  if (t.id === 'dirIn') { handleFiles(t.files, true); t.value = ''; }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { st.q = t.value; renderTree(); t.parentElement && t.parentElement.classList.toggle('has-q', !!t.value); }
  if (t.id === 'bgm') { st.bgm = +t.value; updBgm(); }
});
function updBgm() { const b = $('#bgm'); b && b.style.setProperty('--v', st.bgm + '%'); $$('#hudBgm').forEach(e => (e.textContent = `BGM 002 · ${st.bgm}%`)); $$('[data-bind="bgm"]').forEach(e => (e.textContent = st.bgm + '%')); }
document.addEventListener('keydown', e => {
  const tg = e.target && e.target.nodeType === 1 ? e.target : document.body;
  if (tg.matches('input,textarea,select')) { if (e.key === 'Escape') tg.blur(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.key === ' ' || e.key === 'Enter') && tg.closest('button')) return;
  const open = $('.modal.open'), k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'Escape') { if (open) closeModal(open); else if (st.hidden) toggleHide(); return; }
  if (open && k !== 'l') return;
  const map = { ' ': next, Enter: next, ArrowRight: next, ArrowLeft: prev, l: () => (open ? closeModal(open) : openBacklog()), a: toggleAuto, h: toggleHide, f: toggleFull, r: () => showLine(), i: openImport, '[': ACTS.prevEp, ']': ACTS.nextEp, '/': () => $('#q') && $('#q').focus() };
  if (map[k]) { e.preventDefault(); map[k](); }
});
/* drag files anywhere → open import */
let dragDepth = 0;
window.addEventListener('dragenter', e => { if (![...(e.dataTransfer?.types || [])].includes('Files')) return; dragDepth++; if (!$('#importModal.open')) openImport(); document.body.classList.add('dragging'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging'); $('#drop') && $('#drop').classList.remove('over'); if (!e.target.closest || !e.target.closest('#drop')) dropFiles(e); });
async function dropFiles(e) {
  const items = [...(e.dataTransfer.items || [])], entries = items.map(it => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
  const dir = entries.find(en => en.isDirectory);
  if (dir) handleFiles(await readEntries(entries), true, dir.name); else handleFiles(e.dataTransfer.files);
}
function bindDrop() {
  const d = $('#drop'); if (!d) return;
  ['dragenter', 'dragover'].forEach(ev => d.addEventListener(ev, e => { e.preventDefault(); d.classList.add('over'); }));
  d.addEventListener('dragleave', e => { if (!d.contains(e.relatedTarget)) d.classList.remove('over'); });
  d.addEventListener('drop', e => { e.preventDefault(); d.classList.remove('over'); dropFiles(e); });
}
window.addEventListener('message', e => { const m = e.data || {}; if (m.cmd === 'import') openImport(); else if (m.cmd === 'backlog') openBacklog(); else if (m.cmd === 'close') $$('.modal.open').forEach(closeModal); });

/* ───────────── boot ───────────── */
function init() {
  const tf = new Image(); tf.onload = () => document.documentElement.classList.add('has-tf'); tf.src = '/textframe/001';
  renderUnits(); renderCounts(); renderTree(); syncSeg(); syncToggles(); bindDrop(); updBgm();
  setBg(); renderNow(); renderEps(); showLine(true); renderPreview(null); renderLocalList(); updRec();
  let f = 0, t0 = performance.now();
  const loop = t => { f++; if (t - t0 >= 500) { const v = Math.round(f * 1000 / (t - t0)); $$('#hudFps').forEach(e => (e.textContent = Math.min(v, 144) + 'fps')); f = 0; t0 = t; } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  setInterval(() => { if (st.rec) { st.recT++; updRec(); } }, 1000);
  if (location.hash === '#import') openImport(); else if (location.hash === '#backlog') openBacklog();
  if (window.parent !== window) try { window.parent.postMessage({ cmd: 'ready', style: document.documentElement.dataset.style }, '*'); } catch (e) { /* noop */ }
}
window.MOCK = { openImport, openBacklog, closeAll: () => $$('.modal.open').forEach(closeModal), state: st, toast };
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
