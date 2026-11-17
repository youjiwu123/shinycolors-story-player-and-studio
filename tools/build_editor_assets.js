'use strict';
/**
 * 打造「二创剧作台 Studio」完美使用所需的 enza 资源轻量包。
 *
 * 统计逻辑与 tools/analyze_editor_assets.js 一致：
 *   - Spine：idol_outfits.json 中所有服装/发型 key + char_anim_combos.json 的 defaultSpinePack
 *   - 背景/前景/对话框/选项框/content 图标：整目录
 *   - BGM / SE / movies / fonts / lib：整目录
 * 不包含 voice/ 与 translations/（编辑器不使用原版语音）。
 *
 * 用法:
 *   node tools/build_editor_assets.js --enza D:/enza --out output/editor-assets
 *   node tools/build_editor_assets.js --enza D:/enza --out output/editor-assets --dry-run
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith('--' + name + '='));
  return eq ? eq.slice(name.length + 3) : def;
}
const ENZA = path.resolve(arg('enza', 'D:/enza'));
const OUT = path.resolve(arg('out', path.join(ROOT, 'output', 'editor-assets')));
const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force') || process.argv.includes('-f');

const SPINE = path.join(ENZA, 'assets', 'spine');
const MB = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

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
function copyDir(src, dst) {
  fs.cpSync(src, dst, { recursive: true, force: true });
}
function countPacks(dir) {
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const fp = path.join(d, e.name);
      if (fs.existsSync(path.join(fp, 'data.json'))) n++;
      else walk(fp);
    }
  };
  walk(dir);
  return n;
}

// ---------- 1. 收集 Spine 引用 ----------
function collectSpineRefs() {
  const refs = new Map();
  const add = (p, src) => {
    if (!p || typeof p !== 'string') return;
    const clean = p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!clean) return;
    if (!refs.has(clean)) refs.set(clean, new Set());
    refs.get(clean).add(src);
  };
  const outfits = readJson(path.join(ROOT, 'studio/data/idol_outfits.json'));
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (typeof n.key === 'string' && /^[a-z_]+\/[a-z_]+\//.test(n.key)) add(n.key, 'idol_outfits');
    if (typeof n.spinePath === 'string') add(n.spinePath, 'idol_outfits.spinePath');
    for (const k of Object.keys(n)) if (k !== 'key' && k !== 'spinePath') walk(n[k]);
  };
  walk(outfits);
  const combos = readJson(path.join(ROOT, 'studio/data/char_anim_combos.json'));
  for (const ch of Object.values(combos.characters || {})) add(ch.defaultSpinePack, 'char_anim_combos');
  return refs;
}

// ---------- 2. 计划清单 ----------
const DIR_GROUPS = [
  ['assets/images/event/bg', '背景图（正文演出）'],
  ['assets/images/event/fg', '前景 CG'],
  ['assets/images/event/text_frame', '对话框贴图'],
  ['assets/images/event/select_frame', '选项框贴图'],
  ['assets/images/content', '角色圆形头像 / 卡面小图'],
  ['assets/sounds/bgm', 'BGM（含变体）'],
  ['assets/sounds/se', 'SE 音效'],
  ['assets/movies', '演出视频片段'],
  ['assets/fonts', '游戏原字体'],
  ['assets/lib', 'PIXI + pixi-spine 运行时'],
  ['assets/spine/collaborate', '联动角色骨架（整目录）'],
  ['assets/spine/events', '活动专用骨架（整目录）'],
];

const refs = collectSpineRefs();
const spinePacks = [];
const spineMissing = [];
for (const [pack, srcs] of refs) {
  const dir = path.join(SPINE, pack);
  if (fs.existsSync(path.join(dir, 'data.json'))) spinePacks.push(pack);
  else spineMissing.push({ pack, srcs: [...srcs] });
}
log(`Spine 引用 ${refs.size} 个包：存在 ${spinePacks.length}，缺失 ${spineMissing.length}`);

// 小家族整目录带上（角色常服/Q版/支援卡/进化皮肤/联动/活动），避免漏掉未来新增或
// 未被 idol_outfits 收录的条目（这些家族合计不到 200 MB）；idols / awake_idols 过大，按引用裁剪。
const WHOLE_FAMILIES = ['characters', 'sub_characters', 'support_idols', 'idol_evolution_skins', 'collaborate', 'events'];
const wholeFamilies = WHOLE_FAMILIES.filter((f) => fs.existsSync(path.join(SPINE, f)));
const refPacks = spinePacks.filter((p) => !WHOLE_FAMILIES.includes(p.split('/')[0]));
log(`整目录家族 ${wholeFamilies.length} 个（${wholeFamilies.join(', ')}），逐包复制 ${refPacks.length} 个`);

if (!DRY && fs.existsSync(OUT)) {
  if (!FORCE) {
    console.error(`[中止] 输出目录已存在：${OUT}\n用 --force 覆盖（会先清空该目录）。`);
    process.exit(2);
  }
  log('清空旧输出目录…');
  fs.rmSync(OUT, { recursive: true, force: true });
}

// ---------- 3. 复制 ----------
const families = {};
let spineBytes = 0, spineFiles = 0;
const started = Date.now();
if (!DRY) fs.mkdirSync(path.join(OUT, 'assets', 'spine'), { recursive: true });

for (const fam of wholeFamilies) {
  const src = path.join(SPINE, fam);
  const dst = path.join(OUT, 'assets', 'spine', fam);
  const { total, files } = dirSize(src);
  const packs = countPacks(src);
  spineBytes += total; spineFiles += files;
  families[fam] = { packs, bytes: total, files, wholeFamily: true };
  if (!DRY) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    copyDir(src, dst);
  }
  log(`  整目录 ${fam} · ${packs} 套 · ${MB(total)}`);
}

refPacks.forEach((pack, i) => {
  const src = path.join(SPINE, pack);
  const dst = path.join(OUT, 'assets', 'spine', pack);
  const { total, files } = dirSize(src);
  spineBytes += total; spineFiles += files;
  const fam = pack.split('/').slice(0, 2).join('/');
  families[fam] = families[fam] || { packs: 0, bytes: 0, files: 0 };
  families[fam].packs++; families[fam].bytes += total; families[fam].files += files;
  if (!DRY) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    copyDir(src, dst);
  }
  if ((i + 1) % 250 === 0) log(`  骨架 ${i + 1}/${refPacks.length} · ${MB(spineBytes)}`);
});
const dirStats = [];
let otherBytes = 0, otherFiles = 0;
for (const [rel, label] of DIR_GROUPS) {
  const src = path.join(ENZA, rel);
  if (!fs.existsSync(src)) { log(`  [跳过] 源不存在：${rel}`); continue; }
  const { total, files } = dirSize(src);
  dirStats.push({ rel, label, bytes: total, files });
  otherBytes += total; otherFiles += files;
  if (!DRY) {
    const dst = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    copyDir(src, dst);
  }
}
log(`其它资源 ${dirStats.length} 组 · ${MB(otherBytes)} / ${otherFiles} 文件`);

// ---------- 4. 清单 / 说明 ----------
const totalPacks = Object.values(families).reduce((s, f) => s + (f.packs || 0), 0);
const manifest = {
  generatedAt: new Date().toISOString(),
  source: ENZA,
  purpose: '闪耀色彩 二创剧作台 Studio 完美使用资源包（不含 voice / translations）',
  layout: '本目录即资源挂载根目录（内含 assets/…），在 Studio 顶栏「📂 资源挂载」指向本目录即可。',
  spine: {
    packs: totalPacks,
    referencedPacks: spinePacks.length,
    wholeFamilies,
    files: spineFiles,
    bytes: spineBytes,
    families: Object.fromEntries(Object.entries(families).sort((a, b) => b[1].bytes - a[1].bytes)),
    missingReferencedPacks: spineMissing,
  },
  dirs: dirStats,
  totals: { files: spineFiles + otherFiles, bytes: spineBytes + otherBytes, human: MB(spineBytes + otherBytes) },
};
if (!DRY) {
  fs.writeFileSync(path.join(OUT, 'MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');
  const lines = [
    '闪耀色彩 · 二创剧作台 Studio 资源包（完美使用版）',
    '================================================================',
    '',
    `生成时间：${manifest.generatedAt}`,
    `体积：${manifest.totals.human}（${manifest.totals.files.toLocaleString()} 个文件）`,
    '',
    '【怎么用】',
    '  1. 解压到任意本地目录（例如 D:\\enza-editor-assets）。',
    '  2. 启动播放器 + Studio（启动_二创制作器Studio.bat），打开 http://127.0.0.1:18898/proto/ 。',
    '  3. 顶栏「📂 资源挂载」→ 填入解压后的目录（即包含 assets 文件夹的那一层）→ 保存并热重载挂载。',
    '     也可以直接改 data/mount-config.json 的 enzaRoot 为该目录。',
    '',
    '【包含】',
    '  • assets/spine/  全部被参考的 Spine 骨架（服装/发型/觉醒/进化皮肤，共 ' + totalPacks + ' 套）',
    '  • assets/images/ bg 背景、fg 前景、对话框/选项框贴图、角色头像',
    '  • assets/sounds/ BGM 与 SE 全量（试听 + 成片都用得到）',
    '  • assets/movies/ 演出视频、assets/fonts/ 原字体、assets/lib/ PIXI + pixi-spine',
    '',
    '【不包含】',
    '  • voice/（27 万条原版语音，11.4 GB）—— 编辑器用 TTS 生成配音，播放器看官方全语音剧情才需要',
    '  • translations/（5.3 GB 全量双语）—— 仓库已带中文标题索引',
    '',
    '【已知缺失】服装表（2,509 套）本身全部齐全；以下 10 个「剧本角色别名」的默认骨架在 enza 源里没有对应文件（引用自 char_anim_combos），选中这些别名会退回该角色的其他服装：',
  ];
  for (const m of spineMissing) lines.push('  - ' + m.pack + '  (' + m.srcs.join(', ') + ')');
  lines.push('', '【体积分布】');
  for (const [fam, r] of Object.entries(manifest.spine.families)) {
    lines.push(`  spine/${fam}  ${r.packs} 套  ${MB(r.bytes)}`);
  }
  for (const d of dirStats) lines.push(`  ${d.rel}  ${d.files} 文件  ${MB(d.bytes)}`);
  fs.writeFileSync(path.join(OUT, '使用说明.txt'), lines.join('\r\n'), 'utf8');
}

log(`完成 · ${MB(spineBytes + otherBytes)} · ${(Date.now() - started) / 1000 | 0}s`);
console.log(JSON.stringify(manifest.totals));
