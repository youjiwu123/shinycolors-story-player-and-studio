'use strict';

/**
 * enza 剧情播放器（不含编辑器）桌面壳入口。
 *
 * 这个文件位于 EXE 内置资源里，是稳定引导层：
 *   1. 解析数据目录并做启动校验；
 *   2. 启用上次已经暂存的新版 app 壳；
 *   3. 从版本化 app 目录加载 main-app.js（server/player 都在那里）；
 *   4. 提供检查更新/回滚菜单和可靠的子进程收尾。
 *
 * 升级只替换 %APPDATA%\enza-player\versions\<version>，不碰 D:\enza。
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');
const updater = require('./updater');

const APP_NAME = 'enza-player';
const DISPLAY_NAME = 'enza 剧情播放器';
const DEFAULT_DATA_ROOT = 'D:\\enza';
const IS_DEV = process.argv.includes('--dev');
const IS_PACKAGED = app.isPackaged;

function exeDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return path.resolve(process.env.PORTABLE_EXECUTABLE_DIR);
  if (process.env.PORTABLE_EXECUTABLE_FILE) return path.dirname(path.resolve(process.env.PORTABLE_EXECUTABLE_FILE));
  return IS_PACKAGED ? path.dirname(process.execPath) : __dirname;
}

// DSH/部分受限终端会把 EXE 标成 Low Integrity。Low 进程写不了
// %APPDATA%，Chromium 会在 app ready 前直接 c0000005 崩溃；并且它的
// 子进程沙箱也不可用。检测到 Low 时显式关沙箱，并把可写数据目录降级。
function isLowIntegrityProcess() {
  if (process.platform !== 'win32') return false;
  try {
    const who = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'whoami.exe');
    const r = spawnSync(who, ['/groups', '/fo', 'csv', '/nh'], {
      encoding: 'utf8', windowsHide: true, timeout: 4000
    });
    return /S-1-16-4096/.test(String(r.stdout || ''));
  } catch (e) {
    return false;
  }
}

function canWriteDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.write-probe-' + process.pid + '-' + Date.now());
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch (e) {
    return false;
  }
}

const LOW_INTEGRITY = isLowIntegrityProcess();
if (LOW_INTEGRITY) {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-crash-reporter');
}

const NORMAL_APP_DATA_DIR = path.join(app.getPath('appData'), 'enza-player');
function chooseAppDataDir() {
  const candidates = [
    NORMAL_APP_DATA_DIR,
    path.join(exeDir(), 'enza-player-data'),
    path.join(app.getPath('temp'), 'enza-player-data')
  ];
  for (const candidate of candidates) {
    if (canWriteDir(candidate)) {
      return {
        dir: candidate,
        mode: candidate === NORMAL_APP_DATA_DIR ? 'roaming' : 'adjacent-fallback'
      };
    }
  }
  return { dir: NORMAL_APP_DATA_DIR, mode: 'unwritable' };
}
const APP_DATA_CHOICE = chooseAppDataDir();
const APP_DATA_DIR = APP_DATA_CHOICE.dir;
const APP_DATA_MODE = APP_DATA_CHOICE.mode;

app.setName(APP_NAME);
app.setAppUserModelId('com.enza.player');
app.setPath('userData', APP_DATA_DIR);
try {
  const sessionDir = path.join(APP_DATA_DIR, 'session-data');
  fs.mkdirSync(sessionDir, { recursive: true });
  app.setPath('sessionData', sessionDir);
} catch (e) {}
try {
  const crashDir = path.join(APP_DATA_DIR, 'crash-dumps');
  fs.mkdirSync(crashDir, { recursive: true });
  app.setPath('crashDumps', crashDir);
} catch (e) {}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
if (process.env.ENZA_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
}

const LOG_DIR = path.join(APP_DATA_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'main.log');
let logReady = false;
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  logReady = true;
} catch (e) {}

const CONSOLE_LOG = !IS_PACKAGED || process.env.ENZA_CONSOLE === '1';
// 打包版没有稳定控制台；把 console 全部静音，避免 stdout 管道被关闭后
// 任何 console.log 触发异步 EPIPE 把主进程带崩。
if (IS_PACKAGED && process.env.ENZA_CONSOLE !== '1') {
  for (const key of ['log', 'info', 'warn', 'error', 'debug', 'trace']) {
    try { console[key] = function () {}; } catch (e) {}
  }
}

// 打包版从 Explorer 双击时没有有效的控制台；若 stdout 管道随后被关闭，
// Node 会在下一次 console.log 触发异步 EPIPE，不能让它杀掉播放器。
for (const stream of [process.stdout, process.stderr]) {
  if (!stream || typeof stream.on !== 'function') continue;
  stream.on('error', (err) => {
    if (err && (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED')) return;
  });
}

function log() {
  const text = Array.prototype.map.call(arguments, (v) => {
    if (v instanceof Error) return v.stack || v.message;
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }).join(' ');
  const line = '[' + new Date().toISOString() + '] ' + text;
  if (CONSOLE_LOG) {
    try { console.log(line); } catch (e) {}
  }
  if (logReady) {
    try { fs.appendFileSync(LOG_FILE, line + '\n', 'utf8'); } catch (e) {}
  }
}

function expandEnv(value) {
  return String(value).replace(/%([^%]+)%/g, (match, name) => {
    const v = process.env[name];
    return v === undefined ? match : v;
  });
}

function cleanPath(value) {
  let s = String(value == null ? '' : value).trim().replace(/^\uFEFF/, '');
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return expandEnv(s).trim();
}

function argValue(argv, name) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === name) return argv[i + 1] === undefined ? '' : argv[i + 1];
    if (arg.indexOf(name + '=') === 0) return arg.slice(name.length + 1);
  }
  return '';
}

function firstMeaningfulLine(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return ''; }
  for (const line of raw.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    return trimmed;
  }
  return '';
}

function resolveDataRoot(argv) {
  const explicit = cleanPath(argValue(argv, '--data-root') || process.env.ENZA_DATA_ROOT || '');
  if (explicit) {
    return {
      root: path.resolve(explicit),
      source: argValue(argv, '--data-root') ? '命令行 --data-root' : '环境变量 ENZA_DATA_ROOT',
      sourceFile: ''
    };
  }

  const mountCandidates = [
    path.join(exeDir(), 'data', 'mount-config.json'),
    path.join(__dirname, '..', 'data', 'mount-config.json'),
    path.join(APP_DATA_DIR, 'mount-config.json')
  ];
  for (const mcFile of mountCandidates) {
    if (!fs.existsSync(mcFile)) continue;
    try {
      const mc = JSON.parse(fs.readFileSync(mcFile, 'utf8').replace(/^\uFEFF/, ''));
      if (mc && typeof mc === 'object') {
        if (mc.scspRoot && !process.env.SCSP_DATA_ROOT) {
          process.env.SCSP_DATA_ROOT = cleanPath(mc.scspRoot);
        }
        const value = cleanPath(mc.enzaRoot || '');
        if (value) {
          const resolved = path.isAbsolute(value) ? path.resolve(value) : path.resolve(path.dirname(mcFile), value);
          return { root: resolved, source: '外部资源配置 mount-config.json', sourceFile: mcFile };
        }
      }
    } catch (e) {
      log('mount-config.json parse warning:', mcFile, e.message);
    }
  }

  const dataPathCandidates = [
    path.join(exeDir(), 'data-path.txt'),
    path.join(__dirname, 'data-path.txt')
  ];
  for (const localFile of dataPathCandidates) {
    if (!fs.existsSync(localFile)) continue;
    const value = cleanPath(firstMeaningfulLine(localFile));
    if (value) {
      const resolved = path.isAbsolute(value) ? path.resolve(value) : path.resolve(path.dirname(localFile), value);
      return { root: resolved, source: 'data-path.txt', sourceFile: localFile };
    }
  }

  const configFile = path.join(APP_DATA_DIR, 'config.json');
  if (fs.existsSync(configFile)) {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(configFile, 'utf8').replace(/^\uFEFF/, ''));
    } catch (e) {
      throw new Error('配置文件无法解析：' + configFile + '\n' + e.message);
    }
    if (raw && typeof raw === 'object' && raw.dataRoot !== undefined) {
      const value = cleanPath(raw.dataRoot);
      if (value) {
        return {
          root: path.isAbsolute(value) ? path.resolve(value) : path.resolve(path.dirname(configFile), value),
          source: '用户配置 config.json',
          sourceFile: configFile
        };
      }
    }
  }

  return { root: path.resolve(DEFAULT_DATA_ROOT), source: '默认值', sourceFile: '' };
}

function inspectPath(file, kind) {
  try {
    const stat = fs.statSync(file);
    if (kind === 'dir' && !stat.isDirectory()) return '不是目录';
    if (kind === 'file' && !stat.isFile()) return '不是普通文件';
    if (kind === 'file' && stat.size === 0) return '文件为空';
    fs.accessSync(file, fs.constants.R_OK);
    return '';
  } catch (e) {
    if (e.code === 'ENOENT') return '不存在';
    if (e.code === 'EACCES' || e.code === 'EPERM') return '没有读取权限';
    return e.message;
  }
}

function validateDataRoot(dataRoot) {
  const eventsDir = path.join(dataRoot, 'voice', 'voice', 'events');
  const checks = [
    { label: 'catalog.json', file: path.join(dataRoot, 'catalog.json'), kind: 'file' },
    { label: 'voice 目录（voice\\voice\\events）', file: eventsDir, kind: 'dir' },
    { label: 'voice 索引（voice\\voice\\events\\index.json）', file: path.join(eventsDir, 'index.json'), kind: 'file' }
  ];
  const problems = [];
  for (const check of checks) {
    const reason = inspectPath(check.file, check.kind);
    if (reason) problems.push({ ...check, reason });
  }
  return problems;
}

function showStartupError(title, detail, parent) {
  if (parent && !parent.isDestroyed()) {
    dialog.showMessageBoxSync(parent, {
      type: 'error', title: DISPLAY_NAME + ' - ' + title, message: title, detail, buttons: ['退出']
    });
  } else {
    dialog.showErrorBox(DISPLAY_NAME + ' - ' + title, detail);
  }
}

function showBox(parent, options) {
  if (parent && !parent.isDestroyed()) return dialog.showMessageBox(parent, options);
  return dialog.showMessageBox(options);
}

let shellHandle = null;
let appInfo = {
  name: APP_NAME,
  version: app.getVersion(),
  dataRoot: '',
  dataSource: '',
  shellDir: '',
  shellSource: '',
  userDataDir: APP_DATA_DIR,
  logFile: LOG_FILE,
  isDev: IS_DEV
};
let quitting = false;
let quitStarted = false;

function focusMainWindow() {
  if (shellHandle && typeof shellHandle.showWindow === 'function') {
    shellHandle.showWindow();
    return;
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return;
  }
}

function resolveShell() {
  if (!IS_PACKAGED) {
    const local = path.join(__dirname, 'app');
    const manifest = updater.validateAppDir(local, null);
    return { appDir: local, version: manifest.version, source: '开发目录 app/', manifest };
  }

  const bundled = path.join(process.resourcesPath, 'app');
  let bundleManifest;
  try {
    bundleManifest = updater.validateAppDir(bundled, null);
  } catch (e) {
    throw new Error('安装包内缺少 app 壳：' + bundled + '\n' + e.message);
  }

  const current = updater.readCurrent(APP_DATA_DIR);
  if (!current) {
    const seeded = updater.seedVersionedApp({
      sourceDir: bundled,
      userDataDir: APP_DATA_DIR,
      version: bundleManifest.version
    });
    if (seeded && seeded.error) {
      log('内置 app 复制到版本目录失败，直接使用安装包内资源:', seeded.error.message);
      return { appDir: bundled, version: bundleManifest.version, source: '安装包内置资源（只读）', manifest: bundleManifest };
    }
    if (seeded && typeof seeded === 'string') {
      try { return { appDir: seeded, version: bundleManifest.version, source: '版本目录（内置初始化）', manifest: bundleManifest }; } catch (e) {}
    }
  }

  const active = updater.activeAppOrFallback({ userDataDir: APP_DATA_DIR, fallbackDir: bundled });
  if (!active) throw new Error('找不到可用的播放器 app 壳。');
  return {
    appDir: active.appDir,
    version: active.version,
    source: active.source === 'versioned' ? '版本目录（已更新）' : '安装包内置资源',
    manifest: active.manifest
  };
}

function bundledStartStory() {
  // 离线全量包用 EXE 同目录的 start-story.txt 指定双击后的默认剧目。
  // 命令行 --story / --url 和 ENZA_START_STORY 仍然优先，便于排障。
  try {
    const file = path.join(exeDir(), 'start-story.txt');
    if (!fs.existsSync(file)) return '';
    return firstMeaningfulLine(file).replace(/^\/+/, '').replace(/^[?&]/, '');
  } catch (e) {
    return '';
  }
}

function startStoryArgv(argv) {
  const story = argValue(argv, '--story') || process.env.ENZA_START_STORY || bundledStartStory() || '';
  let target = story ? '/?cat=' + encodeURIComponent(story.split('/')[0] || '') + '&id=' + encodeURIComponent(story.split('/').slice(1).join('/')) : '';
  const url = argValue(argv, '--url');
  if (url) {
    try {
      const parsed = new URL(url, 'http://127.0.0.1/');
      target = (parsed.pathname || '/') + (parsed.search || '') + (parsed.hash || '');
    } catch (e) {
      target = url.startsWith('/') ? url : '/' + url;
    }
  }
  return target;
}

async function checkForUpdates(parentWindow) {
  const parent = parentWindow && !parentWindow.isDestroyed() ? parentWindow : BrowserWindow.getFocusedWindow();
  const currentVersion = appInfo.version;
  let first;
  try {
    first = await updater.checkForUpdates({
      currentVersion,
      exeDir: exeDir(),
      userDataDir: APP_DATA_DIR,
      download: false
    });
  } catch (err) {
    showStartupError('检查更新失败', String(err && err.message ? err.message : err), parent);
    return;
  }

  if (first.status === 'no-feed') {
    await showBox(parent, {
      type: 'info',
      title: '检查更新',
      message: '没有找到更新描述文件 update.json',
      detail: '会查找：\n  ' + first.checked.join('\n  ') +
        '\n\n手动放好 update.json 后，再点一次「检查更新」。\n本次不会修改任何文件。',
      buttons: ['好']
    });
    return;
  }
  if (first.status === 'up-to-date') {
    await showBox(parent, {
      type: 'info',
      title: '检查更新',
      message: '当前已经是最新版本',
      detail: '当前版本：' + currentVersion + '\n最新版本：' + first.feedVersion +
        '\n来源：' + first.source + (first.notes ? '\n\n更新说明：\n' + first.notes : ''),
      buttons: ['好']
    });
    return;
  }

  const feed = first.feed;
  const confirm = await showBox(parent, {
    type: 'info',
    title: '发现新版本',
    message: '发现 enza 剧情播放器 ' + feed.version,
    detail: '当前版本：' + currentVersion +
      '\n更新包：' + feed.url +
      '\nSHA-256：' + feed.sha256 +
      (feed.notes ? '\n\n更新说明：\n' + feed.notes : '') +
      '\n\n只会下载并替换 app 壳；资源目录（默认 D:\\enza）不会被读取、复制或修改。' +
      '\n新版本会在下次启动时原子切换，失败保留旧版。',
    buttons: ['下载并准备', '取消'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });
  if (confirm.response !== 0) return;

  if (parent && parent.setProgressBar) parent.setProgressBar(0.02);
  try {
    const staged = await updater.checkForUpdates({
      currentVersion,
      exeDir: exeDir(),
      userDataDir: APP_DATA_DIR,
      download: true,
      onProgress: (received, total) => {
        if (!parent || !parent.setProgressBar) return;
        if (total > 0) parent.setProgressBar(Math.max(0.02, Math.min(1, received / total)));
      }
    });
    if (parent && parent.setProgressBar) parent.setProgressBar(-1);
    if (staged.status !== 'staged') {
      await showBox(parent, {
        type: 'info', title: '检查更新', message: '没有需要准备的更新',
        detail: '状态：' + staged.status, buttons: ['好']
      });
      return;
    }
    const devNote = IS_DEV
      ? '\n\n当前是 npm start 开发模式，版本化 app 不会自动启用；打包版会在下次启动时启用。'
      : '\n\n请关闭本窗口，下次双击 EXE 即会启用新版本。';
    await showBox(parent, {
      type: 'info',
      title: '更新已准备',
      message: '已下载、校验并暂存 ' + staged.feedVersion,
      detail: '下载：' + staged.zipPath +
        '\n暂存：' + staged.appDir +
        '\nsha256：' + staged.sha256 +
        '\n\n旧版本仍完整保留。' + devNote,
      buttons: ['好']
    });
    log('update staged:', staged.feedVersion, staged.appDir);
  } catch (err) {
    if (parent && parent.setProgressBar) parent.setProgressBar(-1);
    showStartupError('更新准备失败', String(err && err.message ? err.message : err) + '\n\n旧版本未被修改。', parent);
    log('update failed:', err);
  }
}

async function rollbackLatest(parentWindow) {
  const parent = parentWindow && !parentWindow.isDestroyed() ? parentWindow : BrowserWindow.getFocusedWindow();
  const state = updater.getInstallState(APP_DATA_DIR);
  if (!state.current || !state.current.previous) {
    await showBox(parent, {
      type: 'info', title: '回滚',
      message: '没有可回滚的上一版本',
      detail: '只有成功升级过一次、且旧版本目录仍存在时才能回滚。',
      buttons: ['好']
    });
    return;
  }
  const answer = await showBox(parent, {
    type: 'warning', title: '回滚到上一版本',
    message: '回滚 ' + state.current.version + ' → ' + state.current.previous + '？',
    detail: '只切换 app 壳，不改动 D:\\enza 资源。下次启动生效。',
    buttons: ['回滚', '取消'], defaultId: 1, cancelId: 1, noLink: true
  });
  if (answer.response !== 0) return;
  const result = updater.rollback({ userDataDir: APP_DATA_DIR, logger: log });
  if (result.status !== 'rolled-back') {
    showStartupError('回滚失败', result.error ? result.error.message : '没有上一版本', parent);
    return;
  }
  await showBox(parent, {
    type: 'info', title: '回滚已准备',
    message: '已切回 ' + result.version,
    detail: '关闭窗口后，下次启动将加载 ' + result.version + '。',
    buttons: ['好']
  });
}

async function chooseExternalDataRoot(parent) {
  const res = await dialog.showOpenDialog(parent || undefined, {
    title: '选择外部 enza 核心资源目录（含 catalog.json 与 assets）',
    defaultPath: (appInfo.dataRoot && fs.existsSync(appInfo.dataRoot)) ? appInfo.dataRoot : undefined,
    properties: ['openDirectory']
  });
  if (!res || res.canceled || !res.filePaths || !res.filePaths[0]) return;
  const chosen = path.resolve(res.filePaths[0]);
  const port = shellHandle && shellHandle.port;
  if (port) {
    try {
      await new Promise((resolve, reject) => {
        const body = Buffer.from(JSON.stringify({ enzaRoot: chosen }), 'utf8');
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: '/api/mount-config',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
        }, (resp) => {
          resp.resume();
          resp.on('end', () => (resp.statusCode === 200 ? resolve() : reject(new Error('HTTP ' + resp.statusCode))));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
      appInfo.dataRoot = chosen;
      appInfo.dataSource = '外部资源配置 mount-config.json';
      const win = parent || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) win.webContents.reload();
      return;
    } catch (err) {
      log('POST /api/mount-config failed, writing local data-path.txt fallback:', err.message);
    }
  }
  try {
    fs.writeFileSync(path.join(__dirname, 'data-path.txt'), chosen + '\n', 'utf8');
    appInfo.dataRoot = chosen;
  } catch (e) {
    log('failed writing data-path.txt:', e.message);
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [];
  if (isMac) template.push({ role: 'appMenu' });
  template.push({
    label: '文件',
    submenu: [
      {
        label: '选择并挂载外部 enza 资源目录…',
        click: () => { chooseExternalDataRoot(BrowserWindow.getFocusedWindow()); }
      },
      {
        label: '打开外部资源挂载设置面板…',
        click: () => {
          const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
          if (win && !win.isDestroyed()) {
            win.webContents.executeJavaScript('window.__openMountModal && window.__openMountModal()').catch(() => {});
          }
        }
      },
      { type: 'separator' },
      {
        label: '打开数据目录',
        click: () => { if (appInfo.dataRoot) shell.openPath(appInfo.dataRoot).catch(() => {}); }
      },
      {
        label: '打开本应用数据目录',
        click: () => { shell.openPath(APP_DATA_DIR).catch(() => {}); }
      },
      { type: 'separator' },
      { role: 'close', label: '关闭窗口' },
      { role: 'quit', label: '退出' }
    ]
  });
  template.push({
    label: '视图',
    submenu: [
      { role: 'togglefullscreen', label: '全屏' },
      { role: 'resetzoom', label: '实际大小' },
      { role: 'zoomin', label: '放大' },
      { role: 'zoomout', label: '缩小' },
      { type: 'separator' },
      {
        label: '开发者工具',
        visible: IS_DEV,
        accelerator: 'F12',
        click: () => {
          const win = BrowserWindow.getFocusedWindow();
          if (!win) return;
          if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
          else win.webContents.openDevTools({ mode: 'detach' });
        }
      }
    ]
  });
  template.push({
    label: '帮助',
    submenu: [
      {
        label: '检查更新…',
        click: () => { checkForUpdates(BrowserWindow.getFocusedWindow()); }
      },
      {
        label: '回滚到上一版本…',
        enabled: IS_PACKAGED,
        click: () => { rollbackLatest(BrowserWindow.getFocusedWindow()); }
      },
      { type: 'separator' },
      {
        label: '关于 ' + DISPLAY_NAME,
        click: () => {
          const state = updater.getInstallState(APP_DATA_DIR);
          showBox(BrowserWindow.getFocusedWindow(), {
            type: 'info',
            title: '关于',
            message: DISPLAY_NAME,
            detail: '版本：' + appInfo.version +
              '\napp 壳：' + appInfo.shellDir +
              '\n壳来源：' + appInfo.shellSource +
              '\n资源目录：' + appInfo.dataRoot +
              '\n资源来源：' + appInfo.dataSource +
              '\n用户数据：' + APP_DATA_DIR + '（' + APP_DATA_MODE + '）' +
              '\n当前版本记录：' + (state.current ? state.current.version : '内置/开发') +
              '\n日志：' + LOG_FILE +
              '\n\nElectron ' + process.versions.electron + ' / Chromium ' + process.versions.chrome +
              '\n不含编辑器；D:\\enza 资源不随 EXE 分发。',
            buttons: ['好']
          });
        }
      }
    ]
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc() {
  ipcMain.handle('enza:app-info', () => ({
    name: APP_NAME,
    displayName: DISPLAY_NAME,
    version: appInfo.version,
    dataRoot: appInfo.dataRoot,
    shellDir: appInfo.shellDir,
    shellSource: appInfo.shellSource,
    port: shellHandle && shellHandle.port ? shellHandle.port : null,
    isDev: IS_DEV,
    resources: 'external'
  }));
}

async function shutdown(code) {
  if (quitting) return;
  quitting = true;
  try {
    if (shellHandle && typeof shellHandle.stop === 'function') {
      await shellHandle.stop();
    }
  } catch (err) {
    log('shutdown stop error:', err);
  }
  quitStarted = true;
  app.exit(typeof code === 'number' ? code : 0);
}

function installLifecycle() {
  app.on('second-instance', (event, argv) => {
    focusMainWindow();
    if (shellHandle && typeof shellHandle.openArgv === 'function') {
      try { shellHandle.openArgv(argv); } catch (e) { log('second-instance open failed:', e); }
    }
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length) focusMainWindow();
  });
  app.on('before-quit', (event) => {
    if (quitStarted) return;
    event.preventDefault();
    shutdown(0);
  });
  app.on('will-quit', () => {
    if (shellHandle && typeof shellHandle.forceKill === 'function') {
      try { shellHandle.forceKill(); } catch (e) {}
    }
  });
  process.on('uncaughtException', (err) => {
    if (err && (err.code === 'EPIPE' || /EPIPE/.test(String(err.message || '')))) {
      log('ignored EPIPE on console stream');
      return;
    }
    log('uncaughtException:', err);
    try { dialog.showErrorBox(DISPLAY_NAME + ' 发生错误', String((err && err.stack) || err)); } catch (e) {}
    shutdown(1);
  });
  process.on('unhandledRejection', (err) => {
    log('unhandledRejection:', err);
  });
}

function describeGpuStatus(status) {
  const s = status || {};
  const text = Object.keys(s).map((k) => k + '=' + s[k]).join('; ');
  const webglOk = /^enabled/.test(String(s.webgl || ''));
  const compositingOk = /^enabled/.test(String(s.gpu_compositing || ''));
  // 只有 WebGL/gpu_compositing 不可用才算软件渲染；disabled_off_ok
  // 一类的可选特性不能误判。
  const software = !webglOk || !compositingOk;
  return { software, text, webglOk, compositingOk };
}

async function logGpuStatus(label) {
  try {
    const status = app.getGPUFeatureStatus();
    const about = describeGpuStatus(status);
    log('gpu feature status (' + label + '):', JSON.stringify(status));
    log('gpu software rendering (' + label + '):', about.software, '|', about.text);
  } catch (err) {
    log('gpu feature status error:', err && err.message ? err.message : err);
  }
  try {
    const info = await app.getGPUInfo('basic');
    log('gpu info (' + label + '):', JSON.stringify(info));
  } catch (err) {
    log('gpu info error:', err && err.message ? err.message : err);
  }
  log('gpu switches:', JSON.stringify({
    ignoreGpuBlocklist: app.commandLine.hasSwitch('ignore-gpu-blocklist'),
    gpuRasterization: app.commandLine.hasSwitch('enable-gpu-rasterization'),
    disableGpuSandbox: app.commandLine.hasSwitch('disable-gpu-sandbox'),
    noSandbox: app.commandLine.hasSwitch('no-sandbox'),
    hardwareAccelerationDisabled: process.env.ENZA_DISABLE_GPU === '1'
  }));
}

async function bootstrap() {
  await app.whenReady();
  installLifecycle();
  registerIpc();

  log('========== start ==========');
  log('version:', app.getVersion(), 'packaged:', IS_PACKAGED, 'devtools:', IS_DEV);
  log('low integrity:', LOW_INTEGRITY, 'app data mode:', APP_DATA_MODE);
  log('exe dir:', exeDir());
  log('app data:', APP_DATA_DIR);

  let data;
  try {
    data = resolveDataRoot(process.argv);
  } catch (err) {
    showStartupError('数据目录配置错误', String(err.message || err), null);
    await shutdown(1);
    return;
  }
  log('data root:', data.root, '(' + data.source + ')');
  const problems = validateDataRoot(data.root);
  if (problems.length) {
    log('external data root unmounted (' + problems.length + ' checks missing); launching player in lightweight metadata-snapshot mode so user can configure via #mountModal:',
      problems.map((p) => p.label + '=' + p.reason).join(', '));
  }

  if (IS_PACKAGED) {
    try {
      const promo = updater.promotePending({ userDataDir: APP_DATA_DIR, logger: log });
      if (promo.status !== 'none') log('pending update:', promo);
    } catch (err) {
      log('promotePending error (旧版继续):', err);
    }
    if (process.argv.includes('--rollback')) {
      const rb = updater.rollback({ userDataDir: APP_DATA_DIR, logger: log });
      log('command-line rollback:', rb);
    }
  } else {
    log('dev mode: 使用 desktop/app，不启用版本化更新');
  }

  let shellInfo;
  try {
    shellInfo = resolveShell();
  } catch (err) {
    showStartupError('无法加载播放器', String((err && err.stack) || err), null);
    await shutdown(1);
    return;
  }

  appInfo = {
    ...appInfo,
    version: shellInfo.version,
    dataRoot: data.root,
    dataSource: data.source,
    shellDir: shellInfo.appDir,
    shellSource: shellInfo.source
  };
  log('shell:', shellInfo.appDir, 'version:', shellInfo.version, 'source:', shellInfo.source);
  buildMenu();

  let shellModule;
  try {
    shellModule = require(path.join(shellInfo.appDir, 'main-app.js'));
    if (!shellModule || typeof shellModule.start !== 'function') {
      throw new Error('app/main-app.js 必须导出 start(ctx)');
    }
  } catch (err) {
    showStartupError('播放器 app 壳损坏', String((err && err.stack) || err), null);
    await shutdown(1);
    return;
  }

  try {
    const handle = await shellModule.start({
      app,
      BrowserWindow,
      dialog,
      shell,
      ipcMain,
      userDataDir: APP_DATA_DIR,
      preloadPath: path.join(__dirname, 'preload.js'),
      appDir: shellInfo.appDir,
      dataRoot: data.root,
      version: shellInfo.version,
      channel: 'stable',
      isDev: IS_DEV,
      argv: process.argv,
      startTarget: startStoryArgv(process.argv),
      log,
      checkForUpdates,
      updater,
      exeDir: exeDir()
    });
    if (handle) {
      shellHandle = handle;
      appInfo = { ...appInfo, port: handle.port || null };
    }
    setTimeout(() => { logGpuStatus('startup+4s'); }, 4000);
  } catch (err) {
    log('shell start failed:', err);
    showStartupError('启动本地播放器失败', String((err && err.stack) || err), BrowserWindow.getFocusedWindow());
    await shutdown(1);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  bootstrap().catch((err) => {
    log('bootstrap failed:', err);
    try { dialog.showErrorBox(DISPLAY_NAME + ' 启动失败', String((err && err.stack) || err)); } catch (e) {}
    shutdown(1);
  });
}

module.exports = { checkForUpdates };
