#!/usr/bin/env node
'use strict';
/*
 * scproj v2.1 example & unit checker (read-only; writes nothing).
 *   node projects/shinycolors/examples/scproj/_ref/check.js
 * 1. JSON Schema (ajv, desktop/node_modules) for every example + progress/*.json
 * 2. L1/L2 lossless: official_superset -> strip _meta == original (deep-equal; bytes via meta.source.sha256)
 * 3. decompile -> YAML -> compile round trip (canonical) for both stories
 * 4. fanwork .scs.yaml recompiles to the committed .scproj.json (canonical)
 * 5. Semantic rules V3 V4 V5 V6 V7 V8 V9 V11 V12 V13 V15 V16 V18 (docs/scproj_format_v2.md §7)
 * 6. v2.1 unit assertions for all 4 additive enhancements (speaker->charLabel + @none/@off, pack presentation metadata, hybrid voice recipe, holdMs/hold)
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const SC = path.resolve(__dirname, '../../..');
const NM = path.join(SC, 'desktop', 'node_modules');
const Ajv = require(path.join(NM, 'ajv'));
const yaml = require(path.join(NM, 'js-yaml'));
const scs = require('./scs_ref.js');
const ENZA = process.env.ENZA_ROOT || 'D:/enza';
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let fails = 0, warns = 0;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
const warn = msg => { console.log('WARN ' + msg); warns++; };

// ---- 1. schema
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(J(path.join(SC, 'schema/official_script.schema.json')));
const schemaObj = J(path.join(SC, 'schema/scproj.schema.json'));
const v = ajv.compile(schemaObj);
const vp = ajv.compile(J(path.join(SC, 'progress/_schema.json')));
const EX = path.join(SC, 'examples/scproj');
const PACK = path.join(EX, 'rooftop_after_rain.scpack');
const offEnv = J(path.join(EX, 'official_superset.scproj.json'));
const pack = J(path.join(PACK, 'pack.json'));
const fmt = f => JSON.stringify((f.errors || []).slice(0, 3).map(e => e.instancePath + ' ' + e.message));
ok(v(offEnv), 'schema official_superset.scproj.json ' + (v.errors ? fmt(v) : ''));
ok(v(pack), 'schema pack.json ' + (v.errors ? fmt(v) : ''));
const stories = {};
for (const s of pack.stories) {
  const p = path.join(PACK, s.file);
  ok(fs.existsSync(p), `V13 story file exists ${s.file}`);
  const doc = J(p); stories[s.id] = { entry: s, doc };
  ok(v(doc), `schema ${s.file} ` + (v.errors ? fmt(v) : ''));
  const metaId = Array.isArray(doc) ? s.id : doc.meta.id;
  ok(metaId === s.id && path.basename(s.file).split('.')[0] === s.id, `V13 id consistency ${s.id}`);
}
ok(new Set(pack.stories.map(s => s.id)).size === pack.stories.length, 'V13 pack story ids unique');
for (const f of fs.readdirSync(path.join(SC, 'progress')).filter(f => f.endsWith('.json') && f !== '_schema.json')) {
  const d = J(path.join(SC, 'progress', f));
  ok(vp(d), `progress/${f} ` + (vp.errors ? fmt(vp) : ''));
  if (d.done > d.total) warn(`progress/${f} done > total`);
}

// ---- 2. lossless
const exportedObj = scs.toOfficial(offEnv.lines);
const src = offEnv.meta.source, ser = src.serialization || {};
const exported = (ser.bom ? '\ufeff' : '') + JSON.stringify(exportedObj, null, ser.indent || undefined) + (ser.finalNewline ? (ser.eol === 'crlf' ? '\r\n' : '\n') : '');
ok(sha(Buffer.from(exported, 'utf8')) === src.sha256, 'L2 byte-identical export (sha256 == meta.source.sha256)');
const orig = path.join(ENZA, 'voice/json/json/json', src.path);
if (fs.existsSync(orig)) ok(JSON.stringify(exportedObj) === JSON.stringify(J(orig)), 'L1 semantic export == ' + orig);
else warn('L1 original not present, skipped: ' + orig);
ok(exportedObj.length === src.lineCount, 'line count preserved');

// ---- 3/4. round trips
const fanEntry = stories.fyk_rooftop01;
for (const [name, env] of [['official', offEnv], ['fanwork', fanEntry.doc]]) {
  const y = yaml.dump(scs.decompile(env), { lineWidth: -1, noRefs: true });
  const re = scs.compile(yaml.load(y), { packCharacters: pack.characters });
  ok(scs.canonical(re.lines) === scs.canonical(env.lines), `roundtrip compile(decompile(${name})) ≡ ${name}`);
}
const ysrc = fs.readFileSync(path.join(PACK, fanEntry.entry.source));
const recompiled = scs.compile(yaml.load(ysrc.toString('utf8')), { packCharacters: pack.characters });
ok(scs.canonical(recompiled.lines) === scs.canonical(fanEntry.doc.lines), 'fanwork .scs.yaml compiles to committed .scproj.json');
const cs = fanEntry.doc.meta.compile && fanEntry.doc.meta.compile.sourceSha256;
if (cs && cs !== sha(ysrc)) warn('V16 envelope stale vs source (sourceSha256 mismatch)'); else ok(true, 'V16 sourceSha256 matches');

// ---- 5. semantic
const CONTROL = { bg: ['off'], bgm: ['off', 'pause', 'fade_out', 'resume', '0000'], fg: ['off', 'fade_out'], middleFg: ['off', 'fade_out'] };
const OFFICIAL_PATH = {
  bg: id => [`assets/images/event/bg/${id}.jpg`, `assets/images/event/bg/${id}.png`],
  fg: id => [`assets/images/event/fg/${id}.png`],
  bgm: id => [`assets/sounds/bgm/${id}.m4a`],
  se: id => [`assets/sounds/se/event/${id}.m4a`],
  voice: id => [`voice/voice/events/${id}.m4a`],
  still: id => { const [t, s] = id.split('/'); return ['png', 'jpg', 'webp'].map(e => `assets/images/content/${t}/card/${s}.${e}`); },
};
const EXT = { bg: ['webp', 'png', 'jpg'], fg: ['webp', 'png'], bgm: ['m4a', 'ogg', 'mp3'], se: ['m4a', 'ogg', 'mp3', 'wav'], voice: ['m4a', 'ogg', 'wav', 'mp3'], still: ['webp', 'png', 'jpg'] };
const inside = p => { const r = path.relative(PACK, path.resolve(PACK, p)); return r && !r.startsWith('..') && !path.isAbsolute(r); };
function packFile(kind, id) {
  const def = (pack.assets && pack.assets[kind] && pack.assets[kind][id]) || null;
  if (def && def.file) { if (!inside(def.file)) return { def, bad: true }; return { def, file: fs.existsSync(path.join(PACK, def.file)) ? def.file : null }; }
  const ext = (pack.overlay && pack.overlay.extPriority && pack.overlay.extPriority[kind]) || EXT[kind];
  for (const e of ext) { const f = `assets/${kind}/${id}.${e}`; if (!inside(f)) return { def, bad: true }; if (fs.existsSync(path.join(PACK, f))) return { def, file: f }; }
  return { def, file: null };
}
const officialHas = (kind, id) => fs.existsSync(ENZA) ? OFFICIAL_PATH[kind](id).some(p => fs.existsSync(path.join(ENZA, p))) : null;
function resolve(kind, id, where) {
  if ((CONTROL[kind] || []).includes(id)) return;
  const r = packFile(kind, id);
  if (r.bad) return ok(false, `V11 ${where} ${kind}:${id} escapes pack root`);
  if (r.file) return ok(true, `V8 ${where} ${kind}:${id} -> pack ${r.file}`);
  if (r.def && ['pending', 'draft', 'rejected'].includes(r.def.status)) {
    const fb = r.def.fallback || (r.def.imageGen && r.def.imageGen.refBgId);
    const h = fb ? officialHas(kind, fb) : false;
    return h === false ? ok(false, `V8 ${where} ${kind}:${id} pending and fallback ${fb} unresolved`) : warn(`V8 ${where} ${kind}:${id} pending -> fallback ${fb}`);
  }
  if (r.def && ['approved', 'generated'].includes(r.def.status)) return ok(false, `V9 ${where} ${kind}:${id} status ${r.def.status} but file missing`);
  if (pack.overlay && pack.overlay.mode === 'isolated') return ok(false, `V8 ${where} ${kind}:${id} missing (isolated)`);
  const h = officialHas(kind, id);
  if (h === null) warn(`V8 ${where} ${kind}:${id} official unchecked (no ${ENZA})`);
  else ok(h, `V8 ${where} ${kind}:${id} -> official`);
}
if (pack.cover) {
  if (!inside(pack.cover)) ok(false, `V11 pack.cover escapes pack root: ${pack.cover}`);
  else if (fs.existsSync(path.join(PACK, pack.cover))) ok(true, `V8 pack.cover -> pack file ${pack.cover}`);
  else if (pack.cover.includes('/')) resolve('still', pack.cover, 'pack.cover');
  else resolve('bg', pack.cover, 'pack.cover');
}
for (const [kind, defs] of Object.entries(pack.assets || {})) for (const [id, d] of Object.entries(defs)) {
  if (d.file && d.sha256 && fs.existsSync(path.join(PACK, d.file))) ok(sha(fs.readFileSync(path.join(PACK, d.file))) === d.sha256, `V9 sha256 ${kind}:${id}`);
  if (d.imageGen && d.imageGen.workflow) ok(fs.existsSync(path.join(PACK, d.imageGen.workflow)), `V9 workflow exists ${d.imageGen.workflow}`);
}
const SECRET = /^(apiKey|api_key|token|secret|password|authorization)$/i;
(function scan(o, p) { if (o && typeof o === 'object') for (const [k, val] of Object.entries(o)) { if (SECRET.test(k)) ok(false, `V12 credential key at ${p}.${k}`); scan(val, p + '.' + k); } })(pack, 'pack');
ok(true, 'V12 credential scan done');

function semantic(name, lines, packCtx) {
  const uids = new Set(), labels = new Set(lines.filter(l => l.label).map(l => l.label));
  lines.forEach((l, i) => {
    const m = l._meta || {}, at = `${name}[${i}]`;
    if (m.uid) { if (uids.has(m.uid)) ok(false, `V3 dup uid ${m.uid} ${at}`); uids.add(m.uid); }
    if (l.nextLabel !== undefined && !labels.has(l.nextLabel)) ok(false, `V4 ${at} nextLabel ${l.nextLabel} has no label`);
    if (l.select !== undefined && l.nextLabel === undefined) ok(false, `V7 ${at} select without nextLabel`);
    if (m.takes) {
      ok(new Set(m.takes.map(t => t.id)).size === m.takes.length, `V6 ${at} take ids unique`);
      if (m.takeSelected) { const t = m.takes.find(t => t.id === m.takeSelected); ok(t && t.voice === l.voice, `V5 ${at} takeSelected ${m.takeSelected} == line.voice`); }
      for (const t of m.takes) {
        if (t.text !== undefined && t.text !== (m.ttsText ?? l.text)) warn(`V15 ${at} take ${t.id} stale text`);
        if (packCtx) resolve('voice', t.voice, at + '.take:' + t.id);
        if (t.recipe) {
          const segs = Array.isArray(t.recipe) ? t.recipe : t.recipe.segments;
          segs.forEach((seg, si) => {
            if (seg.ref) ok(inside(seg.ref), `V11 ${at}.take:${t.id}.recipe[${si}] ref safe`);
            if (seg.trimMs) ok(seg.trimMs[0] < seg.trimMs[1], `V18 ${at}.take:${t.id}.recipe[${si}] trimMs start < end`);
            if (packCtx && seg.kind === 'aizuchi' && seg.ref && seg.ref.includes('/')) {
              resolve('voice', seg.ref, `${at}.take:${t.id}.recipe[${si}]:aizuchi`);
            }
          });
        }
      }
    }
    if (packCtx) {
      for (const k of ['bg', 'bgm', 'se', 'fg', 'middleFg', 'voice']) if (typeof l[k] === 'string') resolve(k === 'middleFg' ? 'fg' : k, l[k], at);
      if (l.stillType && l.stillId) resolve('still', `${l.stillType}/${l.stillId}`, at);
    }
  });
  ok(true, `V3/V4/V5/V7/V18 scanned ${name} (${lines.length} lines)`);
}
semantic('official_superset', offEnv.lines, false);
for (const [id, s] of Object.entries(stories)) semantic(id, Array.isArray(s.doc) ? s.doc : s.doc.lines, true);

// ---- 6. v2.1 unit assertions (all 4 additive features)
(function testV21() {
  // 6.1 Feature #1: Author-mode speaker -> charLabel auto-resolution + @none/@off + verbatim non-guessing + ambiguity safety
  const explicitDoc = { scs: 2, meta: { id: 't_spk' }, lines: ['冬優子@fuyuko(smile,wait1,smile): テスト || 测试'] };
  const autoJaDoc = { scs: 2, meta: { id: 't_spk' }, lines: ['冬優子(smile,wait1,smile): テスト || 测试'] };
  const autoZhDoc = { scs: 2, meta: { id: 't_spk' }, lines: ['冬优子(smile,wait1,smile): 测试'] };
  const cExp = scs.compile(explicitDoc, { packCharacters: pack.characters });
  const cJa = scs.compile(autoJaDoc, { packCharacters: pack.characters });
  const cZh = scs.compile(autoZhDoc, { packCharacters: pack.characters });
  ok(scs.canonical(cJa.lines) === scs.canonical(cExp.lines), 'v2.1[1] author JA speaker auto-resolves identically to explicit @fuyuko');
  ok(cZh.lines[0].charLabel === 'fuyuko' && cZh.lines[0].charId === '018', 'v2.1[1] author ZH speaker (nameZh) auto-resolves to fuyuko + sprite');

  // Tier priority: story.meta.characters > pack.characters > char_map.json
  const tier1Doc = {
    scs: 2,
    meta: {
      id: 't_tier1',
      characters: {
        fuyuko_alt: { charType: 'idols', charId: '1030180010', charCategory: 'stand_costume', name: '冬優子', nameZh: '冬优子' }
      }
    },
    lines: ['冬優子(smile): ステージ衣装よ']
  };
  // Override fuyuko in story.meta.characters to ensure unambiguous Tier 1 win over pack.characters
  const tier1Override = {
    scs: 2,
    meta: {
      id: 't_tier1',
      characters: {
        fuyuko: { charType: 'idols', charId: '1030180010', charCategory: 'stand_costume', name: '冬優子', nameZh: '冬优子' }
      }
    },
    lines: ['冬優子(smile): ステージ衣装よ']
  };
  const cTier1 = scs.compile(tier1Override, { packCharacters: pack.characters });
  ok(cTier1.lines[0].charLabel === 'fuyuko' && cTier1.lines[0].charId === '1030180010', 'v2.1[1] Tier 1 story.meta.characters overrides Tier 2 pack.characters');

  // Tier 3 char_map.json fallback (no story.meta.characters, no pack.characters)
  const tier3Doc = { scs: 2, meta: { id: 't_tier3' }, lines: ['真乃(smile): こんにちは', '樱木真乃(smile): 你好'] };
  const cTier3 = scs.compile(tier3Doc);
  ok(cTier3.lines[0].charLabel === 'mano' && cTier3.lines[0].charId === '001' && cTier3.lines[1].charLabel === 'mano', 'v2.1[1] Tier 3 char_map.json resolves JA & ZH speaker to mano');

  // Ambiguous speaker in same tier -> must NOT guess
  const ambigDoc = {
    scs: 2,
    meta: {
      id: 't_ambig',
      characters: {
        clerk_a: { charType: 'sub_characters', charId: 'woman', charCategory: 'stand_costume', name: '店員' },
        clerk_b: { charType: 'sub_characters', charId: 'girl', charCategory: 'stand_costume', name: '店員' }
      }
    },
    lines: ['店員: いらっしゃいませ', '店員@clerk_b: ありがとうございました']
  };
  const cAmbig = scs.compile(ambigDoc);
  ok(cAmbig.lines[0].charLabel === undefined && cAmbig.lines[1].charLabel === 'clerk_b', 'v2.1[1] ambiguous speaker is not guessed; explicit @label still works');
  // Cross-tier ambiguity test: tier1Doc has fuyuko_alt in Tier 1 (1 match in Tier 1, even though pack has fuyuko) -> Tier 1 wins unambiguously
  const cTier1Win = scs.compile(tier1Doc, { packCharacters: pack.characters });
  ok(cTier1Win.lines[0].charLabel === 'fuyuko_alt' && cTier1Win.lines[0].charId === '1030180010', 'v2.1[1] single match in Tier 1 wins cleanly before checking Tier 2');

  // @none / @off escape hatch + preserving first-appearance state for later stage entry
  const noneDoc = {
    scs: 2,
    meta: { id: 't_none' },
    lines: [
      '冬優子@none: もしもし、聞こえる？',
      '冬優子@off: 今向かってるわよ',
      { say: '冬優子: もうすぐ着くから', char: 'none' },
      '冬優子(smile): お待たせ♪'
    ]
  };
  const cNone = scs.compile(noneDoc, { packCharacters: pack.characters });
  ok(
    cNone.lines[0].charLabel === undefined && cNone.lines[0].charId === undefined && cNone.lines[0].textFrame === '001' &&
    cNone.lines[1].charLabel === undefined &&
    cNone.lines[2].charLabel === undefined &&
    cNone.lines[3].charLabel === 'fuyuko' && cNone.lines[3].charId === '018' && cNone.lines[3].charPosition.x === 568,
    'v2.1[1] @none / @off / char:none suppress sprite & preserve later first-appearance autofill'
  );

  // verbatim mode strict non-guessing
  const verbDoc = { scs: 2, meta: { id: 't_verb', compile: { mode: 'verbatim' } }, lines: ['冬優子: もしもし…'] };
  const cVerb = scs.compile(verbDoc, { packCharacters: pack.characters });
  ok(cVerb.lines[0].charLabel === undefined && cVerb.lines[0].id === undefined, 'v2.1[1] verbatim mode strictly does not guess charLabel');

  // 6.2 Feature #2: pack.json presentation metadata (cover, unit, synopsis, synopsisZh, themeColor)
  ok(
    pack.cover === 'rooftop_after_rain' && pack.unit === 'straylight' &&
    typeof pack.synopsis === 'string' && pack.synopsis.length > 0 &&
    typeof pack.synopsisZh === 'string' && pack.synopsisZh.length > 0 &&
    pack.themeColor === '#D92B4B',
    'v2.1[2] rooftop_after_rain/pack.json demonstrates cover, unit, synopsis, synopsisZh, themeColor'
  );
  ok(v({ ...pack, cover: 'assets/bg/rooftop_after_rain.png', themeColor: '#5ce626' }), 'v2.1[2] schema accepts pack-relative cover path & lowercase hex themeColor');
  ok(v({ ...pack, cover: 'idols/1040180010', unit: 'noctchill' }), 'v2.1[2] schema accepts still ID cover & unit slug');
  ok(!v({ ...pack, themeColor: 'crimson' }) && !v({ ...pack, themeColor: '#12345' }) && !v({ ...pack, themeColor: '#GGGGGG' }), 'v2.1[2] schema rejects invalid themeColor values');
  ok(!v({ ...pack, cover: '../secret.png' }) && !v({ ...pack, cover: '/abs/cover.png' }) && !v({ ...pack, cover: 'C:\\cover.png' }), 'v2.1[2] schema rejects unsafe cover paths');

  // 6.3 Feature #3: _meta.takes[].recipe hybrid voice splice (object & array forms + negative checks)
  const vLine = ajv.compile({ $ref: schemaObj.$id + '#/definitions/line' });
  const baseTakeLine = recipe => ({
    id: 'x_001', speaker: '冬優子', text: '……はぁ。テスト', voice: 'custom/x/001_t1',
    _meta: { takeSelected: 't1', takes: [{ id: 't1', voice: 'custom/x/001_t1', recipe }] }
  });
  ok(vLine(baseTakeLine({
    crossfadeMs: 80,
    normalizeLufs: -18,
    segments: [
      { kind: 'aizuchi', ref: 'produce_events/101800401/1018004010220', gainDb: 0, trimMs: [0, 480] },
      { kind: 'tts', text: 'テスト', ref: 'fuyuko/honne/03', gainDb: -0.5 },
      { kind: 'wav', ref: 'cache/tail.wav', trimMs: [10, 200], gapMs: 40 }
    ]
  })), 'v2.1[3] schema accepts object take.recipe with aizuchi + tts + wav segments');
  ok(vLine(baseTakeLine([
    { kind: 'aizuchi', ref: 'produce_events/101800202/1018002020150' },
    { kind: 'tts', text: 'さすがプロデューサーさんですぅ' }
  ])), 'v2.1[3] schema accepts compact array take.recipe');
  ok(!vLine(baseTakeLine({ segments: [] })) && !vLine(baseTakeLine([])), 'v2.1[3] schema rejects empty recipe segments');
  ok(!vLine(baseTakeLine([{ kind: 'mp3', ref: 'foo.mp3' }])), 'v2.1[3] schema rejects unknown recipe segment kind');
  ok(!vLine(baseTakeLine([{ kind: 'aizuchi' }])) && !vLine(baseTakeLine([{ kind: 'wav' }])) && !vLine(baseTakeLine([{ kind: 'tts' }])), 'v2.1[3] schema requires ref (or text for tts) on recipe segments');
  ok(!vLine(baseTakeLine([{ kind: 'wav', ref: '../outside.wav' }])), 'v2.1[3] schema rejects path traversal in recipe segment ref');
  ok(!vLine(baseTakeLine([{ kind: 'wav', ref: 'cache/a.wav', trimMs: [100] }])), 'v2.1[3] schema rejects malformed trimMs tuple');

  // 6.4 Feature #4: _meta.holdMs & .scs.yaml shorthand hold
  const holdDoc = {
    scs: 2,
    meta: { id: 't_hold' },
    lines: [
      { say: '冬優子(smile): 普通の一言', hold: 300 },
      { say: '冬優子@none: ……余韻の重い一言', holdMs: 900 },
      { say: 'プロデューサー: 即座に次へ', hold: 0 }
    ]
  };
  const cHold = scs.compile(holdDoc, { packCharacters: pack.characters });
  ok(
    cHold.lines[0]._meta.holdMs === 300 && cHold.lines[0]._meta.hold === undefined &&
    cHold.lines[1]._meta.holdMs === 900 &&
    cHold.lines[2]._meta.holdMs === 0,
    'v2.1[4] hold alias compiles to _meta.holdMs (including 0ms)'
  );
  const decHold = scs.decompile(cHold);
  ok(decHold.lines[0].holdMs === 300 && scs.canonical(scs.compile(decHold).lines) === scs.canonical(cHold.lines), 'v2.1[4] decompile emits long-form holdMs and round-trips identically');
  ok(vLine({ speaker: '冬優子', text: '…', _meta: { holdMs: 0 } }) && vLine({ speaker: '冬優子', text: '…', _meta: { holdMs: 30000 } }), 'v2.1[4] schema accepts holdMs boundary values 0 and 30000');
  ok(
    !vLine({ speaker: '冬優子', text: '…', _meta: { holdMs: -1 } }) &&
    !vLine({ speaker: '冬優子', text: '…', _meta: { holdMs: 30001 } }) &&
    !vLine({ speaker: '冬優子', text: '…', _meta: { holdMs: 12.5 } }) &&
    !vLine({ speaker: '冬優子', text: '…', _meta: { holdMs: '500' } }),
    'v2.1[4] schema rejects out-of-range or non-integer holdMs'
  );
})();

console.log(`\n${fails ? 'FAILED' : 'OK'}: ${fails} fail, ${warns} warn`);
process.exit(fails ? 1 : 0);
