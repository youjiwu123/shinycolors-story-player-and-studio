/* =====================================================================
   闪耀色彩 同人工坊 · Phase 2 三层工程结构 (.scpack → Scenes → Script)
   与三步渐进式创作流 (Step 1 脑洞大纲 → Step 2 台本润色+OOC → Step 3 编译舞台+:18899真Spine内嵌)
   ===================================================================== */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const LLM_STORAGE_KEY = 'scstudio.llmConfig';
  const AI_TTS_STORAGE_KEY = 'scstudio.aiTtsConfig.v2';
  const SNAPSHOT_PREFIX = 'scstudio.snapshots.';

  const W = {
    projects: [],
    idolMeta: {},
    emotionPresets: {},
    idolOutfits: {},
    activeProjectId: 'island_survival_pack',
    activeSceneId: 'scene_01_harbor',
    stageViewMode: 'spine', // 'spine' | 'ruler'
    outlineDrafts: [],
    premiseDraft: '',
    busy: false,
    isDirty: false,
    envDrawerOpen: false,
    dirtySceneIds: new Set(),
    scriptLang: 'both', // 'both' | 'zh'
    scriptEditMode: 'cards', // 'cards' | 'batch'
    lastGenerator: '',
    lastGeneratorLabel: '',
    lastLlmWarning: null,
    scriptDepth: (() => { try { return localStorage.getItem('scstudio.scriptDepth') || 'standard'; } catch (_) { return 'standard'; } })(),
    playAllState: null // { active: true, playerId, mergedScproj, sceneRanges, currentSceneId, timer }
  };

  let _quietRecompileTimer = null;
  let _quietRecompileSeq = 0;

  function invalidateQuietRecompile() {
    _quietRecompileSeq++;
    if (_quietRecompileTimer) {
      clearTimeout(_quietRecompileTimer);
      _quietRecompileTimer = null;
    }
  }

  function resolveScenePlayerId(project, sceneOrId) {
    const scObj = (sceneOrId && typeof sceneOrId === 'object') ? sceneOrId : null;
    const rawId = scObj ? (scObj.id || scObj.sceneId || '') : String(sceneOrId || '');
    if (!rawId) return '';
    if (scObj) {
      if (scObj.playerScriptId) return String(scObj.playerScriptId);
      if (scObj.scproj && scObj.scproj.meta && scObj.scproj.meta['x-playerScriptId']) {
        return String(scObj.scproj.meta['x-playerScriptId']);
      }
    }
    const projObj = project || getActiveProject();
    if (!scObj && projObj && Array.isArray(projObj.stories)) {
      const hit = projObj.stories.find((s) => s && s.id === rawId);
      if (hit) {
        if (hit.playerScriptId) return String(hit.playerScriptId);
        if (hit.scproj && hit.scproj.meta && hit.scproj.meta['x-playerScriptId']) {
          return String(hit.scproj.meta['x-playerScriptId']);
        }
      }
    }
    const rawScene = String(rawId).replace(/[^A-Za-z0-9_-]/g, '_').replace(/^[^A-Za-z0-9]+/, '') || 'custom_scene';
    const pid = projObj && projObj.id ? String(projObj.id) : '';
    if (!pid || /_full_all$/i.test(rawScene)) return rawScene.slice(0, 64);
    const safeProj = pid.replace(/[^A-Za-z0-9_-]/g, '_').replace(/^[^A-Za-z0-9]+/, '') || 'proj';
    if (rawScene.indexOf(safeProj + '__') === 0 && rawScene.length <= 64) return rawScene;
    const combined = `${safeProj}__${rawScene}`;
    if (combined.length <= 64) return combined;
    let h = 0x811c9dc5;
    for (let i = 0; i < combined.length; i++) {
      h ^= combined.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    const h6 = (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
    if (rawScene.length <= 39) {
      const availProj = 64 - 2 - rawScene.length;
      return `${safeProj.slice(0, availProj - 7)}_${h6}__${rawScene}`;
    }
    const projPart = `${safeProj.slice(0, Math.min(16, safeProj.length))}_${h6}`;
    return `${projPart}__${rawScene.slice(0, Math.max(1, 64 - projPart.length - 2))}`;
  }

  function defaultLlmProfile() {
    return { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: '', model: 'gemini-2.5-flash' };
  }

  function normalizeLlmProfile(raw, dflt, inheritDefault) {
    const src = Object.assign({}, dflt, raw || {});
    let baseUrl = String(src.baseUrl || dflt.baseUrl).trim();
    const apiKey = String(src.apiKey || '').trim();
    let model = String(src.model || dflt.model).trim();
    // Migrate untouched legacy DeepSeek default when no API key is saved
    if (!apiKey && /^https:\/\/api\.deepseek\.com\/v1\/?$/i.test(baseUrl) && model === 'deepseek-chat') {
      baseUrl = dflt.baseUrl;
      model = dflt.model;
    }
    const out = { baseUrl, apiKey, model };
    if (inheritDefault !== undefined) {
      out.inheritStory = raw && raw.inheritStory !== undefined ? raw.inheritStory !== false : inheritDefault;
    }
    return out;
  }

  function defaultTtsConfig() {
    return {
      provider: 'cloud_fish',
      endpoint: 'https://api.fish.audio',
      apiKey: '',
      model: 'drama-3',
      voiceMapText: '',
      format: 'mp3',
      explicitOff: false
    };
  }

  function getAiTtsBundle() {
    let legacy = {};
    try {
      const rawLegacy = localStorage.getItem(LLM_STORAGE_KEY);
      if (rawLegacy) legacy = JSON.parse(rawLegacy) || {};
    } catch (_) {}
    let bundle = null;
    try {
      const rawV2 = localStorage.getItem(AI_TTS_STORAGE_KEY);
      if (rawV2) bundle = JSON.parse(rawV2);
    } catch (_) {}
    const dflt = defaultLlmProfile();
    const rawTts = (bundle && bundle.tts) || null;
    const tts = Object.assign({}, defaultTtsConfig(), rawTts || {});
    // Migrate untouched legacy default ('off' pointing to :8088 with no key and not explicitly disabled) -> cloud_fish
    if (
      rawTts &&
      !rawTts.explicitOff &&
      rawTts.provider === 'off' &&
      !rawTts.apiKey &&
      (!rawTts.endpoint || rawTts.endpoint === 'http://127.0.0.1:8088')
    ) {
      tts.provider = 'cloud_fish';
      tts.endpoint = 'https://api.fish.audio';
      tts.model = 'drama-3';
      tts.format = 'mp3';
    }
    return {
      story: normalizeLlmProfile((bundle && bundle.story) || legacy, dflt),
      stage: normalizeLlmProfile(bundle && bundle.stage, dflt, true),
      agent: normalizeLlmProfile(bundle && bundle.agent, dflt, true),
      tts
    };
  }

  function saveAiTtsBundle(nextBundle) {
    const prev = getAiTtsBundle();
    const merged = {
      story: Object.assign({}, prev.story, (nextBundle && nextBundle.story) || {}),
      stage: Object.assign({}, prev.stage, (nextBundle && nextBundle.stage) || {}),
      agent: Object.assign({}, prev.agent, (nextBundle && nextBundle.agent) || {}),
      tts: Object.assign({}, prev.tts, (nextBundle && nextBundle.tts) || {})
    };
    try {
      localStorage.setItem(AI_TTS_STORAGE_KEY, JSON.stringify(merged));
      localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(merged.story));
    } catch (_) {}
    updateGeneratorBadges();
    return merged;
  }

  function getLlmConfig(role = 'story') {
    const b = getAiTtsBundle();
    const r = (role === 'stage' || role === 'agent') ? role : 'story';
    const prof = b[r] || b.story;
    if (r !== 'story' && prof.inheritStory && !prof.apiKey) {
      return { baseUrl: b.story.baseUrl, apiKey: b.story.apiKey, model: b.story.model };
    }
    return {
      baseUrl: prof.baseUrl || b.story.baseUrl,
      apiKey: prof.apiKey || (prof.inheritStory ? b.story.apiKey : ''),
      model: prof.model || b.story.model
    };
  }

  function getTtsConfig() {
    return getAiTtsBundle().tts;
  }

  async function ensureAutoFishTtsConfig(forceRefresh = false) {
    try {
      const res = await fetch('/api/studio/tts/eidolon-preset' + (forceRefresh ? '?refresh=1' : ''));
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.ok) return null;
      W.eidolonFishPreset = data;
      const cur = getTtsConfig();
      if (data.hasLocalKey && !cur.explicitOff && (!cur.provider || cur.provider === 'cloud_fish')) {
        const nextModel = (cur.model && cur.model !== 'gpt-4o-mini-tts') ? cur.model : (data.defaultModel || 'drama-3');
        saveAiTtsBundle({
          tts: {
            provider: 'cloud_fish',
            endpoint: data.endpoint || 'https://api.fish.audio',
            model: nextModel,
            format: 'mp3',
            explicitOff: false
          }
        });
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  function saveLlmConfig(cfg, role = 'story') {
    const r = (role === 'stage' || role === 'agent') ? role : 'story';
    const dflt = defaultLlmProfile();
    const clean = {
      baseUrl: String((cfg && cfg.baseUrl) || dflt.baseUrl).trim(),
      apiKey: String((cfg && cfg.apiKey) || '').trim(),
      model: String((cfg && cfg.model) || dflt.model).trim()
    };
    if (r !== 'story') clean.inheritStory = Boolean(cfg && cfg.inheritStory);
    saveAiTtsBundle({ [r]: clean });
    return clean;
  }

  function getActiveServerLlmInfo() {
    const info = W.authInfo;
    if (info && info.canUseServerKeys && info.serverLlm && info.serverLlm.configured) {
      return info.serverLlm;
    }
    return null;
  }

  function getDefaultEngineBadge() {
    const cfg = getLlmConfig('story');
    const serverLlm = getActiveServerLlmInfo();
    if (cfg.apiKey) {
      return {
        isLlm: true,
        label: `🤖 AI 大模型就绪 (${cfg.model})`,
        shortLabel: `🤖 AI 就绪 (${cfg.model})`,
        title: `已配置生文大模型：${cfg.baseUrl} (${cfg.model})`
      };
    }
    if (serverLlm) {
      const m = serverLlm.model || 'Gemini';
      return {
        isLlm: true,
        label: `☁ 服务器 Gemini 就绪 (${m})`,
        shortLabel: `☁ 服务器 Gemini (${m})`,
        title: `已通过账号授权使用服务器托管大模型：${m}（自定义 Key 留空即可）`
      };
    }
    return {
      isLlm: false,
      label: '⚡ 本地模板生成',
      shortLabel: '⚡ 本地模板',
      title: '未填写 API Key 时默认使用本地 0-OOC 模板引擎，点击右上「🔌 接口与语音」可分别配置生文/演出/助手模型与 TTS'
    };
  }

  function updateGeneratorBadges(genType, genLabel, warningMsg) {
    if (genType !== undefined) W.lastGenerator = genType;
    if (genLabel !== undefined) W.lastGeneratorLabel = genLabel;
    if (warningMsg !== undefined) W.lastLlmWarning = warningMsg;

    const cfg = getLlmConfig('story');
    const tts = getTtsConfig();
    const hasKey = Boolean(cfg.apiKey);
    const serverLlm = getActiveServerLlmInfo();
    const dfltBadge = getDefaultEngineBadge();
    const btnLbl = $('#llmBtnLabel');
    if (btnLbl) {
      const ttsTag = (tts && tts.provider && tts.provider !== 'off') ? ` · ${tts.provider}` : '';
      btnLbl.textContent = hasKey
        ? ` ${cfg.model || 'AI'}${ttsTag}`
        : serverLlm
        ? ` ☁ ${serverLlm.model || 'Gemini'}${ttsTag}`
        : ` 接口与语音${ttsTag}`;
    }
    const badge = $('#genEngineBadge');
    if (badge) {
      const isLlm = W.lastGenerator === 'llm' || (dfltBadge.isLlm && W.lastGenerator !== 'template_fallback');
      badge.classList.toggle('llm', isLlm);
      badge.textContent = W.lastGeneratorLabel || dfltBadge.label;
      badge.title = W.lastLlmWarning ? `⚠ 回退提示：${W.lastLlmWarning}` : dfltBadge.title;
    }
  }

  function getActiveProject() {
    return W.projects.find((p) => p.id === W.activeProjectId) || W.projects[0] || null;
  }

  function getActiveScene() {
    const p = getActiveProject();
    if (!p || !Array.isArray(p.stories)) return null;
    return p.stories.find((s) => s.id === W.activeSceneId) || p.stories[0] || null;
  }

  function ensureCardSegments(sceneOrCard, fallbackCast) {
    const cast = Array.isArray(sceneOrCard && sceneOrCard.cast) && sceneOrCard.cast.length
      ? sceneOrCard.cast.slice()
      : Array.isArray(fallbackCast) && fallbackCast.length
      ? fallbackCast.slice()
      : ['amana', 'hana'];
    if (sceneOrCard && Array.isArray(sceneOrCard.segments) && sceneOrCard.segments.length) {
      return sceneOrCard.segments.map((seg, idx) => ({
        beatId: String(seg.beatId || `beat_${idx + 1}`),
        title: String(seg.title || `剧情小段 ${idx + 1}`).trim(),
        summary: String(seg.summary || seg.title || '').trim(),
        cast: Array.isArray(seg.cast) && seg.cast.length ? seg.cast.slice() : cast.slice(0, 3),
        targetLines: Number(seg.targetLines) || 4,
        needsActionCue: Boolean(seg.needsActionCue),
        blockingHint: String(seg.blockingHint || '').trim(),
        mood: String(seg.mood || '').trim().toLowerCase(),
        bgm: String(seg.bgm || '').trim(),
        bgmReason: String(seg.bgmReason || '').trim(),
        bgmLocked: Boolean(seg.bgmLocked),
        bgmSuggestions: Array.isArray(seg.bgmSuggestions) ? seg.bgmSuggestions : []
      }));
    }
    const beats = (sceneOrCard && Array.isArray(sceneOrCard.beats) && sceneOrCard.beats.length)
      ? sceneOrCard.beats
      : ['节拍 1：角色登场与开场互动', '节拍 2：核心冲突与推进', '节拍 3：情感升温与本幕收尾'];
    return beats.map((b, idx) => {
      const raw = String(b || '').replace(/^节拍\s*\d+\s*[：:]\s*/, '').trim() || `剧情小段 ${idx + 1}`;
      const parts = raw.split(/[—\-：:，,]/);
      return {
        beatId: `beat_${idx + 1}`,
        title: (parts[0] || raw).slice(0, 22),
        summary: raw,
        cast: cast.slice(0, 3),
        targetLines: 4
      };
    });
  }

  function getActiveSceneSegment(beatId) {
    const sc = getActiveScene();
    const card = (W.outlineDrafts || []).find((c) => c.sceneId === W.activeSceneId);
    const segs = (card && Array.isArray(card.segments) && card.segments.length)
      ? card.segments
      : (sc ? ensureCardSegments(sc, sc.cast) : []);
    const idx = segs.findIndex((s) => s.beatId === beatId);
    if (idx >= 0) {
      return Object.assign({ index: idx + 1 }, segs[idx]);
    }
    return null;
  }

  function updateSegmentMeta(beatId, patch) {
    if (!beatId || !patch) return;
    const sc = getActiveScene();
    const card = (W.outlineDrafts || []).find((c) => c.sceneId === W.activeSceneId);
    [sc, card].forEach((target) => {
      if (!target) return;
      target.segments = ensureCardSegments(target, target.cast);
      const seg = target.segments.find((s) => s.beatId === beatId);
      if (seg) Object.assign(seg, patch);
      target.beats = target.segments.map((s, i) => `节拍 ${i + 1}：${s.title} —— ${s.summary}`);
    });
  }

  function addLineToBeat(beatId) {
    const P = window.SCProto;
    if (!P || !P.S || !P.S.doc) return;
    const rows = P.S.doc.rows;
    let insertIdx = rows.length - 1;
    let lastBeatRow = null;
    for (let i = 0; i < rows.length; i++) {
      const m = rows[i].line._meta || {};
      if ((m['x-beatId'] || m.beatId) === beatId) {
        insertIdx = i;
        lastBeatRow = rows[i];
      }
    }
    const seg = getActiveSceneSegment(beatId);
    const cid = (seg && seg.cast && seg.cast[0]) || (lastBeatRow && lastBeatRow.line.charLabel) || 'amana';
    const im = W.idolMeta[cid] || { speaker: cid, nameZh: cid };
    P.exec(`在小段 ${beatId} 末尾新增台词`, () => {
      const nl = {
        id: Date.now() % 1000000,
        speaker: im.speaker || cid,
        charLabel: cid,
        text: '「プロデューサー、ここからの展開はどうする？」',
        textCtrl: 'p',
        textFrame: '001',
        _meta: {
          uid: 'u_' + Date.now().toString(36),
          zh: '「制作人，接下来的剧情要怎么展开呢？」',
          origin: 'custom',
          'x-beatId': beatId,
          'x-beatTitle': (seg && seg.title) || beatId
        }
      };
      const made = { key: 'k' + (++P.S.doc.keySeq), line: nl };
      rows.splice(insertIdx + 1, 0, made);
      P.S.selKey = made.key;
    });
    P.toast(`＋ 已在「${(seg && seg.title) || beatId}」末尾新增台词`);
  }

  function getPinnedFacts(proj) {
    if (!proj) return [];
    if (Array.isArray(proj.pinnedFacts)) return proj.pinnedFacts;
    try {
      const raw = localStorage.getItem(`sc_pinned_facts_${proj.id}`);
      const arr = raw ? JSON.parse(raw) : [];
      proj.pinnedFacts = Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && x.trim()) : [];
    } catch (_) {
      proj.pinnedFacts = [];
    }
    return proj.pinnedFacts;
  }

  function savePinnedFacts(proj, list) {
    if (!proj) return;
    proj.pinnedFacts = Array.from(new Set((list || []).map((x) => String(x).trim()).filter(Boolean)));
    try {
      localStorage.setItem(`sc_pinned_facts_${proj.id}`, JSON.stringify(proj.pinnedFacts));
    } catch (_) {}
  }

  function buildStoryContinuityContext(targetSceneId, generatedRowsMap = null) {
    const p = getActiveProject();
    if (!p) return null;
    const pinnedFacts = getPinnedFacts(p);
    const projectPremise = String(W.premiseDraft || p.premise || p.synopsisZh || p.synopsis || '').trim();
    const acts = (W.outlineDrafts && W.outlineDrafts.length ? W.outlineDrafts : (p.stories || []))
      .map((item, idx) => ({
        sceneId: item.sceneId || item.id,
        order: idx + 1,
        title: item.titleZh || item.title || `第 ${idx + 1} 幕`,
        summary: item.summary || '',
        cast: item.cast || [],
        rows: (generatedRowsMap && generatedRowsMap.get(item.sceneId || item.id)) ||
          (p.stories && p.stories.find((s) => s.id === (item.sceneId || item.id))?.scriptRows) ||
          []
      }));

    const curIdx = acts.findIndex((a) => a.sceneId === targetSceneId);
    const prevActs = curIdx > 0 ? acts.slice(0, curIdx) : [];

    // Layer 2: compressed summary + character-fact ledger across all prior acts (scales to 30+ acts)
    const previousActsSummary = prevActs
      .map((a) => {
        const castNames = (a.cast || []).map((cid) => (W.idolMeta[cid] ? W.idolMeta[cid].speaker : cid)).join('、');
        const digest = (a.summary || '').trim().slice(0, 140);
        return `第${a.order}幕「${a.title}」(${castNames})：${digest}`;
      })
      .join('\n');

    // Layer 3: recent dialogue window (last 6 lines of immediately preceding act)
    let recentLines = '';
    if (prevActs.length > 0) {
      const lastAct = prevActs[prevActs.length - 1];
      const dlg = (lastAct.rows || []).filter((r) => r && (r.zh || r.text) && r.kind !== 'direction');
      recentLines = dlg
        .slice(-6)
        .map((r) => `[${r.speaker || '旁白'}] ${r.zh || r.text}`)
        .join('\n');
    }

    return { pinnedFacts, projectPremise, previousActsSummary, recentLines };
  }

  async function regenerateSingleBeat(beatId, btnEl) {
    const p = getActiveProject();
    const sc = getActiveScene();
    const P = window.SCProto;
    if (!p || !sc || !beatId) return;
    const card = (W.outlineDrafts || []).find((c) => c.sceneId === sc.id) || sc;
    card.segments = ensureCardSegments(card, card.cast);
    const segIdx = card.segments.findIndex((s) => s.beatId === beatId);
    const seg = segIdx >= 0 ? card.segments[segIdx] : { beatId, title: beatId, summary: sc.summary || '', cast: sc.cast || ['amana', 'hana'], targetLines: 4 };
    const existingRows = extractScriptRowsFromProtoDoc();
    setBusyProgress(`正在生成小段「${seg.title}」台词…`, `regen-seg-${segIdx >= 0 ? segIdx : 0}`, btnEl);
    try {
      if (P && P.toast) P.toast(`🔄 正在仅重写小段「${seg.title}」的台词（保留其他小段不变）…`);
      const res = await fetch('/api/studio/expand-beat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: p.id,
          sceneId: sc.id,
          outline: card,
          beatId: seg.beatId,
          beat: seg,
          segment: seg,
          beatIndex: segIdx >= 0 ? segIdx : 0,
          existingRows,
          existingScriptRows: existingRows,
          storyContext: buildStoryContinuityContext(sc.id),
          applyToProject: true,
          applyToScene: true,
          llmConfig: getLlmConfig()
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '重写小段失败');
      updateGeneratorBadges(data.generator, data.generatorLabel, data.llmWarning || null);
      if (Array.isArray(data.projects)) {
        invalidateQuietRecompile();
        W.projects = data.projects;
      }
      const updatedP = getActiveProject();
      const updatedSc = getActiveScene();
      if (updatedP && updatedSc) {
        syncSceneIntoSCProto(updatedP, updatedSc);
      }
      renderSceneTree();
      if (P && P.S && P.S.mode === 'muse') {
        renderStep1OutlinePanel($('#musePanel'));
      }
      if (P && P.toast) {
        P.toast(`✅ 已重写小段「${seg.title}」（${(data.beatRows || []).length} 句 · OOC 0）！`);
      }
    } catch (err) {
      if (P && P.toast) P.toast('✗ 重写小段失败：' + err.message, 'err');
    } finally {
      clearBusyProgress(btnEl);
    }
  }

  let _wfBusyTimer = null;
  function setBusyProgress(label, key, btnEl) {
    W.busy = true;
    W.busyLabel = label || 'AI 处理中…';
    W.busyKey = key || '';
    W.busyStartedAt = Date.now();
    if (btnEl) {
      if (!btnEl.dataset.origText) btnEl.dataset.origText = btnEl.textContent;
      btnEl.disabled = true;
      btnEl.classList.add('is-busy-active');
    }
    let hud = $('#wfFloatingBusyHud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'wfFloatingBusyHud';
      hud.className = 'wf-floating-busy';
      hud.innerHTML = `<span class="wf-spin"></span><span class="wf-busy-text"></span><span class="wf-busy-elapsed"></span>`;
      document.body.appendChild(hud);
    }
    const updateTick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - W.busyStartedAt) / 1000));
      const elapsed = `${sec}s`;
      const hTxt = $('.wf-busy-text', hud);
      const hSec = $('.wf-busy-elapsed', hud);
      if (hTxt) hTxt.textContent = W.busyLabel;
      if (hSec) hSec.textContent = `已耗时 ${elapsed}`;
      hud.classList.add('show');
      $$('[data-busy-elapsed]').forEach((el) => {
        el.textContent = `已耗时 ${elapsed}`;
      });
      $$('[data-busy-key]').forEach((el) => {
        if (W.busyKey && el.dataset.busyKey === W.busyKey) {
          el.classList.add('is-busy-active');
          const base = el.dataset.busyActiveText || '⏳ 处理中';
          el.textContent = `${base} ${elapsed}…`;
        }
      });
      if (btnEl && document.body.contains(btnEl) && !btnEl.dataset.busyKey) {
        btnEl.textContent = `⏳ 处理中 ${elapsed}…`;
      }
    };
    if (_wfBusyTimer) clearInterval(_wfBusyTimer);
    updateTick();
    _wfBusyTimer = setInterval(updateTick, 1000);
  }

  function clearBusyProgress(btnEl) {
    if (_wfBusyTimer) {
      clearInterval(_wfBusyTimer);
      _wfBusyTimer = null;
    }
    W.busy = false;
    W.busyLabel = '';
    W.busyKey = '';
    const hud = $('#wfFloatingBusyHud');
    if (hud) hud.classList.remove('show');
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.classList.remove('is-busy-active');
      if (btnEl.dataset.origText && !btnEl.dataset.busyKey) {
        btnEl.textContent = btnEl.dataset.origText;
      }
    }
  }

  // Convert current SCProto.S.doc.rows into editable `scriptRows` for the backend compiler
  function extractScriptRowsFromProtoDoc() {
    const P = window.SCProto;
    if (!P || !P.S || !P.S.doc || !Array.isArray(P.S.doc.rows)) return [];
    const lines = P.S.doc.rows.map((r) => r.line);
    const sc = getActiveScene();
    if (sc && lines[0] && lines[0]._meta && String(lines[0]._meta.uid || '').startsWith('setup_bg')) {
      if (lines[0].bg) sc.bg = String(lines[0].bg);
      if (lines[0].bgm) sc.bgm = String(lines[0].bgm);
    }
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln) continue;
      const m = ln._meta || {};
      // Skip compiler auto-generated framing/child lines
      if (m['x-autoGenerated'] || m.autoGenerated) continue;
      // Preserve first-class 🎬 动作拍 (cue) rows round-trip
      if (m.rowKind === 'cue' && m.cue) {
        out.push({
          kind: 'cue',
          rowId: m.uid || `cue_${String(out.length + 1).padStart(2, '0')}`,
          beatId: m['x-beatId'] || m.beatId || '',
          beatTitle: m['x-beatTitle'] || m.beatTitle || '',
          note: m.note || '',
          cue: JSON.parse(JSON.stringify(m.cue))
        });
        continue;
      }
      // Skip pure camera-cut / setup direction lines that have no dialogue or select
      if (!ln.text && !ln.select) continue;
      if (ln.select && !ln.text && out.length > 0 && Array.isArray(out[out.length - 1].choices)) {
        out[out.length - 1].choices.push({
          text: ln.select,
          zh: (ln._meta && ln._meta.selectZh) || ln.select,
          nextLabel: ln.nextLabel || ''
        });
        continue;
      }
      const emoMap = {
        joy_bright: 'joy',
        shy_flustered: 'shy',
        anger_pout: 'tsun',
        sad_downcast: 'sad',
        surprise_wide: 'surp',
        calm_neutral: 'serious',
        smile_gentle: 'idol',
        troubled_sigh: 'sigh'
      };
      const isAutoBeatBgm = Boolean(m['x-beatBgmAuto'] && ln.bgm && String(m['x-beatBgmAuto']) === String(ln.bgm));
      const selectedTake = Array.isArray(m.takes)
        ? (m.takes.find((t) => t && String(t.id) === String(m.takeSelected)) || m.takes[0] || null)
        : null;
      const takeDurMs = selectedTake && Number(selectedTake.durationMs) > 0 ? Number(selectedTake.durationMs) : 0;
      const effLipDur = Number(ln.lipAnimDuration) > 0 ? Number(ln.lipAnimDuration) : takeDurMs;
      const effDur = Number(ln.dur) > 0 ? Number(ln.dur) : (effLipDur > 0 ? Number((effLipDur / 1000).toFixed(3)) : undefined);
      const effLipSegs = (Array.isArray(ln.lipSegments) && ln.lipSegments.length)
        ? ln.lipSegments
        : ((selectedTake && Array.isArray(selectedTake['x-lipSegments'] || selectedTake.lipSegments) && (selectedTake['x-lipSegments'] || selectedTake.lipSegments).length)
          ? (selectedTake['x-lipSegments'] || selectedTake.lipSegments)
          : undefined);
      const row = {
        kind: 'dialogue',
        rowId: m.uid || `row_${String(out.length + 1).padStart(2, '0')}`,
        speaker: ln.speaker !== undefined ? ln.speaker : '',
        charLabel: ln.charLabel || m.offScreenChar || '',
        charType: ln.charType || '',
        charCategory: ln.charCategory || '',
        charId: ln.charId || '',
        clothId: ln.clothId || '',
        se: ln.se || '',
        bgm: isAutoBeatBgm ? '' : (ln.bgm || ''),
        bg: ln.bg || '',
        text: ln.text || '',
        zh: m.zh || '',
        emotion: m['x-emotion'] || emoMap[m.surfaceEmotion] || 'joy',
        anim1: ln.charAnim1 || '',
        anim2: ln.charAnim2 || '',
        anim3: ln.charAnim3 || '',
        anim4: ln.charAnim4 || '',
        charPosition: ln.charPosition || null,
        manualPos: Boolean(m.manualPos),
        charScale: (ln.charScale !== undefined && ln.charScale !== 1) ? ln.charScale : undefined,
        charEffect: ln.charEffect || null,
        holdMs: m.holdMs || 0,
        motionTrack: Array.isArray(m.motionTrack) ? m.motionTrack : null,
        moveTrack: Array.isArray(m.moveTrack) ? m.moveTrack : null,
        beatId: m['x-beatId'] || m.beatId || '',
        beatTitle: m['x-beatTitle'] || m.beatTitle || '',
        note: m.note || '',
        stageAction: m.stageAction || '',
        branchLabel: ln.label || '',
        innerMonologue: Boolean(m['x-innerMonologue']),
        offScreen: Boolean(m.offScreen),
        mode: m.mode || '',
        ttsText: m.ttsText || '',
        voice: ln.voice || '',
        ...(effDur ? { dur: effDur } : {}),
        ...(effLipDur ? { lipAnimDuration: effLipDur } : {}),
        ...(effLipSegs ? { lipSegments: effLipSegs } : {}),
        ...(!m.voiceStale && Array.isArray(ln.subBeats) && ln.subBeats.length ? { subBeats: ln.subBeats } : {}),
        voiceSynthSig: m.voiceSynthSig || '',
        voiceStale: Boolean(m.voiceStale),
        takeSelected: (m.takeSelected !== undefined && m.takeSelected !== null && m.takeSelected !== '') ? String(m.takeSelected) : '',
        takes: (Array.isArray(m.takes) && m.takes.length) ? m.takes.map((t) => Object.assign({}, t)) : undefined
      };
      if (ln.select) {
        row.choices = [
          {
            text: ln.select,
            zh: m.selectZh || ln.select,
            nextLabel: ln.nextLabel || 'branch_a'
          }
        ];
      } else if (ln.nextLabel) {
        row.jumpTo = ln.nextLabel;
      }
      out.push(row);
    }
    return out;
  }

  function isScenePrecompiled(sc) {
    return Boolean(
      sc &&
      (sc.preservePrecompiled ||
        (sc.outlineData && sc.outlineData.preservePrecompiled) ||
        (sc.scproj && sc.scproj.meta && sc.scproj.meta.origin === 'external-import'))
    );
  }

  // Sync a loaded scene (`scproj`) into `window.SCProto.S.doc` so the existing editor, timeline & inspector work seamlessly
  function syncSceneIntoSCProto(project, scene) {
    const P = window.SCProto;
    if (!P || !P.S || !project || !scene || !scene.scproj) return;

    const scproj = JSON.parse(JSON.stringify(scene.scproj));
    const packManifest = {
      $schema: '../../schema/scproj.schema.json',
      format: 'scpack',
      formatVersion: 2,
      id: project.id,
      name: project.name,
      nameZh: project.nameZh || project.name,
      version: project.version || '0.2.0',
      unit: project.unit || '283 Production',
      synopsis: project.synopsis || '',
      synopsisZh: project.synopsisZh || '',
      characters: Object.assign({}, project.characters || {}, (scproj.meta && scproj.meta.characters) || {}),
      stories: (project.stories || []).map((s, idx) => ({
        id: s.id,
        file: s.file || `stories/${s.id}.scproj.json`,
        source: s.source || `stories/${s.id}.scs.yaml`,
        title: s.title,
        titleZh: s.titleZh || s.title,
        order: s.order !== undefined ? s.order : idx + 1,
        cast: s.cast || []
      }))
    };

    let n = 0;
    P.S.doc = {
      packId: project.id,
      sceneId: scene.id,
      pack: packManifest,
      head: {
        $schema: scproj.$schema || '../../../schema/scproj.schema.json',
        format: 'scproj',
        formatVersion: 2
      },
      meta: Object.assign({}, scproj.meta, {
        title: scene.title || (scproj.meta && scproj.meta.title) || scene.id,
        titleZh: scene.titleZh || (scproj.meta && scproj.meta.titleZh) || scene.title || scene.id
      }),
      rows: (scproj.lines || []).map((l) => ({ key: 'k' + ++n, line: l })),
      keySeq: n
    };

    const firstDlg = P.S.doc.rows.find((r) => typeof r.line.text === 'string' && r.line.speaker !== 'off');
    P.S.selKey = (firstDlg || P.S.doc.rows[0] || { key: 'k1' }).key;
    P.S.undo = [];
    P.S.redo = [];
    P.renderAll();
    refreshDirectionsToggleUi();

    const titleEl = $('#storyTitle');
    if (titleEl) {
      titleEl.textContent = scene.titleZh || scene.title || scene.id;
    }

    updateRealSpineIframe(scene.id);
    if (W.isDirty && typeof P.markDirty === 'function') {
      P.markDirty();
    } else if (typeof P.clearDirtyState === 'function') {
      P.clearDirtyState('已保存');
    }
  }

  function updateRealSpineIframe(sceneId) {
    const iframe = $('#realSpineIframe');
    if (!iframe || !sceneId) return;
    const playerId = resolveScenePlayerId(getActiveProject(), sceneId) || sceneId;
    const targetUrl = `/player/?cat=custom&id=${encodeURIComponent(playerId)}&theater=1`;
    const pushNow = () => {
      if (window.SCProto && typeof window.SCProto.syncLoadDocToSpineStage === 'function') {
        window.SCProto.syncLoadDocToSpineStage(false);
        window.SCProto.syncGotoLineToSpineStage(false);
      }
    };
    if (iframe.dataset.currentScene !== playerId) {
      iframe.dataset.currentScene = playerId;
      iframe.onload = () => {
        pushNow();
        setTimeout(pushNow, 260);
      };
      iframe.src = targetUrl;
    } else {
      pushNow();
      setTimeout(pushNow, 280);
    }
  }

  function setStageViewMode(viewMode) {
    W.stageViewMode = viewMode === 'ruler' ? 'ruler' : 'spine';
    const spineBox = $('#realSpineContainer');
    const stage2d = $('#stage');
    if (spineBox) spineBox.hidden = W.stageViewMode !== 'spine';
    if (stage2d) stage2d.style.visibility = W.stageViewMode === 'ruler' ? 'visible' : 'hidden';
    $$('#stageViewModeSeg button').forEach((b) => {
      b.classList.toggle('on', b.dataset.stageView === W.stageViewMode);
    });
  }

  // Render Top Bar Project Selector (`#packSelect`)
  function renderProjectSelector() {
    const ps = $('#packSelect');
    if (!ps) return;
    ps.innerHTML =
      W.projects
        .map(
          (p) =>
            `<option value="${esc(p.id)}" ${p.id === W.activeProjectId ? 'selected' : ''}>${esc(
              p.nameZh || p.name
            )} (${p.stories ? p.stories.length : 0}幕 · ${esc(p.id)}.scpack)</option>`
        )
        .join('') +
      `<option disabled>──────────</option>` +
      `<option value="__new_project">➕ 新建 .scpack 工程包…</option>` +
      `<option value="__import">📂 导入本地 .scproj.json…</option>`;
    ps.dataset.projectsLoaded = '1';
  }

  const MOOD_OPTION_LABELS = [
    ['warm', '☀️ 温暖日常'],
    ['upbeat', '✨ 明快元气'],
    ['calm', '🍵 宁静舒缓'],
    ['emotional', '💖 感动抒情'],
    ['tense', '⚡ 紧张悬念'],
    ['sad', '🌧 低落感伤'],
    ['comedy', '😆 轻松逗趣'],
    ['energetic', '🔥 活力燃向'],
    ['ambient', '🌿 自然环境音']
  ];

  function getAllBgOptions() {
    const P = window.SCProto;
    if (P && typeof P.bgCatalog === 'function') {
      return P.bgCatalog().map((b) => ({
        id: String(b.id),
        label: b.title || b.name || String(b.id),
        category: b.category || 'scenic',
        usageCount: b.usageCount || 0
      }));
    }
    const mockBgs = (window.SC_MOCK && window.SC_MOCK.bgLibrary) || [];
    const remoteBgs = window.SC_STUDIO_BG_CATALOG || [];
    const seen = new Set();
    const list = [];
    [...mockBgs, ...remoteBgs].forEach((b) => {
      if (!b || !b.id || seen.has(String(b.id))) return;
      seen.add(String(b.id));
      list.push({
        id: String(b.id),
        label: b.title || b.name || String(b.id),
        category: b.category || 'scenic',
        usageCount: b.usageCount || 0
      });
    });
    return list;
  }

  function getAllBgmOptions() {
    if (window.SCProto && typeof window.SCProto.bgmCatalog === 'function') {
      const cat = window.SCProto.bgmCatalog();
      if (Array.isArray(cat) && cat.length) {
        return cat.map((m) => ({
          id: String(m.id),
          label: m.label || m.title || m.name || String(m.id),
          title: m.title || m.name || String(m.id),
          category: m.category || 'music',
          kindTag: m.kindTag || (m.category === 'ambient' ? '🌿环境音' : '🎵配乐'),
          avoidAutoBgm: Boolean(m.avoidAutoBgm),
          moodTags: Array.isArray(m.moodTags) ? m.moodTags : [],
          durationSec: m.durationSec ?? null,
          usageCount: m.usageCount || 0
        }));
      }
    }
    const mockBgms = (window.SC_MOCK && window.SC_MOCK.bgmLibrary) || [
      { id: '002', title: '海风微澜·温柔抒情 (轻柔合奏)' },
      { id: '003', title: '灿烂日光·元气轻快日常' },
      { id: '016', title: '悠闲茶歇·事务所日常' },
      { id: '021', title: '节拍跃动·活力节奏' }
    ];
    return mockBgms.map((m) => ({
      id: String(m.id),
      label: m.title || m.name || String(m.id),
      title: m.title || m.name || String(m.id),
      category: m.category || 'music',
      kindTag: '🎵配乐',
      moodTags: [],
      durationSec: null,
      usageCount: 0
    }));
  }

  function resolveBgRecsForObj(sceneOrCard, bgOpts, limit = 8) {
    const byId = new Map(bgOpts.map((b) => [b.id, b]));
    const recs = [];
    const seen = new Set();
    if (sceneOrCard && Array.isArray(sceneOrCard.bgSuggestions)) {
      for (const s of sceneOrCard.bgSuggestions) {
        const id = String((s && s.id) || s || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        recs.push(byId.get(id) || { id, label: (s && (s.zhLabel || s.title)) || id, category: 'scenic' });
        if (recs.length >= limit) return recs;
      }
    }
    const P = window.SCProto;
    if (P && typeof P.recommendBgsForActiveScene === 'function') {
      for (const r of P.recommendBgsForActiveScene(limit)) {
        const id = String(r.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        recs.push(byId.get(id) || { id, label: r.title || id, category: r.category || 'scenic' });
        if (recs.length >= limit) return recs;
      }
    }
    for (const b of bgOpts) {
      if (seen.has(b.id) || b.category === 'abstract_effect' || b.category === 'logo_title') continue;
      seen.add(b.id);
      recs.push(b);
      if (recs.length >= limit) break;
    }
    return recs;
  }

  function resolveBgmRecsForObj(sceneOrCard, bgmOpts, limit = 6) {
    const byId = new Map(bgmOpts.map((m) => [m.id, m]));
    const recs = [];
    const seen = new Set();
    if (sceneOrCard && Array.isArray(sceneOrCard.bgmSuggestions)) {
      for (const s of sceneOrCard.bgmSuggestions) {
        const id = String((s && s.id) || s || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        recs.push(byId.get(id) || { id, label: (s && (s.label || s.title)) || id, category: (s && s.category) || 'music' });
        if (recs.length >= limit) return recs;
      }
    }
    const P = window.SCProto;
    if (P && typeof P.recommendBgmsForActiveScene === 'function') {
      for (const r of P.recommendBgmsForActiveScene(limit)) {
        const id = String(r.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        recs.push(byId.get(id) || { id, label: r.label || r.title || id, category: r.category || 'music' });
        if (recs.length >= limit) return recs;
      }
    }
    for (const m of bgmOpts) {
      if (seen.has(m.id) || m.category !== 'music' || m.avoidAutoBgm) continue;
      seen.add(m.id);
      recs.push(m);
      if (recs.length >= limit) break;
    }
    return recs;
  }

  function buildGroupedBgOptionsHtml(curBg, sceneOrCard) {
    const cur = String(curBg || '');
    const all = getAllBgOptions();
    const recs = resolveBgRecsForObj(sceneOrCard, all, 8);
    const recIds = new Set(recs.map((b) => b.id));
    const rest = all.filter((b) => !recIds.has(b.id));
    let selectedAssigned = false;
    const optHtml = (b) => {
      const sel = !selectedAssigned && b.id === cur;
      if (sel) selectedAssigned = true;
      return `<option value="${esc(b.id)}" ${sel ? 'selected' : ''}>${esc(b.id)} · ${esc(b.label)}</option>`;
    };
    const parts = [];
    if (recs.length) {
      parts.push(`<optgroup label="⭐ 剧情推荐候选背景 (Top ${recs.length})">${recs.map(optHtml).join('')}</optgroup>`);
    }
    if (rest.length) {
      parts.push(`<optgroup label="🗂️ 全部其余背景库 (${rest.length}张)">${rest.map(optHtml).join('')}</optgroup>`);
    }
    if (cur && !selectedAssigned) {
      parts.unshift(`<option value="${esc(cur)}" selected>${esc(cur)} · 官方背景</option>`);
    }
    return parts.join('');
  }

  function buildGroupedBgmOptionsHtml(curBgm, sceneOrCard, opts = {}) {
    const cur = String(curBgm || '');
    const all = getAllBgmOptions();
    const recs = resolveBgmRecsForObj(sceneOrCard, all, 6);
    const recIds = new Set(recs.map((m) => m.id));
    const ambients = all.filter((m) => m.category === 'ambient' || m.category === 'silence');
    const musics = all.filter((m) => m.category !== 'ambient' && m.category !== 'silence' && !recIds.has(m.id));
    let selectedAssigned = false;
    const parts = [];
    if (opts.isBeat) {
      const isCtrl = cur === '' || cur === 'fade_out' || cur === 'off';
      if (cur === '') selectedAssigned = true;
      parts.push(`<option value="" ${cur === '' ? 'selected' : ''}>🔄 延续上一段配乐（不切换）</option>`);
      if (cur === 'fade_out') selectedAssigned = true;
      parts.push(`<option value="fade_out" ${cur === 'fade_out' ? 'selected' : ''}>🔉 淡出渐弱 (fade_out)</option>`);
      if (cur === 'off') selectedAssigned = true;
      parts.push(`<option value="off" ${cur === 'off' ? 'selected' : ''}>🔇 停止静场 (off)</option>`);
      void isCtrl;
    }
    const optHtml = (m) => {
      const sel = !selectedAssigned && m.id === cur;
      if (sel) selectedAssigned = true;
      const prefix = m.category === 'ambient' ? '🌿 ' : (m.category === 'silence' ? '🔇 ' : '');
      return `<option value="${esc(m.id)}" ${sel ? 'selected' : ''}>${prefix}${esc(m.id)} · ${esc(m.label)}</option>`;
    };
    if (recs.length) {
      parts.push(`<optgroup label="⭐ 剧情流向推荐配乐 (${recs.length})">${recs.map(optHtml).join('')}</optgroup>`);
    }
    if (ambients.length) {
      parts.push(`<optgroup label="🌿 环境底噪与自然音 (蝉鸣/海浪/风声 · ${ambients.length})">${ambients.map(optHtml).join('')}</optgroup>`);
    }
    if (musics.length) {
      parts.push(`<optgroup label="🎵 全部剧情配乐 BGM (${musics.length})">${musics.map(optHtml).join('')}</optgroup>`);
    }
    if (cur && !selectedAssigned) {
      parts.unshift(`<option value="${esc(cur)}" selected>${esc(cur)} · 官方BGM</option>`);
    }
    return parts.join('');
  }

  function setActiveSceneEnv(patch, opts = {}) {
    const p = getActiveProject();
    const sc = getActiveScene();
    const P = window.SCProto;
    if (!p || !sc || !patch) return;
    const prevBg = sc.bg ? String(sc.bg).padStart(5, '0') : '';
    const nextBg = patch.bg !== undefined && patch.bg !== '' ? String(patch.bg).padStart(5, '0') : '';
    if (nextBg) sc.bg = nextBg;
    if (patch.bgm !== undefined && patch.bgm !== '') sc.bgm = String(patch.bgm);
    if (patch.bgmStyle !== undefined) sc.bgmStyle = String(patch.bgmStyle);

    if (nextBg && Array.isArray(sc.scriptRows)) {
      sc.scriptRows.forEach((sr) => {
        if (sr && sr.bg && String(sr.bg).padStart(5, '0') === prevBg) {
          delete sr.bg;
        }
      });
    }

    if (Array.isArray(W.outlineDrafts)) {
      const card = W.outlineDrafts.find((c) => c.sceneId === sc.id);
      if (card) {
        if (nextBg) card.bg = sc.bg;
        if (patch.bgm !== undefined && patch.bgm !== '') card.bgm = sc.bgm;
        if (patch.bgmStyle !== undefined) card.bgmStyle = sc.bgmStyle;
      }
    }

    if (P && P.S && P.S.doc && Array.isArray(P.S.doc.rows) && P.S.doc.rows.length) {
      const r0 = P.S.doc.rows[0].line;
      if (r0 && (!r0.text || (r0._meta && String(r0._meta.uid || '').startsWith('setup_bg')))) {
        if (nextBg) r0.bg = sc.bg;
        if (patch.bgm !== undefined && patch.bgm !== '') r0.bgm = sc.bgm;
        if (r0._meta) r0._meta.note = `场景初始化：BG ${sc.bg || ''} / BGM ${sc.bgm || ''}`;
      }
      if (nextBg) {
        P.S.doc.rows.forEach((r, idx) => {
          if (idx === 0 || !r || !r.line || !r.line.bg) return;
          const rowBg = String(r.line.bg).padStart(5, '0');
          const isChaseBg = r.line.bgEffect === 'switch_fade' || (r.line._meta && /追逐过场/.test(String(r.line._meta.note || '')));
          if (rowBg === prevBg || isChaseBg) {
            if (r.line.bgEffect) r.line.bg = nextBg;
            else delete r.line.bg;
          }
        });
      }
      if (opts.clearOpeningRowOverride) {
        const firstDlg = P.S.doc.rows.find((r, idx) => idx > 0 && r && r.line && typeof r.line.text === 'string' && r.line.speaker !== 'off');
        if (firstDlg && firstDlg.line) {
          if (patch.bg !== undefined) delete firstDlg.line.bg;
          if (patch.bgm !== undefined && firstDlg.line.bgm !== 'fade_out' && firstDlg.line.bgm !== 'off') {
            delete firstDlg.line.bgm;
          }
        }
      }
      if (opts.resumeStageBgm && typeof P.stopBgm === 'function') {
        P.stopBgm();
      }
      if (typeof P.syncLoadDocToSpineStage === 'function') P.syncLoadDocToSpineStage(false);
      if (typeof P.syncGotoLineToSpineStage === 'function') P.syncGotoLineToSpineStage(false);
      if (opts.resumeStageBgm && typeof P.postToSpineStage === 'function') {
        P.postToSpineStage({ type: 'sc-studio:bgm-control', action: 'resume' });
      }
    }

    renderSceneCastOutfitBar();
    renderSceneTree();
    if (opts.recompile !== false) {
      recompileCurrentSceneQuietly(150);
    }
  }

  let _step1CardSaveTimer = null;
  function persistStep1CardEnvQuietly(card, changedField = '') {
    if (!card || !card.sceneId) return;
    const p = getActiveProject();
    if (!p) return;
    const targetSc = (p.stories || []).find((s) => s.id === card.sceneId);
    if (targetSc) {
      if (card.bg) targetSc.bg = String(card.bg);
      if (card.bgm) targetSc.bgm = String(card.bgm);
      if (card.bgmStyle !== undefined) targetSc.bgmStyle = String(card.bgmStyle);
      if (card.title) targetSc.titleZh = String(card.title);
      if (Array.isArray(card.cast) && card.cast.length) targetSc.cast = [...card.cast];
      if (Array.isArray(card.segments) && card.segments.length) targetSc.segments = card.segments;
    }
    if (W.activeSceneId === card.sceneId) {
      setActiveSceneEnv(
        { bg: card.bg, bgm: card.bgm, bgmStyle: card.bgmStyle },
        { clearOpeningRowOverride: true, recompile: false, resumeStageBgm: changedField === 'bgm' }
      );
    }
    W.isDirty = true;
    W.dirtySceneIds.add(card.sceneId);
    if (window.SCProto && typeof window.SCProto.markDirty === 'function') {
      window.SCProto.markDirty();
    }
    if (_step1CardSaveTimer) clearTimeout(_step1CardSaveTimer);
    const reqProjId = p.id;
    const reqSeq = _quietRecompileSeq;
    _step1CardSaveTimer = setTimeout(async () => {
      try {
        if (reqSeq !== _quietRecompileSeq) return;
        const latestP = getActiveProject();
        const sc = latestP && (latestP.stories || []).find((s) => s.id === card.sceneId);
        if (!latestP || latestP.id !== reqProjId || !sc) return;
        if (isScenePrecompiled(sc)) {
          sc.preservePrecompiled = true;
          renderSceneTree();
          if (W.activeSceneId === sc.id) {
            updateRealSpineIframe(sc.id);
          }
          return;
        }
        const res = await fetch('/api/studio/preview-compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: latestP.id,
            sceneId: sc.id,
            title: sc.title,
            titleZh: card.title || sc.titleZh || sc.title,
            bg: card.bg || sc.bg || '',
            bgm: card.bgm || sc.bgm || '',
            bgmStyle: card.bgmStyle !== undefined ? card.bgmStyle : (sc.bgmStyle || ''),
            cast: Array.isArray(card.cast) && card.cast.length ? card.cast : (sc.cast || []),
            summary: card.summary !== undefined ? card.summary : (sc.summary || ''),
            segments: card.segments || sc.segments || [],
            beats: card.beats || sc.beats || [],
            scriptRows: sc.scriptRows || []
          })
        });
        const data = await res.json();
        const curP = getActiveProject();
        if (reqSeq !== _quietRecompileSeq || !curP || curP.id !== reqProjId) return;
        const curSc = (curP.stories || []).find((s) => s.id === card.sceneId);
        if (curSc && data && data.ok && data.scproj) {
          curSc.scproj = data.scproj;
          if (data.scproj.meta && data.scproj.meta['x-playerScriptId']) {
            curSc.playerScriptId = data.scproj.meta['x-playerScriptId'];
          }
          renderSceneTree();
          if (W.activeSceneId === curSc.id && W.activeStep !== 1) {
            syncSceneIntoSCProto(curP, curSc);
          }
        }
      } catch (_) {}
    }, 220);
  }

  function refreshEnvBars() {
    renderSceneCastOutfitBar();
    const museBox = $('#musePanel');
    if (window.SCProto && window.SCProto.S && window.SCProto.S.mode === 'muse' && museBox && !museBox.hidden) {
      const actEl = document.activeElement;
      const isEditingInMuse = Boolean(actEl && museBox.contains(actEl) && (actEl.tagName === 'INPUT' || actEl.tagName === 'TEXTAREA'));
      if (!isEditingInMuse) {
        renderStep1OutlinePanel(museBox);
      }
    }
  }

  function openBeatBgmPlanModal() {
    const sc = getActiveScene();
    const P = window.SCProto;
    if (!sc || !P || typeof P.openModal !== 'function') return;
    sc.segments = ensureCardSegments(sc, sc.cast);
    const segRowsHtml = sc.segments
      .map((seg, idx) => {
        const moodOpts = MOOD_OPTION_LABELS.map(([k, lbl]) => `<option value="${esc(k)}" ${(seg.mood || 'warm') === k ? 'selected' : ''}>${esc(lbl)}</option>`).join('');
        const bgmOptsHtml = buildGroupedBgmOptionsHtml(seg.bgm || '', seg, { isBeat: true });
        return `<div class="beat-plan-modal-item" data-modal-seg-row="${idx}">
          <div class="row-flex" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
            <b>🧩 小段 ${idx + 1}：${esc(seg.title || seg.beatId)}</b>
            <span class="muted" style="font-size:11px">${esc((seg.summary || '').slice(0, 64))}</span>
          </div>
          <div class="beat-bgm-row" style="margin-top:6px">
            <label>🎭 情绪：<select data-modal-seg-mood="${idx}">${moodOpts}</select></label>
            <label style="flex:1;min-width:210px">🎵 本段配乐：<select data-modal-seg-bgm="${idx}" style="max-width:260px">${bgmOptsHtml}</select></label>
            <button type="button" class="sc-mini-btn" data-modal-seg-play="${idx}" title="试听本小段配乐">▶ 试听</button>
          </div>
          <div class="row-flex" style="margin-top:4px;gap:6px">
            <span class="muted" style="font-size:11px">💡 切曲理由：</span>
            <input type="text" data-modal-seg-reason="${idx}" value="${esc(seg.bgmReason || '')}" placeholder="例如：危机解除转入温柔欢呼…" style="flex:1;font-size:11.5px;padding:3px 8px">
          </div>
        </div>`;
      })
      .join('');

    const bodyHtml = `
      <div class="modal-head">
        <h2>🎼 本幕分段 BGM 规划（${esc(sc.titleZh || sc.title)}）</h2>
        <span class="grow"></span>
        <button class="ibtn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <div class="callout info">
          <b>📌 全幕开场 BGM：</b><code>${esc(sc.bgm || '未设')}</code>${sc.bgmStyle ? ` · <span>${esc(sc.bgmStyle)}</span>` : ''}<br>
          <small>各小段选择「🔄 延续上一段配乐」将保持同一首曲子流畅播放；选择具体曲目（含 🌿 盛夏蝉鸣等环境音）或「🔉 淡出」时，编译器会自动在该小段第一行自动插入切曲事件。</small>
        </div>
        <div class="beat-plan-modal-list">${segRowsHtml}</div>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" data-close>取消</button>
        <button class="btn prism" id="btnSaveBeatBgmPlan">💾 保存分段切曲并重编译本幕</button>
      </div>`;

    P.openModal(bodyHtml, (modalEl) => {
      modalEl.querySelectorAll('[data-modal-seg-play]').forEach((btn) => {
        btn.onclick = () => {
          const idx = +btn.dataset.modalSegPlay;
          const sel = modalEl.querySelector(`[data-modal-seg-bgm="${idx}"]`);
          const targetId = (sel && sel.value && sel.value !== 'fade_out' && sel.value !== 'off') ? sel.value : sc.bgm;
          if (targetId && typeof P.playBgmPreview === 'function') {
            P.playBgmPreview(targetId, 0, { force: true });
          }
        };
      });
      const saveBtn = modalEl.querySelector('#btnSaveBeatBgmPlan');
      if (saveBtn) {
        saveBtn.onclick = () => {
          sc.segments.forEach((seg, idx) => {
            const mSel = modalEl.querySelector(`[data-modal-seg-mood="${idx}"]`);
            const bSel = modalEl.querySelector(`[data-modal-seg-bgm="${idx}"]`);
            const rInp = modalEl.querySelector(`[data-modal-seg-reason="${idx}"]`);
            if (mSel) seg.mood = mSel.value;
            if (bSel) {
              seg.bgm = bSel.value;
              seg.bgmLocked = true;
            }
            if (rInp) {
              seg.bgmReason = rInp.value.trim() || (seg.bgm ? `手动指定切换 → ${seg.bgm}` : '延续上一段配乐');
            }
          });
          if (Array.isArray(W.outlineDrafts)) {
            const card = W.outlineDrafts.find((c) => c.sceneId === sc.id);
            if (card) card.segments = JSON.parse(JSON.stringify(sc.segments));
          }
          if (typeof P.closeModal === 'function') P.closeModal();
          renderSceneCastOutfitBar();
          recompileCurrentSceneQuietly(30);
          if (P.toast) P.toast('🎼 已更新本幕分段 BGM 规划并重新编译！');
        };
      }
    });
  }

  function openBgPreviewModal(initialBgId, opts = {}) {
    const P = window.SCProto;
    if (!P || typeof P.openModal !== 'function') return;
    const allBgs = typeof P.bgCatalog === 'function' ? P.bgCatalog() : [];
    let curId = String(initialBgId || '').trim();
    if (!curId && allBgs.length) curId = allBgs[0].id;
    const recs = Array.isArray(opts.recs) ? opts.recs : [];
    const resolveInfo = (bgId) => {
      if (typeof P.resolveBg === 'function') return P.resolveBg(bgId);
      const item = allBgs.find((b) => b.id === bgId);
      return {
        img: bgId ? `/bg/${encodeURIComponent(bgId)}.jpg` : null,
        fallbackImg: null,
        label: item ? `${bgId} ${item.label || item.title || ''}` : bgId || '（无背景）',
        src: bgId ? `官方背景 (/bg/${bgId}.jpg)` : '—'
      };
    };

    const renderContent = (modalEl) => {
      const info = resolveInfo(curId);
      const wrap = modalEl.querySelector('#bgPreviewStageWrap');
      const meta = modalEl.querySelector('#bgPreviewMeta');
      const pickBtn = modalEl.querySelector('#btnBgPreviewApply');
      const titleEl = modalEl.querySelector('#bgPreviewTitle');
      if (titleEl) titleEl.textContent = `🖼️ 背景试看 · ${info.label || curId || '未选择'}`;
      if (meta) meta.textContent = `${curId ? `编号 ${curId} · ` : ''}${info.src || ''}`;
      if (pickBtn) pickBtn.disabled = !curId || typeof opts.onPick !== 'function';
      if (wrap) {
        if (!info.img) {
          wrap.innerHTML = '<div class="bg-preview-empty">暂无可显示的背景图片</div>';
        } else {
          const img = document.createElement('img');
          img.className = 'bg-preview-img';
          img.alt = info.label || curId;
          img.src = info.img;
          img.onerror = () => {
            if (info.fallbackImg && !img.dataset.fbApplied) {
              img.dataset.fbApplied = '1';
              img.src = info.fallbackImg;
            } else {
              wrap.innerHTML = `<div class="bg-preview-empty">图片加载失败（${esc(curId)}）</div>`;
            }
          };
          wrap.innerHTML = '';
          wrap.appendChild(img);
        }
      }
      modalEl.querySelectorAll('[data-bg-preview-switch]').forEach((btn) => {
        btn.classList.toggle('on', btn.dataset.bgPreviewSwitch === curId);
      });
    };

    const recBarHtml = recs.length
      ? `<div class="bg-preview-recs"><span class="muted" style="font-size:11.5px">⭐ 本幕推荐切换看图：</span>${recs
          .map(
            (b) =>
              `<button type="button" class="chip-btn ${b.id === curId ? 'on' : ''}" data-bg-preview-switch="${esc(b.id)}">${esc(b.id)} ${esc((b.label || '').slice(0, 10))}</button>`
          )
          .join('')}</div>`
      : '';

    P.openModal(
      `
      <div class="modal-head">
        <b id="bgPreviewTitle">🖼️ 背景试看</b>
        <button type="button" class="ibtn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <div class="bg-preview-stage" id="bgPreviewStageWrap"></div>
        <div class="muted" id="bgPreviewMeta" style="font-size:12px"></div>
        ${recBarHtml}
      </div>
      <div class="modal-foot">
        <button type="button" class="btn ghost" data-close>关闭</button>
        <button type="button" class="btn prism" id="btnBgPreviewApply">✓ 设为本幕开场背景</button>
      </div>
      `,
      (modalEl) => {
        renderContent(modalEl);
        modalEl.querySelectorAll('[data-bg-preview-switch]').forEach((btn) => {
          btn.onclick = () => {
            curId = btn.dataset.bgPreviewSwitch || curId;
            renderContent(modalEl);
          };
        });
        const applyBtn = modalEl.querySelector('#btnBgPreviewApply');
        if (applyBtn) {
          applyBtn.onclick = () => {
            if (curId && typeof opts.onPick === 'function') opts.onPick(curId);
            if (typeof P.closeModal === 'function') P.closeModal();
          };
        }
      }
    );
  }

  function syncBeatBgmFromRow(beatId, nextBgm = '', reason = '') {
    const sc = getActiveScene();
    if (!sc || !beatId) return false;
    sc.segments = ensureCardSegments(sc, sc.cast);
    const seg = sc.segments.find((s) => s && String(s.beatId) === String(beatId));
    if (!seg) return false;
    const val = String(nextBgm || '').trim();
    seg.bgm = val;
    seg.bgmLocked = true;
    seg.bgmReason = reason || (val
      ? (val === 'fade_out' ? '手动设为本段淡出' : (val === 'off' ? '手动设为本段静场' : `手动指定本段切换 → ${val}`))
      : '手动取消本段切曲（延续上一首）');
    if (Array.isArray(W.outlineDrafts)) {
      const card = W.outlineDrafts.find((c) => c && c.sceneId === sc.id);
      if (card) {
        card.segments = ensureCardSegments(card, card.cast);
        const cSeg = card.segments.find((s) => s && String(s.beatId) === String(beatId));
        if (cSeg) {
          cSeg.bgm = seg.bgm;
          cSeg.bgmLocked = true;
          cSeg.bgmReason = seg.bgmReason;
        }
      }
    }
    renderSceneCastOutfitBar();
    const museBox = $('#musePanel');
    if (window.SCProto && window.SCProto.S && window.SCProto.S.mode === 'muse' && museBox && !museBox.hidden) {
      renderStep1OutlinePanel(museBox);
    }
    return true;
  }

  // Render Scene Cast & Costume + Per-Scene BG/BGM Bar (`#sceneCastOutfitBar`)
  function renderSceneCastOutfitBar() {
    const barEl = $('#sceneCastOutfitBar');
    if (!barEl) return;
    const p = getActiveProject();
    const sc = getActiveScene();
    const P = window.SCProto;
    if (!p || !sc || !P) {
      barEl.innerHTML = '';
      return;
    }
    const castList = Array.isArray(sc.cast) && sc.cast.length ? sc.cast : Object.keys((P.S && P.S.doc && P.S.doc.pack && P.S.doc.pack.characters) || {});
    const curBg = String(sc.bg || '00003');
    const curBgm = String(sc.bgm || '002');
    const bgmCat = typeof P.bgmCatalog === 'function' ? P.bgmCatalog() : [];
    const curBgmItem = bgmCat.find((x) => String(x.id) === curBgm) || null;
    const curBgmTitle = curBgmItem ? String(curBgmItem.title || curBgmItem.zhLabel || '') : '';
    const switchCount = (sc.segments || []).filter((sg) => sg && sg.bgm).length;

    const envPillsHtml = `
      <div class="cast-outfit-pill" title="设置当前第 ${sc.order || 1} 幕的开场默认背景（第 0 帧立即生效，无切换延迟，每一幕可独立设置）">
        <b>🖼️ 本幕背景</b>
        <select id="sceneDefaultBgSelect" style="max-width:190px">
          ${buildGroupedBgOptionsHtml(curBg, sc)}
        </select>
        <button type="button" class="sc-mini-btn" id="btnOpenBgPickerScene" title="打开缩略图背景库搜索并设为本幕默认背景">图库</button>
      </div>
      <div class="cast-outfit-pill" title="设置当前第 ${sc.order || 1} 幕的开场默认配乐或环境音（如盛夏蝉鸣 0001；每一幕可独立设置全幕 BGM）">
        <b>🎵 本幕BGM</b>
        <select id="sceneDefaultBgmSelect" style="max-width:175px">
          ${buildGroupedBgmOptionsHtml(curBgm, sc, { isBeat: false })}
        </select>
        <button type="button" class="sc-mini-btn" id="btnSceneBgmAudition" title="试听/停止当前选中 BGM（自动暂停舞台主音乐）">▶ 试听</button>
        <button type="button" class="sc-mini-btn" id="btnSceneBeatBgmPlan" title="按小段剧情变化设置本幕内自动切换 BGM 或淡出">🎼 分段切曲${switchCount ? ` (${switchCount})` : ''}</button>
      </div>
    `;

    const pillsHtml = castList
      .map((cid) => {
        const im = W.idolMeta[cid] || { speaker: cid, nameZh: cid };
        const outfits = typeof P.getOutfitsForChar === 'function' ? P.getOutfitsForChar(cid) : [];
        const curOutfit = typeof P.getCurrentOutfitForChar === 'function' ? P.getCurrentOutfitForChar(cid, null, null) : outfits[0] || {};
        return `<div class="cast-outfit-pill">
          <b>${esc(im.nameZh || im.speaker)}</b>
          <span class="muted" style="font-size:11px" title="整套立绘服装（头身原画一体匹配）">👗</span>
          <select data-cast-outfit-char="${esc(cid)}" title="切换 ${esc(im.nameZh || im.speaker)} 在本幕中的整套 Spine 立绘（私服/夏装/运动服/打歌服），将在 :18899 舞台实时换装">
            ${outfits
              .map(
                (o) =>
                  `<option value="${esc(o.key)}" ${o.key === curOutfit.key ? 'selected' : ''}>${esc(o.shortLabel || o.label)} (${esc(
                    o.charCategory
                  )}/${esc(o.charId)})</option>`
              )
              .join('')}
          </select>
        </div>`;
      })
      .join('');

    barEl.innerHTML = `<details class="scene-env-drawer" ${W.envDrawerOpen ? 'open' : ''}>
      <summary class="scene-env-summary">
        <span>🖼️ 背景 <code>${esc(curBg)}</code> · 🎵 BGM <code>${esc(curBgm)}</code>${curBgmTitle ? `<span class="summary-bgm-title">${esc(curBgmTitle)}</span>` : ''}<button type="button" class="summary-bgm-aud-btn" id="btnSceneBgmSummaryAudition" data-bgm-id="${esc(curBgm)}" title="直接试听/停止本幕当前 BGM（不展开抽屉、不改动存档）">▶ 试听</button> · 👗 本幕角色换装 (${castList.length}人)</span>
        <span class="env-toggle-pill">${W.envDrawerOpen ? '收起 ▴' : '展开设置 ▾'}</span>
      </summary>
      <div class="scene-env-body">
        ${envPillsHtml}<span class="muted" style="font-weight:700;margin-left:4px">👥 角色换装：</span>${pillsHtml}
      </div>
    </details>`;

    const detailsEl = barEl.querySelector('.scene-env-drawer');
    if (detailsEl) {
      detailsEl.addEventListener('toggle', () => {
        W.envDrawerOpen = Boolean(detailsEl.open);
        const pill = detailsEl.querySelector('.env-toggle-pill');
        if (pill) pill.textContent = W.envDrawerOpen ? '收起 ▴' : '展开设置 ▾';
      });
    }

    const bgSel = $('#sceneDefaultBgSelect', barEl);
    if (bgSel) {
      bgSel.onchange = () => {
        setActiveSceneEnv({ bg: bgSel.value }, { clearOpeningRowOverride: true });
        if (P.toast) P.toast(`🖼️ 已切换「${sc.titleZh || sc.title}」本幕默认背景 → ${bgSel.value}`);
      };
    }
    const openBgBtn = $('#btnOpenBgPickerScene', barEl);
    if (openBgBtn) {
      openBgBtn.onclick = () => {
        if (P.S) { P.S.bgScope = 'scene'; P.S.dockLeftView = 'bg'; }
        if (typeof P.setMode === 'function') P.setMode('stage');
        if (typeof P.renderStageDirectorDock === 'function') P.renderStageDirectorDock({ forceLeft: true });
        const q = document.getElementById('dockBgQuery') || document.getElementById('bgQuery');
        if (q) q.focus();
      };
    }
    const bgmSel = $('#sceneDefaultBgmSelect', barEl);
    if (bgmSel) {
      bgmSel.onchange = () => {
        setActiveSceneEnv({ bgm: bgmSel.value }, { clearOpeningRowOverride: true, resumeStageBgm: true });
        if (P.toast) P.toast(`🎵 已切换「${sc.titleZh || sc.title}」本幕默认 BGM → ${bgmSel.value}`);
      };
    }
    const bgmAudBtn = $('#btnSceneBgmAudition', barEl);
    if (bgmAudBtn && bgmSel) {
      bgmAudBtn.onclick = () => {
        if (P && typeof P.playBgmPreview === 'function') {
          P.playBgmPreview(bgmSel.value, 0, { force: true });
        }
      };
    }
    const sumAudBtn = $('#btnSceneBgmSummaryAudition', barEl);
    if (sumAudBtn) {
      sumAudBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (P && typeof P.playBgmPreview === 'function') {
          const targetId = (bgmSel && bgmSel.value) || sumAudBtn.dataset.bgmId || curBgm;
          P.playBgmPreview(targetId, 0, { force: true });
        }
      };
    }
    const beatBgmPlanBtn = $('#btnSceneBeatBgmPlan', barEl);
    if (beatBgmPlanBtn) {
      beatBgmPlanBtn.onclick = () => openBeatBgmPlanModal();
    }
    if (P && typeof P.syncBgmPlayButtons === 'function') {
      P.syncBgmPlayButtons();
    }

    $$('select[data-cast-outfit-char]', barEl).forEach((sel) => {
      sel.onchange = () => {
        const cid = sel.dataset.castOutfitChar;
        if (!cid || typeof P.getOutfitsForChar !== 'function' || typeof P.applyOutfitToCharacter !== 'function') return;
        const spec = P.getOutfitsForChar(cid).find((o) => o.key === sel.value);
        if (spec) {
          P.applyOutfitToCharacter(cid, spec, true);
        }
      };
    });
  }

  // Render Left Sidebar Scene Tree (`#sceneTreeList`)
  function renderSceneTree() {
    const p = getActiveProject();
    const listEl = $('#sceneTreeList');
    const badgeEl = $('#sceneCountBadge');
    if (!listEl || !p) return;

    const scenes = p.stories || [];
    if (badgeEl) badgeEl.textContent = `${scenes.length} 幕`;

    const playingSid = W.playAllState && W.playAllState.active ? W.playAllState.currentSceneId : null;

    listEl.innerHTML = scenes
      .map((sc, idx) => {
        const isOn = sc.id === W.activeSceneId;
        const isPlayingScene = playingSid === sc.id;
        const rawTitle = String(sc.titleZh || sc.title || sc.id || '');
        const displayTitle = rawTitle.replace(/^第\s*\d+\s*[幕场話话章]\s*[·•:：\-—]?\s*/u, '').trim() || rawTitle;
        const castCount = (sc.cast || []).length;
        const castNames = (sc.cast || [])
          .slice(0, 4)
          .map((c) => (W.idolMeta[c] ? W.idolMeta[c].speaker : c))
          .join('·');
        const camTag = castCount > 3 ? `🎥${castCount}人双机位` : `👤${castCount}人`;
        const oocErr = (sc.oocSummary && sc.oocSummary.error) || 0;
        const oocWarn = (sc.oocSummary && sc.oocSummary.warn) || 0;
        const oocBadge =
          oocErr > 0
            ? `<span class="sc-ooc-pill err">OOC ${oocErr}</span>`
            : oocWarn > 0
            ? `<span class="sc-ooc-pill warn">OOC ${oocWarn}</span>`
            : `<span class="sc-ooc-pill ok">✓ OOC 0</span>`;

        return `
          <div class="scene-tree-item ${isOn ? 'on' : ''} ${isPlayingScene ? 'playing-scene' : ''}" data-scene-id="${esc(sc.id)}" role="option" aria-selected="${isOn}">
            <div class="sc-item-main">
              <span class="sc-idx-pill">${isPlayingScene ? '▶ 连播中 · ' : ''}第 ${idx + 1} 幕</span>
              <span class="sc-title" title="${esc(rawTitle)}">${esc(displayTitle)}</span>
            </div>
            <div class="sc-item-meta">
              <span class="sc-cast-pill" title="登场角色：${esc(castNames || (sc.cast || []).join(', '))}">${esc(camTag)}</span>
              ${oocBadge}
              <span class="sc-reorder-btns">
                <button class="sc-mini-btn" data-scene-move="-1" data-idx="${idx}" title="上移场景" ${idx === 0 ? 'disabled' : ''}>↑</button>
                <button class="sc-mini-btn" data-scene-move="1" data-idx="${idx}" title="下移场景" ${
                  idx === scenes.length - 1 ? 'disabled' : ''
                }>↓</button>
                <button class="sc-mini-btn sc-del-btn" data-scene-del="${esc(sc.id)}" title="删除这一幕" ${scenes.length <= 1 ? 'disabled' : ''}>✕</button>
              </span>
            </div>
          </div>
        `;
      })
      .join('');

    $$('.scene-tree-item', listEl).forEach((item) => {
      item.onclick = (e) => {
        const delBtn = e.target.closest('[data-scene-del]');
        if (delBtn) {
          e.stopPropagation();
          deleteScene(delBtn.dataset.sceneDel);
          return;
        }
        const moveBtn = e.target.closest('[data-scene-move]');
        if (moveBtn) {
          e.stopPropagation();
          reorderScene(+moveBtn.dataset.idx, +moveBtn.dataset.sceneMove);
          return;
        }
        const sid = item.dataset.sceneId;
        if (W.playAllState && W.playAllState.active) {
          jumpToSceneInPlayAll(sid);
          return;
        }
        selectScene(sid);
      };
    });

    renderSceneCastOutfitBar();
  }

  function stashActiveProtoIntoSceneMemory() {
    const P = window.SCProto;
    const sc = getActiveScene();
    if (!P || !P.S || !P.S.doc || !sc) return;
    if (isScenePrecompiled(sc)) {
      sc.preservePrecompiled = true;
    }
    if (W.isDirty || P.S.isDirty) {
      sc.scriptRows = extractScriptRowsFromProtoDoc();
      sc.scproj = sc.scproj || {};
      sc.scproj.lines = P.S.doc.rows.map((r) => JSON.parse(JSON.stringify(r.line)));
      W.dirtySceneIds.add(sc.id);
    }
  }

  function selectProject(pid, opts = {}) {
    const p = W.projects.find((x) => x.id === pid);
    if (!p) return;
    const P = window.SCProto;
    if (pid !== W.activeProjectId && (W.isDirty || (P && P.S && P.S.isDirty)) && !opts.force) {
      const ok = window.confirm('当前工程有未写入磁盘的改动。确认放弃这些改动并切换工程吗？（可先点击「💾 保存」）');
      if (!ok) {
        const ps = $('#packSelect');
        if (ps) ps.value = W.activeProjectId;
        return;
      }
      W.isDirty = false;
      W.dirtySceneIds.clear();
      if (P && typeof P.clearDirtyState === 'function') P.clearDirtyState('已保存');
    }
    invalidateQuietRecompile();
    stopPlayAllScenes(false);
    W.activeProjectId = p.id;
    W.premiseDraft = p.premise || p.synopsisZh || p.synopsis || '';
    W.outlineDrafts = (p.stories || []).map((s) => {
      const segs = ensureCardSegments(s, s.cast);
      return {
        sceneId: s.id,
        title: s.titleZh || s.title,
        titleJa: s.title,
        bg: s.bg || '',
        bgm: s.bgm || '002',
        bgmStyle: s.bgmStyle || '',
        bgmSuggestions: Array.isArray(s.bgmSuggestions) ? s.bgmSuggestions : [],
        bgSuggestions: Array.isArray(s.bgSuggestions) ? s.bgSuggestions : [],
        cast: Array.isArray(s.cast) ? s.cast.slice() : [],
        summary: s.summary || '',
        segments: segs,
        beats: segs.map((seg, i) => `节拍 ${i + 1}：${seg.title} —— ${seg.summary}`)
      };
    });
    const firstScene = (p.stories && p.stories[0]) || null;
    W.activeSceneId = firstScene ? firstScene.id : '';
    renderProjectSelector();
    if (firstScene) {
      syncSceneIntoSCProto(p, firstScene);
    }
    renderSceneTree();
    const isReaction = p['x-projectType'] === 'reaction' || p.projectType === 'reaction' || p.id === 'reaction_idol_relation';
    setReactionWorkbenchActive(isReaction);
    if (!isReaction && window.SCProto && window.SCProto.S.mode === 'muse') {
      renderStep1OutlinePanel($('#musePanel'));
    }
  }

  function selectScene(sceneId) {
    const p = getActiveProject();
    if (!p) return;
    const sc = (p.stories || []).find((s) => s.id === sceneId);
    if (!sc) return;
    invalidateQuietRecompile();
    if (sceneId !== W.activeSceneId) {
      stashActiveProtoIntoSceneMemory();
    }
    W.activeSceneId = sc.id;
    syncSceneIntoSCProto(p, sc);
    renderSceneTree();
    if (window.SCProto && window.SCProto.S.mode === 'muse') {
      renderStep1OutlinePanel($('#musePanel'));
    }
    if (window.SCProto && window.SCProto.toast) {
      window.SCProto.toast(`🎬 已切换至：${sc.titleZh || sc.title}`);
    }
  }

  async function reorderScene(idx, delta) {
    const p = getActiveProject();
    if (!p || !Array.isArray(p.stories)) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= p.stories.length) return;
    const order = p.stories.map((s) => s.id);
    const tmp = order[idx];
    order[idx] = order[targetIdx];
    order[targetIdx] = tmp;

    try {
      const res = await fetch(`/api/studio/projects/${encodeURIComponent(p.id)}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', sceneOrder: order })
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.projects)) {
        W.projects = data.projects;
        renderSceneTree();
        window.SCProto.toast('✓ 场景顺序已更新并保存至 pack.json');
      }
    } catch (err) {
      window.SCProto.toast('✗ 排序保存失败：' + err.message, 'err');
    }
  }

  async function deleteScene(sid) {
    const p = getActiveProject();
    if (!p || !Array.isArray(p.stories)) return;
    if (p.stories.length <= 1) {
      window.SCProto.toast('⚠️ 至少需要保留 1 幕，无法删除最后一幕', 'warn');
      return;
    }
    const target = p.stories.find((s) => s.id === sid);
    const label = (target && (target.titleZh || target.title)) || sid;
    if (!window.confirm(`确定删除「${label}」吗？删除后该幕大纲与台本文件将被移除。`)) return;

    try {
      const res = await fetch(`/api/studio/projects/${encodeURIComponent(p.id)}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', sceneId: sid })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error((data && data.error) || '删除失败');
      if (Array.isArray(data.projects)) {
        invalidateQuietRecompile();
        W.projects = data.projects;
        const updatedP = getActiveProject();
        if (updatedP && Array.isArray(updatedP.stories) && updatedP.stories.length) {
          if (W.activeSceneId === sid || !updatedP.stories.some((s) => s.id === W.activeSceneId)) {
            W.activeSceneId = updatedP.stories[0].id;
          }
          W.outlineDrafts = W.outlineDrafts.filter((c) => c.sceneId !== sid);
          const nextSc = getActiveScene();
          if (nextSc) syncSceneIntoSCProto(updatedP, nextSc);
        }
        renderSceneTree();
        const museBox = $('#musePanel');
        if (museBox && !museBox.hidden) renderStep1OutlinePanel(museBox);
        window.SCProto.toast(`🗑️ 已删除「${label}」`);
      }
    } catch (err) {
      window.SCProto.toast('✗ 删除场景失败：' + err.message, 'err');
    }
  }

  // ---------------------------------------------------------------------------
  // Step 1 · 💡 脑洞与分场大纲 (Outline) Panel
  // ---------------------------------------------------------------------------
  function renderStep1OutlinePanel(box) {
    if (!box) box = $('#musePanel');
    if (!box) return;
    const p = getActiveProject();
    if (!p) return;

    if (!W.outlineDrafts || !W.outlineDrafts.length) {
      W.outlineDrafts = (p.stories || []).map((s) => {
        const segs = ensureCardSegments(s, s.cast);
        return {
          sceneId: s.id,
          title: s.titleZh || s.title,
          titleJa: s.title,
          bg: s.bg || '',
          bgm: s.bgm || '002',
          bgmStyle: s.bgmStyle || '',
          bgmSuggestions: Array.isArray(s.bgmSuggestions) ? s.bgmSuggestions : [],
          bgSuggestions: Array.isArray(s.bgSuggestions) ? s.bgSuggestions : [],
          cast: Array.isArray(s.cast) ? s.cast.slice() : [],
          summary: s.summary || '',
          segments: segs,
          beats: segs.map((seg, i) => `节拍 ${i + 1}：${seg.title} —— ${seg.summary}`)
        };
      });
    } else {
      W.outlineDrafts.forEach((c) => {
        c.segments = ensureCardSegments(c, c.cast);
      });
    }
    if (W.premiseDraft === undefined || W.premiseDraft === null) {
      W.premiseDraft = p.premise || p.synopsisZh || '';
    }

    const bgOptsAll = getAllBgOptions();
    const bgmOptsAll = getAllBgmOptions();
    const allIdols = Object.keys(W.idolMeta).length
      ? Object.keys(W.idolMeta)
      : ['mano', 'hiori', 'meguru', 'amana', 'tenka', 'hana', 'fuyuko', 'asahi', 'mei', 'tooru', 'madoka'];

    const dfltStep1Badge = getDefaultEngineBadge();
    const activeIdx = Math.max(0, W.outlineDrafts.findIndex((c) => c.sceneId === W.activeSceneId));
    const activeCard = W.outlineDrafts[activeIdx] || null;
    if (activeCard) W.activeSceneId = activeCard.sceneId;

    const projectCastSet = new Set(W.outlineDrafts.flatMap((c) => c.cast || []));
    const projectCastNames = Array.from(projectCastSet)
      .map((cid) => (W.idolMeta[cid] ? W.idolMeta[cid].speaker : cid))
      .join('、');

    box.innerHTML = `
      <div class="step1-blueprint">
        <!-- L1：项目总剧情与全局控制 -->
        <section class="bp-l1 glass">
          <div class="bp-l1-top">
            <div class="bp-l1-title">
              <span class="bp-tier-tag">L1 · 项目总剧情</span>
              <b>${esc(p.nameZh || p.name)}</b>
              <span class="gen-engine-badge ${W.lastGenerator === 'llm' || dfltStep1Badge.isLlm ? 'llm' : ''}">
                ${esc(W.lastGeneratorLabel || dfltStep1Badge.shortLabel)}
              </span>
            </div>
            <div class="bp-l1-actions">
              <select class="depth-select" id="scriptDepthSelect" title="选择生成剧本的篇幅与细腻度">
                <option value="short" ${W.scriptDepth === 'short' ? 'selected' : ''}>⚡ 轻量 8-10句/幕</option>
                <option value="standard" ${W.scriptDepth === 'standard' ? 'selected' : ''}>🎬 标准 16-22句/幕</option>
                <option value="deep" ${W.scriptDepth === 'deep' ? 'selected' : ''}>📖 深度 28-36句/幕</option>
              </select>
              <button class="btn ghost" id="btnImportExternalScript" ${W.busy ? 'disabled' : ''} title="零成本直接导入朋友或外部 AI 生成的剧本（支持外部剧场 JSON / scproj / 大纲 JSON / 文本对话）">📥 导入外部剧本</button>
              <button class="btn prism ${W.busyKey === 'expand-outline' ? 'is-busy-active' : ''}" id="btnExpandOutline" data-busy-key="expand-outline" data-busy-active-text="⏳ 拆解蓝图中" ${W.busy ? 'disabled' : ''} title="根据 L1 总剧情自动拆解 L2 分幕大转场与 L3 每幕小段">
                ${W.busyKey === 'expand-outline' ? '⏳ 拆解蓝图中…' : '✨ AI 拆解分幕与小段'}
              </button>
              <button class="btn prism ${W.busyKey === 'gen-all' ? 'is-busy-active' : ''}" id="btnGenerateAllScripts" data-busy-key="gen-all" data-busy-active-text="⏳ 全片生成中" ${W.busy || !W.outlineDrafts.length ? 'disabled' : ''} title="确认 L1→L2→L3 蓝图后，依次生成全片台词并进入 Step 2 精修">
                ${W.busyKey === 'gen-all' ? '⏳ 全片生成中…' : '📜 确认蓝图并生成全片台词 → Step 2'}
              </button>
            </div>
          </div>
          ${W.busy ? `<div class="wf-busy-bar" data-busy-banner><span class="wf-spin"></span><span class="wf-busy-text">${esc(W.busyLabel || 'AI 处理中…')}</span><span class="wf-busy-elapsed" data-busy-elapsed>已耗时 0s</span></div>` : ''}
          ${W.lastLlmWarning ? `<div class="callout warn" style="padding:5px 10px;font-size:11.5px">⚠️ ${esc(W.lastLlmWarning)}</div>` : ''}
          <textarea id="outlineIdeaInput" class="bp-l1-premise" rows="2" placeholder="先在这里写下整部故事的完整脑洞与起承转合，再点右上角「✨ AI 拆解分幕与小段」…">${esc(
            W.premiseDraft
          )}</textarea>
          <div class="bp-pinned-facts" id="bpPinnedFactsBar">
            <span class="bp-pin-lbl" title="钉选全片不可违背的设定或伏笔，生成任何一幕/小段都会置顶注入">📌 核心事实钉选：</span>
            <div class="bp-pin-chips">
              ${getPinnedFacts(p)
                .map((f, fi) => `<span class="bp-pin-chip">${esc(f)} <button type="button" data-del-pin="${fi}" title="移除">✕</button></span>`)
                .join('')}
            </div>
            <input type="text" class="bp-pin-input" id="pinnedFactInput" placeholder="输入防吃书核心事实（如：朝日右脚扭伤），回车钉选…" />
            <button type="button" class="chip-btn" id="btnAddPinnedFact">+ 钉选</button>
          </div>
          <div class="bp-l1-meta">
            <span>👥 全片已识别角色 (${projectCastSet.size}人)：<b>${esc(projectCastNames || '未指定')}</b>（每幕可在下方 L2 单独增减）</span>
            <span>💡 渐进流程：先定 <b>L1 总剧情</b> → 再定左栏 <b>L2 几幕与大转场</b> → 再细化右栏 <b>L3 每幕小段走向</b> → 最后进 Step 2 精修台词</span>
          </div>
        </section>

        <!-- L2 + L3 双栏渐进细化区 -->
        <div class="bp-columns">
          <!-- L2：全片分幕与大转场（独立滚动） -->
          <section class="bp-col glass" id="bpL2Col">
            <div class="bp-col-head">
              <div class="bp-l1-title">
                <span class="bp-tier-tag l2">L2 · 分幕与大转场</span>
                <b>共 ${W.outlineDrafts.length} 幕</b>
              </div>
              <button type="button" class="chip-btn" id="btnAddOutlineCard">+ 新增一幕</button>
            </div>
            <div class="bp-col-body" id="bpL2List">
              ${W.outlineDrafts
                .map((card, cIdx) => {
                  const isOn = cIdx === activeIdx;
                  const castList = Array.isArray(card.cast) ? card.cast : [];
                  const castSet = new Set(castList);
                  const selectedNames = castList.map((cid) => (W.idolMeta[cid] ? W.idolMeta[cid].speaker : cid)).join('、');
                  const orderedIdols = [...allIdols].sort((a, b) => (castSet.has(a) === castSet.has(b) ? 0 : castSet.has(a) ? -1 : 1));
                  const nextCard = W.outlineDrafts[cIdx + 1];
                  const transHtml = nextCard
                    ? `<div class="bp-transition-pill" title="第 ${cIdx + 1} 幕到第 ${cIdx + 2} 幕的场景与配乐大转场">↓ 大转场：BG ${esc(card.bg || '—')} → ${esc(nextCard.bg || '—')} · BGM ${esc(card.bgm || '—')} → ${esc(nextCard.bgm || '—')}</div>`
                    : '';
                  return `
                  <div class="bp-act-card outline-card ${isOn ? 'on active-card' : ''}" data-card-idx="${cIdx}" data-act-select="${esc(card.sceneId)}">
                    <div class="bp-act-top">
                      <span class="sc-idx-pill">第 ${cIdx + 1} 幕</span>
                      <input type="text" class="outline-title-inp" data-field="title" value="${esc(card.title)}" placeholder="输入本幕标题…" />
                      <button type="button" class="sc-mini-btn" data-bp-move="-1" data-bp-idx="${cIdx}" title="上移此幕" ${cIdx === 0 ? 'disabled' : ''}>↑</button>
                      <button type="button" class="sc-mini-btn" data-bp-move="1" data-bp-idx="${cIdx}" title="下移此幕" ${cIdx === W.outlineDrafts.length - 1 ? 'disabled' : ''}>↓</button>
                      <button type="button" class="sc-mini-btn sc-del-btn" data-bp-del="${esc(card.sceneId)}" title="删除这一幕" ${W.outlineDrafts.length <= 1 ? 'disabled' : ''}>✕</button>
                      <button type="button" class="btn prism sm-cta" data-gen-script="${cIdx}" title="只为这一幕单独生成/重生成台词并进 Step 2">生成本幕 →</button>
                    </div>
                    <div class="outline-env-row">
                      <label>🖼️ 背景：
                        <select data-field="bg">
                          ${buildGroupedBgOptionsHtml(card.bg, card)}
                        </select>
                        <button type="button" class="sc-mini-btn" data-outline-bg-preview="${esc(card.bg)}" title="放大试看当前选中的背景图片">👁 试看</button>
                      </label>
                      <label>🎵 开场配乐：
                        <select data-field="bgm">
                          ${buildGroupedBgmOptionsHtml(card.bgm, card, { isBeat: false })}
                        </select>
                        <button type="button" class="sc-mini-btn" data-outline-bgm-play="${esc(card.bgm)}" title="试听/停止该配乐（自动暂停舞台主音乐）">▶ 试听</button>
                      </label>
                      <label title="留空表示跟随顶部全局档位；填入 2–50 可单独指定本幕台词总句数">💬 句数：
                        <input type="number" min="0" max="50" class="act-lines-in" data-field="targetLines" value="${Number(card.targetLines) > 0 ? Number(card.targetLines) : ''}" placeholder="自动" />
                      </label>
                    </div>
                    <div class="outline-bgm-flow-box">
                      <div class="row-flex" style="gap:6px;align-items:center">
                        <span class="muted" style="font-size:11px;white-space:nowrap">🎼 剧情流向配乐思路：</span>
                        <input type="text" class="outline-bgm-style-in" data-field="bgmStyle" value="${esc(card.bgmStyle || '')}" placeholder="例如：开场元气日常 → 中段危机紧张 → 结尾温柔抒情" />
                      </div>
                      <div class="rec-pick-row">
                        <span class="muted rec-row-lbl">⭐ 推荐配乐：</span>
                        ${resolveBgmRecsForObj(card, bgmOptsAll, 4)
                          .map((m) => `<span class="rec-pick-chip ${card.bgm === m.id ? 'on' : ''}"><button type="button" data-pick-card-bgm="${esc(m.id)}" title="点击设为本幕开场 BGM">${esc(m.id)} ${esc((m.title || m.label || '').slice(0, 12))}</button><button type="button" class="rec-aud" data-aud-chip-bgm="${esc(m.id)}" title="试听 ${esc(m.id)}">▶</button></span>`)
                          .join('')}
                      </div>
                      <div class="rec-pick-row">
                        <span class="muted rec-row-lbl">🖼 推荐背景：</span>
                        ${resolveBgRecsForObj(card, bgOptsAll, 4)
                          .map((b) => `<span class="rec-pick-chip ${card.bg === b.id ? 'on' : ''}"><button type="button" data-pick-card-bg="${esc(b.id)}" title="点击设为本幕开场背景">${esc(b.id)} ${esc((b.label || '').slice(0, 8))}</button><button type="button" class="rec-aud" data-preview-bg="${esc(b.id)}" title="试看背景图 ${esc(b.id)}">👁</button></span>`)
                          .join('')}
                      </div>
                    </div>
                    <div class="outline-cast-row">
                      <span class="fld-lbl">👥 本幕角色 (${castSet.size}人${selectedNames ? `：<b>${esc(selectedNames)}</b>` : ''}${
                        castSet.size > 3 ? ' <b class="cam-cut-warn">· >3人自动切机位</b>' : ''
                      })：</span>
                      <div class="idol-chip-wrap">
                        ${orderedIdols
                          .map((cid) => {
                            const im = W.idolMeta[cid] || { speaker: cid, nameZh: cid };
                            return `<button type="button" class="idol-toggle-chip ${castSet.has(cid) ? 'on' : ''}" data-toggle-idol="${esc(cid)}">${esc(im.speaker)}</button>`;
                          })
                          .join('')}
                      </div>
                    </div>
                    <div class="outline-summary-row" style="margin-top:6px">
                      <textarea rows="2" class="outline-sum-inp" data-field="summary" placeholder="本幕核心剧情与大转场说明…">${esc(card.summary)}</textarea>
                    </div>
                  </div>
                  ${transHtml}
                  `;
                })
                .join('')}
            </div>
          </section>

          <!-- L3：当前选中幕的小段走向（独立滚动） -->
          <section class="bp-col glass" id="bpL3Col" data-l3-card-idx="${activeIdx}">
            ${
              activeCard
                ? `
              <div class="bp-col-head">
                <div class="bp-l1-title">
                  <span class="bp-tier-tag l3">L3 · 小段剧情走向</span>
                  <b>第 ${activeIdx + 1} 幕：${esc((activeCard.title || '').replace(/^第\s*\d+\s*幕\s*[·・]?\s*/, '') || activeCard.sceneId)}</b>
                  <span class="muted" style="font-size:11.5px">共 ${(activeCard.segments || []).length} 段</span>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <button type="button" class="chip-btn ${W.busyKey === 'enrich-l3' ? 'is-busy-active' : ''}" id="btnEnrichL3Segments" data-busy-key="enrich-l3" data-busy-active-text="⏳ 理清中" ${W.busy ? 'disabled' : ''} title="用平实叙事补全本幕各小段的前因后果与信息推进，方便理清整体剧情脉络">${W.busyKey === 'enrich-l3' ? '⏳ 理清中…' : '✨ AI 理清本幕小段'}</button>
                  <button type="button" class="chip-btn" data-add-beat="${activeIdx}">+ 新增小段</button>
                </div>
              </div>
              <div class="bp-col-body" id="bpL3List">
                ${(activeCard.segments || [])
                  .map((seg, bIdx) => {
                    const segCast = new Set(Array.isArray(seg.cast) && seg.cast.length ? seg.cast : activeCard.cast || []);
                    const sceneCastPool = activeCard.cast && activeCard.cast.length ? activeCard.cast : ['amana', 'hana'];
                    return `
                    <div class="bp-beat-card" data-seg-idx="${bIdx}">
                      <div class="bp-beat-top">
                        <span class="beat-num">🧩 小段 ${bIdx + 1}</span>
                        <input type="text" class="beat-title-in" data-seg-field="title" data-seg-idx="${bIdx}" value="${esc(seg.title)}" placeholder="小段标题（如：山道竞速与意外崴脚）…" />
                        <button type="button" class="sc-mini-btn" data-move-seg="-1" data-seg-idx="${bIdx}" title="上移小段" ${bIdx === 0 ? 'disabled' : ''}>↑</button>
                        <button type="button" class="sc-mini-btn" data-move-seg="1" data-seg-idx="${bIdx}" title="下移小段" ${bIdx === activeCard.segments.length - 1 ? 'disabled' : ''}>↓</button>
                        <button type="button" class="sc-mini-btn sc-del-btn" data-del-beat="${bIdx}" title="删除此小段" ${activeCard.segments.length <= 1 ? 'disabled' : ''}>✕</button>
                        <button type="button" class="chip-btn ${W.busyKey === `regen-seg-${bIdx}` ? 'is-busy-active' : ''}" data-regen-seg="${bIdx}" data-busy-key="regen-seg-${bIdx}" data-busy-active-text="⏳ 生成中" ${W.busy ? 'disabled' : ''} title="仅按本小段描述生成/重写本小段台词">${W.busyKey === `regen-seg-${bIdx}` ? '⏳ 生成中…' : '🔄 仅写本小段台词'}</button>
                      </div>
                      <textarea rows="4" class="beat-summary-in" data-seg-field="summary" data-seg-idx="${bIdx}" placeholder="细化这一小段具体发生什么、谁先开口、有什么情绪转折…">${esc(seg.summary)}</textarea>
                      <div class="beat-segment-meta">
                        <span class="muted">本小段出场角色：</span>
                        ${sceneCastPool
                          .map((cid) => {
                            const im = W.idolMeta[cid] || { speaker: cid, nameZh: cid };
                            return `<button type="button" class="idol-toggle-chip ${segCast.has(cid) ? 'on' : ''}" data-seg-idol="${esc(cid)}" data-seg-idx="${bIdx}" style="padding:1px 7px;font-size:10.5px">${esc(im.speaker)}</button>`;
                          })
                          .join('')}
                        <label class="beat-lines-ctl" title="单独指定本小段生成的对话句数（1–20 句）">
                          · 💬 目标句数
                          <input type="number" min="1" max="20" class="beat-lines-in" data-seg-field="targetLines" data-seg-idx="${bIdx}" value="${Number(seg.targetLines) || 4}" />
                          句
                        </label>
                        <button type="button" class="chip-btn cue-toggle-btn ${seg.needsActionCue ? 'on' : ''}" data-toggle-seg-cue="${bIdx}" title="开启后生成台词时将按走位提示插入独立🎬动作拍；日常纯对话请保持关闭">${seg.needsActionCue ? '🎬 含动作拍 ✓' : '🎬 + 动作拍'}</button>
                      </div>
                      <div class="beat-bgm-row">
                        <label title="本小段的核心情绪基调">🎭 情绪：
                          <select data-seg-field="mood" data-seg-idx="${bIdx}">
                            ${MOOD_OPTION_LABELS.map(([mk, ml]) => `<option value="${esc(mk)}" ${(seg.mood || 'warm') === mk ? 'selected' : ''}>${esc(ml)}</option>`).join('')}
                          </select>
                        </label>
                        <label title="选「延续上一段配乐」保持不变；选具体曲目或淡出则在该小段自动切歌">🎵 本段配乐：
                          <select data-seg-field="bgm" data-seg-idx="${bIdx}" style="max-width:225px">
                            ${buildGroupedBgmOptionsHtml(seg.bgm || '', seg, { isBeat: true })}
                          </select>
                        </label>
                        <button type="button" class="sc-mini-btn" data-beat-bgm-play="${bIdx}" title="试听本小段当前生效的 BGM（自动暂停主音乐）">▶ 试听</button>
                        <span class="beat-bgm-reason" title="${esc(seg.bgmReason || '')}">💡 ${esc(seg.bgmReason || (seg.bgm ? `切换 → ${seg.bgm}` : '延续上一段配乐'))}</span>
                      </div>
                      ${seg.needsActionCue ? `<div class="beat-cue-hint-row"><input type="text" class="beat-blocking-in" data-seg-field="blockingHint" data-seg-idx="${bIdx}" value="${esc(seg.blockingHint || '')}" placeholder="写明谁怎么水平走位（如：朝日说完向右跑出画外，冬优和爱依随后追出并切镜）…" /></div>` : ''}
                    </div>
                  `;
                  })
                  .join('')}
              </div>
              `
                : '<div class="muted" style="padding:20px">请在左侧新增或选择一幕</div>'
            }
          </section>
        </div>
      </div>
    `;

    // Bind Step 1 events
    const ideaInp = $('#outlineIdeaInput', box);
    if (ideaInp) {
      ideaInp.oninput = () => {
        W.premiseDraft = ideaInp.value;
      };
    }

    const pinInp = $('#pinnedFactInput', box);
    const btnPin = $('#btnAddPinnedFact', box);
    const addPin = () => {
      const val = pinInp ? pinInp.value.trim() : '';
      if (!val) return;
      const cur = getPinnedFacts(p).slice();
      cur.push(val);
      savePinnedFacts(p, cur);
      renderStep1OutlinePanel(box);
    };
    if (btnPin) btnPin.onclick = addPin;
    if (pinInp) {
      pinInp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addPin();
        }
      };
    }
    $$('[data-del-pin]', box).forEach((db) => {
      db.onclick = () => {
        const idx = +db.dataset.delPin;
        const cur = getPinnedFacts(p).slice();
        cur.splice(idx, 1);
        savePinnedFacts(p, cur);
        renderStep1OutlinePanel(box);
      };
    });

    const btnEnrichL3 = $('#btnEnrichL3Segments', box);
    if (btnEnrichL3 && activeCard) {
      btnEnrichL3.onclick = async () => {
        setBusyProgress(`正在理清第 ${activeIdx + 1} 幕小段剧情脉络…`, 'enrich-l3', btnEnrichL3);
        renderStep1OutlinePanel(box);
        try {
          const res = await fetch('/api/studio/enrich-segments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scene: activeCard,
              projectPremise: W.premiseDraft || p.premise || '',
              storyContext: buildStoryContinuityContext(activeCard.sceneId),
              llmConfig: getLlmConfig()
            })
          });
          const data = await res.json();
          if (data.ok && Array.isArray(data.segments) && data.segments.length) {
            activeCard.segments = data.segments;
            activeCard.beats = data.segments.map((s, i) => `节拍 ${i + 1}：${s.title} —— ${s.summary}`);
            if (data.bgmStyle) activeCard.bgmStyle = data.bgmStyle;
            if (Array.isArray(data.bgmSuggestions)) activeCard.bgmSuggestions = data.bgmSuggestions;
            if (Array.isArray(data.bgSuggestions)) activeCard.bgSuggestions = data.bgSuggestions;
            const targetSc = (p.stories || []).find((s) => s.id === activeCard.sceneId);
            if (targetSc) {
              targetSc.segments = data.segments;
              targetSc.beats = activeCard.beats;
              if (activeCard.bgmStyle) targetSc.bgmStyle = activeCard.bgmStyle;
              if (activeCard.bgmSuggestions) targetSc.bgmSuggestions = activeCard.bgmSuggestions;
              if (activeCard.bgSuggestions) targetSc.bgSuggestions = activeCard.bgSuggestions;
              await fetch(`/api/studio/projects/${encodeURIComponent(p.id)}/scenes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'upsert_scene', scene: targetSc })
              }).catch(() => {});
            }
            window.SCProto.toast(`✨ [${data.generatorLabel || 'AI 细化'}] 已将第 ${activeIdx + 1} 幕的 ${data.segments.length} 个小段扩写为详细剧情！`);
          } else {
            window.SCProto.toast('✗ 细化小段失败：' + (data.error || '未知错误'), 'err');
          }
        } catch (err) {
          window.SCProto.toast('✗ 细化小段失败：' + err.message, 'err');
        } finally {
          clearBusyProgress(btnEnrichL3);
          renderStep1OutlinePanel(box);
        }
      };
    }

    const btnImportExt = $('#btnImportExternalScript', box);
    if (btnImportExt) {
      btnImportExt.onclick = () => openImportExternalScriptModal(p);
    }

    const btnExpand = $('#btnExpandOutline', box);
    if (btnExpand) {
      btnExpand.onclick = async () => {
        setBusyProgress('正在根据 L1 总剧情拆解 L2 分幕与 L3 小段…', 'expand-outline', btnExpand);
        renderStep1OutlinePanel(box);
        try {
          const res = await fetch('/api/studio/expand-outline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: p.id,
              projectTitle: p.nameZh || p.name,
              prompt: W.premiseDraft,
              cast: p.cast || ['mano', 'hiori', 'meguru', 'amana', 'tenka', 'hana'],
              applyToProject: true,
              llmConfig: getLlmConfig()
            })
          });
          const data = await res.json();
          if (data.ok && Array.isArray(data.outlines)) {
            invalidateQuietRecompile();
            updateGeneratorBadges(data.generator, data.generatorLabel, data.llmWarning || null);
            W.outlineDrafts = data.outlines;
            if (Array.isArray(data.projects)) {
              W.projects = data.projects;
              const updatedP = getActiveProject();
              if (updatedP && updatedP.stories && updatedP.stories[0]) {
                W.activeSceneId = updatedP.stories[0].id;
                syncSceneIntoSCProto(updatedP, updatedP.stories[0]);
              }
              renderSceneTree();
            }
            const detectedNames = Array.isArray(data.detectedCast) && data.detectedCast.length
              ? data.detectedCast.map((cid) => (W.idolMeta[cid] && (W.idolMeta[cid].nameZh || W.idolMeta[cid].speaker)) || cid).join('、')
              : '';
            const castHint = detectedNames ? `｜自动识别角色：${detectedNames}（可在卡片内手动增减）` : '';
            window.SCProto.toast(`✨ [${data.generatorLabel || '⚡ 本地模板生成'}] 已扩写 ${data.outlines.length} 幕分场大纲${castHint}`);
          }
        } catch (err) {
          window.SCProto.toast('✗ 扩写大纲失败：' + err.message, 'err');
        } finally {
          clearBusyProgress(btnExpand);
          renderStep1OutlinePanel(box);
        }
      };
    }

    const btnGenAll = $('#btnGenerateAllScripts', box);
    if (btnGenAll) {
      btnGenAll.onclick = async () => {
        if (!W.outlineDrafts || !W.outlineDrafts.length) return;
        setBusyProgress(`正在生成第 1/${W.outlineDrafts.length} 幕台词…`, 'gen-all', btnGenAll);
        renderStep1OutlinePanel(box);
        let totalLines = 0;
        let warnCount = 0;
        const generatedRowsMap = new Map();
        try {
          for (let i = 0; i < W.outlineDrafts.length; i++) {
            const card = W.outlineDrafts[i];
            W.busyLabel = `正在生成第 ${i + 1}/${W.outlineDrafts.length} 幕「${card.title}」台词…`;
            const btnLive = $('#btnGenerateAllScripts', box);
            if (btnLive) btnLive.dataset.busyActiveText = `⏳ 第 ${i + 1}/${W.outlineDrafts.length} 幕`;
            window.SCProto.toast(`⏳ 正在生成第 ${i + 1}/${W.outlineDrafts.length} 幕「${card.title}」台词…`);
            const expRes = await fetch('/api/studio/expand-script', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                outline: card,
                depth: W.scriptDepth || 'standard',
                storyContext: buildStoryContinuityContext(card.sceneId, generatedRowsMap),
                llmConfig: getLlmConfig()
              })
            });
            const expData = await expRes.json();
            if (!expData.ok) throw new Error(expData.error || `第 ${i + 1} 幕生成失败`);
            if (Array.isArray(expData.scriptRows)) generatedRowsMap.set(card.sceneId, expData.scriptRows);
            updateGeneratorBadges(expData.generator, expData.generatorLabel, expData.llmWarning || null);
            if (expData.llmWarning) warnCount++;
            totalLines += Array.isArray(expData.scriptRows) ? expData.scriptRows.length : 0;

            invalidateQuietRecompile();
            delete card.preservePrecompiled;
            delete card.precompiledLines;
            delete card.scprojLines;
            const saveRes = await fetch(`/api/studio/projects/${encodeURIComponent(p.id)}/scenes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'save',
                regenerateScript: true,
                sceneId: card.sceneId,
                title: card.title,
                titleZh: card.title,
                bg: card.bg,
                bgm: card.bgm,
                bgmStyle: card.bgmStyle || '',
                cast: card.cast,
                summary: card.summary,
                segments: card.segments,
                beats: card.beats,
                scriptRows: expData.scriptRows
              })
            });
            const saveData = await saveRes.json();
            if (saveData.ok && Array.isArray(saveData.projects)) {
              W.projects = saveData.projects;
            }
          }
          renderSceneTree();
          const updatedP = getActiveProject();
          const updatedSc = getActiveScene();
          if (updatedP && updatedSc) syncSceneIntoSCProto(updatedP, updatedSc);
          window.SCProto.setMode('polish');
          if (warnCount > 0) {
            window.SCProto.toast(`⚠️ 已完成全部 ${W.outlineDrafts.length} 幕台词（共 ${totalLines} 句，其中 ${warnCount} 幕触发了兜底模板）`, 'err');
          } else {
            window.SCProto.toast(`✅ 已全部生成 ${W.outlineDrafts.length} 幕详细台词（共 ${totalLines} 句）！`);
          }
        } catch (err) {
          window.SCProto.toast('✗ 批量生成台词失败：' + err.message, 'err');
        } finally {
          clearBusyProgress(btnGenAll);
          renderStep1OutlinePanel(box);
        }
      };
    }

    const btnAddCard = $('#btnAddOutlineCard', box);
    if (btnAddCard) {
      btnAddCard.onclick = () => {
        const nextNum = W.outlineDrafts.length + 1;
        const newSid = `scene_${String(nextNum).padStart(2, '0')}`;
        W.outlineDrafts.push({
          sceneId: newSid,
          title: `第 ${nextNum} 幕 · 新增分场剧情`,
          bg: '',
          bgm: '',
          cast: (p.cast || ['amana', 'hana']).slice(0, 3),
          summary: '在此输入新场景的剧情梗概…',
          beats: ['节拍 1：角色登场与环境铺垫', '节拍 2：制作人与偶像互动推进', '节拍 3：场景收尾']
        });
        W.activeSceneId = newSid;
        renderStep1OutlinePanel(box);
      };
    }

    const depthSelGlobal = $('#scriptDepthSelect', box);
    if (depthSelGlobal) {
      depthSelGlobal.onchange = () => {
        W.scriptDepth = depthSelGlobal.value || 'standard';
        try { localStorage.setItem('scstudio.scriptDepth', W.scriptDepth); } catch (_) {}
      };
    }

    $$('.outline-card', box).forEach((cardEl) => {
      const cIdx = +cardEl.dataset.cardIdx;
      const card = W.outlineDrafts[cIdx];
      if (!card) return;

      cardEl.onclick = (e) => {
        if (e.target.closest('input, textarea, select, button')) return;
        if (W.activeSceneId !== card.sceneId) {
          W.activeSceneId = card.sceneId;
          const exists = p && Array.isArray(p.stories) && p.stories.some((s) => s.id === card.sceneId);
          if (exists) selectScene(card.sceneId);
          else renderStep1OutlinePanel(box);
        }
      };

      $$('input[data-field], textarea[data-field], select[data-field]', cardEl).forEach((inp) => {
        inp.oninput = () => {
          if (inp.dataset.field === 'targetLines') {
            const v = parseInt(inp.value, 10);
            card.targetLines = v > 0 ? Math.max(2, Math.min(50, v)) : 0;
          } else {
            card[inp.dataset.field] = inp.value;
          }
        };
        inp.onchange = () => {
          if (inp.dataset.field === 'targetLines') {
            const v = parseInt(inp.value, 10);
            card.targetLines = v > 0 ? Math.max(2, Math.min(50, v)) : 0;
          } else {
            card[inp.dataset.field] = inp.value;
          }
          if (inp.dataset.field === 'bg' || inp.dataset.field === 'bgm' || inp.dataset.field === 'bgmStyle' || inp.dataset.field === 'title' || inp.dataset.field === 'summary') {
            persistStep1CardEnvQuietly(card, inp.dataset.field);
            if (inp.dataset.field === 'bg' || inp.dataset.field === 'bgm') {
              renderStep1OutlinePanel(box);
            }
          }
        };
      });

      $$('[data-pick-card-bgm]', cardEl).forEach((pbtn) => {
        pbtn.onclick = (e) => {
          e.stopPropagation();
          card.bgm = pbtn.dataset.pickCardBgm;
          persistStep1CardEnvQuietly(card, 'bgm');
          renderStep1OutlinePanel(box);
        };
      });

      $$('[data-aud-chip-bgm]', cardEl).forEach((abtn) => {
        abtn.onclick = (e) => {
          e.stopPropagation();
          if (window.SCProto && typeof window.SCProto.playBgmPreview === 'function') {
            window.SCProto.playBgmPreview(abtn.dataset.audChipBgm, 0, { force: true });
          }
        };
      });

      $$('[data-pick-card-bg]', cardEl).forEach((gbtn) => {
        gbtn.onclick = (e) => {
          e.stopPropagation();
          card.bg = gbtn.dataset.pickCardBg;
          persistStep1CardEnvQuietly(card, 'bg');
          renderStep1OutlinePanel(box);
        };
      });

      const applyBgPreviewPick = (pickedBgId) => {
        card.bg = pickedBgId;
        persistStep1CardEnvQuietly(card, 'bg');
        renderStep1OutlinePanel(box);
      };

      const outBgPreview = $('[data-outline-bg-preview]', cardEl);
      if (outBgPreview) {
        outBgPreview.onclick = (e) => {
          e.stopPropagation();
          const gSel = $('select[data-field="bg"]', cardEl);
          const bgId = gSel ? gSel.value : outBgPreview.dataset.outlineBgPreview;
          openBgPreviewModal(bgId, {
            recs: resolveBgRecsForObj(card, bgOptsAll, 4),
            onPick: applyBgPreviewPick
          });
        };
      }

      $$('[data-preview-bg]', cardEl).forEach((pbtn) => {
        pbtn.onclick = (e) => {
          e.stopPropagation();
          openBgPreviewModal(pbtn.dataset.previewBg, {
            recs: resolveBgRecsForObj(card, bgOptsAll, 4),
            onPick: applyBgPreviewPick
          });
        };
      });

      const outBgmAud = $('[data-outline-bgm-play]', cardEl);
      if (outBgmAud) {
        outBgmAud.onclick = (e) => {
          e.stopPropagation();
          const bSel = $('select[data-field="bgm"]', cardEl);
          const bId = bSel ? bSel.value : outBgmAud.dataset.outlineBgmPlay;
          if (window.SCProto && typeof window.SCProto.playBgmPreview === 'function') {
            window.SCProto.playBgmPreview(bId, 0, { force: true });
          }
        };
      }

      $$('[data-toggle-idol]', cardEl).forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const cid = btn.dataset.toggleIdol;
          card.cast = card.cast || [];
          if (card.cast.includes(cid)) {
            if (card.cast.length > 1) card.cast = card.cast.filter((x) => x !== cid);
          } else {
            card.cast.push(cid);
          }
          renderStep1OutlinePanel(box);
        };
      });

      const genBtn = $('[data-gen-script]', cardEl);
      if (genBtn) {
        genBtn.onclick = (e) => {
          e.stopPropagation();
          generateScriptFromCardAndGoStep2(card, genBtn);
        };
      }
    });

    $$('[data-bp-move]', box).forEach((mbtn) => {
      mbtn.onclick = (e) => {
        e.stopPropagation();
        const idx = +mbtn.dataset.bpIdx;
        const delta = +mbtn.dataset.bpMove;
        const target = idx + delta;
        if (target < 0 || target >= W.outlineDrafts.length) return;
        const tmp = W.outlineDrafts[idx];
        W.outlineDrafts[idx] = W.outlineDrafts[target];
        W.outlineDrafts[target] = tmp;
        renderStep1OutlinePanel(box);
      };
    });

    $$('[data-bp-del]', box).forEach((dbtn) => {
      dbtn.onclick = (e) => {
        e.stopPropagation();
        const sid = dbtn.dataset.bpDel;
        const exists = p && Array.isArray(p.stories) && p.stories.some((s) => s.id === sid);
        if (exists) {
          deleteScene(sid);
          return;
        }
        if (W.outlineDrafts.length <= 1) return;
        W.outlineDrafts = W.outlineDrafts.filter((c) => c.sceneId !== sid);
        if (W.activeSceneId === sid) W.activeSceneId = W.outlineDrafts[0].sceneId;
        renderStep1OutlinePanel(box);
      };
    });

    const l3Col = $('#bpL3Col', box);
    const l3Card = l3Col ? W.outlineDrafts[+l3Col.dataset.l3CardIdx] : null;
    if (l3Col && l3Card) {
      const card = l3Card;
      $$('[data-seg-field]', l3Col).forEach((sinp) => {
        const applySegField = (isCommit) => {
          const bIdx = +sinp.dataset.segIdx;
          const field = sinp.dataset.segField;
          card.segments = ensureCardSegments(card, card.cast);
          const seg = card.segments[bIdx];
          if (seg) {
            if (field === 'targetLines') {
              const v = parseInt(sinp.value, 10);
              seg.targetLines = v > 0 ? Math.max(1, Math.min(20, v)) : 4;
            } else {
              seg[field] = sinp.value;
              if (field === 'bgm') {
                seg.bgmLocked = true;
                seg.bgmReason = sinp.value === ''
                  ? '手动设为延续上一段配乐'
                  : (sinp.value === 'fade_out' ? '手动设为本段淡出' : (sinp.value === 'off' ? '手动设为本段静场' : `手动指定本段切换 → ${sinp.value}`));
              } else if (field === 'mood' && isCommit) {
                const ml = (MOOD_OPTION_LABELS.find((x) => x[0] === sinp.value) || ['', sinp.value])[1];
                if (!seg.bgmLocked && !seg.bgm) seg.bgmReason = `情绪基调设为「${ml}」`;
              }
            }
            card.beats = card.segments.map((s, i) => `节拍 ${i + 1}：${s.title} —— ${s.summary}`);
            if (isCommit && (field === 'bgm' || field === 'mood')) {
              persistStep1CardEnvQuietly(card, 'segments');
              renderStep1OutlinePanel(box);
            }
          }
        };
        sinp.oninput = () => applySegField(false);
        sinp.onchange = () => applySegField(true);
      });

      $$('[data-beat-bgm-play]', l3Col).forEach((abtn) => {
        abtn.onclick = () => {
          const bIdx = +abtn.dataset.beatBgmPlay;
          const seg = (card.segments || [])[bIdx];
          const bId = (seg && seg.bgm && seg.bgm !== 'fade_out' && seg.bgm !== 'off') ? seg.bgm : card.bgm;
          if (bId && window.SCProto && typeof window.SCProto.playBgmPreview === 'function') {
            window.SCProto.playBgmPreview(bId, 0, { force: true });
          }
        };
      });

      $$('[data-seg-idol]', l3Col).forEach((sbtn) => {
        sbtn.onclick = () => {
          const bIdx = +sbtn.dataset.segIdx;
          const cid = sbtn.dataset.segIdol;
          card.segments = ensureCardSegments(card, card.cast);
          const seg = card.segments[bIdx];
          if (!seg) return;
          seg.cast = Array.isArray(seg.cast) ? seg.cast : (card.cast || []).slice(0, 3);
          if (seg.cast.includes(cid)) {
            if (seg.cast.length > 1) seg.cast = seg.cast.filter((x) => x !== cid);
          } else {
            seg.cast.push(cid);
          }
          renderStep1OutlinePanel(box);
        };
      });

      $$('[data-toggle-seg-cue]', l3Col).forEach((cbtn) => {
        cbtn.onclick = () => {
          const bIdx = +cbtn.dataset.toggleSegCue;
          card.segments = ensureCardSegments(card, card.cast);
          const seg = card.segments[bIdx];
          if (!seg) return;
          seg.needsActionCue = !seg.needsActionCue;
          renderStep1OutlinePanel(box);
        };
      });

      $$('[data-move-seg]', l3Col).forEach((mbtn) => {
        mbtn.onclick = () => {
          const bIdx = +mbtn.dataset.segIdx;
          const delta = +mbtn.dataset.moveSeg;
          card.segments = ensureCardSegments(card, card.cast);
          const target = bIdx + delta;
          if (target < 0 || target >= card.segments.length) return;
          const tmp = card.segments[bIdx];
          card.segments[bIdx] = card.segments[target];
          card.segments[target] = tmp;
          card.beats = card.segments.map((s, i) => `节拍 ${i + 1}：${s.title} —— ${s.summary}`);
          renderStep1OutlinePanel(box);
        };
      });

      const addBeatBtn = $('[data-add-beat]', l3Col);
      if (addBeatBtn) {
        addBeatBtn.onclick = () => {
          card.segments = ensureCardSegments(card, card.cast);
          const n = card.segments.length + 1;
          card.segments.push({
            beatId: `beat_${n}_${Date.now().toString(36).slice(-3)}`,
            title: `新增小段 ${n}`,
            summary: '在此描述这一小段发生的具体互动与转折…',
            cast: (card.cast || ['amana', 'hana']).slice(0, 3),
            targetLines: 4
          });
          card.beats = card.segments.map((s, i) => `节拍 ${i + 1}：${s.title} —— ${s.summary}`);
          renderStep1OutlinePanel(box);
        };
      }

      $$('[data-del-beat]', l3Col).forEach((dbtn) => {
        dbtn.onclick = () => {
          const bIdx = +dbtn.dataset.delBeat;
          card.segments = ensureCardSegments(card, card.cast);
          if (card.segments.length > 1) {
            card.segments.splice(bIdx, 1);
            card.beats = card.segments.map((s, i) => `节拍 ${i + 1}：${s.title} —— ${s.summary}`);
            renderStep1OutlinePanel(box);
          }
        };
      });

      $$('[data-regen-seg]', l3Col).forEach((rbtn) => {
        rbtn.onclick = async () => {
          const bIdx = +rbtn.dataset.regenSeg;
          card.segments = ensureCardSegments(card, card.cast);
          const seg = card.segments[bIdx];
          if (!seg) return;
          W.activeSceneId = card.sceneId;
          await regenerateSingleBeat(seg.beatId, rbtn);
        };
      });
    }
    if (window.SCProto && typeof window.SCProto.syncBgmPlayButtons === 'function') {
      window.SCProto.syncBgmPlayButtons();
    }
  }

  // Step 1 -> Step 2 transition (`POST /api/studio/expand-script` + `POST /api/studio/projects/:pid/scenes`)
  async function generateScriptFromCardAndGoStep2(card, btnEl) {
    const p = getActiveProject();
    if (!p || !card) return;
    setBusyProgress(`正在根据大纲生成「${card.title}」台本…`, 'gen-single-act', btnEl);
    try {
      window.SCProto.toast(`⏳ 正在根据大纲生成「${card.title}」台本并执行 30 人 OOC 校验…`);
      const expRes = await fetch('/api/studio/expand-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline: card,
          depth: W.scriptDepth || 'standard',
          storyContext: buildStoryContinuityContext(card.sceneId),
          llmConfig: getLlmConfig()
        })
      });
      const expData = await expRes.json();
      if (!expData.ok) throw new Error(expData.error || '生成台本失败');
      updateGeneratorBadges(expData.generator, expData.generatorLabel, expData.llmWarning || null);

      invalidateQuietRecompile();
      delete card.preservePrecompiled;
      delete card.precompiledLines;
      delete card.scprojLines;
      const saveRes = await fetch(`/api/studio/projects/${encodeURIComponent(p.id)}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          regenerateScript: true,
          sceneId: card.sceneId,
          title: card.title,
          titleZh: card.title,
          bg: card.bg,
          bgm: card.bgm,
          bgmStyle: card.bgmStyle || '',
          cast: card.cast,
          summary: card.summary,
          segments: card.segments,
          beats: card.beats,
          scriptRows: expData.scriptRows
        })
      });
      const saveData = await saveRes.json();
      if (saveData.ok && Array.isArray(saveData.projects)) {
        W.projects = saveData.projects;
        W.activeSceneId = card.sceneId;
        renderSceneTree();
        const updatedP = getActiveProject();
        const updatedSc = getActiveScene();
        if (updatedP && updatedSc) {
          syncSceneIntoSCProto(updatedP, updatedSc);
        }
        window.SCProto.setMode('polish');
        if (expData.llmWarning) {
          window.SCProto.toast(`⚠️ AI 生成台本异常已回退本地模板：${expData.llmWarning}`, 'err');
        } else {
          window.SCProto.toast(
            `✅ [${expData.generatorLabel || 'AI'}] 已生成 ${expData.scriptRows.length} 行台本（30人OOC校验：${expData.oocSummary.pass}/${expData.oocSummary.total} 通过）！`
          );
        }
      }
    } catch (err) {
      window.SCProto.toast('✗ 生成台本失败：' + err.message, 'err');
    } finally {
      clearBusyProgress(btnEl);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2 -> Step 3 Preview Compiler (`POST /api/studio/preview-compile`, no disk write until 💾 保存)
  // ---------------------------------------------------------------------------
  async function compileCurrentSceneAndGoStep3(openInNewTab = false) {
    const p = getActiveProject();
    const sc = getActiveScene();
    if (!p || !sc) return;

    const scriptRows = extractScriptRowsFromProtoDoc();
    const castOutfits = { ...(sc.castOutfits || {}) };
    const P = window.SCProto;
    if (P && typeof P.getCurrentOutfitForChar === 'function') {
      for (const cid of (sc.cast || [])) {
        const oid = P.getCurrentOutfitForChar(cid);
        if (oid) castOutfits[cid] = oid;
      }
    }
    sc.castOutfits = castOutfits;
    delete sc.castHairs;
    try {
      if (isScenePrecompiled(sc)) {
        sc.preservePrecompiled = true;
        sc.scriptRows = scriptRows;
        sc.scproj = sc.scproj || {};
        if (P && P.S && P.S.doc && Array.isArray(P.S.doc.rows)) {
          sc.scproj.lines = P.S.doc.rows.map((r) => JSON.parse(JSON.stringify(r.line)));
        }
        if (W.isDirty || (P && P.S && P.S.isDirty)) {
          W.isDirty = true;
          W.dirtySceneIds.add(sc.id);
        }
        renderSceneTree();
        updateRealSpineIframe(sc.id);
        setStageViewMode('spine');
        window.SCProto.setMode('stage');
        if (typeof window.SCProto.syncLoadDocToSpineStage === 'function') {
          window.SCProto.syncLoadDocToSpineStage(false);
          window.SCProto.syncGotoLineToSpineStage(false);
        }
        if (openInNewTab) {
          await saveCurrentProjectExplicitly({ quiet: true });
          const openPid = resolveScenePlayerId(getActiveProject() || p, getActiveScene() || sc);
          window.open(`/player/?cat=custom&id=${encodeURIComponent(openPid)}`, '_blank');
        } else {
          window.SCProto.toast(`🎬 已无损同步「${sc.titleZh || sc.title}」预编译舞台演出并进入 Step 3（点右上「💾 保存」写入磁盘）`);
        }
        return;
      }

      window.SCProto.toast('🎬 正在生成 Step 3 舞台演出预览（内存预览，未写入磁盘）…');
      const res = await fetch('/api/studio/preview-compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: p.id,
          sceneId: sc.id,
          title: sc.title,
          titleZh: sc.titleZh || sc.title,
          bg: sc.bg || '',
          bgm: sc.bgm || '',
          bgmStyle: sc.bgmStyle || '',
          cast: sc.cast || [],
          castOutfits,
          summary: sc.summary || '',
          segments: sc.segments || [],
          beats: sc.beats || [],
          scriptRows
        })
      });
      const data = await res.json();
      if (!data.ok || !data.scproj) throw new Error(data.error || '预览编译失败');

      sc.scriptRows = scriptRows;
      sc.scproj = data.scproj;
      if (data.scproj.meta && data.scproj.meta['x-playerScriptId']) {
        sc.playerScriptId = data.scproj.meta['x-playerScriptId'];
      }
      if (W.isDirty || (P && P.S && P.S.isDirty)) {
        W.isDirty = true;
        W.dirtySceneIds.add(sc.id);
      }
      renderSceneTree();
      syncSceneIntoSCProto(p, sc);
      setStageViewMode('spine');
      window.SCProto.setMode('stage');
      if (typeof window.SCProto.syncLoadDocToSpineStage === 'function') {
        window.SCProto.syncLoadDocToSpineStage(false);
        window.SCProto.syncGotoLineToSpineStage(false);
      }

      if (openInNewTab) {
        await saveCurrentProjectExplicitly({ quiet: true });
        const openPid = resolveScenePlayerId(getActiveProject() || p, getActiveScene() || sc);
        window.open(`/player/?cat=custom&id=${encodeURIComponent(openPid)}`, '_blank');
      } else {
        window.SCProto.toast(`🎬 已生成「${sc.titleZh || sc.title}」舞台演出（进入 Step 3 微调，满意后点右上「💾 保存」写入磁盘）`);
      }
    } catch (err) {
      window.SCProto.toast('✗ 生成演出失败：' + err.message, 'err');
    }
  }

  // ---------------------------------------------------------------------------
  // Task 3 · 🎬 全工程多幕连播 (Full-Project Multi-Scene Continuous Playback)
  //       & 📥 导出全工程合并剧本 (.scproj.json)
  // ---------------------------------------------------------------------------
  function buildClientMergedScprojFallback(project) {
    const stories = project.stories || [];
    const mergedLines = [];
    const sceneRanges = [];
    stories.forEach((sc, idx) => {
      const startIndex = mergedLines.length;
      const titleZh = sc.titleZh || sc.title || sc.id;
      if (idx > 0) {
        const prevScene = stories[idx - 1];
        const prevCast = (prevScene && prevScene.cast) || [];
        prevCast.forEach((prevChar, pIdx) => {
          mergedLines.push({
            charLabel: prevChar,
            charScale: 1,
            charEffect: { type: 'to', alpha: 0, time: 180 },
            textFrame: 'off',
            waitType: 'time',
            waitTime: pIdx === prevCast.length - 1 ? 180 : 20,
            _meta: { uid: `trans_out_${idx}_${prevChar}`, 'x-sceneId': sc.id, 'x-sceneIndex': idx, 'x-isTransition': true, note: `幕间换场淡出：${prevChar}` }
          });
        });
        mergedLines.push({
          bgm: 'off',
          bg: 'off',
          bgEffect: 'fade_out',
          bgEffectTime: 420,
          fg: 'off',
          middleFg: 'off',
          textFrame: 'off',
          waitType: 'time',
          waitTime: 460,
          _meta: { uid: `tr_fade_${idx + 1}`, 'x-sceneId': sc.id, 'x-sceneIndex': idx, 'x-isTransitionCard': true }
        });
      }
      const locText = String(titleZh).replace(/^第\s*\d+\s*幕\s*[·・:：-]?\s*/, '').trim() || titleZh;
      const scBg = sc.bg ? String(sc.bg).padStart(5, '0') : undefined;
      const scBgm = sc.bgm || undefined;
      mergedLines.push({
        ...(scBg ? { bg: scBg, bgEffect: 'fade', bgEffectTime: 480 } : {}),
        ...(scBgm ? { bgm: scBgm } : {}),
        textFrame: 'off',
        locationBanner: locText,
        waitType: 'time',
        waitTime: 1600,
        _meta: {
          uid: `tr_title_${idx + 1}`,
          'x-locationBanner': locText,
          note: `📍 地点条划入划出：${locText}`,
          'x-sceneId': sc.id,
          'x-sceneIndex': idx,
          'x-isTransitionCard': true
        }
      });
      const scLines = (sc.scproj && Array.isArray(sc.scproj.lines)) ? sc.scproj.lines : [];
      scLines.forEach((ln, lIdx) => {
        if (lIdx === 0 && ln._meta && String(ln._meta.uid || '').startsWith('setup_bg')) return;
        if (idx < stories.length - 1 && lIdx === scLines.length - 1 && ln._meta && String(ln._meta.uid || '').startsWith('end_')) return;
        const copy = JSON.parse(JSON.stringify(ln));
        if (copy.label) copy.label = `s${idx + 1}_${copy.label}`;
        if (copy.nextLabel) copy.nextLabel = `s${idx + 1}_${copy.nextLabel}`;
        copy._meta = Object.assign({}, copy._meta || {}, {
          'x-sceneId': sc.id,
          'x-sceneIndex': idx,
          'x-sceneTitleZh': titleZh
        });
        mergedLines.push(copy);
      });
      sceneRanges.push({
        sceneId: sc.id,
        sceneIndex: idx,
        order: idx + 1,
        title: sc.title || titleZh,
        titleZh,
        startIndex,
        endIndex: mergedLines.length - 1,
        lineCount: mergedLines.length - startIndex
      });
    });
    return {
      ok: true,
      projectId: project.id,
      playerId: `${project.id}_full_all`,
      totalScenes: stories.length,
      totalLines: mergedLines.length,
      sceneRanges,
      mergedScproj: {
        $schema: '../../../schema/scproj.schema.json',
        format: 'scproj',
        formatVersion: 2,
        meta: {
          id: `${project.id}_full_all`,
          title: `${project.nameZh || project.name}（全工程 ${stories.length} 幕连播版）`,
          titleZh: `${project.nameZh || project.name}（全工程 ${stories.length} 幕连播版）`,
          'x-sceneRanges': sceneRanges
        },
        lines: mergedLines
      }
    };
  }

  async function fetchOrCompileMergedProject(project) {
    // First sync current active scene's edits into memory so compile-all uses latest scriptRows
    const curSc = getActiveScene();
    const curRows = extractScriptRowsFromProtoDoc();
    const scenesPayload = (project.stories || []).map((s) => {
      if (curSc && s.id === curSc.id && curRows.length) {
        return Object.assign({}, s, { scriptRows: curRows });
      }
      return s;
    });
    try {
      const res = await fetch(`/api/studio/projects/${encodeURIComponent(project.id)}/compile-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: scenesPayload })
      });
      const data = await res.json();
      if (data && data.ok && data.mergedScproj) return data;
    } catch (_) {}
    return buildClientMergedScprojFallback(project);
  }

  function renderMultiScenePlayBanner() {
    const banner = $('#multiScenePlayBanner');
    if (!banner) return;
    const st = W.playAllState;
    if (!st || !st.active) {
      banner.hidden = true;
      banner.innerHTML = '';
      return;
    }
    banner.hidden = false;
    const ranges = st.sceneRanges || [];
    const curRange = ranges.find((r) => r.sceneId === st.currentSceneId) || ranges[0] || {};
    banner.innerHTML = `
      <div class="row-flex" style="gap:6px">
        <span class="sc-idx-pill" style="background:#10b981">🎬 全工程连播中</span>
        <b>正在播放：第 ${curRange.order || 1} 幕 · ${esc(curRange.titleZh || curRange.title || '')}</b>
        <span class="muted" style="font-size:11px">（共 ${st.totalScenes} 幕 / ${st.totalLines} 行 · 含黑场转场标题卡）</span>
      </div>
      <div class="row-flex" style="gap:4px">
        ${ranges
          .map(
            (r) =>
              `<button type="button" class="chip-btn ${r.sceneId === st.currentSceneId ? 'prismy' : ''}" data-playall-jump="${esc(
                r.sceneId
              )}" title="跳至第 ${r.order} 幕开头（行 #${r.startIndex + 1}）继续连播">第 ${r.order} 幕</button>`
          )
          .join('')}
        <a class="chip-btn" href="/player/?cat=custom&id=${encodeURIComponent(st.playerId)}" target="_blank" style="text-decoration:none" title="在独立全屏窗口打开全工程合并版">↗ 独立窗口打开</a>
        <button type="button" class="chip-btn" id="btnStopPlayAll" title="停止全工程多幕连播并返回单幕编辑">■ 停止连播</button>
      </div>
    `;
    $$('[data-playall-jump]', banner).forEach((btn) => {
      btn.onclick = () => jumpToSceneInPlayAll(btn.dataset.playallJump);
    });
    const stopBtn = $('#btnStopPlayAll', banner);
    if (stopBtn) {
      stopBtn.onclick = () => stopPlayAllScenes(true);
    }
  }

  function stopPlayAllScenes(showToast = true) {
    if (W.playAllState && W.playAllState.timer) {
      clearInterval(W.playAllState.timer);
    }
    const wasActive = Boolean(W.playAllState && W.playAllState.active);
    W.playAllState = null;
    renderMultiScenePlayBanner();
    renderSceneTree();
    if (wasActive && showToast && window.SCProto && window.SCProto.toast) {
      window.SCProto.toast('■ 已结束全工程多幕连播');
    }
  }

  function jumpToSceneInPlayAll(sceneId) {
    const st = W.playAllState;
    if (!st || !st.active) return;
    const r = (st.sceneRanges || []).find((x) => x.sceneId === sceneId);
    if (!r) return;
    st.currentSceneId = r.sceneId;
    st.currentLineEstimate = r.startIndex;
    W.activeSceneId = r.sceneId;
    renderMultiScenePlayBanner();
    renderSceneTree();
    if (window.SCProto && typeof window.SCProto.postToSpineStage === 'function') {
      window.SCProto.postToSpineStage({
        type: 'sc-studio:load-doc',
        lines: st.mergedScproj.lines,
        index: r.startIndex,
        play: true
      });
      window.SCProto.postToSpineStage({
        type: 'sc-studio:goto-line',
        index: r.startIndex,
        play: true
      });
    }
    if (window.SCProto && window.SCProto.toast) {
      window.SCProto.toast(`🎬 全工程连播跳至：第 ${r.order} 幕 · ${r.titleZh}`);
    }
  }

  async function playAllProjectScenes() {
    const p = getActiveProject();
    if (!p) return;
    const P = window.SCProto;
    try {
      if (P && P.toast) P.toast('🎬 正在合并编译全工程多幕剧本并插入黑场转场标题卡…');
      const data = await fetchOrCompileMergedProject(p);
      const mergedScproj = data.mergedScproj;
      const sceneRanges = data.sceneRanges || [];
      if (!mergedScproj || !Array.isArray(mergedScproj.lines) || !mergedScproj.lines.length) {
        throw new Error('合并后的剧本为空');
      }

      if (W.playAllState && W.playAllState.timer) {
        clearInterval(W.playAllState.timer);
      }

      const firstSid = (sceneRanges[0] && sceneRanges[0].sceneId) || W.activeSceneId;
      W.playAllState = {
        active: true,
        playerId: data.playerId || `${p.id}_full_all`,
        mergedScproj,
        sceneRanges,
        totalScenes: data.totalScenes || sceneRanges.length,
        totalLines: data.totalLines || mergedScproj.lines.length,
        currentSceneId: firstSid,
        currentLineEstimate: 0,
        timer: null
      };

      setStageViewMode('spine');
      if (P && typeof P.setMode === 'function') {
        P.setMode('stage');
      }

      // Send the combined multi-scene sequence directly to #realSpineIframe via sc-studio:load-doc with play: true
      const sendPlayAllToIframe = () => {
        if (P && typeof P.postToSpineStage === 'function') {
          P.postToSpineStage({
            type: 'sc-studio:load-doc',
            lines: mergedScproj.lines,
            index: 0,
            play: true,
            auto: true
          });
        } else {
          const ifr = $('#realSpineIframe');
          if (ifr && ifr.contentWindow) {
            ifr.contentWindow.postMessage(
              { type: 'sc-studio:load-doc', lines: mergedScproj.lines, index: 0, play: true, auto: true },
              '*'
            );
          }
        }
      };
      sendPlayAllToIframe();
      setTimeout(sendPlayAllToIframe, 380);

      // Update left scene list & banner to highlight the active scene as playback progresses
      renderMultiScenePlayBanner();
      renderSceneTree();

      W.playAllState.timer = setInterval(() => {
        const st = W.playAllState;
        if (!st || !st.active) return;
        st.currentLineEstimate = (st.currentLineEstimate + 1) % Math.max(1, st.totalLines);
        const matched = (st.sceneRanges || []).find(
          (r) => st.currentLineEstimate >= r.startIndex && st.currentLineEstimate <= r.endIndex
        );
        if (matched && matched.sceneId !== st.currentSceneId) {
          st.currentSceneId = matched.sceneId;
          W.activeSceneId = matched.sceneId;
          renderMultiScenePlayBanner();
          renderSceneTree();
          if (P && P.toast) {
            P.toast(`🎬 全工程连播进入：第 ${matched.order} 幕 · ${matched.titleZh}`);
          }
        }
      }, 3200);

      if (P && P.toast) {
        P.toast(
          `🎬 已启动全工程 ${sceneRanges.length} 幕连播（共 ${mergedScproj.lines.length} 行，自动带黑场转场标题卡）！`
        );
      }
    } catch (err) {
      if (P && P.toast) P.toast('✗ 全工程连播启动失败：' + err.message, 'err');
    }
  }

  async function exportMergedProjectScproj() {
    const p = getActiveProject();
    if (!p) return;
    const P = window.SCProto;
    try {
      if (P && P.toast) P.toast('📥 正在打包全工程合并剧本 (.scproj.json)…');
      const data = await fetchOrCompileMergedProject(p);
      const mergedScproj = data.mergedScproj;
      const filename = `${p.id}_full.scproj.json`;
      const jsonText = JSON.stringify(mergedScproj, null, 2);

      // Trigger browser file download
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 250);

      const playerUrl = `/player/?cat=custom&id=${encodeURIComponent(data.playerId || p.id + '_full_all')}`;
      if (P && typeof P.openModal === 'function') {
        P.openModal(
          `
          <div class="modal-head">
            <h2>📥 全工程合并剧本已导出 (${esc(filename)})</h2>
            <span class="grow"></span>
            <button class="ibtn" data-close>✕</button>
          </div>
          <div class="modal-body">
            <div class="callout info">
              ✅ 已将 <b>${esc(p.nameZh || p.name)}</b> 的全部 <b>${data.totalScenes} 幕场景</b>（共 <b>${
            data.totalLines
          } 行演出指令</b>，含幕间黑场淡出与标题转场卡）合并导出为 <code>${esc(filename)}</code>，并已同步注册至本地 <code>:18899</code> 播放器！
            </div>
            <div class="card">
              <div class="sec-title">🎬 分幕章节索引 (Scene Ranges)</div>
              <ul class="check-list">
                ${(data.sceneRanges || [])
                  .map(
                    (r) =>
                      `<li><span class="ok">✓</span> <b>第 ${r.order} 幕 · ${esc(r.titleZh)}</b> <span class="muted">（行 #${
                        r.startIndex + 1
                      } ~ #${r.endIndex + 1} · 共 ${r.lineCount} 行）</span></li>`
                  )
                  .join('')}
              </ul>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn ghost" data-close>关闭</button>
            <a class="btn prism" href="${esc(playerUrl)}" target="_blank" style="text-decoration:none">🚀 在 :18899 独立窗口打开/录制全工程视频</a>
          </div>
        `
        );
      } else if (P && P.toast) {
        P.toast(`✓ 已下载 ${filename}（共 ${data.totalScenes} 幕 / ${data.totalLines} 行）`);
      }
    } catch (err) {
      if (P && P.toast) P.toast('✗ 导出合并剧本失败：' + err.message, 'err');
    }
  }

  // ---------------------------------------------------------------------------
  // Task 4 · 🔌 3-Way Independent AI + TTS Gateway Settings Modal
  // ---------------------------------------------------------------------------
  function openLlmSettingsModal(initialTab = 'llm') {
    const P = window.SCProto;
    if (!P || typeof P.openModal !== 'function') return;
    const bundle = getAiTtsBundle();
    const serverLlm = getActiveServerLlmInfo();
    const modelPresets = [
      { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
      { id: 'gpt-4o', label: 'OpenAI GPT-4o', baseUrl: 'https://api.openai.com/v1' },
      { id: 'deepseek-chat', label: 'DeepSeek-V3 (deepseek-chat)', baseUrl: 'https://api.deepseek.com/v1' },
      { id: 'deepseek-reasoner', label: 'DeepSeek-R1 (deepseek-reasoner)', baseUrl: 'https://api.deepseek.com/v1' }
    ];
    const rolesMeta = [
      { role: 'story', title: '📝 生文与台本大模型', hint: '负责 Step 1 脑洞大纲、Step 2 对话扩写与人设润色（留空 API Key 时使用本地 0-OOC 模板）。', allowInherit: false },
      { role: 'stage', title: '🎬 剧情分镜与演出大模型', hint: '负责镜头节奏、情绪编排与舞台调度建议（可独立配置低延迟或推理模型）。', allowInherit: true },
      { role: 'agent', title: '🤖 全局 AI 导演助手', hint: '驱动全局侧滑「导演助手」与独立助手窗口执行补丁排查。', allowInherit: true }
    ];
    const ttsProviders = [
      { id: 'off', label: '关闭外部 TTS（仅使用原版声优短句 / 本地导入音频）', defEndpoint: '', defModel: '', defFormat: 'wav' },
      { id: 'cloud_fish', label: '🐟 Fish Audio 云端角色语音（内置 30 人声线与读音词典）', defEndpoint: 'https://api.fish.audio', defModel: 'drama-3', defFormat: 'mp3' },
      { id: 'local_irodori', label: '本地 Irodori-TTS (:8088)', defEndpoint: 'http://127.0.0.1:8088', defModel: 'irodori-v1', defFormat: 'wav' },
      { id: 'local_gptsovits', label: '本地 GPT-SoVITS (:9880)', defEndpoint: 'http://127.0.0.1:9880', defModel: 'gptsovits', defFormat: 'wav' },
      { id: 'local_voicevox', label: '本地 VOICEVOX Engine (:50021)', defEndpoint: 'http://127.0.0.1:50021', defModel: 'voicevox', defFormat: 'wav' },
      { id: 'cloud_openai', label: '线上 OpenAI / 兼容语音 API (/v1/audio/speech)', defEndpoint: 'https://api.openai.com/v1', defModel: 'gpt-4o-mini-tts', defFormat: 'mp3' },
      { id: 'custom_webhook', label: '自定义 HTTP Webhook POST 接口', defEndpoint: 'http://127.0.0.1:9000/tts', defModel: 'custom', defFormat: 'wav' }
    ];
    const fishModelPresets = ['drama-3', 's1', 'speech-1.6'];

    const renderProfileCard = (rm) => {
      const cfg = bundle[rm.role] || defaultLlmProfile();
      const inh = rm.allowInherit && cfg.inheritStory !== false;
      const displayModel = (!cfg.apiKey && serverLlm && serverLlm.model) ? serverLlm.model : (cfg.model || '');
      return `<div class="ai-profile-card" data-role-card="${rm.role}">
        <div class="row-flex" style="justify-content:space-between;gap:6px">
          <b>${rm.title}</b>
          ${rm.allowInherit ? `<label class="toggle" style="font-size:11px"><input type="checkbox" data-role-inherit="${rm.role}" ${inh ? 'checked' : ''}><span class="tr"></span>沿用生文模型</label>` : ''}
        </div>
        <div class="muted" style="font-size:11px;line-height:1.4">${rm.hint}</div>
        <div data-role-fields="${rm.role}" ${inh ? 'hidden' : ''} style="display:flex;flex-direction:column;gap:6px">
          <label class="fld"><span>API Base URL</span><input type="text" data-role-url="${rm.role}" value="${esc(cfg.baseUrl || '')}" placeholder="https://generativelanguage.googleapis.com/v1beta/openai" /></label>
          <label class="fld"><span>API Key</span><input type="password" data-role-key="${rm.role}" value="${esc(cfg.apiKey || '')}" placeholder="${serverLlm ? '留空即直接使用服务器托管 Gemini' : 'AIza... 或 sk-...（留空使用本地引擎）'}" autocomplete="off" /></label>
          <label class="fld"><span>模型 (Model)</span><input type="text" data-role-model="${rm.role}" value="${esc(displayModel)}" placeholder="gemini-2.5-flash" /></label>
          <div class="chips" style="margin-top:2px">
            ${modelPresets.map((mp) => `<button type="button" class="chip ${displayModel === mp.id ? 'on' : ''}" data-role-preset="${rm.role}" data-p-model="${esc(mp.id)}" data-p-url="${esc(mp.baseUrl)}">${esc(mp.label)}</button>`).join('')}
          </div>
          <div class="row-flex" style="justify-content:flex-end;gap:6px">
            <button type="button" class="chip-btn" data-role-test="${rm.role}">🧪 测试连接</button>
          </div>
        </div>
      </div>`;
    };

    const activeTab = initialTab === 'tts' ? 'tts' : 'llm';
    const ttsCur = bundle.tts || defaultTtsConfig();

    P.openModal(
      `
      <div class="modal-head">
        <h2>🔌 接口与语音设置（三路大模型 + 本地 / 线上 TTS 网关）</h2>
        <span class="grow"></span>
        <button class="ibtn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-tabs" id="aiTtsModalTabs">
          <button type="button" class="modal-tab-btn ${activeTab === 'llm' ? 'active' : ''}" data-mtab="llm">🤖 三路独立大模型 (生文 / 演出 / 助手)</button>
          <button type="button" class="modal-tab-btn ${activeTab === 'tts' ? 'active' : ''}" data-mtab="tts">🎙 TTS 语音合成接口 (本地 / 云端)</button>
        </div>
        <div id="mtabLlm" ${activeTab === 'llm' ? '' : 'hidden'}>
          ${serverLlm ? `<div class="callout info" style="margin-bottom:8px;border-color:rgba(16,185,129,.45);background:rgba(16,185,129,.09)">
            ☁ 当前账号已解锁服务器托管 Gemini：<b>${esc(serverLlm.model || 'gemini')}</b>（下方 API Key 留空即可直接调用；若填写个人 Key 则优先使用个人配置）。
          </div>` : ''}
          <div class="callout info" style="margin-bottom:10px">
            🔒 凭据仅存于浏览器本机 <code>localStorage</code>，支持分别指定「生文」「演出」「导演助手」三套独立端点，或让演出/助手一键沿用生文模型。
          </div>
          <div class="ai-profile-grid">
            ${rolesMeta.map(renderProfileCard).join('')}
          </div>
        </div>
        <div id="mtabTts" ${activeTab === 'tts' ? '' : 'hidden'}>
          <div class="callout info" style="margin-bottom:10px">
            🎙 统一网关 <code>POST /api/studio/tts/synthesize</code> 已内置 <b>Fish Audio</b> 30 人角色声线表与专有名词读音词典；请填写个人 API Key 或配置本地托管凭据，Step 2 每句右侧与工具栏可直接点击试听。
          </div>
          <label class="fld">
            <span>语音服务提供方 (Provider)</span>
            <select id="ttsProviderSel">
              ${ttsProviders.map((tp) => `<option value="${esc(tp.id)}" ${ttsCur.provider === tp.id ? 'selected' : ''}>${esc(tp.label)}</option>`).join('')}
            </select>
          </label>
          <div class="grid2" style="gap:8px;margin-top:8px">
            <label class="fld">
              <span>服务地址 Endpoint URL</span>
              <input type="text" id="ttsEndpointInp" value="${esc(ttsCur.endpoint || '')}" placeholder="https://api.fish.audio" />
            </label>
            <label class="fld">
              <span>API Key / Bearer Token（选 Fish Audio 时支持自动读取本地托管 Key）</span>
              <input type="password" id="ttsApiKeyInp" value="${esc(ttsCur.apiKey || '')}" placeholder="留空自动使用本机托管 Key（如有）" autocomplete="off" />
            </label>
            <label class="fld">
              <span>模型 / 音色 Preset</span>
              <input type="text" id="ttsModelInp" value="${esc(ttsCur.model || 'drama-3')}" placeholder="drama-3" />
              <div class="chips" style="margin-top:4px">
                ${fishModelPresets.map((fm) => `<button type="button" class="chip ${ttsCur.model === fm ? 'on' : ''}" data-tts-model-chip="${esc(fm)}">${esc(fm)}</button>`).join('')}
              </div>
            </label>
            <label class="fld">
              <span>输出格式</span>
              <select id="ttsFormatInp">
                <option value="mp3" ${ttsCur.format === 'mp3' ? 'selected' : ''}>mp3（Fish Audio / 浏览器试听推荐）</option>
                <option value="wav" ${ttsCur.format === 'wav' ? 'selected' : ''}>wav（无损格式）</option>
              </select>
            </label>
          </div>
          <label class="fld" style="margin-top:8px">
            <span>自定义角色声线映射表 JSON（可选，Fish Audio 已内置 28 偶像 + 羽月默认音色）</span>
            <textarea id="ttsVoiceMapInp" rows="2" placeholder='{"fuyuko": "105efba2160a40119d6d21e5445b889e"}'>${esc(ttsCur.voiceMapText || '')}</textarea>
          </label>
          <div class="row-flex" style="margin-top:8px;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn ghost" id="btnSyncEidolonFish">📥 读取本地 Fish 预设配置</button>
            <button type="button" class="btn ghost" id="btnTtsHealth">🩺 检测 TTS 服务连通性</button>
            <button type="button" class="btn ghost" id="btnTtsSample">🔊 试听一句合成效果 (冬优子)</button>
          </div>
        </div>
        <div id="llmTestStatusBox" class="callout info" style="margin-top:10px" hidden></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn ghost" id="btnClearLlmKey">🧹 清空全部 Key (切回本地默认)</button>
        <span class="grow"></span>
        <button type="button" class="btn ghost" data-close>取消</button>
        <button type="button" class="btn prism" id="btnSaveLlmCfg">💾 保存接口与语音配置</button>
      </div>
    `,
      (m) => {
        const statusBox = $('#llmTestStatusBox', m);
        $$('#aiTtsModalTabs .modal-tab-btn', m).forEach((btn) => {
          btn.onclick = () => {
            const target = btn.dataset.mtab;
            $$('#aiTtsModalTabs .modal-tab-btn', m).forEach((b) => b.classList.toggle('active', b === btn));
            $('#mtabLlm', m).hidden = target !== 'llm';
            $('#mtabTts', m).hidden = target !== 'tts';
          };
        });

        $$('[data-role-inherit]', m).forEach((chk) => {
          chk.onchange = () => {
            const role = chk.dataset.roleInherit;
            const fields = $(`[data-role-fields="${role}"]`, m);
            if (fields) fields.hidden = chk.checked;
          };
        });

        $$('[data-role-preset]', m).forEach((btn) => {
          btn.onclick = () => {
            const role = btn.dataset.rolePreset;
            const u = $(`[data-role-url="${role}"]`, m);
            const md = $(`[data-role-model="${role}"]`, m);
            if (md) md.value = btn.dataset.pModel;
            if (u && btn.dataset.pUrl) u.value = btn.dataset.pUrl;
            $$(`[data-role-preset="${role}"]`, m).forEach((b) => b.classList.toggle('on', b === btn));
          };
        });

        const collectRoleCfg = (role) => {
          const inhChk = $(`[data-role-inherit="${role}"]`, m);
          return {
            baseUrl: ($(`[data-role-url="${role}"]`, m)?.value || '').trim(),
            apiKey: ($(`[data-role-key="${role}"]`, m)?.value || '').trim(),
            model: ($(`[data-role-model="${role}"]`, m)?.value || '').trim(),
            ...(role !== 'story' ? { inheritStory: inhChk ? inhChk.checked : true } : {})
          };
        };

        const collectTtsCfg = () => {
          const voiceMapText = ($('#ttsVoiceMapInp', m)?.value || '').trim();
          let voiceMap = {};
          if (voiceMapText) {
            try { voiceMap = JSON.parse(voiceMapText); } catch (_) {}
          }
          const prov = ($('#ttsProviderSel', m)?.value || 'cloud_fish').trim();
          return {
            provider: prov,
            endpoint: ($('#ttsEndpointInp', m)?.value || '').trim(),
            apiKey: ($('#ttsApiKeyInp', m)?.value || '').trim(),
            model: ($('#ttsModelInp', m)?.value || (prov === 'cloud_fish' ? 'drama-3' : 'gpt-4o-mini-tts')).trim(),
            format: ($('#ttsFormatInp', m)?.value || (prov === 'cloud_fish' ? 'mp3' : 'wav')).trim(),
            voiceMapText,
            voiceMap,
            explicitOff: prov === 'off'
          };
        };

        const provSel = $('#ttsProviderSel', m);
        const epInp = $('#ttsEndpointInp', m);
        const mdlInp = $('#ttsModelInp', m);
        const fmtInp = $('#ttsFormatInp', m);
        if (provSel && epInp) {
          provSel.onchange = () => {
            const hit = ttsProviders.find((tp) => tp.id === provSel.value);
            if (hit && hit.defEndpoint !== undefined) epInp.value = hit.defEndpoint;
            if (hit && hit.defModel && mdlInp) mdlInp.value = hit.defModel;
            if (hit && hit.defFormat && fmtInp) fmtInp.value = hit.defFormat;
            $$('[data-tts-model-chip]', m).forEach((b) => b.classList.toggle('on', mdlInp && b.dataset.ttsModelChip === mdlInp.value));
          };
        }
        $$('[data-tts-model-chip]', m).forEach((btn) => {
          btn.onclick = () => {
            if (mdlInp) mdlInp.value = btn.dataset.ttsModelChip || 'drama-3';
            $$('[data-tts-model-chip]', m).forEach((b) => b.classList.toggle('on', b === btn));
          };
        });
        const syncFishBtn = $('#btnSyncEidolonFish', m);
        if (syncFishBtn) {
          syncFishBtn.onclick = async () => {
            syncFishBtn.disabled = true;
            statusBox.hidden = false;
            statusBox.className = 'callout info';
            statusBox.textContent = '⏳ 正在读取本地 Fish Audio 角色声线、读音词典与配置…';
            try {
              const res = await fetch('/api/studio/tts/eidolon-preset?refresh=1');
              const data = await res.json();
              if (!res.ok || !data || !data.ok) {
                throw new Error((data && data.error) || '读取失败');
              }
              W.eidolonFishPreset = data;
              if (provSel) provSel.value = 'cloud_fish';
              if (epInp) epInp.value = data.endpoint || 'https://api.fish.audio';
              if (mdlInp) mdlInp.value = data.defaultModel || 'drama-3';
              if (fmtInp) fmtInp.value = 'mp3';
              $$('[data-tts-model-chip]', m).forEach((b) => b.classList.toggle('on', mdlInp && b.dataset.ttsModelChip === mdlInp.value));
              statusBox.className = data.hasLocalKey ? 'callout info' : 'callout warn';
              statusBox.textContent = data.hasLocalKey
                ? `✅ 已同步本地 Fish 配置：模型 ${data.defaultModel} · ${data.voiceCount} 个角色声线 · ${data.readingsCount} 条读音词典 · 已托管本机 API Key（留空即可直接使用）。`
                : `⚠️ 已加载 ${data.voiceCount} 个角色声线与 ${data.readingsCount} 条读音词典，但未在本机检测到 Fish API Key，请在上方手动填写。`;
            } catch (err) {
              statusBox.className = 'callout warn';
              statusBox.textContent = '✗ 读取本地 Fish 配置失败：' + err.message;
            } finally {
              syncFishBtn.disabled = false;
            }
          };
        }

        $$('[data-role-test]', m).forEach((btn) => {
          btn.onclick = async () => {
            const role = btn.dataset.roleTest;
            const cfg = collectRoleCfg(role);
            statusBox.hidden = false;
            statusBox.className = 'callout info';
            const useServerHosted = !cfg.apiKey && serverLlm;
            statusBox.textContent = useServerHosted
              ? `⏳ 正在通过服务器托管 Gemini 测试 [${role}] (${serverLlm.model || 'gemini'})…`
              : `⏳ 正在测试 [${role}] ${cfg.baseUrl || '默认端点'} (${cfg.model || '自动'})…`;
            btn.disabled = true;
            try {
              const res = await fetch('/api/studio/test-llm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ llmConfig: cfg })
              });
              const data = await res.json();
              if (data.ok) {
                statusBox.className = 'callout info';
                statusBox.innerHTML = `✅ <b>[${esc(role)}] 连接成功！</b> 模型：<code>${esc(data.model)}</code> · <b>${data.latencyMs}ms</b>`;
              } else {
                statusBox.className = 'callout warn';
                statusBox.textContent = `⚠️ [${role}] 连接未通过：${data.error || '请检查 URL 与 Key'}`;
              }
            } catch (err) {
              statusBox.className = 'callout warn';
              statusBox.textContent = `✗ [${role}] 请求失败：` + err.message;
            } finally {
              btn.disabled = false;
            }
          };
        });

        const ttsHealthBtn = $('#btnTtsHealth', m);
        if (ttsHealthBtn) {
          ttsHealthBtn.onclick = async () => {
            const tc = collectTtsCfg();
            statusBox.hidden = false;
            statusBox.className = 'callout info';
            statusBox.textContent = `⏳ 正在检测 TTS 服务 (${tc.provider} · ${tc.endpoint || '无'})…`;
            ttsHealthBtn.disabled = true;
            try {
              const res = await fetch('/api/studio/tts/health', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ttsConfig: tc })
              });
              const data = await res.json();
              statusBox.className = data.ok ? 'callout info' : 'callout warn';
              statusBox.textContent = `${data.ok ? '✅' : '⚠️'} [${data.provider || tc.provider}] ${data.detail || data.status || '检测完成'}`;
            } catch (err) {
              statusBox.className = 'callout warn';
              statusBox.textContent = '✗ 检测失败：' + err.message;
            } finally {
              ttsHealthBtn.disabled = false;
            }
          };
        }

        const ttsSampleBtn = $('#btnTtsSample', m);
        if (ttsSampleBtn) {
          ttsSampleBtn.onclick = async () => {
            const tc = collectTtsCfg();
            statusBox.hidden = false;
            statusBox.className = 'callout info';
            statusBox.textContent = `⏳ 正在请求合成试听 (${tc.provider})…`;
            ttsSampleBtn.disabled = true;
            try {
              const res = await fetch('/api/studio/tts/synthesize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: 'プロデューサーさん、準備はバッチリですわ！',
                  charLabel: 'fuyuko',
                  ttsConfig: tc
                })
              });
              const data = await res.json();
              if (data.ok && data.audioUrl) {
                statusBox.className = 'callout info';
                statusBox.textContent = `✅ 合成成功！正在播放：${data.audioUrl}`;
                new Audio(data.audioUrl).play().catch(() => {});
              } else {
                statusBox.className = 'callout warn';
                statusBox.textContent = `⚠️ 合成失败：${data.error || data.detail || '请检查 TTS 服务配置'}`;
              }
            } catch (err) {
              statusBox.className = 'callout warn';
              statusBox.textContent = '✗ 合成请求失败：' + err.message;
            } finally {
              ttsSampleBtn.disabled = false;
            }
          };
        }

        const clearBtn = $('#btnClearLlmKey', m);
        if (clearBtn) {
          clearBtn.onclick = () => {
            saveAiTtsBundle({
              story: { ...collectRoleCfg('story'), apiKey: '' },
              stage: { ...collectRoleCfg('stage'), apiKey: '', inheritStory: true },
              agent: { ...collectRoleCfg('agent'), apiKey: '', inheritStory: true },
              tts: { ...collectTtsCfg(), apiKey: '' }
            });
            updateGeneratorBadges('', '', null);
            P.closeModal();
            if (P.S && P.S.mode === 'muse') renderStep1OutlinePanel($('#musePanel'));
            P.toast(serverLlm ? `☁ 已清空个人 Key，恢复使用服务器 Gemini (${serverLlm.model || 'gemini'})` : '⚡ 已清空全部 API Key，生文恢复本地 0-OOC 模板引擎');
          };
        }

        const saveBtn = $('#btnSaveLlmCfg', m);
        if (saveBtn) {
          saveBtn.onclick = () => {
            saveAiTtsBundle({
              story: collectRoleCfg('story'),
              stage: collectRoleCfg('stage'),
              agent: collectRoleCfg('agent'),
              tts: collectTtsCfg()
            });
            updateGeneratorBadges('', '', null);
            P.closeModal();
            if (P.S && P.S.mode === 'muse') renderStep1OutlinePanel($('#musePanel'));
            if (typeof P.renderInspector === 'function') P.renderInspector();
            P.toast('🔌 已保存三路大模型与 TTS 语音接口配置');
          };
        }
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Modal: 📥 导入外部剧本 (Zero-Token Import: External Fan-Player JSON / scproj / Outline / Text)
  // ---------------------------------------------------------------------------
  function openImportExternalScriptModal(projectObj) {
    const P = window.SCProto;
    const p = projectObj || getActiveProject();
    if (!P || !P.openModal || !p) return;

    let selectedFileBaseName = '';

    P.openModal(
      `
      <div class="modal-head">
        <h2>📥 导入外部剧本（免 AI 费 · 自动转换）</h2>
        <span class="grow"></span>
        <button class="ibtn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <div class="callout info" style="margin-bottom:10px">
          ✅ 零 AI 消耗，支持直接读取以下 4 种格式：<br>
          1. <b>外部剧场 JSON</b>（如含 <code>bg.src</code>、<code>chars.left/right</code>、<code>trans</code> 的 <code>[{...}]</code> 剧本，自动映射 5 位背景、Spine 服装与同台站位）<br>
          2. <b>标准 <code>.scproj.json</code></b> / <b>外部分幕大纲 JSON</b>（<code>{ scenes: [...] }</code>）<br>
          3. <b>外部对话文本 / Markdown</b>（如 ChatGPT/Gemini 网页版生成的 <code># 第1幕</code> + <code>美琴：……</code>）
        </div>
        <div class="row-flex" style="gap:8px;align-items:center;margin-bottom:8px">
          <button type="button" class="btn ghost" id="btnPickExtFile">📂 选择本地文件 (.json / .txt / .md)</button>
          <span class="muted" id="extFileNameLbl" style="font-size:12px">或直接在下方粘贴剧本内容：</span>
          <input type="file" id="extFileInput" accept=".json,.txt,.md,application/json,text/plain" hidden />
        </div>
        <textarea id="extScriptInput" rows="10" style="width:100%;font-family:monospace;font-size:12px" placeholder="粘贴外部 JSON 或对话文本，例如：
# 第1幕 · 圣诞夜的咖啡店（背景：00226）
美琴：……六点四十。晚了十分钟。
日花：美琴小姐！对、对不起……！"></textarea>
        <div id="extParsePreview" class="callout info" style="margin-top:8px;font-size:12px" hidden></div>
        <label class="toggle" style="margin-top:8px;font-size:12px">
          <input type="checkbox" id="extJumpStep2" checked />
          <span class="tr"></span>
          <span>导入后直接切换到 Step 2 舞台预览与精修</span>
        </label>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" data-close>取消</button>
        <button class="btn prism" id="btnConfirmExtImport" disabled>✅ 写入当前工程「${esc(p.nameZh || p.name)}」</button>
      </div>
    `,
      (m) => {
        const fileInp = $('#extFileInput', m);
        const pickBtn = $('#btnPickExtFile', m);
        const fileLbl = $('#extFileNameLbl', m);
        const txtArea = $('#extScriptInput', m);
        const previewBox = $('#extParsePreview', m);
        const jumpChk = $('#extJumpStep2', m);
        const confirmBtn = $('#btnConfirmExtImport', m);

        const refreshPreview = () => {
          const val = (txtArea.value || '').trim();
          if (!val) {
            previewBox.hidden = true;
            confirmBtn.disabled = true;
            return;
          }
          const adapter = window.SCExternalScriptAdapter;
          if (!adapter || typeof adapter.parseExternalInput !== 'function') {
            previewBox.hidden = false;
            previewBox.className = 'callout warn';
            previewBox.textContent = '⚠️ 前端适配器未加载，请刷新页面重试';
            confirmBtn.disabled = true;
            return;
          }
          const parsed = adapter.parseExternalInput(val, { fileBaseName: selectedFileBaseName });
          previewBox.hidden = false;
          if (!parsed || !parsed.ok) {
            previewBox.className = 'callout warn';
            previewBox.textContent = '⚠️ ' + ((parsed && parsed.error) || '无法识别格式');
            confirmBtn.disabled = true;
            return;
          }
          previewBox.className = 'callout info';
          const st = parsed.stats || {};
          const castNames = (parsed.cast || []).map((c) => (W.idolMeta[c] ? W.idolMeta[c].nameZh : c)).join('、') || '无指定偶像';
          previewBox.innerHTML = `🔍 已识别为：<b>${esc(parsed.formatLabel)}</b> · <b>${st.sceneCount || 1} 幕</b> · <b>${st.lineCount || 0} 条指令</b>（背景 ${st.bgCount || 1} 张）<br>👥 识别角色：<b>${esc(castNames)}</b><br><span class="muted">${esc((parsed.premise || '').slice(0, 120))}</span>`;
          if (parsed.format === 'outline_json' || parsed.format === 'plain_text') {
            jumpChk.checked = parsed.format === 'plain_text';
          } else {
            jumpChk.checked = true;
          }
          confirmBtn.disabled = false;
        };

        if (pickBtn && fileInp) {
          pickBtn.onclick = () => fileInp.click();
          fileInp.onchange = () => {
            const f = fileInp.files && fileInp.files[0];
            if (!f) return;
            selectedFileBaseName = f.name.replace(/\.[^.]+$/, '');
            if (fileLbl) fileLbl.textContent = `📄 ${f.name} (${Math.round(f.size / 1024)} KB)`;
            f.text().then((content) => {
              txtArea.value = content;
              refreshPreview();
            });
          };
        }

        if (txtArea) {
          txtArea.oninput = refreshPreview;
        }

        if (confirmBtn) {
          confirmBtn.onclick = async () => {
            const raw = (txtArea.value || '').trim();
            if (!raw) return;
            confirmBtn.disabled = true;
            confirmBtn.textContent = '⏳ 正在转换并保存…';
            try {
              const res = await fetch(`/api/studio/projects/${encodeURIComponent(p.id)}/import-external`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content: raw,
                  fileBaseName: selectedFileBaseName
                })
              });
              const rawResp = await res.text();
              let data = null;
              try { data = JSON.parse(rawResp); } catch (_) {}
              if (!res.ok || !data || !data.ok) {
                throw new Error((data && data.error) || `HTTP ${res.status}: ${rawResp.slice(0, 120) || '导入失败'}`);
              }
              if (Array.isArray(data.projects)) W.projects = data.projects;
              if (Array.isArray(data.outlines)) W.outlineDrafts = data.outlines;
              if (data.premise) W.premiseDraft = data.premise;
              P.closeModal();
              selectProject(p.id, { force: true });
              renderSceneTree();
              if (jumpChk && jumpChk.checked) {
                P.setMode('polish');
              } else {
                P.setMode('muse');
                renderStep1OutlinePanel($('#musePanel'));
              }
              P.toast(`✅ 已成功导入「${data.formatLabel}」（${(data.stats && data.stats.lineCount) || 0} 条演出指令）！`);
            } catch (err) {
              P.toast('✗ 导入失败：' + err.message, 'err');
              confirmBtn.disabled = false;
              confirmBtn.textContent = `✅ 写入当前工程「${esc(p.nameZh || p.name)}」`;
            }
          };
        }
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Modal: ➕ 新建工程 (`POST /api/studio/projects` & `projectType: 'story' | 'reaction'`)
  // ---------------------------------------------------------------------------
  function openNewProjectModal() {
    const P = window.SCProto;
    if (!P || !P.openModal) return;

    const allIdols = Object.keys(W.idolMeta).length
      ? Object.keys(W.idolMeta)
      : ['mano', 'hiori', 'meguru', 'amana', 'tenka', 'hana', 'fuyuko', 'asahi', 'mei', 'tooru', 'madoka', 'kaho', 'kogane', 'nichika', 'luca'];
    const selectedCast = new Set();
    let selectedProjType = 'story';

    P.openModal(
      `
      <div class="modal-head">
        <h2>➕ 新建二创工程包 (.scpack) · 选择创作模式</h2>
        <span class="grow"></span>
        <button class="ibtn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <label class="fld">
          <span>1. 选择项目类型 (Project Type)</span>
          <div class="proj-type-grid" id="npTypeGrid" style="margin-top:6px;">
            <div class="proj-type-card on" data-proj-type="story">
              <div class="pt-title">📖 连续故事剧场 (Story Mode)</div>
              <div class="pt-desc">4级结构（工程 → 幕 Scene → 剧情小段 Beat → 具体台词）· 支持多人同台、分镜切镜、分支选项与多幕连播。</div>
            </div>
            <div class="proj-type-card" data-proj-type="reaction">
              <div class="pt-title">⚡ 多人反应 / 怪文书合集 (Reaction Mode)</div>
              <div class="pt-desc">B站同款「当偶像们听到某句话时的反应合集」极简工作台 · 1句命题 + 每人一张独立反应卡（服装/风格/1~4句破防反转），免调站位与时间轴！</div>
            </div>
          </div>
        </label>
        <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          <label class="fld">
            <span>工程中文名称 (Project Title)</span>
            <input type="text" id="npNameZh" value="" placeholder="例如：圣诞夜的咖啡店偶遇（可留空自动命名）" />
          </label>
          <label class="fld">
            <span>工程目录标识 (.scpack ID)</span>
            <input type="text" id="npSlugId" value="" placeholder="留空自动生成 proj_xxx，或填英文/数字/下划线" />
          </label>
        </div>
        <div class="fld" style="margin-top:10px;">
          <div class="row-flex" style="gap:6px;align-items:center;flex-wrap:wrap">
            <span>参演偶像选择（Story 模式可 0 人直接建空白工程；已选 <b id="npCastCount">0</b> 人）</span>
            <span class="grow"></span>
            <button type="button" class="chip-btn" data-np-cast-preset="none">全不选</button>
            <button type="button" class="chip-btn" data-np-cast-preset="canonical8">经典代表组</button>
            <button type="button" class="chip-btn" data-np-cast-preset="all28">全员28人</button>
          </div>
          <div class="idol-chip-wrap" id="npCastGrid" style="margin-top:6px;">
            ${allIdols
              .map((cid) => {
                const im = W.idolMeta[cid] || { speaker: cid, nameZh: cid };
                return `<button type="button" class="idol-toggle-chip" data-np-idol="${esc(cid)}">${esc(
                  im.nameZh || im.speaker
                )} (${esc(cid)})</button>`;
              })
              .join('')}
          </div>
        </div>
        <label class="fld" style="margin-top:10px;">
          <span id="npPremiseLabel">故事核心脑洞 / 一句话梗概（可留空直接进入空白工程，后续再「AI 拆解分幕」或「导入外部剧本」）</span>
          <textarea id="npPremise" rows="3" placeholder="写下一段话脑洞，或留空直接建空白工程…"></textarea>
        </label>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" data-close>取消</button>
        <button class="btn prism" id="btnCreateProjectConfirm">✨ 创建 .scpack 工程并进入工作台</button>
      </div>
    `,
      (m) => {
        const syncCastChipsUi = () => {
          $$('[data-np-idol]', m).forEach((btn) => {
            btn.classList.toggle('on', selectedCast.has(btn.dataset.npIdol));
          });
          const cntEl = $('#npCastCount', m);
          if (cntEl) cntEl.textContent = String(selectedCast.size);
        };

        $$('[data-proj-type]', m).forEach((card) => {
          card.onclick = () => {
            selectedProjType = card.dataset.projType;
            $$('[data-proj-type]', m).forEach((c) => c.classList.toggle('on', c === card));
            const nameInp = $('#npNameZh', m);
            const slugInp = $('#npSlugId', m);
            const premLbl = $('#npPremiseLabel', m);
            const premInp = $('#npPremise', m);
            if (selectedProjType === 'reaction') {
              if (nameInp) nameInp.placeholder = '例如：⚡ 当偶像们听到……时的反应合集（可留空自动命名）';
              if (slugInp) slugInp.placeholder = '留空自动生成 proj_xxx，或填英文/数字/下划线';
              if (premLbl) premLbl.textContent = '🎤 制作人命题台词（日文/中文 · 每位偶像反应卡前的统一触发台词，可进入工作台后再填）';
              if (premInp) premInp.placeholder = '输入制作人命题台词（可留空进入工作台后编辑）…';
            } else {
              if (nameInp) nameInp.placeholder = '例如：圣诞夜的咖啡店偶遇（可留空自动命名）';
              if (slugInp) slugInp.placeholder = '留空自动生成 proj_xxx，或填英文/数字/下划线';
              if (premLbl) premLbl.textContent = '故事核心脑洞 / 一句话梗概（可留空直接进入空白工程，后续再「AI 拆解分幕」或「导入外部剧本」）';
              if (premInp) premInp.placeholder = '写下一段话脑洞，或留空直接建空白工程…';
            }
          };
        });

        $$('[data-np-cast-preset]', m).forEach((btn) => {
          btn.onclick = () => {
            const preset = btn.dataset.npCastPreset;
            selectedCast.clear();
            if (preset === 'canonical8') {
              ['fuyuko', 'madoka', 'amana', 'tenka', 'hana', 'luca', 'mano', 'nichika'].forEach((cid) => {
                if (allIdols.includes(cid)) selectedCast.add(cid);
              });
            } else if (preset === 'all28') {
              allIdols.forEach((cid) => selectedCast.add(cid));
            }
            syncCastChipsUi();
          };
        });

        $$('[data-np-idol]', m).forEach((btn) => {
          btn.onclick = () => {
            const cid = btn.dataset.npIdol;
            if (selectedCast.has(cid)) {
              selectedCast.delete(cid);
            } else {
              selectedCast.add(cid);
            }
            syncCastChipsUi();
          };
        });

        const confirmBtn = $('#btnCreateProjectConfirm', m);
        if (confirmBtn) {
          confirmBtn.onclick = async () => {
            const rawNameZh = ($('#npNameZh', m).value || '').trim();
            const rawSlugId = ($('#npSlugId', m).value || '').trim();
            const id = rawSlugId || `proj_${Date.now().toString(36)}`;
            const nameZh = rawNameZh || (selectedProjType === 'reaction' ? '新建反应合集工程' : '新建空白工程');
            const premise = ($('#npPremise', m).value || '').trim();
            const cast = Array.from(selectedCast);
            confirmBtn.disabled = true;
            confirmBtn.textContent = '正在创建工程目录…';
            try {
              if (selectedProjType === 'reaction') {
                const cards = cast.map((cid) => buildDefaultReactionCardClient(cid));
                const compRes = await fetch('/api/studio/compile-reaction-pack', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    projectId: id,
                    title: nameZh,
                    ...(premise ? { triggerPromptJa: premise, triggerPromptZh: premise } : {}),
                    defaultBg: '00003',
                    defaultBgm: '016',
                    reactionCards: cards
                  })
                });
                const compData = await compRes.json();
                if (!compData.ok) throw new Error(compData.error || '创建反应合集失败');
                if (Array.isArray(compData.projects)) W.projects = compData.projects;
                P.closeModal();
                selectProject(compData.projectId || id, { force: true });
                setReactionWorkbenchActive(true);
                P.toast(`⚡ 已创建多人反应合集「${nameZh}」（${cards.length} 人）并进入独立反应工作台！`);
                return;
              }

              const res = await fetch('/api/studio/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name: nameZh, nameZh, projectType: 'story', cast, premise, blankTemplate: true })
              });
              const data = await res.json();
              if (!data.ok) throw new Error(data.error || '创建失败');

              W.projects = data.projects || W.projects;
              P.closeModal();
              selectProject(data.project.id, { force: true });
              P.setMode('muse');
              P.toast(`🎉 已创建空白工程「${nameZh} (${data.project.id}.scpack)」！可直接「导入外部剧本」或填写脑洞后「AI 拆解分幕」`);
            } catch (err) {
              P.toast('✗ 创建工程失败：' + err.message, 'err');
              confirmBtn.disabled = false;
              confirmBtn.textContent = '✨ 创建 .scpack 工程并进入工作台';
            }
          };
        }
      }
    );
  }

  // Add a new scene to the current project (`+ 新增场景`)
  async function addNewSceneToActiveProject() {
    const p = getActiveProject();
    if (!p) return;
    const nextIdx = (p.stories || []).length + 1;
    const sceneId = `scene_${String(nextIdx).padStart(2, '0')}_new`;
    const titleZh = `第 ${nextIdx} 幕 · 新增场景剧情`;
    try {
      const res = await fetch(`/api/studio/projects/${encodeURIComponent(p.id)}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          sceneId,
          title: titleZh,
          titleZh,
          bg: '',
          bgm: '',
          cast: (p.cast || ['amana', 'hana']).slice(0, 3),
          summary: `第 ${nextIdx} 幕新场景：制作人与偶像们的互动新篇章。`
        })
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.projects)) {
        W.projects = data.projects;
        W.outlineDrafts = (getActiveProject().stories || []).map((s) => ({
          sceneId: s.id,
          title: s.titleZh || s.title,
          titleJa: s.title,
          bg: s.bg || '',
          bgm: s.bgm || '016',
          cast: s.cast || [],
          summary: s.summary || '',
          beats: s.beats || []
        }));
        selectScene(sceneId);
        window.SCProto.toast(`✓ 已新增「${titleZh}」并生成初始台本`);
      }
    } catch (err) {
      window.SCProto.toast('✗ 新增场景失败：' + err.message, 'err');
    }
  }

  // Bind Step 2 / Stage Director Dock Quick Emotion Preset Chips & Branch Note button via delegated events
  function bindStep2QuickTools() {
    if (document.body.dataset.boundQuickStageTools) return;
    document.body.dataset.boundQuickStageTools = '1';

    document.addEventListener('click', (e) => {
      const P = window.SCProto;
      if (!P) return;

      const emoBtn = e.target && e.target.closest ? e.target.closest('#emoQuickBar .emo-chip') : null;
      if (emoBtn) {
        const emoKey = emoBtn.dataset.emo;
        const preset = W.emotionPresets[emoKey];
        if (!preset || !P.S || !P.S.doc) return;
        const idx = Math.max(0, P.S.doc.rows.findIndex((r) => r.key === P.S.selKey));
        const row = P.S.doc.rows[idx];
        if (!row) return;
        const lb = row.line.charLabel || P.S.selChar || '';
        const a1 = preset.bodyCandidates && preset.bodyCandidates[0];
        const a2 = preset.faceCandidates && preset.faceCandidates[0];
        const a4 = preset.eyeCandidates && preset.eyeCandidates[0];
        if (typeof P.applyMotionAndFaceToCurrentSelection === 'function' && lb) {
          P.applyMotionAndFaceToCurrentSelection(lb, {
            anim1: a1,
            anim2: a2,
            anim4: a4,
            labelHint: `切换情绪预设：${preset.label}`
          });
        }
        P.exec(`切换情绪预设：${preset.label}`, () => {
          const l = row.line;
          l._meta = l._meta || {};
          l._meta.surfaceEmotion = preset.surfaceEmotion;
          l._meta.innerEmotion = preset.innerEmotion;
          l._meta.vocalTone = preset.vocalTone;
        }, { syncStage: false });
        if (typeof P.renderStageDirectorDock === 'function') P.renderStageDirectorDock();
        if (typeof P.renderInspector === 'function') P.renderInspector();
        P.toast(`🎭 已应用并实时演示情绪预设：${preset.label}`);
        return;
      }

      const branchBtn = e.target && e.target.closest ? e.target.closest('#btnAddBranchNote') : null;
      if (branchBtn) {
        if (!P.S || !P.S.doc) return;
        const idx = Math.max(0, P.S.doc.rows.findIndex((r) => r.key === P.S.selKey));
        P.exec('插入分支选项与标签', () => {
          const stamp = Date.now().toString(36).slice(-4);
          const branchIdA = 'branch_a_' + stamp;
          const branchIdB = 'branch_b_' + stamp;
          const newLines = [
            {
              select: '選択肢A（クリックして編集）',
              nextLabel: branchIdA,
              _meta: { uid: 'sel_' + Date.now().toString(36), selectZh: '选项 A（请填写中文译文）', note: '[分支选项 A]' }
            },
            {
              select: '選択肢B（クリックして編集）',
              nextLabel: branchIdB,
              _meta: { uid: 'sel_' + (Date.now() + 1).toString(36), selectZh: '选项 B（请填写中文译文）', note: '[分支选项 B]' }
            },
            {
              label: branchIdA,
              _meta: { uid: 'lbl_' + Date.now().toString(36), note: '[分支 A 落点]' }
            },
            {
              label: branchIdB,
              _meta: { uid: 'lbl_' + (Date.now() + 1).toString(36), note: '[分支 B 落点]' }
            }
          ];
          const made = newLines.map((line) => ({ key: 'k' + ++P.S.doc.keySeq, line }));
          P.S.doc.rows.splice(idx + 1, 0, ...made);
          P.S.selKey = made[0].key;
        });
        if (document.body.classList.contains('hide-directions')) {
          setDirectionsVisible(true, { forceRerender: true });
        } else {
          if (typeof P.renderScript === 'function') P.renderScript();
          refreshDirectionsToggleUi();
        }
        P.toast('🔀 已在当前行后插入 2 个分支选项及对应标签');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Task 2 · ⚡ 多人反应 / 怪文书合集模式 (Reaction Anthology Workbench)
  // ---------------------------------------------------------------------------
  function buildDefaultReactionCardClient(cid) {
    const im = W.idolMeta[cid] || { id: '001', speaker: cid, nameZh: cid, selfJa: '私', pCallJa: 'プロデューサー', pCallZh: '制作人', unit: '283 Production', color: '#ff6ba6' };
    const selfJa = im.selfJa || im.pronoun || '私';
    const pCallJa = im.pCallJa || im.pCall || 'プロデューサー';
    const pCallZh = im.pCallZh || '制作人';
    const noKeigo = ['luca', 'juri', 'mei', 'kogane', 'mamimi', 'tooru', 'hinana', 'natsuha', 'sakuya', 'yuika', 'tenka'].includes(cid);
    const noBang = ['madoka', 'kiriko', 'tooru', 'mikoto'].includes(cid);
    const endBang = noBang ? '。' : '！';
    const line1Ja = cid === 'tenka'
      ? `あ、あの……${pCallJa}、急にどうしたの……？`
      : noKeigo
      ? `……えっ、${pCallJa}、急に何を言ってるの？`
      : `えっ……${pCallJa}、急にどうしたんですか？`;
    const line2Ja = cid === 'tenka'
      ? `うぅ……ただの関係だなんて、甜花、寂しいよ……${pCallJa}の傍がいいな……。`
      : noKeigo
      ? `${selfJa}にとって${pCallJa}は、ただの関係なんかじゃないよ${endBang}`
      : `${selfJa}にとって${pCallJa}は、それ以上に大切な人ですよ${endBang}`;
    return {
      cardId: `react_${cid}`,
      charLabel: cid,
      style: 'canon',
      bg: '00003',
      bgm: '016',
      outfitKey: `characters/stand/${im.id || '001'}`,
      charType: 'characters',
      charCategory: 'stand',
      charId: im.id || '001',
      clothId: im.id || '001',
      lines: [
        {
          lineId: `${cid}_1`,
          text: line1Ja,
          zh: `咦……${pCallZh}，怎么突然说这种话呀？`,
          emotion: 'surp',
          se: '0327'
        },
        {
          lineId: `${cid}_2`,
          text: line2Ja,
          zh: `对我来说，${pCallZh}才不是那种普通的关系哦${endBang}`,
          emotion: 'shy',
          se: '0453'
        }
      ]
    };
  }

  function ensureReactionStateFromProject(p) {
    if (!p) return null;
    if (!p.reactionConfig || !Array.isArray(p.reactionConfig.reactionCards) || !p.reactionConfig.reactionCards.length) {
      const rxProj = W.projects.find((x) => x.id === 'reaction_idol_relation');
      const src = Array.isArray(p.reactionCards) && p.reactionCards.length
        ? p
        : rxProj && Array.isArray(rxProj.reactionCards) && rxProj.reactionCards.length
        ? rxProj
        : rxProj && rxProj.reactionConfig && Array.isArray(rxProj.reactionConfig.reactionCards)
        ? rxProj.reactionConfig
        : null;
      if (src) {
        const rawCards = src.reactionCards || (src.reactionConfig && src.reactionConfig.reactionCards) || [];
        p.reactionConfig = {
          triggerPromptJa: src.triggerPromptJa || '「プロデューサーとアイドル、それ以上でも以下でもない関係だろ？」',
          triggerPromptZh: src.triggerPromptZh || '（我们只是制作人和偶像的关系，仅此而已吧？）',
          defaultBg: src.defaultBg || '00001',
          defaultBgm: src.defaultBgm || '001',
          reactionCards: JSON.parse(JSON.stringify(rawCards))
        };
      } else {
        const defaultCast = ['fuyuko', 'madoka', 'amana', 'tenka', 'hana', 'luca', 'mano', 'nichika'];
        p.reactionConfig = {
          triggerPromptJa: p.triggerPromptJa || '「プロデューサーとアイドル、それ以上でも以下でもない関係だろ？」',
          triggerPromptZh: p.triggerPromptZh || '（我们只是制作人和偶像的关系，仅此而已吧？）',
          defaultBg: p.defaultBg || '00001',
          defaultBgm: p.defaultBgm || '001',
          reactionCards: defaultCast.map((cid) => buildDefaultReactionCardClient(cid))
        };
      }
    }
    return p.reactionConfig;
  }

  function isReactionProject(p) {
    return Boolean(p && (p['x-projectType'] === 'reaction' || p.projectType === 'reaction'));
  }

  function syncReactionTopbarDom(isActive) {
    document.body.classList.toggle('reaction-workbench-active', Boolean(isActive));
    const modeSegEl = $('#modeSeg');
    if (modeSegEl) modeSegEl.hidden = Boolean(isActive);
    const rxBannerEl = $('#rxModeTopBanner');
    if (rxBannerEl) {
      rxBannerEl.classList.toggle('hidden', !isActive);
      rxBannerEl.hidden = !isActive;
    }
    const p = getActiveProject();
    const hideExit = isReactionProject(p);
    document.querySelectorAll('#btnRxExitToStory').forEach((el) => {
      el.hidden = hideExit;
    });
  }

  function setReactionWorkbenchActive(active) {
    const isActive = Boolean(active);
    W.reactionWorkbenchActive = isActive;
    syncReactionTopbarDom(isActive);
    const rxBox = $('#reactionWorkbench');
    const museBox = $('#musePanel');
    const scriptBox = $('#scriptList');
    const step2Bar = $('#step2Toolbar');
    const topBtn = $('#btnReactionWorkbenchTop');
    if (topBtn) {
      topBtn.classList.toggle('prism', W.reactionWorkbenchActive);
      topBtn.classList.toggle('ghost', !W.reactionWorkbenchActive);
    }
    if (!rxBox) return;
    if (W.reactionWorkbenchActive) {
      rxBox.hidden = false;
      if (museBox) museBox.hidden = true;
      if (scriptBox) scriptBox.hidden = true;
      if (step2Bar) step2Bar.hidden = true;
      renderReactionWorkbench(rxBox);
    } else {
      rxBox.hidden = true;
      const P = window.SCProto;
      if (P && P.S) {
        if (museBox) museBox.hidden = P.S.mode !== 'muse';
        if (scriptBox) scriptBox.hidden = P.S.mode === 'muse';
        if (step2Bar) step2Bar.hidden = P.S.mode === 'muse';
      }
    }
  }

  function resolveReactionTtsConfig({ silent = false } = {}) {
    let tc = getTtsConfig();
    if (!tc || !tc.provider || tc.provider === 'off') {
      if (tc && tc.explicitOff) {
        if (!silent && window.SCProto) {
          window.SCProto.toast && window.SCProto.toast('当前已显式关闭 TTS 接口，可在顶栏「🔌 接口与语音 → 🎙 TTS」重新启用 Fish Audio', 'warn');
        }
        return null;
      }
      tc = { provider: 'cloud_fish', endpoint: 'https://api.fish.audio', model: 'drama-3', format: 'mp3' };
    }
    return tc;
  }

  let _rxPreviewAudio = null;
  function playReactionAudioUrl(url) {
    if (!url) return;
    const P = window.SCProto;
    if (P && typeof P.playRealAudio === 'function') {
      P.playRealAudio(url);
      return;
    }
    try {
      if (_rxPreviewAudio) {
        _rxPreviewAudio.pause();
        _rxPreviewAudio = null;
      }
      const a = new Audio(url);
      _rxPreviewAudio = a;
      a.play().catch(() => {});
    } catch (_) {}
  }

  async function synthesizeReactionLineTts(card, lIdx, { force = false, autoPlay = true, silent = false } = {}) {
    if (!card || !Array.isArray(card.lines) || !card.lines[lIdx]) return null;
    const ln = card.lines[lIdx];
    const synthText = String(ln.ttsText || ln.text || '').trim();
    if (!synthText) {
      if (!silent && window.SCProto && window.SCProto.toast) {
        window.SCProto.toast('当前行日文台词为空，无法合成语音', 'warn');
      }
      return null;
    }
    const ttsConfig = resolveReactionTtsConfig({ silent });
    if (!ttsConfig) return null;
    const emoMap = {
      surp: 'surprise_wide',
      tsun: 'anger_pout',
      shy: 'shy_flustered',
      joy: 'joy_bright',
      idol: 'smile_gentle',
      sad: 'sad_downcast',
      serious: 'calm_neutral',
      sigh: 'troubled_sigh'
    };
    const res = await fetch('/api/studio/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: synthText,
        charLabel: card.charLabel,
        emotion: emoMap[ln.emotion] || 'neutral',
        force: Boolean(force),
        ttsConfig
      })
    });
    const data = await res.json();
    if (!data || !data.ok || !data.audioUrl) {
      throw new Error((data && (data.error || data.detail)) || 'TTS 合成失败');
    }
    const voicePath = data.playerVoicePath || data.audioUrl;
    ln.voice = voicePath;
    ln.audioUrl = data.audioUrl || voicePath;
    ln.voiceText = synthText;
    ln.voiceStale = false;
    if (Number(data.durationMs) > 0) {
      ln.durationMs = Math.round(Number(data.durationMs));
      ln.dur = Number((ln.durationMs / 1000).toFixed(3));
    }
    if (Array.isArray(data.lipSegments) && data.lipSegments.length) {
      ln.lipSegments = data.lipSegments;
    } else {
      delete ln.lipSegments;
    }
    if (autoPlay) {
      playReactionAudioUrl(data.audioUrl || voicePath);
    }
    return data;
  }

  function normalizeImportedReactionCard(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const rawChar = raw.charLabel || raw.char || raw.speaker || raw.name || raw.nameZh || '';
    const cid = resolveCharLabelByName(rawChar) || (W.idolMeta[rawChar] ? rawChar : '');
    if (!cid) return null;
    const base = buildDefaultReactionCardClient(cid);
    const validStyle = ['canon', 'canonical', 'heavy', 'sweet', 'meme', 'gag'].includes(raw.style) ? raw.style : base.style;
    const normalizedStyle = validStyle === 'canonical' ? 'canon' : validStyle === 'gag' ? 'meme' : validStyle;
    const rawLines = Array.isArray(raw.lines) ? raw.lines : [];
    const lines = rawLines
      .map((item, idx) => {
        if (typeof item === 'string') {
          const t = item.trim();
          return t ? { lineId: `${cid}_${idx + 1}`, text: t, zh: t, emotion: 'joy', se: '' } : null;
        }
        if (!item || typeof item !== 'object') return null;
        const text = String(item.text || item.ja || item.line || '').trim();
        const zh = String(item.zh || item.cn || text).trim();
        if (!text && !zh) return null;
        return {
          lineId: item.lineId || `${cid}_${idx + 1}`,
          text: text || zh,
          zh: zh || text,
          emotion: item.emotion || 'joy',
          se: item.se || '',
          ...(item.voice ? { voice: item.voice } : {})
        };
      })
      .filter(Boolean);
    return {
      ...base,
      style: normalizedStyle,
      bg: raw.bg ? String(raw.bg).padStart(5, '0') : base.bg,
      bgm: raw.bgm ? String(raw.bgm) : base.bgm,
      ...(raw.outfitKey ? { outfitKey: raw.outfitKey } : {}),
      ...(raw.charType ? { charType: raw.charType } : {}),
      ...(raw.charCategory ? { charCategory: raw.charCategory } : {}),
      ...(raw.charId ? { charId: raw.charId } : {}),
      ...(raw.clothId ? { clothId: raw.clothId } : {}),
      lines: lines.length ? lines : base.lines
    };
  }

  function parseReactionBatchInput(rawText) {
    const trimmed = String(rawText || '').trim();
    if (!trimmed) return { ok: false, error: '请输入反应文本或 JSON 内容' };
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const arr = Array.isArray(parsed)
          ? parsed
          : (Array.isArray(parsed.reactionCards) ? parsed.reactionCards : (Array.isArray(parsed.cards) ? parsed.cards : null));
        if (!arr) return { ok: false, error: 'JSON 需为卡片数组 [...] 或包含 reactionCards 数组的对象' };
        const cards = arr.map(normalizeImportedReactionCard).filter(Boolean);
        if (!cards.length) return { ok: false, error: '未在 JSON 中识别到有效的 283 偶像角色卡片（需含 charLabel / speaker）' };
        return {
          ok: true,
          format: 'json',
          cards,
          triggerPromptJa: !Array.isArray(parsed) ? (parsed.triggerPromptJa || '') : '',
          triggerPromptZh: !Array.isArray(parsed) ? (parsed.triggerPromptZh || '') : ''
        };
      } catch (err) {
        return { ok: false, error: 'JSON 解析失败：' + err.message };
      }
    }

    // Parse plain text grouped by idol headings or `角色名：台词`
    const rawLines = trimmed.split(/\r?\n/);
    const cards = [];
    let currentCard = null;
    let triggerPromptJa = '';
    let triggerPromptZh = '';

    const pushLineToCard = (card, rawLine) => {
      if (!card || !rawLine) return;
      const parts = rawLine.split(/\s*(?:\|\||\||\/\/|\t)\s*/);
      const text = (parts[0] || '').trim();
      const zh = (parts[1] || parts[0] || '').trim();
      if (!text && !zh) return;
      card.lines.push({
        lineId: `${card.charLabel}_${card.lines.length + 1}`,
        text: text || zh,
        zh: zh || text,
        emotion: 'joy',
        se: ''
      });
    };

    const ensureCardForIdol = (cid) => {
      const existing = cards.find((c) => c.charLabel === cid);
      if (existing) {
        currentCard = existing;
        return existing;
      }
      const base = buildDefaultReactionCardClient(cid);
      base.lines = [];
      cards.push(base);
      currentCard = base;
      return base;
    };

    for (const raw of rawLines) {
      const line = raw.trim();
      if (!line) continue;
      const trigMatch = line.match(/^(?:命题|触发台词|制作人命题)[：:]\s*(.+)$/);
      if (trigMatch) {
        const parts = trigMatch[1].split(/\s*(?:\|\||\||\/\/)\s*/);
        triggerPromptJa = (parts[0] || '').trim();
        triggerPromptZh = (parts[1] || parts[0] || '').trim();
        continue;
      }
      const headMatch =
        line.match(/^#{1,3}\s*【?([^】#\n]+?)】?$/) ||
        line.match(/^【([^】]+)】(.*)$/) ||
        line.match(/^\[([^\]]+)\](.*)$/);
      if (headMatch) {
        const cid = resolveCharLabelByName(headMatch[1].trim());
        if (cid) {
          const card = ensureCardForIdol(cid);
          const rest = (headMatch[2] || '').trim().replace(/^[：:]\s*/, '');
          if (rest) pushLineToCard(card, rest);
          continue;
        }
      }
      const spkMatch = line.match(/^([^\s：:]{1,16})[：:]\s*(.+)$/);
      if (spkMatch) {
        const cid = resolveCharLabelByName(spkMatch[1].trim());
        if (cid) {
          const card = ensureCardForIdol(cid);
          pushLineToCard(card, spkMatch[2].trim());
          continue;
        }
      }
      if (currentCard) {
        pushLineToCard(currentCard, line);
      }
    }

    const validCards = cards.filter((c) => c.lines && c.lines.length > 0);
    if (!validCards.length) {
      return { ok: false, error: '未识别到偶像反应段落，请使用「【冬优子】」或「冬优子：台词」格式分段' };
    }
    return { ok: true, format: 'text', cards: validCards, triggerPromptJa, triggerPromptZh };
  }

  function openReactionBatchImportModal(rx, box) {
    const P = window.SCProto;
    if (!P || typeof P.openModal !== 'function') return;
    P.openModal(
      `
      <div class="modal-head">
        <h2>📥 批量导入反应文本 / JSON</h2>
        <span class="grow"></span>
        <button class="ibtn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <div class="callout info" style="margin-bottom:8px;font-size:12px">
          支持两种格式快速生成/填充反应卡片：<br>
          1. <b>纯文本分段</b>：使用 <code>【冬优子】</code> 或 <code>冬优子：...</code> 标记角色，支持 <code>日文 | 中文</code> 双语写法；<br>
          2. <b>JSON 数组/对象</b>：<code>[{"charLabel":"fuyuko","bgm":"016","lines":[{"text":"...","zh":"...","emotion":"tsun"}]}]</code>。
        </div>
        <div class="row-flex" style="gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
          <button type="button" class="btn ghost" id="btnRxPickFile">📂 选择本地文件 (.json / .txt / .md)</button>
          <input type="file" id="rxBatchFileInp" accept=".json,.txt,.md,application/json,text/plain" hidden />
          <span class="grow"></span>
          <label style="font-size:12px;display:inline-flex;align-items:center;gap:6px">
            导入方式：
            <select id="rxBatchImportMode" style="font-size:12px;padding:3px 6px;border-radius:6px">
              <option value="append">追加 / 按角色合并到现有卡片</option>
              <option value="replace">替换全部现有反应卡片</option>
            </select>
          </label>
        </div>
        <textarea id="rxBatchTextarea" rows="10" style="width:100%;font-family:monospace;font-size:12px" placeholder="【冬优子】
ふゆ、そんなつもりで……！ | 冬优、冬优才不是那个意思……！
プロデューサーさん、覚悟してください。 | 制作人先生，请做好觉悟吧。

【円香】
……別に。勝手にしてください。 | ……无所谓。随你的便吧。"></textarea>
        <div id="rxBatchPreview" class="callout info" style="margin-top:8px;font-size:12px" hidden></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn ghost" data-close>取消</button>
        <button type="button" class="btn prism" id="btnRxBatchConfirm" disabled>✅ 写入反应工作台</button>
      </div>
      `,
      (m) => {
        const ta = $('#rxBatchTextarea', m);
        const prev = $('#rxBatchPreview', m);
        const btnConfirm = $('#btnRxBatchConfirm', m);
        const fileBtn = $('#btnRxPickFile', m);
        const fileInp = $('#rxBatchFileInp', m);
        const modeSel = $('#rxBatchImportMode', m);
        let lastParsed = null;

        const refresh = () => {
          const val = (ta && ta.value) || '';
          if (!val.trim()) {
            if (prev) prev.hidden = true;
            if (btnConfirm) btnConfirm.disabled = true;
            lastParsed = null;
            return;
          }
          const parsed = parseReactionBatchInput(val);
          lastParsed = parsed;
          if (prev) prev.hidden = false;
          if (!parsed.ok) {
            if (prev) {
              prev.className = 'callout warn';
              prev.textContent = '⚠️ ' + parsed.error;
            }
            if (btnConfirm) btnConfirm.disabled = true;
            return;
          }
          const lineTotal = parsed.cards.reduce((s, c) => s + (c.lines ? c.lines.length : 0), 0);
          const names = parsed.cards.map((c) => (W.idolMeta[c.charLabel] ? W.idolMeta[c.charLabel].nameZh : c.charLabel)).join('、');
          if (prev) {
            prev.className = 'callout info';
            prev.innerHTML = `🔍 已识别 <b>${parsed.format === 'json' ? 'JSON' : '纯文本分段'}</b>：<b>${parsed.cards.length}</b> 张反应卡 · 共 <b>${lineTotal}</b> 句台词<br>👥 角色：${esc(names)}`;
          }
          if (btnConfirm) btnConfirm.disabled = false;
        };

        if (fileBtn && fileInp) {
          fileBtn.onclick = () => fileInp.click();
          fileInp.onchange = () => {
            const f = fileInp.files && fileInp.files[0];
            if (!f) return;
            f.text().then((content) => {
              if (ta) ta.value = content;
              refresh();
            });
          };
        }
        if (ta) ta.oninput = refresh;
        if (btnConfirm) {
          btnConfirm.onclick = () => {
            if (!lastParsed || !lastParsed.ok) return;
            const mode = modeSel ? modeSel.value : 'append';
            if (lastParsed.triggerPromptJa) rx.triggerPromptJa = lastParsed.triggerPromptJa;
            if (lastParsed.triggerPromptZh) rx.triggerPromptZh = lastParsed.triggerPromptZh;
            if (mode === 'replace') {
              rx.reactionCards = lastParsed.cards;
            } else {
              rx.reactionCards = rx.reactionCards || [];
              lastParsed.cards.forEach((nc) => {
                const existing = rx.reactionCards.find((c) => c.charLabel === nc.charLabel);
                if (existing) {
                  existing.lines = (existing.lines || []).concat(nc.lines || []);
                  if (nc.bgm) existing.bgm = nc.bgm;
                  if (nc.bg) existing.bg = nc.bg;
                  if (nc.style) existing.style = nc.style;
                } else {
                  rx.reactionCards.push(nc);
                }
              });
            }
            const totalLines = lastParsed.cards.reduce((s, c) => s + (c.lines ? c.lines.length : 0), 0);
            P.closeModal();
            renderReactionWorkbench(box);
            P.toast && P.toast(`✅ 已导入 ${lastParsed.cards.length} 张反应卡片（共 ${totalLines} 句）！`);
          };
        }
      }
    );
  }

  function renderReactionWorkbench(box) {
    if (!box) box = $('#reactionWorkbench');
    if (!box) return;
    let p = getActiveProject();
    if (!p) return;
    const isRxProj = isReactionProject(p);
    const rx = ensureReactionStateFromProject(p);
    const cards = rx.reactionCards || [];
    const allIdols = Object.keys(W.idolMeta).length
      ? Object.keys(W.idolMeta)
      : ['fuyuko', 'madoka', 'amana', 'tenka', 'hana', 'luca', 'mano', 'nichika', 'hiori', 'meguru', 'kogane', 'mamimi', 'sakuya', 'yuika', 'kiriko', 'kaho', 'chiyoko', 'juri', 'rinze', 'natsuha', 'chiyuki', 'asahi', 'mei', 'tooru', 'koito', 'hinana', 'mikoto', 'haruki'];

    const bgs = (window.SC_MOCK && window.SC_MOCK.bgLibrary) || [
      { id: '00003', name: '283事务所·日常会客室' },
      { id: '00004', name: '283事务所·黄昏窗边' },
      { id: '00269', name: '夏日碧海沙滩' },
      { id: '00271', name: '海平线黄昏晚霞' }
    ];
    const emoOpts = [
      { id: 'surp', label: '😲 震惊睁眼' },
      { id: 'tsun', label: '💢 傲娇破防' },
      { id: 'shy', label: '😳 害羞脸红' },
      { id: 'joy', label: '😊 开心元气' },
      { id: 'idol', label: '✨ 营业甜笑' },
      { id: 'sad', label: '🥺 委屈低落' },
      { id: 'serious', label: '😐 冷淡认真' },
      { id: 'sigh', label: '😮‍💨 叹气无奈' }
    ];
    const seOpts = [
      { id: '', label: '🔔 无音效' },
      { id: 'bgm_stop', label: '🔇 bgm_stop BGM骤停 (破防转折)' },
      { id: '0327', label: '❗ 0327 惊讶一凛 / 闪光音' },
      { id: '0453', label: '💓 0453 心跳加速 / 脸红气泡' },
      { id: '0478', label: '✨ 0478 欢欣雀跃 / 元气闪耀音' },
      { id: '0789', label: '⚡ 0789 吐槽 / 破防重音' },
      { id: '1268', label: '💦 1268 慌张石化 / 搞笑囧音' },
      { id: '0113', label: '🚪 0113 推门声' }
    ];

    box.innerHTML = `
      <div class="rx-trigger-box">
        <div class="rx-trigger-head">
          <div>
            <span class="step-badge" style="background:linear-gradient(135deg,#ec4899,#8b5cf6)">⚡ 多人反应 / 怪文书合集模式 (Reaction Anthology)</span>
            <b>B站同款「当偶像们听到某句话时的反应」极简工作台 · 免调坐标/时间轴，每人一张独立反应卡</b>
          </div>
          <div class="row-flex" style="gap:6px;flex-wrap:wrap">
            <button type="button" class="chip-btn" id="btnRxExitToStory" ${isRxProj ? 'hidden' : ''} title="切回连续故事 4 级剧场编辑器">📖 切回故事剧场模式</button>
            <button type="button" class="chip-btn" id="btnRxBatchImport" title="从纯文本分段或 JSON 数组批量导入/追加反应卡片">📥 批量导入反应文本/JSON</button>
            <button type="button" class="btn ghost" id="btnRxTtsAll" title="使用 Fish Audio 接口为当前全部偶像反应台词逐句合成语音">🎙 一键合成全员语音</button>
            <button type="button" class="btn prism" id="btnRxCompileAll" title="将全部角色反应卡编译为连续 .scproj.json（自动加黑场标题卡与制作人命题），并在右侧 :18899 舞台立即连播！">
              🎬 编译并连播全员反应合集 (${cards.length}人)
            </button>
            <button type="button" class="chip-btn prismy" id="btnRxRecordMp4" title="将当前反应合集按单人 C 位编译为 .scproj 并推送舞台录制 MP4">🎥 录制合集 MP4</button>
          </div>
        </div>
        <div id="rxTtsProgress" class="callout info" style="margin:6px 0 0;padding:6px 10px;font-size:12px" hidden></div>

        <div class="rx-trigger-inputs">
          <label class="fld" style="margin:0">
            <span style="font-size:11px;font-weight:700">🎤 制作人命题台词（日文原文 · 将在每位角色反应前自动播放）</span>
            <input type="text" id="rxTriggerJa" value="${esc(rx.triggerPromptJa)}" placeholder="「プロデューサーとアイドル、それ以上でも以下でもない関係だろ？」" />
          </label>
          <label class="fld" style="margin:0">
            <span style="font-size:11px;font-weight:700">💬 制作人命题台词（中文翻译）</span>
            <input type="text" id="rxTriggerZh" value="${esc(rx.triggerPromptZh)}" placeholder="「我们只是制作人和偶像的关系，仅此而已吧？」" />
          </label>
        </div>

        <div class="rx-preset-bar">
          <span class="muted" style="font-size:11px;font-weight:700">👥 快速选人预设：</span>
          <button type="button" class="chip-btn" data-rx-preset="canonical8">⭐ 经典8人代表组</button>
          <button type="button" class="chip-btn" data-rx-preset="heavy">🔪 高反差重女组 (冬优子/円香/甘奈/路加/美琴)</button>
          <button type="button" class="chip-btn" data-rx-preset="sweet">🍬 直球甜度组 (真乃/羽那/恋钟/透/甜花/果穗)</button>
          <button type="button" class="chip-btn" data-rx-preset="cometik">☄️ CoMETIK (羽那/路加/阳希)</button>
          <button type="button" class="chip-btn" data-rx-preset="all28">🌟 全员 28 人大合集</button>
          <span class="grow"></span>
          <select id="rxAddIdolSelect" style="font-size:11.5px;padding:3px 6px;border-radius:6px">
            <option value="">＋ 添加指定偶像反应卡…</option>
            ${allIdols
              .map((cid) => {
                const im = W.idolMeta[cid] || { speaker: cid, nameZh: cid, unit: '' };
                return `<option value="${esc(cid)}">${esc(im.nameZh || im.speaker)} (${esc(im.unit || cid)})</option>`;
              })
              .join('')}
          </select>
        </div>
      </div>

      <div class="rx-cards-grid" id="rxCardsGrid">
        ${cards
          .map((card, cIdx) => {
            const cid = card.charLabel;
            const im = W.idolMeta[cid] || { speaker: cid, nameZh: cid, unit: '283 Production', color: '#ff6ba6' };
            const P = window.SCProto;
            const outfits = P && typeof P.getOutfitsForChar === 'function' ? P.getOutfitsForChar(cid) : [];
            const rawStyle = card.style || 'canon';
            const curStyle = rawStyle === 'canonical' ? 'canon' : rawStyle === 'gag' ? 'meme' : rawStyle;
            const curCardBgm = card.bgm || rx.defaultBgm || '016';
            return `
            <div class="rx-idol-card" data-rx-idx="${cIdx}">
              <div class="rx-idol-head">
                <span class="rx-unit-badge" style="background:${esc(im.color || '#ec4899')}">#${String(cIdx + 1).padStart(2, '0')} · ${esc(im.unit || '283')}</span>
                <b style="font-size:13.5px">${esc(im.nameZh || im.speaker)} <small class="muted">(${esc(im.speaker)})</small></b>
                <span class="grow"></span>
                <label class="muted" style="font-size:11px">👗服装
                  <select data-rx-outfit="${cIdx}" style="font-size:11px;padding:1px 4px;max-width:130px">
                    ${
                      outfits.length
                        ? outfits
                            .map(
                              (o) =>
                                `<option value="${esc(o.key)}" ${
                                  o.charCategory === card.charCategory && o.charId === card.charId ? 'selected' : ''
                                }>${esc(o.shortLabel || o.label)}</option>`
                            )
                            .join('')
                        : `<option value="default">默认私服 (${esc(card.charCategory || 'stand')}/${esc(card.charId || '001')})</option>`
                    }
                  </select>
                </label>
                <label class="muted" style="font-size:11px">🖼背景
                  <select data-rx-bg="${cIdx}" style="font-size:11px;padding:1px 4px;max-width:120px">
                    ${bgs
                      .map((b) => `<option value="${esc(b.id)}" ${card.bg === b.id ? 'selected' : ''}>${esc(b.id)}·${esc(b.name)}</option>`)
                      .join('')}
                  </select>
                </label>
                <label class="muted" style="font-size:11px">🎵 BGM
                  <select data-rx-bgm="${cIdx}" style="font-size:11px;padding:1px 4px;max-width:135px" title="设置 ${esc(im.nameZh || im.speaker)} 这张反应卡切换时的配乐 BGM">
                    ${buildGroupedBgmOptionsHtml(curCardBgm, card, { isBeat: false })}
                  </select>
                </label>
                <button type="button" class="sc-mini-btn" data-rx-move="-1" data-rx-idx="${cIdx}" title="上移卡片" ${cIdx === 0 ? 'disabled' : ''}>↑</button>
                <button type="button" class="sc-mini-btn" data-rx-move="1" data-rx-idx="${cIdx}" title="下移卡片" ${cIdx === cards.length - 1 ? 'disabled' : ''}>↓</button>
                <button type="button" class="sc-mini-btn" data-rx-del="${cIdx}" title="移除此角色卡片">✕</button>
              </div>

              <div class="rx-style-bar">
                <span class="muted" style="font-size:11px">🎭 一键切换反应风格：</span>
                <button type="button" class="rx-style-btn ${curStyle === 'canon' ? 'on' : ''}" data-rx-style="canon" data-rx-idx="${cIdx}">🎯 原作味</button>
                <button type="button" class="rx-style-btn ${curStyle === 'heavy' ? 'on' : ''}" data-rx-style="heavy" data-rx-idx="${cIdx}">🔪 破防重女</button>
                <button type="button" class="rx-style-btn ${curStyle === 'sweet' ? 'on' : ''}" data-rx-style="sweet" data-rx-idx="${cIdx}">🍬 直球心动</button>
                <button type="button" class="rx-style-btn ${curStyle === 'meme' ? 'on' : ''}" data-rx-style="meme" data-rx-idx="${cIdx}">😂 怪文书整活</button>
                <span class="grow"></span>
                <button type="button" class="sc-mini-btn" data-rx-scsp="${esc(cid)}" hidden style="display:none" title="参考台词">参考</button>
              </div>

              <div class="rx-lines-list">
                ${(card.lines || [])
                  .map(
                    (ln, lIdx) => `
                  <div class="rx-line-row" data-rx-line="${lIdx}">
                    <div class="rx-line-top">
                      <span class="beat-num">${lIdx === 0 ? '初反应' : lIdx === 1 ? '反转/破防' : '追击 #' + (lIdx + 1)}</span>
                      <select data-rx-line-field="emotion" data-rx-idx="${cIdx}" data-line-idx="${lIdx}" title="选择表情与动作预设">
                        ${emoOpts
                          .map((eo) => `<option value="${esc(eo.id)}" ${(ln.emotion || 'joy') === eo.id ? 'selected' : ''}>${esc(eo.label)}</option>`)
                          .join('')}
                      </select>
                      <select data-rx-line-field="se" data-rx-idx="${cIdx}" data-line-idx="${lIdx}" title="卡点音效">
                        ${seOpts
                          .map((so) => `<option value="${esc(so.id)}" ${(ln.se || '') === so.id ? 'selected' : ''}>${esc(so.label)}</option>`)
                          .join('')}
                      </select>
                      <span class="grow"></span>
                      ${
                        ln.voice && !ln.voiceStale
                          ? `<button type="button" class="sc-mini-btn" data-rx-play-line="${lIdx}" data-rx-idx="${cIdx}" title="试听本句已合成语音">🔊 试听</button>
                             <button type="button" class="sc-mini-btn" data-rx-tts-line="${lIdx}" data-rx-idx="${cIdx}" title="重新合成本句语音">🎙 重配</button>`
                          : `<button type="button" class="sc-mini-btn" data-rx-tts-line="${lIdx}" data-rx-idx="${cIdx}" title="合成并试听本句语音">🎙 合成试听</button>`
                      }
                      <button type="button" class="sc-mini-btn" data-rx-del-line="${lIdx}" data-rx-idx="${cIdx}" title="删除本句">✕</button>
                    </div>
                    <input type="text" data-rx-line-field="text" data-rx-idx="${cIdx}" data-line-idx="${lIdx}" value="${esc(ln.text)}" placeholder="日文台词（自动校验第一人称与口癖）…" />
                    <input type="text" data-rx-line-field="zh" data-rx-idx="${cIdx}" data-line-idx="${lIdx}" value="${esc(ln.zh)}" placeholder="中文翻译字幕…" />
                  </div>
                `
                  )
                  .join('')}
              </div>

              <div class="rx-card-foot">
                <span class="sc-ooc-pill ok">✓ OOC 0 · 已锁人设</span>
                <button type="button" class="sc-mini-btn" data-rx-add-line="${cIdx}">＋ 加一句反应</button>
                <span class="grow"></span>
                <button type="button" class="chip-btn" data-rx-preview-single="${cIdx}" title="立即在右侧 :18899 真 Spine 舞台单独试看 ${esc(im.nameZh || im.speaker)} 的反应！">
                  ▶ 在真舞台单人试看
                </button>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;

    syncReactionTopbarDom(W.reactionWorkbenchActive);

    // Bind events in Reaction Workbench
    const btnExit = $('#btnRxExitToStory', box);
    if (btnExit) {
      btnExit.hidden = isRxProj;
      btnExit.onclick = () => {
        if (isReactionProject(getActiveProject())) return;
        setReactionWorkbenchActive(false);
      };
    }

    const btnBatchImport = $('#btnRxBatchImport', box);
    if (btnBatchImport) {
      btnBatchImport.onclick = () => openReactionBatchImportModal(rx, box);
    }

    const btnTtsAll = $('#btnRxTtsAll', box);
    const ttsProgEl = $('#rxTtsProgress', box);
    if (btnTtsAll) {
      let rxTtsRunning = false;
      let rxTtsAbort = false;
      btnTtsAll.onclick = async () => {
        const P = window.SCProto;
        if (rxTtsRunning) {
          rxTtsAbort = true;
          btnTtsAll.textContent = '⏹ 正在停止…';
          return;
        }
        const targets = [];
        (rx.reactionCards || []).forEach((card, cIdx) => {
          (card.lines || []).forEach((ln, lIdx) => {
            if (ln && String(ln.text || '').trim() && (!ln.voice || ln.voiceStale)) {
              targets.push({ card, cIdx, ln, lIdx });
            }
          });
        });
        if (!targets.length) {
          P && P.toast && P.toast('全部反应台词均已合成最新语音（如需重配可点单句 🎙 重配）');
          return;
        }
        const tc = resolveReactionTtsConfig({ silent: false });
        if (!tc) return;
        const origText = btnTtsAll.textContent;
        rxTtsRunning = true;
        rxTtsAbort = false;
        let okCount = 0;
        if (ttsProgEl) {
          ttsProgEl.hidden = false;
          ttsProgEl.textContent = `⏳ 准备为 ${targets.length} 句反应台词合成语音…`;
        }
        try {
          for (let i = 0; i < targets.length; i++) {
            if (rxTtsAbort) break;
            const t = targets[i];
            const im = W.idolMeta[t.card.charLabel] || { nameZh: t.card.charLabel };
            btnTtsAll.textContent = `⏹ 停止合成 (${i + 1}/${targets.length})`;
            if (ttsProgEl) {
              ttsProgEl.textContent = `⏳ 正在合成第 ${i + 1}/${targets.length} 句（${im.nameZh || t.card.charLabel}）…`;
            }
            try {
              const r = await synthesizeReactionLineTts(t.card, t.lIdx, { force: Boolean(t.ln.voiceStale), autoPlay: false, silent: true });
              if (r && r.ok) okCount++;
            } catch (_) {}
          }
          if (ttsProgEl) {
            ttsProgEl.textContent = rxTtsAbort
              ? `⏹ 已中止合成，完成 ${okCount}/${targets.length} 句`
              : `✅ 已完成全员语音合成：${okCount}/${targets.length} 句`;
          }
          P && P.toast && P.toast(
            rxTtsAbort
              ? `⏹ 已中止全员语音合成（已完成 ${okCount} 句）`
              : `🎙 已为反应合集合成 ${okCount}/${targets.length} 句语音！`,
            okCount ? undefined : 'warn'
          );
          renderReactionWorkbench(box);
        } finally {
          rxTtsRunning = false;
          rxTtsAbort = false;
          btnTtsAll.textContent = origText;
        }
      };
    }

    const inpJa = $('#rxTriggerJa', box);
    if (inpJa) inpJa.oninput = () => { rx.triggerPromptJa = inpJa.value; };
    const inpZh = $('#rxTriggerZh', box);
    if (inpZh) inpZh.oninput = () => { rx.triggerPromptZh = inpZh.value; };

    const btnCompileAll = $('#btnRxCompileAll', box);
    if (btnCompileAll) {
      btnCompileAll.onclick = () => compileAndPlayReactionWorkbench(null);
    }

    const btnRecordMp4 = $('#btnRxRecordMp4', box);
    if (btnRecordMp4) {
      btnRecordMp4.onclick = () => recordReactionWorkbenchMp4();
    }

    const selAdd = $('#rxAddIdolSelect', box);
    if (selAdd) {
      selAdd.onchange = async () => {
        const cid = selAdd.value;
        selAdd.value = '';
        if (!cid) return;
        const newCard = buildDefaultReactionCardClient(cid);
        try {
          const res = await fetch('/api/studio/generate-reaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              charLabel: cid,
              style: 'canonical',
              triggerPrompt: rx.triggerPromptJa,
              llmConfig: getLlmConfig()
            })
          });
          const data = await res.json();
          if (data && data.ok && data.card) Object.assign(newCard, data.card);
        } catch (_) {}
        rx.reactionCards.push(newCard);
        renderReactionWorkbench(box);
      };
    }

    $$('[data-rx-preset]', box).forEach((btn) => {
      btn.onclick = async () => {
        const preset = btn.dataset.rxPreset;
        const map = {
          canonical8: ['fuyuko', 'madoka', 'amana', 'tenka', 'hana', 'luca', 'mano', 'nichika'],
          heavy: ['fuyuko', 'madoka', 'amana', 'luca', 'mikoto', 'sakuya', 'rinze', 'nichika'],
          sweet: ['mano', 'hana', 'kogane', 'tooru', 'tenka', 'kaho', 'meguru', 'chiyoko'],
          cometik: ['hana', 'luca', 'haruki'],
          all28: allIdols
        };
        const targetCast = map[preset] || map.canonical8;
        const existingMap = new Map((rx.reactionCards || []).map((c) => [c.charLabel, c]));
        rx.reactionCards = targetCast.map((cid) => existingMap.get(cid) || buildDefaultReactionCardClient(cid));
        renderReactionWorkbench(box);
        if (window.SCProto && window.SCProto.toast) {
          window.SCProto.toast(`👥 已切换为「${btn.textContent}」（共 ${rx.reactionCards.length} 张反应卡）`);
        }
      };
    });

    $$('[data-rx-move]', box).forEach((btn) => {
      btn.onclick = () => {
        const idx = +btn.dataset.rxIdx;
        const delta = +btn.dataset.rxMove;
        const target = idx + delta;
        if (target < 0 || target >= rx.reactionCards.length) return;
        const tmp = rx.reactionCards[idx];
        rx.reactionCards[idx] = rx.reactionCards[target];
        rx.reactionCards[target] = tmp;
        renderReactionWorkbench(box);
      };
    });

    $$('[data-rx-del]', box).forEach((btn) => {
      btn.onclick = () => {
        const idx = +btn.dataset.rxDel;
        if (rx.reactionCards.length <= 1) return;
        rx.reactionCards.splice(idx, 1);
        renderReactionWorkbench(box);
      };
    });

    $$('[data-rx-bg]', box).forEach((sel) => {
      sel.onchange = () => {
        const idx = +sel.dataset.rxBg;
        if (rx.reactionCards[idx]) rx.reactionCards[idx].bg = sel.value;
      };
    });

    $$('[data-rx-bgm]', box).forEach((sel) => {
      sel.onchange = () => {
        const idx = +sel.dataset.rxBgm;
        if (rx.reactionCards[idx]) rx.reactionCards[idx].bgm = sel.value;
      };
    });

    $$('[data-rx-outfit]', box).forEach((sel) => {
      sel.onchange = () => {
        const idx = +sel.dataset.rxOutfit;
        const card = rx.reactionCards[idx];
        const P = window.SCProto;
        if (!card || !P || typeof P.getOutfitsForChar !== 'function') return;
        const spec = P.getOutfitsForChar(card.charLabel).find((o) => o.key === sel.value);
        if (spec) {
          card.outfitKey = spec.key || card.outfitKey;
          card.charType = spec.charType;
          card.charCategory = spec.charCategory;
          card.charId = spec.charId;
          card.clothId = spec.clothId || spec.charId;
        }
      };
    });

    $$('[data-rx-style]', box).forEach((btn) => {
      btn.onclick = async () => {
        const idx = +btn.dataset.rxIdx;
        const style = btn.dataset.rxStyle;
        const card = rx.reactionCards[idx];
        if (!card) return;
        btn.disabled = true;
        try {
          const res = await fetch('/api/studio/generate-reaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              charLabel: card.charLabel,
              style,
              triggerPrompt: rx.triggerPromptJa,
              llmConfig: getLlmConfig()
            })
          });
          const data = await res.json();
          if (data && data.ok && data.card) {
            card.style = style;
            card.lines = data.card.lines;
            renderReactionWorkbench(box);
            if (window.SCProto && window.SCProto.toast) {
              window.SCProto.toast(`🎭 已生成 ${card.charLabel} 的「${btn.textContent}」反应台词（0 OOC）！`);
            }
          }
        } catch (err) {
          if (window.SCProto && window.SCProto.toast) {
            window.SCProto.toast('✗ 生成反应失败：' + err.message, 'err');
          }
        } finally {
          btn.disabled = false;
        }
      };
    });

    $$('[data-rx-line-field]', box).forEach((inp) => {
      inp.oninput = inp.onchange = () => {
        const cIdx = +inp.dataset.rxIdx;
        const lIdx = +inp.dataset.lineIdx;
        const field = inp.dataset.rxLineField;
        const ln = rx.reactionCards[cIdx] && rx.reactionCards[cIdx].lines && rx.reactionCards[cIdx].lines[lIdx];
        if (ln) {
          ln[field] = inp.value;
          if (field === 'text' && ln.voice && ln.voiceText && String(inp.value).trim() !== String(ln.voiceText).trim()) {
            ln.voiceStale = true;
          }
        }
      };
    });

    $$('[data-rx-play-line]', box).forEach((btn) => {
      btn.onclick = () => {
        const cIdx = +btn.dataset.rxIdx;
        const lIdx = +btn.dataset.rxPlayLine;
        const ln = rx.reactionCards[cIdx] && rx.reactionCards[cIdx].lines && rx.reactionCards[cIdx].lines[lIdx];
        if (ln && (ln.audioUrl || ln.voice)) {
          playReactionAudioUrl(ln.audioUrl || ln.voice);
        }
      };
    });

    $$('[data-rx-tts-line]', box).forEach((btn) => {
      btn.onclick = async () => {
        const cIdx = +btn.dataset.rxIdx;
        const lIdx = +btn.dataset.rxTtsLine;
        const card = rx.reactionCards[cIdx];
        if (!card) return;
        const orig = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ 合成中…';
        try {
          const hadVoice = Boolean(card.lines && card.lines[lIdx] && card.lines[lIdx].voice);
          const data = await synthesizeReactionLineTts(card, lIdx, { force: hadVoice, autoPlay: true, silent: false });
          if (data && data.ok) {
            window.SCProto && window.SCProto.toast && window.SCProto.toast('🎙 语音合成成功并开始试听！');
            renderReactionWorkbench(box);
          }
        } catch (err) {
          window.SCProto && window.SCProto.toast && window.SCProto.toast('✗ 语音合成失败：' + err.message, 'err');
          btn.disabled = false;
          btn.textContent = orig;
        }
      };
    });

    $$('[data-rx-add-line]', box).forEach((btn) => {
      btn.onclick = () => {
        const cIdx = +btn.dataset.rxAddLine;
        const card = rx.reactionCards[cIdx];
        if (!card) return;
        const cid = card.charLabel || 'mano';
        const im = W.idolMeta[cid] || { selfJa: '私', pCallJa: 'プロデューサー', pCallZh: '制作人' };
        const pCallJa = im.pCallJa || 'プロデューサー';
        const pCallZh = im.pCallZh || '制作人';
        const selfJa = im.selfJa || '私';
        const noKeigo = ['luca', 'juri', 'mei', 'kogane', 'mamimi', 'tooru', 'hinana', 'natsuha', 'sakuya', 'yuika', 'tenka'].includes(cid);
        const addJa = cid === 'tenka'
          ? `にへへ……これからもずっと、${selfJa}の隣にいてね、${pCallJa}……。`
          : noKeigo
          ? `……もう、これからもずっと${selfJa}の隣にいてよ、${pCallJa}。`
          : `……もう、これからもずっと${selfJa}の隣にいてくださいね、${pCallJa}。`;
        card.lines = card.lines || [];
        card.lines.push({
          text: addJa,
          zh: `……真是的，今后也请一直留在我的身边哦，${pCallZh}。`,
          emotion: 'shy',
          se: '0453'
        });
        renderReactionWorkbench(box);
      };
    });

    $$('[data-rx-del-line]', box).forEach((btn) => {
      btn.onclick = () => {
        const cIdx = +btn.dataset.rxIdx;
        const lIdx = +btn.dataset.rxDelLine;
        const card = rx.reactionCards[cIdx];
        if (!card || !Array.isArray(card.lines) || card.lines.length <= 1) return;
        card.lines.splice(lIdx, 1);
        renderReactionWorkbench(box);
      };
    });

    $$('[data-rx-preview-single]', box).forEach((btn) => {
      btn.onclick = () => {
        const cIdx = +btn.dataset.rxPreviewSingle;
        const card = rx.reactionCards[cIdx];
        if (card) compileAndPlayReactionWorkbench(card.charLabel);
      };
    });

    $$('[data-rx-scsp]', box).forEach((btn) => {
      btn.onclick = () => openScspCorpusModal(btn.dataset.rxScsp);
    });
  }

  function attachVoicesToCompiledReactionScproj(scproj, rxCards, singleCharLabel) {
    if (!scproj || !Array.isArray(scproj.lines) || !Array.isArray(rxCards)) return;
    const activeCards = singleCharLabel ? rxCards.filter((c) => c.charLabel === singleCharLabel) : rxCards;
    const voiceByUid = new Map();
    activeCards.forEach((card, cIdx) => {
      (card.lines || []).forEach((ln, lIdx) => {
        if (ln && ln.voice) {
          voiceByUid.set(`rx_${cIdx + 1}_${lIdx + 1}`, ln.voice);
        }
      });
    });
    if (!voiceByUid.size) return;
    scproj.lines.forEach((lineObj) => {
      const uid = lineObj && lineObj._meta && lineObj._meta.uid;
      if (uid && voiceByUid.has(uid)) {
        lineObj.voice = voiceByUid.get(uid);
      }
    });
  }

  async function compileAndPlayReactionWorkbench(singleCharLabel, opts = {}) {
    const { autoPlay = true, syncDoc = true } = opts || {};
    const p = getActiveProject();
    if (!p) return null;
    const rx = ensureReactionStateFromProject(p);
    const P = window.SCProto;
    const targetProjectId = isReactionProject(p) ? p.id : 'reaction_idol_relation';
    try {
      if (P && P.toast) {
        P.toast(
          singleCharLabel
            ? `▶ 正在编译并试看 ${singleCharLabel} 的单人反应卡…`
            : `🎬 正在编译全员反应合集（${rx.reactionCards.length} 人）并推送至 :18899 真舞台…`
        );
      }
      const res = await fetch('/api/studio/compile-reaction-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: targetProjectId,
          title: isReactionProject(p) ? p.nameZh || p.name : '⚡ 当偶像们听到「我们只是制作人和偶像的关系」时的反应合集',
          triggerPromptJa: rx.triggerPromptJa,
          triggerPromptZh: rx.triggerPromptZh,
          defaultBg: rx.defaultBg || '00003',
          defaultBgm: rx.defaultBgm || '016',
          reactionCards: rx.reactionCards,
          singleCharLabel: singleCharLabel || undefined
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '编译反应合集失败');
      if (!singleCharLabel && Array.isArray(data.projects)) {
        W.projects = data.projects;
      }
      if (data.scproj && Array.isArray(data.scproj.lines)) {
        attachVoicesToCompiledReactionScproj(data.scproj, rx.reactionCards, singleCharLabel);
        if (syncDoc && P && P.S) {
          let seq = 0;
          P.S.doc = {
            packId: targetProjectId,
            sceneId: (data.scproj.meta && data.scproj.meta.id) || 'scene_01_reactions',
            pack: {
              ...(P.S.doc && P.S.doc.pack ? P.S.doc.pack : {}),
              id: targetProjectId,
              nameZh: isReactionProject(p) ? p.nameZh || p.name : '反应合集',
              characters: (data.scproj.meta && data.scproj.meta.characters) || {}
            },
            head: { format: 'scproj', formatVersion: 2 },
            meta: data.scproj.meta || {},
            rows: data.scproj.lines.map((l) => ({ key: 'k' + (++seq), line: l })),
            keySeq: seq
          };
          P.S.selKey = (P.S.doc.rows[0] && P.S.doc.rows[0].key) || 'k1';
        }
      }
      setStageViewMode('spine');
      if (P && typeof P.postToSpineStage === 'function' && data.scproj && Array.isArray(data.scproj.lines)) {
        P.postToSpineStage({
          type: 'sc-studio:load-doc',
          lines: data.scproj.lines,
          index: 0,
          play: Boolean(autoPlay)
        });
        if (autoPlay) {
          setTimeout(() => {
            P.postToSpineStage({
              type: 'sc-studio:load-doc',
              lines: data.scproj.lines,
              index: 0,
              play: true
            });
          }, 320);
        }
      }
      if (P && P.toast && autoPlay) {
        P.toast(
          singleCharLabel
            ? `✅ 正在右侧 :18899 真舞台播放 ${singleCharLabel} 的反应（${data.lineCount} 行 · OOC 0）！`
            : `✅ 已编译全员反应合集（${data.cardCount} 人 / ${data.lineCount} 行 · OOC 0）并在真舞台连播！`
        );
      }
      return data;
    } catch (err) {
      if (P && P.toast) P.toast('✗ 编译反应合集失败：' + err.message, 'err');
      return null;
    }
  }

  async function recordReactionWorkbenchMp4() {
    const P = window.SCProto;
    if (!P || typeof P.postToSpineStage !== 'function') return;
    if (W.stageRecordingState === 'countdown' || W.stageRecordingState === 'preparing' || W.stageRecordingState === 'recording') {
      P.postToSpineStage({ type: 'sc-studio:stop-record' });
      P.toast && P.toast('⏹ 正在停止录制并封装视频…');
      return;
    }
    if (W.stageRecordingState === 'remuxing') {
      P.toast && P.toast('⏳ 正在封装 MP4，请稍候…');
      return;
    }
    const compiled = await compileAndPlayReactionWorkbench(null, { autoPlay: false, syncDoc: true });
    if (!compiled || !compiled.scproj || !Array.isArray(compiled.scproj.lines) || !compiled.scproj.lines.length) {
      P.toast && P.toast('⚠ 编译反应合集失败，无法启动录制', 'warn');
      return;
    }
    setStageViewMode('spine');
    const qSel = $('#recQualitySelect');
    const presetVal = (qSel && qSel.value) || '1080p60';
    try { localStorage.setItem('sc_rec_preset', presetVal); } catch (_) {}
    const ifr = $('#realSpineIframe');
    try {
      if (ifr && ifr.contentWindow && typeof ifr.contentWindow.__unlockStageAudio === 'function') {
        ifr.contentWindow.__unlockStageAudio();
      }
    } catch (_) {}
    updateStudioRecordButtonUi('countdown', { rem: 3 });
    setTimeout(() => {
      P.postToSpineStage({ type: 'sc-studio:start-record', countdownSec: 3, preset: presetVal });
    }, 320);
    const labelText = (qSel && qSel.selectedOptions && qSel.selectedOptions[0]) ? qSel.selectedOptions[0].textContent : presetVal;
    P.toast && P.toast(`🎥 已将全员反应合集编译为单人 C 位演出并启动 3-2-1 录制（${labelText}）！`);
  }

  // ---------------------------------------------------------------------------
  // Task 3 · 💎 SCSP (D:\SCSPDownloader) Read-Only Corpus & CoMETIK Reference Modal
  // ---------------------------------------------------------------------------
  async function openScspCorpusModal(initialChar = 'hana') {
    const P = window.SCProto;
    if (!P || typeof P.openModal !== 'function') return;
    let curChar = initialChar || 'hana';
    let curQ = '';
    let summary = null;
    try {
      const sRes = await fetch('/api/studio/scsp-summary');
      summary = await sRes.json();
    } catch (_) {}

    const allIdols = Object.keys(W.idolMeta).length
      ? Object.keys(W.idolMeta)
      : ['hana', 'luca', 'haruki', 'fuyuko', 'madoka', 'amana', 'tenka', 'mano', 'nichika'];

    P.openModal(
      `
      <div class="modal-head">
        <h2>💎 SCSP 棱镜 (D:\\SCSPDownloader) 只读资源索引与 CoMETIK 语料参考</h2>
        <span class="grow"></span>
        <button class="ibtn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <div class="callout info" style="font-size:12px">
          🔒 <b>100% 只读接入</b>：已索引 <code>D:\\SCSPDownloader</code>（语音库 <b>${(summary && summary.stats && summary.stats.audioBankFiles) || 7936}</b> 个 · 语音条目 <b>${(summary && summary.stats && summary.stats.totalVoiceCues) || 58268}</b> 条 · 剧本文件 <b>${(summary && summary.stats && summary.stats.rawScenarioFiles) || 5135}</b> 篇 · 覆盖 <b>${(summary && Array.isArray(summary.characters) && summary.characters.length) || 28}</b> 位偶像，含 <b>CoMETIK 羽那 / 路加 / 阳希</b>）。
        </div>
        <div class="row-flex" style="gap:8px;flex-wrap:wrap">
          <span class="muted" style="font-size:11.5px;font-weight:700">☄️ CoMETIK 快捷切换：</span>
          <button type="button" class="chip-btn" data-scsp-char="hana">☄️ 铃木羽那 (hana)</button>
          <button type="button" class="chip-btn" data-scsp-char="luca">☄️ 斑鸠路加 (luca)</button>
          <button type="button" class="chip-btn" data-scsp-char="haruki">☄️ 郁田阳希 (haruki)</button>
          <select id="scspCharSel" style="font-size:12px;padding:4px 8px;border-radius:6px">
            ${allIdols
              .map((cid) => {
                const im = W.idolMeta[cid] || { speaker: cid, nameZh: cid, unit: '' };
                return `<option value="${esc(cid)}" ${cid === curChar ? 'selected' : ''}>${esc(im.nameZh || im.speaker)} (${esc(im.unit || cid)})</option>`;
              })
              .join('')}
          </select>
          <input type="search" id="scspQueryInp" placeholder="🔍 搜索日文原句或语境关键词…" style="flex:1;min-width:160px" />
        </div>
        <div id="scspLinesContainer" class="lib-list" style="max-height:340px;margin-top:8px">
          <div class="muted" style="padding:12px">⏳ 正在读取 SCSP 语料…</div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" data-close>关闭</button>
      </div>
    `,
      (m) => {
        const sel = $('#scspCharSel', m);
        const qInp = $('#scspQueryInp', m);
        const listBox = $('#scspLinesContainer', m);

        async function loadLines() {
          listBox.innerHTML = `<div class="muted" style="padding:12px">⏳ 正在读取 ${esc(curChar)} 的 SCSP 语料…</div>`;
          try {
            const res = await fetch(
              `/api/studio/scsp-lines?char=${encodeURIComponent(curChar)}&q=${encodeURIComponent(curQ)}&limit=30`
            );
            const data = await res.json();
            const lines = (data && data.lines) || [];
            if (!lines.length) {
              listBox.innerHTML = `<div class="muted" style="padding:12px">未找到匹配台词</div>`;
              return;
            }
            listBox.innerHTML = lines
              .map((ln, idx) => {
                const textJa = ln.textJa || ln.text || '';
                const textZh = ln.textZh || ln.zh || '';
                const cue = ln.cueId || ln.voice || '';
                return `
              <div class="lib-item" style="align-items:flex-start;padding:7px 10px">
                <code>#${idx + 1}</code>
                <div class="t" style="white-space:normal;line-height:1.45">
                  <div><b>${esc(textJa)}</b></div>
                  ${textZh ? `<div style="font-size:11.5px;color:var(--fg-muted,#64748b)">${esc(textZh)}</div>` : ''}
                  <div class="muted" style="font-size:11px">${esc(ln.storyTitle || ln.source || 'SCSP')} ${cue ? '· 🔊 ' + esc(cue) : ''}</div>
                </div>
                <button type="button" class="chip-btn" data-scsp-insert="${idx}">＋ 引用到台本</button>
              </div>
            `;
              })
              .join('');

            $$('[data-scsp-insert]', listBox).forEach((ibtn) => {
              ibtn.onclick = () => {
                const picked = lines[+ibtn.dataset.scspInsert];
                if (!picked) return;
                const rawJa = String(picked.textJa || picked.text || '').trim();
                const rawZh = String(picked.textZh || picked.zh || `（SCSP参考：${picked.storyTitle || '棱镜语料'}）`).trim();
                if (!rawJa) return;
                const im = W.idolMeta[curChar] || { speaker: curChar, nameZh: curChar };
                if (W.reactionWorkbenchActive) {
                  const p = getActiveProject();
                  const rx = ensureReactionStateFromProject(p);
                  let targetCard = (rx.reactionCards || []).find((c) => c.charLabel === curChar);
                  if (!targetCard) {
                    targetCard = buildDefaultReactionCardClient(curChar);
                    rx.reactionCards.push(targetCard);
                  }
                  targetCard.lines.push({
                    text: rawJa,
                    zh: rawZh,
                    emotion: picked.emotion || 'joy',
                    se: ''
                  });
                  renderReactionWorkbench($('#reactionWorkbench'));
                  P.closeModal();
                  P.toast(`💎 已将 ${im.nameZh || curChar} 的 SCSP 原句加入反应卡！`);
                  return;
                }
                if (P.S && P.S.doc) {
                  const curIdx = Math.max(0, P.S.doc.rows.findIndex((r) => r.key === P.S.selKey));
                  P.exec('插入 SCSP 参考台词', () => {
                    const nl = {
                      id: Date.now() % 1000000,
                      speaker: im.speaker || curChar,
                      charLabel: curChar,
                      text: rawJa,
                      textCtrl: 'p',
                      textFrame: '001',
                      _meta: {
                        uid: 'u_' + Date.now().toString(36),
                        zh: rawZh,
                        origin: 'custom'
                      }
                    };
                    const made = { key: 'k' + (++P.S.doc.keySeq), line: nl };
                    P.S.doc.rows.splice(curIdx + 1, 0, made);
                    P.S.selKey = made.key;
                  });
                  P.closeModal();
                  P.toast(`💎 已引用 ${im.nameZh || curChar} 的 SCSP 台词到当前行之后`);
                }
              };
            });
          } catch (err) {
            listBox.innerHTML = `<div class="muted" style="padding:12px">读取失败：${esc(err.message)}</div>`;
          }
        }

        $$('[data-scsp-char]', m).forEach((b) => {
          b.onclick = () => {
            curChar = b.dataset.scspChar;
            if (sel) sel.value = curChar;
            loadLines();
          };
        });
        if (sel) {
          sel.onchange = () => {
            curChar = sel.value;
            loadLines();
          };
        }
        if (qInp) {
          let t = null;
          qInp.oninput = () => {
            clearTimeout(t);
            curQ = qInp.value.trim();
            t = setTimeout(loadLines, 260);
          };
        }
        loadLines();
      }
    );
  }

  function loadProjectSnapshots(pid) {
    if (!pid) return [];
    try {
      const raw = localStorage.getItem(SNAPSHOT_PREFIX + pid);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function saveProjectSnapshot(p, reason = '手动保存') {
    if (!p || !p.id) return;
    const entry = {
      id: 'snap_' + Date.now().toString(36),
      savedAt: new Date().toLocaleString(),
      reason,
      stories: (p.stories || []).map((s) => ({
        id: s.id,
        title: s.title,
        titleZh: s.titleZh,
        bg: s.bg || '',
        bgm: s.bgm || '',
        bgmStyle: s.bgmStyle || '',
        cast: Array.isArray(s.cast) ? s.cast.slice() : [],
        castOutfits: Object.assign({}, s.castOutfits || {}),
        summary: s.summary || '',
        segments: JSON.parse(JSON.stringify(s.segments || [])),
        beats: JSON.parse(JSON.stringify(s.beats || [])),
        scriptRows: JSON.parse(JSON.stringify(s.scriptRows || []))
      }))
    };
    const list = [entry, ...loadProjectSnapshots(p.id)].slice(0, 10);
    while (list.length > 0) {
      try {
        localStorage.setItem(SNAPSHOT_PREFIX + p.id, JSON.stringify(list));
        return;
      } catch (_) {
        list.pop();
      }
    }
  }

  async function saveCurrentProjectExplicitly({ quiet = false } = {}) {
    const p = getActiveProject();
    const sc = getActiveScene();
    const P = window.SCProto;
    if (!p || !sc) return false;
    invalidateQuietRecompile();
    stashActiveProtoIntoSceneMemory();
    const dirtyIds = new Set(Array.from(W.dirtySceneIds || []));
    dirtyIds.add(sc.id);
    if (!quiet && P && P.toast) P.toast('💾 正在显式写入工程与剧本文件…');
    try {
      let latestProjects = null;
      for (const sid of dirtyIds) {
        const targetSc = (p.stories || []).find((s) => s.id === sid);
        if (!targetSc) continue;
        const scriptRows = (sid === sc.id) ? extractScriptRowsFromProtoDoc() : (targetSc.scriptRows || []);
        const castOutfits = { ...(targetSc.castOutfits || {}) };
        if (sid === sc.id && P && typeof P.getCurrentOutfitForChar === 'function') {
          for (const cid of (targetSc.cast || [])) {
            const oid = P.getCurrentOutfitForChar(cid);
            if (oid) castOutfits[cid] = oid;
          }
        }
        targetSc.castOutfits = castOutfits;
        delete targetSc.castHairs;
        const isPrecompiled = isScenePrecompiled(targetSc);
        let scprojLines;
        if (isPrecompiled) {
          targetSc.preservePrecompiled = true;
          if (sid === sc.id && P && P.S && P.S.doc && Array.isArray(P.S.doc.rows)) {
            scprojLines = P.S.doc.rows.map((r) => JSON.parse(JSON.stringify(r.line)));
          } else if (targetSc.scproj && Array.isArray(targetSc.scproj.lines)) {
            scprojLines = targetSc.scproj.lines;
          }
          if (scprojLines) {
            targetSc.scproj = targetSc.scproj || {};
            targetSc.scproj.lines = scprojLines;
          }
        }
        const res = await fetch('/api/studio/compile-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: p.id,
            sceneId: targetSc.id,
            title: targetSc.title,
            titleZh: targetSc.titleZh || targetSc.title,
            bg: targetSc.bg || '',
            bgm: targetSc.bgm || '',
            bgmStyle: targetSc.bgmStyle || '',
            cast: targetSc.cast || [],
            castOutfits,
            summary: targetSc.summary || '',
            segments: targetSc.segments || [],
            beats: targetSc.beats || [],
            scriptRows,
            ...(isPrecompiled ? { preservePrecompiled: true, scprojLines: scprojLines || [] } : {})
          })
        });
        const data = await res.json();
        if (res.status === 401 && data && data.authRequired) {
          openStudioAuthModal();
          throw new Error(data.error || '请输入访问口令后再保存到服务器');
        }
        if (!data || !data.ok) throw new Error((data && data.error) || `保存 ${sid} 失败`);
        if (data.playerScriptId) targetSc.playerScriptId = data.playerScriptId;
        if (Array.isArray(data.projects)) latestProjects = data.projects;
      }
      if (latestProjects) W.projects = latestProjects;
      const savedProj = getActiveProject() || p;
      const activeSavedSc = (savedProj.stories || []).find((s) => s.id === W.activeSceneId);
      if (activeSavedSc && P && P.S && P.S.doc && Array.isArray(P.S.doc.rows)) {
        if (savedProj.assets && P.S.doc.pack) {
          P.S.doc.pack.assets = savedProj.assets;
        }
        const byUid = new Map();
        (activeSavedSc.scriptRows || []).forEach((sr) => {
          if (sr && sr.rowId) byUid.set(sr.rowId, sr);
        });
        let archivedSynced = 0;
        P.S.doc.rows.forEach((rw) => {
          const ln = rw && rw.line;
          const uid = ln && ln._meta && ln._meta.uid;
          const sr = uid ? byUid.get(uid) : null;
          if (!sr) return;
          if (sr.voice && ln.voice !== sr.voice) {
            ln.voice = sr.voice;
            archivedSynced++;
          }
          if (Array.isArray(sr.takes) && ln._meta) {
            ln._meta.takes = sr.takes.map((t) => Object.assign({}, t));
          }
        });
        if (archivedSynced > 0 && typeof P.syncLoadDocToSpineStage === 'function') {
          P.syncLoadDocToSpineStage(false);
        }
      }
      saveProjectSnapshot(savedProj, '显式保存');
      W.dirtySceneIds.clear();
      W.isDirty = false;
      const tStr = new Date().toLocaleTimeString().slice(0, 5);
      if (P && typeof P.clearDirtyState === 'function') P.clearDirtyState('✓ 已保存 ' + tStr);
      renderSceneTree();
      if (!quiet && P && P.toast) P.toast(`💾 已正式保存工程「${savedProj.nameZh || savedProj.name}」并生成版本快照`);
      return true;
    } catch (err) {
      if (P && P.toast) P.toast('✗ 保存失败：' + (err && err.message ? err.message : err), 'err');
      return false;
    }
  }

  async function discardUnsavedChanges() {
    const P = window.SCProto;
    if (!window.confirm('确定放弃当前全部未保存改动，恢复到磁盘上次保存的版本吗？')) return;
    invalidateQuietRecompile();
    try {
      const res = await fetch('/api/studio/projects?lite=1');
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.projects)) {
        W.projects = data.projects;
      }
      W.isDirty = false;
      W.dirtySceneIds.clear();
      const targetProjId = W.activeProjectId;
      const targetSceneId = W.activeSceneId;
      selectProject(targetProjId, { force: true });
      if (targetSceneId) selectScene(targetSceneId);
      if (P && typeof P.clearDirtyState === 'function') P.clearDirtyState('↩ 已放弃未保存改动');
      if (P && P.toast) P.toast('↩ 已放弃未保存修改，恢复上次磁盘存档');
    } catch (err) {
      if (P && P.toast) P.toast('✗ 恢复失败：' + err.message, 'err');
    }
  }

  function openSnapshotHistoryModal() {
    const P = window.SCProto;
    const p = getActiveProject();
    if (!P || !p || typeof P.openModal !== 'function') return;
    const snaps = loadProjectSnapshots(p.id);
    P.openModal(
      `<div class="modal-head">
        <h2>🕘 工程快照历史（${esc(p.nameZh || p.name)} · 最近 ${snaps.length}/10 份）</h2>
        <span class="grow"></span>
        <button class="ibtn" data-close>✕</button>
      </div>
      <div class="modal-body">
        ${snaps.length ? snaps.map((sn, idx) => `
          <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
            <div>
              <b>#${idx + 1} · ${esc(sn.savedAt)}</b> <span class="badge">${esc(sn.reason || '保存')}</span>
              <div class="muted" style="font-size:11.5px;margin-top:3px">${(sn.stories || []).map((s) => `${esc(s.titleZh || s.title)}(${(s.scriptRows || []).length}行)`).join(' · ')}</div>
            </div>
            <button type="button" class="btn prism sm" data-restore-snap="${idx}">↩ 恢复到此快照</button>
          </div>`).join('') : '<div class="insp-empty">暂无快照记录。每次点击「💾 保存」时会自动生成可回滚快照（最多保留 10 份）。</div>'}
      </div>
      <div class="modal-foot"><span class="grow"></span><button class="btn ghost" data-close>关闭</button></div>`,
      (m) => {
        $$('[data-restore-snap]', m).forEach((btn) => {
          btn.onclick = () => {
            const sn = snaps[+btn.dataset.restoreSnap];
            if (!sn || !Array.isArray(sn.stories)) return;
            sn.stories.forEach((ss) => {
              const target = (p.stories || []).find((x) => x.id === ss.id);
              if (target) {
                Object.assign(target, JSON.parse(JSON.stringify(ss)));
                delete target.scproj;
                W.dirtySceneIds.add(target.id);
              }
            });
            W.isDirty = true;
            P.closeModal();
            recompileCurrentSceneQuietly(60);
            if (typeof P.markDirty === 'function') P.markDirty();
            P.toast(`🕘 已载入快照 #${+btn.dataset.restoreSnap + 1} 到编辑区（点「💾 保存」正式写入磁盘）`);
          };
        });
      }
    );
  }

  function copyOutfitsFromPrevScene() {
    const p = getActiveProject();
    const sc = getActiveScene();
    const P = window.SCProto;
    if (!p || !sc || !P) return;
    const idx = (p.stories || []).findIndex((s) => s.id === sc.id);
    if (idx <= 0) {
      P.toast && P.toast('当前已经是第 1 幕，没有上一幕穿搭可沿用', 'warn');
      return;
    }
    const prev = p.stories[idx - 1];
    const prevOutfits = prev.castOutfits || {};
    sc.castOutfits = sc.castOutfits || {};
    delete sc.castHairs;
    const copied = [];
    for (const cid of (sc.cast || [])) {
      if (prevOutfits[cid]) {
        sc.castOutfits[cid] = prevOutfits[cid];
        copied.push(cid);
        if (typeof P.getOutfitsForChar === 'function' && typeof P.applyOutfitToCharacter === 'function') {
          const spec = P.getOutfitsForChar(cid).find((o) => o.key === prevOutfits[cid] || `${o.charType}:${o.charCategory}:${o.charId}` === prevOutfits[cid]);
          if (spec) P.applyOutfitToCharacter(cid, spec, true);
        }
      }
    }
    if (!copied.length) {
      P.toast && P.toast('上一幕同角色未设定特殊服装，无需复制', 'warn');
      return;
    }
    W.isDirty = true;
    W.dirtySceneIds.add(sc.id);
    if (typeof P.markDirty === 'function') P.markDirty();
    if (typeof P.toast === 'function') P.toast(`👗 已从上一幕沿用 ${copied.join(' / ')} 的整套服装`);
  }

  function resolveCharLabelByName(rawName) {
    const clean = String(rawName || '').trim();
    if (!clean) return '';
    if (W.idolMeta && W.idolMeta[clean]) return clean;
    for (const [cid, info] of Object.entries(W.idolMeta || {})) {
      const candidates = [info.speaker, info.name, info.nameZh, info.shortName, cid].filter(Boolean);
      if (candidates.some((c) => c === clean || c.endsWith(clean) || clean.endsWith(c))) return cid;
    }
    return '';
  }

  function serializeDocRowsToBatchText() {
    const P = window.SCProto;
    if (!P || !P.S || !P.S.doc || !Array.isArray(P.S.doc.rows)) return '';
    const out = [];
    for (const wrap of P.S.doc.rows) {
      const l = wrap && wrap.line;
      if (!l) continue;
      const m = l._meta || {};
      if (m['x-autoGenerated'] || m.autoGenerated) continue;
      if (!l.text && !l.select) {
        if (m.note) out.push(`[演出] ${m.note}`);
        continue;
      }
      if (l.select && !l.text) {
        out.push(`[选项] ${m.selectZh || l.select}`);
        continue;
      }
      const txt = m.zh || l.text || '';
      if (!l.speaker || l.speaker === 'off' || l.speaker === '旁白') {
        out.push(`# ${txt}`);
      } else {
        out.push(`【${l.speaker}】${txt}`);
      }
    }
    return out.join('\n');
  }

  function applyBatchTextBackToDoc({ switchToCards = false } = {}) {
    const P = window.SCProto;
    const ta = $('#batchTextArea');
    if (!P || !P.S || !P.S.doc || !ta) return;
    const rawLines = String(ta.value || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const oldRows = P.S.doc.rows.filter((w) => w && w.line && (w.line.text || (w.line._meta && w.line._meta.note)));
    let nextSeq = P.S.doc.keySeq || oldRows.length;
    const newRows = [];
    rawLines.forEach((raw, idx) => {
      const matchedPrev = oldRows[idx] ? JSON.parse(JSON.stringify(oldRows[idx].line)) : null;
      if (raw.startsWith('#')) {
        const bodyTxt = raw.replace(/^#\s*/, '').trim();
        const ln = (matchedPrev && (!matchedPrev.speaker || matchedPrev.speaker === '旁白'))
          ? matchedPrev
          : { id: `${W.activeSceneId || 'sc'}_${String(idx + 1).padStart(3, '0')}`, speaker: '', text: bodyTxt, _meta: { uid: 'row_' + (idx + 1), origin: 'custom' } };
        ln.speaker = '';
        if (!ln._meta) ln._meta = {};
        const hadKana = /[\u3040-\u30ff]/.test(ln.text || '');
        ln._meta.zh = bodyTxt;
        if (!hadKana || !ln.text) ln.text = bodyTxt;
        newRows.push({ key: 'k' + (++nextSeq), line: ln });
        return;
      }
      if (raw.startsWith('[演出]')) {
        const note = raw.replace(/^\[演出\]\s*/, '').trim();
        const ln = { waitType: 'time', waitTime: 250, _meta: { uid: 'cue_' + (idx + 1), origin: 'custom', note } };
        newRows.push({ key: 'k' + (++nextSeq), line: ln });
        return;
      }
      const mSpk = raw.match(/^【([^】]+)】\s*(.+)$/) || raw.match(/^([^：:\s]{1,16})[：:]\s*(.+)$/);
      const spk = mSpk ? mSpk[1].trim() : '';
      const content = mSpk ? mSpk[2].trim() : raw;
      const cid = resolveCharLabelByName(spk) || (matchedPrev && matchedPrev.charLabel) || '';
      const ln = (matchedPrev && matchedPrev.speaker === spk)
        ? matchedPrev
        : {
            id: `${W.activeSceneId || 'sc'}_${String(idx + 1).padStart(3, '0')}`,
            speaker: spk,
            ...(cid ? { charLabel: cid } : {}),
            text: content,
            _meta: { uid: 'row_' + (idx + 1), origin: 'custom' }
          };
      ln.speaker = spk;
      if (cid && !ln.charLabel) ln.charLabel = cid;
      if (!ln._meta) ln._meta = {};
      const hadKana = /[\u3040-\u30ff]/.test(ln.text || '');
      ln._meta.zh = content;
      if (!hadKana || !ln.text) ln.text = content;
      newRows.push({ key: 'k' + (++nextSeq), line: ln });
    });
    if (!newRows.length) {
      P.toast && P.toast('连写内容为空，未覆盖原台本', 'warn');
      return;
    }
    P.exec('连写同步回台本卡片', () => {
      P.S.doc.rows = newRows;
      P.S.doc.keySeq = nextSeq;
      if (newRows[0]) P.S.selKey = newRows[0].key;
    });
    if (switchToCards) setScriptEditMode('cards', { applyBatch: false });
    P.toast && P.toast(`✓ 已将 ${newRows.length} 行连写内容同步回台本卡片`);
  }

  function setScriptLangMode(lang) {
    W.scriptLang = lang === 'zh' ? 'zh' : 'both';
    document.body.classList.toggle('lang-zh-only', W.scriptLang === 'zh');
    $$('#scriptLangSeg button').forEach((b) => b.classList.toggle('on', b.dataset.lang === W.scriptLang));
  }

  function setScriptEditMode(mode, { applyBatch = true } = {}) {
    const next = mode === 'batch' ? 'batch' : 'cards';
    if (next === W.scriptEditMode) return;
    if (next === 'batch') {
      const ta = $('#batchTextArea');
      if (ta) ta.value = serializeDocRowsToBatchText();
    } else if (applyBatch) {
      applyBatchTextBackToDoc({ switchToCards: false });
    }
    W.scriptEditMode = next;
    $$('#scriptEditModeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.editMode === next));
    const batchWrap = $('#batchTextWrap');
    const scriptList = $('#scriptList');
    if (batchWrap) batchWrap.hidden = next !== 'batch';
    if (scriptList) scriptList.hidden = next === 'batch';
  }

  function runStagePreflightCheck() {
    const P = window.SCProto;
    const sc = getActiveScene();
    if (!P || !P.S || !P.S.doc || typeof P.openModal !== 'function') return;
    const rList = P.S.doc.rows || [];
    const firstRow = rList[0] ? rList[0].line : {};
    const openBg = firstRow.bg || (sc && sc.bg) || '';
    const openBgm = firstRow.bgm || (sc && sc.bgm) || '';
    const firstDlgIdx = rList.findIndex((r) => r && r.line && r.line.text && r.line.speaker);
    const firstDlg = firstDlgIdx >= 0 ? rList[firstDlgIdx].line : null;
    let maxVis = 0;
    let oocCount = 0;
    let totalMs = 0;
    for (let i = 0; i < rList.length; i++) {
      const st = P.stageAt(i);
      const visCount = Object.values((st && st.chars) || {}).filter((c) => c && c.visible).length;
      if (visCount > maxVis) maxVis = visCount;
      oocCount += (P.checkLine(rList[i].line) || []).filter((f) => f.sev !== 'info').length;
      if (typeof P.estDur === 'function') totalMs += P.estDur(rList[i].line);
    }
    const issues = [];
    if (!openBg) issues.push('首帧缺少默认背景 (BG)');
    if (!openBgm) issues.push('首帧缺少默认配乐 (BGM)');
    if (firstDlg && !firstDlg.charAnim1) issues.push(`首句台词（第 ${firstDlgIdx + 1} 行）未设置起手身体动作 charAnim1`);
    if (maxVis > 3) issues.push(`同屏最多出现 ${maxVis} 人（超过官方 Spine 3 人上限，建议编译分镜切屏）`);
    if (oocCount > 0) issues.push(`存在 ${oocCount} 项 OOC 提醒`);

    const okBadge = (pass, lbl) => `<div style="display:flex;justify-content:space-between;padding:6px 10px;border-radius:8px;background:var(--glass);border:1px solid var(--line)"><span>${lbl}</span><b>${pass ? '✅ 正常' : '⚠️ 需关注'}</b></div>`;
    P.openModal(
      `<div class="modal-head"><h2>🩺 Step 3 · 1 秒舞台演出体检报告</h2><span class="grow"></span><button class="ibtn" data-close>✕</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:8px">
        ${okBadge(Boolean(openBg), `开场默认背景 (BG ${esc(openBg || '未设')})`)}
        ${okBadge(Boolean(openBgm), `开场默认配乐 (BGM ${esc(openBgm || '未设')})`)}
        ${okBadge(!(firstDlg && !firstDlg.charAnim1), `首句起手动作 (${esc(firstDlg ? (firstDlg.charAnim1 || '缺失') : '无台词')})`)}
        ${okBadge(maxVis <= 3, `同屏最多立绘数 (${maxVis} / 3 人)`)}
        ${okBadge(oocCount === 0, `30 人人设 OOC 校验 (待处理 ${oocCount} 项)`)}
        <div class="callout info">⏱ 预估全幕总时长：<b>${(totalMs / 1000).toFixed(1)} 秒</b> · 共 ${rList.length} 行${issues.length ? '<br>建议：' + esc(issues.join('；')) : '<br>✨ 各项指标就绪，可直接点击「🎥 录制 MP4」！'}</div>
      </div>
      <div class="modal-foot"><span class="grow"></span><button class="btn prism" data-close>知道了</button></div>`
    );
  }

  function updateStudioRecordButtonUi(recState, extra = {}) {
    W.stageRecordingState = recState || 'idle';
    const qSel = $('#recQualitySelect');
    if (qSel) qSel.disabled = !!(recState && recState !== 'idle');
    const applyBtn = (btn, idleLabel) => {
      if (!btn) return;
      btn.classList.remove('recording', 'on');
      btn.disabled = false;
      if (recState === 'countdown') {
        btn.textContent = `⏹ 取消倒计时 (${extra.rem || 3}s)`;
        btn.classList.add('on');
      } else if (recState === 'preparing') {
        btn.textContent = '⏹ 取消预热…';
        btn.classList.add('on');
      } else if (recState === 'recording') {
        btn.textContent = '⏹ 停止保存';
        btn.classList.add('on');
      } else if (recState === 'remuxing') {
        btn.textContent = '⏳ 封装 MP4…';
        btn.disabled = true;
      } else {
        btn.textContent = idleLabel;
      }
    };
    applyBtn($('#btnObsRecord'), '🎥 录制 MP4');
    applyBtn($('#btnRxRecordMp4'), '🎥 录制合集 MP4');
  }

  function triggerStageRecording() {
    const P = window.SCProto;
    if (!P || typeof P.postToSpineStage !== 'function') return;
    if (W.stageRecordingState === 'countdown' || W.stageRecordingState === 'preparing' || W.stageRecordingState === 'recording') {
      P.postToSpineStage({ type: 'sc-studio:stop-record' });
      P.toast && P.toast('⏹ 正在停止录制并封装视频…');
      return;
    }
    if (W.stageRecordingState === 'remuxing') {
      P.toast && P.toast('⏳ 正在封装 MP4，请稍候…');
      return;
    }
    if (!P.S || !P.S.doc || !Array.isArray(P.S.doc.rows) || !P.S.doc.rows.length) {
      P.toast && P.toast('⚠ 当前没有可录制的剧本内容', 'warn');
      return;
    }
    if (document.body.classList.contains('mode-muse') || document.body.classList.contains('mode-polish')) {
      P.setMode('stage');
    }
    setStageViewMode('spine');
    const qSel = $('#recQualitySelect');
    const presetVal = (qSel && qSel.value) || '1080p60';
    try { localStorage.setItem('sc_rec_preset', presetVal); } catch (_) {}
    const ifr = $('#realSpineIframe');
    try {
      if (ifr && ifr.contentWindow && typeof ifr.contentWindow.__unlockStageAudio === 'function') {
        ifr.contentWindow.__unlockStageAudio();
      }
    } catch (_) {}
    if (typeof P.syncLoadDocToSpineStage === 'function') P.syncLoadDocToSpineStage(false);
    updateStudioRecordButtonUi('countdown', { rem: 3 });
    setTimeout(() => {
      P.postToSpineStage({ type: 'sc-studio:start-record', countdownSec: 3, preset: presetVal });
    }, 220);
    const labelText = (qSel && qSel.selectedOptions && qSel.selectedOptions[0]) ? qSel.selectedOptions[0].textContent : presetVal;
    P.toast && P.toast(`🎥 已启动 3-2-1 录制（${labelText}），播放完毕后将自动封装 MP4`);
  }

  async function refreshStudioAuthStatus() {
    const btn = $('#btnStudioAuth');
    try {
      const res = await fetch('/api/studio/auth-status');
      const data = await res.json();
      if (!data || !data.ok) return;
      W.authRequired = Boolean(data.authRequired);
      W.authenticated = Boolean(data.authenticated);
      W.authInfo = {
        canWrite: Boolean(data.canWrite),
        canUseServerKeys: Boolean(data.canUseServerKeys),
        userId: String(data.userId || ''),
        role: String(data.role || 'guest'),
        accountsEnabled: Boolean(data.accountsEnabled),
        serverLlm: data.serverLlm || null
      };
      if (btn) {
        btn.hidden = !W.authRequired;
        if (W.authRequired) {
          if (W.authenticated && W.authInfo.role === 'ai') {
            btn.textContent = `🔑 ${W.authInfo.userId || '专享'} · AI可用`;
            btn.title = `已登录专享账号（${W.authInfo.userId}）：可用服务器 AI/语音 Key，不可修改服务器存盘工程，可本地导出`;
          } else if (W.authenticated) {
            btn.textContent = '🔓 已解锁';
            btn.title = '已输入管理员授权，可使用全部 AI / 配音与服务器保存';
          } else {
            btn.textContent = '🔒 访客模式';
            btn.title = '当前为公网访客试用模式，点击用专属账号密码或口令登录';
          }
        }
      }
      if (W.lastGenerator !== 'llm') {
        updateGeneratorBadges('', '', null);
      } else {
        updateGeneratorBadges();
      }
      await ensureAutoFishTtsConfig(true);
      const P = window.SCProto;
      if (P && P.S && P.S.mode === 'muse') renderStep1OutlinePanel($('#musePanel'));
    } catch (_) {}
  }

  function openStudioAuthModal() {
    const P = window.SCProto;
    if (!P || typeof P.openModal !== 'function') return;
    const info = W.authInfo || {};
    const isAiOnly = W.authenticated && info.role === 'ai';
    P.openModal(`
      <div class="modal-head">
        <h2>${W.authenticated ? (isAiOnly ? `🔑 已登录账号：${esc(info.userId || '专享')}` : '🔓 管理员授权管理') : '🔒 账号登录 / 访问口令'}</h2>
        <span class="grow"></span>
        <button class="ibtn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <div class="callout info">
          ${W.authenticated
            ? (isAiOnly
              ? `当前使用专属账号 <b>${esc(info.userId)}</b> 登录：已解锁服务器配置的 AI 与配音额度；为防覆盖作者工程，服务器存盘写入仍锁定（可随时本地导出 .scpack.zip 或 MP4）。`
              : '当前浏览器已通过管理员验证，可保存工程到服务器并调用服务器配置的 AI 与配音额度。')
            : '当前网站开启了公网防护：未登录可免费浏览、编辑预览、本地导出或自填 API Key；拥有管理员给的「专属账号 + 密码」或「访问口令」登录后可使用服务器配置的 AI / 语音 Key。'}
        </div>
        <label class="fld" style="margin-top:10px;">
          <span>账号 ID <small class="muted">(使用专属账号时填写；管理员纯口令可留空)</small></span>
          <input type="text" id="studioAuthUserInp" value="${esc(W.authenticated ? (info.userId || '') : '')}" placeholder="例如 123（留空则按访问口令验证）" autocomplete="username" />
        </label>
        <label class="fld" style="margin-top:8px;">
          <span>密码 / 访问口令</span>
          <input type="password" id="studioAuthTokenInp" placeholder="请输入密码或访问口令" autocomplete="current-password" />
        </label>
        <div id="studioAuthMsg" class="muted" style="margin-top:8px;min-height:18px;"></div>
      </div>
      <div class="modal-foot">
        ${W.authenticated ? '<button type="button" class="btn ghost" id="btnStudioLogout">退出登录</button>' : ''}
        <button type="button" class="btn ghost" data-close>取消</button>
        <button type="button" class="btn prism" id="btnStudioAuthSubmit">✓ 登录 / 解锁</button>
      </div>
    `, (m) => {
      const uInp = $('#studioAuthUserInp', m);
      const inp = $('#studioAuthTokenInp', m);
      const msg = $('#studioAuthMsg', m);
      const submit = async () => {
        const username = String((uInp && uInp.value) || '').trim();
        const secret = String((inp && inp.value) || '').trim();
        if (!secret) {
          if (msg) msg.textContent = '请先输入密码或访问口令';
          return;
        }
        try {
          const payload = username ? { username, password: secret } : { token: secret };
          const r = await fetch('/api/studio/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const d = await r.json();
          if (!r.ok || !d.ok) {
            if (msg) msg.textContent = '✗ ' + ((d && d.error) || '账号或口令不正确');
            return;
          }
          await refreshStudioAuthStatus();
          P.closeModal && P.closeModal();
          P.toast && P.toast(
            d.role === 'ai'
              ? `🔑 已登录账号「${d.userId}」，已解锁服务器 AI / 语音 Key`
              : '🔓 验证成功，已解锁全部功能'
          );
        } catch (err) {
          if (msg) msg.textContent = '✗ 验证失败：' + err.message;
        }
      };
      const btnSub = $('#btnStudioAuthSubmit', m);
      if (btnSub) btnSub.onclick = submit;
      if (uInp) uInp.onkeydown = (e) => { if (e.key === 'Enter') { inp && inp.focus(); } };
      if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
      const btnOut = $('#btnStudioLogout', m);
      if (btnOut) {
        btnOut.onclick = async () => {
          await fetch('/api/studio/logout', { method: 'POST' });
          await refreshStudioAuthStatus();
          P.closeModal && P.closeModal();
          P.toast && P.toast('🔒 已切回访客试用模式');
        };
      }
      setTimeout(() => (uInp && !uInp.value ? uInp : inp)?.focus(), 50);
    });
  }

  async function initWorkflow() {
    // Wire buttons
    const btnNewProj = $('#btnNewProject');
    if (btnNewProj) btnNewProj.onclick = openNewProjectModal;

    const btnRxTop = $('#btnReactionWorkbenchTop');
    if (btnRxTop) {
      btnRxTop.onclick = () => {
        if (!W.reactionWorkbenchActive) {
          const rxProj = W.projects.find((x) => isReactionProject(x) || x.id === 'reaction_idol_relation');
          if (rxProj && W.activeProjectId !== rxProj.id) {
            selectProject(rxProj.id);
            return;
          }
          setReactionWorkbenchActive(true);
        } else {
          if (isReactionProject(getActiveProject())) {
            window.SCProto && window.SCProto.toast && window.SCProto.toast('当前为独立反应合集工程，如需创作连续故事请从顶栏「📦 工程」切换或新建故事工程');
            return;
          }
          setReactionWorkbenchActive(false);
        }
      };
    }

    const topExitRx = $('#rxModeTopBanner #btnRxExitToStory');
    if (topExitRx) {
      topExitRx.onclick = () => {
        if (isReactionProject(getActiveProject())) return;
        setReactionWorkbenchActive(false);
      };
    }

    const btnScspTop = $('#btnScspCorpusTop');
    if (btnScspTop) {
      btnScspTop.onclick = () => openScspCorpusModal('hana');
    }

    const btnAddScene = $('#btnAddScene');
    if (btnAddScene) btnAddScene.onclick = addNewSceneToActiveProject;

    const btnCompile = $('#btnStep2Compile');
    if (btnCompile) btnCompile.onclick = () => compileCurrentSceneAndGoStep3(false);

    const btnPush = $('#btnPushPlayer');
    if (btnPush) btnPush.onclick = () => compileCurrentSceneAndGoStep3(true);

    const btnPushTop = $('#btnPushPlayerTop');
    if (btnPushTop) btnPushTop.onclick = () => compileCurrentSceneAndGoStep3(true);

    const btnPlayAllTop = $('#btnPlayAllTop');
    if (btnPlayAllTop) btnPlayAllTop.onclick = playAllProjectScenes;

    const btnPlayAllScenes = $('#btnPlayAllScenes');
    if (btnPlayAllScenes) btnPlayAllScenes.onclick = playAllProjectScenes;

    const btnGlobalOv = $('#btnGlobalOverview');
    if (btnGlobalOv) btnGlobalOv.onclick = () => openGlobalScriptOverviewModal();

    const btnExportMergedTop = $('#btnExportMergedTop');
    if (btnExportMergedTop) btnExportMergedTop.onclick = exportMergedProjectScproj;

    const btnExportMergedScproj = $('#btnExportMergedScproj');
    if (btnExportMergedScproj) btnExportMergedScproj.onclick = exportMergedProjectScproj;

    const closeToolsMenu = () => {
      const tm = $('#topbarToolsMenu');
      const tb = $('#btnTopbarTools');
      if (tm) tm.hidden = true;
      if (tb) tb.setAttribute('aria-expanded', 'false');
    };

    const btnExportPackZipTop = $('#btnExportPackZipTop');
    if (btnExportPackZipTop) btnExportPackZipTop.onclick = () => {
      closeToolsMenu();
      exportPackZip();
    };

    const importZipInput = $('#importPackZipInput');
    const btnImportPackZipTop = $('#btnImportPackZipTop');
    if (btnImportPackZipTop && importZipInput) {
      btnImportPackZipTop.onclick = () => {
        closeToolsMenu();
        importZipInput.value = '';
        importZipInput.click();
      };
      importZipInput.onchange = () => {
        const f = importZipInput.files && importZipInput.files[0];
        if (f) importPackZipFromFile(f);
      };
    }

    const btnCleanupTtsTop = $('#btnCleanupTtsCacheTop');
    if (btnCleanupTtsTop) btnCleanupTtsTop.onclick = () => {
      closeToolsMenu();
      cleanupUnusedTtsCacheFromUi();
    };

    const btnLlmSettings = $('#btnLlmSettings');
    if (btnLlmSettings) btnLlmSettings.onclick = () => openLlmSettingsModal('llm');

    $$('.js-save-proj-btn').forEach((btn) => {
      btn.onclick = () => saveCurrentProjectExplicitly({ quiet: false });
    });
    $$('.js-discard-proj-btn').forEach((btn) => {
      btn.onclick = discardUnsavedChanges;
    });
    const btnBack2 = $('#btnBackToStep2');
    if (btnBack2) btnBack2.onclick = () => window.SCProto && window.SCProto.setMode && window.SCProto.setMode('polish');
    const btnQuickGo3 = $('#btnQuickGoStep3');
    if (btnQuickGo3) btnQuickGo3.onclick = () => compileCurrentSceneAndGoStep3(false);

    const btnSnapHist = $('#btnSnapshotHistory');
    if (btnSnapHist) btnSnapHist.onclick = openSnapshotHistoryModal;

    const btnDirDrawer = $('#btnDirectorDrawer');
    if (btnDirDrawer) {
      btnDirDrawer.onclick = () => {
        const dr = $('#directorDrawer');
        if (!window.SCProto) return;
        if (dr && !dr.hidden) window.SCProto.closeDirectorDrawer && window.SCProto.closeDirectorDrawer();
        else window.SCProto.openDirectorDrawer && window.SCProto.openDirectorDrawer();
      };
    }

    const btnCloseDirDrawer = $('#btnCloseDirectorDrawer');
    if (btnCloseDirDrawer) {
      btnCloseDirDrawer.onclick = () => window.SCProto && window.SCProto.closeDirectorDrawer && window.SCProto.closeDirectorDrawer();
    }

    const openPopoutStageWin = () => {
      const sid = encodeURIComponent(resolveScenePlayerId(getActiveProject(), getActiveScene() || W.activeSceneId || 'scene_01_harbor'));
      const w = window.open(`/player/?cat=custom&id=${sid}&theater=1&popout=stage`, 'sc_popout_stage', 'width=1280,height=760');
      if (w && window.SCProto) {
        window.SCProto.S.popoutStageWin = w;
        window.__SC_POPOUT_STAGE_WIN = w;
        setTimeout(() => window.SCProto.syncLoadDocToSpineStage && window.SCProto.syncLoadDocToSpineStage(false), 900);
      }
    };
    const btnPopStage = $('#btnPopoutStage');
    if (btnPopStage) btnPopStage.onclick = openPopoutStageWin;

    const openPopoutAssistantWin = () => {
      window.open('/proto/?popout=assistant', 'sc_popout_assistant', 'width=480,height=780');
    };
    const btnPopAst = $('#btnPopoutAssistant');
    if (btnPopAst) btnPopAst.onclick = openPopoutAssistantWin;
    const btnPopAstDrawer = $('#btnPopoutAssistantInDrawer');
    if (btnPopAstDrawer) btnPopAstDrawer.onclick = openPopoutAssistantWin;

    const langSeg = $('#scriptLangSeg');
    if (langSeg) {
      langSeg.onclick = (e) => {
        const b = e.target.closest('button[data-lang]');
        if (b) setScriptLangMode(b.dataset.lang);
      };
    }

    const editModeSeg = $('#scriptEditModeSeg');
    if (editModeSeg) {
      editModeSeg.onclick = (e) => {
        const b = e.target.closest('button[data-edit-mode]');
        if (b) setScriptEditMode(b.dataset.editMode);
      };
    }

    const btnApplyBatch = $('#btnApplyBatchText');
    if (btnApplyBatch) btnApplyBatch.onclick = () => applyBatchTextBackToDoc({ switchToCards: true });

    const btnPreflight = $('#btnPreflightCheck');
    if (btnPreflight) btnPreflight.onclick = runStagePreflightCheck;

    const btnObsRec = $('#btnObsRecord');
    if (btnObsRec) btnObsRec.onclick = triggerStageRecording;

    const recQSel = $('#recQualitySelect');
    if (recQSel) {
      try {
        const savedQ = localStorage.getItem('sc_rec_preset');
        if (savedQ && Array.from(recQSel.options).some((o) => o.value === savedQ)) {
          recQSel.value = savedQ;
        }
      } catch (_) {}
      recQSel.addEventListener('change', () => {
        try { localStorage.setItem('sc_rec_preset', recQSel.value); } catch (_) {}
      });
    }

    const btnTogMt = $('#btnToggleMultitrack');
    if (btnTogMt) {
      btnTogMt.onclick = () => {
        const expanded = document.body.classList.toggle('tl-expanded');
        btnTogMt.classList.toggle('on', expanded);
      };
    }

    updateGeneratorBadges();

    window.addEventListener('message', (e) => {
      const d = e && e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'sc-studio:record-state') {
        updateStudioRecordButtonUi(d.state || 'idle', d);
        if (d.state === 'done') {
          window.SCProto && window.SCProto.toast && window.SCProto.toast(
            d.fallback
              ? `⚠ 已导出原始视频 ${d.filename || ''}（${d.warning || '未封装'}）`
              : `✅ 已导出可拖动 MP4：${d.filename || ''} (${((d.sizeBytes || 0) / 1048576).toFixed(1)} MB)`,
            d.fallback ? 'warn' : 'ok'
          );
          updateStudioRecordButtonUi('idle');
        } else if (d.state === 'error') {
          window.SCProto && window.SCProto.toast && window.SCProto.toast('✗ 录制失败：' + (d.error || '未知错误'), 'err');
          updateStudioRecordButtonUi('idle');
        }
        return;
      }
      if (W.playAllState && W.playAllState.active && typeof d.index === 'number') {
        W.playAllState.currentLineEstimate = d.index;
        const matched = (W.playAllState.sceneRanges || []).find(
          (r) => d.index >= r.startIndex && d.index <= r.endIndex
        );
        if (matched && matched.sceneId !== W.playAllState.currentSceneId) {
          W.playAllState.currentSceneId = matched.sceneId;
          W.activeSceneId = matched.sceneId;
          renderMultiScenePlayBanner();
          renderSceneTree();
        }
      }
    });

    const stageSeg = $('#stageViewModeSeg');
    if (stageSeg) {
      stageSeg.onclick = (e) => {
        const b = e.target.closest('button[data-stage-view]');
        if (!b) return;
        setStageViewMode(b.dataset.stageView);
      };
    }

    const btnReloadSpine = $('#btnReloadSpineStage');
    if (btnReloadSpine) {
      btnReloadSpine.onclick = () => {
        const iframe = $('#realSpineIframe');
        if (iframe && W.activeSceneId) {
          const playerId = resolveScenePlayerId(getActiveProject(), getActiveScene() || W.activeSceneId) || W.activeSceneId;
          iframe.dataset.currentScene = playerId;
          iframe.src = `/player/?cat=custom&id=${encodeURIComponent(playerId)}&theater=1&_t=${Date.now()}`;
          setStageViewMode('spine');
          window.SCProto.toast('↻ 已刷新真 Spine 实时舞台');
        }
      };
    }

    const btnSanitizeActions = $('#btnSanitizeActions');
    if (btnSanitizeActions) {
      btnSanitizeActions.onclick = async () => {
        const P = window.SCProto;
        const docRows = (P && P.S && P.S.doc && Array.isArray(P.S.doc.rows)) ? P.S.doc.rows : [];
        const targetIndices = [];
        const payloadRows = [];
        docRows.forEach((rowWrap, idx) => {
          const ln = (rowWrap && rowWrap.line) ? rowWrap.line : rowWrap;
          if (!ln || !ln.speaker || (!ln.text && !(ln._meta && ln._meta.zh))) return;
          const m = ln._meta || {};
          targetIndices.push(idx);
          payloadRows.push({
            rowId: idx,
            speaker: ln.speaker,
            charLabel: ln.charLabel || ln.speaker,
            zh: m.zh || ln.zh || '',
            text: ln.text || '',
            note: m.note || '',
            stageAction: m.stageAction || ''
          });
        });
        if (!payloadRows.length) {
          P && P.toast && P.toast('当前幕暂无可检测的台词行');
          return;
        }
        btnSanitizeActions.disabled = true;
        try {
          const res = await fetch('/api/studio/sanitize-actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: payloadRows })
          });
          const data = await res.json();
          if (!data || !data.ok || !Array.isArray(data.rows)) {
            throw new Error((data && data.error) || '重检舞台动作失败');
          }
          let changed = 0;
          data.rows.forEach((fixed, k) => {
            const docIdx = targetIndices[k];
            const rowWrap = docRows[docIdx];
            const ln = (rowWrap && rowWrap.line) ? rowWrap.line : rowWrap;
            if (!ln) return;
            if (!ln._meta) ln._meta = {};
            const oldAction = String(ln._meta.stageAction || '').trim();
            const newAction = String((fixed && fixed.stageAction) || '').trim();
            if (oldAction !== newAction) {
              if (newAction) ln._meta.stageAction = newAction;
              else delete ln._meta.stageAction;
              changed++;
            }
          });
          if (changed > 0) {
            P.renderScript && P.renderScript();
            P.markDirty && P.markDirty();
            P.toast && P.toast(`🧹 已自动修正 ${changed} 处舞台动作与站位冲突`);
          } else {
            P.toast && P.toast('🧹 未发现舞台动作与站位冲突');
          }
        } catch (err) {
          P && P.toast && P.toast(`重检舞台动作失败: ${err.message}`);
        } finally {
          btnSanitizeActions.disabled = false;
        }
      };
    }

    const btnStep2TableRead = $('#btnStep2TableRead');
    if (btnStep2TableRead) {
      btnStep2TableRead.onclick = () => {
        const P = window.SCProto;
        if (P && typeof P.toggleTableRead === 'function') {
          P.toggleTableRead();
        }
      };
    }

    const btnStep2TtsLine = $('#btnStep2TtsLine');
    if (btnStep2TtsLine) {
      btnStep2TtsLine.onclick = async () => {
        const P = window.SCProto;
        if (!P || !P.S || !P.S.doc || !Array.isArray(P.S.doc.rows)) return;
        const rowsArr = P.S.doc.rows;
        let idx = rowsArr.findIndex((r) => r.key === P.S.selKey);
        if (idx < 0 || !rowsArr[idx].line || rowsArr[idx].line.text === undefined) {
          idx = rowsArr.findIndex((r) => r.line && r.line.speaker && r.line.text !== undefined && r.line.speaker !== 'プロデューサー');
        }
        if (idx < 0) {
          P.toast && P.toast('当前幕暂无可试听的台词行', 'warn');
          return;
        }
        const ln = rowsArr[idx].line;
        const rKey = rowsArr[idx].key;
        const isStale = Boolean(ln && ln.voice && ln._meta && ln._meta.voiceStale);
        if (ln && ln.voice && !isStale && typeof P.playRealAudio === 'function') {
          P.playRealAudio(ln.voice, () => P.synthTtsTake && P.synthTtsTake(idx, { force: true }), { rowKey: rKey });
          return;
        }
        if (typeof P.synthTtsTake === 'function') {
          btnStep2TtsLine.disabled = true;
          try {
            await P.synthTtsTake(idx, { force: isStale });
          } finally {
            btnStep2TtsLine.disabled = false;
          }
        }
      };
    }

    const btnStep2TtsScene = $('#btnStep2TtsScene');
    if (btnStep2TtsScene) {
      let batchTtsRunning = false;
      let batchTtsAbort = false;
      btnStep2TtsScene.onclick = async () => {
        const P = window.SCProto;
        if (!P || !P.S || !P.S.doc || !Array.isArray(P.S.doc.rows) || typeof P.synthTtsTake !== 'function') return;
        if (batchTtsRunning) {
          batchTtsAbort = true;
          btnStep2TtsScene.textContent = '⏹ 正在停止…';
          return;
        }
        const rowsArr = P.S.doc.rows;
        const targetRows = rowsArr
          .filter((r) => r && r.line && r.line.text && r.line.speaker && !['プロデューサー', '制作人', 'ナレーション', '旁白'].includes(r.line.speaker) && (!r.line.voice || (r.line._meta && r.line._meta.voiceStale)));
        const targetKeys = targetRows.map((r) => r.key);
        if (!targetKeys.length) {
          P.toast && P.toast('本幕偶像台词均已有最新语音（如需重配可点击单句右侧 ↻）');
          return;
        }
        const staleCount = targetRows.filter((r) => Boolean(r.line && r.line.voice && r.line._meta && r.line._meta.voiceStale)).length;
        const unvoicedCount = targetKeys.length - staleCount;
        const totalChars = targetRows.reduce((sum, r) => {
          const m = (r.line && r.line._meta) || {};
          return sum + String(m.ttsText ?? r.line.text ?? '').trim().length;
        }, 0);
        let creditLine = '';
        try {
          const tc = getTtsConfig();
          if (!tc.provider || tc.provider === 'cloud_fish' || tc.provider === 'off') {
            const hRes = await fetch('/api/studio/tts/health', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ttsConfig: { ...tc, provider: (!tc.provider || tc.provider === 'off') ? 'cloud_fish' : tc.provider } })
            });
            const hData = await hRes.json();
            if (hData && hData.credit !== null && hData.credit !== undefined) {
              creditLine = `\n当前 Fish Audio 账户余量：${hData.credit}${hData.credit < 1 ? '（⚠ 余额较低）' : ''}`;
            } else if (hData && hData.message) {
              creditLine = `\n接口状态：${hData.message}`;
            }
          }
        } catch (_) {}
        const breakdown = staleCount > 0
          ? `${targetKeys.length} 句偶像台词（${unvoicedCount} 句未配音 + ${staleCount} 句词已改重配，共 ${totalChars} 字符）`
          : `${targetKeys.length} 句未配音的偶像台词（共 ${totalChars} 字符）`;
        if (!window.confirm(`将为本幕 ${breakdown} 批量调用 TTS 合成。${creditLine}\n\n合成过程中随时可再次点击该按钮中止。确认开始吗？`)) {
          return;
        }

        const origTxt = btnStep2TtsScene.textContent;
        batchTtsRunning = true;
        batchTtsAbort = false;
        setBusyProgress(`正在为本幕 0/${targetKeys.length} 句合成 Fish TTS…`, 'tts-scene', null);
        let okCount = 0;
        try {
          for (let k = 0; k < targetKeys.length; k++) {
            if (batchTtsAbort) break;
            const rKey = targetKeys[k];
            const rIdx = P.S.doc.rows.findIndex((r) => r.key === rKey);
            if (rIdx < 0) continue;
            const curLn = P.S.doc.rows[rIdx] && P.S.doc.rows[rIdx].line;
            const forceRow = Boolean(curLn && curLn.voice && curLn._meta && curLn._meta.voiceStale);
            btnStep2TtsScene.textContent = `⏹ 停止合成 (${k + 1}/${targetKeys.length})`;
            setBusyProgress(`正在合成第 ${k + 1}/${targetKeys.length} 句偶像语音…`, 'tts-scene', null);
            const resData = await P.synthTtsTake(rIdx, { force: forceRow, autoPlay: false, silent: true });
            if (resData && resData.ok) okCount++;
          }
          if (batchTtsAbort) {
            P.toast && P.toast(`⏹ 已中止批量合成（已保留前 ${okCount} 句语音）`);
          } else {
            P.toast && P.toast(okCount ? `🎙 已为本幕合成 ${okCount}/${targetKeys.length} 句偶像语音，点击任意行即可自动试听！` : '⚠️ 批量合成未生成新语音，请点顶栏「🔌 接口与语音 → 🎙 TTS」检测配置', okCount ? undefined : 'warn');
          }
        } finally {
          batchTtsRunning = false;
          batchTtsAbort = false;
          clearBusyProgress(null);
          btnStep2TtsScene.textContent = origTxt;
        }
      };
    }

    const btnEnrich = $('#btnEnrichScene');
    if (btnEnrich) {
      btnEnrich.onclick = async () => {
        const p = getActiveProject();
        const sc = getActiveScene();
        if (!p || !sc) return;
        const origTxt = btnEnrich.textContent;
        setBusyProgress(`正在 AI 扩写润色「${sc.titleZh || sc.title}」…`, 'enrich-scene', btnEnrich);
        try {
          window.SCProto.toast(`✨ 正在保留「${sc.titleZh || sc.title}」核心剧情并丰富人物互动与细节…`);
          const existingRows = (typeof extractScriptRowsFromProtoDoc === 'function' ? extractScriptRowsFromProtoDoc() : [])
            .filter((r) => r && r.speaker && r.kind !== 'direction');
          const outline = {
            sceneId: sc.id,
            title: sc.titleZh || sc.title,
            bg: sc.bg || '00001',
            bgm: sc.bgm || '001',
            cast: Array.isArray(sc.cast) && sc.cast.length ? sc.cast : ['amana', 'hana'],
            summary: sc.summary || '',
            segments: sc.segments || [],
            beats: sc.beats || []
          };
          const targetDepth = W.scriptDepth === 'deep' ? 'deep' : 'standard';
          const expRes = await fetch('/api/studio/expand-script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              outline,
              depth: targetDepth,
              existingRows,
              storyContext: buildStoryContinuityContext(sc.id),
              llmConfig: getLlmConfig()
            })
          });
          const expData = await expRes.json();
          if (!expData.ok) throw new Error(expData.error || '扩写失败');
          updateGeneratorBadges(expData.generator, expData.generatorLabel, expData.llmWarning || null);

          invalidateQuietRecompile();
          const saveRes = await fetch(`/api/studio/projects/${encodeURIComponent(p.id)}/scenes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save',
              regenerateScript: true,
              sceneId: sc.id,
              title: sc.titleZh || sc.title,
              titleZh: sc.titleZh || sc.title,
              bg: outline.bg,
              bgm: outline.bgm,
              cast: outline.cast,
              summary: outline.summary,
              segments: outline.segments,
              beats: outline.beats,
              scriptRows: expData.scriptRows
            })
          });
          const saveData = await saveRes.json();
          if (saveData.ok && Array.isArray(saveData.projects)) {
            W.projects = saveData.projects;
            renderSceneTree();
            const updatedP = getActiveProject();
            const updatedSc = getActiveScene();
            if (updatedP && updatedSc) syncSceneIntoSCProto(updatedP, updatedSc);
            if (expData.llmWarning) {
              window.SCProto.toast(`⚠️ AI 扩写异常已回退：${expData.llmWarning}`, 'err');
            } else {
              window.SCProto.toast(`✨ 已将本幕丰富为 ${expData.scriptRows.length} 行详细剧本（OOC ${expData.oocSummary.pass}/${expData.oocSummary.total}）！`);
            }
          }
        } catch (err) {
          window.SCProto.toast('✗ 丰富本幕失败：' + err.message, 'err');
        } finally {
          clearBusyProgress(btnEnrich);
          btnEnrich.textContent = origTxt;
        }
      };
    }

    const ps = $('#packSelect');
    if (ps) {
      ps.onchange = () => {
        const v = ps.value;
        if (v === '__new_project') {
          ps.value = W.activeProjectId;
          openNewProjectModal();
          return;
        }
        if (v === '__import') {
          ps.value = W.activeProjectId;
          return;
        }
        selectProject(v);
      };
    }

    const btnAuth = $('#btnStudioAuth');
    if (btnAuth) btnAuth.onclick = openStudioAuthModal;
    refreshStudioAuthStatus();

    bindStep2QuickTools();
    setStageViewMode('spine');
    ensureAutoFishTtsConfig();

    // Load projects from `/api/studio/projects?lite=1` (outfits loaded separately in proto-app.js)
    try {
      const res = await fetch('/api/studio/projects?lite=1');
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.projects) && data.projects.length) {
        W.projects = data.projects;
        W.idolMeta = data.idolMeta || {};
        W.emotionPresets = data.emotionPresets || {};
        if (data.idolOutfits && data.idolOutfits.idols) {
          W.idolOutfits = data.idolOutfits;
          window.SC_STUDIO_OUTFITS = data.idolOutfits;
          if (window.SCProto && window.SCProto.S) {
            window.SCProto.S.idolOutfits = data.idolOutfits;
          }
        }
        if (window.__SC_OUTFITS_PROMISE) {
          try { await window.__SC_OUTFITS_PROMISE; } catch (_) {}
        }
        const reqPack = new URLSearchParams(window.location.search || '').get('pack');
        const initId = (reqPack && W.projects.some((x) => x.id === reqPack))
          ? reqPack
          : (W.projects.some((x) => x.id === 'island_survival_pack') ? 'island_survival_pack' : W.projects[0].id);
        selectProject(initId, { force: true });
      }
    } catch (_) {
      // Offline / file:// fallback: build project entry from SC_MOCK.packs[0]
      if (window.SC_MOCK && Array.isArray(window.SC_MOCK.packs) && window.SC_MOCK.packs[0]) {
        const p0 = window.SC_MOCK.packs[0];
        W.projects = [
          {
            id: p0.id,
            name: p0.pack.name,
            nameZh: p0.pack.nameZh,
            unit: p0.pack.unit,
            characters: p0.pack.characters,
            stories: (p0.pack.stories || []).map((s) => ({
              id: s.id,
              title: s.title,
              titleZh: s.titleZh,
              order: s.order,
              cast: s.cast,
              scproj: (p0.scenesMap && p0.scenesMap[s.id]) || p0.story
            }))
          }
        ];
        selectProject(p0.id);
      }
    }
  }

  function exportPackZip() {
    const P = window.SCProto;
    const pid = W.activeProjectId || 'island_survival_pack';
    const a = document.createElement('a');
    a.href = `/api/studio/projects/${encodeURIComponent(pid)}/export-zip`;
    a.download = `${pid}.scpack.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 500);
    if (P && typeof P.toast === 'function') P.toast(`📦 正在打包下载 ${pid}.scpack.zip…`);
  }

  async function importPackZipFromFile(file) {
    const P = window.SCProto;
    if (!file) return;
    if (file.size > 55 * 1024 * 1024) {
      if (P && typeof P.toast === 'function') P.toast('⚠ .scpack.zip 文件过大（上限约 55 MB）', 'warn');
      return;
    }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('读取压缩包失败'));
        reader.readAsDataURL(file);
      });
      const resp = await fetch('/api/studio/projects/import-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, dataUrl })
      });
      const data = await resp.json();
      if (resp.status === 401) {
        openStudioAuthModal();
        throw new Error(data.error || '导入工程包需要先输入访问口令');
      }
      if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      W.projects = Array.isArray(data.projects) ? data.projects : W.projects;
      renderProjectSelector();
      selectProject(data.projectId);
      const renameHint = data.renamedFrom ? `（原名冲突，已存为 ${data.projectId}）` : '';
      if (P && typeof P.toast === 'function') P.toast(`✅ 已导入工程：${data.projectId}${renameHint}`, 'ok');
    } catch (err) {
      if (P && typeof P.toast === 'function') P.toast('❌ 导入失败：' + err.message, 'warn');
    }
  }

  async function cleanupUnusedTtsCacheFromUi() {
    const P = window.SCProto;
    try {
      const resp = await fetch('/api/studio/tts/cleanup-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false })
      });
      const data = await resp.json();
      if (resp.status === 401) {
        openStudioAuthModal();
        throw new Error(data.error || '清理缓存需要先输入访问口令');
      }
      if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      const msg = data.deletedCount > 0
        ? `🧹 已清理 ${data.deletedCount} 个未引用配音缓存，释放 ${data.freedMB} MB（保留 ${data.keptCount} 个在用）`
        : `🧹 配音缓存很干净，没有废弃文件（当前保留 ${data.keptCount} 个在用）`;
      if (P && typeof P.toast === 'function') P.toast(msg, 'ok');
    } catch (err) {
      if (P && typeof P.toast === 'function') P.toast('清理失败：' + err.message, 'warn');
    }
  }

  window.StudioWorkflow = {
    W,
    renderStep1OutlinePanel,
    selectProject,
    selectScene,
    compileCurrentSceneAndGoStep3,
    saveCurrentProjectExplicitly,
    discardUnsavedChanges,
    openSnapshotHistoryModal,
    copyOutfitsFromPrevScene,
    runStagePreflightCheck,
    triggerStageRecording,
    playAllProjectScenes,
    exportMergedProjectScproj,
    exportPackZip,
    importPackZipFromFile,
    cleanupUnusedTtsCacheFromUi,
    stopPlayAllScenes,
    openLlmSettingsModal,
    getLlmConfig,
    saveLlmConfig,
    getAiTtsBundle,
    saveAiTtsBundle,
    getTtsConfig,
    openNewProjectModal,
    setStageViewMode,
    getActiveSceneSegment,
    updateSegmentMeta,
    addLineToBeat,
    regenerateSingleBeat,
    setReactionWorkbenchActive,
    renderReactionWorkbench,
    openScspCorpusModal,
    openGlobalScriptOverviewModal,
    renderWorkflowProgress,
    setDirectionsVisible,
    refreshDirectionsToggleUi
  };

  function openGlobalScriptOverviewModal() {
    const P = window.SCProto;
    const p = getActiveProject();
    if (!P || !p) return;
    const stories = Array.isArray(p.stories) ? p.stories : [];

    const buildBody = (query = '') => {
      const q = String(query || '').trim().toLowerCase();
      if (!stories.length) {
        return '<div class="muted" style="padding:16px">当前工程暂无分幕，请先在 Step 1 生成分场大纲。</div>';
      }
      return stories
        .map((sc, actIdx) => {
          const draftCard = (W.outlineDrafts || []).find((c) => c.sceneId === sc.id);
          const segments = (draftCard && draftCard.segments) || sc.segments || [];
          const segMap = new Map(segments.map((sg) => [sg.beatId, sg]));
          const storyArr = Array.isArray(sc.scriptRows) && sc.scriptRows.length
            ? sc.scriptRows
            : ((sc.scproj && (sc.scproj.list || sc.scproj.story)) || []);
          const rawTitle = sc.titleZh || sc.title || sc.id;
          const actTitle = /^第\s*\d+\s*幕/.test(rawTitle) ? rawTitle : `第 ${actIdx + 1} 幕 · ${rawTitle}`;
          const dlgLines = [];
          let dlgIdx = 0;
          storyArr.forEach((ln) => {
            if (!ln) return;
            const hasTxt = Boolean(ln.text && String(ln.text).trim()) || Boolean(ln.select);
            if (!hasTxt) return;
            const meta = ln._meta || {};
            const zh = meta.zh || ln.zh || ln.select || ln.text || '';
            const ja = ln.text || ln.select || '';
            const spk = ln.speaker || (ln.charLabel && W.idolMeta[ln.charLabel] ? W.idolMeta[ln.charLabel].speaker : '旁白');
            const color = (ln.charLabel && W.idolMeta[ln.charLabel] && W.idolMeta[ln.charLabel].color) || '#64748b';
            const beatId = meta.beatId || ln.beatId || 'beat_1';
            const beatTitle = meta.beatTitle || ln.beatTitle || (segMap.get(beatId) && segMap.get(beatId).title) || beatId;
            if (!q || spk.toLowerCase().includes(q) || zh.toLowerCase().includes(q) || ja.toLowerCase().includes(q)) {
              dlgLines.push({ dlgIdx, spk, color, zh, ja, beatId, beatTitle });
            }
            dlgIdx++;
          });

          // Group by beatId in order
          const groups = [];
          const groupByKey = new Map();
          dlgLines.forEach((item) => {
            if (!groupByKey.has(item.beatId)) {
              const segObj = segMap.get(item.beatId);
              const g = {
                beatId: item.beatId,
                title: (segObj && segObj.title) || item.beatTitle || item.beatId,
                summary: (segObj && segObj.summary) || '',
                items: []
              };
              groupByKey.set(item.beatId, g);
              groups.push(g);
            }
            groupByKey.get(item.beatId).items.push(item);
          });

          if (q && !groups.length) return '';

          return `
            <div class="overview-act" id="ovAct_${esc(sc.id)}">
              <div class="overview-act-head">
                <div>
                  <b>${esc(actTitle)}</b>
                  <span class="muted" style="margin-left:8px;font-size:11px">BG ${esc(sc.bg || '—')} · BGM ${esc(sc.bgm || '—')} · ${dlgLines.length} 句</span>
                </div>
                <button type="button" class="chip-btn" data-jump-scene-only="${esc(sc.id)}">跳转到本幕编辑 →</button>
              </div>
              ${sc.summary ? `<div class="overview-act-sum">${esc(sc.summary)}</div>` : ''}
              ${groups.length ? groups.map((g, gi) => `
                <div class="overview-beat">
                  <div class="overview-beat-head">🧩 小段 ${gi + 1} · ${esc(g.title)}${g.summary && g.summary !== g.title ? `<small>${esc(g.summary)}</small>` : ''}</div>
                  ${g.items.map((it) => `
                    <button type="button" class="overview-line" data-jump-scene="${esc(sc.id)}" data-jump-dlg="${it.dlgIdx}">
                      <span class="overview-line-num">#${String(it.dlgIdx + 1).padStart(2, '0')}</span>
                      <span class="overview-spk" style="--c:${esc(it.color)}">${esc(it.spk)}</span>
                      <span class="overview-txt">${esc(it.zh)}<small>${esc(it.ja)}</small></span>
                      <span class="overview-jump-hint">点击跳转修改 ✎</span>
                    </button>
                  `).join('')}
                </div>
              `).join('') : (segs.length ? segs.map((seg, si) => `
                <div class="overview-beat">
                  <div class="overview-beat-head">🧩 小段 ${si + 1} · ${esc(seg.title)}</div>
                  <div class="overview-act-sum" style="margin:6px 0 0">${esc(seg.summary || '（暂无详细描写）')}</div>
                </div>
              `).join('') : '<div class="muted" style="font-size:12px">本幕暂无台词（可在 Step 1 点击生成）</div>')}
            </div>
          `;
        })
        .join('') || '<div class="muted" style="padding:16px">未找到匹配的台词</div>';
    };

    const actPills = stories
      .map((sc, i) => `<button type="button" class="chip-btn" data-scroll-act="ovAct_${esc(sc.id)}">第 ${i + 1} 幕</button>`)
      .join('');

    P.openModal(
      `
      <div class="modal-head">
        <b>📖 全局剧本总览 · ${esc(p.nameZh || p.name)}</b>
        <button class="ibtn" data-close>✕</button>
      </div>
      <div class="modal-body">
        <div class="overview-toolbar">
          <input type="search" class="overview-search" id="overviewSearchInput" placeholder="搜索角色名或台词关键词…" />
          ${actPills}
        </div>
        <div class="overview-scroll" id="overviewScrollBox">
          ${buildBody('')}
        </div>
      </div>
      <div class="modal-foot">
        <span class="muted" style="margin-right:auto;font-size:12px">提示：点击任意一句台词即可直接跳转到 Step 2 对应位置修改</span>
        <button class="btn ghost" data-close>关闭</button>
      </div>
      `,
      (m) => {
        const scrollBox = $('#overviewScrollBox', m);
        const searchInp = $('#overviewSearchInput', m);
        const bindJumpHandlers = () => {
          $$('[data-jump-scene]', scrollBox).forEach((btn) => {
            btn.onclick = () => {
              const sid = btn.dataset.jumpScene;
              const dIdx = Number(btn.dataset.jumpDlg || 0);
              P.closeModal();
              selectScene(sid);
              P.setMode('polish');
              setTimeout(() => {
                const rows = (P.S && P.S.doc && P.S.doc.rows) || [];
                const dlgRows = rows.filter((r) => r.line && ((r.line.text && String(r.line.text).trim()) || r.line.select));
                const target = dlgRows[dIdx] || dlgRows[0];
                if (target) {
                  P.selectRow(target.key, { scroll: true });
                  const inp = document.querySelector(`.row[data-key="${target.key}"] .zh, .row[data-key="${target.key}"] .txt`);
                  if (inp) inp.focus();
                }
              }, 80);
            };
          });
          $$('[data-jump-scene-only]', scrollBox).forEach((btn) => {
            btn.onclick = () => {
              const sid = btn.dataset.jumpSceneOnly;
              P.closeModal();
              selectScene(sid);
              P.setMode('polish');
            };
          });
        };
        bindJumpHandlers();
        if (searchInp) {
          searchInp.oninput = () => {
            scrollBox.innerHTML = buildBody(searchInp.value);
            bindJumpHandlers();
          };
        }
        $$('[data-scroll-act]', m).forEach((b) => {
          b.onclick = () => {
            const target = document.getElementById(b.dataset.scrollAct);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          };
        });
      }
    );
  }

  function renderWorkflowProgress() {
    const segBar = document.getElementById('modeSeg');
    const bar = document.getElementById('workflowProgressBar') || segBar;
    if (!bar) return;

    const mode = document.body.classList.contains('mode-muse')
      ? 'muse'
      : document.body.classList.contains('mode-stage')
        ? 'stage'
        : 'polish';

    const p = getActiveProject();
    const stories = p && Array.isArray(p.stories) ? p.stories : [];
    const outlineCount = W.outlineDrafts && W.outlineDrafts.length ? W.outlineDrafts.length : stories.length;
    const step1Done = outlineCount > 0;

    const dialogueRows = document.querySelectorAll('#scriptList .row:not(.k-direction)').length;
    const totalScriptLines = stories.reduce((sum, s) => sum + (s.lineCount || 0), 0);
    const hasScript = dialogueRows > 0 || totalScriptLines > 0;
    const step2Done = hasScript && (mode === 'stage' || Boolean(W.stageCompleted) || totalScriptLines >= 3);
    const step3Done = Boolean(W.stageCompleted);

    const sub1 = document.getElementById('wfSub1');
    const sub2 = document.getElementById('wfSub2');
    const sub3 = document.getElementById('wfSub3');
    if (sub1) sub1.textContent = step1Done ? `✓ ${outlineCount} 幕` : '待构思';
    if (sub2) sub2.textContent = hasScript ? `${dialogueRows || totalScriptLines} 句` : '待生成';
    if (sub3) sub3.textContent = step3Done ? '✓ 已导出' : (mode === 'stage' ? '预览中' : '待预览');

    const states = {
      1: { active: mode === 'muse', done: step1Done && mode !== 'muse' },
      2: { active: mode === 'polish', done: step2Done && mode !== 'polish' },
      3: { active: mode === 'stage', done: step3Done && mode !== 'stage' }
    };

    bar.querySelectorAll('[data-step]').forEach((btn) => {
      const n = Number(btn.dataset.step);
      const st = states[n] || {};
      btn.classList.toggle('is-active', Boolean(st.active));
      btn.classList.toggle('is-done', Boolean(st.done));
    });

    let pct = 15;
    if (mode === 'muse') pct = step1Done ? 35 : 15;
    else if (mode === 'polish') pct = hasScript ? 68 : 50;
    else if (mode === 'stage') pct = step3Done ? 100 : 88;
    if (step3Done && mode !== 'stage') pct = Math.max(pct, 92);

    const fill = document.getElementById('wfTrackFill');
    if (fill) fill.style.width = `${pct}%`;
    refreshDirectionsToggleUi();
  }

  function initWorkflowProgressBar() {
    const toolsBtn = document.getElementById('btnTopbarTools');
    const toolsMenu = document.getElementById('topbarToolsMenu');
    if (toolsBtn && toolsMenu && !toolsBtn.dataset.boundMenu) {
      toolsBtn.dataset.boundMenu = '1';
      toolsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toolsMenu.hidden = !toolsMenu.hidden;
      });
      document.addEventListener('click', (e) => {
        if (!toolsMenu.hidden && !toolsMenu.contains(e.target) && e.target !== toolsBtn) {
          toolsMenu.hidden = true;
        }
      });
      toolsMenu.addEventListener('click', (e) => {
        if (e.target.closest('button, a')) toolsMenu.hidden = true;
      });
    }
    ['btnPreview', 'btnExport', 'btnPushPlayerTop', 'btnPlayAllTop', 'btnExportMergedTop', 'btnPushPlayer', 'btnPlayAllScenes'].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.dataset.boundStageDone) {
        el.dataset.boundStageDone = '1';
        el.addEventListener('click', () => {
          W.stageCompleted = true;
          setTimeout(renderWorkflowProgress, 60);
        });
      }
    });
    renderWorkflowProgress();
  }


  const DIR_TOGGLE_KEY = 'scstudio.showDirections';

  function getDirectionsRowCount() {
    return document.querySelectorAll('#scriptList .row.k-direction, #scriptList .row.k-cue').length;
  }

  function refreshDirectionsToggleUi(showDirOverride) {
    const showDir = showDirOverride !== undefined
      ? Boolean(showDirOverride)
      : !document.body.classList.contains('hide-directions');
    const dirCount = getDirectionsRowCount();
    const label = showDir ? '🎬 隐藏分镜' : (dirCount ? `🎬 显示分镜 (${dirCount})` : '🎬 显示分镜');
    const btn = document.getElementById('btnToggleDirections');
    if (btn) {
      btn.classList.toggle('on', showDir);
      btn.textContent = label;
    }
    const btn3 = document.getElementById('btnToggleDirectionsStep3');
    if (btn3) {
      btn3.classList.toggle('on', showDir);
      btn3.textContent = label;
    }
  }

  function setDirectionsVisible(showDir, opts = {}) {
    const visible = Boolean(showDir);
    const prevVisible = !document.body.classList.contains('hide-directions');
    document.body.classList.toggle('hide-directions', !visible);
    if (opts.persist !== false) {
      try { localStorage.setItem(DIR_TOGGLE_KEY, visible ? '1' : '0'); } catch (_) {}
    }
    refreshDirectionsToggleUi(visible);
    if (opts.forceRerender || (opts.rerender !== false && visible !== prevVisible)) {
      const P = window.SCProto;
      if (P && typeof P.renderScript === 'function') P.renderScript();
      refreshDirectionsToggleUi(visible);
    }
    return visible;
  }

  function initDirectionsToggle() {
    let showDir = false;
    try { showDir = localStorage.getItem(DIR_TOGGLE_KEY) === '1'; } catch (_) {}
    setDirectionsVisible(showDir, { persist: false, rerender: false });
    if (!document.body.dataset.boundDirToggle) {
      document.body.dataset.boundDirToggle = '1';
      document.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('#btnToggleDirections, #btnToggleDirectionsStep3') : null;
        if (!btn) return;
        showDir = document.body.classList.contains('hide-directions');
        setDirectionsVisible(showDir, { persist: true, forceRerender: true });
        const dirCount = getDirectionsRowCount();
        const P = window.SCProto;
        if (P && typeof P.toast === 'function') {
          P.toast(showDir
            ? (dirCount ? `🎬 已显示 ${dirCount} 条分镜调度行` : '🎬 当前幕暂无分镜调度行')
            : `🎬 已隐藏 ${dirCount} 条分镜调度行（仅保留台词）`);
        }
      });
    }
  }

  function recompileCurrentSceneQuietly(delayMs = 220) {
    const reqSeq = ++_quietRecompileSeq;
    const targetProjId = W.activeProjectId;
    const targetSceneId = W.activeSceneId;
    if (_quietRecompileTimer) clearTimeout(_quietRecompileTimer);
    _quietRecompileTimer = setTimeout(async () => {
      if (reqSeq !== _quietRecompileSeq) return;
      const p = getActiveProject();
      const sc = getActiveScene();
      const P = window.SCProto;
      if (!p || !sc || p.id !== targetProjId || sc.id !== targetSceneId || !P || !P.S || !P.S.doc) return;
      if (P.S.doc.packId && P.S.doc.packId !== targetProjId) return;
      if (P.S.doc.sceneId && P.S.doc.sceneId !== targetSceneId) return;
      const curRow = P.S.doc.rows.find((r) => r.key === P.S.selKey);
      const curUid = curRow && curRow.line && curRow.line._meta ? curRow.line._meta.uid : '';
      const scriptRows = extractScriptRowsFromProtoDoc();
      const castOutfits = { ...(sc.castOutfits || {}) };
      if (typeof P.getCurrentOutfitForChar === 'function') {
        for (const cid of (sc.cast || [])) {
          const oid = P.getCurrentOutfitForChar(cid);
          if (oid) castOutfits[cid] = oid;
        }
      }
      sc.castOutfits = castOutfits;
      delete sc.castHairs;
      if (isScenePrecompiled(sc)) {
        sc.preservePrecompiled = true;
        sc.scriptRows = scriptRows;
        sc.scproj = sc.scproj || {};
        sc.scproj.lines = P.S.doc.rows.map((r) => JSON.parse(JSON.stringify(r.line)));
        updateRealSpineIframe(sc.id);
        return;
      }
      try {
        const res = await fetch('/api/studio/preview-compile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: p.id,
            sceneId: sc.id,
            title: sc.title,
            titleZh: sc.titleZh || sc.title,
            bg: sc.bg || '',
            bgm: sc.bgm || '',
            bgmStyle: sc.bgmStyle || '',
            cast: sc.cast || [],
            castOutfits,
            summary: sc.summary || '',
            segments: sc.segments || [],
            beats: sc.beats || [],
            scriptRows
          })
        });
        const data = await res.json();
        if (reqSeq !== _quietRecompileSeq) return;
        const curP = getActiveProject();
        const curSc = getActiveScene();
        if (!curP || !curSc || curP.id !== targetProjId || curSc.id !== targetSceneId) return;
        if (!data.ok || !data.scproj) return;
        curSc.scriptRows = scriptRows;
        curSc.scproj = data.scproj;
        if (data.scproj.meta && data.scproj.meta['x-playerScriptId']) {
          curSc.playerScriptId = data.scproj.meta['x-playerScriptId'];
        }
        syncSceneIntoSCProto(curP, curSc);
        if (curUid && P.S.doc && Array.isArray(P.S.doc.rows)) {
          const hit = P.S.doc.rows.find((r) => r.line && r.line._meta && r.line._meta.uid === curUid);
          if (hit && typeof P.selectRow === 'function') {
            P.selectRow(hit.key, { scroll: false });
          }
        }
      } catch (_) {}
    }, delayMs);
  }

  window.SCWorkflow = {
    getActiveScene,
    setSceneEnv: setActiveSceneEnv,
    refreshEnvBars,
    syncBeatBgmFromRow,
    recompileSceneQuietly: recompileCurrentSceneQuietly,
    invalidateQuietRecompile,
    resolveScenePlayerId,
    extractScriptRows: extractScriptRowsFromProtoDoc
  };

  function bootWorkflow() {
    document.body.classList.remove('simple-mode');
    initDirectionsToggle();
    initWorkflowProgressBar();
    initWorkflow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootWorkflow);
  } else {
    bootWorkflow();
  }
})();
