/* 二创剧作台 Studio · 外部资源挂载面板
 * Studio 本身不直接管理资源目录，挂载配置由 :18899 播放器服务统一持有；
 * 这里通过 Studio 网关透传的 /api/mount-status 与 /api/mount-config 读写，
 * 保存后自动刷新内嵌的真 Spine 舞台 iframe。
 */
(function () {
  'use strict';

  var STATUS_URL = '/api/mount-status';
  var CONFIG_URL = '/api/mount-config';
  var STYLE_ID = 'sc-mount-style';
  var panel = null;
  var busy = false;

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = [
      '.sc-mount-mask{position:fixed;inset:0;z-index:9998;background:rgba(4,8,16,.62);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px}',
      '.sc-mount-mask[hidden]{display:none}',
      '.sc-mount-card{width:min(620px,94vw);max-height:86vh;overflow:auto;border-radius:16px;padding:20px 22px;background:linear-gradient(180deg,#101827,#0b1220);border:1px solid rgba(120,170,255,.28);box-shadow:0 24px 70px rgba(0,0,0,.55);color:#e8eefc;font:14px/1.6 "Microsoft YaHei",system-ui,sans-serif}',
      '.sc-mount-card h2{margin:0 0 6px;font-size:17px;letter-spacing:.3px}',
      '.sc-mount-sub{margin:0 0 14px;color:#93a4c4;font-size:12.5px}',
      '.sc-mount-row{margin:12px 0 4px}',
      '.sc-mount-row label{display:block;margin-bottom:6px;color:#b9c8e6;font-size:12.5px;font-weight:700}',
      '.sc-mount-row input{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:9px;border:1px solid rgba(130,170,240,.3);background:#0a1424;color:#e8eefc;font:13px/1.4 Consolas,monospace}',
      '.sc-mount-row input:focus{outline:none;border-color:#4f8dff;box-shadow:0 0 0 3px rgba(79,141,255,.16)}',
      '.sc-mount-hint{margin:4px 0 0;color:#7f8fb0;font-size:12px}',
      '.sc-mount-state{margin:14px 0 0;padding:10px 12px;border-radius:10px;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.22);font-size:12.5px;color:#bcd7f5;white-space:pre-wrap;word-break:break-all}',
      '.sc-mount-state.bad{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.3);color:#fecaca}',
      '.sc-mount-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}',
      '.sc-mount-btn{padding:8px 16px;border-radius:9px;border:1px solid rgba(140,180,255,.35);background:#152136;color:#dbe7ff;font:13px "Microsoft YaHei",system-ui,sans-serif;cursor:pointer}',
      '.sc-mount-btn:hover{background:#1c2c48}',
      '.sc-mount-btn.primary{border-color:transparent;background:linear-gradient(180deg,#3b82f6,#2563eb);color:#fff;font-weight:700}',
      '.sc-mount-btn.primary:disabled{opacity:.6;cursor:default}',
      '.btn.sc-mount-warn{color:#fbbf24 !important;border-color:rgba(251,191,36,.45) !important}'
    ].join('\n');
    document.head.appendChild(css);
  }

  function setState(text, bad) {
    if (!panel) return;
    panel.state.textContent = text;
    panel.state.classList.toggle('bad', !!bad);
  }

  function fmtStatus(j) {
    if (!j || typeof j !== 'object') return '未知状态';
    if (!j.enzaMounted) {
      return '⚠ 当前未挂载 enza 资源目录：舞台没有立绘/背景，编辑器只能写文字。\n' +
        '请在上面的「enza 资源目录」填入解压后的文件夹（包含 assets 的那一层），再点「保存并热重载挂载」。';
    }
    var s = j.enzaStats || {};
    return '✓ 已挂载：' + j.enzaRoot + '\n' +
      '  目录检查：Spine ' + (s.hasSpine ? '✓' : '✗') + ' · 背景 ' + (s.hasBg ? '✓' : '✗') +
      ' · BGM ' + (s.hasBgm ? '✓' : '✗') + ' · 语音 ' + (s.hasVoice ? '✓' : '✗') +
      ' · 剧本 ' + (s.hasJson ? '✓' : '✗') + '\n' +
      '  （精简资源包没有 voice / 剧本，属正常：用那个包时 :18899 只作为 Studio 的实时舞台）' +
      (j.configSource ? '\n  配置来源：' + j.configSource : '');
  }

  async function refresh() {
    if (!panel) return;
    setState('读取挂载状态…', false);
    try {
      var r = await fetch(STATUS_URL, { cache: 'no-store' });
      var j = await r.json();
      panel.enza.value = j.enzaRoot || '';
      panel.scsp.value = j.scspRoot || '';
      setState(fmtStatus(j), !j.enzaMounted);
      markButton(!j.enzaMounted);
    } catch (e) {
      setState('读取失败：' + (e && e.message ? e.message : e), true);
    }
  }

  function markButton(unmounted) {
    var btns = [document.getElementById('btnMountAssets'), document.getElementById('btnMountAssetsTop')];
    btns.forEach(function (b) {
      if (!b) return;
      b.classList.toggle('sc-mount-warn', !!unmounted);
      b.title = unmounted
        ? '当前未挂载资源目录，点此挂载（填包含 assets 的那一层）'
        : '外部资源目录挂载设置（Spine 立绘 / 背景 / BGM）';
    });
  }

  function open() {
    ensureStyle();
    if (!panel) {
      var mask = h('div', 'sc-mount-mask');
      mask.hidden = true;
      var card = h('div', 'sc-mount-card');
      card.appendChild(h('h2', null, '📂 外部资源目录挂载'));
      card.appendChild(h('p', 'sc-mount-sub', 'Studio 的舞台与素材都从外部 enza 资源目录只读读取；填「包含 assets 文件夹」的那一层。'));

      var row1 = h('div', 'sc-mount-row');
      row1.appendChild(h('label', null, 'enza 资源目录（必填）'));
      var enza = document.createElement('input');
      enza.type = 'text';
      enza.spellcheck = false;
      enza.placeholder = String.raw`例如：D:\enza-editor-assets  或  D:\enza`;
      row1.appendChild(enza);
      row1.appendChild(h('p', 'sc-mount-hint', '精简资源包解压后是 enza-editor-assets（里面才有 assets）；完整版是 enza。'));
      card.appendChild(row1);

      var row2 = h('div', 'sc-mount-row');
      row2.appendChild(h('label', null, 'SCSP 语料目录（可选）'));
      var scsp = document.createElement('input');
      scsp.type = 'text';
      scsp.spellcheck = false;
      scsp.placeholder = String.raw`例如：D:\SCSPDownloader（可留空）`;
      row2.appendChild(scsp);
      card.appendChild(row2);

      var state = h('div', 'sc-mount-state', '');
      card.appendChild(state);

      var actions = h('div', 'sc-mount-actions');
      var closeBtn = h('button', 'sc-mount-btn', '关闭');
      closeBtn.type = 'button';
      closeBtn.onclick = function () { mask.hidden = true; };
      var reloadBtn = h('button', 'sc-mount-btn', '↻ 只重读状态');
      reloadBtn.type = 'button';
      reloadBtn.onclick = refresh;
      var saveBtn = h('button', 'sc-mount-btn primary', '💾 保存并热重载挂载');
      saveBtn.type = 'button';
      saveBtn.onclick = save;
      actions.appendChild(closeBtn);
      actions.appendChild(reloadBtn);
      actions.appendChild(saveBtn);
      card.appendChild(actions);

      mask.appendChild(card);
      document.body.appendChild(mask);
      mask.addEventListener('click', function (e) { if (e.target === mask) mask.hidden = true; });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !mask.hidden) mask.hidden = true;
      });

      panel = { mask: mask, enza: enza, scsp: scsp, state: state, saveBtn: saveBtn };
    }
    panel.mask.hidden = false;
    refresh();
  }

  async function save() {
    if (!panel || busy) return;
    busy = true;
    panel.saveBtn.disabled = true;
    setState('保存中…', false);
    try {
      var body = {
        enzaRoot: panel.enza.value.trim(),
        scspRoot: panel.scsp.value.trim(),
        persist: true
      };
      if (!body.enzaRoot) {
        setState('enza 资源目录不能为空；如需卸载，请保持为空并确认保存。', true);
      }
      var r = await fetch(CONFIG_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok || j.ok === false) {
        setState('挂载失败：' + (j.error || ('HTTP ' + r.status)) + (j.detail ? '\n' + j.detail : ''), true);
      } else {
        setState('✓ 已保存并热重载。\n' + (j.enzaRoot ? 'enza：' + j.enzaRoot : 'enza：已卸下') +
          (j.warnings && j.warnings.length ? '\n提示：' + j.warnings.join('；') : ''), false);
        markButton(!j.enzaMounted);
        reloadStage();
      }
    } catch (e) {
      setState('挂载失败：' + (e && e.message ? e.message : e), true);
    } finally {
      busy = false;
      panel.saveBtn.disabled = false;
    }
  }

  function reloadStage() {
    var ifr = document.getElementById('realSpineIframe');
    if (!ifr || !ifr.src || ifr.src === 'about:blank') return;
    var src = ifr.src;
    try {
      ifr.src = 'about:blank';
      setTimeout(function () { ifr.src = src; }, 60);
    } catch (e) {}
  }

  function boot() {
    ensureStyle();
    var a = document.getElementById('btnMountAssets');
    var b = document.getElementById('btnMountAssetsTop');
    if (a) a.addEventListener('click', open);
    if (b) b.addEventListener('click', open);
    // 启动时静默读一次状态，未挂载就让按钮变黄提醒
    fetch(STATUS_URL, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) { markButton(!(j && j.enzaMounted)); })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
