'use strict';
/**
 * 校验「精简资源包」对编辑器的覆盖度：服装 / 发型 / 表情动作 是否齐全。
 * 用法: node tools/check_editor_coverage.js --pack output/enza-editor-assets
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
const PACK = path.resolve(arg('pack', 'output/enza-editor-assets'));
const SPINE = path.join(PACK, 'assets', 'spine');
const outfits = JSON.parse(fs.readFileSync(path.join(ROOT, 'studio/data/idol_outfits.json'), 'utf8'));
const combos = JSON.parse(fs.readFileSync(path.join(ROOT, 'studio/data/char_anim_combos.json'), 'utf8'));
const has = (p) => !!p && fs.existsSync(path.join(SPINE, p, 'data.json'));

let outfitTotal = 0, outfitOk = 0, hairTotal = 0, hairOk = 0;
const missingOutfit = [], missingHair = [];
for (const [key, ch] of Object.entries(outfits.idols || {})) {
  for (const o of ch.outfits || []) {
    outfitTotal++;
    if (has(o.key)) outfitOk++;
    else missingOutfit.push(`${key} | ${o.key}`);
  }
  for (const h of ch.hairstyles || []) {
    if (!h.spinePath) continue;
    hairTotal++;
    if (has(h.spinePath)) hairOk++;
    else missingHair.push(`${key} | ${h.spinePath}`);
  }
}
console.log(`角色 ${Object.keys(outfits.idols || {}).length} 个`);
console.log(`服装 ${outfitOk}/${outfitTotal} 可用${missingOutfit.length ? '（缺 ' + missingOutfit.length + '）' : ''}`);
console.log(`发型 ${hairOk}/${hairTotal} 可用${missingHair.length ? '（缺 ' + missingHair.length + '）' : ''}`);
for (const m of [...missingOutfit, ...missingHair]) console.log('  ✗ ' + m);

// 缺失的 char_anim_combos 默认骨架
const missDefault = [];
for (const [label, ch] of Object.entries(combos.characters || {})) {
  if (ch.defaultSpinePack && !has(ch.defaultSpinePack)) missDefault.push(`${label} | ${ch.defaultSpinePack}`);
}
console.log(`\n默认骨架缺失 ${missDefault.length} 个：`);
for (const m of missDefault) console.log('  ✗ ' + m);

// 表情 / 动作动画覆盖
const packSet = new Set();
for (const ch of Object.values(outfits.idols || {})) {
  for (const o of ch.outfits || []) if (has(o.key)) packSet.add(o.key);
  for (const h of ch.hairstyles || []) if (has(h.spinePath)) packSet.add(h.spinePath);
}
const groups = { face: /^face_/, eye: /^eye_/, lip: /^lip_/, pose: /^pose_/, act: /^act_/, arm: /^arm_/, blank: /^blank$/ };
const lack = { face: [], eye: [], lip: [], pose: [], act: [], arm: [] };
let minAnims = Infinity, maxAnims = 0, sum = 0;
for (const p of packSet) {
  const j = JSON.parse(fs.readFileSync(path.join(SPINE, p, 'data.json'), 'utf8'));
  const names = Object.keys(j.animations || {});
  minAnims = Math.min(minAnims, names.length);
  maxAnims = Math.max(maxAnims, names.length);
  sum += names.length;
  for (const [k, re] of Object.entries(groups)) {
    if (k === 'blank') continue;
    if (!names.some((n) => re.test(n))) lack[k].push(p);
  }
}
console.log(`\n被引用骨架 ${packSet.size} 套；动画数 min=${minAnims} max=${maxAnims} avg=${(sum / packSet.size).toFixed(1)}`);
for (const [k, arr] of Object.entries(lack)) {
  console.log(`  含 ${k}_* 动画: ${packSet.size - arr.length}/${packSet.size}` + (arr.length ? `（缺：${arr.slice(0, 3).join(', ')}${arr.length > 3 ? ' …' : ''}）` : ''));
}
