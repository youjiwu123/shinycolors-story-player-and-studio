'use strict';

/**
 * 可升级 app 壳主体：窗口 + 本地服务生命周期。
 * 由根目录 main.js 从 active app 目录 require，因此升级 main-app/server/player
 * 都不需要替换 EXE。
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { fork, spawnSync } = require('child_process');
const { BrowserWindow, shell } = require('electron');

const DISPLAY_NAME = 'enza 剧情播放器';
const HOST = '127.0.0.1';

let mainWindow = null;
let serverChild = null;
let serverPort = 0;
let pageReady = false;
let stopping = false;
let stopPromise = null;
let starting = false;
let stderrTail = [];
let stdoutTail = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimPush(arr, line, max) {
  arr.push(line);
  if (arr.length > (max || 120)) arr.splice(0, arr.length - (max || 120));
}

function addLogLine(ctx, prefix, chunk) {
  const text = String(chunk || '');
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    trimPush(prefix === 'stderr' ? stderrTail : stdoutTail, line);
    if (typeof ctx.log === 'function') ctx.log('[' + prefix + '] ' + line);
  }
}

function splashHtml(dataRoot) {
  function dataUri(rel, mime) {
    try {
      const p = path.join(dataRoot || '', 'assets', 'images', 'content', 'unit', 'logo_official', rel);
      return 'data:' + mime + ';base64,' + fs.readFileSync(p).toString('base64');
    } catch (e) { return ''; }
  }
  const bg = dataUri('splash_bg.jpg', 'image/jpeg');
  const logo = dataUri('game_logo.png', 'image/png');
  const bgCss = bg ? `background:#0a1022 url('${bg}') center/cover no-repeat;` : 'background:#0a1022;';
  const logoCss = logo ? `background:url('${logo}') center/contain no-repeat;` : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>${DISPLAY_NAME}</title>
<style>
  html,body{height:100%;margin:0;color:#eef1fa;font-family:"Segoe UI","Microsoft YaHei",sans-serif}
  body{display:grid;place-items:center;overflow:hidden;${bgCss}}
  body::before{content:"";position:fixed;inset:0;background:linear-gradient(180deg,rgba(6,10,24,.10) 0%,rgba(6,10,24,.45) 62%,rgba(6,10,24,.86) 100%)}
  .box{position:relative;text-align:center;transform:translateY(12vh)}
  .logo{width:min(420px,62vw);height:min(176px,26vw);${logoCss}}
  h1{font-size:15px;font-weight:500;letter-spacing:.18em;margin:20px 0 6px;color:#dce6ff}
  p{font-size:11px;letter-spacing:.12em;color:rgba(220,230,255,.62);margin:0}
  .bar{width:210px;height:2px;border-radius:99px;background:rgba(255,255,255,.18);margin:22px auto 0;overflow:hidden}
  .bar i{display:block;width:38%;height:100%;border-radius:99px;background:linear-gradient(90deg,#ffd36e,#ff9fc4,#8fc8ff);animation:go 1.2s ease-in-out infinite}
  @keyframes go{0%{transform:translateX(-110%)}100%{transform:translateX(330%)}}
</style>
</head>
<body>
  <div class="box">
    <div class="logo" role="img" aria-label="SHINY COLORS"></div>
    <h1>enza 剧情播放器</h1>
    <p>正在启动本地播放服务…</p>
    <div class="bar"><i></i></div>
  </div>
</body>
</html>`;
}

function targetFromArgv(argv) {
  function argValue(name) {
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === name) return argv[i + 1] === undefined ? '' : argv[i + 1];
      if (a.indexOf(name + '=') === 0) return a.slice(name.length + 1);
    }
    return '';
  }
  const story = argValue('--story') || process.env.ENZA_START_STORY || '';
  if (story) {
    const idx = story.indexOf('/');
    const cat = idx < 0 ? story : story.slice(0, idx);
    const id = idx < 0 ? '' : story.slice(idx + 1);
    return '/?cat=' + encodeURIComponent(cat) + '&id=' + encodeURIComponent(id);
  }
  const url = argValue('--url');
  if (url) {
    try {
      const parsed = new URL(url, 'http://127.0.0.1/');
      return (parsed.pathname || '/') + (parsed.search || '') + (parsed.hash || '');
    } catch (e) {
      return url.startsWith('/') ? url : '/' + url;
    }
  }
  return '/';
}

function createWindow(ctx) {
  const iconPath = path.join(ctx.appDir, 'icon.ico');
  const win = new BrowserWindow({
    title: DISPLAY_NAME,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    show: false,
    backgroundColor: '#07090f',
    autoHideMenuBar: false,
    webPreferences: {
      preload: ctx.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  win.on('page-title-updated', (event) => {
    event.preventDefault();
    if (!win.isDestroyed()) win.setTitle(DISPLAY_NAME);
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
    pageReady = false;
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      try { shell.openExternal(url); } catch (e) {}
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.origin === 'http://' + HOST + ':' + serverPort) return;
    } catch (e) {}
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) {
      try { shell.openExternal(url); } catch (e) {}
    }
  });
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });
  win.webContents.on('render-process-gone', (event, details) => {
    if (stopping) return;
    ctx.log('renderer gone:', details);
    try {
      ctx.dialog.showErrorBox(DISPLAY_NAME + ' 页面已退出', '渲染进程异常：' + (details.reason || 'unknown'));
    } catch (e) {}
    ctx.app.quit();
  });
  return win;
}

function serverErrorText(ctx) {
  const lines = stderrTail.concat(stdoutTail).slice(-40);
  return (lines.length ? lines.join('\n') : '（服务端没有输出）') +
    '\n\n日志：' + path.join(ctx.userDataDir, 'logs', 'main.log');
}

function startServer(ctx) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      ENZA_DATA_ROOT: ctx.dataRoot,
      ENZA_HOST: HOST,
      ENZA_PORT: '0',
      ENZA_APP_VERSION: ctx.version,
      ENZA_CHANNEL: ctx.channel || 'stable',
      ENZA_APP_ROOT: ctx.appDir
    };
    const script = path.join(ctx.appDir, 'server.js');
    if (!fs.existsSync(script)) {
      reject(new Error('找不到本地服务：' + script));
      return;
    }
    stderrTail = [];
    stdoutTail = [];
    let child;
    try {
      child = fork(script, ['--host=' + HOST, '--port=0'], {
        cwd: ctx.appDir,
        env,
        silent: true,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
      });
    } catch (err) {
      reject(err);
      return;
    }
    serverChild = child;
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch (e) {}
      reject(new Error('本地服务启动超时（60 秒）\n\n' + serverErrorText(ctx)));
    }, 60000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => addLogLine(ctx, 'stdout', chunk));
    child.stderr.on('data', (chunk) => addLogLine(ctx, 'stderr', chunk));
    child.on('message', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'enza-ready' && !settled) {
        settled = true;
        clearTimeout(timeout);
        serverPort = parseInt(msg.port, 10);
        if (!serverPort) {
          reject(new Error('本地服务没有返回有效端口'));
          return;
        }
        ctx.log('local server ready on', HOST + ':' + serverPort, 'pid', child.pid, 'version', msg.version);
        resolve({ port: serverPort, child });
      } else if (msg.type === 'enza-error' && !settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('本地服务启动失败：' + msg.message + '\n\n' + serverErrorText(ctx)));
      }
    });
    child.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('无法启动本地服务：' + err.message));
      }
    });
    child.on('exit', (code, signal) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('本地服务提前退出（code=' + code + ', signal=' + signal + '）\n\n' + serverErrorText(ctx)));
        return;
      }
      if (serverChild === child) serverChild = null;
      if (stopping) return;
      ctx.log('local server exited unexpectedly:', code, signal);
      try {
        ctx.dialog.showErrorBox(DISPLAY_NAME + ' 本地服务已退出',
          '本地播放服务意外退出（code=' + code + ', signal=' + signal + '）。\n\n' + serverErrorText(ctx));
      } catch (e) {}
      ctx.app.quit();
    });
  });
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      resolve(true);
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(child.exitCode !== null || child.signalCode !== null);
    };
    const timer = setTimeout(finish, timeoutMs);
    child.once('exit', finish);
  });
}

async function stop() {
  if (stopPromise) return stopPromise;
  stopping = true;
  stopPromise = (async () => {
    const child = serverChild;
    serverChild = null;
    if (!child) return;
    try { child.disconnect(); } catch (e) {}
    try { child.kill(); } catch (e) {}
    const exited = await waitForExit(child, 2500);
    if (!exited && child.pid) {
      try {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore'
        });
      } catch (e) {}
      await waitForExit(child, 1200);
    }
  })();
  return stopPromise;
}

function forceKill() {
  const child = serverChild;
  serverChild = null;
  if (!child || !child.pid || child.exitCode !== null) return;
  try { child.kill(); } catch (e) {}
  try {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore'
    });
  } catch (e) {}
}

function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, { timeout: 1200 }, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve(true);
        retry(new Error('HTTP ' + res.statusCode));
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', retry);
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error('等待播放器页面超时'));
        return;
      }
      setTimeout(attempt, 120);
    };
    attempt();
  });
}

function logRendererGpu(ctx) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const expression = `(() => {
    let glInfo = null;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        glInfo = {
          version: gl.getParameter(gl.VERSION),
          vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
          renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
        };
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) { glInfo = { error: String(e) }; }
    return { dpr: window.devicePixelRatio, webgl: glInfo };
  })()`;
  mainWindow.webContents.executeJavaScript(expression, true).then((info) => {
    ctx.log('renderer webgl:', JSON.stringify(info));
  }).catch((err) => ctx.log('renderer webgl probe failed:', err && err.message ? err.message : err));
}

function logDevFps(ctx) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const expression = `(() => {
    const fps = document.getElementById('fps');
    const canvas = document.querySelector('.char-layer canvas');
    return {
      fps: fps ? fps.textContent : null,
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      dpr: window.devicePixelRatio,
      hidden: document.hidden,
      visibility: document.visibilityState
    };
  })()`;
  mainWindow.webContents.executeJavaScript(expression, true).then((info) => {
    ctx.log('dev fps probe (+10s):', JSON.stringify(info));
  }).catch((err) => ctx.log('dev fps probe failed:', err && err.message ? err.message : err));
}

function navigate(win, target) {
  if (!win || win.isDestroyed()) return;
  const url = 'http://' + HOST + ':' + serverPort + (target || '/');
  pageReady = false;
  win.loadURL(url).then(() => {
    pageReady = true;
  }).catch((err) => {
    // 导航被后续操作取消时忽略；真实错误由 did-fail-load 处理。
    if (err && err.code !== 'ERR_ABORTED') console.error('loadURL:', err);
  });
}

async function start(ctx) {
  if (starting) throw new Error('播放器已经启动');
  starting = true;
  stopping = false;
  stopPromise = null;

  mainWindow = createWindow(ctx);
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });
  await mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml(ctx.dataRoot)));
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();

  let server;
  try {
    server = await startServer(ctx);
  } catch (err) {
    await stop();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
    throw err;
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    return makeHandle(ctx);
  }

  const versionUrl = 'http://' + HOST + ':' + serverPort + '/api/app/version';
  try {
    await waitForHttp(versionUrl, 15000);
  } catch (err) {
    await stop();
    throw new Error('本地服务已经启动，但 /api/app/version 无法访问：' + err.message);
  }

  mainWindow.webContents.on('did-fail-load', (event, code, description, validatedURL, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    ctx.log('did-fail-load:', code, description, validatedURL);
    showLoadFailure(ctx, code, description, validatedURL);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    pageReady = true;
    if (ctx.isDev) {
      try { mainWindow.webContents.openDevTools({ mode: 'detach' }); } catch (e) {}
    }
    setTimeout(() => logRendererGpu(ctx), 2500);
    if (ctx.isDev) {
      setTimeout(() => logDevFps(ctx), 10000);
    }
  });

  const target = ctx.startTarget || '/';
  navigate(mainWindow, target);
  ctx.log('window target:', 'http://' + HOST + ':' + serverPort + target);
  return makeHandle(ctx);
}

function showLoadFailure(ctx, code, description, url) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + DISPLAY_NAME +
    '</title><style>body{background:#07090f;color:#eef1fa;font-family:"Segoe UI","Microsoft YaHei",sans-serif;display:grid;place-items:center;height:100vh;margin:0}' +
    '.b{max-width:720px;padding:28px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#101525}' +
    'h1{font-size:18px;margin:0 0 12px}p{color:#9aa4bd;font-size:13px;line-height:1.7;word-break:break-all}' +
    'code{color:#ffb84d}</style></head><body><div class="b"><h1>播放器页面加载失败</h1>' +
    '<p>错误：<code>' + String(code) + ' ' + String(description || '') + '</code></p>' +
    '<p>地址：' + String(url || '') + '</p><p>请查看日志：' + path.join(ctx.userDataDir, 'logs', 'main.log') +
    '</p></div></body></html>';
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {});
}

function makeHandle(ctx) {
  return {
    get port() { return serverPort; },
    get window() { return mainWindow; },
    stop,
    forceKill,
    showWindow() {
      const win = mainWindow;
      if (!win || win.isDestroyed()) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    },
    openArgv(argv) {
      const target = targetFromArgv(argv);
      if (target && target !== '/' && pageReady && mainWindow && !mainWindow.isDestroyed()) {
        navigate(mainWindow, target);
      }
      this.showWindow();
    },
    openTarget(target) {
      if (pageReady && mainWindow && !mainWindow.isDestroyed()) navigate(mainWindow, target);
      this.showWindow();
    },
    getPageReady() { return pageReady; }
  };
}

module.exports = { start };
