'use strict';
// Reference compiler/decompiler for scproj v2.1 shorthand (.scs.yaml) — owned by spec; executable definition of docs/scproj_format_v2.md §4.
// Implements docs/scproj_format_v2.md §4 (including v2.1 author-mode speaker -> charLabel resolution, @none/@off, hold -> holdMs).
// Downstream (editor-proto/studio) may copy/port it; does not perform disk asset existence checks.

const fs = require('fs');
const path = require('path');

const OFFICIAL_STRING_ID_FIELDS = ['bg', 'bgm', 'se', 'charId', 'textFrame', 'stillId', 'fg', 'middleFg', 'movie', 'voice'];
const META_KEYS = ['uid', 'zh', 'speakerZh', 'selectZh', 'i18n', 'ttsText', 'takes', 'takeSelected', 'mode', 'era',
  'surfaceEmotion', 'innerEmotion', 'vocalTone', 'macroId', 'macroArgs', 'lipBaked', 'holdMs', 'oocFlags', 'origin', 'src', 'ai', 'note', 'locked'];
const META_ALIASES = {
  tts: 'ttsText', take: 'takeSelected', emo: 'surfaceEmotion', inner: 'innerEmotion',
  tone: 'vocalTone', macro: 'macroId', ooc: 'oocFlags', hold: 'holdMs'
};
const SUGAR_KEYS = ['say', 'char', 'outfit', 'pos', 'anim', 'face', 'lip', 'anim3', 'anim4', 'anim5', 'effect', 'exit', 'enter',
  'bgmFade', 'jump', 'wait', 'autoWait', 'choices', 'still', 'raw', '_meta'];
const RESERVED = new Set([...SUGAR_KEYS, ...META_KEYS, ...Object.keys(META_ALIASES)]);
const NARRATOR = new Set(['', '制作人', 'プロデューサー', '旁白', 'off']);
const CHAR_NONE_TOKENS = new Set(['none', 'off']);
const OFFICIAL_KEYS = new Set(Object.keys(require(path.join(__dirname, '../../../schema/official_script.schema.json')).definitions.line.properties)
  .concat(['movieCtrl', 'fgEffectTime', 'lipAnimDuration', '_EMPTY', '_EMPTY14']));
const OUTFIT_ALIAS = { costume: 'stand_costume', jersey: 'stand_jersey', default: 'stand' };
const SLOTS = { 1: [568], 2: [310, 796], 3: [200, 568, 936], 4: [150, 420, 716, 986] };
const FADE_IN = () => ({ type: 'from', alpha: 0, time: 100 });
const FADE_OUT = () => ({ type: 'to', alpha: 0, time: 100 });

// Canonical unambiguous speaker names (JA + Simplified Chinese, given + full) for base char_map.json labels (Tier 3 fallback).
const CANON_CHAR_NAMES = {
  mano: ['真乃', '櫻木真乃', '樱木真乃'],
  hiori: ['灯織', '風野灯織', '灯织', '风野灯织'],
  meguru: ['めぐる', '八宮めぐる', '巡', '八宫巡'],
  kogane: ['恋鐘', '月岡恋鐘', '恋钟', '月冈恋钟'],
  mamimi: ['摩美々', '田中摩美々', '摩美美', '田中摩美美'],
  sakuya: ['咲耶', '白瀬咲耶', '白濑咲耶'],
  yuika: ['結華', '三峰結華', '结华', '三峰结华'],
  kiriko: ['霧子', '幽谷霧子', '雾子', '幽谷雾子'],
  kaho: ['果穂', '小宮果穂', '果穗', '小宫果穗'],
  chiyoko: ['智代子', '園田智代子', '园田智代子'],
  juri: ['樹里', '西城樹里', '树里', '西城树里'],
  rinze: ['凛世', '杜野凛世', '凜世', '杜野凜世'],
  natsuha: ['夏葉', '有栖川夏葉', '夏叶', '有栖川夏叶'],
  amana: ['甘奈', '大崎甘奈'],
  tenka: ['甜花', '大崎甜花'],
  chiyuki: ['千雪', '桑山千雪'],
  asahi: ['あさひ', '芹沢あさひ', '朝日', '芹泽朝日'],
  fuyuko: ['冬優子', '黛冬優子', '冬优子', '黛冬优子'],
  mei: ['愛依', '和泉愛依', '爱依', '和泉爱依'],
  toru: ['透', '浅倉透', '浅仓透'],
  madoka: ['円香', '樋口円香', '圆香', '樋口圆香'],
  koito: ['小糸', '福丸小糸'],
  hinana: ['雛菜', '市川雛菜', '雏菜', '市川雏菜'],
  nichika: ['にちか', '七草にちか', '日花', '七草日花'],
  mikoto: ['美琴', '緋田美琴', '绯田美琴'],
  luca: ['ルカ', '斑鳩ルカ', '路加', '斑鸠路加', '露卡', '斑鸠露卡'],
  hana: ['羽那', '鈴木羽那', '铃木羽那'],
  haruki: ['はるき', '郁田はるき', '阳希', '郁田阳希'],
  hazuki: ['はづき', '七草はづき', '叶月', '七草叶月'],
  ceo: ['社長', '天井努', '社长'],
  ruby: ['ルビー', '星野ルビー', '露比'],
  kana: ['かな', '有馬かな', '加奈', '有马加奈'],
  mem: ['MEMちょ', 'MEM啾'],
  akane: ['あかね', '黒川あかね', '茜', '黑川茜'],
};

const FALLBACK_CHAR_MAP = {
  mano: { id: '001', type: 'characters', cat: 'stand_fix' },
  hiori: { id: '002', type: 'characters', cat: 'stand_fix' },
  meguru: { id: '003', type: 'characters', cat: 'stand_fix' },
  kogane: { id: '004', type: 'characters', cat: 'stand_fix' },
  mamimi: { id: '005', type: 'characters', cat: 'stand_fix' },
  sakuya: { id: '006', type: 'characters', cat: 'stand_fix' },
  yuika: { id: '007', type: 'characters', cat: 'stand_fix' },
  kiriko: { id: '008', type: 'characters', cat: 'stand_fix' },
  kaho: { id: '009', type: 'characters', cat: 'stand_fix' },
  chiyoko: { id: '010', type: 'characters', cat: 'stand_fix' },
  juri: { id: '011', type: 'characters', cat: 'stand_fix' },
  rinze: { id: '012', type: 'characters', cat: 'stand_fix' },
  natsuha: { id: '013', type: 'characters', cat: 'stand_fix' },
  amana: { id: '014', type: 'characters', cat: 'stand_fix' },
  tenka: { id: '015', type: 'characters', cat: 'stand_fix' },
  chiyuki: { id: '016', type: 'characters', cat: 'stand_fix' },
  asahi: { id: '017', type: 'characters', cat: 'stand_fix' },
  fuyuko: { id: '018', type: 'characters', cat: 'stand_fix' },
  mei: { id: '019', type: 'characters', cat: 'stand_fix' },
  toru: { id: '020', type: 'characters', cat: 'stand_fix' },
  madoka: { id: '021', type: 'characters', cat: 'stand_fix' },
  koito: { id: '022', type: 'characters', cat: 'stand_fix' },
  hinana: { id: '023', type: 'characters', cat: 'stand_fix' },
  nichika: { id: '024', type: 'characters', cat: 'stand_fix' },
  mikoto: { id: '025', type: 'characters', cat: 'stand_fix' },
  luca: { id: '026', type: 'characters', cat: 'stand_fix' },
  hana: { id: '027', type: 'characters', cat: 'stand_fix' },
  haruki: { id: '028', type: 'characters', cat: 'stand_fix' },
  hazuki: { id: 'staff', type: 'sub_characters', cat: 'stand_silhouette' },
  ceo: { id: 'ceo', type: 'sub_characters', cat: 'stand_costume' },
};

let _defaultCharMapCache = null;
function getDefaultCharMap(customPath) {
  if (customPath) {
    return fs.existsSync(customPath) ? JSON.parse(fs.readFileSync(customPath, 'utf8')) : {};
  }
  if (_defaultCharMapCache !== null) return _defaultCharMapCache;
  const p = process.env.ENZA_CHAR_MAP || path.join(process.env.ENZA_ROOT || 'D:/enza', 'translations', 'char_map.json');
  try {
    _defaultCharMapCache = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : FALLBACK_CHAR_MAP;
  } catch (_) {
    _defaultCharMapCache = FALLBACK_CHAR_MAP;
  }
  return _defaultCharMapCache;
}

function normCharMap(cm) {
  const r = {};
  for (const [label, e] of Object.entries(cm || {})) {
    if (!e || typeof e !== 'object') continue;
    const charId = e.charId ?? e.id;
    const charType = e.charType ?? (charId !== undefined && /^\d{3}$/.test(String(charId)) && e.type === 'idols' ? 'characters' : e.type);
    const charCategory = e.charCategory ?? e.cat;
    r[label] = {
      ...e,
      ...(charId !== undefined ? { charId: String(charId) } : {}),
      ...(charType ? { charType } : {}),
      ...(charCategory ? { charCategory } : {}),
    };
  }
  return r;
}

function matchSpeakerInTable(speaker, table) {
  if (!table) return [];
  const hits = [];
  for (const [label, def] of Object.entries(table)) {
    if (!def || typeof def !== 'object') continue;
    if (def.name === speaker || def.nameZh === speaker || (Array.isArray(def.aliases) && def.aliases.includes(speaker))) {
      hits.push(label);
    }
  }
  return hits;
}

// Resolve speaker -> charLabel across story.meta.characters -> pack.characters -> char_map.json when unambiguous.
function resolveSpeaker(speaker, metaChars, packChars, charMap) {
  if (!speaker || NARRATOR.has(speaker)) return null;
  // Tier 1: story.meta.characters
  const t1 = matchSpeakerInTable(speaker, metaChars);
  if (t1.length === 1) return t1[0];
  if (t1.length > 1) return null;

  // Tier 2: pack.characters (excluding labels overridden by story.meta.characters)
  if (packChars) {
    const effPack = {};
    for (const [k, v] of Object.entries(packChars)) {
      if (!(metaChars && k in metaChars)) effPack[k] = v;
    }
    const t2 = matchSpeakerInTable(speaker, effPack);
    if (t2.length === 1) return t2[0];
    if (t2.length > 1) return null;
  }

  // Tier 3: char_map.json (explicit name/nameZh first, then canonical 283 idol/staff names for base labels)
  if (charMap) {
    const effCm = {};
    for (const [k, v] of Object.entries(charMap)) {
      if (!(metaChars && k in metaChars) && !(packChars && k in packChars)) effCm[k] = v;
    }
    const t3 = matchSpeakerInTable(speaker, effCm);
    if (t3.length === 1) return t3[0];
    if (t3.length > 1) return null;

    const canonHits = [];
    for (const [label, names] of Object.entries(CANON_CHAR_NAMES)) {
      if (!(label in charMap)) continue;
      const ov = (metaChars && metaChars[label]) || (packChars && packChars[label]) || charMap[label];
      if (ov && ov.name && !names.includes(ov.name)) continue;
      if (ov && ov.nameZh && !names.includes(ov.nameZh)) continue;
      if (names.includes(speaker)) canonHits.push(label);
    }
    if (canonHits.length === 1) return canonHits[0];
  }
  return null;
}

class ScsError extends Error { constructor(i, msg) { super(`item ${i + 1}: ${msg}`); } }

const HEAD_RE = /^([^:：@()]*?)(?:@([A-Za-z0-9_]+))?(?:\(([^)]*)\))?$/;
function parseSay(s, i) {
  const m = /[:：]/.exec(s);
  if (!m) throw new ScsError(i, `say needs "head: text": ${s}`);
  const head = s.slice(0, m.index).trim();
  let body = s.slice(m.index + 1).replace(/^ /, '');
  const hm = HEAD_RE.exec(head);
  if (!hm) throw new ScsError(i, `bad say head: ${head}`);
  const out = [];
  out.push(['speaker', hm[1].trim()]);
  if (hm[2]) out.push(['char', hm[2]]);
  if (hm[3] !== undefined) {
    const [face, anim, lip] = hm[3].split(',').map(x => x.trim());
    if (face && face !== '-') out.push(['face', face]);
    if (anim && anim !== '-') out.push(['anim', anim]);
    if (lip && lip !== '-') out.push(['lip', lip]);
  }
  let zh;
  const zi = body.indexOf(' || ');
  if (zi >= 0) { zh = body.slice(zi + 4); body = body.slice(0, zi); }
  out.push(['text', body]);
  if (zh !== undefined) out.push(['zh', zh]);
  return out;
}

function parseDirective(s, i) {
  const [cmd, ...rest] = s.slice(1).trim().split(/\s+/);
  const arg = rest.join(' ');
  switch (cmd) {
    case 'bg': case 'bgm': case 'se': case 'movie': return [[cmd, arg]];
    case 'frame': return [['textFrame', arg]];
    case 'label': return [['label', arg]];
    case 'jump': return [['jump', arg]];
    case 'wait': return [['wait', /^\d+$/.test(arg) ? Number(arg) : arg]];
    case 'still': return [['still', arg]];
    case 'enter': return [['enter', arg]];
    case 'exit': return [['exit', arg.includes(',') ? arg.split(',').map(x => x.trim()) : arg]];
    default: throw new ScsError(i, `unknown directive #${cmd}`);
  }
}

function prefixed(v, p) { return v === 'blank' || v.startsWith(p) ? v : p + v; }

// Expand one item -> array of { line:[[k,v]...], meta:{}, flags }
function expandItem(item, i, mode) {
  let pairs;
  const flags = { effectNone: false, enter: false, fromSay: false, charNone: false };
  if (typeof item === 'string') {
    if (item.startsWith('#')) pairs = parseDirective(item, i);
    else { pairs = parseSay(item, i); flags.fromSay = true; }
  } else if (item && typeof item === 'object' && !Array.isArray(item)) pairs = Object.entries(item);
  else throw new ScsError(i, 'item must be string or mapping');
  if (typeof item === 'object') {
    const ks = Object.keys(item);
    if (mode === 'author' && ks.length === 1 && !RESERVED.has(ks[0]) && !OFFICIAL_KEYS.has(ks[0]) && !ks[0].startsWith('x-'))
      throw new ScsError(i, `single unknown key "${ks[0]}" — unquoted say line? write "${ks[0]}: ..." in quotes or use full-width ：`);
    const si = pairs.findIndex(([k]) => k === 'say');
    if (si >= 0) { pairs.splice(si, 1, ...parseSay(pairs[si][1], i)); flags.fromSay = true; }
  }
  const line = []; const meta = {};
  let multi = null;
  const put = (k, v) => { const j = line.findIndex(([kk]) => kk === k); if (j >= 0) line[j][1] = v; else line.push([k, v]); };
  for (const [k0, v] of pairs) {
    const k = META_ALIASES[k0] || k0;
    if (META_KEYS.includes(k)) { meta[k] = v; continue; }
    switch (k) {
      case '_meta': Object.assign(meta, v); break;
      case 'raw':
        if ('_meta' in v) throw new ScsError(i, 'raw must not contain _meta');
        for (const [rk, rv] of Object.entries(v)) put(rk, rv);
        flags.raw = true; break;
      case 'char':
        if (v === null || CHAR_NONE_TOKENS.has(v)) flags.charNone = true;
        else put('charLabel', v);
        break;
      case 'outfit': put('charCategory', OUTFIT_ALIAS[v] || v); break;
      case 'pos': flags.pos = Array.isArray(v) ? { x: v[0], y: v[1] ?? 640 } : { x: v.x, y: v.y ?? 640, ...(v.order !== undefined ? { order: v.order } : {}) }; put('charPosition', null); break;
      case 'anim': put('charAnim1', v); break;
      case 'face': put('charAnim2', prefixed(String(v), 'face_')); break;
      case 'lip': put('charLipAnim', prefixed(String(v), 'lip_')); break;
      case 'anim3': case 'anim4': case 'anim5': put('charAnim' + k.slice(4), v); break;
      case 'effect':
        if (v === 'none') flags.effectNone = true;
        else put('charEffect', v === 'in' ? FADE_IN() : v === 'out' ? FADE_OUT() : v);
        break;
      case 'enter': put('charLabel', v); put('charEffect', FADE_IN()); flags.enter = true; break;
      case 'exit': {
        const labels = Array.isArray(v) ? v : [v];
        multi = labels.map(l => ({ line: [['charLabel', l], ['charEffect', FADE_OUT()]], meta: {}, flags: {} }));
        break;
      }
      case 'bgmFade': put('bgmFadeTime', v); break;
      case 'autoWait': put('autoWaitTime', v); break;
      case 'jump': put('nextLabel', v); break;
      case 'wait':
        if (typeof v === 'number') { put('waitType', 'time'); put('waitTime', v); }
        else if (v === 'effect') put('waitType', 'effect');
        else { put('waitType', v.type); if (v.time !== undefined) put('waitTime', v.time); }
        break;
      case 'still':
        if (v === 'off') put('stillCtrl', 'off');
        else if (typeof v === 'string') { const j = v.lastIndexOf('/'); put('stillType', v.slice(0, j)); put('stillId', v.slice(j + 1)); }
        else { put('stillType', v.type); put('stillId', String(v.id)); }
        break;
      case 'choices':
        multi = v.map(c => {
          const m = {}; if (c.zh !== undefined) m.selectZh = c.zh;
          for (const [ck, cv] of Object.entries(c)) { const kk = META_ALIASES[ck] || ck; if (kk !== 'zh' && META_KEYS.includes(kk)) m[kk] = cv; }
          return { line: [['select', c.text], ['nextLabel', c.jump]], meta: m, flags: {} };
        });
        break;
      default:
        if (mode === 'author' && OFFICIAL_STRING_ID_FIELDS.includes(k) && typeof v === 'number')
          throw new ScsError(i, `${k} must be a quoted string (YAML turned it into number ${v})`);
        put(k, v);
    }
  }
  if (multi) {
    if (line.length) throw new ScsError(i, 'exit/choices cannot be combined with other line keys');
    // item-level meta (e.g. macroId) applies to every generated line
    multi.forEach(g => { g.meta = { ...meta, ...g.meta }; });
    return multi;
  }
  return [{ line, meta, flags }];
}

function compile(doc, opts = {}) {
  let meta = {}, items;
  if (Array.isArray(doc)) items = doc;
  else { meta = doc.meta || {}; items = doc.lines || []; }
  const mode = (meta.compile && meta.compile.mode) || 'author';
  const charMap = opts.charMap !== undefined ? (opts.charMap || {}) : getDefaultCharMap(opts.charMapPath);
  const registry = { ...normCharMap(charMap), ...(opts.packCharacters || {}), ...(meta.characters || {}) };
  const gen = [];
  items.forEach((it, i) => gen.push(...expandItem(it, i, mode)));

  // v2.1: In author mode, auto-resolve say speaker -> charLabel when @label is omitted (and not suppressed via @none/@off)
  if (mode !== 'verbatim') {
    for (const g of gen) {
      if (!g.flags || g.flags.raw || !g.flags.fromSay || g.flags.charNone) continue;
      if (g.line.some(([k]) => k === 'charLabel')) continue;
      const spIdx = g.line.findIndex(([k]) => k === 'speaker');
      const resolved = spIdx >= 0 ? resolveSpeaker(g.line[spIdx][1], meta.characters, opts.packCharacters, charMap) : null;
      if (resolved) g.line.splice(spIdx + 1, 0, ['charLabel', resolved]);
    }
  }

  // cast order for auto slots
  const cast = [];
  for (const g of gen) { const l = g.line.find(([k]) => k === 'charLabel'); if (l && !cast.includes(l[1]) && g.flags && !isExitLine(g.line)) cast.push(l[1]); }
  const slots = SLOTS[cast.length] || cast.map((_, j) => Math.round(1136 * (j + 1) / (cast.length + 1)));

  const chars = {}; let seq = 0;
  const out = gen.map((g, gi) => {
    const o = {}; for (const [k, v] of g.line) o[k] = v;
    const auto = g.flags.raw ? false : mode === 'author';
    if (g.flags.pos) o.charPosition = g.flags.pos;
    if (auto) {
      if (typeof o.text === 'string') o.text = o.text.replace(/\r?\n/g, '\r\n');
      if (typeof o.select === 'string') o.select = o.select.replace(/\r?\n/g, '\r\n');
    }
    const label = o.charLabel;
    if (label) {
      const st = chars[label] || (chars[label] = { seen: false, exited: false, cat: null, pos: null });
      const reg = registry[label] || {};
      if (auto) {
        const exitNow = isExitObj(o.charEffect);
        const catChange = o.charCategory !== undefined && st.seen && o.charCategory !== st.cat;
        const first = !st.seen || st.exited || g.flags.enter;
        if (!exitNow && (first || catChange)) {
          const cat = o.charCategory ?? st.cat ?? reg.charCategory ?? 'stand';
          const outfit = (reg.outfits && reg.outfits[cat]) || {};
          if (o.charType === undefined) o.charType = outfit.charType ?? reg.charType;
          if (o.charId === undefined) o.charId = outfit.charId ?? reg.charId;
          if (o.charCategory === undefined) o.charCategory = cat;
          if (o.charPosition === undefined) {
            const ord = cast.indexOf(label);
            o.charPosition = st.pos ? { ...st.pos } : { x: slots[ord], y: 640, order: ord };
          }
          if (o.charEffect === undefined && !g.flags.effectNone) o.charEffect = FADE_IN();
          for (const k of ['charType', 'charId']) if (o[k] === undefined) delete o[k];
        }
        if (o.charPosition && o.charPosition.order === undefined && g.flags.pos) o.charPosition.order = cast.indexOf(label);
      }
      if (o.charCategory !== undefined) st.cat = o.charCategory;
      if (o.charPosition && typeof o.charPosition === 'object') st.pos = o.charPosition;
      if (isExitObj(o.charEffect)) st.exited = true;
      else { st.seen = true; st.exited = false; }
    }
    if (auto) {
      if (o.voice === undefined && g.meta.takeSelected && Array.isArray(g.meta.takes)) {
        const t = g.meta.takes.find(t => t.id === g.meta.takeSelected); if (t) o.voice = t.voice;
      }
      const hasText = typeof o.text === 'string';
      if ((hasText || o.voice !== undefined)) seq++;
      if ((hasText || o.voice !== undefined) && o.id === undefined) {
        const sid = String(meta.id || opts.id || 'custom');
        const id = /^\d{6,}$/.test(sid) ? Number(sid + String(seq * 10).padStart(4, '0')) : `${sid}_${String(seq).padStart(3, '0')}`;
        const rest = { ...o }; for (const k of Object.keys(o)) delete o[k]; o.id = id; Object.assign(o, rest);
      }
      if (hasText && o.textCtrl === undefined) o.textCtrl = 'p';
      if (o.select !== undefined && o.textCtrl === undefined) {
        const next = gen[gi + 1]; const nextSel = next && next.line.some(([k]) => k === 'select');
        if (!nextSel) o.textCtrl = 'cm';
      }
      if (o.textFrame === undefined) {
        if (hasText) o.textFrame = NARRATOR.has(o.speaker ?? '') ? '002' : '001';
        else if (o.select === undefined && Object.keys(o).some(k => k !== 'label' && k !== 'nextLabel')) o.textFrame = 'off';
      }
    }
    if (Object.keys(g.meta).length) o._meta = sortKeys(g.meta);
    return o;
  });
  const project = { format: 'scproj', formatVersion: 2, meta: stripCompile(meta, mode), lines: out };
  return project;
}

function stripCompile(meta, mode) { const m = { ...meta }; m.compile = { ...(meta.compile || {}), mode }; return m; }
function isExitObj(e) { return e && typeof e === 'object' && e.type === 'to' && e.alpha === 0; }
function isExitLine(line) { const e = line.find(([k]) => k === 'charEffect'); return e && isExitObj(e[1]); }
function sortKeys(o) { const r = {}; for (const k of Object.keys(o).sort()) r[k] = o[k]; return r; }

// scproj -> shorthand doc (verbatim mode, sugar-free). compile(decompile(p)) ≡ p
function decompile(project) {
  const meta = { ...project.meta, compile: { ...(project.meta.compile || {}), mode: 'verbatim' } };
  const lines = project.lines.map(l => {
    const off = {}; let needRaw = false;
    for (const [k, v] of Object.entries(l)) { if (k === '_meta') continue; off[k] = v; if (RESERVED.has(k)) needRaw = true; }
    const item = needRaw ? { raw: off } : { ...off };
    if (l._meta) {
      const x = {};
      for (const [k, v] of Object.entries(l._meta)) { if (META_KEYS.includes(k)) item[k] = v; else x[k] = v; }
      if (Object.keys(x).length) item._meta = x;
    }
    return item;
  });
  return { scs: 2, meta, lines };
}

// canonical form: official keys in order, _meta keys sorted, _meta last
function canonical(lines) {
  return JSON.stringify(lines.map(l => { const o = {}; for (const k of Object.keys(l)) if (k !== '_meta') o[k] = l[k]; if (l._meta) o._meta = sortKeys(l._meta); return o; }));
}
function toOfficial(lines) { return lines.map(l => { const o = {}; for (const k of Object.keys(l)) if (k !== '_meta') o[k] = l[k]; return o; }); }

module.exports = { compile, decompile, canonical, toOfficial, resolveSpeaker, RESERVED, META_KEYS, SUGAR_KEYS, META_ALIASES, CANON_CHAR_NAMES };
