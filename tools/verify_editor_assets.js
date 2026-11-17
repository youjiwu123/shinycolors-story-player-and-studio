'use strict';
/**
 * 校验资源包完整性：文件级 + HTTP 级。
 * 用法:
 *   node tools/verify_editor_assets.js --pack output/editor-assets [--base http://127.0.0.1:18999]
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
const PACK = path.resolve(arg('pack', path.join(ROOT, 'output/editor-assets')));
const BASE = arg('base', '');
const SPINE = path.join(PACK, 'assets', 'spine');

let fail = 0;
const bad = (msg) => { fail++; console.log('  ✗ ' + msg); };

// 1) 文件级：逐包检查 data.json / .atlas / .png
const man = JSON.parse(fs.readFileSync(path.join(PACK, 'MANIFEST.json'), 'utf8'));
const packs = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const fp = path.join(d, e.name);
    if (e.isDirectory()) {
      if (fs.existsSync(path.join(fp, 'data.json'))) packs.push(path.relative(SPINE, fp).replace(/\\/g, '/'));
      else walk(fp);
    }
  }
};
walk(SPINE);
let badPack = 0;
for (const p of packs) {
  const dir = path.join(SPINE, p);
  for (const f of ['data.json', 'data.atlas', 'data.png']) {
    if (!fs.existsSync(path.join(dir, f))) { bad(`spine ${p} 缺 ${f}`); badPack++; }
  }
  const at = fs.readFileSync(path.join(dir, 'data.atlas'), 'utf8').split(/\r?\n/)[0];
  if (at && !fs.existsSync(path.join(dir, at))) { bad(`spine ${p} 缺图集首页 ${at}`); badPack++; }
}
console.log(`Spine: ${packs.length} 套，异常 ${badPack}`);

const checks = [
  ['assets/images/event/bg', (f) => /\.(jpg|png|webp)$/i.test(f)],
  ['assets/images/event/fg', (f) => /\.(png|jpg|webp)$/i.test(f)],
  ['assets/images/content', (f) => /\.(png|jpg|webp)$/i.test(f)],
  ['assets/sounds/bgm', (f) => /\.m4a$/i.test(f)],
  ['assets/sounds/se', (f) => /\.m4a$/i.test(f)],
  ['assets/fonts', () => true],
  ['assets/lib', () => true],
];
for (const [rel] of checks) {
  const d = path.join(PACK, rel);
  const n = fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).filter((f) => fs.statSync(path.join(d, f)).isFile()).length : -1;
  console.log(`${rel}: ${n} 文件`);
  if (n <= 0) bad(`${rel} 为空或缺失`);
}

// 2) HTTP 级（服务端挂载该包后）
if (BASE) {
  const probe = async (u) => {
    const r = await fetch(BASE + u, { method: 'GET' });
    const ok = r.ok;
    if (!ok) bad(`GET ${u} -> ${r.status}`);
    return ok;
  };
  (async () => {
    const samples = [
      '/spine/characters/stand/001/data.json',
      '/spine/characters/stand_costume/001/data.json',
      '/spine/idols/stand_costume/1040010010/data.json',
      '/spine/awake_idols/stand_costume/1040280020/data.json',
      '/spine/idol_evolution_skins/stand_costume/104003013001/data.json',
      '/bg/00889',
      '/bgm/0001',
      '/se-event/001',
      '/font/primula-HummingStd-E.woff2',
      '/lib/pixi-spine.umd.js',
      '/api/animations?label=mano',
    ];
    for (const u of samples) await probe(u);
    console.log(fail === 0 ? '\nHTTP 抽查全部通过 ✓' : `\nHTTP 抽查失败 ${fail} 项 ✗`);
    process.exit(fail ? 1 : 0);
  })();
} else {
  console.log(fail === 0 ? '\n文件级校验通过 ✓' : `\n文件级校验失败 ${fail} 项 ✗`);
  process.exit(fail ? 1 : 0);
}
