/* =========================================================
   enza 剧本时间轴编辑器
   只依赖浏览器 + 本机 18899 服务端；不加载任何外部 CDN。
   ========================================================= */
(function () {
  'use strict';

  /* ---------------- 基础工具 ---------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const debounce = (fn, ms) => {
    let t = 0;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const numOrNull = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const ell = (s, n) => {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, Math.max(0, n - 1)) + '…' : s;
  };
  const pad2 = (n) => String(n).padStart(2, '0');
  const deepEqual = (a, b) => {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return a === b; }
  };

  const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
  const DEFAULT_OPEN = ['dialogue', 'action', 'background', 'flow'];
  const ALL_TRACKS = ['dialogue', 'character', 'action', 'expression', 'background', 'foreground', 'audio', 'still', 'movie', 'effect', 'flow'];
  const DERIVED_KEYS = new Set(['speakerZh', 'char', 'frame', 'dur', 'effectTime', '__seg']);

  const FIELD_ORDER = [
    'speaker', 'text', 'zh', 'charLabel', 'charId', 'charType', 'charCategory',
    'charPosition', 'charScale', 'charEffect', 'voice', 'voiceKeep', 'textFrame',
    'charAnim1', 'charAnim1Loop', 'charAnim2', 'charAnim2Loop', 'charAnim3', 'charAnim3Loop',
    'charAnim4', 'charAnim4Loop', 'charAnim5', 'charAnim5Loop', 'charLipAnim', 'lipAnimDuration',
    'bg', 'bgEffect', 'bgEffectTime', 'fg', 'fgEffect', 'fgEffectTime',
    'middleFg', 'middleFgEffect', 'middleFgEffectTime',
    'bgm', 'bgmFadeTime', 'se',
    'stillType', 'stillId', 'stillCtrl', 'still',
    'movie', 'gameEventCommunicationMovie',
    'effectLabel', 'effectTarget', 'effectValue',
    'waitType', 'waitTime', 'autoWaitTime', 'textCtrl', 'textWait'
  ];
  // 视频模式：旧剧本里的跳转/分支字段在读取时转换或忽略，保存时一律不写回。
  const LEGACY_KEYS = new Set(['select', 'nextLabel', 'label', 'command', 'commandKey']);
  const VIDEO_CONTENT_KEYS = [
    'text', 'voice', 'charLabel', 'charId', 'charPosition', 'charScale', 'charEffect',
    'charAnim1', 'charAnim2', 'charAnim3', 'charAnim4', 'charAnim5', 'charLipAnim',
    'bg', 'bgEffect', 'fg', 'middleFg', 'fgEffect', 'middleFgEffect',
    'bgm', 'se', 'stillType', 'stillId', 'stillCtrl',
    'movie', 'gameEventCommunicationMovie', 'effectLabel', 'effectTarget', 'effectValue',
    'waitType', 'autoWaitTime'
  ];

  const TRACKS = [
    { id: 'dialogue', cls: 't-dialogue', name: '台词 / 语音', short: '台词', focus: 'f-text', section: 'dialogue' },
    { id: 'character', cls: 't-character', name: '角色 / 站位', short: '角色', focus: 'f-charLabel', section: 'character' },
    { id: 'action', cls: 't-action', name: '动作', short: '动作', focus: 'f-charAnim1', section: 'action' },
    { id: 'expression', cls: 't-expression', name: '表情', short: '表情', focus: 'f-charAnim2', section: 'expression' },
    { id: 'background', cls: 't-background', name: '背景', short: '背景', focus: 'f-bg', section: 'background' },
    { id: 'foreground', cls: 't-foreground', name: '前景', short: '前景', focus: 'f-fg', section: 'foreground' },
    { id: 'audio', cls: 't-audio', name: '音频 BGM / SE', short: '音频', focus: 'f-bgm', section: 'audio' },
    { id: 'still', cls: 't-still', name: '卡面 still', short: '卡面', focus: 'f-stillType', section: 'still' },
    { id: 'movie', cls: 't-movie', name: '视频 movie', short: '视频', focus: 'f-movie', section: 'movie' },
    { id: 'effect', cls: 't-effect', name: '特效', short: '特效', focus: 'f-effectLabel', section: 'effect' },
    { id: 'flow', cls: 't-flow', name: '事件 / 等待', short: '等待', focus: 'f-waitType', section: 'flow' }
  ];
  const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));

  let syncForce = false;
  const els = {};
  const state = {
    id: '',
    title: '未命名剧本',
    lines: [],
    selected: 0,
    openTracks: new Set(DEFAULT_OPEN),
    dirty: false,
    saving: false,
    lastSaved: null,
    saveState: 'dirty',
    charMap: {},
    animCache: new Map(),
    animPromises: new Map(),
    animErrors: new Map(),
    durations: new Map(),
    durationErrors: new Set(),
    durationLoading: new Set(),
    titleMap: {},
    openScripts: [],
    dragFrom: -1,
    ready: false,
    legacyLines: new WeakSet(),
    legacyCount: 0,
    legacyDropped: 0
  };

  /* ---------------- DOM 缓存 ---------------- */
  function cacheEls() {
    els.scriptId = $('#scriptId');
    els.scriptTitle = $('#scriptTitle');
    els.saveState = $('#saveState');
    els.btnSave = $('#btnSave');
    els.btnPlay = $('#btnPlay');
    els.btnOpen = $('#btnOpen');
    els.btnNew = $('#btnNew');
    els.btnImport = $('#btnImport');
    els.btnExport = $('#btnExport');
    els.fileImport = $('#fileImport');
    els.lineCount = $('#lineCount');
    els.lineList = $('#lineList');
    els.timelineScroll = $('#timelineScroll');
    els.timeline = $('#timeline');
    els.totalTime = $('#totalTime');
    els.compatNote = $('#compatNote');
    els.animNote = $('#animNote');
    els.inspector = $('#inspector');
    els.inspectorEmpty = $('#inspectorEmpty');
    els.inspectorContent = $('#inspectorContent');
    els.inspectorHead = $('.inspector-head');
    els.inspectorBody = $('#inspectorBody');
    els.insIndex = $('#insIndex');
    els.insKind = $('#insKind');
    els.insMeta = $('#insMeta');
    els.durHint = $('#durHint');
    els.animStatus = $('#animStatus');
    els.charHint = $('#charHint');
    els.legacyHint = $('#legacyHint');
    els.bgPreview = $('#bgPreview');
    els.stillPreview = $('#stillPreview');
    els.openDialog = $('#openDialog');
    els.openList = $('#openList');
    els.openSearch = $('#openSearch');
    els.btnRefreshOpen = $('#btnRefreshOpen');
    els.btnCloseOpen = $('#btnCloseOpen');
    els.toastStack = $('#toastStack');
  }

  /* ---------------- 小工具 ---------------- */
  function currentLine() {
    return state.lines[state.selected] || null;
  }
  function isProducer(speaker) {
    const s = String(speaker || '').trim();
    return s === '' || ['制作人', '制片人', 'プロデューサー', 'プロデューサーさん', '旁白', 'ナレーション', 'narration'].includes(s);
  }
  function normalizeType(type, id) {
    let t = String(type || '').trim();
    const sid = String(id || '');
    if (t === 'idols' && sid.length > 0 && sid.length < 5) t = 'characters';
    if (!t && sid) t = sid.length >= 5 ? 'idols' : 'characters';
    return t;
  }
  function normalizeCat(cat) {
    return String(cat || 'stand').trim().replace(/_(fix|flex)$/, '') || 'stand';
  }
  function titleFromLines(lines) {
    const l = (lines || []).find((x) => x && (x.text || x.zh));
    if (!l) return '';
    const t = String(l.zh || l.text || '').replace(/\s+/g, ' ').trim();
    return t.length > 28 ? t.slice(0, 28) + '…' : t;
  }
  function generateId() {
    const d = new Date();
    const stamp = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '_' + pad2(d.getHours()) + pad2(d.getMinutes());
    return 'custom_' + stamp;
  }
  function playerUrl(id) {
    return location.origin + '/?cat=custom&id=' + encodeURIComponent(id || state.id);
  }
  function setUrlId(id) {
    const params = new URLSearchParams(location.search);
    if (id && ID_RE.test(id)) {
      params.set('id', id);
      params.delete('new');
    } else {
      params.delete('id');
      params.delete('new');
    }
    const q = params.toString();
    try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '')); } catch (e) {}
  }
  function fmtStart(ms) {
    const total = Math.max(0, Number(ms) || 0) / 1000;
    const m = Math.floor(total / 60);
    const s = total - m * 60;
    return m + ':' + s.toFixed(1).padStart(4, '0');
  }
  function fmtDur(ms) {
    const n = Math.max(0, Number(ms) || 0);
    if (n >= 60000) return fmtStart(n);
    return (n / 1000).toFixed(1) + 's';
  }
  function pauseMs(text) {
    let total = 0;
    let rest = String(text || '');
    const long = rest.split('……').length - 1;
    total += long * 700;
    rest = rest.replace(/……/g, '');
    const single = { '、': 120, '，': 220, ',': 220, '。': 450, '.': 450, '！': 350, '!': 350, '？': 350, '?': 350, '…': 350 };
    for (const ch of Object.keys(single)) {
      total += (rest.split(ch).length - 1) * single[ch];
    }
    total += (String(text || '').split('\n').length - 1) * 200;
    return total;
  }
  function estimateTextMs(text) {
    const t = String(text || '');
    const chars = t.replace(/\s/g, '').length;
    if (!chars) return 900;
    return Math.max(1200, chars * 170) + pauseMs(t);
  }
  function getTimings() {
    let acc = 0;
    return state.lines.map((l) => {
      let ms;
      if (l.waitType === 'time' && Number(l.waitTime) > 0) {
        ms = Number(l.waitTime);
      } else if (l.waitType === 'effect') {
        ms = Number(l.effectValue && l.effectValue.time) || 500;
      } else if (l.voice && state.durations.has(l.voice)) {
        ms = Math.max(600, state.durations.get(l.voice) * 1000);
      } else if (l.voice) {
        ms = Math.max(1800, estimateTextMs(l.zh || l.text || ''));
      } else {
        ms = estimateTextMs(l.text || l.zh || '');
      }
      const t = { start: acc, ms, voice: !!l.voice, exact: !!(l.voice && state.durations.has(l.voice)) };
      acc += ms;
      return t;
    });
  }

  /* ---------------- 行类型 ---------------- */
  function kindOf(l) {
    if (!l) return { key: 'event', label: '事件' };
    if (l.stillType || l.stillId || l.stillCtrl) return { key: 'still', label: '卡面' };
    if (l.text || l.voice) return { key: 'line', label: '台词' };
    if (l.charAnim1 || l.charAnim2 || l.charAnim3 || l.charAnim4 || l.charAnim5 || l.charLipAnim) return { key: 'action', label: '动作' };
    if (l.bg || l.bgm || l.se || l.fg || l.middleFg) return { key: 'bg', label: '背景 / 音频' };
    if (l.movie || l.gameEventCommunicationMovie) return { key: 'movie', label: '视频' };
    if (l.waitType) return { key: 'flow', label: '等待' };
    if (l.effectLabel || l.effectValue || l.charEffect) return { key: 'effect', label: '特效' };
    return { key: 'event', label: '事件' };
  }
  function lineSpeaker(l) {
    if (l.speaker) return l.speaker;
    if (l.stillType || l.stillId) return '卡面';
    if (l.charLabel) return l.charLabel;
    if (l.bg || l.bgm || l.se) return '场景';
    return '旁白';
  }
  function linePreview(l) {
    if (l.text) return l.text;
    if (l.zh) return l.zh;
    if (l.stillType || l.stillId) return '卡面 ' + (l.stillType || '?') + '/' + (l.stillId || '?');
    if (l.bg) return '背景 → ' + l.bg + (l.bgEffect ? ' · ' + l.bgEffect : '');
    if (l.charAnim1 || l.charAnim2 || l.charAnim3 || l.charAnim4 || l.charAnim5) {
      return '动作 ' + [l.charAnim1, l.charAnim2, l.charAnim3, l.charAnim4, l.charAnim5].filter(Boolean).join(' / ');
    }
    if (l.bgm) return 'BGM ' + l.bgm;
    if (l.se) return 'SE ' + l.se;
    if (l.effectLabel) return '特效 ' + l.effectLabel;
    if (l.waitType) return '等待 ' + (l.waitType === 'time' ? fmtDur(l.waitTime || 0) : 'effect');
    return '(空行 / 事件)';
  }
  function playerWillKeep(l) {
    if (!l) return false;
    return !!(l.text || l.voice || l.stillType || l.stillId || l.stillCtrl ||
      l.charLabel || l.bg || l.bgm || l.se || l.waitType || l.textFrame ||
      l.charAnim1 || l.charAnim2 || l.charAnim3 || l.charAnim4 || l.charAnim5 || l.charLipAnim ||
      l.movie || l.gameEventCommunicationMovie || l.fg || l.middleFg || l.effectLabel || l.bgEffect ||
      l.fgEffect || l.middleFgEffect || l.charEffect || l.charScale || l.charPosition);
  }

  /* ---------------- 动画白名单 ---------------- */
  function filterAnims(field, anims) {
    const list = anims.slice();
    if (field === 'charAnim2') {
      const main = list.filter((a) => /^(face_|blank$)/.test(a));
      return main.length ? main : list;
    }
    if (field === 'charLipAnim') {
      const main = list.filter((a) => /^(lip_|blank$)/.test(a));
      return main.length ? main : list;
    }
    if (field === 'charAnim4') {
      const main = list.filter((a) => /^(eye_|blank$)/.test(a));
      return main.length ? main : list;
    }
    return list;
  }
  function ensureAnims(label) {
    label = String(label || '').trim();
    if (!label) return Promise.resolve([]);
    if (state.animCache.has(label)) return Promise.resolve(state.animCache.get(label));
    if (state.animPromises.has(label)) return state.animPromises.get(label);
    const p = fetchJson('/api/animations?label=' + encodeURIComponent(label))
      .then((arr) => {
        if (!Array.isArray(arr)) throw new Error('返回不是数组');
        state.animCache.set(label, arr);
        state.animErrors.delete(label);
        return arr;
      })
      .catch((e) => {
        state.animCache.set(label, []);
        state.animErrors.set(label, (e && e.message) || '加载失败');
        return [];
      })
      .finally(() => { state.animPromises.delete(label); });
    state.animPromises.set(label, p);
    return p;
  }
  function animStatusText() {
    const l = currentLine();
    const label = l && l.charLabel ? String(l.charLabel).trim() : '';
    if (!label) return '选择 charLabel 后加载该角色的 Spine 动画白名单。';
    if (state.animErrors.has(label)) return '该角色没有可用的动画白名单（' + ell(state.animErrors.get(label), 48) + '），下拉保留手填值。';
    if (state.animCache.has(label)) {
      const n = state.animCache.get(label).length;
      return n ? '已按「' + label + '」加载 ' + n + ' 个动画；切换角色会重新加载。' : '「' + label + '」的白名单为空（spine 可能没有导出动画）。';
    }
    return '正在加载「' + label + '」的动画白名单…';
  }
  async function refreshAnimsForCurrent() {
    const l = currentLine();
    if (!l) return;
    const label = String(l.charLabel || '').trim();
    updateAnimStatus();
    if (!label) { fillAnimSelects([]); updateAnimStatus(); return; }
    const anims = await ensureAnims(label);
    if (currentLine() !== l) return;
    fillAnimSelects(anims);
    updateAnimStatus();
    renderFooter();
  }
  function fillAnimSelects(anims) {
    const l = currentLine();
    if (!l) return;
    const label = String(l.charLabel || '').trim();
    const fields = [
      ['f-charAnim1', 'charAnim1'], ['f-charAnim2', 'charAnim2'], ['f-charAnim3', 'charAnim3'],
      ['f-charAnim4', 'charAnim4'], ['f-charAnim5', 'charAnim5'], ['f-charLipAnim', 'charLipAnim']
    ];
    for (const pair of fields) {
      const sel = document.getElementById(pair[0]);
      const field = pair[1];
      if (!sel) continue;
      const current = String(l[field] || '');
      if (!label) {
        sel.innerHTML = '<option value="">先选 charLabel</option>';
        sel.disabled = true;
        continue;
      }
      if (!anims || !anims.length) {
        sel.innerHTML = '<option value="">（无白名单）</option>' +
          (current ? '<option value="' + esc(current) + '">' + esc(current) + '（当前值）</option>' : '');
        sel.value = current;
        sel.disabled = false;
        continue;
      }
      const list = filterAnims(field, anims);
      let html = '<option value="">（无 / 沿用）</option>';
      if (field === 'charAnim2' || field === 'charLipAnim' || field === 'charAnim4') {
        let re = field === 'charAnim2' ? /^(face_|blank$)/ : field === 'charLipAnim' ? /^(lip_|blank$)/ : /^(eye_|blank$)/;
        const main = list.filter((a) => re.test(a));
        const rest = list.filter((a) => !re.test(a));
        const groupLabel = field === 'charAnim2' ? '表情 face' : field === 'charLipAnim' ? '口型 lip' : '眼睛 eye';
        if (main.length) html += '<optgroup label="' + groupLabel + '">' + main.map((a) => '<option value="' + esc(a) + '">' + esc(a) + '</option>').join('') + '</optgroup>';
        if (rest.length) html += '<optgroup label="其它动画">' + rest.map((a) => '<option value="' + esc(a) + '">' + esc(a) + '</option>').join('') + '</optgroup>';
      } else {
        html += '<optgroup label="' + esc(label) + ' 的动画">' + list.map((a) => '<option value="' + esc(a) + '">' + esc(a) + '</option>').join('') + '</optgroup>';
      }
      if (current && list.indexOf(current) < 0) {
        html += '<option value="' + esc(current) + '">' + esc(current) + '（当前值）</option>';
      }
      sel.innerHTML = html;
      sel.disabled = false;
      sel.value = current;
      if (sel.value !== current) {
        const opt = document.createElement('option');
        opt.value = current;
        opt.textContent = current + '（当前值）';
        sel.appendChild(opt);
        sel.value = current;
      }
    }
  }
  function updateAnimStatus() {
    if (els.animStatus) els.animStatus.textContent = animStatusText();
  }

  /* ---------------- 时间估算 / 语音时长 ---------------- */
  function loadVoiceDuration(voice) {
    voice = String(voice || '');
    if (!voice || state.durations.has(voice) || state.durationErrors.has(voice) || state.durationLoading.has(voice)) return;
    state.durationLoading.add(voice);
    let audio;
    try { audio = new Audio(); } catch (e) { state.durationLoading.delete(voice); state.durationErrors.add(voice); return; }
    audio.preload = 'metadata';
    let finished = false;
    const done = (ok, dur) => {
      if (finished) return;
      finished = true;
      state.durationLoading.delete(voice);
      if (ok && Number.isFinite(dur) && dur > 0) {
        state.durations.set(voice, dur);
        refreshTimingViews();
      } else {
        state.durationErrors.add(voice);
      }
      try { audio.removeAttribute('src'); audio.load(); } catch (e) {}
    };
    audio.onloadedmetadata = () => done(true, audio.duration);
    audio.onerror = () => done(false, 0);
    audio.src = '/voice/' + voice.split('/').map(encodeURIComponent).join('/');
    try { audio.load(); } catch (e) { done(false, 0); }
  }
  function queueVoiceDurations() {
    const seen = new Set();
    let n = 0;
    for (const l of state.lines) {
      const v = String(l.voice || '');
      if (!v || seen.has(v) || state.durations.has(v) || state.durationErrors.has(v) || state.durationLoading.has(v)) continue;
      seen.add(v);
      setTimeout(() => loadVoiceDuration(v), 90 * n);
      n++;
      if (n >= 24) break;
    }
  }
  const refreshTimingViews = debounce(() => {
    renderTimeline();
    renderLineList();
    renderFooter();
    const l = currentLine();
    if (l) {
      const timing = getTimings()[state.selected];
      if (els.insMeta) els.insMeta.textContent = timingMeta(l, timing);
      updateDurHint(l, timing);
    }
  }, 120);

  /* ---------------- 数据清理 / 序列化 ---------------- */
  function readNumEl(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return numOrNull(el.value);
  }
  function cleanLine(line) {
    const src = line || {};
    const out = {};
    const take = (k, v) => {
      if (v === undefined || v === null) return;
      if (typeof v === 'string') {
        if (v !== '') out[k] = v;
      } else if (typeof v === 'number') {
        if (Number.isFinite(v)) out[k] = v;
      } else if (typeof v === 'boolean') {
        if (v || /Loop$/.test(k)) out[k] = v;
      } else if (typeof v === 'object') {
        if (Array.isArray(v)) { if (v.length) out[k] = clone(v); }
        else if (Object.keys(v).length) out[k] = clone(v);
      }
    };
    for (const k of FIELD_ORDER) if (k in src) take(k, src[k]);
    for (const k of Object.keys(src)) {
      if (FIELD_ORDER.indexOf(k) >= 0 || DERIVED_KEYS.has(k) || LEGACY_KEYS.has(k) || k.indexOf('__') === 0) continue;
      take(k, src[k]);
    }
    for (const k of LEGACY_KEYS) delete out[k];
    // charPosition：空值不写，部分填写补默认值
    const pos = src.charPosition;
    if (pos && typeof pos === 'object' && !Array.isArray(pos)) {
      const x = numOrNull(pos.x), y = numOrNull(pos.y), order = numOrNull(pos.order);
      if (x !== null || y !== null || order !== null) {
        out.charPosition = { x: x === null ? 568 : x, y: y === null ? 640 : y, order: order === null ? 0 : order };
      }
    }
    // 角色信息自动补
    const label = String(out.charLabel || '');
    if (label && state.charMap[label]) {
      const info = state.charMap[label];
      if (!out.charId && info.id) out.charId = String(info.id);
      if (!out.charType && info.type) out.charType = normalizeType(info.type, out.charId);
      if (!out.charCategory && info.cat) out.charCategory = normalizeCat(info.cat);
    }
    if (out.charId && !out.charType) out.charType = String(out.charId).length >= 5 ? 'idols' : 'characters';
    if (out.charType === 'idols' && String(out.charId || '').length > 0 && String(out.charId).length < 5) out.charType = 'characters';
    if ((out.charLabel || out.charId) && !out.charCategory) out.charCategory = 'stand';
    // 空 loop 不保留
    for (let i = 1; i <= 5; i++) {
      if (!out['charAnim' + i]) delete out['charAnim' + i + 'Loop'];
    }
    if (!out.charAnim2) delete out.charAnim2Loop;
    if (!out.charLipAnim) delete out.charLipAnim;
    // 默认文本框
    if (out.text && !out.textFrame) out.textFrame = isProducer(out.speaker) ? '002' : '001';
    // waitType 没有时长时不写
    if (out.waitType === 'time' && !(Number(out.waitTime) > 0)) delete out.waitType;
    // 纯空行只保留一个可识别字段，避免保存空对象
    return out;
  }
  function cleanLines() {
    return state.lines.map(cleanLine);
  }

  /* ---------------- 视频模式：旧跳转字段兼容 ---------------- */
  function hasVideoContent(l) {
    return VIDEO_CONTENT_KEYS.some((k) => {
      const v = l[k];
      if (v === undefined || v === null || v === '') return false;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false;
      return true;
    });
  }
  function normalizeLinesForVideo(rows) {
    let ignored = 0;
    let dropped = 0;
    const out = [];
    for (const raw of rows || []) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const l = clone(raw);
      let changed = false;
      if (l.select !== undefined && l.select !== null && l.select !== '') {
        if (!l.text) l.text = String(l.select).replace(/\r\n|\r/g, '\n');
        changed = true;
      }
      for (const k of LEGACY_KEYS) {
        if (l[k] !== undefined && l[k] !== null && l[k] !== '') changed = true;
        delete l[k];
      }
      if (changed && !hasVideoContent(l)) { dropped++; continue; }
      if (changed) { ignored++; state.legacyLines.add(l); }
      out.push(l);
    }
    state.legacyCount += ignored;
    state.legacyDropped += dropped;
    return out;
  }
  function resetLegacyState() {
    state.legacyLines = new WeakSet();
    state.legacyCount = 0;
    state.legacyDropped = 0;
  }
  function legacyNotice(prefix) {
    if (!state.legacyCount && !state.legacyDropped) return;
    const bits = [];
    if (state.legacyCount) bits.push(state.legacyCount + ' 行旧跳转字段（select/nextLabel/label/command）已转为普通文本或忽略');
    if (state.legacyDropped) bits.push('移除 ' + state.legacyDropped + ' 行纯跳转控制行');
    toast((prefix ? prefix + '：' : '') + bits.join('；') + '。保存时会丢弃这些字段。', 'warn', { stay: 6800 });
  }

  /* ---------------- fetch ---------------- */
  async function fetchJson(url, opts) {
    const r = await fetch(url, Object.assign({ cache: 'no-store' }, opts || {}));
    let data = null;
    const text = await r.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = null; }
    }
    if (!r.ok) {
      const err = new Error((data && (data.error || data.detail)) || ('HTTP ' + r.status));
      err.status = r.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ---------------- toast ---------------- */
  function toast(message, type, opts) {
    type = type || 'info';
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    if (opts.html) el.innerHTML = message;
    else el.textContent = message;
    els.toastStack.appendChild(el);
    while (els.toastStack.children.length > 4) els.toastStack.removeChild(els.toastStack.firstChild);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, opts.stay || 3800);
    return el;
  }

  /* ---------------- 状态外观 ---------------- */
  function setSaveState(s) {
    state.saveState = s;
    if (!els.saveState) return;
    els.saveState.dataset.state = s;
    const label = s === 'saved' ? '已保存' : s === 'saving' ? '保存中…' : '未保存';
    const span = els.saveState.querySelector('span');
    if (span) span.textContent = label;
    if (els.saveState) els.saveState.title = state.lastSaved ? ('上次保存：' + state.lastSaved.toLocaleString()) : '尚未保存到磁盘';
    if (els.btnSave) {
      els.btnSave.disabled = s === 'saving';
      els.btnSave.textContent = s === 'saving' ? '保存中…' : '保存';
    }
  }
  function updatePlayLink() {
    const id = String(state.id || '').trim();
    const ok = ID_RE.test(id);
    els.btnPlay.classList.toggle('disabled', !ok);
    els.btnPlay.href = ok ? playerUrl(id) : '#';
    els.btnPlay.title = ok
      ? ('打开播放器：' + playerUrl(id))
      : '先填写合法的剧本 ID（A-Z a-z 0-9 _ -）';
    els.scriptId.classList.toggle('invalid', !ok);
  }
  function markDirty() {
    state.dirty = true;
    setSaveState('dirty');
    updatePlayLink();
    saveDraftDebounced();
  }

  /* ---------------- 本地存储 ---------------- */
  function loadLocalData() {
    try {
      const t = JSON.parse(localStorage.getItem('enza.editor.titles.v1') || '{}');
      if (t && typeof t === 'object' && !Array.isArray(t)) state.titleMap = t;
    } catch (e) { state.titleMap = {}; }
    try {
      const tracks = JSON.parse(localStorage.getItem('enza.editor.tracks.v1') || 'null');
      if (Array.isArray(tracks)) {
        const valid = tracks.filter((id) => ALL_TRACKS.indexOf(id) >= 0);
        if (valid.length) state.openTracks = new Set(valid);
      }
    } catch (e) {}
  }
  function persistTitles() {
    try { localStorage.setItem('enza.editor.titles.v1', JSON.stringify(state.titleMap)); } catch (e) {}
  }
  function persistTracks() {
    try { localStorage.setItem('enza.editor.tracks.v1', JSON.stringify(Array.from(state.openTracks))); } catch (e) {}
  }
  function draftPayload() {
    return {
      v: 1, id: state.id, title: state.title, lines: state.lines,
      selected: state.selected, openTracks: Array.from(state.openTracks), savedAt: Date.now()
    };
  }
  function saveDraftNow() {
    if (!state.ready) return;
    try { localStorage.setItem('enza.editor.draft.v1', JSON.stringify(draftPayload())); } catch (e) {}
  }
  const saveDraftDebounced = debounce(saveDraftNow, 700);
  function restoreDraft() {
    try {
      const raw = localStorage.getItem('enza.editor.draft.v1');
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.lines) || !d.lines.length) return false;
      const rawLines = d.lines.filter((l) => l && typeof l === 'object' && !Array.isArray(l));
      resetLegacyState();
      state.lines = normalizeLinesForVideo(rawLines);
      if (!state.lines.length) return false;
      state.id = String(d.id || generateId());
      state.title = String(d.title || titleFromLines(state.lines) || '未命名剧本');
      state.selected = clamp(Number(d.selected) || 0, 0, state.lines.length - 1);
      if (Array.isArray(d.openTracks)) {
        const valid = d.openTracks.filter((id) => ALL_TRACKS.indexOf(id) >= 0);
        if (valid.length) state.openTracks = new Set(valid);
      }
      state.dirty = true;
      state.lastSaved = null;
      if (state.legacyCount || state.legacyDropped) setTimeout(() => legacyNotice('恢复草稿时检测到旧格式'), 800);
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- 顶部 ---------------- */
  function renderTop() {
    const id = String(state.id || '');
    if (document.activeElement !== els.scriptId) els.scriptId.value = id;
    if (document.activeElement !== els.scriptTitle) els.scriptTitle.value = state.title || '';
    els.lineCount.textContent = String(state.lines.length);
    document.title = (state.title || '未命名剧本') + ' · enza 剧本时间轴';
    updatePlayLink();
    setSaveState(state.dirty ? 'dirty' : (state.lastSaved ? 'saved' : 'dirty'));
  }

  /* ---------------- 左侧台词行 ---------------- */
  function lineBadges(l) {
    const b = [];
    if (l.voice) b.push({ t: '♪ voice', c: 'v' });
    if (l.bg) b.push({ t: 'bg ' + l.bg, c: '' });
    if (l.bgm) b.push({ t: 'bgm ' + l.bgm, c: 'a' });
    if (l.se) b.push({ t: 'se ' + l.se, c: 'a' });
    if (l.stillType || l.stillId) b.push({ t: 'still ' + (l.stillId || l.stillType || ''), c: 's' });
    if (l.charAnim1) b.push({ t: l.charAnim1, c: 'a' });
    if (l.charAnim2) b.push({ t: l.charAnim2, c: 'a' });
    if (state.legacyLines.has(l)) b.push({ t: '旧字段已忽略', c: 's' });
    return b;
  }
  function renderLineList() {
    const st = els.lineList.scrollTop;
    const timings = getTimings();
    if (!state.lines.length) {
      els.lineList.innerHTML = '<div class="line-empty"><b>还没有台词行</b>用上面的「+ 台词」开始，或从已有剧本导入。</div>';
      return;
    }
    els.lineList.innerHTML = state.lines.map((l, i) => {
      const t = timings[i] || { start: 0, ms: 0 };
      const k = kindOf(l);
      const kClass = k.key === 'bg' ? 'k-bg' : k.key === 'still' ? 'k-still' : k.key === 'action' ? 'k-action' : '';
      const badges = lineBadges(l);
      const badgeHtml = badges.slice(0, 3).map((b) => '<span class="li-badge ' + b.c + '">' + esc(b.t) + '</span>').join('') +
        (badges.length > 3 ? '<span class="li-badge">+' + (badges.length - 3) + '</span>' : '');
      const warn = playerWillKeep(l) ? '' : '<span class="li-warn" title="播放器会跳过这一行">!</span>';
      return '<div class="line-item ' + (i === state.selected ? 'sel' : '') + '" data-index="' + i + '" draggable="true">' +
        '<div class="li-grip" title="拖动排序">⠿</div>' +
        '<div class="li-num">' + pad2(i + 1) + '</div>' +
        '<div class="li-main">' +
          '<div class="li-top"><span class="li-speaker">' + esc(lineSpeaker(l)) + '</span>' +
            '<span class="li-kind ' + kClass + '">' + esc(k.label) + '</span>' +
            '<span class="li-time">' + fmtStart(t.start) + '</span></div>' +
          '<div class="li-text ' + (linePreview(l) === '(空行 / 事件)' ? 'empty' : '') + '">' + esc(linePreview(l)) + '</div>' +
          '<div class="li-badges">' + badgeHtml + '</div>' +
        '</div>' + warn +
        '<div class="li-actions">' +
          '<button type="button" data-act="up" title="上移">↑</button>' +
          '<button type="button" data-act="down" title="下移">↓</button>' +
          '<button type="button" data-act="dup" title="复制">⧉</button>' +
          '<button type="button" data-act="del" title="删除">✕</button>' +
        '</div>' +
      '</div>';
    }).join('');
    els.lineList.scrollTop = st;
  }

  /* ---------------- 轨道数据 ---------------- */
  function pushChip(out, b, v, cls) {
    if (v === undefined || v === null || v === '') return;
    out.push({ b: b || '', v: String(v), cls: cls || '' });
  }
  function trackChips(id, l) {
    const out = [];
    if (!l) return out;
    const p = l.charPosition || {};
    const ce = l.charEffect && typeof l.charEffect === 'object' ? l.charEffect : null;
    if (id === 'dialogue') {
      if (l.speaker) pushChip(out, '', l.speaker, 'sp');
      else if (l.text && !l.charLabel) pushChip(out, '', '旁白', 'dim');
      if (l.text) pushChip(out, '', ell(l.text, 20));
      else if (l.zh) pushChip(out, '', ell(l.zh, 20));
      if (l.voice) pushChip(out, '♪', l.voiceKeep ? 'keep' : 'voice', 'voice');
      if (l.zh && l.text) pushChip(out, '中', 'zh', 'dim');
    } else if (id === 'character') {
      if (l.charLabel) pushChip(out, '', l.charLabel);
      if (p && (p.x !== undefined || p.y !== undefined)) pushChip(out, '@', (p.x === undefined ? '?' : p.x) + ',' + (p.y === undefined ? '?' : p.y), 'dim');
      if (l.charScale) pushChip(out, '×', l.charScale, 'dim');
      if (ce && (ce.type || ce.alpha !== undefined)) {
        const isExit = ce.type === 'to' && Number(ce.alpha) === 0;
        const isIn = ce.type === 'from';
        pushChip(out, 'fx', isExit ? '退场' : isIn ? '入场' : (ce.type || 'charEffect'), isExit ? 'warn' : '');
      }
    } else if (id === 'action') {
      for (let i = 1; i <= 5; i++) {
        if (i === 2) continue;
        if (l['charAnim' + i]) pushChip(out, 'A' + i, l['charAnim' + i] + (l['charAnim' + i + 'Loop'] ? ' ∞' : ''));
      }
    } else if (id === 'expression') {
      if (l.charAnim2) pushChip(out, 'A2', l.charAnim2 + (l.charAnim2Loop ? ' ∞' : ''));
      if (l.charLipAnim) pushChip(out, 'lip', l.charLipAnim, l.voice ? '' : 'warn');
    } else if (id === 'background') {
      if (l.bg) pushChip(out, 'bg', l.bg);
      if (l.bgEffect) pushChip(out, '', l.bgEffect + (l.bgEffectTime ? ' ' + fmtDur(l.bgEffectTime) : ''), 'dim');
    } else if (id === 'foreground') {
      if (l.fg) pushChip(out, 'fg', l.fg);
      if (l.middleFg) pushChip(out, 'mid', l.middleFg);
      if (l.fgEffect) pushChip(out, '', 'fg ' + l.fgEffect, 'dim');
      if (l.middleFgEffect) pushChip(out, '', 'mid ' + l.middleFgEffect, 'dim');
    } else if (id === 'audio') {
      if (l.bgm) pushChip(out, 'bgm', l.bgm + (l.bgmFadeTime ? ' ·' + fmtDur(l.bgmFadeTime) : ''));
      if (l.se) pushChip(out, 'se', l.se);
    } else if (id === 'still') {
      if (l.stillType || l.stillId) pushChip(out, 'still', (l.stillType || '?') + '/' + (l.stillId || '?'));
      if (l.stillCtrl) pushChip(out, '', 'ctrl ' + l.stillCtrl, l.stillCtrl === 'off' ? 'dim' : '');
    } else if (id === 'movie') {
      if (l.movie) pushChip(out, 'movie', l.movie);
      if (l.gameEventCommunicationMovie) pushChip(out, 'movie', l.gameEventCommunicationMovie);
    } else if (id === 'effect') {
      if (l.effectLabel) pushChip(out, 'fx', l.effectLabel);
      if (l.effectValue && typeof l.effectValue === 'object') pushChip(out, '', l.effectValue.type || 'value', 'dim');
      if (l.effectTarget && typeof l.effectTarget === 'object') pushChip(out, '', l.effectTarget.type || 'target', 'dim');
      if (ce) {
        const exit = ce.type === 'to' && Number(ce.alpha) === 0;
        pushChip(out, 'char', exit ? '退场' : (ce.type || 'effect'), 'dim');
      }
    } else if (id === 'flow') {
      if (l.waitType) pushChip(out, 'wait', l.waitType === 'time' ? fmtDur(l.waitTime || 0) : 'effect');
    }
    return out;
  }

  /* ---------------- 轨道渲染 ---------------- */
  function chipHtml(c) {
    return '<span class="chip ' + (c.cls || '') + '">' +
      (c.b ? '<b>' + esc(c.b) + '</b>' : '') +
      '<span class="cv">' + esc(c.v) + '</span></span>';
  }
  function cellHtml(track, l, i, timing, maxMs, isSel) {
    if (track.id === 'time') {
      const pct = maxMs > 0 ? clamp(Math.round((timing.ms / maxMs) * 100), 4, 100) : 4;
      return '<button type="button" class="tl-cell ' + (isSel ? 'sel' : '') + '" data-line="' + i + '" data-track="time" title="' +
        esc(fmtStart(timing.start) + ' 起 · ' + fmtDur(timing.ms) + (timing.voice ? ' · voice' : ' · 估算')) + '">' +
        '<span class="time-top"><span class="time-start">' + fmtStart(timing.start) + '</span><span class="time-dur">' + fmtDur(timing.ms) + '</span></span>' +
        '<span class="time-bar"><i style="width:' + pct + '%"></i></span>' +
        (timing.voice ? '<span class="time-voice">' + (timing.exact ? 'voice 实测' : 'voice 估算') + '</span>' : '') +
      '</button>';
    }
    const chips = trackChips(track.id, l);
    const tip = chips.length ? chips.map((c) => (c.b ? c.b + ' ' : '') + c.v).join(' · ') : '空';
    let inner = '';
    if (chips.length) {
      inner = chips.slice(0, 3).map(chipHtml).join('');
      if (chips.length > 3) inner += '<span class="chip count">+' + (chips.length - 3) + '</span>';
    } else {
      inner = '<span class="cell-plus">+</span>';
    }
    return '<button type="button" class="tl-cell ' + (isSel ? 'sel ' : '') + (chips.length ? '' : 'empty ') + '" data-line="' + i + '" data-track="' + track.id + '" title="' +
      esc(tip + ' · 点击编辑第 ' + (i + 1) + ' 行') + '">' + inner + '</button>';
  }
  function trackHeadHtml(track, count, totalLabel) {
    if (track.id === 'time') {
      return '<div class="tl-trackhead static t-time"><span class="th-dot"></span><span class="th-name">时间标尺</span>' +
        '<span class="th-count has" title="累计时长">' + esc(totalLabel) + '</span></div>';
    }
    const open = state.openTracks.has(track.id);
    return '<button type="button" class="tl-trackhead ' + track.cls + (open ? '' : ' collapsed') + '" data-track="' + track.id + '" title="' +
      esc(open ? '收起 ' + track.name : '展开 ' + track.name) + '">' +
      '<span class="th-dot"></span><span class="th-name">' + esc(track.name) + '</span>' +
      '<span class="th-count ' + (count ? 'has' : '') + '">' + count + '</span>' +
      '<span class="th-fold">⌄</span></button>';
  }
  function collapsedLaneHtml(track) {
    const parts = [];
    state.lines.forEach((l, i) => {
      const chips = trackChips(track.id, l);
      if (!chips.length) return;
      const text = chips.map((c) => (c.b ? c.b + ' ' : '') + c.v).join(' · ');
      parts.push({ i, text });
    });
    let inner = parts.slice(0, 10).map((p) =>
      '<button type="button" class="sum-chip" data-line="' + p.i + '" data-track="' + track.id + '" title="' + esc(p.text) + '"><b>' + pad2(p.i + 1) + '</b>' + esc(ell(p.text, 24)) + '</button>'
    ).join('');
    if (parts.length > 10) inner += '<span class="sum-empty">+' + (parts.length - 10) + '</span>';
    if (!parts.length) inner = '<span class="sum-empty">—</span>';
    return '<div class="tl-lane collapsed ' + track.cls + '" data-track="' + track.id + '"><div class="tl-summary">' + inner + '</div></div>';
  }
  function renderTimeline() {
    const scrollLeft = els.timelineScroll.scrollLeft;
    const scrollTop = els.timelineScroll.scrollTop;
    const timings = getTimings();
    const total = timings.reduce((a, t) => a + t.ms, 0);
    els.totalTime.textContent = fmtStart(total);
    if (!state.lines.length) {
      els.timeline.innerHTML = '<div class="line-empty"><b>暂无轨道</b>先添加一行台词或事件。</div>';
      return;
    }
    const cols = state.lines.length;
    const available = Math.max(500, els.timelineScroll.clientWidth - 24);
    const labelW = 150;
    const colw = clamp(Math.floor((available - labelW - 4) / Math.max(1, cols)), 118, 184);
    const laneW = colw * cols;
    const maxMs = timings.reduce((a, t) => Math.max(a, t.ms), 1);
    const colheads = state.lines.map((l, i) => {
      const k = kindOf(l);
      return '<button type="button" class="tl-colhead ' + (i === state.selected ? 'sel' : '') + '" data-line="' + i + '" title="选择第 ' + (i + 1) + ' 行">' +
        '<span class="col-no">' + pad2(i + 1) + ' · ' + esc(k.label) + '</span>' +
        '<span class="col-speaker">' + esc(lineSpeaker(l)) + '</span>' +
        '<span class="col-kind">' + fmtStart(timings[i].start) + ' 起 · ' + fmtDur(timings[i].ms) + '</span></button>';
    }).join('');
    let html = '<div class="tl-grid" style="--cols:' + cols + ';--colw:' + colw + 'px;--lanew:' + laneW + 'px;--labelw:' + labelW + 'px">' +
      '<div class="tl-corner"><span class="corner-dot"></span>轨道 / 行</div>' +
      '<div class="tl-colheads">' + colheads + '</div>';
    // 时间标尺
    const timeLane = timings.map((t, i) => cellHtml({ id: 'time' }, state.lines[i], i, t, maxMs, i === state.selected)).join('');
    html += trackHeadHtml({ id: 'time', name: '时间标尺' }, cols, fmtStart(total));
    html += '<div class="tl-lane t-time" data-track="time">' + timeLane + '</div>';
    // 11 条数据轨
    for (const track of TRACKS) {
      let count = 0;
      state.lines.forEach((l) => { if (trackChips(track.id, l).length) count++; });
      html += trackHeadHtml(track, count, '');
      if (state.openTracks.has(track.id)) {
        const cells = state.lines.map((l, i) => cellHtml(track, l, i, timings[i], maxMs, i === state.selected)).join('');
        html += '<div class="tl-lane ' + track.cls + '" data-track="' + track.id + '">' + cells + '</div>';
      } else {
        html += collapsedLaneHtml(track);
      }
    }
    html += '</div>';
    els.timeline.innerHTML = html;
    els.timelineScroll.scrollLeft = scrollLeft;
    els.timelineScroll.scrollTop = scrollTop;
  }

  /* ---------------- 行编辑面板 ---------------- */
  function setVal(id, value) {
    const el = document.getElementById(id);
    if (!el || (!syncForce && document.activeElement === el)) return;
    el.value = value === undefined || value === null ? '' : String(value);
  }
  function setCheck(id, checked) {
    const el = document.getElementById(id);
    if (!el || (!syncForce && document.activeElement === el)) return;
    el.checked = !!checked;
  }
  function setSelect(id, value) {
    const el = document.getElementById(id);
    if (!el || (!syncForce && document.activeElement === el)) return;
    const v = value === undefined || value === null ? '' : String(value);
    if (v && !Array.from(el.options).some((o) => o.value === v)) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v + '（当前值）';
      el.appendChild(opt);
    }
    el.value = v;
  }
  function setJson(id, value) {
    const el = document.getElementById(id);
    if (!el || (!syncForce && document.activeElement === el)) return;
    const has = value && typeof value === 'object' && Object.keys(value).length;
    el.value = has ? JSON.stringify(value, null, 2) : '';
    el.classList.remove('invalid');
  }
  function timingMeta(l, t) {
    return fmtStart(t.start) + ' 起 · ' + fmtDur(t.ms) + (l.voice ? ' · voice' : '') + (t.exact ? ' 实测' : '');
  }
  function updateDurHint(l, t) {
    if (!els.durHint || !l) return;
    const ms = t ? t.ms : 0;
    let msg;
    if (l.waitType === 'time' && Number(l.waitTime) > 0) {
      msg = 'waitTime 固定 ' + fmtDur(Number(l.waitTime)) + '，播放器按此等待。';
    } else if (l.waitType === 'effect') {
      msg = 'waitType=effect，按 effectValue.time 等待（' + fmtDur(ms) + '）。';
    } else if (l.voice && state.durations.has(l.voice)) {
      msg = 'voice 实测 ' + state.durations.get(l.voice).toFixed(2) + 's，行时长 ' + fmtDur(ms) + '。';
    } else if (l.voice) {
      msg = 'voice 时长读取中，暂按字数估算 ' + fmtDur(ms) + '。';
    } else {
      msg = '无 voice，按字数 + 标点估算 ' + fmtDur(ms) + '。';
    }
    if (l.voiceKeep) msg += ' 这一行会保留上一句语音。';
    els.durHint.textContent = msg;
  }
  function updatePreviews() {
    const l = currentLine();
    if (!l) return;
    const bg = String(l.bg || '');
    if (bg && bg !== 'off') {
      els.bgPreview.src = '/bg/' + encodeURIComponent(bg);
      els.bgPreview.classList.add('on');
    } else {
      els.bgPreview.classList.remove('on');
      els.bgPreview.removeAttribute('src');
    }
    const st = String(l.stillType || '');
    const sid = String(l.stillId || '');
    if (st && sid) {
      els.stillPreview.src = '/still/' + encodeURIComponent(st) + '/' + encodeURIComponent(sid);
      els.stillPreview.classList.add('on');
    } else {
      els.stillPreview.classList.remove('on');
      els.stillPreview.removeAttribute('src');
    }
  }
  const updatePreviewsDebounced = debounce(updatePreviews, 260);

  function syncInspector(force) {
    syncForce = !!force;
    const l = currentLine();
    if (!l) { syncForce = false; return; }
    const t = getTimings()[state.selected] || { start: 0, ms: 0, exact: false };
    setVal('f-speaker', l.speaker);
    setVal('f-text', l.text);
    setVal('f-zh', l.zh);
    setVal('f-voice', l.voice);
    setCheck('f-voiceKeep', l.voiceKeep);
    setVal('f-textFrame', l.textFrame);
    setVal('f-charLabel', l.charLabel);
    setVal('f-charId', l.charId);
    setSelect('f-charType', l.charType);
    setVal('f-charCategory', l.charCategory);
    const p = l.charPosition || {};
    setVal('f-posX', p.x);
    setVal('f-posY', p.y);
    setVal('f-posOrder', p.order);
    setVal('f-charScale', l.charScale);
    setSelect('f-bgEffect', l.bgEffect);
    setVal('f-bgEffectTime', l.bgEffectTime);
    setVal('f-bg', l.bg);
    setVal('f-fg', l.fg);
    setSelect('f-fgEffect', l.fgEffect);
    setVal('f-fgEffectTime', l.fgEffectTime);
    setVal('f-middleFg', l.middleFg);
    setSelect('f-middleFgEffect', l.middleFgEffect);
    setVal('f-middleFgEffectTime', l.middleFgEffectTime);
    setVal('f-bgm', l.bgm);
    setVal('f-bgmFadeTime', l.bgmFadeTime);
    setVal('f-se', l.se);
    setVal('f-stillType', l.stillType);
    setVal('f-stillId', l.stillId);
    setVal('f-stillCtrl', l.stillCtrl);
    setVal('f-movie', l.movie);
    setVal('f-gameEventCommunicationMovie', l.gameEventCommunicationMovie);
    setVal('f-effectLabel', l.effectLabel);
    setJson('f-effectTarget', l.effectTarget);
    setJson('f-effectValue', l.effectValue);
    setJson('f-charEffect', l.charEffect);
    setSelect('f-waitType', l.waitType);
    setVal('f-waitTime', l.waitTime);
    setVal('f-lipAnimDuration', l.lipAnimDuration);
    if (els.legacyHint) els.legacyHint.hidden = !state.legacyLines.has(l);
    for (let i = 1; i <= 5; i++) setCheck('f-charAnim' + i + 'Loop', l['charAnim' + i + 'Loop']);
    setCheck('f-charAnim2Loop', l.charAnim2Loop);
    const label = String(l.charLabel || '').trim();
    if (!label) els.charHint.textContent = '未指定角色（旁白 / 制作人 / 纯事件行）。';
    else if (state.charMap[label]) {
      const info = state.charMap[label];
      els.charHint.textContent = '自动补：' + (info.id || '?') + ' · ' + normalizeType(info.type, info.id) + ' / ' + normalizeCat(info.cat);
    } else els.charHint.textContent = '不在 char_map，请手填 charId / charType / charCategory。';
    updateAnimStatus();
    fillAnimSelects(label && state.animCache.has(label) ? state.animCache.get(label) : []);
    updateDurHint(l, t);
    updatePreviewsDebounced();
    syncForce = false;
  }
  function renderInspector() {
    const l = currentLine();
    els.inspectorContent.hidden = !l;
    els.inspectorEmpty.hidden = !!l;
    if (!l) return;
    const t = getTimings()[state.selected] || { start: 0, ms: 0, exact: false };
    els.insIndex.textContent = pad2(state.selected + 1);
    els.insKind.textContent = kindOf(l).label + (l.charLabel ? ' · ' + l.charLabel : '');
    els.insMeta.textContent = timingMeta(l, t);
    syncInspector(true);
    if (l.charLabel && !state.animCache.has(l.charLabel)) refreshAnimsForCurrent();
  }

  /* ---------------- 时间线选择 / 折叠 ---------------- */
  function focusInspectorField(trackId, opts) {
    const track = TRACK_BY_ID[trackId];
    if (!track) return;
    const sec = document.querySelector('details[data-sec="' + track.section + '"]');
    if (sec) sec.open = true;
    const target = document.getElementById(track.focus);
    if (!target) return;
    try { target.focus({ preventScroll: true }); } catch (e) {}
    if (sec) {
      try { sec.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
    if (opts && opts.select && target.select && trackId === 'dialogue') {
      try { target.select(); } catch (e) {}
    }
  }
  function scrollColumnIntoView(i) {
    const head = $('.tl-colhead[data-line="' + i + '"]');
    if (!head) return;
    const sc = els.timelineScroll;
    const sr = sc.getBoundingClientRect();
    const hr = head.getBoundingClientRect();
    const leftLimit = sr.left + 150;
    if (hr.left < leftLimit) sc.scrollLeft -= (leftLimit - hr.left + 12);
    else if (hr.right > sr.right - 10) sc.scrollLeft += (hr.right - sr.right + 12);
  }
  function selectLine(i, opts) {
    opts = opts || {};
    if (!state.lines.length) return;
    state.selected = clamp(Number(i) || 0, 0, state.lines.length - 1);
    renderTop();
    renderLineList();
    renderTimeline();
    renderInspector();
    renderFooter();
    const focusTrack = opts.focusTrack;
    requestAnimationFrame(() => {
      scrollColumnIntoView(state.selected);
      if (focusTrack) focusInspectorField(focusTrack, opts);
    });
    saveDraftDebounced();
  }

  /* ---------------- 行操作 ---------------- */
  function newLine(kind) {
    const prev = currentLine() || {};
    const base = {
      speaker: '', text: '', charLabel: '', charId: '', charType: '', charCategory: '',
      textFrame: '', waitType: 'time', waitTime: 1800
    };
    if (kind === 'line') {
      base.speaker = '制作人'; base.textFrame = '002';
    } else if (kind === 'action') {
      base.charLabel = prev.charLabel || '';
      base.charId = prev.charId || '';
      base.charType = prev.charType || '';
      base.charCategory = prev.charCategory || '';
      base.textFrame = 'off';
      base.waitTime = 900;
      base.charAnim1 = prev.charAnim1 || 'wait';
      if (prev.charAnim2) base.charAnim2 = prev.charAnim2;
    } else if (kind === 'background') {
      base.bg = prev.bg || '00007';
      base.bgEffect = 'fade';
      base.bgEffectTime = 500;
      base.textFrame = 'off';
      base.waitTime = 900;
    } else if (kind === 'still') {
      base.stillType = 'idols';
      base.stillId = '';
      base.textFrame = 'off';
      base.waitTime = 1200;
    } else if (kind === 'event') {
      base.textFrame = 'off';
      base.waitTime = 1000;
    } else if (kind === 'blank') {
      base.textFrame = 'off';
      base.waitTime = 1000;
    }
    if (base.charLabel && state.charMap[base.charLabel]) {
      const info = state.charMap[base.charLabel];
      base.charId = base.charId || String(info.id || '');
      base.charType = base.charType || normalizeType(info.type, base.charId);
      base.charCategory = base.charCategory || normalizeCat(info.cat);
    }
    return base;
  }
  function addLine(kind) {
    const line = newLine(kind || 'line');
    const at = state.lines.length ? state.selected + 1 : 0;
    state.lines.splice(at, 0, line);
    state.selected = at;
    markDirty();
    renderTop();
    renderLineList();
    renderTimeline();
    renderInspector();
    renderFooter();
    requestAnimationFrame(() => scrollColumnIntoView(at));
    saveDraftNow();
  }
  function duplicateLine(i) {
    const l = state.lines[i];
    if (!l) return;
    state.lines.splice(i + 1, 0, clone(l));
    state.selected = i + 1;
    markDirty();
    renderTop(); renderLineList(); renderTimeline(); renderInspector(); renderFooter();
    requestAnimationFrame(() => scrollColumnIntoView(i + 1));
  }
  function deleteLine(i) {
    if (state.lines.length <= 1) { toast('至少保留一行。', 'warn'); return; }
    if (!window.confirm('删除第 ' + (i + 1) + ' 行？此操作可以在保存前撤销（未保存）。')) return;
    state.lines.splice(i, 1);
    state.selected = clamp(i, 0, state.lines.length - 1);
    markDirty();
    renderTop(); renderLineList(); renderTimeline(); renderInspector(); renderFooter();
    requestAnimationFrame(() => scrollColumnIntoView(state.selected));
  }
  function moveLine(from, to) {
    if (from === to || from < 0 || to < 0 || from >= state.lines.length || to >= state.lines.length) return;
    const item = state.lines.splice(from, 1)[0];
    state.lines.splice(to, 0, item);
    state.selected = to;
    markDirty();
    renderTop(); renderLineList(); renderTimeline(); renderInspector(); renderFooter();
    requestAnimationFrame(() => scrollColumnIntoView(to));
  }

  /* ---------------- 行编辑事件 ---------------- */
  function applyCharInfo(l, label) {
    if (label && state.charMap[label]) {
      const info = state.charMap[label];
      l.charId = String(info.id || '');
      l.charType = normalizeType(info.type, l.charId);
      l.charCategory = normalizeCat(info.cat);
    } else if (!label) {
      l.charId = '';
      l.charType = '';
      l.charCategory = '';
    }
  }
  function updatePositionFromInputs() {
    const l = currentLine();
    if (!l) return;
    const x = readNumEl('f-posX'), y = readNumEl('f-posY'), order = readNumEl('f-posOrder');
    if (x === null && y === null && order === null) delete l.charPosition;
    else l.charPosition = { x: x === null ? 568 : x, y: y === null ? 640 : y, order: order === null ? 0 : order };
  }
  const refreshListAndTimeline = debounce(() => {
    renderTimeline();
    renderLineList();
    renderFooter();
    updatePlayLink();
  }, 160);
  function afterLineEdit(field) {
    markDirty();
    const l = currentLine();
    if (!l) return;
    if (field === 'voice') queueVoiceDurations();
    if (field === 'bg' || field === 'stillType' || field === 'stillId') updatePreviewsDebounced();
    const t = getTimings()[state.selected];
    if (els.insMeta && t) els.insMeta.textContent = timingMeta(l, t);
    updateDurHint(l, t);
    refreshListAndTimeline();
  }
  function onInspectorInput(e) {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.classList.contains('json-field')) {
      const raw = String(el.value || '').trim();
      if (!raw) { el.classList.remove('invalid'); return; }
      try {
        const v = JSON.parse(raw);
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('object only');
        el.classList.remove('invalid');
      } catch (err) { el.classList.add('invalid'); }
      return;
    }
    if (!el.matches('[data-field]')) return;
    const field = el.dataset.field;
    const l = currentLine();
    if (!l || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    if (el.type === 'number') {
      const v = String(el.value || '').trim();
      if (!v) delete l[field];
      else {
        const n = Number(v);
        if (!Number.isFinite(n)) return;
        l[field] = n;
      }
    } else {
      l[field] = el.value;
    }
    afterLineEdit(field);
  }
  function onInspectorChange(e) {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const l = currentLine();
    if (!l) return;
    if (el.matches('[data-loop]')) {
      l[el.dataset.loop] = !!el.checked;
      afterLineEdit(el.dataset.loop);
      return;
    }
    if (el.matches('[data-pos]')) {
      updatePositionFromInputs();
      afterLineEdit('charPosition');
      return;
    }
    if (!el.matches('[data-field]')) return;
    const field = el.dataset.field;
    if (el.type === 'checkbox') {
      l[field] = !!el.checked;
    } else {
      l[field] = el.value;
    }
    if (field === 'charLabel') {
      applyCharInfo(l, String(l.charLabel || '').trim());
      refreshAnimsForCurrent();
      syncInspector();
    }
    if (field === 'waitType' && l.waitType === 'time' && !(Number(l.waitTime) > 0)) {
      l.waitTime = 1800;
      setVal('f-waitTime', l.waitTime);
    }
    afterLineEdit(field);
  }
  function parseJsonField(el) {
    const l = currentLine();
    if (!l) return true;
    const field = el.dataset.jsonField;
    const raw = String(el.value || '').trim();
    if (!raw) {
      delete l[field];
      el.classList.remove('invalid');
      return true;
    }
    try {
      const v = JSON.parse(raw);
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('must be object');
      l[field] = v;
      el.classList.remove('invalid');
      return true;
    } catch (e) {
      el.classList.add('invalid');
      return false;
    }
  }
  function onInspectorBlur(e) {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.classList.contains('json-field')) return;
    const before = JSON.stringify(currentLine());
    if (!parseJsonField(el)) {
      toast('JSON 格式不合法：' + (el.dataset.jsonField || '') + '，修正后再保存。', 'warn');
      return;
    }
    el.classList.remove('invalid');
    if (JSON.stringify(currentLine()) !== before) afterLineEdit(el.dataset.jsonField || 'json');
  }
  function setQuickEffect(kind) {
    const l = currentLine();
    if (!l) return;
    const effect = kind === 'enter'
      ? { type: 'from', alpha: 0, time: 100 }
      : kind === 'exit'
        ? { type: 'to', alpha: 0, time: 100 }
        : { type: 'to', alpha: 1, time: 100 };
    l.charEffect = effect;
    setJson('f-charEffect', effect);
    markDirty();
    refreshListAndTimeline();
    toast(kind === 'exit' ? '已记录退场 charEffect（播放器当前以切换当前角色实现隐藏）。' : '已记录入场 charEffect。', 'info');
  }
  function autoSlot() {
    const l = currentLine();
    if (!l) return;
    if (!l.charLabel) { toast('先填写 charLabel，才能计算站位。', 'warn'); return; }
    const labels = [];
    for (const x of state.lines) {
      const lab = String(x.charLabel || '').trim();
      if (lab && labels.indexOf(lab) < 0) labels.push(lab);
    }
    const idx = Math.max(0, labels.indexOf(l.charLabel));
    const n = labels.length;
    let x = 568;
    if (n === 2) x = [310, 796][clamp(idx, 0, 1)];
    else if (n >= 3) x = [260, 568, 876][clamp(idx, 0, 2)];
    l.charPosition = { x, y: 640, order: idx };
    setVal('f-posX', x); setVal('f-posY', 640); setVal('f-posOrder', idx);
    markDirty();
    refreshListAndTimeline();
  }
  function clearPosition() {
    const l = currentLine();
    if (!l) return;
    delete l.charPosition;
    setVal('f-posX', ''); setVal('f-posY', ''); setVal('f-posOrder', '');
    markDirty();
    refreshListAndTimeline();
  }

  /* ---------------- 保存 / 导入 / 导出 ---------------- */
  function validateBeforeSave() {
    const id = String(state.id || '').trim();
    if (!ID_RE.test(id)) { toast('剧本 ID 不合法：只能 A-Z a-z 0-9 _ -，1–64 位，不能含路径分隔符。', 'error'); els.scriptId.focus(); return false; }
    if (!state.lines.length) { toast('至少要有一行。', 'error'); return false; }
    for (const el of $$('.json-field')) {
      if (!parseJsonField(el)) {
        toast('JSON 字段不合法：' + (el.dataset.jsonField || '') + '，请修正。', 'error');
        el.focus();
        return false;
      }
    }
    return true;
  }
  async function save() {
    if (state.saving) return false;
    if (!validateBeforeSave()) return false;
    if (!state.title.trim()) state.title = titleFromLines(state.lines) || '未命名剧本';
    const id = String(state.id).trim();
    const hasLegacy = state.legacyCount > 0 || state.legacyDropped > 0 ||
      state.lines.some((l) => Array.from(LEGACY_KEYS).some((k) => l[k] !== undefined && l[k] !== null && l[k] !== ''));
    if (hasLegacy) {
      toast('视频模式保存：select / nextLabel / label / command 不会写入 JSON，旧 select 文本已转为普通台词。', 'warn', { stay: 5200 });
    }
    const payload = { id, lines: cleanLines() };
    state.saving = true;
    setSaveState('saving');
    try {
      const res = await fetchJson('/api/save-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      state.id = id;
      state.dirty = false;
      state.lastSaved = new Date();
      state.titleMap[id] = state.title;
      persistTitles();
      setUrlId(id);
      if (hasLegacy) resetLegacyState();
      renderTop();
      setSaveState('saved');
      saveDraftNow();
      renderLineList();
      renderTimeline();
      renderFooter();
      const link = '<a href="' + esc(res.url) + '" target="_blank" rel="noopener">打开播放器 →</a>';
      const note = hasLegacy ? ' · 旧跳转字段已丢弃' : '';
      toast('已保存 <b>' + esc(id) + '.json</b> · ' + res.count + ' 行' + note + ' ' + link, 'success', { html: true, stay: 6200 });
      return true;
    } catch (e) {
      setSaveState('dirty');
      toast('保存失败：' + ((e && e.message) || e), 'error', { stay: 5200 });
      return false;
    } finally {
      state.saving = false;
      if (els.btnSave) els.btnSave.disabled = false;
    }
  }
  function exportJson() {
    if (!validateBeforeSave()) return;
    if (state.legacyCount || state.legacyDropped) legacyNotice('导出');
    const id = String(state.id || 'custom').trim() || 'custom';
    const text = JSON.stringify(cleanLines(), null, 2) + '\n';
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = id + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出 ' + id + '.json（' + state.lines.length + ' 行）。', 'success');
  }
  function importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const data = JSON.parse(text);
        importData(data, { filename: file.name });
      } catch (e) {
        toast('导入失败：不是合法 JSON（' + ((e && e.message) || e) + '）', 'error');
      }
    };
    reader.onerror = () => toast('读取文件失败。', 'error');
    reader.readAsText(file, 'utf-8');
  }
  function importData(data, opts) {
    opts = opts || {};
    if (state.dirty && !opts.silent && !window.confirm('当前有未保存修改，导入会覆盖，继续？')) return false;
    const arr = Array.isArray(data) ? data : (data && Array.isArray(data.lines) ? data.lines : null);
    if (!arr) { if (!opts.silent) toast('导入失败：顶层必须是数组，或 {lines:[...]}。', 'error'); return false; }
    resetLegacyState();
    const clean = normalizeLinesForVideo(arr);
    if (!clean.length) { if (!opts.silent) toast('导入失败：没有可用的线性行。', 'error'); return false; }
    let id = String((data && !Array.isArray(data) && data.id) || opts.filename || '').replace(/\.json$/i, '').trim();
    if (!ID_RE.test(id)) id = generateId();
    state.id = id;
    state.lines = clean;
    state.selected = 0;
    state.title = String((data && !Array.isArray(data) && data.title) || opts.filename || '').replace(/\.json$/i, '') || titleFromLines(clean) || '未命名剧本';
    state.dirty = true;
    state.lastSaved = null;
    setUrlId(id);
    renderAll();
    saveDraftNow();
    if (!opts.silent) toast('已导入 ' + clean.length + ' 行：' + id, 'success');
    legacyNotice('检测到旧格式');
    return true;
  }

  /* ---------------- 打开已有 ---------------- */
  async function loadOpenList() {
    if (!els.openList) return;
    els.openList.innerHTML = '<div class="open-empty">读取中…</div>';
    try {
      const res = await fetchJson('/api/list?cat=custom');
      state.openScripts = Array.isArray(res.ids) ? res.ids : [];
      renderOpenList();
    } catch (e) {
      els.openList.innerHTML = '<div class="open-empty">读取失败：' + esc((e && e.message) || e) + '</div>';
    }
  }
  function renderOpenList() {
    const q = String((els.openSearch && els.openSearch.value) || '').trim().toLowerCase();
    const ids = state.openScripts.filter((id) => !q || id.toLowerCase().indexOf(q) >= 0);
    if (!ids.length) { els.openList.innerHTML = '<div class="open-empty">没有匹配的自定义剧本。</div>'; return; }
    els.openList.innerHTML = ids.map((id) => {
      const title = state.titleMap[id] || '';
      return '<button type="button" class="open-item" data-id="' + esc(id) + '">' +
        '<span class="oi-id">' + esc(id) + '</span>' +
        (title ? '<span class="oi-title">' + esc(title) + '</span>' : '') +
        '<span class="oi-go">打开 →</span></button>';
    }).join('');
  }
  async function openDialog() {
    if (els.openDialog.open) return;
    els.openDialog.showModal();
    await loadOpenList();
  }
  async function loadCustom(id, opts) {
    opts = opts || {};
    if (!ID_RE.test(String(id || ''))) { if (!opts.silent) toast('剧本 ID 不合法。', 'error'); return false; }
    try {
      const res = await fetchJson('/api/custom-raw?id=' + encodeURIComponent(id));
      if (!Array.isArray(res.lines)) throw new Error('不是数组');
      resetLegacyState();
      state.id = id;
      state.lines = normalizeLinesForVideo(res.lines);
      if (!state.lines.length) throw new Error('剧本为空');
      state.selected = 0;
      state.title = state.titleMap[id] || titleFromLines(state.lines) || id;
      state.dirty = false;
      state.lastSaved = new Date(res.mtime || Date.now());
      state.openTracks = new Set(DEFAULT_OPEN);
      persistTracks();
      setUrlId(id);
      if (opts.render !== false) {
        renderAll();
        saveDraftNow();
      }
      if (!opts.silent) toast('已打开 ' + id + ' · ' + state.lines.length + ' 行', 'info');
      if (state.legacyCount || state.legacyDropped) setTimeout(() => legacyNotice('检测到旧格式'), 450);
      return true;
    } catch (e) {
      if (!opts.silent) toast('打开失败：' + ((e && e.message) || e), 'error');
      return false;
    }
  }

  /* ---------------- 新建 / 恢复 ---------------- */
  function newScript(opts) {
    opts = opts || {};
    resetLegacyState();
    state.id = generateId();
    state.title = '未命名剧本';
    state.lines = [newLine('line')];
    state.selected = 0;
    state.openTracks = new Set(DEFAULT_OPEN);
    state.dirty = true;
    state.lastSaved = null;
    state.saveState = 'dirty';
    if (!opts.keepUrl) setUrlId('');
    if (opts.render !== false) {
      renderAll();
      saveDraftNow();
    }
  }
  function requestNew() {
    if (state.dirty && !window.confirm('当前修改还没保存，确定新建？')) return;
    newScript();
    toast('已新建空白剧本。', 'info');
  }

  /* ---------------- 渲染入口 ---------------- */
  function renderFooter() {
    const skipped = state.lines.filter((l) => !playerWillKeep(l)).length;
    if (els.compatNote) {
      if (state.legacyCount || state.legacyDropped) {
        els.compatNote.className = 'compat-note warn';
        els.compatNote.textContent = '视频模式：旧跳转字段已忽略 ' + state.legacyCount + ' 行' +
          (state.legacyDropped ? '，移除 ' + state.legacyDropped + ' 行控制行' : '') + ' · 保存时丢弃';
      } else if (skipped) {
        els.compatNote.className = 'compat-note warn';
        els.compatNote.textContent = '⚠ ' + skipped + ' 行没有播放器可识别的字段，播放时可能被跳过';
      } else {
        els.compatNote.className = 'compat-note ok';
        els.compatNote.textContent = '✓ ' + state.lines.length + ' 行均可被当前播放器读取 · 线性时间轴 · 空值会在保存时省略';
      }
    }
    if (els.animNote) {
      const l = currentLine();
      const label = l && l.charLabel ? String(l.charLabel).trim() : '';
      if (!label) els.animNote.textContent = '动画白名单：—';
      else if (state.animErrors.has(label)) els.animNote.textContent = '动画白名单：' + label + ' 不可用';
      else if (state.animCache.has(label)) els.animNote.textContent = '动画白名单：' + label + ' · ' + state.animCache.get(label).length + ' 个';
      else els.animNote.textContent = '动画白名单：' + label + ' 加载中…';
    }
  }
  function renderAll() {
    renderTop();
    renderLineList();
    renderTimeline();
    renderInspector();
    renderFooter();
    queueVoiceDurations();
    preloadAnims();
  }
  function preloadAnims() {
    const labels = [];
    for (const l of state.lines) {
      const lab = String(l.charLabel || '').trim();
      if (lab && labels.indexOf(lab) < 0) labels.push(lab);
    }
    labels.slice(0, 8).forEach((lab) => {
      ensureAnims(lab).then(() => {
        renderFooter();
        const cur = currentLine();
        if (cur && String(cur.charLabel || '').trim() === lab) {
          fillAnimSelects(state.animCache.get(lab) || []);
          updateAnimStatus();
        }
      });
    });
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    els.scriptId.addEventListener('input', () => {
      state.id = els.scriptId.value;
      markDirty();
      updatePlayLink();
    });
    els.scriptTitle.addEventListener('input', () => {
      state.title = els.scriptTitle.value;
      markDirty();
      if (document.title) document.title = (state.title || '未命名剧本') + ' · enza 剧本时间轴';
    });
    els.btnSave.addEventListener('click', () => save());
    els.btnExport.addEventListener('click', exportJson);
    els.btnImport.addEventListener('click', () => els.fileImport.click());
    els.fileImport.addEventListener('change', () => {
      const f = els.fileImport.files && els.fileImport.files[0];
      if (f) importFile(f);
      els.fileImport.value = '';
    });
    els.btnNew.addEventListener('click', requestNew);
    els.btnOpen.addEventListener('click', openDialog);
    els.btnPlay.addEventListener('click', () => {
      if (state.dirty) toast('提示：当前有未保存修改，播放器打开的是上一次保存的版本。', 'warn', { stay: 4200 });
    });

    $$('[data-add]').forEach((b) => b.addEventListener('click', () => addLine(b.dataset.add)));
    $$('#btnDefaultTracks').forEach((b) => b.addEventListener('click', () => {
      state.openTracks = new Set(DEFAULT_OPEN);
      persistTracks();
      renderTimeline();
      renderFooter();
    }));
    els.timelineScroll.parentNode.querySelector('#btnExpandAll').addEventListener('click', () => {
      state.openTracks = new Set(ALL_TRACKS);
      persistTracks();
      renderTimeline();
    });
    els.timelineScroll.parentNode.querySelector('#btnCollapseAll').addEventListener('click', () => {
      state.openTracks = new Set();
      persistTracks();
      renderTimeline();
    });

    // 左侧点击 / 操作
    els.lineList.addEventListener('click', (e) => {
      const item = e.target.closest('.line-item');
      if (!item) return;
      const idx = Number(item.dataset.index);
      const act = e.target.closest('[data-act]');
      if (act) {
        e.stopPropagation();
        const a = act.dataset.act;
        if (a === 'up') moveLine(idx, idx - 1);
        else if (a === 'down') moveLine(idx, idx + 1);
        else if (a === 'dup') duplicateLine(idx);
        else if (a === 'del') deleteLine(idx);
        return;
      }
      selectLine(idx);
    });
    // 左侧拖拽
    els.lineList.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.line-item');
      if (!item) return;
      state.dragFrom = Number(item.dataset.index);
      item.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(state.dragFrom)); } catch (err) {}
    });
    els.lineList.addEventListener('dragend', () => {
      state.dragFrom = -1;
      $$('.line-item', els.lineList).forEach((x) => x.classList.remove('dragging', 'drag-over'));
    });
    els.lineList.addEventListener('dragover', (e) => {
      const item = e.target.closest('.line-item');
      if (!item || state.dragFrom < 0) return;
      e.preventDefault();
      $$('.line-item', els.lineList).forEach((x) => x.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });
    els.lineList.addEventListener('dragleave', (e) => {
      const item = e.target.closest('.line-item');
      if (item) item.classList.remove('drag-over');
    });
    els.lineList.addEventListener('drop', (e) => {
      const item = e.target.closest('.line-item');
      if (!item || state.dragFrom < 0) return;
      e.preventDefault();
      let to = Number(item.dataset.index);
      if (state.dragFrom < to) to--;
      moveLine(state.dragFrom, to);
      state.dragFrom = -1;
    });

    // 轨道点击
    els.timeline.addEventListener('click', (e) => {
      const fold = e.target.closest('.tl-trackhead');
      if (fold && !fold.classList.contains('static')) {
        const id = fold.dataset.track;
        if (state.openTracks.has(id)) state.openTracks.delete(id);
        else state.openTracks.add(id);
        persistTracks();
        renderTimeline();
        return;
      }
      const hit = e.target.closest('.tl-cell, .tl-colhead, .sum-chip');
      if (!hit) return;
      const idx = Number(hit.dataset.line);
      const track = hit.dataset.track || '';
      selectLine(idx, { focusTrack: track });
    });

    // 行编辑面板
    els.inspectorBody.addEventListener('input', onInspectorInput);
    els.inspectorBody.addEventListener('change', onInspectorChange);
    els.inspectorBody.addEventListener('blur', onInspectorBlur, true);
    els.inspectorBody.addEventListener('click', (e) => {
      const quick = e.target.closest('[data-quick-effect]');
      if (quick) { setQuickEffect(quick.dataset.quickEffect); return; }
      const rowAct = e.target.closest('[data-row-act]');
      if (rowAct) {
        if (rowAct.dataset.rowAct === 'dup') duplicateLine(state.selected);
        else if (rowAct.dataset.rowAct === 'del') deleteLine(state.selected);
        return;
      }
      if (e.target.closest('#btnAutoSlot')) { autoSlot(); return; }
      if (e.target.closest('#btnClearPos')) { clearPosition(); return; }
    });
    els.bgPreview.addEventListener('error', () => els.bgPreview.classList.remove('on'));
    els.stillPreview.addEventListener('error', () => els.stillPreview.classList.remove('on'));

    // 模态框
    els.btnCloseOpen.addEventListener('click', () => els.openDialog.close());
    els.btnRefreshOpen.addEventListener('click', loadOpenList);
    els.openSearch.addEventListener('input', renderOpenList);
    els.openDialog.addEventListener('click', (e) => {
      if (e.target === els.openDialog) els.openDialog.close();
    });
    els.openList.addEventListener('click', async (e) => {
      const item = e.target.closest('.open-item');
      if (!item) return;
      const id = item.dataset.id;
      if (state.dirty && !window.confirm('当前修改还没保存，打开 ' + id + ' 会覆盖，继续？')) return;
      els.openDialog.close();
      await loadCustom(id, { silent: false });
    });

    // 快捷键
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        save();
      }
    });
    window.addEventListener('resize', debounce(() => {
      if (state.lines.length) renderTimeline();
    }, 140));
    window.addEventListener('beforeunload', (e) => {
      if (state.dirty && !state.saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /* ---------------- 角色映射 ---------------- */
  async function loadCharMap() {
    try {
      const map = await fetchJson('/api/char-map');
      if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('bad char map');
      state.charMap = map;
      populateCharDatalists();
    } catch (e) {
      toast('char_map 加载失败：' + ((e && e.message) || e) + '（仍可手填 charId）', 'warn', { stay: 5000 });
    }
  }
  function populateCharDatalists() {
    const labels = Object.keys(state.charMap).sort();
    const labelList = document.getElementById('charLabels');
    if (labelList) labelList.innerHTML = labels.map((k) => '<option value="' + esc(k) + '"></option>').join('');
    const ids = [];
    for (const k of labels) {
      const id = state.charMap[k] && state.charMap[k].id;
      if (id && ids.indexOf(String(id)) < 0) ids.push(String(id));
    }
    ids.sort();
    const idList = document.getElementById('charIds');
    if (idList) idList.innerHTML = ids.map((v) => '<option value="' + esc(v) + '"></option>').join('');
    const bgList = document.getElementById('bgIds');
    if (bgList && !bgList.children.length) {
      const opts = [];
      for (let i = 0; i <= 40; i++) opts.push('000' + pad2(i).padStart(2, '0'));
      bgList.innerHTML = ['00007', '00074', '00133', '001331'].concat(opts).map((v) => '<option value="' + v + '"></option>').join('');
    }
    const bgmList = document.getElementById('bgmIds');
    if (bgmList && !bgmList.children.length) {
      const opts = [];
      for (let i = 0; i <= 40; i++) opts.push(String(i).padStart(3, '0'));
      bgmList.innerHTML = opts.map((v) => '<option value="' + v + '"></option>').join('');
    }
  }

  /* ---------------- 初始化 ---------------- */
  async function init() {
    cacheEls();
    bindEvents();
    loadLocalData();
    setSaveState('dirty');
    await loadCharMap();

    const params = new URLSearchParams(location.search);
    const qid = params.get('id');
    let loaded = false;
    if (qid && ID_RE.test(qid)) loaded = await loadCustom(qid, { silent: true, render: false });
    if (!loaded && params.get('new') !== '1') {
      loaded = restoreDraft();
      if (loaded) {
        setUrlId(state.id);
        setTimeout(() => toast('已恢复上次未保存的草稿（' + state.lines.length + ' 行）。', 'info', { stay: 4600 }), 500);
      }
    }
    if (!loaded) newScript({ render: false });
    if (!state.id) state.id = generateId();
    if (!state.lines.length) state.lines = [newLine('line')];
    state.selected = clamp(state.selected, 0, Math.max(0, state.lines.length - 1));
    state.ready = true;
    renderAll();
    window.__editorReady = true;
    window.__editor = {
      state,
      save,
      loadCustom,
      selectLine,
      addLine,
      importData,
      getTimings,
      playerUrl: () => playerUrl(state.id),
      setScript: (data) => importData(data, { silent: true }),
      refresh: () => renderAll()
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
