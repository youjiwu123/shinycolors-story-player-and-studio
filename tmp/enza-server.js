'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const os = require('os');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const PLAYER = fs.existsSync(path.join(__dirname, 'enza-player.html'))
  ? path.join(__dirname, 'enza-player.html')
  : path.join(__dirname, 'player.html');
const PROJECT_ROOT = path.resolve(__dirname, '..');
function isShinyColorsRootDir(dir) {
  if (!dir) return false;
  return (
    fs.existsSync(path.join(dir, 'data', 'catalog_meta_snapshot.json')) ||
    fs.existsSync(path.join(dir, 'data', 'story_title_zh.json')) ||
    fs.existsSync(path.join(dir, 'progress'))
  );
}
const SHINYCOLORS_ROOT = isShinyColorsRootDir(PROJECT_ROOT)
  ? PROJECT_ROOT
  : (isShinyColorsRootDir(path.resolve(__dirname, '..', '..'))
      ? path.resolve(__dirname, '..', '..')
      : PROJECT_ROOT);
const PROGRESS_DIR = path.join(SHINYCOLORS_ROOT, 'progress');
const DASHBOARD_HTML = path.join(PROGRESS_DIR, 'dashboard.html');
const SERVER_BUILD = 'lifecycle-2026-11-13-portable-mount-scsp';
const EDITOR_HTML = fs.existsSync(path.join(PROJECT_ROOT, 'editor.html'))
  ? path.join(PROJECT_ROOT, 'editor.html')
  : path.join(SHINYCOLORS_ROOT, 'editor.html');
const EDITOR_CSS = fs.existsSync(path.join(PROJECT_ROOT, 'editor.css'))
  ? path.join(PROJECT_ROOT, 'editor.css')
  : path.join(SHINYCOLORS_ROOT, 'editor.css');
const EDITOR_JS = fs.existsSync(path.join(PROJECT_ROOT, 'editor.js'))
  ? path.join(PROJECT_ROOT, 'editor.js')
  : path.join(SHINYCOLORS_ROOT, 'editor.js');
const ANIM_WHITELIST_PATH = fs.existsSync(path.join(SHINYCOLORS_ROOT, 'data', 'anim_whitelist.json'))
  ? path.join(SHINYCOLORS_ROOT, 'data', 'anim_whitelist.json')
  : (fs.existsSync(path.join(__dirname, 'data', 'anim_whitelist.json'))
      ? path.join(__dirname, 'data', 'anim_whitelist.json')
      : path.join(SHINYCOLORS_ROOT, 'tools', 'cache', 'anim_whitelist.json'));
const MOUNT_CONFIG_PATH = path.join(SHINYCOLORS_ROOT, 'data', 'mount-config.json');
const DESKTOP_DATA_PATH_TXT = path.join(SHINYCOLORS_ROOT, 'desktop', 'data-path.txt');
const CATALOG_SNAPSHOT_PATH = fs.existsSync(path.join(SHINYCOLORS_ROOT, 'data', 'catalog_meta_snapshot.json'))
  ? path.join(SHINYCOLORS_ROOT, 'data', 'catalog_meta_snapshot.json')
  : path.join(__dirname, 'data', 'catalog_meta_snapshot.json');
const SCSP_CURATED_PATH = fs.existsSync(path.join(SHINYCOLORS_ROOT, 'data', 'scsp_curated_stories.json'))
  ? path.join(SHINYCOLORS_ROOT, 'data', 'scsp_curated_stories.json')
  : path.join(__dirname, 'data', 'scsp_curated_stories.json');
const IDOL_OUTFITS_PATH = fs.existsSync(path.join(SHINYCOLORS_ROOT, 'studio', 'data', 'idol_outfits.json'))
  ? path.join(SHINYCOLORS_ROOT, 'studio', 'data', 'idol_outfits.json')
  : path.join(SHINYCOLORS_ROOT, 'data', 'idol_outfits.json');

let _cachedFfmpegBin;
let _cachedFfmpegEncoders = '';
function resolveFfmpegBin() {
  if (_cachedFfmpegBin !== undefined) return _cachedFfmpegBin;
  const binName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = [];
  if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);
  candidates.push(
    path.resolve(SHINYCOLORS_ROOT, '..', 'taibon', 'voice-toolkit', 'tools', 'ffmpeg', 'bin', binName),
    path.resolve(SHINYCOLORS_ROOT, '..', '..', 'taibon', 'voice-toolkit', 'tools', 'ffmpeg', 'bin', binName),
    path.join(SHINYCOLORS_ROOT, 'tools', 'ffmpeg', 'bin', binName),
    path.join(SHINYCOLORS_ROOT, 'tools', binName),
    path.join(__dirname, 'ffmpeg', 'bin', binName),
    path.join(__dirname, binName),
    'C:\\Program Files\\Virtual Desktop Streamer\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe'
  );
  const pathEnv = process.env.PATH || process.env.Path || '';
  if (pathEnv) {
    for (const dir of pathEnv.split(path.delimiter)) {
      if (dir) candidates.push(path.join(dir, binName));
    }
  }
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p) && fs.statSync(p).isFile()) {
        const chk = spawnSync(p, ['-hide_banner', '-encoders'], {
          encoding: 'utf8',
          timeout: 4000,
          windowsHide: true
        });
        if (chk && chk.status === 0) {
          _cachedFfmpegBin = p;
          _cachedFfmpegEncoders = String(chk.stdout || '');
          return p;
        }
      }
    } catch (_) {}
  }
  _cachedFfmpegBin = '';
  _cachedFfmpegEncoders = '';
  return '';
}

function getVideoRemuxEncoderPlans(fps, keyintMin, inExt, encodersText) {
  const enc = encodersText !== undefined ? String(encodersText || '') : _cachedFfmpegEncoders;
  const plans = [];
  if (/\blibx264\b/.test(enc)) {
    plans.push(['-c:v', 'libx264', '-crf', '15', '-preset', 'veryfast', '-g', String(fps), '-keyint_min', String(keyintMin), '-pix_fmt', 'yuv420p']);
  }
  if (/\bh264_amf\b/.test(enc)) {
    plans.push(['-c:v', 'h264_amf', '-rc', 'cqp', '-qp_i', '17', '-qp_p', '18', '-qp_b', '19', '-g', String(fps), '-pix_fmt', 'yuv420p']);
  }
  if (/\bh264_nvenc\b/.test(enc)) {
    plans.push(['-c:v', 'h264_nvenc', '-cq', '18', '-g', String(fps), '-pix_fmt', 'yuv420p']);
  }
  if (/\bh264_qsv\b/.test(enc)) {
    plans.push(['-c:v', 'h264_qsv', '-global_quality', '18', '-g', String(fps), '-pix_fmt', 'yuv420p']);
  }
  if (/\bh264_mf\b/.test(enc)) {
    plans.push(['-c:v', 'h264_mf', '-b:v', '18M', '-g', String(fps), '-pix_fmt', 'yuv420p']);
  }
  if (/\blibopenh264\b/.test(enc)) {
    plans.push(['-c:v', 'libopenh264', '-b:v', '18M', '-g', String(fps), '-pix_fmt', 'yuv420p']);
  }
  if (inExt === '.mp4' || plans.length === 0) {
    plans.push(['-c:v', 'copy']);
  }
  return plans;
}

function getRecTmpDir() {
  const localTmp = path.join(SHINYCOLORS_ROOT, '_tmp_rec');
  try {
    fs.mkdirSync(localTmp, { recursive: true });
    return localTmp;
  } catch (_) {}
  const sysTmp = path.join(os.tmpdir(), 'enza_rec_tmp');
  try { fs.mkdirSync(sysTmp, { recursive: true }); } catch (_) {}
  return sysTmp;
}

/* ------------------------------------------------------------------
 * 监听地址 / 端口 / 外部资源挂载参数
 *   --host=0.0.0.0   或  ENZA_HOST=0.0.0.0   手机走局域网访问
 *   --port=18899     或  ENZA_PORT=18899     仅用于本机回归测试
 *   --data-root=...  或  ENZA_DATA_ROOT=...  外部 enza 资源根目录
 *   --scsp-root=...  或  SCSP_DATA_ROOT=...  外部 SCSP 棱镜资源根目录
 * 默认仍是 127.0.0.1，不改变原来的本机行为。
 * ------------------------------------------------------------------ */
function argValue(argv, name) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === name) return argv[i + 1] !== undefined ? argv[i + 1] : '';
    if (a.indexOf(name + '=') === 0) return a.slice(name.length + 1);
  }
  return '';
}
const CLI = process.argv.slice(2);
const HOST = String(argValue(CLI, '--host') || process.env.ENZA_HOST || '127.0.0.1').trim() || '127.0.0.1';
const PORT = parseInt(argValue(CLI, '--port') || process.env.ENZA_PORT || '18899', 10) || 18899;

/* ---------- 轻量级元数据快照、服装索引与 SCSP 精选语料（随项目分发的无重资源回退层） ---------- */
let CATALOG_SNAPSHOT = { meta: {}, stories: [], chapters: [], charMap: {}, storyTitles: {}, groupTitles: {} };
try {
  if (fs.existsSync(CATALOG_SNAPSHOT_PATH)) {
    const snap = JSON.parse(fs.readFileSync(CATALOG_SNAPSHOT_PATH, 'utf8'));
    if (snap && typeof snap === 'object') {
      CATALOG_SNAPSHOT = Object.assign(CATALOG_SNAPSHOT, snap);
      console.log('catalog snapshot:', (CATALOG_SNAPSHOT.stories || []).length, 'stories /',
        (CATALOG_SNAPSHOT.chapters || []).length, 'chapters');
    }
  }
} catch (e) {
  console.log('catalog snapshot missing/broken:', e.message);
}

let IDOL_OUTFITS = { version: '1.0.0', categories: [], idols: {} };
try {
  if (fs.existsSync(IDOL_OUTFITS_PATH)) {
    const outRaw = JSON.parse(fs.readFileSync(IDOL_OUTFITS_PATH, 'utf8'));
    if (outRaw && typeof outRaw === 'object') {
      IDOL_OUTFITS = Object.assign(IDOL_OUTFITS, outRaw);
    }
  }
} catch (e) {
  console.log('idol outfits missing/broken:', e.message);
}

let SCSP_CURATED_META = { corpusStats: { totalRawScenarios: 5133, totalVoiceCues: 58268, decodedUniqueWavs: 18713 } };
let SCSP_CURATED_STORIES = [];
const SCSP_STORY_BY_ID = new Map();
const SCSP_VOICE_MAP = new Map(); // cue -> { scspWavRel, dur }
try {
  if (fs.existsSync(SCSP_CURATED_PATH)) {
    const scspRaw = JSON.parse(fs.readFileSync(SCSP_CURATED_PATH, 'utf8'));
    if (scspRaw && typeof scspRaw === 'object') {
      if (scspRaw.meta) SCSP_CURATED_META = scspRaw.meta;
      if (Array.isArray(scspRaw.stories)) SCSP_CURATED_STORIES = scspRaw.stories;
      for (const st of SCSP_CURATED_STORIES) {
        if (!st || !st.id) continue;
        SCSP_STORY_BY_ID.set(st.id, st);
        if (st.sceneId) SCSP_STORY_BY_ID.set(st.sceneId, st);
        for (const ln of st.lines || []) {
          if (ln && ln.cue && ln.scspWavRel && !SCSP_VOICE_MAP.has(ln.cue)) {
            SCSP_VOICE_MAP.set(ln.cue, { scspWavRel: ln.scspWavRel, dur: ln.dur || 0 });
          }
        }
      }
      console.log('scsp curated:', SCSP_CURATED_STORIES.length, 'stories /', SCSP_VOICE_MAP.size, 'wav cues');
    }
  }
} catch (e) {
  console.log('scsp curated missing/broken:', e.message);
}

function readFirstNonCommentLine(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const txt = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    for (const raw of txt.split(/\r?\n/)) {
      const s = raw.trim();
      if (!s || s.charAt(0) === '#') continue;
      return s;
    }
  } catch (e) {}
  return '';
}

function resolveInitialMountConfig() {
  const cliEnza = String(argValue(CLI, '--data-root') || argValue(CLI, '--enza-root') || process.env.ENZA_DATA_ROOT || process.env.ENZA_ROOT || '').trim();
  const cliScsp = String(argValue(CLI, '--scsp-root') || process.env.SCSP_DATA_ROOT || process.env.SCSP_ROOT || '').trim();
  const DEFAULT_ENZA = 'D:\\enza';
  const DEFAULT_SCSP = 'D:\\SCSPDownloader';
  let fileEnza = '';
  let fileScsp = '';
  let source = 'default';
  let hasConfigEnza = false;
  let hasConfigScsp = false;
  if (fs.existsSync(MOUNT_CONFIG_PATH)) {
    try {
      const mc = JSON.parse(fs.readFileSync(MOUNT_CONFIG_PATH, 'utf8'));
      if (mc && typeof mc === 'object') {
        // mount-config.json 里显式写过的字段优先，空串也算数（空串 = 用户主动卸下）。
        // 否则「卸下挂载」会先被 desktop/data-path.txt 的旧路径、再被默认值悄悄救回来。
        if (Object.prototype.hasOwnProperty.call(mc, 'enzaRoot') && typeof mc.enzaRoot === 'string') {
          fileEnza = mc.enzaRoot.trim();
          hasConfigEnza = true;
        }
        if (Object.prototype.hasOwnProperty.call(mc, 'scspRoot') && typeof mc.scspRoot === 'string') {
          fileScsp = mc.scspRoot.trim();
          hasConfigScsp = true;
        }
        source = 'mount-config.json';
      }
    } catch (e) {}
  }
  if (!hasConfigEnza) {
    const txtPath = readFirstNonCommentLine(DESKTOP_DATA_PATH_TXT);
    if (txtPath) {
      fileEnza = txtPath;
      if (source === 'default') source = 'data-path.txt';
    }
  }
  if (cliEnza || cliScsp) source = 'env/cli';
  return {
    enzaRoot: cliEnza || (hasConfigEnza ? fileEnza : (fileEnza || DEFAULT_ENZA)),
    scspRoot: cliScsp || (hasConfigScsp ? fileScsp : (fileScsp || DEFAULT_SCSP)),
    configSource: source
  };
}

let DATA_ROOT = '';
let JSON_ROOT = '';
let CUSTOM_ROOT = '';
let VOICE_ROOT = '';
let ASSETS = '';
let CATALOG_PATH = '';
let ZH_PATH = '';
let ZH_DYNAMIC_PATH = '';
let TITLE_ZH_PATH = '';
let CHAR_MAP_PATH = '';
let STORY_DATES_PATH = '';
let SCSP_ROOT = '';
let MOUNT_SOURCE = 'default';
let CATALOG_SOURCE = 'external';

// /api/script 的结果缓存（LRU，按 cat+id+ids 作 key）。
// 一集剧本每次都要读 JSON → normalizeScriptLines（CFG 分支传播/补字段）→ 合并 → 序列化，
// 缓存后重复打开同一集合从 12~50ms 降到 ~0ms，并支持 ETag 304 让浏览器不再重下 250KB。
// 任何会让剧本内容变化的事件（切换挂载、重载词典、导入/删除/保存剧本）都必须 clearScriptCache()。
const SCRIPT_CACHE = new Map();
const SCRIPT_CACHE_MAX_ENTRIES = 120;
const SCRIPT_CACHE_MAX_BYTES = 2 * 1024 * 1024;

function clearScriptCache() {
  SCRIPT_CACHE.clear();
}

function scriptCacheGet(key) {
  const hit = SCRIPT_CACHE.get(key);
  if (!hit) return null;
  // 命中后重新插入，维持 LRU 顺序
  SCRIPT_CACHE.delete(key);
  SCRIPT_CACHE.set(key, hit);
  return hit;
}

function scriptCacheSet(key, body, etag) {
  if (body.length > SCRIPT_CACHE_MAX_BYTES) return;
  SCRIPT_CACHE.set(key, { body: body, etag: etag });
  while (SCRIPT_CACHE.size > SCRIPT_CACHE_MAX_ENTRIES) {
    const oldest = SCRIPT_CACHE.keys().next().value;
    SCRIPT_CACHE.delete(oldest);
  }
}

function resolveEnzaAssetsDir(dataRoot) {
  if (!dataRoot) return '';
  const withAssets = path.join(dataRoot, 'assets');
  if (fs.existsSync(withAssets)) return withAssets;
  if (
    fs.existsSync(path.join(dataRoot, 'spine')) ||
    fs.existsSync(path.join(dataRoot, 'images')) ||
    fs.existsSync(path.join(dataRoot, 'sounds'))
  ) {
    return dataRoot;
  }
  return withAssets;
}

function setMountPaths(enzaRoot, scspRoot, sourceLabel) {
  const cleanEnza = String(enzaRoot == null ? '' : enzaRoot).trim();
  const cleanScsp = String(scspRoot == null ? '' : scspRoot).trim();
  DATA_ROOT = cleanEnza ? path.resolve(cleanEnza) : '';
  JSON_ROOT = DATA_ROOT ? path.join(DATA_ROOT, 'voice', 'json', 'json', 'json') : '';
  CUSTOM_ROOT = DATA_ROOT ? path.join(DATA_ROOT, 'scripts', 'custom') : '';
  VOICE_ROOT = DATA_ROOT ? path.join(DATA_ROOT, 'voice', 'voice', 'events') : '';
  ASSETS = resolveEnzaAssetsDir(DATA_ROOT);
  CATALOG_PATH = process.env.ENZA_CATALOG_PATH || (DATA_ROOT ? path.join(DATA_ROOT, 'catalog.json') : '');
  ZH_PATH = DATA_ROOT ? path.join(DATA_ROOT, 'translations', 'zh_index.json') : '';
  ZH_DYNAMIC_PATH = DATA_ROOT ? path.join(DATA_ROOT, 'translations', 'zh_dynamic.json') : '';
  TITLE_ZH_PATH = DATA_ROOT ? path.join(DATA_ROOT, 'translations', 'title_zh.json') : '';
  CHAR_MAP_PATH = DATA_ROOT ? path.join(DATA_ROOT, 'translations', 'char_map.json') : '';
  STORY_DATES_PATH = process.env.ENZA_STORY_DATES_PATH || (DATA_ROOT ? path.join(DATA_ROOT, 'story_dates.json') : '');
  SCSP_ROOT = cleanScsp ? path.resolve(cleanScsp) : '';
  if (sourceLabel) MOUNT_SOURCE = sourceLabel;
}

const _INIT_MOUNT = resolveInitialMountConfig();
setMountPaths(_INIT_MOUNT.enzaRoot, _INIT_MOUNT.scspRoot, _INIT_MOUNT.configSource);

// 项目级活动名 / 章节标题中文化对照表 (projects/shinycolors/data/story_title_zh.json)
const STORY_TITLE_ZH_PATH = fs.existsSync(path.join(SHINYCOLORS_ROOT, 'data', 'story_title_zh.json'))
  ? path.join(SHINYCOLORS_ROOT, 'data', 'story_title_zh.json')
  : path.join(__dirname, 'data', 'story_title_zh.json');
let STORY_TITLE_ZH_DATA = { arcs: {}, idols: {}, partNames: {}, byChapter: {}, byStory: {}, firstLineByStory: {} };
try {
  if (fs.existsSync(STORY_TITLE_ZH_PATH)) {
    const parsed = JSON.parse(fs.readFileSync(STORY_TITLE_ZH_PATH, 'utf8'));
    if (parsed && typeof parsed === 'object') {
      STORY_TITLE_ZH_DATA = Object.assign(STORY_TITLE_ZH_DATA, parsed);
    }
    console.log('story_title_zh:', Object.keys(STORY_TITLE_ZH_DATA.arcs || {}).length, 'arcs /',
      Object.keys(STORY_TITLE_ZH_DATA.byStory || {}).length, 'stories');
  }
} catch (e) {
  console.log('story_title_zh missing/broken:', e.message);
}

const STORY_ARC_ZH_NORM = {};
Object.keys(STORY_TITLE_ZH_DATA.arcs || {}).forEach(function (k) {
  try { STORY_ARC_ZH_NORM[String(k).normalize('NFC')] = STORY_TITLE_ZH_DATA.arcs[k]; } catch (e) {}
});

const NAME_CSV = fs.existsSync(path.join(__dirname, 'data', 'name.csv'))
  ? path.join(__dirname, 'data', 'name.csv')
  : (process.env.SC_NAME_CSV || path.join(__dirname, 'data', 'name.csv'));
const NAMES = {};
try {
  if (fs.existsSync(NAME_CSV)) {
    for (const line of fs.readFileSync(NAME_CSV, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const i = line.indexOf(',');
      if (i <= 0) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (k && k !== 'name') NAMES[k] = v;
    }
  }
} catch (e) { console.log('name.csv missing:', e.message); }

// 章节树用的角色名（name.csv 只覆盖一部分旁白/配角）。
const IDOL_NAME_ZH = {
  'mano': '樱木真乃', 'hiori': '风野灯织', 'meguru': '八宫巡',
  'kogane': '月冈恋钟', 'mamimi': '田中摩美美', 'sakuya': '白濑咲耶',
  'yuika': '三峰结华', 'mitsumine': '三峰结华', 'kiriko': '幽谷雾子',
  'kaho': '小宫果穗', 'chiyoko': '园田智代子', 'juri': '西城树里',
  'rinze': '杜野凛世', 'natsuha': '有栖川夏叶',
  'amana': '大崎甘奈', 'tenka': '大崎甜花', 'chiyuki': '桑山千雪',
  'asahi': '芹泽朝日', 'fuyuko': '黛冬优子', 'mei': '和泉爱依',
  'toru': '浅仓透', 'tooru': '浅仓透', 'madoka': '樋口圆香', 'koito': '福丸小糸', 'hinana': '市川雏菜',
  'nichika': '七草日花', 'mikoto': '绯田美琴',
  'luca': '斑鸠路加', 'hana': '铃木羽那', 'haruki': '郁田阳希', 'hazuki': '叶月',
  'ruby': '星野露比', 'kana': '有马加奈', 'mem': 'MEM啾', 'akane': '黑川茜',
  '櫻木真乃': '樱木真乃', '風野灯織': '风野灯织', '八宮めぐる': '八宫巡',
  '月岡恋鐘': '月冈恋钟', '田中摩美々': '田中摩美美', '白瀬咲耶': '白濑咲耶',
  '三峰結華': '三峰结华', '幽谷霧子': '幽谷雾子',
  '小宮果穂': '小宫果穗', '園田智代子': '园田智代子', '西城樹里': '西城树里',
  '杜野凛世': '杜野凛世', '有栖川夏葉': '有栖川夏叶',
  '大崎甘奈': '大崎甘奈', '大崎甜花': '大崎甜花', '桑山千雪': '桑山千雪',
  '芹沢あさひ': '芹泽朝日', '黛冬優子': '黛冬优子', '和泉愛依': '和泉爱依',
  '浅倉透': '浅仓透', '淺倉透': '浅仓透', '樋口円香': '樋口圆香', '福丸小糸': '福丸小糸', '市川雛菜': '市川雏菜',
  '七草にちか': '七草日花', '緋田美琴': '绯田美琴',
  '斑鳩ルカ': '斑鸠路加', '鈴木羽那': '铃木羽那', '郁田はるき': '郁田阳希',
  '星野ルビー': '星野露比', 'ルビー': '露比', '有馬かな': '有马加奈', 'かな': '加奈',
  'MEMちょ': 'MEM啾', 'ＭＥＭちょ': 'MEM啾', '黒川あかね': '黑川茜', 'あかね': '黑川茜',
  'はづき': '叶月', 'プロデューサー': '制作人', '社長': '社长', '天井社長': '社长', '天井努': '天井努'
};
function zhCharName(raw, label) {
  return IDOL_NAME_ZH[raw] || IDOL_NAME_ZH[label] || NAMES[raw] || raw || label || '';
}
function norm(s) {
  return String(s || '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

const MAIN_IDOL_LABELS = [
  'mano', 'hiori', 'meguru',
  'kogane', 'mamimi', 'sakuya', 'yuika', 'kiriko',
  'kaho', 'chiyoko', 'juri', 'rinze', 'natsuha',
  'amana', 'tenka', 'chiyuki',
  'asahi', 'fuyuko', 'mei',
  'toru', 'madoka', 'koito', 'hinana',
  'nichika', 'mikoto',
  'luca', 'hana', 'haruki'
];

// Spine 动画白名单（角色 label -> pack -> 动画名数组），由 tools/build_anim_whitelist.py 生成
let ANIM_WHITELIST = { version: 0, packs: {}, by_label: {} };
try {
  ANIM_WHITELIST = JSON.parse(fs.readFileSync(ANIM_WHITELIST_PATH, 'utf8'));
  console.log('anim whitelist:', Object.keys(ANIM_WHITELIST.packs || {}).length, 'packs /',
    Object.keys(ANIM_WHITELIST.by_label || {}).length, 'labels');
} catch (e) { console.log('anim whitelist missing:', e.message); }

const STORY_ERA_MAP_PATH = fs.existsSync(path.join(SHINYCOLORS_ROOT, 'studio', 'tools', 'story_era_map.json'))
  ? path.join(SHINYCOLORS_ROOT, 'studio', 'tools', 'story_era_map.json')
  : path.join(SHINYCOLORS_ROOT, 'data', 'story_era_map.json');
let STORY_ERA_MAP = {};
try {
  if (fs.existsSync(STORY_ERA_MAP_PATH)) {
    const rawEra = JSON.parse(fs.readFileSync(STORY_ERA_MAP_PATH, 'utf8'));
    STORY_ERA_MAP = (rawEra && rawEra.stories) ? rawEra.stories : {};
    console.log('story era map:', Object.keys(STORY_ERA_MAP).length, 'records');
  }
} catch (e) {
  STORY_ERA_MAP = {};
  console.log('story era map missing:', e.message);
}

const EIDOLON_AVATAR_ROOT = fs.existsSync(path.join(__dirname, 'data', 'avatars'))
  ? path.join(__dirname, 'data', 'avatars')
  : (process.env.SC_AVATAR_ROOT || path.join(__dirname, 'data', 'avatars'));

// 动态可热重载的外部挂载字典与角色映射表（保持对象引用稳定以兼容 module.exports）
const DUR = new Map();
let ZH = {};
let ZH_DYNAMIC = {};
let TITLE_ZH = {};
const TITLE_ZH_NORM = {};
const CHAR_MAP = {};
const CHAR_ID_TO_LABEL = {};
let STORY_TITLES = {};
let GROUP_TITLES = {};
let STORY_DATES = {};

// ── 词典健康度（汉化词典加载失败绝不能再静默降级成「全是日文 + 汉化 0%」）──
// 之前 ZH = JSON.parse(...) 的失败被 catch(e){} 吞掉，界面只会显示 0%，无法判断是
// 「没下资源」还是「词典没读进来」。现在每次加载都记录 路径/是否存在/字节数/条数/错误。
const DICT_HEALTH = {
  zh: { path: '', exists: false, ok: false, keys: 0, bytes: 0, error: '', loadedAt: '' },
  zhDynamic: { path: '', exists: false, ok: false, keys: 0, bytes: 0, error: '', loadedAt: '' },
  titleZh: { path: '', exists: false, ok: false, keys: 0, bytes: 0, error: '', loadedAt: '' },
  charMap: { path: '', exists: false, ok: false, keys: 0, bytes: 0, error: '', loadedAt: '' },
  voiceIndex: { path: '', exists: false, ok: false, keys: 0, bytes: 0, error: '', loadedAt: '' }
};

function loadJsonDict(slot, filePath, expectObject) {
  const h = DICT_HEALTH[slot];
  h.path = filePath || '';
  h.exists = Boolean(filePath && fs.existsSync(filePath));
  h.ok = false;
  h.keys = 0;
  h.bytes = 0;
  h.error = '';
  h.loadedAt = new Date().toISOString();
  if (!h.exists) {
    h.error = filePath ? '文件不存在' : '未配置路径（enza 未挂载）';
    return null;
  }
  try { h.bytes = fs.statSync(filePath).size; } catch (e) { h.bytes = 0; }
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    h.error = '读取失败: ' + ((e && e.message) || e);
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (expectObject && (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))) {
      h.error = 'JSON 顶层不是对象';
      return null;
    }
    h.ok = true;
    h.keys = parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0;
    return parsed;
  } catch (e) {
    h.error = 'JSON 解析失败: ' + ((e && e.message) || e);
    return null;
  }
}

const SNAPSHOT_STORY_DATES = {};
for (const snapStory of (CATALOG_SNAPSHOT.stories || [])) {
  if (snapStory && snapStory.cat && snapStory.id && snapStory.timelineDate) {
    SNAPSHOT_STORY_DATES[snapStory.cat + '/' + snapStory.id] = { date: snapStory.timelineDate };
  }
}

function reloadExternalDictionaries(quiet, options) {
  const opts = options || {};
  clearScriptCache();
  // 只重载「汉化词典」时可以跳过多达 25 万条的语音索引（约 2/3 的耗时），
  // 避免用户点一次「重载汉化词典」就让整个服务端同步阻塞好几秒。
  if (!opts.skipVoice) {
    DUR.clear();
    const voiceIdx = loadJsonDict('voiceIndex', VOICE_ROOT ? path.join(VOICE_ROOT, 'index.json') : '', true);
    if (voiceIdx) {
      try {
        for (const c of voiceIdx.clips || []) DUR.set(String(c.id), c.duration);
        DICT_HEALTH.voiceIndex.keys = (voiceIdx.clips || []).length;
        if (!quiet) console.log('voice index:', (voiceIdx.clips || []).length, 'clips');
      } catch (e) {
        DICT_HEALTH.voiceIndex.ok = false;
        DICT_HEALTH.voiceIndex.error = 'clips 读取失败: ' + ((e && e.message) || e);
        if (!quiet) console.log('voice index broken:', e.message);
      }
    } else if (!quiet) {
      console.log('voice index unmounted (using lightweight metadata mode)');
    }
  }

  ZH = loadJsonDict('zh', ZH_PATH, true) || {};
  ZH_DYNAMIC = loadJsonDict('zhDynamic', ZH_DYNAMIC_PATH, true) || {};
  TITLE_ZH = loadJsonDict('titleZh', TITLE_ZH_PATH, true) || {};
  Object.keys(TITLE_ZH_NORM).forEach(function (k) { delete TITLE_ZH_NORM[k]; });
  Object.keys(TITLE_ZH).forEach(function (k) {
    try { TITLE_ZH_NORM[String(k).normalize('NFC')] = TITLE_ZH[k]; } catch (e) {}
  });
  Object.keys(STORY_ARC_ZH_NORM).forEach(function (k) {
    if (!TITLE_ZH_NORM[k]) TITLE_ZH_NORM[k] = STORY_ARC_ZH_NORM[k];
  });

  // 角色映射表：优先外部 char_map.json，未挂载时回退至 catalog_meta_snapshot.charMap + idol_outfits.json
  let nextCharMap = Object.assign({}, CATALOG_SNAPSHOT.charMap || {});
  const outfitsIdols = (IDOL_OUTFITS && IDOL_OUTFITS.idols) || {};
  Object.keys(outfitsIdols).forEach(function (key) {
    if (!nextCharMap[key] && outfitsIdols[key] && outfitsIdols[key].charId) {
      nextCharMap[key] = { id: String(outfitsIdols[key].charId), type: 'characters', cat: 'stand_fix' };
    }
  });
  if (CHAR_MAP_PATH && fs.existsSync(CHAR_MAP_PATH)) {
    const extMap = loadJsonDict('charMap', CHAR_MAP_PATH, true);
    if (extMap) nextCharMap = Object.assign(nextCharMap, extMap);
  }
  Object.keys(CHAR_MAP).forEach(function (k) { delete CHAR_MAP[k]; });
  Object.assign(CHAR_MAP, nextCharMap);

  Object.keys(CHAR_ID_TO_LABEL).forEach(function (k) { delete CHAR_ID_TO_LABEL[k]; });
  Object.keys(CHAR_MAP).forEach(function (label) {
    const cm = CHAR_MAP[label] || {};
    if (cm.id && MAIN_IDOL_LABELS.indexOf(label) >= 0) CHAR_ID_TO_LABEL[cm.id] = label;
  });

  STORY_TITLES = Object.assign({}, CATALOG_SNAPSHOT.storyTitles || {});
  if (DATA_ROOT && fs.existsSync(path.join(DATA_ROOT, 'story_titles.json'))) {
    try {
      const extSt = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'story_titles.json'), 'utf8'));
      if (extSt && typeof extSt === 'object') STORY_TITLES = Object.assign(STORY_TITLES, extSt);
    } catch (e) {}
  }

  GROUP_TITLES = Object.assign({}, CATALOG_SNAPSHOT.groupTitles || {});
  if (DATA_ROOT && fs.existsSync(path.join(DATA_ROOT, 'group_titles.json'))) {
    try {
      const extGt = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'group_titles.json'), 'utf8'));
      if (extGt && typeof extGt === 'object') GROUP_TITLES = Object.assign(GROUP_TITLES, extGt);
    } catch (e) {}
  }

  STORY_DATES = Object.assign({}, SNAPSHOT_STORY_DATES);
  if (STORY_DATES_PATH && fs.existsSync(STORY_DATES_PATH)) {
    try {
      const extSd = JSON.parse(fs.readFileSync(STORY_DATES_PATH, 'utf8'));
      if (extSd && typeof extSd === 'object') STORY_DATES = Object.assign(STORY_DATES, extSd);
    } catch (e) {}
  }

  if (!quiet) {
    console.log('dictionaries loaded -> zh:', Object.keys(ZH).length,
      '| charMap:', Object.keys(CHAR_MAP).length,
      '| storyTitles:', Object.keys(STORY_TITLES).length,
      '| storyDates:', Object.keys(STORY_DATES).length);
    if (!DICT_HEALTH.zh.ok) {
      console.log('!!! 汉化词典未就绪：' + (DICT_HEALTH.zh.path || '(未配置)') + ' -> ' +
        DICT_HEALTH.zh.error + ' —— 所有台词会退回日文、界面显示「汉化 0%」');
    }
  }
}

function titleZh(s) {
  try { return TITLE_ZH_NORM[String(s || '').normalize('NFC')] || ''; } catch (e) { return ''; }
}
function arcTitleZh(s) {
  try {
    const n = String(s || '').normalize('NFC').trim();
    if (!n) return '';
    return STORY_ARC_ZH_NORM[n] || TITLE_ZH_NORM[n] || '';
  } catch (e) { return ''; }
}
function storyTitleZhById(cat, id, jaTitle) {
  const byStory = STORY_TITLE_ZH_DATA.byStory || {};
  return byStory[cat + '/' + id] || arcTitleZh(jaTitle) || '';
}
function chapterTitleZhByKey(cat, chapter, rawTitle) {
  const byCh = STORY_TITLE_ZH_DATA.byChapter || {};
  return byCh[cat + '/' + chapter] || arcTitleZh(rawTitle) || '';
}

reloadExternalDictionaries(false);

const ERA_BASE_ORDER = {
  wing: 20180400,
  event_2018: 20180600,
  kanshasai: 20190300,
  event_2019: 20190600,
  grad: 20200500,
  event_2020: 20200600,
  lp: 20210700,
  event_2021: 20210600,
  step: 20220700,
  event_2022: 20220600,
  event_2023: 20230600,
  say_halo: 20240700,
  event_2024: 20240600,
  event_2025: 20250600,
  event_2026: 20260300
};

function storyDate(cat, id) {
  const key = cat + '/' + id;
  const rec = STORY_DATES[key];
  if (rec && rec.date) return rec.date;
  const eraRec = STORY_ERA_MAP[key];
  return (eraRec && eraRec.date) ? eraRec.date : null;
}

function storyTimelineMeta(cat, id, existingOrder, existingDate) {
  const d = existingDate || storyDate(cat, id) || '';
  if (existingOrder != null && existingOrder > 0) {
    return { timelineOrder: existingOrder, timelineDate: d };
  }
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return { timelineOrder: parseInt(d.replace(/-/g, ''), 10), timelineDate: d };
  }
  const eraRec = STORY_ERA_MAP[cat + '/' + id];
  if (eraRec && eraRec.era && ERA_BASE_ORDER[eraRec.era]) {
    return { timelineOrder: ERA_BASE_ORDER[eraRec.era], timelineDate: eraRec.date || d };
  }
  return { timelineOrder: existingOrder || null, timelineDate: d };
}

function earliestDate(parts) {
  let best = null;
  for (const p of parts || []) {
    const d = storyDate(p.cat, p.id);
    if (d && (!best || d < best)) best = d;
  }
  return best;
}

/* ---------- 导入剧本目录与二创工程包 (.scpack) 扫描 ---------- */
const USER_IMPORTS_DIR = process.env.ENZA_USER_IMPORTS_DIR
  ? path.resolve(process.env.ENZA_USER_IMPORTS_DIR)
  : path.join(SHINYCOLORS_ROOT, 'user_imports');
const PROJECTS_WORKSPACE_DIR = path.join(SHINYCOLORS_ROOT, 'projects_workspace');
const EXAMPLES_SCPROJ_DIR = path.join(SHINYCOLORS_ROOT, 'examples', 'scproj');
const UI_MOCKUPS_DIR = path.join(SHINYCOLORS_ROOT, 'ui-mockups');
try { fs.mkdirSync(USER_IMPORTS_DIR, { recursive: true }); } catch (e) {}

const SCRIPT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

const ROOFTOP_PACK_DIR = path.join(EXAMPLES_SCPROJ_DIR, 'rooftop_after_rain.scpack');
const ROOFTOP_PACK_STORIES_DIR = path.join(ROOFTOP_PACK_DIR, 'stories');
const ROOFTOP_PACK_BG_DIR = path.join(ROOFTOP_PACK_DIR, 'assets', 'bg');
const ROOFTOP_PACK_VOICE_DIR = path.join(ROOFTOP_PACK_DIR, 'assets', 'voice');

let _jsYaml = null;
function getJsYaml() {
  if (_jsYaml) return _jsYaml;
  const candidates = [
    path.join(SHINYCOLORS_ROOT, 'desktop', 'node_modules', 'js-yaml'),
    path.join(__dirname, '..', 'node_modules', 'js-yaml'),
    'js-yaml'
  ];
  for (const cand of candidates) {
    try { _jsYaml = require(cand); return _jsYaml; } catch (e) {}
  }
  throw new Error('js-yaml module not found');
}

let _scsRef = null;
function getScsRef() {
  if (_scsRef) return _scsRef;
  _scsRef = require(path.join(EXAMPLES_SCPROJ_DIR, '_ref', 'scs_ref.js'));
  return _scsRef;
}

const BUILTIN_SHOWCASE_DEFS = [
  {
    id: 'island_survival_rescue_01',
    title: '荒岛求生！？～偷溜的两人与海平线大营救～ (6人同台)',
    unit: 'CoMETIK',
    units: ['CoMETIK', 'ALSTROEMERIA'],
    chars: ['hana', 'amana', 'haruki', 'tenka', 'chiyuki', 'luca'],
    charNames: ['鈴木羽那', '大崎甘奈', '郁田はるき', '大崎甜花', '桑山千雪', '斑鳩ルカ'],
    date: '2026-11-12',
    timelineOrder: 20261113
  },
  {
    id: 'sc_feature_showcase',
    title: '283五人走位·换景·三分支实测篇',
    unit: 'Straylight',
    units: ['Straylight', 'noctchill'],
    chars: ['fuyuko', 'asahi', 'mei', 'toru', 'madoka'],
    charNames: ['黛冬優子', '芹沢あさひ', '和泉愛依', '浅倉透', '樋口円香'],
    date: '2026-11-12',
    timelineOrder: 20261112
  },
  {
    id: 'fyk_rooftop01',
    title: '雨后的天台·冬优子双声道演示 (TTS语音)',
    unit: 'Straylight',
    units: ['Straylight'],
    chars: ['fuyuko'],
    charNames: ['黛冬優子'],
    date: '2026-11-11',
    timelineOrder: 20261111
  }
];
const BUILTIN_DEF_BY_ID = new Map(BUILTIN_SHOWCASE_DEFS.map((d) => [d.id, d]));

const CANON_UNIT_MAP = {
  'illumination stars': 'illumination STARS',
  'illuminationstars': 'illumination STARS',
  'istars': 'illumination STARS',
  "l'antica": "L'Antica",
  'lantica': "L'Antica",
  'l_antica': "L'Antica",
  '放課後climaxgirls': '放課後CLIMAXGIRLS',
  '放クラ': '放課後CLIMAXGIRLS',
  'hokago': '放課後CLIMAXGIRLS',
  'houkago': '放課後CLIMAXGIRLS',
  'alstroemeria': 'ALSTROEMERIA',
  'straylight': 'Straylight',
  'noctchill': 'noctchill',
  'shhis': 'SHHis',
  'cometik': 'CoMETIK',
  '其他': '其他',
  'other': '其他'
};

function normalizeUnitName(rawUnit) {
  const s = String(rawUnit || '').trim();
  if (!s) return '';
  const low = s.toLowerCase();
  if (CANON_UNIT_MAP[low]) return CANON_UNIT_MAP[low];
  return s;
}

function listScpackDirs() {
  const out = [];
  const roots = [
    { dir: PROJECTS_WORKSPACE_DIR, source: 'workspace_pack' },
    { dir: EXAMPLES_SCPROJ_DIR, source: 'example_pack' }
  ];
  for (const r of roots) {
    if (!r.dir || !fs.existsSync(r.dir)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(r.dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name.toLowerCase().endsWith('.scpack'))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) { continue; }
    for (const d of entries) {
      const packDir = path.join(r.dir, d.name);
      let packMeta = {};
      const packJsonPath = path.join(packDir, 'pack.json');
      if (fs.existsSync(packJsonPath)) {
        try { packMeta = JSON.parse(fs.readFileSync(packJsonPath, 'utf8').replace(/^\uFEFF/, '')) || {}; } catch (e) { packMeta = {}; }
      }
      const packId = String(packMeta.id || d.name.slice(0, -7));
      const packTitle = String(packMeta.nameZh || packMeta.name || packId);
      out.push({ packDir, packId, packTitle, packMeta, source: r.source });
    }
  }
  return out;
}

let CUSTOM_SCRIPT_INDEX = new Map();

function stripScriptExt(filename) {
  return String(filename || '')
    .replace(/\.(scproj\.json|scs\.ya?ml|json|ya?ml)$/i, '')
    .trim();
}

function inspectCustomScriptFile(id, file, defaults) {
  defaults = defaults || {};
  if (!file || !fs.existsSync(file)) return null;
  let stat, raw;
  try {
    stat = fs.statSync(file);
    raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    return null;
  }
  const entries = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.lines) ? raw.lines : null);
  if (!Array.isArray(entries) || !entries.length) return null;
  const rawMeta = (!Array.isArray(raw) && raw && typeof raw === 'object' && (raw.meta || raw._meta)) || {};
  const firstMeta = (entries[0] && typeof entries[0] === 'object' && entries[0]._meta) || {};
  const bDef = BUILTIN_DEF_BY_ID.get(id) || null;

  const chars = [];
  const charNames = [];
  const inferredUnits = [];
  let dialogueLines = 0;
  let hasVoice = false;
  let hasSelect = false;
  let firstText = '';

  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const tx = (e._meta && e._meta.zh) || e.zh || e.text || '';
    if (typeof tx === 'string' && tx.trim()) {
      dialogueLines++;
      if (!firstText) firstText = tx.trim();
    }
    const cl = (typeof e.charLabel === 'string' && e.charLabel.trim())
      ? e.charLabel.trim()
      : ((typeof e.char === 'string' && e.char.trim()) ? e.char.trim() : '');
    if (cl && chars.indexOf(cl) < 0) {
      chars.push(cl);
      const p = resolveDynamicPerson(cl);
      if (p) {
        if (charNames.indexOf(p.name) < 0) charNames.push(p.name);
        if (inferredUnits.indexOf(p.unit) < 0) inferredUnits.push(p.unit);
      }
    }
    if (typeof e.voice === 'string' && e.voice.trim()) hasVoice = true;
    if (typeof e.select === 'string' && e.select.trim()) hasSelect = true;
  }

  if (!chars.length && bDef && Array.isArray(bDef.chars)) {
    bDef.chars.forEach((c) => { if (chars.indexOf(c) < 0) chars.push(c); });
  }
  if (!charNames.length && bDef && Array.isArray(bDef.charNames)) {
    bDef.charNames.forEach((cn) => { if (charNames.indexOf(cn) < 0) charNames.push(cn); });
  }

  const unit = normalizeUnitName(rawMeta.unit || defaults.unit || (bDef && bDef.unit) || '')
    || inferredUnits[0] || '其他';
  const units = [];
  if (unit && unit !== '其他') units.push(unit);
  for (const u of (defaults.units || (bDef && bDef.units) || []).concat(inferredUnits)) {
    const nu = normalizeUnitName(u);
    if (nu && nu !== '其他' && units.indexOf(nu) < 0) units.push(nu);
  }

  let title = String(
    rawMeta.titleZh || rawMeta.title ||
    firstMeta.titleZh || firstMeta.title ||
    defaults.title || (bDef && bDef.title) || ''
  ).trim();
  if (!title) {
    if (firstText) {
      const flat = firstText.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      title = flat.length > 36 ? flat.slice(0, 36) + '…' : flat;
    } else {
      title = id;
    }
  }

  const rawDate = String(
    rawMeta.date ||
    (rawMeta.importedAt ? String(rawMeta.importedAt).slice(0, 10) : '') ||
    defaults.date || (bDef && bDef.date) ||
    new Date(stat.mtimeMs).toISOString().slice(0, 10)
  ).slice(0, 10);

  const timelineOrder = defaults.timelineOrder || (bDef && bDef.timelineOrder) ||
    (20270000 + Math.min(999999, Math.floor(stat.mtimeMs / 1000) % 1000000));

  return {
    id,
    cat: 'custom',
    file,
    filename: path.basename(file),
    title,
    unit,
    units,
    chars,
    charNames,
    lineCount: entries.length,
    lines: dialogueLines || entries.length,
    hasVoice,
    hasSelect,
    date: rawDate,
    mtimeMs: stat.mtimeMs,
    timelineOrder,
    folder: defaults.folder || '导入与二创\\自定义剧本',
    source: defaults.source || 'custom_dir',
    packId: defaults.packId || '',
    packTitle: defaults.packTitle || '',
    deletable: !!defaults.deletable
  };
}

function scanAllCustomScripts() {
  const items = [];
  const seen = new Set();

  // 1. User-imported scripts in projects/shinycolors/user_imports/ (highest priority, newest first)
  if (USER_IMPORTS_DIR && fs.existsSync(USER_IMPORTS_DIR)) {
    let files = [];
    try {
      files = fs.readdirSync(USER_IMPORTS_DIR)
        .filter((f) => f.charAt(0) !== '.' && /\.(scproj\.json|json)$/i.test(f))
        .map((f) => {
          const full = path.join(USER_IMPORTS_DIR, f);
          let mtimeMs = 0;
          try { mtimeMs = fs.statSync(full).mtimeMs; } catch (e) {}
          return { name: f, full, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));
    } catch (e) { files = []; }
    for (const f of files) {
      const id = stripScriptExt(f.name);
      if (!SCRIPT_ID_RE.test(id) || seen.has(id)) continue;
      const item = inspectCustomScriptFile(id, f.full, {
        source: 'user_import',
        folder: '导入与二创\\用户导入剧本',
        packTitle: '用户导入',
        deletable: true,
        timelineOrder: 20290000 + Math.min(999999, Math.floor(f.mtimeMs / 1000) % 1000000)
      });
      if (item) {
        seen.add(id);
        items.push(item);
      }
    }
  }

  // 2. Workspace .scpack & Example .scpack directories
  const packs = listScpackDirs();
  for (const pk of packs) {
    const folderLabel = '导入与二创\\' + (pk.packTitle || pk.packId);
    const declaredStories = Array.isArray(pk.packMeta.stories) ? pk.packMeta.stories : [];
    for (const st of declaredStories) {
      if (!st || !st.id) continue;
      const id = String(st.id).trim();
      if (!SCRIPT_ID_RE.test(id) || seen.has(id)) continue;
      const relFile = st.file || ('stories/' + id + '.scproj.json');
      const full = safeJoin(pk.packDir, relFile);
      const item = inspectCustomScriptFile(id, full, {
        title: st.titleZh || st.title || '',
        unit: st.unit || pk.packMeta.unit || '',
        source: pk.source,
        folder: folderLabel,
        packId: pk.packId,
        packTitle: pk.packTitle,
        deletable: false
      });
      if (item) {
        seen.add(id);
        items.push(item);
      }
    }
    const storiesDir = path.join(pk.packDir, 'stories');
    if (fs.existsSync(storiesDir)) {
      let sFiles = [];
      try {
        sFiles = fs.readdirSync(storiesDir)
          .filter((f) => f.charAt(0) !== '.' && /\.(scproj\.json|json)$/i.test(f))
          .sort();
      } catch (e) { sFiles = []; }
      for (const sf of sFiles) {
        const id = stripScriptExt(sf);
        if (!SCRIPT_ID_RE.test(id) || seen.has(id)) continue;
        const item = inspectCustomScriptFile(id, path.join(storiesDir, sf), {
          unit: pk.packMeta.unit || '',
          source: pk.source,
          folder: folderLabel,
          packId: pk.packId,
          packTitle: pk.packTitle,
          deletable: false
        });
        if (item) {
          seen.add(id);
          items.push(item);
        }
      }
    }
  }

  CUSTOM_SCRIPT_INDEX = new Map(items.map((it) => [it.id, it]));
  return items;
}

function resolveBuiltinCustomFile(id) {
  if (!id || !SCRIPT_ID_RE.test(id)) return null;
  const cached = CUSTOM_SCRIPT_INDEX.get(id);
  if (cached && cached.file && fs.existsSync(cached.file)) return cached.file;
  for (const ext of ['.scproj.json', '.json']) {
    const fUser = safeJoin(USER_IMPORTS_DIR, id + ext);
    if (fUser && fs.existsSync(fUser)) return fUser;
  }
  for (const pk of listScpackDirs()) {
    const declared = Array.isArray(pk.packMeta.stories)
      ? pk.packMeta.stories.find((s) => s && String(s.id) === id)
      : null;
    if (declared && declared.file) {
      const fd = safeJoin(pk.packDir, declared.file);
      if (fd && fs.existsSync(fd)) return fd;
    }
    for (const ext of ['.scproj.json', '.json']) {
      const fp = safeJoin(path.join(pk.packDir, 'stories'), id + ext);
      if (fp && fs.existsSync(fp)) return fp;
    }
  }
  const fCustom = safeJoin(CUSTOM_ROOT, id + '.json');
  if (fCustom && fs.existsSync(fCustom)) return fCustom;
  return null;
}

function readScriptFileLines(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.lines)) return raw.lines;
  return null;
}

const SELECT_ZH_FALLBACK = {
  'ストレイライトの平面移動と表情変化をもっと見せる': '再展示一下 Straylight 的双人平面走位与破防表情！',
  'ノクチルの間（ま）と距離感の演出をテストする': '测试一下 noctchill 的留白节奏与凑近互动！',
  '冬優子の『営業モード⇔本音モード』高速切り替えを試す': '测试冬优子『营业甜嗓 ⇔ 冷淡本音』无缝秒切！',
  'まずは事務所のカメラ前でテストしよう': '先在事务所镜头前测试吧',
  'レッスン室に移動して動きを試そう': '去练习室试试动作表现吧',
  '屋上で夕方の空気感を確かめよう': '去天台确认傍晚的氛围感吧'
};

/* ------------------------------------------------------------------
 * 全局剧本目录（D:\enza\catalog.json 或轻量级 catalog_meta_snapshot.json） + 动态发现 (D1)
 * 只读加载，进程内做过滤/分页，绝不改写磁盘 catalog.json。
 * ------------------------------------------------------------------ */
let CATALOG_STORIES = [];
let CATALOG_GROUPS = [];
let CATALOG_BY_ID = new Map();       // cat|id -> story
let CATALOG_BY_GROUP = new Map();    // cat|chapter -> group
let CATALOG_ERROR = '';

const TYPE_BY_CAT = {
  produce_events: '主线',
  game_event_communications: '活动',
  produce_communications: '培育',
  produce_communications_promises: '培育',
  produce_communication_promise_results: '培育',
  produce_communication_auditions: '培育',
  produce_communication_cheers: '培育',
  produce_communication_judges: '培育',
  produce_communication_televisions: '培育',
  special_communications: '个人',
  mypage_communications: '个人',
  business_unit_communication: '其他',
  support_skills: '其他'
};

const UNIT_DEFS = [
  ['illumination STARS', [['mano', '櫻木真乃', '001'], ['hiori', '風野灯織', '002'], ['meguru', '八宮めぐる', '003']]],
  ["L'Antica", [['kogane', '月岡恋鐘', '004'], ['mamimi', '田中摩美々', '005'], ['sakuya', '白瀬咲耶', '006'], ['yuika', '三峰結華', '007'], ['kiriko', '幽谷霧子', '008']]],
  ['放課後CLIMAXGIRLS', [['kaho', '小宮果穂', '009'], ['chiyoko', '園田智代子', '010'], ['juri', '西城樹里', '011'], ['rinze', '杜野凛世', '012'], ['natsuha', '有栖川夏葉', '013']]],
  ['ALSTROEMERIA', [['amana', '大崎甘奈', '014'], ['tenka', '大崎甜花', '015'], ['chiyuki', '桑山千雪', '016']]],
  ['Straylight', [['asahi', '芹沢あさひ', '017'], ['fuyuko', '黛冬優子', '018'], ['mei', '和泉愛依', '019']]],
  ['noctchill', [['toru', '浅倉透', '020'], ['madoka', '樋口円香', '021'], ['koito', '福丸小糸', '022'], ['hinana', '市川雛菜', '023']]],
  ['SHHis', [['nichika', '七草にちか', '024'], ['mikoto', '緋田美琴', '025']]],
  ['CoMETIK', [['luca', '斑鳩ルカ', '026'], ['hana', '鈴木羽那', '027'], ['haruki', '郁田はるき', '028']]]
];
const PERSON_BY_LABEL = new Map();
const PERSON_BY_NO = new Map();
for (const [uName, idols] of UNIT_DEFS) {
  for (const [lab, jaName, no] of idols) {
    const rec = { label: lab, name: jaName, unit: uName, no };
    PERSON_BY_LABEL.set(lab, rec);
    PERSON_BY_NO.set(no, rec);
  }
}

function resolveDynamicPerson(label) {
  const key = String(label || '').trim();
  if (!key) return null;
  if (PERSON_BY_LABEL.has(key)) return PERSON_BY_LABEL.get(key);
  const base = key.replace(/\d+$/, '');
  if (base && PERSON_BY_LABEL.has(base)) return PERSON_BY_LABEL.get(base);
  const cm = CHAR_MAP[key];
  if (cm && cm.id) {
    const m3 = /^(\d{3})$/.exec(String(cm.id));
    const m10 = /^\d(\d{2})(\d{3})\d{4}$/.exec(String(cm.id));
    const no = m3 ? m3[1] : (m10 ? m10[2] : '');
    if (no && PERSON_BY_NO.has(no)) return PERSON_BY_NO.get(no);
  }
  return null;
}

function buildDynamicStoryFromDisk(cat, id, fullPath) {
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    return null;
  }
  if (!Array.isArray(entries)) return null;
  const chars = [];
  const charPersons = [];
  let lines = 0;
  let hasVoice = false, hasSelect = false, hasStill = false, hasMovie = false;
  let firstText = '';
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    if (typeof e.text === 'string' && e.text.trim() !== '') {
      lines++;
      if (!firstText) firstText = e.text;
    }
    const cl = typeof e.charLabel === 'string' && e.charLabel.trim() ? e.charLabel.trim()
      : (typeof e.char === 'string' && e.char.trim() ? e.char.trim() : '');
    if (cl && chars.indexOf(cl) < 0) {
      chars.push(cl);
      const p = resolveDynamicPerson(cl);
      if (p) charPersons.push(p);
    }
    if (typeof e.voice === 'string' && e.voice.trim()) hasVoice = true;
    if (typeof e.select === 'string' && e.select.trim()) hasSelect = true;
    if ((typeof e.still === 'string' && e.still.trim()) || (typeof e.stillId === 'string' && e.stillId.trim())) hasStill = true;
    if (typeof e.movie === 'string' && e.movie.trim()) hasMovie = true;
  }
  const chapter = id.length > 2 ? id.slice(0, -2) : id;
  const part = id.length > 2 ? id.slice(-2) : id;
  const stMeta = STORY_TITLES[id] && typeof STORY_TITLES[id] === 'object' ? STORY_TITLES[id] : null;
  const folder = stMeta && typeof stMeta.folder === 'string' ? stMeta.folder.replace(/\//g, '\\') : '';
  const unitSet = [];
  for (const p of charPersons) {
    if (unitSet.indexOf(p.unit) < 0) unitSet.push(p.unit);
  }
  const unit = charPersons.length ? charPersons[0].unit : '其他';
  const charNames = [];
  for (const p of charPersons) {
    if (charNames.indexOf(p.name) < 0) charNames.push(p.name);
  }

  let title = '';
  let titleSource = 'text';
  if (stMeta && typeof stMeta.title === 'string' && stMeta.title.trim() && stMeta.title.trim() !== id) {
    title = stMeta.title.trim();
    titleSource = 'story_titles';
  } else if (GROUP_TITLES[cat + '/' + chapter]) {
    title = GROUP_TITLES[cat + '/' + chapter];
    titleSource = 'group';
  } else if (/^produce_communications?_promises?/.test(cat)) {
    title = '约定';
    titleSource = 'promises-default';
  } else if (firstText) {
    const flat = firstText.replace(/\r\n?/g, ' ').replace(/[\s\u3000]+/g, ' ').trim();
    const arr = Array.from(flat);
    title = arr.length > 42 ? arr.slice(0, 42).join('') + '…' : flat;
  } else {
    title = id;
  }
  const tZh = titleZh(title);
  const s = {
    cat,
    id,
    title: tZh || title,
    titleZh: tZh || undefined,
    folder,
    type: TYPE_BY_CAT[cat] || '其他',
    unit,
    units: unitSet,
    chapter,
    part,
    lines,
    chars,
    charNames,
    hasVoice,
    hasSelect,
    hasStill,
    hasMovie,
    titleSource,
    dynamicDiscovered: true
  };
  s._q = fold([
    s.title, title, s.id, s.cat, s.type, s.unit, s.chapter,
    s.cat + '/' + s.id, unitSet.join(' '), charNames.join(' ')
  ].join('\n'));
  return s;
}

function fold(v) { return String(v == null ? '' : v).toLowerCase(); }

/** 章节标题：该组第一条正式标题；
 *  正式程度 story_titles > group > promises-default；
 *  只有正文截断标题时取最短的一条（最像标题）。 */
function pickChapterTitle(parts) {
  for (const src of ['story_titles', 'group', 'promises-default']) {
    for (const p of parts) {
      if (p && p.title && p.titleSource === src) return p.title;
    }
  }
  let best = '';
  for (const p of parts) {
    if (!p || !p.title) continue;
    if (!best || p.title.length < best.length) best = p.title;
  }
  return best;
}

function rebuildGroupMeta(g, fallbackTitle) {
  g.parts.sort(function (a, b) { return String(a.part).localeCompare(String(b.part), 'en', { numeric: true }); });
  g.title = pickChapterTitle(g.parts) || g.title || fallbackTitle || g.chapter;
  let lines = 0;
  let timelineOrder = null;
  let timelineDate = '';
  for (const p of g.parts) {
    lines += p.lines || 0;
    if (p.timelineOrder != null && (!timelineOrder || p.timelineOrder < timelineOrder)) timelineOrder = p.timelineOrder;
    if (p.timelineDate && (!timelineDate || p.timelineDate < timelineDate)) timelineDate = p.timelineDate;
  }
  g.lines = lines || g.lines || 0;
  g.timelineOrder = timelineOrder;
  g.timelineDate = timelineDate;
  const search = [
    g.title, g.cat, g.chapter, g.type, g.unit,
    ...g.parts.map(function (p) {
      return [p.title, p.id, p.cat + '/' + p.id, p.unit, (p.units || []).join(' ')].join(' ');
    })
  ].join('\n');
  g._q = fold(search);
}

function loadCatalogFile(opts) {
  // 目录/挂载/自定义剧本一变，之前缓存的 /api/script 结果就可能串味，直接整体作废。
  clearScriptCache();
  opts = opts || {};
  const hasExplicitCatalog = Object.prototype.hasOwnProperty.call(opts, 'catalogPath');
  const catalogPath = hasExplicitCatalog ? opts.catalogPath : CATALOG_PATH;
  const jsonRoot = Object.prototype.hasOwnProperty.call(opts, 'jsonRoot') ? opts.jsonRoot : JSON_ROOT;
  const t0 = Date.now();
  try {
    let raw = { stories: [], chapters: [] };
    if (catalogPath && fs.existsSync(catalogPath)) {
      raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      if (!hasExplicitCatalog) CATALOG_SOURCE = 'external';
    } else if (!hasExplicitCatalog && Array.isArray(CATALOG_SNAPSHOT.stories) && CATALOG_SNAPSHOT.stories.length) {
      raw = {
        stories: CATALOG_SNAPSHOT.stories,
        chapters: CATALOG_SNAPSHOT.chapters || []
      };
      CATALOG_SOURCE = 'snapshot';
    } else if (!hasExplicitCatalog) {
      CATALOG_SOURCE = 'empty';
    }
    const stories = Array.isArray(raw.stories) ? raw.stories.map((x) => Object.assign({}, x)) : [];
    const chapters = Array.isArray(raw.chapters) ? raw.chapters : [];
    const firstLineMap = STORY_TITLE_ZH_DATA.firstLineByStory || {};
    const byId = new Map();
    for (const s of stories) {
      if (!s || !s.cat || !s.id) continue;
      const titleJa = s.title || '';
      const origTitleZh = s.titleZh || '';
      if (origTitleZh) s.title = origTitleZh;
      const resolvedZh = storyTitleZhById(s.cat, s.id, titleJa) || origTitleZh || '';
      s.titleJa = titleJa;
      s.titleZh = resolvedZh;
      s.firstLineZh = firstLineMap[s.cat + '/' + s.id] || '';
      const stRec = STORY_TITLES[s.cat + '/' + s.id] || STORY_TITLES[s.id] || null;
      const folderStr = (stRec && stRec.folder) || s.folder || '';
      const folderLeaf = String(folderStr).split(/[\\\/]+/).filter(Boolean).pop() || '';
      s.arcZh = arcTitleZh(folderStr) || arcTitleZh(folderLeaf) || '';
      const tm = storyTimelineMeta(s.cat, s.id, s.timelineOrder, s.timelineDate);
      if (tm.timelineOrder != null) s.timelineOrder = tm.timelineOrder;
      if (tm.timelineDate) s.timelineDate = tm.timelineDate;
      const search = [
        s.title, titleJa, s.titleZh, s.firstLineZh, s.arcZh, folderStr,
        s.id, s.cat, s.type, s.unit, s.chapter,
        s.cat + '/' + s.id,
        (s.units || []).join(' '), (s.charNames || []).join(' ')
      ].join('\n');
      s._q = fold(search);
      byId.set(s.cat + '|' + s.id, s);
    }

    const groups = [];
    const byGroup = new Map();
    for (const c of chapters) {
      if (!c || !c.cat || !c.chapter) continue;
      const parts = [];
      for (const part of c.parts || []) {
        const s = byId.get(c.cat + '|' + (c.chapter + String(part)));
        if (s) parts.push(s);
      }
      parts.sort(function (a, b) { return String(a.part).localeCompare(String(b.part), 'en', { numeric: true }); });
      const title = c.titleZh || pickChapterTitle(parts) || c.title || c.chapter;
      const titleJa = c.title || (parts[0] && parts[0].titleJa) || '';
      let arcZh = '';
      for (const p of parts) {
        if (p.arcZh) { arcZh = p.arcZh; break; }
      }
      const titleZhVal = chapterTitleZhByKey(c.cat, c.chapter, title) ||
        chapterTitleZhByKey(c.cat, c.chapter, titleJa) ||
        (c.type === '活动' && arcZh ? arcZh : '') ||
        c.titleZh ||
        (parts[0] && parts[0].titleZh) || '';
      let lines = 0;
      let timelineOrder = null;
      let timelineDate = '';
      for (const p of parts) {
        lines += p.lines || 0;
        if (p.timelineOrder != null && (!timelineOrder || p.timelineOrder < timelineOrder)) timelineOrder = p.timelineOrder;
        if (p.timelineDate && (!timelineDate || p.timelineDate < timelineDate)) timelineDate = p.timelineDate;
      }
      const search = [
        title, titleJa, titleZhVal, arcZh, c.cat, c.chapter, c.type, c.unit,
        ...parts.map(function (p) {
          return [p.title, p.titleJa, p.titleZh, p.firstLineZh, p.id, p.cat + '/' + p.id, p.unit, (p.units || []).join(' ')].join(' ');
        })
      ].join('\n');
      const g = {
        cat: c.cat,
        chapter: c.chapter,
        title: title,
        titleJa: titleJa,
        titleZh: titleZhVal,
        arcZh: arcZh,
        type: c.type,
        unit: c.unit,
        lines: lines || c.lines || 0,
        timelineOrder: timelineOrder,
        timelineDate: timelineDate,
        parts: parts,
        _q: fold(search)
      };
      groups.push(g);
      byGroup.set(c.cat + '|' + c.chapter, g);
    }

    // D1: 扫描磁盘目录，自动发现并索引未写入 catalog.json 的手工/增量剧本文件（绝不改写磁盘文件）
    let discoveredCount = 0;
    const touchedGroups = new Set();
    if (jsonRoot && fs.existsSync(jsonRoot)) {
      const catDirs = fs.readdirSync(jsonRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      for (const cat of catDirs) {
        const dir = path.join(jsonRoot, cat);
        let files = [];
        try {
          files = fs.readdirSync(dir).filter((f) => f.length > 5 && f.slice(-5).toLowerCase() === '.json').sort();
        } catch (e) { continue; }
        for (const f of files) {
          const id = f.slice(0, -5);
          const key = cat + '|' + id;
          if (byId.has(key)) continue;
          const dynStory = buildDynamicStoryFromDisk(cat, id, path.join(dir, f));
          if (!dynStory) continue;
          const tm = storyTimelineMeta(dynStory.cat, dynStory.id, dynStory.timelineOrder, dynStory.timelineDate);
          if (tm.timelineOrder != null) dynStory.timelineOrder = tm.timelineOrder;
          if (tm.timelineDate) dynStory.timelineDate = tm.timelineDate;
          stories.push(dynStory);
          byId.set(key, dynStory);
          discoveredCount++;

          const gKey = cat + '|' + dynStory.chapter;
          let g = byGroup.get(gKey);
          if (!g) {
            g = {
              cat: cat,
              chapter: dynStory.chapter,
              title: '',
              type: dynStory.type,
              unit: dynStory.unit,
              lines: 0,
              timelineOrder: null,
              timelineDate: '',
              parts: [],
              _q: ''
            };
            groups.push(g);
            byGroup.set(gKey, g);
          }
          g.parts.push(dynStory);
          if ((!g.unit || g.unit === '其他') && dynStory.unit && dynStory.unit !== '其他') {
            g.unit = dynStory.unit;
          }
          touchedGroups.add(g);
        }
      }
      for (const g of touchedGroups) rebuildGroupMeta(g);
    }

    // Mount user-imported scripts & .scpack fanwork stories at the top of default catalog
    if (!opts.catalogPath && !opts.jsonRoot) {
      const customItems = scanAllCustomScripts();
      for (let bi = customItems.length - 1; bi >= 0; bi--) {
        const item = customItems[bi];
        STORY_TITLES[item.id] = { title: item.title, folder: item.folder };
        GROUP_TITLES['custom/' + item.id] = item.title;
        STORY_DATES['custom/' + item.id] = { date: item.date };
        const sObj = {
          cat: 'custom',
          id: item.id,
          title: item.title,
          titleZh: item.title,
          folder: item.folder,
          type: '导入与二创',
          unit: item.unit,
          units: item.units,
          chapter: item.id,
          part: '01',
          lines: item.lines,
          lineCount: item.lineCount,
          chars: item.chars,
          charNames: item.charNames,
          hasVoice: item.hasVoice,
          hasSelect: item.hasSelect,
          hasStill: false,
          hasMovie: false,
          timelineOrder: item.timelineOrder,
          timelineDate: item.date,
          titleSource: 'story_titles',
          source: item.source,
          packId: item.packId,
          packTitle: item.packTitle,
          deletable: item.deletable
        };
        sObj._q = fold([
          sObj.title, sObj.id, 'custom', sObj.type, '演示与二创', '导入与二创',
          sObj.unit, sObj.folder, (item.units || []).join(' '), (item.charNames || []).join(' ')
        ].join('\n'));
        if (!byId.has('custom|' + item.id)) {
          stories.unshift(sObj);
          byId.set('custom|' + item.id, sObj);
        }
        if (!byGroup.has('custom|' + item.id)) {
          const gObj = {
            cat: 'custom',
            chapter: item.id,
            title: item.title,
            type: '导入与二创',
            unit: item.unit,
            lines: sObj.lines,
            timelineOrder: item.timelineOrder,
            timelineDate: item.date,
            parts: [sObj],
            source: item.source,
            packId: item.packId,
            packTitle: item.packTitle,
            deletable: item.deletable,
            _q: sObj._q
          };
          groups.unshift(gObj);
          byGroup.set('custom|' + item.id, gObj);
        }
      }
    }

    CATALOG_STORIES = stories;
    CATALOG_GROUPS = groups;
    CATALOG_BY_ID = byId;
    CATALOG_BY_GROUP = byGroup;
    CATALOG_ERROR = '';
    console.log('catalog (' + CATALOG_SOURCE + '):', stories.length, 'stories /', groups.length, 'chapter groups' +
      (discoveredCount ? ' (+' + discoveredCount + ' dynamic)' : '') + ',',
      (Date.now() - t0) + 'ms');
  } catch (e) {
    CATALOG_STORIES = [];
    CATALOG_GROUPS = [];
    CATALOG_BY_ID = new Map();
    CATALOG_BY_GROUP = new Map();
    CATALOG_ERROR = String((e && e.message) || e);
    console.log('catalog missing:', CATALOG_ERROR);
  }
}

function resolveScspSubRoot(root) {
  if (!root) return { baseRoot: '', innerRoot: '' };
  const abs = path.resolve(root);
  const sub = path.join(abs, 'SCSPDownloader');
  const hasMarkers = (dir) => (
    fs.existsSync(path.join(dir, 'official-current-index.json')) ||
    fs.existsSync(path.join(dir, 'wardrobe-data.json')) ||
    fs.existsSync(path.join(dir, 'wardrobe-thumbnails')) ||
    fs.existsSync(path.join(dir, 'audio-index')) ||
    fs.existsSync(path.join(dir, 'web-downloads'))
  );
  if (hasMarkers(sub)) {
    return { baseRoot: abs, innerRoot: sub };
  }
  if (hasMarkers(abs)) {
    return { baseRoot: path.dirname(abs), innerRoot: abs };
  }
  return { baseRoot: abs, innerRoot: sub };
}

function resolveScspWavFile(scspWavRel) {
  if (!scspWavRel || !SCSP_ROOT || !fs.existsSync(SCSP_ROOT)) return null;
  const direct = safeJoin(SCSP_ROOT, scspWavRel);
  if (direct && fs.existsSync(direct)) return direct;
  const prefix = 'SCSPDownloader/';
  const normRel = String(scspWavRel).replace(/\\/g, '/');
  if (normRel.indexOf(prefix) === 0) {
    const alt = safeJoin(SCSP_ROOT, normRel.slice(prefix.length));
    if (alt && fs.existsSync(alt)) return alt;
  }
  return null;
}

function getMountStatus() {
  const enzaExists = Boolean(DATA_ROOT && fs.existsSync(DATA_ROOT));
  const hasCatalog = Boolean(enzaExists && CATALOG_PATH && fs.existsSync(CATALOG_PATH));
  const hasJson = Boolean(enzaExists && JSON_ROOT && fs.existsSync(JSON_ROOT));
  const hasSpine = Boolean(
    enzaExists && ASSETS && (
      fs.existsSync(path.join(ASSETS, 'spine', 'characters', 'stand', '001', 'data.json')) ||
      fs.existsSync(path.join(ASSETS, 'spine'))
    )
  );
  const hasBg = Boolean(enzaExists && ASSETS && fs.existsSync(path.join(ASSETS, 'images', 'event', 'bg')));
  const hasVoice = Boolean(
    enzaExists && VOICE_ROOT && (
      fs.existsSync(path.join(VOICE_ROOT, 'index.json')) ||
      fs.existsSync(VOICE_ROOT)
    )
  );
  const hasBgm = Boolean(enzaExists && ASSETS && fs.existsSync(path.join(ASSETS, 'sounds', 'bgm')));
  const enzaMounted = Boolean((hasCatalog && (hasJson || hasSpine || hasBg)) || (hasSpine && hasBg));

  const scspExists = Boolean(SCSP_ROOT && fs.existsSync(SCSP_ROOT));
  const scspDirs = scspExists ? resolveScspSubRoot(SCSP_ROOT) : { baseRoot: '', innerRoot: '' };
  const hasScspIndex = Boolean(
    scspExists && (
      fs.existsSync(path.join(scspDirs.innerRoot, 'official-current-index.json')) ||
      fs.existsSync(path.join(scspDirs.innerRoot, 'wardrobe-data.json')) ||
      fs.existsSync(path.join(scspDirs.baseRoot, 'scsp_localify')) ||
      fs.existsSync(path.join(SCSP_ROOT, 'scsp_localify'))
    )
  );
  const hasScspAudioIndex = Boolean(scspExists && fs.existsSync(path.join(scspDirs.innerRoot, 'audio-index', 'banks')));
  const hasScspDownloads = Boolean(scspExists && fs.existsSync(path.join(scspDirs.innerRoot, 'web-downloads')));
  const scspMounted = Boolean(scspExists && (hasScspIndex || hasScspAudioIndex || hasScspDownloads));

  return {
    ok: true,
    enzaRoot: DATA_ROOT,
    enzaMounted: enzaMounted,
    enzaStats: {
      hasCatalog: hasCatalog,
      hasJson: hasJson,
      hasSpine: hasSpine,
      hasBg: hasBg,
      hasVoice: hasVoice,
      hasBgm: hasBgm,
      storyCount: CATALOG_STORIES.length,
      chapterCount: CATALOG_GROUPS.length
    },
    scspRoot: SCSP_ROOT,
    scspMounted: scspMounted,
    scspStats: {
      hasIndex: hasScspIndex,
      hasAudioIndex: hasScspAudioIndex,
      hasDownloads: hasScspDownloads,
      storyCount: SCSP_CURATED_STORIES.length,
      totalRawScenarios: (SCSP_CURATED_META.corpusStats && SCSP_CURATED_META.corpusStats.totalRawScenarios) || 5133,
      totalVoiceCues: (SCSP_CURATED_META.corpusStats && SCSP_CURATED_META.corpusStats.totalVoiceCues) || 58268,
      decodedUniqueWavs: (SCSP_CURATED_META.corpusStats && SCSP_CURATED_META.corpusStats.decodedUniqueWavs) || 18713
    },
    catalogSource: CATALOG_SOURCE,
    configSource: MOUNT_SOURCE,
    // 汉化/角色/语音词典健康度：前端据此解释「汉化 0%」到底是没挂载、还是词典读失败
    dicts: {
      zh: Object.assign({}, DICT_HEALTH.zh),
      zhDynamic: Object.assign({}, DICT_HEALTH.zhDynamic),
      titleZh: Object.assign({}, DICT_HEALTH.titleZh),
      charMap: Object.assign({}, DICT_HEALTH.charMap),
      voiceIndex: Object.assign({}, DICT_HEALTH.voiceIndex)
    }
  };
}

function applyMountRoots(enzaRoot, scspRoot, sourceLabel, quiet) {
  setMountPaths(enzaRoot, scspRoot, sourceLabel || 'memory');
  reloadExternalDictionaries(Boolean(quiet));
  loadCatalogFile();
  return getMountStatus();
}

function getScspStories(query) {
  query = query || {};
  const unitFilter = fold(String(query.unit || '').trim());
  const charFilter = fold(String(query.char || '').trim());
  const catFilter = fold(String(query.category || '').trim());
  const qFilter = fold(String(query.q || '').trim());
  const status = getMountStatus();
  const list = [];
  for (const st of SCSP_CURATED_STORIES) {
    if (!st || !st.id) continue;
    if (unitFilter && unitFilter !== 'all') {
      const unitsLow = [st.unit].concat(st.units || []).map(fold);
      if (unitsLow.indexOf(unitFilter) < 0) continue;
    }
    if (charFilter) {
      const charsLow = (st.chars || []).concat(st.charNames || [], st.charNamesZh || []).map(fold);
      if (!charsLow.some((c) => c.indexOf(charFilter) >= 0)) continue;
    }
    if (catFilter && fold(st.category || '').indexOf(catFilter) < 0) continue;
    if (qFilter) {
      const hay = fold([
        st.id, st.sceneId, st.title, st.titleJa, st.category, st.unit,
        (st.units || []).join(' '), (st.chars || []).join(' '),
        (st.charNames || []).join(' '), (st.charNamesZh || []).join(' ')
      ].join('\n'));
      if (hay.indexOf(qFilter) < 0) continue;
    }
    list.push({
      id: st.id,
      cat: 'scsp',
      sceneId: st.sceneId,
      sourceType: st.sourceType,
      category: st.category,
      unit: st.unit,
      units: st.units || [],
      chars: st.chars || [],
      charIds: st.charIds || [],
      charNames: st.charNames || [],
      charNamesZh: st.charNamesZh || [],
      title: st.title,
      titleJa: st.titleJa || '',
      placeZh: st.placeZh || '283事务所',
      lineCount: st.lineCount || (st.lines ? st.lines.length : 0),
      voicedCount: st.voicedCount || 0,
      wavAvailableCount: status.scspMounted ? (st.wavAvailableCount || 0) : 0,
      zhPct: st.zhPct != null ? st.zhPct : 100
    });
  }
  return {
    ok: true,
    scspMounted: status.scspMounted,
    scspRoot: status.scspRoot,
    enzaMounted: status.enzaMounted,
    corpusStats: SCSP_CURATED_META.corpusStats || {},
    total: list.length,
    stories: list
  };
}

loadCatalogFile();

function catalogFilter(qs) {
  let type = String(qs.type || '').trim();
  if (type === 'all') type = '';
  const TYPE_ALIAS = {
    main: '主线',
    event: '活动',
    produce: '培育',
    personal: '个人',
    custom: '导入与二创',
    '📁 导入与二创': '导入与二创',
    '🌟 演示与二创': '导入与二创',
    '演示与二创': '导入与二创'
  };
  if (TYPE_ALIAS[type]) type = TYPE_ALIAS[type];
  const units = [];
  const rawUnit = qs.unit;
  const list = Array.isArray(rawUnit) ? rawUnit : [rawUnit];
  for (const item of list) {
    if (!item) continue;
    for (const u of String(item).split(',')) {
      const v = u.trim();
      if (v) units.push(fold(v));
    }
  }
  return {
    type: type,
    units: units,
    q: fold(String(qs.q || '').trim()),
    cat: String(qs.cat || '').trim()
  };
}

function catalogInt(v, def, min, max) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function storyLite(s) {
  return {
    cat: s.cat, id: s.id, title: s.title,
    titleZh: s.titleZh || '', titleJa: s.titleJa || '',
    firstLineZh: s.firstLineZh || '', arcZh: s.arcZh || '',
    type: s.type, unit: s.unit,
    chapter: s.chapter, part: s.part, lines: s.lines,
    date: storyDate(s.cat, s.id),
    hasVoice: !!s.hasVoice, hasSelect: !!s.hasSelect,
    hasStill: !!s.hasStill, hasMovie: !!s.hasMovie,
    source: s.source || undefined,
    deletable: !!s.deletable
  };
}

function groupLite(g) {
  const date = earliestDate(g.parts);
  let folder = '';
  for (const p of g.parts) {
    if (p.folder) { folder = p.folder; break; }
  }
  const charSet = [];
  const charNameSet = [];
  for (const p of g.parts) {
    (p.chars || []).forEach(function (c, i) {
      if (charSet.indexOf(c) >= 0) return;
      charSet.push(c);
      charNameSet.push(zhCharName((p.charNames || [])[i] || c, c));
    });
  }
  return {
    cat: g.cat, chapter: g.chapter, title: g.title,
    titleZh: g.titleZh || '', titleJa: g.titleJa || '', arcZh: g.arcZh || '',
    type: g.type, unit: g.unit, count: g.parts.length, lines: g.lines,
    date: date,
    timelineOrder: g.timelineOrder,
    timelineDate: g.timelineDate || '',
    folder: folder,
    source: g.source || undefined,
    packTitle: g.packTitle || undefined,
    deletable: !!g.deletable,
    chars: charSet,
    charNames: charNameSet,
    parts: g.parts.map(function (p) {
      return {
        cat: p.cat, id: p.id, part: p.part, title: p.title,
        titleZh: p.titleZh || '', titleJa: p.titleJa || '',
        firstLineZh: p.firstLineZh || '',
        lines: p.lines,
        date: storyDate(p.cat, p.id),
        timelineOrder: p.timelineOrder || null,
        timelineDate: p.timelineDate || '',
        chars: p.chars || [], charNames: p.charNames || [],
        hasSelect: !!p.hasSelect, hasStill: !!p.hasStill
      };
    })
  };
}

function resolveSpine(type, cat, id) {
  if (!ASSETS || !id) return null;
  const cands = [
    [type, cat], ['idol_evolution_skins', cat], ['idol_evolution_skins', 'stand_costume'], ['idol_evolution_skins', 'stand'],
    ['awake_idols', cat], ['awake_idols', 'stand_costume'], ['awake_idols', 'stand'],
    ['characters', cat], [type, 'stand'], ['characters', 'stand'],
    ['characters', 'stand_costume'], [type, 'stand_costume'], ['sub_characters', cat],
    ['support_idols', cat], ['idols', cat],
    ['sub_characters', 'stand'], ['support_idols', 'stand'], ['idols', 'stand'],
    ['events', cat]
  ];
  const seen = new Set();
  for (const [t, c] of cands) {
    if (!t || !c) continue;
    const key = t + '/' + c;
    if (seen.has(key)) continue;
    seen.add(key);
    if (fs.existsSync(path.join(ASSETS, 'spine', t, c, id, 'data.json'))) return { type: t, cat: c };
  }
  return null;
}

function safeJoin(root, rel) {
  if (!root) return null;
  const abs = path.resolve(root, rel);
  const base = path.resolve(root);
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}

/* ------------------------------------------------------------------
 * 文本资源 gzip（仅 >1KB 的 html/js/css/json；图片/音频/视频一律不动）
 * 按 Accept-Encoding 协商，响应加 Vary，Range 请求保持原样。
 * ------------------------------------------------------------------ */
const GZIP_MIN = 1024;
const GZIP_MAX = 512 * 1024;
function isCompressible(type) {
  const t = String(type || '').toLowerCase();
  return /^text\/html\b/.test(t) || /^text\/css\b/.test(t) ||
    /^application\/json\b/.test(t) || /^application\/javascript\b/.test(t) ||
    /^text\/javascript\b/.test(t);
}
function acceptsGzip(req) {
  const ae = String((req && req.headers && req.headers['accept-encoding']) || '');
  if (!/\bgzip\b/i.test(ae)) return false;
  const m = /(?:^|,)\s*gzip\s*(?:;\s*q\s*=\s*([0-9.]+))?/i.exec(ae);
  return !(m && m[1] !== undefined && parseFloat(m[1]) === 0);
}
/** 一次性缓冲响应：文本且 >1KB 时同步 gzip。 */
function sendBuffer(req, res, code, headers, buf) {
  const type = headers['Content-Type'] || '';
  if (buf.length > GZIP_MIN && buf.length <= GZIP_MAX && isCompressible(type) && acceptsGzip(req)) {
    zlib.gzip(buf, { level: 6 }, (err, gz) => {
      if (err || !gz) {
        res.writeHead(code, Object.assign({}, headers, { 'Content-Length': buf.length }));
        res.end(buf);
        return;
      }
      res.writeHead(code, Object.assign({}, headers, {
        'Content-Encoding': 'gzip',
        'Content-Length': gz.length,
        'Vary': 'Accept-Encoding'
      }));
      res.end(gz);
    });
    return;
  }
  res.writeHead(code, Object.assign({}, headers, { 'Content-Length': buf.length }));
  res.end(buf);
}

function sendJson(res, code, obj) {
  sendBuffer(res.req, res, code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, Buffer.from(JSON.stringify(obj)));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const fail = (err) => { if (!done) { done = true; reject(err); } };
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limit) { fail(new Error('request body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', fail);
  });
}

function listDirs(root) {
  if (!root || !fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}

function listScripts(cat) {
  if (cat === 'scsp') {
    return SCSP_CURATED_STORIES.map((s) => s.id);
  }
  if (cat === 'custom') {
    const out = [];
    for (const item of scanAllCustomScripts()) {
      if (out.indexOf(item.id) < 0) out.push(item.id);
    }
    if (CUSTOM_ROOT && fs.existsSync(CUSTOM_ROOT)) {
      const disk = fs.readdirSync(CUSTOM_ROOT).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
      for (const id of disk) {
        if (out.indexOf(id) < 0) out.push(id);
      }
    }
    return out;
  }
  const dir = safeJoin(JSON_ROOT, cat);
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
}

function hasMeaningfulDirective(l) {
  if (!l || typeof l !== 'object' || Array.isArray(l)) return false;
  return Boolean(
    l.text || l.zh || l.voice || l.select || l.nextLabel || l.label ||
    l.bg || l.bgEffect || l.bgEffectTime != null ||
    l.fg || l.fgEffect || l.fgEffectTime != null ||
    l.middleFg || l.middleFgEffect || l.middleFgEffectTime != null ||
    l.stillType || l.stillId || l.still || l.stillCtrl || l.stillEffect ||
    l.effectLabel || l.effectTarget || l.effectValue ||
    l.bgm || l.bgmFadeTime != null || l.se || l.movie ||
    l.waitType || l.waitTime != null ||
    l.textFrame || l.frame || l.textCtrl || l.textWait != null || l.autoWaitTime != null ||
    l.charLabel || l.char || l.charId || l.charSpine || l.charType || l.charCategory ||
    l.charPosition || l.charScale != null || l.charEffect ||
    l.charAnim1 || l.charAnim2 || l.charAnim3 || l.charAnim4 || l.charAnim5 ||
    l.charLipAnim || l.lip || l._meta
  );
}

function emptyCfgState() {
  return {
    curBg: '',
    curBgm: '',
    pausedTrack: '',
    bgmPaused: false,
    lastType: Object.create(null),
    lastCat: Object.create(null),
    lastId: Object.create(null),
    lastHair: Object.create(null)
  };
}

function cloneCfgState(st) {
  return {
    curBg: st.curBg,
    curBgm: st.curBgm,
    pausedTrack: st.pausedTrack,
    bgmPaused: st.bgmPaused,
    _orphan: !!st._orphan,
    _bgConflict: !!st._bgConflict,
    _bgmConflict: !!st._bgmConflict,
    lastType: Object.assign(Object.create(null), st.lastType),
    lastCat: Object.assign(Object.create(null), st.lastCat),
    lastId: Object.assign(Object.create(null), st.lastId),
    lastHair: Object.assign(Object.create(null), st.lastHair)
  };
}

/**
 * Lossless + CFG branch-safe + segment-isolated script normalizer.
 * Preserves ALL raw module16375 fields while computing backward-compatible helper fields.
 */
function normalizeScriptLines(rawPart, opts) {
  opts = opts || {};
  if (!Array.isArray(rawPart) || !rawPart.length) return [];
  const segId = String(opts.segId || '');
  const merged = !!opts.merged;
  const prefixLabels = !!opts.prefixLabels && !!segId;

  const items = [];
  for (let idx = 0; idx < rawPart.length; idx++) {
    const raw = rawPart[idx];
    if (!hasMeaningfulDirective(raw)) continue;
    const l = Object.assign({}, raw);
    delete l.__seg;
    if (prefixLabels) {
      const pre = segId + ':';
      if (l.label && String(l.label).indexOf(pre) !== 0) l.label = pre + l.label;
      if (l.nextLabel && String(l.nextLabel).indexOf(pre) !== 0) l.nextLabel = pre + l.nextLabel;
    }
    items.push(l);
  }
  const M = items.length;
  if (!M) return [];

  const labelIdx = Object.create(null);
  for (let i = 0; i < M; i++) {
    const lbl = items[i].label;
    if (lbl && labelIdx[lbl] === undefined) labelIdx[lbl] = i;
  }

  const inState = new Array(M).fill(null);
  const outState = new Array(M).fill(null);
  const normalized = new Array(M).fill(null);
  const isJumpBarrier = new Array(M).fill(false);
  const visited = new Uint8Array(M);

  function evaluateNode(i) {
    const l = items[i];
    const st = cloneCfgState(inState[i] || emptyCfgState());

    // BGM: control tokens ("off" | "fade_out" | "pause" | "resume") emit on THIS line
    // without corrupting outgoing curBgm on subsequent lines.
    let emittedBgm = '';
    if (l.bgm) {
      const b = String(l.bgm);
      emittedBgm = b;
      if (b !== 'pause' && b !== 'resume') st._bgmConflict = false;
      if (b === 'off' || b === 'fade_out') {
        st.curBgm = '';
        st.pausedTrack = '';
        st.bgmPaused = false;
      } else if (b === 'pause') {
        st.bgmPaused = true;
      } else if (b === 'resume') {
        st.bgmPaused = false;
        if (!st.curBgm && st.pausedTrack) st.curBgm = st.pausedTrack;
      } else {
        st.curBgm = b;
        st.pausedTrack = b;
        st.bgmPaused = false;
      }
    } else {
      emittedBgm = st.bgmPaused ? '' : st.curBgm;
    }

    // BG: preserve explicit control on this line; update outgoing curBg cleanly.
    let emittedBg = '';
    if (l.bg) {
      const bgVal = String(l.bg);
      emittedBg = bgVal;
      if (bgVal !== 'on') st._bgConflict = false;
      if (bgVal === 'off' || bgVal === 'fade_out') st.curBg = 'off';
      else if (bgVal !== 'on') st.curBg = bgVal;
    } else {
      emittedBg = st.curBg;
    }

    const t = l.text || '';
    const label = l.charLabel || l.char || '';
    const metaObj = (l._meta && typeof l._meta === 'object') ? l._meta : null;
    const cm = CHAR_MAP[label] || {};
    let charId = '';
    let charType = '';
    let charCategory = '';
    const charHair = '';
    const rawCid = l.charId || l.clothId || '';
    if (label || rawCid || l.charType || l.charCategory) {
      charId = rawCid || (label && st.lastId[label]) || cm.id || '';
      charType = l.charType || (label && st.lastType[label]) || (charId && String(charId).length >= 5 ? 'idols' : 'characters');
      if (charType === 'idols' && String(charId).length < 5) charType = 'characters';
      if (l.charCategory) charCategory = l.charCategory;
      else if (charType === 'sub_characters') charCategory = (label && st.lastCat[label]) || 'stand';
      else charCategory = (label && st.lastCat[label]) || (cm.cat || 'stand').replace(/_(fix|flex)$/, '');
      if (label) {
        if (l.charType) st.lastType[label] = l.charType;
        if (l.charCategory) st.lastCat[label] = l.charCategory;
        if (rawCid) st.lastId[label] = rawCid;
      }
      const rs = resolveSpine(charType, charCategory, charId);
      if (rs) { charType = rs.type; charCategory = rs.cat; }
    }

    const speakerRaw = String(l.speaker || '');
    const speakerName = /^(off|オフ)$/i.test(speakerRaw) ? '' : speakerRaw;
    const selNorm = l.select ? norm(l.select) : '';

    const trimmedText = String(t || '').trim();
    const isParenMono = Boolean(
      label &&
      trimmedText.length >= 2 &&
      ((trimmedText[0] === '（' && trimmedText[trimmedText.length - 1] === '）') ||
       (trimmedText[0] === '(' && trimmedText[trimmedText.length - 1] === ')')) &&
      !/[「」]/.test(trimmedText.slice(1, -1))
    );
    const isMonoLip = Boolean((metaObj && metaObj['x-innerMonologue']) || isParenMono);
    const outLipAnim = isMonoLip
      ? ((!l.charLipAnim || !/_s\d*$|^blank$/.test(String(l.charLipAnim))) ? 'lip_wait_s' : l.charLipAnim)
      : (l.charLipAnim || '');

    // Start with shallow clone of ALL raw fields so module16375 / v2 fields are 100% lossless!
    const out = Object.assign({}, l, {
      speaker: speakerName,
      speakerZh: speakerName ? (NAMES[speakerRaw] || IDOL_NAME_ZH[speakerRaw] || l.speakerZh || (metaObj && metaObj.speakerZh) || speakerName) : '',
      text: t,
      zh: ZH[norm(t)] || ZH_DYNAMIC[norm(t)] || l.zh || (metaObj && metaObj.zh) || '',
      voice: l.voice || '',
      bg: emittedBg,
      bgm: emittedBgm,
      char: label,
      seg: merged ? segId : '',
      charId: charId,
      charType: charType,
      charCategory: charCategory,
      charHair: charHair,
      charPosition: l.charPosition || null,
      charScale: l.charScale === undefined ? null : l.charScale,
      charEffect: l.charEffect || null,
      charAnim1: l.charAnim1 || '',
      charAnim2: l.charAnim2 || '',
      charAnim3: l.charAnim3 || '',
      charAnim4: l.charAnim4 || '',
      charAnim5: l.charAnim5 || '',
      charAnim1Loop: l.charAnim1Loop === undefined ? null : !!l.charAnim1Loop,
      charAnim2Loop: l.charAnim2Loop === undefined ? null : !!l.charAnim2Loop,
      charAnim3Loop: l.charAnim3Loop === undefined ? null : !!l.charAnim3Loop,
      charAnim4Loop: l.charAnim4Loop === undefined ? null : !!l.charAnim4Loop,
      charAnim5Loop: l.charAnim5Loop === undefined ? null : !!l.charAnim5Loop,
      charLipAnim: outLipAnim,
      lipAnimDuration: l.lipAnimDuration || 0,
      frame: l.textFrame !== undefined ? (l.textFrame || '') : (l.frame || ''),
      stillType: l.stillType || '',
      stillId: l.stillId || '',
      stillCtrl: l.stillCtrl || '',
      select: l.select || '',
      selectZh: l.selectZh || (metaObj && metaObj.selectZh) || (selNorm ? (ZH[selNorm] || ZH_DYNAMIC[selNorm] || SELECT_ZH_FALLBACK[selNorm] || '') : ''),
      nextLabel: l.nextLabel || '',
      label: l.label || '',
      se: l.se || '',
      waitType: l.waitType || '',
      waitTime: l.waitTime || 0,
      effectTime: (l.effectValue && l.effectValue.time) || l.effectTime || 0,
      dur: DUR.get(String(l.id || '')) || l.dur || 0
    });
    if (l.movie) out.unsupportedMovie = true;
    if (merged && i === 0) out.segStart = true;

    normalized[i] = out;
    outState[i] = st;
  }

  // Propagate state along per-segment Control Flow Graph (CFG)
  const queue = [];
  function enqueue(idx, st) {
    if (idx < 0 || idx >= M) return;
    if (!inState[idx]) {
      inState[idx] = cloneCfgState(st);
    } else {
      if (st && st._orphan) return;
      const ex = inState[idx];
      let changed = false;
      if (!ex._bgConflict && (st._bgConflict || (ex.curBg && st.curBg && ex.curBg !== st.curBg))) {
        ex.curBg = '';
        ex._bgConflict = true;
        changed = true;
      }
      if (!ex._bgmConflict && (st._bgmConflict || ex.curBgm !== st.curBgm || ex.pausedTrack !== st.pausedTrack || ex.bgmPaused !== st.bgmPaused)) {
        ex.curBgm = '';
        ex.pausedTrack = '';
        ex.bgmPaused = false;
        ex._bgmConflict = true;
        changed = true;
      }
      if (changed && visited[idx]) {
        visited[idx] = 0;
        if (!queue.includes(idx)) queue.push(idx);
        return;
      }
    }
    if (!visited[idx]) {
      visited[idx] = 1;
      queue.push(idx);
    }
  }

  enqueue(0, emptyCfgState());
  for (let startScan = 0; startScan < M; startScan++) {
    while (queue.length > 0) {
      // Pop smallest index first so linear prefixes resolve before forward merge labels
      let bestPos = 0;
      for (let q = 1; q < queue.length; q++) {
        if (queue[q] < queue[bestPos]) bestPos = q;
      }
      const cur = queue.splice(bestPos, 1)[0];
      const l = items[cur];

      // Consecutive `select` tracks form one choice menu sharing pre-choice state
      if (l.select) {
        const baseSt = cloneCfgState(inState[cur] || emptyCfgState());
        let endSel = cur;
        while (endSel + 1 < M && items[endSel + 1].select) endSel++;
        for (let s = cur; s <= endSel; s++) {
          if (!inState[s]) inState[s] = cloneCfgState(baseSt);
          visited[s] = 1;
          evaluateNode(s);
          isJumpBarrier[s] = true;
          const nl = items[s].nextLabel;
          if (nl && labelIdx[nl] !== undefined) {
            enqueue(labelIdx[nl], outState[s]);
          } else if (!nl && endSel + 1 < M) {
            enqueue(endSel + 1, outState[s]);
          }
        }
        continue;
      }

      evaluateNode(cur);

      if (l.nextLabel && labelIdx[l.nextLabel] !== undefined) {
        isJumpBarrier[cur] = true;
        enqueue(labelIdx[l.nextLabel], outState[cur]);
      } else if (cur + 1 < M) {
        enqueue(cur + 1, outState[cur]);
      }
    }

    if (!visited[startScan]) {
      const fallback = (startScan > 0 && outState[startScan - 1] && !isJumpBarrier[startScan - 1])
        ? cloneCfgState(outState[startScan - 1])
        : emptyCfgState();
      fallback._orphan = true;
      enqueue(startScan, fallback);
    }
  }

  return normalized.filter(Boolean);
}

function loadScript(cat, id, idList) {
  if (cat === 'scsp') {
    const scspStory = SCSP_STORY_BY_ID.get(id) || SCSP_STORY_BY_ID.get('scsp_' + id);
    if (!scspStory || !Array.isArray(scspStory.lines) || !scspStory.lines.length) return null;
    const rawLines = scspStory.lines.map((ln) => {
      const copy = Object.assign({}, ln);
      if (copy.cue && copy.scspWavRel && resolveScspWavFile(copy.scspWavRel)) {
        copy.voice = 'scsp/' + copy.cue;
      }
      if (copy.charId && !copy.charType) copy.charType = 'characters';
      if (copy.charId && !copy.charCategory) copy.charCategory = 'stand';
      return copy;
    });
    const normLines = normalizeScriptLines(rawLines, {
      cat: 'scsp',
      segId: scspStory.id,
      merged: false,
      prefixLabels: false
    });
    if (!normLines.length) return null;
    let txtN = 0, zhN = 0;
    normLines.forEach((l) => { if (l.text) { txtN++; if (l.zh) zhN++; } });
    const zhPct = txtN ? Math.round(zhN / txtN * 100) : 100;
    return {
      lines: normLines,
      title: scspStory.title,
      titleJa: scspStory.titleJa || scspStory.title,
      merged: false,
      segments: [scspStory.id],
      zhPct
    };
  }

  const isCustom = cat === 'custom';
  let files = [];
  if (isCustom) {
    const file = resolveBuiltinCustomFile(id);
    if (!file || !fs.existsSync(file)) return null;
    files = [{ id, file }];
  } else if (Array.isArray(idList) && idList.length) {
    files = idList.map((x) => ({ id: x, file: safeJoin(JSON_ROOT, path.join(cat, x + '.json')) }));
  } else {
    const exact = safeJoin(JSON_ROOT, path.join(cat, id + '.json'));
    if (exact && fs.existsSync(exact)) {
      files = [{ id, file: exact }];
    } else {
      const all = listScripts(cat);
      // 合并章节必须按「完整 chapter」匹配：id 去尾 2 位 === chapter。
      // 仅用 indexOf 会把 200100100 和更长的 2001001001/2/3 一起吞进来。
      let ids = all.filter((x) => x.slice(0, -2) === id);
      if (!ids.length) ids = all.filter((x) => x.indexOf(id) === 0);
      if (!ids.length) return null;
      files = ids.map((x) => ({ id: x, file: safeJoin(JSON_ROOT, path.join(cat, x + '.json')) }));
    }
  }

  const lines = [];
  const validSegments = [];
  const isMultiSeg = files.length > 1;
  for (const f of files) {
    if (!f.file || !fs.existsSync(f.file)) continue;
    let part;
    try { part = readScriptFileLines(f.file); } catch (e) { continue; }
    if (!Array.isArray(part)) continue;
    const segLines = normalizeScriptLines(part, {
      cat,
      segId: f.id,
      merged: isMultiSeg,
      prefixLabels: !isCustom
    });
    if (!segLines.length) continue;
    validSegments.push(f.id);
    for (let i = 0; i < segLines.length; i++) lines.push(segLines[i]);
  }
  if (!lines.length) return null;

  let title = GROUP_TITLES[cat + '/' + id] || '';
  if (!title) {
    for (const f of files) {
      if (STORY_TITLES[f.id]) { title = STORY_TITLES[f.id].title; break; }
    }
  }
  if (!title && /_promises$/.test(cat)) title = '约定';
  if (!title) {
    const ft = lines.find((x) => x.text);
    title = ft ? ft.text.replace(/\s+/g, ' ').slice(0, 24) : '';
  }
  let txtN = 0, zhN = 0;
  lines.forEach((l) => { if (l.text) { txtN++; if (l.zh) zhN++; } });
  const zhPct = txtN ? Math.round(zhN / txtN * 100) : 100;
  return { lines, title, merged: validSegments.length > 1, segments: validSegments, zhPct };
}

function serveFile(req, res, file, type, noStore) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const stat = fs.statSync(file);
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (start >= stat.size) { res.writeHead(416); res.end(); return; }
    end = Math.min(end, stat.size - 1);
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1
    });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes' };
    if (noStore || type.indexOf('text/html') === 0) headers['Cache-Control'] = 'no-store';
    if (stat.size > GZIP_MIN && isCompressible(type) && acceptsGzip(req)) {
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
      res.writeHead(200, headers);
      const gz = zlib.createGzip({ level: 6 });
      const src = fs.createReadStream(file);
      src.on('error', () => { try { res.destroy(); } catch (e) {} });
      gz.on('error', () => { try { res.destroy(); } catch (e) {} });
      src.pipe(gz).pipe(res);
      return;
    }
    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  }
}

function mimeOf(p) {
  const e = path.extname(p).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8',
    '.m4a': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.json': 'application/json; charset=utf-8',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.js': 'application/javascript; charset=utf-8',
    '.atlas': 'text/plain; charset=utf-8'
  }[e] || 'application/octet-stream';
}

function deriveSafeImportId(rawCandidate) {
  const stripped = stripScriptExt(path.basename(String(rawCandidate || '').trim()));
  let cleaned = stripped
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
  if (!cleaned || !/^[A-Za-z0-9]/.test(cleaned)) {
    cleaned = 'imp_' + Date.now().toString(36) + (cleaned ? '_' + cleaned : '');
  }
  cleaned = cleaned.slice(0, 64).replace(/[_-]+$/g, '');
  if (!SCRIPT_ID_RE.test(cleaned)) {
    cleaned = 'imp_' + Date.now().toString(36);
  }
  return cleaned;
}

function isPackOwnedStoryId(id) {
  if (BUILTIN_DEF_BY_ID.has(id)) return true;
  for (const pk of listScpackDirs()) {
    const declared = Array.isArray(pk.packMeta.stories)
      ? pk.packMeta.stories.some((s) => s && String(s.id) === id)
      : false;
    if (declared) return true;
    for (const ext of ['.scproj.json', '.json']) {
      const fp = safeJoin(path.join(pk.packDir, 'stories'), id + ext);
      if (fp && fs.existsSync(fp)) return true;
    }
  }
  return false;
}

function isScsShorthandDoc(doc, isYamlHint) {
  if (!doc || typeof doc !== 'object') return false;
  if (Array.isArray(doc)) {
    return doc.some((x) => typeof x === 'string' || (x && typeof x === 'object' && ('say' in x || 'choices' in x || 'enter' in x || 'exit' in x)));
  }
  if (doc.scs || /^scs\b/i.test(String(doc.format || ''))) return true;
  if (Array.isArray(doc.script) && !Array.isArray(doc.lines)) return true;
  if (Array.isArray(doc.lines)) {
    if (isYamlHint && !/^scproj/i.test(String(doc.format || ''))) return true;
    return doc.lines.some((x) => typeof x === 'string' || (x && typeof x === 'object' && ('say' in x || 'choices' in x || 'enter' in x || 'exit' in x)));
  }
  return false;
}

function compileAndSaveImport(data) {
  if (!data || typeof data !== 'object') {
    const err = new Error('JSON object body required');
    err.status = 400;
    throw err;
  }
  if (data.content === undefined || data.content === null || data.content === '') {
    const err = new Error('content is required');
    err.status = 400;
    throw err;
  }

  const rawFilename = String(data.filename || '').trim();
  const isYamlHint = /\.(ya?ml)$/i.test(rawFilename);
  let parsed = null;
  let isScsYaml = false;

  if (typeof data.content === 'object') {
    parsed = data.content;
    isScsYaml = isScsShorthandDoc(parsed, isYamlHint);
  } else if (typeof data.content === 'string') {
    const text = data.content.replace(/^\uFEFF/, '');
    if (!text.trim()) {
      const err = new Error('content is empty');
      err.status = 400;
      throw err;
    }
    if (isYamlHint) {
      try {
        parsed = getJsYaml().load(text);
      } catch (e) {
        const err = new Error('YAML parse error: ' + e.message);
        err.status = 400;
        throw err;
      }
    } else {
      try {
        parsed = JSON.parse(text);
      } catch (jsonErr) {
        try {
          parsed = getJsYaml().load(text);
        } catch (yamlErr) {
          const err = new Error('Invalid JSON/YAML content: ' + jsonErr.message);
          err.status = 400;
          throw err;
        }
      }
    }
    isScsYaml = isScsShorthandDoc(parsed, isYamlHint);
  } else {
    const err = new Error('content must be a JSON/YAML string, object, or array');
    err.status = 400;
    throw err;
  }

  const explicitId = String(data.id || '').trim();
  const docIdHint = (!Array.isArray(parsed) && parsed && typeof parsed === 'object')
    ? String((parsed.meta && parsed.meta.id) || (parsed._meta && parsed._meta.id) || parsed.id || '').trim()
    : '';
  let resolvedId = deriveSafeImportId(explicitId || rawFilename || docIdHint || data.title || '');
  if (!explicitId && isPackOwnedStoryId(resolvedId)) {
    const existingUserCopy = safeJoin(USER_IMPORTS_DIR, resolvedId + '.scproj.json');
    if (!existingUserCopy || !fs.existsSync(existingUserCopy)) {
      resolvedId = deriveSafeImportId(resolvedId.slice(0, 56) + '_imp');
    }
  }

  let rawLines = null;
  let extractedMeta = {};
  if (isScsYaml) {
    try {
      let scsInput = parsed;
      if (!Array.isArray(parsed) && parsed && Array.isArray(parsed.script) && !Array.isArray(parsed.lines)) {
        scsInput = Object.assign({}, parsed, { lines: parsed.script });
      }
      const compiled = getScsRef().compile(scsInput, { charMap: CHAR_MAP, id: resolvedId });
      rawLines = compiled.lines;
      extractedMeta = Object.assign(
        {},
        (!Array.isArray(parsed) && parsed && parsed.meta) || {},
        compiled.meta || {},
        compiled._meta || {}
      );
    } catch (e) {
      const err = new Error('SCS YAML compile failed: ' + e.message);
      err.status = 400;
      throw err;
    }
  } else if (Array.isArray(parsed)) {
    rawLines = parsed;
    if (parsed[0] && parsed[0]._meta && typeof parsed[0]._meta === 'object') {
      extractedMeta = Object.assign({}, parsed[0]._meta);
    }
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.lines)) {
    rawLines = parsed.lines;
    extractedMeta = Object.assign({}, parsed._meta || {}, parsed.meta || {});
  } else {
    const err = new Error('Unsupported script format: expected .scproj.json, official .json array, or .scs.yaml');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    const err = new Error('Script lines must be a non-empty array');
    err.status = 400;
    throw err;
  }
  if (rawLines.length > 5000) {
    const err = new Error('Too many lines (max 5000)');
    err.status = 400;
    throw err;
  }

  const cleanLines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i];
    if (!l || typeof l !== 'object' || Array.isArray(l)) {
      const err = new Error('Line at index ' + i + ' is not an object');
      err.status = 400;
      throw err;
    }
    const s = JSON.stringify(l);
    if (s.length > 512 * 1024) {
      const err = new Error('Line at index ' + i + ' exceeds size limit');
      err.status = 400;
      throw err;
    }
    cleanLines.push(JSON.parse(s));
  }

  const defaultTitleFromFile = stripScriptExt(path.basename(rawFilename));
  const resolvedTitle = String(
    data.title ||
    extractedMeta.titleZh ||
    extractedMeta.title ||
    defaultTitleFromFile ||
    resolvedId
  ).trim() || resolvedId;
  const resolvedUnit = normalizeUnitName(data.unit || extractedMeta.unit || '');

  const outFile = safeJoin(USER_IMPORTS_DIR, resolvedId + '.scproj.json');
  if (!outFile) {
    const err = new Error('Invalid target import path');
    err.status = 400;
    throw err;
  }

  const savedDoc = {
    format: 'scproj-script',
    version: '1.0',
    meta: Object.assign({}, extractedMeta, {
      id: resolvedId,
      title: resolvedTitle,
      titleZh: resolvedTitle,
      unit: resolvedUnit || extractedMeta.unit || '',
      sourceFilename: rawFilename || (resolvedId + '.scproj.json'),
      importedAt: new Date().toISOString()
    }),
    lines: cleanLines
  };

  fs.mkdirSync(USER_IMPORTS_DIR, { recursive: true });
  const tmpFile = path.join(USER_IMPORTS_DIR, '.' + resolvedId + '.' + process.pid + '.' + Date.now() + '.tmp');
  fs.writeFileSync(tmpFile, JSON.stringify(savedDoc, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpFile, outFile);

  // If an older plain .json with the same id existed in user_imports, remove it so .scproj.json is authoritative
  const legacyJson = safeJoin(USER_IMPORTS_DIR, resolvedId + '.json');
  if (legacyJson && legacyJson !== outFile && fs.existsSync(legacyJson)) {
    try { fs.unlinkSync(legacyJson); } catch (e) {}
  }

  loadCatalogFile();
  const indexed = CUSTOM_SCRIPT_INDEX.get(resolvedId);
  return {
    ok: true,
    id: resolvedId,
    cat: 'custom',
    title: indexed ? indexed.title : resolvedTitle,
    unit: indexed ? indexed.unit : (resolvedUnit || '其他'),
    lineCount: cleanLines.length,
    deletable: true,
    url: '/?cat=custom&id=' + encodeURIComponent(resolvedId)
  };
}

function checkEnzaWriteAuth(req, res) {
  const expected = String(process.env.STUDIO_ACCESS_TOKEN || '').trim();
  if (!expected) return true;
  const hdrs = (req && req.headers) || {};
  let supplied = String(hdrs['x-studio-token'] || '').trim();
  if (!supplied && /^Bearer\s+/i.test(String(hdrs.authorization || ''))) {
    supplied = String(hdrs.authorization).replace(/^Bearer\s+/i, '').trim();
  }
  if (!supplied && hdrs.cookie) {
    for (const part of String(hdrs.cookie).split(';')) {
      const idx = part.indexOf('=');
      if (idx > 0 && part.slice(0, idx).trim() === 'sc_studio_token') {
        try { supplied = decodeURIComponent(part.slice(idx + 1).trim()); } catch (_) { supplied = part.slice(idx + 1).trim(); }
        break;
      }
    }
  }
  const ba = Buffer.from(supplied, 'utf8');
  const bb = Buffer.from(expected, 'utf8');
  if (ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb)) return true;
  sendJson(res, 401, { ok: false, authRequired: true, error: '公网试用模式：写入服务器需要访问口令' });
  return false;
}

const server = http.createServer((req, res) => {
  const origin = req.headers && req.headers.origin;
  if (origin && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Studio-Token');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const u = url.parse(req.url, true);
  const p = decodeURIComponent(u.pathname);
  try {
    if (p === '/' || p === '/index.html') { return serveFile(req, res, PLAYER, 'text/html; charset=utf-8'); }

    // ---------- UI 视觉样稿静态预览 (/ui-mockups & /ui-mockups/*) ----------
    if (p === '/ui-mockups') {
      const idxFile = path.join(UI_MOCKUPS_DIR, 'index.html');
      if (fs.existsSync(idxFile)) {
        const html = fs.readFileSync(idxFile, 'utf8').replace(/<head([^>]*)>/i, '<head$1><base href="/ui-mockups/">');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        return res.end(req.method === 'HEAD' ? undefined : html);
      }
      return serveFile(req, res, idxFile, 'text/html; charset=utf-8', true);
    }
    if (p === '/ui-mockups/') {
      return serveFile(req, res, path.join(UI_MOCKUPS_DIR, 'index.html'), 'text/html; charset=utf-8', true);
    }
    if (p.startsWith('/ui-mockups/')) {
      const rel = p.slice('/ui-mockups/'.length);
      let file = safeJoin(UI_MOCKUPS_DIR, rel);
      if (!file) { res.writeHead(400); return res.end('bad path'); }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.html');
      }
      return serveFile(req, res, file, mimeOf(file), true);
    }

    // ---------- 导入剧本 / 二创工程管理 API ----------
    if (p === '/api/imported-scripts') {
      if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET required' });
      const items = scanAllCustomScripts().map((it) => {
        const copy = Object.assign({}, it);
        delete copy.file;
        return copy;
      });
      return sendJson(res, 200, { ok: true, total: items.length, items: items });
    }
    if (p.startsWith('/api/imported-scripts/')) {
      if (req.method !== 'DELETE') return sendJson(res, 405, { ok: false, error: 'DELETE required' });
      if (!checkEnzaWriteAuth(req, res)) return;
      const id = p.slice('/api/imported-scripts/'.length).trim();
      if (!SCRIPT_ID_RE.test(id)) return sendJson(res, 400, { ok: false, error: 'invalid id' });
      const candidates = [
        safeJoin(USER_IMPORTS_DIR, id + '.scproj.json'),
        safeJoin(USER_IMPORTS_DIR, id + '.json')
      ].filter((f) => f && fs.existsSync(f));
      if (!candidates.length) {
        if (resolveBuiltinCustomFile(id)) {
          return sendJson(res, 403, { ok: false, error: 'built-in or .scpack scripts are read-only', id: id });
        }
        return sendJson(res, 404, { ok: false, error: 'imported script not found', id: id });
      }
      for (const f of candidates) {
        try { fs.unlinkSync(f); } catch (e) {
          return sendJson(res, 500, { ok: false, error: 'delete failed', detail: e.message });
        }
      }
      delete STORY_TITLES[id];
      delete GROUP_TITLES['custom/' + id];
      delete STORY_DATES['custom/' + id];
      loadCatalogFile();
      return sendJson(res, 200, { ok: true, id: id });
    }
    if (p === '/api/import-script') {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST required' });
      if (!checkEnzaWriteAuth(req, res)) return;
      readBody(req, 16 * 1024 * 1024).then((raw) => {
        let data;
        try { data = JSON.parse(raw); } catch (e) {
          return sendJson(res, 400, { ok: false, error: 'invalid json', detail: e.message });
        }
        try {
          const result = compileAndSaveImport(data);
          return sendJson(res, 200, result);
        } catch (err) {
          const code = (err && err.status) || 500;
          return sendJson(res, code, { ok: false, error: (err && err.message) || String(err) });
        }
      }).catch((e) => {
        try { sendJson(res, 400, { ok: false, error: 'bad request', detail: e.message }); } catch (e2) {}
      });
      return;
    }

    // ---------- 桌面壳版本健康检查 + 外部资源挂载 API + SCSP 棱镜故事库 ----------
    if (p === '/api/app/version') {
      return sendJson(res, 200, {
        name: 'enza-player',
        version: process.env.ENZA_APP_VERSION || '0.2.0',
        channel: process.env.ENZA_CHANNEL || 'stable',
        resources: 'external',
        build: SERVER_BUILD
      });
    }
    if (p === '/api/mount-status') {
      if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET required' });
      return sendJson(res, 200, getMountStatus());
    }
    if (p === '/api/dicts/reload') {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST required' });
      reloadExternalDictionaries(false, { skipVoice: !u.query.full });
      return sendJson(res, 200, getMountStatus());
    }
    if (p === '/api/mount-config') {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST required' });
      if (!checkEnzaWriteAuth(req, res)) return;
      readBody(req, 64 * 1024).then((raw) => {
        let data;
        try { data = JSON.parse(raw || '{}'); } catch (e) {
          return sendJson(res, 400, { ok: false, error: 'invalid json', detail: e.message });
        }
        const hasEnzaField = Object.prototype.hasOwnProperty.call(data, 'enzaRoot');
        const hasScspField = Object.prototype.hasOwnProperty.call(data, 'scspRoot');
        const nextEnza = hasEnzaField ? String(data.enzaRoot == null ? '' : data.enzaRoot).trim() : DATA_ROOT;
        let nextScsp = hasScspField ? String(data.scspRoot == null ? '' : data.scspRoot).trim() : SCSP_ROOT;
        const allowUnmounted = Boolean(data.allowUnmounted);
        const warnings = [];

        if (nextEnza && !allowUnmounted) {
          const absEnza = path.resolve(nextEnza);
          if (!fs.existsSync(absEnza) || !fs.statSync(absEnza).isDirectory()) {
            return sendJson(res, 400, {
              ok: false,
              error: 'enza 资源目录不存在或不是有效文件夹: ' + absEnza,
              detail: 'enza 是核心目录（官方剧本/立绘/语音与汉化词典都在里面）。路径写错时可以留空后点保存，或先选对目录。'
            });
          }
        }
        // SCSP 只是可选的棱镜语料目录：目录缺失不应让整次挂载保存失败。
        // 旧行为会直接 400，用户看到「挂载失败：SCSP 资源目录不存在…」，连 enza 的保存
        // 和词典重载都被一起取消——这正是「加了个空文件夹才有中文」的真正原因。
        if (nextScsp && !allowUnmounted) {
          const absScsp = path.resolve(nextScsp);
          if (!fs.existsSync(absScsp) || !fs.statSync(absScsp).isDirectory()) {
            warnings.push('SCSP 目录不存在或不是文件夹，已跳过 SCSP 挂载（不影响官方剧本与汉化）: ' + absScsp);
            nextScsp = '';
          }
        }

        const persist = data.persist !== false;
        if (persist) {
          try {
            fs.mkdirSync(path.dirname(MOUNT_CONFIG_PATH), { recursive: true });
            const cfgPayload = {
              enzaRoot: nextEnza ? path.resolve(nextEnza) : '',
              scspRoot: nextScsp ? path.resolve(nextScsp) : '',
              updatedAt: new Date().toISOString()
            };
            fs.writeFileSync(MOUNT_CONFIG_PATH, JSON.stringify(cfgPayload, null, 2) + '\n', 'utf8');
            if (nextEnza && fs.existsSync(path.dirname(DESKTOP_DATA_PATH_TXT))) {
              fs.writeFileSync(
                DESKTOP_DATA_PATH_TXT,
                '# 闪耀色彩播放器外部资源目录 (每行首条非注释路径生效，切勿将重资源打入发行包)\n' +
                  path.resolve(nextEnza) + '\n',
                'utf8'
              );
            }
          } catch (err) {
            return sendJson(res, 500, { ok: false, error: '保存挂载配置失败: ' + err.message });
          }
        }

        const status = applyMountRoots(
          nextEnza,
          nextScsp,
          persist ? 'mount-config.json' : 'memory',
          false
        );
        status.warnings = warnings;
        return sendJson(res, 200, status);
      }).catch((e) => {
        try { sendJson(res, 400, { ok: false, error: 'bad request', detail: e.message }); } catch (e2) {}
      });
      return;
    }
    if (p === '/api/scsp/stories') {
      if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET required' });
      return sendJson(res, 200, getScspStories(u.query));
    }
    if (p === '/api/idol-outfits') {
      return sendJson(res, 200, IDOL_OUTFITS);
    }

    // ---------- 舞台录制视频无损/高速封装标准 faststart MP4（解决拖动进度条问题） ----------
    if (p === '/api/video-remux/status') {
      const bin = resolveFfmpegBin();
      return sendJson(res, 200, { available: Boolean(bin), bin: bin || '' });
    }
    if (p === '/api/video-remux') {
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST required' });
      const ffmpegBin = resolveFfmpegBin();
      if (!ffmpegBin) {
        req.resume();
        return sendJson(res, 503, { ok: false, error: 'ffmpeg_not_found' });
      }
      const mime = String(u.query.mime || '').toLowerCase();
      const inExt = mime.indexOf('mp4') >= 0 ? '.mp4' : '.webm';
      const tmpDir = getRecTmpDir();
      const stamp = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const inFile = path.join(tmpDir, 'in_' + stamp + inExt);
      const outFile = path.join(tmpDir, 'out_' + stamp + '.mp4');
      const cleanup = () => {
        try { if (fs.existsSync(inFile)) fs.unlinkSync(inFile); } catch (_) {}
        try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch (_) {}
      };
      const ws = fs.createWriteStream(inFile);
      let aborted = false;
      req.on('aborted', () => {
        aborted = true;
        try { ws.destroy(); } catch (_) {}
        cleanup();
      });
      ws.on('error', (err) => {
        cleanup();
        if (!res.headersSent) sendJson(res, 500, { ok: false, error: err.message });
      });
      req.pipe(ws);
      ws.on('finish', () => {
        if (aborted) return cleanup();
        // 浏览器 MediaRecorder 直出常缺少周期性关键帧（stss 可能只有第 0 帧 1 个关键帧）且时间轴为流式碎片；
        // 自动按可用编码器（libx264 / h264_amf / h264_nvenc / h264_qsv / h264_mf / libopenh264 / copy）+ faststart 封装，确保全平台毫秒级拖动进度条。
        const fps = Math.max(15, Math.min(60, parseInt((u.query && u.query.fps) || '60', 10) || 60));
        const keyintMin = Math.max(15, Math.floor(fps / 2));
        const plans = getVideoRemuxEncoderPlans(fps, keyintMin, inExt);
        let lastErr = '';
        function tryPlan(planIdx) {
          if (aborted) return cleanup();
          if (planIdx >= plans.length) {
            cleanup();
            if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'ffmpeg_failed', detail: lastErr.slice(-500) });
            return;
          }
          try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch (_) {}
          const args = [
            '-y', '-fflags', '+genpts', '-i', inFile,
            ...plans[planIdx],
            '-c:a', 'aac', '-b:a', '192k',
            '-movflags', '+faststart', '-avoid_negative_ts', 'make_zero', outFile
          ];
          const ff = spawn(ffmpegBin, args, { windowsHide: true });
          let errText = '';
          ff.stderr.on('data', (d) => { if (errText.length < 4096) errText += String(d); });
          ff.on('error', (err) => {
            lastErr = err && err.message ? err.message : String(err);
            tryPlan(planIdx + 1);
          });
          ff.on('close', (code) => {
            if (code !== 0 || !fs.existsSync(outFile) || fs.statSync(outFile).size < 1024) {
              lastErr = errText || ('exit_' + code);
              tryPlan(planIdx + 1);
              return;
            }
            try {
              const rawName = (u.query && u.query.name) ? String(u.query.name).trim() : '';
              const safeName = rawName.replace(/[^A-Za-z0-9_\-\u4e00-\u9fa5]/g, '_').slice(0, 80);
              if (safeName) {
                const outDir = path.join(SHINYCOLORS_ROOT, 'output', 'videos');
                fs.mkdirSync(outDir, { recursive: true });
                fs.copyFileSync(outFile, path.join(outDir, safeName + '.mp4'));
              }
            } catch (_) {}
            streamOutMp4();
          });
        }
        tryPlan(0);
        function streamOutMp4() {
          try {
            const st = fs.statSync(outFile);
            res.writeHead(200, {
              'Content-Type': 'video/mp4',
              'Content-Length': st.size,
              'Cache-Control': 'no-store'
            });
            const rs = fs.createReadStream(outFile);
            rs.on('close', cleanup);
            rs.on('error', cleanup);
            rs.pipe(res);
          } catch (e) {
            cleanup();
            if (!res.headersSent) sendJson(res, 500, { ok: false, error: e.message });
          }
        }
      });
      return;
    }

    // ---------- Swarm 实时进度监控面板 (/progress & /api/progress) ----------
    if (p === '/progress' || p === '/progress/') {
      return serveFile(req, res, DASHBOARD_HTML, 'text/html; charset=utf-8', true);
    }
    if (p === '/api/progress') {
      return sendJson(res, 200, buildProgressPayload());
    }

    // ---------- 剧本时间轴编辑器（独立页面，不影响播放器） ----------
    if (p === '/editor' || p === '/editor/') {
      return serveFile(req, res, EDITOR_HTML, 'text/html; charset=utf-8', true);
    }
    if (p === '/editor.css') {
      return serveFile(req, res, EDITOR_CSS, 'text/css; charset=utf-8', true);
    }
    if (p === '/editor.js') {
      return serveFile(req, res, EDITOR_JS, 'application/javascript; charset=utf-8', true);
    }
    if (p === '/api/char-map') {
      if (u.query.main === '1') {
        const out = {};
        MAIN_IDOL_LABELS.forEach(function (label) {
          if (CHAR_MAP[label]) out[label] = CHAR_MAP[label];
        });
        return sendJson(res, 200, out);
      }
      return sendJson(res, 200, CHAR_MAP);
    }
    if (p === '/api/animations') {
      const label = String(u.query.label || '').trim();
      if (!label) return sendJson(res, 400, { error: 'label required' });
      const rec = (ANIM_WHITELIST.by_label || {})[label];
      if (!rec) return sendJson(res, 404, { error: 'unknown label', label });
      const anims = (ANIM_WHITELIST.packs || {})[rec.key] || [];
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, max-age=300'
      });
      return res.end(JSON.stringify(anims));
    }
    if (p === '/api/custom-raw') {
      const id = String(u.query.id || '').trim();
      if (!SCRIPT_ID_RE.test(id)) return sendJson(res, 400, { error: 'invalid id' });
      const file = resolveBuiltinCustomFile(id);
      if (!file || !fs.existsSync(file)) return sendJson(res, 404, { error: 'script not found', id });
      let lines;
      try { lines = readScriptFileLines(file); } catch (e) {
        return sendJson(res, 500, { error: 'bad json', detail: e.message });
      }
      if (!Array.isArray(lines)) return sendJson(res, 500, { error: 'script is not an array' });
      const st = fs.statSync(file);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ id, lines, bytes: st.size, mtime: st.mtimeMs }));
    }
    if (p === '/api/save-custom') {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST required' });
      if (!checkEnzaWriteAuth(req, res)) return;
      readBody(req, 8 * 1024 * 1024).then((raw) => {
        let data;
        try { data = JSON.parse(raw); } catch (e) { return sendJson(res, 400, { error: 'invalid json', detail: e.message }); }
        const id = String((data && data.id) || '').trim();
        if (!SCRIPT_ID_RE.test(id)) {
          return sendJson(res, 400, { error: 'invalid id', detail: 'allow A-Z a-z 0-9 _ - (1..64 chars, no path separators)' });
        }
        const lines = data && data.lines;
        if (!Array.isArray(lines) || lines.length === 0) return sendJson(res, 400, { error: 'lines must be a non-empty array' });
        if (lines.length > 3000) return sendJson(res, 400, { error: 'too many lines', max: 3000 });
        const clean = [];
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (!l || typeof l !== 'object' || Array.isArray(l)) {
            return sendJson(res, 400, { error: 'line is not an object', index: i });
          }
          let clone;
          try {
            const s = JSON.stringify(l);
            if (s.length > 512 * 1024) return sendJson(res, 400, { error: 'line too large', index: i });
            clone = JSON.parse(s);
          } catch (e) {
            return sendJson(res, 400, { error: 'line is not json-serializable', index: i });
          }
          clean.push(clone);
        }
        const file = safeJoin(USER_IMPORTS_DIR, id + '.json');
        if (!file) return sendJson(res, 400, { error: 'bad path' });
        try {
          fs.mkdirSync(USER_IMPORTS_DIR, { recursive: true });
          const tmp = path.join(USER_IMPORTS_DIR, '.' + id + '.' + process.pid + '.' + Date.now() + '.tmp');
          fs.writeFileSync(tmp, JSON.stringify(clean, null, 2) + '\n', 'utf8');
          fs.renameSync(tmp, file);
          loadCatalogFile();
        } catch (e) {
          return sendJson(res, 500, { error: 'write failed', detail: e.message });
        }
        return sendJson(res, 200, {
          ok: true,
          id,
          count: clean.length,
          file,
          url: 'http://127.0.0.1:' + PORT + '/?cat=custom&id=' + encodeURIComponent(id)
        });
      }).catch((e) => {
        try { sendJson(res, 400, { error: 'bad request', detail: e.message }); } catch (e2) {}
      });
      return;
    }

    if (p === '/api/catalog') {
      if (CATALOG_ERROR) return sendJson(res, 503, { error: 'catalog unavailable', detail: CATALOG_ERROR });
      const f = catalogFilter(u.query);
      const limit = catalogInt(u.query.limit, 100, 1, 500);
      const offset = catalogInt(u.query.offset, 0, 0, 1000000);
      const items = [];
      let total = 0;
      for (const s of CATALOG_STORIES) {
        if (f.type && s.type !== f.type) continue;
        if (f.cat && s.cat !== f.cat) continue;
        if (f.units.length && f.units.indexOf(fold(s.unit)) < 0) continue;
        if (f.q && s._q.indexOf(f.q) < 0) continue;
        if (total >= offset && items.length < limit) items.push(storyLite(s));
        total++;
      }
      return sendJson(res, 200, { total: total, limit: limit, offset: offset, items: items });
    }

    if (p === '/api/catalog/chapters') {
      if (CATALOG_ERROR) return sendJson(res, 503, { error: 'catalog unavailable', detail: CATALOG_ERROR });
      const f = catalogFilter(u.query);
      const matched = [];
      let totalStories = 0, totalParts = 0, totalLines = 0;
      for (const g of CATALOG_GROUPS) {
        if (f.type && g.type !== f.type) continue;
        if (f.cat && g.cat !== f.cat) continue;
        if (f.units.length && f.units.indexOf(fold(g.unit)) < 0) continue;
        if (f.q && g._q.indexOf(f.q) < 0) continue;
        matched.push(g);
        totalStories += g.parts.length;
        totalParts += g.parts.length;
        totalLines += g.lines || 0;
      }
      // 不传 limit 时返回全部章节组（前端会显式传 limit=100 分页）
      const rawLimit = u.query.limit;
      const limit = rawLimit === undefined || rawLimit === ''
        ? matched.length
        : catalogInt(rawLimit, 100, 1, 2000);
      const offset = catalogInt(u.query.offset, 0, 0, 1000000);
      const groups = matched.slice(offset, offset + limit).map(groupLite);
      return sendJson(res, 200, {
        total: matched.length, stories: totalStories, parts: totalParts, lines: totalLines,
        limit: limit, offset: offset, groups: groups
      });
    }

    if (p === '/api/categories') {
      let cats = listDirs(JSON_ROOT);
      if (!cats.length && CATALOG_STORIES.length) {
        const catSet = new Set();
        for (const s of CATALOG_STORIES) {
          if (s && s.cat) catSet.add(s.cat);
        }
        cats = Array.from(catSet).sort();
      }
      if (SCSP_CURATED_STORIES.length && cats.indexOf('scsp') < 0) cats.unshift('scsp');
      if (cats.indexOf('custom') < 0) cats.unshift('custom');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(cats));
    }
    if (p === '/api/title-zh') {
      return sendJson(res, 200, {
        ok: true,
        arcs: STORY_TITLE_ZH_DATA.arcs || {},
        idols: STORY_TITLE_ZH_DATA.idols || {},
        partNames: STORY_TITLE_ZH_DATA.partNames || {}
      });
    }
    if (p === '/api/list') {
      const cat = u.query.cat || '';
      const ids = listScripts(cat);
      const info = {};
      const partNameMap = STORY_TITLE_ZH_DATA.partNames || {};
      ids.forEach((id) => {
        if (STORY_TITLES[id]) {
          const rec = STORY_TITLES[id];
          const folderRaw = rec.folder || '';
          const folderLeaf = String(folderRaw).split(/[\\\/]+/).filter(Boolean).pop() || '';
          const arcZh = arcTitleZh(folderRaw) || arcTitleZh(folderLeaf) || '';
          const pnZh = rec.partName ? (partNameMap[rec.partName] || '') : '';
          info[id] = Object.assign({}, rec, {
            arcZh: arcZh || undefined,
            partNameZh: pnZh || undefined
          });
        }
      });
      return sendBuffer(req, res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, Buffer.from(JSON.stringify({ cat, ids, info })));
    }
    if (p === '/api/script') {
      const cat = u.query.cat || '', id = u.query.id || '';
      const idList = u.query.ids ? String(u.query.ids).split(',').filter(Boolean) : null;
      const cacheKey = cat + '\u0000' + id + '\u0000' + (idList ? idList.join(',') : '');
      const cached = scriptCacheGet(cacheKey);
      if (cached) {
        if (String(req.headers['if-none-match'] || '') === cached.etag) {
          res.writeHead(304, { ETag: cached.etag, 'Cache-Control': 'no-cache' });
          return res.end();
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache',
          ETag: cached.etag,
          'X-Script-Cache': 'hit'
        });
        return res.end(cached.body);
      }
      const r = loadScript(cat, id, idList);
      if (!r) { res.writeHead(404); return res.end('script not found'); }
      const titleJa = r.titleJa || r.title || '';
      const titleTranslated = (cat === 'scsp' ? r.title : '') || storyTitleZhById(cat, id, titleJa) || chapterTitleZhByKey(cat, id, titleJa) || titleZh(titleJa);
      const body = Buffer.from(JSON.stringify({ cat, id, lines: r.lines, title: titleTranslated || r.title || titleJa, titleZh: titleTranslated, titleJa, date: storyDate(cat, id), merged: r.merged, segments: r.segments, zhPct: r.zhPct }), 'utf8');
      const etag = 'W/"' + crypto.createHash('sha1').update(body).digest('hex').slice(0, 16) + '"';
      scriptCacheSet(cacheKey, body, etag);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        ETag: etag,
        'X-Script-Cache': 'miss'
      });
      return res.end(body);
    }

    if (p.startsWith('/voice/')) {
      const rawRel = p.slice('/voice/'.length);
      if (rawRel.indexOf('scsp/') === 0) {
        const cueId = rawRel.slice('scsp/'.length).replace(/\.(wav|m4a|mp3)$/i, '');
        if (!/^[A-Za-z0-9_.-]+$/.test(cueId)) { res.writeHead(400); return res.end('bad scsp cue'); }
        const rec = SCSP_VOICE_MAP.get(cueId);
        const wavFile = rec ? resolveScspWavFile(rec.scspWavRel) : null;
        if (wavFile) return serveFile(req, res, wavFile, mimeOf(wavFile));
        res.writeHead(404); return res.end('scsp voice not mounted or not found');
      }
      if (rawRel.indexOf('_tts_cache/') === 0) {
        const ttsName = path.basename(rawRel.slice('_tts_cache/'.length));
        if (!/^[A-Za-z0-9_.-]+$/.test(ttsName)) { res.writeHead(400); return res.end('bad tts cache file'); }
        const ttsFile = safeJoin(path.join(SHINYCOLORS_ROOT, 'user_imports', '_tts_cache'), ttsName);
        if (ttsFile && fs.existsSync(ttsFile)) return serveFile(req, res, ttsFile, mimeOf(ttsFile));
        res.writeHead(404); return res.end('tts cache file not found');
      }
      let rel = rawRel;
      if (!/\.[a-z0-9]+$/i.test(rel)) rel += '.m4a';
      const file = safeJoin(VOICE_ROOT, rel);
      if (file && fs.existsSync(file)) return serveFile(req, res, file, mimeOf(file));
      const stem = rawRel.replace(/\.[a-z0-9]+$/i, '');
      const baseStem = path.basename(stem);
      for (const pk of listScpackDirs()) {
        const vMap = pk.packMeta && pk.packMeta.assets && pk.packMeta.assets.voice;
        if (vMap && vMap[baseStem] && vMap[baseStem].file) {
          const mv = safeJoin(pk.packDir, vMap[baseStem].file);
          if (mv && fs.existsSync(mv)) return serveFile(req, res, mv, mimeOf(mv));
        }
        const vDir = path.join(pk.packDir, 'assets', 'voice');
        for (const ext of ['.wav', '.m4a', '.mp3']) {
          const packVoice = safeJoin(vDir, baseStem + ext);
          if (packVoice && fs.existsSync(packVoice)) return serveFile(req, res, packVoice, mimeOf(packVoice));
        }
      }
      if (!VOICE_ROOT) { res.writeHead(404); return res.end('voice root unmounted'); }
      if (!file) { res.writeHead(400); return res.end('bad path'); }
      return serveFile(req, res, file, 'audio/mp4');
    }
    if (p.startsWith('/bgm/')) {
      const id = p.slice('/bgm/'.length);
      if (!/^[\w.-]+$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
      const bgmMain = ASSETS ? path.join(ASSETS, 'sounds', 'bgm', id + '.m4a') : '';
      if (bgmMain && fs.existsSync(bgmMain)) return serveFile(req, res, bgmMain, 'audio/mp4');
      for (const pk of listScpackDirs()) {
        const bgmDir = path.join(pk.packDir, 'assets', 'bgm');
        for (const ext of ['.m4a', '.mp3', '.wav']) {
          const pf = safeJoin(bgmDir, id + ext);
          if (pf && fs.existsSync(pf)) return serveFile(req, res, pf, mimeOf(pf));
        }
      }
      if (!bgmMain) { res.writeHead(404); return res.end('no bgm'); }
      return serveFile(req, res, bgmMain, 'audio/mp4');
    }
    if (p.startsWith('/bg/')) {
      const id = p.slice('/bg/'.length).replace(/\.(jpg|png|webp)$/i, '');
      if (!/^[\w.-]+$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
      if (ASSETS) {
        for (const ext of ['.jpg', '.png', '.webp']) {
          const f = path.join(ASSETS, 'images', 'event', 'bg', id + ext);
          if (fs.existsSync(f)) return serveFile(req, res, f, mimeOf(f));
        }
      }
      for (const pk of listScpackDirs()) {
        const bMap = pk.packMeta && pk.packMeta.assets && pk.packMeta.assets.bg;
        if (bMap && bMap[id] && bMap[id].file) {
          const mb = safeJoin(pk.packDir, bMap[id].file);
          if (mb && fs.existsSync(mb)) return serveFile(req, res, mb, mimeOf(mb));
        }
        const bgDir = path.join(pk.packDir, 'assets', 'bg');
        for (const ext of ['.png', '.jpg', '.webp']) {
          const pf = safeJoin(bgDir, id + ext);
          if (pf && fs.existsSync(pf)) return serveFile(req, res, pf, mimeOf(pf));
        }
      }
      res.writeHead(404); return res.end('no bg');
    }
    if (p.startsWith('/unit-logo/')) {
      const id = p.slice('/unit-logo/'.length).replace(/\.png$/i, '');
      const n = /^00[1-8]$/.test(id) ? Number(id) : 0;
      if (!n) { res.writeHead(400); return res.end('bad unit logo'); }
      if (!ASSETS) { res.writeHead(404); return res.end('no unit logo'); }
      return serveFile(req, res, path.join(ASSETS, 'images', 'content', 'unit', 'logo_official', 'logo_' + n + '.png'), 'image/png');
    }
    if (p.startsWith('/still/')) {
      const rel = p.slice('/still/'.length).split('/');
      if (rel.length !== 2) { res.writeHead(400); return res.end('bad still'); }
      const st = rel[0], sid = rel[1];
      if (!/^[a-z_]+$/.test(st) || !/^[A-Za-z0-9_]+$/.test(sid)) { res.writeHead(400); return res.end('bad still'); }
      if (ASSETS) {
        for (const ext of ['.jpg', '.png', '.webp']) {
          const f = path.join(ASSETS, 'images', 'content', st, 'card', sid + ext);
          if (fs.existsSync(f)) return serveFile(req, res, f, mimeOf(f));
        }
      }
      res.writeHead(404); return res.end('no still');
    }
    if (p.startsWith('/selectframe/')) {
      const id = p.slice('/selectframe/'.length);
      if (!/^\d{3}$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
      if (!ASSETS) { res.writeHead(404); return res.end('no selectframe'); }
      return serveFile(req, res, path.join(ASSETS, 'images', 'event', 'select_frame', id + '.png'), 'image/png');
    }
    if (p.startsWith('/textframe/')) {
      const id = p.slice('/textframe/'.length);
      if (!/^\d{3,4}$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
      if (!ASSETS) { res.writeHead(404); return res.end('no textframe'); }
      return serveFile(req, res, path.join(ASSETS, 'images', 'event', 'text_frame', id + '.png'), 'image/png');
    }
    // foreground layer (script fg / middleFg): images/event/fg/<id>.jpg|png
    if (p.startsWith('/fg/')) {
      const id = p.slice('/fg/'.length).replace(/\.(jpg|png)$/i, '');
      if (!/^[0-9A-Za-z_]+$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
      if (ASSETS) {
        for (const ext of ['.jpg', '.png']) {
          const f = path.join(ASSETS, 'images', 'event', 'fg', id + ext);
          if (fs.existsSync(f)) return serveFile(req, res, f, mimeOf(f));
        }
      }
      res.writeHead(404); return res.end('no fg');
    }
    // log (backlog) text frame: images/event/log_text_frame/<id>.png
    if (p.startsWith('/logframe/')) {
      const id = p.slice('/logframe/'.length).replace(/\.png$/i, '');
      if (!/^[0-9A-Za-z_]+$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
      if (ASSETS) {
        for (const ext of ['.png', '.jpg']) {
          const f = path.join(ASSETS, 'images', 'event', 'log_text_frame', id + ext);
          if (fs.existsSync(f)) return serveFile(req, res, f, mimeOf(f));
        }
      }
      res.writeHead(404); return res.end('no logframe');
    }
    // speaker round icon: images/content/<type>/icon_circle_l/<id>.png
    if (p.startsWith('/icon/')) {
      const seg = p.slice('/icon/'.length).replace(/\.png$/i, '').split('/');
      if (seg.length !== 2) { res.writeHead(400); return res.end('bad icon'); }
      const itype = seg[0], iid = seg[1];
      if (!/^[a-z_]+$/.test(itype) || !/^[0-9A-Za-z_]+$/.test(iid)) { res.writeHead(400); return res.end('bad icon'); }
      if (ASSETS) {
        for (const ext of ['.png', '.jpg']) {
          const f = path.join(ASSETS, 'images', 'content', itype, 'icon_circle_l', iid + ext);
          if (fs.existsSync(f)) return serveFile(req, res, f, mimeOf(f));
        }
      }
      res.writeHead(404); return res.end('no icon');
    }
    // 角色圆形头像：优先官方 icon，缺失时回退到该角色第一张卡面（前端 CSS 圆形裁切）。
    if (p.startsWith('/avatar/')) {
      const seg = p.slice('/avatar/'.length).replace(/\.(png|jpg)$/i, '').split('/');
      if (seg.length !== 2) { res.writeHead(400); return res.end('bad avatar'); }
      const atype = seg[0], aid = seg[1];
      if (!/^[a-z_]+$/.test(atype) || !/^[0-9A-Za-z_]+$/.test(aid)) { res.writeHead(400); return res.end('bad avatar'); }
      // EidolonSC 里已有 28 位主偶像的大头头像，优先用这个。
      if (atype === 'idols' || atype === 'characters') {
        const label = CHAR_ID_TO_LABEL[aid];
        if (label) {
          const face = path.join(EIDOLON_AVATAR_ROOT, label + '.jpg');
          if (fs.existsSync(face)) return serveFile(req, res, face, 'image/jpeg');
        }
      }
      if (ASSETS) {
        for (const ext of ['.png', '.jpg']) {
          const icon = path.join(ASSETS, 'images', 'content', atype, 'icon_circle_l', aid + ext);
          if (fs.existsSync(icon)) return serveFile(req, res, icon, mimeOf(icon));
        }
        if (atype === 'idols') {
          try {
            const dir = path.join(ASSETS, 'images', 'content', 'idols', 'card');
            const prefix = '103' + aid;
            const hit = fs.readdirSync(dir).find(function (f) { return f.indexOf(prefix) === 0 && /\.(jpg|png)$/i.test(f); });
            if (hit) return serveFile(req, res, path.join(dir, hit), mimeOf(hit));
          } catch (e) {}
        }
      }
      res.writeHead(404); return res.end('no avatar');
    }
    // card animation / event movie: movies/idols/card/<id>.mp4 (Range handled by serveFile)
    if (p.startsWith('/movie/')) {
      const id = p.slice('/movie/'.length).replace(/\.mp4$/i, '');
      if (!/^[0-9A-Za-z_]+$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
      if (ASSETS) {
        for (const dirs of [['movies', 'idols', 'card'], ['movies', 'game_event_communications']]) {
          const f = path.join(ASSETS, ...dirs, id + '.mp4');
          if (fs.existsSync(f)) return serveFile(req, res, f, 'video/mp4');
        }
      }
      res.writeHead(404); return res.end('no movie');
    }
    if (p.startsWith('/se/')) {
      const id = p.slice('/se/'.length);
      if (!/^[\w-]+$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
      if (!ASSETS) { res.writeHead(404); return res.end('no se'); }
      return serveFile(req, res, path.join(ASSETS, 'sounds', 'se', id + '.m4a'), 'audio/mp4');
    }
    if (p.startsWith('/se-event/')) {
      const id = p.slice('/se-event/'.length);
      if (!/^[\w-]+$/.test(id)) { res.writeHead(400); return res.end('bad id'); }
      if (!ASSETS) { res.writeHead(404); return res.end('no se-event'); }
      const fEv = path.join(ASSETS, 'sounds', 'se', 'event', id + '.m4a');
      if (fs.existsSync(fEv)) return serveFile(req, res, fEv, 'audio/mp4');
      const fBase = path.join(ASSETS, 'sounds', 'se', id + '.m4a');
      if (fs.existsSync(fBase)) return serveFile(req, res, fBase, 'audio/mp4');
      return serveFile(req, res, fEv, 'audio/mp4');
    }
    if (p.startsWith('/font/')) {
      const name = p.slice('/font/'.length);
      if (!/^[\w.-]+\.(woff2|ttf)$/i.test(name)) { res.writeHead(404); return res.end('no font'); }
      if (!ASSETS) { res.writeHead(404); return res.end('no font'); }
      return serveFile(req, res, path.join(ASSETS, 'fonts', name), mimeOf(name));
    }
    if (p.startsWith('/lib/')) {
      const name = p.slice('/lib/'.length);
      if (!/^(pixi\.js|pixi-spine\.umd\.js)$/.test(name)) { res.writeHead(404); return res.end('no lib'); }
      if (!ASSETS) { res.writeHead(404); return res.end('no lib'); }
      return serveFile(req, res, path.join(ASSETS, 'lib', name), 'application/javascript; charset=utf-8');
    }
    if (p.startsWith('/spine/')) {
      if (!ASSETS) { res.writeHead(404); return res.end('spine assets unmounted'); }
      const rel = p.slice('/spine/'.length);
      let file = safeJoin(path.join(ASSETS, 'spine'), rel);
      if (!file) { res.writeHead(400); return res.end('bad path'); }
      if (!fs.existsSync(file)) {
        const parts = rel.split('/').filter(Boolean);
        if (parts.length === 4) {
          const rs = resolveSpine(parts[0], parts[1], parts[2]);
          if (rs) {
            const alt = safeJoin(path.join(ASSETS, 'spine', rs.type, rs.cat, parts[2]), parts[3]);
            if (alt && fs.existsSync(alt)) file = alt;
          }
        }
      }
      return serveFile(req, res, file, mimeOf(file));
    }

    res.writeHead(404); res.end('not found');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String((e && e.stack) || e));
  }
});

function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (!info || info.family !== 'IPv4' || info.internal) continue;
      out.push({ name, address: info.address });
    }
  }
  // 常见虚拟网卡（WSL/Hyper-V）排在后面，但都打印出来便于排查
  const virtual = /^(172\.(1[6-9]|2\d|3[01])\.|172\.31\.|169\.254\.)/;
  out.sort((a, b) => (virtual.test(a.address) ? 1 : 0) - (virtual.test(b.address) ? 1 : 0));
  return out;
}

function printStartup() {
  const wildcard = HOST === '0.0.0.0' || HOST === '::' || HOST === '';
  console.log('enza player');
  console.log('  listen   http://' + HOST + ':' + PORT + '/');
  console.log('  local    http://127.0.0.1:' + PORT + '/');
  for (const item of lanAddresses()) {
    console.log('  ' + (wildcard ? 'mobile   ' : 'lan      ') + 'http://' + item.address + ':' + PORT + '/  (' + item.name + ')');
  }
  if (!wildcard) {
    console.log('  note: 当前只监听本机；手机访问请加 --host=0.0.0.0 或设置 ENZA_HOST=0.0.0.0');
  } else {
    console.log('  note: 手机与 PC 需在同一 Wi-Fi；路由器若开 AP 隔离则无法互访。');
  }
  console.log('  firewall (管理员 PowerShell，仅首次): New-NetFirewallRule -DisplayName "enza-player ' + PORT +
    '" -Direction Inbound -Protocol TCP -LocalPort ' + PORT + ' -Profile Private -Action Allow');
}

const WORKER_SORT_ORDER = [
  'coordinator', 'spec', 'engine', 'corpus', 'tts', 'polisher',
  'disk-audit', 'search', 'persona', 'editor-proto', 'verifier', 'monitor'
];

function buildProgressPayload() {
  const workers = [];
  const byName = Object.create(null);
  const gateOverrides = Object.create(null);
  try {
    if (fs.existsSync(PROGRESS_DIR)) {
      const files = fs.readdirSync(PROGRESS_DIR)
        .filter((f) => f.endsWith('.json') && f.charAt(0) !== '_')
        .sort();
      for (const f of files) {
        const full = path.join(PROGRESS_DIR, f);
        const stem = f.slice(0, -5);
        let obj = null;
        try {
          obj = JSON.parse(fs.readFileSync(full, 'utf8'));
        } catch (e) {
          obj = {
            worker: stem,
            model: '',
            phase: 'Phase 1',
            status: 'parse_error',
            step: 'JSON 读取重试中: ' + e.message,
            done: 0,
            total: 1,
            blocker: null,
            artifacts: [],
            updatedAt: new Date().toISOString()
          };
        }
        if (obj && typeof obj === 'object') {
          if (!obj.worker) obj.worker = stem;
          workers.push(obj);
          byName[obj.worker] = obj;
          if (obj.gates && typeof obj.gates === 'object') {
            for (const gk of Object.keys(obj.gates)) {
              const gv = obj.gates[gk];
              if (gv && gv !== 'n/a' && (obj.worker === 'coordinator' || !gateOverrides[gk])) {
                gateOverrides[gk] = gv;
              }
            }
          }
        }
      }
    }
  } catch (e) {}

  workers.sort((a, b) => {
    const ia = WORKER_SORT_ORDER.indexOf(a.worker);
    const ib = WORKER_SORT_ORDER.indexOf(b.worker);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return String(a.worker).localeCompare(String(b.worker));
  });

  function isDoneOrReview(name) {
    const w = byName[name];
    if (!w) return false;
    const s = String(w.status || '').toLowerCase();
    return s === 'done' || s === 'completed' || s === 'review' || s === 'pass';
  }
  function gateStatus(id, inferredReady) {
    const ov = gateOverrides[id];
    if (ov === 'waiting_user' || ov === 'ready_for_approval') return 'ready_for_approval';
    if (ov === 'pass' || ov === 'approved' || ov === 'completed' || ov === 'done') return 'completed';
    if (ov === 'fail' || ov === 'blocked') return 'blocked';
    if (inferredReady) return 'ready_for_approval';
    return 'pending_gate';
  }

  const gates = [
    {
      id: 'G1',
      title: '加载 TTS 大模型做 A/B 合成',
      status: gateStatus('G1', isDoneOrReview('tts')),
      action: 'tts 完成纯 CPU 参考音频筛选后，待点头加载模型（峰值约 27GB 内存）'
    },
    {
      id: 'G2',
      title: 'voices.v2.json 替换线上配置',
      status: gateStatus('G2', false),
      action: 'A/B 试听页出炉后，试听决定是否替换线上音色配置'
    },
    {
      id: 'G3',
      title: '编辑器交互原型手感确认',
      status: gateStatus('G3', isDoneOrReview('editor-proto')),
      action: 'editor-proto 完成后，试用时间轴与立绘摆位手感并给反馈'
    },
    {
      id: 'G4',
      title: '桌面端覆盖包同步与重打包',
      status: gateStatus('G4', isDoneOrReview('engine') && isDoneOrReview('verifier')),
      action: 'engine 回归全绿且 verifier 交叉验收通过后，决定是否同步 desktop/app'
    },
    {
      id: 'G5',
      title: 'Phase 2 启动与 UI 视觉定版',
      status: gateStatus('G5', false),
      action: 'Phase 2 启动前，从 2–3 套 UI 样稿确认最终视觉方向'
    }
  ];

  return {
    ok: true,
    server: {
      pid: process.pid,
      port: PORT,
      host: HOST,
      build: SERVER_BUILD,
      uptimeSec: Math.round(process.uptime()),
      freeMemGB: (os.freemem() / (1024 * 1024 * 1024)).toFixed(1),
      totalMemGB: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1),
      now: new Date().toISOString()
    },
    gates: gates,
    workers: workers
  };
}

if (require.main === module) {
  try {
    os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    console.log('process priority: BelowNormal');
  } catch (e) {
    console.log('process priority unchanged:', e.message);
  }

  server.on('error', (err) => {
    console.error('server listen error:', (err && err.message) || err);
    if (typeof process.send === 'function') {
      try { process.send({ type: 'enza-error', message: (err && err.message) || String(err) }); } catch (e) {}
    }
    process.exitCode = 1;
  });

  server.listen(PORT, HOST, () => {
    printStartup();
    const addr = server.address();
    const actualPort = (addr && typeof addr === 'object' && addr.port) ? addr.port : PORT;
    if (typeof process.send === 'function') {
      try {
        process.send({
          type: 'enza-ready',
          port: actualPort,
          version: process.env.ENZA_APP_VERSION || '0.2.0'
        });
      } catch (e) {}
    }
  });
}

module.exports = {
  server,
  loadScript,
  normalizeScriptLines,
  loadCatalogFile,
  listScripts,
  listDirs,
  buildProgressPayload,
  resolveFfmpegBin,
  getVideoRemuxEncoderPlans,
  getMountStatus,
  applyMountRoots,
  getScspStories,
  CHAR_MAP,
  CHAR_ID_TO_LABEL,
  IDOL_NAME_ZH,
  MAIN_IDOL_LABELS,
  getCatalogState: () => ({
    stories: CATALOG_STORIES,
    groups: CATALOG_GROUPS,
    error: CATALOG_ERROR,
    source: CATALOG_SOURCE
  })
};
