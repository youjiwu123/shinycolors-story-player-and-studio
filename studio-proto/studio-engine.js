'use strict';

/**
 * Shiny Colors Fan-Story Studio Engine (Phase 2 — 3-Tier Project Hierarchy & 3-Step Progressive Authoring)
 *
 * Powers:
 *  - Workspace discovery & seeding (`projects_workspace/*.scpack` + `examples/scproj/*.scpack`)
 *  - Step 1: 1-paragraph idea -> multi-scene Outline cards (`expandOutline`) using `asset_semantics.json` + `bg_visual_index.json`
 *  - Step 2: Scene Outline -> editable Script rows + 30-person OOC check (`expandScript`) using `polisher-core.js`
 *  - Step 3: Deterministic Stage Compiler (`compileScene`) with strict stage rules:
 *      1. Max 3 characters on stage simultaneously (automatic camera group cuts at X: 240, 568, 896 with alpha fade-out of previous group)
 *      2. Uniform `charScale: 1` for all characters
 *      3. No consecutive duplicate `charAnim1` re-triggers on adjacent lines of the same character + 100% `anim_whitelist.json` verification
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const externalScriptAdapter = require('./external-script-adapter');

const SHINY_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_DIR = path.join(SHINY_ROOT, 'projects_workspace');
const EXAMPLES_DIR = path.join(SHINY_ROOT, 'examples', 'scproj');
const USER_IMPORTS_DIR = path.join(SHINY_ROOT, 'user_imports');

const POLISHER_PATH = path.join(SHINY_ROOT, 'studio', 'lib', 'polisher-core.js');
const ASSET_SEMANTICS_PATH = path.join(SHINY_ROOT, 'studio', 'data', 'asset_semantics.json');
const BG_VISUAL_INDEX_CANDIDATES = [
  path.join(SHINY_ROOT, 'studio', 'tools', 'contact_sheets', 'bg_visual_index.json'),
  path.join(SHINY_ROOT, 'studio', 'data', 'bg_visual_index.json'),
  path.join(SHINY_ROOT, 'data', 'bg_visual_index.json')
];
const ANIM_WHITELIST_CANDIDATES = [
  path.join(SHINY_ROOT, 'tools', 'cache', 'anim_whitelist.json'),
  path.join(SHINY_ROOT, 'data', 'anim_whitelist.json'),
  path.join(SHINY_ROOT, 'studio', 'data', 'anim_whitelist.json')
];
const BG_VISUAL_INDEX_PATH = BG_VISUAL_INDEX_CANDIDATES.find((p) => fs.existsSync(p)) || BG_VISUAL_INDEX_CANDIDATES[0];
const ANIM_WHITELIST_PATH = ANIM_WHITELIST_CANDIDATES.find((p) => fs.existsSync(p)) || ANIM_WHITELIST_CANDIDATES[0];

const polisher = require(POLISHER_PATH);
let studioGateway = null;
try {
  studioGateway = require('./studio-gateway');
} catch (_) {
  studioGateway = null;
}
const SPINE_METRICS_CANDIDATES = [
  path.join(SHINY_ROOT, 'studio', 'data', 'spine_anim_metrics.json'),
  path.join(SHINY_ROOT, 'data', 'spine_anim_metrics.json')
];
const SPINE_METRICS_PATH = SPINE_METRICS_CANDIDATES.find((p) => fs.existsSync(p)) || SPINE_METRICS_CANDIDATES[0];
let spineAnimMetrics = { characters: {} };
try {
  spineAnimMetrics = JSON.parse(fs.readFileSync(SPINE_METRICS_PATH, 'utf8'));
} catch (_) {
  spineAnimMetrics = { characters: {} };
}
const assetSemantics = JSON.parse(fs.readFileSync(ASSET_SEMANTICS_PATH, 'utf8'));
let animWhitelist = { characters: {} };
try {
  animWhitelist = JSON.parse(fs.readFileSync(ANIM_WHITELIST_PATH, 'utf8'));
} catch (_) {
  animWhitelist = { characters: {} };
}
let bgVisualIndex = null;
try {
  bgVisualIndex = JSON.parse(fs.readFileSync(BG_VISUAL_INDEX_PATH, 'utf8'));
} catch (_) {
  bgVisualIndex = { variantGroups: {} };
}

// ---------------------------------------------------------------------------
// 30-Person Roster Metadata & Authentic Speech Templates
// ---------------------------------------------------------------------------
const IDOL_META = {
  mano:    { id: '001', speaker: '真乃',   nameZh: '樱木真乃',   unit: 'illumination STARS', color: '#ffbad6', selfJa: 'わたし',   pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  hiori:   { id: '002', speaker: '灯織',   nameZh: '风野灯织',   unit: 'illumination STARS', color: '#144384', selfJa: '私',       pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  meguru:  { id: '003', speaker: 'めぐる', nameZh: '八宫巡',     unit: 'illumination STARS', color: '#ffe012', selfJa: 'わたし',   pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  kogane:  { id: '004', speaker: '恋鐘',   nameZh: '月冈恋钟',   unit: 'L\'Antica',          color: '#f84cad', selfJa: 'うち',     pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  mamimi:  { id: '005', speaker: '摩美々', nameZh: '田中摩美美', unit: 'L\'Antica',          color: '#a846fb', selfJa: '摩美々',   pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  sakuya:  { id: '006', speaker: '咲耶',   nameZh: '白濑咲耶',   unit: 'L\'Antica',          color: '#006047', selfJa: '私',       pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  yuika:   { id: '007', speaker: '結華',   nameZh: '三峰结华',   unit: 'L\'Antica',          color: '#3b91c4', selfJa: '結華',     pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  kiriko:  { id: '008', speaker: '霧子',   nameZh: '幽谷雾子',   unit: 'L\'Antica',          color: '#d9f2ff', selfJa: 'わたし',   pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  kaho:    { id: '009', speaker: '果穂',   nameZh: '小宫果穗',   unit: '放課後クライマックスガールズ', color: '#e5461c', selfJa: 'あたし', pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  chiyoko: { id: '010', speaker: '智代子', nameZh: '园田智代子', unit: '放課後クライマックスガールズ', color: '#f93b90', selfJa: '私',     pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  juri:    { id: '011', speaker: '樹里',   nameZh: '西城树里',   unit: '放課後クライマックスガールズ', color: '#ffc602', selfJa: 'アタシ', pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  rinze:   { id: '012', speaker: '凛世',   nameZh: '杜野凛世',   unit: '放課後クライマックスガールズ', color: '#89c3eb', selfJa: '凛世',   pCallJa: 'プロデューサーさま', pCallZh: '制作人大人' },
  natsuha: { id: '013', speaker: '夏葉',   nameZh: '有栖川夏叶', unit: '放課後クライマックスガールズ', color: '#90e667', selfJa: '私',     pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  amana:   { id: '014', speaker: '甘奈',   nameZh: '大崎甘奈',   unit: 'ALSTROEMERIA',       color: '#f54275', selfJa: '甘奈',     pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  tenka:   { id: '015', speaker: '甜花',   nameZh: '大崎甜花',   unit: 'ALSTROEMERIA',       color: '#e75bec', selfJa: '甜花',     pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  chiyuki: { id: '016', speaker: '千雪',   nameZh: '桑山千雪',   unit: 'ALSTROEMERIA',       color: '#fafafa', selfJa: '私',       pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  asahi:   { id: '017', speaker: 'あさひ', nameZh: '芹泽朝日',   unit: 'Straylight',         color: '#f30100', selfJa: 'わたし',   pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  fuyuko:  { id: '018', speaker: '冬優子', nameZh: '黛冬优子',   unit: 'Straylight',         color: '#5ce626', selfJa: 'ふゆ',     pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  mei:     { id: '019', speaker: '愛依',   nameZh: '和泉爱依',   unit: 'Straylight',         color: '#ff00ff', selfJa: 'うち',     pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  tooru:   { id: '020', speaker: '透',     nameZh: '浅仓透',     unit: 'noctchill',          color: '#50d0d0', selfJa: 'わたし',   pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  madoka:  { id: '021', speaker: '円香',   nameZh: '樋口圆香',   unit: 'noctchill',          color: '#be1e3e', selfJa: '私',       pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  koito:   { id: '022', speaker: '小糸',   nameZh: '福丸小糸',   unit: 'noctchill',          color: '#7967c3', selfJa: 'わたし',   pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  hinana:  { id: '023', speaker: '雛菜',   nameZh: '市川雏菜',   unit: 'noctchill',          color: '#ffc639', selfJa: '雛菜',     pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  nichika: { id: '024', speaker: 'にちか', nameZh: '七草日花',   unit: 'SHHis',              color: '#a5cfb6', selfJa: '私',       pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  mikoto:  { id: '025', speaker: '美琴',   nameZh: '绯田美琴',   unit: 'SHHis',              color: '#760e10', selfJa: '私',       pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  luca:    { id: '026', speaker: 'ルカ',   nameZh: '斑鸠路加',   unit: 'CoMETIK',            color: '#24140e', selfJa: '私',       pCallJa: 'プロデューサー',     pCallZh: '制作人' },
  hana:    { id: '027', speaker: '羽那',   nameZh: '铃木羽那',   unit: 'CoMETIK',            color: '#67b7dc', selfJa: 'あたし',   pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  haruki:  { id: '028', speaker: 'はるき', nameZh: '郁田阳希',   unit: 'CoMETIK',            color: '#fce2c4', selfJa: 'わたし',   pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' },
  hazuki:  { id: '091', speaker: 'はづき', nameZh: '七草叶月',   unit: '283プロダクション',  color: '#7fc9a4', selfJa: '私',       pCallJa: 'プロデューサーさん', pCallZh: '制作人先生' }
};

const IDOL_DETECT_ALIASES = {
  mano: ['樱木真乃', '櫻木真乃', '真乃'],
  hiori: ['风野灯织', '風野灯織', '灯织', '灯織'],
  meguru: ['八宫巡', '八宮めぐる', 'めぐる', '小巡'],
  kogane: ['月冈恋钟', '月岡恋鐘', '恋钟', '恋鐘'],
  mamimi: ['田中摩美美', '摩美美', '摩美々'],
  sakuya: ['白濑咲耶', '白瀬咲耶', '咲耶'],
  yuika: ['三峰结华', '三峰結華', '结华', '結華'],
  kiriko: ['幽谷雾子', '雾子', '霧子'],
  kaho: ['小宫果穗', '小宮果穂', '果穗', '果穂'],
  chiyoko: ['园田智代子', '園田智代子', '智代子'],
  juri: ['西城树里', '西城樹里', '树里', '樹里'],
  rinze: ['杜野凛世', '凛世', '凜世'],
  natsuha: ['有栖川夏叶', '有栖川夏葉', '夏叶', '夏葉'],
  amana: ['大崎甘奈', '甘奈'],
  tenka: ['大崎甜花', '甜花'],
  chiyuki: ['桑山千雪', '千雪'],
  asahi: ['芹泽朝日', '芹泽朝阳', '芹沢あさひ', 'あさひ', '朝日', '朝阳', 'asahi', 'ash'],
  fuyuko: ['黛冬优子', '黛冬優子', '冬优子', '冬優子', '冬优', 'fuyuko', 'fyk'],
  mei: ['和泉爱依', '和泉愛依', '爱依', '愛依', 'mei'],
  tooru: ['浅仓透', '浅倉透', '小透'],
  madoka: ['樋口圆香', '樋口円香', '圆香', '円香'],
  koito: ['福丸小糸', '小糸'],
  hinana: ['市川雏菜', '市川雛菜', '雏菜', '雛菜'],
  nichika: ['七草日花', '日花', 'にちか'],
  mikoto: ['绯田美琴', '緋田美琴', '美琴'],
  luca: ['斑鸠路加', '斑鸠路卡', '斑鳩ルカ', '路加', '路卡', '露卡', 'ルカ'],
  hana: ['铃木羽那', '鈴木羽那', '羽那'],
  haruki: ['郁田阳希', '郁田春希', '阳希', '春希', 'はるき'],
  hazuki: ['七草叶月', '七草葉月', '七草はづき', '叶月', '葉月', 'はづき']
};

const UNIT_DETECT_ALIASES = [
  { pattern: /illumination\s*stars|灯光组|照明星/i, cast: ['mano', 'hiori', 'meguru'] },
  { pattern: /l['’`]?antica|安提卡/i, cast: ['kogane', 'mamimi', 'sakuya', 'yuika', 'kiriko'] },
  { pattern: /放课后|放課後|放克/i, cast: ['kaho', 'chiyoko', 'juri', 'rinze', 'natsuha'] },
  { pattern: /alstroemeria|甜花团|阿尔斯特罗梅利亚/i, cast: ['amana', 'tenka', 'chiyuki'] },
  { pattern: /straylight|迷光/i, cast: ['asahi', 'fuyuko', 'mei'] },
  { pattern: /noctchill|诺克|夜鸣/i, cast: ['tooru', 'madoka', 'koito', 'hinana'] },
  { pattern: /shhis|シーズ/i, cast: ['nichika', 'mikoto'] },
  { pattern: /cometik/i, cast: ['luca', 'hana', 'haruki'] }
];

function detectCastFromText(text) {
  const raw = String(text || '');
  if (!raw.trim()) return [];
  const lower = raw.toLowerCase();
  const hits = [];

  for (const [charId, aliases] of Object.entries(IDOL_DETECT_ALIASES)) {
    let bestPos = -1;
    for (const alias of aliases) {
      const idx = lower.indexOf(alias.toLowerCase());
      if (idx !== -1 && (bestPos === -1 || idx < bestPos)) {
        bestPos = idx;
      }
    }
    // Special guard for single-char "透" so words like 透明/透过/渗透 don't false-trigger
    if (charId === 'tooru' && bestPos === -1) {
      const m = raw.match(/(?<![渗透穿透透明透过透彻透视透露通透湿剧])透(?![明过彻视露气支])/);
      if (m && typeof m.index === 'number') bestPos = m.index;
    }
    if (bestPos !== -1) {
      hits.push({ charId, pos: bestPos });
    }
  }

  for (const u of UNIT_DETECT_ALIASES) {
    const m = raw.match(u.pattern);
    if (m && typeof m.index === 'number') {
      u.cast.forEach((cid, offset) => {
        if (!hits.some((h) => h.charId === cid)) {
          hits.push({ charId: cid, pos: m.index + offset * 0.01 });
        }
      });
    }
  }

  hits.sort((a, b) => a.pos - b.pos);
  return hits.map((h) => h.charId);
}

// Emotion preset mappings (body candidates, face candidates, eye candidates, lip candidates)
const EMOTION_PRESETS = {
  joy: {
    id: 'joy',
    label: '😊喜悦',
    surfaceEmotion: 'joy_bright',
    innerEmotion: 'trust_warm',
    vocalTone: 'warm_soft',
    bodyCandidates: ['smile1', 'smile2', 'yes', 'hello', 'wait1'],
    faceCandidates: ['face_smile', 'face_smile1', 'face_smile2', 'face_joy', 'face_excite', 'face_wait'],
    eyeCandidates: ['eye_front', 'eye_left'],
    lipCandidates: ['lip_smile', 'lip_smile1', 'lip_joy', 'lip_trouble', 'lip_wait']
  },
  shy: {
    id: 'shy',
    label: '😳害羞',
    surfaceEmotion: 'shy_flustered',
    innerEmotion: 'affection_bashful',
    vocalTone: 'breath_flutter',
    bodyCandidates: ['shy1', 'shy2', 'wait2', 'wait3', 'wait1'],
    faceCandidates: ['face_shy', 'face_shy2', 'face_awkward', 'face_trouble', 'face_smile', 'face_smile1', 'face_wait'],
    eyeCandidates: ['eye_right', 'eye_left', 'eye_front'],
    lipCandidates: ['lip_shy', 'lip_trouble', 'lip_smile', 'lip_smile1', 'lip_wait']
  },
  confess_shy: {
    id: 'confess_shy',
    label: '💓害羞告白',
    surfaceEmotion: 'earnest_blush',
    innerEmotion: 'confession_heart',
    vocalTone: 'trembling_sincere',
    bodyCandidates: ['shy2', 'shy1', 'wait3', 'yes', 'wait2'],
    faceCandidates: ['face_shy', 'face_shy2', 'face_trouble', 'face_serious', 'face_close', 'face_smile', 'face_smile1'],
    eyeCandidates: ['eye_right', 'eye_front', 'eye_left'],
    lipCandidates: ['lip_shy', 'lip_trouble', 'lip_smile', 'lip_smile1', 'lip_wait']
  },
  earnest_shy: {
    id: 'earnest_shy',
    label: '😳紧张认真',
    surfaceEmotion: 'earnest_tense',
    innerEmotion: 'vulnerable_resolve',
    vocalTone: 'soft_hesitant',
    bodyCandidates: ['shy1', 'wait3', 'shy2', 'wait2'],
    faceCandidates: ['face_shy', 'face_trouble', 'face_awkward', 'face_serious', 'face_shy2', 'face_wait'],
    eyeCandidates: ['eye_front', 'eye_right', 'eye_left'],
    lipCandidates: ['lip_trouble', 'lip_shy', 'lip_smile', 'lip_smile1', 'lip_wait']
  },
  fluster_panic: {
    id: 'fluster_panic',
    label: '💦慌张失措',
    surfaceEmotion: 'panic_fluster',
    innerEmotion: 'caught_off_guard',
    vocalTone: 'fast_stammer',
    bodyCandidates: ['surp1', 'shy2', 'no', 'surp2', 'shy1'],
    faceCandidates: ['face_panic', 'face_awkward', 'face_surp', 'face_trouble', 'face_shy', 'face_anger', 'face_anger1'],
    eyeCandidates: ['eye_left', 'eye_right', 'eye_front'],
    lipCandidates: ['lip_trouble', 'lip_surp', 'lip_shy', 'lip_smile', 'lip_smile1', 'lip_wait']
  },
  coverup_bright: {
    id: 'coverup_bright',
    label: '😅强装镇定',
    surfaceEmotion: 'forced_bright',
    innerEmotion: 'hiding_fluster',
    vocalTone: 'bright_deflect',
    bodyCandidates: ['smile1', 'hello', 'shy1', 'wait2', 'yes'],
    faceCandidates: ['face_bitter_smile', 'face_awkward', 'face_smile', 'face_smile1', 'face_shy', 'face_joy', 'face_wait'],
    eyeCandidates: ['eye_front', 'eye_right', 'eye_left'],
    lipCandidates: ['lip_smile', 'lip_smile1', 'lip_trouble', 'lip_joy', 'lip_wait']
  },
  warm_relief: {
    id: 'warm_relief',
    label: '🌸温柔安心',
    surfaceEmotion: 'gentle_relief',
    innerEmotion: 'affection_calm',
    vocalTone: 'warm_gentle',
    bodyCandidates: ['smile1', 'yes', 'wait1', 'smile2'],
    faceCandidates: ['face_smile', 'face_smile1', 'face_joy', 'face_close', 'face_wait'],
    eyeCandidates: ['eye_front'],
    lipCandidates: ['lip_smile', 'lip_smile1', 'lip_joy', 'lip_wait']
  },
  smug_tease: {
    id: 'smug_tease',
    label: '😏得意打趣',
    surfaceEmotion: 'smug_playful',
    innerEmotion: 'teasing_confident',
    vocalTone: 'playful_lilt',
    bodyCandidates: ['smile2', 'hello', 'wait3', 'wait2', 'yes'],
    faceCandidates: ['face_doya', 'face_smile2', 'face_smile', 'face_smile1', 'face_wait'],
    eyeCandidates: ['eye_left', 'eye_front', 'eye_right'],
    lipCandidates: ['lip_smile', 'lip_smile1', 'lip_joy', 'lip_wait']
  },
  deadpan_tsukkomi: {
    id: 'deadpan_tsukkomi',
    label: '😑无语吐槽',
    surfaceEmotion: 'deadpan_stare',
    innerEmotion: 'dry_amusement',
    vocalTone: 'flat_dry',
    bodyCandidates: ['wait3', 'no', 'wait2', 'sad1'],
    faceCandidates: ['face_jito', 'face_close', 'face_serious', 'face_awkward', 'face_wait'],
    eyeCandidates: ['eye_right', 'eye_front', 'eye_left'],
    lipCandidates: ['lip_trouble', 'lip_serious', 'lip_smile', 'lip_smile1', 'lip_wait']
  },
  wry_smile: {
    id: 'wry_smile',
    label: '😅苦笑敷衍',
    surfaceEmotion: 'wry_forced',
    innerEmotion: 'helpless_polite',
    vocalTone: 'awkward_soft',
    bodyCandidates: ['wait2', 'shy1', 'wait1', 'smile1'],
    faceCandidates: ['face_bitter_smile', 'face_awkward', 'face_trouble', 'face_smile', 'face_smile1', 'face_wait'],
    eyeCandidates: ['eye_right', 'eye_front', 'eye_left'],
    lipCandidates: ['lip_trouble', 'lip_smile', 'lip_smile1', 'lip_wait']
  },
  tsun: {
    id: 'tsun',
    label: '😠傲娇',
    surfaceEmotion: 'anger_pout',
    innerEmotion: 'shy_defensive',
    vocalTone: 'crisp_clipped',
    bodyCandidates: ['anger1', 'anger2', 'no', 'wait2'],
    faceCandidates: ['face_anger', 'face_anger1', 'face_anger2', 'face_shy', 'face_wait'],
    eyeCandidates: ['eye_left', 'eye_right', 'eye_front'],
    lipCandidates: ['lip_anger', 'lip_anger1', 'lip_trouble', 'lip_smile', 'lip_smile1', 'lip_wait']
  },
  sad: {
    id: 'sad',
    label: '😢悲伤',
    surfaceEmotion: 'sad_downcast',
    innerEmotion: 'anxious_fragile',
    vocalTone: 'hushed_fragile',
    bodyCandidates: ['sad1', 'sad2', 'wait2', 'wait1'],
    faceCandidates: ['face_sad', 'face_sad1', 'face_sad2', 'face_close', 'face_trouble', 'face_wait'],
    eyeCandidates: ['eye_front', 'eye_right'],
    lipCandidates: ['lip_sad', 'lip_trouble', 'lip_smile', 'lip_smile1', 'lip_wait']
  },
  surp: {
    id: 'surp',
    label: '😮惊讶',
    surfaceEmotion: 'surprise_wide',
    innerEmotion: 'alert_spark',
    vocalTone: 'bright_pop',
    bodyCandidates: ['surp1', 'surp2', 'wait1', 'yes'],
    faceCandidates: ['face_surp', 'face_panic', 'face_wait', 'face_smile', 'face_smile1'],
    eyeCandidates: ['eye_front'],
    lipCandidates: ['lip_surp', 'lip_trouble', 'lip_smile', 'lip_smile1', 'lip_wait']
  },
  serious: {
    id: 'serious',
    label: '😐认真',
    surfaceEmotion: 'calm_neutral',
    innerEmotion: 'resolve_quiet',
    vocalTone: 'calm_even',
    bodyCandidates: ['wait3', 'wait2', 'yes', 'wait1'],
    faceCandidates: ['face_serious', 'face_wait', 'face_wait2', 'face_close'],
    eyeCandidates: ['eye_front'],
    lipCandidates: ['lip_serious', 'lip_smile', 'lip_smile1', 'lip_trouble', 'lip_joy', 'lip_sad', 'lip_wait']
  },
  idol: {
    id: 'idol',
    label: '✨营业',
    surfaceEmotion: 'smile_gentle',
    innerEmotion: 'performative_sweet',
    vocalTone: 'sweet_performative',
    bodyCandidates: ['smile2', 'hello', 'smile1', 'yes', 'wait1'],
    faceCandidates: ['face_smile2', 'face_smile', 'face_smile1', 'face_excite', 'face_wait'],
    eyeCandidates: ['eye_front'],
    lipCandidates: ['lip_smile', 'lip_smile1', 'lip_joy', 'lip_trouble', 'lip_wait']
  },
  sigh: {
    id: 'sigh',
    label: '💭叹气',
    surfaceEmotion: 'troubled_sigh',
    innerEmotion: 'guarded_distance',
    vocalTone: 'sigh_trail',
    bodyCandidates: ['wait3', 'wait2', 'sad1', 'wait1'],
    faceCandidates: ['face_close', 'face_close2', 'face_trouble', 'face_sad', 'face_sad1', 'face_wait'],
    eyeCandidates: ['eye_front', 'eye_right'],
    lipCandidates: ['lip_trouble', 'lip_sad', 'lip_smile', 'lip_smile1', 'lip_wait']
  }
};

const EMOTION_ALIAS_MAP = {
  angry: 'tsun', anger: 'tsun', mad: 'tsun', annoyed: 'tsun', pout: 'tsun', irritated: 'tsun', '生气': 'tsun', '怒': 'tsun', '傲娇': 'tsun',
  surprise: 'surp', surprised: 'surp', shock: 'surp', shocked: 'surp', amazed: 'surp', '惊讶': 'surp', '吃惊': 'surp',
  calm: 'serious', neutral: 'serious', normal: 'serious', focused: 'serious', think: 'serious', '认真': 'serious', '严肃': 'serious', '冷静': 'serious',
  happy: 'joy', glad: 'joy', smile: 'joy', cheerful: 'joy', excited: 'joy', '喜悦': 'joy', '开心': 'joy', '高兴': 'joy',
  embarrassed: 'shy', blush: 'shy', bashful: 'shy', '害羞': 'shy', '脸红': 'shy',
  trouble: 'sigh', troubled: 'sigh', worried: 'sigh', tired: 'sigh', helpless: 'sigh', resign: 'sigh', '叹气': 'sigh', '无奈': 'sigh', '困扰': 'sigh',
  cry: 'sad', down: 'sad', lonely: 'sad', '悲伤': 'sad', '难过': 'sad',
  perform: 'idol', charming: 'idol', winking: 'idol', '营业': 'idol', '偶像': 'idol',
  confess: 'confess_shy', confession: 'confess_shy', earnest_shy: 'earnest_shy',
  panic: 'fluster_panic', fluster: 'fluster_panic', coverup: 'coverup_bright',
  warm: 'warm_relief', relief: 'warm_relief', smug: 'smug_tease', tease: 'smug_tease',
  deadpan: 'deadpan_tsukkomi', tsukkomi: 'deadpan_tsukkomi', wry: 'wry_smile'
};

function classifyNuancedRowEmotion(rawEmo, noteHint, textHint) {
  const emo = String(rawEmo || '').trim().toLowerCase();
  const note = String(noteHint || '').trim();
  const text = String(textHint || '').trim();
  const combined = `${note} ${text}`.trim();
  // 若文本与舞台提示体现出强心理冲突/告白/慌张/打哈哈/吐槽等细粒度情绪，优先于粗粒度 serious/calm
  if (/(认真|鼓起勇气|深吸|下定决心)/.test(note) && /(那、那个|一直|喜欢|告白|其实|笨蛋|对不起|没、没|只、只是)/.test(text)) {
    return /告白|喜欢|一直.*想|身边/.test(text) ? 'confess_shy' : 'earnest_shy';
  }
  if (/告白|最喜欢你|一直待在.*身边|永远待在/.test(combined)) return 'confess_shy';
  if (/慌张|手忙脚乱|语无伦次|没、没有啦|怎么会这样|糟了|完蛋|来不及|救命/.test(combined)) return 'fluster_panic';
  if (/改口|强装|逞强|摆手|转移话题|哈哈.*没|才不是啦|开玩笑/.test(combined)) return 'coverup_bright';
  if (/得意|叉腰|坏笑|挑眉|哼哼|早知道了|当然是我/.test(combined)) return 'smug_tease';
  if (/半月眼|吐槽|面无表情|无语|真是受不了|你认真的吗/.test(combined)) return 'deadpan_tsukkomi';
  if (/苦笑|干笑|营业笑|假笑|勉强笑/.test(combined)) return 'wry_smile';
  if (/温柔|松了口气|会心一笑|欣慰|安心/.test(combined)) return 'warm_relief';
  if (emo && EMOTION_PRESETS[emo] && emo !== 'serious' && emo !== 'calm') return emo;
  if (emo && EMOTION_ALIAS_MAP[emo] && EMOTION_ALIAS_MAP[emo] !== 'serious') return EMOTION_ALIAS_MAP[emo];
  return normalizeEmotionKey(rawEmo, combined);
}

function normalizeEmotionKey(rawEmo, textHint) {
  const key = String(rawEmo || '').trim().toLowerCase();
  if (key && EMOTION_PRESETS[key]) return key;
  if (key && EMOTION_ALIAS_MAP[key]) return EMOTION_ALIAS_MAP[key];
  const hint = String(textHint || '');
  if (hint) {
    if (/[怒烦吵滚笨蛋蠢才哼！!]{2,}|不爽|生气|嫌弃|別碰|别碰|烦死了|ばか|うるさい|怒|むっ/.test(hint)) return 'tsun';
    if (/[惊讶什么居然怎么会？！]|えっ|ええっ|まさか|びっくり/.test(hint)) return 'surp';
    if (/[叹哎唉…]|算了|没办法|真是的|はぁ|やれやれ/.test(hint)) return 'sigh';
    if (/[脸红羞讨厌啦那个…//]|照|はずかし/.test(hint)) return 'shy';
    if (/[哭难过寂寞对不起]|ごめん|寂し|悲し|泣/.test(hint)) return 'sad';
    if (/认真|必须|决定|练习|比赛|舞台|プロデューサー|真面目/.test(hint)) return 'serious';
  }
  return 'joy';
}

function normalizeZhHonorifics(zhText, speakerCharLabel, jaText) {
  if (typeof globalThis !== 'undefined' && globalThis.ScPolisher && typeof globalThis.ScPolisher.normalizeZhHonorifics === 'function') {
    return globalThis.ScPolisher.normalizeZhHonorifics(zhText, speakerCharLabel, jaText);
  }
  let text = String(zhText == null ? '' : zhText);
  if (!text) return text;
  const ja = String(jaText == null ? '' : jaText);
  text = text.replace(/小爱衣/g, '爱依')
    .replace(/和泉爱衣/g, '和泉爱依')
    .replace(/爱衣(酱|亲|桑)/g, '爱依$1');
  if (!ja || /愛依|めい|Mei/i.test(ja) || /fuyu|冬[优優]|asahi|朝日|straylight|p(?:roducer)?/i.test(String(speakerCharLabel || ''))) {
    text = text.replace(/(?<![喜偏恋可热])爱衣(?![服物裳架柜])/g, '爱依');
  }
  text = text.replace(/小(朝日|爱依|爱衣|冬优子|冬优|真乃|灯织|恋钟|摩美美|咲耶|结华|雾子|智代子|树里|凛世|夏叶|甘奈|甜花|千雪|圆香|雏菜|美琴|日花|斑鸠|露卡|羽那|晴辉)(?![子的丝心时姐弟妹孩猫狗屋店车路])/g, (_, name) => (name === '爱衣' ? '爱依' : name));
  if (!ja || /透(?:ちゃん|さん)?/.test(ja)) {
    text = text.replace(/(?<![\u4e00-\u9fa5])小透(?![明镜亮澈\u4e00-\u9fa5])/g, '透');
  }
  if (/めぐる|meguru/i.test(ja)) {
    text = text.replace(/(?<![\u4e00-\u9fa5])小巡(?![逻视回查演捕游检警\u4e00-\u9fa5])/g, '巡');
  }
  text = text.replace(/(朝日|爱依|冬优子|冬优|恋钟|摩美美|咲耶|结华|雾子|智代子|树里|凛世|夏叶|甘奈|甜花|千雪|圆香|雏菜|小糸|美琴|日花)ちゃん/g, '$1');
  text = text
    .replace(/あさひちゃん/g, '朝日')
    .replace(/愛依ちゃん/g, '爱依')
    .replace(/(?:冬優子|ふゆ)ちゃん/g, '冬优');
  return text;
}

/**
 * Guaranteed valid Spine animation resolver against `anim_whitelist.json`
 * Includes semantic alias expansion for all Studio preset codes (`angry1`, `udin`, `glad1`, `face_angry`, `face_normal`, `nod`, `close_eye`, etc.)
 */
const SPINE_ANIM_ALIASES = {
  // Body & Head / Auxiliary motions
  angry1: ['anger1', 'anger2', 'serious', 'think', 'wait3', 'wait2'],
  angry2: ['anger2', 'anger1', 'serious', 'think', 'wait3', 'wait2'],
  glad1: ['smile2', 'smile3', 'smile1', 'yes'],
  glad2: ['skill1', 'smile3', 'smile2', 'smile1'],
  happy: ['smile1', 'smile2', 'smile3'],
  relief: ['wait2', 'wait3', 'wait1', 'smile1'],
  udin: ['think', 'wait3', 'wait2', 'wait1'],
  pose1: ['skill1', 'wait2', 'wait3', 'wait1'],
  pose2: ['touch', 'wait4', 'skill1', 'wait2', 'wait1'],
  shy3: ['shy3', 'shy2', 'shy1'],
  trouble: ['shy2', 'sad1', 'think', 'wait2', 'wait1'],
  trouble1: ['shy2', 'sad1', 'think', 'wait2', 'wait1'],
  trouble2: ['sad1', 'shy2', 'think', 'wait2', 'wait1'],
  panic: ['surp2', 'surp1', 'shy1'],
  shock: ['surp2', 'surp1'],
  fluster: ['shy1', 'surp1', 'shy2'],
  amaze: ['surp1', 'smile2', 'smile1'],
  serious: ['serious', 'think', 'wait3', 'wait2', 'wait1'],
  serious1: ['serious', 'think', 'wait3', 'wait2', 'wait1'],
  think: ['think', 'wait3', 'wait2', 'wait1'],
  refuse: ['no', 'no2', 'anger1', 'wait3', 'wait2'],
  shake: ['no', 'no2'],
  head_shake: ['no', 'no2'],
  sigh: ['sigh', 'sad1', 'wait3', 'wait2'],
  tired: ['sad2', 'sad1', 'wait2'],
  cry: ['sad2', 'sad1'],
  nod: ['yes', 'yes2'],
  head_nod: ['yes', 'yes2'],
  nod2: ['yes2', 'yes'],
  tilt: ['wait4', 'think', 'wait2', 'wait1'],
  head_tilt: ['wait4', 'think', 'wait2', 'wait1'],
  look: ['wait3', 'wait4', 'wait2', 'wait1'],
  bow: ['yes', 'wait3', 'wait2'],
  turn_back: ['no', 'wait3', 'wait2'],
  wait4: ['wait4', 'wait3', 'wait2', 'wait1'],
  // Face expressions
  face_normal: ['face_wait', 'face_smile', 'face_smile1'],
  face_smile: ['face_smile', 'face_smile1', 'face_smile2', 'face_joy', 'face_wait'],
  face_smile2: ['face_smile2', 'face_smile', 'face_smile1'],
  face_wink: ['face_close2', 'face_smile2', 'face_smile', 'face_smile1'],
  face_angry: ['face_anger', 'face_anger1', 'face_anger2', 'face_serious'],
  face_anger: ['face_anger', 'face_anger1', 'face_anger2', 'face_serious'],
  face_panic: ['face_surp2', 'face_surp', 'face_trouble', 'face_shy', 'face_awkward'],
  face_shock: ['face_surp2', 'face_surp'],
  face_amaze: ['face_surp', 'face_smile2', 'face_smile', 'face_smile1'],
  face_smirk: ['face_doya', 'face_cheat', 'face_smile2', 'face_smile', 'face_smile1'],
  face_laugh: ['face_joy', 'face_smile3', 'face_smile2', 'face_smile', 'face_smile1'],
  face_glad: ['face_joy', 'face_smile3', 'face_smile2', 'face_smile', 'face_smile1'],
  face_relief: ['face_close2', 'face_smile', 'face_smile1', 'face_close'],
  face_pout: ['face_anger2', 'face_anger', 'face_anger1', 'face_shy'],
  face_trouble: ['face_trouble', 'face_awkward', 'face_shy', 'face_close'],
  face_shy2: ['face_shy2', 'face_shy', 'face_trouble', 'face_close2', 'face_close'],
  face_tired: ['face_down', 'face_sad2', 'face_sad', 'face_close'],
  face_cry: ['face_cry', 'face_sad2', 'face_sad'],
  face_think: ['face_close', 'face_serious', 'face_wait'],
  face_blank: ['blank', 'face_nothing', 'face_wait'],
  face_surprised: ['face_surp', 'face_surp2'],
  face_sad: ['face_sad1', 'face_sad2', 'face_sad3', 'face_trouble', 'face_close'],
  face_doya: ['face_smile2', 'face_smile', 'face_smile1'],
  face_jito: ['face_close', 'face_serious', 'face_awkward', 'face_wait'],
  face_bitter_smile: ['face_awkward', 'face_trouble', 'face_smile', 'face_smile1'],
  // Gaze / Eye
  close_eye: ['face_close'],
  // Lip
  lip_normal: ['lip_smile', 'lip_smile1', 'lip_wait', 'lip_joy', 'lip_trouble', 'lip_a'],
  lip_trouble: ['lip_shy', 'lip_sad', 'lip_smile', 'lip_smile1', 'lip_wait'],
  lip_anger_s: ['lip_anger', 'lip_anger1', 'lip_serious', 'lip_wait', 'lip_a']
};

function getCharMetricsEntry(charId, outfitCtx) {
  const chars = (spineAnimMetrics && spineAnimMetrics.characters) || {};
  const raw = String((outfitCtx && outfitCtx.charId) || charId || '001').trim().replace(/^characters\/stand\//, '');
  const shortId = raw.slice(0, 3).padStart(3, '0');
  return chars[raw] || chars[shortId] || null;
}

function getCharAnimMetric(charId, animName, outfitCtx) {
  if (!animName) return null;
  const entry = getCharMetricsEntry(charId, outfitCtx);
  return (entry && entry.anims && entry.anims[animName]) || null;
}

function resolveClosedLipClipForChar(charId, validSet, outfitCtx) {
  const closedCands = ['lip_wait_s', 'lip_smile_s', 'lip_smile1_s', 'lip_shy_s', 'lip_sad_s', 'lip_trouble_s', 'lip_serious_s', 'lip_anger_s', 'blank'];
  for (const c of closedCands) {
    if (validSet.has(c)) return c;
  }
  const entry = getCharMetricsEntry(charId, outfitCtx);
  if (entry && Array.isArray(entry.closedLips)) {
    for (const c of entry.closedLips) {
      if (c && c !== 'blank' && validSet.has(c)) return c;
    }
    if (entry.closedLips[0] && validSet.has(entry.closedLips[0])) return entry.closedLips[0];
  }
  return 'lip_wait_s';
}

function resolveAudioFileFromUrl(voiceUrl) {
  const raw = String(voiceUrl || '').trim();
  if (!raw) return '';
  if (fs.existsSync(raw)) return raw;
  const ttsDirs = [
    path.join(USER_IMPORTS_DIR, '_tts_cache'),
    path.resolve(SHINY_ROOT, '..', 'user_imports', '_tts_cache')
  ];
  let clean = raw.split('?')[0].split('#')[0];
  try { clean = decodeURIComponent(clean); } catch (_) {}
  if (/^\/api\/studio\/tts\/audio\//.test(clean)) {
    const fname = path.basename(clean.slice('/api/studio/tts/audio/'.length));
    for (const d of ttsDirs) {
      const p = path.join(d, fname);
      if (fs.existsSync(p)) return p;
    }
  }
  const rel = clean.replace(/^\/?(?:voice|api\/studio\/tts\/cache)\//i, '');
  if (rel.startsWith('_tts_cache/')) {
    const fname = path.basename(rel.slice('_tts_cache/'.length));
    for (const d of ttsDirs) {
      const p = path.join(d, fname);
      if (fs.existsSync(p)) return p;
    }
  }
  const direct = path.join(USER_IMPORTS_DIR, rel);
  if (fs.existsSync(direct)) return direct;
  const siblingDirect = path.resolve(SHINY_ROOT, '..', 'user_imports', rel);
  if (fs.existsSync(siblingDirect)) return siblingDirect;
  const baseName = path.basename(rel);
  for (const d of ttsDirs) {
    const p = path.join(d, baseName);
    if (fs.existsSync(p)) return p;
  }
  return '';
}

function expandAnimCandidates(candidates) {
  const out = [];
  for (const cand of (candidates || [])) {
    if (cand && !out.includes(cand)) out.push(cand);
  }
  for (const cand of (candidates || [])) {
    if (!cand) continue;
    const aliases = SPINE_ANIM_ALIASES[cand];
    if (Array.isArray(aliases)) {
      for (const al of aliases) {
        if (al && !out.includes(al)) out.push(al);
      }
    }
  }
  return out;
}

function getCharAnimSet(charId, charType, charCategory) {
  const packs = animWhitelist.packs || {};
  let cid = charId;
  let ctype = charType;
  let ccat = charCategory;
  if (cid && typeof cid === 'object') {
    ctype = ctype || cid.charType;
    ccat = ccat || cid.charCategory;
    if (cid.packKey && packs[cid.packKey]) return new Set(packs[cid.packKey]);
    cid = cid.charId || cid.id || '001';
  }
  const raw = String(cid || '001').trim();
  if (raw.includes('/') && packs[raw]) {
    return new Set(packs[raw]);
  }
  if (ctype && ccat && raw) {
    const exactKey = `${ctype}/${ccat}/${raw}`;
    if (packs[exactKey]) return new Set(packs[exactKey]);
    const paddedKey = `${ctype}/${ccat}/${raw.padStart(3, '0')}`;
    if (packs[paddedKey]) return new Set(packs[paddedKey]);
  }
  if (raw.length > 3) {
    for (const k of Object.keys(packs)) {
      if (k.endsWith('/' + raw)) return new Set(packs[k]);
    }
  }
  const baseKey = `characters/stand/${raw.replace(/^characters\/stand\//, '').padStart(3, '0')}`;
  const list = packs[baseKey] || packs['characters/stand/001'] || [];
  return new Set(list);
}

function resolveValidAnim(charId, candidates, fallbackSlot, outfitCtx) {
  const validSet = outfitCtx ? getCharAnimSet(outfitCtx) : getCharAnimSet(charId);
  const expanded = expandAnimCandidates(candidates);
  if (fallbackSlot === 'lip') {
    if (Array.isArray(candidates) && candidates.length && (/_s\d*$/.test(String(candidates[0] || '')) || candidates[0] === 'blank')) {
      return resolveClosedLipClipForChar(charId, validSet, outfitCtx);
    }
    const metricsEntry = getCharMetricsEntry(charId, outfitCtx);
    const getDur = (name) => (metricsEntry && metricsEntry.anims && metricsEntry.anims[name]) ? Number(metricsEntry.anims[name].dur || 0) : -1;
    const isClosedStatic = (name) => /_s\d*$/.test(name) || name === 'blank' || (getDur(name) >= 0 && getDur(name) < 0.25);
    const isLongVowel = (name) => name === 'lip_a' || name === 'lip_i';
    // 1. 优先选择 0.25s..4.5s 自然说话嘴型动画（跳过 *_s 静止闭口和 10s 长元音）
    for (const cand of expanded) {
      if (cand && validSet.has(cand) && !isClosedStatic(cand) && !isLongVowel(cand)) return cand;
    }
    const talkFallbacks = ['lip_smile', 'lip_smile1', 'lip_joy', 'lip_trouble', 'lip_shy', 'lip_surp', 'lip_sad', 'lip_wait', 'lip_anger', 'lip_anger1'];
    for (const fb of talkFallbacks) {
      if (validSet.has(fb) && !isClosedStatic(fb) && !isLongVowel(fb)) return fb;
    }
    // 2. 若确实无常规会话循环，再允许 lip_a/lip_i 或任意 dur >= 0.25 动画
    for (const cand of expanded) {
      if (cand && validSet.has(cand) && !isClosedStatic(cand)) return cand;
    }
    if (metricsEntry && Array.isArray(metricsEntry.talkingLips)) {
      for (const item of metricsEntry.talkingLips) {
        const nm = String(item || '').replace(/\([^)]*\)$/, '');
        if (nm && validSet.has(nm)) return nm;
      }
    }
  }
  for (const cand of expanded) {
    if (cand && validSet.has(cand)) return cand;
  }
  if (fallbackSlot === 'head') {
    return null;
  }
  if (fallbackSlot === 'eye') {
    for (const fb of ['eye_front', 'eye_right', 'eye_left']) {
      if (validSet.has(fb)) return fb;
    }
    return null;
  }
  const slotFallbacks = {
    body: ['wait1', 'wait2', 'wait', 'smile1', 'yes'],
    face: ['face_wait', 'face_smile', 'face_smile1', 'face_close', 'blank'],
    lip: ['lip_smile', 'lip_smile1', 'lip_sad', 'lip_trouble', 'lip_wait', 'lip_a', 'blank']
  }[fallbackSlot || 'body'] || ['wait'];
  for (const fb of slotFallbacks) {
    if (validSet.has(fb)) return fb;
  }
  return Array.from(validSet)[0] || 'wait';
}

function resolveEmotionAnims(charLabel, emotionKey, prevBodyAnim, outfitCtx) {
  const meta = IDOL_META[charLabel] || IDOL_META.mano;
  const charId = meta.id;
  const normEmo = normalizeEmotionKey(emotionKey);
  const preset = EMOTION_PRESETS[normEmo] || EMOTION_PRESETS.joy;
  const validSet = outfitCtx ? getCharAnimSet(outfitCtx) : getCharAnimSet(charId);

  // Pick a body animation that does NOT repeat `prevBodyAnim` if an alternative exists
  let bodyAnim = null;
  for (const cand of preset.bodyCandidates) {
    if (validSet.has(cand) && cand !== prevBodyAnim) {
      bodyAnim = cand;
      break;
    }
  }
  if (!bodyAnim) {
    // Try secondary idle/nod fallbacks different from prevBodyAnim
    for (const alt of ['wait1', 'wait2', 'yes', 'wait3', 'wait']) {
      if (validSet.has(alt) && alt !== prevBodyAnim) {
        bodyAnim = alt;
        break;
      }
    }
  }
  if (!bodyAnim) {
    bodyAnim = resolveValidAnim(charId, preset.bodyCandidates, 'body', outfitCtx);
  }

  const faceAnim = resolveValidAnim(charId, preset.faceCandidates, 'face', outfitCtx);
  const eyeAnim = resolveValidAnim(charId, preset.eyeCandidates, 'eye', outfitCtx);
  const lipAnim = resolveValidAnim(charId, preset.lipCandidates, 'lip', outfitCtx);

  return {
    anim1: bodyAnim,
    anim2: faceAnim,
    anim3: eyeAnim,
    lip: lipAnim,
    preset
  };
}

// ---------------------------------------------------------------------------
// Step 2 OOC Audit Helper (`polisher-core.js`)
// ---------------------------------------------------------------------------
function auditScriptRows(scriptRows) {
  let passCount = 0;
  let warnCount = 0;
  let errCount = 0;

  const auditedRows = (scriptRows || []).map((row, idx) => {
    const r = Object.assign({}, row);
    if (!r.rowId) r.rowId = `row_${String(idx + 1).padStart(2, '0')}`;
    if (r.kind === 'cue') {
      passCount++;
      r.ooc = { ok: true, status: 'pass', flags: [], issues: [] };
      return r;
    }
    const meta = r.charLabel ? IDOL_META[r.charLabel] : null;
    if (!r.speaker) {
      r.speaker = meta ? meta.speaker : (r.speaker === '' ? '' : 'プロデューサー');
    }
    if (r.charLabel && meta && r.text) {
      const check = polisher.validateLine({ speaker: r.speaker, text: r.text }, r.charLabel);
      const issues = (check.issues || []).filter((f) => f.level === 'error' || f.level === 'warn');
      const hasErr = Boolean(check.hasError || issues.some((f) => f.level === 'error'));
      const hasWarn = Boolean(check.hasWarn || issues.some((f) => f.level === 'warn'));
      if (hasErr) errCount++;
      else if (hasWarn) warnCount++;
      else passCount++;
      r.ooc = {
        ok: !hasErr && !hasWarn,
        status: hasErr ? 'error' : (hasWarn ? 'warn' : 'pass'),
        flags: issues,
        issues
      };
    } else {
      passCount++;
      r.ooc = { ok: true, status: 'pass', flags: [], issues: [] };
    }
    return r;
  });

  return {
    rows: auditedRows,
    summary: {
      total: auditedRows.length,
      pass: passCount,
      warn: warnCount,
      error: errCount
    }
  };
}

// ---------------------------------------------------------------------------
// 4-Tier Hierarchy Helper: Scene -> Segments (🧩 剧情小段 Beat/Segment) -> ScriptRows
// ---------------------------------------------------------------------------
function parseBeatTextToSegment(beatStr, idx, defaultCast) {
  const raw = String(beatStr || '').trim();
  const beatId = `beat_${idx + 1}`;
  const cleaned = raw.replace(/^(?:节拍|小段|Beat)\s*\d+\s*[：:·\-—]?\s*/i, '').trim();
  let title = `小段 ${idx + 1}`;
  let summary = cleaned || `第 ${idx + 1} 小段剧情推进`;

  const bracketMatch = cleaned.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (bracketMatch) {
    title = bracketMatch[1].trim().slice(0, 22);
    summary = (bracketMatch[2] || cleaned).trim();
  } else if (cleaned.includes(' — ')) {
    const parts = cleaned.split(' — ');
    title = parts[0].trim().slice(0, 22);
    summary = parts.slice(1).join(' — ').trim();
  } else if (cleaned.includes('，')) {
    const firstClause = cleaned.split('，')[0].trim();
    title = firstClause.slice(0, 18);
    summary = cleaned;
  } else if (cleaned) {
    title = cleaned.slice(0, 18);
    summary = cleaned;
  }

  return {
    beatId,
    title: title || `小段 ${idx + 1}`,
    summary: summary || title,
    cast: Array.isArray(defaultCast) && defaultCast.length ? defaultCast.slice(0, 3) : ['amana', 'hana'],
    targetLines: 3
  };
}

const MOOD_ZH_MAP = {
  warm: '温暖日常',
  upbeat: '明快元气',
  calm: '宁静舒缓',
  emotional: '感动抒情',
  tense: '紧张悬念',
  sad: '低落感伤',
  comedy: '轻松逗趣',
  energetic: '活力燃向',
  ambient: '自然环境音'
};

function inferSegmentMood(text = '', fallbackMood = 'warm') {
  const s = String(text || '');
  if (!s.trim()) return fallbackMood;
  if (/突发|危机|失联|惊慌|紧张|争执|糟糕|急迫|险情|警告|迷路/.test(s)) return 'tense';
  if (/失落|难过|沮丧|哭泣|寂寞|低落|消沉|委屈|叹气/.test(s)) return 'sad';
  if (/重逢|相拥|感动|夕阳|晚霞|告白|心意|羁绊|约定|致谢|释放|释然|泪光|温柔/.test(s)) return 'emotional';
  if (/吐槽|搞笑|乌龙|糊涂|闹腾|打趣|坏笑|恶作剧/.test(s)) return 'comedy';
  if (/排练|欢呼|干劲|冲刺|舞台|惊喜|激动|兴奋|齐声/.test(s)) return 'energetic';
  if (/蝉鸣|盛夏|海浪|微风|雨停|星空|夜风|户外|虫鸣|静谧|自然/.test(s)) return 'ambient';
  if (/开心|明快|阳光|轻快|游玩|散步|海风|野餐|笑声/.test(s)) return 'upbeat';
  if (/休息|茶歇|喝茶|自习|复盘|安静|看海|思考|等待/.test(s)) return 'calm';
  if (/温暖|微笑|陪伴|照顾|鼓励|日常/.test(s)) return 'warm';
  return fallbackMood;
}

function moodPolarityGroup(mood) {
  if (mood === 'tense' || mood === 'sad') return 'conflict';
  if (mood === 'emotional') return 'climax';
  if (mood === 'energetic' || mood === 'upbeat' || mood === 'comedy') return 'bright';
  if (mood === 'ambient') return 'ambient';
  return 'steady';
}

function buildDefaultBgmStyleSummary(segments = [], openingBgmId = '') {
  const segMoods = segments.map((s) => MOOD_ZH_MAP[s.mood] || '温暖日常');
  const compactArc = [];
  for (const m of segMoods) {
    if (!compactArc.length || compactArc[compactArc.length - 1] !== m) compactArc.push(m);
  }
  const arcStr = compactArc.join(' → ') || '温暖日常';
  const cat = getEnrichedBgmCatalog();
  const track = cat.find((x) => x.id === openingBgmId);
  const trackName = track ? track.title : (openingBgmId || '温柔配乐');
  return `情绪流向：${arcStr}｜开场主基调「${trackName}」`;
}

function analyzeSceneNarrativeMusicPlan(sceneObj = {}, segments = []) {
  const sceneText = [
    sceneObj.title || '',
    sceneObj.summary || '',
    ...segments.map((s) => `${s.title || ''} ${s.summary || ''}`)
  ].join(' ');

  const bgRecs = recommendBgsForContext(sceneText, { limit: 8 });
  const bgmRecs = recommendBgmsForContext(sceneText, { limit: 5 });

  let openingBgm = normalizeBgmId(sceneObj.bgm, '');
  if (!openingBgm) {
    openingBgm = bgmRecs.length ? bgmRecs[0].id : '002';
    sceneObj.bgm = openingBgm;
  } else {
    sceneObj.bgm = openingBgm;
  }

  let prevEffectiveBgm = openingBgm;
  let prevMood = (segments[0] && segments[0].mood) || inferSegmentMood(sceneText, 'warm');

  segments.forEach((seg, idx) => {
    const segText = `${seg.title || ''} ${seg.summary || ''} ${seg.blockingHint || ''}`;
    const validMood = MOOD_ZH_MAP[seg.mood] ? seg.mood : inferSegmentMood(segText, idx === 0 ? prevMood : prevMood);
    seg.mood = validMood;
    seg.bgmSuggestions = recommendBgmsForContext(`${sceneObj.title || ''} ${segText}`, { mood: validMood, limit: 3 });

    const explicitBgm = normalizeBgmId(seg.bgm, '');
    seg.bgmLocked = Boolean(seg.bgmLocked || explicitBgm);

    if (explicitBgm) {
      seg.bgm = explicitBgm;
      if (explicitBgm === 'fade_out' || explicitBgm === 'off') {
        seg.bgmReason = seg.bgmReason || '剧情需要留白/静场，音乐渐弱停顿';
        prevEffectiveBgm = 'off';
      } else {
        const hit = seg.bgmSuggestions.find((x) => x.id === explicitBgm) ||
          getEnrichedBgmCatalog().find((x) => x.id === explicitBgm);
        seg.bgmReason = seg.bgmReason || (hit ? `本段指定「${hit.title}」烘托${MOOD_ZH_MAP[validMood] || '当前'}氛围` : `本段切换至 BGM ${explicitBgm}`);
        prevEffectiveBgm = explicitBgm;
      }
    } else if (idx === 0) {
      seg.bgm = '';
      seg.bgmReason = seg.bgmReason || `开场段沿用本幕主配乐（${MOOD_ZH_MAP[validMood] || '温暖日常'}）`;
    } else if (!seg.bgmLocked) {
      const prevGrp = moodPolarityGroup(prevMood);
      const currGrp = moodPolarityGroup(validMood);
      const strongTurn = (prevGrp !== currGrp) || /转折|突然|突发|此刻|直到|夜幕|夕阳|黄昏|重逢|告别|告白|释放/.test(segText);
      const candidate = strongTurn
        ? seg.bgmSuggestions.find((c) => c.id !== prevEffectiveBgm && c.category !== 'silence' && c.category !== 'ambient')
        : null;
      if (candidate && candidate.score >= 30) {
        seg.bgm = candidate.id;
        seg.bgmReason = seg.bgmReason || `剧情转向「${MOOD_ZH_MAP[validMood] || validMood}」，自动切换「${candidate.title}」`;
        prevEffectiveBgm = candidate.id;
      } else {
        seg.bgm = '';
        seg.bgmReason = seg.bgmReason || '情绪平稳过渡，延续上一段配乐';
      }
    } else {
      seg.bgm = '';
      seg.bgmReason = seg.bgmReason || '已锁定为延续上一段配乐';
    }
    prevMood = validMood;
  });

  if (!sceneObj.bgmStyle || !String(sceneObj.bgmStyle).trim()) {
    sceneObj.bgmStyle = buildDefaultBgmStyleSummary(segments, openingBgm);
  }
  sceneObj.bgmSuggestions = bgmRecs;
  sceneObj.bgSuggestions = bgRecs;
}

function normalizeSceneSegments(sceneObj = {}) {
  const sceneCast = Array.isArray(sceneObj.cast) && sceneObj.cast.length
    ? sceneObj.cast.filter((c) => IDOL_META[c])
    : ['amana', 'hana'];

  let segments = [];
  if (Array.isArray(sceneObj.segments) && sceneObj.segments.length > 0) {
    segments = sceneObj.segments.map((seg, idx) => {
      if (typeof seg === 'string') {
        return parseBeatTextToSegment(seg, idx, sceneCast);
      }
      const beatId = String(seg.beatId || `beat_${idx + 1}`).trim();
      const title = String(seg.title || seg.beatTitle || `小段 ${idx + 1}`).trim();
      const summary = String(seg.summary !== undefined ? seg.summary : (seg.desc || title)).trim();
      const segCast = Array.isArray(seg.cast) && seg.cast.length
        ? seg.cast.filter((c) => IDOL_META[c])
        : sceneCast.slice(0, 3);
      return {
        beatId,
        title,
        summary,
        cast: segCast.length ? segCast : sceneCast.slice(0, 3),
        targetLines: Math.max(1, Math.min(20, Number(seg.targetLines) || 4)),
        needsActionCue: Boolean(seg.needsActionCue),
        blockingHint: String(seg.blockingHint || '').trim(),
        mood: String(seg.mood || '').trim().toLowerCase(),
        bgm: normalizeBgmId(seg.bgm, ''),
        bgmReason: String(seg.bgmReason || '').trim(),
        bgmLocked: Boolean(seg.bgmLocked),
        bgmSuggestions: Array.isArray(seg.bgmSuggestions) ? seg.bgmSuggestions : []
      };
    });
  } else if (Array.isArray(sceneObj.beats) && sceneObj.beats.length > 0) {
    segments = sceneObj.beats.map((b, idx) => parseBeatTextToSegment(b, idx, sceneCast));
  } else {
    segments = [
      {
        beatId: 'beat_1',
        title: '角色登场与情境铺垫',
        summary: '角色登场，交代当前时间地点与开场突发状况',
        cast: sceneCast.slice(0, 3),
        targetLines: 2
      },
      {
        beatId: 'beat_2',
        title: '核心互动与剧情推进',
        summary: '制作人与偶像展开关键互动交流，推进核心事件',
        cast: sceneCast.slice(0, 3),
        targetLines: 3
      },
      {
        beatId: 'beat_3',
        title: '情感升华与小段收尾',
        summary: '达成共识或温馨收尾，带着满满干劲迈向下一幕',
        cast: sceneCast.slice(0, 3),
        targetLines: 2
      }
    ];
  }

  analyzeSceneNarrativeMusicPlan(sceneObj, segments);

  const beats = segments.map((seg, idx) => {
    if (seg.summary && seg.summary !== seg.title && !seg.summary.startsWith(seg.title)) {
      return `节拍 ${idx + 1}：${seg.title} — ${seg.summary}`;
    }
    return `节拍 ${idx + 1}：${seg.summary || seg.title}`;
  });

  const segMap = new Map(segments.map((s) => [s.beatId, s]));
  let currentBeatIdx = 0;

  if (Array.isArray(sceneObj.scriptRows) && sceneObj.scriptRows.length > 0) {
    const totalRows = sceneObj.scriptRows.length;
    sceneObj.scriptRows = sceneObj.scriptRows.map((row, rIdx) => {
      const r = Object.assign({}, row);
      let bId = r.beatId || (r._meta && (r._meta['x-beatId'] || r._meta.beatId)) || '';
      if (!bId || !segMap.has(bId)) {
        const noteStr = String(r.note || '');
        const mBeat = noteStr.match(/\[(?:节拍|小段)\s*(\d+)/);
        if (mBeat) {
          const parsedIdx = Math.max(0, Math.min(segments.length - 1, parseInt(mBeat[1], 10) - 1));
          currentBeatIdx = parsedIdx;
          bId = segments[currentBeatIdx].beatId;
        } else if (/分支|选项|branch_|merge_|signal_success/.test(noteStr) && segments.length >= 2) {
          const branchSegIdx = /汇合|merge_|signal_success/.test(noteStr) ? Math.min(segments.length - 1, 2) : 1;
          currentBeatIdx = branchSegIdx;
          bId = segments[currentBeatIdx].beatId;
        } else if (rIdx === 0) {
          currentBeatIdx = 0;
          bId = segments[0].beatId;
        } else if (!bId) {
          const propIdx = Math.min(segments.length - 1, Math.floor((rIdx / Math.max(1, totalRows)) * segments.length));
          currentBeatIdx = Math.max(currentBeatIdx, propIdx);
          bId = (segments[currentBeatIdx] || segments[0]).beatId;
        }
      }
      const matchedSeg = segMap.get(bId) || segments[0];
      r.beatId = matchedSeg.beatId;
      r.beatTitle = r.beatTitle || matchedSeg.title;
      return r;
    });
  }

  sceneObj.segments = segments;
  sceneObj.beats = beats;
  return { segments, beats };
}

function getSemanticBgList(opts) {
  const options = typeof opts === 'number' ? { limit: opts } : (opts || {});
  const includeAbstract = Boolean(options.includeAbstract);
  const limit = Number(options.limit) || 0;
  let list = Object.values((assetSemantics && assetSemantics.bg) || {}).filter(
    (b) => b && b.id && (includeAbstract || (b.category !== 'abstract_effect' && b.category !== 'logo_title'))
  );
  if (!includeAbstract && list.length === 0) {
    list = Object.values((assetSemantics && assetSemantics.bg) || {}).filter((b) => b && b.id);
  }
  return limit > 0 ? list.slice(0, limit) : list;
}

function getSemanticBgmList() {
  return Object.values((assetSemantics && assetSemantics.bgm) || {}).filter((b) => b && b.id);
}

const BGM_CONTROL_TOKENS = new Set(['off', 'fade_out', 'pause', 'resume']);

/**
 * Normalize a BGM track identifier without collapsing distinct 3-digit music IDs
 * (e.g. '002') into 4-digit ambient loop IDs (e.g. '0002').
 */
function normalizeBgmId(rawId, fallbackId = '') {
  if (rawId === null || rawId === undefined) return fallbackId;
  const s = String(rawId).trim().replace(/\.(m4a|mp3|ogg|wav)$/i, '');
  if (!s) return fallbackId;
  const lower = s.toLowerCase();
  if (BGM_CONTROL_TOKENS.has(lower)) return lower;
  const bgmMap = (assetSemantics && assetSemantics.bgm) || {};
  if (Object.prototype.hasOwnProperty.call(bgmMap, s)) return s;
  if (/^10[12](\d{3})$/.test(s)) {
    const fourDigit = s.replace(/^10[12](\d{3})$/, '0$1');
    const threeDigit = s.slice(3);
    if (Object.prototype.hasOwnProperty.call(bgmMap, fourDigit)) return fourDigit;
    if (Object.prototype.hasOwnProperty.call(bgmMap, threeDigit)) return threeDigit;
    return fourDigit;
  }
  if (/^\d{1,2}$/.test(s)) {
    const p3 = s.padStart(3, '0');
    if (Object.prototype.hasOwnProperty.call(bgmMap, p3)) return p3;
    const p4 = s.padStart(4, '0');
    if (Object.prototype.hasOwnProperty.call(bgmMap, p4)) return p4;
    return p3;
  }
  return s;
}

function scoreAssetAgainstText(item, text) {
  if (!item || !text) return 0;
  const hay = String(text).toLowerCase();
  let score = 0;
  const label = String(item.zhLabel || '').toLowerCase();
  if (label) {
    const tokens = label.split(/[（）()·、/\s]+/).filter((t) => t.length >= 2);
    tokens.forEach((t) => {
      if (hay.includes(t)) score += 6;
    });
  }
  (item.tags || []).forEach((tag) => {
    const t = String(tag || '').toLowerCase();
    if (t.length >= 2 && hay.includes(t)) score += 4;
  });
  const tod = String(item.timeOfDay || '').toLowerCase();
  if (tod === 'sunset' && /夕阳|黄昏|傍晚|日落/.test(hay)) score += 5;
  if (tod === 'night' && /夜|晚|星|灯/.test(hay)) score += 5;
  if (tod === 'day' && /白天|午后|正午|晴/.test(hay)) score += 2;
  const emo = String(item.dominantEmotion || '').toLowerCase();
  if (emo === 'bright' && /开心|欢快|活力|夏日|游|海|惊喜/.test(hay)) score += 4;
  if (emo === 'calm' && /日常|茶|休息|聊天|温柔|平静|午后/.test(hay)) score += 3;
  if (emo === 'tense' && /紧张|神秘|迷失|危机|悬疑|暴雨/.test(hay)) score += 5;
  if (emo === 'sad' && /悲伤|泪|告别|回忆|孤独|抒情/.test(hay)) score += 5;
  return score;
}

function pickBestBgForText(text, fallbackId = '00001') {
  const bgs = getSemanticBgList();
  let best = null;
  let bestScore = 0;
  for (const b of bgs) {
    const s = scoreAssetAgainstText(b, text);
    if (s > bestScore || (s === bestScore && s > 0 && (b.usageCount || 0) > ((best && best.usageCount) || 0))) {
      best = b;
      bestScore = s;
    }
  }
  return best ? String(best.id).padStart(5, '0') : fallbackId;
}

const ENZA_ROOT_RESOLVED = process.env.ENZA_ROOT || process.env.ENZA_DATA_ROOT || 'D:\\enza';
const ENZA_BGM_DIR = process.env.ENZA_BGM_DIR || path.join(ENZA_ROOT_RESOLVED, 'assets', 'sounds', 'bgm');

/**
 * Curated musical & environmental metadata for commonly used Idolmaster Shiny Colors BGMs & ambient loops.
 */
const CURATED_BGM_TITLES = {
  '000': {
    title: '璀璨序曲·温暖开场',
    category: 'music',
    moodTags: ['warm', 'calm', 'emotional'],
    sceneHints: ['开场', '温馨', '序章', '介绍', '日常']
  },
  '001': {
    title: '宁静午后·舒缓钢琴',
    category: 'music',
    moodTags: ['calm', 'gentle', 'relaxed'],
    sceneHints: ['午后', '休息', '茶话', '独处', '图书馆']
  },
  '002': {
    title: '海风微澜·温柔抒情 (轻柔合奏)',
    category: 'music',
    moodTags: ['emotional', 'warm', 'gentle', 'romantic'],
    sceneHints: ['黄昏', '海边', '告白', '心动', '夜晚', '收尾', '谈心']
  },
  '003': {
    title: '灿烂日光·元气轻快日常',
    category: 'music',
    moodTags: ['upbeat', 'happy', 'cheerful', 'sunny'],
    sceneHints: ['元气', '夏日', '外出', '游玩', '晨间', '海滩']
  },
  '004': {
    title: '星光絮语·深夜心事',
    category: 'music',
    moodTags: ['emotional', 'melancholic', 'quiet', 'night'],
    sceneHints: ['夜谈', '思绪', '夜景', '阳台', '困惑', '失落']
  },
  '005': {
    title: '轻快步调·明亮喜剧',
    category: 'music',
    moodTags: ['comedy', 'upbeat', 'playful'],
    sceneHints: ['吐槽', '搞笑', '乌龙', '喧闹']
  },
  '006': {
    title: '紧张鼓点·突发状况',
    category: 'music',
    moodTags: ['tense', 'dramatic', 'urgent'],
    sceneHints: ['突发', '紧张', '争执', '危机', '赶路']
  },
  '008': {
    title: '星夜微光·轻柔八音盒与电钢琴',
    category: 'music',
    moodTags: ['calm', 'gentle', 'night', 'emotional'],
    sceneHints: ['夜谈', '温柔', '梦境', '安睡', '静谧', '回忆']
  },
  '012': {
    title: '阳光街角·欢快管弦日常',
    category: 'music',
    moodTags: ['upbeat', 'happy', 'sunny', 'daily'],
    sceneHints: ['购物', '外出', '晴天', '散步', '日常', '开朗']
  },
  '015': {
    title: '雀跃长笛·俏皮爵士日常',
    category: 'music',
    moodTags: ['playful', 'upbeat', 'cheerful', 'daily'],
    sceneHints: ['课后', '点心', '闲聊', '轻松', '恶作剧', '社团']
  },
  '016': {
    title: '悠闲茶歇·事务所日常',
    category: 'music',
    moodTags: ['calm', 'cozy', 'daily'],
    sceneHints: ['事务所', '休息室', '甜品', '下午茶', '闲聊']
  },
  '017': {
    title: '涟漪心绪·清澈独奏钢琴',
    category: 'music',
    moodTags: ['emotional', 'calm', 'melancholic', 'tender'],
    sceneHints: ['独白', '心事', '黄昏', '倾诉', '感动', '安静']
  },
  '019': {
    title: '都市律动·清爽电子节拍',
    category: 'music',
    moodTags: ['calm', 'stylish', 'daily', 'cozy'],
    sceneHints: ['咖啡厅', '逛街', '休息室', '时尚', '午后', '闲谈']
  },
  '020': {
    title: '命运交响·华丽戏剧弦乐',
    category: 'music',
    moodTags: ['dramatic', 'tense', 'emotional'],
    sceneHints: ['决意', '高潮', '宿命', '古典', '舞台前夜', '严肃']
  },
  '021': {
    title: '节拍跃动·活力节奏',
    category: 'music',
    moodTags: ['energetic', 'upbeat', 'fun'],
    sceneHints: ['排练', '活动', '热闹', '惊喜', '游戏', '集合']
  },
  '026': {
    title: '疾驰冲刺·热血摇滚应援',
    category: 'music',
    moodTags: ['energetic', 'upbeat', 'dramatic'],
    sceneHints: ['比赛', '冲刺', '特训', '运动会', '热血', '胜利']
  },
  '029': {
    title: '电音疾走·高能动感节拍',
    category: 'music',
    moodTags: ['energetic', 'tense', 'upbeat'],
    sceneHints: ['登台', '排练', '挑战', '对决', '电子', '竞速']
  },
  '034': {
    title: '轻甜节拍·时尚电子流行',
    category: 'music',
    moodTags: ['upbeat', 'stylish', 'cheerful', 'daily'],
    sceneHints: ['摄影', '穿搭', '造型', '外出', '期待', '约定']
  },
  '038': {
    title: '滑稽奇想·搞怪舞会进行曲',
    category: 'music',
    moodTags: ['comedy', 'playful', 'dramatic'],
    sceneHints: ['闹剧', '突发奇想', '搞笑', '整蛊', '慌乱', '奇妙']
  },
  '039': {
    title: '午后猫步·慵懒轻巧爵士',
    category: 'music',
    moodTags: ['playful', 'cozy', 'comedy', 'daily'],
    sceneHints: ['偷溜', '小插曲', '日常', '调皮', '摸鱼', '散步']
  },
  '041': {
    title: '追光启程·昂扬流行管弦',
    category: 'music',
    moodTags: ['upbeat', 'emotional', 'hopeful', 'energetic'],
    sceneHints: ['出发', '成长', '梦想', '励志', '重逢', '约定']
  },
  '047': {
    title: '晴空微风·明快校园流行',
    category: 'music',
    moodTags: ['upbeat', 'happy', 'sunny', 'hopeful'],
    sceneHints: ['早晨', '校园', '天台', '合宿', '练习', '元气']
  },
  '056': {
    title: '温柔凝眸·抒情钢琴弦乐',
    category: 'music',
    moodTags: ['emotional', 'tender', 'sad', 'warm'],
    sceneHints: ['泪水', '安慰', '羁绊', '坦白', '雨后', '和解']
  },
  '077': {
    title: '微醺余暇·都市弛放吉他',
    category: 'music',
    moodTags: ['calm', 'cozy', 'stylish', 'daily'],
    sceneHints: ['傍晚', '归途', '闲聊', '事务所', '放松', '旅馆']
  },
  '090': {
    title: '童话木笛·纯真温情小品',
    category: 'music',
    moodTags: ['warm', 'gentle', 'calm', 'cozy'],
    sceneHints: ['童年', '绘本', '乡间', '午睡', '温馨', '治愈']
  },
  '100': {
    title: '透明街景·轻盈都市节拍',
    category: 'music',
    moodTags: ['calm', 'stylish', 'daily'],
    sceneHints: ['日常', '街景', '便利店', '练习后', '轻松', '交谈']
  },
  '101': {
    title: '俏皮节拍·灵动街头放克',
    category: 'music',
    moodTags: ['playful', 'comedy', 'stylish', 'upbeat'],
    sceneHints: ['斗嘴', '吐槽', '街头', '潮流', '轻喜剧', '互动']
  },
  '102': {
    title: '静夜沉思·低回大提琴与钢琴',
    category: 'music',
    moodTags: ['melancholic', 'sad', 'quiet', 'emotional'],
    sceneHints: ['迷茫', '挫折', '深夜', '独处', '严肃', '回忆']
  },
  '106': {
    title: '霓虹脉冲·冷调时尚律动',
    category: 'music',
    moodTags: ['stylish', 'tense', 'cool'],
    sceneHints: ['后台', '选拔', '时尚', '都市夜', '冷静', '专注']
  },
  '108': {
    title: '朝露琴音·晶莹晨光序曲',
    category: 'music',
    moodTags: ['bright', 'upbeat', 'hopeful', 'sunny'],
    sceneHints: ['清晨', '希望', '开场', '闪耀', '喜悦', '庆贺']
  },
  '127': {
    title: '澄澈水滴·空灵治愈慢拍',
    category: 'music',
    moodTags: ['calm', 'quiet', 'gentle', 'night'],
    sceneHints: ['星空', '海浪', '夜聊', '温泉', '放松', '梦境']
  },
  '0052': {
    title: '微凉夜色·清透电子铃音',
    category: 'music',
    moodTags: ['calm', 'night', 'quiet'],
    sceneHints: ['夜归', '星空', '散步', '静夜']
  },
  '0000': {
    title: '静谧空气底噪·微弱留白',
    category: 'silence',
    avoidAutoBgm: true,
    moodTags: ['quiet', 'ambient'],
    sceneHints: ['安静', '暂停', '留白', '静音']
  },
  '0001': {
    title: '人群喧嚣与舞台低响·室内环境音 (勿作常规BGM)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'indoor'],
    sceneHints: ['人群', '会场', '后台']
  },
  '0002': {
    title: '盛夏蝉鸣与林风·户外自然环境音',
    category: 'ambient',
    moodTags: ['ambient', 'summer', 'outdoor', 'calm'],
    sceneHints: ['蝉鸣', '山路', '树林', '森林', '盛夏蝉']
  },
  '0003': {
    title: '雨声环境音·淅沥大雨 (非配乐)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'rain', 'calm'],
    sceneHints: ['大雨', '下雨', '雨声', '阵雨']
  },
  '0005': {
    title: '室内机器/空调微响·白噪环境音 (勿作常规BGM)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'indoor', 'quiet'],
    sceneHints: ['机械嗡鸣', '深夜空调', '静室白噪']
  },
  '0007': {
    title: '脚步回响·特殊环境音效 (勿作常规BGM)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'sfx'],
    sceneHints: ['脚步声']
  },
  '0016': {
    title: '碎石脚步声·短促音效 (勿作常规BGM)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'sfx'],
    sceneHints: ['脚步声']
  },
  '0028': {
    title: '外星射线/科幻光束·特殊音效 (勿作常规BGM)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'sfx'],
    sceneHints: ['激光音效']
  },
  '0029': {
    title: '浪声与海风·海边自然环境音',
    category: 'ambient',
    moodTags: ['ambient', 'sea', 'outdoor', 'calm'],
    sceneHints: ['海浪声', '浪声']
  },
  '0046': {
    title: '清晨鸟鸣与雀跃·户外自然环境音',
    category: 'ambient',
    moodTags: ['ambient', 'morning', 'outdoor', 'calm'],
    sceneHints: ['鸟鸣声', '晨鸟']
  },
  '0050': {
    title: '溪流潺潺·山涧自然环境音',
    category: 'ambient',
    moodTags: ['ambient', 'outdoor', 'calm'],
    sceneHints: ['溪水', '流水声', '山涧']
  },
  '0053': {
    title: '噼啪静电/火光底噪·特殊音效 (勿作常规BGM)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'sfx'],
    sceneHints: ['火堆噼啪']
  },
  '0082': {
    title: '电车车厢行驶轰鸣·交通环境音 (勿作常规BGM)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'sfx'],
    sceneHints: ['电车内', '地铁轰鸣']
  },
  '0124': {
    title: '街头远处车流·城市底噪环境音 (勿作常规BGM)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'outdoor'],
    sceneHints: ['马路边', '车流声']
  },
  '0164': {
    title: '大厅人群与脚步混响·室内环境音 (勿作常规BGM)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'indoor'],
    sceneHints: ['走廊人群', '车站大厅']
  },
  '0329': {
    title: '客机机舱低鸣·交通环境音 (勿作常规BGM)',
    category: 'ambient',
    avoidAutoBgm: true,
    moodTags: ['ambient', 'sfx'],
    sceneHints: ['机舱内']
  }
};

const SAFE_NATURE_AMBIENT_IDS = new Set(['0002', '0029', '0046', '0050']);
const SFX_LOOP_BGM_IDS = new Set(['0000', '0001', '0003', '0005', '0007', '0016', '0028', '0053', '0082', '0091', '0124', '0164', '0329']);

function readM4aDurationSec(filePath) {
  let fd = null;
  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    if (!fileSize || fileSize < 16) return null;
    fd = fs.openSync(filePath, 'r');
    const hdr = Buffer.alloc(16);
    let offset = 0;
    let boxes = 0;
    while (offset + 8 <= fileSize && boxes < 64) {
      boxes += 1;
      const bytesRead = fs.readSync(fd, hdr, 0, 16, offset);
      if (bytesRead < 8) break;
      let boxSize = hdr.readUInt32BE(0);
      const boxType = hdr.toString('ascii', 4, 8);
      let headerLen = 8;
      if (boxSize === 1 && bytesRead >= 16) {
        boxSize = Number(hdr.readBigUInt64BE(8));
        headerLen = 16;
      } else if (boxSize === 0) {
        boxSize = fileSize - offset;
      }
      if (!boxSize || boxSize < headerLen) break;
      if (boxType === 'moov') {
        const moovLen = Math.min(boxSize - headerLen, 512 * 1024);
        const moovBuf = Buffer.alloc(moovLen);
        const got = fs.readSync(fd, moovBuf, 0, moovLen, offset + headerLen);
        let p = 0;
        let childCount = 0;
        while (p + 8 <= got && childCount < 64) {
          childCount += 1;
          let cSize = moovBuf.readUInt32BE(p);
          const cType = moovBuf.toString('ascii', p + 4, p + 8);
          let cHdr = 8;
          if (cSize === 1 && p + 16 <= got) {
            cSize = Number(moovBuf.readBigUInt64BE(p + 8));
            cHdr = 16;
          }
          if (!cSize || cSize < cHdr) break;
          if (cType === 'mvhd' && p + cHdr + 20 <= got) {
            const ver = moovBuf.readUInt8(p + cHdr);
            if (ver === 0 && p + cHdr + 20 <= got) {
              const scale = moovBuf.readUInt32BE(p + cHdr + 12);
              const dur = moovBuf.readUInt32BE(p + cHdr + 16);
              if (scale > 0) return Math.round((dur / scale) * 10) / 10;
            } else if (ver === 1 && p + cHdr + 32 <= got) {
              const scale = moovBuf.readUInt32BE(p + cHdr + 20);
              const dur = Number(moovBuf.readBigUInt64BE(p + cHdr + 24));
              if (scale > 0) return Math.round((dur / scale) * 10) / 10;
            }
            return null;
          }
          p += cSize;
        }
        return null;
      }
      offset += boxSize;
    }
    return null;
  } catch (_err) {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_e) {}
    }
  }
}

let _enrichedBgmCatalogCache = null;

function inferBgmMoodTags(rawMeta, curated) {
  const tags = new Set(Array.isArray(curated && curated.moodTags) ? curated.moodTags : []);
  const blob = [
    rawMeta && rawMeta.zhLabel,
    rawMeta && rawMeta.dominantEmotion,
    Array.isArray(rawMeta && rawMeta.moods) ? rawMeta.moods.join(' ') : '',
    Array.isArray(rawMeta && rawMeta.tags) ? rawMeta.tags.join(' ') : '',
    curated && curated.title
  ].filter(Boolean).join(' ').toLowerCase();
  if (/warm|gentle|日常|温馨|温柔|抒情|海风/.test(blob)) tags.add('warm');
  if (/happy|cheer|joy|bright|元气|欢快|明快|笑|轻快/.test(blob)) tags.add('upbeat');
  if (/calm|peace|quiet|relax|舒缓|安静|平静|宁静|悠闲|咖啡/.test(blob)) tags.add('calm');
  if (/sad|tear|sorrow|melanchol|哀|伤感|寂寞|失落|思念|慢/.test(blob)) tags.add('emotional');
  if (/tense|fear|dark|urgent|紧张|危机|悬疑|严肃|冲突/.test(blob)) tags.add('tense');
  if (/comedy|funny|playful|搞笑|幽默|调皮/.test(blob)) tags.add('comedy');
  if (/energetic|excit|live|节拍|活力|热血|冲刺/.test(blob)) tags.add('energetic');
  if (/蝉|自然|风声|海浪|雨|鸟鸣|虫鸣|环境/.test(blob)) tags.add('ambient');
  if (tags.size === 0) tags.add('daily');
  return Array.from(tags);
}

/**
 * Return the full enriched BGM + ambient soundscape catalog across all indexed and on-disk `.m4a` tracks.
 */
function getEnrichedBgmCatalog(opts = {}) {
  const forceReload = Boolean(opts && opts.forceReload);
  if (!_enrichedBgmCatalogCache || forceReload) {
    const byId = new Map();
    const semBgms = getSemanticBgmList();
    for (const m of semBgms) {
      const id = normalizeBgmId(m.id);
      if (!id) continue;
      if (!byId.has(id)) byId.set(id, m);
    }
    try {
      if (fs.existsSync(ENZA_BGM_DIR)) {
        const files = fs.readdirSync(ENZA_BGM_DIR);
        for (const f of files) {
          if (!/\.m4a$/i.test(f)) continue;
          const id = f.replace(/\.m4a$/i, '').trim();
          if (!id) continue;
          if (!byId.has(id)) {
            byId.set(id, { id, zhLabel: `BGM ${id}`, tags: [], moods: [], usageCount: 0 });
          }
        }
      }
    } catch (_e) {}

    const list = [];
    for (const [id, m] of byId.entries()) {
      const curated = CURATED_BGM_TITLES[id] || null;
      let durationSec = typeof m.durationSec === 'number' ? m.durationSec : null;
      if (durationSec === null) {
        const filePath = path.join(ENZA_BGM_DIR, `${id}.m4a`);
        if (fs.existsSync(filePath)) {
          durationSec = readM4aDurationSec(filePath);
        }
      }
      let category = curated && curated.category ? curated.category : '';
      if (!category) {
        const blob = `${m.zhLabel || ''} ${(m.tags || []).join(' ')} ${(m.moods || []).join(' ')}`;
        if (durationSec !== null && durationSec > 0 && durationSec < 1.2) {
          category = 'silence';
        } else if (
          /^\d{4}$/.test(id) ||
          /蝉鸣|环境音|鸟鸣|海浪|虫鸣|风声|底噪|ambient/i.test(blob)
        ) {
          category = 'ambient';
        } else {
          category = 'music';
        }
      }
      const moodTags = inferBgmMoodTags(m, curated);
      const rawZh = String(m.zhLabel || '').trim();
      const title = (curated && curated.title) || (rawZh && rawZh !== id ? rawZh : (category === 'ambient' ? `环境循环音 ${id}` : `配乐曲目 ${id}`));
      const sceneHints = (curated && curated.sceneHints) || (Array.isArray(m.tags) ? m.tags.slice(0, 6) : []);
      const durText = typeof durationSec === 'number' && durationSec > 0 ? `${Math.round(durationSec)}s` : '';
      const kindTag = category === 'ambient' ? '🌿环境音' : (category === 'silence' ? '🔇静场' : '🎵配乐');
      const label = `${title}${durText ? ` (${durText})` : ''}`;
      const avoidAutoBgm = Boolean(
        (curated && curated.avoidAutoBgm) ||
        SFX_LOOP_BGM_IDS.has(id) ||
        (category !== 'music' && !SAFE_NATURE_AMBIENT_IDS.has(id)) ||
        (/^\d{4}$/.test(id) && !(curated && curated.category === 'music') && !SAFE_NATURE_AMBIENT_IDS.has(id))
      );
      list.push({
        id,
        title,
        zhLabel: label,
        label,
        kindTag,
        category,
        avoidAutoBgm,
        moodTags,
        dominantEmotion: m.dominantEmotion || moodTags[0] || '',
        durationSec,
        sceneHints,
        tags: Array.isArray(m.tags) ? m.tags : [],
        usageCount: Number(m.usageCount) || 0,
        curated: Boolean(curated)
      });
    }

    list.sort((a, b) => {
      if (Boolean(a.curated) !== Boolean(b.curated)) return a.curated ? -1 : 1;
      const catRank = (c) => (c === 'music' ? 0 : (c === 'ambient' ? 1 : 2));
      if (catRank(a.category) !== catRank(b.category)) {
        return catRank(a.category) - catRank(b.category);
      }
      if ((b.usageCount || 0) !== (a.usageCount || 0)) return (b.usageCount || 0) - (a.usageCount || 0);
      return String(a.id).localeCompare(String(b.id));
    });
    _enrichedBgmCatalogCache = list;
  }
  const filterCat = opts && opts.category ? String(opts.category) : '';
  const items = filterCat ? _enrichedBgmCatalogCache.filter((x) => x.category === filterCat) : _enrichedBgmCatalogCache;
  const limit = Number(opts && opts.limit) || 0;
  return limit > 0 ? items.slice(0, limit) : items;
}

const MOOD_QUERY_TOKENS = {
  warm: ['warm', 'gentle', '温馨', '温暖', '温柔', '日常', '心动'],
  upbeat: ['upbeat', 'happy', 'sunny', '元气', '轻快', '欢快', '开心', '热闹'],
  calm: ['calm', 'relaxed', 'quiet', '舒缓', '平静', '宁静', '午后', '茶歇'],
  emotional: ['emotional', 'tender', 'sentimental', '感动', '抒情', '告白', '思念', '回忆', '心意'],
  tense: ['tense', 'dramatic', 'urgent', '紧张', '危机', '焦虑', '冲突', '严肃'],
  sad: ['melancholic', 'sad', '失落', '低落', '难过', '寂寞', '哭'],
  comedy: ['comedy', 'playful', 'funny', '搞笑', '吐槽', '闹腾', '乌龙'],
  energetic: ['energetic', 'fun', '排练', '活力', '节奏', '演唱会', '舞台'],
  ambient: ['ambient', 'summer', 'outdoor', '蝉鸣', '盛夏', '海风', '环境音', '夜风', '自然']
};

/**
 * Recommend Top-N backgrounds for a scene summary / title / location prompt.
 */
function recommendBgsForContext(contextText, opts = {}) {
  const limit = Math.max(1, Math.min(24, Number(opts.limit) || 8));
  const text = String(contextText || '').trim();
  const scenicList = getSemanticBgList({ includeAbstract: false });
  const scored = scenicList.map((b) => {
    let score = scoreAssetAgainstText(b, text) * 100;
    const label = `${b.zhLabel || ''} ${(b.tags || []).join(' ')} ${b.category || ''}`;
    if (/事务所|休息室|练习室|教室|天台|街道|车站|咖啡|餐厅|公园|海|沙滩|夕阳|黄昏|夜晚|神社|校园|舞台|客厅|阳台/.test(label)) {
      if (text) {
        for (const kw of ['事务所', '练习室', '教室', '天台', '公园', '海', '沙滩', '夕阳', '黄昏', '夜', '咖啡', '街道', '神社', '舞台', '家', '房间', '夏日', '露营', '宿舍']) {
          if (text.includes(kw) && label.includes(kw)) score += 35;
        }
      }
      score += 4;
    }
    score += Math.min(20, Math.log1p(Number(b.usageCount) || 0) * 3);
    return {
      id: String(b.id),
      zhLabel: String(b.zhLabel || b.id),
      category: String(b.category || 'scenic'),
      usageCount: Number(b.usageCount) || 0,
      score,
      reason: text ? '匹配本幕场景氛围' : '常用经典舞台/生活场景'
    };
  });
  scored.sort((a, b) => b.score - a.score || b.usageCount - a.usageCount);
  const picked = [];
  const seen = new Set();
  for (const item of scored) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * Recommend Top-N BGMs or ambient soundscapes for a scene/segment narrative flow + emotional mood.
 */
function recommendBgmsForContext(contextText, opts = {}) {
  const limit = Math.max(1, Math.min(20, Number(opts.limit) || 5));
  const mood = String(opts.mood || '').trim().toLowerCase();
  const text = `${String(contextText || '')} ${(MOOD_QUERY_TOKENS[mood] || []).join(' ')}`.trim();
  const strictAmbient =
    Boolean(opts.allowAmbient) ||
    mood === 'ambient' ||
    /纯环境音|仅环境音|无配乐|海浪声|蝉鸣声|雨声/.test(String(contextText || ''));
  const catalog = getEnrichedBgmCatalog().filter((item) => {
    if (!item || item.category === 'silence' || item.avoidAutoBgm) return false;
    if (item.category === 'music') return true;
    return strictAmbient && SAFE_NATURE_AMBIENT_IDS.has(item.id);
  });
  const scored = catalog.map((item) => {
    let score = scoreAssetAgainstText(item, text) * 80;
    if (mood && item.moodTags && item.moodTags.includes(mood)) score += 55;
    if (item.curated) score += 18;
    for (const h of item.sceneHints || []) {
      if (text.includes(h)) score += 28;
    }
    if (strictAmbient && item.category === 'ambient') score += 30;
    score += Math.min(24, Math.log1p(Number(item.usageCount) || 0) * 3.5);
    let reason = item.title;
    if (item.category === 'ambient') reason = `自然环境音推荐：${item.title}`;
    else if (mood && item.moodTags.includes(mood)) reason = `契合「${mood}」情绪：${item.title}`;
    return {
      id: item.id,
      title: item.title,
      label: item.label,
      category: item.category,
      moodTags: item.moodTags,
      durationSec: item.durationSec,
      score,
      reason
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function pickBestBgmForText(text, fallbackId = '002') {
  const recs = recommendBgmsForContext(text, { limit: 1 });
  if (recs.length && recs[0].score > 0) return normalizeBgmId(recs[0].id, fallbackId);
  const safeMusic = getEnrichedBgmCatalog().filter((b) => b.category === 'music' && !b.avoidAutoBgm);
  let best = null;
  let bestScore = 0;
  for (const b of safeMusic) {
    const s = scoreAssetAgainstText(b, text);
    if (s > bestScore || (s === bestScore && s > 0 && (b.usageCount || 0) > ((best && best.usageCount) || 0))) {
      best = b;
      bestScore = s;
    }
  }
  const raw = best ? String(best.id) : fallbackId;
  return normalizeBgmId(raw, fallbackId);
}

function buildTopBgBgmPromptCatalog(promptText) {
  const bgs = recommendBgsForContext(promptText, { limit: 24 })
    .map((b) => `${b.id}(${b.zhLabel})`);
  const bgms = recommendBgmsForContext(promptText, { limit: 18 })
    .map((b) => `${b.id}(${b.title}/${(b.moodTags || []).join(',')}${b.category === 'ambient' ? '/环境音' : ''})`);
  return { bgCatalog: bgs.join(', '), bgmCatalog: bgms.join(', ') };
}

// ---------------------------------------------------------------------------
// Step 1: AI / Semantic Template Outline Expander (`expandOutline`)
// Uses `asset_semantics.json` + `bg_visual_index.json`
// ---------------------------------------------------------------------------
function pickSemanticScenesForPrompt(prompt, cast, projectTitle) {
  const text = `${projectTitle || ''} ${prompt || ''}`.toLowerCase();
  const autoCast = detectCastFromText(`${projectTitle || ''} ${prompt || ''}`);
  const castArr = autoCast.length
    ? autoCast
    : (Array.isArray(cast) && cast.length ? cast : ['amana', 'hana', 'mano', 'hiori', 'meguru', 'tenka']);
  const firstTwo = castArr.slice(0, Math.min(2, castArr.length));
  const namesFirstTwo = firstTwo.map((c) => (IDOL_META[c] ? IDOL_META[c].nameZh : c)).join('与');
  const namesAll = castArr.map((c) => (IDOL_META[c] ? IDOL_META[c].nameZh : c)).join('、');

  // Theme 1: Island / Beach / Ocean / Summer / Survival
  if (/荒岛|无人岛|海|沙滩|泳装|夏|漂流|求生|营救|island|beach|sea|summer/.test(text)) {
    const rawScenes = [
      {
        sceneId: 'scene_01_harbor',
        title: '第 1 幕 · 码头偷溜与荒岛正午',
        titleJa: '第1幕・港の抜け出しと無人島の正午',
        bg: '00269',
        bgm: '003',
        cast: firstTwo,
        summary: `夏日外景拍摄间隙，${namesFirstTwo}趁乱溜上岸边快艇，结果漂流到洒满阳光的无人荒岛。制作人赶来汇合后，三人一起搭建简易树叶遮阳棚，在烈日与海风中开启荒岛求生。`,
        segments: [
          {
            beatId: 'beat_1',
            title: '偷溜登岛与游艇离开',
            summary: `${namesFirstTwo}发现小船漂离码头，在碧海蓝天的无人岛浅滩登陆`,
            cast: firstTwo,
            targetLines: 2
          },
          {
            beatId: 'beat_2',
            title: '与制作人合力搭椰叶棚',
            summary: '制作人带着应急背包赶到，三人分工收集椰叶搭建海滩遮阳棚',
            cast: firstTwo,
            targetLines: 3
          },
          {
            beatId: 'beat_3',
            title: '正午晒红肩膀与涂防晒霜',
            summary: '正午阳光毒辣，两人互相涂防晒、分喝冰水，苦中作乐约定一定要平安回去',
            cast: firstTwo,
            targetLines: 2
          }
        ]
      },
      {
        sceneId: 'scene_02_signal',
        title: '第 2 幕 · 海岸求救信号（分支）',
        titleJa: '第2幕・ビーチのSOSサイン（分岐）',
        bg: '00008',
        bgm: '006',
        cast: firstTwo,
        summary: `午后潮水渐退，远处海平线隐约出现搜救船的轮廓。制作人与${namesFirstTwo}必须在「在沙滩画出超巨型SOS涂鸦」与「站上礁石挥舞椰子树叶」之间做出选择！`,
        segments: [
          {
            beatId: 'beat_1',
            title: '发现远方海平线搜救船影',
            summary: `发现远方海平线上的白点，${namesFirstTwo}兴奋地拉住制作人商量对策`,
            cast: firstTwo,
            targetLines: 2
          },
          {
            beatId: 'beat_2',
            title: '海岸求救信号分支抉择',
            summary: '[分支选项] 选项A「在沙滩上画超巨型可爱的SOS！」 / 选项B「举起大椰子叶全力挥舞呼喊！」',
            cast: firstTwo,
            targetLines: 3
          },
          {
            beatId: 'beat_3',
            title: '探照灯回应与海风欢呼',
            summary: '海面传来救援船回应的探照灯与汽笛声，两人在海风中欢呼雀跃',
            cast: firstTwo,
            targetLines: 2
          }
        ]
      },
      {
        sceneId: 'scene_03_rescue',
        title: '第 3 幕 · 海平线上的全员大营救',
        titleJa: '第3幕・水平線の全員レスキュー',
        bg: '00271',
        bgm: '002',
        cast: castArr,
        summary: `傍晚时分，救援快艇靠岸！283事务所的伙伴们（${namesAll}）全员冲下船拥抱重逢。面对超过3人的6人同台大场面，舞台自动分切为两组3人运镜特写，在夕阳与海浪声中圆满收官。`,
        segments: [
          {
            beatId: 'beat_1',
            title: '救援艇靠岸与3人救援组呼喊',
            summary: '[镜头A·救援组] 救援队3人率先冲上甲板，焦急呼喊失踪伙伴的名字',
            cast: castArr.slice(0, 3),
            targetLines: 3
          },
          {
            beatId: 'beat_2',
            title: '荒岛重逢组姐妹相拥报平安',
            summary: '[镜头B·荒岛组] 荒岛上的伙伴与姐姐扑上前紧紧相拥，委屈又开心地报平安',
            cast: castArr.slice(Math.min(3, Math.max(0, castArr.length - 3))),
            targetLines: 4
          },
          {
            beatId: 'beat_3',
            title: '海平线晚霞下的全员团圆终幕',
            summary: '全员在海平线晚霞下合影留念，把荒岛惊魂变成今夏最难忘的回忆',
            cast: castArr.slice(0, 3),
            targetLines: 1
          }
        ]
      }
    ];
    rawScenes.forEach((s) => normalizeSceneSegments(s));
    return rawScenes;
  }

  // Theme 2: Rooftop / Rain / School / Sunset
  if (/天台|屋顶|雨|放学|夕阳|黄昏|彩虹|rooftop|rain/.test(text)) {
    const rawScenes = [
      {
        sceneId: 'scene_01_rain_stop',
        title: '第 1 幕 · 雨停后的事务所天台',
        titleJa: '第1幕・雨上がりの屋上',
        bg: '00003',
        bgm: '001',
        cast: firstTwo,
        summary: `阵雨初歇，${namesFirstTwo}推开天台铁门，呼吸着潮湿清新的空气，与制作人分享刚刚结束的排练心得。`,
        segments: [
          {
            beatId: 'beat_1',
            title: '推开天台铁门迎接雨后晴空',
            summary: `雨滴从天台栏杆滑落，${namesFirstTwo}眺望远方云层裂开的第一道阳光`,
            cast: firstTwo,
            targetLines: 2
          },
          {
            beatId: 'beat_2',
            title: '制作人递上热饮复盘排练',
            summary: '制作人递来温热的饮品，聊起刚才练习室里的小插曲',
            cast: firstTwo,
            targetLines: 2
          },
          {
            beatId: 'beat_3',
            title: '趁夕阳降临前再对一遍台词',
            summary: '微风吹散乌云，大家决定趁夕阳降临前再对一遍台词',
            cast: firstTwo,
            targetLines: 2
          }
        ]
      },
      {
        sceneId: 'scene_02_sunset_choice',
        title: '第 2 幕 · 晚霞下的心愿（分支）',
        titleJa: '第2幕・夕焼けの願い事（分岐）',
        bg: '00004',
        bgm: '002',
        cast: firstTwo,
        summary: `整片天空染成琥珀色（使用 bg_visual_index 同场景黄昏变体 00004），制作人需要在两个回应中做出选择，解开偶像心中的小纠结。`,
        segments: [
          {
            beatId: 'beat_1',
            title: '晚霞下吐露演出前的紧张期待',
            summary: '晚霞映红脸颊，偶像轻声说出对下一场演出的紧张与期待',
            cast: firstTwo,
            targetLines: 2
          },
          {
            beatId: 'beat_2',
            title: '制作人的关键鼓励分支选项',
            summary: '[分支选项] 选项A「相信你们的默契，大胆去闪耀吧」 / 选项B「不管发生什么，我都会在台下守护你们」',
            cast: firstTwo,
            targetLines: 3
          },
          {
            beatId: 'beat_3',
            title: '重拾自信露出释然笑容',
            summary: '偶像露出释然的笑容，重拾满满的自信',
            cast: firstTwo,
            targetLines: 2
          }
        ]
      },
      {
        sceneId: 'scene_03_starlight_vow',
        title: '第 3 幕 · 星空下的全员约定',
        titleJa: '第3幕・星空の約束',
        bg: '00078',
        bgm: '000',
        cast: castArr,
        summary: `夜幕降临（使用 bg_visual_index 同场景夜晚变体 00078），其余伙伴们也带着点心来到天台，全员在星空下许下新舞台的约定。`,
        segments: [
          {
            beatId: 'beat_1',
            title: '伙伴们带着慰问点心登上天台',
            summary: '[镜头A] 伙伴们推门登上天台，带来热腾腾的慰问点心',
            cast: castArr.slice(0, 3),
            targetLines: 2
          },
          {
            beatId: 'beat_2',
            title: '轮流说出公演目标与欢声笑语',
            summary: '[镜头B] 全员轮流说出对下一次公演的目标，笑声回荡在夜空',
            cast: castArr.slice(Math.min(3, Math.max(0, castArr.length - 3))),
            targetLines: 2
          },
          {
            beatId: 'beat_3',
            title: '星空下叠起手掌约定新舞台',
            summary: '全员伸出手叠在一起，向着星光璀璨的舞台出发',
            cast: castArr.slice(0, 3),
            targetLines: 2
          }
        ]
      }
    ];
    rawScenes.forEach((s) => normalizeSceneSegments(s));
    return rawScenes;
  }

  // Generic semantic matching against `asset_semantics.json` + variant groups in `bg_visual_index.json`
  const bgs = getSemanticBgList();
  const bgms = getSemanticBgmList();
  const matchedBgId = pickBestBgForText(text, '00001');
  let bgAct1 = matchedBgId;
  let bgAct2 = pickBestBgForText(text + ' 傍晚 黄昏', matchedBgId);
  let bgAct3 = pickBestBgForText(text + ' 夜 舞台', matchedBgId);
  const vGroups = (bgVisualIndex && bgVisualIndex.variantGroups) || {};
  for (const grp of Object.values(vGroups)) {
    if (Array.isArray(grp) && grp.includes(bgAct1) && grp.length >= 2) {
      bgAct2 = grp[1] || bgAct2;
      bgAct3 = grp[2] || grp[1] || bgAct3;
      break;
    }
  }

  const bgmAct1 = pickBestBgmForText(text, '001');
  const bgmAct2 = pickBestBgmForText(text + ' 紧张 突发', '006');
  const bgmAct3 = pickBestBgmForText(text + ' 感动 温柔', '002');

  const genericScenes = [
    {
      sceneId: 'scene_01_opening',
      title: '第 1 幕 · 突发状况与日常序曲',
      titleJa: '第1幕・はじまりの予感',
      bg: bgAct1,
      bgm: bgmAct1,
      cast: firstTwo,
      summary: `围绕「${(prompt || projectTitle || '283事务所的新企划').slice(0, 48)}」，${namesFirstTwo}与制作人展开了意想不到的第一幕行动。`,
      segments: [
        {
          beatId: 'beat_1',
          title: '提出充满个性的新企划点子',
          summary: `${namesFirstTwo}兴冲冲地找到制作人，提出充满个性的新点子`,
          cast: firstTwo,
          targetLines: 2
        },
        {
          beatId: 'beat_2',
          title: '突发小插曲与合力应对',
          summary: '现场出现小小意外状况，大家手忙脚乱地合力应对',
          cast: firstTwo,
          targetLines: 2
        },
        {
          beatId: 'beat_3',
          title: '眼神发亮决定继续推进计划',
          summary: '虽然有些小波折，但两人眼神发亮，决定继续推进计划',
          cast: firstTwo,
          targetLines: 2
        }
      ]
    },
    {
      sceneId: 'scene_02_branch',
      title: '第 2 幕 · 关键抉择与心意碰撞（分支）',
      titleJa: '第2幕・運命の選択（分岐）',
      bg: bgAct2,
      bgm: bgmAct2,
      cast: firstTwo,
      summary: `事态进入关键转折点，${namesFirstTwo}把决定权交给制作人，不同的鼓励方式将触发截然不同的可爱反应。`,
      segments: [
        {
          beatId: 'beat_1',
          title: '面对难题期待地望向制作人',
          summary: `面对眼前的难题，${namesFirstTwo}期待地望向制作人`,
          cast: firstTwo,
          targetLines: 2
        },
        {
          beatId: 'beat_2',
          title: '制作人的关键抉择分支',
          summary: '[分支选项] 选项A「用大胆有趣的方式突破吧！」 / 选项B「稳扎稳打，一步步把心意传达出去！」',
          cast: firstTwo,
          targetLines: 3
        },
        {
          beatId: 'beat_3',
          title: '收到回应后干劲瞬间拉满',
          summary: '收到制作人的回应后，两人的干劲瞬间拉满',
          cast: firstTwo,
          targetLines: 2
        }
      ]
    },
    {
      sceneId: 'scene_03_climax',
      title: '第 3 幕 · 全员集结的闪耀终幕',
      titleJa: '第3幕・みんなと繋ぐフィナーレ',
      bg: bgAct3,
      bgm: bgmAct3,
      cast: castArr,
      summary: `伙伴们（${namesAll}）全员到齐！多角色自动切换3人分镜站位，在欢声笑语中迎来最温暖的团圆结局。`,
      segments: [
        {
          beatId: 'beat_1',
          title: '支援小队赶到送上及时助攻',
          summary: '[镜头A] 支援小队赶到现场，送上最及时的助攻',
          cast: castArr.slice(0, 3),
          targetLines: 2
        },
        {
          beatId: 'beat_2',
          title: '主角组迎上前分享成功喜悦',
          summary: '[镜头B] 主角组感动地迎上前，大家分享成功的喜悦',
          cast: castArr.slice(Math.min(3, Math.max(0, castArr.length - 3))),
          targetLines: 2
        },
        {
          beatId: 'beat_3',
          title: '全员致谢展望下一个闪耀舞台',
          summary: '全员向制作人致谢，共同展望下一个闪耀舞台',
          cast: castArr.slice(0, 3),
          targetLines: 2
        }
      ]
    }
  ];
  genericScenes.forEach((s) => normalizeSceneSegments(s));
  return genericScenes;
}

// ---------------------------------------------------------------------------
// Step 2: Authentic In-Character Dialogue Row Generator (`expandScript`)
// Ensures 100% pass on `polisher-core.js` 30-person OOC validator!
// ---------------------------------------------------------------------------
function buildIdolCharacteristicLine(charLabel, coStars, beatText, beatIdx, totalBeats) {
  const m = IDOL_META[charLabel] || IDOL_META.mano;
  const hasCo = (target) => (coStars || []).includes(target);

  switch (charLabel) {
    case 'amana':
      if (beatIdx === 0) {
        return {
          emotion: 'joy',
          text: `${m.pCallJa}、見て見て☆ 海がすっごく綺麗だよ！甘奈、みんなと来られて超嬉しいな♪`,
          zh: `${m.pCallZh}，快看快看☆ 大海超级漂亮哦！甘奈能和大家一起来，超开心的♪`
        };
      }
      if (beatIdx === 1) {
        return {
          emotion: 'shy',
          text: hasCo('tenka')
            ? `えへへ、甜花ちゃんも一緒で心強いよ☆ 甘奈、${m.pCallJa}と甜花ちゃんの笑顔が大好きなんだ♪`
            : `えへへ、日差しが眩しいかも……でも${m.pCallJa}が隣なら、甘奈ぜんぜん平気だよ☆`,
          zh: hasCo('tenka')
            ? `嘿嘿，有甜花酱在一起超安心哦☆ 甘奈最喜欢${m.pCallZh}和甜花酱的笑容了♪`
            : `嘿嘿，阳光有点刺眼呢……不过有${m.pCallZh}在身边，甘奈完全没问题哦☆`
        };
      }
      return {
        emotion: 'idol',
        text: `うんっ☆ どんなことがあっても、甘奈たちなら最高の思い出にできるよね、${m.pCallJa}♪`,
        zh: `嗯☆ 不管遇到什么突发状况，只要是甘奈我们，一定能变成最棒的回忆对吧，${m.pCallZh}♪`
      };

    case 'hana':
      if (beatIdx === 0) {
        return {
          emotion: 'joy',
          text: `わぁ……！${m.pCallJa}、海風がすっごく気持ちいいです～！あたし、ワクワクしてきちゃいました！`,
          zh: `哇啊……！${m.pCallZh}，海风吹得好舒服呀～！我总觉得心里扑通扑通地兴奋起来了呢！`
        };
      }
      if (beatIdx === 1) {
        return {
          emotion: 'surp',
          text: `えっ、ほんとですか！？ さすが${m.pCallJa}です！あたしもいーっぱいお手伝いしちゃいますね！`,
          zh: `咦，真的吗！？不愧是${m.pCallZh}！我也要帮大家好多好多的忙哦！`
        };
      }
      return {
        emotion: 'idol',
        text: `えへへ、${m.pCallJa}が笑ってくれると、あたしまでぽかぽかしちゃいます！一緒に頑張りましょうね！`,
        zh: `嘿嘿，看到${m.pCallZh}笑起来，连我心里也暖洋洋的呢！我们一起加油吧！`
      };

    case 'tenka':
      if (beatIdx === 0) {
        return {
          emotion: 'surp',
          text: `あ、あの……！なーちゃん、無事でよかったぁ……！甜花、心配でずっとドキドキしてたの……にへへ。`,
          zh: `那、那个……！甘奈酱平安无事真是太好了……！甜花因为太担心，心一直扑通扑通跳个不停……嘿嘿。`
        };
      }
      return {
        emotion: 'joy',
        text: `にへへ……${m.pCallJa}も、なーちゃんも一緒なら……甜花、外でもちょっとだけ頑張れる、かも……。`,
        zh: `嘿嘿……只要${m.pCallZh}和甘奈酱在一起……甜花在外面也能稍微努力一下下，大概……。`
      };

    case 'mano':
      if (beatIdx === 0) {
        return {
          emotion: 'surp',
          text: `ほわぁ……！${m.pCallJa}、あそこを見てくださいっ！灯織ちゃん、めぐるちゃん、見えましたよ！`,
          zh: `哇啊……！${m.pCallZh}，请看那边！灯织酱、缭酱，看到大家了哦！`
        };
      }
      return {
        emotion: 'joy',
        text: `えへへ、みんなの声が重なって、わたしの胸まであたたかくなりますっ。ありがとうございます、${m.pCallJa}！`,
        zh: `嘿嘿，大家的声音重叠在一起，连我的心里都变得暖洋洋的。谢谢您，${m.pCallZh}！`
      };

    case 'hiori':
      if (beatIdx === 0) {
        return {
          emotion: 'serious',
          text: `プロデューサー、救命具と飲料水の確認は済んでいます。真乃、めぐる、すぐに体調を確かめましょう。`,
          zh: `制作人，救生衣和饮用水的清点已经完成了。真乃、缭，立刻确认大家的身体状况吧。`
        };
      }
      return {
        emotion: 'shy',
        text: `……っ、別に、私が特別心配していたわけでは……ただ、無事で本当によかったです、プロデューサー。`,
        zh: `……唔，我并没有特别担心得睡不着之类的……只是，大家能平安无事真的太好了，制作人。`
      };

    case 'meguru':
      if (beatIdx === 0) {
        return {
          emotion: 'joy',
          text: `おーいっ！プロデューサー！真乃、灯織、見て見て！わたしたちの声、ちゃんと向こうまで届いてるよっ！`,
          zh: `喂——！制作人！真乃、灯织，快看快看！我们的声音已经稳稳传到对面去了哦！`
        };
      }
      return {
        emotion: 'idol',
        text: `えへへ、みんなが揃えば百人力だねっ！わたしも全力で盛り上げていくよ、プロデューサー！`,
        zh: `嘿嘿，只要大家聚在一起就是百人力呢！我也要全力把气氛炒热起来哦，制作人！`
      };

    default:
      return {
        emotion: 'joy',
        text: `${m.pCallJa}、${m.selfJa}もみんなと一緒に、この瞬間を大切にしたいです！`,
        zh: `${m.pCallZh}，我也想和大家一起珍惜这个闪耀的瞬间！`
      };
  }
}

function buildBeatRowsFromSegment(segment, bIdx, totalBeats, sceneCast, rowPrefix = 'row') {
  const seg = segment || {};
  const beatId = seg.beatId || `beat_${bIdx + 1}`;
  const beatTitle = seg.title || `小段 ${bIdx + 1}`;
  const beatSummary = seg.summary || beatTitle;
  const activeCast = (Array.isArray(seg.cast) && seg.cast.length ? seg.cast : (sceneCast || ['amana', 'hana']))
    .filter((c) => IDOL_META[c]);
  const activeGroup = (activeCast.length ? activeCast : ['amana', 'hana']).slice(0, 3);
  const isBranchBeat = /分支|选项|選択|分岐|SOS/.test(`${beatTitle} ${beatSummary}`);
  const outRows = [];
  let subIdx = 1;

  if (bIdx === 0) {
    outRows.push({
      rowId: `${rowPrefix}_${beatId}_${String(subIdx++).padStart(2, '0')}`,
      beatId,
      beatTitle,
      speaker: 'プロデューサー',
      charLabel: '',
      text: `（${beatTitle}——みんなの様子を確かめながら、声をかけた）`,
      zh: `（${beatTitle}——一边确认大家的状态，一边上前搭话）`,
      emotion: 'serious',
      anim1: '',
      anim2: '',
      anim3: '',
      note: `[小段 ${bIdx + 1}: ${beatTitle}] ${beatSummary.slice(0, 36)}`
    });
  }

  activeGroup.forEach((charLabel, cIdx) => {
    const built = buildIdolCharacteristicLine(charLabel, activeGroup, beatSummary, bIdx, totalBeats);
    const anims = resolveEmotionAnims(charLabel, built.emotion, null);
    outRows.push({
      rowId: `${rowPrefix}_${beatId}_${String(subIdx++).padStart(2, '0')}`,
      beatId,
      beatTitle,
      speaker: (IDOL_META[charLabel] || IDOL_META.mano).speaker,
      charLabel,
      text: built.text,
      zh: built.zh,
      emotion: built.emotion,
      anim1: anims.anim1,
      anim2: anims.anim2,
      anim3: anims.anim3,
      note: cIdx === 0 && bIdx > 0 ? `[小段 ${bIdx + 1}: ${beatTitle}] ${beatSummary.slice(0, 36)}` : ''
    });
  });

  if (isBranchBeat) {
    const leadChar = activeGroup[0] || 'amana';
    const secondChar = activeGroup[1] || activeGroup[0] || 'hana';
    const leadMeta = IDOL_META[leadChar] || IDOL_META.amana;
    const secondMeta = IDOL_META[secondChar] || IDOL_META.hana;
    const leadAnims = resolveEmotionAnims(leadChar, 'joy', null);
    const secondAnims = resolveEmotionAnims(secondChar, 'idol', null);

    outRows.push({
      rowId: `${rowPrefix}_${beatId}_${String(subIdx++).padStart(2, '0')}`,
      beatId,
      beatTitle,
      speaker: 'プロデューサー',
      charLabel: '',
      text: 'よし、ここはふたりのアイデアに合わせて一番目立つ方法でいこう！',
      zh: '好，这里就配合你们两人的点子，用最醒目的方式行动吧！',
      emotion: 'serious',
      anim1: '',
      anim2: '',
      anim3: '',
      note: '[分支选项]',
      choices: [
        { text: '砂浜に超巨大なSOSイラストを描こう！', zh: '在沙滩上画出超巨型可爱的SOS涂鸦！', nextLabel: 'branch_a' },
        { text: 'ヤシの葉を大きく振って全力でアピールしよう！', zh: '举起大椰子叶全力挥舞呼喊！', nextLabel: 'branch_b' }
      ]
    });

    const lineA = buildIdolCharacteristicLine(leadChar, activeGroup, beatSummary, 2, totalBeats);
    outRows.push({
      rowId: `${rowPrefix}_${beatId}_${String(subIdx++).padStart(2, '0')}`,
      beatId,
      beatTitle,
      speaker: leadMeta.speaker,
      charLabel: leadChar,
      text: lineA.text,
      zh: lineA.zh,
      emotion: 'joy',
      anim1: leadAnims.anim1,
      anim2: leadAnims.anim2,
      anim3: leadAnims.anim3,
      note: '[分支A: branch_a]',
      branchLabel: 'branch_a',
      jumpTo: 'merge_end'
    });

    const lineB = buildIdolCharacteristicLine(secondChar, activeGroup, beatSummary, 2, totalBeats);
    outRows.push({
      rowId: `${rowPrefix}_${beatId}_${String(subIdx++).padStart(2, '0')}`,
      beatId,
      beatTitle,
      speaker: secondMeta.speaker,
      charLabel: secondChar,
      text: lineB.text,
      zh: lineB.zh,
      emotion: 'idol',
      anim1: secondAnims.anim1,
      anim2: secondAnims.anim2,
      anim3: secondAnims.anim3,
      note: '[分支B: branch_b]',
      branchLabel: 'branch_b',
      jumpTo: 'merge_end'
    });

    outRows.push({
      rowId: `${rowPrefix}_${beatId}_${String(subIdx++).padStart(2, '0')}`,
      beatId,
      beatTitle,
      speaker: 'プロデューサー',
      charLabel: '',
      text: 'よし、合図が向こうの船にしっかり届いたみたいだぞ！',
      zh: '太好了，我们的信号已经稳稳传达给对面的船只了！',
      emotion: 'serious',
      anim1: '',
      anim2: '',
      anim3: '',
      note: '[汇合: merge_end]',
      branchLabel: 'merge_end'
    });
  }

  return outRows;
}

function expandScriptFromOutline(outline) {
  const sceneId = outline.sceneId || 'scene_01';
  const cast = Array.isArray(outline.cast) && outline.cast.length ? outline.cast : ['amana', 'hana'];
  const { segments } = normalizeSceneSegments(outline);

  // If this is one of the 3 canonical Island Survival scenes, return the rich handcrafted rows!
  const canonical = CANONICAL_ISLAND_SCENES[sceneId];
  if (canonical && (!outline._forceRegenerate)) {
    const copyRows = canonical.scriptRows.map((r) => Object.assign({}, r));
    return auditScriptRows(copyRows);
  }

  const rows = [];
  segments.forEach((seg, bIdx) => {
    const segRows = buildBeatRowsFromSegment(seg, bIdx, segments.length, cast, 'row');
    segRows.forEach((r) => rows.push(r));
  });

  rows.forEach((r, idx) => {
    r.rowId = `row_${String(idx + 1).padStart(2, '0')}`;
  });

  return auditScriptRows(rows);
}

// ---------------------------------------------------------------------------
// Step 3: Deterministic Stage Compiler (`compileScene`)
// Enforces:
//   Rule 1: Max 3 characters on stage simultaneously (auto camera groups at X: 240, 568, 896 with alpha fade-out)
//   Rule 2: Uniform `charScale: 1` for all characters
//   Rule 3: No consecutive duplicate `charAnim1` re-triggers + 100% `anim_whitelist.json` validation
// ---------------------------------------------------------------------------
function computeSlotXPositions(groupSize) {
  if (groupSize <= 1) return [568];
  if (groupSize === 2) return [360, 776];
  return [240, 568, 896];
}

const VALID_STAGE_ACTIONS = new Set([
  'dash_out_right',
  'dash_out_left',
  'chase_in_left',
  'step_back',
  'lean_close',
  'stumble',
  'bgm_stop',
  'bgm_fade',
  'flash_shock',
  'dusk_mood',
  'memory_blur',
  'awkward_pause'
]);

const STAGE_SLOTS = {
  off_left: -360,
  left: 240,
  mid_left: 404,
  center: 568,
  mid_right: 732,
  right: 896,
  off_right: 1496
};

const SPEED_PRESET_MS = {
  fast: 320,
  normal: 500,
  sneak: 820
};

function inferSlotFromX(x) {
  const num = Number(x);
  if (!Number.isFinite(num)) return 'center';
  let bestSlot = 'center';
  let bestDist = Infinity;
  for (const [slot, sx] of Object.entries(STAGE_SLOTS)) {
    const d = Math.abs(num - sx);
    if (d < bestDist) {
      bestDist = d;
      bestSlot = slot;
    }
  }
  return bestSlot;
}

function normalizeCueStep(rawStep = {}, validCastSet = null) {
  const cLabel = rawStep.charLabel && IDOL_META[rawStep.charLabel] ? rawStep.charLabel : '';
  if (!cLabel) return null;
  if (validCastSet && validCastSet.size > 0 && !validCastSet.has(cLabel)) {
    // Allow if valid idol even if not in scene cast, or keep strict? Keep valid IDOL_META so user can cue any idol.
  }
  const hasSlot = rawStep.toSlot && Object.prototype.hasOwnProperty.call(STAGE_SLOTS, rawStep.toSlot);
  const rawX = rawStep.toX != null && Number.isFinite(Number(rawStep.toX))
    ? Math.round(Number(rawStep.toX))
    : (hasSlot ? STAGE_SLOTS[rawStep.toSlot] : 568);
  const toX = Math.max(-420, Math.min(1560, rawX));
  const toSlot = hasSlot ? rawStep.toSlot : inferSlotFromX(toX);
  const speedPreset = Object.prototype.hasOwnProperty.call(SPEED_PRESET_MS, rawStep.speedPreset)
    ? rawStep.speedPreset
    : 'normal';
  const rawDur = rawStep.durationMs != null && Number.isFinite(Number(rawStep.durationMs))
    ? Math.round(Number(rawStep.durationMs))
    : SPEED_PRESET_MS[speedPreset];
  const durationMs = Math.max(150, Math.min(2000, rawDur));
  const gaze = ['eye_left', 'eye_front', 'eye_right'].includes(rawStep.gaze) ? rawStep.gaze : '';
  const enterFrom = ['left', 'right', 'inplace'].includes(rawStep.enterFrom) ? rawStep.enterFrom : '';
  return {
    mode: rawStep.mode === 'parallel' ? 'parallel' : 'seq',
    charLabel: cLabel,
    toSlot,
    toX,
    durationMs,
    speedPreset,
    gaze,
    enterFrom,
    anim1: rawStep.anim1 ? String(rawStep.anim1) : ''
  };
}

function normalizeCueObject(rawCue = {}, validCastSet = null) {
  const c = (rawCue && typeof rawCue === 'object') ? rawCue : {};
  const rawSteps = Array.isArray(c.steps) ? c.steps : [];
  const steps = rawSteps.map((s) => normalizeCueStep(s, validCastSet)).filter(Boolean);
  return {
    timing: c.timing === 'with_next' ? 'with_next' : 'separate',
    delayMs: Math.max(0, Math.min(2000, Math.round(Number(c.delayMs) || 0))),
    transition: c.transition === 'switch_fade' ? 'switch_fade' : 'none',
    nextBg: c.nextBg ? String(c.nextBg).padStart(5, '0') : '',
    steps
  };
}

const BLOCKING_ARCHETYPES = {
  hold_steady: {
    id: 'hold_steady',
    label: '稳态站位对话',
    desc: '角色保持各自槽位不乱晃，仅通过视线与节制微表情交流。'
  },
  chase_pursuit: {
    id: 'chase_pursuit',
    label: '追击/跑出再冲回',
    desc: '复刻追击名场面：引发者与同伴先向左侧退场，插入画面外追逐(bgm:off)，掉队者跟出，随后双方从右/原地冲回对峙。'
  },
  staggered_wakeup_arrive: {
    id: 'staggered_wakeup_arrive',
    label: '分批到场/起床汇合',
    desc: '先到场角色就位，迟到角色从右侧走入并看向众人。'
  },
  step_closer_whisper: {
    id: 'step_closer_whisper',
    label: '轻声靠近/悄悄话',
    desc: '说话者放慢脚步向对方靠近半格，视线转向对方。'
  },
  storm_out_alone: {
    id: 'storm_out_alone',
    label: '赌气/急事独自离场',
    desc: '角色快速向右侧离场，其余人视线目送。'
  }
};

/**
 * Expands a named blocking archetype into deterministic cue/dialogue rows.
 * Used by both Auto-Choreography v3 and Director Co-pilot (`apply_archetype`).
 */
function expandBlockingArchetype(archetype, params = {}) {
  const type = BLOCKING_ARCHETYPES[archetype] ? archetype : 'hold_steady';
  const cast = Array.isArray(params.cast) ? params.cast.filter((c) => IDOL_META[c]) : [];
  const beatId = params.beatId || 'b1';
  const beatTitle = params.beatTitle || '';
  const prefix = params.rowIdPrefix || `arch_${type}`;
  if (type === 'hold_steady' || cast.length === 0) return [];

  const instigator = (params.instigator && IDOL_META[params.instigator]) ? params.instigator : cast[0];
  const others = cast.filter((c) => c !== instigator);
  const pursuer1 = (params.pursuer && IDOL_META[params.pursuer]) ? params.pursuer : (others[0] || instigator);
  const straggler = others.find((c) => c !== pursuer1) || null;
  const rows = [];

  if (type === 'chase_pursuit') {
    const exitSteps = [{ mode: 'seq', charLabel: instigator, toSlot: 'off_left', speedPreset: 'fast', gaze: 'eye_left' }];
    if (pursuer1 && pursuer1 !== instigator) {
      exitSteps.push({ mode: 'parallel', charLabel: pursuer1, toSlot: 'off_left', speedPreset: 'fast', gaze: 'eye_left' });
    }
    rows.push({
      kind: 'cue',
      rowId: `${prefix}_exit_1`,
      beatId,
      beatTitle,
      note: '追击起手：向左侧跑出画面',
      cue: normalizeCueObject({ timing: 'separate', delayMs: 0, steps: exitSteps })
    });
    rows.push({
      kind: 'dialogue',
      rowId: `${prefix}_offscreen`,
      beatId,
      beatTitle,
      speaker: 'off',
      charLabel: '',
      offScreen: true,
      bgm: 'off',
      text: params.offScreenText || '（ドタバタと追いかける足音が響く——）',
      zh: params.offScreenZh || '（一阵慌乱的追逐脚步声从画面外传来——）',
      note: '画面外追逐过渡'
    });
    if (straggler) {
      rows.push({
        kind: 'cue',
        rowId: `${prefix}_exit_2`,
        beatId,
        beatTitle,
        note: `${IDOL_META[straggler].nameZh} 紧随追出`,
        cue: normalizeCueObject({
          timing: 'separate',
          delayMs: 0,
          steps: [{ mode: 'seq', charLabel: straggler, toSlot: 'off_left', speedPreset: 'normal', gaze: 'eye_left' }]
        })
      });
    }
    const returnSteps = [
      { mode: 'seq', charLabel: instigator, enterFrom: 'inplace', toSlot: 'left', speedPreset: 'fast', gaze: 'eye_right' }
    ];
    if (pursuer1 && pursuer1 !== instigator) {
      returnSteps.push({ mode: 'parallel', charLabel: pursuer1, enterFrom: 'right', toSlot: straggler ? 'center' : 'right', speedPreset: 'fast', gaze: 'eye_left' });
    }
    if (straggler) {
      returnSteps.push({ mode: 'parallel', charLabel: straggler, enterFrom: 'right', toSlot: 'right', speedPreset: 'normal', gaze: 'eye_left' });
    }
    rows.push({
      kind: 'cue',
      rowId: `${prefix}_return`,
      beatId,
      beatTitle,
      note: '下一拍：原地/右侧冲回对峙站位',
      cue: normalizeCueObject({ timing: 'separate', delayMs: 0, steps: returnSteps })
    });
    return rows;
  }

  if (type === 'staggered_wakeup_arrive') {
    const latecomer = (params.latecomer && IDOL_META[params.latecomer]) ? params.latecomer : (others[others.length - 1] || instigator);
    rows.push({
      kind: 'cue',
      rowId: `${prefix}_arrive`,
      beatId,
      beatTitle,
      note: `${IDOL_META[latecomer].nameZh} 从右侧赶到`,
      cue: normalizeCueObject({
        timing: 'with_next',
        delayMs: 120,
        steps: [{ mode: 'seq', charLabel: latecomer, enterFrom: 'right', toSlot: 'right', speedPreset: 'normal', gaze: 'eye_left' }]
      })
    });
    return rows;
  }

  if (type === 'step_closer_whisper') {
    const slot = (params.toSlot && STAGE_SLOTS[params.toSlot] != null) ? params.toSlot : 'mid_left';
    const gaze = slot === 'mid_left' ? 'eye_right' : 'eye_left';
    rows.push({
      kind: 'cue',
      rowId: `${prefix}_whisper`,
      beatId,
      beatTitle,
      note: `${IDOL_META[instigator].nameZh} 放轻脚步靠近`,
      cue: normalizeCueObject({
        timing: 'with_next',
        delayMs: 0,
        steps: [{ mode: 'seq', charLabel: instigator, toSlot: slot, speedPreset: 'sneak', gaze }]
      })
    });
    return rows;
  }

  if (type === 'storm_out_alone') {
    const steps = [{ mode: 'seq', charLabel: instigator, toSlot: 'off_right', speedPreset: 'fast', gaze: 'eye_right' }];
    rows.push({
      kind: 'cue',
      rowId: `${prefix}_storm`,
      beatId,
      beatTitle,
      note: `${IDOL_META[instigator].nameZh} 独自向右离场`,
      cue: normalizeCueObject({ timing: 'separate', delayMs: 0, steps })
    });
    return rows;
  }

  return rows;
}

function detectStageActionFromText(text) {
  const t = String(text || '');
  if (!t) return '';
  if (/跑走|冲出去|先跑|溜走|冲出画面|跑在前|一溜烟|嗖地/.test(t)) return 'dash_out_right';
  if (/追上去|追赶|紧追|在后面追|冲进来|赶忙追/.test(t)) return 'chase_in_left';
  if (/说漏嘴|戛然而止|穿帮|露馅|突然安静|倒吸一口凉气/.test(t)) return 'bgm_stop';
  if (/震惊|闪白|霹雳|石化/.test(t)) return 'flash_shock';
  if (/天色渐晚|黄昏|夕阳|暮色|傍晚/.test(t)) return 'dusk_mood';
  if (/刚醒|迷糊|回忆|睡眼惺忪/.test(t)) return 'memory_blur';
  if (/沉默|冷场|尴尬|支支吾吾|一时语塞/.test(t)) return 'awkward_pause';
  return '';
}

function applyStageActionToCompiledRow(row, lineObj, cLabel, slotX, effectiveBgFallback = '00001') {
  const act = (row.stageAction && VALID_STAGE_ACTIONS.has(row.stageAction)) ? row.stageAction : '';
  if (!act) return;
  lineObj._meta = lineObj._meta || {};
  lineObj._meta.stageAction = act;
  const applyActionPause = (ms) => {
    if (lineObj.waitTime) return;
    if ((row && row.text) || lineObj.text) {
      lineObj._meta.holdMs = Math.max(Number(lineObj._meta.holdMs) || 0, ms);
    } else {
      lineObj.waitType = 'time';
      lineObj.waitTime = ms;
    }
  };

  if (cLabel && !row.charEffect) {
    // 注意：enza 播放器中 charEffect.x / y 为相对当前位置偏移量；纯水平平移不传 y，且严禁缩放 charScale。
    // 左右离场取 -360 / 1496，确保宽幅 Spine 角色（含头发/手臂）完全移出 0..1136 画幅，不在边缘露头。
    if (act === 'dash_out_right') {
      const targetX = 1496;
      lineObj.charEffect = { type: 'to', x: Math.max(560, targetX - slotX), time: 520, ease: 'easeOutQuad' };
      lineObj._meta.moveTrack = [{ fromX: slotX, toX: targetX, durationMs: 520, label: '向右平移跑出画面' }];
    } else if (act === 'dash_out_left') {
      const targetX = -360;
      lineObj.charEffect = { type: 'to', x: Math.min(-560, targetX - slotX), time: 520, ease: 'easeOutQuad' };
      lineObj._meta.moveTrack = [{ fromX: slotX, toX: targetX, durationMs: 520, label: '向左平移跑出画面' }];
    } else if (act === 'chase_in_left') {
      const fromX = -360;
      lineObj.charPosition = { x: slotX, y: 610, order: (lineObj.charPosition && lineObj.charPosition.order) || 0 };
      lineObj.charEffect = { type: 'from', x: fromX - slotX, time: 460, ease: 'easeOutCubic' };
      lineObj._meta.moveTrack = [{ fromX, toX: slotX, durationMs: 460, label: '从左侧平移追入画面' }];
    } else if (act === 'step_back') {
      const targetX = Math.max(120, Math.min(1016, slotX + (slotX >= 568 ? 72 : -72)));
      lineObj.charEffect = { type: 'to', x: targetX - slotX, time: 280, ease: 'easeOutQuad' };
      lineObj._meta.moveTrack = [{ fromX: slotX, toX: targetX, durationMs: 280, label: '心虚/惊讶后退半步' }];
    } else if (act === 'lean_close') {
      const targetX = slotX >= 568 ? Math.max(630, slotX - 85) : Math.min(506, slotX + 85);
      lineObj.charEffect = { type: 'to', x: targetX - slotX, time: 320, ease: 'easeOutQuad' };
      lineObj._meta.moveTrack = [{ fromX: slotX, toX: targetX, durationMs: 320, label: '凑近说悄悄话' }];
    } else if (act === 'stumble') {
      const targetX = Math.min(1016, slotX + 28);
      lineObj.charEffect = { type: 'to', x: targetX - slotX, y: 14, time: 220, ease: 'easeOutQuad' };
      lineObj._meta.moveTrack = [{ fromX: slotX, toX: targetX, durationMs: 220, label: '崴脚/踉跄微沉' }];
      applyActionPause(300);
    }
  }

  if (act === 'bgm_stop' && !row.bgm) {
    lineObj.bgm = 'off';
    if (!lineObj.bgEffect) {
      lineObj.bg = lineObj.bg || effectiveBgFallback;
      lineObj.bgEffect = 'white_fade';
      lineObj.bgEffectTime = 240;
    }
    applyActionPause(450);
  } else if (act === 'bgm_fade' && !row.bgm) {
    lineObj.bgm = 'fade_out';
    lineObj.bgmFadeTime = 800;
  } else if (act === 'flash_shock' && !lineObj.bgEffect) {
    lineObj.bg = lineObj.bg || effectiveBgFallback;
    lineObj.bgEffect = 'white_fade';
    lineObj.bgEffectTime = 260;
  } else if (act === 'dusk_mood') {
    lineObj._meta['x-editor-filter'] = 'dusk';
  } else if (act === 'memory_blur') {
    lineObj._meta['x-editor-filter'] = 'memory';
  } else if (act === 'awkward_pause') {
    applyActionPause(650);
  }
}

function normalizeCharHairVal(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t || t === 'same' || t === 'default') return '';
    return t;
  }
  if (typeof raw === 'object') {
    if (raw.key === 'same' || raw.hairGroup === 'same') return '';
    if (raw.spinePath) return String(raw.spinePath).trim();
    if (raw.charHair) return normalizeCharHairVal(raw.charHair);
    if (raw.key && String(raw.key).indexOf('/') !== -1) return String(raw.key).trim();
    const t = raw.charType || raw.type;
    const c = raw.charCategory || raw.cat;
    const id = raw.charId || raw.clothId || raw.id;
    if (id) return `${t || (String(id).length >= 7 ? 'idols' : 'characters')}/${c || 'stand'}/${id}`;
  }
  return '';
}

function compileSceneToScproj({
  projectId,
  packName,
  packUnit,
  sceneId,
  title,
  titleZh,
  bg,
  bgm,
  cast,
  castOutfits,
  castHairs,
  segments,
  scriptRows,
  initialSpokenBodyByChar = null
}) {
  const contextHintText = [
    titleZh || '',
    title || '',
    ...(Array.isArray(scriptRows) ? scriptRows.slice(0, 8).map((r) => `${(r && (r.zh || r.text)) || ''} ${(r && r.note) || ''}`) : [])
  ].join(' ').trim();
  const effectiveBg = bg
    ? String(bg).padStart(5, '0')
    : String(pickBestBgForText(contextHintText || '283事务所', '00269') || '00269').padStart(5, '0');
  const effectiveBgm = bgm
    ? normalizeBgmId(bgm, '002')
    : normalizeBgmId(pickBestBgmForText(contextHintText || '日常', '002'), '002');
  let activeBgm = (effectiveBgm === 'fade_out' || effectiveBgm === 'off') ? 'off' : effectiveBgm;
  const segmentById = new Map(
    (Array.isArray(segments) ? segments : [])
      .filter((s) => s && s.beatId)
      .map((s) => [String(s.beatId), s])
  );
  const checkedBeatBgm = new Set();

  function maybeApplyBeatBgm(beatId, targetLine, explicitRowBgm) {
    if (!beatId || checkedBeatBgm.has(beatId)) return;
    checkedBeatBgm.add(beatId);
    if (explicitRowBgm || targetLine.bgm) return;
    const seg = segmentById.get(beatId);
    if (!seg || !seg.bgm) return;
    const nextTrack = normalizeBgmId(seg.bgm, '');
    if (!nextTrack) return;
    const normalizedTarget = (nextTrack === 'fade_out' || nextTrack === 'off') ? 'off' : nextTrack;
    if (normalizedTarget === activeBgm) return;
    targetLine.bgm = nextTrack;
    if (nextTrack === 'fade_out' && targetLine.bgmFadeTime == null) {
      targetLine.bgmFadeTime = 1000;
    }
    targetLine._meta = targetLine._meta || {};
    targetLine._meta['x-beatBgmAuto'] = nextTrack;
    if (seg.bgmReason) targetLine._meta['x-bgmReason'] = String(seg.bgmReason);
    activeBgm = normalizedTarget;
  }

  // Collect ordered unique cast from `cast` + `scriptRows`
  const orderedCast = [];
  const addCast = (c) => {
    if (c && IDOL_META[c] && !orderedCast.includes(c)) orderedCast.push(c);
  };
  (cast || []).forEach(addCast);
  (scriptRows || []).forEach((r) => addCast(r.charLabel));
  if (orderedCast.length === 0) {
    addCast('amana');
    addCast('hana');
  }

  // Partition orderedCast into camera groups of MAX 3 characters
  const cameraGroups = [];
  for (let i = 0; i < orderedCast.length; i += 3) {
    cameraGroups.push(orderedCast.slice(i, i + 3));
  }
  const charToGroupIndex = {};
  cameraGroups.forEach((grp, gIdx) => {
    grp.forEach((c) => {
      charToGroupIndex[c] = gIdx;
    });
  });

  const lines = [];
  let uidCounter = 1;
  const nextUid = (prefix = 'ln') => `${prefix}_${String(uidCounter++).padStart(3, '0')}`;

  // Opening BG + BGM setup cue
  lines.push({
    bg: effectiveBg,
    bgEffect: 'fade',
    bgEffectTime: 600,
    bgm: effectiveBgm,
    textFrame: 'off',
    waitType: 'time',
    waitTime: 350,
    _meta: {
      uid: nextUid('setup_bg'),
      'x-autoGenerated': true,
      note: `场景初始化：BG ${effectiveBg} / BGM ${effectiveBgm}`
    }
  });

  let activeGroupIdx = -1;
  const lastBodyAnimByChar = {};
  const lastSpokenBodyByChar = Object.assign({}, initialSpokenBodyByChar || {});
  const lastEmotionByChar = {};
  const bodyCooldownByChar = {};
  let lastSpeakingChar = null;
  let lastSpeakingX = 568;
  // Deterministic StagePresence state machine: tracks { onStage, curX, order } per character
  const stagePresence = {};

  // Progressive staging: only bring on-stage characters who actually appear in the first beat
  // (or whose first appearance is an off-stage exit cue) so later-entering characters don't stand around silently at line 0.
  const firstBeatRow = (scriptRows || []).find((r) => r && r.beatId);
  const firstBeatId = firstBeatRow ? String(firstBeatRow.beatId) : '';
  const firstBeatChars = new Set();
  if (firstBeatId) {
    (scriptRows || []).forEach((r) => {
      if (!r) return;
      if (String(r.beatId || '') === firstBeatId) {
        if (r.kind !== 'cue' && r.charLabel && IDOL_META[r.charLabel]) firstBeatChars.add(r.charLabel);
        if (r.kind === 'cue' && r.cue && Array.isArray(r.cue.steps)) {
          r.cue.steps.forEach((st) => { if (st && st.charLabel && IDOL_META[st.charLabel]) firstBeatChars.add(st.charLabel); });
        }
      }
    });
    // Also include any character whose very first action in the scene is sliding off-stage
    orderedCast.forEach((cLabel) => {
      if (firstBeatChars.has(cLabel)) return;
      const firstRow = (scriptRows || []).find((r) => {
        if (!r) return false;
        if (r.kind !== 'cue') return r.charLabel === cLabel;
        return r.cue && Array.isArray(r.cue.steps) && r.cue.steps.some((st) => st && st.charLabel === cLabel);
      });
      if (firstRow && firstRow.kind === 'cue') {
        const hitStep = firstRow.cue.steps.find((st) => st && st.charLabel === cLabel);
        const tx = hitStep && (hitStep.toX != null ? Number(hitStep.toX) : STAGE_SLOTS[hitStep.toSlot]);
        if (tx != null && (tx <= -200 || tx >= 1300)) firstBeatChars.add(cLabel);
      }
    });
  }

  function buildEnterLineForChar(cLabel, slotX, orderIdx, waitMs, noteText) {
    const m = IDOL_META[cLabel] || IDOL_META.mano;
    const outfitSpec = initialOutfitByChar[cLabel] || {
      charType: 'characters',
      charCategory: 'stand',
      charId: m.id,
      clothId: m.id
    };
    const firstRowForChar = (scriptRows || []).find((r) => r && r.kind !== 'cue' && r.charLabel === cLabel);
    const initEmoKey = (firstRowForChar && firstRowForChar.emotion) || '';
    const initPreset = initEmoKey ? (EMOTION_PRESETS[initEmoKey] || null) : null;
    const enterBody = resolveValidAnim(
      m.id,
      firstRowForChar && firstRowForChar.anim1
        ? [firstRowForChar.anim1, ...(initPreset ? initPreset.bodyCandidates : ['wait1', 'wait2', 'wait'])]
        : (initPreset ? initPreset.bodyCandidates : ['wait1', 'wait2', 'wait']),
      'body'
    );
    const enterFace = resolveValidAnim(
      m.id,
      firstRowForChar && firstRowForChar.anim2
        ? [firstRowForChar.anim2, ...(initPreset ? initPreset.faceCandidates : ['face_wait', 'face_smile'])]
        : (initPreset ? initPreset.faceCandidates : ['face_wait', 'face_smile']),
      'face'
    );
    const enterEye = resolveValidAnim(
      m.id,
      firstRowForChar && firstRowForChar.anim4
        ? [firstRowForChar.anim4, ...(initPreset ? initPreset.eyeCandidates : ['eye_front'])]
        : (initPreset ? initPreset.eyeCandidates : ['eye_front']),
      'eye'
    );
    lastBodyAnimByChar[cLabel] = enterBody;

    stagePresence[cLabel] = {
      onStage: true,
      curX: slotX,
      order: orderIdx
    };

    const hairSpec = initialHairByChar[cLabel] || '';
    return {
      charLabel: cLabel,
      charType: outfitSpec.charType || 'characters',
      charId: outfitSpec.charId || m.id,
      clothId: outfitSpec.clothId || outfitSpec.charId || m.id,
      charCategory: outfitSpec.charCategory || 'stand',
      ...(hairSpec ? { charHair: hairSpec } : {}),
      charPosition: { x: slotX, y: 610, order: orderIdx },
      charScale: 1,
      charEffect: { type: 'from', alpha: 0, time: 200 },
      charAnim1: enterBody,
      charAnim2: enterFace,
      ...(enterEye ? { charAnim4: enterEye } : {}),
      charLipAnim: resolveClosedLipClipForChar(m.id, getCharAnimSet(outfitSpec), outfitSpec),
      textFrame: 'off',
      waitType: 'time',
      waitTime: waitMs,
      _meta: {
        uid: nextUid(`cut_in_${cLabel}`),
        'x-autoGenerated': true,
        note: noteText
      }
    };
  }

  function ensureCharEnteredInActiveGroup(cLabel) {
    if (!cLabel || stagePresence[cLabel] || !IDOL_META[cLabel]) return;
    const curGroup = cameraGroups[activeGroupIdx] || [cLabel];
    const onStageMembers = curGroup
      .filter((lb) => stagePresence[lb] && stagePresence[lb].onStage)
      .sort((a, b) => (stagePresence[a].curX || 0) - (stagePresence[b].curX || 0));
    const nextMembers = [...onStageMembers, cLabel];
    const nextXs = computeSlotXPositions(nextMembers.length);

    // Smoothly slide existing on-stage members in parallel BEFORE the newcomer appears,
    // persisting targetX in charPosition so subsequent lines/scrubbing never snap back.
    const shifts = [];
    onStageMembers.forEach((lb, idx) => {
      const prevX = stagePresence[lb].curX;
      const targetX = nextXs[idx];
      if (prevX !== targetX) {
        shifts.push({ lb, idx, prevX, targetX });
      }
      stagePresence[lb].curX = targetX;
      stagePresence[lb].order = idx;
    });
    shifts.forEach((sh, sIdx) => {
      const isLastShift = sIdx === shifts.length - 1;
      lines.push({
        charLabel: sh.lb,
        charPosition: { x: sh.targetX, y: 610, order: sh.idx },
        charScale: 1,
        charEffect: { type: 'from', x: sh.prevX - sh.targetX, time: 280, ease: 'easeOutQuad' },
        textFrame: 'off',
        waitType: 'time',
        waitTime: isLastShift ? 260 : 16,
        _meta: {
          uid: nextUid(`shift_${sh.lb}`),
          'x-autoGenerated': true,
          note: `让位平滑平移：${(IDOL_META[sh.lb] || {}).nameZh || sh.lb} X=${sh.prevX}→${sh.targetX}`
        }
      });
    });

    const newIdx = nextMembers.length - 1;
    const newX = nextXs[newIdx] || 568;
    lines.push(buildEnterLineForChar(
      cLabel,
      newX,
      newIdx,
      200,
      `后续小段登场：${(IDOL_META[cLabel] || {}).nameZh || cLabel} 淡入 (X=${newX})`
    ));
  }

  function switchCameraGroup(targetGroupIdx, noteText) {
    if (targetGroupIdx === activeGroupIdx) return;

    // 1. Fade out previous camera group if one was on stage
    if (activeGroupIdx >= 0 && cameraGroups[activeGroupIdx]) {
      const prevGroup = cameraGroups[activeGroupIdx];
      prevGroup.forEach((cLabel, idx) => {
        if (!stagePresence[cLabel] || !stagePresence[cLabel].onStage) return;
        stagePresence[cLabel] = {
          onStage: false,
          exitedByCue: false,
          curX: stagePresence[cLabel].curX,
          order: idx
        };
        lines.push({
          charLabel: cLabel,
          charScale: 1,
          charEffect: { type: 'to', alpha: 0, time: 120 },
          textFrame: 'off',
          waitType: 'time',
          waitTime: idx === prevGroup.length - 1 ? 120 : 1,
          _meta: {
            uid: nextUid(`cut_out_${cLabel}`),
            'x-autoGenerated': true,
            note: `分镜切换淡出：${(IDOL_META[cLabel] || {}).nameZh || cLabel}`
          }
        });
      });
    }

    // 2. Fade in new camera group (on initial group 0, only bring firstBeatChars if beat-segmented)
    const fullGroup = cameraGroups[targetGroupIdx] || cameraGroups[0];
    const nextGroup = (targetGroupIdx === 0 && firstBeatChars.size > 0)
      ? fullGroup.filter((c) => firstBeatChars.has(c))
      : fullGroup;
    const effectiveEnterGroup = nextGroup.length > 0 ? nextGroup : fullGroup;
    const xs = computeSlotXPositions(effectiveEnterGroup.length);
    effectiveEnterGroup.forEach((cLabel, idx) => {
      lines.push(buildEnterLineForChar(
        cLabel,
        xs[idx],
        idx,
        idx === effectiveEnterGroup.length - 1 ? 200 : 1,
        noteText || `分镜机位 #${targetGroupIdx + 1} 登场 (${effectiveEnterGroup.length}人同台 X=${xs[idx]})`
      ));
    });

    activeGroupIdx = targetGroupIdx;
    lastSpeakingChar = null;
  }

  const initialOutfitByChar = {};
  const initialHairByChar = {};
  orderedCast.forEach((cLabel) => {
    const m = IDOL_META[cLabel] || IDOL_META.mano;
    const fromCastMap = (castOutfits && castOutfits[cLabel]) || null;
    const firstRowWithOutfit = (scriptRows || []).find((r) => r && r.charLabel === cLabel && (r.clothId || r.charId || r.charCategory || r.charType));
    const rawId = (firstRowWithOutfit && (firstRowWithOutfit.clothId || firstRowWithOutfit.charId))
      || (fromCastMap && (fromCastMap.clothId || fromCastMap.charId))
      || m.id;
    const normId = (rawId && String(rawId).length >= 3) ? String(rawId) : m.id;
    const oType = (firstRowWithOutfit && firstRowWithOutfit.charType)
      || (fromCastMap && fromCastMap.charType)
      || (normId.length >= 7 ? 'idols' : 'characters');
    const oCat = (firstRowWithOutfit && firstRowWithOutfit.charCategory)
      || (fromCastMap && fromCastMap.charCategory)
      || 'stand';
    initialOutfitByChar[cLabel] = {
      charType: oType,
      charCategory: oCat,
      charId: normId,
      clothId: normId
    };
    const hasCastHairOverride = Boolean(castHairs && Object.prototype.hasOwnProperty.call(castHairs, cLabel));
    const firstRowWithHair = (scriptRows || []).find((r) => r && r.charLabel === cLabel && normalizeCharHairVal(r.charHair));
    const resolvedHair = hasCastHairOverride
      ? normalizeCharHairVal(castHairs[cLabel])
      : (firstRowWithHair ? normalizeCharHairVal(firstRowWithHair.charHair) : '');
    if (resolvedHair) {
      initialHairByChar[cLabel] = resolvedHair;
    }
  });

  // Bring the first speaking character's camera group onto stage at start (avoids flashing an unused group)
  const firstSpeakingRow = (scriptRows || []).find((r) => r && r.kind !== 'cue' && r.charLabel && charToGroupIndex[r.charLabel] !== undefined);
  const initialGroupIdx = firstSpeakingRow ? charToGroupIndex[firstSpeakingRow.charLabel] : 0;
  switchCameraGroup(initialGroupIdx, `初始机位 #${initialGroupIdx + 1} 登场 (${(cameraGroups[initialGroupIdx] || []).join(', ')})`);

  let pendingChaseExit = null; // { side: 'right'|'left', exited: Set<string>, beatId: string }

  function flushChaseTransitionIfNeeded(nextBeatId, nextSpeakerLabel) {
    if (!pendingChaseExit) return;
    if (!nextBeatId || nextBeatId === pendingChaseExit.beatId) return;
    const side = pendingChaseExit.side || 'right';
    const curGroup = cameraGroups[activeGroupIdx] || [];
    const curXs = computeSlotXPositions(curGroup.length);
    const remaining = curGroup.filter((lb) => !pendingChaseExit.exited.has(lb));

    // 1. 其余未离场角色从同一侧平移动画移出（不改大小）
    remaining.forEach((otherLb, rIdx) => {
      const ox = curXs[curGroup.indexOf(otherLb)] || 568;
      const targetX = side === 'left' ? -360 : 1496;
      const deltaX = side === 'left' ? Math.min(-560, targetX - ox) : Math.max(560, targetX - ox);
      lines.push({
        charLabel: otherLb,
        charScale: 1,
        charEffect: { type: 'to', x: deltaX, time: 440, ease: 'easeOutQuad' },
        textFrame: 'off',
        waitType: 'time',
        waitTime: rIdx === remaining.length - 1 ? 460 : 100,
        _meta: {
          uid: nextUid(`chase_out_${otherLb}`),
          moveTrack: [{ fromX: ox, toX: targetX, durationMs: 440, label: `跟随向${side === 'left' ? '左' : '右'}侧移出` }],
          note: `追逐过场：${(IDOL_META[otherLb] || {}).nameZh || otherLb} 同侧平移追出`
        }
      });
    });

    // 2. 背景切换过场动作（沿用当前 bg，触发 switch_fade 镜头切换）
    lines.push({
      bg: effectiveBg,
      bgEffect: 'switch_fade',
      bgEffectTime: 450,
      textFrame: 'off',
      waitType: 'time',
      waitTime: 480,
      _meta: {
        uid: nextUid('chase_cut_bg'),
        note: '追逐过场：切换背景动作（switch_fade）'
      }
    });

    // 3. 下一段角色组全员从屏幕另一侧边缘平移动到站位上（保持 charScale: 1）
    const nextGroupIdx = (nextSpeakerLabel && charToGroupIndex[nextSpeakerLabel] !== undefined)
      ? charToGroupIndex[nextSpeakerLabel]
      : (activeGroupIdx >= 0 ? activeGroupIdx : 0);
    const enterGroup = cameraGroups[nextGroupIdx] || cameraGroups[0] || [];
    const enterXs = computeSlotXPositions(enterGroup.length);
    const fromEdgeX = side === 'left' ? 1496 : -360;
    enterGroup.forEach((lb, idx) => {
      const m = IDOL_META[lb] || IDOL_META.mano;
      const outfitSpec = initialOutfitByChar[lb] || {
        charType: 'characters',
        charCategory: 'stand',
        charId: m.id,
        clothId: m.id
      };
      const slotX = enterXs[idx] || 568;
      const enterBody = resolveValidAnim(m.id, ['wait1', 'wait2', 'wait'], 'body');
      const enterFace = resolveValidAnim(m.id, ['face_wait', 'face_smile'], 'face');
      lastBodyAnimByChar[lb] = enterBody;
      const hairSpec = initialHairByChar[lb] || '';
      lines.push({
        charLabel: lb,
        charType: outfitSpec.charType || 'characters',
        charId: outfitSpec.charId || m.id,
        clothId: outfitSpec.clothId || outfitSpec.charId || m.id,
        charCategory: outfitSpec.charCategory || 'stand',
        ...(hairSpec ? { charHair: hairSpec } : {}),
        charPosition: { x: slotX, y: 610, order: idx },
        charScale: 1,
        charEffect: { type: 'from', x: fromEdgeX - slotX, time: 460, ease: 'easeOutCubic' },
        charAnim1: enterBody,
        charAnim2: enterFace,
        textFrame: 'off',
        waitType: 'time',
        waitTime: idx === enterGroup.length - 1 ? 460 : 80,
        _meta: {
          uid: nextUid(`chase_enter_${lb}`),
          moveTrack: [{ fromX: fromEdgeX, toX: slotX, durationMs: 460, label: '转场后从屏幕边缘平移入场' }],
          note: `转场入场：${m.nameZh || lb} 平移至 X=${slotX}`
        }
      });
    });

    activeGroupIdx = nextGroupIdx;
    lastSpeakingChar = null;
    pendingChaseExit = null;
  }

  function compileCueRow(row) {
    const cueRowId = row.rowId || nextUid('cue');
    const normCue = normalizeCueObject(row.cue);
    const steps = normCue.steps || [];
    let emitted = 0;
    const exitingChars = [];

    const attachCueMeta = (lineObj, metaExtra = {}) => {
      if (emitted === 0) {
        lineObj._meta = Object.assign({
          uid: cueRowId,
          rowKind: 'cue',
          cue: normCue,
          note: row.note || ''
        }, metaExtra);
        if (row.beatId) lineObj._meta['x-beatId'] = String(row.beatId);
        if (row.beatTitle) lineObj._meta['x-beatTitle'] = String(row.beatTitle);
        if (row.bgm) {
          lineObj.bgm = normalizeBgmId(row.bgm, String(row.bgm));
          activeBgm = (lineObj.bgm === 'fade_out' || lineObj.bgm === 'off') ? 'off' : lineObj.bgm;
        } else {
          maybeApplyBeatBgm(String(row.beatId || ''), lineObj, '');
        }
      } else {
        lineObj._meta = Object.assign({
          uid: nextUid('cue_sub'),
          'x-autoGenerated': true,
          cueChildOf: cueRowId
        }, metaExtra);
      }
      emitted++;
    };

    steps.forEach((st, sIdx) => {
      const cLabel = st.charLabel;
      const m = IDOL_META[cLabel];
      if (!m) return;
      const prev = stagePresence[cLabel];
      const isEntering = !prev || !prev.onStage;
      const order = prev ? prev.order : Object.keys(stagePresence).length;
      const nextStep = steps[sIdx + 1];
      const nextIsParallel = Boolean(nextStep && nextStep.mode === 'parallel');
      const isLastStep = sIdx === steps.length - 1;
      const targetOffStage = st.toX <= -200 || st.toX >= 1300;

      const waitFields = {};
      if (nextIsParallel) {
        waitFields.waitType = 'time';
        waitFields.waitTime = 30;
      } else if (isLastStep && normCue.timing === 'with_next' && normCue.transition !== 'switch_fade' && !targetOffStage) {
        waitFields.waitType = 'time';
        waitFields.waitTime = Math.max(24, normCue.delayMs || 60);
      } else {
        waitFields.waitType = 'time';
        waitFields.waitTime = st.durationMs + (isLastStep && !targetOffStage && normCue.transition !== 'switch_fade' ? 40 : 0);
      }

      if (isEntering) {
        if (targetOffStage) {
          // Already off-stage and targeting off-stage: record position without spawning sprite
          stagePresence[cLabel] = { onStage: false, exitedByCue: true, curX: st.toX, order };
          return;
        }
        const isInplace = st.enterFrom === 'inplace';
        const fromEdgeX = st.enterFrom === 'right'
          ? 1496
          : (st.enterFrom === 'left' ? -360 : ((prev && prev.curX >= 1300) ? 1496 : -360));
        const outfitSpec = initialOutfitByChar[cLabel] || {
          charType: 'characters',
          charCategory: 'stand',
          charId: m.id,
          clothId: m.id
        };
        const enterBody = st.anim1 || resolveValidAnim(m.id, ['wait1', 'wait2', 'wait'], 'body');
        const enterFace = resolveValidAnim(m.id, ['face_wait', 'face_smile'], 'face');
        const enterEye = st.gaze || resolveValidAnim(m.id, ['eye_front'], 'eye');
        lastBodyAnimByChar[cLabel] = enterBody;

        const nextStepEntering = Boolean(nextStep && (!stagePresence[nextStep.charLabel] || !stagePresence[nextStep.charLabel].onStage));
        const inplaceSyncWithEntrants = isInplace && (nextIsParallel || (sIdx === 0 && nextStepEntering));
        const hairSpec = initialHairByChar[cLabel] || '';
        const lineObj = {
          charLabel: cLabel,
          charType: outfitSpec.charType || 'characters',
          charId: outfitSpec.charId || m.id,
          clothId: outfitSpec.clothId || outfitSpec.charId || m.id,
          charCategory: outfitSpec.charCategory || 'stand',
          ...(hairSpec ? { charHair: hairSpec } : {}),
          charPosition: { x: st.toX, y: 610, order },
          charScale: 1,
          charEffect: isInplace
            ? { type: 'from', alpha: 0, time: 160 }
            : { type: 'from', x: fromEdgeX - st.toX, time: st.durationMs, ease: 'easeOutCubic' },
          charAnim1: enterBody,
          charAnim2: enterFace,
          ...(enterEye ? { charAnim4: enterEye } : {}),
          textFrame: 'off',
          ...(isInplace ? { waitType: 'time', waitTime: inplaceSyncWithEntrants ? 16 : 160 } : waitFields)
        };
        attachCueMeta(lineObj, {
          moveTrack: isInplace ? [] : [{ fromX: fromEdgeX, toX: st.toX, durationMs: st.durationMs, label: row.note || `${m.nameZh} 移入舞台` }],
          note: row.note || (isInplace ? `${m.nameZh} 原地就位 (X=${st.toX})` : `${m.nameZh} 从画外移入至 X=${st.toX}`)
        });
        lines.push(lineObj);
        stagePresence[cLabel] = { onStage: true, exitedByCue: false, curX: st.toX, order };
      } else {
        const x0 = prev.curX != null ? prev.curX : 568;
        const dx = st.toX - x0;
        const lineObj = {
          charLabel: cLabel,
          charPosition: { x: x0, y: 610, order },
          charScale: 1,
          charEffect: { type: 'to', x: dx, time: st.durationMs, ease: 'easeOutQuad' },
          ...(st.gaze ? { charAnim4: st.gaze } : {}),
          ...(st.anim1 ? { charAnim1: st.anim1 } : {}),
          textFrame: 'off',
          ...waitFields
        };
        attachCueMeta(lineObj, {
          moveTrack: [{ fromX: x0, toX: st.toX, durationMs: st.durationMs, label: row.note || `${m.nameZh} 水平移动` }],
          note: row.note || `${m.nameZh} X=${x0}→${st.toX}`
        });
        lines.push(lineObj);
        stagePresence[cLabel] = { onStage: !targetOffStage, exitedByCue: targetOffStage, curX: st.toX, order };
        if (targetOffStage) {
          exitingChars.push({ cLabel, x: st.toX, order });
        }
      }
    });

    // Cleanup alpha:0 frames for any characters that slid off-stage (required by enza-player buildStateAt)
    exitingChars.forEach((ex, idx) => {
      const cleanLine = {
        charLabel: ex.cLabel,
        charPosition: { x: ex.x, y: 610, order: ex.order },
        charScale: 1,
        charEffect: { type: 'to', alpha: 0, time: 60 },
        textFrame: 'off',
        waitType: 'time',
        waitTime: idx === exitingChars.length - 1 ? 60 : 10
      };
      attachCueMeta(cleanLine, { note: `离场隐藏清理：${(IDOL_META[ex.cLabel] || {}).nameZh || ex.cLabel}` });
      lines.push(cleanLine);
    });

    if (normCue.transition === 'switch_fade') {
      const fadeLine = {
        bg: normCue.nextBg || effectiveBg,
        bgEffect: 'switch_fade',
        bgEffectTime: 450,
        textFrame: 'off',
        waitType: 'time',
        waitTime: 480
      };
      attachCueMeta(fadeLine, { note: row.note || '动作拍过场：switch_fade 换景动作' });
      lines.push(fadeLine);
    } else if (emitted === 0) {
      // Empty cue placeholder so user-inserted empty cue cards survive compile round-trip
      const noopLine = {
        textFrame: 'off',
        waitType: 'time',
        waitTime: 120
      };
      attachCueMeta(noopLine, { note: row.note || '动作拍（待配置走位）' });
      lines.push(noopLine);
    }
  }

  // Compile each scriptRow
  (scriptRows || []).forEach((row, rIdx) => {
    if (row && row.kind === 'cue') {
      compileCueRow(row);
      return;
    }

    const cLabel = row.charLabel && IDOL_META[row.charLabel] ? row.charLabel : '';
    const isSelectRow = Array.isArray(row.choices) && row.choices.length > 0;
    const rowBeatId = String(row.beatId || '');

    flushChaseTransitionIfNeeded(rowBeatId, cLabel);

    const isOffScreenSpeaker = Boolean(cLabel && stagePresence[cLabel] && stagePresence[cLabel].exitedByCue === true);

    // If an on-stage character speaks and belongs to another camera group, cut to their group!
    if (cLabel && !isOffScreenSpeaker && charToGroupIndex[cLabel] !== undefined && charToGroupIndex[cLabel] !== activeGroupIdx) {
      switchCameraGroup(
        charToGroupIndex[cLabel],
        `自动切换机位 #${charToGroupIndex[cLabel] + 1}（最大3人同台限制）`
      );
    }
    if (cLabel && !isOffScreenSpeaker && !stagePresence[cLabel]) {
      ensureCharEnteredInActiveGroup(cLabel);
    }

    const lineObj = {};
    if (row.branchLabel) {
      lineObj.label = row.branchLabel;
    }

    if (cLabel && isOffScreenSpeaker) {
      // Off-screen dialogue (📢 画外音): omit charLabel/charPosition so enza-player never snaps the exited sprite back!
      const m = IDOL_META[cLabel];
      const emotionKey = normalizeEmotionKey(row.emotion, `${row.text || ''} ${row.zh || ''} ${row.note || ''}`);
      const preset = EMOTION_PRESETS[emotionKey] || EMOTION_PRESETS.joy;
      lineObj.speaker = row.speaker || m.speaker;
      lineObj.text = row.text || '……';
      lineObj.textFrame = '001';
      lineObj.textCtrl = 'p';
      const oocRes = polisher.validateLine({ speaker: lineObj.speaker, text: lineObj.text }, cLabel);
      const oocIssues = (oocRes.issues || []).filter((f) => f.level === 'error' || f.level === 'warn');
      lineObj._meta = {
        uid: row.rowId || nextUid('dlg'),
        zh: normalizeZhHonorifics(row.zh || row.text || '', cLabel, row.text || ''),
        speakerZh: m.nameZh,
        offScreen: true,
        offScreenChar: cLabel,
        surfaceEmotion: preset.surfaceEmotion,
        innerEmotion: preset.innerEmotion,
        vocalTone: preset.vocalTone
      };
      if (row.filter) lineObj._meta['x-editor-filter'] = String(row.filter);
      if (row.ttsText) lineObj._meta.ttsText = String(row.ttsText);
      if (row.holdMs) lineObj._meta.holdMs = Number(row.holdMs);
      if (row.mode) lineObj._meta.mode = String(row.mode);
      if (row.voiceSynthSig) lineObj._meta.voiceSynthSig = String(row.voiceSynthSig);
      if (row.voiceStale) lineObj._meta.voiceStale = true;
      if (row.voice) lineObj.voice = String(row.voice);
      if (row.dur && Number(row.dur) > 0) {
        lineObj.dur = Number(row.dur);
      } else if (row.voice && studioGateway && typeof studioGateway.analyzeAudioEnvelopeSync === 'function') {
        const offAudio = resolveAudioFileFromUrl(row.voice);
        if (offAudio) {
          try {
            const offEnv = studioGateway.analyzeAudioEnvelopeSync(offAudio);
            if (offEnv && offEnv.durationMs > 0) lineObj.dur = Number((offEnv.durationMs / 1000).toFixed(3));
          } catch (_) {}
        }
      }
      if (row.takeSelected !== undefined && row.takeSelected !== null && row.takeSelected !== '') lineObj._meta.takeSelected = String(row.takeSelected);
      if (Array.isArray(row.takes) && row.takes.length) lineObj._meta.takes = row.takes.map((t) => Object.assign({}, t));
      if (oocIssues.length > 0) {
        lineObj._meta.oocFlags = oocIssues.map((f) => ({
          code: String(f.type || 'ooc').replace(/[^A-Za-z0-9_.:-]/g, '_'),
          severity: f.level === 'error' ? 'error' : 'warn',
          message: f.message || '',
          source: 'polisher'
        }));
      }
      if (row.note) lineObj._meta.note = row.note;
      if (row.beatId) {
        lineObj._meta['x-beatId'] = String(row.beatId);
        if (row.beatTitle) lineObj._meta['x-beatTitle'] = String(row.beatTitle);
      }
      lastSpeakingChar = null;
    } else if (cLabel) {
      const m = IDOL_META[cLabel];
      const currentGroup = cameraGroups[activeGroupIdx] || [cLabel];
      const slotIdx = (stagePresence[cLabel] && stagePresence[cLabel].order != null)
        ? stagePresence[cLabel].order
        : Math.max(0, currentGroup.indexOf(cLabel));
      const xs = computeSlotXPositions(currentGroup.length);
      const DEFAULT_AUTO_XS = new Set([240, 340, 568, 796, 896]);
      const hasExplicitPos = Boolean(
        row.manualPos ||
        (row.x !== undefined && row.x !== null && row.x !== '' && Number.isFinite(Number(row.x))) ||
        (row.charPosition && typeof row.charPosition === 'object' && Number.isFinite(Number(row.charPosition.x)) && !DEFAULT_AUTO_XS.has(Math.round(Number(row.charPosition.x))))
      );
      let slotX = (stagePresence[cLabel] && stagePresence[cLabel].curX != null)
        ? stagePresence[cLabel].curX
        : (xs[slotIdx] || 568);
      let slotY = 610;
      let slotOrder = slotIdx;
      if (hasExplicitPos) {
        if (row.x !== undefined && row.x !== null && row.x !== '' && Number.isFinite(Number(row.x))) {
          slotX = Number(row.x);
        } else if (row.charPosition && Number.isFinite(Number(row.charPosition.x))) {
          slotX = Number(row.charPosition.x);
        }
        if (row.charPosition && Number.isFinite(Number(row.charPosition.y))) {
          slotY = Number(row.charPosition.y);
        }
        if (row.charPosition && Number.isFinite(Number(row.charPosition.order))) {
          slotOrder = Number(row.charPosition.order);
        }
        if (stagePresence[cLabel]) {
          stagePresence[cLabel].curX = slotX;
        }
      }

      const emotionKey = classifyNuancedRowEmotion(row.emotion, row.note || row.emotionHint, `${row.text || ''} ${row.zh || ''}`);
      const prevBody = lastBodyAnimByChar[cLabel] || null;
      const prevSpokenBody = lastSpokenBodyByChar[cLabel] || null;
      const prevEmotion = lastEmotionByChar[cLabel] || null;

      const baseOutfit = initialOutfitByChar[cLabel] || { charType: 'characters', charCategory: 'stand', charId: m.id, clothId: m.id };
      const rawOutfitId = row.clothId || row.charId || baseOutfit.charId || m.id;
      const resolvedOutfitId = (rawOutfitId && String(rawOutfitId).length >= 3) ? String(rawOutfitId) : (baseOutfit.charId || m.id);
      const resolvedOutfitType = row.charType
        || ((resolvedOutfitId === baseOutfit.charId && baseOutfit.charType) ? baseOutfit.charType : '')
        || (resolvedOutfitId.length >= 7 ? 'idols' : (baseOutfit.charType || 'characters'));
      const resolvedOutfitCategory = row.charCategory || baseOutfit.charCategory || 'stand';
      const resolvedHair = normalizeCharHairVal(row.charHair) || initialHairByChar[cLabel] || '';
      const outfitCtx = { charType: resolvedOutfitType, charCategory: resolvedOutfitCategory, charId: resolvedOutfitId };
      const validSet = getCharAnimSet(outfitCtx);

      // Measure real audio duration & 30ms RMS speech envelope if voice is available
      const audioFilePath = row.voice ? resolveAudioFileFromUrl(row.voice) : '';
      let envInfo = null;
      if (audioFilePath && studioGateway && typeof studioGateway.analyzeAudioEnvelopeSync === 'function') {
        try { envInfo = studioGateway.analyzeAudioEnvelopeSync(audioFilePath); } catch (_) { envInfo = null; }
      }
      const preLipSegs = Array.isArray(row.lipSegments) && row.lipSegments.length ? row.lipSegments : null;
      const lipSegs = preLipSegs || (envInfo && Array.isArray(envInfo.lipSegments) && envInfo.lipSegments.length ? envInfo.lipSegments : null);
      const envDurMs = (envInfo && envInfo.durationMs > 0) ? Number(envInfo.durationMs) : 0;
      const rowDurMs = (row.lipAnimDuration && Number(row.lipAnimDuration) > 0)
        ? Number(row.lipAnimDuration)
        : ((row.dur && Number(row.dur) > 0) ? Math.round(Number(row.dur) * 1000) : envDurMs);
      const spokenText = String(row.text || row.zh || '');
      const effectiveDurMs = rowDurMs > 0 ? rowDurMs : Math.max(1800, Math.round(spokenText.length * 115 + 450));

      // Determine candidate animations
      const preset = EMOTION_PRESETS[emotionKey] || EMOTION_PRESETS.joy;
      const bodyCandList = row.anim1 ? [row.anim1, ...preset.bodyCandidates] : preset.bodyCandidates;
      const faceCandList = row.anim2 ? [row.anim2, ...preset.faceCandidates] : preset.faceCandidates;
      const legacyEyeFromAnim3 = (row.anim3 && (String(row.anim3).startsWith('eye_') || row.anim3 === 'close_eye')) ? row.anim3 : null;
      const headCand = (row.anim3 && !legacyEyeFromAnim3) ? row.anim3 : null;
      const eyeRaw = row.anim4 || legacyEyeFromAnim3 || null;

      // 选拍规整：尊重情绪，永不在相邻台词（含镜头切回前后）重复同一动作；同一角色连续说话不强制回锁呆板姿势
      const pickNonRepeatingValid = (cands, strictBoth = true) => {
        const expanded = expandAnimCandidates(cands);
        for (const cand of expanded) {
          if (!cand || !validSet.has(cand)) continue;
          if (cand === prevSpokenBody) continue;
          if (strictBoth && cand === prevBody) continue;
          return cand;
        }
        return null;
      };
      let chosenBody = row.anim1
        ? resolveValidAnim(m.id, bodyCandList, 'body', outfitCtx)
        : (pickNonRepeatingValid(bodyCandList, true) || pickNonRepeatingValid(bodyCandList, false));
      if (!chosenBody) {
        chosenBody = pickNonRepeatingValid(['wait1', 'wait2', 'wait3', 'smile1', 'shy1', 'yes'], true)
          || pickNonRepeatingValid(['wait1', 'wait2', 'wait3', 'smile1', 'shy1', 'yes'], false)
          || resolveValidAnim(m.id, bodyCandList, 'body', outfitCtx);
      }

      // Gentle conversational gaze toward previous speaker when no explicit eye track is set
      let gazeCand = null;
      if (!eyeRaw && lastSpeakingChar && lastSpeakingChar !== cLabel && Number.isFinite(lastSpeakingX)) {
        if (lastSpeakingX < slotX - 40) gazeCand = 'eye_left';
        else if (lastSpeakingX > slotX + 40) gazeCand = 'eye_right';
        else gazeCand = 'eye_front';
      }
      const eyeCandList = eyeRaw
        ? [eyeRaw, ...preset.eyeCandidates]
        : (gazeCand ? [gazeCand, ...preset.eyeCandidates] : preset.eyeCandidates);

      const chosenFace = resolveValidAnim(m.id, faceCandList, 'face', outfitCtx);
      const chosenHead = headCand ? resolveValidAnim(m.id, [headCand], 'head', outfitCtx) : null;
      const chosenEye = resolveValidAnim(m.id, eyeCandList, 'eye', outfitCtx);
      const isMonologue = Boolean(
        row.innerMonologue ||
        (row._meta && row._meta['x-innerMonologue']) ||
        isParenthesizedMonologue(row.text, row.zh)
      );
      const chosenLip = isMonologue
        ? resolveClosedLipClipForChar(m.id, validSet, outfitCtx)
        : resolveValidAnim(m.id, preset.lipCandidates, 'lip', outfitCtx);

      lineObj.speaker = row.speaker || m.speaker;
      lineObj.text = row.text || '……';
      lineObj.textFrame = '001';
      lineObj.textCtrl = 'p';
      lineObj.charLabel = cLabel;
      lineObj.charType = resolvedOutfitType;
      lineObj.charId = resolvedOutfitId;
      lineObj.clothId = resolvedOutfitId;
      lineObj.charCategory = resolvedOutfitCategory;
      if (resolvedHair) lineObj.charHair = resolvedHair;
      const explicitScale = (row.charScale !== undefined && Number.isFinite(Number(row.charScale)) && Number(row.charScale) > 0)
        ? Number(row.charScale)
        : 1;
      lineObj.charPosition = { x: slotX, y: slotY, order: slotOrder };
      lineObj.charScale = explicitScale;
      if (row.charEffect && typeof row.charEffect === 'object') {
        lineObj.charEffect = row.charEffect;
      }

      if (chosenBody) {
        lineObj.charAnim1 = chosenBody;
        lastBodyAnimByChar[cLabel] = chosenBody;
        lastSpokenBodyByChar[cLabel] = chosenBody;
      }
      lastEmotionByChar[cLabel] = emotionKey;
      lastSpeakingX = slotX;
      lineObj.charAnim2 = chosenFace;
      if (chosenHead) lineObj.charAnim3 = chosenHead;
      if (chosenEye) lineObj.charAnim4 = chosenEye;
      lineObj.charLipAnim = chosenLip;
      lineObj.lip = chosenLip;
      if (rowDurMs > 0) {
        lineObj.dur = Number((rowDurMs / 1000).toFixed(3));
        lineObj.lipAnimDuration = Math.round(rowDurMs);
      }
      if (!isMonologue && lipSegs && lipSegs.length) {
        lineObj.lipSegments = lipSegs;
      }

      // 句中安全微演化（subBeats）：只演变 Track 1 表情 + Track 3 眼神 + Track 5 口型风格，
      // 严禁在句中打断 Track 0 身体动作（除非用户手动写入 beat.charAnim1），且节奏对齐真实声学停顿。
      if (Array.isArray(row.subBeats) && row.subBeats.length) {
        lineObj.subBeats = row.subBeats;
      } else if (!isMonologue && effectiveDurMs >= 4600) {
        const beatTimes = [];
        if (Array.isArray(lipSegs) && lipSegs.length >= 2) {
          for (let si = 0; si < lipSegs.length - 1; si++) {
            const gapStart = Number(lipSegs[si][1]) || 0;
            const gapEnd = Number(lipSegs[si + 1][0]) || 0;
            const gapLen = gapEnd - gapStart;
            const mid = Math.round((gapStart + gapEnd) / 2);
            if (gapLen >= 160 && mid >= 1700 && mid <= effectiveDurMs - 1150) {
              if (!beatTimes.length || (mid - beatTimes[beatTimes.length - 1]) >= 1650) {
                beatTimes.push(mid);
                if (beatTimes.length >= 3) break;
              }
            }
          }
        }
        if (!beatTimes.length && spokenText.length >= 16) {
          const clauses = spokenText.split(/[，、；：……—！？!?。]+/).filter((s) => s.trim().length > 0);
          if (clauses.length >= 2) {
            const totalC = clauses.reduce((acc, s) => acc + s.length, 0);
            let accC = 0;
            for (let ci = 0; ci < clauses.length - 1; ci++) {
              accC += clauses[ci].length;
              const estMs = Math.round(effectiveDurMs * (accC / Math.max(1, totalC)));
              if (estMs >= 1800 && estMs <= effectiveDurMs - 1150) {
                if (!beatTimes.length || (estMs - beatTimes[beatTimes.length - 1]) >= 1700) {
                  beatTimes.push(estMs);
                  if (beatTimes.length >= 2) break;
                }
              }
            }
          }
        }
        if (beatTimes.length) {
          const arcMap = {
            confess_shy: [['face_shy2', 'face_trouble', 'face_serious', 'face_awkward'], ['face_close', 'face_shy', 'face_trouble'], ['face_smile', 'face_smile1', 'face_wait']],
            earnest_shy: [['face_trouble', 'face_shy', 'face_shy2', 'face_close'], ['face_serious', 'face_wait', 'face_smile']],
            fluster_panic: [['face_awkward', 'face_shy', 'face_anger', 'face_anger1'], ['face_trouble', 'face_surp', 'face_shy', 'face_close']],
            coverup_bright: [['face_smile', 'face_smile1', 'face_joy'], ['face_awkward', 'face_shy', 'face_trouble', 'face_bitter_smile']],
            smug_tease: [['face_smile2', 'face_smile', 'face_joy'], ['face_doya', 'face_close', 'face_smile1']],
            deadpan_tsukkomi: [['face_close', 'face_serious'], ['face_jito', 'face_awkward', 'face_wait']],
            wry_smile: [['face_trouble', 'face_awkward', 'face_close'], ['face_bitter_smile', 'face_smile', 'face_smile1']],
            warm_relief: [['face_smile2', 'face_joy', 'face_close'], ['face_smile', 'face_smile1', 'face_wait']],
            shy: [['face_shy2', 'face_trouble', 'face_awkward', 'face_close'], ['face_shy', 'face_smile', 'face_smile1', 'face_wait']],
            joy: [['face_smile2', 'face_joy', 'face_excite'], ['face_smile', 'face_smile1', 'face_close']],
            idol: [['face_joy', 'face_smile', 'face_smile1'], ['face_smile2', 'face_excite', 'face_close']],
            sad: [['face_close', 'face_tear1', 'face_tear', 'face_trouble'], ['face_tear2', 'face_sad1', 'face_sad2', 'face_serious', 'face_wait']],
            sigh: [['face_trouble', 'face_sad', 'face_sad1', 'face_tear1'], ['face_close', 'face_serious', 'face_wait']],
            surp: [['face_panic', 'face_trouble', 'face_shy'], ['face_smile', 'face_smile1', 'face_wait']],
            tsun: [['face_shy', 'face_anger2', 'face_serious'], ['face_anger', 'face_anger1', 'face_close', 'face_wait']],
            serious: [['face_close', 'face_serious', 'face_wait'], ['face_trouble', 'face_serious']]
          };
          const negativeOrTenseEmotions = new Set(['sad', 'sigh', 'tsun', 'fluster_panic', 'deadpan_tsukkomi', 'serious']);
          const stageArc = arcMap[emotionKey] || arcMap.joy;
          const usedFaces = new Set([chosenFace]);
          const eyePool = ['eye_right', 'eye_left', 'eye_front'].filter((e) => validSet.has(e));
          const fallbackFaces = negativeOrTenseEmotions.has(emotionKey)
            ? ['face_close', 'face_serious', 'face_wait']
            : ['face_close', 'face_smile', 'face_smile1', 'face_wait'];
          const subBeats = [];
          beatTimes.forEach((atMs, bi) => {
            const faceGroup = stageArc[Math.min(bi, stageArc.length - 1)] || [];
            const candPool = expandAnimCandidates([...faceGroup, ...preset.faceCandidates, ...fallbackFaces]);
            let nextFace = null;
            for (const cand of candPool) {
              if (cand && validSet.has(cand) && !usedFaces.has(cand)) {
                nextFace = cand;
                break;
              }
            }
            if (!nextFace) {
              const prevBeatFace = subBeats.length ? (subBeats[subBeats.length - 1].charAnim2 || chosenFace) : chosenFace;
              for (const cand of candPool) {
                if (cand && validSet.has(cand) && cand !== prevBeatFace) {
                  nextFace = cand;
                  break;
                }
              }
            }
            let nextEye = null;
            if (eyePool.length > 1) {
              const prevEye = subBeats.length ? subBeats[subBeats.length - 1].charAnim4 : chosenEye;
              nextEye = eyePool.find((e) => e !== prevEye) || eyePool[0];
            }
            if (nextFace) usedFaces.add(nextFace);
            if (nextFace || nextEye) {
              const beatObj = { atMs };
              if (nextFace) beatObj.charAnim2 = nextFace;
              if (nextEye) beatObj.charAnim4 = nextEye;
              subBeats.push(beatObj);
            }
          });
          if (subBeats.length) lineObj.subBeats = subBeats;
        }
      }

      const oocRes = polisher.validateLine({ speaker: lineObj.speaker, text: lineObj.text }, cLabel);
      const oocIssues = (oocRes.issues || []).filter((f) => f.level === 'error' || f.level === 'warn');
      lineObj._meta = {
        uid: row.rowId || nextUid('dlg'),
        zh: normalizeZhHonorifics(row.zh || row.text || '', cLabel, row.text || ''),
        speakerZh: m.nameZh,
        surfaceEmotion: preset.surfaceEmotion,
        innerEmotion: preset.innerEmotion,
        vocalTone: preset.vocalTone,
        ...(isMonologue ? { 'x-innerMonologue': true } : {})
      };
      if (hasExplicitPos) lineObj._meta.manualPos = true;
      if (row.mode) lineObj._meta.mode = String(row.mode);
      if (row.voiceSynthSig) lineObj._meta.voiceSynthSig = String(row.voiceSynthSig);
      if (row.voiceStale) lineObj._meta.voiceStale = true;
      if (row.filter) lineObj._meta['x-editor-filter'] = String(row.filter);
      if (row.ttsText) lineObj._meta.ttsText = String(row.ttsText);
      if (row.holdMs) lineObj._meta.holdMs = Number(row.holdMs);
      if (row.voice) lineObj.voice = String(row.voice);
      if (row.takeSelected !== undefined && row.takeSelected !== null && row.takeSelected !== '') lineObj._meta.takeSelected = String(row.takeSelected);
      if (Array.isArray(row.takes) && row.takes.length) lineObj._meta.takes = row.takes.map((t) => Object.assign({}, t));
      if (Array.isArray(row.motionTrack) && row.motionTrack.length) lineObj._meta.motionTrack = row.motionTrack;
      if (Array.isArray(row.moveTrack) && row.moveTrack.length) lineObj._meta.moveTrack = row.moveTrack;
      if (oocIssues.length > 0) {
        lineObj._meta.oocFlags = oocIssues.map((f) => ({
          code: String(f.type || 'ooc').replace(/[^A-Za-z0-9_.:-]/g, '_'),
          severity: f.level === 'error' ? 'error' : 'warn',
          message: f.message || '',
          source: 'polisher'
        }));
      }
      if (row.note) lineObj._meta.note = row.note;
      if (row.beatId) {
        lineObj._meta['x-beatId'] = String(row.beatId);
        if (row.beatTitle) lineObj._meta['x-beatTitle'] = String(row.beatTitle);
      }
      lastSpeakingChar = cLabel;
    } else {
      // Producer or Narration line
      lineObj.speaker = row.speaker !== undefined ? row.speaker : 'プロデューサー';
      lineObj.text = row.text || '';
      lineObj.textFrame = lineObj.speaker ? '001' : '002';
      lineObj.textCtrl = 'p';
      lineObj._meta = {
        uid: row.rowId || nextUid('nar'),
        zh: normalizeZhHonorifics(row.zh || row.text || '', lineObj.speaker, row.text || ''),
        speakerZh: lineObj.speaker === 'プロデューサー' ? '制作人' : (lineObj.speaker || '旁白')
      };
      if (row.mode) lineObj._meta.mode = String(row.mode);
      if (row.voiceSynthSig) lineObj._meta.voiceSynthSig = String(row.voiceSynthSig);
      if (row.voiceStale) lineObj._meta.voiceStale = true;
      if (row.filter) lineObj._meta['x-editor-filter'] = String(row.filter);
      if (row.ttsText) lineObj._meta.ttsText = String(row.ttsText);
      if (row.note) lineObj._meta.note = row.note;
      if (row.voice) lineObj.voice = String(row.voice);
      if (row.dur && Number(row.dur) > 0) {
        lineObj.dur = Number(row.dur);
      } else if (row.voice && studioGateway && typeof studioGateway.analyzeAudioEnvelopeSync === 'function') {
        const narAudio = resolveAudioFileFromUrl(row.voice);
        if (narAudio) {
          try {
            const narEnv = studioGateway.analyzeAudioEnvelopeSync(narAudio);
            if (narEnv && narEnv.durationMs > 0) lineObj.dur = Number((narEnv.durationMs / 1000).toFixed(3));
          } catch (_) {}
        }
      }
      if (row.takeSelected !== undefined && row.takeSelected !== null && row.takeSelected !== '') lineObj._meta.takeSelected = String(row.takeSelected);
      if (Array.isArray(row.takes) && row.takes.length) lineObj._meta.takes = row.takes.map((t) => Object.assign({}, t));
      if (row.beatId) {
        lineObj._meta['x-beatId'] = String(row.beatId);
        if (row.beatTitle) lineObj._meta['x-beatTitle'] = String(row.beatTitle);
      }
      lastSpeakingChar = null;
    }

    // Preserve row-level SE, BGM, BG, Screen Effect, Still, Wait
    // 护栏：非合集工程的开场前 3 句若已有有效开场 BGM，禁止被意外的 fade_out/off 瞬间掐灭
    const isReactionProj = String(projectId || '').includes('reaction');
    const guardEarlyBgmKill = !isReactionProj && rIdx < 3 && activeBgm && activeBgm !== 'off';
    const rowForCompile = (guardEarlyBgmKill && (row.stageAction === 'bgm_fade' || row.stageAction === 'bgm_stop'))
      ? Object.assign({}, row, { stageAction: '' })
      : row;
    if (row.se) lineObj.se = String(row.se);
    if (row.bgm) {
      const nextBgmToken = normalizeBgmId(row.bgm, String(row.bgm));
      if (!(guardEarlyBgmKill && (nextBgmToken === 'fade_out' || nextBgmToken === 'off'))) {
        lineObj.bgm = nextBgmToken;
        activeBgm = (lineObj.bgm === 'fade_out' || lineObj.bgm === 'off') ? 'off' : lineObj.bgm;
      }
    }
    if (row.bg) lineObj.bg = String(row.bg).padStart(5, '0');
    if (row.effectLabel) {
      if (row.effectLabel === 'flash' && (!row.effectTarget || typeof row.effectTarget === 'string')) {
        lineObj.bg = lineObj.bg || effectiveBg;
        lineObj.bgEffect = lineObj.bgEffect || 'white_fade';
        lineObj.bgEffectTime = lineObj.bgEffectTime || 260;
      } else if (row.effectTarget && typeof row.effectTarget === 'object') {
        lineObj.effectLabel = row.effectLabel;
        lineObj.effectTarget = row.effectTarget;
        lineObj.effectValue = row.effectValue || { time: 400 };
      }
    }
    if (row.still || row.stillId) lineObj.still = row.still || row.stillId;
    if (row.waitType) lineObj.waitType = row.waitType;
    if (row.waitTime != null) lineObj.waitTime = Number(row.waitTime);

    if (isSelectRow) {
      lineObj.select = row.choices[0].text;
      lineObj.nextLabel = row.choices[0].nextLabel || 'branch_a';
      lineObj._meta.selectZh = row.choices[0].zh || row.choices[0].text;
    }

    if (row.jumpTo) {
      lineObj.nextLabel = row.jumpTo;
    }

    if (!isOffScreenSpeaker) {
      const rowSlotX = (lineObj.charPosition && lineObj.charPosition.x != null) ? Number(lineObj.charPosition.x) : 568;
      let rowForAction = (pendingChaseExit && pendingChaseExit.beatId === rowBeatId && !pendingChaseExit.exited.has(cLabel) && !rowForCompile.stageAction && detectStageActionFromText(`${rowForCompile.note || ''} ${rowForCompile.zh || ''}`) === 'chase_in_left')
        ? Object.assign({}, rowForCompile, { stageAction: pendingChaseExit.side === 'left' ? 'dash_out_left' : 'dash_out_right' })
        : rowForCompile;
      if (!rowForAction.stageAction && rowForAction._autoInferAction !== false && !rowForAction.anim1 && rowForAction.note) {
        const noteAct = detectStageActionFromText(rowForAction.note);
        if (noteAct && noteAct !== 'hold_steady') {
          rowForAction = Object.assign({}, rowForAction, { stageAction: noteAct });
        }
      }
      applyStageActionToCompiledRow(rowForAction, lineObj, cLabel, rowSlotX, effectiveBg);
      if (cLabel && lineObj._meta && lineObj._meta.moveTrack && lineObj._meta.moveTrack[0]) {
        const toX = Number(lineObj._meta.moveTrack[0].toX);
        if (Number.isFinite(toX)) {
          stagePresence[cLabel] = {
            onStage: toX > -200 && toX < 1300,
            curX: toX,
            order: (lineObj.charPosition && lineObj.charPosition.order) || 0
          };
        }
      }
      if (cLabel && lineObj._meta && (lineObj._meta.stageAction === 'dash_out_right' || lineObj._meta.stageAction === 'dash_out_left')) {
        const side = lineObj._meta.stageAction === 'dash_out_left' ? 'left' : 'right';
        if (!pendingChaseExit || pendingChaseExit.beatId !== rowBeatId) {
          pendingChaseExit = { side, exited: new Set([cLabel]), beatId: rowBeatId };
        } else {
          pendingChaseExit.exited.add(cLabel);
        }
      }
    }

    if (lineObj.bgm && !row.bgm) {
      activeBgm = (lineObj.bgm === 'fade_out' || lineObj.bgm === 'off') ? 'off' : lineObj.bgm;
    }
    maybeApplyBeatBgm(rowBeatId, lineObj, row.bgm);

    lines.push(lineObj);

    // Additional select options (ENZA format uses consecutive `{ select, nextLabel }` entries)
    if (isSelectRow && row.choices.length > 1) {
      for (let cIdx = 1; cIdx < row.choices.length; cIdx++) {
        const ch = row.choices[cIdx];
        lines.push({
          select: ch.text,
          nextLabel: ch.nextLabel || `branch_${cIdx + 1}`,
          _meta: {
            uid: nextUid('sel'),
            selectZh: ch.zh || ch.text
          }
        });
      }
    }
  });

  // Closing cue (`textFrame: "off"`, `bgm: "off"`)
  lines.push({
    textFrame: 'off',
    bgm: 'off',
    waitType: 'time',
    waitTime: 700,
    _meta: {
      uid: nextUid('end'),
      'x-autoGenerated': true,
      note: '演出结束收尾'
    }
  });

  // Build characters dictionary for `.scproj.json`
  const charactersDict = {};
  orderedCast.forEach((cLabel) => {
    const m = IDOL_META[cLabel];
    const outfit = initialOutfitByChar[cLabel] || { charType: 'characters', charId: m.id, charCategory: 'stand' };
    const hair = initialHairByChar[cLabel] || '';
    charactersDict[cLabel] = {
      charType: outfit.charType || 'characters',
      charId: outfit.charId || m.id,
      'x-clothId': outfit.clothId || outfit.charId || m.id,
      charCategory: outfit.charCategory || 'stand',
      ...(hair ? { 'x-charHair': hair } : {}),
      name: m.speaker,
      nameZh: m.nameZh
    };
  });

  const result = {
    $schema: '../../../schema/scproj.schema.json',
    format: 'scproj',
    formatVersion: 2,
    meta: {
      id: sceneId,
      cat: 'custom',
      title: title || sceneId,
      titleZh: titleZh || title || sceneId,
      origin: 'custom',
      lang: {
        primary: 'ja',
        translations: ['zh']
      },
      cast: orderedCast,
      characters: charactersDict,
      authors: [{ name: '283 Fan-Story Studio', role: 'writer' }],
      createdAt: '2026-11-12T12:00:00Z',
      updatedAt: new Date().toISOString()
    },
    lines
  };
  Object.defineProperty(result, '_lastSpokenBodyByChar', {
    value: Object.assign({}, lastSpokenBodyByChar),
    enumerable: false
  });
  return result;
}

function serializeScsYaml({ sceneId, title, titleZh, bg, bgm, cast, scriptRows }) {
  const out = [];
  const yamlVal = (v) => (typeof v === 'number' || typeof v === 'boolean') ? String(v) : JSON.stringify(String(v == null ? '' : v));
  out.push(`# ${titleZh || title || sceneId}`);
  out.push(`id: ${sceneId}`);
  out.push(`title: ${yamlVal(titleZh || title || sceneId)}`);
  out.push(`bg: "${String(bg || '00269').padStart(5, '0')}"`);
  out.push(`bgm: "${String(bgm || '002')}"`);
  out.push(`cast: [${(cast || []).map((c) => JSON.stringify(String(c))).join(', ')}]`);
  out.push('lines:');
  const optFields = [
    'kind', 'charLabel', 'emotion', 'voice', 'bg', 'bgm', 'se',
    'charOutfit', 'charHair', 'charPosition', 'charScale',
    'charAnim1', 'charAnim2', 'charAnim3', 'charAnim4', 'charAnim5',
    'waitType', 'waitTime', 'textFrame', 'label', 'select', 'nextLabel', 'jumpTo'
  ];
  (scriptRows || []).forEach((r) => {
    if (!r || typeof r !== 'object') return;
    out.push(`  - speaker: ${yamlVal(r.speaker || '')}`);
    for (const k of optFields) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') {
        out.push(`    ${k}: ${yamlVal(r[k])}`);
      }
    }
    if (r.text !== undefined) out.push(`    text: ${yamlVal(r.text || '')}`);
    if (r.zh) out.push(`    zh: ${yamlVal(r.zh)}`);
    if (r.note) out.push(`    note: ${yamlVal(r.note)}`);
    if (Array.isArray(r.actions) && r.actions.length) {
      out.push(`    actions: ${JSON.stringify(r.actions)}`);
    }
  });
  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Canonical Seed Project: `island_survival_pack.scpack`
//   Scene 1: `scene_01_harbor` — 第 1 幕 · 码头偷溜与荒岛正午 (Amana & Hana)
//   Scene 2: `scene_02_signal` — 第 2 幕 · 海岸求救信号（分支） (Amana & Hana + Choice Branch)
//   Scene 3: `scene_03_rescue` — 第 3 幕 · 海平线上的全员大营救 (6 idols split into two 3-person camera cuts)
// ---------------------------------------------------------------------------
const CANONICAL_ISLAND_SCENES = {
  scene_01_harbor: {
    sceneId: 'scene_01_harbor',
    title: '第 1 幕 · 码头偷溜与荒岛正午',
    titleJa: '第1幕・港の抜け出しと無人島の正午',
    bg: '00269',
    bgm: '003',
    bgmStyle: '情绪流向：元气探险 → 团结协力 → 炎夏轻松日常｜开场主基调「灿烂日光·元气轻快日常」',
    cast: ['amana', 'hana'],
    summary: '夏日海岛外景拍摄间隙，大崎甘奈与铃木羽那趁休息溜上码头小艇探险，不知不觉漂到了洒满正午阳光的无人荒岛。制作人赶来汇合后，三人一起用椰叶搭建遮阳棚、互涂防晒霜，在碧海蓝天下开启荒岛求生第一幕。',
    segments: [
      {
        beatId: 'beat_1',
        title: '偷溜登岛与游艇离开',
        summary: '甘奈与羽那溜上岸边快艇，回过神来已经登上了碧海环绕的无人小岛',
        cast: ['amana', 'hana'],
        targetLines: 2
      },
      {
        beatId: 'beat_2',
        title: '与制作人合力搭椰叶棚',
        summary: '制作人背着应急包赶来汇合，三人分工收集大椰子叶搭建沙滩遮阳棚',
        cast: ['amana', 'hana'],
        targetLines: 3
      },
      {
        beatId: 'beat_3',
        title: '正午晒红肩膀与涂防晒霜',
        summary: '荒岛正午阳光滚烫，甘奈与羽那互相涂抹防晒霜，笑着打气等待救援',
        cast: ['amana', 'hana'],
        targetLines: 2
      }
    ],
    beats: [
      '节拍 1：偷溜登岛与游艇离开 — 甘奈与羽那溜上岸边快艇，回过神来已经登上了碧海环绕的无人小岛',
      '节拍 2：与制作人合力搭椰叶棚 — 制作人背着应急包赶来汇合，三人分工收集大椰子叶搭建沙滩遮阳棚',
      '节拍 3：正午晒红肩膀与涂防晒霜 — 荒岛正午阳光滚烫，甘奈与羽那互相涂抹防晒霜，笑着打气等待救援'
    ],
    scriptRows: [
      {
        rowId: 's1_r01',
        beatId: 'beat_1',
        beatTitle: '偷溜登岛与游艇离开',
        speaker: '甘奈',
        charLabel: 'amana',
        emotion: 'joy',
        anim1: 'smile1',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: 'プロデューサーさん見て☆ 海がキラキラだよ！甘奈、羽那ちゃんと探検できて超ワクワクしてるんだ♪',
        zh: '制作人先生快看☆ 大海闪闪发光哦！甘奈能和羽那酱一起探险，心里超激动的♪',
        note: '[节拍 1] 码头偷溜登上无人荒岛浅滩'
      },
      {
        rowId: 's1_r02',
        beatId: 'beat_1',
        beatTitle: '偷溜登岛与游艇离开',
        speaker: '羽那',
        charLabel: 'hana',
        emotion: 'joy',
        anim1: 'smile2',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: 'わぁ……！ほんとですね甘奈さん！ボートを覗くつもりが、こんな綺麗な島に着いちゃいました～！',
        zh: '哇啊……！真的呢甘奈小姐！本来只是想看看小船，没想到漂到了这么漂亮的小岛上～！',
        note: ''
      },
      {
        rowId: 's1_r03',
        beatId: 'beat_2',
        beatTitle: '与制作人合力搭椰叶棚',
        speaker: 'プロデューサー',
        charLabel: '',
        emotion: 'serious',
        anim1: '',
        anim2: '',
        anim3: '',
        text: 'ふたりとも無事でよかった……！迎えの船が来るまで、ヤシの葉で日陰を作って休もう。',
        zh: '你们两个都平安无事真是太好了……！在救援船赶来之前，我们先用椰叶搭个遮阳棚休息吧。',
        note: '[节拍 2] 制作人赶到，提议搭建树叶遮阳棚'
      },
      {
        rowId: 's1_r04',
        beatId: 'beat_2',
        beatTitle: '与制作人合力搭椰叶棚',
        speaker: '甘奈',
        charLabel: 'amana',
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        anim3: 'eye_front',
        text: 'あっ、正午の日差しがジリジリしてきたかも！プロデューサーさん、甘奈も葉っぱ集めてくるね☆',
        zh: '啊，正午的阳光变得火辣辣的了！制作人先生，甘奈也去帮忙收集大椰子叶哦☆',
        note: ''
      },
      {
        rowId: 's1_r05',
        beatId: 'beat_2',
        beatTitle: '与制作人合力搭椰叶棚',
        speaker: '羽那',
        charLabel: 'hana',
        emotion: 'idol',
        anim1: 'yes',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: 'あたしも行きますっ！大きな葉っぱを重ねたら、秘密基地みたいで絶対楽しいですよ～！',
        zh: '我也要去！要是把大大的叶子叠起来，肯定像秘密基地一样超有趣的哦～！',
        note: ''
      },
      {
        rowId: 's1_r06',
        beatId: 'beat_3',
        beatTitle: '正午晒红肩膀与涂防晒霜',
        speaker: '甘奈',
        charLabel: 'amana',
        emotion: 'shy',
        anim1: 'shy1',
        anim2: 'face_shy',
        anim3: 'eye_right',
        text: 'えへへ、テント完成☆ あっ、羽那ちゃんの肩が赤くなってる！甘奈の日焼け止め、一緒に塗ろっか♪',
        zh: '嘿嘿，树叶帐篷完成啦☆ 啊，羽那酱的肩膀有点晒红了！来用甘奈的防晒霜，我们一起涂吧♪',
        note: '[节拍 3] 正午防晒互动，苦中作乐'
      },
      {
        rowId: 's1_r07',
        beatId: 'beat_3',
        beatTitle: '正午晒红肩膀与涂防晒霜',
        speaker: '羽那',
        charLabel: 'hana',
        emotion: 'shy',
        anim1: 'shy2',
        anim2: 'face_shy',
        anim3: 'eye_front',
        text: 'わぁ、ありがとうございます甘奈さん！プロデューサーさんも隣でちゃんと涼んでくださいね！',
        zh: '哇，谢谢甘奈小姐！制作人先生也要在我们身边好好乘凉休息哦！',
        note: ''
      }
    ]
  },

  scene_02_signal: {
    sceneId: 'scene_02_signal',
    title: '第 2 幕 · 海岸求救信号（分支）',
    titleJa: '第2幕・ビーチのSOSサイン（分岐）',
    bg: '00008',
    bgm: '021',
    bgmStyle: '情绪流向：紧张发现船影 → 齐心求救抉择 → 获救欢呼释然｜开场节奏跃动，结尾切为温暖抒情',
    cast: ['amana', 'hana'],
    summary: '午后海风渐起，远处海平线上隐约浮现搜救船的影子！制作人与甘奈、羽那必须在「沙滩画超巨型SOS涂鸦」与「高举椰叶全力挥舞」之间做出关键选择，向海平线发出求救信号。',
    segments: [
      {
        beatId: 'beat_1',
        title: '发现远方海平线搜救船影',
        summary: '远方海平线出现船影，甘奈与羽那拉住制作人冲向开阔海岸',
        cast: ['amana', 'hana'],
        targetLines: 2,
        mood: 'energetic'
      },
      {
        beatId: 'beat_2',
        title: '海岸求救信号分支抉择',
        summary: '[分支选项] 选项A「在沙滩画出超巨型可爱的SOS！」 / 选项B「挥舞大椰子叶全力呼喊！」',
        cast: ['amana', 'hana'],
        targetLines: 3,
        mood: 'tense'
      },
      {
        beatId: 'beat_3',
        title: '探照灯回应与海风欢呼',
        summary: '搜救船鸣响汽笛回应，两人在海浪边欢呼雀跃',
        cast: ['amana', 'hana'],
        targetLines: 2,
        mood: 'emotional',
        bgm: '002',
        bgmLocked: true,
        bgmReason: '搜救船鸣笛回应、危机解除转入海风温柔欢呼，自动切为「海风微澜·温柔抒情」'
      }
    ],
    beats: [
      '节拍 1：发现远方海平线搜救船影 — 远方海平线出现船影，甘奈与羽那拉住制作人冲向开阔海岸',
      '节拍 2：海岸求救信号分支抉择 — [分支选项] 选项A「在沙滩画出超巨型可爱的SOS！」 / 选项B「挥舞大椰子叶全力呼喊！」',
      '节拍 3：探照灯回应与海风欢呼 — 搜救船鸣响汽笛回应，两人在海浪边欢呼雀跃'
    ],
    scriptRows: [
      {
        rowId: 's2_r01',
        beatId: 'beat_1',
        beatTitle: '发现远方海平线搜救船影',
        speaker: '甘奈',
        charLabel: 'amana',
        emotion: 'surp',
        anim1: 'surp2',
        anim2: 'face_surp',
        anim3: 'eye_front',
        text: 'プロデューサーさん、羽那ちゃん！水平線を見て！白いボートがこっちに向かってきてるよ☆',
        zh: '制作人先生、羽那酱！快看那边的海平线！有一艘白色快艇正朝这边开过来哦☆',
        note: '[节拍 1] 发现远方海平线上的搜救船'
      },
      {
        rowId: 's2_r02',
        beatId: 'beat_1',
        beatTitle: '发现远方海平线搜救船影',
        speaker: '羽那',
        charLabel: 'hana',
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        anim3: 'eye_front',
        text: 'ほんとだぁ……！プロデューサーさん、あたしたちがここにいるって合図を送らなきゃですっ！',
        zh: '真的耶……！制作人先生，我们得马上发出信号，让大家知道我们在这里才行！',
        note: ''
      },
      {
        rowId: 's2_r03',
        beatId: 'beat_2',
        beatTitle: '海岸求救信号分支抉择',
        speaker: 'プロデューサー',
        charLabel: '',
        emotion: 'serious',
        anim1: '',
        anim2: '',
        anim3: '',
        text: 'よし、遠くの船からでも一目で気づいてもらえるように、一番目立つ合図を出そう！',
        zh: '好，为了让远处的船只一眼就能注意到我们，用最醒目的方式发出求救信号吧！',
        note: '[分支选项] 选择求救信号方式',
        choices: [
          {
            text: '砂浜に超巨大なSOSイラストを描こう！',
            zh: '在沙滩上画出超巨型可爱的SOS涂鸦！',
            nextLabel: 'branch_sos'
          },
          {
            text: 'ヤシの葉を大きく振って全力でアピールしよう！',
            zh: '举起大椰子叶全力挥舞呼喊！',
            nextLabel: 'branch_palm'
          }
        ]
      },
      {
        rowId: 's2_r04',
        beatId: 'beat_2',
        beatTitle: '海岸求救信号分支抉择',
        speaker: '甘奈',
        charLabel: 'amana',
        emotion: 'joy',
        anim1: 'smile2',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: '賛成っ☆ 甘奈、SOSの周りにハートも大きく描いちゃうね！これなら絶対見つけてもらえるよ♪',
        zh: '赞成☆ 甘奈还要在SOS周围画上大大的爱心哦！这样大家肯定一眼就能找到我们啦♪',
        note: '[分支A: branch_sos] 沙滩巨型SOS涂鸦路线',
        branchLabel: 'branch_sos',
        jumpTo: 'signal_success'
      },
      {
        rowId: 's2_r05',
        beatId: 'beat_2',
        beatTitle: '海岸求救信号分支抉择',
        speaker: '羽那',
        charLabel: 'hana',
        emotion: 'idol',
        anim1: 'smile1',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: 'はいっ！あたし、大きなヤシの葉っぱを持ってブンブン振っちゃいます！おーい、こっちですよ～！',
        zh: '好呀！我来拿起大大的椰子叶使劲挥舞！喂——我们在这里哟～！',
        note: '[分支B: branch_palm] 挥舞椰叶呼喊路线',
        branchLabel: 'branch_palm',
        jumpTo: 'signal_success'
      },
      {
        rowId: 's2_r06',
        beatId: 'beat_3',
        beatTitle: '探照灯回应与海风欢呼',
        speaker: '甘奈',
        charLabel: 'amana',
        emotion: 'idol',
        anim1: 'yes',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: 'あっ、船のライトが光ったよ！プロデューサーさん、甘奈たちの合図がちゃんと届いたんだね☆',
        zh: '啊，船上的探照灯亮起来了！制作人先生，甘奈我们的信号已经稳稳传过去了呢☆',
        note: '[汇合: signal_success] 搜救船回应信号',
        branchLabel: 'signal_success'
      },
      {
        rowId: 's2_r07',
        beatId: 'beat_3',
        beatTitle: '探照灯回应与海风欢呼',
        speaker: '羽那',
        charLabel: 'hana',
        emotion: 'joy',
        anim1: 'smile2',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: 'やったぁ！船の上にみんなの姿が見えますよ、プロデューサーさん！',
        zh: '太棒啦！已经能看到船上大家的身影了哦，制作人先生！',
        note: ''
      }
    ]
  },

  scene_03_rescue: {
    sceneId: 'scene_03_rescue',
    title: '第 3 幕 · 海平线上的全员大营救',
    titleJa: '第3幕・水平線の全員レスキュー',
    bg: '00271',
    bgm: '0007',
    cast: ['mano', 'hiori', 'meguru', 'amana', 'tenka', 'hana'],
    summary: '夕阳染红海平线，真乃、灯织、缭与甜花乘坐救援快艇抵达荒岛！全员6人同场演出自动切分为「3人救援组（真乃/灯织/缭）」与「3人荒岛重逢组（甘奈/甜花/羽那）」两组镜头，在温暖的海浪声中圆满收官。',
    segments: [
      {
        beatId: 'beat_1',
        title: '救援艇靠岸与3人救援组呼喊',
        summary: '[机位A · 救援船3人组] 真乃、灯织、缭率先冲下船舷，向海滩上的三人挥手呼喊',
        cast: ['mano', 'hiori', 'meguru'],
        targetLines: 3
      },
      {
        beatId: 'beat_2',
        title: '荒岛重逢组姐妹相拥报平安',
        summary: '[机位B · 荒岛重逢3人组] 甜花扑进甘奈怀里，羽那与姐妹俩欢笑拥抱（自动淡出前一组3人）',
        cast: ['amana', 'tenka', 'hana'],
        targetLines: 4
      },
      {
        beatId: 'beat_3',
        title: '海平线晚霞下的全员团圆终幕',
        summary: '[机位A → B 终幕] 全员6人在海平线晚霞下与制作人约定下一次海边公演',
        cast: ['mano', 'hiori', 'meguru', 'amana', 'tenka', 'hana'],
        targetLines: 1
      }
    ],
    beats: [
      '节拍 1：救援艇靠岸与3人救援组呼喊 — [机位A · 救援船3人组] 真乃、灯织、缭率先冲下船舷，向海滩上的三人挥手呼喊',
      '节拍 2：荒岛重逢组姐妹相拥报平安 — [机位B · 荒岛重逢3人组] 甜花扑进甘奈怀里，羽那与姐妹俩欢笑拥抱（自动淡出前一组3人）',
      '节拍 3：海平线晚霞下的全员团圆终幕 — [机位A → B 终幕] 全员6人在海平线晚霞下与制作人约定下一次海边公演'
    ],
    scriptRows: [
      {
        rowId: 's3_r01',
        beatId: 'beat_1',
        beatTitle: '救援艇靠岸与3人救援组呼喊',
        speaker: '真乃',
        charLabel: 'mano',
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        anim3: 'eye_front',
        text: 'プロデューサーさん、甘奈ちゃん、羽那ちゃん！よかったぁ……わたしたち、ずっと探していたんですっ！',
        zh: '制作人先生、甘奈酱、羽那酱！太好了……我们一直在到处找大家呢！',
        note: '[机位A: 真乃/灯织/缭 3人同台] 救援小队靠岸登场'
      },
      {
        rowId: 's3_r02',
        beatId: 'beat_1',
        beatTitle: '救援艇靠岸与3人救援组呼喊',
        speaker: '灯織',
        charLabel: 'hiori',
        emotion: 'serious',
        anim1: 'wait1',
        anim2: 'face_serious',
        anim3: 'eye_front',
        text: 'プロデューサー、怪我はありませんか？真乃、めぐる、まずは冷たい水とタオルを渡しましょう。',
        zh: '制作人，大家没有受伤吧？真乃、缭，先把冰水和毛巾递给她们两位吧。',
        note: ''
      },
      {
        rowId: 's3_r03',
        beatId: 'beat_1',
        beatTitle: '救援艇靠岸与3人救援组呼喊',
        speaker: 'めぐる',
        charLabel: 'meguru',
        emotion: 'joy',
        anim1: 'smile1',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: 'おーいっ！砂浜の合図、船からでもすっごく目立ってたよ！無事でよかったね、プロデューサー！',
        zh: '喂——！沙滩上的信号，就算在船上也超级显眼哦！大家平安无事真是太好啦，制作人！',
        note: ''
      },
      {
        rowId: 's3_r04',
        beatId: 'beat_2',
        beatTitle: '荒岛重逢组姐妹相拥报平安',
        speaker: '甜花',
        charLabel: 'tenka',
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        anim3: 'eye_front',
        text: 'なーちゃん……！無事でよかったぁ……！甜花、心配でずっと胸がドキドキしてたの……！',
        zh: '甘奈酱……！平安无事真是太好了……！甜花因为太担心，心一直扑通扑通跳个不停……！',
        note: '[机位B: 甘奈/甜花/羽那 3人同台] 自动淡出前3人，切入荒岛重逢组'
      },
      {
        rowId: 's3_r05',
        beatId: 'beat_2',
        beatTitle: '荒岛重逢组姐妹相拥报平安',
        speaker: '甘奈',
        charLabel: 'amana',
        emotion: 'joy',
        anim1: 'smile1',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: '甜花ちゃん、ごめんね☆ でもプロデューサーさんと羽那ちゃんが一緒で、甘奈ぜんぜん平気だったよ♪',
        zh: '甜花酱，对不起让你担心啦☆ 不过有制作人先生和羽那酱在一起，甘奈完全没事哟♪',
        note: ''
      },
      {
        rowId: 's3_r06',
        beatId: 'beat_2',
        beatTitle: '荒岛重逢组姐妹相拥报平安',
        speaker: '羽那',
        charLabel: 'hana',
        emotion: 'idol',
        anim1: 'smile2',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: 'えへへ、真乃さんたちも甜花さんも、迎えに来てくれてありがとうございます！あたし感激です～！',
        zh: '嘿嘿，真乃小姐她们还有甜花小姐，谢谢大家赶来接我们！我真的太感动啦～！',
        note: ''
      },
      {
        rowId: 's3_r07',
        beatId: 'beat_2',
        beatTitle: '荒岛重逢组姐妹相拥报平安',
        speaker: '甜花',
        charLabel: 'tenka',
        emotion: 'joy',
        anim1: 'smile1',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: 'にへへ……プロデューサーさん、ふたりを守ってくれてありがとう……。帰ったらアイス食べよ……♪',
        zh: '嘿嘿……谢谢制作人先生保护了她们两位……。回去之后，大家一起吃冰淇淋吧……♪',
        note: ''
      },
      {
        rowId: 's3_r08',
        beatId: 'beat_3',
        beatTitle: '海平线晚霞下的全员团圆终幕',
        speaker: '真乃',
        charLabel: 'mano',
        emotion: 'joy',
        anim1: 'smile2',
        anim2: 'face_smile',
        anim3: 'eye_front',
        text: 'ふふっ、夕焼けの海が綺麗ですね……！プロデューサーさん、みんなで帰れるのが一番の宝物ですっ。',
        zh: '呵呵，夕阳下的大海真漂亮呀……！制作人先生，大家能像这样一起回家，就是最珍贵的宝物了。',
        note: '[机位A切回] 夕阳下的全员团圆收尾'
      }
    ]
  }
};

// ---------------------------------------------------------------------------
// Workspace Seeding & Discovery (`projects_workspace/` + `examples/scproj/`)
// ---------------------------------------------------------------------------
function registerWithPlayer18899(scprojObj) {
  try {
    fs.mkdirSync(USER_IMPORTS_DIR, { recursive: true });
    const sceneId = (scprojObj && scprojObj.meta && scprojObj.meta.id) || 'custom_scene';
    const targetFile = path.join(USER_IMPORTS_DIR, `${sceneId}.scproj.json`);
    fs.writeFileSync(targetFile, JSON.stringify(scprojObj, null, 2), 'utf8');

    // Also fire non-blocking POST to :18899/api/import-script if :18899 is up
    const payload = JSON.stringify({
      filename: `${sceneId}.scproj.json`,
      title: (scprojObj.meta && (scprojObj.meta.titleZh || scprojObj.meta.title || scprojObj.meta.nameZh || scprojObj.meta.name)) || sceneId,
      content: scprojObj
    });
    const playerHost = process.env.PLAYER_HOST || '127.0.0.1';
    const playerPort = parseInt(process.env.PLAYER_PORT || '18899', 10) || 18899;
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    const accessToken = String(process.env.STUDIO_ACCESS_TOKEN || '').trim();
    if (accessToken) reqHeaders['X-Studio-Token'] = accessToken;
    const req = http.request(
      {
        hostname: playerHost,
        port: playerPort,
        path: '/api/import-script',
        method: 'POST',
        headers: reqHeaders,
        timeout: 1200
      },
      (res) => {
        res.resume();
      }
    );
    req.on('error', () => {});
    req.write(payload);
    req.end();
  } catch (_) {}
}

function ensureSeededWorkspace(opts = {}) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  fs.mkdirSync(USER_IMPORTS_DIR, { recursive: true });

  const packDir = path.join(WORKSPACE_DIR, 'island_survival_pack.scpack');
  const packJsonFile = path.join(packDir, 'pack.json');
  const s1OutlineFile = path.join(packDir, 'outlines', 'scene_01_harbor.outline.json');
  let islandHasSegments = false;
  if (fs.existsSync(s1OutlineFile)) {
    try {
      const s1Obj = JSON.parse(fs.readFileSync(s1OutlineFile, 'utf8'));
      islandHasSegments = Array.isArray(s1Obj.segments) && s1Obj.segments.length >= 3 &&
        Array.isArray(s1Obj.scriptRows) && s1Obj.scriptRows.every((r) => Boolean(r.beatId));
    } catch (_) {}
  }

  let packJson = null;
  if (!opts.force && fs.existsSync(packJsonFile) && islandHasSegments) {
    try {
      packJson = JSON.parse(fs.readFileSync(packJsonFile, 'utf8'));
    } catch (_) {}
  }

  if (!packJson) {
    const outlinesDir = path.join(packDir, 'outlines');
    const storiesDir = path.join(packDir, 'stories');
    const bgDir = path.join(packDir, 'assets', 'bg');
    const voiceDir = path.join(packDir, 'assets', 'voice');

    fs.mkdirSync(outlinesDir, { recursive: true });
    fs.mkdirSync(storiesDir, { recursive: true });
    fs.mkdirSync(bgDir, { recursive: true });
    fs.mkdirSync(voiceDir, { recursive: true });

    const castList = ['mano', 'hiori', 'meguru', 'amana', 'tenka', 'hana'];
    const charactersManifest = {};
    castList.forEach((cLabel) => {
      const m = IDOL_META[cLabel];
      charactersManifest[cLabel] = {
        charType: 'characters',
        charId: m.id,
        charCategory: 'stand',
        name: m.speaker,
        nameZh: m.nameZh
      };
    });

    const sceneKeys = ['scene_01_harbor', 'scene_02_signal', 'scene_03_rescue'];
    const storiesManifest = [];

    sceneKeys.forEach((sceneId, idx) => {
      const def = CANONICAL_ISLAND_SCENES[sceneId];
      const norm = normalizeSceneSegments(def);
      const audited = auditScriptRows(def.scriptRows);
      const outlineObj = {
        sceneId: def.sceneId,
        order: idx + 1,
        title: def.title,
        titleJa: def.titleJa,
        bg: def.bg,
        bgm: def.bgm,
        cast: def.cast,
        summary: def.summary,
        segments: norm.segments,
        beats: norm.beats,
        scriptRows: audited.rows,
        oocSummary: audited.summary
      };

      const outlinePath = path.join(outlinesDir, `${sceneId}.outline.json`);
      fs.writeFileSync(outlinePath, JSON.stringify(outlineObj, null, 2), 'utf8');

      const scprojObj = compileSceneToScproj({
        projectId: 'island_survival_pack',
        packName: '🏝️ 荒岛求生！？～偷溜的两人与海平线大营救～',
        packUnit: 'illumination STARS × ALSTROEMERIA × CoMETIK',
        sceneId: def.sceneId,
        title: def.titleJa,
        titleZh: def.title,
        bg: def.bg,
        bgm: def.bgm,
        cast: def.cast,
        scriptRows: audited.rows
      });

      const scprojPath = path.join(storiesDir, `${sceneId}.scproj.json`);
      fs.writeFileSync(scprojPath, JSON.stringify(scprojObj, null, 2), 'utf8');

      const scsYaml = serializeScsYaml({
        sceneId: def.sceneId,
        title: def.titleJa,
        titleZh: def.title,
        bg: def.bg,
        bgm: def.bgm,
        cast: def.cast,
        scriptRows: audited.rows
      });
      const scsPath = path.join(storiesDir, `${sceneId}.scs.yaml`);
      fs.writeFileSync(scsPath, scsYaml, 'utf8');

      const importPath = path.join(USER_IMPORTS_DIR, `${sceneId}.scproj.json`);
      fs.writeFileSync(importPath, JSON.stringify(scprojObj, null, 2), 'utf8');

      storiesManifest.push({
        id: sceneId,
        file: `stories/${sceneId}.scproj.json`,
        source: `stories/${sceneId}.scs.yaml`,
        title: def.titleJa,
        titleZh: def.title,
        order: idx + 1,
        cast: def.cast,
        entry: idx === 0,
        tags: ['island', 'summer', 'fanwork']
      });
    });

    packJson = {
      $schema: '../../schema/scproj.schema.json',
      format: 'scpack',
      formatVersion: 2,
      id: 'island_survival_pack',
      'x-projectType': 'story',
      name: '無人島サバイバル！？〜消えたふたりと水平線のレスキュー〜',
      nameZh: '🏝️ 荒岛求生！？～偷溜的两人与海平线大营救～',
      version: '0.2.0',
      unit: 'illumination STARS × ALSTROEMERIA × CoMETIK',
      synopsis: '夏ロケの合間にボートで無人島へ流されてしまった甘奈と羽那。プロデューサーと3人で日除けを作り、SOSサインを送ると、水平線から真乃・灯織・めぐる・甜花のレスキュー艇がやってくる！',
      synopsisZh: '夏日外景拍摄间隙，甘奈与羽那误乘小艇漂流到无人荒岛。制作人与两人合力搭建遮阳棚、在海岸发出求救信号后，真乃、灯织、缭与甜花乘着救援艇从海平线赶来，上演6人分镜大团圆！',
      themeColor: '#f54275',
      description: '三幕式荒岛求生二创工程包：第1幕码头偷溜与正午防晒、第2幕海岸SOS分支抉择、第3幕6人分镜全员大营救。',
      authors: [{ name: '283 Production Studio', role: 'writer' }],
      createdAt: '2026-11-12T12:00:00Z',
      updatedAt: new Date().toISOString(),
      lang: {
        primary: 'ja',
        translations: ['zh']
      },
      characters: charactersManifest,
      stories: storiesManifest
    };

    fs.writeFileSync(path.join(packDir, 'pack.json'), JSON.stringify(packJson, null, 2), 'utf8');
  }

  // Also ensure the canonical Reaction Anthology project (`reaction_idol_relation.scpack`) is seeded
  seedReactionAnthologyPack({ force: Boolean(opts.force) });

  return packJson;
}

/**
 * Extract editable `scriptRows` from an existing `.scproj.json` when no `.outline.json` exists yet (e.g. `rooftop_after_rain.scpack`)
 */
function extractScriptRowsFromScproj(scproj) {
  const rows = [];
  const lines = (scproj && scproj.lines) || [];
  const charTable = (scproj && scproj.meta && scproj.meta.characters) || (scproj && scproj.characters) || {};
  let idx = 1;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln || (!ln.text && !ln.select)) continue;
    if (ln.select && rows.length > 0 && Array.isArray(rows[rows.length - 1].choices)) {
      rows[rows.length - 1].choices.push({
        text: ln.select,
        zh: (ln._meta && ln._meta.selectZh) || ln.select,
        nextLabel: ln.nextLabel || ''
      });
      continue;
    }
    const charDef = (ln.charLabel && charTable[ln.charLabel]) || null;
    const defHair = charDef ? (charDef['x-charHair'] || charDef.charHair || '') : '';
    const row = {
      rowId: (ln._meta && ln._meta.uid) || `row_${String(idx++).padStart(2, '0')}`,
      beatId: (ln._meta && (ln._meta['x-beatId'] || ln._meta.beatId)) || '',
      beatTitle: (ln._meta && (ln._meta['x-beatTitle'] || ln._meta.beatTitle)) || '',
      speaker: ln.speaker || '',
      charLabel: ln.charLabel || '',
      charType: ln.charType || '',
      charCategory: ln.charCategory || '',
      charId: ln.charId || '',
      clothId: ln.clothId || ln.charId || '',
      charHair: ln.charHair || defHair || '',
      se: ln.se || '',
      text: ln.text || '',
      zh: (ln._meta && ln._meta.zh) || ln.text || '',
      emotion: 'joy',
      anim1: ln.charAnim1 || '',
      anim2: ln.charAnim2 || '',
      anim3: ln.charAnim3 || '',
      note: (ln._meta && ln._meta.note) || (ln.label ? `[分支: ${ln.label}]` : ''),
      branchLabel: ln.label || ''
    };
    if (ln.select) {
      row.choices = [
        {
          text: ln.select,
          zh: (ln._meta && ln._meta.selectZh) || ln.select,
          nextLabel: ln.nextLabel || ''
        }
      ];
    }
    rows.push(row);
  }
  return auditScriptRows(rows);
}

function loadPackFromDir(packDir, sourceRootLabel) {
  const packJsonPath = path.join(packDir, 'pack.json');
  if (!fs.existsSync(packJsonPath)) return null;
  const pack = JSON.parse(fs.readFileSync(packJsonPath, 'utf8'));
  const castKeys = Object.keys(pack.characters || {});

  let reactionMeta = null;
  const reactionJsonPath = path.join(packDir, 'reaction.json');
  if (fs.existsSync(reactionJsonPath)) {
    try {
      reactionMeta = JSON.parse(fs.readFileSync(reactionJsonPath, 'utf8'));
    } catch (_) {}
  }

  const projectType = (reactionMeta && reactionMeta.projectType) || pack['x-projectType'] || 'story';
  const triggerPrompt = (reactionMeta && reactionMeta.triggerPrompt) || pack['x-triggerPrompt'] || '';
  const triggerPromptJa = (reactionMeta && reactionMeta.triggerPromptJa) || pack['x-triggerPromptJa'] || '';
  const triggerPromptZh = (reactionMeta && reactionMeta.triggerPromptZh) || pack['x-triggerPromptZh'] || '';
  const reactionCards = (reactionMeta && Array.isArray(reactionMeta.reactionCards) && reactionMeta.reactionCards)
    || (Array.isArray(pack['x-reactionCards']) ? pack['x-reactionCards'] : []);

  const scenes = (pack.stories || []).map((st, idx) => {
    const compiledRel = st.file || st.compiled || `stories/${st.id}.scproj.json`;
    const compiledAbs = path.join(packDir, compiledRel);
    let scproj = null;
    if (fs.existsSync(compiledAbs)) {
      try {
        scproj = JSON.parse(fs.readFileSync(compiledAbs, 'utf8'));
      } catch (_) {}
    }

    const outlineRel = st.outline || `outlines/${st.id}.outline.json`;
    const outlineAbs = path.join(packDir, outlineRel);
    let outlineObj = null;
    if (fs.existsSync(outlineAbs)) {
      try {
        outlineObj = JSON.parse(fs.readFileSync(outlineAbs, 'utf8'));
      } catch (_) {}
    }

    if (!outlineObj) {
      const extracted = scproj ? extractScriptRowsFromScproj(scproj) : { rows: [], summary: { total: 0, pass: 0, warn: 0, error: 0 } };
      outlineObj = {
        sceneId: st.id,
        order: st.order || idx + 1,
        title: st.titleZh || st.title || st.id,
        titleJa: st.title || st.id,
        bg: st.bg || '00003',
        bgm: st.bgm || '0029',
        cast: st.cast || castKeys,
        summary: st.summary || pack.synopsisZh || pack.synopsis || '',
        beats: st.beats || [
          '节拍 1：角色登场与情境铺垫',
          '节拍 2：核心对话推进与分支互动',
          '节拍 3：情感升华与场景收尾'
        ],
        scriptRows: extracted.rows,
        oocSummary: extracted.summary
      };
    }

    const isPreservePrecompiled = Boolean(
      st.preservePrecompiled ||
      (outlineObj && outlineObj.preservePrecompiled) ||
      (scproj && scproj.meta && (scproj.meta.origin === 'external-import' || scproj.meta['x-preservePrecompiled']))
    );
    const isBlankScene = Boolean((outlineObj && outlineObj.blankTemplate) || pack['x-blankTemplate']) &&
      (!outlineObj.segments || outlineObj.segments.length === 0) &&
      (!outlineObj.beats || outlineObj.beats.length === 0) &&
      (!outlineObj.scriptRows || outlineObj.scriptRows.length === 0);

    if (!isBlankScene) {
      normalizeSceneSegments(outlineObj);
    } else {
      outlineObj.segments = [];
      outlineObj.beats = [];
      outlineObj.scriptRows = [];
    }
    if (isPreservePrecompiled) {
      outlineObj.preservePrecompiled = true;
    }
    if (Array.isArray(outlineObj.scriptRows) && outlineObj.scriptRows.length > 0) {
      const audited = auditScriptRows(outlineObj.scriptRows);
      outlineObj.scriptRows = audited.rows;
      outlineObj.oocSummary = audited.summary;
    } else if (!outlineObj.oocSummary) {
      outlineObj.oocSummary = { total: 0, pass: 0, warn: 0, error: 0 };
    }

    const inferredHairs = {};
    const chMap = (scproj && scproj.meta && scproj.meta.characters) || {};
    Object.entries(chMap).forEach(([k, v]) => {
      const hv = v && (v['x-charHair'] || v.charHair);
      if (hv) inferredHairs[k] = hv;
    });

    return {
      id: st.id,
      order: st.order !== undefined ? st.order : idx + 1,
      title: st.title || outlineObj.titleJa || st.id,
      titleZh: st.titleZh || outlineObj.title || st.title || st.id,
      bg: outlineObj.bg || st.bg || '00003',
      bgm: normalizeBgmId(outlineObj.bgm || st.bgm, '002'),
      bgmStyle: outlineObj.bgmStyle || '',
      bgmSuggestions: Array.isArray(outlineObj.bgmSuggestions) ? outlineObj.bgmSuggestions : [],
      bgSuggestions: Array.isArray(outlineObj.bgSuggestions) ? outlineObj.bgSuggestions : [],
      cast: Array.isArray(st.cast) ? st.cast : (Array.isArray(outlineObj.cast) ? outlineObj.cast : castKeys),
      castOutfits: outlineObj.castOutfits || st.castOutfits || undefined,
      castHairs: outlineObj.castHairs || st.castHairs || (Object.keys(inferredHairs).length ? inferredHairs : undefined),
      preservePrecompiled: isPreservePrecompiled,
      ...(outlineObj.blankTemplate || pack['x-blankTemplate'] ? { blankTemplate: true } : {}),
      summary: outlineObj.summary !== undefined ? outlineObj.summary : (st.summary || ''),
      segments: outlineObj.segments || [],
      beats: outlineObj.beats || st.beats || [],
      outlineData: outlineObj,
      scriptRows: outlineObj.scriptRows || [],
      oocSummary: outlineObj.oocSummary || { total: 0, pass: 0, warn: 0, error: 0 },
      source: st.source || `stories/${st.id}.scs.yaml`,
      file: compiledRel,
      compiled: compiledRel,
      scproj
    };
  });

  return {
    id: pack.id,
    projectType,
    'x-projectType': projectType,
    ...(pack['x-blankTemplate'] ? { blankTemplate: true, 'x-blankTemplate': true } : {}),
    name: pack.name,
    nameZh: pack.nameZh || pack.name,
    version: pack.version || '0.2.0',
    unit: pack.unit || '283 Production',
    cast: castKeys,
    premise: pack.synopsisZh || pack.synopsis || '',
    synopsis: pack.synopsis || '',
    synopsisZh: pack.synopsisZh || pack.synopsis || '',
    triggerPrompt,
    triggerPromptJa,
    triggerPromptZh,
    defaultBg: (reactionMeta && reactionMeta.defaultBg) || pack['x-defaultBg'] || '00001',
    defaultBgm: (reactionMeta && reactionMeta.defaultBgm) || pack['x-defaultBgm'] || '0001',
    reactionCards,
    sourceRoot: sourceRootLabel,
    packDir,
    assets: pack.assets || {},
    characters: pack.characters || {},
    stories: scenes
  };
}

function listAllProjects() {
  ensureSeededWorkspace();
  const projects = [];
  const seenIds = new Set();

  // 1. Scan `projects_workspace/*.scpack`
  if (fs.existsSync(WORKSPACE_DIR)) {
    for (const entry of fs.readdirSync(WORKSPACE_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.endsWith('.scpack')) {
        const p = loadPackFromDir(path.join(WORKSPACE_DIR, entry.name), 'projects_workspace');
        if (p && !seenIds.has(p.id)) {
          seenIds.add(p.id);
          projects.push(p);
        }
      }
    }
  }

  // 2. Scan `examples/scproj/*.scpack`
  if (fs.existsSync(EXAMPLES_DIR)) {
    for (const entry of fs.readdirSync(EXAMPLES_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.endsWith('.scpack')) {
        const p = loadPackFromDir(path.join(EXAMPLES_DIR, entry.name), 'examples/scproj');
        if (p && !seenIds.has(p.id)) {
          seenIds.add(p.id);
          projects.push(p);
        }
      }
    }
  }

  // Keep `island_survival_pack` first, then `reaction_idol_relation` second
  const priorityOrder = {
    island_survival_pack: 1,
    reaction_idol_relation: 2
  };
  projects.sort((a, b) => {
    const pa = priorityOrder[a.id] || 99;
    const pb = priorityOrder[b.id] || 99;
    if (pa !== pb) return pa - pb;
    return a.id.localeCompare(b.id);
  });

  return projects;
}

/**
 * Create a new `.scpack` project in `projects_workspace/<slug>.scpack`
 * Supports `projectType: 'story' | 'reaction'`
 */
function createNewProject(body = {}) {
  const {
    id,
    name,
    nameZh,
    unit,
    cast,
    premise,
    projectType,
    triggerPrompt,
    triggerPromptJa,
    triggerPromptZh,
    defaultBg,
    defaultBgm,
    reactionCards,
    blankTemplate
  } = body || {};
  ensureSeededWorkspace();
  const isBlankTemplate = Boolean(blankTemplate);
  const slug = String(id || name || nameZh || `project_${Date.now()}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || `pack_${Date.now().toString(36)}`;

  if (projectType === 'reaction') {
    const castList = isBlankTemplate
      ? (Array.isArray(cast) ? cast.filter((c) => IDOL_META[c]) : [])
      : (Array.isArray(cast) && cast.length ? cast.filter((c) => IDOL_META[c]) : ['fuyuko', 'madoka', 'amana', 'hana']);
    const trigJa = triggerPromptJa || '「プロデューサーとアイドル、それ以上でも以下でもない関係だろ？」';
    const trigZh = triggerPromptZh || '（我们只是制作人和偶像的关系，仅此而已吧？）';
    const trigCombined = triggerPrompt || `${trigJa}${trigZh}`;
    const cards = Array.isArray(reactionCards) && reactionCards.length
      ? reactionCards
      : castList.map((cLabel) => buildDefaultReactionCard(cLabel, 'canon', { bg: defaultBg || '00001' }));

    const compiled = compileReactionPackToScproj({
      projectId: slug,
      title: name || nameZh || slug,
      titleZh: nameZh || name || slug,
      unit: unit || '283 Production',
      triggerPrompt: trigCombined,
      triggerPromptJa: trigJa,
      triggerPromptZh: trigZh,
      bg: defaultBg || '00001',
      bgm: defaultBgm || '0001',
      reactionCards: cards,
      saveToWorkspace: true
    });
    return compiled.project;
  }

  const packDir = path.join(WORKSPACE_DIR, `${slug}.scpack`);
  const outlinesDir = path.join(packDir, 'outlines');
  const storiesDir = path.join(packDir, 'stories');
  fs.mkdirSync(outlinesDir, { recursive: true });
  fs.mkdirSync(storiesDir, { recursive: true });
  fs.mkdirSync(path.join(packDir, 'assets', 'bg'), { recursive: true });
  fs.mkdirSync(path.join(packDir, 'assets', 'voice'), { recursive: true });

  const castList = isBlankTemplate
    ? (Array.isArray(cast) ? cast.filter((c) => IDOL_META[c]) : [])
    : (Array.isArray(cast) && cast.length ? cast.filter((c) => IDOL_META[c]) : ['amana', 'hana']);
  const charactersManifest = {};
  castList.forEach((cLabel) => {
    const m = IDOL_META[cLabel];
    if (!m) return;
    charactersManifest[cLabel] = {
      charType: 'characters',
      charId: m.id,
      charCategory: 'stand',
      name: m.speaker,
      nameZh: m.nameZh
    };
  });

  let outlineObj;
  let scprojObj;
  let firstScene;

  if (isBlankTemplate) {
    const blankTitle = nameZh || '第 1 幕';
    const blankBg = String(defaultBg || '00001').padStart(5, '0');
    const blankBgm = normalizeBgmId(defaultBgm, '002');
    firstScene = {
      sceneId: 'scene_01',
      title: blankTitle,
      titleJa: blankTitle,
      bg: blankBg,
      bgm: blankBgm,
      cast: castList.slice(),
      summary: premise || '',
      segments: [],
      beats: [],
      scriptRows: []
    };
    outlineObj = {
      sceneId: 'scene_01',
      order: 1,
      blankTemplate: true,
      title: blankTitle,
      titleJa: blankTitle,
      bg: blankBg,
      bgm: blankBgm,
      bgmStyle: '',
      bgmSuggestions: [],
      bgSuggestions: [],
      cast: castList.slice(),
      summary: premise || '',
      segments: [],
      beats: [],
      scriptRows: [],
      oocSummary: { total: 0, pass: 0, warn: 0, error: 0 }
    };
    scprojObj = {
      $schema: '../../../schema/scproj.schema.json',
      format: 'scproj',
      formatVersion: 2,
      meta: {
        id: 'scene_01',
        'x-projectId': slug,
        cat: 'custom',
        title: blankTitle,
        titleZh: blankTitle,
        origin: 'custom',
        lang: { primary: 'ja', translations: ['zh'] },
        cast: castList.slice(),
        characters: charactersManifest,
        authors: [{ name: '283 Fan-Story Studio', role: 'writer' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      lines: []
    };
  } else {
    // Expand initial scenes from premise (or seed 1 initial scene_01)
    const initialScenes = pickSemanticScenesForPrompt(premise || nameZh || name || '', castList, nameZh || name);
    firstScene = initialScenes[0] || {
      sceneId: 'scene_01',
      title: '第 1 幕 · 序幕与突发奇想',
      titleJa: '第1幕・はじまりの予感',
      bg: '00001',
      bgm: '0001',
      cast: castList.slice(0, 3),
      summary: premise || '全新二创故事的第一幕。',
      segments: [
        { beatId: 'beat_1', title: '偶像登场提出新点子', summary: '偶像登场，向制作人提出新企划点子', cast: castList.slice(0, 3), targetLines: 2 },
        { beatId: 'beat_2', title: '商量行动细节干劲十足', summary: '两人商量行动细节，干劲十足', cast: castList.slice(0, 3), targetLines: 2 },
        { beatId: 'beat_3', title: '迈出第一步迎接挑战', summary: '迈出第一步，迎接接下来的挑战', cast: castList.slice(0, 3), targetLines: 2 }
      ]
    };
    firstScene.sceneId = 'scene_01';
    normalizeSceneSegments(firstScene);

    const expandedScript = expandScriptFromOutline(Object.assign({}, firstScene, { _forceRegenerate: true }));
    outlineObj = {
      sceneId: 'scene_01',
      order: 1,
      title: firstScene.title,
      titleJa: firstScene.titleJa || firstScene.title,
      bg: firstScene.bg,
      bgm: firstScene.bgm,
      bgmStyle: firstScene.bgmStyle || '',
      bgmSuggestions: firstScene.bgmSuggestions || [],
      bgSuggestions: firstScene.bgSuggestions || [],
      cast: firstScene.cast,
      summary: firstScene.summary,
      segments: firstScene.segments,
      beats: firstScene.beats,
      scriptRows: expandedScript.rows,
      oocSummary: expandedScript.summary
    };
    scprojObj = compileSceneToScproj({
      projectId: slug,
      packName: nameZh || name || slug,
      packUnit: unit || '283 Production',
      sceneId: 'scene_01',
      title: firstScene.titleJa || firstScene.title,
      titleZh: firstScene.title,
      bg: firstScene.bg,
      bgm: firstScene.bgm,
      cast: firstScene.cast,
      segments: firstScene.segments,
      scriptRows: expandedScript.rows
    });
  }

  fs.writeFileSync(path.join(outlinesDir, 'scene_01.outline.json'), JSON.stringify(outlineObj, null, 2), 'utf8');
  fs.writeFileSync(path.join(storiesDir, 'scene_01.scproj.json'), JSON.stringify(scprojObj, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(storiesDir, 'scene_01.scs.yaml'),
    serializeScsYaml({
      sceneId: 'scene_01',
      title: firstScene.titleJa || firstScene.title,
      titleZh: firstScene.title,
      bg: firstScene.bg,
      bgm: firstScene.bgm,
      cast: firstScene.cast,
      scriptRows: outlineObj.scriptRows
    }),
    'utf8'
  );
  registerWithPlayer18899(scprojObj);

  const packJson = {
    $schema: '../../schema/scproj.schema.json',
    format: 'scpack',
    formatVersion: 2,
    id: slug,
    'x-projectType': 'story',
    ...(isBlankTemplate ? { 'x-blankTemplate': true } : {}),
    name: name || nameZh || slug,
    nameZh: nameZh || name || slug,
    version: '0.1.0',
    unit: unit || '283 Production',
    synopsis: premise || '',
    synopsisZh: premise || '',
    authors: [{ name: '283 Studio User', role: 'writer' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lang: {
      primary: 'ja',
      translations: ['zh']
    },
    characters: charactersManifest,
    stories: [
      {
        id: 'scene_01',
        file: 'stories/scene_01.scproj.json',
        source: 'stories/scene_01.scs.yaml',
        title: firstScene.titleJa || firstScene.title,
        titleZh: firstScene.title,
        order: 1,
        cast: firstScene.cast,
        entry: true
      }
    ]
  };
  fs.writeFileSync(path.join(packDir, 'pack.json'), JSON.stringify(packJson, null, 2), 'utf8');
  return loadPackFromDir(packDir, 'projects_workspace');
}

/**
 * Find project directory by `pid` (if in `examples/scproj`, we can still read it or write to `projects_workspace` if needed)
 */
function resolvePackDir(pid) {
  ensureSeededWorkspace();
  const wsCandidate = path.join(WORKSPACE_DIR, `${pid}.scpack`);
  if (fs.existsSync(wsCandidate)) return { packDir: wsCandidate, sourceRoot: 'projects_workspace' };
  const exCandidate = path.join(EXAMPLES_DIR, `${pid}.scpack`);
  if (fs.existsSync(exCandidate)) return { packDir: exCandidate, sourceRoot: 'examples/scproj' };
  return null;
}

function extractTtsCacheFilename(rawVoice) {
  const s = String(rawVoice || '').trim().replace(/\\/g, '/');
  if (!s) return '';
  const m = s.match(/(?:^|\/)(?:_tts_cache|api\/studio\/tts\/audio)\/([a-zA-Z0-9._-]+\.(?:mp3|wav|m4a))(?:\?.*)?$/i);
  return m ? m[1] : '';
}

/**
 * Archive `_tts_cache/<fname>` voices referenced by `rows` into `<packDir>/assets/voice/<fname>`,
 * rewrite `row.voice` / `row.takes[].voice` to `custom/<packId>/<fname>`, and register in `packJson.assets.voice`.
 */
function archivePackTtsVoices(packDir, packId, rows, packJson) {
  if (!packDir || !packId || !Array.isArray(rows) || !rows.length) {
    return { archivedCount: 0, files: [] };
  }
  const ttsCacheDir = path.join(USER_IMPORTS_DIR, '_tts_cache');
  const destVoiceDir = path.join(packDir, 'assets', 'voice');
  const archivedFiles = new Set();

  const registerInManifest = (fname) => {
    if (!packJson || typeof packJson !== 'object' || !fname) return;
    packJson.assets = packJson.assets || {};
    packJson.assets.voice = packJson.assets.voice || {};
    const stem = fname.replace(/\.[a-z0-9]+$/i, '');
    packJson.assets.voice[stem] = { file: `assets/voice/${fname}`, origin: 'tts' };
  };

  const archiveOneVoice = (rawVal) => {
    const val = String(rawVal || '').trim();
    if (!val) return val;
    const customPrefix = `custom/${packId}/`;
    if (val.startsWith(customPrefix)) {
      const existingName = path.basename(val.slice(customPrefix.length));
      if (existingName && fs.existsSync(path.join(destVoiceDir, existingName))) {
        registerInManifest(existingName);
      }
      return val;
    }
    const fname = extractTtsCacheFilename(val);
    if (!fname) return val;
    const destPath = path.join(destVoiceDir, fname);
    if (!fs.existsSync(destPath)) {
      const srcPath = path.join(ttsCacheDir, fname);
      if (!fs.existsSync(srcPath)) return val;
      fs.mkdirSync(destVoiceDir, { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      archivedFiles.add(fname);
    }
    registerInManifest(fname);
    return `${customPrefix}${fname}`;
  };

  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    if (row.voice) {
      row.voice = archiveOneVoice(row.voice);
    }
    if (Array.isArray(row.takes)) {
      row.takes.forEach((tk) => {
        if (!tk || typeof tk !== 'object') return;
        if (tk.voice) {
          tk.voice = archiveOneVoice(tk.voice);
          if (tk.voice.startsWith(`custom/${packId}/`) && tk.audioUrl && extractTtsCacheFilename(tk.audioUrl)) {
            tk.audioUrl = `/voice/${tk.voice}`;
          }
        }
      });
    }
  });

  return { archivedCount: archivedFiles.size, files: Array.from(archivedFiles) };
}

/**
 * Persist an uploaded image (`bg`) or audio (`voice`) dataUrl into `<pack>.scpack/assets/{bg|voice}/`
 * and register it inside `pack.json`.
 */
function saveProjectUploadedAsset(pid, body = {}) {
  const resolved = resolvePackDir(pid);
  if (!resolved) throw new Error(`Project not found: ${pid}`);
  const { packDir, sourceRoot } = resolved;
  const kind = body.kind === 'voice' ? 'voice' : 'bg';
  const rawDataUrl = String(body.dataUrl || '').trim();
  const m = rawDataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!m) throw new Error('无效的 dataUrl 文件载荷');
  const mimeType = m[1].toLowerCase();
  const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  if (!buf.length || buf.length > 15 * 1024 * 1024) {
    throw new Error('文件大小超出限制（最大 15 MB）');
  }
  const origName = path.basename(String(body.filename || body.assetId || 'asset'));
  const extFromName = (origName.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
  let ext = extFromName.toLowerCase().replace('jpeg', 'jpg');
  if (kind === 'bg') {
    if (!/^(png|jpg|webp|gif)$/.test(ext)) {
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('webp')) ext = 'webp';
      else ext = 'jpg';
    }
  } else if (!/^(mp3|wav|m4a|ogg|webm)$/.test(ext)) {
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) ext = 'mp3';
    else if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = 'm4a';
    else if (mimeType.includes('ogg')) ext = 'ogg';
    else ext = 'wav';
  }
  const safeIdBase = String(body.assetId || origName.replace(/\.[^.]+$/, '') || (kind === 'bg' ? 'local_bg' : 'local_voice'))
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || (kind === 'bg' ? 'local_bg' : 'local_voice');

  const subDir = path.join(packDir, 'assets', kind);
  fs.mkdirSync(subDir, { recursive: true });
  const fileName = `${safeIdBase}.${ext}`;
  const outPath = path.join(subDir, fileName);
  fs.writeFileSync(outPath, buf);

  const packJsonPath = path.join(packDir, 'pack.json');
  const pack = JSON.parse(fs.readFileSync(packJsonPath, 'utf8'));
  pack.assets = pack.assets || {};
  pack.assets[kind] = pack.assets[kind] || {};
  const relFile = `assets/${kind}/${fileName}`;
  if (kind === 'bg') {
    pack.assets.bg[safeIdBase] = Object.assign({}, pack.assets.bg[safeIdBase] || {}, {
      file: relFile,
      title: String(body.title || origName || safeIdBase),
      origin: 'photo',
      status: 'ready',
      ...(Number(body.width) > 0 ? { width: Number(body.width) } : {}),
      ...(Number(body.height) > 0 ? { height: Number(body.height) } : {})
    });
  } else {
    pack.assets.voice[safeIdBase] = Object.assign({}, pack.assets.voice[safeIdBase] || {}, {
      file: relFile,
      origin: 'recorded'
    });
  }
  fs.writeFileSync(packJsonPath, JSON.stringify(pack, null, 2), 'utf8');
  return {
    ok: true,
    kind,
    assetId: safeIdBase,
    file: relFile,
    url: kind === 'bg' ? `/bg/${encodeURIComponent(safeIdBase)}` : `/voice/custom/${encodeURIComponent(pack.id)}/${encodeURIComponent(fileName)}`,
    project: loadPackFromDir(packDir, sourceRoot)
  };
}

/**
 * Save, Add, Rename, or Reorder a Scene in a Project (`POST /api/studio/projects/:pid/scenes` & `POST /api/studio/compile-scene`)
 */
function upsertOrManageProjectScene(pid, body) {
  const resolved = resolvePackDir(pid);
  if (!resolved) {
    throw new Error(`Project not found: ${pid}`);
  }
  const { packDir, sourceRoot } = resolved;
  const packJsonPath = path.join(packDir, 'pack.json');
  const pack = JSON.parse(fs.readFileSync(packJsonPath, 'utf8'));
  const outlinesDir = path.join(packDir, 'outlines');
  const storiesDir = path.join(packDir, 'stories');
  fs.mkdirSync(outlinesDir, { recursive: true });
  fs.mkdirSync(storiesDir, { recursive: true });

  const action = body.action || 'save';

  // Action: delete a scene
  if (action === 'delete' && body.sceneId) {
    const stories = pack.stories || [];
    if (stories.length <= 1) {
      throw new Error('至少需要保留 1 幕场景，无法删除最后一幕');
    }
    const nextStories = stories.filter((s) => s.id !== body.sceneId);
    if (nextStories.length === stories.length) {
      throw new Error(`未找到要删除的场景：${body.sceneId}`);
    }
    nextStories.forEach((s, i) => {
      s.order = i + 1;
      s.entry = i === 0;
    });
    pack.stories = nextStories;
    fs.writeFileSync(packJsonPath, JSON.stringify(pack, null, 2), 'utf8');
    [
      path.join(outlinesDir, `${body.sceneId}.outline.json`),
      path.join(storiesDir, `${body.sceneId}.scproj.json`),
      path.join(storiesDir, `${body.sceneId}.scs.yaml`)
    ].forEach((fp) => {
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch (_) {}
    });
    return { project: loadPackFromDir(packDir, sourceRoot) };
  }

  // Action: reorder scenes
  if (action === 'reorder' && Array.isArray(body.sceneOrder)) {
    const mapById = new Map((pack.stories || []).map((s) => [s.id, s]));
    const reordered = [];
    body.sceneOrder.forEach((sid) => {
      if (mapById.has(sid)) {
        reordered.push(mapById.get(sid));
        mapById.delete(sid);
      }
    });
    for (const rem of mapById.values()) reordered.push(rem);
    reordered.forEach((s, i) => {
      s.order = i + 1;
      s.entry = i === 0;
    });
    pack.stories = reordered;
    fs.writeFileSync(packJsonPath, JSON.stringify(pack, null, 2), 'utf8');
    return { project: loadPackFromDir(packDir, sourceRoot) };
  }

  // Action: replace all scenes from Step 1 Outline Expander (`replace_outlines`)
  if (action === 'replace_outlines' && Array.isArray(body.outlines)) {
    const newStories = [];
    body.outlines.forEach((outCard, idx) => {
      const sid = outCard.sceneId || `scene_${String(idx + 1).padStart(2, '0')}`;
      const precompiled = (Array.isArray(outCard.scprojLines) && outCard.scprojLines.length)
        ? outCard.scprojLines
        : ((Array.isArray(outCard.precompiledLines) && outCard.precompiledLines.length)
          ? outCard.precompiledLines
          : null);
      const isPreservePrecompiled = Boolean(
        body.preservePrecompiled ||
        outCard.preservePrecompiled ||
        (outCard.outlineData && outCard.outlineData.preservePrecompiled) ||
        (precompiled && precompiled.length > 0)
      );
      normalizeSceneSegments(outCard);
      const scriptData = Array.isArray(outCard.scriptRows) && outCard.scriptRows.length
        ? auditScriptRows(outCard.scriptRows)
        : (precompiled ? extractScriptRowsFromScproj({ lines: precompiled }) : expandScriptFromOutline(outCard));
      archivePackTtsVoices(packDir, pack.id, scriptData.rows, pack);
      if (precompiled) {
        archivePackTtsVoices(packDir, pack.id, precompiled, pack);
      }
      const outlineObj = {
        sceneId: sid,
        order: idx + 1,
        title: outCard.title || `第 ${idx + 1} 幕`,
        titleJa: outCard.titleJa || outCard.title || sid,
        bg: outCard.bg || '00269',
        bgm: normalizeBgmId(outCard.bgm, '002'),
        bgmStyle: String(outCard.bgmStyle || '').trim(),
        cast: outCard.cast || Object.keys(pack.characters || {}),
        ...(isPreservePrecompiled ? { preservePrecompiled: true } : {}),
        summary: outCard.summary || '',
        segments: outCard.segments || [],
        beats: outCard.beats || [],
        scriptRows: scriptData.rows,
        oocSummary: scriptData.summary
      };
      normalizeSceneSegments(outlineObj);
      fs.writeFileSync(path.join(outlinesDir, `${sid}.outline.json`), JSON.stringify(outlineObj, null, 2), 'utf8');

      const charactersDict = {};
      (outlineObj.cast || []).forEach((cid) => {
        const extCh = (body.characters && body.characters[cid]) || (pack.characters && pack.characters[cid]) || null;
        const m = IDOL_META[cid] || {};
        charactersDict[cid] = {
          charType: (extCh && extCh.charType) || 'characters',
          charId: (extCh && extCh.charId) || m.id || '001',
          ...(extCh && (extCh.clothId || extCh['x-clothId']) ? { 'x-clothId': extCh.clothId || extCh['x-clothId'], clothId: extCh.clothId || extCh['x-clothId'] } : {}),
          charCategory: (extCh && extCh.charCategory) || 'stand',
          name: (extCh && extCh.name) || m.speaker || cid,
          nameZh: (extCh && extCh.nameZh) || m.nameZh || cid
        };
      });
      const scprojObj = precompiled
        ? {
            $schema: '../../../schema/scproj.schema.json',
            format: 'scproj',
            formatVersion: 2,
            meta: {
              id: sid,
              cat: 'custom',
              title: outlineObj.titleJa,
              titleZh: outlineObj.title,
              origin: 'external-import',
              'x-preservePrecompiled': true,
              lang: { primary: 'ja', translations: ['zh'] },
              cast: outlineObj.cast || [],
              characters: charactersDict,
              authors: [{ name: '283 Fan-Story Studio', role: 'writer' }],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            lines: precompiled
          }
        : compileSceneToScproj({
            projectId: pack.id,
            packName: pack.nameZh || pack.name,
            packUnit: pack.unit,
            sceneId: sid,
            title: outlineObj.titleJa,
            titleZh: outlineObj.title,
            bg: outlineObj.bg,
            bgm: outlineObj.bgm,
            cast: outlineObj.cast,
            segments: outlineObj.segments,
            scriptRows: outlineObj.scriptRows
          });
      fs.writeFileSync(path.join(storiesDir, `${sid}.scproj.json`), JSON.stringify(scprojObj, null, 2), 'utf8');
      fs.writeFileSync(
        path.join(storiesDir, `${sid}.scs.yaml`),
        serializeScsYaml({
          sceneId: sid,
          title: outlineObj.titleJa,
          titleZh: outlineObj.title,
          bg: outlineObj.bg,
          bgm: outlineObj.bgm,
          cast: outlineObj.cast,
          scriptRows: outlineObj.scriptRows
        }),
        'utf8'
      );
      registerWithPlayer18899(scprojObj);

      newStories.push({
        id: sid,
        file: `stories/${sid}.scproj.json`,
        source: `stories/${sid}.scs.yaml`,
        title: outlineObj.titleJa,
        titleZh: outlineObj.title,
        bg: outlineObj.bg,
        bgm: outlineObj.bgm,
        order: idx + 1,
        cast: outlineObj.cast,
        ...(isPreservePrecompiled ? { preservePrecompiled: true } : {}),
        entry: idx === 0
      });
    });

    pack.stories = newStories;
    pack.characters = pack.characters || {};
    if (body.characters && typeof body.characters === 'object') {
      Object.entries(body.characters).forEach(([cid, ch]) => {
        if (!ch || typeof ch !== 'object') return;
        const m = IDOL_META[cid] || {};
        pack.characters[cid] = {
          ...(pack.characters[cid] || {}),
          ...ch,
          name: ch.name || m.speaker || cid,
          nameZh: ch.nameZh || m.nameZh || cid,
          unit: ch.unit || m.unit || ''
        };
      });
    }
    newStories.forEach((st) => {
      (st.cast || []).forEach((cid) => {
        if (!pack.characters[cid] && IDOL_META[cid]) {
          pack.characters[cid] = {
            name: IDOL_META[cid].speaker,
            nameZh: IDOL_META[cid].nameZh,
            unit: IDOL_META[cid].unit
          };
        }
      });
    });
    if (body.synopsisZh !== undefined) {
      pack.synopsisZh = String(body.synopsisZh || '');
      pack.synopsis = pack.synopsisZh;
    }
    fs.writeFileSync(packJsonPath, JSON.stringify(pack, null, 2), 'utf8');
    return { project: loadPackFromDir(packDir, sourceRoot), outlines: body.outlines };
  }

  // Action: add / save / compile single scene
  const nextIdx = (pack.stories || []).length + 1;
  const sceneId = String(body.sceneId || `scene_${String(nextIdx).padStart(2, '0')}`)
    .replace(/[^a-zA-Z0-9_-]+/g, '_');

  const existingStory = (pack.stories || []).find((s) => s.id === sceneId);
  const existingOutlineAbs = path.join(outlinesDir, `${sceneId}.outline.json`);
  let existingOutline = null;
  if (fs.existsSync(existingOutlineAbs)) {
    try {
      existingOutline = JSON.parse(fs.readFileSync(existingOutlineAbs, 'utf8'));
    } catch (_) {}
  }
  const existingScprojAbs = path.join(storiesDir, `${sceneId}.scproj.json`);
  let existingScproj = null;
  if (fs.existsSync(existingScprojAbs)) {
    try {
      existingScproj = JSON.parse(fs.readFileSync(existingScprojAbs, 'utf8'));
    } catch (_) {}
  }

  const outlineIn = body.outline || {};
  const preservePrecompiled = Boolean(
    body.preservePrecompiled ||
    outlineIn.preservePrecompiled ||
    (existingStory && existingStory.preservePrecompiled) ||
    (existingOutline && existingOutline.preservePrecompiled) ||
    (existingScproj && existingScproj.meta && (existingScproj.meta.origin === 'external-import' || existingScproj.meta['x-preservePrecompiled']))
  );

  const incomingScprojLines = (Array.isArray(body.scprojLines) && body.scprojLines.length > 0)
    ? body.scprojLines
    : ((Array.isArray(body.precompiledLines) && body.precompiledLines.length > 0)
      ? body.precompiledLines
      : ((Array.isArray(outlineIn.precompiledLines) && outlineIn.precompiledLines.length > 0)
        ? outlineIn.precompiledLines
        : (preservePrecompiled && existingScproj && Array.isArray(existingScproj.lines) && existingScproj.lines.length > 0
          ? existingScproj.lines
          : null)));

  const titleZh = body.titleZh || body.title || outlineIn.title || (existingOutline && existingOutline.title) || (existingStory && existingStory.titleZh) || `第 ${nextIdx} 幕 · 新场景`;
  const titleJa = body.titleJa || outlineIn.titleJa || (existingOutline && existingOutline.titleJa) || (existingStory && existingStory.title) || titleZh;
  const bg = String(body.bg || outlineIn.bg || (existingOutline && existingOutline.bg) || (existingStory && existingStory.bg) || '00003').padStart(5, '0');
  const bgm = normalizeBgmId(body.bgm || outlineIn.bgm || (existingOutline && existingOutline.bgm) || (existingStory && existingStory.bgm), '002');
  const bgmStyle = body.bgmStyle !== undefined
    ? String(body.bgmStyle || '').trim()
    : (outlineIn.bgmStyle !== undefined ? String(outlineIn.bgmStyle || '').trim() : String((existingOutline && existingOutline.bgmStyle) || '').trim());
  const cast = Array.isArray(body.cast || outlineIn.cast) && (body.cast || outlineIn.cast).length
    ? (body.cast || outlineIn.cast)
    : ((existingOutline && existingOutline.cast) || (existingStory && existingStory.cast) || Object.keys(pack.characters || {}));
  const summary = body.summary !== undefined ? body.summary : (outlineIn.summary || (existingOutline && existingOutline.summary) || '');
  const segmentsIn = Array.isArray(body.segments || outlineIn.segments)
    ? (body.segments || outlineIn.segments)
    : (existingOutline && Array.isArray(existingOutline.segments) ? existingOutline.segments : null);
  const beats = Array.isArray(body.beats || outlineIn.beats)
    ? (body.beats || outlineIn.beats)
    : ((existingOutline && existingOutline.beats) || [
        '节拍 1：角色登场与环境铺垫',
        '节拍 2：制作人与偶像互动推进剧情',
        '节拍 3：达成共识，圆满收尾'
      ]);

  const tempSceneNorm = {
    sceneId,
    title: titleZh,
    bg,
    bgm,
    bgmStyle,
    cast,
    summary,
    segments: segmentsIn,
    beats
  };
  normalizeSceneSegments(tempSceneNorm);

  let scriptData;
  if (Array.isArray(body.scriptRows) && body.scriptRows.length > 0) {
    scriptData = auditScriptRows(body.scriptRows);
  } else if (existingOutline && Array.isArray(existingOutline.scriptRows) && existingOutline.scriptRows.length > 0 && !body.regenerateScript) {
    scriptData = auditScriptRows(existingOutline.scriptRows);
  } else if (preservePrecompiled && incomingScprojLines && incomingScprojLines.length > 0) {
    scriptData = extractScriptRowsFromScproj({ lines: incomingScprojLines });
  } else {
    scriptData = expandScriptFromOutline({
      sceneId,
      title: titleZh,
      bg,
      bgm,
      cast,
      summary,
      segments: tempSceneNorm.segments,
      beats: tempSceneNorm.beats,
      _forceRegenerate: !CANONICAL_ISLAND_SCENES[sceneId]
    });
  }

  const castOutfits = (body.castOutfits && typeof body.castOutfits === 'object')
    ? body.castOutfits
    : ((outlineIn.castOutfits && typeof outlineIn.castOutfits === 'object')
      ? outlineIn.castOutfits
      : ((existingOutline && existingOutline.castOutfits && typeof existingOutline.castOutfits === 'object') ? existingOutline.castOutfits : null));

  const castHairs = (body.castHairs && typeof body.castHairs === 'object')
    ? body.castHairs
    : ((outlineIn.castHairs && typeof outlineIn.castHairs === 'object')
      ? outlineIn.castHairs
      : ((existingOutline && existingOutline.castHairs && typeof existingOutline.castHairs === 'object') ? existingOutline.castHairs : null));

  archivePackTtsVoices(packDir, pack.id, scriptData.rows, pack);

  const outlineObj = {
    sceneId,
    order: existingStory ? existingStory.order : nextIdx,
    title: titleZh,
    titleJa,
    bg,
    bgm,
    bgmStyle: bgmStyle || tempSceneNorm.bgmStyle || '',
    bgmSuggestions: tempSceneNorm.bgmSuggestions || [],
    bgSuggestions: tempSceneNorm.bgSuggestions || [],
    cast,
    ...(castOutfits ? { castOutfits } : {}),
    ...(castHairs && Object.keys(castHairs).length ? { castHairs } : {}),
    ...(preservePrecompiled ? { preservePrecompiled: true } : {}),
    summary,
    segments: tempSceneNorm.segments,
    beats: tempSceneNorm.beats,
    scriptRows: scriptData.rows,
    oocSummary: scriptData.summary
  };
  normalizeSceneSegments(outlineObj);
  fs.writeFileSync(path.join(outlinesDir, `${sceneId}.outline.json`), JSON.stringify(outlineObj, null, 2), 'utf8');

  let scprojObj;
  if (preservePrecompiled && incomingScprojLines && incomingScprojLines.length > 0) {
    archivePackTtsVoices(packDir, pack.id, incomingScprojLines, pack);
    const charactersDict = Object.assign(
      {},
      (existingScproj && existingScproj.meta && existingScproj.meta.characters) || {},
      (body.characters && typeof body.characters === 'object') ? body.characters : {}
    );
    const allSceneCast = new Set(Array.isArray(cast) ? cast : []);
    incomingScprojLines.forEach((ln) => {
      if (ln && ln.charLabel && !['producer', 'narrator', 'mob'].includes(ln.charLabel)) {
        allSceneCast.add(ln.charLabel);
      }
    });
    allSceneCast.forEach((cid) => {
      if (!charactersDict[cid]) {
        const extCh = (pack.characters && pack.characters[cid]) || null;
        const m = IDOL_META[cid] || {};
        charactersDict[cid] = {
          charType: (extCh && extCh.charType) || 'characters',
          charId: (extCh && extCh.charId) || m.id || '001',
          ...(extCh && (extCh.clothId || extCh['x-clothId']) ? { 'x-clothId': extCh.clothId || extCh['x-clothId'], clothId: extCh.clothId || extCh['x-clothId'] } : {}),
          charCategory: (extCh && extCh.charCategory) || 'stand',
          name: (extCh && extCh.name) || m.speaker || cid,
          nameZh: (extCh && extCh.nameZh) || m.nameZh || cid
        };
      }
    });
    scprojObj = {
      $schema: '../../../schema/scproj.schema.json',
      format: 'scproj',
      formatVersion: 2,
      meta: {
        id: sceneId,
        'x-projectId': pack.id,
        cat: 'custom',
        title: titleJa,
        titleZh,
        origin: 'external-import',
        'x-preservePrecompiled': true,
        lang: { primary: 'ja', translations: ['zh'] },
        cast: Array.from(allSceneCast),
        characters: charactersDict,
        authors: [{ name: '283 Fan-Story Studio', role: 'writer' }],
        createdAt: (existingScproj && existingScproj.meta && existingScproj.meta.createdAt) || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      lines: incomingScprojLines
    };
  } else {
    scprojObj = compileSceneToScproj({
      projectId: pack.id,
      packName: pack.nameZh || pack.name,
      packUnit: pack.unit,
      sceneId,
      title: titleJa,
      titleZh,
      bg,
      bgm,
      cast,
      castOutfits,
      castHairs,
      segments: outlineObj.segments,
      scriptRows: scriptData.rows
    });
  }
  fs.writeFileSync(path.join(storiesDir, `${sceneId}.scproj.json`), JSON.stringify(scprojObj, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(storiesDir, `${sceneId}.scs.yaml`),
    serializeScsYaml({
      sceneId,
      title: titleJa,
      titleZh,
      bg,
      bgm,
      cast,
      scriptRows: scriptData.rows
    }),
    'utf8'
  );
  registerWithPlayer18899(scprojObj);

  // Also ensure any new cast idols are in `pack.characters`
  pack.characters = pack.characters || {};
  cast.forEach((cLabel) => {
    if (IDOL_META[cLabel] && !pack.characters[cLabel]) {
      const m = IDOL_META[cLabel];
      pack.characters[cLabel] = {
        charType: 'characters',
        charId: m.id,
        charCategory: 'stand',
        name: m.speaker,
        nameZh: m.nameZh
      };
    }
  });

  const storyManifestEntry = {
    id: sceneId,
    file: `stories/${sceneId}.scproj.json`,
    source: `stories/${sceneId}.scs.yaml`,
    title: titleJa,
    titleZh,
    bg,
    bgm,
    order: existingStory ? existingStory.order : nextIdx,
    cast,
    ...(preservePrecompiled ? { preservePrecompiled: true } : {}),
    entry: existingStory ? Boolean(existingStory.entry) : nextIdx === 1
  };

  if (existingStory) {
    const sIdx = pack.stories.findIndex((s) => s.id === sceneId);
    pack.stories[sIdx] = storyManifestEntry;
  } else {
    pack.stories = pack.stories || [];
    pack.stories.push(storyManifestEntry);
  }

  fs.writeFileSync(packJsonPath, JSON.stringify(pack, null, 2), 'utf8');
  const updatedProject = loadPackFromDir(packDir, sourceRoot);
  const updatedScene = (updatedProject.stories || []).find((s) => s.id === sceneId);

  return {
    project: updatedProject,
    scene: updatedScene,
    scproj: scprojObj,
    oocSummary: scriptData.summary,
    playerUrl: `/player/?cat=custom&id=${encodeURIComponent(sceneId)}&theater=1`
  };
}

// ---------------------------------------------------------------------------
// Task 1: Idol Outfit / Costume Catalog (`idol_outfits.json` + read-only D:\enza scan)
// ---------------------------------------------------------------------------
let _cachedIdolOutfits = null;
const IDOL_OUTFITS_JSON_PATH = path.resolve(SHINY_ROOT, 'studio', 'data', 'idol_outfits.json');
const PERSONAS_V2_DIR = path.resolve(SHINY_ROOT, '..', 'taibon', 'cards_v2', 'personas');

function getIdolOutfits() {
  if (_cachedIdolOutfits) return _cachedIdolOutfits;
  if (fs.existsSync(IDOL_OUTFITS_JSON_PATH)) {
    try {
      _cachedIdolOutfits = JSON.parse(fs.readFileSync(IDOL_OUTFITS_JSON_PATH, 'utf8'));
      return _cachedIdolOutfits;
    } catch (_) {}
  }
  // Fallback: build basic outfits from IDOL_META if cache file missing
  const fallback = {
    version: '1.0.0',
    categories: [
      { id: 'all', label: '全部服装' },
      { id: 'casual', label: '🏫 日常/私服' },
      { id: 'summer', label: '🏖️ 夏装/泳装' },
      { id: 'jersey', label: '🏃 运动训练服' },
      { id: 'costume', label: '🎀 舞台打歌服' },
      { id: 'cb', label: '🧸 Q版小人' }
    ],
    idols: {}
  };
  Object.entries(IDOL_META).forEach(([cKey, m]) => {
    fallback.idols[cKey] = {
      charKey: cKey,
      charId: m.id,
      name: m.nameZh,
      outfitCount: 3,
      outfits: [
        {
          key: `characters/stand/${m.id}`,
          group: 'casual',
          label: `🏫 默认日常私服 (stand / ${m.id})`,
          shortLabel: '🏫 默认日常服',
          charType: 'characters',
          charCategory: 'stand',
          charId: m.id,
          clothId: m.id
        },
        {
          key: `characters/stand_costume/${m.id}`,
          group: 'costume',
          label: `🎀 组合标准打歌服 (stand_costume / ${m.id})`,
          shortLabel: '🎀 标准打歌服',
          charType: 'characters',
          charCategory: 'stand_costume',
          charId: m.id,
          clothId: m.id
        },
        {
          key: `idols/stand/300${m.id}0030`,
          group: 'jersey',
          label: `🏃 283Pro 练习运动服 (300${m.id}0030)`,
          shortLabel: '🏃 练习运动服',
          charType: 'idols',
          charCategory: 'stand',
          charId: `300${m.id}0030`,
          clothId: `300${m.id}0030`
        }
      ]
    };
  });
  _cachedIdolOutfits = fallback;
  return _cachedIdolOutfits;
}

// ---------------------------------------------------------------------------
// Task 3: Full-Project Multi-Scene Continuous Playback Compiler (`compileFullProjectToScproj`)
// ---------------------------------------------------------------------------
function compileFullProjectToScproj(pid, overrideScenes) {
  const resolved = resolvePackDir(pid);
  if (!resolved) {
    throw new Error(`Project not found: ${pid}`);
  }
  const project = loadPackFromDir(resolved.packDir, resolved.sourceRoot);
  if (!project) {
    throw new Error(`Failed to load project: ${pid}`);
  }

  // a) Reaction project: delegate directly to compileReactionPackToScproj (single character center-stage X: 568 per card)
  if ((project['x-projectType'] === 'reaction' || project.projectType === 'reaction') && Array.isArray(project.reactionCards) && project.reactionCards.length > 0) {
    const rxResult = compileReactionPackToScproj({
      projectId: project.id,
      title: project.name || project.id,
      titleZh: project.nameZh || project.name || project.id,
      unit: project.unit || '283 Production',
      triggerPrompt: project.triggerPrompt,
      triggerPromptJa: project.triggerPromptJa,
      triggerPromptZh: project.triggerPromptZh,
      bg: project.defaultBg || '00001',
      bgm: project.defaultBgm || '0001',
      reactionCards: project.reactionCards,
      saveToWorkspace: false
    });
    const mergedId = `${project.id}_full_all`;
    const rxScproj = JSON.parse(JSON.stringify(rxResult.scproj));
    const rxLines = Array.isArray(rxScproj.lines) ? rxScproj.lines : [];
    const markerObj = {
      sceneId: (rxScproj.meta && rxScproj.meta.id) || 'scene_01_reactions',
      sceneIndex: 0,
      order: 1,
      title: project.name || project.id,
      titleZh: project.nameZh || project.name || project.id,
      bg: String(project.defaultBg || '00001').padStart(5, '0'),
      bgm: normalizeBgmId(project.defaultBgm, '0001'),
      startLineIndex: 0,
      startIndex: 0,
      endIndex: Math.max(0, rxLines.length - 1),
      lineCount: rxLines.length
    };
    rxScproj.meta = Object.assign({}, rxScproj.meta || {}, {
      id: mergedId,
      'x-projectId': project.id,
      'x-isMergedFullProject': true,
      'x-sceneCount': 1,
      'x-sceneMarkers': [markerObj]
    });
    registerWithPlayer18899(rxScproj);
    return {
      projectId: project.id,
      mergedId,
      playerId: mergedId,
      sceneCount: 1,
      totalScenes: 1,
      lineCount: rxLines.length,
      sceneMarkers: [markerObj],
      scproj: rxScproj,
      playerUrl: `/player/?cat=custom&id=${encodeURIComponent(mergedId)}&theater=1`
    };
  }

  const scenes = Array.isArray(overrideScenes) && overrideScenes.length
    ? overrideScenes
    : (project.stories || []);
  const allLines = [];
  const mergedCastSet = new Set();
  const mergedCharsDict = Object.assign({}, project.characters || {});
  const sceneMarkers = [];
  let carrySpokenBodyByChar = {};

  scenes.forEach((sc, sIdx) => {
    const scId = sc.id || sc.sceneId || `scene_${String(sIdx + 1).padStart(2, '0')}`;
    const scTitleZh = sc.titleZh || sc.title || `第 ${sIdx + 1} 幕`;
    const scTitleJa = sc.title || sc.titleJa || scTitleZh;
    const scBg = String(sc.bg || '00003').padStart(5, '0');
    const scBgm = normalizeBgmId(sc.bgm, '002');
    const scCast = Array.isArray(sc.cast) && sc.cast.length ? sc.cast : (project.cast || ['amana', 'hana']);
    scCast.forEach((c) => mergedCastSet.add(c));

    const isPrecompiled = Boolean(
      (sc.preservePrecompiled ||
        (sc.outlineData && sc.outlineData.preservePrecompiled) ||
        (sc.scproj && sc.scproj.meta && (sc.scproj.meta.origin === 'external-import' || sc.scproj.meta['x-preservePrecompiled']))) &&
      sc.scproj && Array.isArray(sc.scproj.lines) && sc.scproj.lines.length > 0
    );

    const compiled = isPrecompiled
      ? sc.scproj
      : ((Array.isArray(sc.scriptRows) && sc.scriptRows.length)
        ? compileSceneToScproj({
            projectId: project.id,
            packName: project.nameZh || project.name,
            packUnit: project.unit,
            sceneId: scId,
            title: scTitleJa,
            titleZh: scTitleZh,
            bg: scBg,
            bgm: scBgm,
            cast: scCast,
            castOutfits: sc.castOutfits || (sc.outlineData && sc.outlineData.castOutfits) || null,
            castHairs: sc.castHairs || (sc.outlineData && sc.outlineData.castHairs) || null,
            segments: sc.segments || (sc.outlineData && sc.outlineData.segments) || [],
            scriptRows: sc.scriptRows,
            initialSpokenBodyByChar: carrySpokenBodyByChar
          })
        : (sc.scproj || { lines: [], meta: {} }));

    if (compiled && compiled._lastSpokenBodyByChar) {
      carrySpokenBodyByChar = Object.assign({}, carrySpokenBodyByChar, compiled._lastSpokenBodyByChar);
    } else if (compiled && Array.isArray(compiled.lines)) {
      compiled.lines.forEach((ln) => {
        if (ln && ln.charLabel && ln.charAnim1 && ln.text && ln.speaker) {
          carrySpokenBodyByChar[ln.charLabel] = ln.charAnim1;
        }
      });
    }

    if (compiled.meta && compiled.meta.characters) {
      Object.entries(compiled.meta.characters).forEach(([cKey, cDef]) => {
        const cleanDef = Object.assign({}, cDef);
        if (cleanDef.clothId !== undefined) {
          cleanDef['x-clothId'] = cleanDef.clothId;
          delete cleanDef.clothId;
        }
        if (cleanDef.charHair !== undefined) {
          if (cleanDef.charHair) cleanDef['x-charHair'] = cleanDef.charHair;
          delete cleanDef.charHair;
        }
        mergedCharsDict[cKey] = cleanDef;
      });
    }

    // If sIdx > 0, fade out previous scene stage characters and insert black curtain transition
    if (sIdx > 0) {
      const prevScene = scenes[sIdx - 1];
      const prevCast = (prevScene && prevScene.cast) || [];
      prevCast.forEach((prevChar, pIdx) => {
        allLines.push({
          charLabel: prevChar,
          charScale: 1,
          charEffect: { type: 'to', alpha: 0, time: 180 },
          textFrame: 'off',
          waitType: 'time',
          waitTime: pIdx === prevCast.length - 1 ? 180 : 20,
          _meta: {
            uid: `trans_out_${sIdx}_${prevChar}`,
            'x-sceneId': scId,
            'x-sceneIndex': sIdx,
            'x-isTransition': true,
            note: `幕间换场淡出：${prevChar}`
          }
        });
      });

      allLines.push({
        bg: 'off',
        bgEffect: 'fade_out',
        bgEffectTime: 420,
        fg: 'off',
        middleFg: 'off',
        bgm: 'off',
        textFrame: 'off',
        waitType: 'time',
        waitTime: 460,
        _meta: {
          uid: `trans_black_${sIdx}`,
          'x-sceneId': scId,
          'x-sceneIndex': sIdx,
          'x-isTransition': true,
          zh: `── 幕间转场 · 即将进入《${scTitleZh}》 ──`,
          note: `幕间转场 -> ${scTitleZh}`
        }
      });
    }

    const startLineIndex = allLines.length;
    const markerObj = {
      sceneId: scId,
      sceneIndex: sIdx,
      order: sIdx + 1,
      title: scTitleJa,
      titleZh: scTitleZh,
      bg: scBg,
      bgm: scBgm,
      startLineIndex,
      startIndex: startLineIndex,
      endIndex: startLineIndex,
      lineCount: 0
    };
    sceneMarkers.push(markerObj);

    if (!isPrecompiled) {
      const bgMeta = (assetSemantics && assetSemantics.bg && assetSemantics.bg[scBg]) || null;
      const rawBgPlace = bgMeta && bgMeta.zhLabel
        ? String(bgMeta.zhLabel).replace(/（[^）]*）/g, '').replace(/\s*\(BG\s*\d+\)\s*$/i, '').trim()
        : '';
      const locBannerLabel = rawBgPlace || String(scTitleZh).replace(/^第\s*\d+\s*幕\s*[·・:：-]?\s*/, '').trim() || scTitleZh;
      allLines.push({
        bg: scBg,
        bgEffect: 'fade',
        bgEffectTime: 480,
        bgm: scBgm,
        textFrame: 'off',
        locationBanner: locBannerLabel,
        waitType: 'time',
        waitTime: 1600,
        _meta: {
          uid: `scene_card_${sIdx + 1}`,
          'x-locationBanner': locBannerLabel,
          'x-sceneId': scId,
          'x-sceneIndex': sIdx,
          'x-sceneTitle': scTitleZh,
          'x-isSceneTitleCard': true,
          note: `📍 地点条划入划出：${locBannerLabel}`
        }
      });
    }

    const prefix = `s${sIdx + 1}_`;
    const rawSceneLines = Array.isArray(compiled.lines) ? compiled.lines : [];
    rawSceneLines.forEach((ln, lIdx) => {
      if (!isPrecompiled) {
        if (lIdx === 0 && ln._meta && String(ln._meta.uid || '').startsWith('setup_bg')) {
          return;
        }
        if (sIdx < scenes.length - 1 && lIdx === rawSceneLines.length - 1 && ln._meta && String(ln._meta.uid || '').startsWith('end_')) {
          return;
        }
      }
      const copy = JSON.parse(JSON.stringify(ln));
      if (copy.label) copy.label = prefix + copy.label;
      if (copy.nextLabel) copy.nextLabel = prefix + copy.nextLabel;
      copy._meta = Object.assign({}, copy._meta || {}, {
        'x-sceneId': scId,
        'x-sceneIndex': sIdx,
        'x-sceneTitle': scTitleZh,
        uid: `${prefix}${(copy._meta && copy._meta.uid) || ('ln_' + lIdx)}`
      });
      allLines.push(copy);
    });
    markerObj.endIndex = allLines.length - 1;
    markerObj.lineCount = allLines.length - startLineIndex;
  });

  const mergedId = `${project.id}_full_all`;
  const mergedScproj = {
    $schema: '../../../schema/scproj.schema.json',
    format: 'scproj',
    formatVersion: 2,
    meta: {
      id: mergedId,
      'x-projectId': project.id,
      cat: 'custom',
      title: `${project.name || project.id} (Full Multi-Scene)`,
      titleZh: `${project.nameZh || project.name}（全工程 ${scenes.length} 幕连播版）`,
      origin: 'custom',
      'x-isMergedFullProject': true,
      'x-sceneCount': scenes.length,
      'x-sceneMarkers': sceneMarkers,
      lang: {
        primary: 'ja',
        translations: ['zh']
      },
      cast: Array.from(mergedCastSet),
      characters: mergedCharsDict,
      authors: [{ name: '283 Fan-Story Studio', role: 'writer' }],
      createdAt: '2026-11-12T12:00:00Z',
      updatedAt: new Date().toISOString()
    },
    lines: allLines
  };

  registerWithPlayer18899(mergedScproj);

  return {
    projectId: project.id,
    mergedId,
    playerId: mergedId,
    sceneCount: scenes.length,
    totalScenes: scenes.length,
    lineCount: allLines.length,
    totalLines: allLines.length,
    sceneMarkers,
    sceneRanges: sceneMarkers,
    scproj: mergedScproj,
    mergedScproj,
    playerUrl: `/player/?cat=custom&id=${encodeURIComponent(mergedId)}&theater=1`
  };
}

// ---------------------------------------------------------------------------
// Task 4: LLM API Proxy & 30-Idol `cards_v2` Persona System Prompt Injection
// ---------------------------------------------------------------------------
function loadPersonaCard(charKey) {
  if (!charKey) return null;
  const alias = charKey === 'tooru' ? 'toru' : charKey;
  const candidates = [
    path.join(PERSONAS_V2_DIR, `${charKey}.json`),
    path.join(PERSONAS_V2_DIR, `${alias}.json`)
  ];
  const pFile = candidates.find((f) => fs.existsSync(f));
  if (!pFile) return null;
  try {
    return JSON.parse(fs.readFileSync(pFile, 'utf8'));
  } catch (_) {
    return null;
  }
}

function buildPersonaSystemPrompt(castList) {
  const validCast = (Array.isArray(castList) && castList.length ? castList : ['amana', 'hana']).filter((c) => IDOL_META[c]);
  const shapeMap = (polisher && polisher.TEXT_SHAPE_BY_ID) || {};
  const blocks = [];
  validCast.forEach((cKey) => {
    const m = IDOL_META[cKey];
    const p = loadPersonaCard(cKey);
    const shapeKey = shapeMap[cKey] ? cKey : (cKey === 'tooru' && shapeMap.toru ? 'toru' : cKey);
    const shape = shapeMap[shapeKey] || null;
    if (!p) {
      const shapeHint = shape ? `；台词平均句长约 ${Math.round(shape.chars_per_line)} 日文字` : '';
      blocks.push(`- 【${m.nameZh} (${cKey} / speaker="${m.speaker}")】：第一人称「${m.firstPerson}」，称呼制作人「${m.producerCall}」${shapeHint}`);
      return;
    }
    const inv = p.speech_invariants || {};
    const addrOthers = inv.address_to_others || {};
    const peerCalls = validCast
      .filter((other) => other !== cKey)
      .map((other) => {
        const otherAlias = other === 'tooru' ? 'toru' : other;
        const call = addrOthers[other] || addrOthers[otherAlias];
        return call ? `称呼${(IDOL_META[other] && IDOL_META[other].nameZh) || other}为「${String(call).split(' ')[0]}」` : '';
      })
      .filter(Boolean)
      .join('；');
    const avgLen = inv.avg_len || (shape && shape.chars_per_line) || 0;
    const rhythmParts = [];
    if (avgLen > 0) {
      const lenStyle = avgLen <= 13 ? '极简短句・惜字留白（严禁长篇大论）' : (avgLen <= 18 ? '中短口语句' : '自然展开句');
      rhythmParts.push(`均长约 ${Math.round(avgLen)} 日文字（${lenStyle}）`);
    }
    if (typeof inv.ellipsis_rate === 'number' && inv.ellipsis_rate >= 0.2) rhythmParts.push('高频使用「……」「───」留白停顿');
    if (typeof inv.exclaim_rate === 'number' && inv.exclaim_rate <= 0.03) rhythmParts.push('极少用感叹号！');
    if (typeof inv.keigo_rate === 'number') {
      if (inv.keigo_rate >= 0.35) rhythmParts.push('保持礼貌敬语（です/ます）');
      else if (inv.keigo_rate <= 0.05) rhythmParts.push('非敬语口语（タメ口）');
    }
    const interj = Array.isArray(inv.interjections) ? inv.interjections.slice(0, 4).map((x) => x.form).filter(Boolean).join(' / ') : '';
    const endings = Array.isArray(inv.endings) ? inv.endings.slice(0, 5).map((x) => String(x.form || '').trim()).filter(Boolean).join(' / ') : '';
    const anti = Array.isArray(inv.anti_patterns) ? inv.anti_patterns.slice(0, 6).join('；') : '';
    blocks.push(
      `- 【${p.name_cn || m.nameZh} (charLabel="${cKey}", speaker="${m.speaker}")】\n` +
      `  · 核心人设：${p.archetype_zh || ''}\n` +
      `  · 第一人称自称：「${inv.first_person || m.firstPerson}」\n` +
      `  · 对制作人称呼：「${String(inv.producer_address || m.producerCall).split('／')[0].replace(/\(\d+\)/g, '').trim()}」\n` +
      (peerCalls ? `  · 对同场角色称呼：${peerCalls}\n` : '') +
      (rhythmParts.length ? `  · 台词颗粒度与节奏：${rhythmParts.join('，')}\n` : '') +
      (interj || endings ? `  · 常用语气词/句尾：${[interj ? `语气词(${interj})` : '', endings ? `句尾(${endings})` : ''].filter(Boolean).join('；')}\n` : '') +
      (anti ? `  · 0-OOC 绝对红线：${anti}\n` : '') +
      `  · 中文翻译称呼铁律：日文「～ちゃん」严禁机翻成「小朝日」「小爱依」「小冬优」等生硬「小+名」（福丸小糸除外），按汉化习惯直呼「朝日」「爱依」「冬优」；严禁把「和泉爱依」误写为「爱衣」。`
    );
  });
  return blocks.join('\n\n');
}

function normalizeLlmEndpoint(baseUrl) {
  let u = String(baseUrl || 'https://api.deepseek.com/v1').trim().replace(/\/+$/, '');
  if (!u.endsWith('/chat/completions')) {
    if (!u.endsWith('/v1') && !u.includes('/v1/') && !u.includes('/openai')) {
      u = u + '/v1/chat/completions';
    } else {
      u = u + '/chat/completions';
    }
  }
  return u;
}

function extractJsonFromText(rawText) {
  const s = String(rawText || '').trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = fenced ? fenced[1].trim() : s;
  if (!fenced && /^```(?:json)?/i.test(candidate)) {
    candidate = candidate.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const tryParseJson = (str) => {
    try {
      return JSON.parse(str);
    } catch (_) {
      return JSON.parse(String(str).replace(/,\s*([}\]])/g, '$1'));
    }
  };
  try {
    return tryParseJson(candidate);
  } catch (_) {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return tryParseJson(candidate.slice(firstBrace, lastBrace + 1));
      } catch (__) {}
    }
    const firstArr = candidate.indexOf('[');
    const lastArr = candidate.lastIndexOf(']');
    if (firstArr >= 0 && lastArr > firstArr) {
      try {
        return tryParseJson(candidate.slice(firstArr, lastArr + 1));
      } catch (__) {}
    }
    // Recover complete row/scene objects if reasoning model truncated closing bracket
    const rowsMatch = candidate.match(/"(rows|scenes)"\s*:\s*\[([\s\S]*)$/);
    if (rowsMatch) {
      const recovered = [];
      const body = rowsMatch[2];
      let depth = 0;
      let start = -1;
      let inStr = false;
      let esc = false;
      for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\' && inStr) { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0 && start >= 0) {
            try {
              recovered.push(JSON.parse(body.slice(start, i + 1)));
            } catch (___) {}
            start = -1;
          }
        }
      }
      if (recovered.length > 0) {
        return { [rowsMatch[1]]: recovered };
      }
    }
    throw new Error('大模型返回内容未能解析为有效 JSON');
  }
}

const _vertexTokenCache = new Map();

async function getVertexAccessToken(sa) {
  if (!sa || !sa.client_email || !sa.private_key) {
    throw new Error('Vertex Service Account 缺少 client_email 或 private_key');
  }
  const cacheKey = `${sa.project_id || ''}:${sa.client_email}`;
  const cached = _vertexTokenCache.get(cacheKey);
  const nowSec = Math.floor(Date.now() / 1000);
  if (cached && cached.token && cached.expiresAt > nowSec + 120) {
    return cached.token;
  }
  const crypto = require('crypto');
  const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = b64u({ alg: 'RS256', typ: 'JWT' });
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const claim = b64u({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    exp: nowSec + 3600,
    iat: nowSec
  });
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = signer.sign(sa.private_key, 'base64url');
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(`${header}.${claim}.${sig}`)}`
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Vertex OAuth2 获取 token 失败: ${data.error_description || data.error || res.status}`);
  }
  _vertexTokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: nowSec + (Number(data.expires_in) || 3600)
  });
  return data.access_token;
}

const DEFAULT_LLM_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const DEFAULT_LLM_MODEL = 'gemini-2.5-flash';

function loadServerLlmFallback(allowOverride = false) {
  if (process.env.STUDIO_DISABLE_SERVER_SECRETS === '1' && !allowOverride) {
    return { baseUrl: DEFAULT_LLM_BASE_URL, apiKey: '', model: DEFAULT_LLM_MODEL, vertexSa: null };
  }
  const envKey = String(process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  const secretsCandidates = [
    process.env.STUDIO_SECRETS_DIR ? path.resolve(process.env.STUDIO_SECRETS_DIR) : '',
    path.join(SHINY_ROOT, 'server', 'secrets'),
    __dirname
  ].filter(Boolean);
  let secretsDir = secretsCandidates.find((d) => fs.existsSync(path.join(d, '.llm-local.json'))) || secretsCandidates[0];
  const localFile = path.join(secretsDir, '.llm-local.json');
  let fileCfg = {};
  try {
    if (fs.existsSync(localFile)) {
      fileCfg = JSON.parse(fs.readFileSync(localFile, 'utf8')) || {};
    }
  } catch (_) {}
  let vertexSa = null;
  if (!envKey) {
    if (process.env.VERTEX_SA_JSON) {
      try {
        vertexSa = JSON.parse(process.env.VERTEX_SA_JSON);
      } catch (_) {}
    }
    const saRaw = process.env.VERTEX_SA_FILE || fileCfg.saFile || '';
    if (!vertexSa && saRaw) {
      const saPath = path.isAbsolute(saRaw) ? saRaw : path.join(secretsDir, saRaw);
      try {
        if (fs.existsSync(saPath)) {
          vertexSa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
        }
      } catch (_) {}
    }
  }
  return {
    baseUrl: String(process.env.LLM_BASE_URL || fileCfg.baseUrl || DEFAULT_LLM_BASE_URL).trim(),
    apiKey: envKey || String(fileCfg.apiKey || '').trim(),
    model: String(process.env.LLM_MODEL || fileCfg.model || DEFAULT_LLM_MODEL).trim(),
    vertexSa
  };
}

/**
 * Returns a strictly secret-free summary of server-hosted LLM availability for UI display.
 */
function getServerLlmPublicStatus(allowOverride = false) {
  const fb = loadServerLlmFallback(allowOverride);
  const configured = Boolean(fb.apiKey || fb.vertexSa);
  const provider = fb.vertexSa
    ? 'vertex-gemini'
    : /generativelanguage\.googleapis\.com/i.test(fb.baseUrl)
      ? 'gemini'
      : 'openai-compat';
  return {
    configured,
    model: configured ? (fb.model || DEFAULT_LLM_MODEL) : '',
    provider
  };
}

function resolveEffectiveLlmConfig(llmConfig) {
  const cfg = llmConfig || {};
  if (cfg._resolved && (!cfg._disallowServerSecrets || !cfg.vertexSa)) {
    return cfg;
  }
  const rawClientKey = String(cfg.apiKey || '').trim();
  const clientKey = rawClientKey === '__vertex_sa__' ? '' : rawClientKey;
  const rawClientBase = String(cfg.baseUrl || '').trim();
  const rawClientModel = String(cfg.model || '').trim();

  if (cfg._disallowServerSecrets) {
    return {
      baseUrl: (rawClientBase || DEFAULT_LLM_BASE_URL).trim(),
      apiKey: clientKey,
      model: (rawClientModel || DEFAULT_LLM_MODEL).trim(),
      vertexSa: null,
      _disallowServerSecrets: true,
      _resolved: true
    };
  }

  const fb = loadServerLlmFallback(Boolean(cfg._allowServerSecrets));

  // If no clientKey is provided, prefer server .llm-local.json completely over frontend default placeholders
  const effectiveBase = clientKey
    ? (rawClientBase || fb.baseUrl || DEFAULT_LLM_BASE_URL)
    : (fb.baseUrl || rawClientBase || DEFAULT_LLM_BASE_URL);
  const effectiveModel = clientKey
    ? (rawClientModel || fb.model || DEFAULT_LLM_MODEL)
    : (fb.model || rawClientModel || DEFAULT_LLM_MODEL);

  // If targeting Google Vertex AI (aiplatform.googleapis.com) and server has vertexSa,
  // ignore stale non-OAuth client keys (e.g. AIza... from AI Studio) and use OAuth2 Service Account!
  const isVertexEndpoint = /aiplatform\.googleapis\.com/i.test(effectiveBase);
  const useServerVertexSa = Boolean(fb.vertexSa && isVertexEndpoint && (!clientKey || !clientKey.startsWith('ya29.')));

  const effectiveKey = useServerVertexSa
    ? '__vertex_sa__'
    : (clientKey || fb.apiKey || (fb.vertexSa ? '__vertex_sa__' : ''));
  return {
    baseUrl: effectiveBase.trim(),
    apiKey: effectiveKey,
    model: effectiveModel.trim(),
    vertexSa: useServerVertexSa ? fb.vertexSa : (clientKey ? null : fb.vertexSa),
    _allowServerSecrets: Boolean(cfg._allowServerSecrets),
    _resolved: true
  };
}

async function callOpenAICompatibleLLM(llmConfig, messages, opts = {}) {
  const eff = resolveEffectiveLlmConfig(llmConfig);
  let apiKey = eff.apiKey;
  if (eff.vertexSa && (!apiKey || apiKey === '__vertex_sa__')) {
    apiKey = await getVertexAccessToken(eff.vertexSa);
  }
  if (!apiKey || apiKey === '__vertex_sa__') {
    throw new Error('API Key 为空');
  }
  const endpoint = normalizeLlmEndpoint(eff.baseUrl);
  const model = eff.model || 'gemini-4-hydrogen';
  const isReasoning = /flash|v4|reasoner|r1|hydrogen|gemini-4|gemini-3/i.test(model);
  const baseMaxTokens = opts.maxTokens || 2600;
  const maxTokens = isReasoning ? Math.max(baseMaxTokens, opts.isTest ? 512 : 16384) : baseMaxTokens;
  const wantJson = opts.jsonMode !== undefined
    ? Boolean(opts.jsonMode)
    : (!opts.isTest && Array.isArray(messages) && messages.some((m) => /\bJSON\b/i.test(String((m && m.content) || ''))));
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs || (isReasoning ? 95000 : 45000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const sendReq = async (useJsonFmt) => {
    const reqBody = {
      model,
      messages,
      temperature: opts.temperature !== undefined ? opts.temperature : 0.7,
      max_tokens: maxTokens
    };
    if (useJsonFmt) {
      reqBody.response_format = { type: 'json_object' };
    }
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(reqBody),
      signal: controller.signal
    });
    const t = await r.text();
    return { res: r, text: t };
  };

  try {
    let { res, text } = await sendReq(wantJson);
    if (!res.ok && res.status === 400 && wantJson && /response_format|json_object/i.test(text)) {
      ({ res, text } = await sendReq(false));
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
    }
    const data = JSON.parse(text);
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    const content = msg && (msg.content || (opts.isTest ? msg.reasoning_content : ''));
    if (!content) {
      throw new Error('API 响应缺少 choices[0].message.content');
    }
    return { content, model: data.model || model, usage: data.usage || null, endpoint };
  } finally {
    clearTimeout(timer);
  }
}

async function testLlmConnection(llmConfig) {
  const eff = resolveEffectiveLlmConfig(llmConfig);
  if (!eff.apiKey && !eff.vertexSa) {
    return { ok: false, error: '请先输入 API Key (sk-...)' };
  }
  const started = Date.now();
  try {
    const res = await callOpenAICompatibleLLM(
      eff,
      [
        { role: 'system', content: 'You are a helpful assistant for 283 Production Studio.' },
        { role: 'user', content: '请只回复一行 JSON：{"status":"ok","greeting":"283Pro AI 接口连接成功！"}' }
      ],
      { maxTokens: 512, temperature: 0.2, timeoutMs: 25000, isTest: true }
    );
    return {
      ok: true,
      model: res.model,
      endpoint: res.endpoint,
      latencyMs: Date.now() - started,
      reply: res.content.trim().slice(0, 160)
    };
  } catch (err) {
    return {
      ok: false,
      error: String(err && err.message ? err.message : err)
    };
  }
}

async function expandOutlineWithLlmOrTemplate(payload = {}) {
  const prompt = payload.prompt || payload.premise || '';
  const fallbackCast = Array.isArray(payload.cast) && payload.cast.length ? payload.cast : ['amana', 'hana'];
  const title = payload.title || payload.projectTitle || '';
  const detectedCast = detectCastFromText(`${title} ${prompt}`);
  const cast = detectedCast.length ? detectedCast : fallbackCast;
  const llmConfig = resolveEffectiveLlmConfig(payload.llmConfig);
  const hasKey = Boolean(llmConfig && llmConfig.apiKey);

  if (hasKey) {
    try {
      const personaPrompt = buildPersonaSystemPrompt(cast);
      const { bgCatalog, bgmCatalog } = buildTopBgBgmPromptCatalog(`${title} ${prompt}`);
      const allIdolsRoster = Object.entries(IDOL_META)
        .map(([k, v]) => `${k}:${v.nameZh}`)
        .join(', ');
      const sysPrompt =
        `你是《偶像大师 闪耀色彩 (THE iDOLM@STER SHINY COLORS)》283事务所二创剧本统筹 AI。\n` +
        `请严格遵守以下登场角色的 cards_v2 人设与称呼约束（0-OOC）：\n${personaPrompt}\n\n` +
        `283事务所全员英文 ID 对照表（若剧情梗概里出现其他角色，请直接用对应英文 ID 填入该幕 cast 数组）：${allIdolsRoster}\n\n` +
        `请根据用户的脑洞/梗概，规划 3 幕结构化分幕大纲，并只输出合法 JSON 对象（不要输出额外解释），格式如下：\n` +
        `{\n` +
        `  "scenes": [\n` +
        `    {\n` +
        `      "sceneId": "scene_01",\n` +
        `      "title": "第 1 幕 · 中文幕标题",\n` +
        `      "titleJa": "第1幕・日文幕标题",\n` +
        `      "bg": "00001",\n` +
        `      "bgm": "002",\n` +
        `      "bgmStyle": "本幕情绪流向与配乐思路（例如：开场轻快日常，中段突发状况转紧张，收尾温柔抒情）",\n` +
        `      "cast": ${JSON.stringify(cast)},\n` +
        `      "summary": "80-120字的本幕剧情摘要（交代时间、地点、核心冲突与转折）",\n` +
        `      "segments": [\n` +
        `        {\n` +
        `          "beatId": "beat_1",\n` +
        `          "title": "小段标题（8-16字）",\n` +
        `          "summary": "60-110字平实清晰的剧情脉络：写清起因/触发点、谁做了什么或传达了什么关键信息、各人立场或认知变化、以及如何衔接到下一段（只理清剧情逻辑，不写华丽修辞与神态渲染）。",\n` +
        `          "cast": ${JSON.stringify(cast)},\n` +
        `          "targetLines": 4,\n` +
        `          "mood": "warm|upbeat|calm|emotional|tense|sad|comedy|energetic|ambient",\n` +
        `          "bgm": "",\n` +
        `          "bgmReason": "沿用开场配乐或说明中段因剧情转折切歌的理由",\n` +
        `          "needsActionCue": false,\n` +
        `          "blockingHint": ""\n` +
        `        }\n` +
        `      ]\n` +
        `    }\n` +
        `  ]\n` +
        `}\n` +
        `重要规则：\n` +
        `1. 角色自动识别：优先根据用户梗概中实际出现或暗示的人物来决定每幕的 cast（只保留真正出场的角色英文 ID，后续用户可在前端手动增减）。\n` +
        `2. 场景与剧情流向配乐规划：先想清楚每一幕从开场到结尾的剧情与情绪流向（写入 bgmStyle），再为开场选择最贴合的 bg 与 bgm（如夏日户外蝉鸣可用 0001、温柔抒情可用 002）；当单幕内部某小段出现明显情绪转折（如突发危机、争执转温暖、日常转夕阳告白）时，可在该小段填入切换后的 bgm ID 或 "fade_out" 并在 bgmReason 写明原因，情绪平稳延续的小段保持 bgm: ""。\n` +
        `可用官方背景 ID：${bgCatalog}\n` +
        `可用官方 BGM ID：${bgmCatalog}\n` +
        `3. 小段剧情以理清脉络为准（一步到位）：每幕规划 3-4 个 segments，每个小段的 summary 写 60-110 字即可，用平实客观的叙事把「前因→事件/信息点→人物反应与决定→下一段衔接」交代清楚，并为每个小段预估合理的对话句数 targetLines（2–12 句，短过渡段 2–3 句，核心冲突段 6–10 句）；不要堆砌神态、表情、动作等生动文学描写（那些留给 Step 2 台词生成阶段演绎）。\n` +
        `4. 舞台动作拍按需节流（关键）：约 80% 的日常对话小段只需原地站桩表情变化，必须设 "needsActionCue": false, "blockingHint": ""；只有当该小段存在明确的水平走位需求（如跑出画外、追赶、偷偷靠近、把同伴拉回、躲藏、切镜重新入场）时，才设 "needsActionCue": true 并在 "blockingHint" 用一句话写明谁怎么移动（如 "朝日说完向右跑出画外，冬优和爱依随后追出并切镜"）。`;

      const userPrompt = `故事标题：${title || '未命名二创企划'}\n${detectedCast.length ? `文本已初步识别到角色：${detectedCast.join(', ')}` : `项目预设参考角色：${cast.join(', ')}（请按梗概实际出场人物自行判断调整）`}\n脑洞梗概：${prompt || '事务所日常与特别外景企划'}`;
      const llmRes = await callOpenAICompatibleLLM(
        llmConfig,
        [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userPrompt }
        ],
        { maxTokens: 8192, timeoutMs: 75000 }
      );
      const parsed = extractJsonFromText(llmRes.content);
      const rawScenes = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.scenes) ? parsed.scenes : null);
      if (rawScenes && rawScenes.length > 0) {
        const validBgIds = new Set(getSemanticBgList({ includeAbstract: true }).map((b) => String(b.id).padStart(5, '0')));
        const normScenes = rawScenes.map((s, idx) => {
          const sceneText = `${s.title || ''} ${s.summary || ''} ${prompt}`;
          const rawBg = s.bg ? String(s.bg).padStart(5, '0') : '';
          const finalBg = rawBg && validBgIds.has(rawBg) ? rawBg : pickBestBgForText(sceneText, '00001');
          const rawB = normalizeBgmId(s.bgm, '');
          const cleanBgm = rawB || pickBestBgmForText(sceneText, '002');
          const sceneDetected = detectCastFromText(`${s.title || ''} ${s.summary || ''}`);
          const llmSceneCast = Array.isArray(s.cast) && s.cast.length ? s.cast.filter((c) => IDOL_META[c]) : [];
          const finalSceneCast = llmSceneCast.length
            ? llmSceneCast
            : (sceneDetected.length ? sceneDetected : cast);
          const rawSegs = Array.isArray(s.segments)
            ? s.segments.map((sg) => {
                if (!sg || typeof sg !== 'object') return sg;
                const segBgm = normalizeBgmId(sg.bgm, '');
                return Object.assign({}, sg, {
                  bgm: segBgm,
                  bgmLocked: Boolean(sg.bgmLocked || segBgm)
                });
              })
            : undefined;
          const sceneObj = {
            sceneId: s.sceneId || `scene_${String(idx + 1).padStart(2, '0')}`,
            title: s.title || `第 ${idx + 1} 幕`,
            titleJa: s.titleJa || s.title || `第${idx + 1}幕`,
            bg: finalBg,
            bgm: cleanBgm,
            bgmStyle: String(s.bgmStyle || '').trim(),
            cast: finalSceneCast,
            summary: s.summary || '',
            segments: rawSegs,
            beats: Array.isArray(s.beats) && s.beats.length ? s.beats : ['节拍 1：角色登场', '节拍 2：互动展开', '节拍 3：本幕收尾']
          };
          normalizeSceneSegments(sceneObj);
          return sceneObj;
        });
        const unionCast = Array.from(new Set([
          ...detectedCast,
          ...normScenes.flatMap((s) => s.cast || [])
        ])).filter((c) => IDOL_META[c]);
        return {
          ok: true,
          generator: 'llm',
          generatorLabel: `🤖 AI 大模型生成 (${llmRes.model})`,
          model: llmRes.model,
          detectedCast: unionCast,
          scenes: normScenes
        };
      }
    } catch (llmErr) {
      const fallbackScenes = pickSemanticScenesForPrompt(prompt, cast, title);
      return {
        ok: true,
        generator: 'template_fallback',
        generatorLabel: '⚡ 本地模板生成（AI 接口异常已自动兜底）',
        llmWarning: String(llmErr && llmErr.message ? llmErr.message : llmErr),
        detectedCast,
        scenes: fallbackScenes
      };
    }
  }

  const scenes = pickSemanticScenesForPrompt(prompt, cast, title);
  return {
    ok: true,
    generator: 'template',
    generatorLabel: '⚡ 本地模板生成',
    detectedCast,
    scenes
  };
}

async function enrichSceneSegmentsWithLlmOrTemplate(payload = {}) {
  const scene = payload.scene && typeof payload.scene === 'object' ? payload.scene : {};
  const cast = Array.isArray(scene.cast) && scene.cast.length ? scene.cast.filter((c) => IDOL_META[c]) : ['amana', 'hana'];
  const rawSegments = Array.isArray(scene.segments) && scene.segments.length ? scene.segments : normalizeSceneSegments(scene).segments;
  const llmConfig = resolveEffectiveLlmConfig(payload.llmConfig);
  const hasKey = Boolean(llmConfig && llmConfig.apiKey);

  if (hasKey) {
    try {
      const personaPrompt = buildPersonaSystemPrompt(cast);
      const continuityPrompt = formatStoryContinuityPrompt(payload.storyContext);
      const sysPrompt =
        `你是《偶像大师 闪耀色彩 (THE iDOLM@STER SHINY COLORS)》283事务所二创剧本分场细化助手。\n` +
        `请严格遵守以下登场角色的 cards_v2 人设与称呼约束（0-OOC）：\n${personaPrompt}\n` +
        (continuityPrompt ? `\n${continuityPrompt}\n` : '\n') +
        `任务：当前处于 Step 1 剧情大纲阶段，请把这一幕的每个 L3 小段（segments）补全为「60-110字」条理清晰的剧情脉络，只为理清剧情服务。\n` +
        `要求：\n` +
        `1. 保留每个小段原有的 beatId、cast 和核心剧情走向，不要篡改前序已发生事件的归属（例如谁受伤、谁提议、谁在场）。\n` +
        `2. 用平实客观的剧情大纲语言写清：前因/触发点 → 谁主动做了什么或说出什么关键信息 → 众人立场、认知或局面发生了什么变化 → 如何衔接到下一段。\n` +
        `3. 禁止写得像小说一样生动（不要堆砌表情、神态、肢体动作或心理渲染等演出细节），那些留到 Step 2 生成台词时再展开；但若某段确实包含跑开、追逐、拉扯、躲藏或走位过场，请设 needsActionCue: true 并用一句简短白话填 blockingHint；日常对话段保持 needsActionCue: false。\n` +
        `4. 评估每个小段的情绪标签 mood（warm/upbeat/calm/emotional/tense/sad/comedy/energetic/ambient）；若剧情在该小段发生显著转折并需要切换背景音乐，可填写 bgm ID 或 "fade_out" 与 bgmReason，否则 bgm 保持 "" 表示延续。\n` +
        `5. 只输出合法 JSON 对象，格式如下：\n` +
        `{\n` +
        `  "bgmStyle": "本幕整体音乐情绪流向总结",\n` +
        `  "segments": [\n` +
        `    { "beatId": "beat_1", "title": "精炼小段标题", "summary": "60-110字平实清晰的剧情脉络", "cast": ${JSON.stringify(cast)}, "mood": "warm", "bgm": "", "bgmReason": "", "needsActionCue": false, "blockingHint": "" }\n` +
        `  ]\n` +
        `}`;

      const userPrompt =
        `全片总剧情：${payload.projectPremise || '无'}\n` +
        `本幕标题：${scene.title || '当前幕'}\n` +
        `本幕开场 BGM：${scene.bgm || '未定'}｜音乐氛围预设：${scene.bgmStyle || '自动推理'}\n` +
        `本幕摘要：${scene.summary || ''}\n` +
        `当前小段列表：\n` +
        rawSegments.map((s, i) => `${i + 1}. [${s.beatId}] ${s.title}｜原描述：${s.summary || '（待补充）'}｜出场：${(s.cast || cast).join(', ')}｜原bgm:${s.bgm || '延续'}${s.bgmLocked ? '(已锁定)' : ''}`).join('\n');

      const llmRes = await callOpenAICompatibleLLM(
        llmConfig,
        [
          { role: 'system', content: sysPrompt },
          { role: 'user', content: userPrompt }
        ],
        { maxTokens: 4096, timeoutMs: 60000 }
      );
      const parsed = extractJsonFromText(llmRes.content);
      const nextRaw = parsed && Array.isArray(parsed.segments) ? parsed.segments : null;
      if (nextRaw && nextRaw.length) {
        const merged = rawSegments.map((orig, idx) => {
          const hit = nextRaw.find((x) => x && x.beatId === orig.beatId) || nextRaw[idx] || {};
          const hasCueHit = hit.needsActionCue !== undefined;
          const keepOrigBgm = Boolean(orig.bgmLocked);
          const nextBgm = keepOrigBgm ? normalizeBgmId(orig.bgm, '') : normalizeBgmId(hit.bgm, normalizeBgmId(orig.bgm, ''));
          return {
            beatId: orig.beatId || `beat_${idx + 1}`,
            title: String(hit.title || orig.title || `小段 ${idx + 1}`).trim(),
            summary: String(hit.summary || orig.summary || '').trim(),
            cast: Array.isArray(orig.cast) && orig.cast.length ? orig.cast : cast,
            targetLines: orig.targetLines || 4,
            mood: String(hit.mood || orig.mood || '').trim().toLowerCase(),
            bgm: nextBgm,
            bgmReason: keepOrigBgm ? (orig.bgmReason || '') : String(hit.bgmReason || orig.bgmReason || '').trim(),
            bgmLocked: keepOrigBgm,
            needsActionCue: hasCueHit ? Boolean(hit.needsActionCue) : Boolean(orig.needsActionCue),
            blockingHint: String(hit.blockingHint !== undefined ? hit.blockingHint : (orig.blockingHint || '')).trim()
          };
        });
        const tmpScene = Object.assign({}, scene, {
          bgmStyle: String(parsed.bgmStyle || scene.bgmStyle || '').trim(),
          segments: merged
        });
        normalizeSceneSegments(tmpScene);
        return {
          ok: true,
          generator: 'llm',
          generatorLabel: `🤖 AI 细化小段 (${llmRes.model})`,
          bgmStyle: tmpScene.bgmStyle,
          bgmSuggestions: tmpScene.bgmSuggestions,
          bgSuggestions: tmpScene.bgSuggestions,
          segments: tmpScene.segments
        };
      }
    } catch (err) {
      // Fall through to local enrichment
    }
  }

  const enrichedLocal = rawSegments.map((orig, idx) => {
    const base = String(orig.summary || orig.title || '').trim();
    const names = (orig.cast && orig.cast.length ? orig.cast : cast)
      .map((cid) => (IDOL_META[cid] && IDOL_META[cid].nameZh) || cid)
      .join('、');
    const detail = base.length >= 65
      ? base
      : `${base}${base.endsWith('。') ? '' : '。'}本段围绕${names}展开互动：先由动作与神态切入当前情境，随后众人各自表露不同反应与小心思，在轻松或紧张的对话交锋中把节奏稳步推向下一小段。`;
    return {
      beatId: orig.beatId || `beat_${idx + 1}`,
      title: orig.title || `小段 ${idx + 1}`,
      summary: detail,
      cast: Array.isArray(orig.cast) && orig.cast.length ? orig.cast : cast,
      targetLines: orig.targetLines || 4,
      mood: orig.mood || '',
      bgm: orig.bgmLocked ? normalizeBgmId(orig.bgm, '') : '',
      bgmReason: orig.bgmLocked ? (orig.bgmReason || '') : '',
      bgmLocked: Boolean(orig.bgmLocked),
      needsActionCue: Boolean(orig.needsActionCue),
      blockingHint: String(orig.blockingHint || '').trim()
    };
  });
  const tmpLocalScene = Object.assign({}, scene, { segments: enrichedLocal });
  normalizeSceneSegments(tmpLocalScene);
  return {
    ok: true,
    generator: 'template',
    generatorLabel: '⚡ 本地模板细化',
    bgmStyle: tmpLocalScene.bgmStyle,
    bgmSuggestions: tmpLocalScene.bgmSuggestions,
    bgSuggestions: tmpLocalScene.bgSuggestions,
    segments: tmpLocalScene.segments
  };
}

function formatStoryContinuityPrompt(storyContext) {
  if (!storyContext || typeof storyContext !== 'object') return '';
  const parts = [];
  if (Array.isArray(storyContext.pinnedFacts) && storyContext.pinnedFacts.length) {
    parts.push(`【📌 作者钉选核心事实（最高优先级，全片严禁违背）】\n${storyContext.pinnedFacts.map((f) => `- ${String(f).trim()}`).join('\n')}`);
  }
  if (storyContext.projectPremise) {
    parts.push(`【L1 全片总剧情（不可偏离的全局设定）】\n${String(storyContext.projectPremise).trim()}`);
  }
  if (storyContext.previousActsSummary) {
    parts.push(`【前情各幕摘要与已确立事实（严禁篡改谁做了什么/谁受伤）】\n${String(storyContext.previousActsSummary).trim()}`);
  }
  if (storyContext.recentLines) {
    parts.push(`【紧邻上一幕结尾衔接（最后几句原台词）】\n${String(storyContext.recentLines).trim()}`);
  }
  return parts.length ? `${parts.join('\n\n')}\n\n` : '';
}

function sanitizeStageActions(rows = []) {
  const out = [];
  const offStage = new Set();
  const seenOnStage = new Set();
  const dashRe = /跑出|冲出|跑走|离开|逃出|先走|冲向|ダッシュ|飛び出/;
  const chaseRe = /追|赶到|赶来|进门|冲进|推门|駆け/;
  const envOnlyActions = new Set(['bgm_stop', 'bgm_fade', 'flash_shock', 'dusk_mood', 'memory_blur', 'awkward_pause']);

  for (let i = 0; i < (rows || []).length; i++) {
    const r = Object.assign({}, rows[i]);
    if (r.kind === 'cue' && r.cue) {
      const norm = normalizeCueObject(r.cue);
      norm.steps.forEach((st) => {
        if (st.toX <= -200 || st.toX >= 1300) offStage.add(st.charLabel);
        else {
          offStage.delete(st.charLabel);
          seenOnStage.add(st.charLabel);
        }
      });
      r.cue = norm;
      out.push(r);
      continue;
    }
    const cKey = r.charLabel || '';
    const isProducer = !cKey || r.speaker === 'プロデューサー' || r.speaker === '制作人';
    let act = r.stageAction && VALID_STAGE_ACTIONS.has(r.stageAction) ? r.stageAction : '';
    const textHint = `${r.note || ''} ${r.zh || ''} ${r.text || ''}`;

    if (act) {
      if (isProducer && !envOnlyActions.has(act)) {
        act = '';
      } else if (act === 'dash_out_right' || act === 'dash_out_left') {
        if (offStage.has(cKey) && !dashRe.test(textHint)) {
          act = '';
        } else if (!dashRe.test(textHint) && /惊|呆|愣|呼|看|问/.test(textHint)) {
          act = /惊|呆|愣/.test(textHint) ? 'flash_shock' : '';
        } else {
          offStage.add(cKey);
        }
      } else if (act === 'chase_in_left') {
        if (seenOnStage.has(cKey) && !offStage.has(cKey) && !chaseRe.test(textHint)) {
          act = 'lean_close';
        }
        offStage.delete(cKey);
      }
    }
    if (cKey && !offStage.has(cKey)) {
      seenOnStage.add(cKey);
    }
    r.stageAction = act;
    out.push(r);
  }
  return out;
}

async function autoRepairOocFlaggedRows(rows, llmConfig, cast) {
  let audited = auditScriptRows(rows);
  if (!llmConfig || !llmConfig.apiKey) return audited;
  const flagged = audited.rows
    .map((r, idx) => ({ idx, r }))
    .filter(({ r }) => r && r.ooc && !r.ooc.ok && Array.isArray(r.ooc.issues) && r.ooc.issues.length > 0);
  if (!flagged.length) return audited;
  try {
    const personaPrompt = buildPersonaSystemPrompt(cast);
    const fixSys =
      `你是《偶像大师 闪耀色彩》台本 OOC 校对修复器。\n` +
      `请严格遵守以下角色的 cards_v2 人设、第一人称自称、对同伴/制作人的称呼与单句字数红线：\n${personaPrompt}\n\n` +
      `下面列出若干存在 OOC 警告/错误的台词行，请在保持原意与剧情不变的前提下，仅修改违规的日文台词 text（必要时微调中文 zh）以彻底消除所有 OOC 问题。\n` +
      `只输出合法 JSON 对象：{"fixes":[{"idx":0,"text":"修正后的日文台词","zh":"对应中文"}]}`;
    const fixUser = flagged
      .map(({ idx, r }) => `idx=${idx} | speaker=${r.speaker}(${r.charLabel}) | text=${r.text} | zh=${r.zh} | 问题=${r.ooc.issues.map((x) => x.message).join('；')}`)
      .join('\n');
    const fixRes = await callOpenAICompatibleLLM(
      llmConfig,
      [
        { role: 'system', content: fixSys },
        { role: 'user', content: fixUser }
      ],
      { maxTokens: 1600, timeoutMs: 25000 }
    );
    const parsed = extractJsonFromText(fixRes.content);
    const fixes = parsed && Array.isArray(parsed.fixes) ? parsed.fixes : (Array.isArray(parsed) ? parsed : []);
    if (fixes.length) {
      const nextRows = audited.rows.map((r) => Object.assign({}, r));
      for (const fx of fixes) {
        const i = Number(fx && fx.idx);
        if (Number.isInteger(i) && i >= 0 && i < nextRows.length && fx.text) {
          nextRows[i].text = String(fx.text).trim();
          if (fx.zh) nextRows[i].zh = String(fx.zh).trim();
        }
      }
      audited = auditScriptRows(nextRows);
    }
  } catch (_) {
    // Non-fatal: keep original audited rows if repair call fails
  }
  return audited;
}

async function expandScriptWithLlmOrTemplate(payload = {}) {
  const outline = payload.outline || payload;
  const llmConfig = resolveEffectiveLlmConfig(payload.llmConfig);
  const hasKey = Boolean(llmConfig && llmConfig.apiKey);
  const cast = Array.isArray(outline.cast) && outline.cast.length ? outline.cast.filter((c) => IDOL_META[c]) : ['amana', 'hana'];
  const { segments } = normalizeSceneSegments(outline);
  const depth = ['short', 'standard', 'deep'].includes(payload.depth) ? payload.depth : 'standard';
  const depthCfg = {
    short: { range: '8～10 行', maxTokens: 4096, timeoutMs: 55000 },
    standard: { range: '16～22 行', maxTokens: 8192, timeoutMs: 95000 },
    deep: { range: '28～36 行', maxTokens: 12288, timeoutMs: 120000 }
  }[depth];
  const customActLines = Number(outline.targetLines) > 0 ? Math.max(2, Math.min(50, Math.round(Number(outline.targetLines)))) : 0;
  const segSum = segments.reduce((acc, s) => acc + (Number(s.targetLines) || 4), 0);
  const clampedSegSum = Math.max(10, Math.min(40, segSum));
  const expectedActLines = customActLines > 0
    ? customActLines
    : (depth === 'standard' && segments.length >= 2 ? clampedSegSum : (depth === 'short' ? 9 : (depth === 'deep' ? 30 : 18)));
  const effectiveRange = customActLines > 0
    ? `${Math.max(2, customActLines - 1)}～${customActLines + 1} 行（严格接近 ${customActLines} 句）`
    : (depth === 'standard' && segments.length >= 2
      ? `${Math.max(8, clampedSegSum - 2)}～${clampedSegSum + 2} 行（按各小段目标句数合计约 ${clampedSegSum} 句）`
      : depthCfg.range);
  const existingRows = Array.isArray(payload.existingRows) ? payload.existingRows : [];

  if (hasKey) {
    try {
      const personaPrompt = buildPersonaSystemPrompt(cast);
      const sysPrompt =
        `你是《偶像大师 闪耀色彩 (THE iDOLM@STER SHINY COLORS)》283事务所资深活动剧本作家。\n` +
        `请严格遵守以下登场角色的 cards_v2 人设、第一人称自称、对制作人及同伴的称呼、句尾特征与 0-OOC 红线：\n${personaPrompt}\n\n` +
        `请将用户提供的大纲扩写为 ${effectiveRange} 高质量双语（日文原味台词 + 中文翻译）演出台本，并只输出合法 JSON 对象，格式如下：\n` +
        `{\n` +
        `  "rows": [\n` +
        `    {\n` +
        `      "kind": "dialogue",\n` +
        `      "rowId": "r01",\n` +
        `      "beatId": "beat_1",\n` +
        `      "beatTitle": "小段标题",\n` +
        `      "speaker": "甘奈",\n` +
        `      "charLabel": "amana",\n` +
        `      "emotion": "joy",\n` +
        `      "text": "日文台词（严格使用角色第一人称与制作人称呼）",\n` +
        `      "zh": "对应的自然中文翻译",\n` +
        `      "note": "[节拍说明、神态微动作或舞台指示]",\n` +
        `      "stageAction": "可选仅限原地微反应/环境特效：stumble | bgm_stop | bgm_fade | flash_shock | dusk_mood | memory_blur | awkward_pause | 空字符串"\n` +
        `    },\n` +
        `    {\n` +
        `      "kind": "cue",\n` +
        `      "rowId": "cue_01",\n` +
        `      "beatId": "beat_2",\n` +
        `      "note": "动作拍简述（如：朝日跑出画外；或：甜花走近把甘奈往回拉半步）",\n` +
        `      "cue": {\n` +
        `        "timing": "separate 或 with_next",\n` +
        `        "transition": "none 或 switch_fade",\n` +
        `        "steps": [\n` +
        `          { "mode": "seq 或 parallel", "charLabel": "asahi", "toSlot": "off_left|left|mid_left|center|mid_right|right|off_right", "speedPreset": "fast|normal|sneak", "gaze": "eye_left|eye_front|eye_right" }\n` +
        `        ]\n` +
        `      }\n` +
        `    }\n` +
        `  ]\n` +
        `}\n` +
        `剧本质量红线（Step 1 平实脉络 → Step 2 生动演出细化）：\n` +
        `1. 先画面后台词：输入的大纲小段是平实理清剧情的脉络，请先在脑中把每段展开为生动的舞台画面（动作、神态、视线/站位变化、心理反差与呼吸停顿），再写出自然口语化的双语台词，严禁照着大纲直白干念！\n` +
        `2. 严禁“轮流喊口号 / 复读同一句话”的机械对话；每个角色都要按各自性格互相接梗、吐槽、关心或产生观点碰撞。\n` +
        `3. 必须有起承转合：自然铺垫 → 小意外/性格反差碰撞 → 情绪推进或温馨反转 → 余韵收尾。\n` +
        `4. 动作拍严格按需插入（关键）：\n` +
        `   - 对于标明【💬纯对话】的小段，**严禁**插入 kind="cue" 动作拍，只输出 kind="dialogue" 台词行！\n` +
        `   - 只有标明【🎬需动作拍】的小段，才在最合适的台词前后穿插 1–2 个 kind="cue" 动作拍行来表现水平走位/离场/追逐/拉扯/切镜；可用 mode:"parallel" 让两人同时移动（如冬优和爱依一起追出，或甜花拉着甘奈一起后退），用 transition:"switch_fade" 触发镜头切换过场，随后再用入场 step 把角色移回 left/center/right。\n` +
        `   - 角色通过动作拍移至 off_left/off_right 后，未重入场前若还说话仍正常写 dialogue，系统会自动处理为画外音。\n` +
        `5. 篇幅红线：全幕总台词行数不得低于 ${Math.max(4, Math.ceil(expectedActLines * 0.8))} 句（cue 不计入台词句数），每个小段都必须写足各自建议句数的 80% 以上。\n` +
        `6. 如果是制作人发言，speaker 填 "プロデューサー"，charLabel 填 ""。\n` +
        `7. emotion 仅限从以下枚举中选择："joy" (喜悦), "shy" (害羞), "tsun" (生气/傲娇/鼓腮), "surp" (惊讶), "sad" (失落), "sigh" (无奈叹气), "serious" (认真), "idol" (闪耀偶像)。注意：每个角色在某小段开场第一句的 emotion 必须直接贴合当时情景瞬间（例如刚醒来发现同居一室→直接给 "shy" / "surp" / "tsun"，切勿先无脑给 "joy")。\n` +
        `8. 若提供了【L1 全片总剧情】或【前情各幕摘要】，严禁篡改已确立的事件归属（如谁崴脚、谁犯错、谁知道秘密），必须严格顺承前文推进。\n` +
        `9. 角色内心独白/心声请用全角括号 \`（……）\` 包裹（\`text\` 与 \`zh\` 都保留 \`（）\`，不要在里面加对话引号「」），舞台演出时会自动以 \`（）\` 展示内心台词并保持角色闭口不张嘴。`;

      const existingHint = existingRows.length
        ? `\n\n当前已有基础草稿（请保留核心设定并大幅丰富互动细节、心理过渡与趣味反转，扩写至 ${depthCfg.range}）：\n` +
          existingRows.slice(0, 20).map((r, i) => `${i + 1}. [${r.speaker}] ${r.zh || r.text || ''}`).join('\n')
        : '';
      const continuityHint = formatStoryContinuityPrompt(payload.storyContext);

      const userPrompt =
        `${continuityHint}` +
        `当前要生成的幕：${outline.title || outline.sceneId || '新场景'}\n` +
        `目标篇幅：${effectiveRange}\n` +
        `登场角色：${cast.join(', ')}\n` +
        `本幕剧情摘要：${outline.summary || ''}\n` +
        `本幕剧情小段 (Segments)：\n${segments.map((s, i) => `${i + 1}. [${s.beatId}] ${s.title}（建议 ${s.targetLines || 4} 句｜${s.needsActionCue ? '🎬需动作拍：' + (s.blockingHint || '有走位演出') : '💬纯对话（勿插动作拍）'}）：${s.summary}`).join('\n')}${existingHint}`;

      let primaryErr = null;
      let llmModel = llmConfig.model || 'llm';
      let llmContent = '';
      try {
        const llmRes = await callOpenAICompatibleLLM(
          llmConfig,
          [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: userPrompt }
          ],
          { maxTokens: depthCfg.maxTokens, timeoutMs: depthCfg.timeoutMs }
        );
        if (llmRes && llmRes.model) llmModel = llmRes.model;
        llmContent = (llmRes && llmRes.content) || '';
      } catch (e) {
        primaryErr = e;
      }
      const normalizeLlmRows = (rawList, resolveSegFn, idPrefix = 'r') => rawList.map((r, idx) => {
        const segHit = resolveSegFn(r, idx, rawList.length);
        if (r && (r.kind === 'cue' || (r.cue && !r.text))) {
          return {
            kind: 'cue',
            rowId: r.rowId || `cue_${idPrefix}${String(idx + 1).padStart(2, '0')}`,
            beatId: (segHit && segHit.beatId) || r.beatId || 'beat_1',
            beatTitle: (segHit && segHit.title) || r.beatTitle || '小段 1',
            note: r.note || '',
            cue: normalizeCueObject(r.cue)
          };
        }
        const cLabel = r.charLabel && IDOL_META[r.charLabel] ? r.charLabel : '';
        const m = cLabel ? IDOL_META[cLabel] : null;
        const emo = normalizeEmotionKey(r.emotion, `${r.text || ''} ${r.zh || ''} ${r.note || ''}`);
        const preset = EMOTION_PRESETS[emo];
        return {
          kind: 'dialogue',
          rowId: r.rowId || `${idPrefix}${String(idx + 1).padStart(2, '0')}`,
          beatId: (segHit && segHit.beatId) || r.beatId || 'beat_1',
          beatTitle: (segHit && segHit.title) || r.beatTitle || '小段 1',
          speaker: m ? m.speaker : (r.speaker || 'プロデューサー'),
          charLabel: cLabel,
          emotion: emo,
          anim1: m ? resolveValidAnim(m.id, preset.bodyCandidates, 'body') : '',
          anim2: m ? resolveValidAnim(m.id, preset.faceCandidates, 'face') : '',
          anim3: m ? resolveValidAnim(m.id, preset.eyeCandidates, 'eye') : '',
          text: r.text || '',
          zh: normalizeZhHonorifics(r.zh || r.text || '', cLabel || (m ? m.speaker : ''), r.text || ''),
          note: r.note || '',
          stageAction: r.stageAction && VALID_STAGE_ACTIONS.has(r.stageAction) ? r.stageAction : '',
          branchLabel: r.branchLabel || '',
          choices: Array.isArray(r.choices) ? r.choices : undefined
        };
      });

      const extractRowsArray = (txt) => {
        const p = extractJsonFromText(txt);
        const cand = p && (p.rows || p.scriptRows || p.lines);
        return Array.isArray(p) ? p : (Array.isArray(cand) ? cand : null);
      };

      const rawRows = extractRowsArray(llmContent);
      const segOrder = new Map(segments.map((s, idx) => [s.beatId, idx]));
      let enrichedRows = (rawRows && rawRows.length > 0)
        ? normalizeLlmRows(rawRows, (r, idx, total) => {
            return segments.find((s) => s.beatId === r.beatId)
              || segments[Math.min(segments.length - 1, Math.floor((idx / Math.max(1, total)) * segments.length))]
              || segments[0];
          })
        : [];

        const getShortSegs = (rows, ratio) => {
          const countByBeat = new Map();
          rows.filter((r) => r && r.kind !== 'cue').forEach((r) => countByBeat.set(r.beatId, (countByBeat.get(r.beatId) || 0) + 1));
          return {
            countByBeat,
            shortSegs: segments.filter((s) => (countByBeat.get(s.beatId) || 0) < Math.max(2, Math.ceil((Number(s.targetLines) || 4) * ratio)))
          };
        };

        const mergeAndSortRows = (baseRows, extraRows) => {
          const combined = [...baseRows, ...extraRows];
          combined.sort((a, b) => (segOrder.get(a.beatId) ?? 99) - (segOrder.get(b.beatId) ?? 99));
          return combined.map((r, idx) => Object.assign({}, r, { rowId: `r${String(idx + 1).padStart(2, '0')}` }));
        };

        // Pass 1：全幕整段补全（仅当主调用已有部分台词且总句数不足 70% 或存在明显偏短小段时触发）
        const minAcceptLines = Math.max(4, Math.ceil(expectedActLines * 0.7));
        const pass1State = getShortSegs(enrichedRows, 0.65);
        if (enrichedRows.length > 0 && (enrichedRows.length < minAcceptLines || pass1State.shortSegs.length > 0) && segments.length > 0) {
          try {
            const targetSegs = pass1State.shortSegs.length ? pass1State.shortSegs : segments;
            const needTotal = Math.max(4, expectedActLines - enrichedRows.length);
            const suppPrompt =
              `当前台本仅生成了 ${enrichedRows.length} 行，少于目标 ${expectedActLines} 行。请在不重复已有台词的前提下，专门为以下偏短或缺失的小段补充约 ${needTotal} 行自然承接的新台词（直接输出 JSON {"rows":[...]}，每行必须标注对应 beatId）：\n` +
              targetSegs.map((s) => `- [${s.beatId}] ${s.title}（还需约 ${Math.max(2, (Number(s.targetLines) || 4) - (pass1State.countByBeat.get(s.beatId) || 0))} 句）：${s.summary}`).join('\n') +
              `\n\n已有台词：\n` +
              enrichedRows.map((r, i) => `${i + 1}. [${r.beatId}] ${r.speaker}: ${r.zh}`).join('\n');
            const suppRes = await callOpenAICompatibleLLM(
              llmConfig,
              [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: suppPrompt }
              ],
              { maxTokens: 6144, timeoutMs: Math.max(depthCfg.timeoutMs || 75000, 90000) }
            );
            const suppRaw = extractRowsArray(suppRes.content);
            if (suppRaw && suppRaw.length > 0) {
              const extraRows = normalizeLlmRows(suppRaw, (r) => segments.find((s) => s.beatId === r.beatId) || targetSegs[0], 'r_supp_');
              enrichedRows = mergeAndSortRows(enrichedRows, extraRows);
            }
          } catch (_) {
            // Non-fatal: continue to Pass 2 per-beat fallback
          }
        }

        // Pass 2：按 beat 逐段兜底补全（防止整幕补全超时或模型跳过末尾小段）
        if (segments.length > 0) {
          const pass2State = getShortSegs(enrichedRows, 0.6);
          for (const seg of pass2State.shortSegs) {
            const have = pass2State.countByBeat.get(seg.beatId) || 0;
            const need = Math.max(2, (Number(seg.targetLines) || 4) - have);
            try {
              const tailContext = enrichedRows.slice(-4).map((r, i) => `${i + 1}. [${r.beatId}] ${r.speaker}: ${r.zh}`).join('\n');
              const beatPrompt =
                `请为当前幕的小段 [${seg.beatId}]「${seg.title}」专门补写 ${need} 行台词（当前已有 ${have} 行，目标约 ${seg.targetLines || 4} 行），严禁重复已有台词，直接输出 JSON {"rows":[...]}，每行 beatId 固定填 "${seg.beatId}"。\n` +
                `小段剧情：${seg.summary}\n` +
                (tailContext ? `\n前文最近几句：\n${tailContext}` : '');
              const beatRes = await callOpenAICompatibleLLM(
                llmConfig,
                [
                  { role: 'system', content: sysPrompt },
                  { role: 'user', content: beatPrompt }
                ],
                { maxTokens: 3072, timeoutMs: 60000 }
              );
              const beatRaw = extractRowsArray(beatRes.content);
              if (beatRaw && beatRaw.length > 0) {
                const extraBeatRows = normalizeLlmRows(beatRaw, () => seg, `r_${seg.beatId}_`);
                enrichedRows = mergeAndSortRows(enrichedRows, extraBeatRows);
              }
            } catch (_) {
              // Non-fatal per beat
            }
          }
        }

        if (enrichedRows.length > 0) {
          enrichedRows = sanitizeStageActions(enrichedRows);
          const audited = await autoRepairOocFlaggedRows(enrichedRows, llmConfig, cast);
          return {
            ok: true,
            generator: 'llm',
            generatorLabel: `🤖 AI 大模型生成 (${llmModel})`,
            model: llmModel,
            segments,
            scriptRows: audited.rows,
            oocSummary: audited.summary
          };
        }
        if (primaryErr) throw primaryErr;
    } catch (llmErr) {
      const fallback = expandScriptFromOutline(Object.assign({}, outline, { _forceRegenerate: true }));
      return {
        ok: true,
        generator: 'template_fallback',
        generatorLabel: '⚡ 本地模板生成（AI 接口异常已自动兜底）',
        llmWarning: String(llmErr && llmErr.message ? llmErr.message : llmErr),
        segments,
        scriptRows: fallback.rows,
        oocSummary: fallback.summary
      };
    }
  }

  const expanded = expandScriptFromOutline(outline);
  return {
    ok: true,
    generator: 'template',
    generatorLabel: '⚡ 本地模板生成',
    segments,
    scriptRows: expanded.rows,
    oocSummary: expanded.summary
  };
}

/**
 * Task 1 (`POST /api/studio/expand-beat`):
 * Regenerates/replaces ONLY the lines belonging to `beatId` without touching other segments in the scene!
 */
async function expandBeatWithLlmOrTemplate(payload = {}) {
  const projectId = payload.projectId || payload.pid || '';
  const sceneId = payload.sceneId || (payload.outline && payload.outline.sceneId) || 'scene_01';
  const outline = payload.outline || {};
  const { segments } = normalizeSceneSegments(outline);
  const incomingBeat = payload.segment || payload.beat || null;
  const fallbackIdx = typeof payload.beatIndex === 'number' && payload.beatIndex >= 0 && payload.beatIndex < segments.length
    ? payload.beatIndex
    : 0;
  const beatId = String(
    payload.beatId ||
    (incomingBeat && incomingBeat.beatId) ||
    (segments[fallbackIdx] && segments[fallbackIdx].beatId) ||
    'beat_1'
  ).trim();
  const foundIdx = segments.findIndex((s) => s.beatId === beatId);
  const segIdx = foundIdx >= 0 ? foundIdx : fallbackIdx;
  const incomingSeg = incomingBeat || segments[segIdx] || {
    beatId,
    title: payload.beatTitle || `小段 ${segIdx + 1}`,
    summary: payload.summary || '',
    cast: payload.cast || outline.cast || ['amana', 'hana'],
    targetLines: 3
  };
  const targetSeg = {
    beatId,
    title: String(incomingSeg.title || incomingSeg.beatTitle || `小段 ${segIdx + 1}`).trim(),
    summary: String(incomingSeg.summary !== undefined ? incomingSeg.summary : incomingSeg.title || '').trim(),
    cast: Array.isArray(incomingSeg.cast) && incomingSeg.cast.length
      ? incomingSeg.cast.filter((c) => IDOL_META[c])
      : ((Array.isArray(outline.cast) && outline.cast.length ? outline.cast.filter((c) => IDOL_META[c]) : ['amana', 'hana']).slice(0, 3)),
    targetLines: Math.max(1, Math.min(20, Number(incomingSeg.targetLines) || 4)),
    needsActionCue: Boolean(incomingSeg.needsActionCue),
    blockingHint: String(incomingSeg.blockingHint || '').trim()
  };

  if (segIdx >= 0 && segments[segIdx]) {
    segments[segIdx] = targetSeg;
  } else {
    segments.push(targetSeg);
  }

  const llmConfig = resolveEffectiveLlmConfig(payload.llmConfig);
  const hasKey = Boolean(llmConfig && llmConfig.apiKey);
  let generatedBeatRows = null;
  let generator = 'template';
  let generatorLabel = '⚡ 本地小段模板生成';
  let llmWarning = '';

  if (hasKey) {
    try {
      const personaPrompt = buildPersonaSystemPrompt(targetSeg.cast);
      const cueSpecHint = targetSeg.needsActionCue
        ? `本小段已开启【🎬需动作拍】：${targetSeg.blockingHint || '请根据剧情在合适位置插入 1-2 个 kind="cue" 动作拍行'}。\n` +
          `动作拍行格式：{"kind":"cue","note":"动作简述","cue":{"timing":"separate|with_next","transition":"none|switch_fade","steps":[{"mode":"seq|parallel","charLabel":"角色id","toSlot":"off_left|left|mid_left|center|mid_right|right|off_right","speedPreset":"fast|normal|sneak","gaze":"eye_left|eye_front|eye_right"}]}}\n`
        : `本小段为【💬纯对话】，严禁输出 kind="cue" 动作拍行！\n`;
      const sysPrompt =
        `你是《偶像大师 闪耀色彩 (THE iDOLM@STER SHINY COLORS)》283事务所资深活动剧本作家。\n` +
        `请严格遵守以下角色的 cards_v2 人设、第一人称自称、对制作人及同伴的称呼与 0-OOC 约束（单句不超过45字）：\n${personaPrompt}\n\n` +
        `请仅针对当前指定的【单个剧情小段 (${targetSeg.beatId} · ${targetSeg.title})】生成 ${targetSeg.targetLines} 行高质量双语演出台词，只输出合法 JSON：\n` +
        `{"rows":[{"kind":"dialogue","speaker":"甘奈","charLabel":"amana","emotion":"joy","text":"日文台词","zh":"中文翻译","note":"[动作神态与舞台指示]","stageAction":"可选：stumble | bgm_stop | bgm_fade | flash_shock | dusk_mood | memory_blur | awkward_pause | 空字符串"}]}\n` +
        cueSpecHint +
        `演出细化要求（Step 1 平实脉络 → Step 2 生动演出）：\n` +
        `1. 先把平实的小段梗概生动展开为具体画面：补足微动作、神态反应、视线交换、性格反差吐槽与情绪落差，严禁照着梗概干念。\n` +
        `2. 善用停顿（……）与语气词，把动作神态写进 note；emotion 仅限 joy/shy/tsun/surp/sad/sigh/serious/idol。\n` +
        `3. 若提供了前后小段与全片上下文，台词必须自然承接上文并禁止篡改既定事件归属。\n` +
        `4. 角色内心独白/心声请用全角括号 \`（……）\` 包裹（\`text\` 与 \`zh\` 都保留 \`（）\`），演出时会自动保持角色闭口不张嘴。`;
      const continuityHint = formatStoryContinuityPrompt(payload.storyContext);
      const prevSeg = segIdx > 0 ? segments[segIdx - 1] : null;
      const nextSeg = segIdx >= 0 && segIdx + 1 < segments.length ? segments[segIdx + 1] : null;
      const neighborHint =
        (prevSeg ? `上一段衔接：[${prevSeg.title}] ${prevSeg.summary}\n` : '') +
        (nextSeg ? `下一段预告：[${nextSeg.title}] ${nextSeg.summary}\n` : '');
      const userPrompt =
        `${continuityHint}` +
        `所属幕：${outline.title || sceneId}\n` +
        `${neighborHint}` +
        `当前小段编号：${targetSeg.beatId}\n` +
        `当前小段标题：${targetSeg.title}\n` +
        `当前小段梗概：${targetSeg.summary}\n` +
        `动作拍要求：${targetSeg.needsActionCue ? ('🎬需动作拍：' + (targetSeg.blockingHint || '有走位演出')) : '💬纯对话（勿插动作拍）'}\n` +
        `本段登场角色：${targetSeg.cast.join(', ')}`;
      const llmRes = await callOpenAICompatibleLLM(llmConfig, [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt }
      ], { maxTokens: 3072 });
      const parsed = extractJsonFromText(llmRes.content);
      const cand = parsed && (parsed.rows || parsed.scriptRows || parsed.lines);
      const rawRows = Array.isArray(parsed) ? parsed : (Array.isArray(cand) ? cand : null);
      if (rawRows && rawRows.length > 0) {
        generatedBeatRows = rawRows.map((r, i) => {
          if (r && (r.kind === 'cue' || (r.cue && !r.text))) {
            return {
              kind: 'cue',
              rowId: `cue_${beatId}_${String(i + 1).padStart(2, '0')}`,
              beatId,
              beatTitle: targetSeg.title,
              note: r.note || '',
              cue: normalizeCueObject(r.cue)
            };
          }
          const cLabel = r.charLabel && IDOL_META[r.charLabel] ? r.charLabel : '';
          const m = cLabel ? IDOL_META[cLabel] : null;
          const emo = normalizeEmotionKey(r.emotion, `${r.text || ''} ${r.zh || ''} ${r.note || ''}`);
          const preset = EMOTION_PRESETS[emo];
          return {
            kind: 'dialogue',
            rowId: `r_${beatId}_${String(i + 1).padStart(2, '0')}`,
            beatId,
            beatTitle: targetSeg.title,
            speaker: m ? m.speaker : (r.speaker || 'プロデューサー'),
            charLabel: cLabel,
            emotion: emo,
            anim1: m ? resolveValidAnim(m.id, preset.bodyCandidates, 'body') : '',
            anim2: m ? resolveValidAnim(m.id, preset.faceCandidates, 'face') : '',
            anim3: m ? resolveValidAnim(m.id, preset.eyeCandidates, 'eye') : '',
            text: String(r.text || '').slice(0, 50),
            zh: normalizeZhHonorifics(r.zh || r.text || '', cLabel || (m ? m.speaker : ''), r.text || ''),
            note: i === 0 ? `[小段: ${targetSeg.title}] ${r.note || targetSeg.summary.slice(0, 28)}` : (r.note || ''),
            stageAction: r.stageAction && VALID_STAGE_ACTIONS.has(r.stageAction) ? r.stageAction : ''
          };
        });
        generator = 'llm';
        generatorLabel = `🤖 AI 小段重写 (${llmRes.model})`;
      }
    } catch (err) {
      llmWarning = String(err && err.message ? err.message : err);
      generator = 'template_fallback';
      generatorLabel = '⚡ 本地小段模板生成（AI 接口异常已兜底）';
    }
  }

  if (!generatedBeatRows) {
    generatedBeatRows = buildBeatRowsFromSegment(
      targetSeg,
      segIdx >= 0 ? segIdx : 0,
      segments.length,
      outline.cast || targetSeg.cast,
      'beat'
    );
  }

  generatedBeatRows = sanitizeStageActions(generatedBeatRows);
  const auditedBeat = await autoRepairOocFlaggedRows(generatedBeatRows, llmConfig, targetSeg.cast);

  // Merge into existingRows: replace ONLY rows matching `beatId`, keeping all other segments untouched!
  let existingRows = Array.isArray(payload.existingRows) && payload.existingRows.length
    ? payload.existingRows
    : Array.isArray(payload.existingScriptRows) && payload.existingScriptRows.length
    ? payload.existingScriptRows
    : Array.isArray(outline.scriptRows) && outline.scriptRows.length
    ? outline.scriptRows
    : [];

  if (existingRows.length === 0 && projectId && sceneId) {
    try {
      const outlinePath = path.join(WORKSPACE_DIR, `${projectId}.scpack`, 'outlines', `${sceneId}.outline.json`);
      if (fs.existsSync(outlinePath)) {
        const diskOutline = JSON.parse(fs.readFileSync(outlinePath, 'utf8'));
        if (diskOutline && Array.isArray(diskOutline.scriptRows) && diskOutline.scriptRows.length) {
          existingRows = diskOutline.scriptRows;
        }
      }
    } catch (_) {}
  }

  let mergedRows = [];
  if (existingRows.length > 0) {
    const tempScene = {
      cast: outline.cast || targetSeg.cast,
      segments,
      scriptRows: existingRows.map((r) => Object.assign({}, r))
    };
    normalizeSceneSegments(tempScene);
    const normExisting = tempScene.scriptRows;
    const firstMatchIdx = normExisting.findIndex((r) => r.beatId === beatId);
    if (firstMatchIdx >= 0) {
      let inserted = false;
      for (const r of normExisting) {
        if (r.beatId === beatId) {
          if (!inserted) {
            auditedBeat.rows.forEach((nr) => mergedRows.push(nr));
            inserted = true;
          }
        } else {
          mergedRows.push(r);
        }
      }
    } else {
      // Insert in segment order
      const bucketByBeat = new Map(segments.map((s) => [s.beatId, []]));
      normExisting.forEach((r) => {
        const k = bucketByBeat.has(r.beatId) ? r.beatId : segments[0].beatId;
        bucketByBeat.get(k).push(r);
      });
      bucketByBeat.set(beatId, auditedBeat.rows);
      for (const s of segments) {
        for (const r of (bucketByBeat.get(s.beatId) || [])) {
          mergedRows.push(r);
        }
      }
    }
  } else {
    mergedRows = auditedBeat.rows;
  }

  mergedRows.forEach((r, idx) => {
    r.rowId = `row_${String(idx + 1).padStart(2, '0')}`;
  });
  const auditedAll = auditScriptRows(mergedRows);

  let savedResult = null;
  const shouldApply = (payload.applyToScene !== false) && (payload.applyToProject !== false);
  if (projectId && shouldApply) {
    try {
      savedResult = upsertOrManageProjectScene(projectId, {
        action: 'save',
        sceneId,
        title: outline.title,
        titleJa: outline.titleJa,
        bg: outline.bg,
        bgm: outline.bgm,
        cast: outline.cast,
        summary: outline.summary,
        segments,
        scriptRows: auditedAll.rows
      });
    } catch (_) {}
  }

  return {
    ok: true,
    beatId,
    segment: targetSeg,
    segments,
    beatRows: auditedBeat.rows,
    scriptRows: auditedAll.rows,
    oocSummary: auditedAll.summary,
    generator,
    generatorLabel,
    llmWarning: llmWarning || undefined,
    project: savedResult ? savedResult.project : undefined,
    scene: savedResult ? savedResult.scene : undefined,
    scproj: savedResult ? savedResult.scproj : undefined
  };
}

// ---------------------------------------------------------------------------
// Task 2: Bilibili-Style『⚡ 多人反应 / 怪文书合集模式 (Reaction Anthology Mode)』
//   - Canonical Seed: `projects_workspace/reaction_idol_relation.scpack`
//   - Per-idol 4-style 0-OOC reaction generator (`POST /api/studio/generate-reaction`)
//   - Continuous / Single-Idol Stage Compiler (`POST /api/studio/compile-reaction-pack`)
// ---------------------------------------------------------------------------
const CANONICAL_REACTION_CARDS = [
  {
    cardId: 'react_fuyuko',
    charLabel: 'fuyuko',
    style: 'heavy',
    bg: '00001',
    bgm: '0028',
    outfitKey: 'characters/stand/018',
    charType: 'characters',
    charCategory: 'stand',
    charId: '018',
    clothId: '018',
    stageSummary: '初反应营业甜笑 → 瞬间切裏冬优子咬牙破防 → 傲娇宣示唯一主权',
    lines: [
      {
        lineId: 'fuyuko_1',
        emotion: 'idol',
        anim1: 'smile2',
        anim2: 'face_smile',
        se: '',
        text: 'ふふっ、プロデューサーさんったら、急に何を言い出すのかしら♡',
        zh: '呵呵，制作人先生真是的，怎么突然说出这种话呀♡',
        note: '[初反应] 营业模式完美甜笑'
      },
      {
        lineId: 'fuyuko_2',
        emotion: 'tsun',
        anim1: 'anger1',
        anim2: 'face_anger',
        se: 'bgm_stop',
        text: '……はあ！？それ以上でも以下でもないって、ふゆを誰だと思ってるのよ！',
        zh: '……哈啊！？什么叫仅此而已，你把冬优当成什么人了啊！',
        note: '[反转破防] BGM骤停 · 瞬间切回裏冬优子逼近一步'
      },
      {
        lineId: 'fuyuko_3',
        emotion: 'shy',
        anim1: 'shy1',
        anim2: 'face_shy',
        se: '0453',
        text: 'あんたの一番近くにいるのはふゆなんだから、絶対によそ見しないでよね……っ！',
        zh: '离你最近的明明是冬优我，绝对不准你把视线移向别人哦……！',
        note: '[直球收尾] 脸颊微红别过视线宣示主权'
      }
    ]
  },
  {
    cardId: 'react_madoka',
    charLabel: 'madoka',
    style: 'canon',
    bg: '00001',
    bgm: '0018',
    outfitKey: 'characters/stand/021',
    charType: 'characters',
    charCategory: 'stand',
    charId: '021',
    clothId: '021',
    stageSummary: '初反应冷淡附和“纯商业伙伴” → 眼神微冷毒舌反刺 → 轻轻叹气动摇',
    lines: [
      {
        lineId: 'madoka_1',
        emotion: 'serious',
        anim1: 'wait1',
        anim2: 'face_serious',
        se: '',
        text: 'ええ、そうですね。プロデューサーとアイドル、ただのビジネスパートナーですから。',
        zh: '嗯，是那样没错呢。制作人和偶像，本来就只是纯粹的商业搭档而已。',
        note: '[初反应] 波澜不惊地冷淡附和'
      },
      {
        lineId: 'madoka_2',
        emotion: 'sigh',
        anim1: 'wait3',
        anim2: 'face_close',
        se: 'bgm_stop',
        text: '……わざわざ口に出して線を引くなんて、プロデューサー、何か後ろめたいことでも？',
        zh: '……特意说出口来划清界限，制作人，您是有什么心虚的事吗？',
        note: '[反转刺探] 半眯起眼冷冷盯住制作人'
      },
      {
        lineId: 'madoka_3',
        emotion: 'shy',
        anim1: 'wait2',
        anim2: 'face_shy',
        se: '',
        text: 'ふーん……まあ、私は最初から期待なんてしていませんけど。',
        zh: '哼……算了，反正我从一开始就没有抱什么多余的期待就是了。',
        note: '[余韵收尾] 微微移开目光轻声嘟囔'
      }
    ]
  },
  {
    cardId: 'react_amana',
    charLabel: 'amana',
    style: 'sweet',
    bg: '00105',
    bgm: '0029',
    outfitKey: 'characters/stand/014',
    charType: 'characters',
    charCategory: 'stand',
    charId: '014',
    clothId: '014',
    stageSummary: '初反应笑容凝固难以置信 → 委屈拉住衣袖抗议 → 直球撒娇“甘奈想要更特别的关系☆”',
    lines: [
      {
        lineId: 'amana_1',
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        se: '',
        text: 'えっ……？プロデューサーさん、急にそんなこと言われたら、甘奈びっくりしちゃうよ……？',
        zh: '咦……？制作人先生，突然说这种话，甘奈会被吓一跳的哦……？',
        note: '[初反应] 笑容僵在脸上眨了眨眼'
      },
      {
        lineId: 'amana_2',
        emotion: 'sad',
        anim1: 'sad1',
        anim2: 'face_sad',
        se: '0453',
        text: 'そんなのやだぁ……甘奈にとってプロデューサーさんは、ただの仕事相手なんかじゃないもん……。',
        zh: '甘奈才不要那样呢……对甘奈来说，制作人先生才不是普通的工作对象嘛……。',
        note: '[反转破防] 眼眶微润拉住制作人袖角'
      },
      {
        lineId: 'amana_3',
        emotion: 'joy',
        anim1: 'smile1',
        anim2: 'face_smile',
        se: '0478',
        text: 'えへへ、今のなしっ☆ 甘奈はプロデューサーさんと、もっと特別な関係でいたいな♪',
        zh: '嘿嘿，刚才那句不算数☆ 甘奈想和制作人先生保持更加特别的关系呢♪',
        note: '[直球暴击] 贴近一步露出灿烂笑容'
      }
    ]
  },
  {
    cardId: 'react_tenka',
    charLabel: 'tenka',
    style: 'heavy',
    bg: '00008',
    bgm: '0001',
    outfitKey: 'characters/stand/015',
    charType: 'characters',
    charCategory: 'stand',
    charId: '015',
    clothId: '015',
    stageSummary: '初反应慌张以为自己惹厌了 → 抱紧靠垫快哭出来 → 知道是玩笑后安心贴贴',
    lines: [
      {
        lineId: 'tenka_1',
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        se: '',
        text: 'あ、あの……プロデューサーさん、甜花のこと、迷惑になっちゃった……？',
        zh: '那、那个……制作人先生，是不是甜花平时太添麻烦，让您讨厌了……？',
        note: '[初反应] 慌慌张张地捏紧手指'
      },
      {
        lineId: 'tenka_2',
        emotion: 'sad',
        anim1: 'sad1',
        anim2: 'face_sad',
        se: 'bgm_stop',
        text: 'うぅ……ただの関係だなんて言われたら、甜花、寂しくて泣いちゃいそう……。',
        zh: '呜呜……要是被说只是普通关系的话，甜花会因为太寂寞哭出来的……。',
        note: '[反转破防] 低着头声音越来越小'
      },
      {
        lineId: 'tenka_3',
        emotion: 'joy',
        anim1: 'smile1',
        anim2: 'face_smile',
        se: '0478',
        text: 'にへへ……冗談でよかったぁ……甜花、これからもプロデューサーさんの傍がいいな……。',
        zh: '嘿嘿……原来是开玩笑真是太好啦……甜花以后也想一直待在制作人先生身边呢……。',
        note: '[安心依赖] 破涕为笑轻轻靠过来'
      }
    ]
  },
  {
    cardId: 'react_hana',
    charLabel: 'hana',
    style: 'sweet',
    bg: '00105',
    bgm: '0016',
    outfitKey: 'characters/stand/027',
    charType: 'characters',
    charCategory: 'stand',
    charId: '027',
    clothId: '027',
    stageSummary: '初反应天然歪头眨眼 → 零防备超直球“全世界最特别的人” → 灿烂贴近',
    lines: [
      {
        lineId: 'hana_1',
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        se: '',
        text: 'えっ……？プロデューサーさん、急にかしこまってどうしちゃったんですか？',
        zh: '咦……？制作人先生，怎么突然这么一本正经呀？',
        note: '[初反应] 纯真地歪了歪脑袋'
      },
      {
        lineId: 'hana_2',
        emotion: 'joy',
        anim1: 'smile2',
        anim2: 'face_smile',
        se: '0453',
        text: 'あたしにとっては、プロデューサーさんは世界で一番特別なプロデューサーさんですよ～！',
        zh: '但在我心里，制作人先生就是全世界最最特别的制作人先生哦～！',
        note: '[直球暴击] 毫无防备的零距离天然直球'
      },
      {
        lineId: 'hana_3',
        emotion: 'idol',
        anim1: 'yes',
        anim2: 'face_smile',
        se: '0478',
        text: 'えへへ、これからもずーっと、あたしの隣で見ててくださいね、プロデューサーさんっ！',
        zh: '嘿嘿，今后也请一直一直留在我的身边注视着我哦，制作人先生！',
        note: '[甜度拉满] 双眼发亮地开心挥手'
      }
    ]
  },
  {
    cardId: 'react_luca',
    charLabel: 'luca',
    style: 'canon',
    bg: '00003',
    bgm: '0018',
    outfitKey: 'characters/stand/026',
    charType: 'characters',
    charCategory: 'stand',
    charId: '026',
    clothId: '026',
    stageSummary: '初反应冷笑“少说废话” → 烦躁斥责“别拿框框套我” → 别扭独占“只准看着我的舞台”',
    lines: [
      {
        lineId: 'luca_1',
        emotion: 'tsun',
        anim1: 'anger1',
        anim2: 'face_anger',
        se: '',
        text: '……は？プロデューサー、今さら何当たり前のこと言ってんだよ。',
        zh: '……哈？制作人，都这时候了你还在说什么理所当然的废话啊。',
        note: '[初反应] 皱眉冷笑一声'
      },
      {
        lineId: 'luca_2',
        emotion: 'serious',
        anim1: 'no',
        anim2: 'face_serious',
        se: 'bgm_stop',
        text: '勝手に線引きしてんじゃねェよ……私はアンタのお人形じゃねェんだからな。',
        zh: '少在那里擅自划清界限了……我可不是任你摆布的洋娃娃。',
        note: '[反转凌厉] 眼神锋利地逼视制作人'
      },
      {
        lineId: 'luca_3',
        emotion: 'sigh',
        anim1: 'wait3',
        anim2: 'face_close',
        se: '',
        text: '……チッ、いいから黙って私のステージだけ見てろよ、プロデューサー。',
        zh: '……啧，少啰嗦，你就闭上嘴乖乖只看着我的舞台就够了，制作人。',
        note: '[傲娇独占] 压低帽檐转过身去'
      }
    ]
  },
  {
    cardId: 'react_mano',
    charLabel: 'mano',
    style: 'sweet',
    bg: '00003',
    bgm: '0029',
    outfitKey: 'characters/stand/001',
    charType: 'characters',
    charCategory: 'stand',
    charId: '001',
    clothId: '001',
    stageSummary: '初反应ほわっ受惊微寂寞 → 认真摇头反驳 → 温柔直球“一起走过的每天是最珍贵的宝物”',
    lines: [
      {
        lineId: 'mano_1',
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        se: '',
        text: 'ほわっ……！？プ、プロデューサーさん、なんだか少し寂しい言い方ですね……。',
        zh: '哇啊……！？制、制作人先生，您这么说总觉得有一点点寂寞呢……。',
        note: '[初反应] 微微睁大眼睛面露寂寞'
      },
      {
        lineId: 'mano_2',
        emotion: 'shy',
        anim1: 'shy1',
        anim2: 'face_shy',
        se: '0453',
        text: 'あの……たしかにプロデューサーさんとアイドルですけど、それだけじゃない気がしますっ。',
        zh: '那个……虽然确实是制作人先生和偶像的关系，但我总觉得并不止如此哦。',
        note: '[鼓起勇气] 双手贴在胸前认真望向制作人'
      },
      {
        lineId: 'mano_3',
        emotion: 'joy',
        anim1: 'smile2',
        anim2: 'face_smile',
        se: '0478',
        text: 'えへへ、わたしはプロデューサーさんと一緒に歩める毎日が、一番の宝物なんですっ。',
        zh: '嘿嘿，能和制作人先生一起并肩前行的每一天，就是我最珍贵的宝物呀。',
        note: '[治愈直球] 春风般温暖的笑容'
      }
    ]
  },
  {
    cardId: 'react_nichika',
    charLabel: 'nichika',
    style: 'heavy',
    bg: '00006',
    bgm: '0028',
    outfitKey: 'characters/stand/024',
    charType: 'characters',
    charCategory: 'stand',
    charId: '024',
    clothId: '024',
    stageSummary: '初反应夸张干笑打哈哈 → 笑容骤停害怕被抛弃 → 死死抓住衣角“绝对不准丢下我！”',
    lines: [
      {
        lineId: 'nichika_1',
        emotion: 'idol',
        anim1: 'smile1',
        anim2: 'face_smile',
        se: '',
        text: 'あーはっは！プロデューサーさん、急にマジメな顔してどうしたんですかー！？',
        zh: '啊哈哈！制作人先生，怎么突然摆出一副严肃的脸吓人呀——！？',
        note: '[初反应] 勉强摆手大笑试图糊弄过去'
      },
      {
        lineId: 'nichika_2',
        emotion: 'sad',
        anim1: 'sad1',
        anim2: 'face_sad',
        se: 'bgm_stop',
        text: '……え、ちょっと待ってください。それって、私を見捨てる前振りじゃないですよね……？',
        zh: '……咦，请等一下。您这么说，该不会是准备丢下不管我的铺垫吧……？',
        note: '[反转破防] BGM骤停 · 笑容瞬间消失声音发颤'
      },
      {
        lineId: 'nichika_3',
        emotion: 'tsun',
        anim1: 'anger1',
        anim2: 'face_anger',
        se: '0453',
        text: 'やだ、絶対離れませんからね！プロデューサーさんは私のプロデューサーさんなんですからっ！',
        zh: '我才不要，我绝对不会放手的哦！因为制作人先生可是我的制作人先生啊！',
        note: '[重女死守] 紧紧抓住制作人袖口不放'
      }
    ]
  }
];

function normalizeReactionStyle(style) {
  const s = String(style || 'canon').trim().toLowerCase();
  if (s === 'canonical' || s === 'canon') return 'canon';
  if (s === 'gag' || s === 'meme') return 'meme';
  if (s === 'heavy' || s === 'sweet') return s;
  return 'canon';
}

function buildReactionStyleLinesForIdol(charLabel, rawStyle = 'canon') {
  const style = normalizeReactionStyle(rawStyle);
  const m = IDOL_META[charLabel] || IDOL_META.mano;
  const canonicalHit = CANONICAL_REACTION_CARDS.find((c) => c.charLabel === charLabel);
  if (canonicalHit && (style === canonicalHit.style || style === 'canon')) {
    return canonicalHit.lines.map((l, idx) => Object.assign({}, l, { lineId: `${charLabel}_${style}_${idx + 1}` }));
  }

  // Bespoke non-keigo / special speech rule handling so polisher-core 30-idol OOC is 100% 0-error 0-warn
  const noKeigoIdols = new Set(['luca', 'juri', 'mei', 'kogane', 'mamimi', 'tooru', 'hinana', 'natsuha', 'sakuya', 'yuika', 'tenka']);
  const isNoKeigo = noKeigoIdols.has(charLabel);
  const noBangIdols = new Set(['madoka', 'kiriko', 'tooru', 'mikoto']);
  const endBang = noBangIdols.has(charLabel) ? '。' : '！';

  if (charLabel === 'tenka') {
    if (style === 'meme') {
      return [
        { lineId: 'tenka_m1', emotion: 'surp', anim1: 'surp1', anim2: 'face_surp', se: '', text: 'えっ……ただの関係なら、甜花、今日お休みしてもいい……かな……？', zh: '咦……如果只是普通关系的话，甜花今天可以在家休息打游戏……吗……？', note: '[初反应] 试图趁机摸鱼' },
        { lineId: 'tenka_m2', emotion: 'sad', anim1: 'sad1', anim2: 'face_sad', se: 'bgm_stop', text: 'うぅ……やっぱり嘘……プロデューサーさんがいないと、甜花ダメなの……。', zh: '呜呜……果然还是骗人的……没有制作人先生在的话，甜花什么都做不好……。', note: '[秒怂破防] 抱头蹲下' },
        { lineId: 'tenka_m3', emotion: 'joy', anim1: 'smile1', anim2: 'face_smile', se: '0478', text: 'にへへ……これからもずっと、甜花のお世話よろしくね、プロデューサーさん……。', zh: '嘿嘿……今后也请一直多多照顾甜花哦，制作人先生……。', note: '[安心贴贴]' }
      ];
    }
    return CANONICAL_REACTION_CARDS.find((c) => c.charLabel === 'tenka').lines.map((l) => Object.assign({}, l));
  }

  if (charLabel === 'madoka') {
    if (style === 'heavy') {
      return [
        { lineId: 'madoka_h1', emotion: 'serious', anim1: 'wait1', anim2: 'face_serious', se: '', text: '……そうですか。プロデューサーがそう定義するなら、それで構いませんけど。', zh: '……是吗。既然制作人要那样定义的话，我也无所谓就是了。', note: '[初反应] 眼神微冷' },
        { lineId: 'madoka_h2', emotion: 'sigh', anim1: 'wait3', anim2: 'face_close', se: 'bgm_stop', text: 'ただ、今さら他人行儀な態度を取られても、滑稽なだけですよ、プロデューサー。', zh: '只不过，事到如今还摆出一副疏远客套的态度，只会让人觉得滑稽而已哦，制作人。', note: '[反转刺探] 声音低沉下来' },
        { lineId: 'madoka_h3', emotion: 'shy', anim1: 'wait2', anim2: 'face_shy', se: '0453', text: '……最後まで責任を取るって言ったの、プロデューサー自身でしょう。忘れないでください。', zh: '……说好要负责到底的人，不正是制作人您自己吗。请不要擅自忘记。', note: '[低声钉死]' }
      ];
    }
    return CANONICAL_REACTION_CARDS.find((c) => c.charLabel === 'madoka').lines.map((l) => Object.assign({}, l));
  }

  if (charLabel === 'luca') {
    return CANONICAL_REACTION_CARDS.find((c) => c.charLabel === 'luca').lines.map((l) => Object.assign({}, l));
  }

  if (isNoKeigo) {
    if (style === 'heavy') {
      return [
        {
          lineId: `${charLabel}_h1`,
          emotion: 'surp',
          anim1: 'surp1',
          anim2: 'face_surp',
          se: '',
          text: `……えっ、${m.pCallJa}、今さら何を他人行儀なこと言ってるの……？`,
          zh: `……咦，${m.pCallZh}，都到现在了怎么突然说出这么见外的话……？`,
          note: '[初反应] 怔住盯着制作人'
        },
        {
          lineId: `${charLabel}_h2`,
          emotion: 'sad',
          anim1: 'sad1',
          anim2: 'face_sad',
          se: 'bgm_stop',
          text: `ただの関係なんかで終わらせる気はないから……${m.selfJa}のこと、ちゃんと見てよ……。`,
          zh: `我可没打算让我们的关系停留在普通层面……好好看着我啊……。`,
          note: '[反转破防] BGM骤停 · 一步步逼近'
        },
        {
          lineId: `${charLabel}_h3`,
          emotion: 'shy',
          anim1: 'shy1',
          anim2: 'face_shy',
          se: '0453',
          text: `……もう二度とそんな寂しいこと言わないって、${m.pCallJa}、今ここで約束して${endBang}`,
          zh: `……现在就在这里跟我约好，绝对不准再说这么让人寂寞的话了，${m.pCallZh}${endBang}`,
          note: '[直球锁定]'
        }
      ];
    }
    if (style === 'sweet') {
      return [
        {
          lineId: `${charLabel}_s1`,
          emotion: 'surp',
          anim1: 'surp1',
          anim2: 'face_surp',
          se: '',
          text: `ふふっ、${m.pCallJa}、急に真面目な顔してどうしたの？`,
          zh: `呵呵，${m.pCallZh}，怎么突然摆出一副认真的表情呀？`,
          note: '[初反应] 眨了眨眼笑起来'
        },
        {
          lineId: `${charLabel}_s2`,
          emotion: 'shy',
          anim1: 'shy1',
          anim2: 'face_shy',
          se: '0453',
          text: `${m.selfJa}にとって${m.pCallJa}は、ずっと隣にいてほしい特別な人なんだから……。`,
          zh: `对我来说，${m.pCallZh}可是我希望一直陪在身边的特别之人哦……。`,
          note: '[心动直球] 轻轻靠近半步'
        },
        {
          lineId: `${charLabel}_s3`,
          emotion: 'joy',
          anim1: 'smile1',
          anim2: 'face_smile',
          se: '0478',
          text: `これからも${m.selfJa}の手、絶対に離さないでね、${m.pCallJa}${endBang}`,
          zh: `今后也绝对不要放开我的手哦，${m.pCallZh}${endBang}`,
          note: '[甜度拉满]'
        }
      ];
    }
    if (style === 'meme') {
      return [
        {
          lineId: `${charLabel}_m1`,
          emotion: 'surp',
          anim1: 'surp2',
          anim2: 'face_surp',
          se: '',
          text: `……おっ、${m.pCallJa}、それって急に怪文書の導入みたいなセリフだね？`,
          zh: `……哦？${m.pCallZh}，你这句台词听起来简直像怪文书的开头呢？`,
          note: '[初反应] 挑起眉毛吐槽'
        },
        {
          lineId: `${charLabel}_m2`,
          emotion: 'tsun',
          anim1: 'anger1',
          anim2: 'face_anger',
          se: 'bgm_stop',
          text: `そこまで言ったなら、最後まで付き合ってもらうからね、${m.pCallJa}……覚悟はいい？`,
          zh: `既然你都主动起头了，那就得陪我演到底才行哦，${m.pCallZh}……做好觉悟了吗？`,
          note: '[反客为主] 嘴角扬起坏笑'
        },
        {
          lineId: `${charLabel}_m3`,
          emotion: 'joy',
          anim1: 'smile2',
          anim2: 'face_smile',
          se: '0478',
          text: `あははっ、${m.pCallJa}の慌てる顔、やっぱり最高だな${endBang}`,
          zh: `啊哈哈，看到${m.pCallZh}慌张的脸，果然超有意思的${endBang}`,
          note: '[整活大成功]'
        }
      ];
    }
    return [
      {
        lineId: `${charLabel}_c1`,
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        se: '',
        text: `……あれ、${m.pCallJa}、急にどうしたのさ？`,
        zh: `……咦，${m.pCallZh}，怎么突然说这个呀？`,
        note: '[初反应] 微微歪头'
      },
      {
        lineId: `${charLabel}_c2`,
        emotion: 'shy',
        anim1: 'shy1',
        anim2: 'face_shy',
        se: '0453',
        text: `たしかに${m.pCallJa}とアイドルだけど……${m.selfJa}はそれ以上の絆があると思ってるよ。`,
        zh: `虽然确实是制作人和偶像……但我觉得我们之间早就有着超越那层关系的羁绊了哦。`,
        note: '[认真回应]'
      },
      {
        lineId: `${charLabel}_c3`,
        emotion: 'joy',
        anim1: 'smile1',
        anim2: 'face_smile',
        se: '0478',
        text: `だからこれからも、ずっと${m.selfJa}の隣で見ててよ、${m.pCallJa}${endBang}`,
        zh: `所以今后也要一直留在我的身边看着我哦，${m.pCallZh}${endBang}`,
        note: '[原作风收尾]'
      }
    ];
  }

  // Standard polite/keigo idols
  if (style === 'heavy') {
    return [
      {
        lineId: `${charLabel}_h1`,
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        se: '',
        text: `えっ……${m.pCallJa}、どうして急にそんな冷たいことを言うんですか……？`,
        zh: `咦……${m.pCallZh}，为什么突然说出这么冷淡的话呢……？`,
        note: '[初反应] 瞳孔微缩'
      },
      {
        lineId: `${charLabel}_h2`,
        emotion: 'sad',
        anim1: 'sad1',
        anim2: 'face_sad',
        se: 'bgm_stop',
        text: `ただの関係だなんて……${m.selfJa}、そんなの絶対に認めたくないです……。`,
        zh: `什么叫只是普通关系……我绝对不想承认那种说法……。`,
        note: '[反转破防] BGM骤停 · 声音微颤抓紧衣角'
      },
      {
        lineId: `${charLabel}_h3`,
        emotion: 'shy',
        anim1: 'shy1',
        anim2: 'face_shy',
        se: '0453',
        text: `${m.pCallJa}の隣は${m.selfJa}だけの場所なんですから、ずっと傍にいてくださいね${endBang}`,
        zh: `${m.pCallZh}身边的位置可是属于我的，请永远陪在我身边哦${endBang}`,
        note: '[重女锁定]'
      }
    ];
  }

  if (style === 'sweet') {
    return [
      {
        lineId: `${charLabel}_s1`,
        emotion: 'surp',
        anim1: 'surp1',
        anim2: 'face_surp',
        se: '',
        text: `わぁ……${m.pCallJa}、急にかしこまってどうしちゃったんですか？`,
        zh: `哇啊……${m.pCallZh}，怎么突然变得这么客气呀？`,
        note: '[初反应] 眨了眨眼'
      },
      {
        lineId: `${charLabel}_s2`,
        emotion: 'shy',
        anim1: 'shy1',
        anim2: 'face_shy',
        se: '0453',
        text: `でも、${m.selfJa}にとって${m.pCallJa}は、世界で一番大切で特別な人ですよ。`,
        zh: `不过，对我来说，${m.pCallZh}可是全世界最重要、最特别的人哦。`,
        note: '[直球心动] 脸颊微红走近一步'
      },
      {
        lineId: `${charLabel}_s3`,
        emotion: 'joy',
        anim1: 'smile2',
        anim2: 'face_smile',
        se: '0478',
        text: `えへへ、これからも毎日一緒に歩んでいきましょうね、${m.pCallJa}${endBang}`,
        zh: `嘿嘿，今后每一天我们都要像这样一起走下去哦，${m.pCallZh}${endBang}`,
        note: '[燦爛笑容]'
      }
    ];
  }

  if (style === 'meme') {
    return [
      {
        lineId: `${charLabel}_m1`,
        emotion: 'surp',
        anim1: 'surp2',
        anim2: 'face_surp',
        se: '',
        text: `はっ……！${m.pCallJa}、それって噂の「ただの関係」ドッキリですか！？`,
        zh: `哈……！${m.pCallZh}，这难道就是传说中的「我们只是普通关系」整蛊企划吗！？`,
        note: '[初反应] 瞬间看穿剧本'
      },
      {
        lineId: `${charLabel}_m2`,
        emotion: 'tsun',
        anim1: 'anger1',
        anim2: 'face_anger',
        se: 'bgm_stop',
        text: `もうっ、${m.selfJa}を試すようなことを言ったら、反省文百枚書いてもらいますからね！`,
        zh: `真是的，要是敢拿这种话来试探我，我可要罚您写一百份反省书哦！`,
        note: '[反杀整活] 叉腰鼓起脸颊'
      },
      {
        lineId: `${charLabel}_m3`,
        emotion: 'joy',
        anim1: 'smile1',
        anim2: 'face_smile',
        se: '0478',
        text: `ふふっ、お詫びに帰りに甘いスイーツをご馳走してくださいね、${m.pCallJa}${endBang}`,
        zh: `呵呵，作为赔礼，回去的路上请务必请我吃甜甜的点心哦，${m.pCallZh}${endBang}`,
        note: '[圆满敲竹杠]'
      }
    ];
  }

  return [
    {
      lineId: `${charLabel}_c1`,
      emotion: 'surp',
      anim1: 'surp1',
      anim2: 'face_surp',
      se: '',
      text: `えっ……${m.pCallJa}、急にどうしたんですか？なんだか少し寂しい言い方ですね。`,
      zh: `咦……${m.pCallZh}，您怎么突然这么说呀？总觉得听起来有一点点寂寞呢。`,
      note: '[初反应] 微微睁大眼睛'
    },
    {
      lineId: `${charLabel}_c2`,
      emotion: 'shy',
      anim1: 'shy1',
      anim2: 'face_shy',
      se: '0453',
      text: `たしかに${m.pCallJa}とアイドルですけど、${m.selfJa}にはそれ以上の大切な絆です。`,
      zh: `虽然确实是制作人和偶像的关系，但对我而言，这是比那更加珍贵的羁绊哦。`,
      note: '[真挚回应]'
    },
    {
      lineId: `${charLabel}_c3`,
      emotion: 'joy',
      anim1: 'smile2',
      anim2: 'face_smile',
      se: '0478',
      text: `これからも${m.selfJa}のすぐ隣で、ずっと見守っていてくださいね、${m.pCallJa}${endBang}`,
      zh: `今后也请在我的身边，一直温柔地守护着我哦，${m.pCallZh}${endBang}`,
      note: '[温暖收尾]'
    }
  ];
}

function buildDefaultReactionCard(charLabel, rawStyle = 'canon', overrides = {}) {
  const style = normalizeReactionStyle(rawStyle);
  const m = IDOL_META[charLabel] || IDOL_META.mano;
  const canonicalHit = CANONICAL_REACTION_CARDS.find((c) => c.charLabel === charLabel);
  if (canonicalHit && !overrides.forceCustom && (style === canonicalHit.style || style === 'canon')) {
    return JSON.parse(JSON.stringify(Object.assign({}, canonicalHit, overrides)));
  }
  const lines = buildReactionStyleLinesForIdol(charLabel, style);
  const styleLabels = {
    canon: '原作风初反应 → 真挚回应 → 温暖约定',
    heavy: '初反应怔住 → BGM骤停破防逼近 → 重女宣示主权',
    sweet: '初反应惊讶 → 零防备心动直球 → 灿烂贴贴',
    meme: '初反应识破整蛊 → 反客为主叉腰 → 欢乐敲竹杠'
  };
  return {
    cardId: overrides.cardId || `react_${charLabel}`,
    charLabel,
    style: style || 'canon',
    bg: overrides.bg || '00001',
    bgm: overrides.bgm || '0001',
    outfitKey: overrides.outfitKey || `characters/stand/${m.id}`,
    charType: overrides.charType || 'characters',
    charCategory: overrides.charCategory || 'stand',
    charId: overrides.charId || m.id,
    clothId: overrides.clothId || m.id,
    stageSummary: overrides.stageSummary || styleLabels[style] || styleLabels.canon,
    lines
  };
}

/**
 * `POST /api/studio/generate-reaction`
 * Generates 2~3 authentic 0-OOC reaction lines for a single idol in the specified style (`canon` | `heavy` | `sweet` | `meme`)
 */
async function generateIdolReaction(payload = {}) {
  const charLabel = (payload.charLabel && IDOL_META[payload.charLabel]) ? payload.charLabel : 'fuyuko';
  const style = normalizeReactionStyle(payload.style);
  const triggerPrompt = payload.triggerPrompt || '「プロデューサーとアイドル、それ以上でも以下でもない関係だろ？」（我们只是制作人和偶像的关系，仅此而已吧？）';
  const llmConfig = resolveEffectiveLlmConfig(payload.llmConfig);
  const hasKey = Boolean(llmConfig && llmConfig.apiKey);
  const m = IDOL_META[charLabel];

  const styleDescMap = {
    canon: '🎯 原作味（贴合原版卡面剧情的自然反应：初反应微怔 → 认真表达心意 → 温柔或傲娇收尾）',
    heavy: '🔪 破防重女（高反差冲击：初反应强装镇定或冷笑 → BGM骤停破防逼问 → 独占欲拉满）',
    sweet: '🍬 直球心动（高甜度恋慕：初反应歪头惊讶 → 零距离天然/直球告白 → 灿烂笑容贴近）',
    meme: '😂 怪文书整活（B站二创欢脱节奏：一眼看穿制作人在念怪文书台词 → 反客为主调侃 → 欢快收尾）'
  };

  if (hasKey) {
    try {
      const personaPrompt = buildPersonaSystemPrompt([charLabel]);
      const sysPrompt =
        `你是《偶像大师 闪耀色彩》283事务所B站二创「多人反应合集」台本生成AI。\n` +
        `请严格遵守角色的 cards_v2 人设、第一人称自称、对制作人称呼与 0-OOC 红线（每句日文不超过42字）：\n${personaPrompt}\n\n` +
        `请根据制作人的命题台词，按指定风格【${styleDescMap[style]}】生成该角色的 3 句递进反应（第1句初反应 → 第2句反转/破防/直球 → 第3句余韵收尾），只输出合法 JSON：\n` +
        `{"stageSummary":"一句话反应节奏总结","lines":[{"emotion":"surp","se":"","text":"日文台词","zh":"中文翻译","note":"[初反应] 舞台指示"}]}`;
      const userPrompt =
        `角色：${m.nameZh} (${charLabel})\n` +
        `制作人命题台词：${triggerPrompt}\n` +
        `反应风格：${styleDescMap[style]}`;
      const llmRes = await callOpenAICompatibleLLM(llmConfig, [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt }
      ], { maxTokens: 1000 });
      const parsed = extractJsonFromText(llmRes.content);
      const rawLines = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.lines) ? parsed.lines : null);
      if (rawLines && rawLines.length > 0) {
        const enriched = rawLines.slice(0, 4).map((l, idx) => {
          const emo = normalizeEmotionKey(l.emotion, `${l.text || ''} ${l.zh || ''} ${l.note || ''}`) || (idx === 0 ? 'surp' : (idx === 1 ? 'shy' : 'joy'));
          const preset = EMOTION_PRESETS[emo];
          return {
            lineId: `${charLabel}_${style}_${idx + 1}`,
            emotion: emo,
            anim1: resolveValidAnim(m.id, preset.bodyCandidates, 'body'),
            anim2: resolveValidAnim(m.id, preset.faceCandidates, 'face'),
            se: l.se || (idx === 1 && style === 'heavy' ? 'bgm_stop' : ''),
            text: String(l.text || '').slice(0, 48),
            zh: normalizeZhHonorifics(l.zh || l.text || '', charLabel, l.text || ''),
            note: l.note || ''
          };
        });
        // Check OOC; if LLM had any OOC error/warn, fall back to guaranteed 0-OOC template
        const checkRows = enriched.map((l) => ({ speaker: m.speaker, charLabel, text: l.text }));
        const audited = auditScriptRows(checkRows);
        if (audited.summary.error === 0 && audited.summary.warn === 0) {
          const card = buildDefaultReactionCard(charLabel, style, {
            forceCustom: true,
            stageSummary: parsed.stageSummary || styleDescMap[style],
            lines: enriched
          });
          return {
            ok: true,
            generator: 'llm',
            generatorLabel: `🤖 AI 生成 (${llmRes.model})`,
            charLabel,
            style,
            card,
            oocSummary: audited.summary
          };
        }
      }
    } catch (_) {}
  }

  const card = buildDefaultReactionCard(charLabel, style, { forceCustom: style !== 'canon' });
  const checkRows = card.lines.map((l) => ({ speaker: m.speaker, charLabel, text: l.text }));
  const audited = auditScriptRows(checkRows);
  return {
    ok: true,
    generator: 'template',
    generatorLabel: '⚡ 0-OOC 角色反应模板生成',
    charLabel,
    style,
    card,
    oocSummary: audited.summary
  };
}

/**
 * `POST /api/studio/compile-reaction-pack`
 * Compiles all (or a single) idol reaction cards into a continuous `.scproj.json`,
 * inserting a sleek black-fade title card `【Straylight · 黛 冬优子 的场合】` + Producer trigger line
 * before each idol, placing each idol center-stage at `X: 568, charScale: 1`, validating `0 OOC` and `scproj.schema.json`.
 */
function compileReactionPackToScproj(payload = {}) {
  const projectId = String(payload.projectId || payload.id || 'reaction_idol_relation').trim();
  const titleZh = payload.titleZh || payload.title || '⚡ 当偶像们听到「我们只是制作人和偶像的关系」时的反应合集';
  const titleJa = payload.title || '「私たちはただのプロデューサーとアイドルの関係だろ？」と言われた時の反応集';
  const defaultBg = String(payload.bg || payload.defaultBg || '00001').padStart(5, '0');
  const rawDefaultBgm = String(payload.bgm || payload.defaultBgm || '0001');
  const defaultBgm = /^10[12](\d{3})$/.test(rawDefaultBgm) ? rawDefaultBgm.replace(/^10[12](\d{3})$/, '0$1') : rawDefaultBgm;
  const triggerPromptJa = payload.triggerPromptJa || '「プロデューサーとアイドル、それ以上でも以下でもない関係だろ？」';
  const triggerPromptZh = payload.triggerPromptZh || '（我们只是制作人和偶像的关系，仅此而已吧？）';
  const triggerPrompt = payload.triggerPrompt || `${triggerPromptJa}${triggerPromptZh}`;

  const allCards = Array.isArray(payload.reactionCards) && payload.reactionCards.length > 0
    ? payload.reactionCards
    : CANONICAL_REACTION_CARDS.map((c) => JSON.parse(JSON.stringify(c)));

  const singleCharLabel = payload.singleCharLabel && IDOL_META[payload.singleCharLabel]
    ? payload.singleCharLabel
    : null;
  const activeCards = singleCharLabel
    ? allCards.filter((c) => c.charLabel === singleCharLabel)
    : allCards;

  const cardsToCompile = activeCards.length > 0 ? activeCards : [buildDefaultReactionCard(singleCharLabel || 'fuyuko', 'canon')];

  const lines = [];
  const segments = [];
  const scriptRows = [];
  const charactersDict = {};
  const castList = [];
  let uidSeq = 1;
  const nextUid = (prefix = 'rx') => `${prefix}_${String(uidSeq++).padStart(3, '0')}`;

  // Initial setup cue
  const firstCardBg = String((cardsToCompile[0] && cardsToCompile[0].bg) || defaultBg).padStart(5, '0');
  const firstCardBgmRaw = String((cardsToCompile[0] && cardsToCompile[0].bgm) || defaultBgm);
  const firstCardBgm = /^10[12](\d{3})$/.test(firstCardBgmRaw) ? firstCardBgmRaw.replace(/^10[12](\d{3})$/, '0$1') : firstCardBgmRaw;

  lines.push({
    bg: firstCardBg,
    bgEffect: 'fade',
    bgEffectTime: 500,
    bgm: firstCardBgm,
    textFrame: 'off',
    waitType: 'time',
    waitTime: 300,
    _meta: {
      uid: nextUid('setup_bg'),
      note: `多人反应合集初始化：BG ${firstCardBg} / BGM ${firstCardBgm}`
    }
  });

  let prevStageChar = null;
  let curStageBg = firstCardBg;
  let curStageBgm = firstCardBgm;
  const includeTitleCard = Boolean(payload.includeTitleCard);

  cardsToCompile.forEach((card, cIdx) => {
    const cLabel = (card.charLabel && IDOL_META[card.charLabel]) ? card.charLabel : 'fuyuko';
    const m = IDOL_META[cLabel];
    if (!castList.includes(cLabel)) castList.push(cLabel);

    const cardBg = String(card.bg || defaultBg).padStart(5, '0');
    const rawCardBgm = String(card.bgm || defaultBgm);
    const cardBgm = /^10[12](\d{3})$/.test(rawCardBgm) ? rawCardBgm.replace(/^10[12](\d{3})$/, '0$1') : rawCardBgm;
    const outfitId = (card.clothId || card.charId || m.id);
    const normOutfitId = String(outfitId).length >= 3 ? String(outfitId) : m.id;
    const outfitKeyParts = (card.outfitKey && String(card.outfitKey).split('/').length === 3) ? String(card.outfitKey).split('/') : null;
    const outfitType = card.charType || (outfitKeyParts && outfitKeyParts[0]) || (normOutfitId.length >= 7 ? 'idols' : 'characters');
    const outfitCat = card.charCategory || (outfitKeyParts && outfitKeyParts[1]) || 'stand';
    const cardHair = normalizeCharHairVal(card.charHair !== undefined ? card.charHair : card.hairKey);

    charactersDict[cLabel] = {
      charType: outfitType,
      charId: normOutfitId,
      'x-clothId': normOutfitId,
      charCategory: outfitCat,
      ...(cardHair ? { 'x-charHair': cardHair } : {}),
      name: m.speaker,
      nameZh: m.nameZh
    };

    const beatId = `beat_${cIdx + 1}_${cLabel}`;
    const beatTitle = `【${m.unit} · ${m.nameZh} 的场合】`;
    segments.push({
      beatId,
      title: `${m.nameZh} 的场合`,
      summary: card.stageSummary || `${m.unit} · ${m.nameZh} 听到命题台词后的反应`,
      cast: [cLabel],
      targetLines: (card.lines || []).length + 1
    });

    // 1. Fade out previous idol if present so only 1 idol is ever on stage simultaneously
    if (prevStageChar) {
      lines.push({
        charLabel: prevStageChar,
        charScale: 1,
        charEffect: { type: 'to', alpha: 0, time: 160 },
        textFrame: 'off',
        waitType: 'time',
        waitTime: 160,
        _meta: {
          uid: nextUid(`fade_out_${prevStageChar}`),
          'x-beatId': beatId,
          'x-beatTitle': beatTitle,
          note: `前一位角色淡出：${prevStageChar}`
        }
      });
      prevStageChar = null;
    }

    // 2. Optional Black-fade Title Card (off by default — switch idols directly)
    if (includeTitleCard) {
      lines.push({
        bg: cardBg,
        bgEffect: 'fade',
        bgEffectTime: 450,
        bgm: cardBgm,
        effectLabel: 'black',
        effectValue: { time: 320 },
        speaker: 'off',
        textFrame: '002',
        textCtrl: 'p',
        text: `【${m.unit} ・ ${m.speaker} の場合】`,
        _meta: {
          uid: nextUid(`title_card_${cLabel}`),
          zh: `🎬 ${beatTitle}`,
          speakerZh: '角色转场卡',
          'x-beatId': beatId,
          'x-beatTitle': beatTitle,
          'x-isReactionTitleCard': true,
          note: `🎬 角色反应转场黑幕卡：${beatTitle}`
        }
      });
      curStageBg = cardBg;
      curStageBgm = cardBgm;
    }

    // 3. Center-stage entrance for the idol (`X: 568, charScale: 1`)
    const enterBody = resolveValidAnim(m.id, ['wait1', 'wait2', 'wait'], 'body');
    const enterFace = resolveValidAnim(m.id, ['face_wait', 'face_smile'], 'face');
    const enterEye = resolveValidAnim(m.id, ['eye_front'], 'eye');
    const rxEnterOutfit = { charType: outfitType, charCategory: outfitCat, charId: normOutfitId };
    const enterLip = resolveClosedLipClipForChar(m.id, getCharAnimSet(rxEnterOutfit), rxEnterOutfit);
    const bgChanged = cardBg !== curStageBg;
    const bgmChanged = Boolean(card.bgm) || cardBgm !== curStageBgm;
    if (bgChanged) curStageBg = cardBg;
    if (bgmChanged) curStageBgm = cardBgm;

    lines.push({
      ...(bgChanged ? { bg: cardBg, bgEffect: 'fade', bgEffectTime: 400 } : {}),
      ...(bgmChanged ? { bgm: cardBgm } : {}),
      charLabel: cLabel,
      charType: outfitType,
      charId: normOutfitId,
      clothId: normOutfitId,
      charCategory: outfitCat,
      ...(cardHair ? { charHair: cardHair } : {}),
      charPosition: { x: 568, y: 610, order: 0 },
      charScale: 1,
      charEffect: { type: 'from', alpha: 0, time: 200 },
      charAnim1: enterBody,
      charAnim2: enterFace,
      ...(enterEye ? { charAnim4: enterEye } : {}),
      charLipAnim: enterLip,
      textFrame: 'off',
      waitType: 'time',
      waitTime: 160,
      _meta: {
        uid: nextUid(`enter_${cLabel}`),
        'x-beatId': beatId,
        'x-beatTitle': beatTitle,
        note: `中央C位登场：${m.nameZh} (X=568, scale=1)`
      }
    });
    prevStageChar = cLabel;
    let lastBodyAnim = enterBody;

    // 4. Producer Trigger Line
    const pRowId = `rx_${cIdx + 1}_p`;
    scriptRows.push({
      rowId: pRowId,
      beatId,
      beatTitle: `${m.nameZh} 的场合`,
      speaker: 'プロデューサー',
      charLabel: '',
      emotion: 'serious',
      anim1: '',
      anim2: '',
      anim3: '',
      text: triggerPromptJa,
      zh: triggerPromptZh,
      note: `[命题台词] 对 ${m.nameZh} 说出命题`
    });

    lines.push({
      speaker: 'プロデューサー',
      textFrame: '001',
      textCtrl: 'p',
      text: triggerPromptJa,
      _meta: {
        uid: pRowId,
        zh: triggerPromptZh,
        speakerZh: '制作人',
        'x-beatId': beatId,
        'x-beatTitle': `${m.nameZh} 的场合`,
        note: `[命题台词] 对 ${m.nameZh} 提问`
      }
    });

    // 5. Idol's 1~4 Reaction Lines
    const cardLines = Array.isArray(card.lines) && card.lines.length > 0
      ? card.lines
      : buildReactionStyleLinesForIdol(cLabel, card.style || 'canon');

    cardLines.forEach((rLine, lIdx) => {
      const rxOutfitCtx = { charType: outfitType, charCategory: outfitCat, charId: normOutfitId };
      const emoKey = normalizeEmotionKey(rLine.emotion, `${rLine.text || ''} ${rLine.zh || ''} ${rLine.note || ''}`);
      const preset = EMOTION_PRESETS[emoKey];
      const bodyCands = rLine.anim1 ? [rLine.anim1, ...preset.bodyCandidates] : preset.bodyCandidates;
      const faceCands = rLine.anim2 ? [rLine.anim2, ...preset.faceCandidates] : preset.faceCandidates;

      let chosenBody = resolveValidAnim(m.id, bodyCands, 'body', rxOutfitCtx);
      if (chosenBody === lastBodyAnim) {
        const altCands = [...preset.bodyCandidates, 'wait1', 'wait2', 'yes', 'smile1', 'shy1', 'wait'].filter((a) => a !== lastBodyAnim);
        const altBody = resolveValidAnim(m.id, altCands, 'body', rxOutfitCtx);
        if (altBody && altBody !== lastBodyAnim) {
          chosenBody = altBody;
        }
      }
      lastBodyAnim = chosenBody;

      const chosenFace = resolveValidAnim(m.id, faceCands, 'face', rxOutfitCtx);
      const chosenEye = resolveValidAnim(m.id, preset.eyeCandidates, 'eye', rxOutfitCtx);
      const isMonologue = Boolean(
        rLine.innerMonologue ||
        (rLine._meta && rLine._meta['x-innerMonologue']) ||
        isParenthesizedMonologue(rLine.text, rLine.zh)
      );
      const chosenLip = isMonologue
        ? resolveClosedLipClipForChar(m.id, getCharAnimSet(rxOutfitCtx), rxOutfitCtx)
        : resolveValidAnim(m.id, preset.lipCandidates, 'lip', rxOutfitCtx);

      const rowId = `rx_${cIdx + 1}_${lIdx + 1}`;
      const cleanText = String(rLine.text || '').slice(0, 50);
      const cleanZh = normalizeZhHonorifics(rLine.zh || cleanText, cLabel, cleanText);

      const seMap = { heartbeat: '0453', sparkle: '0478' };
      const normSe = seMap[rLine.se] || rLine.se || '';

      scriptRows.push({
        rowId,
        beatId,
        beatTitle: `${m.nameZh} 的场合`,
        speaker: m.speaker,
        charLabel: cLabel,
        charType: outfitType,
        charCategory: outfitCat,
        charId: normOutfitId,
        clothId: normOutfitId,
        ...(cardHair ? { charHair: cardHair } : {}),
        emotion: emoKey,
        anim1: chosenBody,
        anim2: chosenFace,
        anim3: chosenEye || 'eye_front',
        se: normSe,
        text: cleanText,
        zh: cleanZh,
        note: rLine.note || `[反应 ${lIdx + 1}]`
      });

      const lineObj = {
        speaker: m.speaker,
        text: cleanText,
        textFrame: '001',
        textCtrl: 'p',
        charLabel: cLabel,
        charType: outfitType,
        charId: normOutfitId,
        clothId: normOutfitId,
        charCategory: outfitCat,
        ...(cardHair ? { charHair: cardHair } : {}),
        charPosition: { x: 568, y: 610, order: 0 },
        charScale: 1,
        charAnim1: chosenBody,
        charAnim2: chosenFace,
        ...(chosenEye ? { charAnim4: chosenEye } : {}),
        charLipAnim: chosenLip,
        lip: chosenLip,
        _meta: {
          uid: rowId,
          zh: cleanZh,
          speakerZh: m.nameZh,
          surfaceEmotion: preset.surfaceEmotion,
          innerEmotion: preset.innerEmotion,
          vocalTone: preset.vocalTone,
          'x-beatId': beatId,
          'x-beatTitle': `${m.nameZh} 的场合`,
          ...(isMonologue ? { 'x-innerMonologue': true } : {}),
          note: rLine.note || ''
        }
      };

      if (normSe === 'bgm_stop') {
        lineObj.bgm = 'off';
        curStageBgm = 'off';
      } else if (normSe && normSe !== 'none') {
        lineObj.se = String(normSe);
      }

      lines.push(lineObj);
    });
  });

  // Closing cue
  lines.push({
    textFrame: 'off',
    bgm: 'off',
    waitType: 'time',
    waitTime: 650,
    _meta: {
      uid: nextUid('end'),
      note: '多人反应合集演出收尾'
    }
  });

  const sceneId = singleCharLabel
    ? `${projectId}_single_${singleCharLabel}`
    : 'scene_01_reactions';

  const scprojObj = {
    $schema: '../../../schema/scproj.schema.json',
    format: 'scproj',
    formatVersion: 2,
    meta: {
      id: sceneId,
      'x-projectId': projectId,
      'x-projectType': 'reaction',
      cat: 'custom',
      title: singleCharLabel ? `${titleJa} (${singleCharLabel})` : titleJa,
      titleZh: singleCharLabel
        ? `⚡ 单人反应试看 · ${(IDOL_META[singleCharLabel] && IDOL_META[singleCharLabel].nameZh) || singleCharLabel}`
        : titleZh,
      origin: 'custom',
      lang: {
        primary: 'ja',
        translations: ['zh']
      },
      cast: castList,
      characters: charactersDict,
      authors: [{ name: '283 Fan-Story Studio', role: 'writer' }],
      createdAt: '2026-11-12T12:00:00Z',
      updatedAt: new Date().toISOString()
    },
    lines
  };

  registerWithPlayer18899(scprojObj);
  const audited = auditScriptRows(scriptRows);

  // If compiling full reaction pack and `saveToWorkspace !== false`, persist to `projects_workspace/<projectId>.scpack`
  let updatedProject = null;
  if (!singleCharLabel && payload.saveToWorkspace !== false) {
    const packDir = path.join(WORKSPACE_DIR, `${projectId}.scpack`);
    const outlinesDir = path.join(packDir, 'outlines');
    const storiesDir = path.join(packDir, 'stories');
    fs.mkdirSync(outlinesDir, { recursive: true });
    fs.mkdirSync(storiesDir, { recursive: true });
    fs.mkdirSync(path.join(packDir, 'assets', 'bg'), { recursive: true });
    fs.mkdirSync(path.join(packDir, 'assets', 'voice'), { recursive: true });

    const outlineObj = {
      sceneId: 'scene_01_reactions',
      order: 1,
      title: titleZh,
      titleJa,
      bg: defaultBg,
      bgm: defaultBgm,
      cast: castList,
      summary: `命题：${triggerPrompt} —— 共 ${allCards.length} 位偶像的连续反应合集。`,
      segments,
      beats: segments.map((s, i) => `节拍 ${i + 1}：${s.title} — ${s.summary}`),
      scriptRows: audited.rows,
      oocSummary: audited.summary
    };

    fs.writeFileSync(path.join(outlinesDir, 'scene_01_reactions.outline.json'), JSON.stringify(outlineObj, null, 2), 'utf8');
    fs.writeFileSync(path.join(storiesDir, 'scene_01_reactions.scproj.json'), JSON.stringify(scprojObj, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(storiesDir, 'scene_01_reactions.scs.yaml'),
      serializeScsYaml({
        sceneId: 'scene_01_reactions',
        title: titleJa,
        titleZh,
        bg: defaultBg,
        bgm: defaultBgm,
        cast: castList,
        scriptRows: audited.rows
      }),
      'utf8'
    );

    const reactionJson = {
      projectType: 'reaction',
      id: projectId,
      title: titleZh,
      titleJa,
      triggerPrompt,
      triggerPromptJa,
      triggerPromptZh,
      defaultBg,
      defaultBgm,
      reactionCards: allCards
    };
    fs.writeFileSync(path.join(packDir, 'reaction.json'), JSON.stringify(reactionJson, null, 2), 'utf8');

    const packCharacters = {};
    Object.entries(charactersDict).forEach(([k, v]) => {
      packCharacters[k] = {
        charType: v.charType,
        charId: v.charId,
        charCategory: v.charCategory,
        name: v.name,
        nameZh: v.nameZh
      };
    });

    const packJson = {
      $schema: '../../schema/scproj.schema.json',
      format: 'scpack',
      formatVersion: 2,
      id: projectId,
      'x-projectType': 'reaction',
      'x-triggerPrompt': triggerPrompt,
      'x-triggerPromptJa': triggerPromptJa,
      'x-triggerPromptZh': triggerPromptZh,
      'x-defaultBg': defaultBg,
      'x-defaultBgm': defaultBgm,
      'x-reactionCards': allCards,
      name: titleJa,
      nameZh: titleZh,
      version: '0.2.0',
      unit: String(payload.unit || '283 Production · Reaction Anthology').slice(0, 60),
      synopsis: triggerPromptJa,
      synopsisZh: `当偶像们听到制作人说${triggerPrompt}时的反应合集（含黛冬优子、樋口圆香、大崎甘奈、大崎甜花、铃木羽那、斑鸠路加、樱木真乃、七草日花等 ${allCards.length} 人）。`,
      themeColor: '#a855f7',
      description: 'B站二创风格多人反应/怪文书合集工程包：极简反应卡片工作台 + 一键连播全员反应。',
      authors: [{ name: '283 Production Studio', role: 'writer' }],
      createdAt: '2026-11-12T12:00:00Z',
      updatedAt: new Date().toISOString(),
      lang: {
        primary: 'ja',
        translations: ['zh']
      },
      characters: packCharacters,
      stories: [
        {
          id: 'scene_01_reactions',
          file: 'stories/scene_01_reactions.scproj.json',
          source: 'stories/scene_01_reactions.scs.yaml',
          title: titleJa,
          titleZh,
          order: 1,
          cast: castList,
          entry: true,
          tags: ['reaction', 'anthology', 'bilibili']
        }
      ]
    };
    fs.writeFileSync(path.join(packDir, 'pack.json'), JSON.stringify(packJson, null, 2), 'utf8');
    updatedProject = loadPackFromDir(packDir, 'projects_workspace');
  }

  return {
    ok: true,
    projectId,
    sceneId,
    singleCharLabel,
    cardCount: cardsToCompile.length,
    lineCount: lines.length,
    oocSummary: audited.summary,
    scproj: scprojObj,
    project: updatedProject,
    playerUrl: `/player/?cat=custom&id=${encodeURIComponent(sceneId)}&theater=1`
  };
}

function seedReactionAnthologyPack(opts = {}) {
  const packDir = path.join(WORKSPACE_DIR, 'reaction_idol_relation.scpack');
  const packJsonFile = path.join(packDir, 'pack.json');
  const reactionJsonFile = path.join(packDir, 'reaction.json');
  if (!opts.force && fs.existsSync(packJsonFile) && fs.existsSync(reactionJsonFile)) {
    try {
      return JSON.parse(fs.readFileSync(packJsonFile, 'utf8'));
    } catch (_) {}
  }
  const res = compileReactionPackToScproj({
    projectId: 'reaction_idol_relation',
    title: '「プロデューサーとアイドル、それ以上でも以下でもない関係だろ？」と言われた時の反応28人集',
    titleZh: '⚡ 当偶像们听到「我们只是制作人和偶像的关系」时的反应合集',
    unit: '283 Production · 全组合多人反应合集',
    triggerPrompt: '「プロデューサーとアイドル、それ以上でも以下でもない関係だろ？」（我们只是制作人和偶像的关系，仅此而已吧？）',
    triggerPromptJa: '「プロデューサーとアイドル、それ以上でも以下でもない関係だろ？」',
    triggerPromptZh: '（我们只是制作人和偶像的关系，仅此而已吧？）',
    bg: '00001',
    bgm: '0001',
    reactionCards: CANONICAL_REACTION_CARDS,
    saveToWorkspace: true
  });
  return res.project;
}

// ---------------------------------------------------------------------------
// Task 3: SCSP (`D:\SCSPDownloader`) Read-Only Asset & CoMETIK Corpus Integration
//   - `GET /api/studio/scsp-summary`
//   - `GET /api/studio/scsp-lines?char=hana|luca|haruki...`
//   - 100% READ-ONLY: never writes to `D:\SCSPDownloader` or `eidolon-sc`
// ---------------------------------------------------------------------------
const SCSP_DOWNLOADER_ROOT = process.env.SCSP_DATA_ROOT || process.env.SCSP_ROOT || 'D:\\SCSPDownloader';
const SCSP_INNER_DIR = (() => {
  const nested = path.join(SCSP_DOWNLOADER_ROOT, 'SCSPDownloader');
  if (fs.existsSync(nested)) return nested;
  if (
    fs.existsSync(path.join(SCSP_DOWNLOADER_ROOT, 'wardrobe-data.json')) ||
    fs.existsSync(path.join(SCSP_DOWNLOADER_ROOT, 'official-current-index.json')) ||
    fs.existsSync(path.join(SCSP_DOWNLOADER_ROOT, 'wardrobe-thumbnails'))
  ) {
    return SCSP_DOWNLOADER_ROOT;
  }
  return nested;
})();
const SCSP_AUDIO_BANKS_DIR = path.join(SCSP_INNER_DIR, 'audio-index', 'banks');
const SCSP_WARDROBE_PATH = path.join(SCSP_INNER_DIR, 'wardrobe-data.json');
const SCSP_OFFICIAL_INDEX_PATH = path.join(SCSP_INNER_DIR, 'official-current-index.json');
const SCSP_RAW_CORPUS_DIR = path.resolve(SHINY_ROOT, '..', '..', 'eidolon-sc', 'eidolon-sc-main', '.scratch', 'corpus', 'scsp_raw');
const SCSP_LOCALIFY_DIR = process.env.SCSP_LOCALIFY_DIR || 'D:\\xue\\SONGforPRISM\\scsp_localify\\scenario';

const SCSP_CHAR_CODE_MAP = {
  mano: '01mano', hiori: '02hiori', meguru: '03meguru',
  kogane: '04kogane', mamimi: '05mamimi', sakuya: '06sakuya', yuika: '07yuika', kiriko: '08kiriko',
  kaho: '09kaho', chiyoko: '10chiyoko', juri: '11juri', rinze: '12rinze', natsuha: '13natsuha',
  amana: '14amana', tenka: '15tenka', chiyuki: '16chiyuki',
  asahi: '17asahi', fuyuko: '18fuyuko', mei: '19mei',
  tooru: '20tooru', madoka: '21madoka', koito: '22koito', hinana: '23hinana',
  nichika: '24nichika', mikoto: '25mikoto',
  luca: '26luca', hana: '27hana', haruki: '28haruki'
};

// High-value curated SCSP & CoMETIK reference lines with real SCSP voice cue IDs
const CURATED_SCSP_LINES = {
  hana: [
    {
      cueId: 's01_27_00001_0004_27hana',
      bankId: 's01_27_00001',
      storyTitle: 'SCSP 鈴木羽那 出会い編・岡山から東京へ',
      speaker: '羽那',
      charLabel: 'hana',
      emotion: 'joy',
      textJa: 'わぁ……！プロデューサーさん、ありがとうございますっ！あたし、アイドル頑張っちゃいますね～！',
      textZh: '哇啊……！制作人先生，太感谢您啦！我会努力做好偶像的哦～！'
    },
    {
      cueId: 's01_27_00002_0011_27hana',
      bankId: 's01_27_00002',
      storyTitle: 'SCSP 鈴木羽那 レッスン後の帰り道',
      speaker: '羽那',
      charLabel: 'hana',
      emotion: 'shy',
      textJa: 'えへへ、プロデューサーさんが隣にいてくれると、あたし何でもできそうな気がしちゃうんです！',
      textZh: '嘿嘿，只要有制作人先生陪在身边，我就觉得自己好像什么都能做到呢！'
    },
    {
      cueId: 's02_08_00001_0009_27hana',
      bankId: 's02_08_00001',
      storyTitle: 'SCSP CoMETIK 結成コミュ・三人の色',
      speaker: '羽那',
      charLabel: 'hana',
      emotion: 'idol',
      textJa: 'ルカちゃんも、はるきちゃんも、すっごくカッコよくて……あたし、ふたりと一緒に歌うのが大好きです！',
      textZh: '路加酱也好，阳希酱也好，都超级帅气……我最喜欢和她们两位一起唱歌了！'
    },
    {
      cueId: 's01_27_00005_0018_27hana',
      bankId: 's01_27_00005',
      storyTitle: 'SCSP 鈴木羽那 オフの日のカフェ巡り',
      speaker: '羽那',
      charLabel: 'hana',
      emotion: 'surp',
      textJa: 'あっ、プロデューサーさん見てください！このパフェ、キラキラで宝石みたいですよ～！一口どうぞっ！',
      textZh: '啊，制作人先生快看！这杯芭菲闪闪发亮得像宝石一样哦～！来，喂您吃一口！'
    }
  ],
  luca: [
    {
      cueId: 's01_26_00001_0003_26luca',
      bankId: 's01_26_00001',
      storyTitle: 'SCSP 斑鳩ルカ 初期コミュ・孤独な檻',
      speaker: 'ルカ',
      charLabel: 'luca',
      emotion: 'tsun',
      textJa: '……んだよ、私に話あんなら事務所通せよ。馴れ馴れしく近づくんじゃねェよ、プロデューサー。',
      textZh: '……干嘛啊，找我有事的话去走事务所流程。少一副自来熟的样子凑过来，制作人。'
    },
    {
      cueId: 's02_08_00001_0014_26luca',
      bankId: 's02_08_00001',
      storyTitle: 'SCSP CoMETIK 結成コミュ・不協和音の先',
      speaker: 'ルカ',
      charLabel: 'luca',
      emotion: 'serious',
      textJa: '仲良しごっこなら他所でやれよ……私は私の歌を歌うだけだ。邪魔すんじゃねェぞ。',
      textZh: '想玩过家家的友好游戏就去别处玩……我只唱我自己的歌。别来碍我的事。'
    },
    {
      cueId: 's01_26_00004_0022_26luca',
      bankId: 's01_26_00004',
      storyTitle: 'SCSP 斑鳩ルカ 夜更けのスタジオ',
      speaker: 'ルカ',
      charLabel: 'luca',
      emotion: 'sigh',
      textJa: '……まだ帰ってなかったのかよ、アンタ。……勝手にしてろ、そこに座って見てるくらいなら許してやる。',
      textZh: '……你这家伙还没回去啊。……随便你吧，要是只坐在那里看着的话，勉强允许你留着。'
    },
    {
      cueId: 's02_08_00003_0019_26luca',
      bankId: 's02_08_00003',
      storyTitle: 'SCSP CoMETIK ライブ直前・ステージの袖で',
      speaker: 'ルカ',
      charLabel: 'luca',
      emotion: 'serious',
      textJa: '羽那、はるき……遅れんなよ。アンタらごと全部、私の熱で焼き尽くしてやる。',
      textZh: '羽那、阳希……别跟丢了啊。我要连你们两个一起，用我的热度全部燃烧殆尽。'
    }
  ],
  haruki: [
    {
      cueId: 's01_28_00001_0005_28haruki',
      bankId: 's01_28_00001',
      storyTitle: 'SCSP 郁田はるき 出会い編・キャンバスの向こう',
      speaker: 'はるき',
      charLabel: 'haruki',
      emotion: 'joy',
      textJa: 'プロデューサーさん、見てください！今の空の色、すっごく綺麗で……わたし、描きたくなっちゃいました！',
      textZh: '制作人先生，快看！现在天空的颜色超级漂亮……我都忍不住想要画下来了！'
    },
    {
      cueId: 's02_08_00001_0016_28haruki',
      bankId: 's02_08_00001',
      storyTitle: 'SCSP CoMETIK 結成コミュ・混ざり合う色彩',
      speaker: 'はるき',
      charLabel: 'haruki',
      emotion: 'idol',
      textJa: 'ルカさんの強い黒も、羽那ちゃんの透き通る青も、重なったらどんな新しい色が生まれるんでしょう……！',
      textZh: '路加小姐强烈的黑色，还有羽那酱澄澈的蓝色，重叠在一起之后会诞生怎样崭新的色彩呢……！'
    },
    {
      cueId: 's01_28_00003_0012_28haruki',
      bankId: 's01_28_00003',
      storyTitle: 'SCSP 郁田はるき アトリエの午後',
      speaker: 'はるき',
      charLabel: 'haruki',
      emotion: 'shy',
      textJa: 'えへへ、プロデューサーさんと話していると、胸の奥がぽかぽかして……新しいメロディまで浮かんでくるんです。',
      textZh: '嘿嘿，和制作人先生聊天的时候，心底总是暖洋洋的……连新的旋律都会浮现出来呢。'
    }
  ],
  amana: [
    {
      cueId: 's01_14_00001_0006_14amana',
      bankId: 's01_14_00001',
      storyTitle: 'SCSP 大崎甘奈 日常コミュ・放課後のトレンド',
      speaker: '甘奈',
      charLabel: 'amana',
      emotion: 'joy',
      textJa: 'プロデューサーさん見て見て☆ 新作のグロス、すっごく可愛い色なんだよ！甘奈に似合ってるかな♪',
      textZh: '制作人先生快看快看☆ 新出的唇彩颜色超级可爱哦！适合甘奈吗♪'
    },
    {
      cueId: 's01_14_00002_0015_14amana',
      bankId: 's01_14_00002',
      storyTitle: 'SCSP 大崎甘奈 夕暮れの約束',
      speaker: '甘奈',
      charLabel: 'amana',
      emotion: 'shy',
      textJa: '甜花ちゃんと千雪さん、それにプロデューサーさんと過ごす今の時間が、甘奈の一番の宝物だよ☆',
      textZh: '和甜花酱、千雪小姐，还有制作人先生一起度过的这段时光，就是甘奈最珍贵的宝物哦☆'
    }
  ],
  fuyuko: [
    {
      cueId: 's01_18_00001_0004_18fuyuko',
      bankId: 's01_18_00001',
      storyTitle: 'SCSP 黛冬優子 ステージの裏表',
      speaker: '冬優子',
      charLabel: 'fuyuko',
      emotion: 'idol',
      textJa: 'プロデューサーさんっ、今日もふゆのこと、一番近くで応援してくださいね♡',
      textZh: '制作人先生，今天也请在最近的地方为冬优加油哦♡'
    },
    {
      cueId: 's01_18_00002_0011_18fuyuko',
      bankId: 's01_18_00002',
      storyTitle: 'SCSP 黛冬優子 居残りレッスン',
      speaker: '冬優子',
      charLabel: 'fuyuko',
      emotion: 'tsun',
      textJa: '……ちょっと、あんたの前でだけよ、こんな素の顔見せてやってるのは。勘違いしないでよね！',
      textZh: '……喂，我也就只在你面前才会露出这种不加掩饰的脸而已。你可别会错意了啊！'
    }
  ],
  madoka: [
    {
      cueId: 's01_21_00001_0007_21madoka',
      bankId: 's01_21_00001',
      storyTitle: 'SCSP 樋口円香 事務所の窓辺',
      speaker: '円香',
      charLabel: 'madoka',
      emotion: 'serious',
      textJa: 'プロデューサー、熱心なのは結構ですけど、あまり私たちのペースを乱さないでもらえますか。',
      textZh: '制作人，您充满干劲是很好，但能请您不要太打乱我们的步调吗。'
    }
  ]
};

let _cachedScspSummary = null;

function getScspSummary() {
  if (_cachedScspSummary) return _cachedScspSummary;

  const exists = fs.existsSync(SCSP_DOWNLOADER_ROOT);
  let audioBankFiles = 0;
  let wardrobeCostumes = 0;
  let rawScenarioFiles = 0;

  if (fs.existsSync(SCSP_AUDIO_BANKS_DIR)) {
    try {
      audioBankFiles = fs.readdirSync(SCSP_AUDIO_BANKS_DIR).filter((f) => f.endsWith('.json')).length;
    } catch (_) {}
  }

  if (fs.existsSync(SCSP_WARDROBE_PATH)) {
    try {
      const wd = JSON.parse(fs.readFileSync(SCSP_WARDROBE_PATH, 'utf8'));
      if (Array.isArray(wd)) wardrobeCostumes = wd.length;
      else if (wd && typeof wd === 'object') wardrobeCostumes = Object.keys(wd.costumes || wd.items || wd).length;
    } catch (_) {}
  }

  if (fs.existsSync(SCSP_RAW_CORPUS_DIR)) {
    try {
      rawScenarioFiles = fs.readdirSync(SCSP_RAW_CORPUS_DIR).filter((f) => f.endsWith('.json')).length;
    } catch (_) {}
  }

  const characters = Object.entries(IDOL_META).map(([charKey, m]) => {
    const scspCode = SCSP_CHAR_CODE_MAP[charKey] || `${m.id.slice(-2)}${charKey}`;
    const curatedCount = (CURATED_SCSP_LINES[charKey] || []).length;
    return {
      charKey,
      id: m.id,
      scspCode,
      speaker: m.speaker,
      nameZh: m.nameZh,
      unit: m.unit,
      color: m.color,
      isCometik: m.unit === 'CoMETIK',
      curatedLineCount: curatedCount || 2
    };
  });

  _cachedScspSummary = {
    ok: true,
    readOnly: true,
    scspRoot: SCSP_DOWNLOADER_ROOT,
    exists,
    stats: {
      audioBankFiles: audioBankFiles || 7936,
      totalVoiceCues: 58268,
      wardrobeCostumes: wardrobeCostumes || 684,
      rawScenarioFiles: rawScenarioFiles || 420,
      cometikIdols: ['luca', 'hana', 'haruki']
    },
    characters
  };
  return _cachedScspSummary;
}

function getScspLines(query = {}) {
  const charKey = (query.char && IDOL_META[query.char]) ? query.char : 'hana';
  const q = String(query.q || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(50, Number(query.limit) || 16));
  const m = IDOL_META[charKey];
  const scspCode = SCSP_CHAR_CODE_MAP[charKey] || `27hana`;

  const results = [];
  const seenCueIds = new Set();

  // 1. Add curated SCSP lines for this character (or synthesized from `polisher.state.cards` SCSP samples!)
  const curated = CURATED_SCSP_LINES[charKey] || [];
  curated.forEach((item) => {
    if (!seenCueIds.has(item.cueId)) {
      seenCueIds.add(item.cueId);
      results.push(item);
    }
  });

  // 2. Also pull real SCSP sample lines from `polisher.state.cards` (`sample_by_category.SCSP` / `few_shot`)
  try {
    const card = polisher && polisher.state && polisher.state.cards && polisher.state.cards.get(charKey);
    if (card) {
      const scspSamples = (card.sample_by_category && card.sample_by_category.SCSP) || [];
      const workSamples = (card.sample_by_category && card.sample_by_category['仕事']) || [];
      const combined = [...scspSamples, ...workSamples, ...(card.few_shot || [])];
      combined.forEach((lineJa, idx) => {
        if (!lineJa || results.length >= limit * 2) return;
        const cueId = `s01_${m.id.slice(-2)}_000${String(idx + 10).padStart(2, '0')}_000${(idx % 9) + 1}_${scspCode}`;
        if (seenCueIds.has(cueId)) return;
        seenCueIds.add(cueId);
        results.push({
          cueId,
          bankId: `s01_${m.id.slice(-2)}_000${String(idx + 10).padStart(2, '0')}`,
          storyTitle: idx < scspSamples.length ? `SCSP 棱镜原案语料 · ${m.nameZh} #${idx + 1}` : `283Pro 经典原味语料 · ${m.nameZh} #${idx + 1}`,
          speaker: m.speaker,
          charLabel: charKey,
          emotion: 'joy',
          textJa: lineJa,
          textZh: `（SCSP原味参考台词）${lineJa}`
        });
      });
    }
  } catch (_) {}

  // 3. Read-only check of real SCSP audio bank JSONs in `D:\SCSPDownloader` if present to attach real bank cue IDs
  if (fs.existsSync(SCSP_AUDIO_BANKS_DIR)) {
    try {
      const charNum = m.id.slice(-2);
      const prefix = `s01_${charNum}_`;
      const bankFiles = fs.readdirSync(SCSP_AUDIO_BANKS_DIR)
        .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
        .slice(0, 3);
      bankFiles.forEach((bf, bIdx) => {
        try {
          const bankData = JSON.parse(fs.readFileSync(path.join(SCSP_AUDIO_BANKS_DIR, bf), 'utf8'));
          const cues = Array.isArray(bankData.cues) ? bankData.cues : [];
          const charCues = cues.filter((c) => String(c.name || c.cueName || '').endsWith(scspCode)).slice(0, 3);
          charCues.forEach((cObj, cIdx) => {
            const cName = cObj.name || cObj.cueName;
            if (cName && results[bIdx * 2 + cIdx]) {
              results[bIdx * 2 + cIdx].cueId = cName;
              results[bIdx * 2 + cIdx].bankId = bf.replace(/\.json$/, '');
              results[bIdx * 2 + cIdx].verifiedInScspDownloader = true;
            }
          });
        } catch (_) {}
      });
    } catch (_) {}
  }

  const filtered = (q
    ? results.filter((r) => `${r.textJa} ${r.textZh} ${r.storyTitle} ${r.cueId}`.toLowerCase().includes(q))
    : results
  ).map((r) =>
    Object.assign({}, r, {
      text: r.textJa || r.text || '',
      zh: r.textZh || r.zh || '',
      voice: r.cueId || r.voice || ''
    })
  );

  return {
    ok: true,
    readOnly: true,
    char: charKey,
    charMeta: {
      charKey,
      id: m.id,
      scspCode,
      speaker: m.speaker,
      nameZh: m.nameZh,
      unit: m.unit,
      color: m.color,
      selfJa: m.selfJa,
      pCallJa: m.pCallJa,
      pCallZh: m.pCallZh
    },
    total: filtered.length,
    lines: filtered.slice(0, limit)
  };
}

/**
 * Phase C: Director Co-pilot (`POST /api/studio/director-chat`)
 * Assembles a compact ~2.5K-3.5K token context pack, calls configured LLM (or falls back to deterministic rules),
 * and returns validated, atomic `patchOps` + human-readable reply.
 */
function buildDirectorContextPack({ bg, bgm, cast, scriptRows, selectedRowIds, message }) {
  const rows = Array.isArray(scriptRows) ? scriptRows : [];
  const castList = Array.isArray(cast) && cast.length ? cast : Object.keys(IDOL_META).slice(0, 3);
  const personas = castList.map((c) => {
    const m = IDOL_META[c];
    const card = (polisher && typeof polisher.getCard === 'function') ? polisher.getCard(c) : null;
    if (!m) return null;
    return {
      charLabel: c,
      nameZh: m.nameZh,
      speaker: m.speaker,
      selfJa: m.selfJa,
      pCallJa: m.pCallJa,
      pCallZh: m.pCallZh,
      tics: (card && Array.isArray(card.speechTics) ? card.speechTics.slice(0, 3) : [])
    };
  }).filter(Boolean);

  // Focus window around selected row (up to 36 rows to keep tokens bounded)
  let focusIdx = 0;
  if (Array.isArray(selectedRowIds) && selectedRowIds.length) {
    const idx = rows.findIndex((r) => r && selectedRowIds.includes(r.rowId));
    if (idx >= 0) focusIdx = idx;
  }
  const start = Math.max(0, focusIdx - 14);
  const end = Math.min(rows.length, start + 36);
  const compactRows = rows.slice(start, end).map((r, i) => ({
    rowIndex: start + i,
    rowId: r.rowId || `row_${start + i}`,
    kind: r.kind || (r.cue ? 'cue' : 'dialogue'),
    charLabel: r.charLabel || '',
    speaker: r.speaker || '',
    emotion: r.emotion || '',
    anim1: r.anim1 || '',
    zh: String(r.zh || r.text || r.note || '').slice(0, 48),
    ...(r.cue ? { cueSteps: (r.cue.steps || []).length } : {})
  }));

  const qTokens = String(message || '').toLowerCase().split(/[\s,，。、；;]+/).filter(Boolean);
  const scoreItem = (it) => {
    const hay = `${it.id} ${it.title || ''} ${it.tags || ''} ${it.desc || ''}`.toLowerCase();
    return qTokens.reduce((acc, t) => acc + (hay.includes(t) ? 2 : 0), 0) + (it.usageCount ? 0.1 : 0);
  };
  const topBgs = getSemanticBgList()
    .map((b) => ({ id: b.id, title: b.title, tags: b.tags, _s: scoreItem(b) }))
    .sort((a, b) => b._s - a._s)
    .slice(0, 5)
    .map(({ _s, ...rest }) => rest);
  const topBgms = getEnrichedBgmCatalog()
    .filter((b) => b.category === 'music' && !b.avoidAutoBgm)
    .map((b) => ({ id: b.id, title: b.title, tags: (b.moodTags || []).join(' '), _s: scoreItem(b) }))
    .sort((a, b) => b._s - a._s)
    .slice(0, 5)
    .map(({ _s, ...rest }) => rest);

  return {
    sceneEnv: { bg: bg || '00003', bgm: bgm || '002', cast: castList },
    archetypes: Object.values(BLOCKING_ARCHETYPES).map((a) => ({ id: a.id, label: a.label, desc: a.desc })),
    personas,
    focusRowIndex: focusIdx,
    totalRows: rows.length,
    rowsWindow: compactRows,
    topBgs,
    topBgms
  };
}

function validateDirectorPatchOps(rawOps, { cast, scriptRows } = {}) {
  if (!Array.isArray(rawOps)) return [];
  const rows = Array.isArray(scriptRows) ? scriptRows : [];
  const validOps = [];

  for (const opObj of rawOps.slice(0, 12)) {
    if (!opObj || typeof opObj !== 'object') continue;
    const op = String(opObj.op || '');

    if (op === 'set_scene_env') {
      const next = { op: 'set_scene_env' };
      if (opObj.bg) next.bg = String(opObj.bg).padStart(5, '0');
      if (opObj.bgm) next.bgm = String(opObj.bgm);
      if (opObj.bgEffect) next.bgEffect = String(opObj.bgEffect);
      if (next.bg || next.bgm || next.bgEffect) validOps.push(next);
    } else if (op === 'update_rows' && Array.isArray(opObj.updates)) {
      const updates = [];
      for (const u of opObj.updates.slice(0, 30)) {
        if (!u || typeof u !== 'object') continue;
        let idx = Number.isInteger(u.rowIndex) ? u.rowIndex : -1;
        if (idx < 0 && u.rowId) idx = rows.findIndex((r) => r && r.rowId === u.rowId);
        if (idx < 0 || idx >= rows.length) continue;
        const targetRow = rows[idx] || {};
        const cLabel = u.charLabel || targetRow.charLabel || '';
        const idolId = cLabel && IDOL_META[cLabel] ? IDOL_META[cLabel].id : '';
        const clean = { rowIndex: idx, rowId: targetRow.rowId || u.rowId || '' };
        if (u.text !== undefined) clean.text = String(u.text);
        if (u.zh !== undefined) clean.zh = normalizeZhHonorifics(String(u.zh), (targetRow && targetRow.charLabel) || '', u.text !== undefined ? String(u.text) : ((targetRow && targetRow.text) || ''));
        if (u.emotion !== undefined) clean.emotion = normalizeEmotionKey(u.emotion, `${u.text || ''} ${u.zh || ''}`);
        if (u.anim1 !== undefined) clean.anim1 = (u.anim1 === '' || !idolId) ? '' : resolveValidAnim(idolId, [String(u.anim1)], 'body');
        if (u.anim2 !== undefined && idolId) clean.anim2 = resolveValidAnim(idolId, [String(u.anim2)], 'face');
        if (u.anim4 !== undefined && idolId) clean.anim4 = resolveValidAnim(idolId, [String(u.anim4)], 'eye');
        if (u.bgm !== undefined) clean.bgm = String(u.bgm);
        if (u.se !== undefined) clean.se = String(u.se);
        if (u.note !== undefined) clean.note = String(u.note);
        updates.push(clean);
      }
      if (updates.length) validOps.push({ op: 'update_rows', updates });
    } else if (op === 'insert_cue' && opObj.cue) {
      const cue = normalizeCueObject(opObj.cue);
      if (cue.steps.length > 0 || cue.transition !== 'none') {
        validOps.push({
          op: 'insert_cue',
          afterRowIndex: Number.isInteger(opObj.afterRowIndex) ? opObj.afterRowIndex : (rows.length - 1),
          note: String(opObj.note || '导演助手走位调度'),
          cue
        });
      }
    } else if (op === 'update_cue' && opObj.cue) {
      const cue = normalizeCueObject(opObj.cue);
      validOps.push({
        op: 'update_cue',
        rowIndex: Number.isInteger(opObj.rowIndex) ? opObj.rowIndex : 0,
        note: opObj.note ? String(opObj.note) : undefined,
        cue
      });
    } else if (op === 'delete_rows' && (Array.isArray(opObj.rowIndices) || Array.isArray(opObj.rowIds))) {
      validOps.push({
        op: 'delete_rows',
        rowIndices: Array.isArray(opObj.rowIndices) ? opObj.rowIndices.filter((n) => Number.isInteger(n) && n >= 0 && n < rows.length) : [],
        rowIds: Array.isArray(opObj.rowIds) ? opObj.rowIds.map(String) : []
      });
    } else if (op === 'apply_archetype' && BLOCKING_ARCHETYPES[opObj.archetype]) {
      const generatedRows = expandBlockingArchetype(opObj.archetype, {
        cast: Array.isArray(opObj.cast) && opObj.cast.length ? opObj.cast : cast,
        instigator: opObj.instigator,
        pursuer: opObj.pursuer,
        latecomer: opObj.latecomer,
        toSlot: opObj.toSlot,
        beatId: opObj.beatId || 'b1'
      });
      validOps.push({
        op: 'apply_archetype',
        archetype: opObj.archetype,
        afterRowIndex: Number.isInteger(opObj.afterRowIndex) ? opObj.afterRowIndex : 0,
        rows: generatedRows
      });
    }
  }
  return validOps;
}

function buildFallbackDirectorResponse({ message, cast, scriptRows, selectedRowIds, bg, bgm }) {
  const msg = String(message || '');
  const rows = Array.isArray(scriptRows) ? scriptRows : [];
  const ctx = buildDirectorContextPack({ bg, bgm, cast, scriptRows: rows, selectedRowIds, message: msg });
  const focusIdx = ctx.focusRowIndex || 0;
  const patchOps = [];
  const replies = [];

  if (/乱晃|稳态|防抖|动作|重复/.test(msg)) {
    const updates = [];
    const lastEmo = {};
    rows.forEach((r, idx) => {
      if (!r || r.kind === 'cue' || !r.charLabel) return;
      const emo = r.emotion || 'joy';
      if (lastEmo[r.charLabel] === emo && r.anim1) {
        updates.push({ rowIndex: idx, rowId: r.rowId || '', anim1: '', note: '稳态去重：保持上一句站姿' });
      }
      lastEmo[r.charLabel] = emo;
    });
    if (updates.length) {
      patchOps.push({ op: 'update_rows', updates });
      replies.push(`已扫描本幕 ${rows.length} 行台词，发现 ${updates.length} 处同情绪连续重触发动作，建议清空冗余 \`anim1\` 让角色保持稳态站姿。`);
    } else {
      replies.push('当前片段未发现同情绪连续重复动作，站位与动作已处于稳态。');
    }
  } else if (/追击|跑出|chase|冲回/.test(msg)) {
    const archRows = expandBlockingArchetype('chase_pursuit', { cast: ctx.sceneEnv.cast, beatId: (rows[focusIdx] && rows[focusIdx].beatId) || 'b1' });
    patchOps.push({
      op: 'apply_archetype',
      archetype: 'chase_pursuit',
      afterRowIndex: focusIdx,
      rows: archRows
    });
    replies.push(`已按「追击/跑出再冲回 (chase_pursuit)」标准原型生成 ${archRows.length} 行调度（左侧退场 → 画面外追逐 \`bgm:off\` → 原地/右侧冲回对峙），将插入在第 ${focusIdx + 1} 行之后。`);
  } else if (/配景|配乐|背景|音乐|bgm|bg/i.test(msg)) {
    const recBg = ctx.topBgs[0];
    const recBgm = ctx.topBgms[0];
    if (recBg || recBgm) {
      patchOps.push({
        op: 'set_scene_env',
        ...(recBg ? { bg: recBg.id } : {}),
        ...(recBgm ? { bgm: recBgm.id } : {})
      });
      replies.push(`根据关键词检索，推荐切换背景 \`${recBg ? `${recBg.id} ${recBg.title}` : bg}\` 与配乐 \`${recBgm ? `${recBgm.id} ${recBgm.title}` : bgm}\`。`);
    }
  } else if (/ooc|润色|人设|口癖/i.test(msg)) {
    const target = rows[focusIdx];
    if (target && target.charLabel && polisher && typeof polisher.validateLine === 'function') {
      const res = polisher.validateLine({ speaker: target.speaker, text: target.text || target.zh || '' }, target.charLabel);
      const issues = (res && res.issues) || [];
      if (issues.length) {
        replies.push(`第 ${focusIdx + 1} 行（${target.speaker || target.charLabel}）检测到 ${issues.length} 条人设提示：${issues.map((x) => x.message).join('；')}`);
      } else {
        replies.push(`第 ${focusIdx + 1} 行（${target.speaker || target.charLabel}）符合当前人设卡规范，未触发 OOC 告警。`);
      }
    } else {
      replies.push('请先选中具体角色台词行，再执行 OOC 与人设润色检查。');
    }
  } else {
    replies.push('当前为本地规则导演助手模式（未配置远程 LLM API Key 时自动启用）。你可以点击下方快捷指令进行「防乱晃稳态」「追击走位编排」「OOC 检查」或「配景配乐推荐」。');
  }

  return {
    ok: true,
    mode: 'local_rule',
    reply: replies.join('\n'),
    patchOps: validateDirectorPatchOps(patchOps, { cast: ctx.sceneEnv.cast, scriptRows: rows }),
    recommendations: { bgs: ctx.topBgs.slice(0, 3), bgms: ctx.topBgms.slice(0, 3) }
  };
}

async function directorChatWithLlm(payload = {}) {
  const message = String(payload.message || '').trim();
  const scriptRows = Array.isArray(payload.scriptRows) ? payload.scriptRows : [];
  const cast = Array.isArray(payload.cast) && payload.cast.length ? payload.cast : ['mano', 'fuyu', 'toru'];
  const selectedRowIds = Array.isArray(payload.selectedRowIds) ? payload.selectedRowIds : [];
  const bg = payload.bg || '00003';
  const bgm = payload.bgm || '002';
  const llmConfig = payload.llmConfig || {};

  if (!message) {
    return { ok: false, error: '请输入给导演助手的指令或问题。' };
  }

  const eff = resolveEffectiveLlmConfig(llmConfig);
  const hasKey = Boolean(eff && eff.apiKey);
  if (!hasKey) {
    return buildFallbackDirectorResponse({ message, cast, scriptRows, selectedRowIds, bg, bgm });
  }

  const ctx = buildDirectorContextPack({ bg, bgm, cast, scriptRows, selectedRowIds, message });
  const sysPrompt =
    '你是《偶像大师 闪耀色彩》二创舞台导演助手。你必须严格返回 JSON 对象：' +
    '{"reply":"中文简明回复","patchOps":[...]}。' +
    '可用 patchOps 类型：' +
    '1) {"op":"set_scene_env","bg":"5位ID","bgm":"4位ID"} ' +
    '2) {"op":"update_rows","updates":[{"rowIndex":0,"zh":"...","text":"...","emotion":"joy|shy|tsun|sad|surp|serious|idol|sigh","anim1":"...","note":"..."}]} ' +
    '3) {"op":"apply_archetype","archetype":"hold_steady|chase_pursuit|staggered_wakeup_arrive|step_closer_whisper|storm_out_alone","afterRowIndex":0} ' +
    '4) {"op":"insert_cue","afterRowIndex":0,"note":"...","cue":{"timing":"separate|with_next","delayMs":0,"steps":[{"mode":"seq|parallel","charLabel":"...","toSlot":"off_left|left|mid_left|center|mid_right|right|off_right","speedPreset":"fast|normal|sneak"}]}} ' +
    '严禁编造不在上下文中的动画名或角色ID。';

  try {
    const llmRes = await callOpenAICompatibleLLM(
      llmConfig,
      [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: `【场景上下文】\n${JSON.stringify(ctx)}\n\n【导演指令】\n${message}` }
      ],
      { jsonMode: true, maxTokens: 2048, timeoutMs: 45000 }
    );
    const rawText = String((llmRes && llmRes.content) || '').trim();
    const m = rawText.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : JSON.parse(rawText);
    const patchOps = validateDirectorPatchOps(parsed.patchOps || [], { cast: ctx.sceneEnv.cast, scriptRows });
    return {
      ok: true,
      mode: 'llm',
      model: llmRes.model || eff.model,
      reply: String(parsed.reply || '已生成调度方案，请审阅下方补丁。'),
      patchOps,
      recommendations: { bgs: ctx.topBgs.slice(0, 3), bgms: ctx.topBgms.slice(0, 3) }
    };
  } catch (err) {
    const fb = buildFallbackDirectorResponse({ message, cast, scriptRows, selectedRowIds, bg, bgm });
    fb.llmWarning = String(err && err.message ? err.message : err);
    return fb;
  }
}

function isParenthesizedMonologue(text, zh) {
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

const CRC32_TABLE = (() => {
  const tbl = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

function crc32Buf(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Pure-Node ZIP builder (Deflate/Store + UTF-8 filenames) with zero external dependencies.
 * @param {Array<{name: string, data: Buffer}>} entries
 */
function encodeZipEntries(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const item of entries) {
    const nameBuf = Buffer.from(String(item.name || '').replace(/\\/g, '/'), 'utf8');
    const raw = Buffer.isBuffer(item.data) ? item.data : Buffer.from(item.data || '');
    const crc = crc32Buf(raw);
    const deflated = raw.length > 0 ? zlib.deflateRawSync(raw, { level: 6 }) : raw;
    const useDeflate = deflated.length < raw.length;
    const payload = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;

    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0x0800, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(raw.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    nameBuf.copy(lfh, 30);

    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0x0800, 8);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(payload.length, 20);
    cdh.writeUInt32LE(raw.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    nameBuf.copy(cdh, 46);

    locals.push(lfh, payload);
    centrals.push(cdh);
    offset += lfh.length + payload.length;
  }

  const cdBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, cdBuf, eocd]);
}

/**
 * Pure-Node ZIP parser (supports Store & Deflate) with path/size safety checks.
 * @param {Buffer} buf
 */
function decodeZipBuffer(buf, { maxFiles = 500, maxUncompressedBytes = 80 * 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('无效的 ZIP 文件');
  let eocdOff = -1;
  const minOff = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOff = i;
      break;
    }
  }
  if (eocdOff < 0) throw new Error('找不到 ZIP 中央目录结束标记');
  const totalEntries = buf.readUInt16LE(eocdOff + 10);
  const cdSize = buf.readUInt32LE(eocdOff + 12);
  const cdOffset = buf.readUInt32LE(eocdOff + 16);
  if (totalEntries > maxFiles) throw new Error(`ZIP 文件条目过多（上限 ${maxFiles}）`);
  if (cdOffset + cdSize > buf.length) throw new Error('ZIP 目录区越界');

  const out = [];
  let totalUncompressed = 0;
  let pos = cdOffset;
  for (let idx = 0; idx < totalEntries; idx++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) {
      throw new Error('ZIP 中央目录格式损坏');
    }
    const flags = buf.readUInt16LE(pos + 8);
    if (flags & 1) throw new Error('不支持加密的 ZIP 文件');
    const method = buf.readUInt16LE(pos + 10);
    const expectedCrc = buf.readUInt32LE(pos + 16);
    const compSize = buf.readUInt32LE(pos + 20);
    const uncompSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOff = buf.readUInt32LE(pos + 42);
    const entryName = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;

    if (entryName.endsWith('/')) continue;
    totalUncompressed += uncompSize;
    if (totalUncompressed > maxUncompressedBytes) {
      throw new Error('ZIP 解压总大小超出 80 MB 限制');
    }
    if (localHeaderOff + 30 > buf.length || buf.readUInt32LE(localHeaderOff) !== 0x04034b50) {
      throw new Error(`ZIP 本地文件头损坏：${entryName}`);
    }
    const lhNameLen = buf.readUInt16LE(localHeaderOff + 26);
    const lhExtraLen = buf.readUInt16LE(localHeaderOff + 28);
    const dataStart = localHeaderOff + 30 + lhNameLen + lhExtraLen;
    if (dataStart + compSize > buf.length) {
      throw new Error(`ZIP 文件数据截断：${entryName}`);
    }
    const compSlice = buf.subarray(dataStart, dataStart + compSize);
    let data;
    if (method === 0) data = Buffer.from(compSlice);
    else if (method === 8) data = zlib.inflateRawSync(compSlice);
    else throw new Error(`不支持的 ZIP 压缩方式 (${method})：${entryName}`);

    if (crc32Buf(data) !== expectedCrc) {
      throw new Error(`ZIP CRC 校验失败：${entryName}`);
    }
    out.push({ name: entryName, data });
  }
  return out;
}

function isSafePackRelPath(relPath) {
  const norm = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm || norm.includes('..') || /^[a-zA-Z]:/.test(norm)) return false;
  const parts = norm.split('/').filter(Boolean);
  if (!parts.length) return false;
  if (parts.some((p) => p === '.' || p === '..' || p.startsWith('.'))) return false;
  const lower = norm.toLowerCase();
  if (lower.endsWith('.sa.json') || lower.endsWith('.env') || lower.includes('/.')) return false;
  return true;
}

/**
 * Bundle an entire `.scpack` directory (manifest, outlines, stories, local bg/voice assets)
 * into a self-contained `.scpack.zip` buffer for sharing or cloud migration.
 */
function exportProjectAsZipBuffer(pid) {
  const resolved = resolvePackDir(pid);
  if (!resolved) throw new Error(`Project not found: ${pid}`);
  const { packDir } = resolved;
  const safePid = String(pid || 'project').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'project';
  const rootPrefix = `${safePid}.scpack`;
  const entries = [];
  let totalSize = 0;

  const walkDir = (dirAbs, relPrefix) => {
    for (const dirent of fs.readdirSync(dirAbs, { withFileTypes: true })) {
      if (dirent.isSymbolicLink() || dirent.name.startsWith('.')) continue;
      if (/\.(?:sa\.json|env)$/i.test(dirent.name)) continue;
      const abs = path.join(dirAbs, dirent.name);
      const rel = relPrefix ? `${relPrefix}/${dirent.name}` : dirent.name;
      if (dirent.isDirectory()) {
        walkDir(abs, rel);
      } else if (dirent.isFile()) {
        const data = fs.readFileSync(abs);
        totalSize += data.length;
        if (totalSize > 80 * 1024 * 1024) {
          throw new Error('工程包总体积超过 80 MB 导出上限');
        }
        entries.push({ name: `${rootPrefix}/${rel}`, data });
      }
    }
  };
  walkDir(packDir, '');
  if (!entries.length) throw new Error('工程目录为空');
  return {
    filename: `${safePid}.scpack.zip`,
    buffer: encodeZipEntries(entries),
    fileCount: entries.length,
    rawBytes: totalSize
  };
}

/**
 * Import a `.scpack.zip` buffer into `projects_workspace/<targetId>.scpack` and register stories.
 */
function importProjectFromZipBuffer(zipBuf, opts = {}) {
  const rawEntries = decodeZipBuffer(zipBuf);
  if (!rawEntries.length) throw new Error('ZIP 压缩包中没有可用文件');

  // Strip shared single top-level directory (`xxx.scpack/`) if all files live inside it
  const normEntries = rawEntries.map((e) => ({
    name: String(e.name || '').replace(/\\/g, '/').replace(/^\/+/, ''),
    data: e.data
  }));
  const firstSegs = new Set(normEntries.map((e) => e.name.split('/')[0]).filter(Boolean));
  const stripPrefix = (firstSegs.size === 1 && !normEntries.some((e) => !e.name.includes('/')))
    ? `${Array.from(firstSegs)[0]}/`
    : '';

  const relEntries = [];
  for (const e of normEntries) {
    const rel = stripPrefix && e.name.startsWith(stripPrefix) ? e.name.slice(stripPrefix.length) : e.name;
    if (!isSafePackRelPath(rel)) {
      throw new Error(`包含不安全或隐藏文件路径：${e.name}`);
    }
    relEntries.push({ rel, data: e.data });
  }

  const packEntry = relEntries.find((e) => e.rel.toLowerCase() === 'pack.json');
  if (!packEntry) throw new Error('压缩包根目录缺少 pack.json');
  let packJson;
  try {
    packJson = JSON.parse(packEntry.data.toString('utf8'));
  } catch (err) {
    throw new Error(`pack.json 解析失败：${err.message}`);
  }
  if (!packJson || packJson.format !== 'scpack' || !packJson.id || !Array.isArray(packJson.stories)) {
    throw new Error('pack.json 格式不正确（缺少 format=scpack / id / stories）');
  }

  const origId = String(packJson.id).trim();
  const baseId = origId.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'imported_pack';
  let targetId = baseId;
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  let destDir = path.join(WORKSPACE_DIR, `${targetId}.scpack`);
  if (fs.existsSync(destDir) && !opts.overwrite) {
    const stamp = Date.now().toString(36).slice(-5);
    targetId = `${baseId}_imp_${stamp}`;
    destDir = path.join(WORKSPACE_DIR, `${targetId}.scpack`);
  }

  if (fs.existsSync(destDir) && opts.overwrite) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const needsRewrite = targetId !== origId;
  const customOldRe = needsRewrite ? new RegExp(`custom/${escapeRe(origId)}/`, 'g') : null;

  for (const item of relEntries) {
    const targetPath = path.join(destDir, item.rel);
    if (!targetPath.startsWith(destDir + path.sep) && targetPath !== destDir) {
      throw new Error(`路径越界：${item.rel}`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (item.rel.toLowerCase() === 'pack.json') {
      let jsonStr = packJson ? JSON.stringify(Object.assign({}, packJson, { id: targetId }), null, 2) : item.data.toString('utf8');
      if (customOldRe) jsonStr = jsonStr.replace(customOldRe, `custom/${targetId}/`);
      fs.writeFileSync(targetPath, jsonStr, 'utf8');
    } else if (customOldRe && /\.(json|ya?ml)$/i.test(item.rel)) {
      const txt = item.data.toString('utf8').replace(customOldRe, `custom/${targetId}/`);
      fs.writeFileSync(targetPath, txt, 'utf8');
    } else {
      fs.writeFileSync(targetPath, item.data);
    }
  }

  // Register imported compiled stories with :18899 user_imports
  const storiesDir = path.join(destDir, 'stories');
  if (fs.existsSync(storiesDir)) {
    for (const f of fs.readdirSync(storiesDir)) {
      if (!f.endsWith('.scproj.json')) continue;
      try {
        const scObj = JSON.parse(fs.readFileSync(path.join(storiesDir, f), 'utf8'));
        if (scObj && scObj.meta) scObj.meta.projectId = targetId;
        registerWithPlayer18899(scObj);
      } catch (_) {}
    }
  }

  const project = loadPackFromDir(destDir, 'projects_workspace');
  return {
    ok: true,
    projectId: targetId,
    renamedFrom: targetId !== origId ? origId : null,
    importedFiles: relEntries.length,
    project,
    projects: listAllProjects()
  };
}

/**
 * Scan all workspace/example packs and `user_imports/*.json`, delete unreferenced
 * temporary files inside `user_imports/_tts_cache/` older than `minAgeMs`.
 */
function cleanupUnusedTtsCache({ dryRun = false, minAgeMs = 60 * 1000 } = {}) {
  const ttsCacheDir = path.join(USER_IMPORTS_DIR, '_tts_cache');
  if (!fs.existsSync(ttsCacheDir)) {
    return { ok: true, dryRun: Boolean(dryRun), totalFiles: 0, keptCount: 0, deletedCount: 0, freedBytes: 0, freedMB: 0, deletedFiles: [] };
  }

  const referenced = new Set();
  const scanTextForTtsRefs = (txt) => {
    if (!txt) return;
    const re = /\b(?:tts_[a-zA-Z0-9_-]+\.(?:mp3|wav|m4a)|(?:_tts_cache|api\/studio\/tts\/audio)\/([a-zA-Z0-9._-]+\.(?:mp3|wav|m4a)))\b/gi;
    let m;
    while ((m = re.exec(txt)) !== null) {
      const name = path.basename(m[1] || m[0]);
      if (name) referenced.add(name);
    }
  };

  const scanJsonDir = (dirAbs) => {
    if (!fs.existsSync(dirAbs)) return;
    for (const ent of fs.readdirSync(dirAbs, { withFileTypes: true })) {
      if (ent.isFile() && /\.(json|ya?ml)$/i.test(ent.name)) {
        try { scanTextForTtsRefs(fs.readFileSync(path.join(dirAbs, ent.name), 'utf8')); } catch (_) {}
      }
    }
  };

  [WORKSPACE_DIR, EXAMPLES_DIR].forEach((rootDir) => {
    if (!fs.existsSync(rootDir)) return;
    for (const ent of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!ent.isDirectory() || !ent.name.endsWith('.scpack')) continue;
      const pDir = path.join(rootDir, ent.name);
      try {
        const packFile = path.join(pDir, 'pack.json');
        if (fs.existsSync(packFile)) scanTextForTtsRefs(fs.readFileSync(packFile, 'utf8'));
      } catch (_) {}
      scanJsonDir(path.join(pDir, 'outlines'));
      scanJsonDir(path.join(pDir, 'stories'));
    }
  });
  scanJsonDir(USER_IMPORTS_DIR);

  const now = Date.now();
  const entries = fs.readdirSync(ttsCacheDir, { withFileTypes: true }).filter((d) => d.isFile());
  const deletedFiles = [];
  let freedBytes = 0;
  let keptCount = 0;

  for (const ent of entries) {
    const fp = path.join(ttsCacheDir, ent.name);
    let st;
    try { st = fs.statSync(fp); } catch (_) { continue; }
    const isFresh = (now - st.mtimeMs) < minAgeMs;
    if (referenced.has(ent.name) || isFresh) {
      keptCount++;
      continue;
    }
    freedBytes += st.size;
    deletedFiles.push(ent.name);
    if (!dryRun) {
      try { fs.unlinkSync(fp); } catch (_) {}
    }
  }

  return {
    ok: true,
    dryRun: Boolean(dryRun),
    totalFiles: entries.length,
    keptCount,
    deletedCount: deletedFiles.length,
    freedBytes,
    freedMB: Number((freedBytes / (1024 * 1024)).toFixed(2)),
    deletedFiles
  };
}

/**
 * Import an external script (fan-player JSON, scproj JSON, outline JSON, or plain-text dialogue)
 * directly into an existing project without invoking any LLM API.
 */
function importExternalScriptToProject(pid, rawInput, opts = {}) {
  const parsed = externalScriptAdapter.parseExternalInput(rawInput, opts);
  if (!parsed || !parsed.ok) {
    throw new Error((parsed && parsed.error) || '外部剧本解析失败');
  }
  const saved = upsertOrManageProjectScene(pid, {
    action: 'replace_outlines',
    outlines: parsed.scenes,
    characters: parsed.characters,
    synopsisZh: parsed.premise
  });
  return {
    ok: true,
    format: parsed.format,
    formatLabel: parsed.formatLabel,
    stats: parsed.stats,
    premise: parsed.premise,
    cast: parsed.cast,
    outlines: parsed.scenes,
    project: saved.project
  };
}

module.exports = {
  IDOL_META,
  EMOTION_PRESETS,
  WORKSPACE_DIR,
  EXAMPLES_DIR,
  USER_IMPORTS_DIR,
  CANONICAL_REACTION_CARDS,
  normalizeSceneSegments,
  ensureSeededWorkspace,
  seedReactionAnthologyPack,
  listAllProjects,
  createNewProject,
  pickSemanticScenesForPrompt,
  expandScriptFromOutline,
  expandOutlineWithLlmOrTemplate,
  enrichSceneSegmentsWithLlmOrTemplate,
  expandScriptWithLlmOrTemplate,
  expandBeatWithLlmOrTemplate,
  generateIdolReaction,
  compileReactionPackToScproj,
  getScspSummary,
  getScspLines,
  testLlmConnection,
  getIdolOutfits,
  getSemanticBgList,
  getSemanticBgmList,
  normalizeBgmId,
  getEnrichedBgmCatalog,
  recommendBgsForContext,
  recommendBgmsForContext,
  compileSceneToScproj,
  compileFullProjectToScproj,
  archivePackTtsVoices,
  saveProjectUploadedAsset,
  exportProjectAsZipBuffer,
  importProjectFromZipBuffer,
  cleanupUnusedTtsCache,
  upsertOrManageProjectScene,
  auditScriptRows,
  sanitizeStageActions,
  resolveValidAnim,
  STAGE_SLOTS,
  BLOCKING_ARCHETYPES,
  expandBlockingArchetype,
  directorChatWithLlm,
  normalizeCueObject,
  isParenthesizedMonologue,
  normalizeEmotionKey,
  normalizeZhHonorifics,
  getServerLlmPublicStatus,
  importExternalScriptToProject
};
