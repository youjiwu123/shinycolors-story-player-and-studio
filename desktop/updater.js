'use strict';

/*
 * enza 剧情播放器升级引擎（不依赖 Electron，便于单独测试）。
 *
 * 目录（均位于 %APPDATA%\enza-player）：
 *   versions\<version>\           已安装的 app 壳
 *   current.json                  原子指针 {version,path,previous}
 *   updates\downloads\*.zip       下载缓存
 *   updates\staging\<version>\app 已解压待启用的壳
 *   updates\pending.json          下次启动待启用记录
 *
 * 升级包 zip 约定：根目录下必须有 app\，其中含
 *   main-app.js server.js player.html version.json
 *   data\anim_whitelist.json data\name.csv
 * 数据目录（默认 D:\enza）完全不参与升级。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { fileURLToPath } = require('url');
const AdmZip = require('adm-zip');

const APP_NAME = 'enza-player';
const REQUIRED_APP_FILES = [
  'main-app.js',
  'server.js',
  'player.html',
  'icon.ico',
  'version.json',
  'data/anim_whitelist.json',
  'data/name.csv'
];

function compareVersions(a, b) {
  const parse = (value) => {
    const raw = String(value == null ? '' : value).trim().replace(/^v/i, '');
    const withoutBuild = raw.split('+')[0];
    const dash = withoutBuild.indexOf('-');
    const core = (dash < 0 ? withoutBuild : withoutBuild.slice(0, dash)).split('.').map((x) => {
      const n = parseInt(x, 10);
      return Number.isFinite(n) ? n : 0;
    });
    const pre = dash < 0 ? [] : withoutBuild.slice(dash + 1).split('.');
    return { core, pre };
  };
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.core.length, pb.core.length);
  for (let i = 0; i < len; i++) {
    const av = pa.core[i] || 0;
    const bv = pb.core[i] || 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  if (!pa.pre.length && !pb.pre.length) return 0;
  if (!pa.pre.length) return 1;
  if (!pb.pre.length) return -1;
  const plen = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < plen; i++) {
    const av = pa.pre[i];
    const bv = pb.pre[i];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    const an = /^\d+$/.test(av);
    const bn = /^\d+$/.test(bv);
    if (an && bn) {
      const ai = parseInt(av, 10);
      const bi = parseInt(bv, 10);
      if (ai !== bi) return ai > bi ? 1 : -1;
    } else if (an !== bn) {
      return an ? -1 : 1;
    } else if (av !== bv) {
      return av > bv ? 1 : -1;
    }
  }
  return 0;
}

function readJsonSafe(file) {
  try {
    return { value: JSON.parse(fs.readFileSync(file, 'utf8')), error: null };
  } catch (err) {
    return { value: null, error: err };
  }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.' + Date.now() + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n', 'utf8');
    try { fs.fsyncSync(fd); } catch (e) {}
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

function isInside(parent, child) {
  const p = path.resolve(parent);
  const c = path.resolve(child);
  return c === p || c.startsWith(p + path.sep);
}

function validateFeed(feed, source) {
  if (!feed || typeof feed !== 'object' || Array.isArray(feed)) {
    throw new Error('update.json 必须是 JSON 对象');
  }
  if (!feed.version || typeof feed.version !== 'string') {
    throw new Error('update.json 缺少 version');
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(feed.version.trim())) {
    throw new Error('update.json 的 version 不是合法版本号: ' + feed.version);
  }
  if (!feed.url || typeof feed.url !== 'string') {
    throw new Error('update.json 缺少 url');
  }
  let parsed;
  try {
    parsed = new URL(feed.url);
  } catch (e) {
    throw new Error('update.json 的 url 不是合法 URL');
  }
  if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) {
    throw new Error('update.json 的 url 只支持 http/https/file');
  }
  if (!/^[a-fA-F0-9]{64}$/.test(String(feed.sha256 || ''))) {
    throw new Error('update.json 的 sha256 必须是 64 位十六进制');
  }
  return {
    name: feed.name || APP_NAME,
    version: feed.version.trim(),
    url: feed.url,
    sha256: String(feed.sha256).toLowerCase(),
    notes: typeof feed.notes === 'string' ? feed.notes : '',
    channel: feed.channel || 'stable',
    source
  };
}

function findUpdateFeed({ exeDir, userDataDir }) {
  const candidates = [
    path.join(exeDir, 'update.json'),
    path.join(userDataDir, 'update.json')
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error('无法解析 ' + file + ': ' + err.message);
    }
    return { feed: validateFeed(raw, file), source: file, candidates };
  }
  return { feed: null, source: '', candidates };
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function downloadHttp(url, dest, onProgress, redirects) {
  const hops = redirects || 0;
  if (hops > 5) return Promise.reject(new Error('下载重定向次数过多'));
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(parsed, {
      headers: {
        'User-Agent': 'enza-player-updater/0.1',
        'Accept': 'application/octet-stream'
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, parsed).toString();
        downloadHttp(next, dest, onProgress, hops + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('下载失败：HTTP ' + res.statusCode));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
      let received = 0;
      const out = fs.createWriteStream(dest);
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        try { out.destroy(); } catch (e) {}
        try { fs.unlinkSync(dest); } catch (e) {}
        reject(err);
      };
      res.on('data', (chunk) => {
        received += chunk.length;
        if (onProgress) {
          try { onProgress(received, total); } catch (e) {}
        }
      });
      res.on('error', fail);
      out.on('error', fail);
      out.on('finish', () => {
        if (settled) return;
        settled = true;
        resolve({ bytes: received, total });
      });
      res.pipe(out);
    });
    req.setTimeout(30000, () => req.destroy(new Error('下载超时（30 秒无响应）')));
    req.on('error', reject);
  });
}

async function downloadFile(url, dest, onProgress) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const parsed = new URL(url);
  if (parsed.protocol === 'file:') {
    const src = fileURLToPath(parsed);
    await fs.promises.copyFile(src, dest);
    const stat = await fs.promises.stat(dest);
    if (onProgress) onProgress(stat.size, stat.size);
    return;
  }
  const part = dest + '.part';
  try { fs.unlinkSync(part); } catch (e) {}
  await downloadHttp(url, part, onProgress);
  try { fs.renameSync(part, dest); } catch (err) {
    try { fs.unlinkSync(part); } catch (e) {}
    throw err;
  }
}

function assertSafeEntryName(name) {
  const normalized = String(name || '').replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new Error('升级包包含绝对路径: ' + name);
  }
  const parts = normalized.split('/');
  if (parts.some((p) => p === '..')) {
    throw new Error('升级包包含目录穿越路径: ' + name);
  }
  return normalized;
}

function validateAppDir(appDir, expectedVersion) {
  if (!fs.existsSync(appDir) || !fs.statSync(appDir).isDirectory()) {
    throw new Error('app 目录不存在: ' + appDir);
  }
  for (const rel of REQUIRED_APP_FILES) {
    const file = path.join(appDir, ...rel.split('/'));
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      throw new Error('升级包缺少 ' + rel);
    }
    if (fs.statSync(file).size === 0) {
      throw new Error('升级包中的 ' + rel + ' 是空文件');
    }
  }
  const versionFile = path.join(appDir, 'version.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
  } catch (err) {
    throw new Error('version.json 无法解析: ' + err.message);
  }
  if (!manifest || manifest.name !== APP_NAME) {
    throw new Error('version.json 的 name 必须是 "' + APP_NAME + '"');
  }
  if (expectedVersion && manifest.version !== expectedVersion) {
    throw new Error('version.json 版本 ' + manifest.version + ' 与 update.json 版本 ' + expectedVersion + ' 不一致');
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(manifest.version || ''))) {
    throw new Error('version.json 的版本号不合法');
  }
  if (manifest.resources !== 'external') {
    throw new Error('version.json 的 resources 必须是 "external"');
  }
  return manifest;
}

function extractUpdateZip(zipPath, stagingRoot, expectedVersion) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  if (!entries.length) throw new Error('升级包是空 zip');
  let sawApp = false;
  const targetDir = path.join(stagingRoot, 'app');
  fs.rmSync(stagingRoot, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of entries) {
    const name = assertSafeEntryName(entry.entryName);
    if (entry.isDirectory) continue;
    if (!name.startsWith('app/')) continue;
    sawApp = true;
    const rel = name.slice('app/'.length);
    if (!rel) continue;
    const target = path.join(targetDir, ...rel.split('/'));
    if (!isInside(targetDir, target)) throw new Error('升级包文件越界: ' + entry.entryName);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.getData());
  }
  if (!sawApp) {
    throw new Error('升级包格式错误：zip 根目录下必须有 app/ 目录');
  }
  validateAppDir(targetDir, expectedVersion);
  return targetDir;
}

function userPaths(userDataDir) {
  return {
    versions: path.join(userDataDir, 'versions'),
    updates: path.join(userDataDir, 'updates'),
    downloads: path.join(userDataDir, 'updates', 'downloads'),
    staging: path.join(userDataDir, 'updates', 'staging'),
    pending: path.join(userDataDir, 'updates', 'pending.json'),
    current: path.join(userDataDir, 'current.json')
  };
}

function readCurrent(userDataDir) {
  const file = path.join(userDataDir, 'current.json');
  const rec = readJsonSafe(file);
  if (!rec.value || typeof rec.value !== 'object') return null;
  if (!rec.value.version || !rec.value.path) return null;
  const appDir = path.resolve(userDataDir, rec.value.path);
  if (!isInside(path.join(userDataDir, 'versions'), appDir)) return null;
  try {
    const manifest = validateAppDir(appDir, rec.value.version);
    return { ...rec.value, appDir, manifest };
  } catch (e) {
    return null;
  }
}

function activeAppOrFallback({ userDataDir, fallbackDir }) {
  const current = readCurrent(userDataDir);
  if (current) return { appDir: current.appDir, version: current.version, source: 'versioned', current };
  if (fallbackDir) {
    try {
      const manifest = validateAppDir(fallbackDir, null);
      return { appDir: fallbackDir, version: manifest.version, source: 'bundled' };
    } catch (e) {
      return null;
    }
  }
  return null;
}

function copyDir(source, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dst = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

function seedVersionedApp({ sourceDir, userDataDir, version }) {
  const paths = userPaths(userDataDir);
  const target = path.join(paths.versions, version);
  try {
    validateAppDir(sourceDir, version);
    fs.mkdirSync(paths.versions, { recursive: true });
    // 同版本重打包时，内置种子可能已经变化（player/icon/server）。只有在
    // 旧目标目录不完整时才替换，正常已安装/已升级版本不会被覆盖。
    if (fs.existsSync(target)) {
      try {
        validateAppDir(target, version);
      } catch (stale) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
    if (!fs.existsSync(target)) {
      const tmp = target + '.seeding-' + process.pid;
      fs.rmSync(tmp, { recursive: true, force: true });
      copyDir(sourceDir, tmp);
      validateAppDir(tmp, version);
      try {
        fs.renameSync(tmp, target);
      } catch (err) {
        if (err.code === 'EEXIST' || err.code === 'EPERM') {
          fs.rmSync(tmp, { recursive: true, force: true });
        } else {
          throw err;
        }
      }
    }
    validateAppDir(target, version);
    const current = readCurrent(userDataDir);
    if (!current) {
      writeJsonAtomic(paths.current, {
        version,
        path: path.relative(userDataDir, target).replace(/\\/g, '/'),
        previous: null,
        activatedAt: new Date().toISOString(),
        source: 'bundled-seed'
      });
    }
    return target;
  } catch (err) {
    // 打包资源通常位于只读目录；复制失败时仍可从原目录运行。
    return { error: err, appDir: sourceDir, version };
  }
}

async function stageUpdate({ feed, userDataDir, onProgress }) {
  const paths = userPaths(userDataDir);
  const version = feed.version;
  const zipPath = path.join(paths.downloads, APP_NAME + '-' + version + '.zip');
  let actualSha = '';
  if (fs.existsSync(zipPath)) {
    actualSha = await sha256File(zipPath);
    if (actualSha !== feed.sha256) {
      fs.rmSync(zipPath, { force: true });
      actualSha = '';
    }
  }
  if (!actualSha) {
    await downloadFile(feed.url, zipPath, onProgress);
    actualSha = await sha256File(zipPath);
    if (actualSha !== feed.sha256) {
      try { fs.rmSync(zipPath, { force: true }); } catch (e) {}
      throw new Error('sha256 校验失败：期望 ' + feed.sha256 + '，实际 ' + actualSha);
    }
  }
  fs.mkdirSync(paths.staging, { recursive: true });
  const stagingVersionRoot = path.join(paths.staging, version);
  const appDir = extractUpdateZip(zipPath, stagingVersionRoot, version);
  const pending = {
    name: APP_NAME,
    version,
    channel: feed.channel,
    sha256: feed.sha256,
    url: feed.url,
    notes: feed.notes,
    fromVersion: null,
    stagedApp: path.relative(userDataDir, appDir).replace(/\\/g, '/'),
    createdAt: new Date().toISOString()
  };
  writeJsonAtomic(paths.pending, pending);
  return { zipPath, appDir, pending, sha256: actualSha };
}

async function checkForUpdates(options) {
  const opts = options || {};
  const currentVersion = String(opts.currentVersion || '0.0.0');
  const userDataDir = opts.userDataDir;
  const exeDir = opts.exeDir;
  if (!userDataDir || !exeDir) throw new Error('checkForUpdates 需要 userDataDir 和 exeDir');
  const found = findUpdateFeed({ exeDir, userDataDir });
  if (!found.feed) {
    return {
      status: 'no-feed',
      currentVersion,
      checked: [...found.candidates],
      message: '未找到 update.json'
    };
  }
  const feed = found.feed;
  const cmp = compareVersions(feed.version, currentVersion);
  if (cmp <= 0) {
    return {
      status: 'up-to-date',
      currentVersion,
      feedVersion: feed.version,
      source: found.source,
      notes: feed.notes
    };
  }
  if (opts.download === false) {
    return {
      status: 'available',
      currentVersion,
      feedVersion: feed.version,
      source: found.source,
      feed,
      notes: feed.notes
    };
  }
  const staged = await stageUpdate({ feed, userDataDir, onProgress: opts.onProgress });
  return {
    status: 'staged',
    currentVersion,
    feedVersion: feed.version,
    source: found.source,
    notes: feed.notes,
    feed,
    ...staged
  };
}

function validatePending(pending, userDataDir) {
  if (!pending || typeof pending !== 'object') throw new Error('pending.json 不是对象');
  if (!pending.version || !pending.stagedApp) throw new Error('pending.json 缺少 version/stagedApp');
  const appDir = path.resolve(userDataDir, pending.stagedApp);
  const stagingRoot = path.join(userDataDir, 'updates', 'staging');
  if (!isInside(stagingRoot, appDir)) throw new Error('pending.json 的 stagedApp 越界');
  validateAppDir(appDir, pending.version);
  return { appDir, pending };
}

function pendingInfo(userDataDir) {
  const pendingPath = path.join(userDataDir, 'updates', 'pending.json');
  if (!fs.existsSync(pendingPath)) return null;
  const rec = readJsonSafe(pendingPath);
  return rec.value || null;
}

function promotePending({ userDataDir, logger }) {
  const log = typeof logger === 'function' ? logger : () => {};
  const paths = userPaths(userDataDir);
  if (!fs.existsSync(paths.pending)) return { status: 'none' };
  let pending;
  try {
    const rec = readJsonSafe(paths.pending);
    if (rec.error) throw rec.error;
    pending = rec.value;
  } catch (err) {
    log('pending.json 无法读取，保留旧版: ' + err.message);
    return { status: 'failed', error: err };
  }

  const current = readCurrent(userDataDir);
  if (current && compareVersions(pending.version, current.version) <= 0) {
    try { fs.rmSync(paths.pending, { force: true }); } catch (e) {}
    return { status: 'already-active', version: current.version };
  }

  let staged;
  try {
    staged = validatePending(pending, userDataDir);
  } catch (err) {
    try {
      fs.renameSync(paths.pending, paths.pending + '.failed-' + Date.now());
    } catch (e) {}
    log('待启用升级无效，保留旧版: ' + err.message);
    return { status: 'failed', error: err };
  }

  const target = path.join(paths.versions, pending.version);
  try {
    fs.mkdirSync(paths.versions, { recursive: true });
    if (!fs.existsSync(target)) {
      try {
        fs.renameSync(staged.appDir, target);
      } catch (err) {
        if (err.code === 'EXDEV') {
          copyDir(staged.appDir, target);
          fs.rmSync(staged.appDir, { recursive: true, force: true });
        } else {
          throw err;
        }
      }
    }
    validateAppDir(target, pending.version);
    current && log('准备从 ' + current.version + ' 切换到 ' + pending.version);
    // 最后一步：原子替换 current.json。此处失败时 current 仍指向旧版。
    writeJsonAtomic(paths.current, {
      version: pending.version,
      path: path.relative(userDataDir, target).replace(/\\/g, '/'),
      previous: current ? current.version : null,
      previousPath: current ? path.relative(userDataDir, current.appDir).replace(/\\/g, '/') : null,
      activatedAt: new Date().toISOString(),
      source: 'update'
    });
    try { fs.rmSync(paths.pending, { force: true }); } catch (e) {}
    try { fs.rmSync(path.join(paths.staging, pending.version), { recursive: true, force: true }); } catch (e) {}
    return {
      status: 'activated',
      version: pending.version,
      previous: current ? current.version : null,
      appDir: target
    };
  } catch (err) {
    log('切换新版本失败，保留旧版: ' + (err && err.stack ? err.stack : err));
    return { status: 'failed', error: err };
  }
}

function rollback({ userDataDir, logger }) {
  const log = typeof logger === 'function' ? logger : () => {};
  const paths = userPaths(userDataDir);
  const current = readCurrent(userDataDir);
  if (!current || !current.previous) {
    return { status: 'no-previous', currentVersion: current ? current.version : null };
  }
  const target = path.join(paths.versions, current.previous);
  try {
    validateAppDir(target, current.previous);
    writeJsonAtomic(paths.current, {
      version: current.previous,
      path: path.relative(userDataDir, target).replace(/\\/g, '/'),
      previous: current.version,
      previousPath: path.relative(userDataDir, current.appDir).replace(/\\/g, '/'),
      activatedAt: new Date().toISOString(),
      source: 'rollback'
    });
    log('已回滚 ' + current.version + ' -> ' + current.previous);
    return { status: 'rolled-back', from: current.version, version: current.previous, appDir: target };
  } catch (err) {
    log('回滚失败: ' + err.message);
    return { status: 'failed', error: err, currentVersion: current.version };
  }
}

function getInstallState(userDataDir) {
  const current = readCurrent(userDataDir);
  const pending = pendingInfo(userDataDir);
  return { current, pending };
}

module.exports = {
  APP_NAME,
  REQUIRED_APP_FILES,
  compareVersions,
  findUpdateFeed,
  sha256File,
  checkForUpdates,
  stageUpdate,
  promotePending,
  pendingInfo,
  getInstallState,
  readCurrent,
  activeAppOrFallback,
  seedVersionedApp,
  validateAppDir,
  userPaths,
  rollback
};
