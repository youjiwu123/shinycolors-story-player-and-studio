'use strict';
/**
 * 分析「二创剧作台 Studio」完美使用所需的 enza 资源占用。
 * 用法: node tools/analyze_editor_assets.js [enzaRoot]
 * 输出: 各分类的引用数 / 存在数 / 缺失数 / 体积
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENZA = path.resolve(process.argv[2] || 'D:/enza');
const SPINE = path.join(ENZA, 'assets', 'spine');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function dirSize(p) {
  let total = 0, files = 0;
  const walk = (d) => {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) walk(fp);
      else { try { total += fs.statSync(fp).size; files++; } catch {} }
    }
  };
  walk(p);
  return { total, files };
}
const MB = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';

// 1) 收集所有 Spine 引用
const spineRefs = new Map(); // packPath -> Set(source)
const addRef = (p, src) => {
  if (!p || typeof p !== 'string') return;
  const clean = p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!clean) return;
  if (!spineRefs.has(clean)) spineRefs.set(clean, new Set());
  spineRefs.get(clean).add(src);
};

const outfitsFile = path.join(ROOT, 'studio/data/idol_outfits.json');
if (fs.existsSync(outfitsFile)) {
  const o = readJson(outfitsFile);
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (typeof n.key === 'string' && /^(characters|idols|awake_idols|sub_characters|support_idols|collaborate|events)\//.test(n.key)) addRef(n.key, 'idol_outfits.key');
    if (typeof n.spinePath === 'string') addRef(n.spinePath, 'idol_outfits.spinePath');
    for (const k of Object.keys(n)) if (k !== 'key' && k !== 'spinePath') walk(n[k]);
  };
  walk(o);
}
const combosFile = path.join(ROOT, 'studio/data/char_anim_combos.json');
if (fs.existsSync(combosFile)) {
  const c = readJson(combosFile);
  for (const ch of Object.values(c.characters || {})) addRef(ch.defaultSpinePack, 'char_anim_combos');
}

// 2) 逐包统计
const byFamily = new Map(); // "characters/stand" -> {packs, present, missing:[], total}
let spineTotal = 0, spinePacks = 0, spineMissing = [];
for (const [pack, srcs] of spineRefs) {
  const dir = path.join(SPINE, pack);
  const json = path.join(dir, 'data.json');
  const parts = pack.split('/');
  const family = parts.slice(0, 2).join('/');
  if (!byFamily.has(family)) byFamily.set(family, { packs: 0, present: 0, bytes: 0, missing: [] });
  const rec = byFamily.get(family);
  rec.packs++;
  if (fs.existsSync(json)) {
    rec.present++;
    const { total } = dirSize(dir);
    rec.bytes += total;
    spineTotal += total;
    spinePacks++;
  } else {
    rec.missing.push(pack);
    rec.missingSrc = rec.missingSrc || [];
    spineMissing.push({ pack, srcs: [...srcs] });
  }
}

console.log('=== Spine 引用统计 ===');
for (const [fam, r] of [...byFamily].sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`${fam.padEnd(28)} refs=${String(r.packs).padStart(4)} present=${String(r.present).padStart(4)} missing=${String(r.missing.length).padStart(3)} ${MB(r.bytes).padStart(10)}`);
  if (r.missing.length) console.log('    missing: ' + r.missing.slice(0, 8).join(', ') + (r.missing.length > 8 ? ' …' : ''));
}
console.log(`TOTAL spine packs=${spinePacks} ${MB(spineTotal)}`);

// 3) 其它资源分类
const groups = [
  ['images/event/bg', 'assets/images/event/bg'],
  ['images/event/fg', 'assets/images/event/fg'],
  ['images/event/text_frame', 'assets/images/event/text_frame'],
  ['images/event/select_frame', 'assets/images/event/select_frame'],
  ['images/content', 'assets/images/content'],
  ['sounds/bgm', 'assets/sounds/bgm'],
  ['sounds/se', 'assets/sounds/se'],
  ['movies', 'assets/movies'],
  ['fonts', 'assets/fonts'],
  ['lib', 'assets/lib'],
];
console.log('\n=== 其它资源 ===');
let otherTotal = 0;
for (const [label, rel] of groups) {
  const p = path.join(ENZA, rel);
  if (!fs.existsSync(p)) { console.log(`${label.padEnd(26)} MISSING`); continue; }
  const { total, files } = dirSize(p);
  otherTotal += total;
  console.log(`${label.padEnd(26)} files=${String(files).padStart(5)} ${MB(total).padStart(11)}`);
}

console.log(`\n>>> 完美使用合计(不含 voice/translations): ${MB(spineTotal + otherTotal)}`);
console.log(`>>> 其中 spine ${MB(spineTotal)} + 其它 ${MB(otherTotal)}`);

// 4) 对照：如果只带 characters/* 与 30 人默认私服+打歌服
const corePacks = [...spineRefs.keys()].filter((p) => /^characters\//.test(p));
let coreBytes = 0, corePresent = 0;
for (const pack of corePacks) {
  const dir = path.join(SPINE, pack);
  if (fs.existsSync(path.join(dir, 'data.json'))) { coreBytes += dirSize(dir).total; corePresent++; }
}
console.log(`\n>>> 「基础立绘」characters/* : packs=${corePresent}/${corePacks.length} ${MB(coreBytes)}`);
