'use strict';
/**
 * Portable standalone server for ShinyColors Fanwork Studio (:18898/proto/)
 * Supports both local Windows workstation mode and Linux / Google Cloud single-port proxy mode:
 *   - Serves `/proto/` frontend with strict dotfile & backend-module isolation
 *   - Proxies `/player/*` and player APIs/assets (`/spine/*`, `/fg/*`, `/api/catalog*`, etc.) to `:18899`
 *   - Supports optional `STUDIO_ACCESS_TOKEN` guard for public cloud trials (free local use when unset)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SHINYCOLORS_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(SHINYCOLORS_ROOT, '..', '..');
const PROTO_DIR = path.join(SHINYCOLORS_ROOT, 'studio-proto');
const studioGateway = require(path.join(PROTO_DIR, 'studio-gateway.js'));
const POLISHER_CORE_FILE = path.join(SHINYCOLORS_ROOT, 'studio', 'lib', 'polisher-core.js');
const UI_MOCKUPS_DIR = path.join(SHINYCOLORS_ROOT, 'ui-mockups');

function readCliArg(flag) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && args[i + 1]) return args[i + 1];
    if (args[i].startsWith(flag + '=')) return args[i].slice(flag.length + 1);
  }
  return '';
}

function resolveEnzaRoot() {
  const envRoot = String(process.env.ENZA_ROOT || process.env.ENZA_DATA_ROOT || '').trim();
  if (envRoot) return path.resolve(envRoot);
  const mountCfg = path.join(SHINYCOLORS_ROOT, 'data', 'mount-config.json');
  try {
    if (fs.existsSync(mountCfg)) {
      const parsed = JSON.parse(fs.readFileSync(mountCfg, 'utf8'));
      if (parsed && typeof parsed.enzaRoot === 'string' && parsed.enzaRoot.trim()) {
        return path.resolve(parsed.enzaRoot.trim());
      }
    }
  } catch (_) {}
  const dataPathTxt = path.join(SHINYCOLORS_ROOT, 'desktop', 'data-path.txt');
  try {
    if (fs.existsSync(dataPathTxt)) {
      const lines = fs.readFileSync(dataPathTxt, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const clean = line.replace(/^\uFEFF/, '').trim();
        if (clean && !clean.startsWith('#')) return path.resolve(clean);
      }
    }
  } catch (_) {}
  return 'D:\\enza';
}

const PORT = parseInt(readCliArg('--port') || process.env.PORT || process.env.PROGRESS_PORT || process.env.STUDIO_PORT || '18898', 10) || 18898;
const HOST = String(readCliArg('--host') || process.env.STUDIO_HOST || '127.0.0.1').trim() || '127.0.0.1';
const PLAYER_HOST = String(readCliArg('--player-host') || process.env.PLAYER_HOST || '127.0.0.1').trim() || '127.0.0.1';
const PLAYER_PORT = parseInt(readCliArg('--player-port') || process.env.PLAYER_PORT || '18899', 10) || 18899;
const ACCESS_TOKEN = String(process.env.STUDIO_ACCESS_TOKEN || '').trim();
const SESSION_SALT = String(process.env.STUDIO_SESSION_SECRET || '').trim() || crypto.randomBytes(16).toString('hex');

function parseAccountsString(raw) {
  const list = [];
  const text = String(raw || '').trim();
  if (!text) return list;
  if (text.startsWith('[')) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (!item || typeof item !== 'object') continue;
          const id = String(item.id || item.username || item.user || '').trim();
          const password = String(item.password || item.pass || '').trim();
          const roleRaw = String(item.role || 'ai').trim().toLowerCase();
          const role = (roleRaw === 'admin' || roleRaw === 'full') ? 'admin' : 'ai';
          if (id && password) list.push({ id, password, role });
        }
      }
      return list;
    } catch (_) {}
  }
  for (const part of text.split(/[\r\n,;]+/)) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const segs = trimmed.split(':');
    if (segs.length < 2) continue;
    const id = String(segs[0] || '').trim();
    const password = String(segs[1] || '').trim();
    const roleRaw = String(segs[2] || 'ai').trim().toLowerCase();
    const role = (roleRaw === 'admin' || roleRaw === 'full') ? 'admin' : 'ai';
    if (id && password) list.push({ id, password, role });
  }
  return list;
}

function loadStudioAccounts() {
  const map = new Map();
  for (const a of parseAccountsString(process.env.STUDIO_USER_ACCOUNTS || '')) {
    map.set(a.id, a);
  }
  const candidates = [
    process.env.STUDIO_ACCOUNTS_FILE ? path.resolve(process.env.STUDIO_ACCOUNTS_FILE) : '',
    process.env.STUDIO_SECRETS_DIR ? path.join(path.resolve(process.env.STUDIO_SECRETS_DIR), 'studio_accounts.json') : '',
    path.join(SHINYCOLORS_ROOT, 'server', 'secrets', 'studio_accounts.json'),
    '/etc/shinycolors_accounts.json'
  ].filter(Boolean);
  for (const f of candidates) {
    try {
      if (!fs.existsSync(f)) continue;
      const raw = fs.readFileSync(f, 'utf8');
      for (const a of parseAccountsString(raw)) {
        map.set(a.id, a);
      }
    } catch (_) {}
  }
  return map;
}

function getSessionSigningSecret(accountsMap) {
  let accFp = '';
  for (const a of accountsMap.values()) accFp += `|${a.id}:${a.password}:${a.role}`;
  const base = (ACCESS_TOKEN || accFp) ? `${ACCESS_TOKEN}${accFp}` : SESSION_SALT;
  return crypto.createHash('sha256').update(`sc_studio_v1:${base}`).digest();
}

function createSignedSessionValue(userId, role, accountsMap) {
  const payloadObj = { u: String(userId || ''), r: role === 'admin' ? 'admin' : 'ai', ts: Date.now() };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSigningSecret(accountsMap)).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifySignedSessionValue(val, accountsMap) {
  const s = String(val || '').trim();
  const dot = s.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = s.slice(0, dot);
  const sig = s.slice(dot + 1);
  if (!payloadB64 || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', getSessionSigningSecret(accountsMap)).update(payloadB64).digest('base64url');
  if (!timingSafeTokenEq(sig, expectedSig)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const acc = obj && obj.u ? accountsMap.get(String(obj.u)) : null;
    if (!acc) return null;
    return { userId: acc.id, role: acc.role };
  } catch (_) {
    return null;
  }
}

const BLOCKED_PROTO_FILES = new Set([
  'studio-engine.js',
  'studio-gateway.js',
  'verify-studio-pack.js',
  'readme.md'
]);
const ALLOWED_PROTO_EXTS = new Set([
  '.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff2', '.ttf'
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg'
};

function safeJoin(root, rel) {
  const abs = path.resolve(root, rel);
  const base = path.resolve(root);
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}

function isSafeProtoRel(rel) {
  const norm = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm || norm.includes('..')) return false;
  const parts = norm.split('/').filter(Boolean);
  if (!parts.length) return false;
  for (const seg of parts) {
    if (seg.startsWith('.')) return false;
  }
  const baseLower = parts[parts.length - 1].toLowerCase();
  if (BLOCKED_PROTO_FILES.has(baseLower)) return false;
  const ext = path.extname(baseLower);
  return ALLOWED_PROTO_EXTS.has(ext);
}

function parseCookies(req) {
  const out = {};
  const raw = String((req && req.headers && req.headers.cookie) || '');
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch (_) {
      out[k] = v;
    }
  }
  return out;
}

function timingSafeTokenEq(a, b) {
  const ba = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (!ba.length || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function extractRequestToken(req) {
  const headers = (req && req.headers) || {};
  const xTok = String(headers['x-studio-token'] || '').trim();
  if (xTok) return xTok;
  const auth = String(headers.authorization || '').trim();
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  const cookies = parseCookies(req);
  return String(cookies.sc_studio_token || '').trim();
}

function getStudioAuthContext(req) {
  const accountsMap = loadStudioAccounts();
  const accountsEnabled = accountsMap.size > 0;
  const authRequired = Boolean(ACCESS_TOKEN || accountsEnabled);
  if (!authRequired) {
    return {
      authRequired: false,
      authenticated: true,
      canWrite: true,
      canUseServerKeys: process.env.STUDIO_DISABLE_SERVER_SECRETS !== '1',
      userId: 'local',
      role: 'local',
      accountsEnabled: false
    };
  }
  const supplied = extractRequestToken(req);
  if (ACCESS_TOKEN && timingSafeTokenEq(supplied, ACCESS_TOKEN)) {
    return {
      authRequired: true,
      authenticated: true,
      canWrite: true,
      canUseServerKeys: true,
      userId: 'admin',
      role: 'admin',
      accountsEnabled
    };
  }
  const cookies = parseCookies(req);
  const sess = verifySignedSessionValue(cookies.sc_studio_session, accountsMap);
  if (sess) {
    const isAdmin = sess.role === 'admin';
    return {
      authRequired: true,
      authenticated: true,
      canWrite: isAdmin,
      canUseServerKeys: true,
      userId: sess.userId,
      role: sess.role,
      accountsEnabled
    };
  }
  return {
    authRequired: true,
    authenticated: false,
    canWrite: false,
    canUseServerKeys: false,
    userId: '',
    role: 'guest',
    accountsEnabled
  };
}

function getStudioEngineSafe() {
  try {
    return require(path.join(PROTO_DIR, 'studio-engine.js'));
  } catch (_) {
    return null;
  }
}

function buildAuthStatusPayload(auth) {
  const a = auth || {};
  const canUse = Boolean(a.canUseServerKeys);
  const eng = canUse ? getStudioEngineSafe() : null;
  const serverLlm = (canUse && eng && typeof eng.getServerLlmPublicStatus === 'function')
    ? eng.getServerLlmPublicStatus(true)
    : null;
  return {
    ok: true,
    authRequired: Boolean(a.authRequired),
    authenticated: Boolean(a.authenticated),
    canWrite: Boolean(a.canWrite),
    canUseServerKeys: canUse,
    userId: String(a.userId || ''),
    role: String(a.role || 'guest'),
    accountsEnabled: Boolean(a.accountsEnabled),
    playerProxyPath: '/player/',
    serverLlm
  };
}

function isStudioAuthorized(req) {
  return getStudioAuthContext(req).authenticated;
}

function requireWriteAuth(req, res) {
  const auth = getStudioAuthContext(req);
  if (auth.canWrite) return true;
  sendJson(res, 401, {
    ok: false,
    authRequired: true,
    error: auth.authenticated
      ? `账号「${auth.userId}」仅解锁服务器 AI/语音 Key，保存修改到服务器需要管理员权限（您可随时导出到本地 .scpack.zip 或 MP4）。`
      : '当前为公网试用模式：保存修改或写入服务器需要访问口令或账号登录（您仍可随时「🎥 导出」到本地）。'
  });
  return false;
}

function sanitizeClientLlmBody(body, req) {
  const clean = Object.assign({}, body || {});
  delete clean._allowServerSecrets;
  delete clean._disallowServerSecrets;
  const cfg = Object.assign({}, (clean.llmConfig && typeof clean.llmConfig === 'object') ? clean.llmConfig : {});
  delete cfg._disallowServerSecrets;
  delete cfg._allowServerSecrets;
  const auth = getStudioAuthContext(req);
  if (!auth.canUseServerKeys) {
    const clientKey = String(cfg.apiKey || '').trim();
    if (!clientKey || clientKey === '__vertex_sa__') {
      return {
        allowed: false,
        body: clean,
        error: '公网试用模式：调用服务器 AI 需要使用授权账号登录或输入口令，或在「🔌 接口与语音」填写你自己的 API Key。'
      };
    }
    cfg._disallowServerSecrets = true;
  } else {
    cfg._allowServerSecrets = true;
  }
  clean.llmConfig = cfg;
  return { allowed: true, body: clean };
}

function sanitizeClientTtsBody(body, req) {
  const clean = Object.assign({}, body || {});
  delete clean._disallowServerSecrets;
  delete clean._allowServerSecrets;
  if (clean.ttsConfig && typeof clean.ttsConfig === 'object') {
    clean.ttsConfig = Object.assign({}, clean.ttsConfig);
    delete clean.ttsConfig._disallowServerSecrets;
    delete clean.ttsConfig._allowServerSecrets;
  }
  const auth = getStudioAuthContext(req);
  if (!auth.canUseServerKeys) {
    const merged = studioGateway.unwrapTtsPayload(clean);
    const provider = String(merged.provider || 'off').trim();
    const clientKey = String(merged.apiKey || '').trim();
    if (provider !== 'off' && (provider === 'local_irodori' || provider === 'local_voicevox' || provider === 'local_gptsovits' || provider === 'custom_webhook' || !clientKey)) {
      return {
        allowed: false,
        body: clean,
        error: '公网试用模式：使用服务器配音额度需要授权账号登录或输入口令，或在「🔌 接口与语音」选择云端 TTS 并填写你自己的 API Key。'
      };
    }
    if (provider === 'cloud_fish' || provider === 'cloud_openai') {
      clean.endpoint = studioGateway.DEFAULT_ENDPOINTS[provider];
      if (clean.ttsConfig) clean.ttsConfig.endpoint = studioGateway.DEFAULT_ENDPOINTS[provider];
    }
    clean._disallowServerSecrets = true;
    if (clean.ttsConfig) clean.ttsConfig._disallowServerSecrets = true;
  } else {
    clean._allowServerSecrets = true;
    if (clean.ttsConfig) clean.ttsConfig._allowServerSecrets = true;
  }
  return { allowed: true, body: clean };
}

function sendFileIfExists(res, filePath, contentType, cacheControl = 'public, max-age=86400') {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': cacheControl
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function findAndSendCandidate(res, candidates, defaultMime, cacheControl) {
  for (const c of candidates) {
    if (!c) continue;
    const ext = path.extname(c).toLowerCase();
    const mime = (typeof defaultMime === 'function' ? defaultMime(ext) : defaultMime) || MIME[ext] || 'application/octet-stream';
    if (sendFileIfExists(res, c, mime, cacheControl)) return true;
  }
  return false;
}

function readJsonBody(req, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, code, obj, extraHeaders = {}) {
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, extraHeaders));
  res.end(JSON.stringify(obj));
}

function proxyToPlayer(req, res, targetPath) {
  const headers = Object.assign({}, req.headers, {
    host: `${PLAYER_HOST}:${PLAYER_PORT}`
  });
  if (ACCESS_TOKEN && isStudioAuthorized(req) && !headers['x-studio-token']) {
    headers['x-studio-token'] = ACCESS_TOKEN;
  }
  const proxyReq = http.request({
    hostname: PLAYER_HOST,
    port: PLAYER_PORT,
    path: targetPath,
    method: req.method,
    headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      const accept = String((req.headers && req.headers.accept) || '');
      if (accept.includes('text/html') && !String(targetPath).startsWith('/api/')) {
        res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#111827;color:#e5e7eb;padding:28px;">
          <h3>🎭 真 Spine 舞台播放器 (${PLAYER_HOST}:${PLAYER_PORT}) 暂未启动</h3>
          <p>请确认播放器服务 <code>enza-server.js</code> 已运行，然后点击右上「↻ 刷新舞台」。</p>
          <p style="color:#9ca3af;font-size:12px;">Error: ${String(err.message || err).replace(/[<>&]/g, '')}</p>
        </body>`);
      } else {
        sendJson(res, 502, { ok: false, error: `无法连接播放器服务 (${PLAYER_HOST}:${PLAYER_PORT}): ${err.message || err}` });
      }
    }
  });
  req.pipe(proxyReq);
}

function isPlayerOnlyRoute(u) {
  return (
    u.startsWith('/lib/') ||
    u.startsWith('/spine/') ||
    u.startsWith('/fg/') ||
    u.startsWith('/middlefg/') ||
    u.startsWith('/still/') ||
    u.startsWith('/unit-logo/') ||
    u.startsWith('/logframe/') ||
    u.startsWith('/icon/') ||
    u.startsWith('/avatar/') ||
    u.startsWith('/movie/') ||
    u.startsWith('/se/') ||
    u === '/progress' ||
    u === '/progress/' ||
    u === '/editor' ||
    u === '/editor/' ||
    u === '/editor.css' ||
    u === '/editor.js' ||
    u === '/favicon.ico' ||
    u === '/api/catalog' ||
    u.startsWith('/api/catalog/') ||
    u === '/api/script' ||
    u === '/api/list' ||
    u === '/api/categories' ||
    u === '/api/title-zh' ||
    u === '/api/char-map' ||
    u === '/api/animations' ||
    u === '/api/idol-outfits' ||
    u.startsWith('/api/scsp/') ||
    u === '/api/mount-status' ||
    u === '/api/mount-config' ||
    u === '/api/imported-scripts' ||
    u.startsWith('/api/imported-scripts/') ||
    u === '/api/import-script' ||
    u === '/api/custom-raw' ||
    u === '/api/save-custom' ||
    u === '/api/progress' ||
    u === '/api/app/version'
  );
}

/**
 * Support both `<enzaRoot>/assets/{spine,images,sounds}` and flat `<enzaRoot>/{spine,images,sounds}` tar extracts.
 */
function resolveEnzaAssetsDir(rootDir) {
  if (!rootDir) return '';
  const withAssets = path.join(rootDir, 'assets');
  if (fs.existsSync(withAssets)) return withAssets;
  if (
    fs.existsSync(path.join(rootDir, 'spine')) ||
    fs.existsSync(path.join(rootDir, 'images')) ||
    fs.existsSync(path.join(rootDir, 'sounds'))
  ) {
    return rootDir;
  }
  return withAssets;
}

function collectPackBgCandidates(rawId) {
  const candidates = [];
  for (const rootSub of ['projects_workspace', path.join('examples', 'scproj')]) {
    const rootDir = path.join(SHINYCOLORS_ROOT, rootSub);
    if (!fs.existsSync(rootDir)) continue;
    for (const ent of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!ent.isDirectory() || !ent.name.endsWith('.scpack')) continue;
      const pkDir = path.join(rootDir, ent.name);
      const packJsonPath = path.join(pkDir, 'pack.json');
      if (fs.existsSync(packJsonPath)) {
        try {
          const pj = JSON.parse(fs.readFileSync(packJsonPath, 'utf8'));
          const bgRec = pj && pj.assets && pj.assets.bg && pj.assets.bg[rawId];
          if (bgRec && bgRec.file) candidates.push(safeJoin(pkDir, bgRec.file));
        } catch (_) {}
      }
      const bgDir = path.join(pkDir, 'assets', 'bg');
      for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
        candidates.push(safeJoin(bgDir, rawId + ext));
      }
    }
  }
  return candidates;
}

const server = http.createServer((req, res) => {
  const origin = String((req.headers && req.headers.origin) || '');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Studio-Token');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const u = decodeURIComponent(parsedUrl.pathname);

  if (u === '/' || u === '/proto') {
    res.writeHead(302, { Location: '/proto/' });
    res.end();
    return;
  }

  if (u === '/player') {
    res.writeHead(302, { Location: '/player/' });
    res.end();
    return;
  }

  if (u.startsWith('/player/')) {
    const suffix = (req.url || '/player/').slice('/player'.length) || '/';
    if (req.method !== 'GET' && req.method !== 'HEAD' && !requireWriteAuth(req, res)) return;
    proxyToPlayer(req, res, suffix.startsWith('/') ? suffix : '/' + suffix);
    return;
  }

  if (isPlayerOnlyRoute(u)) {
    const isMutatingPlayerRoute = req.method !== 'GET' && req.method !== 'HEAD';
    if (isMutatingPlayerRoute && !requireWriteAuth(req, res)) return;
    proxyToPlayer(req, res, req.url || u);
    return;
  }

  if (u.startsWith('/proto/')) {
    const rel = u === '/proto/' ? 'index.html' : u.slice('/proto/'.length);
    if (!isSafeProtoRel(rel)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const file = safeJoin(PROTO_DIR, rel);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
    return;
  }

  if (u === '/ui-mockups' || u === '/ui-mockups/' || u.startsWith('/ui-mockups/')) {
    const rel = u.replace(/^\/ui-mockups\/?/, '') || 'index.html';
    const file = safeJoin(UI_MOCKUPS_DIR, rel);
    if (file && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      fs.createReadStream(file).pipe(res);
      return;
    }
  }

  if (req.method === 'GET' && u === '/api/studio/auth-status') {
    const auth = getStudioAuthContext(req);
    sendJson(res, 200, buildAuthStatusPayload(auth));
    return;
  }

  if (req.method === 'POST' && u === '/api/studio/auth') {
    readJsonBody(req)
      .then((body) => {
        const accountsMap = loadStudioAccounts();
        const authRequiredNow = Boolean(ACCESS_TOKEN || accountsMap.size > 0);
        if (!authRequiredNow) {
          sendJson(res, 200, buildAuthStatusPayload({
            authRequired: false,
            authenticated: true,
            canWrite: true,
            canUseServerKeys: process.env.STUDIO_DISABLE_SERVER_SECRETS !== '1',
            userId: 'local',
            role: 'local',
            accountsEnabled: false
          }));
          return;
        }
        const username = String((body && (body.username || body.id || body.userId)) || '').trim();
        const password = String((body && (body.password || body.pass)) || '').trim();
        const tok = String((body && body.token) || '').trim();
        if (username) {
          const acc = accountsMap.get(username);
          const pwdToCheck = password || tok;
          if (!acc || !timingSafeTokenEq(pwdToCheck, acc.password)) {
            sendJson(res, 403, { ok: false, error: '账号 ID 或密码不正确' });
            return;
          }
          const sessVal = createSignedSessionValue(acc.id, acc.role, accountsMap);
          const cookieVal = `sc_studio_session=${encodeURIComponent(sessVal)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
          const isAdmin = acc.role === 'admin';
          sendJson(res, 200, buildAuthStatusPayload({
            authRequired: true,
            authenticated: true,
            canWrite: isAdmin,
            canUseServerKeys: true,
            userId: acc.id,
            role: acc.role,
            accountsEnabled: true
          }), { 'Set-Cookie': cookieVal });
          return;
        }
        if (!ACCESS_TOKEN || !timingSafeTokenEq(tok || password, ACCESS_TOKEN)) {
          sendJson(res, 403, { ok: false, error: accountsMap.size > 0 ? '访问口令或账号密码不正确' : '访问口令不正确' });
          return;
        }
        const cookieVal = `sc_studio_token=${encodeURIComponent(ACCESS_TOKEN)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
        sendJson(res, 200, buildAuthStatusPayload({
          authRequired: true,
          authenticated: true,
          canWrite: true,
          canUseServerKeys: true,
          userId: 'admin',
          role: 'admin',
          accountsEnabled: accountsMap.size > 0
        }), { 'Set-Cookie': cookieVal });
      })
      .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
    return;
  }

  if (req.method === 'POST' && u === '/api/studio/logout') {
    const accountsMap = loadStudioAccounts();
    const authRequiredNow = Boolean(ACCESS_TOKEN || accountsMap.size > 0);
    const canUseAfterLogout = !authRequiredNow && process.env.STUDIO_DISABLE_SERVER_SECRETS !== '1';
    sendJson(
      res,
      200,
      buildAuthStatusPayload({
        authRequired: authRequiredNow,
        authenticated: !authRequiredNow,
        canWrite: !authRequiredNow,
        canUseServerKeys: canUseAfterLogout,
        userId: authRequiredNow ? '' : 'local',
        role: authRequiredNow ? 'guest' : 'local',
        accountsEnabled: accountsMap.size > 0
      }),
      {
        'Set-Cookie': [
          'sc_studio_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
          'sc_studio_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
        ]
      }
    );
    return;
  }

  if (req.method === 'GET' && u === '/api/studio/polisher-core.js') {
    if (!fs.existsSync(POLISHER_CORE_FILE)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('polisher-core.js not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(POLISHER_CORE_FILE).pipe(res);
    return;
  }

  if (u.startsWith('/api/studio/')) {
    let studioEngine;
    try {
      studioEngine = require(path.join(PROTO_DIR, 'studio-engine.js'));
    } catch (err) {
      sendJson(res, 500, { ok: false, error: 'Failed to load studio-engine.js: ' + err.message });
      return;
    }

    if (req.method === 'GET' && u === '/api/studio/outfits') {
      try {
        sendJson(res, 200, Object.assign({ ok: true }, studioEngine.getIdolOutfits()));
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method === 'GET' && u === '/api/studio/bg-catalog') {
      try {
        const items = studioEngine.getSemanticBgList({ includeAbstract: true, limit: 5000 }).map((b) => ({
          id: b.id,
          title: b.zhLabel || b.id,
          zhLabel: b.zhLabel || b.id,
          category: b.category || 'scenic',
          timeOfDay: b.timeOfDay || '',
          weather: b.weather || '',
          indoorOutdoor: b.indoorOutdoor || '',
          tags: [b.zhLabel, b.category, b.timeOfDay, b.weather, b.indoorOutdoor, ...(b.tags || [])].filter(Boolean).join(' '),
          usageCount: b.usageCount || 0
        }));
        sendJson(res, 200, { ok: true, items, count: items.length });
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method === 'GET' && u === '/api/studio/bgm-catalog') {
      try {
        const items = studioEngine.getEnrichedBgmCatalog().map((m) => ({
          id: m.id,
          title: m.title,
          zhLabel: m.zhLabel,
          label: m.label,
          kindTag: m.kindTag,
          category: m.category,
          avoidAutoBgm: Boolean(m.avoidAutoBgm),
          moodTags: m.moodTags,
          emotion: m.dominantEmotion || (m.moodTags && m.moodTags[0]) || 'calm',
          durationSec: m.durationSec,
          sceneHints: m.sceneHints,
          curated: m.curated,
          tags: [m.title, m.label, m.category, m.dominantEmotion, ...(m.moodTags || []), ...(m.sceneHints || []), ...(m.tags || [])].filter(Boolean).join(' '),
          usageCount: m.usageCount || 0
        }));
        sendJson(res, 200, { ok: true, items, count: items.length });
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method === 'GET' && u === '/api/studio/projects') {
      try {
        const isLite = String(req.url || '').includes('lite=1');
        const payload = {
          ok: true,
          projects: studioEngine.listAllProjects(),
          idolMeta: studioEngine.IDOL_META,
          emotionPresets: studioEngine.EMOTION_PRESETS
        };
        if (!isLite) payload.idolOutfits = studioEngine.getIdolOutfits();
        sendJson(res, 200, payload);
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/projects') {
      if (!requireWriteAuth(req, res)) return;
      readJsonBody(req)
        .then((body) => {
          const project = studioEngine.createNewProject(body || {});
          const projects = studioEngine.listAllProjects();
          sendJson(res, 200, { ok: true, project, projects });
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/projects/import-zip') {
      if (!requireWriteAuth(req, res)) return;
      readJsonBody(req, 80 * 1024 * 1024)
        .then((body) => {
          const raw = String((body && (body.dataUrl || body.base64)) || '').trim();
          const b64 = raw.includes(',') ? raw.split(',').slice(1).join(',') : raw;
          if (!b64) throw new Error('缺少 ZIP 文件内容');
          const zipBuf = Buffer.from(b64.replace(/\s+/g, ''), 'base64');
          const result = studioEngine.importProjectFromZipBuffer(zipBuf, {
            overwrite: Boolean(body && body.overwrite)
          });
          sendJson(res, 200, result);
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    const exportZipMatch = u.match(/^\/api\/studio\/projects\/([^/]+)\/export-zip$/);
    if (req.method === 'GET' && exportZipMatch) {
      const pid = decodeURIComponent(exportZipMatch[1]);
      try {
        const pkg = studioEngine.exportProjectAsZipBuffer(pid);
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${pkg.filename}"`,
          'Content-Length': pkg.buffer.length,
          'Cache-Control': 'no-store'
        });
        res.end(pkg.buffer);
      } catch (err) {
        sendJson(res, 404, { ok: false, error: err.message });
      }
      return;
    }

    const uploadAssetMatch = u.match(/^\/api\/studio\/projects\/([^/]+)\/upload-asset$/);
    if (req.method === 'POST' && uploadAssetMatch) {
      if (!requireWriteAuth(req, res)) return;
      const pid = decodeURIComponent(uploadAssetMatch[1]);
      readJsonBody(req, 24 * 1024 * 1024)
        .then((body) => {
          const result = studioEngine.saveProjectUploadedAsset(pid, body || {});
          const projects = studioEngine.listAllProjects();
          sendJson(res, 200, Object.assign({ projects }, result));
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    const compileAllMatch = u.match(/^\/api\/studio\/projects\/([^/]+)\/(?:compile-all|merged-scproj)$/);
    if (compileAllMatch && (req.method === 'GET' || req.method === 'POST')) {
      const pid = decodeURIComponent(compileAllMatch[1]);
      const runCompile = (body) => {
        try {
          const merged = studioEngine.compileFullProjectToScproj(pid, body && body.scenes);
          sendJson(res, 200, Object.assign({ ok: true }, merged));
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message });
        }
      };
      if (req.method === 'POST') {
        readJsonBody(req).then(runCompile).catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      } else {
        runCompile({});
      }
      return;
    }

    const sceneMatch = u.match(/^\/api\/studio\/projects\/([^/]+)\/scenes$/);
    if (req.method === 'POST' && sceneMatch) {
      if (!requireWriteAuth(req, res)) return;
      const pid = decodeURIComponent(sceneMatch[1]);
      readJsonBody(req)
        .then((body) => {
          const result = studioEngine.upsertOrManageProjectScene(pid, body || {});
          const projects = studioEngine.listAllProjects();
          sendJson(res, 200, Object.assign({ ok: true, projects }, result));
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    const importExtMatch = u.match(/^\/api\/studio\/projects\/([^/]+)\/import-external$/);
    if (req.method === 'POST' && importExtMatch) {
      if (!requireWriteAuth(req, res)) return;
      const pid = decodeURIComponent(importExtMatch[1]);
      readJsonBody(req)
        .then((body) => {
          const b = body || {};
          const rawInput = b.content !== undefined ? b.content : (b.raw !== undefined ? b.raw : b);
          const result = studioEngine.importExternalScriptToProject(pid, rawInput, {
            title: b.title || '',
            fileBaseName: b.fileBaseName || ''
          });
          const projects = studioEngine.listAllProjects();
          sendJson(res, 200, Object.assign({ ok: true, projects }, result));
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/test-llm') {
      readJsonBody(req)
        .then(async (raw) => {
          const wrapped = (raw && raw.llmConfig) ? raw : { llmConfig: raw || {} };
          const pol = sanitizeClientLlmBody(wrapped, req);
          if (!pol.allowed) {
            sendJson(res, 401, { ok: false, authRequired: true, error: pol.error });
            return;
          }
          const resObj = await studioEngine.testLlmConnection(pol.body.llmConfig);
          sendJson(res, 200, resObj);
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/expand-outline') {
      readJsonBody(req)
        .then(async (raw) => {
          const pol = sanitizeClientLlmBody(raw, req);
          const body = pol.body;
          if (body.applyToProject && !requireWriteAuth(req, res)) return;
          if (!pol.allowed) {
            sendJson(res, 401, { ok: false, authRequired: true, error: pol.error });
            return;
          }
          const exp = await studioEngine.expandOutlineWithLlmOrTemplate({
            prompt: body.prompt || '',
            cast: body.cast || [],
            title: body.projectTitle || body.title || '',
            llmConfig: body.llmConfig
          });
          const outlines = exp.scenes || [];
          let updated = null;
          if (body.projectId && body.applyToProject) {
            updated = studioEngine.upsertOrManageProjectScene(body.projectId, {
              action: 'replace_outlines',
              outlines
            });
          }
          sendJson(res, 200, {
            ok: true,
            generator: exp.generator || 'template',
            generatorLabel: exp.generatorLabel || '⚡ 本地模板生成',
            model: exp.model || null,
            llmWarning: exp.llmWarning || null,
            detectedCast: exp.detectedCast || [],
            outlines,
            project: updated ? updated.project : null,
            projects: updated ? studioEngine.listAllProjects() : undefined
          });
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/enrich-segments') {
      readJsonBody(req)
        .then(async (raw) => {
          const pol = sanitizeClientLlmBody(raw, req);
          if (!pol.allowed) {
            sendJson(res, 401, { ok: false, authRequired: true, error: pol.error });
            return;
          }
          const body = pol.body;
          const out = await studioEngine.enrichSceneSegmentsWithLlmOrTemplate({
            scene: body.scene || {},
            projectPremise: body.projectPremise || '',
            storyContext: body.storyContext || null,
            llmConfig: body.llmConfig
          });
          sendJson(res, 200, out);
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/sanitize-actions') {
      readJsonBody(req)
        .then((body) => {
          const rows = studioEngine.sanitizeStageActions(Array.isArray(body.rows) ? body.rows : []);
          sendJson(res, 200, { ok: true, rows });
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/expand-script') {
      readJsonBody(req)
        .then(async (raw) => {
          const pol = sanitizeClientLlmBody(raw, req);
          if (!pol.allowed) {
            sendJson(res, 401, { ok: false, authRequired: true, error: pol.error });
            return;
          }
          const body = pol.body;
          const outline = Object.assign({}, body.outline || body, {
            _forceRegenerate: Boolean(body.forceRegenerate)
          });
          const exp = await studioEngine.expandScriptWithLlmOrTemplate({
            outline,
            depth: body.depth || 'standard',
            existingRows: Array.isArray(body.existingRows) ? body.existingRows : [],
            storyContext: body.storyContext || null,
            llmConfig: body.llmConfig
          });
          sendJson(res, 200, {
            ok: true,
            sceneId: outline.sceneId || 'scene_01',
            generator: exp.generator || 'template',
            generatorLabel: exp.generatorLabel || '⚡ 本地模板生成',
            model: exp.model || null,
            llmWarning: exp.llmWarning || null,
            scriptRows: exp.scriptRows,
            oocSummary: exp.oocSummary
          });
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/compile-scene') {
      if (!requireWriteAuth(req, res)) return;
      readJsonBody(req)
        .then((body) => {
          const pid = body.projectId || 'island_survival_pack';
          const result = studioEngine.upsertOrManageProjectScene(pid, Object.assign({ action: 'compile' }, body));
          const projects = studioEngine.listAllProjects();
          sendJson(res, 200, Object.assign({ ok: true, projects }, result));
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/expand-beat' && typeof studioEngine.expandBeatWithLlmOrTemplate === 'function') {
      readJsonBody(req)
        .then(async (raw) => {
          const pol = sanitizeClientLlmBody(raw, req);
          const body = pol.body;
          if (body.applyToProject && !requireWriteAuth(req, res)) return;
          if (!pol.allowed) {
            sendJson(res, 401, { ok: false, authRequired: true, error: pol.error });
            return;
          }
          const result = await studioEngine.expandBeatWithLlmOrTemplate(body);
          const projects = result.project ? studioEngine.listAllProjects() : undefined;
          sendJson(res, 200, Object.assign({ ok: true, projects }, result));
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/generate-reaction' && typeof studioEngine.generateIdolReaction === 'function') {
      readJsonBody(req)
        .then(async (raw) => {
          const pol = sanitizeClientLlmBody(raw, req);
          if (!pol.allowed && pol.body.useLlm) {
            sendJson(res, 401, { ok: false, authRequired: true, error: pol.error });
            return;
          }
          const result = await studioEngine.generateIdolReaction(pol.body);
          sendJson(res, 200, result);
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/compile-reaction-pack' && typeof studioEngine.compileReactionPackToScproj === 'function') {
      if (!requireWriteAuth(req, res)) return;
      readJsonBody(req)
        .then((body) => {
          const result = studioEngine.compileReactionPackToScproj(body || {});
          const projects = studioEngine.listAllProjects();
          sendJson(res, 200, Object.assign({ ok: true, projects }, result));
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'GET' && u === '/api/studio/scsp-summary' && typeof studioEngine.getScspSummary === 'function') {
      try {
        sendJson(res, 200, studioEngine.getScspSummary());
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method === 'GET' && u === '/api/studio/scsp-lines' && typeof studioEngine.getScspLines === 'function') {
      try {
        const char = parsedUrl.searchParams.get('char') || 'hana';
        const q = parsedUrl.searchParams.get('q') || '';
        const limit = Number(parsedUrl.searchParams.get('limit')) || 16;
        sendJson(res, 200, studioEngine.getScspLines({ char, q, limit }));
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/director-chat' && typeof studioEngine.directorChatWithLlm === 'function') {
      readJsonBody(req)
        .then(async (raw) => {
          const pol = sanitizeClientLlmBody(raw, req);
          if (!pol.allowed) {
            sendJson(res, 401, { ok: false, authRequired: true, error: pol.error });
            return;
          }
          sendJson(res, 200, await studioEngine.directorChatWithLlm(pol.body));
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/preview-compile') {
      readJsonBody(req)
        .then((body) => sendJson(res, 200, studioGateway.previewCompile(studioEngine, body || {})))
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/tts/cleanup-cache') {
      if (!requireWriteAuth(req, res)) return;
      readJsonBody(req)
        .then((body) => {
          const result = studioEngine.cleanupUnusedTtsCache(body || {});
          sendJson(res, 200, result);
        })
        .catch((err) => sendJson(res, 400, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'GET' && u === '/api/studio/tts/eidolon-preset') {
      try {
        const auth = getStudioAuthContext(req);
        if (!auth.canUseServerKeys) {
          sendJson(res, 200, {
            ok: true,
            available: false,
            hasLocalKey: false,
            defaultModel: 'drama-3',
            endpoint: studioGateway.DEFAULT_ENDPOINTS.cloud_fish,
            voiceCount: Object.keys(studioGateway.DEFAULT_FISH_VOICE_MAP).length,
            readingsCount: 0,
            voiceMap: studioGateway.DEFAULT_FISH_VOICE_MAP,
            sourceDb: ''
          });
          return;
        }
        const refresh = String(req.url || '').includes('refresh=1');
        sendJson(res, 200, studioGateway.getEidolonFishPresetInfo(refresh, { allowServerSecrets: true }));
      } catch (err) {
        sendJson(res, 500, { ok: false, error: err.message });
      }
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/tts/health') {
      readJsonBody(req)
        .then(async (raw) => {
          const pol = sanitizeClientTtsBody(raw, req);
          if (!pol.allowed) {
            sendJson(res, 200, { ok: false, authRequired: true, online: false, message: pol.error, detail: pol.error });
            return;
          }
          sendJson(res, 200, await studioGateway.checkTtsHealth(pol.body));
        })
        .catch((err) => sendJson(res, 500, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'POST' && u === '/api/studio/tts/synthesize') {
      const ttsCacheDir = path.join(SHINYCOLORS_ROOT, 'user_imports', '_tts_cache');
      readJsonBody(req)
        .then(async (raw) => {
          const pol = sanitizeClientTtsBody(raw, req);
          if (!pol.allowed) {
            sendJson(res, 401, { ok: false, authRequired: true, error: pol.error });
            return;
          }
          sendJson(res, 200, await studioGateway.synthesizeTts(pol.body, ttsCacheDir));
        })
        .catch((err) => sendJson(res, 500, { ok: false, error: err.message }));
      return;
    }

    if (req.method === 'GET' && u.startsWith('/api/studio/tts/audio/')) {
      const ttsCacheDir = path.join(SHINYCOLORS_ROOT, 'user_imports', '_tts_cache');
      studioGateway.serveTtsAudio(res, decodeURIComponent(u.slice('/api/studio/tts/audio/'.length)), ttsCacheDir);
      return;
    }
  }

  if (req.method === 'GET' && u === '/api/video-remux/status') {
    studioGateway.proxyVideoRemuxStatus(res, PLAYER_PORT, PLAYER_HOST);
    return;
  }
  if (req.method === 'POST' && u === '/api/video-remux') {
    studioGateway.proxyVideoRemux(req, res, PLAYER_PORT, PLAYER_HOST);
    return;
  }

  const ENZA_ROOT = resolveEnzaRoot();
  const ENZA_ASSETS = resolveEnzaAssetsDir(ENZA_ROOT);
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (u.startsWith('/font/')) {
      const name = path.basename(u.slice('/font/'.length));
      const fpath = name && !name.includes('..') ? safeJoin(path.join(ENZA_ASSETS, 'fonts'), name) : null;
      if (sendFileIfExists(res, fpath, name.toLowerCase().endsWith('.woff2') ? 'font/woff2' : 'font/ttf')) return;
      proxyToPlayer(req, res, req.url || u);
      return;
    }
    if (u.startsWith('/textframe/')) {
      const raw = path.basename(u.slice('/textframe/'.length)).replace(/\.png$/i, '');
      const fpath = raw && !raw.includes('..') ? safeJoin(path.join(ENZA_ASSETS, 'images', 'event', 'text_frame'), raw.padStart(3, '0') + '.png') : null;
      if (sendFileIfExists(res, fpath, 'image/png')) return;
      proxyToPlayer(req, res, req.url || u);
      return;
    }
    if (u.startsWith('/selectframe/')) {
      const raw = path.basename(u.slice('/selectframe/'.length)).replace(/\.png$/i, '');
      const fpath = raw && !raw.includes('..') ? safeJoin(path.join(ENZA_ASSETS, 'images', 'event', 'select_frame'), raw.padStart(3, '0') + '.png') : null;
      if (sendFileIfExists(res, fpath, 'image/png')) return;
      proxyToPlayer(req, res, req.url || u);
      return;
    }
    if (u.startsWith('/bg/')) {
      const raw = path.basename(u.slice('/bg/'.length)).replace(/\.(jpg|jpeg|png|webp)$/i, '');
      const candidates = raw && !raw.includes('..') ? [
        safeJoin(path.join(ENZA_ASSETS, 'images', 'event', 'bg'), raw + '.jpg'),
        safeJoin(path.join(ENZA_ASSETS, 'images', 'event', 'bg'), raw + '.png'),
        safeJoin(path.join(ENZA_ASSETS, 'images', 'bg'), raw + '.jpg'),
        safeJoin(path.join(ENZA_ASSETS, 'images', 'bg'), raw + '.png'),
        ...collectPackBgCandidates(raw)
      ] : [];
      if (findAndSendCandidate(res, candidates, (ext) => (ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg')))) return;
      proxyToPlayer(req, res, req.url || u);
      return;
    }
    if (u.startsWith('/voice/')) {
      const rel = u.slice('/voice/'.length).replace(/^\/+/, '');
      if (rel.startsWith('_tts_cache/')) {
        const ttsName = path.basename(rel.slice('_tts_cache/'.length));
        const ttsFile = ttsName && !ttsName.includes('..')
          ? safeJoin(path.join(SHINYCOLORS_ROOT, 'user_imports', '_tts_cache'), ttsName)
          : null;
        const ttsExt = path.extname(ttsName).toLowerCase();
        if (sendFileIfExists(res, ttsFile, MIME[ttsExt] || 'audio/wav')) return;
      }
      if (rel && !rel.includes('..')) {
        const voiceCandidates = [];
        const pushVoiceExts = (dir, baseOrFile) => {
          if (!dir || !baseOrFile) return;
          if (/\.(mp3|wav|m4a|ogg)$/i.test(baseOrFile)) {
            voiceCandidates.push(safeJoin(dir, baseOrFile));
          } else {
            for (const ext of ['.mp3', '.wav', '.m4a', '.ogg']) {
              voiceCandidates.push(safeJoin(dir, baseOrFile + ext));
            }
          }
        };
        if (rel.startsWith('custom/')) {
          const parts = rel.split('/').filter(Boolean);
          const packId = parts[1] || '';
          const filePart = path.basename(parts.slice(2).join('/'));
          if (packId && filePart && !packId.includes('..')) {
            pushVoiceExts(path.join(SHINYCOLORS_ROOT, 'projects_workspace', `${packId}.scpack`, 'assets', 'voice'), filePart);
            pushVoiceExts(path.join(SHINYCOLORS_ROOT, 'examples', 'scproj', `${packId}.scpack`, 'assets', 'voice'), filePart);
            pushVoiceExts(path.join(SHINYCOLORS_ROOT, 'user_imports', '_tts_cache'), filePart);
          }
        }
        const baseName = path.basename(rel);
        for (const rootSub of ['projects_workspace', path.join('examples', 'scproj')]) {
          const rootDir = path.join(SHINYCOLORS_ROOT, rootSub);
          if (fs.existsSync(rootDir)) {
            for (const ent of fs.readdirSync(rootDir, { withFileTypes: true })) {
              if (ent.isDirectory() && ent.name.endsWith('.scpack')) {
                pushVoiceExts(path.join(rootDir, ent.name, 'assets', 'voice'), baseName);
              }
            }
          }
        }
        pushVoiceExts(path.join(SHINYCOLORS_ROOT, 'user_imports', '_tts_cache'), baseName);
        if (findAndSendCandidate(res, voiceCandidates, (ext) => MIME[ext] || 'audio/mpeg', 'public, max-age=3600')) return;
      }
      const enzaVoice = rel ? safeJoin(path.join(ENZA_ROOT, 'voice', 'voice', 'events'), rel + (rel.endsWith('.m4a') ? '' : '.m4a')) : null;
      if (sendFileIfExists(res, enzaVoice, 'audio/mp4')) return;
      proxyToPlayer(req, res, req.url || u);
      return;
    }
    if (u.startsWith('/bgm/')) {
      const raw = path.basename(u.slice('/bgm/'.length)).replace(/\.m4a$/i, '');
      const bgmDir = path.join(ENZA_ASSETS, 'sounds', 'bgm');
      const candidates = raw && !raw.includes('..') ? [
        safeJoin(bgmDir, raw + '.m4a'),
        safeJoin(bgmDir, raw.padStart(3, '0') + '.m4a'),
        safeJoin(bgmDir, raw.padStart(4, '0') + '.m4a')
      ] : [];
      if (findAndSendCandidate(res, candidates, 'audio/mp4')) return;
      proxyToPlayer(req, res, req.url || u);
      return;
    }
    if (u.startsWith('/se-event/')) {
      const raw = path.basename(u.slice('/se-event/'.length)).replace(/\.m4a$/i, '');
      const seDir = path.join(ENZA_ASSETS, 'sounds', 'se', 'event');
      const candidates = raw && !raw.includes('..') ? [
        safeJoin(seDir, raw + '.m4a'),
        safeJoin(seDir, raw.padStart(4, '0') + '.m4a'),
        safeJoin(seDir, raw.padStart(3, '0') + '.m4a')
      ] : [];
      if (findAndSendCandidate(res, candidates, 'audio/mp4')) return;
      proxyToPlayer(req, res, req.url || u);
      return;
    }
    if (u.startsWith('/ref-wav/')) {
      const rel = u.slice('/ref-wav/'.length).replace(/^\/+/, '');
      const fpath = rel ? safeJoin(path.join(WORKSPACE_ROOT, 'amd-rocm-test', 'voices', 'sc_ref_candidates'), rel) : null;
      if (sendFileIfExists(res, fpath, 'audio/wav')) return;
    }
    if (u.startsWith('/tts-out/')) {
      const rel = u.slice('/tts-out/'.length).replace(/^\/+/, '');
      const candidates = rel ? [
        safeJoin(path.join(WORKSPACE_ROOT, 'amd-rocm-test', 'outputs'), rel),
        safeJoin(path.join(SHINYCOLORS_ROOT, 'examples', 'scproj', 'rooftop_after_rain.scpack', 'assets', 'voice'), rel),
        safeJoin(path.join(WORKSPACE_ROOT, 'projects', 'taibon', 'artifacts'), rel)
      ] : [];
      if (findAndSendCandidate(res, candidates, 'audio/wav', 'public, max-age=3600')) return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`ShinyColors Studio portable server listening at http://${HOST}:${PORT}/proto/ (player proxy -> ${PLAYER_HOST}:${PLAYER_PORT}, auth=${ACCESS_TOKEN ? 'ON' : 'OFF'})`);
  });
}

module.exports = { server, PORT, HOST, PLAYER_HOST, PLAYER_PORT, isSafeProtoRel };
