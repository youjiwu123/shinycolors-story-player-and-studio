/* =====================================================================
   闪耀色彩 同人工坊 · Prism Studio — G3 交互原型主逻辑
   - 纯原生 JS，无依赖、无网络请求；file:// 直接打开即可
   - 文档模型 = scproj v2 envelope（meta + lines），行身份用编辑器内部 key，不污染数据
   - 真实可用的命令栈：所有修改都经 begin/commit 事务（快照式命令），Ctrl+Z / Ctrl+Y
   ===================================================================== */
(() => {
'use strict';
const M = window.SC_MOCK;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jlen = s => Array.from(String(s || '').replace(/\r?\n/g, '')).length;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd36 = () => Math.random().toString(36).slice(2, 8);
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
function nowISO() {
  const d = new Date(), tz = -d.getTimezoneOffset(), p = n => String(Math.abs(n)).padStart(2, '0');
  return new Date(d.getTime() + tz * 60000).toISOString().slice(0, 19) + (tz >= 0 ? '+' : '-') + p(Math.floor(Math.abs(tz) / 60)) + ':' + p(Math.abs(tz) % 60);
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const EMO = Object.fromEntries(M.emotions), TONE = Object.fromEntries(M.tones), ERA = Object.fromEntries(M.eras);
const STATUS_ZH = { approved: '已批准', generated: '已生成', pending: '待生成', draft: '草稿', rejected: '已弃用', undefined: '—' };
const EMO2FACE = { neutral: 'normal', happy: 'smile', sad: 'sad', angry: 'angry', shy: 'shy', surprised: 'surprised', serious: 'serious', flustered: 'shy', annoyed: 'serious', tender: 'smile', tired: 'close', relieved: 'smile' };
const META_KEYS = ['uid', 'zh', 'speakerZh', 'selectZh', 'i18n', 'ttsText', 'takes', 'takeSelected', 'mode', 'era', 'surfaceEmotion', 'innerEmotion', 'vocalTone', 'macroId', 'macroArgs', 'lipBaked', 'oocFlags', 'origin', 'src', 'ai', 'note', 'stageAction', 'locked', 'holdMs', 'motionTrack', 'moveTrack', 'x-emotion', 'x-beatId', 'x-beatTitle', 'x-beatBgmAuto', 'x-bgmReason', 'x-innerMonologue', 'x-stageNote', 'x-locationBanner'];
const STAGE_ACTION_LABELS = {
  '': '➕ 演出',
  dash_out_right: '🏃 向右跑出',
  dash_out_left: '🏃 向左跑出',
  chase_in_left: '🏃‍♂️ 左侧追入',
  step_back: '↩ 后退一步',
  lean_close: '🔍 身体凑近',
  stumble: '🤕 崴脚顿挫',
  bgm_stop: '🔇 BGM急停',
  bgm_fade: '🔉 BGM淡出',
  flash_shock: '⚡ 震惊闪白',
  awkward_pause: '😶 尴尬停顿'
};
const ALIASES = { tts: 'ttsText', take: 'takeSelected', emo: 'surfaceEmotion', inner: 'innerEmotion', tone: 'vocalTone', macro: 'macroId', ooc: 'oocFlags', hold: 'holdMs' };
const SUGAR = ['say', 'char', 'outfit', 'pos', 'anim', 'face', 'lip', 'anim3', 'anim4', 'anim5', 'effect', 'exit', 'enter', 'bgmFade', 'jump', 'wait', 'autoWait', 'choices', 'still', 'raw', '_meta'];
const RESERVED = new Set([...SUGAR, ...META_KEYS, ...Object.keys(ALIASES)]);
const CRED_KEYS = /^(apiKey|api_key|token|secret|password|authorization)$/i;
const LS = { doc: id => 'scproto.v3.doc.' + id, ui: 'scproto.v3.ui' };

/* ============================== 状态 ============================== */
const S = {
  doc: null, packEntry: null, selKey: null, selChar: null,
  mode: 'polish', textView: 'text', rowView: {}, subtitle: 'both', guides: false, theme: 'light',
  tab: 'acting', actCat: 'recommend', selMotionKf: 0, tlPlayTimer: null, spineStageSyncedSig: null,
  srcTab: 'yaml', collapsed: {}, undo: [], redo: [],
  blobs: {}, waves: {}, newTakes: new Set(),
  bgQuery: '', bgCatFilter: 'all', bgmQuery: '', bgmCatFilter: 'all', seQuery: '',
  preview: null, k: 1, syncSrc: true,
  isDirty: false, bgAudioSub: 'bg', popoutStageWin: null, ttsBusyKey: null, tableRead: null, hairFoldOpen: false, dockTextMode: 'text', dockComposing: false
};
const rows = () => S.doc.rows;
const idxOf = key => S.doc.rows.findIndex(r => r.key === key);
const curIdx = () => Math.max(0, idxOf(S.selKey));
const curRow = () => S.doc.rows[curIdx()];
const newKey = () => 'k' + (++S.doc.keySeq);
const newUid = () => 'u' + Date.now().toString(36).slice(-5) + rnd36().slice(0, 3);

/* ============================== 命令栈（撤销 / 重做） ============================== */
let TX = null;
const snap = () => JSON.stringify(S.doc);
const rowKeysSig = () => (S.doc && Array.isArray(S.doc.rows)) ? S.doc.rows.map(r => r.key).join(',') : '';
function begin(label, { syncStage = true } = {}) {
  if (TX) return false;
  TX = { label, before: snap(), keysBefore: rowKeysSig(), selBefore: S.selKey, syncStage };
  return true;
}
function commit() {
  if (!TX) return;
  const t = TX; TX = null;
  const after = snap();
  if (after !== t.before) {
    S.undo.push({ label: t.label, before: t.before, after, selBefore: t.selBefore, selAfter: S.selKey, at: new Date().toLocaleTimeString() });
    if (S.undo.length > 300) S.undo.shift();
    S.redo.length = 0;
    markDirty();
    const structureChanged = rowKeysSig() !== t.keysBefore;
    if (structureChanged || !S.spineStageSyncedSig) {
      syncLoadDocToSpineStage(false);
    }
    if (t.syncStage !== false) {
      syncGotoLineToSpineStage(false);
    }
  }
  renderHistory();
}
function exec(label, fn, { render = true, syncStage = true } = {}) {
  const own = begin(label, { syncStage });
  try { fn(); } finally { if (own) commit(); }
  if (render) renderAll();
}
function validKey(k) { return idxOf(k) >= 0 ? k : (S.doc.rows[0] && S.doc.rows[0].key); }
function undo() {
  if (TX) commit();
  const c = S.undo.pop();
  if (!c) return toast('没有可撤销的操作');
  S.redo.push(c); S.doc = JSON.parse(c.before); S.selKey = validKey(c.selBefore);
  markDirty(); renderAll(); syncLoadDocToSpineStage(false); syncGotoLineToSpineStage(false); toast('↶ 撤销：' + c.label);
}
function redo() {
  if (TX) commit();
  const c = S.redo.pop();
  if (!c) return toast('没有可重做的操作');
  S.undo.push(c); S.doc = JSON.parse(c.after); S.selKey = validKey(c.selAfter);
  markDirty(); renderAll(); syncLoadDocToSpineStage(false); syncGotoLineToSpineStage(false); toast('↷ 重做：' + c.label);
}

/* ============================== 真 Spine 舞台 (:18899) 实时双向桥接 ============================== */
const CHAR_ID_MAP = {
  mano: '001', hiori: '002', meguru: '003', kogane: '004', mamimi: '005', sakuya: '006', yuika: '007', kiriko: '008',
  kaho: '009', chiyoko: '010', juri: '011', rinze: '012', natsuha: '013', amana: '014', tenka: '015', chiyuki: '016',
  asahi: '017', fuyuko: '018', mei: '019', toru: '020', tooru: '020', madoka: '021', koito: '022', hinana: '023', nichika: '024',
  mikoto: '025', luca: '026', hana: '027', haruki: '028', hazuki: '091',
  ruby: '801', kana: '802', mem: '803', akane: '2048040010'
};
function resolveCharId(lb) {
  if (!lb) return '001';
  const pc = (S.doc && S.doc.pack && S.doc.pack.characters && S.doc.pack.characters[lb]) || {};
  const ci = M.charInfo[lb] || {};
  return pc.charId || ci.charId || CHAR_ID_MAP[lb] || '001';
}
function resolveOutfitsIdolEntry(lb) {
  const src = (window.SC_STUDIO_OUTFITS && window.SC_STUDIO_OUTFITS.idols)
    || (S.idolOutfits && S.idolOutfits.idols)
    || null;
  if (!src || !lb) return null;
  if (src[lb]) return src[lb];
  if (lb === 'tooru' && src.toru) return src.toru;
  if (lb === 'toru' && src.tooru) return src.tooru;
  const numId = CHAR_ID_MAP[lb];
  if (numId) {
    const byId = Object.values(src).find(it => it && String(it.charId) === String(numId));
    if (byId) return byId;
  }
  return null;
}
function getOutfitsForChar(lb) {
  const numId = CHAR_ID_MAP[lb] || resolveCharId(lb) || '001';
  const loaded = resolveOutfitsIdolEntry(lb);
  if (loaded && Array.isArray(loaded.outfits) && loaded.outfits.length > 0) {
    return loaded.outfits;
  }
  return [
    { key: `characters/stand/${numId}`, group: 'casual', label: `🏫 默认日常私服 (stand / ${numId})`, shortLabel: '🏫 默认日常服', charType: 'characters', charCategory: 'stand', charId: numId, clothId: numId },
    { key: `characters/stand_costume/${numId}`, group: 'costume', label: `🎀 组合标准打歌服 (stand_costume / ${numId})`, shortLabel: '🎀 标准打歌服', charType: 'characters', charCategory: 'stand_costume', charId: numId, clothId: numId },
    { key: `idols/stand/300${numId}0030`, group: 'jersey', label: `🏃 283Pro 天蓝练习运动服 (300${numId}0030)`, shortLabel: '🏃 天蓝运动服', charType: 'idols', charCategory: 'stand', charId: `300${numId}0030`, clothId: `300${numId}0030` },
    { key: `idols/stand/300${numId}0060`, group: 'jersey', label: `🏃 283Pro 藏青排练运动服 (300${numId}0060)`, shortLabel: '🏃 藏青运动服', charType: 'idols', charCategory: 'stand', charId: `300${numId}0060`, clothId: `300${numId}0060` },
    { key: `idols/stand/300${numId}0550`, group: 'summer', label: `🏖️ 夏日花卉比基尼泳装 (300${numId}0550)`, shortLabel: '🏖️ 花卉泳装', charType: 'idols', charCategory: 'stand', charId: `300${numId}0550`, clothId: `300${numId}0550` },
    { key: `idols/stand/300${numId}0610`, group: 'summer', label: `🌴 热带度假墨镜热裤夏装 (300${numId}0610)`, shortLabel: '🌴 热带夏装', charType: 'idols', charCategory: 'stand', charId: `300${numId}0610`, clothId: `300${numId}0610` },
    { key: `idols/stand/300${numId}0620`, group: 'summer', label: `🏊 283Pro 竞速连体泳装 (300${numId}0620)`, shortLabel: '🏊 竞速泳装', charType: 'idols', charCategory: 'stand', charId: `300${numId}0620`, clothId: `300${numId}0620` },
    { key: `idols/stand/300${numId}0330`, group: 'casual', label: `☕ 283Pro 咖啡厅侍应生制服 (300${numId}0330)`, shortLabel: '☕ 咖啡厅制服', charType: 'idols', charCategory: 'stand', charId: `300${numId}0330`, clothId: `300${numId}0330` },
    { key: `idols/stand/300${numId}0370`, group: 'casual', label: `🎧 潮酷学园街头耳机装 (300${numId}0370)`, shortLabel: '🎧 街头耳机装', charType: 'idols', charCategory: 'stand', charId: `300${numId}0370`, clothId: `300${numId}0370` },
    { key: `idols/stand/300${numId}0180`, group: 'casual', label: `🌸 春日花仙子编发礼服 (300${numId}0180)`, shortLabel: '🌸 花仙子礼服', charType: 'idols', charCategory: 'stand', charId: `300${numId}0180`, clothId: `300${numId}0180` },
    { key: `idols/stand/104${numId}0010`, group: 'casual', label: `👗 SSR专属私服/便服 #1 (104${numId}0010)`, shortLabel: '👗 SSR私服 #1', charType: 'idols', charCategory: 'stand', charId: `104${numId}0010`, clothId: `104${numId}0010` },
    { key: `idols/stand_costume/104${numId}0010`, group: 'costume', label: `✨ SSR专属舞台打歌服 #1 (104${numId}0010)`, shortLabel: '✨ SSR打歌服 #1', charType: 'idols', charCategory: 'stand_costume', charId: `104${numId}0010`, clothId: `104${numId}0010` },
    { key: `idols/stand_costume/300${numId}0070`, group: 'costume', label: `🖤 1st周年·黑曜星光打歌服 (300${numId}0070)`, shortLabel: '🖤 1st周年服', charType: 'idols', charCategory: 'stand_costume', charId: `300${numId}0070`, clothId: `300${numId}0070` },
    { key: `idols/stand_costume/300${numId}0140`, group: 'costume', label: `🪽 2nd周年·虹翼天使打歌服 (300${numId}0140)`, shortLabel: '🪽 2nd周年服', charType: 'idols', charCategory: 'stand_costume', charId: `300${numId}0140`, clothId: `300${numId}0140` }
  ];
}
function getHairstylesForChar() {
  return [{ key: 'same', hairGroup: 'same', tags: [], label: '原画一体头身（跟随立绘）', shortLabel: '原画一体', spinePath: '' }];
}
function getCurrentHairForChar() {
  return { key: 'same', hairGroup: 'same', tags: [], label: '原画一体头身（跟随立绘）', shortLabel: '原画一体', spinePath: '' };
}
function applyHairToCharacter(lb) {
  if (!lb || !S.doc || !S.doc.rows) return;
  exec(`🧹 清理旧版发型覆盖：${charInfo(lb).name}`, () => {
    const cleanObj = (obj) => {
      if (!obj) return;
      delete obj['x-charHair'];
      delete obj.charHair;
    };
    if (S.doc.pack && S.doc.pack.characters) cleanObj(S.doc.pack.characters[lb]);
    if (S.doc.meta && S.doc.meta.characters) cleanObj(S.doc.meta.characters[lb]);
    if (S.doc.characters) cleanObj(S.doc.characters[lb]);
    S.doc.rows.forEach((r, rIdx) => {
      const rl = r.line;
      const rLb = rl.charLabel || charOfLine(rl);
      if (rLb === lb && rl.charHair !== undefined) {
        mutRow(rIdx, l => { delK(l, 'charHair'); });
      }
    });
  }, { syncStage: false });
  renderInspector();
  syncLoadDocToSpineStage(false);
}
function getCurrentOutfitForChar(lb, lineObj, scObj) {
  const numId = CHAR_ID_MAP[lb] || resolveCharId(lb) || '001';
  const pc = (S.doc && S.doc.pack && S.doc.pack.characters && S.doc.pack.characters[lb]) || {};
  const lineLb = lineObj ? (lineObj.charLabel || charOfLine(lineObj) || '') : '';
  const lineMatches = Boolean(lineObj && (!lineLb || lineLb === lb));
  const rawId = (lineMatches && (lineObj.clothId || lineObj.charId))
    || (scObj && (scObj.clothId || scObj.charId))
    || pc.clothId || pc.charId || numId;
  const charId = (rawId && String(rawId).length >= 3) ? String(rawId) : numId;
  const charType = (lineMatches && lineObj.charType)
    || (scObj && scObj.charType)
    || pc.charType
    || (charId.length >= 7 ? 'idols' : 'characters');
  const charCategory = (lineMatches && lineObj.charCategory)
    || (scObj && scObj.charCategory)
    || pc.charCategory
    || 'stand';
  const key = `${charType}/${charCategory}/${charId}`;
  const list = getOutfitsForChar(lb);
  const matched = list.find(o => o.key === key || (o.charId === charId && o.charCategory === charCategory));
  return matched || {
    key,
    group: charCategory.includes('costume') ? 'costume' : charCategory.includes('jersey') ? 'jersey' : 'casual',
    label: `${charType}/${charCategory}/${charId}`,
    shortLabel: charCategory === 'stand_costume' ? '🎀 打歌服' : charCategory === 'stand_jersey' ? '🏃 运动服' : '🏫 日常服',
    charType,
    charCategory,
    charId,
    clothId: charId
  };
}
const CLIENT_ANIM_ALIASES = {
  shy1: ['shy1', 'shy', 'shy2', 'wait3', 'wait4', 'wait2', 'wait1'],
  shy2: ['shy2', 'shy1', 'shy', 'wait3', 'wait4', 'wait2', 'wait1'],
  shy3: ['shy3', 'shy2', 'shy1', 'shy', 'wait3', 'wait4', 'wait2'],
  face_shy: ['face_shy', 'face_shy1', 'face_shy2', 'face_trouble', 'face_awkward', 'face_close2', 'face_close', 'face_wait'],
  face_shy2: ['face_shy2', 'face_shy', 'face_trouble', 'face_close2', 'face_close', 'face_wait'],
  face_trouble: ['face_trouble', 'face_awkward', 'face_close', 'face_wait'],
  face_normal: ['face_wait', 'face_smile', 'face_smile1'],
  face_surp: ['face_surp', 'face_surp2', 'face_panic', 'face_fear', 'face_fear2', 'face_wait'],
  face_panic: ['face_surp2', 'face_surp', 'face_fear', 'face_fear2', 'face_trouble', 'face_shy', 'face_awkward'],
  face_shock: ['face_surp2', 'face_surp', 'face_fear', 'face_fear2'],
  face_bitter_smile: ['face_awkward', 'face_trouble', 'face_close2', 'face_close', 'face_wait'],
  lip_shy: ['lip_shy', 'lip_trouble', 'lip_sad', 'lip_smile', 'lip_smile1', 'lip_wait'],
  lip_surp: ['lip_surp', 'lip_trouble', 'lip_fear', 'lip_wait'],
  lip_trouble: ['lip_shy', 'lip_sad', 'lip_smile', 'lip_smile1', 'lip_wait'],
  lip_wait_s: ['lip_wait_s', 'lip_smile_s', 'lip_smile1_s', 'lip_smile_s2', 'lip_smile2_s', 'lip_shy_s', 'lip_sad_s', 'lip_trouble_s', 'lip_serious_s', 'lip_anger_s', 'lip_anger1_s', 'blank']
};
function getOutfitAnimSetForChar(lb, outfitSpecOrLine, scObj) {
  const outfits = getOutfitsForChar(lb);
  const spec = outfitSpecOrLine && (outfitSpecOrLine.charId || outfitSpecOrLine.clothId || outfitSpecOrLine.key)
    ? outfitSpecOrLine
    : getCurrentOutfitForChar(lb, outfitSpecOrLine, scObj);
  const cid = String((spec && (spec.clothId || spec.charId)) || '');
  const ctype = (spec && spec.charType) || '';
  const ccat = (spec && spec.charCategory) || '';
  const key = (spec && spec.key) || (ctype && ccat && cid ? `${ctype}/${ccat}/${cid}` : '');
  const hit = (key && outfits.find(o => o.key === key && Array.isArray(o.anims) && o.anims.length))
    || (cid && outfits.find(o => o.charId === cid && (!ccat || o.charCategory === ccat) && Array.isArray(o.anims) && o.anims.length))
    || (cid && outfits.find(o => o.charId === cid && Array.isArray(o.anims) && o.anims.length));
  return (hit && hit.anims && hit.anims.length) ? new Set(hit.anims) : null;
}
function resolveClientValidClip(validSet, rawClip, slot) {
  if (!validSet || !validSet.size) return rawClip || '';
  if (!rawClip) return '';
  const s = String(rawClip).trim();
  if (slot === 'closed_lip') {
    if (validSet.has(s) && (/_s\d*$/.test(s) || s === 'blank')) return s;
    for (const c of CLIENT_ANIM_ALIASES.lip_wait_s) {
      if (validSet.has(c)) return c;
    }
    for (const a of validSet) {
      if (/_s\d*$/.test(a)) return a;
    }
    return validSet.has('blank') ? 'blank' : 'lip_wait_s';
  }
  if (validSet.has(s)) return s;
  const aliases = CLIENT_ANIM_ALIASES[s];
  if (aliases) {
    for (const al of aliases) {
      if (validSet.has(al)) return al;
    }
  }
  if (slot === 'eye') {
    for (const fb of ['eye_front', 'eye_right', 'eye_left']) {
      if (validSet.has(fb)) return fb;
    }
    return '';
  }
  if (slot === 'head') return '';
  if (slot === 'lip') {
    if (/_s\d*$|^blank$/.test(s)) return resolveClientValidClip(validSet, s, 'closed_lip');
    for (const fb of ['lip_smile', 'lip_smile1', 'lip_sad', 'lip_trouble', 'lip_wait', 'lip_a']) {
      if (validSet.has(fb)) return fb;
    }
    return '';
  }
  if (slot === 'face') {
    for (const fb of ['face_wait', 'face_close2', 'face_close', 'face_smile', 'face_smile1', 'blank']) {
      if (validSet.has(fb)) return fb;
    }
    return 'face_wait';
  }
  for (const fb of ['wait1', 'wait2', 'wait3', 'wait', 'smile1', 'yes']) {
    if (validSet.has(fb)) return fb;
  }
  return 'wait1';
}
function sanitizeLineClipsForOutfit(l, lb, outfitSpec) {
  if (!l || !lb) return;
  const validSet = getOutfitAnimSetForChar(lb, outfitSpec || l);
  if (!validSet || !validSet.size) return;
  if (l.charAnim1) l.charAnim1 = resolveClientValidClip(validSet, l.charAnim1, 'body');
  if (l.charAnim2) l.charAnim2 = resolveClientValidClip(validSet, l.charAnim2, 'face');
  if (l.charAnim3) {
    const h = resolveClientValidClip(validSet, l.charAnim3, 'head');
    if (h) l.charAnim3 = h; else delete l.charAnim3;
  }
  if (l.charAnim4) {
    const e = resolveClientValidClip(validSet, l.charAnim4, 'eye');
    if (e) l.charAnim4 = e; else delete l.charAnim4;
  }
  const mm = l._meta;
  const isMono = Boolean((mm && mm['x-innerMonologue']) || isMonologueText(l.text, mm && mm.zh) || !l.text || (l.charLipAnim && /_s\d*$|^blank$/.test(String(l.charLipAnim))));
  if (l.charLipAnim) {
    l.charLipAnim = resolveClientValidClip(validSet, l.charLipAnim, isMono ? 'closed_lip' : 'lip');
  }
  if (l.lip) {
    l.lip = resolveClientValidClip(validSet, l.lip, isMono ? 'closed_lip' : 'lip');
  }
  if (mm && Array.isArray(mm.motionTrack)) {
    mm.motionTrack.forEach((kf) => {
      if (!kf || typeof kf !== 'object') return;
      if (kf.anim1) kf.anim1 = resolveClientValidClip(validSet, kf.anim1, 'body');
      if (kf.anim2) kf.anim2 = resolveClientValidClip(validSet, kf.anim2, 'face');
      if (kf.anim3) { const kh = resolveClientValidClip(validSet, kf.anim3, 'head'); if (kh) kf.anim3 = kh; else delete kf.anim3; }
      if (kf.anim4) { const ke = resolveClientValidClip(validSet, kf.anim4, 'eye'); if (ke) kf.anim4 = ke; else delete kf.anim4; }
    });
  }
  if (Array.isArray(l.subBeats)) {
    l.subBeats = l.subBeats
      .map((sb) => {
        if (!sb || typeof sb !== 'object') return null;
        if (sb.charAnim1) sb.charAnim1 = resolveClientValidClip(validSet, sb.charAnim1, 'body');
        if (sb.charAnim2) sb.charAnim2 = resolveClientValidClip(validSet, sb.charAnim2, 'face');
        if (sb.charAnim4) {
          const se = resolveClientValidClip(validSet, sb.charAnim4, 'eye');
          if (se) sb.charAnim4 = se; else delete sb.charAnim4;
        }
        return (sb.charAnim1 || sb.charAnim2 || sb.charAnim4) ? sb : null;
      })
      .filter(Boolean);
    if (!l.subBeats.length) delete l.subBeats;
  }
}
function applyOutfitToCharacter(lb, outfitSpec, applyAllRows = true) {
  if (!lb || !outfitSpec || !S.doc || !S.doc.rows) return;
  const oType = outfitSpec.charType || (String(outfitSpec.charId || '').length >= 7 ? 'idols' : 'characters');
  const oCat = outfitSpec.charCategory || 'stand';
  const oId = String(outfitSpec.clothId || outfitSpec.charId || resolveCharId(lb));
  const targetIdx = charTargetRow(lb);

  exec(`👗 换装：${charInfo(lb).name} → ${outfitSpec.shortLabel || outfitSpec.label}`, () => {
    const patchCharObj = (obj) => {
      if (!obj) return;
      obj.charType = oType;
      obj.charCategory = oCat;
      obj.charId = oId;
      obj.clothId = oId;
      delete obj['x-charHair'];
      delete obj.charHair;
    };
    if (S.doc.pack && S.doc.pack.characters) patchCharObj(S.doc.pack.characters[lb]);
    if (S.doc.meta && S.doc.meta.characters) patchCharObj(S.doc.meta.characters[lb]);
    if (S.doc.characters) patchCharObj(S.doc.characters[lb]);
    if (applyAllRows) {
      let touched = 0;
      S.doc.rows.forEach((r, rIdx) => {
        const rl = r.line;
        const rLb = rl.charLabel || charOfLine(rl);
        if (rLb === lb && !isProducer(rl.speaker)) {
          mutRow(rIdx, l => {
            if (!l.charLabel) setK(l, 'charLabel', lb);
            setK(l, 'charType', oType);
            setK(l, 'charCategory', oCat);
            setK(l, 'charId', oId);
            setK(l, 'clothId', oId);
            delK(l, 'charHair');
            sanitizeLineClipsForOutfit(l, lb, { charType: oType, charCategory: oCat, charId: oId, clothId: oId });
          });
          touched++;
        }
      });
      if (touched === 0) {
        mutRow(targetIdx, l => {
          if (!l.charLabel) setK(l, 'charLabel', lb);
          setK(l, 'charType', oType);
          setK(l, 'charCategory', oCat);
          setK(l, 'charId', oId);
          setK(l, 'clothId', oId);
          delK(l, 'charHair');
          sanitizeLineClipsForOutfit(l, lb, { charType: oType, charCategory: oCat, charId: oId, clothId: oId });
        });
      }
    } else {
      mutRow(targetIdx, l => {
        if (!l.charLabel) setK(l, 'charLabel', lb);
        setK(l, 'charType', oType);
        setK(l, 'charCategory', oCat);
        setK(l, 'charId', oId);
        setK(l, 'clothId', oId);
        delK(l, 'charHair');
        sanitizeLineClipsForOutfit(l, lb, { charType: oType, charCategory: oCat, charId: oId, clothId: oId });
      });
    }
  }, { syncStage: false });

  // Sync full document and trigger live Spine outfit swap on :18899 stage
  syncLoadDocToSpineStage(false);
  previewPoseOnSpineStage({
    charLabel: lb,
    charType: oType,
    charCategory: oCat,
    charId: oId,
    clothId: oId,
    syncDoc: false
  });
  toast(`👗 ${charInfo(lb).name} 已换装为「${outfitSpec.label}」并同步至真 Spine 舞台！`);
}
function isMonologueText(text, zh) {
  const checkStr = (raw) => {
    const s = String(raw || '').trim();
    if (!s || s.length < 2) return false;
    let inner = '';
    if (s.startsWith('（') && s.endsWith('）')) inner = s.slice(1, -1);
    else if (s.startsWith('(') && s.endsWith(')')) inner = s.slice(1, -1);
    else return false;
    return !inner.includes('「') && !inner.includes('」');
  };
  return checkStr(text) || checkStr(zh);
}
function isInnerMonologueRow(line) {
  if (!line) return false;
  const lip = String(line.charLipAnim || line.lip || '').trim().toLowerCase();
  if (lip === 'lip_wait_s' || lip === 'blank' || lip === 'off' || /^lip_.*_s\d*$/.test(lip)) return true;
  const m = line._meta || {};
  if (m['x-innerMonologue']) return true;
  return isMonologueText(line.text, m.zh);
}
function isClosedOrBrokenLipToken(lipName) {
  const s = String(lipName || '').trim().toLowerCase();
  return !s || s === 'lip_wait_s' || s === 'blank' || s === 'off' || s === 'lip_a' || /_s\d*$/.test(s);
}
function buildCompiledLinesFromCurrentRows() {
  if (!S.doc || !Array.isArray(S.doc.rows)) return [];
  return S.doc.rows.map((r, idx) => {
    const l = clone(r.line);
    const lb = l.charLabel || charOfLine(l);
    let outfitValidSet = null;
    if (lb && !isProducer(l.speaker)) {
      const st = stageAt(idx);
      const sc = st.chars[lb] || {};
      const outfit = getCurrentOutfitForChar(lb, l, sc);
      l.charLabel = lb;
      l.charType = outfit.charType || 'characters';
      l.charId = outfit.charId || resolveCharId(lb);
      l.clothId = outfit.clothId || l.charId;
      l.charCategory = outfit.charCategory || 'stand';
      delete l.charHair;
      l.charScale = l.charScale || 1;
      if (!l.charPosition) {
        l.charPosition = {
          x: Math.round(sc.x != null ? sc.x : 568),
          y: Math.round(sc.y != null ? sc.y : 610),
          order: Math.max(0, st.cast.indexOf(lb))
        };
      }
      outfitValidSet = getOutfitAnimSetForChar(lb, outfit, sc);
      sanitizeLineClipsForOutfit(l, lb, outfit);
    }
    const mm = l._meta || {};
    const isExplicitMono = Boolean(mm['x-innerMonologue'] || isMonologueText(l.text, mm.zh));
    if (isExplicitMono) {
      const closedClip = resolveClientValidClip(outfitValidSet, l.charLipAnim || 'lip_wait_s', 'closed_lip');
      l.charLipAnim = closedClip;
      l.lip = closedClip;
      if (!l._meta || typeof l._meta !== 'object') l._meta = {};
      l._meta['x-innerMonologue'] = true;
    }
    return l;
  });
}
const studioBus = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('sc-studio-bus') : null;
function postToSpineStage(msg) {
  const ifr = $('#realSpineIframe');
  if (ifr && ifr.contentWindow) {
    try { ifr.contentWindow.postMessage(msg, '*'); } catch (_) {}
  }
  const pop = S.popoutStageWin || window.__SC_POPOUT_STAGE_WIN;
  if (pop && !pop.closed) {
    try { pop.postMessage(msg, '*'); } catch (_) {}
  }
  if (studioBus && msg && typeof msg.type === 'string') {
    try { studioBus.postMessage(msg); } catch (_) {}
  }
}
function syncLoadDocToSpineStage(play = false) {
  if (!S.doc || !S.doc.rows) return;
  S.spineStageSyncedSig = snap();
  postToSpineStage({
    type: 'sc-studio:load-doc',
    id: (S.doc.meta && S.doc.meta.id) || '',
    lines: buildCompiledLinesFromCurrentRows(),
    index: curIdx(),
    play: !!play
  });
}
function syncGotoLineToSpineStage(play = false) {
  if (!S.doc || !S.doc.rows) return;
  const idx = curIdx();
  const compiled = buildCompiledLinesFromCurrentRows();
  postToSpineStage({
    type: 'sc-studio:goto-line',
    index: idx,
    linePatch: compiled[idx] || (curRow() && curRow().line) || {},
    play: !!play
  });
}
function previewPoseOnSpineStage(overrides = {}) {
  if (!S.doc || !S.doc.rows) return;
  if (!S.spineStageSyncedSig && overrides.syncDoc !== false) {
    syncLoadDocToSpineStage(false);
  }
  const idx = curIdx();
  const st = stageAt(idx);
  const l = (S.doc.rows[idx] && S.doc.rows[idx].line) || {};
  const lb = overrides.charLabel || l.charLabel || charOfLine(l) || S.selChar || st.cast[0] || 'amana';
  const lLb = l ? (l.charLabel || charOfLine(l) || '') : '';
  const lineForChar = (l && lLb === lb) ? l : null;
  const sc = st.chars[lb] || {};
  const curOutfit = getCurrentOutfitForChar(lb, lineForChar, sc);
  const resolvedId = overrides.clothId || overrides.charId || curOutfit.charId || resolveCharId(lb);
  const resolvedType = overrides.charType || curOutfit.charType || (String(resolvedId).length >= 7 ? 'idols' : 'characters');
  const resolvedCat = overrides.charCategory || curOutfit.charCategory || 'stand';
  const payload = {
    type: 'sc-studio:preview-pose',
    charLabel: lb,
    charId: resolvedId,
    clothId: resolvedId,
    charType: resolvedType,
    charCategory: resolvedCat,
    charAnim1: overrides.charAnim1 !== undefined ? overrides.charAnim1 : ((lineForChar && lineForChar.charAnim1) || sc.anim1 || 'wait1'),
    charAnim2: overrides.charAnim2 !== undefined ? overrides.charAnim2 : ((lineForChar && lineForChar.charAnim2) || ('face_' + (sc.face || 'normal'))),
    charAnim3: overrides.charAnim3 !== undefined ? overrides.charAnim3 : ((lineForChar && lineForChar.charAnim3) || ''),
    charAnim4: overrides.charAnim4 !== undefined ? overrides.charAnim4 : ((lineForChar && lineForChar.charAnim4) || sc.eye || 'eye_front'),
    charLipAnim: (lineForChar && isInnerMonologueRow(lineForChar) && !overrides.charLipAnim) ? 'lip_wait_s' : (overrides.charLipAnim || (lineForChar && lineForChar.charLipAnim) || 'lip_smile'),
    x: overrides.x != null ? overrides.x : Math.round((lineForChar && lineForChar.charPosition && lineForChar.charPosition.x != null) ? lineForChar.charPosition.x : (sc.x != null ? sc.x : 568)),
    y: overrides.y != null ? overrides.y : Math.round((lineForChar && lineForChar.charPosition && lineForChar.charPosition.y != null) ? lineForChar.charPosition.y : (sc.y != null ? sc.y : 610)),
    scale: overrides.scale != null ? overrides.scale : ((lineForChar && lineForChar.charScale) || sc.scale || 1),
    moveFromX: overrides.moveFromX,
    moveToX: overrides.moveToX,
    moveTime: overrides.moveTime,
    bg: overrides.bg !== undefined ? overrides.bg : (l.bg !== undefined ? l.bg : st.bg)
  };
  postToSpineStage(payload);
}

/* ============================== 行操作工具 ============================== */
const officialSig = line => JSON.stringify(line, (k, v) => (k === '_meta' ? undefined : v));
function meta(line) { if (!line._meta) line._meta = {}; return line._meta; }
function cleanMeta(line) { if (line._meta && !Object.keys(line._meta).length) delete line._meta; }
/** 设官方键：已有键保持原位置；新键追加后把 _meta 挪回行末（规范形） */
function setK(line, k, v) {
  line[k] = v;
  if (line._meta && k !== '_meta') { const m = line._meta; delete line._meta; line._meta = m; }
}
function delK(line, k) { delete line[k]; }
function syncVoiceTimingOnLine(ln, info = {}) {
  const voicePath = String(info.voice || '').trim();
  if (!voicePath) {
    delete ln.voice;
    delete ln.lipSegments;
    delete ln.lipAnimDuration;
    delete ln.dur;
    return;
  }
  setK(ln, 'voice', voicePath);
  const durMs = Math.round(Number(info.durationMs) || 0);
  if (durMs > 0) {
    setK(ln, 'lipAnimDuration', durMs);
    setK(ln, 'dur', Number((durMs / 1000).toFixed(3)));
  } else {
    delete ln.lipAnimDuration;
    delete ln.dur;
  }
  const segs = Array.isArray(info.lipSegments) && info.lipSegments.length
    ? info.lipSegments.map(s => (Array.isArray(s) ? [Math.round(Number(s[0]) || 0), Math.round(Number(s[1]) || 0)] : s))
    : null;
  if (segs && segs.length) {
    setK(ln, 'lipSegments', segs);
  } else {
    delete ln.lipSegments;
  }
  if (durMs > 0 && Array.isArray(ln.subBeats) && ln.subBeats.length) {
    const filtered = ln.subBeats.filter(b => b && (Number(b.atMs || b.at || 0) <= durMs - 650));
    if (filtered.length) setK(ln, 'subBeats', filtered);
    else delete ln.subBeats;
  }
}
function mutRow(i, fn) {
  const r = S.doc.rows[i]; if (!r) return;
  const before = officialSig(r.line);
  fn(r.line);
  cleanMeta(r.line);
  if (officialSig(r.line) !== before) onOfficialEdit(i);
}
function onOfficialEdit(i) {
  const m = S.doc.rows[i].line._meta; if (!m) return;
  if (m.origin === 'official') m.origin = 'edited';
  if (m.macroId) detachMacro(i);
}
const macroOf = i => (S.doc.rows[i] && S.doc.rows[i].line._meta && S.doc.rows[i].line._meta.macroId) || null;
function detachMacro(i) {
  const id = macroOf(i); if (!id) return;
  let a = i, b = i; const R = S.doc.rows;
  while (a > 0 && macroOf(a - 1) === id) a--;
  while (b < R.length - 1 && macroOf(b + 1) === id) b++;
  for (let k = a; k <= b; k++) { const l = R[k].line; delete l._meta.macroId; delete l._meta.macroArgs; cleanMeta(l); }
  toast('🧩 已脱离宏 ' + id + '（宏内官方字段被修改）');
}
function kindOf(l) {
  if (!l) return 'direction';
  if (l._meta && l._meta.rowKind === 'cue') return 'cue';
  if (l.select !== undefined) return 'select';
  if (typeof l.text === 'string' && l.speaker !== 'off') return 'dialogue';
  if (l.label !== undefined) return 'label';
  return 'direction';
}
function charInfo(label) {
  const ci = M.charInfo[label]; const pc = (S.doc.pack.characters || {})[label] || {};
  return ci ? ci : { name: pc.name || label, nameZh: pc.nameZh || label, color: '#8a94b8', hair: '#4a5068', pitch: 1, dual: false };
}
function charOfLine(l) {
  if (!l) return null;
  if (l.charLabel) return l.charLabel;
  for (const [k, c] of Object.entries(S.doc.pack.characters || {})) if (l.speaker && (c.name === l.speaker || c.nameZh === l.speaker)) return k;
  return null;
}
const isProducer = sp => M.PRODUCER_NAMES.includes(sp);
function speakerColor(l) {
  const lb = charOfLine(l);
  if (lb && (l.speaker === undefined || l.speaker === charInfo(lb).name || !isProducer(l.speaker))) return charInfo(lb).color;
  return '#8793b8';
}
function nextId() {
  const sid = S.doc.meta.id, numeric = /^\d{6,}$/.test(sid); let max = 0;
  for (const { line } of S.doc.rows) {
    if (numeric && typeof line.id === 'number') max = Math.max(max, Math.floor((line.id % 10000) / 10));
    else if (typeof line.id === 'string') { const m = line.id.match(/_(\d+)$/); if (m) max = Math.max(max, +m[1]); }
  }
  const seq = max + 1;
  return numeric ? Number(sid + String(seq * 10).padStart(4, '0')) : sid + '_' + String(seq).padStart(3, '0');
}
function findLabel(name) { return S.doc.rows.findIndex(r => r.line.label === name); }
function insertRows(at, lines, label) {
  const made = lines.map(l => ({ key: newKey(), line: l }));
  S.doc.rows.splice(at, 0, ...made);
  return made;
}
const STUDIO_POST_LINE_GAP_MS = 1150;
function specialFxDur(l) {
  const m = (l && l._meta) || {};
  let ms = 0;
  if (l && l.waitTime != null && Number(l.waitTime) > 0) ms = Math.max(ms, Number(l.waitTime));
  if (Number(m.holdMs) > 0) ms = Math.max(ms, Number(m.holdMs));
  if (l && l.bgEffectTime != null && Number(l.bgEffectTime) > 0) ms = Math.max(ms, Number(l.bgEffectTime));
  else if (l && l.bgEffect) ms = Math.max(ms, 1800);
  if (l && l.effectValue && typeof l.effectValue === 'object' && Number(l.effectValue.time) > 0) ms = Math.max(ms, Number(l.effectValue.time));
  else if (l && (l.charEffect || l.effectLabel)) ms = Math.max(ms, 1600);
  if (l && (l.fg || l.middleFg || l.stillType || l.stillId || l.locationBanner || l.bgm === 'fade_out')) ms = Math.max(ms, 2200);
  if (m.moveTrack || m.motionTrack || m.stageAction) ms = Math.max(ms, 1800);
  return ms;
}
function estDur(l) {
  const k = kindOf(l), m = l._meta || {};
  if (k === 'dialogue') {
    const t = (m.takes || []).find(t => t.id === m.takeSelected);
    const speechMs = Math.max(t && t.durationMs > 600 ? t.durationMs : 0, 500 + jlen(l.text) * 70);
    return speechMs + Math.max(STUDIO_POST_LINE_GAP_MS, Number(m.holdMs) || 0, specialFxDur(l));
  }
  if (k === 'select') return 2000;
  if (k === 'label') return 0;
  return Math.max(Number(l.waitTime) || 0, specialFxDur(l)) || 600;
}

/* ============================== OOC 守卫 ============================== */
function checkLine(l) {
  const out = []; const k = kindOf(l);
  if (k !== 'dialogue' || !l.text) return out;
  const text = l.text, label = charOfLine(l), m = l._meta || {}, mode = m.mode || null;
  const ci = label ? M.charInfo[label] : null;
  const speakingAsChar = label && !isProducer(l.speaker);
  if (ci && speakingAsChar && ci.firstPerson) {
    const rule = mode ? (ci.firstPerson[mode] || ci.firstPerson.any) : (ci.firstPerson.any || null);
    if (rule && new RegExp(rule.wrong.source).test(text)) {
      const mm = text.match(new RegExp(rule.wrong.source));
      out.push({ code: 'first_person', sev: 'error', title: '一人称', message: rule.msg + (mode ? `（当前：${mode === 'omote' ? '营业' : '本音'}）` : ''), from: mm[0], to: rule.ok, fix: { kind: 'replace', re: rule.wrong.source, to: rule.ok } });
    }
  }
  if (speakingAsChar) for (const a of M.addressMatrix) {
    if (a.from !== label || (a.mode && a.mode !== mode)) continue;
    const mm = text.match(new RegExp(a.wrong.source));
    if (mm) out.push({ code: 'address', sev: a.sev, title: '称呼', message: a.msg + '（28×28 称呼矩阵）', from: mm[0], to: a.correct, fix: { kind: 'replace', re: a.wrong.source, to: a.correct } });
  }
  if (speakingAsChar && label === 'fuyuko' && /♪/.test(text)) {
    out.push({ code: 'symbol', sev: 'warn', title: '符号 ♪→♡', message: '冬優子营业（omote）句尾标识为「♡」，极少用「♪」', from: '♪', to: '♡', fix: { kind: 'replace', re: '♪', to: '♡' } });
  }
  if (speakingAsChar && /283プロの子たち/.test(text)) {
    out.push({ code: 'peer_term', sev: 'warn', title: '同辈称谓', message: '偶像称呼同事务所同伴建议用「事務所のみんな」或具体名字，不用「283プロの子たち」', from: '283プロの子たち', to: '事務所のみんな', fix: { kind: 'replace', re: '283プロの子たち', to: '事務所のみんな' } });
  }
  const n = jlen(text);
  if (n > M.LINE_LIMIT) out.push({ code: 'overflow', sev: 'warn', title: `超长 ${n}/${M.LINE_LIMIT}`, message: `对话框单页上限 ${M.LINE_LIMIT} 字，当前 ${n} 字。一键修复：在最接近中点的标点处拆成两行（新行发新 uid，中文同步拆分）。`, fix: { kind: 'split' } });
  if (mode && label && ci && !ci.dual) out.push({ code: 'mode_dual', sev: 'warn', title: '本音/营业', message: 'V14：honne / omote 只用于有二面性的角色（如冬優子）。', fix: { kind: 'clearMode' } });
  const tts = m.ttsText;
  for (const r of M.readingRules) {
    const re = new RegExp(r.re.source);
    if (re.test(text) && (tts === undefined || re.test(tts))) out.push({ code: 'tts_reading', sev: 'info', title: '读音', message: r.msg + '：写入 _meta.ttsText，显示台词不变。', fix: { kind: 'reading' } });
  }
  if (tts && /[♪☆★♡]/.test(tts)) out.push({ code: 'tts_symbol', sev: 'info', title: '读音含符号', message: '送 TTS 的读音里含 ♪ 等符号，建议去掉。', fix: { kind: 'stripSym' } });
  if (speakingAsChar && window.PolisherCore && typeof window.PolisherCore.validateLine === 'function') {
    try {
      const pcRes = window.PolisherCore.validateLine({ speaker: l.speaker, text }, label, { mode });
      if (pcRes && Array.isArray(pcRes.issues)) {
        const existingCodes = new Set(out.map(x => x.code));
        pcRes.issues.forEach(pf => {
          if (pf.level !== 'error' && pf.level !== 'warn') return;
          const c = pf.type || 'polisher_ooc';
          if (!existingCodes.has(c)) {
            out.push({
              code: c,
              sev: pf.level,
              title: pf.label || (c === 'first_person' ? '一人称' : (c.startsWith('address') ? '称呼' : 'OOC')),
              message: pf.message || c
            });
          }
        });
      }
    } catch (_) {}
  }
  const waived = new Set((m.oocFlags || []).filter(f => typeof f === 'object' && f.waived).map(f => f.code));
  out.forEach(f => { f.waived = waived.has(f.code); });
  // 已存储（polisher / LLM / 人工）的标记
  const codes = new Set(out.map(f => f.code));
  (m.oocFlags || []).forEach(f => {
    const o = typeof f === 'string' ? { code: f, severity: 'warn' } : f;
    if (codes.has(o.code)) return;
    out.push({ code: o.code, sev: o.severity || 'warn', title: o.code, message: (o.message || '') + (o.source ? `（来源：${o.source}）` : ''), waived: !!o.waived, stored: true });
  });
  return out;
}
const activeIssues = l => checkLine(l).filter(f => !f.waived);
function applyReadings(s) { let t = s; for (const r of M.readingRules) t = t.replace(new RegExp(r.re.source, 'g'), r.kana); return t.replace(/[♪☆★♡]/g, ''); }
function applyFix(i, f) {
  exec('OOC 修复：' + f.title, () => {
    if (!f.fix) return;
    if (f.fix.kind === 'replace') mutRow(i, l => setK(l, 'text', l.text.replace(new RegExp(f.fix.re, 'g'), f.fix.to)));
    else if (f.fix.kind === 'split') splitRow(i);
    else if (f.fix.kind === 'clearMode') mutRow(i, l => { delete meta(l).mode; });
    else if (f.fix.kind === 'reading') mutRow(i, l => { meta(l).ttsText = applyReadings(l._meta.ttsText ?? l.text); });
    else if (f.fix.kind === 'stripSym') mutRow(i, l => { meta(l).ttsText = l._meta.ttsText.replace(/[♪☆★♡]/g, ''); });
  });
  toast('✓ 已修复：' + f.title);
}
function waiveFlag(i, f) {
  exec('忽略 OOC：' + f.title, () => mutRow(i, l => {
    const m = meta(l); m.oocFlags = m.oocFlags || [];
    const ex = m.oocFlags.find(x => typeof x === 'object' && x.code === f.code);
    if (ex) ex.waived = !ex.waived;
    else m.oocFlags.push({ code: f.code, severity: f.sev, message: f.message, source: 'editor-proto', waived: true, at: nowISO() });
  }));
}
function splitText(t) {
  const arr = Array.from(t), mid = arr.length / 2; let best = -1, bd = 1e9;
  arr.forEach((c, k) => { if ('、。！？…♪　，,.!?'.includes(c) && k < arr.length - 1) { const d = Math.abs(k + 1 - mid); if (d < bd) { bd = d; best = k + 1; } } });
  if (best < 0) best = Math.floor(mid);
  while (best < arr.length - 1 && '…。、！？♪　'.includes(arr[best])) best++;
  return [arr.slice(0, best).join(''), arr.slice(best).join('').replace(/^[　\s]+/, '')];
}
function splitRow(i) {
  const l = S.doc.rows[i].line, m = l._meta || {};
  const [a, b] = splitText(l.text);
  let za, zb; if (m.zh) { [za, zb] = splitText(m.zh); }
  const nl = { id: nextId() };
  ['speaker', 'charLabel'].forEach(k => { if (l[k] !== undefined) nl[k] = l[k]; });
  nl.text = b;
  if (l.nextLabel !== undefined) { nl.nextLabel = l.nextLabel; }
  nl.textCtrl = l.textCtrl || 'p'; nl.textFrame = l.textFrame || '001';
  nl._meta = { uid: newUid(), origin: 'custom' };
  ['mode', 'surfaceEmotion', 'vocalTone', 'era'].forEach(k => { if (m[k] !== undefined) nl._meta[k] = m[k]; });
  if (zb !== undefined) nl._meta.zh = zb;
  mutRow(i, x => { setK(x, 'text', a); if (x.nextLabel !== undefined) delete x.nextLabel; if (za !== undefined) meta(x).zh = za; });
  insertRows(i + 1, [nl]);
}

/* ============================== 舞台状态推演 ============================== */
const AUTO_POS = { 1: [568], 2: [310, 796], 3: [200, 568, 936], 4: [150, 420, 716, 986] };
function stageAt(idx) {
  const R = S.doc.rows, st = { bg: null, bgSrc: -1, bgm: null, se: null, chars: {}, cast: [] };
  for (let i = 0; i <= idx && i < R.length; i++) {
    const l = R[i].line, m = l._meta || {};
    if (l.bg !== undefined) { st.bg = l.bg === 'off' ? null : String(l.bg); st.bgSrc = i; }
    if (l.bgm !== undefined) { const v = String(l.bgm); if (['off', 'fade_out', 'pause', '0000'].includes(v)) st.bgm = null; else if (v !== 'resume') st.bgm = v; }
    if (l.charLabel) {
      const lb = l.charLabel;
      let c = st.chars[lb] || (st.chars[lb] = { label: lb, x: null, y: 640, scale: 1, face: 'normal', anim1: 'wait1', eye: '', visible: false, lastRow: i });
      const fx = l.charEffect || l.charAlpha;
      const mvTrack = m && Array.isArray(m.moveTrack) && m.moveTrack[0] ? m.moveTrack[0] : null;
      const act = m.stageAction || '';
      const dashOutPast = (i < idx) && (
        act === 'dash_out_left' || act === 'dash_out_right' ||
        (mvTrack && (Number(mvTrack.toX) <= -200 || Number(mvTrack.toX) >= 1300))
      );
      const exiting = (fx && typeof fx === 'object' && fx.type === 'to' && Number(fx.alpha) === 0) || dashOutPast;
      if (exiting) { c.visible = false; st.cast = st.cast.filter(x => x !== lb); } else { if (!st.cast.includes(lb)) st.cast.push(lb); c.visible = true; }
      if (l.charPosition && typeof l.charPosition === 'object') { if (l.charPosition.x != null && l.charPosition.x !== '') c.x = +l.charPosition.x; if (l.charPosition.y != null && l.charPosition.y !== '') c.y = (+l.charPosition.y > 0) ? +l.charPosition.y : 640; }
      if (!exiting && mvTrack && mvTrack.toX != null && (!fx || fx.type !== 'from')) {
        c.x = +mvTrack.toX;
      } else if (i === idx && !exiting) {
        if (fx && typeof fx === 'object' && fx.type === 'to' && fx.x != null) c.x = (c.x != null ? c.x : 568) + (+fx.x || 0);
      }
      if (l.charScale != null && l.charScale !== '') c.scale = +l.charScale || 1;
      if (l.charAnim1) c.anim1 = l.charAnim1;
      if (l.charAnim2) c.face = String(l.charAnim2).replace(/^face_/, '');
      if (l.charAnim4 !== undefined) c.eye = String(l.charAnim4);
      if (l.charType) c.charType = String(l.charType);
      if (l.charCategory) c.charCategory = String(l.charCategory);
      if (l.charId) c.charId = String(l.charId);
      if (l.clothId) c.clothId = String(l.clothId);
      c.lastRow = i;
    }
  }
  const n = st.cast.length;
  st.cast.forEach((lb, k) => { const c = st.chars[lb]; if (c.x == null) c.x = (AUTO_POS[n] ? AUTO_POS[n][k] : Math.round(1136 * (k + 1) / (n + 1))); });
  const line = R[idx] ? R[idx].line : null;
  st.line = line; st.kind = kindOf(line); st.idx = idx;
  if (line && line.se !== undefined) st.se = String(line.se);
  if (st.kind === 'select') {
    let a = idx, b = idx; while (a > 0 && kindOf(R[a - 1].line) === 'select') a--; while (b < R.length - 1 && kindOf(R[b + 1].line) === 'select') b++;
    st.choices = []; for (let k = a; k <= b; k++) st.choices.push({ i: k, text: R[k].line.select, zh: (R[k].line._meta || {}).selectZh, next: R[k].line.nextLabel });
  }
  if (st.kind === 'dialogue') { const lb = charOfLine(line); st.speaking = lb && !isProducer(line.speaker) ? lb : null; }
  return st;
}
function charTargetRow(label) {
  const i = curIdx(), R = S.doc.rows, l = R[i].line, k = kindOf(l);
  if (l.charLabel === label) return i;
  if (!l.charLabel && k === 'direction') return i;
  if (!l.charLabel && k === 'dialogue' && (l.speaker === charInfo(label).name)) return i;
  for (let j = i; j >= 0; j--) if (R[j].line.charLabel === label) return j;
  return i;
}

/* ============================== 渲染：总控 ============================== */
function renderAll() {
  renderHeader(); renderScript(); renderStage(); renderTimeline(); renderStageDirectorDock(); renderInspector(); renderHistory(); renderMuse();
}
function renderLight() { renderStage(); renderTimeline(); renderStageDirectorDock(); renderInspector(); renderHistory(); renderOocSummary(); }
function renderHeader() {
  const p = S.doc.pack, m = S.doc.meta;
  $('#storyTitle').innerHTML = `${esc(m.titleZh || m.title || m.id)}<small>${esc(m.title || '')} · ${esc(m.id)} · ${S.doc.rows.length} 行</small>`;
  $('#storyTitle').title = p.synopsisZh || p.description || '';
  $$('#textViewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === S.textView));
  $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode));
  $$('#subSeg button').forEach(b => b.classList.toggle('on', b.dataset.s === S.subtitle));
  $('#btnGuides').classList.toggle('on', S.guides);
  if (window.StudioWorkflow && typeof window.StudioWorkflow.renderWorkflowProgress === 'function') {
    window.StudioWorkflow.renderWorkflowProgress();
  }
}
function renderHistory() {
  $('#btnUndo').disabled = !S.undo.length; $('#btnRedo').disabled = !S.redo.length;
  $('#btnUndo').title = S.undo.length ? `撤销：${S.undo[S.undo.length - 1].label} (Ctrl+Z)` : '撤销 (Ctrl+Z)';
  $('#btnRedo').title = S.redo.length ? `重做：${S.redo[S.redo.length - 1].label} (Ctrl+Y)` : '重做 (Ctrl+Y)';
  $('#btnHistory').textContent = `${S.undo.length}${S.redo.length ? '/' + (S.undo.length + S.redo.length) : ''}`;
}

/* ============================== 渲染：左侧台本 ============================== */
function beatOf(i) {
  const R = S.doc.rows;
  if (!R[i]) return null;
  const m = R[i].line._meta || {};
  const bid = m['x-beatId'] || m.beatId;
  if (bid) return { beatId: bid, beatTitle: m['x-beatTitle'] || m.beatTitle || bid };
  if (i > 0) {
    const pm = R[i - 1].line._meta || {};
    const pbid = pm['x-beatId'] || pm.beatId;
    if (pbid) return { beatId: pbid, beatTitle: pm['x-beatTitle'] || pm.beatTitle || pbid };
  }
  return null;
}
function renderScript() {
  const list = $('#scriptList'), top = list.scrollTop; list.innerHTML = '';
  const R = S.doc.rows; let i = 0, lastBeatId = null, beatCounter = 0;
  while (i < R.length) {
    const beat = beatOf(i);
    if (beat && beat.beatId !== lastBeatId) {
      lastBeatId = beat.beatId;
      let bEnd = i;
      while (bEnd + 1 < R.length) {
        const nb = beatOf(bEnd + 1);
        if (nb && nb.beatId === beat.beatId) bEnd++;
        else break;
      }
      const segMeta = (window.StudioWorkflow && typeof window.StudioWorkflow.getActiveSceneSegment === 'function')
        ? window.StudioWorkflow.getActiveSceneSegment(beat.beatId)
        : null;
      const bTitle = (segMeta && segMeta.title) || beat.beatTitle || beat.beatId;
      const bSummary = (segMeta && segMeta.summary) || '';
      const bIdx = (segMeta && segMeta.index) || (++beatCounter);
      const isCollapsed = !!S.collapsed['beat:' + beat.beatId];
      const dlgCount = R.slice(i, bEnd + 1).filter(r => kindOf(r.line) === 'dialogue').length;
      const headEl = S.mode === 'stage'
        ? el(`<div class="beat-group-head stage-compact-beat" data-beat-group="${esc(beat.beatId)}">
          <button type="button" class="beat-collapse-btn" data-beat-act="toggle" data-beat-id="${esc(beat.beatId)}" title="${isCollapsed ? '展开本小段' : '折叠本小段'}">${isCollapsed ? '▸' : '▾'}</button>
          <span class="beat-group-badge">🧩 小段 ${bIdx} · ${dlgCount} 句</span>
          <span class="beat-compact-title" title="${esc(bTitle)}">${esc(bTitle)}</span>
        </div>`)
        : el(`<div class="beat-group-head" data-beat-group="${esc(beat.beatId)}">
          <div class="beat-group-top">
            <button type="button" class="beat-collapse-btn" data-beat-act="toggle" data-beat-id="${esc(beat.beatId)}" title="${isCollapsed ? '展开本小段' : '折叠本小段'}">${isCollapsed ? '▸' : '▾'}</button>
            <span class="beat-group-badge">🧩 小段 ${bIdx} · ${dlgCount} 句</span>
            <input type="text" class="beat-group-title" data-beat-field="title" data-beat-id="${esc(beat.beatId)}" value="${esc(bTitle)}" placeholder="小段标题…" title="直接修改本剧情小段标题" />
            <div class="beat-group-actions">
              <button type="button" class="chip-btn" data-beat-act="add-line" data-beat-id="${esc(beat.beatId)}" title="在本小段末尾追加一句台词">＋ 本段加词</button>
              <button type="button" class="chip-btn" data-beat-act="regen" data-beat-id="${esc(beat.beatId)}" title="按本段梗概单独重写本小段台词（不影响其他小段）">🔄 重写本段</button>
            </div>
          </div>
          <div class="beat-group-sub">
            <span class="beat-sub-lbl">梗概</span>
            <input type="text" class="beat-group-summary" data-beat-field="summary" data-beat-id="${esc(beat.beatId)}" value="${esc(bSummary)}" placeholder="本小段剧情梗概（修改后点右上角重写本段）…" title="本小段剧情梗概" />
          </div>
        </div>`);
      list.appendChild(headEl);
      if (isCollapsed) {
        i = bEnd + 1;
        continue;
      }
    }
    const mid = macroOf(i);
    if (mid) {
      let j = i; while (j + 1 < R.length && macroOf(j + 1) === mid) j++;
      const name = mid.split('#')[0], mac = M.macros.find(x => x.name === name);
      const g = el(`<div class="macro-group ${S.collapsed[mid] ? 'collapsed' : ''}"><div class="macro-head" data-macro="${esc(mid)}">🧩 宏 <code>${esc(mid)}</code><span>${esc(mac ? mac.label : '')} · ${j - i + 1} 行</span><span class="grow"></span><span>${S.collapsed[mid] ? '展开 ▸' : '折叠 ▾'}</span></div></div>`);
      for (let k = i; k <= j; k++) g.appendChild(rowEl(k));
      list.appendChild(g); i = j + 1;
    } else { list.appendChild(rowEl(i)); i++; }
  }
  list.scrollTop = top;
  $$('textarea', list).forEach(autoSize);
  renderOocSummary();
  if (window.StudioWorkflow && typeof window.StudioWorkflow.refreshDirectionsToggleUi === 'function') {
    window.StudioWorkflow.refreshDirectionsToggleUi();
  }
}
function autoSize(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }
function speakerOptions(l) {
  const chars = S.doc.pack.characters || {}; const cur = l.speaker ?? '';
  let found = false, html = '';
  for (const [lb, c] of Object.entries(chars)) { const sel = l.charLabel === lb && cur === c.name; if (sel) found = true; html += `<option value="c:${esc(lb)}" ${sel ? 'selected' : ''}>${esc(c.name)}</option>`; }
  const isP = isProducer(cur); if (isP) found = true;
  html += `<option value="p" ${isP ? 'selected' : ''}>プロデューサー</option>`;
  html += `<option value="n" ${cur === '' ? 'selected' : ''}>（旁白 / 无名）</option>`;
  if (cur === '') found = true;
  if (!found) html = `<option value="x" selected>${esc(cur)}</option>` + html;
  return html;
}
function pillsHtml(l) {
  return checkLine(l).map((f, n) => `<button class="pill ${f.sev} ${f.waived ? 'waived' : ''}" data-flag="${n}" title="${esc(f.message)}">${f.sev === 'error' ? '⛔' : f.sev === 'warn' ? '⚠️' : 'ℹ️'} ${esc(f.title)}${f.fix && !f.waived ? ' <span class="fix">· 一键修复</span>' : ''}</button>`).join('');
}
function dirChips(l, rowIdx = -1, rowKey = '') {
  const c = [], m = l._meta || {};
  if (l.bg !== undefined) {
    const bgLib = (S.bgCatalogRemote || M.bgLibrary || []).find(x => String(x.id) === String(l.bg));
    const bgTitle = bgLib ? (bgLib.titleZh || bgLib.title || '') : '';
    c.push(`<span class="dchip bg" title="背景 ID: ${esc(l.bg)}">🖼 ${l.bg === 'off' ? '黑场' : `切景 <b>${esc(bgTitle || l.bg)}</b>`}</span>`);
  }
  if (l.bgEffect && l.bgEffect !== 'normal') {
    const fxZh = l.bgEffect === 'white_fade' ? '闪白转场' : l.bgEffect === 'switch_fade' ? '换景过场' : '渐变转场';
    c.push(`<span class="dchip" title="bgEffect: ${esc(l.bgEffect)}">✨ ${fxZh}</span>`);
  }
  if (l.bgm !== undefined) {
    const b = (S.bgmCatalogRemote || M.bgmLibrary || []).find(x => String(x.id) === String(l.bgm));
    const lbl = b ? ' ' + esc(b.titleZh || b.title) : (l.bgm === 'fade_out' ? ' 淡出' : (l.bgm === 'off' ? ' 骤停' : ''));
    const xBtn = (rowIdx > 0 && rowKey) ? `<button type="button" class="tag-x" data-quick-clear-bgm="${esc(rowKey)}" title="关闭本行切换 BGM（沿用上一首）">✕</button>` : '';
    c.push(`<span class="dchip bgm" title="BGM: ${esc(l.bgm)}">🎵 BGM <b>${esc(l.bgm)}</b>${lbl}${xBtn}</span>`);
  }
  if (l.se !== undefined) { const s = M.seLibrary.find(x => x.id === String(l.se)); c.push(`<span class="dchip se" title="SE: ${esc(l.se)}">🔔 SE <b>${esc(l.se)}</b>${s ? ' ' + esc(s.title.replace(/^[^\s]+\s*/, '')) : ''}</span>`); }
  if (l.charLabel !== undefined && kindOf(l) !== 'dialogue') {
    const ci = charInfo(l.charLabel); const parts = [], rawParts = [];
    if (l.charEffect && typeof l.charEffect === 'object') {
      if (Number(l.charEffect.alpha) === 0) parts.push(l.charEffect.type === 'to' ? '退场' : '登场');
      else parts.push('位移');
    }
    if (l.charAnim1) { parts.push(getMotionNameZh(l.charAnim1)); rawParts.push(l.charAnim1); }
    if (l.charAnim2) { parts.push(getFaceNameZh(l.charAnim2)); rawParts.push(l.charAnim2); }
    if (l.charAnim3) { parts.push(getMotionNameZh(l.charAnim3)); rawParts.push(l.charAnim3); }
    if (l.charPosition && typeof l.charPosition === 'object') rawParts.push(`x=${l.charPosition.x}`);
    if (l.charScale !== undefined && Number(l.charScale) !== 1) parts.push(`×${l.charScale}`);
    c.push(`<span class="dchip" style="border-color:${ci.color}" title="${esc([ci.name, ...rawParts].join(' · '))}">👤 <b>${esc(ci.nameZh || ci.name)}</b>${parts.length ? ' ' + esc(parts.join('·')) : ''}</span>`);
  }
  if (l.waitTime !== undefined && Number(l.waitTime) > 10 && !l.charLabel && l.bg === undefined && l.bgm === undefined) {
    c.push(`<span class="dchip">⏱ 留白 <b>${esc(l.waitTime)}</b>ms</span>`);
  }
  if (l.nextLabel !== undefined && kindOf(l) !== 'select') c.push(`<span class="dchip">↪ 跳转 <b>${esc(l.nextLabel)}</b></span>`);
  if (!c.length) c.push(`<span class="dchip">🎬 舞台调度</span>`);
  return c.join('');
}
const CUE_SLOTS = [
  { id: 'off_left', label: '⬅外', title: '左画外 (-360)', x: -360 },
  { id: 'left', label: '左', title: '左站位 (240)', x: 240 },
  { id: 'mid_left', label: '中左', title: '中左 (404)', x: 404 },
  { id: 'center', label: '中', title: '正中 (568)', x: 568 },
  { id: 'mid_right', label: '中右', title: '中右 (732)', x: 732 },
  { id: 'right', label: '右', title: '右站位 (896)', x: 896 },
  { id: 'off_right', label: '外➡', title: '右画外 (1496)', x: 1496 }
];
const CUE_SPEEDS = {
  fast: { label: '⚡快冲 0.3s', ms: 320 },
  normal: { label: '🚶常速 0.5s', ms: 500 },
  sneak: { label: '🤫轻步 0.8s', ms: 820 }
};

function cueXToPct(x) {
  const clamped = Math.max(-420, Math.min(1560, Number(x) || 0));
  return (((clamped + 360) / 1856) * 100).toFixed(2);
}

function renderCueCardHtml(i, r, l, m, tools) {
  const cue = (m && m.cue) || { timing: 'separate', delayMs: 0, transition: 'none', steps: [] };
  const steps = Array.isArray(cue.steps) ? cue.steps : [];
  const prevSt = stageAt(Math.max(0, i - 1));
  const castKeys = Object.keys(S.doc.pack.characters || {});
  const allCast = Array.from(new Set([...castKeys, ...steps.map(s => s.charLabel).filter(Boolean)]));

  // Track simulated X inside this cue's steps so each step's start X reflects prior steps in the same card
  const simX = {};
  allCast.forEach(lb => {
    const ch = prevSt.chars && prevSt.chars[lb];
    simX[lb] = (ch && ch.visible && ch.x != null) ? ch.x : (ch && ch.x != null ? ch.x : -360);
  });

  const rulerTicksHtml = CUE_SLOTS.map(sl =>
    `<div class="cue-tick ${sl.x < 0 || sl.x > 1136 ? 'off' : ''}" style="left:${cueXToPct(sl.x)}%" title="${esc(sl.title)}"><span>${esc(sl.label)}</span></div>`
  ).join('');

  const pucksAndLines = steps.map((st, sIdx) => {
    const lb = st.charLabel || allCast[0] || 'amana';
    const ci = charInfo(lb);
    const fromX = simX[lb] != null ? simX[lb] : 568;
    const toX = st.toX != null ? Number(st.toX) : 568;
    simX[lb] = toX;
    const p1 = Number(cueXToPct(fromX));
    const p2 = Number(cueXToPct(toX));
    const leftPct = Math.min(p1, p2);
    const widthPct = Math.max(0.5, Math.abs(p2 - p1));
    const shortName = (ci.nameZh || ci.name || lb).slice(-2);
    return `
      <div class="cue-arrow-seg" style="left:${leftPct}%;width:${widthPct}%;--c:${ci.color}" title="${esc(ci.nameZh || lb)}: X=${fromX} → ${toX}"></div>
      <div class="cue-ghost-dot" style="left:${p1}%;--c:${ci.color}" title="起点 X=${fromX}"></div>
      <button type="button" class="cue-puck" data-cue-puck="${sIdx}" style="left:${p2}%;--c:${ci.color}" title="拖拽调整 ${esc(ci.nameZh || lb)} 目标站位（按住 Shift 可自由像素微调）">
        <span class="cue-puck-lbl">${esc(shortName)}</span>
        <span class="cue-puck-x">${toX}</span>
      </button>
    `;
  }).join('');

  const stepsHtml = steps.map((st, sIdx) => {
    const lb = st.charLabel || allCast[0] || '';
    const curX = st.toX != null ? Number(st.toX) : 568;
    const spdKey = st.speedPreset && CUE_SPEEDS[st.speedPreset] ? st.speedPreset : 'normal';
    const charOpts = (allCast.length ? allCast : Object.keys(M.charInfo)).map(cid => {
      const ci = charInfo(cid);
      return `<option value="${esc(cid)}" ${cid === lb ? 'selected' : ''}>${esc(ci.nameZh || ci.name || cid)}</option>`;
    }).join('');
    const slotBtns = CUE_SLOTS.map(sl =>
      `<button type="button" class="cue-slot-btn ${Math.abs(curX - sl.x) <= 12 ? 'on' : ''}" data-cue-slot="${sIdx}" data-x="${sl.x}" data-slot="${sl.id}" title="${esc(sl.title)}">${esc(sl.label)}</button>`
    ).join('');
    const spdOpts = Object.entries(CUE_SPEEDS).map(([k, v]) =>
      `<option value="${k}" ${spdKey === k ? 'selected' : ''}>${v.label}</option>`
    ).join('');
    return `
      <div class="cue-step-row" data-step-idx="${sIdx}">
        ${sIdx === 0
          ? `<span class="cue-mode-pill fixed">① 起手</span>`
          : `<button type="button" class="cue-mode-pill ${st.mode === 'parallel' ? 'par' : 'seq'}" data-cue-mode="${sIdx}" title="点击切换：串行（等上一步走完） / 并行（与上一步同时移动）">${st.mode === 'parallel' ? '⚡ 并行' : '⏭ 串行'}</button>`
        }
        <select class="cue-char-sel" data-cue-step-f="charLabel" data-step-idx="${sIdx}" title="选择移动角色">${charOpts}</select>
        <div class="cue-slot-group">${slotBtns}</div>
        <input type="number" class="cue-x-in" data-cue-step-f="toX" data-step-idx="${sIdx}" min="-420" max="1560" value="${curX}" title="目标 X 坐标" />
        <select class="cue-spd-sel" data-cue-step-f="speedPreset" data-step-idx="${sIdx}" title="移动速度">${spdOpts}</select>
        <select class="cue-gaze-sel" data-cue-step-f="enterFrom" data-step-idx="${sIdx}" title="若角色当前在场外，指定入场方式">
          <option value="" ${!st.enterFrom ? 'selected' : ''}>自动入场</option>
          <option value="left" ${st.enterFrom === 'left' ? 'selected' : ''}>⬅左外进</option>
          <option value="right" ${st.enterFrom === 'right' ? 'selected' : ''}>➡右外进</option>
          <option value="inplace" ${st.enterFrom === 'inplace' ? 'selected' : ''}>📍原地等着</option>
        </select>
        <select class="cue-gaze-sel" data-cue-step-f="gaze" data-step-idx="${sIdx}" title="移动后视线朝向">
          <option value="" ${!st.gaze ? 'selected' : ''}>视线不改</option>
          <option value="eye_left" ${st.gaze === 'eye_left' ? 'selected' : ''}>⬅ 左看</option>
          <option value="eye_front" ${st.gaze === 'eye_front' ? 'selected' : ''}>👁 正视</option>
          <option value="eye_right" ${st.gaze === 'eye_right' ? 'selected' : ''}>➡ 右看</option>
        </select>
        <button type="button" class="cue-step-del" data-cue-del-step="${sIdx}" title="删除此步">✕</button>
      </div>
    `;
  }).join('');

  return `
    <div class="cue-card-head">
      <span class="cue-badge">🎬 动作拍</span>
      <input type="text" class="cue-note-in" data-cue-note="1" value="${esc(m.note || '')}" placeholder="动作拍简述（如：朝日向右跑出；甜花拉住甘奈）…" />
      <div class="cue-timing-seg" title="选择本动作拍与下一句台词的时间关系">
        <button type="button" class="${cue.timing !== 'with_next' ? 'on' : ''}" data-cue-timing="separate">⏸ 句间独立一拍</button>
        <button type="button" class="${cue.timing === 'with_next' ? 'on' : ''}" data-cue-timing="with_next">🗣 边说边动</button>
      </div>
      ${cue.timing === 'with_next' ? `
        <select class="cue-delay-sel" data-cue-delay="1" title="台词延迟弹出时间">
          <option value="0" ${!cue.delayMs ? 'selected' : ''}>立刻出词</option>
          <option value="300" ${Number(cue.delayMs) === 300 ? 'selected' : ''}>+0.3s 出词</option>
          <option value="600" ${Number(cue.delayMs) === 600 ? 'selected' : ''}>+0.6s 出词</option>
        </select>
      ` : ''}
      <button type="button" class="cue-fade-toggle ${cue.transition === 'switch_fade' ? 'on' : ''}" data-cue-fade="1" title="动作结束后执行一次背景 switch_fade 换景过场（不改变背景图）">🔄 换景动作</button>
      <button type="button" class="cue-preview-btn" data-cue-play="1" title="预览本动作拍">▶ 试看</button>
      ${tools}
    </div>
    <div class="cue-ruler-wrap" data-cue-ruler="1">
      <div class="cue-stage-zone" style="left:${cueXToPct(0)}%;width:${(1136 / 1856 * 100).toFixed(2)}%"></div>
      <div class="cue-ruler-ticks">${rulerTicksHtml}</div>
      <div class="cue-ruler-track">${pucksAndLines}</div>
    </div>
    <div class="cue-steps-list">
      ${stepsHtml || '<div class="muted" style="font-size:11px;padding:4px 0">暂无走位步骤，点击下方按钮添加</div>'}
      <div class="cue-steps-foot">
        <button type="button" class="chip-btn" data-cue-add-step="1">➕ 加一步联动（追逐 / 拉扯 / 归位）</button>
      </div>
    </div>
  `;
}

function computeVoiceSynthSig(l) {
  if (!l || typeof l !== 'object') return '';
  const lb = l.charLabel || charOfLine(l) || l.speaker || '';
  const mono = isInnerMonologueRow(l) ? 'mono' : 'aloud';
  const rawTxt = String((l._meta && l._meta.ttsText) ?? l.text ?? '').trim();
  return `${lb}|${mono}|${rawTxt}`;
}
function refreshVoiceStaleFlag(l) {
  if (!l || typeof l !== 'object' || !l.voice) {
    if (l && l._meta) delete l._meta.voiceStale;
    return false;
  }
  const mm = meta(l);
  const curSig = computeVoiceSynthSig(l);
  if (mm.voiceSynthSig) {
    if (mm.voiceSynthSig !== curSig) mm.voiceStale = true;
    else delete mm.voiceStale;
  } else {
    mm.voiceStale = true;
  }
  return Boolean(mm.voiceStale);
}

function isKeyDirectionCue(l, i) {
  if (!l || typeof l !== 'object') return false;
  if (l.bg !== undefined || (l.bgEffect && l.bgEffect !== 'normal') || l.bgm !== undefined || l.se !== undefined) return true;
  if (l.stillId || l.stillType || l.locationBanner) return true;
  const m = l._meta || {};
  if (m['x-locationBanner'] || m['x-stageNote']) return true;
  const fx = l.charEffect || l.charAlpha;
  if (fx && typeof fx === 'object') {
    if (Number(fx.alpha) === 0) return true;
    if (fx.x != null && Math.abs(Number(fx.x)) >= 260) return true;
  }
  if (Array.isArray(m.moveTrack) && m.moveTrack.some(mv => mv && (Number(mv.fromX) <= -180 || Number(mv.fromX) >= 1280 || Number(mv.toX) <= -180 || Number(mv.toX) >= 1280))) {
    return true;
  }
  if (l.charPosition && typeof l.charPosition === 'object' && l.charPosition.x != null && (Number(l.charPosition.x) <= -150 || Number(l.charPosition.x) >= 1280)) {
    return true;
  }
  if (m.stageAction && /^(dash_out|chase_in|bgm_|flash_shock)/.test(String(m.stageAction))) return true;
  if (l.charLabel && S.doc && Array.isArray(S.doc.rows)) {
    let prevFound = false, prevExited = false;
    for (let j = i - 1; j >= 0; j--) {
      const rl = S.doc.rows[j] && S.doc.rows[j].line;
      if (!rl) continue;
      const rLb = rl.charLabel || charOfLine(rl);
      if (rLb === l.charLabel) {
        prevFound = true;
        const rFx = rl.charEffect || rl.charAlpha;
        const rMeta = rl._meta || {};
        prevExited = Boolean(
          (rFx && typeof rFx === 'object' && rFx.type === 'to' && Number(rFx.alpha) === 0) ||
          rMeta.stageAction === 'dash_out_left' ||
          rMeta.stageAction === 'dash_out_right'
        );
        break;
      }
    }
    if (!prevFound || prevExited) return true;
  }
  return false;
}

function collectPrecedingHiddenCueItems(i, { includeSelf = true } = {}) {
  if (!S.doc || !Array.isArray(S.doc.rows) || !S.doc.rows[i]) return [];
  const R = S.doc.rows;
  let prevSpokenIdx = -1;
  for (let j = i - 1; j >= 0; j--) {
    const jk = kindOf(R[j].line);
    if (jk === 'dialogue' || jk === 'select') {
      prevSpokenIdx = j;
      break;
    }
  }
  const startJ = prevSpokenIdx + 1;
  const endJ = includeSelf ? i : (i - 1);
  const items = [];
  const pushUniq = (txt) => {
    const s = String(txt || '').trim();
    if (s && !items.includes(s)) items.push(s);
  };

  let lastBg = undefined;
  let lastBgFx = '';
  let lastBgm = undefined;
  const seList = [];
  const stageNotes = [];
  let hasHiddenCharRow = false;

  for (let j = startJ; j <= endJ; j++) {
    const rl = R[j] && R[j].line;
    if (!rl) continue;
    const rm = rl._meta || {};
    if (j < i && (rl.charLabel || kindOf(rl) === 'cue')) hasHiddenCharRow = true;
    if (rl.bg !== undefined) lastBg = rl.bg;
    if (rl.bgEffect && rl.bgEffect !== 'normal') lastBgFx = String(rl.bgEffect);
    if (rl.bgm !== undefined) lastBgm = rl.bgm;
    if (rl.se !== undefined) seList.push(String(rl.se));
    if (kindOf(rl) === 'cue') {
      stageNotes.push('🎬 ' + (rm.note || '走位动作拍'));
    }
    const xNote = rm['x-stageNote'];
    if (Array.isArray(xNote)) {
      xNote.forEach(n => { if (n && String(n).trim()) stageNotes.push('📌 ' + String(n).trim()); });
    } else if (typeof xNote === 'string' && xNote.trim()) {
      stageNotes.push('📌 ' + xNote.trim());
    }
  }
  if (!includeSelf && R[i] && R[i].line && R[i].line._meta) {
    const selfNote = R[i].line._meta['x-stageNote'];
    if (Array.isArray(selfNote)) {
      selfNote.forEach(n => { if (n && String(n).trim()) stageNotes.push('📌 ' + String(n).trim()); });
    } else if (typeof selfNote === 'string' && selfNote.trim()) {
      stageNotes.push('📌 ' + selfNote.trim());
    }
  }

  if (lastBg !== undefined) {
    if (lastBg === 'off') {
      pushUniq('🖼 黑场');
    } else {
      const bgObj = (S.bgCatalogRemote || M.bgLibrary || []).find(b => String(b.id) === String(lastBg));
      const bgTitle = bgObj ? (bgObj.titleZh || bgObj.title || lastBg) : `BG ${lastBg}`;
      pushUniq(`🖼 ${bgTitle}`);
    }
  } else if (lastBgFx) {
    pushUniq(lastBgFx === 'white_fade' ? '✨ 闪白转场' : lastBgFx === 'switch_fade' ? '✨ 换景过场' : '✨ 转场');
  }

  if (lastBgm !== undefined) {
    const bv = String(lastBgm);
    if (bv === 'off' || bv === '0000') pushUniq('🔇 BGM骤停');
    else if (bv === 'fade_out') pushUniq('🔉 BGM淡出');
    else {
      const bgmObj = (S.bgmCatalogRemote || M.bgmLibrary || []).find(b => String(b.id) === bv);
      const bgmTitle = bgmObj ? (bgmObj.titleZh || bgmObj.title || '') : '';
      pushUniq(`🎵 ${bgmTitle ? `${bv}·${bgmTitle}` : `BGM ${bv}`}`);
    }
  }

  seList.forEach(seId => {
    const seObj = (M.seLibrary || []).find(s => String(s.id) === seId);
    const seTitle = seObj ? seObj.title.replace(/^[^\s]+\s*/, '') : `SE ${seId}`;
    pushUniq(`🔔 ${seTitle}`);
  });

  const curLine = R[i].line;
  const curMeta = curLine._meta || {};
  const checkSelfMove = includeSelf && (curLine.charEffect || (Array.isArray(curMeta.moveTrack) && curMeta.moveTrack.length));
  if (hasHiddenCharRow || checkSelfMove) {
    const prevCast = prevSpokenIdx >= 0 ? stageAt(prevSpokenIdx).cast : [];
    const targetStageIdx = includeSelf ? i : Math.max(startJ, i - 1);
    const curCast = stageAt(targetStageIdx).cast;
    if (prevSpokenIdx < 0) {
      if (curCast.length > 0 && startJ < i) {
        pushUniq(`👥 登场：${curCast.map(c => charInfo(c).nameZh || charInfo(c).name).join('·')}`);
      }
    } else {
      const entered = curCast.filter(c => !prevCast.includes(c));
      const exited = prevCast.filter(c => !curCast.includes(c));
      if (entered.length) pushUniq(`👤 ${entered.map(c => charInfo(c).nameZh || charInfo(c).name).join('·')}登场`);
      if (exited.length) pushUniq(`🚪 ${exited.map(c => charInfo(c).nameZh || charInfo(c).name).join('·')}退场`);
    }
  }

  stageNotes.forEach(pushUniq);
  return items;
}

function collectPrecedingHiddenCueSummary(i) {
  const items = collectPrecedingHiddenCueItems(i, { includeSelf: true });
  if (!items.length) return '';
  const shown = items.slice(0, 4);
  const more = items.length - shown.length;
  return `<div class="step2-cue-hint" title="前置/本句舞台演出指令：${esc(items.join(' ｜ '))}">${shown.map(it => `<span class="s2-cue-chip">${esc(it)}</span>`).join('')}${more > 0 ? `<span class="s2-cue-more">+${more}</span>` : ''}</div>`;
}

function rowEl(i) {
  const r = S.doc.rows[i], l = r.line, m = l._meta || {}, k = kindOf(l);
  const isStageReadOnly = S.mode === 'stage';
  const roAttr = isStageReadOnly ? ' readonly tabindex="-1"' : '';
  const spkTab = isStageReadOnly ? ' tabindex="-1"' : '';
  const d = document.createElement('div');
  d.className = `row k-${k}` + ((m['x-autoGenerated'] || m.autoGenerated) ? ' is-autogen' : '') + (r.key === S.selKey ? ' cur' : '') + (S.preview && S.preview.i === i ? ' playing' : '');
  d.dataset.key = r.key;
  const icon = { dialogue: '💬', select: '🔀', label: '🏷', direction: '🎬', cue: '🎬' }[k] || '🎬';
  const isMonoRow = k === 'dialogue' && isInnerMonologueRow(l);
  const canTtsRow = k === 'dialogue' && Boolean(l.speaker && !isProducer(l.speaker) && (l.charLabel || charOfLine(l)));
  const isTtsBusy = S.ttsBusyKey === r.key;
  const isRowPlaying = Boolean(curRealAudio && curRealAudioKey === r.key && !curRealAudio.paused);
  const isVoiceStale = Boolean(l.voice && m.voiceStale);
  const takePillsHtml = (k === 'dialogue' && Array.isArray(m.takes) && m.takes.length >= 2)
    ? `<span class="tts-take-pills">${m.takes.slice(0, 4).map((tk, tIdx) => {
        const isCurTake = m.takeSelected ? (m.takeSelected === tk.id) : (l.voice === tk.voice);
        return `<button type="button" data-act="tts-pick-take" data-take-id="${esc(tk.id)}" class="tts-take-pill ${isCurTake ? 'on' : ''}" title="切换并试听第 ${tIdx + 1} 版配音 (${esc(tk.id)})">T${tIdx + 1}</button>`;
      }).join('')}</span>`
    : '';
  const ttsBtnTitle = isRowPlaying ? '停止试听' : (isVoiceStale ? '台词或读音已修改，点击重新合成语音' : (l.voice ? '播放本句语音' : '一键调用 Fish Audio / 当前 TTS 合成并试听'));
  const ttsBtnLabel = isTtsBusy ? '⏳ 合成中' : (isRowPlaying ? '⏹ 停止' : (isVoiceStale ? '⚠️ 词已改·重配' : (l.voice ? '🔊 试听' : '🎙 合成试听')));
  const ttsRowBtns = (k === 'dialogue' && (canTtsRow || l.voice))
    ? `<button data-act="tts-play-or-synth" class="tts-row-btn ${l.voice ? 'has-voice' : ''} ${isVoiceStale ? 'stale' : ''} ${isRowPlaying ? 'playing' : ''} ${isTtsBusy ? 'busy' : ''}" ${isTtsBusy ? 'disabled' : ''} title="${ttsBtnTitle}">${ttsBtnLabel}</button>${(l.voice && canTtsRow) ? `<button data-act="tts-regen" class="tts-regen-btn" ${isTtsBusy ? 'disabled' : ''} title="强制重新合成当前句 TTS">↻</button>` : ''}${takePillsHtml}`
    : '';
  const step2Tools = `<div class="row-tools">${k === 'dialogue' ? `${ttsRowBtns}<span class="tag inner-monologue" ${isMonoRow ? '' : 'hidden'} title="括号内心独白：舞台保持闭口不张嘴">💭 内心独白·闭口</span><button data-act="toggle-monologue" class="mono-tog-btn ${isMonoRow ? 'on' : ''}" title="切换（）内心独白（角色闭口不张嘴）">${isMonoRow ? '💭 闭口中' : '💭 内心（）'}</button><div class="seg"><button data-act="view-text" class="${rowView(r.key) === 'text' ? 'on' : ''}">台词</button><button data-act="view-tts" class="${rowView(r.key) === 'tts' ? 'on' : ''}">读音</button></div>` : ''}<button data-act="up" title="上移 (Alt+↑)">↑</button><button data-act="down" title="下移 (Alt+↓)">↓</button>${k !== 'cue' ? `<button data-act="dup" title="复制本行">⧉</button>` : ''}<button data-act="del" title="删除本行 (Delete)">✕</button></div>`;
  const stageDirTools = `<div class="row-tools stage-min-tools"><button data-act="del" title="删除此演出行">✕</button></div>`;

  let main = '';
  if (k === 'cue') {
    main = renderCueCardHtml(i, r, l, m, stageDirTools);
  } else if (k === 'dialogue') {
    if (isStageReadOnly) {
      const lbSpk = charOfLine(l);
      const spkName = !l.speaker
        ? '旁白'
        : (isProducer(l.speaker) ? '制作人' : ((lbSpk && (charInfo(lbSpk).nameZh || charInfo(lbSpk).name)) || l.speaker));
      const spkBadge = `<span class="spk spk-locked ${isProducer(l.speaker) || !l.speaker ? 'p' : ''}" style="--c:${speakerColor(l)}" title="${esc(l.speaker || '旁白')}">${esc(spkName)}</span>`;
      const seqText = l.text || m.zh || '';
      const seqHover = (l.text && m.zh && l.text !== m.zh) ? `${l.text}\n${m.zh}` : seqText;
      const cueChips = buildStageCueSummaryHtml(l, i);
      main = `<div class="row-head stage-slim-head">${spkBadge}${cueChips ? `<div class="stage-cue-summary">${cueChips}</div>` : ''}</div><div class="stage-seq-text" title="${esc(seqHover)}">${seqText ? esc(seqText) : '<span class="muted">（空台词）</span>'}</div>`;
    } else {
      const step2CueHint = collectPrecedingHiddenCueSummary(i);
      const n = jlen(l.text);
      const body = rowView(r.key) === 'tts'
        ? `<textarea class="tts" data-f="tts" rows="1"${roAttr} placeholder="未覆写 → 送 TTS 的就是显示台词：${esc(l.text)}">${esc(m.ttsText ?? '')}</textarea><div class="note">显示台词：${esc(l.text)}</div>`
        : `<textarea class="ja" data-f="text" rows="1"${roAttr} placeholder="（台词正文）">${esc(l.text)}</textarea><textarea class="zh" data-f="zh" rows="1"${roAttr} placeholder="（中文双语备注 _meta.zh，可选）">${esc(m.zh ?? '')}</textarea>`;
      main = `<div class="row-head"><select class="spk ${isProducer(l.speaker) || !l.speaker ? 'p' : ''}"${spkTab} style="--c:${speakerColor(l)}" title="说话人">${speakerOptions(l)}</select>${step2CueHint}<span class="len ${n > M.LINE_LIMIT ? 'over' : ''}">${n}/${M.LINE_LIMIT}</span>${step2Tools}</div>${body}<div class="pills">${pillsHtml(l)}</div>${m.note ? `<div class="note">📝 ${esc(m.note)}</div>` : ''}`;
    }
  } else if (k === 'select') {
    if (isStageReadOnly) {
      const selDisp = l.select || m.selectZh || '';
      main = `<div class="row-head stage-slim-head"><span class="tag">🔀 选项 → <b>${esc(l.nextLabel ?? '未设标签')}</b></span></div><div class="stage-seq-text">${esc(selDisp)}</div>`;
    } else {
      main = `<div class="row-head"><span class="tag">选项 → <b>${esc(l.nextLabel ?? '（缺 nextLabel · V7）')}</b></span>${step2Tools}</div><textarea class="ja sel-text" data-f="select" rows="1"${roAttr}>${esc(l.select)}</textarea><textarea class="zh" data-f="selectZh" rows="1"${roAttr} placeholder="（中文 _meta.selectZh）">${esc(m.selectZh ?? '')}</textarea>`;
    }
  } else if (k === 'label') {
    main = `<div class="row-head"><span class="lbl-text">🏷 ${esc(l.label)}</span>${isStageReadOnly ? stageDirTools : step2Tools}</div>`;
  } else {
    main = `<div class="row-head"><div class="dir-line">${dirChips(l, i, r.key)}</div>${isStageReadOnly ? stageDirTools : step2Tools}</div>${m.note ? `<div class="note">📝 ${esc(m.note)}</div>` : ''}`;
  }
  d.innerHTML = `<div class="gutter"><span>${String(i + 1).padStart(2, '0')}</span>${!isStageReadOnly || k !== 'dialogue' ? `<span class="kind">${icon}</span>` : ''}</div><div class="row-main">${main}</div>`;
  return d;
}
function buildStageCueSummaryHtml(l, i) {
  if (!l || typeof l !== 'object') return '';
  const m = l._meta || {};
  const pills = [];
  const hideDirOn = S.mode === 'stage' && typeof document !== 'undefined' && document.body && document.body.classList.contains('hide-directions');
  if (hideDirOn && kindOf(l) === 'dialogue') {
    const hiddenItems = collectPrecedingHiddenCueItems(i, { includeSelf: false }).filter(it => {
      if (l.bg !== undefined && (it.startsWith('🖼') || it.startsWith('✨'))) return false;
      if (l.bgm !== undefined && (it.startsWith('🔇') || it.startsWith('🔉') || it.startsWith('🎵'))) return false;
      if (l.se !== undefined && it.startsWith('🔔')) return false;
      return true;
    });
    const shownHidden = hiddenItems.slice(0, 3);
    shownHidden.forEach(it => {
      const compactTxt = it.length > 12 ? (it.slice(0, 11) + '…') : it;
      pills.push(`<span class="cue-pill cue-pill-folded" title="前置隐藏分镜：${esc(it)}">${esc(compactTxt)}</span>`);
    });
    if (hiddenItems.length > shownHidden.length) {
      pills.push(`<span class="cue-pill cue-pill-folded" title="前置隐藏分镜：${esc(hiddenItems.join(' ｜ '))}">+${hiddenItems.length - shownHidden.length}</span>`);
    }
  }
  if (l.bg !== undefined) {
    pills.push(`<span class="cue-pill" title="切换背景：${esc(l.bg)}">🖼 BG${i > 0 ? `<button type="button" class="cue-pill-clear" data-quick-clear="bg" title="清除本行背景覆盖">×</button>` : ''}</span>`);
  }
  if (l.bgm !== undefined) {
    const bgmIcon = l.bgm === 'off' ? '🔇 停曲' : l.bgm === 'fade_out' ? '🔉 淡出' : '🎵 BGM';
    pills.push(`<span class="cue-pill" title="配乐控制：${esc(l.bgm)}">${bgmIcon}${i > 0 ? `<button type="button" class="cue-pill-clear" data-quick-clear="bgm" title="清除本行配乐覆盖">×</button>` : ''}</span>`);
  }
  if (l.se !== undefined) {
    pills.push(`<span class="cue-pill" title="音效：${esc(l.se)}">🔔 SE<button type="button" class="cue-pill-clear" data-quick-clear="se" title="清除本行音效">×</button></span>`);
  }
  if (l.charScale && Number(l.charScale) > 1.05) {
    pills.push(`<span class="cue-pill" title="微推近特写 ×${esc(l.charScale)}">🔍 推近<button type="button" class="cue-pill-clear" data-quick-clear="scale" title="恢复标准景别">×</button></span>`);
  } else if (l.bgEffect === 'white_fade' || m.stageAction === 'flash_shock') {
    pills.push(`<span class="cue-pill" title="震惊微震演出">📳 微震<button type="button" class="cue-pill-clear" data-quick-clear="shock" title="清除震惊微震">×</button></span>`);
  } else if (l.charEffect || l.charPosition || (Array.isArray(m.moveTrack) && m.moveTrack.length)) {
    pills.push(`<span class="cue-pill" title="角色站位/位移演出">↔ 走位<button type="button" class="cue-pill-clear" data-quick-clear="move" title="清除本行位移/站位">×</button></span>`);
  } else if ((l.charAnim1 && !/^wait1?$/.test(String(l.charAnim1))) || l.charAnim3) {
    const actCode = l.charAnim1 || l.charAnim3;
    pills.push(`<span class="cue-pill" title="重点动作：${esc(actCode)}">🎭 ${esc(getMotionNameZh(actCode))}<button type="button" class="cue-pill-clear" data-quick-clear="anim1" title="恢复默认动作">×</button></span>`);
  }
  if (kindOf(l) === 'dialogue' && isInnerMonologueRow(l)) {
    pills.push(`<span class="cue-pill" title="括号内心独白（闭口不张嘴）">💭</span>`);
  }
  if (l.voice) {
    const stale = Boolean(m.voiceStale);
    pills.push(`<span class="cue-pill ${stale ? 'stale' : ''}" title="${stale ? '台词已修改，建议在右侧重新合成配音' : '已绑定配音（点击本行试听）'}">${stale ? '⚠️重配' : '🎙'}</span>`);
  }
  return pills.join('');
}
const rowView = key => S.rowView[key] || S.textView;
function replaceRow(key) {
  const old = $(`.row[data-key="${key}"]`); const i = idxOf(key);
  if (!old || i < 0) return renderScript();
  const n = rowEl(i); old.replaceWith(n); $$('textarea', n).forEach(autoSize);
}
function renderOocSummary() {
  let n = 0; S.doc.rows.forEach(r => { n += activeIssues(r.line).filter(f => f.sev !== 'info').length; });
  const b = $('#oocSummary'); b.textContent = n ? `⚠ OOC ${n}` : '✓ OOC 0'; b.classList.toggle('has', n > 0);
}
function selectRow(key, { scroll = true, syncSpine = true, autoSpeak = false } = {}) {
  if (!key) return;
  stopRealAudio();
  S.selKey = key;
  S.selMotionKf = 0;
  stopSubtimelinePlay();
  if (bgmAudio) stopBgm();
  $$('.row.cur').forEach(e => e.classList.remove('cur'));
  const e = $(`.row[data-key="${key}"]`);
  if (e) { e.classList.add('cur'); if (scroll) e.scrollIntoView({ block: 'nearest' }); }
  const st = stageAt(curIdx());
  if (S.selChar && !(st.chars[S.selChar] && st.chars[S.selChar].visible)) S.selChar = null;
  renderStage(); renderTimeline(); renderStageDirectorDock(); renderInspector();
  refreshDirectorDrawerIfOpen();
  if (studioBus && !window.__inStudioBusSync) {
    try { studioBus.postMessage({ type: 'sc-studio:row-selected', key }); } catch (_) {}
  }
  if (syncSpine) syncGotoLineToSpineStage(false);
  if (autoSpeak && !S.preview && !S.tableRead) {
    const rIdx = idxOf(key);
    const rLn = rIdx >= 0 && S.doc && S.doc.rows[rIdx] && S.doc.rows[rIdx].line;
    if (rLn && rLn.voice && !(rLn._meta && rLn._meta.voiceStale)) playRealAudio(rLn.voice, null, { rowKey: key });
  }
}

/* ============================== 渲染：舞台 ============================== */
function bgSvgUri(b) {
  const [s1, s2] = b.sky, g = b.ground, night = /^#[0-4]/.test(s1);
  let motif = '';
  const clouds = night ? '<g fill="#fff" opacity=".9">' + Array.from({ length: 40 }, (_, k) => `<circle cx="${(k * 97) % 1136}" cy="${(k * 53) % 300}" r="${k % 3 ? 1.2 : 2}"/>`).join('') + '</g>'
    : '<g fill="#fff" opacity=".7"><ellipse cx="200" cy="110" rx="140" ry="34"/><ellipse cx="290" cy="95" rx="90" ry="40"/><ellipse cx="820" cy="150" rx="170" ry="36"/><ellipse cx="900" cy="130" rx="90" ry="42"/></g>';
  switch (b.motif) {
    case 'fence': motif = `<rect y="400" width="1136" height="240" fill="${g}"/><g stroke="#e8eef5" stroke-width="5" opacity=".9"><line x1="0" y1="330" x2="1136" y2="330"/><line x1="0" y1="420" x2="1136" y2="420"/>${Array.from({ length: 13 }, (_, k) => `<line x1="${k * 95}" y1="320" x2="${k * 95}" y2="430"/>`).join('')}</g><g stroke="#fff" stroke-width="1" opacity=".35">${Array.from({ length: 60 }, (_, k) => `<line x1="${k * 20}" y1="330" x2="${k * 20 + 90}" y2="420"/>`).join('')}</g>`; break;
    case 'window': motif = `<rect width="1136" height="640" fill="#f6e6d6" opacity=".55"/><rect x="300" y="70" width="540" height="330" fill="url(#sky)" stroke="#fff" stroke-width="14"/><line x1="570" y1="70" x2="570" y2="400" stroke="#fff" stroke-width="10"/><rect y="440" width="1136" height="200" fill="${g}"/><rect x="120" y="470" width="420" height="60" rx="6" fill="#6b5546"/><rect x="640" y="480" width="380" height="50" rx="6" fill="#6b5546"/>`; break;
    case 'desk': motif = `<rect y="0" width="1136" height="60" fill="#e9eef3"/><rect x="200" y="90" width="736" height="200" fill="#2f5a4a" stroke="#c9b28f" stroke-width="10"/><rect y="390" width="1136" height="250" fill="${g}"/>${Array.from({ length: 5 }, (_, k) => `<rect x="${80 + k * 210}" y="430" width="160" height="40" rx="4" fill="#d8c3a1"/><rect x="${80 + k * 210}" y="520" width="160" height="40" rx="4" fill="#d8c3a1"/>`).join('')}`; break;
    case 'mirror': motif = `<rect x="80" y="80" width="976" height="330" fill="#dfe8f2" stroke="#fff" stroke-width="8" opacity=".9"/><line x1="0" y1="300" x2="1136" y2="300" stroke="#b9a587" stroke-width="10"/><rect y="440" width="1136" height="200" fill="${g}"/>${Array.from({ length: 12 }, (_, k) => `<line x1="${k * 100}" y1="440" x2="${k * 100 - 160}" y2="640" stroke="#b39c80" stroke-width="2"/>`).join('')}`; break;
    case 'city': motif = `${Array.from({ length: 14 }, (_, k) => { const h = 120 + ((k * 73) % 200), x = k * 84; return `<rect x="${x}" y="${470 - h}" width="76" height="${h}" fill="#20264a"/>` + Array.from({ length: 8 }, (_, j) => `<rect x="${x + 10 + (j % 3) * 20}" y="${480 - h + 20 + Math.floor(j / 3) * 30}" width="9" height="12" fill="#ffd77a" opacity="${(j + k) % 3 ? .9 : .2}"/>`).join(''); }).join('')}<rect y="470" width="1136" height="170" fill="${g}"/>`; break;
    case 'sea': motif = `<rect y="330" width="1136" height="140" fill="#2aa6e0"/><g stroke="#fff" opacity=".6" stroke-width="3">${Array.from({ length: 10 }, (_, k) => `<line x1="${k * 120}" y1="${360 + (k % 3) * 30}" x2="${k * 120 + 60}" y2="${360 + (k % 3) * 30}"/>`).join('')}</g><rect y="460" width="1136" height="180" fill="${g}"/>`; break;
    case 'tree': motif = `<rect y="420" width="1136" height="220" fill="${g}"/><g fill="#4f6b57">${[120, 330, 840, 1020].map(x => `<rect x="${x - 10}" y="300" width="20" height="140" fill="#5b4a3e"/><circle cx="${x}" cy="270" r="90"/>`).join('')}</g><rect x="480" y="440" width="200" height="16" fill="#8b6a52"/><rect x="480" y="470" width="200" height="12" fill="#8b6a52"/>`; break;
    case 'stage': motif = `<g fill="#fff" opacity=".18"><polygon points="200,0 260,0 420,520 40,520"/><polygon points="880,0 940,0 1100,520 720,520"/><polygon points="540,0 600,0 720,520 420,520"/></g><rect y="470" width="1136" height="170" fill="${g}"/><rect y="470" width="1136" height="8" fill="#ff9ad6" opacity=".7"/>`; break;
    case 'snow': motif = `${Array.from({ length: 8 }, (_, k) => `<rect x="${k * 150}" y="${230 + (k % 3) * 40}" width="130" height="300" fill="#8f9cb6"/>`).join('')}<rect y="480" width="1136" height="160" fill="${g}"/><g fill="#fff">${Array.from({ length: 70 }, (_, k) => `<circle cx="${(k * 131) % 1136}" cy="${(k * 89) % 600}" r="${2 + k % 3}"/>`).join('')}</g>`; break;
    case 'road': motif = `<rect y="400" width="1136" height="240" fill="${g}"/><polygon points="420,400 716,400 1000,640 136,640" fill="#5a4a55"/><line x1="568" y1="410" x2="568" y2="640" stroke="#ffd9a8" stroke-width="6" stroke-dasharray="30 26"/><rect x="160" y="190" width="8" height="220" fill="#3a3040"/><circle cx="164" cy="186" r="14" fill="#ffe6a8"/>`; break;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1136 640" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient></defs><rect width="1136" height="640" fill="url(#sky)"/>${clouds}${motif}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function resolveBg(id, depth = 0) {
  if (!id) return { img: null, label: '（无背景）', src: '—' };
  if (S.blobs['bg:' + id]) return { img: S.blobs['bg:' + id], label: id, src: '本机上传预览（内存）' };
  const a = ((S.doc.pack.assets || {}).bg || {})[id];
  if (a) {
    if (['pending', 'draft', 'rejected'].includes(a.status) && !S.blobs['bg:' + id] && depth < 3) {
      const fb = a.fallback || (a.imageGen && a.imageGen.refBgId);
      if (fb) {
        const r = resolveBg(fb, depth + 1);
        return { ...r, label: `${id} → 回退 ${fb}`, src: `包内·${STATUS_ZH[a.status]} → 回退官方 ${fb}（V8 警告）` };
      }
    }
    if (a.file) return { img: `/bg/${id}`, fallbackImg: S.packEntry.assetBase ? S.packEntry.assetBase + a.file : null, label: a.titleZh || a.title || id, src: '包内·' + STATUS_ZH[a.status] };
  }
  const lib = M.bgLibrary.find(b => b.id === id);
  if (lib) return { img: lib.realUrl || `/bg/${id}.jpg`, fallbackImg: bgSvgUri(lib), label: `${id} ${lib.title}`, src: '官方真实背景 (/bg/' + id + '.jpg)' };
  if (/^\d{5}$/.test(String(id))) return { img: `/bg/${id}.jpg`, label: `${id} 官方背景`, src: '官方真实背景 (/bg/' + id + '.jpg)' };
  return { img: null, label: id + '（未找到）', src: '⚠ 无法解析（V8）' };
}
function faceSvg(c, ci, label) {
  const f = c.face, eyeDx = c.eye === 'eye_left' ? -8 : c.eye === 'eye_right' ? 8 : 0;
  let eyes, mouth, extra = '';
  const ex = 172, ex2 = 248, ey = 178;
  if (f === 'close' || f === 'smile2') eyes = `<path d="M${ex - 16} ${ey} q16 ${f === 'close' ? 8 : -12} 32 0 M${ex2 - 16} ${ey} q16 ${f === 'close' ? 8 : -12} 32 0" stroke="#3a2a35" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  else eyes = `<g><ellipse cx="${ex}" cy="${ey}" rx="15" ry="${f === 'surprised' ? 21 : 18}" fill="#fff"/><ellipse cx="${ex2}" cy="${ey}" rx="15" ry="${f === 'surprised' ? 21 : 18}" fill="#fff"/><ellipse cx="${ex + eyeDx}" cy="${ey + 2}" rx="10" ry="13" fill="${ci.hair}"/><ellipse cx="${ex2 + eyeDx}" cy="${ey + 2}" rx="10" ry="13" fill="${ci.hair}"/><circle cx="${ex + eyeDx + 3}" cy="${ey - 4}" r="3.5" fill="#fff"/><circle cx="${ex2 + eyeDx + 3}" cy="${ey - 4}" r="3.5" fill="#fff"/></g>`;
  if (f === 'serious' || f === 'angry') { mouth = `<path d="M196 232 h28" stroke="#9a4a5a" stroke-width="5" stroke-linecap="round"/>`; extra += `<path d="M${ex - 18} ${ey - 26} l30 ${f === 'angry' ? 10 : 5} M${ex2 + 18} ${ey - 26} l-30 ${f === 'angry' ? 10 : 5}" stroke="#3a2a35" stroke-width="5" stroke-linecap="round"/>`; }
  else if (f === 'surprised') mouth = `<ellipse cx="210" cy="234" rx="9" ry="12" fill="#b2485e"/>`;
  else if (f === 'sad') mouth = `<path d="M194 238 q16 -12 32 0" stroke="#9a4a5a" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  else if (f === 'normal') mouth = `<path d="M198 232 q12 5 24 0" stroke="#9a4a5a" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  else mouth = `<path d="M190 226 q20 22 40 0" stroke="#9a4a5a" stroke-width="5" fill="#f3a3b4" stroke-linecap="round"/>`;
  if (f === 'shy' || f === 'flustered') extra += `<g fill="#ff7a9a" opacity=".55"><ellipse cx="150" cy="210" rx="20" ry="9"/><ellipse cx="270" cy="210" rx="20" ry="9"/></g><path d="M150 205 l8 -8 M160 207 l8 -8 M262 205 l8 -8 M272 207 l8 -8" stroke="#ff5a80" stroke-width="2.5"/>`;
  const open = `<ellipse class="mouth-open" cx="210" cy="234" rx="11" ry="9" fill="#b2485e" opacity="0"/>`;
  return eyes + mouth + extra + open;
}
function charSvg(label, c) {
  const ci = charInfo(label), id = 'cg-' + label;
  return `<svg viewBox="0 0 420 620"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ci.color}"/><stop offset="1" stop-color="${ci.color}" stop-opacity=".55"/></linearGradient></defs>
  <path d="M100 172 Q96 52 210 44 Q324 52 320 172 L338 360 Q300 330 292 268 L128 268 Q120 330 82 360 Z" fill="${ci.hair}"/>
  <path d="M112 312 Q210 262 308 312 L352 620 L68 620 Z" fill="url(#${id})" stroke="#fff" stroke-width="5"/>
  <path d="M172 300 L210 352 L248 300" fill="#fff" opacity=".9"/><path d="M196 352 l14 26 l14 -26" fill="${ci.hair}" opacity=".7"/>
  <rect x="186" y="246" width="48" height="50" rx="16" fill="#ffe4d6"/>
  <ellipse cx="210" cy="176" rx="90" ry="100" fill="#ffeadf" stroke="#fff" stroke-width="4"/>
  <path d="M118 160 Q124 64 210 60 Q296 64 302 160 Q272 116 244 128 Q216 96 190 128 Q160 110 118 160 Z" fill="${ci.hair}"/>
  <g transform="translate(286 92) rotate(18)"><path d="M0 0 l26 -16 l4 30 Z M0 0 l-24 -18 l-4 30 Z" fill="${ci.color}" stroke="#fff" stroke-width="3"/><circle r="7" fill="#fff"/></g>
  ${faceSvg(c, ci, label)}</svg>`;
}
function renderStage({ typing = false } = {}) {
  if (!S.doc) return;
  const stage = $('#stage'), idx = curIdx(), st = stageAt(idx), l = st.line || {};
  stage.className = 'stage' + (S.guides ? ' guides-on' : '');
  const bg = resolveBg(st.bg);
  let html = `<div class="st-bg" style="${bg.img ? '' : 'background:linear-gradient(#141a30,#283255)'}">${bg.img ? `<img src="${esc(bg.img)}" ${bg.fallbackImg ? `onerror="this.onerror=null;this.src='${esc(bg.fallbackImg)}'"` : ''} alt="" draggable="false">` : ''}${!bg.img ? `<span class="bg-label">${esc(bg.label)}</span>` : ''}</div>`;
  html += `<div class="st-chars">`;
  for (const c of Object.values(st.chars)) {
    if (!c.visible) continue;
    const ci = charInfo(c.label), mirror = c.eye === 'eye_right';
    const sel = S.selChar === c.label, speaking = (S.preview && S.preview.speaking === c.label) || (S.speakingNow === c.label);
    html += `<div class="st-char ${sel ? 'sel' : ''} ${speaking ? 'speaking' : ''}" data-label="${esc(c.label)}" style="left:${c.x}px;top:${c.y}px;transform:translate(-50%,-100%) scale(${c.scale});z-index:${sel ? 5 : 2}">
      <div style="width:100%;height:100%;transform:scaleX(${mirror ? -1 : 1})">${charSvg(c.label, c)}</div>
      <div class="hit"></div>
      <div class="sel-box"><span class="scale-handle" data-h="scale" title="拖动缩放 charScale"></span><button class="flip-handle" data-h="flip" title="切换视线 charAnim4">⇄ 视线</button></div>
      <div class="char-tag">${esc(ci.name)} · ${esc(M.faceLabels[c.face] || c.face)}</div></div>`;
  }
  html += `</div>`;
  // 2D 平面移动轨迹箭头 (起点 → 终点)
  const mvTrack = l._meta && Array.isArray(l._meta.moveTrack) && l._meta.moveTrack[0] ? l._meta.moveTrack[0] : null;
  if (l.charLabel && (mvTrack || (l.charEffect && l.charEffect.x != null)) && idx > 0) {
    const prevSt = stageAt(idx - 1), pc = prevSt.chars[l.charLabel], cc = st.chars[l.charLabel];
    const basePrevX = pc && pc.x != null ? pc.x : (cc ? cc.x : 568);
    let x1 = basePrevX, x2 = basePrevX;
    if (mvTrack && mvTrack.fromX != null && mvTrack.toX != null) {
      x1 = +mvTrack.fromX;
      x2 = +mvTrack.toX;
    } else if (l.charEffect && l.charEffect.x != null) {
      const dx = +l.charEffect.x;
      if (l.charEffect.type === 'from') {
        x2 = cc && cc.x != null ? cc.x : basePrevX;
        x1 = x2 + dx;
      } else {
        x1 = basePrevX;
        x2 = basePrevX + dx;
      }
    }
    if (Math.abs(x2 - x1) > 8) {
      const dur = (mvTrack && mvTrack.durationMs) || (l.charEffect && l.charEffect.time) || 400;
      html += `<svg class="st-move-overlay" viewBox="0 0 1136 640"><defs><marker id="mvArr" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto"><path d="M0,1 L9,5 L0,9 Z" fill="#4db2ff"/></marker></defs>
        <circle cx="${x1}" cy="410" r="9" fill="rgba(77,178,255,.35)" stroke="#fff" stroke-width="2.5"/>
        <line x1="${x1}" y1="410" x2="${x2}" y2="410" stroke="#4db2ff" stroke-width="4" stroke-dasharray="10 6" marker-end="url(#mvArr)"/>
        <rect x="${(x1 + x2) / 2 - 86}" y="370" width="172" height="28" rx="14" fill="rgba(12,20,42,.82)" stroke="#4db2ff" stroke-width="1.5"/>
        <text x="${(x1 + x2) / 2}" y="389" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">起点 ${Math.round(x1)} → 终点 ${Math.round(x2)} (${dur}ms)</text>
      </svg>`;
    }
  }
  html += `<div class="st-guides"><div class="safe"></div>${[150, 200, 310, 568, 796, 936, 986].map(x => `<div class="vl" style="left:${x}px"><span>${x}</span></div>`).join('')}</div>`;
  if (st.kind === 'dialogue') {
    const sp = l.speaker || '', m = l._meta || {}, lb = charOfLine(l);
    const nameZh = m.speakerZh || (lb && sp === charInfo(lb).name ? ((S.doc.pack.characters[lb] || {}).nameZh || charInfo(lb).nameZh) : (isProducer(sp) ? '制作人' : ''));
    const name = S.subtitle === 'zh' ? (nameZh || sp) : sp;
    const cls = !sp ? 'mono' : (isProducer(sp) || l.textFrame === '004' || l.textFrame === '002') ? 'p' : '';
    const showJa = S.subtitle !== 'zh', showZh = S.subtitle !== 'ja' && m.zh;
    html += `<div class="st-dialog stage-textbox ${cls}" style="--nc:${speakerColor(l)}"><div class="box">${showJa ? `<div class="jp stage-text" id="stJp">${esc(typing ? '' : l.text)}</div>` : ''}${showZh ? `<div class="zh" id="stZh">${esc(m.zh)}</div>` : (!showJa ? `<div class="jp stage-text">${esc(m.zh || l.text)}</div>` : '')}</div>${sp ? `<div class="name stage-speaker">${esc(name)}</div>` : ''}<div class="next"></div></div>`;
  } else if (st.kind === 'select') {
    html += `<div class="st-choices">${st.choices.map(c => `<button class="st-choice" data-choice="${c.i}">${S.subtitle !== 'zh' ? esc(c.text) : esc(c.zh || c.text)}${S.subtitle === 'both' && c.zh ? `<small>${esc(c.zh)}</small>` : ''}</button>`).join('')}</div>`;
  } else if (st.kind === 'label') {
    html += `<div class="st-label">🏷 label: ${esc(l.label)}</div>`;
  }
  if (S.preview) html += `<div class="st-play">● 连续预览中 · 点击舞台跳过 · Esc 停止</div>`;
  else if (st.kind === 'direction') html += `<div class="st-hint">🎬 演出行 · 第 ${idx + 1} 行</div>`;
  else if (!S.selChar && Object.values(st.chars).some(c => c.visible)) html += `<div class="st-hint">拖动角色移动 · 右上圆点 / 滚轮缩放 · 选中后再点一次切换视线</div>`;
  if (S.selChar && st.chars[S.selChar]) { const c = st.chars[S.selChar]; html += `<div class="st-readout" id="stReadout">${readout(c)}</div>`; }
  stage.innerHTML = html;
  // 状态栏
  const bgmT = st.bgm ? (M.bgmLibrary.find(b => b.id === st.bgm) || {}).title : '';
  $('#stageStatus').innerHTML = `<span>第 <b>${idx + 1}</b>/${S.doc.rows.length} 行</span><span>背景 <b>${esc(bg.label)}</b>（${esc(bg.src)}）</span><span>BGM <b>${esc(st.bgm || '无')}</b>${bgmT ? ' ' + esc(bgmT) : ''}</span>${st.se ? `<span>SE <b>${esc(st.se)}</b></span>` : ''}`;
}
const readout = c => `${esc(charInfo(c.label).name)} · x ${Math.round(c.x)} · y ${Math.round(c.y)} · ×${(+c.scale).toFixed(2)} · 视线 ${c.eye === 'eye_left' ? '左' : c.eye === 'eye_right' ? '右' : '正'}`;
function fitStage() {
  const fr = $('#stageFrame'), stage = $('#stage');
  const w = fr.clientWidth, h = fr.clientHeight;
  const k = Math.min(w / 1136, h / 640);
  S.k = k;
  stage.style.transform = `translate(${(w - 1136 * k) / 2}px, ${(h - 640 * k) / 2}px) scale(${k})`;
}

/* ============================== 舞台交互：拖拽 / 缩放 / 视线 ============================== */
function initStageInteractions() {
  const stage = $('#stage');
  stage.addEventListener('pointerdown', e => {
    const choice = e.target.closest('.st-choice');
    if (choice) { e.preventDefault(); return onChoice(+choice.dataset.choice); }
    if (S.preview) { previewSkip(); return; }
    const ch = e.target.closest('.st-char');
    if (!ch) { if (S.selChar) { S.selChar = null; renderStage(); renderInspector(); } return; }
    e.preventDefault();
    const label = ch.dataset.label, h = e.target.closest('[data-h]');
    if (h && h.dataset.h === 'flip') return flipGaze(label);
    const wasSel = S.selChar === label;
    S.selChar = label;
    $$('.st-char', stage).forEach(x => x.classList.toggle('sel', x === ch));
    const st = stageAt(curIdx()), c = st.chars[label];
    const target = charTargetRow(label);
    const castIdx = Math.max(0, st.cast.indexOf(label));
    const start = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, cs: c.scale, moved: false, mode: h && h.dataset.h === 'scale' ? 'scale' : 'move' };
    ch.setPointerCapture(e.pointerId); ch.classList.add('dragging');
    const move = ev => {
      const dx = (ev.clientX - start.x) / S.k, dy = (ev.clientY - start.y) / S.k;
      if (!start.moved && Math.hypot(dx, dy) < 4) return;
      if (!start.moved) { start.moved = true; begin(start.mode === 'scale' ? `缩放 ${charInfo(label).name}` : `移动 ${charInfo(label).name}`); }
      if (start.mode === 'move') {
        let nx = Math.round(clamp(start.cx + dx, -150, 1286)), ny = Math.round(clamp(start.cy + dy, 260, 1000));
        for (const sx of [200, 310, 568, 796, 936]) if (Math.abs(nx - sx) < 10) nx = sx;  // 吸附常用站位
        if (Math.abs(ny - 640) < 10) ny = 640;
        mutRow(target, l => {
          if (!l.charLabel) setK(l, 'charLabel', label);
          const p = (l.charPosition && typeof l.charPosition === 'object') ? { ...l.charPosition } : { x: 0, y: 640, order: castIdx };
          p.x = nx; p.y = ny; setK(l, 'charPosition', p);
          meta(l).manualPos = true;
        });
        ch.style.left = nx + 'px'; ch.style.top = ny + 'px'; c.x = nx; c.y = ny;
      } else {
        const ns = Math.round(clamp(start.cs + (dx - dy) / 420, 0.4, 2.5) * 100) / 100;
        mutRow(target, l => { if (!l.charLabel) setK(l, 'charLabel', label); setK(l, 'charScale', ns); });
        ch.style.transform = `translate(-50%,-100%) scale(${ns})`; c.scale = ns;
      }
      const ro = $('#stReadout'); if (ro) ro.innerHTML = readout(c);
    };
    const up = () => {
      ch.removeEventListener('pointermove', move); ch.removeEventListener('pointerup', up); ch.removeEventListener('pointercancel', up);
      ch.classList.remove('dragging');
      if (start.moved) {
        commit();
        const tk = S.doc.rows[target].key; replaceRow(tk); renderLight();
        if (target !== curIdx()) toast(`已写入第 ${target + 1} 行（该角色最近的关键帧）`);
      } else if (wasSel && start.mode === 'move') flipGaze(label);
      else { renderStage(); renderInspector(); }
    };
    ch.addEventListener('pointermove', move); ch.addEventListener('pointerup', up); ch.addEventListener('pointercancel', up);
  });
  let wheelT = null;
  stage.addEventListener('wheel', e => {
    const ch = e.target.closest('.st-char'); if (!ch || S.preview) return;
    e.preventDefault();
    const label = ch.dataset.label; S.selChar = label;
    const target = charTargetRow(label), c = stageAt(curIdx()).chars[label];
    if (!TX) begin(`滚轮缩放 ${charInfo(label).name}`);
    const ns = Math.round(clamp(c.scale + (e.deltaY < 0 ? 0.05 : -0.05), 0.4, 2.5) * 100) / 100;
    mutRow(target, l => { if (!l.charLabel) setK(l, 'charLabel', label); setK(l, 'charScale', ns); });
    renderStage();
    clearTimeout(wheelT);
    wheelT = setTimeout(() => { commit(); replaceRow(S.doc.rows[target].key); renderLight(); }, 450);
  }, { passive: false });
}
function flipGaze(label) {
  const target = charTargetRow(label), c = stageAt(curIdx()).chars[label];
  const next = c.eye === 'eye_left' ? 'eye_right' : 'eye_left';
  S.selChar = label;
  exec(`切换视线 ${charInfo(label).name}`, () => mutRow(target, l => { if (!l.charLabel) setK(l, 'charLabel', label); setK(l, 'charAnim4', next); }));
  toast(`视线 → ${next === 'eye_left' ? '左' : '右'}（charAnim4: ${next}）`);
}
function onChoice(i) {
  const l = S.doc.rows[i].line;
  if (S.preview) {
    const j = findLabel(l.nextLabel);
    S.preview.i = j >= 0 ? j + 1 : i + 1; S.preview.waiting = false; previewStep();
  } else selectRow(S.doc.rows[i].key);
}

/* ============================== 渲染：时间线（顶部分镜节拍条 + 底部本幕独立三轨时间轴） ============================== */
function getMotionNameZh(code) {
  if (!code) return '默认待机';
  const hit = (M.motionPresetCatalog || []).find(p => p.code === code || p.id === code);
  if (hit) return hit.nameZh;
  const map = { wait1: '标准待机', wait2: '放松待机', wait3: '端庄站姿', smile1: '轻快微笑', smile2: '开心晃身', smile3: '灿烂欢笑', shy1: '害羞微扭', shy2: '脸红低头', surp1: '微微吃惊', surp2: '大惊后仰', anger1: '鼓腮赌气', angry1: '鼓腮赌气', sad1: '失落垂肩', trouble1: '困扰为难', yes: '点头回应' };
  return map[code] || code;
}
function getFaceNameZh(faceCode) {
  if (!faceCode) return '平静';
  const short = String(faceCode).replace(/^face_/, '');
  const hit = (M.faceExpressionCatalog || []).find(f => f.code === faceCode || f.short === short);
  if (hit) return hit.nameZh;
  return (M.faceLabels && M.faceLabels[short]) || short;
}
function getLineSubtimelineData(idx) {
  const r = S.doc.rows[idx];
  if (!r) return { durMs: 2400, speechMs: 2000, holdMs: 400, lb: null, motionTrack: [], moveTrack: [] };
  const l = r.line, m = l._meta || {}, k = kindOf(l);
  const st = stageAt(idx);
  const lb = (k === 'dialogue' ? charOfLine(l) : l.charLabel) || S.selChar || st.cast[0] || null;
  const sc = (lb && st.chars[lb]) || {};
  const holdMs = Number(m.holdMs) || 0;
  const totalDur = Math.max(1200, estDur(l));
  const speechMs = Math.max(600, totalDur - holdMs);

  let motionTrack = Array.isArray(m.motionTrack) && m.motionTrack.length ? m.motionTrack.map(kf => ({ ...kf })) : null;
  if (!motionTrack) {
    const a1 = l.charAnim1 || sc.anim1 || 'wait1';
    const a2 = l.charAnim2 || ('face_' + (sc.face || 'normal'));
    const a3 = l.charAnim3 || '';
    const a4 = l.charAnim4 || sc.eye || 'eye_front';
    motionTrack = [{
      offsetMs: 0,
      charLabel: lb || 'amana',
      anim1: a1,
      anim2: a2,
      anim3: a3,
      anim4: a4,
      label: `${getMotionNameZh(a1)} + ${getFaceNameZh(a2)}`
    }];
  }

  let moveTrack = Array.isArray(m.moveTrack) && m.moveTrack.length ? m.moveTrack.map(mv => ({ ...mv })) : [];
  if (!moveTrack.length && l.charEffect && typeof l.charEffect === 'object' && l.charEffect.type === 'to' && l.charEffect.x != null) {
    const prevX = idx > 0 && lb && stageAt(idx - 1).chars[lb] ? Math.round(stageAt(idx - 1).chars[lb].x || 568) : Math.round(sc.x || 568);
    moveTrack = [{
      offsetMs: 0,
      durationMs: Number(l.charEffect.time) || 450,
      charLabel: lb || 'amana',
      fromX: prevX,
      toX: Math.round(l.charEffect.x),
      label: `平面移动 X:${prevX}→${Math.round(l.charEffect.x)}`
    }];
  }

  const maxKfEnd = motionTrack.reduce((mx, kf) => Math.max(mx, (Number(kf.offsetMs) || 0) + 600), 0);
  const maxMvEnd = moveTrack.reduce((mx, mv) => Math.max(mx, (Number(mv.offsetMs) || 0) + (Number(mv.durationMs) || 450)), 0);
  const durMs = Math.max(totalDur, maxKfEnd, maxMvEnd, 1800);
  return { durMs, speechMs, holdMs, lb, motionTrack, moveTrack };
}

function stopSubtimelinePlay(notifyStage = true) {
  const wasPlaying = Boolean(S.tlPlayTimer);
  if (S.tlPlayTimer) {
    if (S.tlPlayTimer.raf) cancelAnimationFrame(S.tlPlayTimer.raf);
    (S.tlPlayTimer.timeouts || []).forEach(clearTimeout);
    S.tlPlayTimer = null;
  }
  if (notifyStage && wasPlaying) {
    postToSpineStage({ type: 'sc-studio:stop-subtimeline' });
  }
  const btn = $('#btnPlaySubtimeline');
  if (btn) btn.textContent = '▶ 演示本幕时间轴';
}

function playSubtimelineOnSpineStage() {
  if (S.tlPlayTimer) {
    stopSubtimelinePlay(true);
    const ph = $('#tlPlayhead');
    if (ph) ph.style.left = '170px';
    return;
  }
  if (bgmAudio) stopBgm();
  const idx = curIdx();
  const sub = getLineSubtimelineData(idx);
  const durMs = sub.durMs;
  const btn = $('#btnPlaySubtimeline');
  if (btn) btn.textContent = '⏹ 停止演示';

  if (!S.spineStageSyncedSig) {
    syncLoadDocToSpineStage(false);
  }

  // 发送完整子时间轴消息给 :18899（由 :18899 舞台统一调度关键帧动作与 2D 走位，避免重复发送 load-doc / preview-pose 冲突）
  postToSpineStage({
    type: 'sc-studio:play-subtimeline',
    index: idx,
    durationMs: durMs,
    motionTrack: sub.motionTrack,
    moveTrack: sub.moveTrack
  });

  // 仅同步更新底部时间轴胶囊高亮，不再重复发送 previewPoseOnSpineStage
  const timeouts = [];
  sub.motionTrack.forEach((kf, kIdx) => {
    const delay = Math.max(0, Number(kf.offsetMs) || 0);
    timeouts.push(setTimeout(() => {
      S.selMotionKf = kIdx;
      $$('#timeline .tl-kf-pill').forEach((elP, pIdx) => elP.classList.toggle('on', pIdx === kIdx));
    }, delay));
  });

  const startAt = performance.now();
  const timerObj = { raf: null, timeouts };
  S.tlPlayTimer = timerObj;

  function stepFrame(now) {
    if (S.tlPlayTimer !== timerObj) return;
    const elapsed = now - startAt;
    const ratio = clamp(elapsed / durMs, 0, 1);
    const laneTrack = $('#timeline .tl-lane-track');
    const ph = $('#tlPlayhead');
    if (laneTrack && ph) {
      const trackW = laneTrack.clientWidth || 500;
      ph.style.left = Math.round(170 + ratio * (trackW - 4)) + 'px';
    }
    if (elapsed < durMs) {
      timerObj.raf = requestAnimationFrame(stepFrame);
    } else {
      stopSubtimelinePlay(false);
      if (ph) ph.style.left = '170px';
    }
  }
  timerObj.raf = requestAnimationFrame(stepFrame);
}

function renderTimeline() {
  const tl = $('#timeline'), R = S.doc.rows, ci = curIdx();
  let total = 0, upTo = 0;
  const beats = R.map((r, i) => {
    const l = r.line, k = kindOf(l), d = estDur(l); if (i < ci) upTo += d; total += d;
    const w = k === 'label' ? 58 : clamp(Math.round(d / 32), 68, 210);
    const mk = []; if (l.bg !== undefined) mk.push('🖼'); if (l.bgm !== undefined) mk.push('🎵'); if (l.se !== undefined) mk.push('🔔');
    if (activeIssues(l).some(f => f.sev !== 'info')) mk.push('⚠');
    const spk = k === 'dialogue' ? (l.speaker || '旁白') : '';
    const txt = k === 'dialogue' ? (`#${String(i + 1).padStart(2, '0')} ${spk}: ${l.text || '…'}`) : k === 'select' ? `#${String(i + 1).padStart(2, '0')} ◇ ${l.select}` : k === 'label' ? `#${l.label}` : `#${String(i + 1).padStart(2, '0')} 🎬 演出`;
    return `<div class="beat-wrap" style="width:${w}px"><span class="mks">${mk.join('')}</span><div class="beat k-${k} ${i === ci ? 'cur' : ''}" data-key="${r.key}" style="width:${w}px;--c:${speakerColor(l)}" title="第 ${i + 1} 行 · ${esc(txt)} · 约 ${(d / 1000).toFixed(1)}s">${esc(txt)}</div></div>`;
  }).join('');
  const fmt = ms => { const s = Math.round(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const prevTrack = $('.timeline-track', tl), sl = prevTrack ? prevTrack.scrollLeft : 0;

  // 当前幕独立多轨时间轴数据
  const curL = R[ci] ? R[ci].line : {};
  const sub = getLineSubtimelineData(ci);
  const durS = (sub.durMs / 1000).toFixed(1);
  const speechPct = clamp(Math.round((sub.speechMs / sub.durMs) * 100), 15, 100);
  const holdPct = Math.max(0, 100 - speechPct);
  const selKfIdx = clamp(S.selMotionKf || 0, 0, Math.max(0, sub.motionTrack.length - 1));
  S.selMotionKf = selKfIdx;

  const kfPillsHtml = sub.motionTrack.map((kf, kIdx) => {
    const leftPct = clamp(((Number(kf.offsetMs) || 0) / sub.durMs) * 82, 0, 82);
    const secStr = ((Number(kf.offsetMs) || 0) / 1000).toFixed(1);
    const lbl = kf.label || `${getMotionNameZh(kf.anim1)} + ${getFaceNameZh(kf.anim2)}${kf.anim3 ? ' · ' + getMotionNameZh(kf.anim3) : ''}`;
    return `<div class="tl-kf-pill ${kIdx === selKfIdx ? 'on' : ''}" data-kf-idx="${kIdx}" style="left:${leftPct.toFixed(1)}%" title="点击选中此关键帧并在下方修改动作/表情（将在 @${secStr}s 触发）">
      <span class="kf-time">@${secStr}s:</span>
      <span>[${esc(lbl)}]</span>
      ${kIdx > 0 ? `<input type="number" class="kf-sec-inp" data-kf-time="${kIdx}" value="${secStr}" min="0.1" max="8.0" step="0.2" style="width:42px;padding:0 2px;font-size:10px;border-radius:4px;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.18);color:inherit" title="调整句中触发秒数 (0.1s ~ 8.0s)">` : ''}
      ${kIdx > 0 ? `<button type="button" class="kf-del" data-kf-del="${kIdx}" title="删除此句中动作点">×</button>` : ''}
    </div>`;
  }).join('');

  const moveBarsHtml = sub.moveTrack.length ? sub.moveTrack.map((mv, mIdx) => {
    const startPct = clamp(((Number(mv.offsetMs) || 0) / sub.durMs) * 75, 0, 75);
    const widthPct = clamp(((Number(mv.durationMs) || 450) / sub.durMs) * 85, 18, 95 - startPct);
    const startS = ((Number(mv.offsetMs) || 0) / 1000).toFixed(1);
    const endS = (((Number(mv.offsetMs) || 0) + (Number(mv.durationMs) || 450)) / 1000).toFixed(1);
    return `<div class="tl-move-bar" data-mv-idx="${mIdx}" style="left:${startPct.toFixed(1)}%;width:${widthPct.toFixed(1)}%" title="点击在真 Spine 舞台预览此 2D 位移（起点 X=${mv.fromX} → 终点 X=${mv.toX}）">
      <span>↔ @${startS}s~${endS}s · 起点X:${mv.fromX} → 终点X:${mv.toX}</span>
      <input type="number" class="mv-sec-inp" data-mv-time="${mIdx}" value="${startS}" min="0.0" max="6.0" step="0.2" style="width:42px;padding:0 2px;font-size:10px;border-radius:4px;border:1px solid var(--line2);background:var(--glass-hi);color:var(--ink)" title="句中走位触发时机(秒)">
      <button type="button" class="kf-del" data-mv-del="${mIdx}" title="删除此句中走位">×</button>
    </div>`;
  }).join('') : `<span class="muted" style="padding-left:10px;font-size:11px">（本幕固定站位 X=${sub.lb && stageAt(ci).chars[sub.lb] ? Math.round(stageAt(ci).chars[sub.lb].x || 568) : 568} · 可点击右上「+ 插入句中走位」或下方 2D 站位预设）</span>`;

  const curSeObj = curL.se ? (M.seLibrary || []).find(x => x.id === String(curL.se)) : null;
  const seBadgeHtml = curL.se
    ? `<span class="tl-se-badge" data-tl-se-play="${esc(curL.se)}" title="点击试听本幕音效 SE ${esc(curL.se)}">🔔 SE: <b>${esc(curL.se)}</b> ${esc(curSeObj ? curSeObj.title : '')}</span>`
    : `<span class="muted" style="font-size:11px">🔔 无音效（可在下方音效速查栏一键挂入）</span>`;

  tl.innerHTML = `
    <div class="tl-top-row">
      <div class="tl-meta"><span>全幕节拍轨 (${R.length}行)</span><b>${fmt(upTo)} / ${fmt(total)}</b></div>
      <div class="timeline-track"><div class="tl-inner">${beats}</div></div>
    </div>
    <div class="tl-multitrack">
      <div class="tl-mt-head">
        <div class="tl-mt-title">
          <span>⏱ 本幕独立时间轴 · 第 ${ci + 1} 行</span>
          <code>0.0s ~ ${durS}s</code>
          ${seBadgeHtml}
          ${sub.lb ? `<span class="muted">当前角色：<b>${esc(charInfo(sub.lb).name)}</b> · 选中动作帧：<b>#${selKfIdx + 1} (@${((sub.motionTrack[selKfIdx]?.offsetMs || 0) / 1000).toFixed(1)}s)</b></span>` : ''}
        </div>
        <div class="tl-mt-actions">
          <button type="button" class="chip-btn" id="btnAddMotionKf" title="在本句台词中途插入一个动作/表情切换关键帧">＋ 插入句中动作点</button>
          <button type="button" class="chip-btn" id="btnAddMoveKf" title="在本句台词中途插入一段 2D 平面走位">＋ 插入句中走位</button>
          <button type="button" class="chip-btn prismy" id="btnPlaySubtimeline" title="驱动红色播放头并在上方真 Spine 舞台实时演示本幕多关键帧动作与走位">▶ 演示本幕时间轴</button>
        </div>
      </div>
      <div class="tl-lanes">
        <div class="tl-playhead" id="tlPlayhead" style="left:170px"></div>
        <div class="tl-lane">
          <div class="tl-lane-lbl">🎙 语音与音效轨</div>
          <div class="tl-lane-track">
            <div class="tl-voice-bar" style="width:${speechPct}%">🗣 台词发音 0.0s ~ ${(sub.speechMs / 1000).toFixed(1)}s · ${esc((curL.text || (curL._meta && curL._meta.note) || '演出').slice(0, 24))}${curL.se ? ` · 🔔 SE:${esc(curL.se)}` : ''}</div>
            <div class="tl-hold-bar" style="width:${holdPct}%" title="句尾停顿 holdMs（可在下方调整）">${sub.holdMs ? `⏸ 停顿 ${sub.holdMs}ms` : '无额外停顿'}</div>
          </div>
        </div>
        <div class="tl-lane">
          <div class="tl-lane-lbl">🏃 动作与表情轨 <small class="muted">(关键帧)</small></div>
          <div class="tl-lane-track" id="tlMotionTrackLane">${kfPillsHtml}</div>
        </div>
        <div class="tl-lane">
          <div class="tl-lane-lbl">↔️ 2D 平面位移轨 <small class="muted">(运镜)</small></div>
          <div class="tl-lane-track" id="tlMoveTrackLane">${moveBarsHtml}</div>
        </div>
      </div>
    </div>`;

  const track = $('.timeline-track', tl);
  if (track) {
    track.scrollLeft = sl;
    const cur = $('.beat.cur', tl);
    if (cur) {
      const L = cur.parentElement.offsetLeft;
      if (L < track.scrollLeft || L > track.scrollLeft + track.clientWidth - 80) track.scrollLeft = L - 50;
    }
  }
}

/* ============================== 中栏底部：当前句导演控制台 (#stageDirectorDock) ============================== */
function toggleRowInnerMonologue(i) {
  if (!S.doc || !Array.isArray(S.doc.rows) || !S.doc.rows[i]) return;
  const curRowObj = S.doc.rows[i];
  const l0 = curRowObj.line;
  if (!l0 || kindOf(l0) !== 'dialogue') return;
  const wasMono = isInnerMonologueRow(l0);
  const stripParens = (raw) => {
    const s = String(raw || '').trim();
    if (s.startsWith('（') && s.endsWith('）')) return s.slice(1, -1).trim();
    if (s.startsWith('(') && s.endsWith(')')) return s.slice(1, -1).trim();
    return s;
  };
  const wrapParens = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    if ((s.startsWith('（') && s.endsWith('）')) || (s.startsWith('(') && s.endsWith(')'))) return s;
    return `（${s}）`;
  };
  exec(wasMono ? `取消内心独白 #${i + 1}` : `设为（）内心独白·闭口 #${i + 1}`, () => mutRow(i, l => {
    const mm = meta(l);
    if (wasMono) {
      if (l.text) setK(l, 'text', stripParens(l.text));
      if (mm.zh) mm.zh = stripParens(mm.zh);
      delete mm['x-innerMonologue'];
      delete l.lip;
      if (isClosedOrBrokenLipToken(l.charLipAnim)) {
        setK(l, 'charLipAnim', 'lip_smile');
      }
    } else {
      if (l.text) setK(l, 'text', wrapParens(l.text));
      if (mm.zh) mm.zh = wrapParens(mm.zh);
      mm['x-innerMonologue'] = true;
      const monoLb = l.charLabel || charOfLine(l);
      const closedClip = monoLb
        ? resolveClientValidClip(getOutfitAnimSetForChar(monoLb, l), 'lip_wait_s', 'closed_lip')
        : 'lip_wait_s';
      setK(l, 'charLipAnim', closedClip);
      setK(l, 'lip', closedClip);
    }
    refreshVoiceStaleFlag(l);
  }));
  syncLoadDocToSpineStage(false);
  syncGotoLineToSpineStage(false);
}

function applyStageActionToRow(i, rawAct) {
  if (!S.doc || !Array.isArray(S.doc.rows) || i < 0 || !S.doc.rows[i]) return false;
  const act = String(rawAct || '').trim();
  const curSt = stageAt(Math.max(0, i - 1));
  exec('切换演出动作 #' + (i + 1), () => mutRow(i, ln => {
    ln._meta = ln._meta || {};
    if (act) ln._meta.stageAction = act;
    else delete ln._meta.stageAction;
    delete ln.charEffect;
    delete ln._meta.moveTrack;
    if (ln.charScale && Number(ln.charScale) > 1.05 && act !== 'lean_close') setK(ln, 'charScale', 1);
    if (ln.effectLabel === 'flash') { delete ln.effectLabel; delete ln.effectTarget; delete ln.effectValue; }
    if (ln.bgEffect === 'white_fade' && act !== 'bgm_stop' && act !== 'flash_shock') { delete ln.bgEffect; delete ln.bgEffectTime; }
    if (ln.bgm === 'off' || ln.bgm === 'fade_out') { delete ln.bgm; delete ln.bgmFadeTime; }
    const lb = charOfLine(ln) || ln.charLabel || S.selChar || (curSt.cast && curSt.cast[0]) || null;
    const slotX = (ln.charPosition && ln.charPosition.x != null)
      ? +ln.charPosition.x
      : ((lb && curSt.chars && curSt.chars[lb] && curSt.chars[lb].x != null) ? curSt.chars[lb].x : 568);
    if (lb && act && /^(dash_out_right|dash_out_left|chase_in_left|step_back|lean_close|stumble)$/.test(act)) {
      if (!ln.charLabel) setK(ln, 'charLabel', lb);
      if (act === 'dash_out_right') {
        ln.charEffect = { type: 'to', x: Math.max(560, 1496 - slotX), time: 520, ease: 'easeOutQuad' };
        ln._meta.moveTrack = [{ fromX: slotX, toX: 1496, durationMs: 520, label: '向右平移跑出画面' }];
      } else if (act === 'dash_out_left') {
        ln.charEffect = { type: 'to', x: Math.min(-560, -360 - slotX), time: 520, ease: 'easeOutQuad' };
        ln._meta.moveTrack = [{ fromX: slotX, toX: -360, durationMs: 520, label: '向左平移跑出画面' }];
      } else if (act === 'chase_in_left') {
        ln.charPosition = { x: slotX, y: 610, order: (ln.charPosition && ln.charPosition.order) || 0 };
        ln.charEffect = { type: 'from', x: -360 - slotX, time: 460, ease: 'easeOutCubic' };
        ln._meta.moveTrack = [{ fromX: -360, toX: slotX, durationMs: 460, label: '从左侧平移追入画面' }];
      } else if (act === 'step_back') {
        const tx = Math.max(120, Math.min(1016, slotX + (slotX >= 568 ? 72 : -72)));
        ln.charEffect = { type: 'to', x: tx - slotX, time: 280, ease: 'easeOutQuad' };
        ln._meta.moveTrack = [{ fromX: slotX, toX: tx, durationMs: 280, label: '后退半步' }];
      } else if (act === 'lean_close') {
        const tx = slotX >= 568 ? Math.max(630, slotX - 85) : Math.min(506, slotX + 85);
        ln.charEffect = { type: 'to', x: tx - slotX, time: 320, ease: 'easeOutQuad' };
        ln._meta.moveTrack = [{ fromX: slotX, toX: tx, durationMs: 320, label: '凑近说悄悄话' }];
      } else if (act === 'stumble') {
        const tx = Math.min(1016, slotX + 28);
        ln.charEffect = { type: 'to', x: tx - slotX, y: 14, time: 220, ease: 'easeOutQuad' };
        ln._meta.moveTrack = [{ fromX: slotX, toX: tx, durationMs: 220, label: '踉跄微沉' }];
      }
    }
    if (act === 'bgm_stop') { ln.bgm = 'off'; ln.bgEffect = 'white_fade'; ln.bgEffectTime = 240; ln.waitType = 'time'; ln.waitTime = 450; }
    else if (act === 'bgm_fade') { ln.bgm = 'fade_out'; ln.bgmFadeTime = 800; }
    else if (act === 'flash_shock') { ln.bgEffect = 'white_fade'; ln.bgEffectTime = 260; }
  }), { syncStage: false });
  syncLoadDocToSpineStage(false);
  syncGotoLineToSpineStage(Boolean(act));
  if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
    window.SCWorkflow.recompileSceneQuietly(100);
  }
  return true;
}

function syncDockLeftStatusOnly(i, rowObj) {
  const leftCard = $('#dockCardLeft');
  if (!leftCard || !rowObj || !rowObj.line) return;
  const l = rowObj.line, m = l._meta || {}, k = kindOf(l), rowKey = rowObj.key;
  const isMonoRow = k === 'dialogue' && isInnerMonologueRow(l);
  const canTtsCur = k === 'dialogue' && Boolean(l.speaker && !isProducer(l.speaker) && (l.charLabel || charOfLine(l)));
  const isTtsBusy = S.ttsBusyKey === rowKey;
  const isRowPlaying = Boolean(curRealAudio && curRealAudioKey === rowKey && !curRealAudio.paused);
  const isVoiceStale = Boolean(l.voice && m.voiceStale);
  const badge = $('#dockVoiceBadge', leftCard);
  if (badge) {
    badge.hidden = !l.voice;
    if (l.voice) {
      badge.textContent = isVoiceStale ? '⚠️ 词已改·待重配' : '🎙 已配音';
      badge.title = l.voice;
    }
  }
  const monoBtn = $('#btnDockMonologue', leftCard);
  if (monoBtn) monoBtn.classList.toggle('on', isMonoRow);
  const ttsBtn = $('#btnQuickInspTts', leftCard);
  if (ttsBtn) {
    ttsBtn.disabled = Boolean(isTtsBusy || (k !== 'dialogue' && !l.voice));
    ttsBtn.classList.toggle('on', isRowPlaying);
    ttsBtn.classList.toggle('stale', isVoiceStale);
    ttsBtn.textContent = isTtsBusy ? '⏳ 合成中…' : (isRowPlaying ? '⏹ 停止试听' : '🎙 合成/试听配音');
  }
  const regenBtn = $('#btnQuickInspTtsRegen', leftCard);
  if (regenBtn) regenBtn.disabled = Boolean(!(l.voice && canTtsCur) || isTtsBusy);
  const holdVal = $('#dockHoldVal', leftCard);
  if (holdVal) holdVal.textContent = `${m.holdMs || 0}ms`;
}

function renderStageDirectorDock(opts = {}) {
  const dock = $('#stageDirectorDock');
  if (!dock) return;
  const leftCard = $('#dockCardLeft', dock);
  const rightCard = $('#dockCardRight', dock);
  if (!S.doc || !Array.isArray(S.doc.rows) || !S.doc.rows.length) {
    if (leftCard) leftCard.innerHTML = '<div class="muted" style="font-size:12px;padding:8px 0">当前幕暂无台本行，可在第 2 步添加或生成台词。</div>';
    const tb = $('#dockTargetCharBadge', dock);
    if (tb) tb.textContent = '—';
    return;
  }
  const i = curIdx(), rowObj = S.doc.rows[i], l = rowObj.line, m = l._meta || {}, k = kindOf(l);
  const rowKey = rowObj.key;
  const st = stageAt(i);
  const lb = (k === 'dialogue' ? charOfLine(l) : l.charLabel) || S.selChar || (st.cast[0] || Object.keys(S.doc.pack.characters || {})[0] || null);
  const ci = lb ? charInfo(lb) : null;
  S.dockTextMode = S.dockTextMode === 'tts' ? 'tts' : 'text';
  const effectiveTMode = (k === 'dialogue' && S.dockTextMode === 'tts') ? 'tts' : 'text';
  const activeEl = typeof document !== 'undefined' ? document.activeElement : null;

  if (leftCard) {
    const isEditingLeft = !(opts && opts.forceLeft) && Boolean(
      leftCard.dataset.rowKey === rowKey &&
      leftCard.dataset.textMode === effectiveTMode &&
      (S.dockComposing || (activeEl && leftCard.contains(activeEl) && activeEl.matches && activeEl.matches('textarea, input, select')))
    );
    if (isEditingLeft) {
      syncDockLeftStatusOnly(i, rowObj);
    } else {
      leftCard.dataset.rowKey = rowKey;
      leftCard.dataset.textMode = effectiveTMode;
      const isMonoRow = k === 'dialogue' && isInnerMonologueRow(l);
      const canTtsCur = k === 'dialogue' && Boolean(l.speaker && !isProducer(l.speaker) && (l.charLabel || charOfLine(l)));
      const isTtsBusy = S.ttsBusyKey === rowKey;
      const isRowPlaying = Boolean(curRealAudio && curRealAudioKey === rowKey && !curRealAudio.paused);
      const isVoiceStale = Boolean(l.voice && m.voiceStale);
      const quickLineVal = k === 'dialogue'
        ? (effectiveTMode === 'tts' ? (m.ttsText ?? '') : (l.text || m.zh || ''))
        : (k === 'select' ? (l.select || m.selectZh || '') : (k === 'label' ? (l.label || '') : (m.note || '')));
      const quickPlaceholder = k === 'dialogue'
        ? (effectiveTMode === 'tts'
          ? `未覆写则默认按台词发音：${l.text || ''}`
          : '直接修改当前句台词，实时同步舞台与字幕…')
        : (k === 'select' ? '修改分支选项文本…' : (k === 'label' ? '修改跳转标签名…' : '当前为演出行，可填写分镜备注…'));
      const ttsTip = isRowPlaying
        ? '点击停止当前配音试听'
        : (l.voice && !isVoiceStale
          ? `已有语音 (${l.voice})，点击立即试听；按住 Shift 点击或点右侧 ↻ 重新合成`
          : '调用当前 TTS 接口 (synthTtsTake) 合成并试听本句配音');
      const dockTakePillsHtml = (k === 'dialogue' && Array.isArray(m.takes) && m.takes.length >= 2)
        ? `<span class="tts-take-pills dock-take-pills">${m.takes.slice(0, 4).map((tk, tIdx) => {
            const isCurTake = m.takeSelected ? (m.takeSelected === tk.id) : (l.voice === tk.voice);
            return `<button type="button" data-act="tts-pick-take" data-take-id="${esc(tk.id)}" class="tts-take-pill ${isCurTake ? 'on' : ''}" title="切换并试听第 ${tIdx + 1} 版配音 (${esc(tk.id)})">T${tIdx + 1}</button>`;
          }).join('')}</span>`
        : '';
      const nonDlgSpkLabel = { select: '🔀 分支选项', label: '🏷 跳转标签', direction: '🎬 分镜调度', cue: '🎬 走位动作拍' }[k] || '🎬 演出行';

      leftCard.innerHTML = `
        <div class="dock-card-head">
          <span class="dock-card-title">💬 当前句台词 · 读音 · 配音</span>
          <span class="act-block-badge" id="dockVoiceBadge" ${l.voice ? '' : 'hidden'} title="${esc(l.voice || '')}">${isVoiceStale ? '⚠️ 词已改·待重配' : '🎙 已配音'}</span>
        </div>
        <div class="dock-row dock-top-row">
          <span class="dock-line-idx">#${String(i + 1).padStart(2, '0')}</span>
          <select class="spk dock-spk-select ${(k !== 'dialogue' || isProducer(l.speaker) || !l.speaker) ? 'p' : ''}" id="dockSpeakerSelect" style="--c:${k === 'dialogue' ? speakerColor(l) : 'var(--ink3)'}" ${k !== 'dialogue' ? 'disabled' : ''} title="当前句说话人">
            ${k === 'dialogue' ? speakerOptions(l) : `<option value="">${esc(nonDlgSpkLabel)}</option>`}
          </select>
          <div class="seg small dock-text-seg" id="dockTextModeSeg" title="切换编辑显示台词或 TTS 读音覆写">
            <button type="button" data-dock-tmode="text" class="${effectiveTMode === 'text' ? 'on' : ''}">💬 台词</button>
            <button type="button" data-dock-tmode="tts" class="${effectiveTMode === 'tts' ? 'on' : ''}" ${k !== 'dialogue' ? 'disabled' : ''}>🔤 TTS读音</button>
          </div>
          <button type="button" class="chip-btn ${isMonoRow ? 'on' : ''}" id="btnDockMonologue" ${k !== 'dialogue' ? 'disabled' : ''} title="切换（）内心独白（角色舞台闭口不张嘴）">💭 闭口独白</button>
          <div class="dock-row-ops">
            <button type="button" class="ibtn sm" data-dock-op="up" ${i <= 0 ? 'disabled' : ''} title="上移当前行">↑</button>
            <button type="button" class="ibtn sm" data-dock-op="down" ${i >= S.doc.rows.length - 1 ? 'disabled' : ''} title="下移当前行">↓</button>
            <button type="button" class="ibtn sm" data-dock-op="dup" ${k === 'cue' ? 'disabled' : ''} title="复制当前行">⧉</button>
            <button type="button" class="ibtn sm" data-dock-op="del" ${S.doc.rows.length <= 1 ? 'disabled' : ''} title="删除当前行">🗑</button>
          </div>
        </div>
        <textarea id="inspQuickLineText" class="insp-quick-textarea dock-textarea" rows="2" placeholder="${esc(quickPlaceholder)}">${esc(quickLineVal)}</textarea>
        <div class="dock-row dock-audio-row">
          <button type="button" class="chip-btn prismy ${isRowPlaying ? 'on' : ''} ${isVoiceStale ? 'stale' : ''}" id="btnQuickInspTts" ${(isTtsBusy || (k !== 'dialogue' && !l.voice)) ? 'disabled' : ''} title="${esc(ttsTip)}">${isTtsBusy ? '⏳ 合成中…' : (isRowPlaying ? '⏹ 停止试听' : '🎙 合成/试听配音')}</button>
          <button type="button" class="chip-btn" id="btnQuickInspTtsRegen" ${(!(l.voice && canTtsCur) || isTtsBusy) ? 'disabled' : ''} title="强制重新调用 synthTtsTake 合成新配音">↻ 重配</button>
          ${dockTakePillsHtml}
          <div class="dock-hold-wrap" title="句尾停顿时长 holdMs (0~3000ms)">
            <span class="dock-hold-lbl">⏸ <b class="mono" id="dockHoldVal">${m.holdMs || 0}ms</b></span>
            <input type="range" id="dockHoldMs" min="0" max="3000" step="50" value="${m.holdMs || 0}" ${k !== 'dialogue' ? 'disabled' : ''}>
            <button type="button" class="chip-btn" id="btnDockHoldAuto" ${k !== 'dialogue' ? 'disabled' : ''} title="省略号/重拍 800ms，普通 300ms">智能</button>
          </div>
        </div>`;
    }
  }

  if (rightCard) {
    const targetBadge = $('#dockTargetCharBadge', rightCard);
    if (targetBadge) {
      targetBadge.textContent = ci ? (ci.nameZh || ci.name) : (k === 'dialogue' ? (l.speaker || '旁白') : '舞台调度');
      targetBadge.title = lb || '';
    }
    const emoPresets = (window.StudioWorkflow && window.StudioWorkflow.W && window.StudioWorkflow.W.emotionPresets) || null;
    $$('#emoQuickBar .emo-chip', rightCard).forEach(ch => {
      const ek = ch.dataset.emo;
      let isEmoOn = false;
      if (emoPresets && emoPresets[ek]) {
        const pr = emoPresets[ek];
        isEmoOn = Boolean(
          (pr.faceCandidates && pr.faceCandidates[0] && l.charAnim2 === pr.faceCandidates[0] && (!pr.bodyCandidates || !pr.bodyCandidates[0] || l.charAnim1 === pr.bodyCandidates[0])) ||
          (m.surfaceEmotion && pr.surfaceEmotion === m.surfaceEmotion && pr.faceCandidates && pr.faceCandidates.includes(l.charAnim2))
        );
      }
      ch.classList.toggle('on', isEmoOn);
    });
    const isBgmStopOn = l.bgm === 'off';
    const isZoomCloseOn = Boolean((l.charScale && Number(l.charScale) > 1.06) || m.stageAction === 'lean_close');
    const isShockShakeOn = Boolean(l.bgEffect === 'white_fade' || m.stageAction === 'flash_shock');
    const btnBgm = $('#btnQuickBgmStop', rightCard);
    if (btnBgm) btnBgm.classList.toggle('on', isBgmStopOn);
    const btnZoom = $('#btnQuickZoomClose', rightCard);
    if (btnZoom) btnZoom.classList.toggle('on', isZoomCloseOn);
    const btnShock = $('#btnQuickShockShake', rightCard);
    if (btnShock) btnShock.classList.toggle('on', isShockShakeOn);
    const actSel = $('#dockStageActionSelect', rightCard);
    if (actSel && activeEl !== actSel) {
      const wantAct = m.stageAction || '';
      actSel.value = Array.from(actSel.options).some(o => o.value === wantAct) ? wantAct : '';
    }
  }
}

function bindStageDirectorDock() {
  const dock = $('#stageDirectorDock');
  if (!dock || dock.dataset.boundStageDock === '1') return;
  dock.dataset.boundStageDock = '1';

  dock.addEventListener('compositionstart', () => { S.dockComposing = true; });
  dock.addEventListener('compositionend', e => {
    S.dockComposing = false;
    if (e.target && e.target.id === 'inspQuickLineText') {
      e.target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  dock.addEventListener('click', ev => {
    if (!S.doc || !Array.isArray(S.doc.rows) || !S.doc.rows.length) return;
    const i = curIdx(), rowObj = S.doc.rows[i], l = rowObj.line, k = kindOf(l), rowKey = rowObj.key;
    const st = stageAt(i);
    const lb = (k === 'dialogue' ? charOfLine(l) : l.charLabel) || S.selChar || (st.cast[0] || Object.keys(S.doc.pack.characters || {})[0] || null);

    const tmodeBtn = ev.target.closest('[data-dock-tmode]');
    if (tmodeBtn) {
      if (tmodeBtn.disabled) return;
      if (TX) commit();
      S.dockTextMode = tmodeBtn.dataset.dockTmode === 'tts' ? 'tts' : 'text';
      renderStageDirectorDock({ forceLeft: true });
      const ta = $('#inspQuickLineText', dock);
      if (ta) ta.focus();
      return;
    }

    if (ev.target.closest('#btnDockMonologue')) {
      toggleRowInnerMonologue(i);
      return;
    }

    const opBtn = ev.target.closest('[data-dock-op]');
    if (opBtn) {
      if (opBtn.disabled) return;
      const op = opBtn.dataset.dockOp;
      if (op === 'up') moveRow(i, -1);
      else if (op === 'down') moveRow(i, 1);
      else if (op === 'dup') dupRow(i);
      else if (op === 'del') delRow(i);
      return;
    }

    const takeBtn = ev.target.closest('[data-act="tts-pick-take"]');
    if (takeBtn) {
      const takeId = takeBtn.dataset.takeId;
      if (!takeId) return;
      let pickedVoice = '';
      exec(`切换配音版本 ${takeId}`, () => mutRow(i, ln => {
        const mm = meta(ln);
        const tk = Array.isArray(mm.takes) ? mm.takes.find(x => x && x.id === takeId) : null;
        if (!tk || !tk.voice) return;
        mm.takeSelected = tk.id;
        syncVoiceTimingOnLine(ln, {
          voice: tk.voice,
          durationMs: tk.durationMs,
          lipSegments: tk['x-lipSegments'] || tk.lipSegments
        });
        if (tk.synthSig) {
          mm.voiceSynthSig = tk.synthSig;
        } else if (tk.text !== undefined) {
          const lbTk = ln.charLabel || charOfLine(ln) || ln.speaker || '';
          const monoTk = isInnerMonologueRow(ln) ? 'mono' : 'aloud';
          mm.voiceSynthSig = `${lbTk}|${monoTk}|${String(tk.text || '').trim()}`;
        }
        refreshVoiceStaleFlag(ln);
        pickedVoice = tk.voice;
      }));
      syncLoadDocToSpineStage(false);
      if (pickedVoice) playRealAudio(pickedVoice, null, { rowKey });
      return;
    }

    if (ev.target.closest('#btnQuickInspTts')) {
      if (k !== 'dialogue' && !l.voice) {
        toast('请先选中一句偶像台词再合成或试听配音', 'warn');
        return;
      }
      if (curRealAudio && curRealAudioKey === rowKey && !curRealAudio.paused) {
        stopRealAudio();
        renderStageDirectorDock();
        renderInspector();
        return;
      }
      const staleNow = Boolean(l && l.voice && l._meta && l._meta.voiceStale);
      if (l && l.voice && !staleNow && !ev.shiftKey) {
        playRealAudio(l.voice, () => synthTtsTake(i, { force: true }), { rowKey });
      } else {
        synthTtsTake(i, { force: Boolean(staleNow || ev.shiftKey) });
      }
      return;
    }

    if (ev.target.closest('#btnQuickInspTtsRegen')) {
      synthTtsTake(i, { force: true });
      return;
    }

    if (ev.target.closest('#btnDockHoldAuto')) {
      if (k !== 'dialogue') return;
      exec('智能停顿', () => mutRow(i, ln => {
        meta(ln).holdMs = /……|…$|！？$/.test(ln.text || '') ? 800 : 300;
      }));
      return;
    }

    if (ev.target.closest('#btnQuickBgmStop')) {
      if (l && l.bgm === 'off') {
        clearRowBgmControl(i);
        renderStageDirectorDock();
        renderInspector();
      } else {
        stopBgm();
        exec(`第 ${i + 1} 行 BGM 骤停`, () => mutRow(i, ln => {
          setK(ln, 'bgm', 'off');
          delete ln.bgmFadeTime;
          meta(ln).stageAction = 'bgm_stop';
        }));
        syncLoadDocToSpineStage(false);
        syncGotoLineToSpineStage(false);
        toast('🔇 已设为「此句 BGM 骤停」');
      }
      return;
    }

    if (ev.target.closest('#btnQuickZoomClose')) {
      const wasOn = Boolean(l && ((l.charScale && Number(l.charScale) > 1.06) || (l._meta && l._meta.stageAction === 'lean_close')));
      if (wasOn) {
        exec(`恢复第 ${i + 1} 行标准景别`, () => mutRow(i, ln => {
          setK(ln, 'charScale', 1);
          delete ln.charEffect;
          if (ln._meta && ln._meta.stageAction === 'lean_close') delete ln._meta.stageAction;
        }), { syncStage: false });
        syncLoadDocToSpineStage(false);
        syncGotoLineToSpineStage(false);
        if (lb) previewPoseOnSpineStage({ charLabel: lb, scale: 1, syncDoc: false });
        toast('↺ 已恢复标准景别 (×1.00)');
      } else {
        exec(`第 ${i + 1} 行破防微推近`, () => mutRow(i, ln => {
          if (lb && !ln.charLabel) setK(ln, 'charLabel', lb);
          setK(ln, 'charScale', 1.14);
          setK(ln, 'charEffect', { type: 'from', scale: 1, y: 14, time: 300 });
          meta(ln).stageAction = 'lean_close';
        }), { syncStage: false });
        syncLoadDocToSpineStage(false);
        syncGotoLineToSpineStage(true);
        if (lb) previewPoseOnSpineStage({ charLabel: lb, scale: 1.14, syncDoc: false });
        toast('🔍 已套用「破防微推近」(×1.14)');
      }
      return;
    }

    if (ev.target.closest('#btnQuickShockShake')) {
      const wasOn = Boolean(l && (l.bgEffect === 'white_fade' || (l._meta && l._meta.stageAction === 'flash_shock')));
      if (wasOn) {
        exec(`取消第 ${i + 1} 行震惊微震`, () => mutRow(i, ln => {
          if (ln.bgEffect === 'white_fade') { delete ln.bgEffect; delete ln.bgEffectTime; }
          delete ln.charEffect;
          if (ln._meta && ln._meta.stageAction === 'flash_shock') delete ln._meta.stageAction;
        }), { syncStage: false });
        syncLoadDocToSpineStage(false);
        syncGotoLineToSpineStage(false);
        toast('↺ 已取消震惊微震');
      } else {
        exec(`第 ${i + 1} 行震惊微震`, () => mutRow(i, ln => {
          if (lb && !ln.charLabel) setK(ln, 'charLabel', lb);
          setK(ln, 'bgEffect', 'white_fade');
          setK(ln, 'bgEffectTime', 220);
          if (lb) {
            setK(ln, 'charEffect', { type: 'from', x: -16, y: 10, time: 180 });
            if (!ln.charAnim1 || ln.charAnim1 === 'wait' || ln.charAnim1 === 'wait1') setK(ln, 'charAnim1', 'shock');
            if (!ln.charAnim2 || ln.charAnim2 === 'face_normal') setK(ln, 'charAnim2', 'face_shock');
          }
          meta(ln).stageAction = 'flash_shock';
        }), { syncStage: false });
        syncLoadDocToSpineStage(false);
        syncGotoLineToSpineStage(true);
        if (lb) {
          const curX = Math.round((st.chars[lb] && st.chars[lb].x) || 568);
          const updLn = S.doc.rows[i].line;
          previewPoseOnSpineStage({
            charLabel: lb,
            charAnim1: updLn.charAnim1 || 'shock',
            charAnim2: updLn.charAnim2 || 'face_shock',
            moveFromX: curX - 16,
            moveToX: curX,
            moveTime: 180,
            syncDoc: false
          });
        }
        toast('📳 已套用「震惊微震」演出');
      }
      return;
    }

    if (ev.target.closest('#btnDockInsertCue')) {
      insertCueAfterRow(curIdx());
      return;
    }
  });

  dock.addEventListener('input', ev => {
    if (!S.doc || !Array.isArray(S.doc.rows) || !S.doc.rows.length) return;
    const t = ev.target;
    if (t.id === 'dockHoldMs') {
      const hv = $('#dockHoldVal', dock);
      if (hv) hv.textContent = t.value + 'ms';
      return;
    }
    if (t.id !== 'inspQuickLineText') return;
    if (S.dockComposing) return;
    const i = curIdx(), rowObj = S.doc.rows[i], k = kindOf(rowObj.line), rowKey = rowObj.key;
    const val = t.value;
    const isTtsEdit = k === 'dialogue' && S.dockTextMode === 'tts';
    if (!TX) begin(isTtsEdit ? `快捷编辑第 ${i + 1} 行 TTS 读音` : `快捷编辑第 ${i + 1} 行文本`);
    mutRow(i, ln => {
      if (k === 'dialogue') {
        if (isTtsEdit) {
          if (val) meta(ln).ttsText = val;
          else if (ln._meta) delete ln._meta.ttsText;
          refreshVoiceStaleFlag(ln);
        } else {
          const prevTxt = ln.text || '';
          setK(ln, 'text', val);
          if (ln._meta && ln._meta.zh !== undefined && (!prevTxt || ln._meta.zh === prevTxt)) {
            if (val) ln._meta.zh = val;
            else delete ln._meta.zh;
          }
          const mm = meta(ln);
          if (isMonologueText(ln.text, mm.zh)) {
            ln.charLipAnim = 'lip_wait_s';
            ln.lip = 'lip_wait_s';
            mm['x-innerMonologue'] = true;
          } else if (mm['x-innerMonologue']) {
            delete mm['x-innerMonologue'];
            if (isClosedOrBrokenLipToken(ln.charLipAnim)) {
              ln.charLipAnim = 'lip_smile';
            }
            if (isClosedOrBrokenLipToken(ln.lip) || ln.lip === 'lip_wait') {
              delete ln.lip;
            }
          }
          refreshVoiceStaleFlag(ln);
        }
      } else if (k === 'select') {
        setK(ln, 'select', val);
      } else if (k === 'label') {
        setK(ln, 'label', val);
      } else {
        if (val) meta(ln).note = val;
        else if (ln._meta) delete ln._meta.note;
      }
    });
    replaceRow(rowKey);
    renderStage();
    renderOocSummary();
    syncDockLeftStatusOnly(i, rowObj);
    syncGotoLineToSpineStage(false);
  });

  dock.addEventListener('change', ev => {
    if (!S.doc || !Array.isArray(S.doc.rows) || !S.doc.rows.length) return;
    const t = ev.target;
    if (t.id === 'dockSpeakerSelect') {
      const i = curIdx();
      if (kindOf(S.doc.rows[i].line) === 'dialogue') setSpeaker(i, t.value);
      return;
    }
    if (t.id === 'dockHoldMs') {
      const i = curIdx();
      exec('设置停顿 holdMs', () => mutRow(i, ln => {
        const v = +t.value;
        if (v) meta(ln).holdMs = v;
        else if (ln._meta) delete ln._meta.holdMs;
      }));
      return;
    }
    if (t.id === 'dockStageActionSelect') {
      applyStageActionToRow(curIdx(), t.value);
      return;
    }
  });

  dock.addEventListener('focusout', ev => {
    if (ev.target && ev.target.id === 'inspQuickLineText') {
      S.dockComposing = false;
      if (TX) {
        commit();
        renderTimeline();
        renderInspector();
        syncLoadDocToSpineStage(false);
      }
    }
  });
}

/* ============================== 检查器 ============================== */
function renderInspector() {
  const body = $('#inspBody');
  if (!body || !S.doc || !Array.isArray(S.doc.rows) || !S.doc.rows.length) return;
  const activeTabVisual = S.tab === 'audio' ? 'bg' : S.tab;
  $$('#inspTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === activeTabVisual || b.dataset.tab === S.tab));
  const keepScroll = body.dataset.tab === S.tab ? body.scrollTop : 0;
  // 源码编辑器聚焦时不重绘整个 tab（避免打断输入）
  if (S.tab === 'audio' && document.activeElement && document.activeElement.classList.contains('src-editor')) return;
  body.dataset.tab = S.tab;
  const tabMap = { acting: tabActing, blocking: tabBlocking, voice: tabVoice, bg: tabBg, audio: tabAudio, director: renderDirectorToContainer };
  (tabMap[S.tab] || tabActing)(body);
  body.scrollTop = keepScroll;
}
function lineHeader(i, l) {
  const k = kindOf(l), lb = charOfLine(l);
  const who = k === 'dialogue' ? (l.speaker || '旁白') : lb ? (charInfo(lb).nameZh || charInfo(lb).name) : '';
  return `<div class="row-flex" style="margin-bottom:8px" title="行 ID: ${esc(l.id ?? (l._meta || {}).uid ?? '')}"><span class="kicker">第 ${i + 1} 行 · ${({ dialogue: '台词', select: '选项', label: '标签', direction: '演出', cue: '动作拍' })[k] || '演出'}</span>${who ? `<b>${esc(who)}</b>` : ''}</div>`;
}

/* ---------- Tab 1：演技与神态检查器（1.身体动作[上] -> 2.面部表情与视线[中] -> 3.2D站位与移动[下] -> 折叠潜台词） ---------- */
function applyMotionAndFaceToCurrentSelection(lb, { anim1, anim2, anim3, anim4, lip, labelHint }) {
  const i = curIdx();
  const t = charTargetRow(lb);
  const sub = getLineSubtimelineData(t);
  const kfIdx = clamp(S.selMotionKf || 0, 0, Math.max(0, sub.motionTrack.length - 1));
  const targetLine = (S.doc && S.doc.rows && S.doc.rows[t] && S.doc.rows[t].line) || null;
  const stCur = stageAt(t);
  const validSet = lb ? getOutfitAnimSetForChar(lb, targetLine, stCur && stCur.chars && stCur.chars[lb]) : null;
  const sAnim1 = anim1 !== undefined ? (anim1 ? resolveClientValidClip(validSet, anim1, 'body') : '') : undefined;
  const sAnim2 = anim2 !== undefined ? (anim2 ? resolveClientValidClip(validSet, anim2, 'face') : '') : undefined;
  const sAnim3 = anim3 !== undefined ? (anim3 ? resolveClientValidClip(validSet, anim3, 'head') : '') : undefined;
  const sAnim4 = anim4 !== undefined ? (anim4 ? resolveClientValidClip(validSet, anim4, 'eye') : '') : undefined;
  const sLip = lip !== undefined ? (lip ? resolveClientValidClip(validSet, lip, 'lip') : '') : undefined;

  exec(labelHint || '更新动作与表情', () => mutRow(t, l => {
    if (!l.charLabel) setK(l, 'charLabel', lb);
    const mm = meta(l);
    if (Array.isArray(mm.motionTrack) && mm.motionTrack.length > 0 && kfIdx < mm.motionTrack.length) {
      const kf = mm.motionTrack[kfIdx];
      if (sAnim1 !== undefined) kf.anim1 = sAnim1;
      if (sAnim2 !== undefined) kf.anim2 = sAnim2;
      if (sAnim3 !== undefined) { if (sAnim3) kf.anim3 = sAnim3; else delete kf.anim3; }
      if (sAnim4 !== undefined) { if (sAnim4) kf.anim4 = sAnim4; else delete kf.anim4; }
      kf.charLabel = lb;
      kf.label = `${getMotionNameZh(kf.anim1 || 'wait1')} + ${getFaceNameZh(kf.anim2 || 'face_normal')}${kf.anim3 ? ' · ' + getMotionNameZh(kf.anim3) : ''}`;
    }
    if (kfIdx === 0) {
      if (sAnim1 !== undefined) setK(l, 'charAnim1', sAnim1);
      if (sAnim2 !== undefined) setK(l, 'charAnim2', sAnim2);
      if (sAnim3 !== undefined) { if (sAnim3) setK(l, 'charAnim3', sAnim3); else delete l.charAnim3; }
      if (sAnim4 !== undefined) { if (sAnim4) setK(l, 'charAnim4', sAnim4); else delete l.charAnim4; }
      if (sLip !== undefined) setK(l, 'charLipAnim', sLip);
    }
  }), { syncStage: false });

  const updatedSub = getLineSubtimelineData(t);
  const activeKf = updatedSub.motionTrack[kfIdx] || updatedSub.motionTrack[0] || {};
  previewPoseOnSpineStage({
    charLabel: lb,
    charAnim1: sAnim1 !== undefined ? sAnim1 : activeKf.anim1,
    charAnim2: sAnim2 !== undefined ? sAnim2 : activeKf.anim2,
    charAnim3: sAnim3 !== undefined ? sAnim3 : activeKf.anim3,
    charAnim4: sAnim4 !== undefined ? sAnim4 : activeKf.anim4,
    charLipAnim: sLip
  });
}

function tabActing(body) {
  const i = curIdx(), rowObj = S.doc.rows[i], l = rowObj.line, m = l._meta || {}, k = kindOf(l);
  const st = stageAt(i);
  const lb = (k === 'dialogue' ? charOfLine(l) : l.charLabel) || S.selChar || (st.cast[0] || Object.keys(S.doc.pack.characters || {})[0] || null);
  const ci = lb ? charInfo(lb) : null;
  let html = lineHeader(i, l) + `<div class="act-stack">`;

  if (lb) {
    const sc = st.chars[lb] || {};
    const sub = getLineSubtimelineData(i);
    const kfIdx = clamp(S.selMotionKf || 0, 0, Math.max(0, sub.motionTrack.length - 1));
    const curKf = sub.motionTrack[kfIdx] || { offsetMs: 0, anim1: sc.anim1 || 'wait1', anim2: 'face_' + (sc.face || 'normal'), anim3: l.charAnim3 || '', anim4: sc.eye || 'eye_front' };
    const curAnim1 = curKf.anim1 || sc.anim1 || 'wait1';
    const curAnim2 = curKf.anim2 || ('face_' + (sc.face || 'normal'));
    const curAnim3 = curKf.anim3 !== undefined ? curKf.anim3 : (l.charAnim3 || '');
    const curAnim4 = curKf.anim4 !== undefined ? curKf.anim4 : (sc.eye || 'eye_front');

    const cats = M.motionCategories || [];
    const activeCat = S.actCat || 'recommend';
    const catalog = M.motionPresetCatalog || [];
    const charCards = M.actionCards[lb] || [];
    const strata = M.emotionStrata || [];
    const faces = M.faceExpressionCatalog || [];
    const gazes = M.gazeCatalog || [];
    const wl = M.skeletonWhitelist || { anim1: [], anim2: [], anim3: [], anim4: [], lip: [] };

    // 组装当前分类下的动作卡片 HTML（隐藏英文骨骼代号进 title）
    let motionCardsHtml = '';
    if (activeCat === 'recommend') {
      const charCardsHtml = charCards.map((c, n) => {
        const isOn = curAnim1 === c.anim1 && curAnim2 === 'face_' + c.face;
        return `<button type="button" class="motion-preset-card ${isOn ? 'on' : ''}" data-char-card="${n}" title="点击立即在真 Spine 舞台演示：${esc(c.label)} · 骨骼代号：${esc(c.anim1)} + face_${esc(c.face)}">
          <div class="mpc-top"><span class="mpc-name">⭐ ${esc(c.label)}</span></div>
          <div class="mpc-hint">${esc(ci.nameZh || ci.name)}专属高频 · 原作出现 ${c.freq} 次</div>
        </button>`;
      }).join('');
      const strataCardsHtml = strata.map((s, idxS) => {
        const isOn = curAnim1 === s.anim1 && curAnim2 === 'face_' + s.face;
        return `<button type="button" class="motion-preset-card ${isOn ? 'on' : ''}" data-strata="${idxS}" title="${esc(s.desc)} · 骨骼代号：${esc(s.anim1)} + face_${esc(s.face)}">
          <div class="mpc-top"><span class="mpc-name">${s.icon} ${esc(s.label)}</span></div>
          <div class="mpc-hint">${esc(s.desc)}</div>
        </button>`;
      }).join('');
      motionCardsHtml = charCardsHtml + strataCardsHtml;
    } else {
      const catItems = catalog.filter(p => p.cat === activeCat);
      motionCardsHtml = catItems.map(p => {
        const isOn = p.slot === 'anim3' ? (curAnim3 === p.code) : (curAnim1 === p.code);
        return `<button type="button" class="motion-preset-card ${isOn ? 'on' : ''}" data-motion-preset="${esc(p.id)}" title="点击演示：${esc(p.nameZh)} · 骨骼代号：${esc(p.code)}">
          <div class="mpc-top"><span class="mpc-name">${p.icon} ${esc(p.nameZh)}</span></div>
          <div class="mpc-hint">${esc(p.sceneHint)}</div>
        </button>`;
      }).join('');
      if (activeCat === 'head' && curAnim3) {
        motionCardsHtml += `<button type="button" class="motion-preset-card" data-clear-anim3="1" title="清除 charAnim3 头部叠加动作">
          <div class="mpc-top"><span class="mpc-name">↺ 清除头部叠加动作</span></div>
          <div class="mpc-hint">恢复仅播放身体主动作 (${esc(getMotionNameZh(curAnim1))})</div>
        </button>`;
      }
    }

    const castTabsHtml = st.cast.length > 1
      ? `<div class="row-flex" style="gap:4px"><span class="muted" style="font-size:11.5px">目标：</span>${st.cast.map(cLb => `<button type="button" class="chip ${cLb === lb ? 'on' : ''}" data-pick-char="${esc(cLb)}" title="${esc(cLb)}">${esc(charInfo(cLb).nameZh || charInfo(cLb).name)}</button>`).join('')}</div>`
      : `<span class="act-block-badge" title="${esc(lb)}">${esc(ci.nameZh || ci.name)}</span>`;

    // 02 角色立绘换装 & 折叠发型饰品微调
    const outfits = getOutfitsForChar(lb);
    const curOutfit = getCurrentOutfitForChar(lb, l, sc);
    const activeOutfitGroup = S.outfitCat || 'all';
    const outfitGroups = [
      { id: 'all', label: `全部 (${outfits.length})` },
      { id: 'casual', label: '🏫 私服' },
      { id: 'summer', label: '🏖️ 夏装' },
      { id: 'jersey', label: '🏃 训练服' },
      { id: 'costume', label: '🎀 打歌服' },
      { id: 'special', label: '✨ 觉醒/UR' },
      { id: 'cb', label: '🧸 Q版' }
    ];
    const filteredOutfits = activeOutfitGroup === 'all'
      ? outfits
      : outfits.filter(o => o.group === activeOutfitGroup || (activeOutfitGroup === 'cb' && o.group === 'chibi'));
    const quickOutfits = filteredOutfits.slice(0, 6);
    const applyAllChecked = S.outfitApplyAll !== false;

    const gazeObj = gazes.find(g => g.code === (curAnim4 || 'eye_front'));
    const gazeZh = gazeObj ? gazeObj.label : '正视';

    html += `
      <!-- 01：👗 整套角色立绘换装 -->
      <div class="act-block" id="actBlockOutfit">
        <div class="act-block-head">
          <div class="act-block-title" title="整套 Spine 立绘换装（头身原画一体匹配）">
            <span>01 角色立绘与穿搭</span>
            <span class="act-block-badge" id="curOutfitBadge" title="立绘路径：${esc(curOutfit.key)}">${esc(curOutfit.shortLabel || curOutfit.label)}</span>
          </div>
          <div class="row-flex" style="gap:6px;flex-wrap:wrap">
            <button type="button" class="chip-btn" id="btnCopyPrevSceneOutfits" title="从上一幕复制同角色服装到本幕">👗 沿用上幕</button>
            <label class="toggle" style="font-size:11.5px" title="勾选后同步替换本幕中该角色全部台词的服装"><input type="checkbox" id="chkOutfitAllRows" ${applyAllChecked ? 'checked' : ''}><span class="tr"></span>整幕同步</label>
            ${castTabsHtml}
          </div>
        </div>
        <div class="act-cat-tabs" id="outfitGroupTabs">
          ${outfitGroups.map(g => `<button type="button" class="act-cat-btn ${activeOutfitGroup === g.id ? 'on' : ''}" data-outfit-group="${esc(g.id)}">${esc(g.label)}</button>`).join('')}
          <select id="actOutfitSelect" style="margin-left:auto;min-width:170px;max-width:260px;font-size:12px" title="从真实 Spine 服装库中选择任意服装 (${outfits.length} 套可用)">
            ${outfits.map(o => `<option value="${esc(o.key)}" ${o.key === curOutfit.key ? 'selected' : ''} title="${esc(o.charType)}/${esc(o.charCategory)}/${esc(o.charId)}">${esc(o.shortLabel || o.label)}</option>`).join('')}
          </select>
        </div>
        <div class="outfit-quick-grid">
          ${quickOutfits.map(o => {
            const isOn = o.key === curOutfit.key;
            return `<button type="button" class="outfit-chip ${isOn ? 'on' : ''}" data-outfit-key="${esc(o.key)}" title="点击实时换装：${esc(o.label)} · 路径：${esc(o.charType)}/${esc(o.charCategory)}/${esc(o.charId)}">
              <span>${esc(o.shortLabel || o.label)}</span>
            </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 02：😊 面部表情与视线方向 -->
      <div class="act-block" id="actBlockFace">
        <div class="act-block-head">
          <div class="act-block-title" title="面部表情与眼球视线 (charAnim2 / charAnim4)">
            <span>02 面部表情与眼神</span>
            <span class="act-block-badge" title="原始代号：${esc(curAnim2)} · ${esc(curAnim4 || 'eye_front')}">${esc(getFaceNameZh(curAnim2))} · ${esc(gazeZh)}</span>
          </div>
          <div class="gaze-btn-bar">
            <span class="muted" style="font-size:11.5px">👀 视线：</span>
            ${gazes.map(g => `<button type="button" class="chip ${(curAnim4 || 'eye_front') === g.code ? 'on' : ''}" data-eye="${esc(g.code)}" title="${esc(g.desc)} (${esc(g.code)})">${esc(g.label)}</button>`).join('')}
          </div>
        </div>
        <div class="face-chip-grid">
          ${faces.map(f => {
            const isOn = curAnim2 === f.code || ('face_' + sc.face) === f.code;
            return `<button type="button" class="face-chip ${isOn ? 'on' : ''}" data-face-code="${esc(f.code)}" title="${esc(f.nameZh)} · 骨骼代号：${esc(f.code)} · ${esc(f.hint)}">
              <span>${f.icon} ${esc(f.nameZh)}</span>
            </button>`;
          }).join('')}
        </div>
      </div>

      <!-- 03：🏃 身体动作与头部动作预设 -->
      <div class="act-block" id="actBlockBody">
        <div class="act-block-head">
          <div class="act-block-title" title="身体主动作与头部叠加动作 (charAnim1 / charAnim3)">
            <span>03 身体与头部动作</span>
            <span class="act-block-badge" title="原始骨骼代号：${esc(curAnim1)}${curAnim3 ? ' + ' + esc(curAnim3) : ''}">${esc(getMotionNameZh(curAnim1))}${curAnim3 ? ` + ${esc(getMotionNameZh(curAnim3))}` : ''} · #${kfIdx + 1}</span>
          </div>
          ${castTabsHtml}
        </div>
        <div class="act-cat-tabs">
          ${cats.map(c => `<button type="button" class="act-cat-btn ${activeCat === c.id ? 'on' : ''}" data-act-cat="${esc(c.id)}" title="${esc(c.desc)}">${esc(c.label)}</button>`).join('')}
        </div>
        <div class="motion-preset-grid">${motionCardsHtml}</div>
        <details class="clean-fold adv-skel-details">
          <summary>🔧 底层骨骼微调（高级 · 69 动作白名单）</summary>
          <div class="skel-tooltip-box">${esc(wl.tooltipZh || '')}</div>
          <div class="grid2" style="gap:6px;margin-top:8px">
            <label class="fld" title="Track 0: charAnim1">身体主动作<select id="skAnim1">${wl.anim1.map(a => `<option value="${a}" ${curAnim1 === a ? 'selected' : ''} title="${a}">${esc(getMotionNameZh(a))} (${a})</option>`).join('')}</select></label>
            <label class="fld" title="Track 1: charAnim2">面部表情<select id="skAnim2">${wl.anim2.map(a => `<option value="${a}" ${curAnim2 === a ? 'selected' : ''} title="${a}">${esc(getFaceNameZh(a))} (${a})</option>`).join('')}</select></label>
            <label class="fld" title="Track 2: charAnim3">头部与肢体叠加<select id="skAnim3">${wl.anim3.map(a => `<option value="${a}" ${curAnim3 === a ? 'selected' : ''} title="${a}">${a ? `${esc(getMotionNameZh(a))} (${a})` : '（无叠加）'}</option>`).join('')}</select></label>
            <label class="fld" title="Track 3: charAnim4">眼球视线方向<select id="skAnim4">${wl.anim4.map(a => `<option value="${a}" ${curAnim4 === a ? 'selected' : ''} title="${a}">${a || 'eye_front (默认正视)'}</option>`).join('')}</select></label>
          </div>
        </details>
      </div>`;
  } else {
    html += `<div class="insp-empty">当前行暂无可调校的登场立绘角色；选中包含角色登场的行即可实时切换穿搭、表情与动作，走位与音效可切至「📐 站位与运镜」。</div>`;
  }

  // 底部折叠区：💬 潜台词与语域标注（供 OOC 与语音合成参考）
  if (k === 'dialogue') {
    const dual = ci && ci.dual;
    html += `<details class="clean-fold adv-subtext" style="margin-top:4px">
      <summary>💬 潜台词、语域与句尾停顿（高级 · OOC 与 TTS 参数）</summary>
      <div class="cols" style="margin-top:8px">
        <div class="card"><div class="sec-title">本音 / 营业</div>
          <div class="row-flex"><div class="switch2"><button data-mode="omote" class="omote ${m.mode === 'omote' ? 'on' : ''}" title="omote">🎀 营业</button><button data-mode="honne" class="honne ${m.mode === 'honne' ? 'on' : ''}" title="honne">🖤 本音</button><button data-mode="" class="none ${!m.mode ? 'on' : ''}">不标注</button></div></div>
          <div class="muted" style="margin-top:6px;font-size:11.5px">${dual ? `${esc(ci.nameZh || ci.name)} 有二面性：营业自称「${esc(ci.firstPerson.omote.ok)}」，本音自称「${esc(ci.firstPerson.honne.ok)}」。` : `⚠ V14：${ci ? esc(ci.nameZh || ci.name) : '该说话人'} 没有二面性，一般不标注。`}</div>
          <div class="sec-title" style="margin-top:12px" title="_meta.era">时期设定</div>
          <div class="chips" data-group="era">${M.eras.map(([v, t]) => `<button class="chip ${(m.era || '') === v ? 'on' : ''}" data-v="${v}">${esc(t)}${v === '' && S.doc.meta.era ? `<small>${esc(ERA[S.doc.meta.era] || S.doc.meta.era)}</small>` : ''}</button>`).join('')}</div>
        </div>
        <div class="card"><div class="sec-title" title="surfaceEmotion">表层情绪</div>
          <div class="chips" data-group="surfaceEmotion">${M.emotions.map(([v, t]) => `<button class="chip ${m.surfaceEmotion === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
          <label class="toggle" style="margin-top:8px"><input type="checkbox" id="syncFace" ${S.syncFace !== false ? 'checked' : ''}><span class="tr"></span>同步切换立绘表情</label>
          <div class="sec-title" style="margin-top:12px" title="innerEmotion">真实潜台词情绪</div>
          <div class="chips" data-group="innerEmotion">${M.emotions.map(([v, t]) => `<button class="chip ${m.innerEmotion === v ? 'on pinkish' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
        </div>
        <div class="card"><div class="sec-title" title="vocalTone">声音语气</div>
          <div class="chips" data-group="vocalTone">${M.tones.map(([v, t]) => `<button class="chip ${m.vocalTone === v ? 'on' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
          <div class="sec-title" style="margin-top:12px" title="holdMs">句尾停顿时长</div>
          <div class="row-flex"><input type="range" id="holdMs" min="0" max="3000" step="50" value="${m.holdMs || 0}" style="flex:1"><b class="mono" id="holdVal">${m.holdMs || 0}ms</b><button class="chip-btn" id="holdAuto" title="……/重拍 800ms，普通 300ms">智能默认</button></div>
        </div>
      </div>
    </details>`;
  }

  html += `</div>`;
  body.innerHTML = html;

  // 角色切换
  $$('[data-pick-char]', body).forEach(b => b.onclick = () => {
    S.selChar = b.dataset.pickChar;
    renderStage(); renderTimeline(); renderStageDirectorDock(); renderInspector();
  });

  // 👗 01：角色整套立绘换装选择器事件绑定
  const chkOutfitAll = $('#chkOutfitAllRows', body);
  if (chkOutfitAll) {
    chkOutfitAll.onchange = () => { S.outfitApplyAll = chkOutfitAll.checked; };
  }
  $$('[data-outfit-group]', body).forEach(b => b.onclick = () => {
    S.outfitCat = b.dataset.outfitGroup;
    renderInspector();
  });
  $$('[data-outfit-key]', body).forEach(b => b.onclick = () => {
    if (!lb) return;
    const key = b.dataset.outfitKey;
    const spec = getOutfitsForChar(lb).find(o => o.key === key);
    if (spec) applyOutfitToCharacter(lb, spec, S.outfitApplyAll !== false);
  });
  const outfitSel = $('#actOutfitSelect', body);
  if (outfitSel) {
    outfitSel.onchange = () => {
      if (!lb) return;
      const spec = getOutfitsForChar(lb).find(o => o.key === outfitSel.value);
      if (spec) applyOutfitToCharacter(lb, spec, S.outfitApplyAll !== false);
    };
  }

  const btnCopyPrevOutfits = $('#btnCopyPrevSceneOutfits', body);
  if (btnCopyPrevOutfits) {
    btnCopyPrevOutfits.onclick = () => {
      if (window.StudioWorkflow && typeof window.StudioWorkflow.copyOutfitsFromPrevScene === 'function') {
        window.StudioWorkflow.copyOutfitsFromPrevScene();
      } else {
        toast('未加载多幕工程工作流', 'warn');
      }
    };
  }

  // 04：分类 Tab 切换
  $$('[data-act-cat]', body).forEach(b => b.onclick = () => {
    S.actCat = b.dataset.actCat;
    renderInspector();
  });

  // 04：角色专属高频组合卡
  $$('[data-char-card]', body).forEach(b => b.onclick = () => {
    const c = (M.actionCards[lb] || [])[+b.dataset.charCard];
    if (!c) return;
    applyMotionAndFaceToCurrentSelection(lb, {
      anim1: c.anim1,
      anim2: 'face_' + c.face,
      anim3: c.anim3 !== undefined ? c.anim3 : undefined,
      labelHint: `动作组合：${c.label}`
    });
    toast(`🌟 已套用并实时预览「${c.label}」`);
  });

  // 04：核心情绪预设卡
  $$('[data-strata]', body).forEach(b => b.onclick = () => {
    const s = (M.emotionStrata || [])[+b.dataset.strata];
    if (!s) return;
    const t = charTargetRow(lb);
    applyMotionAndFaceToCurrentSelection(lb, {
      anim1: s.anim1,
      anim2: 'face_' + s.face,
      lip: s.lip,
      labelHint: `推荐预设：${s.label}`
    });
    mutRow(t, l => {
      const mm = meta(l);
      if (s.emo) mm.surfaceEmotion = s.emo;
      if (s.tone) mm.vocalTone = s.tone;
      if (s.mode && ci && ci.dual) mm.mode = s.mode;
    });
    toast(`🎭 已套用并实时预览「${s.label}」`);
  });

  // 04：中文分类动作预设卡
  $$('[data-motion-preset]', body).forEach(b => b.onclick = () => {
    const p = (M.motionPresetCatalog || []).find(x => x.id === b.dataset.motionPreset);
    if (!p) return;
    if (p.slot === 'anim3') {
      applyMotionAndFaceToCurrentSelection(lb, {
        anim3: p.code,
        labelHint: `头部/肢体动作：${p.nameZh}`
      });
      toast(`🙇 已叠加头部/肢体动作「${p.nameZh}」`);
    } else {
      applyMotionAndFaceToCurrentSelection(lb, {
        anim1: p.code,
        labelHint: `身体动作：${p.nameZh}`
      });
      toast(`🏃 已触发身体动作「${p.nameZh}」`);
    }
  });

  const btnClearA3 = $('[data-clear-anim3]', body);
  if (btnClearA3) btnClearA3.onclick = () => {
    applyMotionAndFaceToCurrentSelection(lb, { anim3: '', labelHint: '清除头部动作 charAnim3' });
    toast('↺ 已清除头部叠加动作');
  };

  // 04 高级折叠：底层骨骼原始代号下拉框
  const sk1 = $('#skAnim1', body); if (sk1) sk1.onchange = () => applyMotionAndFaceToCurrentSelection(lb, { anim1: sk1.value, labelHint: '设置 charAnim1=' + sk1.value });
  const sk2 = $('#skAnim2', body); if (sk2) sk2.onchange = () => applyMotionAndFaceToCurrentSelection(lb, { anim2: sk2.value, labelHint: '设置 charAnim2=' + sk2.value });
  const sk3 = $('#skAnim3', body); if (sk3) sk3.onchange = () => applyMotionAndFaceToCurrentSelection(lb, { anim3: sk3.value, labelHint: '设置 charAnim3=' + (sk3.value || '无') });
  const sk4 = $('#skAnim4', body); if (sk4) sk4.onchange = () => applyMotionAndFaceToCurrentSelection(lb, { anim4: sk4.value, labelHint: '设置 charAnim4=' + (sk4.value || 'eye_front') });

  // 03：面部表情中文视觉卡片
  $$('[data-face-code]', body).forEach(b => b.onclick = () => {
    const fc = b.dataset.faceCode;
    applyMotionAndFaceToCurrentSelection(lb, {
      anim2: fc,
      labelHint: `面部表情：${getFaceNameZh(fc)}`
    });
    toast(`😊 已切换面部表情「${getFaceNameZh(fc)}」`);
  });

  // 03：眼神视线方向按钮
  $$('[data-eye]', body).forEach(b => b.onclick = () => {
    const eye = b.dataset.eye;
    applyMotionAndFaceToCurrentSelection(lb, {
      anim4: eye,
      labelHint: `视线方向：${eye}`
    });
    toast(`👀 视线已切换`);
  });

  // 底部折叠区事件：潜台词与语域标注
  $$('.switch2 button', body).forEach(b => b.onclick = () => {
    const v = b.dataset.mode;
    exec(v ? `设为${v === 'omote' ? '营业' : '本音'}` : '清除语域', () => mutRow(i, l => { if (v) meta(l).mode = v; else if (l._meta) delete l._meta.mode; }));
    if (v && ci && !ci.dual) toast('⚠ V14：该角色没有二面性', 'warn');
  });
  $$('.chips[data-group] .chip', body).forEach(b => b.onclick = () => {
    const g = b.parentElement.dataset.group, v = b.dataset.v;
    exec(`设置 ${g}`, () => mutRow(i, l => {
      const mm = meta(l);
      if (v === '' || mm[g] === v) delete mm[g]; else mm[g] = v;
      if (g === 'surfaceEmotion' && mm[g] && $('#syncFace') && $('#syncFace').checked && l.charLabel) setK(l, 'charAnim2', 'face_' + EMO2FACE[v]);
    }));
    if (g === 'surfaceEmotion' && v && $('#syncFace') && $('#syncFace').checked && lb) {
      previewPoseOnSpineStage({ charLabel: lb, charAnim2: 'face_' + EMO2FACE[v] });
    }
  });
  const sf = $('#syncFace', body); if (sf) sf.onchange = () => { S.syncFace = sf.checked; };
  const hr = $('#holdMs', body);
  if (hr) {
    hr.oninput = () => { $('#holdVal').textContent = hr.value + 'ms'; };
    hr.onchange = () => exec('设置停顿 holdMs', () => mutRow(i, l => { const v = +hr.value; if (v) meta(l).holdMs = v; else if (l._meta) delete l._meta.holdMs; }));
    $('#holdAuto', body).onclick = () => exec('智能停顿', () => mutRow(i, l => { meta(l).holdMs = /……|…$|！？$/.test(l.text) ? 800 : 300; }));
  }
}

/* ---------- Tab 2：站位、运镜与音效 ---------- */
function tabBlocking(body) {
  const i = curIdx(), l = S.doc.rows[i].line, k = kindOf(l), st = stageAt(i);
  const lb = (k === 'dialogue' ? charOfLine(l) : l.charLabel) || S.selChar || (st.cast[0] || Object.keys(S.doc.pack.characters || {})[0] || null);
  let html = lineHeader(i, l);
  if (lb) {
    const sc = st.chars[lb] || {};
    const sub = getLineSubtimelineData(i);
    const curEff = (l.charEffect && typeof l.charEffect === 'object' && l.charEffect.type === 'to') ? l.charEffect : null;
    const prevX = i > 0 && stageAt(i - 1).chars[lb] ? Math.round(stageAt(i - 1).chars[lb].x || 568) : Math.round(sc.x || 568);
    const destX = curEff && curEff.x != null ? Math.round(curEff.x) : Math.round(sc.x || 568);
    const mvTime = curEff && curEff.time ? curEff.time : 450;
    const mvOffsetS = (sub.moveTrack[0] && sub.moveTrack[0].offsetMs ? (sub.moveTrack[0].offsetMs / 1000) : 0).toFixed(1);
    const mvPresets = M.planarMovePresets || [];
    const castTabsHtml = st.cast.length > 1
      ? `<div class="act-cast-tabs">${st.cast.map(c => `<button type="button" class="act-cast-btn ${c === lb ? 'on' : ''}" data-pick-char="${esc(c)}">${esc(charInfo(c).name)}</button>`).join('')}</div>`
      : '';
    html += `<div class="act-block" id="actBlockMove">
      <div class="act-block-head">
        <div class="act-block-title">
          <span>↔️ 2D 站位与平面移动（2D Position & Planar Walk · <code>charPosition</code> / <code>charEffect</code>）</span>
          <span class="act-block-badge">起点 X=${prevX} → 终点 X=${destX} (${mvTime}ms)</span>
        </div>
        <div class="row-flex" style="gap:6px">${castTabsHtml}<button type="button" class="chip" data-scale="1">复位缩放 ×1.00</button></div>
      </div>
      <div class="move-presets">
        ${mvPresets.map((p, idxP) => `<button type="button" class="chip-btn prismy" data-mv-preset="${idxP}" title="${esc(p.desc)}">${esc(p.label)}</button>`).join('')}
      </div>
      <div class="row-flex" style="margin-top:6px">
        <span class="muted">起点 X</span><b class="mono">${prevX}</b>
        <span>→</span>
        <label class="fld" style="flex-direction:row;align-items:center">终点 X <input type="number" id="mvDestX" value="${destX}" min="-100" max="1236" step="20" style="width:76px"></label>
        <label class="fld" style="flex-direction:row;align-items:center">句中触发(s) <input type="number" id="mvOffsetSec" value="${mvOffsetS}" min="0" max="6" step="0.2" style="width:62px"></label>
        <label class="fld" style="flex-direction:row;align-items:center">缩放 × <input type="number" id="mvScale" value="${(+(sc.scale || 1)).toFixed(2)}" min="0.5" max="1.8" step="0.04" style="width:66px"></label>
        <span class="muted">耗时</span>
        <input type="range" id="mvTime" min="150" max="1500" step="50" value="${mvTime}" style="flex:1;min-width:90px">
        <b class="mono" id="mvTimeVal">${mvTime}ms</b>
        <button type="button" class="btn primary" id="btnApplyMove" style="padding:4px 12px;font-size:12px">写入平面位移 & 实时预览</button>
      </div>
    </div>`;
  } else {
    html += `<div class="insp-empty">选中一行台词或角色演出行即可编辑 2D 站位与平面位移。</div>`;
  }

  const seCats = M.seCategories || [
    { id: 'all', label: '🌟 全部音效 (40)' },
    { id: 'footstep_door', label: '🚪 脚步与开关门' },
    { id: 'weather_nature', label: '🌊 天气与自然环境' },
    { id: 'phone_daily', label: '📱 手机与日常物品' },
    { id: 'emotion_gag', label: '💥 情绪与吐槽搞笑' },
    { id: 'stage_applause', label: '✨ 舞台与欢呼掌声' },
    { id: 'clear', label: '🧹 清除本行音效' }
  ];
  const activeSeCat = S.seCat || 'emotion_gag';
  const curSeId = l.se !== undefined ? String(l.se) : '';
  const curSeInfo = curSeId ? (M.seLibrary || []).find(x => x.id === curSeId) : null;
  const catSeItems = (M.seLibrary || []).filter(x => activeSeCat === 'all' || (x.category || x.cat) === activeSeCat);

  html += `<div class="act-block" id="actBlockQuickSe" style="margin-top:8px">
    <div class="act-block-head">
      <div class="act-block-title">
        <span>🔔 音效（SE）中文情景分类速查面板（<code>line.se</code>）</span>
        <span class="act-block-badge">${curSeId ? `当前已挂入：🔔 SE ${esc(curSeId)} (${esc(curSeInfo ? curSeInfo.title : '')})` : '当前行未挂入音效'}</span>
      </div>
      <div class="row-flex" style="gap:6px">
        ${curSeId ? `<button type="button" class="chip-btn" data-quick-se-play="${esc(curSeId)}">🔊 试听当前 (${esc(curSeId)})</button>` : ''}
        <button type="button" class="chip-btn" data-quick-se-clear="1" ${curSeId ? '' : 'disabled'}>🧹 清除本行音效</button>
      </div>
    </div>
    <div class="act-cat-tabs" id="quickSeCatTabs">
      ${seCats.map(c => `<button type="button" class="act-cat-btn ${activeSeCat === c.id ? 'on' : ''}" data-se-cat="${esc(c.id)}" title="${esc(c.desc || c.label)}">${esc(c.label)}</button>`).join('')}
    </div>
    <div class="se-card-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px">
      ${catSeItems.map(s => {
        const isOn = curSeId === s.id;
        return `<div class="motion-preset-card se-quick-card ${isOn ? 'on' : ''}" style="display:flex;flex-direction:column;justify-content:space-between;gap:4px;cursor:default">
          <div class="mpc-top"><span class="mpc-name">${esc(s.title)}</span><code class="mpc-code">SE ${esc(s.id)}</code></div>
          <div class="mpc-hint">${esc(s.desc || s.tags)}</div>
          <div class="row-flex" style="gap:6px;margin-top:2px">
            <button type="button" class="chip-btn" data-quick-se-play="${esc(s.id)}" style="flex:1;justify-content:center">🔊 试听</button>
            <button type="button" class="chip-btn prismy" data-quick-se-set="${esc(s.id)}" style="flex:1.2;justify-content:center">${isOn ? '✓ 已挂入本幕' : '＋ 挂入本幕'}</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  body.innerHTML = html;

  $$('[data-pick-char]', body).forEach(b => b.onclick = () => {
    S.selChar = b.dataset.pickChar;
    renderStage(); renderTimeline(); renderStageDirectorDock(); renderInspector();
  });

  const mvT = $('#mvTime', body); if (mvT) mvT.oninput = () => { $('#mvTimeVal').textContent = mvT.value + 'ms'; };
  const mvDestInp = $('#mvDestX', body);
  if (mvDestInp) mvDestInp.onchange = () => {
    if (!lb) return;
    const nx = Math.round(+(mvDestInp.value || 568));
    previewPoseOnSpineStage({ charLabel: lb, x: nx });
  };
  const btnMv = $('#btnApplyMove', body);
  if (btnMv && lb) btnMv.onclick = () => {
    const nx = Math.round(+($('#mvDestX', body).value || 568));
    const ns = +($('#mvScale', body).value || 1);
    const dur = +($('#mvTime', body).value || 450);
    const offsetMs = Math.round((+($('#mvOffsetSec', body).value || 0)) * 1000);
    const t = charTargetRow(lb);
    const fromX = i > 0 && stageAt(i - 1).chars[lb] ? Math.round(stageAt(i - 1).chars[lb].x || 568) : Math.round((st.chars[lb] && st.chars[lb].x) || 568);
    exec(`2D 平面移动 → x=${nx} (${dur}ms)`, () => mutRow(t, ln => {
      if (!ln.charLabel) setK(ln, 'charLabel', lb);
      setK(ln, 'charPosition', { x: nx, y: 640, order: Math.max(0, st.cast.indexOf(lb)) });
      setK(ln, 'charScale', ns);
      setK(ln, 'charEffect', { type: 'to', x: nx, scale: ns, time: dur });
      meta(ln).manualPos = true;
      meta(ln).moveTrack = [{ offsetMs, durationMs: dur, charLabel: lb, fromX, toX: nx, label: `平面位移 X:${fromX}→${nx}` }];
    }), { syncStage: false });
    previewPoseOnSpineStage({ charLabel: lb, x: nx, scale: ns, moveFromX: fromX, moveToX: nx, moveTime: dur });
    toast(`↔️ 已写入并实时预览平面位移：X=${fromX} → ${nx} (@${(offsetMs / 1000).toFixed(1)}s, 耗时 ${dur}ms)`);
  };
  $$('[data-mv-preset]', body).forEach(b => b.onclick = () => {
    if (!lb) return;
    const p = (M.planarMovePresets || [])[+b.dataset.mvPreset];
    if (!p) return;
    const t = charTargetRow(lb);
    const curX = Math.round((st.chars[lb] && st.chars[lb].x) || 568);
    let nx = p.targetX != null ? p.targetX : p.toCenter ? (curX > 568 ? Math.max(460, curX - 160) : Math.min(676, curX + 160)) : p.toEdge ? (curX >= 568 ? Math.min(960, curX + 110) : Math.max(180, curX - 110)) : curX;
    if (p.swap) {
      const other = st.cast.find(c => c !== lb && st.chars[c] && st.chars[c].visible);
      nx = other && st.chars[other] ? Math.round(st.chars[other].x) : (1136 - curX);
    }
    const dur = p.time || 450;
    const offsetMs = Math.round((+($('#mvOffsetSec', body)?.value || 0)) * 1000);
    exec(`2D 平面移动预设：${p.label}`, () => mutRow(t, ln => {
      if (!ln.charLabel) setK(ln, 'charLabel', lb);
      setK(ln, 'charPosition', { x: nx, y: p.targetY || 640, order: Math.max(0, st.cast.indexOf(lb)) });
      setK(ln, 'charScale', p.scale || 1);
      setK(ln, 'charEffect', { type: 'to', x: nx, scale: p.scale || 1, time: dur });
      if (p.se) setK(ln, 'se', p.se);
      meta(ln).manualPos = true;
      meta(ln).moveTrack = [{ offsetMs, durationMs: dur, charLabel: lb, fromX: curX, toX: nx, label: p.label }];
    }), { syncStage: false });
    previewPoseOnSpineStage({ charLabel: lb, x: nx, y: p.targetY || 640, scale: p.scale || 1, moveFromX: curX, moveToX: nx, moveTime: dur });
    toast(`✨ 已应用并实时演示平面位移「${p.label}」→ X=${curX}→${nx} (${dur}ms)`);
  });
  $$('[data-scale]', body).forEach(b => b.onclick = () => {
    if (!lb) return;
    const t = charTargetRow(lb);
    exec('复位缩放', () => mutRow(t, ln => { if (!ln.charLabel) setK(ln, 'charLabel', lb); setK(ln, 'charScale', 1); }), { syncStage: false });
    previewPoseOnSpineStage({ charLabel: lb, scale: 1 });
  });

  $$('[data-se-cat]', body).forEach(b => b.onclick = () => {
    const cid = b.dataset.seCat;
    if (cid === 'clear') {
      exec('🧹 清除本行音效', () => mutRow(i, ln => delete ln.se));
      syncLoadDocToSpineStage(false);
      toast('🧹 已清除本行音效');
      return;
    }
    S.seCat = cid;
    renderInspector();
  });
  $$('[data-quick-se-play]', body).forEach(b => b.onclick = () => playSe(b.dataset.quickSePlay));
  $$('[data-quick-se-set]', body).forEach(b => b.onclick = () => {
    const sid = b.dataset.quickSeSet;
    const seObj = (M.seLibrary || []).find(x => x.id === sid);
    exec(`🔔 挂入音效 SE ${sid}`, () => mutRow(i, ln => setK(ln, 'se', sid)));
    playSe(sid);
    syncLoadDocToSpineStage(false);
    toast(`🔔 已挂入音效「${seObj ? seObj.title : sid}」(SE ${sid}) 并同步至舞台！`);
  });
  $$('[data-quick-se-clear]', body).forEach(b => b.onclick = () => {
    exec('🧹 清除本行音效', () => mutRow(i, ln => delete ln.se));
    syncLoadDocToSpineStage(false);
    toast('🧹 已清除本行音效');
  });
}

/* ---------- Tab 2：配音 3 选 1 抽卡 ---------- */
function drawWave(cv, seed, status, text, peaks) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 200, h = cv.clientHeight || 46;
  cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
  const n = Math.floor(w / 3), rng = mulberry(seed || 7);
  const grad = g.createLinearGradient(0, 0, w, 0);
  if (status === 'rejected') { grad.addColorStop(0, '#9aa3bd'); grad.addColorStop(1, '#c0c6d8'); }
  else { grad.addColorStop(0, '#5ccfff'); grad.addColorStop(.5, '#a98bff'); grad.addColorStop(1, '#ff8fc3'); }
  g.fillStyle = grad;
  const syl = Math.max(4, jlen(text) || 12);
  for (let k = 0; k < n; k++) {
    let a;
    if (peaks) a = peaks[Math.floor(k / n * peaks.length)] || 0;
    else { const p = k / n, env = Math.sin(Math.PI * Math.min(1, p * 1.08)) ** .6, sy = Math.abs(Math.sin(p * syl * Math.PI)); a = env * (.25 + .75 * sy) * (.55 + .45 * rng()); }
    const bh = Math.max(1.5, a * (h - 6));
    g.fillRect(k * 3, (h - bh) / 2, 2, bh);
  }
}
function tabVoice(body) {
  const i = curIdx(), l = S.doc.rows[i].line, m = l._meta || {}, k = kindOf(l);
  const lb = charOfLine(l), ci = lb ? charInfo(lb) : null;
  let html = lineHeader(i, l);
  if (k !== 'dialogue') { body.innerHTML = html + `<div class="insp-empty">请先在左侧选中一行台词，再抽取配音 Take。</div>`; return; }
  const synth = m.ttsText ?? l.text;
  const prof = (lb && ((S.doc.pack.characters[lb] || {}).voiceProfile || ((S.doc.pack.tts || {}).voiceProfiles || {})[lb])) || '（制作人无声线）';
  const takes = m.takes || [];
  const snippets = lb ? (M.voiceSnippets[lb] || []) : Object.values(M.voiceSnippets).flat();
  const ttsCfg = (window.StudioWorkflow && typeof window.StudioWorkflow.getTtsConfig === 'function')
    ? window.StudioWorkflow.getTtsConfig()
    : { provider: 'off' };
  const ttsProvLabel = {
    off: '未接独立 TTS（仅使用原版短句 / 本地音频）',
    cloud_fish: 'Fish Audio 云端角色语音（内置 30 人预设）',
    local_irodori: '本地 Irodori TTS (:8088)',
    local_gptsovits: '本地 GPT-SoVITS',
    local_voicevox: '本地 VOICEVOX',
    cloud_openai: '云端 OpenAI TTS',
    custom_webhook: '自定义 HTTP Webhook'
  }[ttsCfg.provider || 'cloud_fish'] || ttsCfg.provider;
  html += `<div class="card"><div class="kv"><span>合成文本</span><span style="font-family:var(--font-jp)">${esc(synth)} ${m.ttsText !== undefined ? '<span class="badge gen">来自 _meta.ttsText</span>' : '<span class="badge">= 显示台词</span>'}</span>
    <span>声线</span><span class="mono">${esc(prof)} · ${esc((S.doc.pack.tts || {}).engine || 'irodori')} · 情绪 ${esc(EMO[m.surfaceEmotion] || '—')} / 语气 ${esc(TONE[m.vocalTone] || '—')}</span>
    <span>行 voice</span><span class="mono">${esc(l.voice || '（未设置）')}</span>
    <span>当前 TTS 接口</span><span class="mono">${esc(ttsProvLabel)}</span></div>
    <div class="row-flex" style="margin-top:10px;flex-wrap:wrap;gap:8px"><button class="btn primary" id="btnSynthTtsLine" ${S.genBusy ? 'disabled' : ''}>${S.genBusy ? '⏳ TTS 合成中…' : '⚡ 当前 TTS 接口合成此句'}</button></div></div>
  <div class="sec-title" style="margin-top:12px">候选 Take（${takes.length}）· 🔒 锁定 = takeSelected + 行 voice 同步（V5）</div>
  <div class="take-grid">${takes.length ? takes.map((t, n) => {
    const locked = m.takeSelected === t.id, stale = t.text !== undefined && t.text !== synth;
    const rec = t.recipe && t.recipe.segments ? t.recipe.segments.filter(s => s.kind === 'aizuchi').map(s => s.ref.split('/').pop()).join('+') : '';
    return `<div class="take ${locked ? 'locked' : ''} ${t.status === 'rejected' ? 'rejected' : ''} ${S.newTakes.has(t.id + '@' + S.selKey) ? 'new' : ''}" data-t="${n}">
      <div class="take-head"><b>${esc(t.id)}</b>${t.status ? `<span class="badge ${t.status === 'approved' ? 'ok' : t.status === 'rejected' ? 'bad' : 'gen'}">${STATUS_ZH[t.status] || t.status}</span>` : ''}${stale ? '<span class="badge stale" title="V15：take.text 与当前读音不一致">已过期</span>' : ''}<span class="grow"></span><span class="stars" data-act="rate" title="评分">${[1, 2, 3, 4, 5].map(s => `<span data-star="${s}">${(t.rating || 0) >= s ? '★' : (t.rating || 0) >= s - .5 ? '⯪' : '☆'}</span>`).join('')}</span></div>
      <canvas data-wave="${n}"></canvas>
      <div class="take-meta">seed ${esc(t.seed ?? '—')} · ${esc(t.engine || '')} · ${t.durationMs ? (t.durationMs / 1000).toFixed(1) + 's' : '—'}<br>${esc(t.voice)}${t.note ? '<br>📝 ' + esc(t.note) : ''}</div>
      <div class="row-flex" style="gap:4px"><span class="muted" style="font-size:11px">前置相槌 <span class="badge gen">v2.1 recipe</span></span><select data-act="recipe" style="flex:1;padding:2px 4px;font-size:11px"><option value="">无</option>${snippets.map(s => `<option value="${esc(s.voice)}" ${rec && s.voice.endsWith(rec) ? 'selected' : ''}>${esc(s.text)}（${esc(s.kind)}）</option>`).join('')}</select></div>
      <div class="take-act"><button data-act="play">▶ 试听</button><button data-act="lock" class="lock ${locked ? 'on' : ''}">${locked ? '🔒 已锁定' : '🔓 锁定'}</button><button data-act="reject" title="弃用">✕</button><button data-act="del" title="删除">🗑</button></div></div>`;
  }).join('') : '<div class="insp-empty">暂无语音 Take。可点击上方「⚡ 当前 TTS 接口合成此句」、右侧拖入本地音频，或下方直插原版声优短句。</div>'}</div>
  <div class="cols" style="margin-top:12px">
    <div class="card"><div class="sec-title">原版声优短句库（笑声 / 叹气 / 相槌）</div><div class="chips">${snippets.map((s, n) => `<span class="snip"><span>${esc(s.text)}</span><small>${esc(s.kind)}${s.mode ? '·' + (s.mode === 'omote' ? '营业' : '本音') : ''}</small><button data-snip-play="${n}">▶</button><button data-snip-ins="${n}" title="在当前行后直插一行">直插</button></span>`).join('') || '<span class="muted">（无）</span>'}</div></div>
    <div class="card"><div class="sec-title">外部音频</div><div class="dropzone" id="audioDrop">🎧 拖入 wav / mp3 / m4a / ogg，或点击选择<br><small>→ 作为录音 Take（engine: recorded）加入本行，波形为真实解码</small></div><input type="file" id="audioFile" accept="audio/*" hidden></div>
  </div>`;
  body.innerHTML = html;
  $$('canvas[data-wave]', body).forEach(cv => { const t = takes[+cv.dataset.wave]; drawWave(cv, t.seed, t.status, t.text || synth, S.waves[t.voice]); });
  S.newTakes.clear();
  const synthBtn = $('#btnSynthTtsLine', body);
  if (synthBtn) synthBtn.onclick = () => synthTtsTake(i);
  $$('.take', body).forEach(card => {
    const n = +card.dataset.t, t = takes[n];
    card.querySelector('[data-act=play]').onclick = () => playTake(t, lb, synth);
    card.querySelector('[data-act=lock]').onclick = () => { exec(m.takeSelected === t.id ? '解锁 Take' : `锁定 Take ${t.id}`, () => mutRow(i, l => {
      const mm = meta(l), tk = mm.takes[n];
      if (mm.takeSelected === tk.id) { delete mm.takeSelected; syncVoiceTimingOnLine(l, {}); }
      else {
        mm.takeSelected = tk.id;
        syncVoiceTimingOnLine(l, { voice: tk.voice, durationMs: tk.durationMs, lipSegments: tk['x-lipSegments'] || tk.lipSegments });
        tk.status = 'approved';
      }
    })); syncLoadDocToSpineStage(false); };
    card.querySelector('[data-act=reject]').onclick = () => { exec(`弃用 Take ${t.id}`, () => mutRow(i, l => {
      const mm = meta(l), tk = mm.takes[n]; tk.status = tk.status === 'rejected' ? 'generated' : 'rejected';
      if (tk.status === 'rejected' && mm.takeSelected === tk.id) { delete mm.takeSelected; syncVoiceTimingOnLine(l, {}); }
    })); syncLoadDocToSpineStage(false); };
    card.querySelector('[data-act=del]').onclick = () => { exec(`删除 Take ${t.id}`, () => mutRow(i, l => {
      const mm = meta(l), tk = mm.takes[n]; if (mm.takeSelected === tk.id) { delete mm.takeSelected; syncVoiceTimingOnLine(l, {}); }
      mm.takes.splice(n, 1); if (!mm.takes.length) delete mm.takes;
    })); syncLoadDocToSpineStage(false); };
    card.querySelector('[data-act=recipe]').onchange = e => exec('设置拼接配方 recipe', () => mutRow(i, l => {
      const tk = meta(l).takes[n], v = e.target.value;
      if (!v) delete tk.recipe; else tk.recipe = { crossfadeMs: 80, segments: [{ kind: 'aizuchi', ref: v, gainDb: 0 }, { kind: 'tts', ref: tk.voice }] };
    }));
    $$('[data-star]', card).forEach(s => s.onclick = () => exec(`评分 ${t.id}`, () => mutRow(i, l => { const tk = meta(l).takes[n]; const v = +s.dataset.star; tk.rating = tk.rating === v ? v - .5 : v; })));
  });
  $$('[data-snip-play]', body).forEach(b => b.onclick = () => {
    const s = snippets[+b.dataset.snipPlay];
    playRealAudio(s.voice, () => toast('⚠ 未找到对应语音文件', 'warn'));
    speakFx(lb, s.durationMs || 1200);
  });
  $$('[data-snip-ins]', body).forEach(b => b.onclick = () => {
    const s = snippets[+b.dataset.snipIns], slb = lb || 'fuyuko', sci = charInfo(slb);
    exec('直插原版短句', () => {
      const nl = { id: nextId(), speaker: sci.name, charLabel: slb, text: s.text, voice: s.voice, textCtrl: 'p', textFrame: '001', _meta: { uid: newUid(), origin: 'custom', zh: s.zh, note: '原版声优短句直插（真实语音）' } };
      if (s.mode && sci.dual) nl._meta.mode = s.mode;
      const [made] = insertRows(i + 1, [nl]); S.selKey = made.key;
    });
  });
  const dz = $('#audioDrop', body), fi = $('#audioFile', body);
  dz.onclick = () => fi.click();
  fi.onchange = () => fi.files[0] && addExternalAudio(i, fi.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); const f = [...e.dataTransfer.files].find(f => /^audio\//.test(f.type) || /\.(wav|mp3|m4a|ogg)$/i.test(f.name)); if (f) addExternalAudio(i, f); else toast('请拖入音频文件', 'warn'); };
}
function seqOf(l, i) { const mm = typeof l.id === 'string' && l.id.match(/_(\d+)$/); return mm ? mm[1] : String(i + 1).padStart(3, '0'); }
async function synthTtsTake(i, opts = {}) {
  const { force = false, autoPlay = true, silent = false } = opts || {};
  const rowObj = S.doc.rows[i];
  if (!rowObj || !rowObj.line) return null;
  let ttsConfig = (window.StudioWorkflow && typeof window.StudioWorkflow.getTtsConfig === 'function')
    ? window.StudioWorkflow.getTtsConfig()
    : { provider: 'cloud_fish', endpoint: 'https://api.fish.audio', model: 'drama-3', format: 'mp3' };
  if (!ttsConfig || !ttsConfig.provider || ttsConfig.provider === 'off') {
    if (ttsConfig && ttsConfig.explicitOff) {
      if (!silent) {
        toast('当前已显式关闭 TTS 接口，可在顶栏「🔌 接口与语音 → 🎙 TTS」重新启用 Fish Audio', 'warn');
        if (window.StudioWorkflow && typeof window.StudioWorkflow.openLlmSettingsModal === 'function') {
          window.StudioWorkflow.openLlmSettingsModal('tts');
        }
      }
      return null;
    }
    ttsConfig = { provider: 'cloud_fish', endpoint: 'https://api.fish.audio', model: 'drama-3', format: 'mp3' };
  }
  const l = rowObj.line, m = l._meta || {};
  const synthText = m.ttsText ?? l.text ?? '';
  const lb = l.charLabel || charOfLine(l) || '';
  if (!lb || isProducer(l.speaker)) {
    if (!silent) toast('仅偶像台词支持一键语音合成（制作人/旁白无声线）', 'warn');
    return null;
  }
  if (!synthText.trim()) {
    if (!silent) toast('当前行合成文本为空', 'warn');
    return null;
  }
  S.genBusy = true;
  S.ttsBusyKey = rowObj.key;
  replaceRow(rowObj.key);
  renderStageDirectorDock();
  renderInspector();
  try {
    const res = await fetch('/api/studio/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: synthText,
        charLabel: lb,
        emotion: m.surfaceEmotion || 'neutral',
        mode: m.mode || '',
        vocalTone: m.vocalTone || '',
        innerMonologue: isInnerMonologueRow(l),
        force: Boolean(force),
        ttsConfig
      })
    });
    const data = await res.json();
    if (!data || !data.ok || !data.audioUrl) {
      throw new Error((data && (data.error || data.detail)) || 'TTS 合成失败');
    }
    const voicePath = data.playerVoicePath || data.audioUrl;
    const targetIdx = idxOf(rowObj.key);
    if (targetIdx >= 0) {
      exec(`TTS 接口合成：${ttsConfig.provider}`, () => mutRow(targetIdx, ln => {
        const mm = meta(ln);
        const sig = computeVoiceSynthSig(ln);
        mm.takes = mm.takes || [];
        let k = mm.takes.length + 1;
        while (mm.takes.some(t => t.id === 'tts' + k)) k++;
        const id = 'tts' + k;
        const durMsVal = data.durationMs || (600 + jlen(synthText) * 95);
        const segsVal = Array.isArray(data.lipSegments) && data.lipSegments.length ? data.lipSegments : undefined;
        mm.takes.unshift({
          id,
          voice: voicePath,
          engine: ttsConfig.provider,
          emotion: mm.surfaceEmotion || 'neutral',
          mode: mm.mode || '',
          text: synthText,
          synthSig: sig,
          durationMs: durMsVal,
          ...(segsVal ? { 'x-lipSegments': segsVal } : {}),
          status: 'approved',
          createdAt: nowISO(),
          note: `API 实时合成 (${ttsConfig.provider}${data.model ? ' · ' + data.model : ''})`
        });
        mm.takeSelected = id;
        mm.voiceSynthSig = sig;
        delete mm.voiceStale;
        syncVoiceTimingOnLine(ln, { voice: voicePath, durationMs: durMsVal, lipSegments: segsVal });
        S.newTakes.add(id + '@' + rowObj.key);
      }));
      syncLoadDocToSpineStage(false);
    }
    if (autoPlay !== false) {
      playRealAudio(data.audioUrl || voicePath, () => {}, { rowKey: rowObj.key });
    }
    if (!silent) {
      toast(`🎙 已通过 ${ttsConfig.provider === 'cloud_fish' ? 'Fish Audio' : ttsConfig.provider} 合成并锁定语音！`);
    }
    return data;
  } catch (err) {
    if (!silent) toast('✗ TTS 合成失败：' + (err && err.message ? err.message : err), 'err');
    return null;
  } finally {
    S.genBusy = false;
    if (S.ttsBusyKey === rowObj.key) S.ttsBusyKey = null;
    replaceRow(rowObj.key);
    renderStageDirectorDock();
    renderInspector();
  }
}
let curRealAudio = null;
let curRealAudioKey = null;
function resolveVoiceUrl(v) {
  if (!v) return null;
  if (S.blobs['voice:' + v]) return S.blobs['voice:' + v];
  if (/^(\/ref-wav\/|\/voice\/|\/tts-out\/|\/api\/studio\/tts\/audio\/|https?:|blob:|data:)/.test(v)) return v;
  if (v.startsWith('voices/sc_ref_candidates/')) return '/ref-wav/' + v.slice('voices/sc_ref_candidates/'.length);
  if (v.startsWith('sounds/voice/events/')) return '/voice/' + v.slice('sounds/voice/events/'.length);
  return '/voice/' + v;
}
function stopRealAudio() {
  if (curRealAudio) {
    try { curRealAudio.pause(); curRealAudio.currentTime = 0; } catch {}
    curRealAudio = null;
  }
  const prevKey = curRealAudioKey;
  curRealAudioKey = null;
  if (prevKey) {
    const btn = $(`.row[data-key="${prevKey}"] .tts-row-btn`);
    if (btn) {
      btn.classList.remove('playing');
      if (btn.classList.contains('has-voice')) {
        btn.textContent = btn.classList.contains('stale') ? '⚠️ 词已改·重配' : '🔊 试听';
      }
    }
    if (prevKey === S.selKey) renderStageDirectorDock();
  }
}
function playRealAudio(rawUrl, fallbackFn, opts = {}) {
  const url = resolveVoiceUrl(rawUrl);
  if (!url) return fallbackFn && fallbackFn();
  stopRealAudio();
  const rowKey = (opts && opts.rowKey) || null;
  const a = new Audio(url);
  curRealAudio = a;
  curRealAudioKey = rowKey;
  if (rowKey) {
    const btn = $(`.row[data-key="${rowKey}"] .tts-row-btn`);
    if (btn) {
      btn.classList.add('playing');
      if (btn.classList.contains('has-voice')) btn.textContent = '⏹ 停止';
    }
    if (rowKey === S.selKey) renderStageDirectorDock();
  }
  a.addEventListener('ended', () => { if (curRealAudio === a) stopRealAudio(); });
  a.play().catch(() => {
    if (curRealAudio === a) stopRealAudio();
    if (fallbackFn) fallbackFn();
  });
  return a;
}
function playTake(t, lb) {
  const ms = t.durationMs || 1800;
  playRealAudio(t.voice, () => toast('⚠ 未找到对应语音文件', 'warn'));
  speakFx(lb, ms);
}
function speakFx(lb, ms) {
  if (!lb) return; S.speakingNow = lb; renderStage();
  clearTimeout(speakFx.t); speakFx.t = setTimeout(() => { S.speakingNow = null; renderStage(); }, ms);
}
function addExternalAudio(i, file) {
  const url = URL.createObjectURL(file);
  const l = S.doc.rows[i].line, mm0 = l._meta || {};
  const packId = (S.doc && S.doc.pack && S.doc.pack.id) || S.doc.meta.id;
  const dir = (S.doc.meta.tts || {}).voiceDir || 'custom/' + packId;
  let k = 1; while ((mm0.takes || []).some(t => t.id === 'rec' + k)) k++;
  const id = 'rec' + k;
  const ext = ((file.name || '').match(/\.(mp3|wav|m4a|ogg|webm)$/i) || [, 'wav'])[1].toLowerCase();
  const assetBase = `${seqOf(l, i)}_${id}`;
  const voice = `${dir}/${assetBase}.${ext}`;
  S.blobs['voice:' + voice] = url;
  const finish = (dur, peaks) => {
    if (peaks) S.waves[voice] = peaks;
    exec('拖入外部音频', () => mutRow(i, l => { const mm = meta(l); mm.takes = mm.takes || []; const t = { id, voice, engine: 'recorded', text: mm.ttsText ?? l.text, status: 'generated', createdAt: nowISO(), note: '外部音频：' + file.name }; if (dur) t.durationMs = Math.round(dur * 1000); mm.takes.push(t); }));
    toast('🎧 已加入本地音频 Take ' + id);
    if (packId && file.size <= 15 * 1024 * 1024) {
      const fr = new FileReader();
      fr.onload = () => {
        fetch(`/api/studio/projects/${encodeURIComponent(packId)}/upload-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'voice', assetId: assetBase, filename: file.name, dataUrl: fr.result })
        }).then(r => r.json()).then(d => {
          if (d && d.ok && d.project && d.project.assets && S.doc && S.doc.pack) {
            S.doc.pack.assets = d.project.assets;
          }
        }).catch(() => {});
      };
      fr.readAsDataURL(file);
    }
  };
  file.arrayBuffer().then(buf => ac().decodeAudioData(buf)).then(ab => {
    const d = ab.getChannelData(0), N = 120, step = Math.floor(d.length / N) || 1, peaks = [];
    let mx = 0; for (let n = 0; n < N; n++) { let p = 0; for (let j = n * step; j < (n + 1) * step && j < d.length; j += 16) p = Math.max(p, Math.abs(d[j])); peaks.push(p); mx = Math.max(mx, p); }
    finish(ab.duration, peaks.map(p => mx ? p / mx : 0));
  }).catch(() => finish(0, null));
}

/* ---------- Tab 3：背景与生图工坊 ---------- */
function semScore(q, text) {
  q = q.trim(); if (!q) return 1;
  let s = 0, maxS = 0;
  for (const t of q.split(/[\s,，、]+/).filter(Boolean)) {
    maxS += 2;
    const syn = M.bgSynonyms[t];
    if (text.includes(t)) s += 2;
    else if (syn && text.includes(syn)) s += 1.6;
    else { let p = 0; for (let k = 0; k < t.length - 1; k++) if (text.includes(t.slice(k, k + 2))) p += .6; for (const ch of t) if (/[\u4e00-\u9fff]/.test(ch) && text.includes(ch)) p += .25; s += Math.min(1.4, p); }
  }
  return maxS ? s / maxS : 0;
}
function bgCatalog() {
  const items = [];
  const byId = new Map();
  for (const [id, a] of Object.entries((S.doc.pack.assets || {}).bg || {})) {
    const ig = a.imageGen || {};
    const it = { id, title: a.titleZh || a.title || id, tags: `${a.title || ''} ${a.titleZh || ''} ${ig.prompt || ''} 包内 自定义 ${a.origin || ''}`, category: 'scenic', pack: true, status: a.status, usageCount: 9999 };
    byId.set(id, it);
    items.push(it);
  }
  for (const b of (S.bgCatalogRemote || [])) {
    if (!b || !b.id || byId.has(b.id)) continue;
    const it = {
      id: b.id,
      title: b.title || b.zhLabel || b.id,
      category: b.category || 'scenic',
      timeOfDay: b.timeOfDay || '',
      weather: b.weather || '',
      indoorOutdoor: b.indoorOutdoor || '',
      tags: `${b.id} ${b.title || ''} ${b.tags || ''}`,
      pack: false,
      usageCount: b.usageCount || 0
    };
    byId.set(b.id, it);
    items.push(it);
  }
  for (const b of M.bgLibrary) {
    if (byId.has(b.id)) continue;
    const it = { id: b.id, title: b.title, tags: b.title + ' ' + b.tags, category: b.category || 'scenic', pack: false, usageCount: b.usageCount || 0 };
    byId.set(b.id, it);
    items.push(it);
  }
  return items;
}
function bgmCatalog() {
  const items = [];
  const byId = new Map();
  for (const b of (S.bgmCatalogRemote || [])) {
    const id = String((b && b.id) || '');
    if (!id || byId.has(id)) continue;
    const it = {
      id,
      title: b.title || b.name || id,
      label: b.label || b.title || id,
      category: b.category || 'music',
      avoidAutoBgm: Boolean(b.avoidAutoBgm),
      kindTag: b.kindTag || (b.category === 'ambient' ? '🌿环境音' : (b.category === 'silence' ? '🔇静场' : '🎵配乐')),
      moodTags: Array.isArray(b.moodTags) ? b.moodTags : [],
      emotion: b.emotion || '',
      durationSec: b.durationSec ?? null,
      sceneHints: Array.isArray(b.sceneHints) ? b.sceneHints : [],
      curated: Boolean(b.curated),
      tags: `${id} ${b.title || ''} ${b.tags || ''} ${b.desc || ''}`,
      usageCount: b.usageCount || 0
    };
    byId.set(id, it);
    items.push(it);
  }
  for (const b of (M.bgmLibrary || [])) {
    const id = String((b && b.id) || '');
    if (!id || byId.has(id)) continue;
    const it = {
      id,
      title: b.title || b.name || id,
      label: b.title || b.name || id,
      category: b.category || 'music',
      kindTag: '🎵配乐',
      moodTags: Array.isArray(b.moodTags) ? b.moodTags : [],
      emotion: b.emotion || '',
      durationSec: b.durationSec ?? null,
      sceneHints: [],
      curated: true,
      tags: `${id} ${b.title || ''} ${b.tags || ''} ${b.desc || ''}`,
      usageCount: b.usageCount || 10
    };
    byId.set(id, it);
    items.push(it);
  }
  return items;
}
function getActiveSceneContextText() {
  const wfSc = window.SCWorkflow && typeof window.SCWorkflow.getActiveScene === 'function' ? window.SCWorkflow.getActiveScene() : null;
  if (!wfSc) return { scene: null, text: '' };
  const segText = Array.isArray(wfSc.segments) ? wfSc.segments.map(s => `${s.title || ''} ${s.summary || ''} ${s.mood || ''}`).join(' ') : '';
  return {
    scene: wfSc,
    text: `${wfSc.titleZh || ''} ${wfSc.title || ''} ${wfSc.summary || ''} ${wfSc.bgmStyle || ''} ${segText}`.trim()
  };
}
function recommendBgsForActiveScene(limit = 8) {
  const cat = bgCatalog();
  const byId = new Map(cat.map(x => [String(x.id), x]));
  const { scene, text } = getActiveSceneContextText();
  const out = [];
  const seen = new Set();
  if (scene && Array.isArray(scene.bgSuggestions)) {
    for (const s of scene.bgSuggestions) {
      const id = String((s && s.id) || s || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const full = byId.get(id) || { id, title: (s && s.zhLabel) || id, tags: '', category: 'scenic' };
      out.push(Object.assign({}, full, { isRecommended: true, reason: (s && s.reason) || '剧情推荐背景' }));
      if (out.length >= limit) return out;
    }
  }
  const scored = cat
    .filter(it => !seen.has(it.id) && it.category !== 'abstract_effect' && it.category !== 'logo_title')
    .map(it => {
      const base = text ? semScore(text, `${it.title} ${it.tags} ${it.timeOfDay || ''} ${it.weather || ''} ${it.indoorOutdoor || ''}`) : 0;
      const boost = Math.log1p(it.usageCount || 0) * 0.08 + (it.pack ? 0.6 : 0);
      return Object.assign({}, it, { _rScore: base * 2 + boost, isRecommended: true, reason: text ? '匹配本幕场景氛围' : '常用推荐场景' });
    })
    .sort((a, b) => b._rScore - a._rScore);
  for (const s of scored) {
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
function recommendBgmsForActiveScene(limit = 6) {
  const cat = bgmCatalog();
  const byId = new Map(cat.map(x => [String(x.id), x]));
  const { scene, text } = getActiveSceneContextText();
  const out = [];
  const seen = new Set();
  const skipSfx = new Set(['0000', '0001', '0003', '0005', '0007', '0016', '0028', '0053', '0091']);
  if (scene && Array.isArray(scene.bgmSuggestions)) {
    for (const s of scene.bgmSuggestions) {
      const id = String((s && s.id) || s || '');
      if (!id || seen.has(id) || skipSfx.has(id)) continue;
      const hit = byId.get(id);
      if (hit && (hit.avoidAutoBgm || hit.category !== 'music')) continue;
      seen.add(id);
      const full = hit || { id, title: (s && (s.title || s.label)) || id, tags: '', category: (s && s.category) || 'music' };
      out.push(Object.assign({}, full, { isRecommended: true, reason: (s && s.reason) || '匹配剧情流向' }));
      if (out.length >= limit) return out;
    }
  }
  const scored = cat
    .filter(it => !seen.has(it.id) && it.category === 'music' && !it.avoidAutoBgm && !skipSfx.has(String(it.id)))
    .map(it => {
      const base = text ? semScore(text, `${it.title} ${it.tags} ${(it.sceneHints || []).join(' ')} ${(it.moodTags || []).join(' ')}`) : 0;
      const boost = Math.log1p(it.usageCount || 0) * 0.08 + (it.curated ? 0.2 : 0);
      return Object.assign({}, it, { _rScore: base * 2 + boost, isRecommended: true, reason: text ? '匹配剧情流向' : '常用配乐' });
    })
    .sort((a, b) => b._rScore - a._rScore);
  for (const s of scored) {
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
function classifyBgItemBucket(it) {
  const blob = `${it.category || ''} ${it.indoorOutdoor || ''} ${it.timeOfDay || ''} ${it.title || ''} ${it.tags || ''}`;
  if (it.category === 'abstract_effect' || it.category === 'logo_title') return 'abstract';
  if (/night|evening|sunset|dusk|夜|黄昏|傍晚|晚霞|星空/i.test(blob)) return 'evening_night';
  if (/outdoor|户外|街道|公园|海|沙滩|天台|山|车站|神社|校园/i.test(blob)) return 'outdoor';
  return 'indoor';
}
function isSceneOpeningRow(idx) {
  if (idx <= 0) return true;
  const rows = (S.doc && S.doc.rows) || [];
  const firstDlgIdx = rows.findIndex(r => r && r.line && typeof r.line.text === 'string' && r.line.speaker !== 'off');
  return firstDlgIdx >= 0 && idx === firstDlgIdx;
}
function currentSceneDefaultBg() {
  const wfSc = window.SCWorkflow && typeof window.SCWorkflow.getActiveScene === 'function' ? window.SCWorkflow.getActiveScene() : null;
  const setupRow = S.doc && S.doc.rows && S.doc.rows[0] && S.doc.rows[0].line;
  return (wfSc && wfSc.bg) || (setupRow && setupRow.bg) || '';
}
function currentSceneDefaultBgm() {
  const wfSc = window.SCWorkflow && typeof window.SCWorkflow.getActiveScene === 'function' ? window.SCWorkflow.getActiveScene() : null;
  const setupRow = S.doc && S.doc.rows && S.doc.rows[0] && S.doc.rows[0].line;
  return (wfSc && wfSc.bgm) || (setupRow && setupRow.bgm) || '';
}
function renderBgItemCardHtml(it, effectiveScope, sceneBg, st, hasQuery) {
  const r = resolveBg(it.id);
  const isOn = effectiveScope === 'scene' ? (sceneBg === it.id) : (st.bg === it.id);
  const thumbHtml = r.img
    ? `<div class="th"><img src="${esc(r.img)}" loading="lazy" decoding="async" alt="${esc(it.title)}"></div>`
    : `<div class="th th-empty"></div>`;
  return `<button class="bg-item ${isOn ? 'on' : ''}" data-bg="${esc(it.id)}" title="${esc(it.title)} (${esc(it.id)})">${thumbHtml}<div class="cap"><span>${esc(it.title)}</span><code>${esc(it.id)}</code></div>${it.pack ? `<span class="st">包内·${STATUS_ZH[it.status] || '—'}</span>` : ''}${hasQuery ? `<span class="score">${Math.round(it.score * 100)}%</span>` : ''}</button>`;
}
function tabBg(body) {
  const i = curIdx(), l = S.doc.rows[i].line, st = stageAt(i);
  const effectiveScope = S.bgScope === 'scene' || S.bgScope === 'row' ? S.bgScope : (isSceneOpeningRow(i) ? 'scene' : 'row');
  const sceneBg = currentSceneDefaultBg();
  const fullCat = bgCatalog();
  const recItemsAll = recommendBgsForActiveScene(8);
  const recIdSet = new Set(recItemsAll.map(x => String(x.id)));
  const activeCat = S.bgCatFilter || 'all';
  const hasQuery = Boolean(S.bgQuery.trim());
  const matched = fullCat
    .map(it => ({ ...it, score: semScore(S.bgQuery, it.tags + ' ' + it.id), bucket: classifyBgItemBucket(it) }))
    .filter(it => {
      if (hasQuery && it.score <= 0.15) return false;
      if (activeCat === 'rec') return recIdSet.has(it.id);
      if (activeCat !== 'all' && it.bucket !== activeCat) return false;
      return true;
    })
    .sort((a, b) => hasQuery ? (b.score - a.score) : ((b.usageCount || 0) - (a.usageCount || 0)));

  const matchedRec = matched.filter(it => recIdSet.has(it.id));
  const matchedRest = matched.filter(it => !recIdSet.has(it.id));
  const recSectionList = activeCat === 'all' && !hasQuery
    ? recItemsAll.map(it => Object.assign({}, it, { score: 1 }))
    : matchedRec;

  const bgCatPills = [
    { id: 'all', label: `🗂 全部 (${fullCat.length})` },
    { id: 'rec', label: `⭐ 本幕推荐 (${recItemsAll.length})` },
    { id: 'indoor', label: '🏠 室内/事务所' },
    { id: 'outdoor', label: '🏖 户外/自然/街道' },
    { id: 'evening_night', label: '🌆 黄昏/夜景' },
    { id: 'abstract', label: '✨ 特效/Logo' }
  ];

  let galleryHtml = '';
  if (activeCat === 'all' && !hasQuery) {
    galleryHtml = `
      <div class="bg-rec-section">
        <div class="bg-sec-hdr"><span>⭐ 剧情推荐候选背景（依据本幕时间/地点与氛围优先推荐）</span><span class="badge">${recSectionList.length} 张</span></div>
        <div class="bg-grid">${recSectionList.map(it => renderBgItemCardHtml(it, effectiveScope, sceneBg, st, false)).join('')}</div>
      </div>
      <div class="bg-all-section">
        <div class="bg-sec-hdr"><span>🗂️ 全部其余背景库（无截断完整展示 · 懒加载缩略图）</span><span class="badge">${matchedRest.length} 张</span></div>
        <div class="bg-grid bg-grid-all">${matchedRest.map(it => renderBgItemCardHtml(it, effectiveScope, sceneBg, st, false)).join('') || '<div class="insp-empty">暂无其余背景</div>'}</div>
      </div>`;
  } else {
    galleryHtml = `
      <div class="bg-all-section" style="margin-top:8px">
        <div class="bg-sec-hdr"><span>🔍 筛选结果</span><span class="badge">${matched.length} 张</span></div>
        <div class="bg-grid bg-grid-all">${matched.map(it => renderBgItemCardHtml(it, effectiveScope, sceneBg, st, hasQuery)).join('') || '<div class="insp-empty">没有匹配的背景</div>'}</div>
      </div>`;
  }

  let html = `<div class="sub-pill-switch">
    <button type="button" class="act-cat-btn on" data-bgaudio-sub="bg">🖼 背景图库与本地导图</button>
    <button type="button" class="act-cat-btn" data-bgaudio-sub="audio">🎵 配乐 BGM · 音效 SE · 源码</button>
  </div>` + lineHeader(i, l) + `<div class="cols">
   <div class="card" style="grid-column:1/-1">
    <div class="row-flex" style="margin-bottom:8px;flex-wrap:wrap;gap:6px">
      <span class="muted" style="font-weight:700">🎯 换景作用范围：</span>
      <div class="seg small" id="bgScopeSeg">
        <button type="button" data-bg-scope="scene" class="${effectiveScope === 'scene' ? 'on' : ''}" title="修改整幕开场默认背景（写入 setup_bg 第 0 帧，切幕立即显示无延迟）">📌 本幕默认背景（开场无延迟 · 当前 ${esc(sceneBg || '未设')}）</button>
        <button type="button" data-bg-scope="row" class="${effectiveScope === 'row' ? 'on' : ''}" title="仅在演到当前第 ${i + 1} 行时中途切换背景">📍 仅在第 ${i + 1} 行中途换景${l.bg && i > 0 ? `（本行覆盖：${esc(l.bg)}）` : ''}</button>
      </div>
      ${l.bg && i > 0 ? `<button type="button" class="chip-btn" id="btnClearRowBg" title="清除本行中途覆盖，恢复继承本幕默认背景">🧹 清除第 ${i + 1} 行背景覆盖</button>` : ''}
    </div>
    <div class="bg-cat-pills" id="bgCatPills">
      ${bgCatPills.map(p => `<button type="button" class="act-cat-btn ${activeCat === p.id ? 'on' : ''}" data-bg-cat="${esc(p.id)}">${esc(p.label)}</button>`).join('')}
    </div>
    <div class="row-flex"><input type="search" id="bgQuery" placeholder="🔍 语义搜背景（在全部 ${fullCat.length} 张中检索）：如「山路」「和室 旅馆」「下雨的天台」「傍晚 事务所」「海边」" value="${esc(S.bgQuery)}" style="flex:1"><button class="btn prism" id="btnUploadBgTop" type="button">📁 上传本地背景图</button><span class="muted">点选 = ${effectiveScope === 'scene' ? '设为本幕开场背景' : `写入第 ${i + 1} 行 bg`}（已完整显示 ${matched.length} / 总计 ${fullCat.length} 张）</span></div>
    ${galleryHtml}</div>
   <div class="card" style="grid-column:1/-1"><div class="sec-title">本地拖图预览</div><div class="dropzone" id="imgDrop">🖼 拖入本地图片（png / jpg / webp），或点击选择<br><small>→ 立即上舞台预览，并登记为包内素材 assets.bg（status: draft）</small></div><input type="file" id="imgFile" accept="image/*" hidden></div>
  </div>`;
  body.innerHTML = html;
  $$('[data-bgaudio-sub]', body).forEach(b => b.onclick = () => {
    S.tab = b.dataset.bgaudioSub === 'audio' ? 'audio' : 'bg';
    saveUi();
    renderInspector();
  });
  const q = $('#bgQuery', body);
  q.oninput = () => { S.bgQuery = q.value; const pos = q.selectionStart; renderInspector(); const nq = $('#bgQuery'); nq.focus(); nq.setSelectionRange(pos, pos); };
  $$('[data-bg-cat]', body).forEach(b => b.onclick = () => { S.bgCatFilter = b.dataset.bgCat; renderInspector(); });
  $$('[data-bg-scope]', body).forEach(b => b.onclick = () => { S.bgScope = b.dataset.bgScope; renderInspector(); });
  const clrBtn = $('#btnClearRowBg', body);
  if (clrBtn) {
    clrBtn.onclick = () => {
      exec(`清除第 ${i + 1} 行背景覆盖`, () => mutRow(i, ln => delete ln.bg));
      syncLoadDocToSpineStage(false);
      syncGotoLineToSpineStage(false);
      if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
        window.SCWorkflow.recompileSceneQuietly(160);
      }
      toast(`🧹 已清除第 ${i + 1} 行背景覆盖，恢复继承本幕默认背景`);
    };
  }
  $$('[data-bg]', body).forEach(b => b.onclick = () => applyBg(i, b.dataset.bg));
  const dz = $('#imgDrop', body), fi = $('#imgFile', body), upTop = $('#btnUploadBgTop', body);
  if (upTop) upTop.onclick = () => fi.click();
  dz.onclick = () => fi.click(); fi.onchange = () => fi.files[0] && addLocalImage(i, fi.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); }; dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); const f = [...e.dataTransfer.files].find(f => /^image\//.test(f.type)); if (f) addLocalImage(i, f); else toast('请拖入图片文件', 'warn'); };
}
function applyBg(i, id) {
  const effectiveScope = S.bgScope === 'scene' || S.bgScope === 'row' ? S.bgScope : (isSceneOpeningRow(i) ? 'scene' : 'row');
  if (effectiveScope === 'scene' && window.SCWorkflow && typeof window.SCWorkflow.setSceneEnv === 'function') {
    window.SCWorkflow.setSceneEnv({ bg: id }, { clearOpeningRowOverride: true });
    renderStage();
    renderTimeline();
    renderInspector();
    toast(`🖼 已设为本幕开场默认背景 → ${id}（第 0 帧立即生效无延迟）`);
    return;
  }
  exec(`更换背景 → ${id}`, () => mutRow(i, l => setK(l, 'bg', id)));
  syncLoadDocToSpineStage(false);
  syncGotoLineToSpineStage(false);
  if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
    window.SCWorkflow.recompileSceneQuietly(160);
  }
  toast(`🖼 第 ${i + 1} 行中途切换 bg = ${id}`);
}
function safeId(name) { return (name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'local_bg').slice(0, 40); }
function addLocalImage(i, file) {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      let id = 'local_' + safeId(file.name), k = 2; const bgs = (S.doc.pack.assets = S.doc.pack.assets || {}).bg || {};
      while (bgs[id] && !S.blobs['bg:' + id]) id = 'local_' + safeId(file.name) + '_' + (k++);
      S.blobs['bg:' + id] = fr.result;
      const ext = (file.name.match(/\.(png|jpe?g|webp)$/i) || [, 'png'])[1].toLowerCase().replace('jpeg', 'jpg');
      exec('拖入本地背景', () => {
        S.doc.pack.assets.bg = S.doc.pack.assets.bg || {};
        S.doc.pack.assets.bg[id] = { file: `assets/bg/${id}.${ext}`, title: file.name, origin: 'photo', status: 'draft', width: img.naturalWidth, height: img.naturalHeight };
        mutRow(i, l => setK(l, 'bg', id));
      });
      const pid = (S.doc && S.doc.pack && S.doc.pack.id) || '';
      if (pid) {
        fetch(`/api/studio/projects/${encodeURIComponent(pid)}/upload-asset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'bg', assetId: id, filename: file.name, title: file.name, width: img.naturalWidth, height: img.naturalHeight, dataUrl: fr.result })
        }).then(r => r.json()).then(d => {
          if (d && d.ok && d.project && d.project.assets && S.doc && S.doc.pack) {
            S.doc.pack.assets = d.project.assets;
            if (typeof syncLoadDocToSpineStage === 'function') syncLoadDocToSpineStage(false);
          }
        }).catch(() => {});
      }
      toast(`🖼 已登记 ${id}（${img.naturalWidth}×${img.naturalHeight}${img.naturalWidth / img.naturalHeight !== 1136 / 640 ? '，非 16:9 将居中裁切' : ''}）`);
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}

function clearRowBgmControl(rowIdx) {
  const row = S.doc && S.doc.rows && S.doc.rows[rowIdx];
  if (!row || !row.line) return;
  const ln0 = row.line;
  const beatId = (ln0._meta && (ln0._meta['x-beatId'] || ln0._meta.beatId)) || '';
  const wasAuto = Boolean(ln0._meta && ln0._meta['x-beatBgmAuto']);
  const oldBgm = ln0.bgm ? String(ln0.bgm) : '';
  stopBgm();
  exec(`关闭第 ${rowIdx + 1} 行 BGM 切换`, () => mutRow(rowIdx, ln => {
    delete ln.bgm;
    delete ln.bgmFadeTime;
    if (ln._meta) {
      delete ln._meta['x-beatBgmAuto'];
      delete ln._meta['x-bgmReason'];
      if (ln._meta.stageAction === 'bgm_stop' || ln._meta.stageAction === 'bgm_fade') {
        delete ln._meta.stageAction;
      }
    }
  }));
  if (beatId && window.SCWorkflow && typeof window.SCWorkflow.syncBeatBgmFromRow === 'function') {
    const sc = typeof window.SCWorkflow.getActiveScene === 'function' ? window.SCWorkflow.getActiveScene() : null;
    const seg = sc && Array.isArray(sc.segments) ? sc.segments.find(s => s && String(s.beatId) === String(beatId)) : null;
    if (wasAuto || (seg && seg.bgm && String(seg.bgm) === oldBgm)) {
      window.SCWorkflow.syncBeatBgmFromRow(beatId, '', '手动关闭本段切曲（延续上一首）');
    }
  }
  syncLoadDocToSpineStage(false);
  postToSpineStage({ type: 'sc-studio:bgm-control', action: 'resume' });
  if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
    window.SCWorkflow.recompileSceneQuietly(160);
  }
  renderStage();
  renderInspector();
  toast(`🧹 已关闭第 ${rowIdx + 1} 行 BGM 切换（锁定沿用上一首）`);
}

function setRowBgmControl(rowIdx, val, toastMsg) {
  const row = S.doc && S.doc.rows && S.doc.rows[rowIdx];
  if (!row || !row.line) return;
  const ln0 = row.line;
  const beatId = (ln0._meta && (ln0._meta['x-beatId'] || ln0._meta.beatId)) || '';
  const wasAuto = Boolean(ln0._meta && ln0._meta['x-beatBgmAuto']);
  exec(`设置 BGM → ${val}`, () => mutRow(rowIdx, ln => {
    setK(ln, 'bgm', val);
    if (ln._meta) {
      delete ln._meta['x-beatBgmAuto'];
      delete ln._meta['x-bgmReason'];
      if (ln._meta.stageAction === 'bgm_stop' || ln._meta.stageAction === 'bgm_fade') {
        delete ln._meta.stageAction;
      }
    }
  }));
  if (wasAuto && beatId && window.SCWorkflow && typeof window.SCWorkflow.syncBeatBgmFromRow === 'function') {
    window.SCWorkflow.syncBeatBgmFromRow(beatId, val, `第 ${rowIdx + 1} 行手动指定 → ${val}`);
  }
  syncLoadDocToSpineStage(false);
  postToSpineStage({ type: 'sc-studio:bgm-control', action: 'resume' });
  if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
    window.SCWorkflow.recompileSceneQuietly(160);
  }
  renderStage();
  renderInspector();
  toast(toastMsg || `🎵 第 ${rowIdx + 1} 行切曲 BGM = ${val}`);
}

/* ---------- Tab 4：BGM · 音效 · 源码 ---------- */
function matchesBgmFilterCat(it, filterId, recSet) {
  if (!filterId || filterId === 'all') return true;
  if (filterId === 'rec') return recSet.has(String(it.id));
  if (filterId === 'ambient') return it.category === 'ambient' || it.category === 'silence';
  const tags = Array.isArray(it.moodTags) ? it.moodTags : [];
  if (filterId === 'bright') return tags.some(t => t === 'upbeat' || t === 'happy' || t === 'warm' || t === 'comedy' || t === 'energetic' || t === 'daily') || /轻快|元气|日常|开心|搞笑|活力/.test(it.tags || '');
  if (filterId === 'mood') return tags.some(t => t === 'emotional' || t === 'tense' || t === 'sad' || t === 'calm') || /抒情|紧张|夜|感动|舒缓|钢琴|悲/.test(it.tags || '');
  return true;
}
function tabAudio(body) {
  const i = curIdx(), l = S.doc.rows[i].line, st = stageAt(i);
  const effectiveBgmScope = S.bgmScope === 'scene' || S.bgmScope === 'row' ? S.bgmScope : (isSceneOpeningRow(i) ? 'scene' : 'row');
  const sceneBgm = currentSceneDefaultBgm();
  const score = (q, it) => semScore(q, it.id + ' ' + it.title + ' ' + (it.desc || '') + ' ' + it.tags);
  const allBgms = bgmCatalog();
  const recBgms = recommendBgmsForActiveScene(6);
  const recBgmSet = new Set(recBgms.map(x => String(x.id)));
  const activeBgmCat = S.bgmCatFilter || 'all';
  const hasBgmQ = Boolean(S.bgmQuery.trim());
  const bgms = allBgms
    .filter(b => matchesBgmFilterCat(b, activeBgmCat, recBgmSet))
    .map(b => ({ ...b, s: score(S.bgmQuery, b) }))
    .filter(b => !hasBgmQ || b.s > .15)
    .sort((a, b) => hasBgmQ ? (b.s - a.s) : ((recBgmSet.has(b.id) ? 1 : 0) - (recBgmSet.has(a.id) ? 1 : 0) || (Number(b.curated) - Number(a.curated))));
  const ambientCount = allBgms.filter(b => b.category === 'ambient' || b.category === 'silence').length;
  const bgmCatPills = [
    { id: 'all', label: `🌟 全部 (${allBgms.length})` },
    { id: 'rec', label: `⭐ 本幕推荐 (${recBgmSet.size})` },
    { id: 'ambient', label: `🌿 环境底噪·蝉鸣 (${ambientCount})` },
    { id: 'bright', label: '☀️ 欢快/日常' },
    { id: 'mood', label: '🌙 抒情/紧张' }
  ];
  const seCats = M.seCategories || [
    { id: 'all', label: '🌟 全部音效 (40)' },
    { id: 'footstep_door', label: '🚪 脚步与开关门' },
    { id: 'weather_nature', label: '🌊 天气与自然环境' },
    { id: 'phone_daily', label: '📱 手机与日常物品' },
    { id: 'emotion_gag', label: '💥 情绪与吐槽搞笑' },
    { id: 'stage_applause', label: '✨ 舞台与欢呼掌声' },
    { id: 'clear', label: '🧹 清除本行音效' }
  ];
  const activeSeCat = S.audioSeCat || 'all';
  const ses = M.seLibrary
    .filter(s => activeSeCat === 'all' || (s.category || s.cat) === activeSeCat)
    .map(b => ({ ...b, s: score(S.seQuery, b) }))
    .filter(b => !S.seQuery.trim() || b.s > .15)
    .sort((a, b) => b.s - a.s);
  const curSeId = l.se !== undefined ? String(l.se) : '';
  const curSeObj = curSeId ? M.seLibrary.find(x => x.id === curSeId) : null;

  const activeAuditionId = (bgmAudio && !bgmAudio.paused && bgmCurrentId) ? String(bgmCurrentId) : '';
  const curRowBgmObj = l.bgm ? (allBgms.find(x => x.id === String(l.bgm)) || M.bgmLibrary.find(x => x.id === String(l.bgm))) : null;
  const curRowBgmLabel = l.bgm === 'fade_out' ? '淡出 fade_out' : l.bgm === 'off' ? '停止 off' : (curRowBgmObj ? `${l.bgm} · ${curRowBgmObj.title}` : (l.bgm || ''));
  const hasRowBgmSwitch = Boolean(l.bgm && i > 0);
  const rowBgmAlertHtml = hasRowBgmSwitch ? `
    <div class="bgm-row-alert">
      <span>${(l._meta && l._meta['x-beatBgmAuto'])
        ? `⚡ <b>第 ${i + 1} 行触发了剧情自动切曲</b>：<code>${esc(curRowBgmLabel)}</code>${l._meta['x-bgmReason'] ? `（${esc(l._meta['x-bgmReason'])}）` : ''}`
        : `📍 <b>第 ${i + 1} 行设置了单独切曲</b>：<code>${esc(curRowBgmLabel)}</code>`}</span>
      <button type="button" class="chip-btn danger" id="btnClearRowBgm">🧹 关闭本行切曲（沿用上一首）</button>
    </div>` : '';
  body.innerHTML = `<div class="sub-pill-switch">
    <button type="button" class="act-cat-btn" data-bgaudio-sub="bg">🖼 背景图库与本地导图</button>
    <button type="button" class="act-cat-btn on" data-bgaudio-sub="audio">🎵 配乐 BGM · 音效 SE · 源码</button>
  </div><div class="audio-cols">
   <div style="display:flex;flex-direction:column;gap:10px;min-width:0">
    <div class="card">
     <div class="sec-title">🎵 BGM（本幕开场：${esc(sceneBgm || '无')} · 当前第 ${i + 1} 行生效：${esc(st.bgm || '无')} · 共 ${allBgms.length} 首）</div>
     ${rowBgmAlertHtml}
     <div class="row-flex" style="margin-bottom:6px;flex-wrap:wrap;gap:6px">
       <div class="seg small" id="bgmScopeSeg">
         <button type="button" data-bgm-scope="scene" class="${effectiveBgmScope === 'scene' ? 'on' : ''}">📌 设为本幕开场 BGM</button>
         <button type="button" data-bgm-scope="row" class="${effectiveBgmScope === 'row' ? 'on' : ''}">📍 仅在第 ${i + 1} 行中途切曲/淡出${hasRowBgmSwitch ? `（${esc(l.bgm)}）` : ''}</button>
       </div>
     </div>
     <div class="act-cat-tabs" style="margin-bottom:6px">
       ${bgmCatPills.map(p => `<button type="button" class="act-cat-btn ${activeBgmCat === p.id ? 'on' : ''}" data-bgm-cat="${esc(p.id)}">${esc(p.label)}</button>`).join('')}
     </div>
     <input type="search" id="bgmQ" placeholder="🔍 语义搜：温柔 钢琴 / 蝉鸣 环境 / 紧张 / 演唱会 / 0001" value="${esc(S.bgmQuery)}" style="width:100%">
     <div class="lib-list" style="margin-top:6px">${bgms.map(b => {
       const isAud = activeAuditionId === String(b.id);
       const badge = b.kindTag || (b.category === 'ambient' ? '🌿环境音' : '🎵配乐');
       const dur = typeof b.durationSec === 'number' && b.durationSec > 0 ? `${Math.round(b.durationSec)}s` : '';
       const isRec = recBgmSet.has(String(b.id));
       const cleanTagStr = (b.tags && String(b.tags).startsWith(String(b.title || '')))
         ? String(b.tags).slice(String(b.title || '').length).trim()
         : String(b.tags || '').trim();
       return `<div class="lib-item ${(effectiveBgmScope === 'scene' ? sceneBgm === b.id : st.bgm === b.id) ? 'on' : ''}"><code>${esc(b.id)}</code><span class="t"><b>${isRec ? '⭐ ' : ''}${esc(b.title)}</b><span class="tag-sub">${esc(badge)}${dur ? ` · ${dur}` : ''}${cleanTagStr ? ` · ${esc(cleanTagStr)}` : ''}</span></span><button data-bgm-play="${esc(b.id)}" class="${isAud ? 'on' : ''}">${isAud ? '⏹ 停止' : '▶ 试听'}</button><button data-bgm-set="${esc(b.id)}">${effectiveBgmScope === 'scene' ? '设为本幕BGM' : '本行切曲'}</button></div>`;
     }).join('') || '<div class="insp-empty">没有匹配的曲目或环境音</div>'}
     <div class="lib-item"><span class="t muted">中途控制（作用于第 ${i + 1} 行）</span><button data-bgm-ctrl="fade_out">淡出 fade_out</button><button data-bgm-ctrl="off">停止 off</button></div></div></div>
    <div class="card">
     <div class="row-flex" style="justify-content:space-between;margin-bottom:6px">
       <div class="sec-title" style="margin:0">🔔 音效（SE）中文情景分类面板（当前：${curSeId ? `SE ${esc(curSeId)} · ${esc(curSeObj ? curSeObj.title : '')}` : '无'}）</div>
       <button class="chip-btn" data-se-clear="1" ${curSeId ? '' : 'disabled'}>🧹 清除本行音效</button>
     </div>
     <div class="act-cat-tabs" style="margin-bottom:6px">
       ${seCats.map(c => `<button type="button" class="act-cat-btn ${activeSeCat === c.id ? 'on' : ''}" data-audio-se-cat="${esc(c.id)}" title="${esc(c.desc || c.label)}">${esc(c.label)}</button>`).join('')}
     </div>
     <input type="search" id="seQ" placeholder="🔍 搜索音效：推门 / 海浪 / 蝉鸣 / 气泡音 / 欢呼 / 快门…" value="${esc(S.seQuery)}" style="width:100%">
     <div class="lib-list" style="margin-top:6px">${ses.map(b => {
       const seSub = b.desc || b.tags || '';
       return `<div class="lib-item ${curSeId === b.id ? 'on' : ''}"><code>${b.id}</code><span class="t"><b>${esc(b.title)}</b>${seSub ? `<span class="tag-sub">${esc(seSub)}</span>` : ''}</span><button data-se-play="${b.id}">🔊 试听</button><button data-se-set="${b.id}">${curSeId === b.id ? '✓ 已挂入' : '＋ 挂入本幕'}</button></div>`;
     }).join('')}</div>
    </div>
   </div>
   <div class="src-wrap card">
    <div class="row-flex"><div class="seg small" id="srcSeg"><button data-s="yaml" class="${S.srcTab === 'yaml' ? 'on' : ''}">.scs.yaml</button><button data-s="json" class="${S.srcTab === 'json' ? 'on' : ''}">.scproj.json</button><button data-s="official" class="${S.srcTab === 'official' ? 'on' : ''}">官方裸数组（只读）</button></div><span class="grow"></span><span class="muted" style="font-size:11px">实时双向同步 · 编辑停顿 0.6s 自动应用（进撤销栈）</span></div>
    <textarea class="src-editor" id="srcEd" spellcheck="false" ${S.srcTab === 'official' ? 'readonly' : ''}></textarea>
    <div class="src-status" id="srcStatus">与文档同步</div>
   </div></div>`;
  const keepFocus = (id, key) => { const q = $(id, body); q.oninput = () => { S[key] = q.value; const p = q.selectionStart; renderInspector(); const n = $(id); n.focus(); n.setSelectionRange(p, p); }; };
  $$('[data-bgaudio-sub]', body).forEach(b => b.onclick = () => {
    S.tab = b.dataset.bgaudioSub === 'audio' ? 'audio' : 'bg';
    saveUi();
    renderInspector();
  });
  keepFocus('#bgmQ', 'bgmQuery'); keepFocus('#seQ', 'seQuery');
  $$('[data-bgm-cat]', body).forEach(b => b.onclick = () => { S.bgmCatFilter = b.dataset.bgmCat; renderInspector(); });
  $$('[data-bgm-scope]', body).forEach(b => b.onclick = () => { S.bgmScope = b.dataset.bgmScope; renderInspector(); });
  const clrBgmBtn = $('#btnClearRowBgm', body);
  if (clrBgmBtn) {
    clrBgmBtn.onclick = () => clearRowBgmControl(i);
  }
  $$('[data-bgm-play]', body).forEach(b => b.onclick = () => playBgmPreview(b.dataset.bgmPlay, 0, { force: true }));
  $$('[data-bgm-set]', body).forEach(b => b.onclick = () => {
    const val = b.dataset.bgmSet;
    stopBgm();
    if (effectiveBgmScope === 'scene' && window.SCWorkflow && typeof window.SCWorkflow.setSceneEnv === 'function') {
      window.SCWorkflow.setSceneEnv({ bgm: val }, { clearOpeningRowOverride: true, resumeStageBgm: true });
      renderStage();
      renderTimeline();
      renderInspector();
      toast(`🎵 已设为本幕开场默认 BGM → ${val}`);
      return;
    }
    setRowBgmControl(i, val, `🎵 第 ${i + 1} 行切曲 BGM = ${val}`);
  });
  $$('[data-bgm-ctrl]', body).forEach(b => b.onclick = () => {
    const val = b.dataset.bgmCtrl;
    stopBgm();
    setRowBgmControl(i, val, `🎵 第 ${i + 1} 行已设置 BGM ${val}`);
  });
  $$('[data-audio-se-cat]', body).forEach(b => b.onclick = () => {
    const cid = b.dataset.audioSeCat;
    if (cid === 'clear') {
      exec('🧹 清除本行音效', () => mutRow(i, l => delete l.se));
      syncLoadDocToSpineStage(false);
      if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
        window.SCWorkflow.recompileSceneQuietly(160);
      }
      toast('🧹 已清除本行音效');
      return;
    }
    S.audioSeCat = cid;
    renderInspector();
  });
  $$('[data-se-play]', body).forEach(b => b.onclick = () => playSe(b.dataset.sePlay));
  $$('[data-se-set]', body).forEach(b => b.onclick = () => {
    const sid = b.dataset.seSet;
    const seObj = (M.seLibrary || []).find(x => x.id === sid);
    exec(`挂入音效 → SE ${sid}`, () => mutRow(i, l => setK(l, 'se', sid)));
    playSe(sid);
    syncLoadDocToSpineStage(false);
    if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
      window.SCWorkflow.recompileSceneQuietly(160);
    }
    toast(`🔔 已挂入音效「${seObj ? seObj.title : sid}」(SE ${sid}) 并同步至舞台！`);
  });
  $$('[data-se-clear]', body).forEach(b => b.onclick = () => {
    exec('🧹 清除本行音效', () => mutRow(i, l => delete l.se));
    syncLoadDocToSpineStage(false);
    if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
      window.SCWorkflow.recompileSceneQuietly(160);
    }
    toast('🧹 已清除本行音效');
  });
  $$('#srcSeg button', body).forEach(b => b.onclick = () => { S.srcTab = b.dataset.s; renderInspector(); });
  const ed = $('#srcEd', body);
  ed.value = S.srcTab === 'yaml' ? toYaml() : S.srcTab === 'json' ? toScprojText() : JSON.stringify(toOfficial(), null, 2);
  let t = null;
  ed.oninput = () => { clearTimeout(t); $('#srcStatus').className = 'src-status'; $('#srcStatus').textContent = '编辑中…'; t = setTimeout(() => applySource(ed.value), 600); };
  ed.onblur = () => { clearTimeout(t); if (S.srcTab !== 'official') applySource(ed.value, true); };
}

/* ---------- Tab 5：🤖 导演助手 (Director Co-pilot) ---------- */
function applyDirectorPatchOpsToLines(rowsCopy, patchOps) {
  const mkRow = (lineObj, idx) => ({ key: 'dir_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6), line: lineObj });
  let list = rowsCopy.slice();
  const findIdx = (rowIndex, rowId) => {
    if (rowId) {
      const hit = list.findIndex(r => r && r.line && r.line._meta && r.line._meta.uid === rowId);
      if (hit >= 0) return hit;
    }
    return Number.isInteger(rowIndex) && rowIndex >= 0 && rowIndex < list.length ? rowIndex : -1;
  };
  let envPatch = null;
  for (const op of (patchOps || [])) {
    if (!op || typeof op !== 'object') continue;
    if (op.op === 'set_scene_env') {
      envPatch = { ...(envPatch || {}), ...(op.bg ? { bg: op.bg } : {}), ...(op.bgm ? { bgm: op.bgm } : {}) };
      if (list[0] && list[0].line) {
        if (op.bg) list[0].line.bg = op.bg;
        if (op.bgm) list[0].line.bgm = op.bgm;
      }
    } else if (op.op === 'update_rows' && Array.isArray(op.updates)) {
      for (const u of op.updates) {
        const idx = findIdx(u.rowIndex, u.rowId);
        if (idx < 0) continue;
        const ln = list[idx].line;
        if (u.text !== undefined) ln.text = u.text;
        if (u.zh !== undefined) { ln._meta = ln._meta || {}; ln._meta.zh = u.zh; }
        if (u.emotion !== undefined) { ln._meta = ln._meta || {}; ln._meta.emotion = u.emotion; }
        if (u.anim1 !== undefined) { if (u.anim1) ln.charAnim1 = u.anim1; else delete ln.charAnim1; }
        if (u.anim2 !== undefined && u.anim2) ln.charAnim2 = u.anim2;
        if (u.anim4 !== undefined && u.anim4) ln.charAnim4 = u.anim4;
        if (u.bgm !== undefined) ln.bgm = u.bgm;
        if (u.se !== undefined) ln.se = u.se;
        if (u.note !== undefined) { ln._meta = ln._meta || {}; ln._meta.note = u.note; }
      }
    } else if ((op.op === 'insert_cue' || op.op === 'apply_archetype')) {
      const insertAt = Math.min(list.length, Math.max(0, (Number.isInteger(op.afterRowIndex) ? op.afterRowIndex : 0) + 1));
      const newItems = [];
      if (op.op === 'apply_archetype' && Array.isArray(op.rows)) {
        op.rows.forEach((r, k) => {
          const lineObj = r.kind === 'cue'
            ? { waitType: 'time', waitTime: 180, textFrame: 'off', _meta: { uid: r.rowId || `cue_${Date.now()}_${k}`, kind: 'cue', cue: r.cue, note: r.note || '' } }
            : { speaker: r.speaker || 'off', text: r.text || '……', textFrame: r.offScreen ? 'off' : '001', ...(r.bgm ? { bgm: r.bgm } : {}), _meta: { uid: r.rowId || `dlg_${Date.now()}_${k}`, zh: r.zh || r.text || '', note: r.note || '' } };
          newItems.push(mkRow(lineObj, k));
        });
      } else if (op.cue) {
        newItems.push(mkRow({ waitType: 'time', waitTime: 180, textFrame: 'off', _meta: { uid: `cue_${Date.now()}`, kind: 'cue', cue: op.cue, note: op.note || '' } }, 0));
      }
      if (newItems.length) list.splice(insertAt, 0, ...newItems);
    } else if (op.op === 'delete_rows') {
      const idSet = new Set(op.rowIds || []);
      const idxSet = new Set(op.rowIndices || []);
      list = list.filter((r, idx) => !idxSet.has(idx) && !(r && r.line && r.line._meta && idSet.has(r.line._meta.uid)));
    }
  }
  return { rows: list, envPatch };
}

function summarizeDirectorPatchOp(op) {
  if (!op || !op.op) return '未知操作';
  if (op.op === 'set_scene_env') return `环境调整：${op.bg ? `BG → ${op.bg} ` : ''}${op.bgm ? `BGM → ${op.bgm}` : ''}`;
  if (op.op === 'update_rows') return `台词/动作微调：共修改 ${(op.updates || []).length} 行`;
  if (op.op === 'apply_archetype') return `套用走位原型 [${op.archetype}]：插入 ${(op.rows || []).length} 行调度`;
  if (op.op === 'insert_cue') return `插入 Cue 调度：${op.note || ((op.cue && op.cue.steps ? op.cue.steps.length : 0) + ' 步')}`;
  if (op.op === 'delete_rows') return `删除行：${(op.rowIndices || []).length + (op.rowIds || []).length} 处`;
  return op.op;
}

function openDirectorDrawer() {
  const dr = $('#directorDrawer');
  const bd = $('#directorDrawerBody');
  if (!dr || !bd) return;
  dr.hidden = false;
  renderDirectorToContainer(bd);
}
function closeDirectorDrawer() {
  const dr = $('#directorDrawer');
  if (dr) dr.hidden = true;
}
function refreshDirectorDrawerIfOpen() {
  const dr = $('#directorDrawer');
  const bd = $('#directorDrawerBody');
  if (dr && !dr.hidden && bd) renderDirectorToContainer(bd);
}
function tabDirector(body) {
  return renderDirectorToContainer(body);
}
function renderDirectorToContainer(body) {
  if (!body) return;
  const i = curIdx();
  const row = S.doc.rows[i] ? S.doc.rows[i].line : {};
  const cast = [...new Set(S.doc.rows.map(r => charOfLine(r.line)).filter(Boolean))];
  const st = stageAt(i);
  const ds = S.directorState || (S.directorState = { prompt: '', loading: false, result: null, error: '' });
  const quickChips = [
    { label: '🛡 防乱晃稳态', prompt: '请分析当前片段并清除连续重复情绪动作，保持站位稳态' },
    { label: '🏃 编排追击走位', prompt: '在当前选定行之后按「追击/跑出再冲回 (chase_pursuit)」原型编排走位' },
    { label: '🎭 OOC 与台词润色', prompt: '检查当前选中台词的人设口癖与称呼，给出 OOC 润色建议' },
    { label: '🎨 配景与配乐推荐', prompt: '根据当前剧情氛围推荐最匹配的官方 BG 和 BGM' }
  ];

  const res = ds.result;
  const ops = (res && Array.isArray(res.patchOps)) ? res.patchOps : [];
  const recBgs = (res && res.recommendations && res.recommendations.bgs) || [];
  const recBgms = (res && res.recommendations && res.recommendations.bgms) || [];

  const rerenderDirectorUi = () => {
    if (S.tab === 'director') renderInspector();
    refreshDirectorDrawerIfOpen();
  };

  body.innerHTML = `<div class="card">
    <div class="sec-title">🤖 导演助手（聚焦第 ${i + 1} 行 · 角色：${esc(cast.join(' / ') || '无')} · BG ${esc(st.bg || '无')} · BGM ${esc(st.bgm || '无')}）</div>
    <div class="row-flex" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">
      ${quickChips.map((c, idx) => `<button type="button" class="chip-btn" data-dir-chip="${idx}">${esc(c.label)}</button>`).join('')}
    </div>
    <textarea id="dirPromptInput" rows="3" placeholder="输入导演指令，例如：让冬优子气呼呼地靠近一步，或推荐更紧张的 BGM…" style="width:100%;box-sizing:border-box">${esc(ds.prompt || '')}</textarea>
    <div class="row-flex" style="margin-top:6px;gap:8px;justify-content:flex-end">
      <button type="button" class="btn primary" id="btnDirSend" ${ds.loading ? 'disabled' : ''}>${ds.loading ? '⏳ 思考与校验中…' : '✨ 发送给导演助手'}</button>
    </div>
  </div>
  ${ds.error ? `<div class="callout warn" style="margin-top:8px">${esc(ds.error)}</div>` : ''}
  ${res ? `<div class="card" style="margin-top:8px">
    <div class="row-flex" style="justify-content:space-between;margin-bottom:6px">
      <div class="sec-title" style="margin:0">🎬 导演建议（${res.mode === 'llm' ? esc(res.model || 'LLM') : '本地规则引擎'}）</div>
      ${res.llmWarning ? `<span class="muted" style="font-size:11px">已自动兜底：${esc(res.llmWarning)}</span>` : ''}
    </div>
    <div style="white-space:pre-wrap;font-size:13px;line-height:1.55">${esc(res.reply || '')}</div>
    ${(recBgs.length || recBgms.length) ? `<div style="margin-top:8px;font-size:12px" class="muted">
      ${recBgs.length ? `<div>推荐背景：${recBgs.map(b => `<code>${esc(b.id)}</code> ${esc(b.title || '')}`).join(' · ')}</div>` : ''}
      ${recBgms.length ? `<div>推荐配乐：${recBgms.map(b => `<code>${esc(b.id)}</code> ${esc(b.title || '')}`).join(' · ')}</div>` : ''}
    </div>` : ''}
    ${ops.length ? `<div style="margin-top:10px;border-top:1px solid var(--line,rgba(128,128,128,.2));padding-top:8px">
      <div class="sec-title" style="margin-bottom:6px">📋 建议补丁预览（${ops.length} 项）</div>
      <ul style="margin:0 0 8px 16px;padding:0;font-size:12px">${ops.map(op => `<li>${esc(summarizeDirectorPatchOp(op))}</li>`).join('')}</ul>
      <div class="row-flex" style="gap:8px">
        <button type="button" class="btn" id="btnDirPreview">👁 临时预览此段</button>
        <button type="button" class="btn primary" id="btnDirApply">✓ 采纳补丁（可 Ctrl+Z 撤销）</button>
      </div>
    </div>` : ''}
  </div>` : ''}`;

  const inp = $('#dirPromptInput', body);
  if (inp) inp.oninput = () => { ds.prompt = inp.value; };
  $$('[data-dir-chip]', body).forEach(b => b.onclick = () => {
    const chip = quickChips[+b.dataset.dirChip];
    if (!chip) return;
    ds.prompt = chip.prompt;
    if (inp) inp.value = chip.prompt;
    $('#btnDirSend', body).click();
  });
  const btnSend = $('#btnDirSend', body);
  if (btnSend) btnSend.onclick = async () => {
    const msg = (ds.prompt || '').trim();
    if (!msg) return toast('请先输入导演指令');
    ds.loading = true;
    ds.error = '';
    rerenderDirectorUi();
    try {
      let llmConfig = {};
      if (window.StudioWorkflow && typeof window.StudioWorkflow.getLlmConfig === 'function') {
        llmConfig = window.StudioWorkflow.getLlmConfig('agent') || {};
      } else {
        try { llmConfig = (JSON.parse(localStorage.getItem(LS.settings) || '{}').llm) || {}; } catch (_) {}
      }
      const sc = window.SCWorkflow && typeof window.SCWorkflow.getActiveScene === 'function' ? window.SCWorkflow.getActiveScene() : null;
      const scriptRows = S.doc.rows.map((r, idx) => ({
        rowId: (r.line._meta && r.line._meta.uid) || `row_${idx}`,
        kind: (r.line._meta && r.line._meta.kind) || (kindOf(r.line) === 'direction' ? 'cue' : 'dialogue'),
        charLabel: charOfLine(r.line) || '',
        speaker: r.line.speaker || '',
        emotion: (r.line._meta && r.line._meta.emotion) || 'joy',
        anim1: r.line.charAnim1 || '',
        text: r.line.text || '',
        zh: (r.line._meta && r.line._meta.zh) || r.line.text || '',
        note: (r.line._meta && r.line._meta.note) || ''
      }));
      const resp = await fetch('/api/studio/director-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: (sc && sc.id) || S.doc.meta.id,
          bg: (sc && sc.bg) || st.bg || '00003',
          bgm: (sc && sc.bgm) || st.bgm || '0029',
          cast: (sc && sc.cast && sc.cast.length) ? sc.cast : cast,
          selectedRowIds: [(row._meta && row._meta.uid) || `row_${i}`],
          scriptRows,
          message: msg,
          llmConfig
        })
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || '请求失败');
      ds.result = data;
    } catch (err) {
      ds.error = '导演助手请求失败：' + (err && err.message ? err.message : err);
    } finally {
      ds.loading = false;
      rerenderDirectorUi();
    }
  };
  const btnPrev = $('#btnDirPreview', body);
  if (btnPrev && ops.length) btnPrev.onclick = () => {
    const cloned = S.doc.rows.map(r => ({ key: r.key, line: JSON.parse(JSON.stringify(r.line)) }));
    const { rows: nextRows } = applyDirectorPatchOpsToLines(cloned, ops);
    const lines = nextRows.map(r => canonLine(r.line));
    postToSpineStage({ type: 'sc-studio:load-doc', id: S.doc.meta.id, lines, index: Math.min(i, Math.max(0, lines.length - 1)), play: true, auto: true });
    toast('👁 已发送临时补丁至 :18899 舞台预览（未修改磁盘文件）');
  };
  const btnApply = $('#btnDirApply', body);
  if (btnApply && ops.length) btnApply.onclick = () => {
    let envPatch = null;
    exec('🤖 导演助手采纳补丁', () => {
      const cloned = S.doc.rows.map(r => ({ key: r.key, line: JSON.parse(JSON.stringify(r.line)) }));
      const out = applyDirectorPatchOpsToLines(cloned, ops);
      S.doc.rows = out.rows;
      envPatch = out.envPatch;
      if (S.doc.rows.length && !S.doc.rows.some(r => r.key === S.selKey)) {
        S.selKey = S.doc.rows[0].key;
      }
    });
    if (envPatch && window.SCWorkflow && typeof window.SCWorkflow.setSceneEnv === 'function') {
      window.SCWorkflow.setSceneEnv(envPatch, { recompile: false });
    }
    syncLoadDocToSpineStage(false);
    if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
      window.SCWorkflow.recompileSceneQuietly(160);
    }
    rerenderDirectorUi();
    toast('✓ 已采纳导演助手补丁（可用 Ctrl+Z 撤销）');
  };
}

/* ============================== 序列化：规范形 / 简写 / 官方 ============================== */
function canonLine(l) {
  const o = {};
  for (const k of Object.keys(l)) if (k !== '_meta') o[k] = l[k];
  if (l._meta && Object.keys(l._meta).length) { const m = {}; for (const k of Object.keys(l._meta).sort()) m[k] = l._meta[k]; o._meta = m; }
  return o;
}
function envelope() {
  const h = S.doc.head, env = {};
  if (h.$schema) env.$schema = h.$schema;
  env.format = 'scproj'; env.formatVersion = 2; env.meta = S.doc.meta; env.lines = S.doc.rows.map(r => canonLine(r.line));
  return env;
}
function toScprojText() {
  const env = envelope();
  const head = JSON.stringify({ ...env, lines: '__LINES__' }, null, 2);
  return head.replace('"__LINES__"', '[\n' + env.lines.map(l => '    ' + JSON.stringify(l)).join(',\n') + '\n  ]');
}
const toOfficial = () => S.doc.rows.map(r => { const o = {}; for (const k of Object.keys(r.line)) if (k !== '_meta') o[k] = r.line[k]; return o; });
function decompileItem(l) {
  const off = {}; for (const k of Object.keys(l)) if (k !== '_meta') off[k] = l[k];
  const item = {};
  if (Object.keys(off).some(k => RESERVED.has(k))) item.raw = off; else Object.assign(item, off);
  const m = l._meta || {}, xs = {};
  for (const k of Object.keys(m).sort()) { if (META_KEYS.includes(k)) item[k] = m[k]; else xs[k] = m[k]; }
  if (Object.keys(xs).length) item._meta = xs;
  return item;
}
const yq = v => JSON.stringify(v); // JSON 是 YAML 1.2 的合法子集
function flowY(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return '{ ' + Object.entries(v).map(([k, x]) => (/^[A-Za-z_$][\w$-]*$/.test(k) ? k : yq(k)) + ': ' + flowY(x)).join(', ') + ' }';
  if (Array.isArray(v)) return '[' + v.map(flowY).join(', ') + ']';
  return yq(v);
}
function toYaml() {
  const out = ['# scproj v2 简写（.scs.yaml）· 原型反编译视图（§4.7，verbatim 语义：不做自动补全）', '# 每个条目一行流式映射，可直接编辑；也接受 "说话人@label(face,anim,lip): 台词 || 中文" 与 "#bg id" 指令', 'scs: 2', 'meta: ' + flowY(S.doc.meta), 'lines:'];
  S.doc.rows.forEach(r => out.push('  - ' + flowY(decompileItem(r.line))));
  return out.join('\n') + '\n';
}
/* ---- 迷你 YAML 流式解析器（YAML 1.2 core：00889 会变成数字 889，所以素材 id 要加引号） ---- */
function parseFlow(src) {
  let p = 0; const s = src;
  const ws = () => { while (p < s.length && /[\s]/.test(s[p])) p++; };
  const err = m => { throw new Error(`${m}（第 ${p + 1} 个字符附近）`); };
  function scalar(plain) {
    if (plain === 'true') return true; if (plain === 'false') return false; if (plain === 'null' || plain === '~' || plain === '') return null;
    if (/^[-+]?[0-9]+$/.test(plain)) return parseInt(plain, 10);
    if (/^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(plain)) return parseFloat(plain);
    return plain;
  }
  function str() {
    const q = s[p];
    if (q === '"') { let e = p + 1; while (e < s.length && s[e] !== '"') { if (s[e] === '\\') e++; e++; } if (e >= s.length) err('双引号未闭合'); const v = JSON.parse(s.slice(p, e + 1)); p = e + 1; return v; }
    let v = ''; p++; while (p < s.length) { if (s[p] === "'") { if (s[p + 1] === "'") { v += "'"; p += 2; continue; } p++; return v; } v += s[p++]; } err('单引号未闭合');
  }
  function plainTok(stops) { let st = p; while (p < s.length && !stops.test(s[p]) && !(s[p] === ':' && /[\s,\]}]/.test(s[p + 1] || ' '))) p++; return s.slice(st, p).trim(); }
  function val() {
    ws(); const c = s[p];
    if (c === '{') { p++; const o = {}; ws(); if (s[p] === '}') { p++; return o; } for (;;) { ws(); const k = (s[p] === '"' || s[p] === "'") ? str() : plainTok(/[,}\]]/); ws(); if (s[p] !== ':') err('映射缺少冒号'); p++; o[k] = val(); ws(); if (s[p] === ',') { p++; continue; } if (s[p] === '}') { p++; return o; } err('映射未闭合'); } }
    if (c === '[') { p++; const a = []; ws(); if (s[p] === ']') { p++; return a; } for (;;) { a.push(val()); ws(); if (s[p] === ',') { p++; continue; } if (s[p] === ']') { p++; return a; } err('序列未闭合'); } }
    if (c === '"' || c === "'") return str();
    return scalar(plainTok(/[,}\]]/));
  }
  const v = val(); ws(); if (p < s.length) err('多余内容');
  return v;
}
function sayParts(s) {
  const i = s.search(/[:：]/); if (i < 0) throw new Error('say 字符串缺少「:」：' + s);
  const head = s.slice(0, i).trim(); let body = s.slice(i + 1).replace(/^ /, ''), zh;
  const zi = body.indexOf(' || '); if (zi >= 0) { zh = body.slice(zi + 4); body = body.slice(0, zi); }
  const hm = head.match(/^([^@(]*)(?:@([A-Za-z0-9_-]+))?(?:\(([^)]*)\))?$/); if (!hm) throw new Error('say 头部无法解析：' + head);
  const o = { speaker: hm[1].trim() };
  if (hm[2] && hm[2] !== 'none' && hm[2] !== 'off') o.charLabel = hm[2];
  if (hm[3]) { const [f, a, lp] = hm[3].split(',').map(x => x.trim()); if (f && f !== '-') o.charAnim2 = /^face_|^blank$/.test(f) ? f : 'face_' + f; if (a && a !== '-') o.charAnim1 = a; if (lp && lp !== '-') o.charLipAnim = /^lip_|^blank$/.test(lp) ? lp : 'lip_' + lp; }
  o.text = body;
  return { line: o, zh };
}
function compileItem(it, warn) {
  if (typeof it === 'string') {
    if (it.startsWith('#')) {
      const [d, ...rest] = it.slice(1).split(/\s+/); const a = rest.join(' ');
      const map = { bg: 'bg', bgm: 'bgm', se: 'se', movie: 'movie', frame: 'textFrame', label: 'label', jump: 'nextLabel' };
      if (map[d]) return [{ [map[d]]: a }];
      if (d === 'wait') return [/^\d+$/.test(a) ? { waitType: 'time', waitTime: +a } : { waitType: a }];
      if (d === 'exit') return a.split(',').map(x => ({ charLabel: x.trim(), charEffect: { type: 'to', alpha: 0, time: 100 } }));
      if (d === 'enter') return [{ charLabel: a, charEffect: { type: 'from', alpha: 0, time: 100 } }];
      throw new Error('未知指令 #' + d);
    }
    const { line, zh } = sayParts(it); if (zh !== undefined) line._meta = { zh }; return [line];
  }
  if (!it || typeof it !== 'object' || Array.isArray(it)) throw new Error('条目必须是映射或字符串');
  if (it.choices) return it.choices.map((c, n, arr) => { const l = { select: c.text, nextLabel: c.jump }; if (n === arr.length - 1 && arr.length > 1) l.textCtrl = 'cm'; if (c.zh) l._meta = { selectZh: c.zh }; return l; });
  let line = {}; const m = {};
  for (const [k, v] of Object.entries(it)) {
    if (k === 'say') { const sp = sayParts(v); Object.assign(line, sp.line); if (sp.zh !== undefined) m.zh = sp.zh; }
    else if (META_KEYS.includes(k) || ALIASES[k]) m[ALIASES[k] || k] = v;
    else if (k === '_meta') Object.assign(m, v);
    else if (k === 'raw') Object.assign(line, v);
    else if (k === 'char') line.charLabel = v;
    else if (k === 'face') line.charAnim2 = /^face_/.test(v) ? v : 'face_' + v;
    else if (k === 'anim') line.charAnim1 = v;
    else if (k === 'lip') line.charLipAnim = /^lip_/.test(v) ? v : 'lip_' + v;
    else if (/^anim[345]$/.test(k)) line['charAnim' + k.slice(4)] = v;
    else if (k === 'jump') line.nextLabel = v;
    else if (k === 'wait') { if (typeof v === 'number') { line.waitType = 'time'; line.waitTime = v; } else line.waitType = v; }
    else if (k === 'autoWait') line.autoWaitTime = v;
    else if (k === 'bgmFade') line.bgmFadeTime = v;
    else if (k === 'pos') line.charPosition = Array.isArray(v) ? { x: v[0], y: v[1] ?? 640 } : v;
    else if (k === 'effect') line.charEffect = v === 'in' ? { type: 'from', alpha: 0, time: 100 } : v === 'out' ? { type: 'to', alpha: 0, time: 100 } : v;
    else {
      if (['bg', 'bgm', 'se', 'charId', 'textFrame', 'stillId', 'fg', 'middleFg', 'movie', 'voice'].includes(k) && typeof v === 'number') warn.push(`${k}: ${v} 被解析成数字（YAML 会丢前导零），建议加引号`);
      line[k] = v;
    }
  }
  if (Object.keys(m).length) line._meta = m;
  return [line];
}
function parseYamlDoc(text) {
  const out = { meta: null, lines: [], warn: [] }; let inLines = false, scs = null;
  text.split(/\r?\n/).forEach((raw, n) => {
    const ln = raw.replace(/\s+$/, '');
    if (!ln.trim() || /^\s*#/.test(raw)) return;
    try {
      let mm;
      if ((mm = ln.match(/^scs:\s*(.+)$/))) { scs = parseFlow(mm[1]); return; }
      if ((mm = ln.match(/^meta:\s*(.+)$/))) { out.meta = parseFlow(mm[1]); return; }
      if (/^lines:\s*$/.test(ln)) { inLines = true; return; }
      if (inLines && (mm = ln.match(/^\s+-\s+(.+)$/))) { out.lines.push(...compileItem(parseFlow(mm[1]), out.warn)); return; }
      throw new Error('原型解析器只支持单行流式条目（完整 YAML 1.2 块语法在 Phase 2 接 _ref/scs_ref.js）');
    } catch (e) { throw new Error(`第 ${n + 1} 行：${e.message}`); }
  });
  if (scs !== 2) out.warn.push('缺少 scs: 2（将按 authoring v1 语义处理）');
  if (!out.meta || !out.meta.id) throw new Error('缺少 meta.id');
  if (!out.lines.length) throw new Error('lines 至少 1 行');
  return out;
}
function applySource(text, final) {
  const stEl = $('#srcStatus');
  try {
    let meta2, lines, warn = [];
    if (S.srcTab === 'yaml') { const r = parseYamlDoc(text); meta2 = r.meta; lines = r.lines; warn = r.warn; }
    else if (S.srcTab === 'json') { const j = JSON.parse(text); if (j.format !== 'scproj' || !Array.isArray(j.lines)) throw new Error('需要 envelope：{format:"scproj", formatVersion:2, meta, lines}'); meta2 = j.meta; lines = j.lines; }
    else return;
    const curLines = JSON.stringify(S.doc.rows.map(r => canonLine(r.line))), newLines = JSON.stringify(lines.map(canonLine));
    if (curLines === newLines && JSON.stringify(meta2) === JSON.stringify(S.doc.meta)) { if (stEl) { stEl.className = 'src-status ok'; stEl.textContent = '✓ 与文档一致' + (warn.length ? ' · ⚠ ' + warn.join('；') : ''); } return; }
    const old = S.doc.rows, byUid = {}; old.forEach(r => { const u = (r.line._meta || {}).uid; if (u) byUid[u] = r.key; });
    exec(`源码编辑（${S.srcTab === 'yaml' ? '.scs.yaml' : '.scproj.json'}）`, () => {
      S.doc.meta = meta2;
      const used = new Set();
      S.doc.rows = lines.map((l, n) => { const u = (l._meta || {}).uid; let key = (u && byUid[u]) || (old[n] && old[n].key); if (!key || used.has(key)) key = newKey(); used.add(key); return { key, line: l }; });
      if (idxOf(S.selKey) < 0) S.selKey = S.doc.rows[0].key;
    }, { render: false });
    renderHeader(); renderScript(); renderStage(); renderTimeline(); renderMuse();
    if (final) renderInspector();
    if (stEl) { stEl.className = 'src-status ok'; stEl.textContent = `✓ 已应用到文档（${lines.length} 行）` + (warn.length ? ' · ⚠ ' + warn.join('；') : ''); }
  } catch (e) { if (stEl) { stEl.className = 'src-status err'; stEl.textContent = '✗ ' + e.message + '（未应用，文档保持不变）'; } }
}

/* ============================== 音频（WebAudio 合成示意，无外部文件） ============================== */
let AC = null;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, t0, dur, type = 'sine', gain = .08, dest) {
  const a = ac(), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g).connect(dest || a.destination); o.start(t0); o.stop(t0 + dur + .03); return o;
}
function noise(t0, dur, freq = 800, gain = .1, type = 'bandpass') {
  const a = ac(), n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / n);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; f.type = type; f.frequency.value = freq; g.gain.value = gain; s.connect(f).connect(g).connect(a.destination); s.start(t0);
}
function playSeSynth(id) {
  const s = M.seLibrary.find(x => x.id === String(id)), t = ac().currentTime + .02, k = s ? s.kind : 'drop';
  if (k === 'drop') { const o = tone(1400, t, .25, 'sine', .15); o.frequency.exponentialRampToValueAtTime(500, t + .2); tone(1800, t + .3, .2, 'sine', .08); }
  else if (k === 'door') { noise(t, .35, 400, .5, 'lowpass'); tone(110, t + .05, .3, 'square', .05); }
  else if (k === 'step') { [0, .28, .56].forEach(d => noise(t + d, .08, 300, .6, 'lowpass')); }
  else if (k === 'wind') noise(t, 1.4, 600, .35);
  else if (k === 'heart') { [0, .22, .9, 1.12].forEach(d => tone(62, t + d, .16, 'sine', .5)); }
  else if (k === 'buzz') { for (let d = 0; d < .5; d += .1) tone(170, t + d, .07, 'square', .06); }
  else if (k === 'sparkle') { [0, 4, 7, 12, 16].forEach((s2, n) => tone(1046 * 2 ** (s2 / 12), t + n * .05, .4, 'sine', .07)); }
}
let seAudio = null;
function playSe(id) {
  if (!id) return;
  if (seAudio) { try { seAudio.pause(); } catch {} seAudio = null; }
  const a = new Audio(`/se-event/${encodeURIComponent(String(id))}.m4a`);
  seAudio = a;
  a.play().catch(() => playSeSynth(id));
}
let bgmTimer = null, bgmAudio = null, bgmCurrentId = null;
function syncBgmPlayButtons() {
  const activeId = (bgmAudio && !bgmAudio.paused && bgmCurrentId) ? String(bgmCurrentId) : '';
  $$('[data-bgm-play]').forEach(btn => {
    const on = !!(activeId && btn.dataset.bgmPlay === activeId);
    btn.classList.toggle('on', on);
    btn.textContent = on ? '⏹ 停止' : '▶ 试听';
  });
  const sceneAudBtn = $('#btnSceneBgmAudition');
  const sumAudBtn = $('#btnSceneBgmSummaryAudition');
  const sceneSel = $('#sceneDefaultBgmSelect');
  const curSceneBgmId = (sceneSel && sceneSel.value) || (sumAudBtn && sumAudBtn.dataset.bgmId) || '';
  [sceneAudBtn, sumAudBtn].forEach(btn => {
    if (!btn) return;
    const on = !!(activeId && curSceneBgmId && curSceneBgmId === activeId);
    btn.classList.toggle('on', on);
    btn.textContent = on ? '⏹ 停止' : '▶ 试听';
  });
  $$('[data-outline-bgm-play]').forEach(btn => {
    const cardEl = btn.closest('.outline-card');
    const sel = cardEl && cardEl.querySelector('select[data-field="bgm"]');
    const targetId = sel ? sel.value : btn.dataset.outlineBgmPlay;
    const on = !!(activeId && targetId && targetId === activeId);
    btn.classList.toggle('on', on);
    btn.textContent = on ? '⏹ 停止' : '▶ 试听';
  });
}
function stopBgm(opts = {}) {
  clearTimeout(bgmTimer); bgmTimer = null;
  bgmCurrentId = null;
  if (bgmAudio) { try { bgmAudio.pause(); } catch {} bgmAudio = null; }
  syncBgmPlayButtons();
  if (opts && opts.resumeStage) {
    postToSpineStage({ type: 'sc-studio:bgm-control', action: 'resume' });
  }
}
function playBgmPreview(id, seconds = 0, opts = {}) {
  const cleanId = id != null ? String(id).trim() : '';
  const prevId = (bgmAudio && !bgmAudio.paused && bgmCurrentId) ? String(bgmCurrentId) : null;
  stopBgm();
  if (!cleanId || ['fade_out', 'off', 'pause', '0000'].includes(cleanId)) {
    if (opts.force) toast('ℹ️ 当前项为空或控制指令（off/fade_out），无需试听');
    return;
  }
  if (opts.force && prevId === cleanId) {
    postToSpineStage({ type: 'sc-studio:bgm-control', action: 'pause' });
    toast(`⏹ 已停止试听 BGM ${cleanId}（主舞台配乐保持暂停，选定曲目或点击台词恢复）`);
    return;
  }
  const spineWrap = document.getElementById('realSpineContainer');
  if (!opts.force && spineWrap && !spineWrap.hidden) return;
  if (opts.force) {
    if (S.preview) stopPreview();
    stopSubtimelinePlay();
    if (seAudio) { try { seAudio.pause(); } catch {} seAudio = null; }
    stopRealAudio();
    postToSpineStage({ type: 'sc-studio:bgm-control', action: 'pause' });
  }
  const a = new Audio(`/bgm/${encodeURIComponent(cleanId)}.m4a`);
  a.volume = 0.35;
  a.loop = !(seconds > 0);
  a.addEventListener('ended', () => { if (bgmAudio === a) stopBgm(); });
  bgmAudio = a;
  bgmCurrentId = cleanId;
  if (seconds > 0) bgmTimer = setTimeout(() => { if (bgmAudio === a) stopBgm(); }, seconds * 1000);
  if (opts.force) toast(`🎵 正在试听 BGM ${cleanId}（已暂停主舞台配乐，再点停止）`);
  a.play().catch((err) => {
    if (bgmAudio === a) stopBgm();
    if (opts.force) toast(`⚠️ BGM ${cleanId} 试听失败：${err && err.message ? err.message : '音频文件不存在或被浏览器拦截'}`);
  });
  syncBgmPlayButtons();
}
function getBgmAuditionState() {
  return {
    auditionId: bgmCurrentId || null,
    auditionPlaying: !!(bgmAudio && !bgmAudio.paused),
    spineStageBgm: S.spineStageBgmState || null
  };
}

/* ============================== 连续预览 ============================== */
function togglePreview() { S.preview ? stopPreview() : startPreview(); }
function startPreview() {
  stopTableRead(true);
  if (bgmAudio) stopBgm();
  if (TX) commit();
  ac();
  S.preview = { i: curIdx(), timer: null, typing: null, waiting: false, speaking: null };
  const st = stageAt(curIdx()); if (st.bgm) playBgmPreview(st.bgm, 0);
  $('#btnPreview').innerHTML = '■<span class="lbl"> 停止预览</span>';
  previewStep();
}
function stopPreview(msg) {
  const p = S.preview; if (!p) return;
  clearTimeout(p.timer); clearTimeout(p.audioTimer); clearTimeout(p.watchdog); clearInterval(p.typing);
  if (S.previewAudio) { try { S.previewAudio.pause(); S.previewAudio.currentTime = 0; } catch (_) {} S.previewAudio = null; }
  stopBgm();
  S.preview = null; $('#btnPreview').innerHTML = '▶<span class="lbl"> 连续预览</span>';
  $$('.row.playing').forEach(e => e.classList.remove('playing'));
  renderStage(); if (msg) toast(msg);
}
function previewStep() {
  const p = S.preview; if (!p) return;
  clearTimeout(p.timer); clearInterval(p.typing);
  const R = S.doc.rows;
  if (p.i >= R.length) return stopPreview('■ 预览结束');
  const r = R[p.i], l = r.line, k = kindOf(l), m = l._meta || {};
  S.selKey = r.key;
  $$('.row.cur, .row.playing').forEach(e => e.classList.remove('cur', 'playing'));
  const re = $(`.row[data-key="${r.key}"]`); if (re) { re.classList.add('cur', 'playing'); re.scrollIntoView({ block: 'nearest' }); }
  const st = stageAt(p.i);
  p.speaking = k === 'dialogue' ? st.speaking : null;
  renderStage({ typing: k === 'dialogue' }); renderTimeline();
  if (S.spineStageSyncedSig !== snap()) syncLoadDocToSpineStage(false);
  syncGotoLineToSpineStage(true);
  if (l.se !== undefined) playSe(l.se);
  if (l.bgm !== undefined) { if (['fade_out', 'off', 'pause', '0000'].includes(String(l.bgm))) stopBgm(); else playBgmPreview(l.bgm, 0); }
  if (k === 'select') { p.waiting = true; p.speaking = null; return; }
  const dur = estDur(l);
  const gapMs = Math.max(STUDIO_POST_LINE_GAP_MS, Number(m.holdMs) || 0);
  const fxMinMs = specialFxDur(l);
  if (k === 'dialogue') {
    const jp = $('#stJp'), full = l.text, arr = Array.from(full); let n = 0;
    let typingDone = arr.length === 0;
    let audioDone = false;
    let advanced = false;
    const finishDialogue = () => {
      if (S.preview !== p || advanced || !typingDone || !audioDone) return;
      advanced = true;
      clearTimeout(p.watchdog);
      p.timer = setTimeout(previewAdvance, Math.max(gapMs, fxMinMs));
    };
    const per = Math.max(22, Math.min(55, (700 + jlen(full) * 65) / Math.max(1, arr.length)));
    if (jp && arr.length > 0) {
      p.typing = setInterval(() => {
        n++;
        jp.textContent = arr.slice(0, n).join('');
        if (n >= arr.length) {
          clearInterval(p.typing); p.typing = null; p.speaking = null;
          renderStageTextKeep(full);
          typingDone = true;
          finishDialogue();
        }
      }, per);
    } else {
      typingDone = true;
    }
    const t = (m.takes || []).find(t => t.id === m.takeSelected);
    const vRef = (t && t.voice) || l.voice;
    const fallbackMs = Math.max(t && t.durationMs > 600 ? t.durationMs : 0, Math.round(arr.length * per + 250));
    let fallbackArmed = false;
    const waitSilent = () => {
      if (S.preview !== p || advanced || fallbackArmed) return;
      fallbackArmed = true;
      clearTimeout(p.audioTimer);
      p.audioTimer = setTimeout(() => { audioDone = true; finishDialogue(); }, fallbackMs);
    };
    if (vRef) {
      let a = null;
      try { a = playRealAudio(vRef, waitSilent); } catch (_) { a = null; }
      if (a && typeof a.addEventListener === 'function') {
        S.previewAudio = a;
        const onAudioEnd = () => {
          if (S.previewAudio === a) S.previewAudio = null;
          audioDone = true;
          finishDialogue();
        };
        a.addEventListener('ended', onAudioEnd, { once: true });
        a.addEventListener('error', waitSilent, { once: true });
        a.addEventListener('pause', () => { if (a.ended) onAudioEnd(); }, { once: true });
      } else {
        waitSilent();
      }
    } else {
      waitSilent();
    }
    p.watchdog = setTimeout(() => {
      if (S.preview === p && !advanced) { typingDone = true; audioDone = true; finishDialogue(); }
    }, 25000);
    return;
  }
  p.timer = setTimeout(previewAdvance, dur);
}
function renderStageTextKeep(full) { const sp = S.preview; if (!sp) return; $$('.st-char.speaking').forEach(e => e.classList.remove('speaking')); const jp = $('#stJp'); if (jp) jp.textContent = full; }
function previewAdvance() {
  const p = S.preview; if (!p || p.waiting) return;
  const l = S.doc.rows[p.i].line;
  if (l.nextLabel !== undefined && kindOf(l) !== 'select') { const j = findLabel(l.nextLabel); p.i = j >= 0 ? j + 1 : p.i + 1; }
  else p.i++;
  previewStep();
}
function previewSkip() { const p = S.preview; if (!p || p.waiting) return; previewAdvance(); }

/* ============================== 弹窗 / 浮层 / 提示 ============================== */
function toast(msg, kind = '') {
  const t = el(`<div class="toast ${kind}">${esc(msg)}</div>`); $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 2600);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function openModal(html, onMount) {
  $('#modal').innerHTML = html; $('#modalBack').hidden = false;
  $$('[data-close]', $('#modal')).forEach(b => b.onclick = closeModal);
  if (onMount) onMount($('#modal'));
}
function closeModal() { $('#modalBack').hidden = true; $('#modal').innerHTML = ''; }
function closePopover() { $('#popover').hidden = true; }
function showFlagPopover(anchor, i, f) {
  const pv = $('#popover'), l = S.doc.rows[i].line;
  let diff = '';
  if (f.fix && f.fix.kind === 'replace') diff = `<div class="pv-diff">${esc(l.text).replace(esc(f.from), `<del>${esc(f.from)}</del><ins>${esc(f.to)}</ins>`)}</div>`;
  if (f.fix && f.fix.kind === 'split') { const [a, b] = splitText(l.text); diff = `<div class="pv-diff">${esc(a)}<br><ins>↵ 新行：</ins>${esc(b)}</div>`; }
  if (f.fix && f.fix.kind === 'reading') diff = `<div class="pv-diff">ttsText：<ins>${esc(applyReadings((l._meta || {}).ttsText ?? l.text))}</ins></div>`;
  pv.innerHTML = `<div class="pv-title"><span class="pill ${f.sev}">${esc(f.title)}</span><span class="mono muted">${esc(f.code)}</span></div><div>${esc(f.message)}</div>${diff}<div class="pv-act"><button class="btn" id="pvWaive">${f.waived ? '恢复检查' : '忽略（写入 oocFlags.waived）'}</button>${f.fix && !f.waived ? '<button class="btn primary" id="pvFix">一键修复</button>' : ''}</div>`;
  pv.hidden = false;
  const r = anchor.getBoundingClientRect();
  pv.style.left = clamp(r.left, 8, innerWidth - 310) + 'px';
  pv.style.top = (r.bottom + 6 + 220 > innerHeight ? Math.max(8, r.top - pv.offsetHeight - 6) : r.bottom + 6) + 'px';
  $('#pvWaive').onclick = () => { closePopover(); waiveFlag(i, f); };
  const fx = $('#pvFix'); if (fx) fx.onclick = () => { closePopover(); applyFix(i, f); };
}
function runChecks() {
  const R = S.doc.rows.map(r => r.line), res = [];
  const uids = R.map(l => (l._meta || {}).uid).filter(Boolean), dup = uids.filter((u, n) => uids.indexOf(u) !== n);
  res.push(['V3', 'uid 故事内唯一', !dup.length, dup.join(', ')]);
  const labels = new Set(R.filter(l => l.label !== undefined).map(l => l.label)), badJ = R.filter(l => l.nextLabel !== undefined && !labels.has(l.nextLabel)).map(l => l.nextLabel);
  res.push(['V4', '每个 nextLabel 都有 label', !badJ.length, badJ.join(', ')]);
  const v5 = R.filter(l => { const m = l._meta || {}; if (!m.takeSelected) return false; const t = (m.takes || []).find(t => t.id === m.takeSelected); return !t || t.voice !== l.voice; });
  res.push(['V5', 'takeSelected 的 voice == 行 voice', !v5.length, v5.length + ' 行']);
  const v6 = R.filter(l => { const ids = ((l._meta || {}).takes || []).map(t => t.id); return new Set(ids).size !== ids.length; });
  res.push(['V6', 'takes[].id 唯一', !v6.length, v6.length + ' 行']);
  const v7 = R.filter(l => l.select !== undefined && l.nextLabel === undefined);
  res.push(['V7', 'select 行都有 nextLabel', !v7.length, v7.length + ' 行']);
  const creds = []; (function scan(o, p) { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (CRED_KEYS.test(k)) creds.push(p + k); scan(v, p + k + '.'); } })({ pack: S.doc.pack, story: envelope() }, '');
  res.push(['V12', '包内无凭据键', !creds.length, creds.join(', ')]);
  const knownBgs = new Set(bgCatalog().map(b => String(b.id)));
  const knownBgms = new Set(bgmCatalog().map(b => String(b.id)));
  const badBg = R.filter(l => l.bg && l.bg !== 'off' && !knownBgs.has(String(l.bg))).map(l => String(l.bg));
  const badBgm = R.filter(l => l.bgm && !['off', 'fade_out'].includes(String(l.bgm)) && !knownBgms.has(String(l.bgm))).map(l => String(l.bgm));
  res.push(['V13', 'BG 资源已收录（warn）', !badBg.length, [...new Set(badBg)].join(', '), true]);
  res.push(['V14', 'BGM 资源已收录（warn）', !badBgm.length, [...new Set(badBgm)].join(', '), true]);
  const v15 = R.filter(l => { const m = l._meta || {}; const cur = m.ttsText ?? l.text; return (m.takes || []).some(t => t.text !== undefined && t.text !== cur); });
  res.push(['V15', 'Take 未过期（warn）', !v15.length, v15.length + ' 行', true]);
  const seen = new Set(); let v17 = []; R.forEach((l, n) => { const id = (l._meta || {}).macroId; if (id && seen.has(id) && (R[n - 1]._meta || {}).macroId !== id) v17.push(id); if (id) seen.add(id); });
  res.push(['V17', '同一宏实例连续（warn）', !v17.length, v17.join(', '), true]);
  let ooc = 0; R.forEach(l => ooc += activeIssues(l).filter(f => f.sev !== 'info').length);
  res.push(['OOC', '无未处理的 OOC 问题（warn）', !ooc, ooc + ' 处', true]);
  return res;
}
function download(name, text, type = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function openExport() {
  if (TX) commit();
  const id = S.doc.meta.id, checks = runChecks(), hardFail = checks.some(c => !c[2] && !c[4]);
  openModal(`<div class="modal-head"><h2>🎥 导出</h2><span class="muted">${esc(S.doc.pack.id)}.scpack / ${esc(id)}</span><span class="grow"></span><button class="ibtn" data-close>✕</button></div>
  <div class="modal-body">
    <div class="sec-title">导出前检查（§7 语义规则子集）</div>
    <ul class="check-list">${checks.map(([c, t, ok, d, w]) => `<li><span class="${ok ? 'ok' : w ? 'wn' : 'bad'}">${ok ? '✓' : w ? '⚠' : '✗'}</span><b class="mono">${c}</b><span>${esc(t)}</span>${!ok && d ? `<span class="muted">— ${esc(d)}</span>` : ''}</li>`).join('')}</ul>
    ${hardFail ? '<div class="callout warn">存在 error 级问题：仍可导出草稿，但正式发布前请修复。</div>' : ''}
    <div class="sec-title">选择格式</div>
    <div class="exp-grid">
      <button class="exp-card" data-exp="scproj"><b>📄 .scproj.json</b><small>规范形 envelope（_meta 行末、键排序），编辑器权威格式</small></button>
      <button class="exp-card" data-exp="yaml"><b>📝 .scs.yaml</b><small>简写（verbatim 反编译视图）</small></button>
      <button class="exp-card" data-exp="official"><b>🗂 官方裸数组</b><small>toOfficial：删除全部 _meta，可直接喂 enza 播放器</small></button>
      <button class="exp-card" data-exp="pack"><b>📦 pack.json</b><small>工程包 manifest（含幕列表与资源索引，无凭据）</small></button>
      <button class="exp-card" data-exp="merged"><b>🎞 合并全工程 .scproj.json</b><small>按顺序合并所有幕并重排连续行号，适合一次性整片播放</small></button>
      <button class="exp-card" data-exp="packzip"><b>🗜 完整工程包 (.scpack.zip)</b><small>打包全部幕 + 自传图片与配音，分享或迁移到云端可直接导入</small></button>
      <button class="exp-card" data-exp="video"><b>🎬 舞台实机录制 MP4 / WebM</b><small>切换到舞台分镜，通过 OBS / 浏览器实机渲染导出视频</small></button>
    </div>
  </div><div class="modal-foot"><button class="btn" data-close>关闭</button></div>`, m => {
    $$('[data-exp]', m).forEach(b => b.onclick = () => {
      const k = b.dataset.exp;
      if (k === 'scproj') download(id + '.scproj.json', toScprojText() + '\n');
      if (k === 'yaml') download(id + '.scs.yaml', toYaml(), 'text/yaml');
      if (k === 'official') download(id + '.json', JSON.stringify(toOfficial(), null, 2));
      if (k === 'pack') download('pack.json', JSON.stringify(S.doc.pack, null, 2) + '\n');
      if (k === 'merged') {
        closeModal();
        if (window.StudioWorkflow && typeof window.StudioWorkflow.exportMergedProjectScproj === 'function') {
          window.StudioWorkflow.exportMergedProjectScproj();
        } else {
          toast('⚠ 合并导出功能尚未就绪', 'warn');
        }
        return;
      }
      if (k === 'packzip') {
        closeModal();
        if (window.StudioWorkflow && typeof window.StudioWorkflow.exportPackZip === 'function') {
          window.StudioWorkflow.exportPackZip();
        } else {
          const pid = encodeURIComponent((S.doc && S.doc.pack && S.doc.pack.id) || 'island_survival_pack');
          window.location.href = `/api/studio/projects/${pid}/export-zip`;
        }
        return;
      }
      if (k === 'video') {
        closeModal();
        setMode('stage');
        if (window.StudioWorkflow && typeof window.StudioWorkflow.triggerStageRecording === 'function') {
          window.StudioWorkflow.triggerStageRecording();
        } else {
          toast('🎬 已切到舞台分镜，请点击上方录制按钮开始导出', 'ok');
        }
        return;
      }
      toast('⬇ 已导出 ' + b.querySelector('b').textContent.replace(/^\S+\s/, ''));
    });
  });
}
function openHistory() {
  const items = S.undo.map((c, n) => `<div class="${n === S.undo.length - 1 ? 'now' : ''}" data-u="${n}">↶ ${esc(c.label)} <span class="muted">${esc(c.at || '')}</span></div>`).join('') + S.redo.slice().reverse().map((c, n) => `<div class="future" data-r="${n}">↷ ${esc(c.label)}</div>`).join('');
  openModal(`<div class="modal-head"><h2>操作历史（命令栈）</h2><span class="grow"></span><button class="ibtn" data-close>✕</button></div><div class="modal-body"><div class="muted">点任意一条跳到该状态（等价于连续撤销 / 重做）。共 ${S.undo.length} 步可撤销、${S.redo.length} 步可重做。</div><div class="hist-list">${items || '<div class="muted">（还没有操作）</div>'}</div></div>`, m => {
    $$('[data-u]', m).forEach(d => d.onclick = () => { const n = +d.dataset.u; while (S.undo.length - 1 > n) undo(); closeModal(); });
    $$('[data-r]', m).forEach(d => d.onclick = () => { const n = +d.dataset.r; for (let k = 0; k <= n; k++) redo(); closeModal(); });
  });
}

/* ============================== 第 1 步 · 大纲规划面板 ============================== */
function renderMuse() {
  const box = $('#musePanel'); box.hidden = S.mode !== 'muse';
  const sl = $('#scriptList'); if (sl) sl.hidden = S.mode === 'muse';
  const s2t = $('#step2Toolbar'); if (s2t) s2t.hidden = S.mode === 'muse';
  if (S.mode !== 'muse') return;
  if (window.StudioWorkflow && typeof window.StudioWorkflow.renderStep1OutlinePanel === 'function') {
    window.StudioWorkflow.renderStep1OutlinePanel(box);
  }
}

/* ============================== 行级命令 ============================== */
function addLine() {
  if (TX) commit();
  const i = curIdx(), l = S.doc.rows[i].line, base = kindOf(l) === 'dialogue' ? l : null;
  const nl = { id: nextId() };
  if (base) { nl.speaker = base.speaker; if (base.charLabel && !isProducer(base.speaker)) nl.charLabel = base.charLabel; } else nl.speaker = 'プロデューサー';
  nl.text = ''; nl.textCtrl = 'p'; nl.textFrame = (isProducer(nl.speaker) || !nl.speaker) ? '002' : '001';
  nl._meta = { uid: newUid(), origin: 'custom' };
  if (base && base._meta && base._meta.mode && nl.charLabel) nl._meta.mode = base._meta.mode;
  const curBeat = beatOf(i);
  if (curBeat) {
    nl._meta['x-beatId'] = curBeat.beatId;
    nl._meta['x-beatTitle'] = curBeat.beatTitle;
  }
  let made; exec('插入台词', () => { [made] = insertRows(i + 1, [nl]); S.selKey = made.key; });
  setTimeout(() => { const t = $(`.row[data-key="${made.key}"] textarea.ja`); if (t) t.focus(); }, 0);
}
function revealDirectionsIfHidden(focusRowKey = '') {
  if (typeof document === 'undefined' || !document.body || !document.body.classList.contains('hide-directions')) return false;
  if (window.StudioWorkflow && typeof window.StudioWorkflow.setDirectionsVisible === 'function') {
    window.StudioWorkflow.setDirectionsVisible(true, { persist: true, forceRerender: true });
  } else {
    document.body.classList.remove('hide-directions');
    ['btnToggleDirections', 'btnToggleDirectionsStep3'].forEach(id => {
      const b = document.getElementById(id);
      if (b) { b.classList.add('on'); b.textContent = '🎬 隐藏分镜'; }
    });
    renderScript();
  }
  if (focusRowKey) {
    const madeEl = $(`.row[data-key="${focusRowKey}"]`);
    if (madeEl) madeEl.scrollIntoView({ block: 'nearest' });
  }
  return true;
}
function addDirection() {
  if (TX) commit();
  const i = curIdx(); let made;
  exec('插入演出行', () => { [made] = insertRows(i + 1, [{ waitType: 'time', waitTime: 500, textFrame: 'off', _meta: { uid: newUid(), origin: 'custom' } }]); S.selKey = made.key; });
  revealDirectionsIfHidden(made && made.key);
}
function moveRow(i, d) {
  const R = S.doc.rows;
  if (!R[i]) return;
  let j = i + d;
  while (j >= 0 && j < R.length && R[j] && R[j].line && R[j].line._meta && (R[j].line._meta['x-autoGenerated'] || R[j].line._meta.autoGenerated)) {
    j += d;
  }
  if (j < 0 || j >= R.length) return;
  const touchesCue = kindOf(R[i].line) === 'cue' || kindOf(R[j].line) === 'cue' || R.some(x => kindOf(x.line) === 'cue');
  exec(d < 0 ? '上移行' : '下移行', () => { [R[i], R[j]] = [R[j], R[i]]; });
  if (touchesCue && window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
    window.SCWorkflow.recompileSceneQuietly(60);
  }
}
function dupRow(i) {
  const src = clone(S.doc.rows[i].line);
  if (src.id !== undefined) { const o = { id: nextId() }; for (const k of Object.keys(src)) if (k !== 'id') o[k] = src[k]; Object.keys(src).forEach(k => delete src[k]); Object.assign(src, o); }
  const m = meta(src); m.uid = newUid(); delete m.takes; delete m.takeSelected; delete m.macroId; delete m.macroArgs; if (m.origin === 'official') m.origin = 'edited';
  if (src.voice) delete src.voice;
  const mm = src._meta; delete src._meta; src._meta = mm; cleanMeta(src);
  let made; exec('复制行', () => { [made] = insertRows(i + 1, [src]); S.selKey = made.key; });
}
function delRow(i) {
  if (S.doc.rows.length <= 1) return toast('至少保留 1 行（lines ≥ 1）', 'warn');
  const target = S.doc.rows[i];
  const uid = target && target.line && target.line._meta ? target.line._meta.uid : '';
  const isCue = target && kindOf(target.line) === 'cue';
  exec(`删除第 ${i + 1} 行`, () => {
    S.doc.rows.splice(i, 1);
    if (isCue && uid) {
      for (let k = S.doc.rows.length - 1; k >= 0; k--) {
        const m = S.doc.rows[k].line && S.doc.rows[k].line._meta;
        if (m && m.cueChildOf === uid) S.doc.rows.splice(k, 1);
      }
    }
    S.selKey = S.doc.rows[Math.min(i, S.doc.rows.length - 1)].key;
  });
  if ((isCue || S.doc.rows.some(x => kindOf(x.line) === 'cue')) && window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
    window.SCWorkflow.recompileSceneQuietly(60);
  }
  toast('已删除（Ctrl+Z 可撤销）');
}
function insertCueAfterRow(i) {
  if (TX) commit();
  const R = S.doc.rows;
  const st = stageAt(i);
  const srcLine = R[i] ? R[i].line : {};
  const srcMeta = srcLine._meta || {};
  const castKeys = Object.keys(S.doc.pack.characters || {});
  const defaultLb = charOfLine(srcLine) || (st.cast && st.cast[0]) || castKeys[0] || 'amana';
  const curChar = st.chars && st.chars[defaultLb];
  const startX = (curChar && curChar.x != null) ? Math.round(curChar.x) : 568;
  const startSlot = CUE_SLOTS.reduce((best, sl) => Math.abs(sl.x - startX) < Math.abs(best.x - startX) ? sl : best, CUE_SLOTS[3]).id;
  const cueObj = {
    timing: 'separate',
    delayMs: 0,
    transition: 'none',
    steps: [{
      mode: 'seq',
      charLabel: defaultLb,
      toSlot: startSlot,
      toX: startX,
      durationMs: 500,
      speedPreset: 'normal',
      gaze: ''
    }]
  };
  let insAt = i + 1;
  while (insAt < R.length && R[insAt].line && R[insAt].line._meta && (R[insAt].line._meta['x-autoGenerated'] || R[insAt].line._meta.autoGenerated)) insAt++;
  let made;
  exec('插入 🎬 动作拍', () => {
    [made] = insertRows(insAt, [{
      textFrame: 'off',
      waitType: 'time',
      waitTime: 500,
      _meta: {
        uid: 'cue_' + newUid(),
        rowKind: 'cue',
        cue: cueObj,
        note: '',
        ...(srcMeta['x-beatId'] ? { 'x-beatId': srcMeta['x-beatId'] } : {}),
        ...(srcMeta['x-beatTitle'] ? { 'x-beatTitle': srcMeta['x-beatTitle'] } : {})
      }
    }]);
    S.selKey = made.key;
  });
  revealDirectionsIfHidden(made && made.key);
  if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
    window.SCWorkflow.recompileSceneQuietly(60);
  }
  toast('🎬 已插入动作拍卡片，可在标尺上直接拖拽角色位置');
}
function syncTableReadBtn() {
  const btn = $('#btnStep2TableRead');
  if (!btn) return;
  const on = Boolean(S.tableRead);
  btn.classList.toggle('playing', on);
  btn.textContent = on ? '⏹ 停止连读' : '▶ 连读本幕';
}
function stopTableRead(silent = true) {
  if (!S.tableRead) return;
  clearTimeout(S.tableRead.timer);
  S.tableRead = null;
  stopRealAudio();
  syncTableReadBtn();
  if (!silent) toast('⏹ 已停止本幕连读');
}
function stepTableRead() {
  const tr = S.tableRead;
  if (!tr || !S.doc || !Array.isArray(S.doc.rows)) return stopTableRead(true);
  const R = S.doc.rows;
  while (tr.i < R.length) {
    const k = kindOf(R[tr.i].line);
    if (k === 'dialogue' || k === 'select') break;
    tr.i++;
  }
  if (tr.i >= R.length) {
    stopTableRead(true);
    toast('✓ 本幕台本连读完毕');
    return;
  }
  const idx = tr.i;
  const rowObj = R[idx];
  const ln = rowObj.line;
  selectRow(rowObj.key, { scroll: true, autoSpeak: false });
  const advance = (delayMs) => {
    if (!S.tableRead || S.tableRead !== tr) return;
    clearTimeout(tr.timer);
    tr.timer = setTimeout(() => {
      if (!S.tableRead || S.tableRead !== tr) return;
      tr.i = idx + 1;
      stepTableRead();
    }, delayMs);
  };
  const canPlayVoice = Boolean(ln && ln.voice && !(ln._meta && ln._meta.voiceStale));
  if (canPlayVoice) {
    const a = playRealAudio(ln.voice, () => advance(1200), { rowKey: rowObj.key });
    if (a) {
      let advanced = false;
      const doneOnce = () => {
        if (advanced) return;
        advanced = true;
        advance(260);
      };
      a.addEventListener('ended', doneOnce, { once: true });
      a.addEventListener('error', doneOnce, { once: true });
      tr.timer = setTimeout(doneOnce, 18000);
    } else {
      advance(1200);
    }
  } else {
    const txtLen = jlen(ln.text || ln.select || (ln._meta && ln._meta.zh) || '');
    const silentWait = clamp(Math.round(950 + txtLen * 52), 1150, 2600);
    advance(silentWait);
  }
}
function startTableRead() {
  if (!S.doc || !Array.isArray(S.doc.rows) || !S.doc.rows.length) return;
  if (S.preview) stopPreview();
  if (bgmAudio) stopBgm();
  stopRealAudio();
  const startIdx = curIdx();
  S.tableRead = { i: startIdx, timer: null };
  syncTableReadBtn();
  toast(`▶ 开始从第 ${startIdx + 1} 行连读本幕（点击任意台词即可随时停下）`);
  stepTableRead();
}
function toggleTableRead() {
  if (S.tableRead) stopTableRead(false);
  else startTableRead();
}

function setSpeaker(i, v) {
  exec('更换说话人', () => mutRow(i, l => {
    const strip = () => { if (l.charPosition === undefined && l.charEffect === undefined && l.charId === undefined) ['charLabel', 'charAnim1', 'charAnim2', 'charLipAnim'].forEach(k => delete l[k]); if (l._meta) delete l._meta.mode; };
    if (v.startsWith('c:')) { const lb = v.slice(2), c = S.doc.pack.characters[lb]; setK(l, 'speaker', c.name); setK(l, 'charLabel', lb); setK(l, 'textFrame', '001'); }
    else if (v === 'p') { setK(l, 'speaker', 'プロデューサー'); strip(); setK(l, 'textFrame', '002'); }
    else if (v === 'n') { setK(l, 'speaker', ''); strip(); setK(l, 'textFrame', '002'); }
    refreshVoiceStaleFlag(l);
  }));
}
function macroTargetChar() { const l = curRow().line; return S.selChar || (l.charLabel) || stageAt(curIdx()).cast[0] || Object.keys(S.doc.pack.characters || {})[0] || null; }
function renderMacroMenu() {
  const ch = macroTargetChar();
  const branchHtml = `<button class="menu-item" data-mac-branch="1" title="在当前行添加分支选项与跳转标签"><b>🔀 插入分支选项</b><small>添加玩家对话分支与对应跳转节点</small></button>`;
  $('#macroMenu').innerHTML = `<div class="kicker" style="padding:4px 10px">插入到第 ${curIdx() + 1} 行之后 · 角色：${ch ? esc(charInfo(ch).nameZh || charInfo(ch).name) : '（无）'}</div>` + branchHtml + M.macros.map((m, n) => `<button class="menu-item" data-mac="${n}" title="宏代号：${esc(m.name)}"><b>🧩 ${esc(m.label)}</b><small>${esc(m.desc)} · 展开 ${m.rows(ch || 'x').length} 行</small></button>`).join('');
}
function insertMacro(n) {
  const mac = M.macros[n]; let ch = null;
  if (mac.needsChar) { ch = macroTargetChar(); if (!ch) return toast('请先在舞台上选中一个角色', 'warn'); }
  let k = 1; const re = new RegExp('^' + mac.name + '#(\\d+)$');
  S.doc.rows.forEach(r => { const mm = ((r.line._meta || {}).macroId || '').match(re); if (mm) k = Math.max(k, +mm[1] + 1); });
  const mid = mac.name + '#' + k;
  exec('插入宏 ' + mid, () => {
    const lines = mac.rows(ch).map(l => { const o = clone(l), m = { ...(o._meta || {}), uid: newUid(), macroId: mid, origin: 'custom' }; if (ch) m.macroArgs = { char: ch }; delete o._meta; o._meta = m; return o; });
    const made = insertRows(curIdx() + 1, lines); S.selKey = made[made.length - 1].key;
  });
  S.collapsed[mid] = false;
  revealDirectionsIfHidden(S.selKey);
  toast(`🧩 已插入宏 ${mid}（${mac.label}）· 在宏内改官方字段会自动脱离宏`);
}

/* ============================== 显式保存状态（不点就不保存） ============================== */
function updateDirtyUi() {
  const dirty = Boolean(S.isDirty);
  const b = $('#dirtyBadge');
  if (b) {
    b.textContent = dirty ? '● 未保存（点「保存」才写入磁盘）' : '已保存';
    b.classList.toggle('unsaved', dirty);
    b.classList.toggle('is-dirty', dirty);
  }
  $$('.js-save-proj-btn').forEach((btn) => {
    btn.classList.toggle('is-dirty', dirty);
    const lblSpan = btn.querySelector('.lbl');
    if (lblSpan) {
      if (!lblSpan.dataset.baseLabel) lblSpan.dataset.baseLabel = lblSpan.textContent;
      lblSpan.textContent = dirty ? (lblSpan.dataset.baseLabel + ' *') : lblSpan.dataset.baseLabel;
    } else {
      if (!btn.dataset.baseLabel) btn.dataset.baseLabel = btn.textContent.trim();
      btn.textContent = dirty ? (btn.dataset.baseLabel + ' *') : btn.dataset.baseLabel;
    }
  });
  $$('.js-discard-proj-btn').forEach((btn) => {
    btn.hidden = !dirty;
  });
}
function markDirty() {
  S.isDirty = true;
  if (window.StudioWorkflow && window.StudioWorkflow.W) {
    window.StudioWorkflow.W.isDirty = true;
  }
  updateDirtyUi();
}
function clearDirtyState(label) {
  S.isDirty = false;
  if (window.StudioWorkflow && window.StudioWorkflow.W) {
    window.StudioWorkflow.W.isDirty = false;
  }
  updateDirtyUi();
  const b = $('#dirtyBadge');
  if (b && label) b.textContent = label;
}
function saveNow() {
  if (window.StudioWorkflow && typeof window.StudioWorkflow.saveCurrentProjectExplicitly === 'function') {
    window.StudioWorkflow.saveCurrentProjectExplicitly();
  }
}
function loadUi() { try { return JSON.parse(localStorage.getItem(LS.ui) || '{}'); } catch { return {}; } }
function saveUi() { try { localStorage.setItem(LS.ui, JSON.stringify({ theme: S.theme, mode: S.mode, textView: S.textView, subtitle: S.subtitle, tab: S.tab, pack: S.doc && S.doc.packId, guides: S.guides })); } catch { } }
function makeDoc(pe) {
  const st = clone(pe.story); let n = 0;
  const doc = { packId: pe.id, pack: clone(pe.pack), head: { $schema: st.$schema, format: st.format, formatVersion: st.formatVersion }, meta: st.meta, rows: st.lines.map(l => ({ key: 'k' + (++n), line: l })), keySeq: n };
  doc.rows.forEach(r => {
    const ln = r && r.line;
    if (ln && ln.voice) {
      const mm = meta(ln);
      if (!mm.voiceSynthSig && !mm.voiceStale) {
        const lb = ln.charLabel || (doc.pack && doc.pack.characters && Object.keys(doc.pack.characters).find(k => doc.pack.characters[k].name === ln.speaker)) || ln.speaker || '';
        const mono = isInnerMonologueRow(ln) ? 'mono' : 'aloud';
        const rawTxt = String(mm.ttsText ?? ln.text ?? '').trim();
        mm.voiceSynthSig = `${lb}|${mono}|${rawTxt}`;
      }
    }
  });
  return doc;
}
function loadPack(id, fresh = false) {
  stopTableRead(true); stopPreview(); if (TX) commit(); closePopover();
  const pe = M.packs.find(p => p.id === id) || M.packs[0]; S.packEntry = pe;
  S.doc = makeDoc(pe);
  if (fresh) try { localStorage.removeItem(LS.doc(pe.id)); } catch (_) {}
  S.undo = []; S.redo = []; S.selChar = null; S.rowView = {}; S.collapsed = {};
  S.selKey = (S.doc.rows.find(r => kindOf(r.line) === 'dialogue') || S.doc.rows[0]).key;
  $('#packSelect').value = pe.id; saveUi();
  renderAll();
  syncLoadDocToSpineStage(false);
  syncGotoLineToSpineStage(false);
  clearDirtyState('已载入');
}

/* ============================== 事件绑定 ============================== */
function bindScriptList() {
  const list = $('#scriptList');
  list.addEventListener('click', e => {
    const beatAct = e.target.closest('[data-beat-act]');
    if (beatAct) {
      e.stopPropagation();
      const act = beatAct.dataset.beatAct;
      const bid = beatAct.dataset.beatId;
      if (act === 'toggle') {
        S.collapsed['beat:' + bid] = !S.collapsed['beat:' + bid];
        renderScript();
      } else if (act === 'add-line' && window.StudioWorkflow && typeof window.StudioWorkflow.addLineToBeat === 'function') {
        window.StudioWorkflow.addLineToBeat(bid);
      } else if (act === 'regen' && window.StudioWorkflow && typeof window.StudioWorkflow.regenerateSingleBeat === 'function') {
        window.StudioWorkflow.regenerateSingleBeat(bid, beatAct);
      }
      return;
    }
    if (e.target.closest('.beat-group-head')) return;
    const mh = e.target.closest('.macro-head');
    if (mh) { const id = mh.dataset.macro; S.collapsed[id] = !S.collapsed[id]; renderScript(); return; }
    const rowE = e.target.closest('.row'); if (!rowE) return;
    if (S.tableRead) stopTableRead(true);
    const key = rowE.dataset.key, i = idxOf(key);
    const quickClear = e.target.closest('[data-quick-clear]');
    if (quickClear && i >= 0) {
      e.stopPropagation();
      const what = quickClear.dataset.quickClear;
      if (what === 'bgm') { clearRowBgmControl(i); return; }
      exec(`快速清除第 ${i + 1} 行 ${what}`, () => mutRow(i, ln => {
        if (what === 'bg') delete ln.bg;
        else if (what === 'anim1') { delete ln.charAnim1; delete ln.charAnim3; }
        else if (what === 'move') { delete ln.charEffect; delete ln.charPosition; if (ln._meta) { delete ln._meta.moveTrack; delete ln._meta.manualPos; } }
        else if (what === 'scale') { setK(ln, 'charScale', 1); delete ln.charEffect; if (ln._meta && ln._meta.stageAction === 'lean_close') delete ln._meta.stageAction; }
        else if (what === 'shock') { if (ln.bgEffect === 'white_fade') { delete ln.bgEffect; delete ln.bgEffectTime; } delete ln.charEffect; if (ln._meta && ln._meta.stageAction === 'flash_shock') delete ln._meta.stageAction; }
        else if (what === 'se') delete ln.se;
      }));
      syncLoadDocToSpineStage(false);
      syncGotoLineToSpineStage(false);
      toast(`🧹 已清除第 ${i + 1} 行「${what}」覆盖`);
      return;
    }
    const quickClearBgm = e.target.closest('[data-quick-clear-bgm]');
    if (quickClearBgm) {
      e.stopPropagation();
      if (i >= 0) clearRowBgmControl(i);
      return;
    }
    const pill = e.target.closest('.pill');
    if (pill) { e.stopPropagation(); if (S.selKey !== key) selectRow(key, { scroll: false }); const f = checkLine(S.doc.rows[i].line)[+pill.dataset.flag]; if (f) showFlagPopover(pill, i, f); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'tts-pick-take') {
        const takeId = act.dataset.takeId;
        if (!takeId || i < 0) return;
        let pickedVoice = '';
        if (S.selKey !== key) selectRow(key, { scroll: false, autoSpeak: false });
        exec(`切换配音版本 ${takeId}`, () => mutRow(i, ln => {
          const mm = meta(ln);
          const tk = Array.isArray(mm.takes) ? mm.takes.find(x => x && x.id === takeId) : null;
          if (!tk || !tk.voice) return;
          mm.takeSelected = tk.id;
          setK(ln, 'voice', tk.voice);
          if (tk.synthSig) {
            mm.voiceSynthSig = tk.synthSig;
          } else if (tk.text !== undefined) {
            const lbTk = ln.charLabel || charOfLine(ln) || ln.speaker || '';
            const monoTk = isInnerMonologueRow(ln) ? 'mono' : 'aloud';
            mm.voiceSynthSig = `${lbTk}|${monoTk}|${String(tk.text || '').trim()}`;
          }
          refreshVoiceStaleFlag(ln);
          pickedVoice = tk.voice;
        }));
        replaceRow(key);
        renderInspector();
        if (pickedVoice) {
          playRealAudio(pickedVoice, null, { rowKey: key });
        }
        return;
      }
      if (a === 'tts-play-or-synth') {
        const curRow = S.doc.rows[i];
        const curLn = curRow && curRow.line;
        if (curRealAudio && curRealAudioKey === key && !curRealAudio.paused) {
          stopRealAudio();
          return;
        }
        if (S.selKey !== key) selectRow(key, { scroll: false, autoSpeak: false });
        const isStaleNow = Boolean(curLn && curLn.voice && curLn._meta && curLn._meta.voiceStale);
        if (curLn && curLn.voice && !isStaleNow) {
          playRealAudio(curLn.voice, () => toast('音频播放失败，可点右侧 ↻ 重新合成', 'warn'), { rowKey: key });
        } else {
          synthTtsTake(i, { force: isStaleNow });
        }
        return;
      }
      if (a === 'tts-regen') return synthTtsTake(i, { force: true });
      if (a === 'view-text' || a === 'view-tts') { S.rowView[key] = a === 'view-tts' ? 'tts' : 'text'; replaceRow(key); if (a === 'view-tts') { const t = $(`.row[data-key="${key}"] textarea.tts`); if (t) t.focus(); } return; }
      if (a === 'toggle-monologue') {
        toggleRowInnerMonologue(i);
        return;
      }
      if (a === 'insert-cue') return insertCueAfterRow(i);
      if (a === 'up') return moveRow(i, -1);
      if (a === 'down') return moveRow(i, 1);
      if (a === 'dup') return dupRow(i);
      if (a === 'del') return delRow(i);
      return;
    }

    // Cue card inline interactive controls
    if (kindOf(S.doc.rows[i].line) === 'cue') {
      const cueMeta = meta(S.doc.rows[i].line);
      const cue = cueMeta.cue || (cueMeta.cue = { timing: 'separate', delayMs: 0, transition: 'none', steps: [] });
      const syncCueRecompile = () => {
        replaceRow(key);
        renderStage();
        if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
          window.SCWorkflow.recompileSceneQuietly(100);
        }
      };
      const tBtn = e.target.closest('[data-cue-timing]');
      if (tBtn) {
        cue.timing = tBtn.dataset.cueTiming === 'with_next' ? 'with_next' : 'separate';
        syncCueRecompile();
        return;
      }
      const fBtn = e.target.closest('[data-cue-fade]');
      if (fBtn) {
        cue.transition = cue.transition === 'switch_fade' ? 'none' : 'switch_fade';
        syncCueRecompile();
        return;
      }
      const playBtn = e.target.closest('[data-cue-play]');
      if (playBtn) {
        selectRow(key, { scroll: false });
        const totalMs = (cue.steps || []).reduce((acc, s) => acc + (s.mode === 'parallel' ? 0 : (Number(s.durationMs) || 500)), 0) + (cue.transition === 'switch_fade' ? 500 : 120);
        syncGotoLineToSpineStage(true);
        if (!S.preview) {
          S.preview = { i, timer: setTimeout(() => { S.preview = null; renderAll(); }, Math.max(400, totalMs)) };
          previewStep();
        }
        return;
      }
      const slotBtn = e.target.closest('[data-cue-slot]');
      if (slotBtn) {
        const sIdx = +slotBtn.dataset.cueSlot;
        const st = cue.steps && cue.steps[sIdx];
        if (st) {
          st.toSlot = slotBtn.dataset.slot;
          st.toX = Number(slotBtn.dataset.x);
          syncCueRecompile();
        }
        return;
      }
      const modeBtn = e.target.closest('[data-cue-mode]');
      if (modeBtn) {
        const sIdx = +modeBtn.dataset.cueMode;
        const st = cue.steps && cue.steps[sIdx];
        if (st) {
          st.mode = st.mode === 'parallel' ? 'seq' : 'parallel';
          syncCueRecompile();
        }
        return;
      }
      const delStepBtn = e.target.closest('[data-cue-del-step]');
      if (delStepBtn) {
        const sIdx = +delStepBtn.dataset.cueDelStep;
        if (Array.isArray(cue.steps)) {
          cue.steps.splice(sIdx, 1);
          if (cue.steps[0]) cue.steps[0].mode = 'seq';
          syncCueRecompile();
        }
        return;
      }
      const addStepBtn = e.target.closest('[data-cue-add-step]');
      if (addStepBtn) {
        cue.steps = Array.isArray(cue.steps) ? cue.steps : [];
        const castKeys = Object.keys(S.doc.pack.characters || {});
        const used = new Set(cue.steps.map(s => s.charLabel));
        const nextLb = castKeys.find(c => !used.has(c)) || castKeys[0] || 'amana';
        const prevSt = stageAt(Math.max(0, i - 1));
        const curX = (prevSt.chars && prevSt.chars[nextLb] && prevSt.chars[nextLb].x != null) ? Math.round(prevSt.chars[nextLb].x) : 568;
        cue.steps.push({
          mode: cue.steps.length > 0 ? 'parallel' : 'seq',
          charLabel: nextLb,
          toSlot: CUE_SLOTS.reduce((b, sl) => Math.abs(sl.x - curX) < Math.abs(b.x - curX) ? sl : b, CUE_SLOTS[3]).id,
          toX: curX,
          durationMs: 500,
          speedPreset: 'normal',
          gaze: ''
        });
        syncCueRecompile();
        return;
      }
      if (e.target.closest('input, select, button')) return;
    }

    if (e.target.closest('textarea, select, input')) {
      if (S.mode !== 'stage') return;
    }
    if (S.preview) { S.preview.i = i; previewStep(); return; }
    if (S.selKey !== key) {
      selectRow(key, { scroll: false, autoSpeak: true });
    } else {
      const wasPlayingThis = Boolean(curRealAudio && curRealAudioKey === key && !curRealAudio.paused);
      stopRealAudio();
      const curLn = S.doc.rows[i] && S.doc.rows[i].line;
      if (!wasPlayingThis && curLn && curLn.voice && !(curLn._meta && curLn._meta.voiceStale)) {
        playRealAudio(curLn.voice, null, { rowKey: key });
      }
    }
  });
  list.addEventListener('focusin', e => {
    const t = e.target; if (!t.matches('textarea[data-f]')) return;
    if (S.tableRead) stopTableRead(true);
    const key = t.closest('.row').dataset.key;
    if (S.mode === 'stage') {
      t.blur();
      if (S.selKey !== key) selectRow(key, { scroll: false, autoSpeak: true });
      return;
    }
    if (S.selKey !== key) selectRow(key, { scroll: false, autoSpeak: true });
  });
  list.addEventListener('input', e => {
    const t = e.target; if (!t.matches('textarea[data-f]')) return;
    if (S.mode === 'stage') return;
    const rowE = t.closest('.row'), key = rowE.dataset.key, i = idxOf(key), f = t.dataset.f, v = t.value;
    if (!TX) begin({ text: '编辑台词', zh: '编辑中文', tts: '编辑 TTS 读音', select: '编辑选项', selectZh: '编辑选项中文' }[f] + ` #${i + 1}`);
    mutRow(i, l => {
      if (f === 'text') setK(l, 'text', v);
      else if (f === 'select') setK(l, 'select', v);
      else { const mk = { zh: 'zh', tts: 'ttsText', selectZh: 'selectZh' }[f]; if (v) meta(l)[mk] = v; else if (l._meta) delete l._meta[mk]; }
    });
    autoSize(t);
    const l = S.doc.rows[i].line;
    if (f === 'text' || f === 'zh') {
      const mNow = meta(l);
      if (isMonologueText(l.text, mNow.zh)) {
        l.charLipAnim = 'lip_wait';
        l.lip = 'lip_wait';
        mNow['x-innerMonologue'] = true;
      } else if (mNow['x-innerMonologue']) {
        delete mNow['x-innerMonologue'];
        if (l.charLipAnim === 'lip_wait' || l.charLipAnim === 'lip_wait_s' || l.charLipAnim === 'blank') {
          l.charLipAnim = 'lip_a';
        }
        if (l.lip === 'lip_wait' || l.lip === 'lip_wait_s' || l.lip === 'blank') {
          delete l.lip;
        }
      }
      const monoBtn = $('.mono-tog-btn', rowE);
      const monoTag = $('.tag.inner-monologue', rowE);
      const nowMono = isInnerMonologueRow(l);
      if (monoBtn) {
        monoBtn.classList.toggle('on', nowMono);
        monoBtn.textContent = nowMono ? '💭 闭口中' : '💭 内心（）';
      }
      if (monoTag) monoTag.hidden = !nowMono;
    }
    if (f === 'text' || f === 'tts' || f === 'zh') {
      refreshVoiceStaleFlag(l);
      const ttsBtn = $('.tts-row-btn', rowE);
      if (ttsBtn && l.voice && S.ttsBusyKey !== key) {
        const nowStale = Boolean(l._meta && l._meta.voiceStale);
        ttsBtn.classList.toggle('stale', nowStale);
        const playingThis = Boolean(curRealAudio && curRealAudioKey === key && !curRealAudio.paused);
        if (!playingThis) {
          ttsBtn.textContent = nowStale ? '⚠️ 词已改·重配' : '🔊 试听';
          ttsBtn.title = nowStale ? '台词或读音已修改，点击重新合成语音' : '播放本句语音';
        }
      }
    }
    const pills = $('.pills', rowE); if (pills) pills.innerHTML = pillsHtml(l);
    const len = $('.len', rowE); if (len) { const n = jlen(l.text); len.textContent = `${n}/${M.LINE_LIMIT}`; len.classList.toggle('over', n > M.LINE_LIMIT); }
    renderStage(); renderOocSummary();
    syncGotoLineToSpineStage(false);
  });
  list.addEventListener('focusout', e => {
    const t = e.target; if (!t.matches('textarea[data-f]')) return;
    const rowE = t.closest('.row'), key = rowE.dataset.key;
    if (TX) { commit(); renderTimeline(); renderInspector(); }
    setTimeout(() => { const cur = $(`.row[data-key="${key}"]`); if (cur && !cur.contains(document.activeElement)) replaceRow(key); }, 0);
  });
  list.addEventListener('pointerdown', e => {
    const puck = e.target.closest('.cue-puck');
    if (!puck) return;
    const ruler = puck.closest('[data-cue-ruler]');
    const rowE = puck.closest('.row');
    if (!ruler || !rowE) return;
    const key = rowE.dataset.key, i = idxOf(key);
    if (i < 0 || !S.doc.rows[i]) return;
    const m = meta(S.doc.rows[i].line);
    const cue = m.cue;
    const sIdx = +puck.dataset.cuePuck;
    const st = cue && cue.steps && cue.steps[sIdx];
    if (!st) return;
    e.preventDefault();
    const rect = ruler.getBoundingClientRect();
    const calcX = (clientX, noSnap) => {
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      let x = Math.round(ratio * 1856 - 360);
      if (!noSnap) {
        const snap = CUE_SLOTS.find(sl => Math.abs(sl.x - x) <= 24);
        if (snap) x = snap.x;
      }
      return Math.max(-420, Math.min(1560, x));
    };
    const onMove = mv => {
      const nx = calcX(mv.clientX, mv.shiftKey);
      st.toX = nx;
      st.toSlot = CUE_SLOTS.reduce((b, sl) => Math.abs(sl.x - nx) < Math.abs(b.x - nx) ? sl : b, CUE_SLOTS[3]).id;
      puck.style.left = `${cueXToPct(nx)}%`;
      const xLbl = puck.querySelector('.cue-puck-x');
      if (xLbl) xLbl.textContent = String(nx);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      replaceRow(key);
      if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
        window.SCWorkflow.recompileSceneQuietly(100);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
  list.addEventListener('change', e => {
    if (e.target.matches('input[data-beat-field]')) {
      const bid = e.target.dataset.beatId;
      const field = e.target.dataset.beatField;
      const val = e.target.value;
      if (field === 'title') {
        S.doc.rows.forEach(r => {
          const m = r.line._meta || {};
          if ((m['x-beatId'] || m.beatId) === bid) m['x-beatTitle'] = val;
        });
      }
      if (window.StudioWorkflow && typeof window.StudioWorkflow.updateSegmentMeta === 'function') {
        window.StudioWorkflow.updateSegmentMeta(bid, { [field]: val });
      }
      return;
    }
    if (e.target.matches('[data-cue-note], [data-cue-delay], [data-cue-step-f]')) {
      const rowE = e.target.closest('.row');
      if (!rowE) return;
      const key = rowE.dataset.key, i = idxOf(key);
      if (i < 0 || !S.doc.rows[i]) return;
      const m = meta(S.doc.rows[i].line);
      const cue = m.cue || (m.cue = { timing: 'separate', delayMs: 0, transition: 'none', steps: [] });
      if (e.target.matches('[data-cue-note]')) {
        m.note = e.target.value;
      } else if (e.target.matches('[data-cue-delay]')) {
        cue.delayMs = Math.max(0, Math.min(2000, parseInt(e.target.value, 10) || 0));
      } else if (e.target.matches('[data-cue-step-f]')) {
        const sIdx = +e.target.dataset.stepIdx;
        const field = e.target.dataset.cueStepF;
        const st = cue.steps && cue.steps[sIdx];
        if (st) {
          if (field === 'toX') {
            const nx = Math.max(-420, Math.min(1560, Math.round(Number(e.target.value) || 568)));
            st.toX = nx;
            st.toSlot = CUE_SLOTS.reduce((b, sl) => Math.abs(sl.x - nx) < Math.abs(b.x - nx) ? sl : b, CUE_SLOTS[3]).id;
          } else if (field === 'speedPreset') {
            const sp = CUE_SPEEDS[e.target.value] ? e.target.value : 'normal';
            st.speedPreset = sp;
            st.durationMs = CUE_SPEEDS[sp].ms;
          } else {
            st[field] = e.target.value;
          }
        }
      }
      replaceRow(key);
      if (window.SCWorkflow && typeof window.SCWorkflow.recompileSceneQuietly === 'function') {
        window.SCWorkflow.recompileSceneQuietly(120);
      }
      return;
    }
    if (e.target.matches('select.stage-action-pick')) {
      const key = e.target.closest('.row').dataset.key, i = idxOf(key);
      if (i >= 0 && S.doc.rows[i]) {
        applyStageActionToRow(i, e.target.value);
      }
      return;
    }
    if (!e.target.matches('select.spk')) return;
    if (S.mode === 'stage') return;
    const key = e.target.closest('.row').dataset.key; setSpeaker(idxOf(key), e.target.value);
  });
}
function setMode(m) {
  stopTableRead(true);
  stopRealAudio();
  if (window.StudioWorkflow && window.StudioWorkflow.W && window.StudioWorkflow.W.reactionWorkbenchActive && typeof window.StudioWorkflow.setReactionWorkbenchActive === 'function') {
    window.StudioWorkflow.setReactionWorkbenchActive(false);
  }
  S.mode = m; document.body.classList.remove('mode-polish', 'mode-stage', 'mode-muse'); document.body.classList.add('mode-' + m);
  if (S.doc && (m === 'stage' || m === 'polish')) renderScript();
  renderHeader(); renderMuse(); saveUi(); setTimeout(fitStage, 30);
  toast({ polish: '✍️ 第 2 步 · 台本润色：专注对白文本、中文润色与 OOC 校准', stage: '🎬 第 3 步 · 舞台与出品：专注站位、情绪动作与成片录制（文本已锁定）', muse: '🧩 第 1 步 · 大纲规划：拆解幕数与角色阵容' }[m]);
}
function bindTopbar() {
  $$('#modeSeg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo; $('#btnHistory').onclick = openHistory;
  $('#btnTheme').onclick = () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; document.body.classList.toggle('dark', S.theme === 'dark'); saveUi(); };
  $('#btnPreview').onclick = togglePreview;
  $('#btnExport').onclick = openExport;
  $('#btnDrawer').onclick = () => { const o = document.body.classList.toggle('drawer-open'); $('#scrim').hidden = !o; };
  $('#scrim').onclick = () => { document.body.classList.remove('drawer-open'); $('#scrim').hidden = true; };
  const ps = $('#packSelect');
  const isHttpRuntime = /^https?:$/i.test(window.location && window.location.protocol ? window.location.protocol : '');
  if (isHttpRuntime) {
    ps.dataset.projectsLoaded = '0';
    ps.innerHTML = `<option value="">⏳ 正在加载工程列表…</option><option disabled>──────────</option><option value="__import">📂 打开本地 .scproj.json…</option>`;
  } else {
    ps.dataset.projectsLoaded = '1';
    ps.innerHTML = M.packs.map(p => `<option value="${p.id}">${esc(p.pack.nameZh || p.pack.name)} · ${p.id}.scpack</option>`).join('') + `<option disabled>──────────</option><option value="__reset">↺ 重置当前包为示例数据</option><option value="__import">📂 打开本地 .scproj.json…</option>`;
  }
  ps.onchange = () => {
    const v = ps.value;
    if (v === '__reset') { if (confirm('丢弃当前包的本机草稿，恢复为示例数据？（撤销历史也会清空）')) loadPack(S.doc.packId, true); else ps.value = S.doc.packId; return; }
    if (v === '__import') { ps.value = S.doc.packId; importFile(); return; }
    if (TX) commit(); loadPack(v);
  };
  $('#textViewSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.textView = b.dataset.v; S.rowView = {}; saveUi(); renderHeader(); renderScript(); toast(S.textView === 'tts' ? '全部台词切到「TTS 读音覆写」视图（编辑 _meta.ttsText）' : '切回「显示台词」视图'); };
  if ($('#btnAddLine')) $('#btnAddLine').onclick = addLine;
  if ($('#btnAddDir')) $('#btnAddDir').onclick = addDirection;
  if ($('#btnMacro')) $('#btnMacro').onclick = e => { e.stopPropagation(); const m = $('#macroMenu'); if (!m) return; if (m.hidden) { renderMacroMenu(); m.hidden = false; } else m.hidden = true; };
  if ($('#macroMenu')) $('#macroMenu').onclick = e => {
    const br = e.target.closest('[data-mac-branch]');
    if (br) {
      $('#macroMenu').hidden = true;
      const bBtn = $('#btnAddBranchNote');
      if (bBtn) bBtn.click();
      return;
    }
    const b = e.target.closest('[data-mac]');
    if (!b) return;
    $('#macroMenu').hidden = true;
    insertMacro(+b.dataset.mac);
  };
  $('#oocSummary').onclick = () => {
    const R = S.doc.rows, s = curIdx();
    for (let d = 1; d <= R.length; d++) { const j = (s + d) % R.length; if (activeIssues(R[j].line).some(f => f.sev !== 'info')) { const mid = macroOf(j); if (mid) S.collapsed[mid] = false; selectRow(R[j].key); const p = $(`.row[data-key="${R[j].key}"] .pill`); if (p) p.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], 400); return; } }
    toast('✓ 没有待处理的 OOC 问题');
  };
  $('#subSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.subtitle = b.dataset.s; saveUi(); renderHeader(); renderStage(); };
  $('#btnGuides').onclick = () => { S.guides = !S.guides; saveUi(); renderHeader(); renderStage(); };
  $('#btnFull').onclick = () => { const f = $('#stageFrame'); if (document.fullscreenElement) document.exitFullscreen(); else if (f.requestFullscreen) f.requestFullscreen(); };
  $('#inspTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.tab = b.dataset.tab; saveUi(); renderInspector(); };
  $('#modalBack').onclick = e => { if (e.target.id === 'modalBack') closeModal(); };
  document.addEventListener('click', e => {
    if (!e.target.closest('#popover') && !e.target.closest('.pill')) closePopover();
    if (!e.target.closest('.macro-pick')) $('#macroMenu').hidden = true;
  });
}
function importFile() {
  const fi = document.createElement('input'); fi.type = 'file'; fi.accept = '.json,.txt,.md,application/json,text/plain';
  fi.onchange = () => {
    const f = fi.files[0]; if (!f) return;
    const baseName = f.name.replace(/\..*$/, '');
    f.text().then(txt => {
      try {
        let st; let formatLabel = 'scproj';
        if (window.SCExternalScriptAdapter && typeof window.SCExternalScriptAdapter.toScprojDocument === 'function') {
          const conv = window.SCExternalScriptAdapter.toScprojDocument(txt, { fileBaseName: baseName });
          if (!conv || !conv.ok || !conv.scproj) throw new Error((conv && conv.error) || '无法识别的剧本格式');
          st = conv.scproj;
          formatLabel = conv.formatLabel || conv.format;
        } else {
          const j = JSON.parse(txt);
          if (Array.isArray(j)) st = { format: 'scproj', formatVersion: 2, meta: { id: baseName.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'imported', origin: 'official' }, lines: j };
          else if (j.format === 'scproj' && Array.isArray(j.lines)) st = j; else throw new Error('不是 scproj envelope 或官方裸数组');
        }
        exec('打开本地文件 ' + f.name, () => {
          S.doc.meta = st.meta;
          S.doc.pack.characters = { ...(S.doc.pack.characters || {}), ...((st.pack && st.pack.characters) || {}), ...((st.meta && st.meta.characters) || {}) };
          st.lines.forEach(l => {
            if (l.charLabel && !S.doc.pack.characters[l.charLabel]) {
              const ci = charInfo(l.charLabel);
              S.doc.pack.characters[l.charLabel] = {
                charType: l.charType || 'characters',
                charId: l.charId || ci.charId || '001',
                ...(l.clothId ? { clothId: l.clothId } : {}),
                charCategory: l.charCategory || 'stand_fix',
                name: l.speaker || ci.name,
                nameZh: ci.nameZh || l.speaker || l.charLabel
              };
            }
          });
          let n = S.doc.keySeq;
          S.doc.rows = st.lines.map(l => ({ key: 'k' + (++n), line: l }));
          S.doc.keySeq = n;
          S.selKey = S.doc.rows[0] && S.doc.rows[0].key;
        });
        toast(`📂 已载入 ${f.name}（${formatLabel} · ${st.lines.length} 行，可撤销）`);
      } catch (e) { toast('✗ 无法读取：' + e.message, 'err'); }
    });
  };
  fi.click();
}
function bindKeys() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 's') {
      e.preventDefault();
      if (window.StudioWorkflow && typeof window.StudioWorkflow.saveCurrentProjectExplicitly === 'function') {
        window.StudioWorkflow.saveCurrentProjectExplicitly();
      }
      return;
    }
    if (e.key === 'Escape') {
      if (!$('#modalBack').hidden) return closeModal();
      if (!$('#popover').hidden) return closePopover();
      const dr = $('#directorDrawer');
      if (dr && !dr.hidden) { closeDirectorDrawer(); return; }
      if (S.preview) return stopPreview('■ 已停止预览');
      if (document.body.classList.contains('drawer-open')) { document.body.classList.remove('drawer-open'); $('#scrim').hidden = true; return; }
      const t = e.target, typing = t.matches && t.matches('input, textarea, select, [contenteditable]');
      if (typing) return t.blur();
      if (S.selChar) { S.selChar = null; renderStage(); renderInspector(); }
      return;
    }
    // 自定义快捷键（Space/方向键/Enter/F2/Delete/Alt+1..4/Ctrl+Enter 等）已按用户要求关闭
  });
}
function bindTimeline() {
  const tl = $('#timeline');
  tl.addEventListener('click', e => {
    const b = e.target.closest('.beat');
    if (b) {
      if (S.preview) { S.preview.i = idxOf(b.dataset.key); previewStep(); }
      else selectRow(b.dataset.key);
      return;
    }
    if (e.target.closest('#btnPlaySubtimeline')) {
      playSubtimelineOnSpineStage();
      return;
    }
    if (e.target.closest('#btnAddMotionKf')) {
      const idx = curIdx();
      const sub = getLineSubtimelineData(idx);
      const lb = sub.lb || 'amana';
      const lastKf = sub.motionTrack[sub.motionTrack.length - 1] || { offsetMs: 0, anim1: 'wait1', anim2: 'face_smile', anim3: '', anim4: 'eye_front' };
      const nextOffset = Math.min(Math.max(800, (Number(lastKf.offsetMs) || 0) + 1200), Math.max(1400, sub.durMs - 300));
      const nextAnim1 = lastKf.anim1 === 'smile1' ? 'smile2' : 'smile1';
      const nextAnim2 = lastKf.anim2 === 'face_smile' ? 'face_smile2' : 'face_smile';
      const newKf = {
        offsetMs: nextOffset,
        charLabel: lb,
        anim1: nextAnim1,
        anim2: nextAnim2,
        anim3: 'yes',
        anim4: lastKf.anim4 || 'eye_front',
        label: `${getMotionNameZh(nextAnim1)} + ${getFaceNameZh(nextAnim2)} · 点头回应`
      };
      exec('插入句中动作关键帧', () => mutRow(idx, l => {
        const mm = meta(l);
        if (!Array.isArray(mm.motionTrack) || !mm.motionTrack.length) {
          mm.motionTrack = sub.motionTrack.map(x => ({ ...x }));
        }
        mm.motionTrack.push(newKf);
        S.selMotionKf = mm.motionTrack.length - 1;
      }), { syncStage: false });
      previewPoseOnSpineStage({
        charLabel: lb,
        charAnim1: newKf.anim1,
        charAnim2: newKf.anim2,
        charAnim3: newKf.anim3,
        charAnim4: newKf.anim4
      });
      toast(`✨ 已插入句中动作点 @${(nextOffset / 1000).toFixed(1)}s — 可在下方点选该时刻要切换的动作与表情`);
      return;
    }
    if (e.target.closest('#btnAddMoveKf')) {
      const idx = curIdx();
      const sub = getLineSubtimelineData(idx);
      const st = stageAt(idx);
      const lb = sub.lb || 'amana';
      const curX = Math.round((st.chars[lb] && st.chars[lb].x) || 568);
      const toX = curX > 568 ? Math.max(420, curX - 140) : Math.min(720, curX + 140);
      const offsetMs = 700;
      const dur = 450;
      exec('插入句中 2D 走位', () => mutRow(idx, l => {
        if (!l.charLabel) setK(l, 'charLabel', lb);
        setK(l, 'charPosition', { x: toX, y: 640, order: Math.max(0, st.cast.indexOf(lb)) });
        setK(l, 'charEffect', { type: 'to', x: toX, scale: 1, time: dur });
        meta(l).manualPos = true;
        meta(l).moveTrack = [{ offsetMs, durationMs: dur, charLabel: lb, fromX: curX, toX, label: `句中走位 X:${curX}→${toX}` }];
      }), { syncStage: false });
      previewPoseOnSpineStage({ charLabel: lb, x: toX, moveFromX: curX, moveToX: toX, moveTime: dur });
      toast(`↔️ 已插入句中走位 @0.7s：X=${curX} → ${toX} (${dur}ms)`);
      return;
    }
    const seBadge = e.target.closest('[data-tl-se-play]');
    if (seBadge) {
      playSe(seBadge.dataset.tlSePlay);
      return;
    }
    const delKfBtn = e.target.closest('[data-kf-del]');
    if (delKfBtn) {
      e.stopPropagation();
      const kIdx = +delKfBtn.dataset.kfDel;
      const idx = curIdx();
      exec('删除句中动作点', () => mutRow(idx, l => {
        const mm = meta(l);
        if (Array.isArray(mm.motionTrack) && kIdx > 0 && kIdx < mm.motionTrack.length) {
          mm.motionTrack.splice(kIdx, 1);
        }
      }));
      S.selMotionKf = 0;
      renderTimeline(); renderInspector();
      toast('已删除句中动作关键帧');
      return;
    }
    const delMvBtn = e.target.closest('[data-mv-del]');
    if (delMvBtn) {
      e.stopPropagation();
      const idx = curIdx();
      exec('删除句中走位', () => mutRow(idx, l => {
        if (l._meta) delete l._meta.moveTrack;
        delete l.charEffect;
      }));
      toast('已清除本幕句中走位');
      return;
    }
    if (e.target.matches('input.kf-sec-inp, input.mv-sec-inp')) return;
    const kfPill = e.target.closest('.tl-kf-pill');
    if (kfPill) {
      const kIdx = +kfPill.dataset.kfIdx;
      S.selMotionKf = kIdx;
      const sub = getLineSubtimelineData(curIdx());
      const kf = sub.motionTrack[kIdx];
      renderTimeline(); renderInspector();
      if (kf) {
        previewPoseOnSpineStage({
          charLabel: kf.charLabel || sub.lb,
          charAnim1: kf.anim1,
          charAnim2: kf.anim2,
          charAnim3: kf.anim3 || '',
          charAnim4: kf.anim4 || 'eye_front'
        });
        toast(`🎯 已选中关键帧 #${kIdx + 1} (@${((kf.offsetMs || 0) / 1000).toFixed(1)}s) 并同步至真 Spine 舞台`);
      }
      return;
    }
    const mvBar = e.target.closest('.tl-move-bar');
    if (mvBar) {
      const mIdx = +mvBar.dataset.mvIdx;
      const sub = getLineSubtimelineData(curIdx());
      const mv = sub.moveTrack[mIdx];
      if (mv) {
        previewPoseOnSpineStage({
          charLabel: mv.charLabel || sub.lb,
          x: mv.toX,
          moveFromX: mv.fromX,
          moveToX: mv.toX,
          moveTime: mv.durationMs || 450
        });
        toast(`↔️ 正在真 Spine 舞台演示走位：起点 X=${mv.fromX} → 终点 X=${mv.toX}`);
      }
    }
  });

  tl.addEventListener('change', e => {
    const kfInp = e.target.closest('[data-kf-time]');
    if (kfInp) {
      const kIdx = +kfInp.dataset.kfTime;
      const newMs = clamp(Math.round((+kfInp.value || 0.5) * 1000), 100, 8000);
      const idx = curIdx();
      const sub = getLineSubtimelineData(idx);
      exec(`调整动作关键帧时间 @${(newMs / 1000).toFixed(1)}s`, () => mutRow(idx, l => {
        const mm = meta(l);
        if (!Array.isArray(mm.motionTrack) || !mm.motionTrack.length) {
          mm.motionTrack = sub.motionTrack.map(x => ({ ...x }));
        }
        if (mm.motionTrack[kIdx]) mm.motionTrack[kIdx].offsetMs = newMs;
      }));
      return;
    }
    const mvInp = e.target.closest('[data-mv-time]');
    if (mvInp) {
      const mIdx = +mvInp.dataset.mvTime;
      const newMs = clamp(Math.round((+mvInp.value || 0) * 1000), 0, 6000);
      const idx = curIdx();
      const sub = getLineSubtimelineData(idx);
      exec(`调整句中走位时间 @${(newMs / 1000).toFixed(1)}s`, () => mutRow(idx, l => {
        const mm = meta(l);
        if (!Array.isArray(mm.moveTrack) || !mm.moveTrack.length) {
          mm.moveTrack = sub.moveTrack.map(x => ({ ...x }));
        }
        if (mm.moveTrack[mIdx]) mm.moveTrack[mIdx].offsetMs = newMs;
      }));
    }
  });
}

function bindRealSpineBridge() {
  const ifr = $('#realSpineIframe');
  if (ifr) {
    ifr.addEventListener('load', () => {
      syncLoadDocToSpineStage(false);
      syncGotoLineToSpineStage(false);
      setTimeout(() => {
        syncLoadDocToSpineStage(false);
        syncGotoLineToSpineStage(false);
      }, 450);
    });
  }
  window.addEventListener('message', e => {
    const d = e && e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'sc-studio:bgm-state') {
      S.spineStageBgmState = d;
      return;
    }
    if (d.type === 'sc-studio:line-changed' && !d.fromStudio && d.index != null) {
      if (bgmAudio) stopBgm();
      const idx = +d.index;
      if (S.doc && Array.isArray(S.doc.rows) && S.doc.rows[idx]) {
        const row = S.doc.rows[idx];
        const mid = typeof macroOf === 'function' ? macroOf(idx) : null;
        if (mid && S.collapsed && S.collapsed[mid]) {
          S.collapsed[mid] = false;
          renderScriptList();
        }
        if (S.preview) S.preview.i = idx;
        if (S.selKey !== row.key) {
          selectRow(row.key, { scroll: true, syncSpine: false });
        }
      }
      return;
    }
    if (d.type === 'sc-studio:char-moved' && d.charLabel && d.x != null) {
      const lb = d.charLabel;
      const nx = Math.round(+d.x);
      const ny = d.y != null ? Math.round(+d.y) : 640;
      const t = charTargetRow(lb);
      const st = stageAt(curIdx());
      const prevX = Math.round((st.chars[lb] && st.chars[lb].x) || nx);
      exec(`舞台拖拽角色 ${lb} → X=${nx}`, () => mutRow(t, l => {
        if (!l.charLabel) setK(l, 'charLabel', lb);
        setK(l, 'charPosition', { x: nx, y: ny, order: Math.max(0, st.cast.indexOf(lb)) });
        if (d.scale != null) setK(l, 'charScale', +(+d.scale).toFixed(2));
        meta(l).manualPos = true;
        if (l._meta && Array.isArray(l._meta.moveTrack) && l._meta.moveTrack[0]) {
          l._meta.moveTrack[0].toX = nx;
          l._meta.moveTrack[0].label = `拖拽位移 X:${prevX}→${nx}`;
        }
      }));
      toast(`🖐️ 已从真 Spine 舞台同步 ${charInfo(lb).name} 站位：X=${nx}`);
    }
  });
}

/* ============================== 启动 ============================== */
function init() {
  const ui = loadUi();
  S.theme = ui.theme || 'light';
  S.mode = ui.mode || 'polish'; S.textView = ui.textView || 'text'; S.subtitle = ui.subtitle || 'both'; S.tab = ui.tab || 'acting'; S.guides = !!ui.guides;
  document.body.classList.toggle('dark', S.theme === 'dark');
  document.body.classList.remove('mode-polish'); document.body.classList.add('mode-' + S.mode);
  bindTopbar(); bindScriptList(); bindKeys(); bindTimeline(); bindStageDirectorDock(); initStageInteractions(); bindRealSpineBridge();
  if (window.ResizeObserver) new ResizeObserver(fitStage).observe($('#stageFrame')); else addEventListener('resize', fitStage);
  document.addEventListener('fullscreenchange', () => setTimeout(fitStage, 50));
  loadPack(ui.pack || M.packs[0].id);
  fitStage();
  window.__SC_OUTFITS_PROMISE = fetch('/api/studio/outfits')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.idols) {
        S.idolOutfits = data;
        window.SC_STUDIO_OUTFITS = data;
        renderInspector();
      }
      return data;
    })
    .catch(() => null);
  fetch('/api/studio/bg-catalog')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && Array.isArray(data.items)) {
        S.bgCatalogRemote = data.items;
        window.SC_STUDIO_BG_CATALOG = data.items;
        if (S.tab === 'bg' || S.inspTab === 'bg') renderInspector();
        if (window.SCWorkflow && typeof window.SCWorkflow.refreshEnvBars === 'function') {
          window.SCWorkflow.refreshEnvBars();
        }
      }
    })
    .catch(() => {});
  fetch('/api/studio/bgm-catalog')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && Array.isArray(data.items)) {
        S.bgmCatalogRemote = data.items;
        window.SC_STUDIO_BGM_CATALOG = data.items;
        if (S.tab === 'audio' || S.inspTab === 'audio') renderInspector();
        if (window.SCWorkflow && typeof window.SCWorkflow.refreshEnvBars === 'function') {
          window.SCWorkflow.refreshEnvBars();
        }
      }
    })
    .catch(() => {});
  try {
    const sp = new URLSearchParams(window.location.search || '');
    if (sp.get('popout') === 'assistant') {
      document.body.classList.add('popout-assistant');
      setTimeout(() => openDirectorDrawer(), 60);
    }
  } catch (_) {}
  if (studioBus) {
    studioBus.onmessage = (ev) => {
      const msg = ev && ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'sc-studio:row-selected' && msg.key && msg.key !== S.selKey) {
        window.__inStudioBusSync = true;
        try {
          selectRow(msg.key, { scroll: false, syncSpine: false });
        } finally {
          window.__inStudioBusSync = false;
        }
      }
    };
  }
  window.SCProto = {
    S, undo, redo, exec, stageAt, checkLine, toYaml, toScprojText, toOfficial, parseYamlDoc, runChecks,
    loadPack, renderAll, renderLight, renderScript, renderStageDirectorDock, renderInspector, selectRow, toast, openModal, closeModal, setMode, bgCatalog, bgmCatalog, resolveBg,
    recommendBgsForActiveScene, recommendBgmsForActiveScene,
    buildCompiledLinesFromCurrentRows, syncLoadDocToSpineStage, syncGotoLineToSpineStage,
    previewPoseOnSpineStage, playSubtimelineOnSpineStage, applyMotionAndFaceToCurrentSelection,
    applyStageActionToRow, toggleRowInnerMonologue, revealDirectionsIfHidden,
    getOutfitsForChar, getCurrentOutfitForChar, applyOutfitToCharacter,
    getHairstylesForChar, getCurrentHairForChar, applyHairToCharacter,
    collectPrecedingHiddenCueItems, collectPrecedingHiddenCueSummary, isKeyDirectionCue,
    estDur, specialFxDur, STUDIO_POST_LINE_GAP_MS,
    clearDirtyState, markDirty, openDirectorDrawer, closeDirectorDrawer, renderDirectorToContainer, refreshDirectorDrawerIfOpen,
    playSe, postToSpineStage, playBgmPreview, stopBgm, syncBgmPlayButtons, getBgmAuditionState,
    synthTtsTake, playRealAudio, stopRealAudio, computeVoiceSynthSig, refreshVoiceStaleFlag,
    startTableRead, stopTableRead, toggleTableRead
  }; // 调试 / 验收用
}
init();
})();
