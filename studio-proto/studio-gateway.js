'use strict';
/**
 * Shared Studio Gateway helpers (zero-write preview compile, unified Local/Cloud TTS adapter,
 * and :18899 /api/video-remux proxy) used by both dev server (serve_progress.js) and
 * portable server (studio_portable_server.js).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const DEFAULT_ENDPOINTS = {
  off: '',
  cloud_fish: 'https://api.fish.audio',
  local_irodori: 'http://127.0.0.1:8088',
  local_gptsovits: 'http://127.0.0.1:9880',
  local_voicevox: 'http://127.0.0.1:50021',
  cloud_openai: 'https://api.openai.com/v1',
  custom_webhook: ''
};

// Default 28 idols + Hazuki (with Studio 'tooru' alias -> 'toru' in Eidolon-SC characters.toml)
const DEFAULT_FISH_VOICE_MAP = {
  mano: 'a1150f3d14ac46fb8ea59c7803cd8357',
  hiori: 'df43849d16ae48fe87f5670b6a2b81b3',
  meguru: '17ce7b6d4ccb43a2bedac1fdb4a219cb',
  kogane: 'a11bfd046e924099a84f989fb4049e95',
  mamimi: '1cbb1ba24d094810a6cada880dd8dec0',
  sakuya: '3543f8d3e498439794f14be23dafbe89',
  yuika: 'e6b09fdf01874e63adf5f8aa45c0d2ea',
  kiriko: '115e921e1b4740b08f3ec723666b2b40',
  toru: 'db8fb218614745f6b854e24620c33445',
  tooru: 'db8fb218614745f6b854e24620c33445',
  madoka: '9fa98a656a0d4242b6073fd955f5179b',
  koito: '8ee2e17bbead4610a17f324fe540be49',
  hinana: '565ffd381fbc427ebfa1cc4c689ac12d',
  nichika: 'b3757a5a71ba4078be1e25b446190975',
  mikoto: 'bf578eec18ca49daaf9216f5df3fabd4',
  asahi: '2dcc8351008f4714b33506d7d45a861e',
  fuyuko: '105efba2160a40119d6d21e5445b889e',
  mei: '1f0033aac5b34d478ec975114c845bf9',
  kaho: 'd9e61a6914dd47669a9bbae71a78ab38',
  chiyoko: 'a48ea1f5d81a478ba528b49188bf4ccc',
  juri: '8875da3542374b18a29b85fbf48f0de2',
  rinze: 'dd73b57d509b436b90ef9263d2e6c5d1',
  natsuha: '70e8160d2cf34c5892b9002e42cbafdb',
  amana: 'd5a68fc022604b23b94e2a0b9f823b59',
  tenka: '7f50c8ef897c402fa7967a11aa94261e',
  chiyuki: '7de8d70dc5e04759be11c01f69c8c863',
  luca: '79e3dd87aa7649dab07350896ce995ae',
  hana: 'ccfce7160c664853813988cea175d1ab',
  haruki: '5dd68541a9a04f50b9332572e0d266ff',
  hazuki: 'a061289170654e1a9dda177a28764651',
  fktn: 'd54a072b1c6341ae880b162389fbbc35'
};

const EIDOLON_MAIN_DIR = path.resolve(__dirname, '../../../eidolon-sc/eidolon-sc-main');
const FISH_DRAMA_TAGS_RE = /<\/?(whisper|emphasis|soft|fast|slow|stress|forceful)\b[^>]*>/gi;
const FISH_BRACKET_CUE_RE = /\[[A-Za-z][A-Za-z0-9 ,'-]{1,42}\]/g;
let _eidolonFishCache = { loadedAt: 0, runtime: null };

function parseDotEnvFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    } else {
      const hashIdx = v.indexOf(' #');
      if (hashIdx >= 0) v = v.slice(0, hashIdx).trim();
    }
    out[k] = v;
  }
  return out;
}

function decryptEidolonFernet(tokenStr, secretKey) {
  if (!tokenStr || !secretKey) return '';
  const derived = Buffer.from(crypto.hkdfSync(
    'sha256',
    Buffer.from(String(secretKey), 'utf8'),
    Buffer.alloc(32, 0),
    Buffer.from('eidolon config overrides', 'utf8'),
    32
  ));
  const signKey = derived.subarray(0, 16);
  const encKey = derived.subarray(16, 32);
  const b64 = String(tokenStr).trim().replace(/-/g, '+').replace(/_/g, '/');
  const tok = Buffer.from(b64, 'base64');
  if (tok.length < 57 || tok[0] !== 0x80) {
    throw new Error('Invalid Fernet token');
  }
  const msg = tok.subarray(0, tok.length - 32);
  const mac = tok.subarray(tok.length - 32);
  const expectedMac = crypto.createHmac('sha256', signKey).update(msg).digest();
  if (!crypto.timingSafeEqual(mac, expectedMac)) {
    throw new Error('Fernet HMAC mismatch');
  }
  const iv = tok.subarray(9, 25);
  const ct = tok.subarray(25, tok.length - 32);
  const decipher = crypto.createDecipheriv('aes-128-cbc', encKey, iv);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

function parseEidolonOverrideValue(rawVal, last4, secretKey) {
  let s = String(rawVal || '').trim();
  if (!s) return '';
  if ((last4 || s.startsWith('gAAAAA')) && secretKey) {
    s = decryptEidolonFernet(s, secretKey).trim();
  }
  try {
    const parsed = JSON.parse(s);
    return typeof parsed === 'string' ? parsed : String(parsed ?? '');
  } catch (_) {
    return s;
  }
}

function parseCharactersTomlVoices(tomlPath) {
  const voiceMap = Object.assign({}, DEFAULT_FISH_VOICE_MAP);
  if (!fs.existsSync(tomlPath)) return voiceMap;
  const txt = fs.readFileSync(tomlPath, 'utf8');
  const blocks = txt.split(/(?:^|\r?\n)\[\[characters\]\]\s*\r?\n/);
  for (const b of blocks) {
    const idM = b.match(/^id\s*=\s*"([^"]+)"/m);
    const vM = b.match(/^voice_id\s*=\s*"([^"]+)"/m);
    if (idM && vM) {
      const k = idM[1].trim().toLowerCase();
      const v = vM[1].trim();
      if (k && v) voiceMap[k] = v;
    }
  }
  if (voiceMap.toru && !voiceMap.tooru) voiceMap.tooru = voiceMap.toru;
  return voiceMap;
}

function parseReadingsToml(tomlPath) {
  if (!fs.existsSync(tomlPath)) return { pronunciationDictionary: null, count: 0 };
  const txt = fs.readFileSync(tomlPath, 'utf8');
  const blocks = txt.split(/(?:^|\r?\n)\[\[readings\]\]\s*\r?\n/);
  const items = [];
  const seen = new Set();
  for (const b of blocks) {
    const wM = b.match(/^written\s*=\s*"([^"]+)"/m);
    const pM = b.match(/^phonemes\s*=\s*"([^"]*)"/m);
    if (!wM || !pM) continue;
    const key = wM[1].trim();
    const val = pM[1].trim();
    if (!key || !val || seen.has(key)) continue;
    seen.add(key);
    items.push({ key, value: val, case_sensitive: true });
  }
  return {
    pronunciationDictionary: items.length ? [{ items }] : null,
    count: items.length
  };
}

function findLatestEidolonDb(mainDir) {
  const candidates = [
    path.join(mainDir, 'data', 'eidolon.db'),
    path.join(mainDir, 'backend', 'data', 'eidolon.db')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const backupDir = path.join(mainDir, 'backups');
  if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir)
      .filter((f) => /^eidolon-.*\.db$/i.test(f))
      .sort()
      .reverse();
    if (files.length) return path.join(backupDir, files[0]);
  }
  return '';
}

function loadEidolonFishRuntime(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _eidolonFishCache.runtime && now - _eidolonFishCache.loadedAt < 60000) {
    return _eidolonFishCache.runtime;
  }
  const shinyRoot = path.resolve(__dirname, '..');
  const hasMainDir = fs.existsSync(EIDOLON_MAIN_DIR);
  const voiceMap = parseCharactersTomlVoices(path.join(EIDOLON_MAIN_DIR, 'characters', 'characters.toml'));
  const eidolonReadingsPath = path.join(EIDOLON_MAIN_DIR, 'characters', 'readings.toml');
  const bundledReadingsPath = path.join(shinyRoot, 'studio', 'data', 'readings.toml');
  const readings = parseReadingsToml(fs.existsSync(eidolonReadingsPath) ? eidolonReadingsPath : bundledReadingsPath);
  const envMap = parseDotEnvFile(path.join(EIDOLON_MAIN_DIR, '.env'));
  const secretKey = String(process.env.EIDOLON_SECRET_KEY || envMap.EIDOLON_SECRET_KEY || '').trim();

  // Support cloud / portable STUDIO_SECRETS_DIR/.tts-local.json (same isolation model as .llm-local.json)
  const secretsCandidates = [
    process.env.STUDIO_SECRETS_DIR ? path.resolve(process.env.STUDIO_SECRETS_DIR) : '',
    path.join(shinyRoot, 'server', 'secrets'),
    __dirname
  ].filter(Boolean);
  let ttsFileCfg = {};
  let ttsSecretsSource = '';
  for (const dir of secretsCandidates) {
    const f = path.join(dir, '.tts-local.json');
    if (fs.existsSync(f)) {
      try {
        ttsFileCfg = JSON.parse(fs.readFileSync(f, 'utf8')) || {};
        ttsSecretsSource = '.tts-local.json';
      } catch (_) {}
      break;
    }
  }
  if (ttsFileCfg.voiceMap && typeof ttsFileCfg.voiceMap === 'object') {
    for (const [k, v] of Object.entries(ttsFileCfg.voiceMap)) {
      if (k && v) voiceMap[String(k).trim().toLowerCase()] = String(v).trim();
    }
    if (voiceMap.toru && !voiceMap.tooru) voiceMap.tooru = voiceMap.toru;
  }

  let apiKey = String(
    process.env.FISH_API_KEY ||
    process.env.TTS_API_KEY ||
    ttsFileCfg.apiKey ||
    ttsFileCfg.fishApiKey ||
    envMap.TTS_API_KEY ||
    envMap.FISH_API_KEY ||
    ''
  ).trim();
  let model = String(
    process.env.FISH_AUDIO_MODEL ||
    ttsFileCfg.model ||
    envMap.FISH_AUDIO_MODEL ||
    ''
  ).trim() || 'drama-3';
  const sourceDb = hasMainDir ? findLatestEidolonDb(EIDOLON_MAIN_DIR) : '';

  if (sourceDb) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(sourceDb, { open: true, readOnly: true });
      try {
        const rows = db.prepare("SELECT name, value, last4 FROM config_overrides WHERE name IN ('tts.api_key', 'tts.model')").all();
        for (const r of rows) {
          const val = parseEidolonOverrideValue(r.value, r.last4, secretKey);
          if (r.name === 'tts.api_key' && val && !apiKey) apiKey = val;
          if (r.name === 'tts.model' && val && !ttsFileCfg.model) model = val;
        }
      } finally {
        db.close();
      }
    } catch (_) {
      // Gracefully fall back if node:sqlite unavailable or DB locked
    }
  }

  const runtime = {
    available: hasMainDir || Boolean(apiKey),
    voiceMap,
    pronunciationDictionary: readings.pronunciationDictionary,
    readingsCount: readings.count,
    apiKey,
    model: model || 'drama-3',
    sourceDb: sourceDb || ttsSecretsSource
  };
  _eidolonFishCache = { loadedAt: now, runtime };
  return runtime;
}

function getEidolonFishPresetInfo(forceRefresh = false, opts = {}) {
  const rt = loadEidolonFishRuntime(forceRefresh);
  const secretsDisabled = process.env.STUDIO_DISABLE_SERVER_SECRETS === '1' && !(opts && opts.allowServerSecrets);
  return {
    ok: true,
    available: rt.available || Boolean(!secretsDisabled && rt.apiKey),
    hasLocalKey: !secretsDisabled && Boolean(rt.apiKey),
    defaultModel: rt.model || 'drama-3',
    endpoint: DEFAULT_ENDPOINTS.cloud_fish,
    voiceCount: Object.keys(rt.voiceMap).length,
    readingsCount: rt.readingsCount || 0,
    voiceMap: rt.voiceMap,
    sourceDb: rt.sourceDb ? path.basename(rt.sourceDb) : ''
  };
}

function unwrapTtsPayload(rawBody) {
  if (!rawBody || typeof rawBody !== 'object') return {};
  if (rawBody.ttsConfig && typeof rawBody.ttsConfig === 'object') {
    return Object.assign({}, rawBody.ttsConfig, rawBody);
  }
  return rawBody;
}

function parseVoiceMapInput(body) {
  const out = {};
  if (body.voiceMap && typeof body.voiceMap === 'object') {
    for (const [k, v] of Object.entries(body.voiceMap)) {
      if (k && v) out[String(k).trim().toLowerCase()] = String(v).trim();
    }
  }
  const rawText = String(body.voiceMapText || '').trim();
  if (rawText) {
    if (rawText.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (k && v) out[String(k).trim().toLowerCase()] = String(v).trim();
          }
          return out;
        }
      } catch (_) {}
    }
    for (const line of rawText.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      const m = s.match(/^([A-Za-z0-9_-]+)\s*[:=]\s*(.+)$/);
      if (m) out[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

function resolveTtsVoiceId({ charLabel, voiceId, provider, body, rt }) {
  const explicit = String(voiceId || '').trim();
  if (explicit) return explicit;
  const cKey = String(charLabel || '').trim().toLowerCase();
  if (!cKey) return '';
  const userMap = parseVoiceMapInput(body);
  if (userMap[cKey]) return userMap[cKey];
  if (cKey === 'tooru' && userMap.toru) return userMap.toru;
  if (provider === 'cloud_fish') {
    if (rt && rt.voiceMap && rt.voiceMap[cKey]) return rt.voiceMap[cKey];
    if (cKey === 'tooru' && rt && rt.voiceMap && rt.voiceMap.toru) return rt.voiceMap.toru;
    if (DEFAULT_FISH_VOICE_MAP[cKey]) return DEFAULT_FISH_VOICE_MAP[cKey];
  }
  return '';
}

function prepareFishText(rawText, model, opts = {}) {
  let s = String(rawText || '').trim();
  const rawStripped = s;
  const isOuterMono = (rawStripped.startsWith('（') && rawStripped.endsWith('）') && rawStripped.indexOf('（', 1) < 0) ||
    (rawStripped.startsWith('(') && rawStripped.endsWith(')') && rawStripped.indexOf('(', 1) < 0);
  const isMono = Boolean(opts.innerMonologue) || isOuterMono;
  // Strip stage notes like 【...】
  s = s.replace(/【[^】]*】/g, ' ');
  // Unwrap pure inner monologue parentheses so Fish Audio reads inner lines cleanly in Step 2
  const stripped = s.trim();
  if ((stripped.startsWith('（') && stripped.endsWith('）') && stripped.indexOf('（', 1) < 0) ||
      (stripped.startsWith('(') && stripped.endsWith(')') && stripped.indexOf('(', 1) < 0)) {
    s = stripped.slice(1, -1).trim();
  }
  // Remove inline stage directions e.g. （小声） unless empty
  const noParens = s.replace(/（[^）]{1,18}）/g, '').replace(/\([^)]{1,18}\)/g, '').trim();
  if (noParens) s = noParens;
  s = s.replace(/\s+/g, ' ').trim();
  const isDrama3 = String(model || '').toLowerCase() === 'drama-3';
  if (!isDrama3) {
    return s.replace(FISH_DRAMA_TAGS_RE, '').replace(FISH_BRACKET_CUE_RE, '').replace(/\s+/g, ' ').trim();
  }
  if (!s) return s;
  const hasCueAlready = FISH_DRAMA_TAGS_RE.test(s) || /^\[[A-Za-z][A-Za-z0-9 ,'-]*\]/.test(s);
  FISH_DRAMA_TAGS_RE.lastIndex = 0;
  if (hasCueAlready) return s;
  const emo = String(opts.emotion || '').trim().toLowerCase();
  const mode = String(opts.mode || '').trim().toLowerCase();
  const tone = String(opts.vocalTone || '').trim().toLowerCase();
  if (isMono) {
    if (mode === 'ura' || emo === 'tsun' || emo === 'angry' || emo === 'anger_pout') {
      return `[low mutter] <whisper>${s}</whisper>`;
    }
    return `<whisper>${s}</whisper>`;
  }
  if (mode === 'omote' || emo === 'idol' || emo === 'smile_gentle') {
    return `[sweet cheerful tone] ${s}`;
  }
  if (mode === 'ura' && ['tsun', 'anger_pout', 'angry', 'serious', 'calm_neutral'].includes(emo)) {
    return `[low candid tone] ${s}`;
  }
  if (emo === 'sigh' || emo === 'troubled_sigh' || /^(はぁ|はあ|ふぅ|ふう)[…・。、\s]/.test(s)) {
    return `[soft sigh] <soft>${s}</soft>`;
  }
  if (emo === 'tsun' || emo === 'anger_pout') {
    return `[slightly flustered] ${s}`;
  }
  if (['sad', 'sad_downcast', 'shy', 'shy_flustered', 'flustered', 'tired', 'tender', 'relieved'].includes(emo) || tone.includes('hushed') || tone.includes('soft')) {
    return `<soft>${s}</soft>`;
  }
  if (emo === 'angry') return `<forceful>${s}</forceful>`;
  if (emo === 'surprised' || emo === 'surp' || emo === 'surprise_wide') return `<emphasis>${s}</emphasis>`;
  return s;
}

function requestBuffer(urlStr, opts = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch (e) {
      reject(new Error('无效 URL: ' + urlStr));
      return;
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const method = opts.method || 'GET';
    const headers = Object.assign({}, opts.headers || {});
    let bodyBuf = null;
    if (opts.body !== undefined && opts.body !== null) {
      bodyBuf = Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(String(opts.body), 'utf8');
      if (!headers['Content-Length'] && !headers['content-length']) {
        headers['Content-Length'] = bodyBuf.length;
      }
    }
    const req = mod.request(parsed, { method, headers, timeout: opts.timeoutMs || 15000 }, (resp) => {
      const chunks = [];
      resp.on('data', (c) => chunks.push(c));
      resp.on('end', () => {
        resolve({
          status: resp.statusCode || 0,
          headers: resp.headers || {},
          buffer: Buffer.concat(chunks)
        });
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('请求超时 (' + (opts.timeoutMs || 15000) + 'ms)'));
    });
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

function previewCompile(studioEngine, body) {
  if (!studioEngine || typeof studioEngine.compileSceneToScproj !== 'function') {
    throw new Error('studioEngine.compileSceneToScproj 不可用');
  }
  const scproj = studioEngine.compileSceneToScproj({
    projectId: body.projectId || 'preview_temp',
    packName: body.packName || '',
    packUnit: body.packUnit || '',
    sceneId: body.sceneId || 'scene_preview',
    title: body.title || '预览分场',
    titleZh: body.titleZh || body.title || '预览分场',
    bg: body.bg || '',
    bgm: body.bgm || '',
    cast: Array.isArray(body.cast) ? body.cast : [],
    castOutfits: body.castOutfits || {},
    castHairs: body.castHairs || {},
    segments: Array.isArray(body.segments) ? body.segments : [],
    scriptRows: Array.isArray(body.scriptRows) ? body.scriptRows : []
  });
  return { ok: true, previewOnly: true, scproj };
}

async function checkTtsHealth(rawBody = {}) {
  const body = unwrapTtsPayload(rawBody);
  const provider = String(body.provider || 'off').trim();
  const endpoint = String(body.endpoint || DEFAULT_ENDPOINTS[provider] || '').trim().replace(/\/+$/, '');
  if (provider === 'off') {
    const msg = 'TTS 网关处于关闭状态 (off)';
    return { ok: true, provider, online: false, message: msg, detail: msg };
  }
  if (!endpoint) {
    const msg = '请先填写 TTS 服务地址 (Endpoint)';
    return { ok: false, provider, online: false, message: msg, detail: msg };
  }
  if (provider === 'cloud_fish') {
    const disallowSecrets = Boolean(body._disallowServerSecrets) || (process.env.STUDIO_DISABLE_SERVER_SECRETS === '1' && !body._allowServerSecrets);
    const rt = loadEidolonFishRuntime();
    const clientApiKey = String(body.apiKey || '').trim();
    const apiKey = clientApiKey || (disallowSecrets ? '' : String(rt.apiKey || '').trim());
    const model = String(body.model || (disallowSecrets ? 'drama-3' : rt.model) || 'drama-3').trim();
    const usingEidolonKey = !disallowSecrets && !clientApiKey && Boolean(rt.apiKey);
    if (!apiKey) {
      const msg = disallowSecrets
        ? '公网试用模式未自动挂载服务器 Fish Key，请输入口令或填写你自己的 Fish Audio API Key'
        : '请填写 Fish Audio API Key，或配置本地托管凭据';
      return { ok: false, provider, online: false, endpoint, message: msg, detail: msg };
    }
    try {
      const creditUrl = `${endpoint}/wallet/self/api-credit`;
      const r = await requestBuffer(creditUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 6000
      });
      if (r.status >= 200 && r.status < 300) {
        let creditStr = '';
        let creditNum = null;
        try {
          const j = JSON.parse(r.buffer.toString('utf8'));
          const val = j.credit ?? j.balance ?? j.remaining_credit;
          if (val !== undefined && val !== null) {
            creditStr = ` · 余量 ${val}`;
            if (Number.isFinite(Number(val))) creditNum = Number(val);
          }
        } catch (_) {}
        const keySource = usingEidolonKey ? '已托管本机 Key' : '自定义 Key';
        const msg = `Fish Audio 在线 (${model} · ${keySource} · ${rt.readingsCount} 条读音词典${creditStr})`;
        return {
          ok: true,
          provider,
          online: true,
          status: r.status,
          endpoint,
          model,
          credit: creditNum,
          usingEidolonKey,
          readingsCount: rt.readingsCount,
          message: msg,
          detail: msg
        };
      }
      const errText = r.buffer.toString('utf8').slice(0, 140);
      const msg = `Fish Audio 鉴权或接口返回 HTTP ${r.status}${errText ? ': ' + errText : ''}`;
      return { ok: false, provider, online: false, status: r.status, endpoint, message: msg, detail: msg };
    } catch (err) {
      const msg = `无法连接 Fish Audio (${endpoint}): ${err.message || err}`;
      return { ok: false, provider, online: false, endpoint, message: msg, detail: msg };
    }
  }
  if (provider === 'cloud_openai') {
    const hasKey = Boolean(String(body.apiKey || '').trim());
    const msg = hasKey ? `OpenAI 兼容语音接口配置就绪 (${endpoint})` : '请先填写云端 TTS API Key';
    return { ok: hasKey, provider, online: hasKey, endpoint, message: msg, detail: msg };
  }
  const probePath = provider === 'local_voicevox' ? '/speakers' : (provider === 'local_irodori' ? '/health' : '');
  try {
    const r = await requestBuffer(endpoint + probePath, { method: 'GET', timeoutMs: 3500 });
    const online = r.status > 0 && r.status < 500;
    const msg = online ? `语音服务在线 (HTTP ${r.status})` : `服务返回 HTTP ${r.status}`;
    return { ok: online, provider, online, status: r.status, endpoint, message: msg, detail: msg };
  } catch (err) {
    const msg = `无法连接本地/自定义 TTS (${endpoint}): ${err.message || err}`;
    return { ok: false, provider, online: false, endpoint, message: msg, detail: msg };
  }
}

async function synthesizeTts(rawBody = {}, cacheDir) {
  const body = unwrapTtsPayload(rawBody);
  const provider = String(body.provider || 'off').trim();
  const rawText = String(body.text || '').trim();
  const charLabel = String(body.charLabel || '').trim();
  const lang = String(body.lang || 'ja').trim();
  const speed = Number(body.speed || 1) || 1;
  const endpoint = String(body.endpoint || DEFAULT_ENDPOINTS[provider] || '').trim().replace(/\/+$/, '');
  const disallowSecrets = Boolean(body._disallowServerSecrets) || (process.env.STUDIO_DISABLE_SERVER_SECRETS === '1' && !body._allowServerSecrets);
  const rt = provider === 'cloud_fish' ? loadEidolonFishRuntime() : null;
  const voiceId = resolveTtsVoiceId({ charLabel, voiceId: body.voiceId, provider, body, rt });
  const clientApiKey = String(body.apiKey || '').trim();
  const apiKey = clientApiKey || (disallowSecrets ? '' : String((rt && rt.apiKey) || '').trim());
  const model = String(body.model || (!disallowSecrets && rt && rt.model) || (provider === 'cloud_fish' ? 'drama-3' : '')).trim();
  const emotion = String(body.emotion || '').trim().toLowerCase();
  const mode = String(body.mode || '').trim().toLowerCase();
  const vocalTone = String(body.vocalTone || '').trim().toLowerCase();
  const innerMonologue = Boolean(body.innerMonologue);
  const text = provider === 'cloud_fish'
    ? (prepareFishText(rawText, model, { emotion, mode, vocalTone, innerMonologue }) || rawText)
    : rawText;

  if (provider === 'off') {
    return { ok: false, error: '当前 TTS 模式为「关闭」，请先在「接口与语音」配置 Fish Audio 或本地语音服务。' };
  }
  if (!text) {
    return { ok: false, error: '待合成台词为空。' };
  }
  if (!endpoint) {
    return { ok: false, error: `TTS 提供方 ${provider} 缺少服务地址 (Endpoint)。` };
  }
  if (provider === 'cloud_fish') {
    if (!apiKey) {
      return {
        ok: false,
        error: disallowSecrets
          ? '公网试用模式：请输入访问口令，或在「接口与语音 → 语音合成」填写你自己的 Fish Audio API Key。'
          : '未检测到 Fish Audio API Key（请在「接口与语音 → 语音合成」填写）。'
      };
    }
    if (!voiceId) {
      return { ok: false, error: `角色 "${charLabel || '未知'}" 未匹配到 Fish Audio 音色 ID（仅偶像角色支持默认音色）。` };
    }
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  const ext = (provider === 'cloud_openai' || provider === 'cloud_fish') ? 'mp3' : 'wav';
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify({
      provider,
      endpoint,
      charLabel,
      voiceId,
      text,
      lang,
      speed,
      model,
      readingsCount: rt ? rt.readingsCount : 0
    }))
    .digest('hex')
    .slice(0, 16);
  const filename = `tts_${charLabel || 'voice'}_${hash}.${ext}`;
  const outPath = path.join(cacheDir, filename);

  if (!body.force && fs.existsSync(outPath) && fs.statSync(outPath).size > 128) {
    return {
      ok: true,
      cached: true,
      provider,
      model,
      voiceId,
      filename,
      audioUrl: `/api/studio/tts/audio/${encodeURIComponent(filename)}`,
      playerVoicePath: `_tts_cache/${filename}`
    };
  }

  let audioBuf = null;
  let actualExt = ext;

  if (provider === 'cloud_fish') {
    const fishUrl = endpoint.endsWith('/v1/tts') ? endpoint : `${endpoint}/v1/tts`;
    const payload = {
      text,
      reference_id: voiceId,
      format: 'mp3',
      latency: 'normal'
    };
    if (rt && rt.pronunciationDictionary) {
      payload.pronunciation_dictionary = rt.pronunciationDictionary;
    }
    if (Math.abs(speed - 1) > 0.01) {
      payload.prosody = { speed };
    }
    const sRes = await requestBuffer(fishUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        model: model || 'drama-3',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeoutMs: 30000
    });
    if (sRes.status < 200 || sRes.status >= 300 || sRes.buffer.length < 128) {
      throw new Error(`Fish Audio TTS 失败 (HTTP ${sRes.status}): ${sRes.buffer.toString('utf8').slice(0, 200)}`);
    }
    audioBuf = sRes.buffer;
    actualExt = 'mp3';
  } else if (provider === 'local_voicevox') {
    const spkId = encodeURIComponent(voiceId || '1');
    const qRes = await requestBuffer(`${endpoint}/audio_query?text=${encodeURIComponent(text)}&speaker=${spkId}`, {
      method: 'POST',
      timeoutMs: 12000
    });
    if (qRes.status < 200 || qRes.status >= 300) {
      throw new Error(`VOICEVOX audio_query 失败 (HTTP ${qRes.status})`);
    }
    const queryJson = JSON.parse(qRes.buffer.toString('utf8'));
    queryJson.speedScale = speed;
    const sRes = await requestBuffer(`${endpoint}/synthesis?speaker=${spkId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryJson),
      timeoutMs: 25000
    });
    if (sRes.status < 200 || sRes.status >= 300 || sRes.buffer.length < 64) {
      throw new Error(`VOICEVOX synthesis 失败 (HTTP ${sRes.status})`);
    }
    audioBuf = sRes.buffer;
    actualExt = 'wav';
  } else if (provider === 'cloud_openai') {
    const speechUrl = endpoint.endsWith('/audio/speech') ? endpoint : `${endpoint}/audio/speech`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const sRes = await requestBuffer(speechUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: body.model || 'tts-1',
        input: text,
        voice: voiceId || 'nova',
        speed,
        response_format: 'mp3'
      }),
      timeoutMs: 30000
    });
    if (sRes.status < 200 || sRes.status >= 300 || sRes.buffer.length < 64) {
      throw new Error(`OpenAI TTS 失败 (HTTP ${sRes.status}): ${sRes.buffer.toString('utf8').slice(0, 180)}`);
    }
    audioBuf = sRes.buffer;
    actualExt = 'mp3';
  } else if (provider === 'local_gptsovits') {
    const sRes = await requestBuffer(`${endpoint}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        text_lang: lang === 'zh' ? 'zh' : 'ja',
        ref_audio_path: voiceId || '',
        prompt_lang: lang === 'zh' ? 'zh' : 'ja',
        speed_factor: speed
      }),
      timeoutMs: 35000
    });
    if (sRes.status < 200 || sRes.status >= 300 || sRes.buffer.length < 64) {
      throw new Error(`GPT-SoVITS 合成失败 (HTTP ${sRes.status}): ${sRes.buffer.toString('utf8').slice(0, 180)}`);
    }
    audioBuf = sRes.buffer;
    actualExt = 'wav';
  } else {
    // local_irodori or custom_webhook
    const targetUrl = provider === 'local_irodori' && !/\/(synthesize|tts)$/i.test(endpoint)
      ? `${endpoint}/synthesize`
      : endpoint;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const sRes = await requestBuffer(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text,
        charLabel,
        speaker: voiceId || charLabel || 'mano',
        voiceId: voiceId || charLabel || 'mano',
        language: lang,
        speed,
        emotion: body.emotion || 'joy'
      }),
      timeoutMs: 35000
    });
    if (sRes.status < 200 || sRes.status >= 300) {
      throw new Error(`TTS 接口返回错误 (HTTP ${sRes.status}): ${sRes.buffer.toString('utf8').slice(0, 180)}`);
    }
    const ctype = String(sRes.headers['content-type'] || '').toLowerCase();
    if (ctype.includes('json')) {
      const data = JSON.parse(sRes.buffer.toString('utf8'));
      if (data.audioBase64) {
        audioBuf = Buffer.from(data.audioBase64, 'base64');
        actualExt = data.format === 'mp3' ? 'mp3' : 'wav';
      } else if (data.audioUrl) {
        return { ok: true, provider, audioUrl: data.audioUrl, cached: false };
      } else {
        throw new Error('JSON 响应未包含 audioBase64 或 audioUrl');
      }
    } else {
      audioBuf = sRes.buffer;
      actualExt = ctype.includes('mpeg') || ctype.includes('mp3') ? 'mp3' : 'wav';
    }
  }

  const finalName = `tts_${charLabel || 'voice'}_${hash}.${actualExt}`;
  const finalPath = path.join(cacheDir, finalName);
  fs.writeFileSync(finalPath, audioBuf);
  return {
    ok: true,
    cached: false,
    provider,
    model,
    voiceId,
    filename: finalName,
    audioUrl: `/api/studio/tts/audio/${encodeURIComponent(finalName)}`,
    playerVoicePath: `_tts_cache/${finalName}`
  };
}

function serveTtsAudio(res, rawFilename, cacheDir) {
  const safeName = path.basename(String(rawFilename || ''));
  if (!safeName || safeName.includes('..')) {
    res.writeHead(400);
    res.end('Invalid filename');
    return;
  }
  const fullPath = path.join(cacheDir, safeName);
  if (!fs.existsSync(fullPath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const ext = path.extname(safeName).toLowerCase();
  const ctype = ext === '.mp3' ? 'audio/mpeg' : (ext === '.m4a' ? 'audio/mp4' : 'audio/wav');
  res.writeHead(200, { 'Content-Type': ctype, 'Cache-Control': 'public, max-age=3600' });
  fs.createReadStream(fullPath).pipe(res);
}

async function proxyVideoRemuxStatus(res, playerPort = 18899, playerHost = '127.0.0.1') {
  try {
    const r = await requestBuffer(`http://${playerHost}:${playerPort}/api/video-remux/status`, { timeoutMs: 2500 });
    res.writeHead(r.status || 200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(r.buffer);
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, available: false, reason: 'player_unreachable: ' + (err.message || err) }));
  }
}

function proxyVideoRemux(req, res, playerPort = 18899, playerHost = '127.0.0.1') {
  const targetReq = http.request({
    hostname: playerHost,
    port: playerPort,
    path: req.url,
    method: 'POST',
    headers: Object.assign({}, req.headers, { host: `${playerHost}:${playerPort}` })
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
  targetReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: '无法连接播放器转码服务 (:18899): ' + (err.message || err) }));
    }
  });
  req.pipe(targetReq);
}

module.exports = {
  DEFAULT_ENDPOINTS,
  DEFAULT_FISH_VOICE_MAP,
  previewCompile,
  getEidolonFishPresetInfo,
  prepareFishText,
  unwrapTtsPayload,
  checkTtsHealth,
  synthesizeTts,
  serveTtsAudio,
  proxyVideoRemuxStatus,
  proxyVideoRemux
};
