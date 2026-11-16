/**
 * Universal External Script Adapter (UMD: Browser + Node.js)
 * Converts external ShinyColors fan-player JSON, scproj JSON, LLM outline JSON,
 * and plain-text / Markdown dialogue scripts into Studio `outlines` / `scproj` structures.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SCExternalScriptAdapter = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const IDOL_TABLE = [
    { label: 'mano', id: '001', speaker: '真乃', nameZh: '樱木真乃', aliases: ['樱木真乃', '櫻木真乃', '真乃', '櫻木真乃', '櫻木真乃'] },
    { label: 'hiori', id: '002', speaker: '灯織', nameZh: '风野灯织', aliases: ['风野灯织', '風野燈織', '灯织', '燈織', '灯織'] },
    { label: 'meguru', id: '003', speaker: 'めぐる', nameZh: '八宫巡', aliases: ['八宫巡', '八宮巡', '巡', 'めぐる'] },
    { label: 'kogane', id: '004', speaker: '恋鐘', nameZh: '月冈恋钟', aliases: ['月冈恋钟', '月岡戀鐘', '月岡恋鐘', '恋钟', '戀鐘', '恋鐘'] },
    { label: 'mamimi', id: '005', speaker: '摩美々', nameZh: '田中摩美美', aliases: ['田中摩美美', '摩美美', '摩美々'] },
    { label: 'sakuya', id: '006', speaker: '咲耶', nameZh: '白濑咲耶', aliases: ['白濑咲耶', '白瀨咲耶', '咲耶'] },
    { label: 'yuika', id: '007', speaker: '結華', nameZh: '三峰结华', aliases: ['三峰结华', '三峰結華', '结华', '結華', '三峰'] },
    { label: 'kiriko', id: '008', speaker: '霧子', nameZh: '幽谷雾子', aliases: ['幽谷雾子', '幽谷霧子', '雾子', '霧子'] },
    { label: 'kaho', id: '009', speaker: '果穂', nameZh: '小宫果穗', aliases: ['小宫果穗', '小宮果穂', '小宮果穗', '果穗', '果穂'] },
    { label: 'chiyoko', id: '010', speaker: '智代子', nameZh: '园田智代子', aliases: ['园田智代子', '園田智代子', '智代子'] },
    { label: 'juri', id: '011', speaker: '樹里', nameZh: '西城树里', aliases: ['西城树里', '西城樹里', '树里', '樹里'] },
    { label: 'rinze', id: '012', speaker: '凛世', nameZh: '杜野凛世', aliases: ['杜野凛世', '凛世', '凜世'] },
    { label: 'natsuha', id: '013', speaker: '夏葉', nameZh: '有栖川夏叶', aliases: ['有栖川夏叶', '有栖川夏葉', '夏叶', '夏葉'] },
    { label: 'amana', id: '014', speaker: '甘奈', nameZh: '大崎甘奈', aliases: ['大崎甘奈', '甘奈'] },
    { label: 'tenka', id: '015', speaker: '甜花', nameZh: '大崎甜花', aliases: ['大崎甜花', '甜花'] },
    { label: 'chiyuki', id: '016', speaker: '千雪', nameZh: '桑山千雪', aliases: ['桑山千雪', '千雪'] },
    { label: 'asahi', id: '017', speaker: 'あさひ', nameZh: '芹泽朝日', aliases: ['芹泽朝日', '芹澤朝日', '芹泽朝阳', '芹澤朝陽', '芹泽あさひ', '朝日', '朝阳', '朝陽', 'あさひ'] },
    { label: 'fuyuko', id: '018', speaker: '冬優子', nameZh: '黛冬优子', aliases: ['黛冬优子', '黛冬優子', '冬优子', '冬優子', '冬优', '冬優'] },
    { label: 'mei', id: '019', speaker: '愛依', nameZh: '和泉爱依', aliases: ['和泉爱依', '愛依', '爱依'] },
    { label: 'tooru', id: '020', speaker: '透', nameZh: '浅仓透', aliases: ['浅仓透', '淺倉透', '浅仓', '淺倉', '透', 'toru'] },
    { label: 'madoka', id: '021', speaker: '円香', nameZh: '樋口圆香', aliases: ['樋口圆香', '樋口圓香', '樋口円香', '圆香', '圓香', '円香'] },
    { label: 'koito', id: '022', speaker: '小糸', nameZh: '福丸小糸', aliases: ['福丸小糸', '小糸'] },
    { label: 'hinana', id: '023', speaker: '雛菜', nameZh: '市川雏菜', aliases: ['市川雏菜', '市川雛菜', '雏菜', '雛菜'] },
    { label: 'nichika', id: '024', speaker: 'にちか', nameZh: '七草日花', aliases: ['七草日花', '七草にちか', '七草妮琪卡', '妮琪卡', '日花', 'にちか', 'nichika'] },
    { label: 'mikoto', id: '025', speaker: '美琴', nameZh: '绯田美琴', aliases: ['绯田美琴', '緋田美琴', '美琴', 'mikoto'] },
    { label: 'luca', id: '026', speaker: 'ルカ', nameZh: '斑鸠路加', aliases: ['斑鸠路加', '斑鳩路加', '斑鸠鲁卡', '斑鸠璐卡', '斑鳩ルカ', '路加', '鲁卡', '璐卡', 'ルカ', 'luca'] },
    { label: 'hana', id: '027', speaker: '羽那', nameZh: '铃木羽那', aliases: ['铃木羽那', '鈴木羽那', '羽那'] },
    { label: 'haruki', id: '028', speaker: 'はるき', nameZh: '郁田阳希', aliases: ['郁田阳希', '郁田陽希', '郁田晴希', '郁田はるき', '阳希', '陽希', '晴希', 'はるき'] },
    { label: 'hazuki', id: '091', speaker: 'はづき', nameZh: '七草叶月', aliases: ['七草叶月', '七草葉月', '七草はづき', '叶月', '葉月', 'はづき'] }
  ];

  const LABEL_BY_ID = {};
  const META_BY_LABEL = {};
  const ALIAS_MAP = new Map();
  IDOL_TABLE.forEach((item) => {
    LABEL_BY_ID[item.id] = item.label;
    META_BY_LABEL[item.label] = item;
    ALIAS_MAP.set(item.label.toLowerCase(), item.label);
    ALIAS_MAP.set(item.speaker.toLowerCase(), item.label);
    ALIAS_MAP.set(item.nameZh.toLowerCase(), item.label);
    item.aliases.forEach((al) => ALIAS_MAP.set(String(al).toLowerCase(), item.label));
  });

  const SLOT_POSITIONS = {
    left: { x: 310, y: 610, order: 0 },
    centerleft: { x: 420, y: 610, order: 0 },
    center: { x: 568, y: 610, order: 1 },
    centerright: { x: 716, y: 610, order: 1 },
    right: { x: 796, y: 610, order: 2 },
    farleft: { x: 180, y: 610, order: 0 },
    farright: { x: 956, y: 610, order: 3 }
  };

  function resolveIdolLabel(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const low = s.toLowerCase();
    if (/^(p|producer|制作人|製作人|プロデューサー)$/i.test(s)) return 'producer';
    if (ALIAS_MAP.has(low)) return ALIAS_MAP.get(low);
    const idMatch = s.match(/\b(0\d{2})\b/);
    if (idMatch && LABEL_BY_ID[idMatch[1]]) return LABEL_BY_ID[idMatch[1]];
    for (const [alias, lb] of ALIAS_MAP.entries()) {
      if (alias.length >= 2 && (low === alias || low.includes(alias))) return lb;
    }
    return '';
  }

  function padBgId(rawBg) {
    if (!rawBg) return '';
    if (rawBg === 'off') return 'off';
    const srcStr = typeof rawBg === 'object' ? String(rawBg.src || rawBg.id || rawBg.name || '') : String(rawBg);
    const m = srcStr.match(/(\d+)(?:\.[a-z0-9]+)?$/i) || srcStr.match(/(\d+)/);
    if (!m) return '';
    return String(m[1]).padStart(5, '0');
  }

  function normalizeFace(face) {
    const f = String(face || '').trim();
    if (!f) return '';
    if (f === 'blank' || f.startsWith('face_')) return f;
    return 'face_' + f;
  }

  function normalizeLip(lip) {
    const l = String(lip || '').trim();
    if (!l) return '';
    if (l === 'blank' || l.startsWith('lip_')) return l;
    return 'lip_' + l;
  }

  function parseSpineDir(slotChar, fallbackLabel) {
    const dir = String((slotChar && (slotChar.dir || slotChar.json)) || '').replace(/\\/g, '/');
    const nameMatch = slotChar && slotChar.name ? resolveIdolLabel(slotChar.name) : '';
    // Match paths like `enza-spine/stand/025_緋田美琴/1030250010`
    const m = dir.match(/\/?(stand_costume|stand_fix|stand)\/(\d{3})_[^/]+\/(\d{3,12})(?:\/|$)/i);
    if (m) {
      const charCategory = m[1].toLowerCase();
      const numId = m[2];
      const clothId = m[3];
      const charLabel = LABEL_BY_ID[numId] || nameMatch || fallbackLabel || 'mano';
      const isIdolCostume = clothId.length >= 6;
      return {
        charLabel,
        charType: isIdolCostume ? 'idols' : 'characters',
        charCategory,
        charId: clothId,
        clothId
      };
    }
    const charLabel = nameMatch || fallbackLabel || '';
    const meta = META_BY_LABEL[charLabel];
    const numId = meta ? meta.id : '001';
    return {
      charLabel: charLabel || 'mano',
      charType: 'characters',
      charCategory: 'stand',
      charId: numId,
      clothId: numId
    };
  }

  function resolveSlotPosition(slotName, slotIdx, totalSlots) {
    const key = String(slotName || '').toLowerCase().replace(/[^a-z]/g, '');
    if (SLOT_POSITIONS[key]) return { ...SLOT_POSITIONS[key] };
    if (totalSlots === 1) return { x: 568, y: 610, order: 0 };
    if (totalSlots === 2) return { x: slotIdx === 0 ? 310 : 796, y: 610, order: slotIdx };
    return { x: Math.round((1136 * (slotIdx + 1)) / (totalSlots + 1)), y: 610, order: slotIdx };
  }

  function isFanPlayerArray(arr) {
    if (!Array.isArray(arr) || !arr.length) return false;
    return arr.some((x) => {
      if (!x || typeof x !== 'object') return false;
      const hasCharsMap = x.chars && typeof x.chars === 'object' && !Array.isArray(x.chars);
      const hasBgObj = x.bg && typeof x.bg === 'object' && ('src' in x.bg || 'name' in x.bg);
      const hasTrans = x.trans && typeof x.trans === 'object';
      return hasCharsMap || hasBgObj || hasTrans;
    });
  }

  function isScprojArray(arr) {
    if (!Array.isArray(arr) || !arr.length) return false;
    return arr.some((x) => x && typeof x === 'object' && (
      x.charLabel || x.charAnim1 || x.textCtrl || x.textFrame || x.charPosition || x.waitType || x.select
    ));
  }

  function mapTransToBgEffect(trans, bgChanged) {
    if (!trans || typeof trans !== 'object' || !trans.type || trans.type === 'none') return null;
    const t = String(trans.type).toLowerCase();
    const time = Math.max(100, Number(trans.time) || 600);
    if (t === 'dissolve' || t === 'crossfade' || t === 'fade') {
      return { bgEffect: bgChanged ? 'switch_fade' : 'fade', bgEffectTime: time };
    }
    if (t === 'white' || t === 'white_fade' || t === 'flash') {
      return { bgEffect: 'white_fade', bgEffectTime: time };
    }
    if (t === 'black' || t === 'fade_out') {
      return { bgEffect: 'fade_out', bgEffectTime: time };
    }
    return { bgEffect: bgChanged ? 'switch_fade' : 'fade', bgEffectTime: time };
  }

  function isInnerThoughtText(text) {
    const t = String(text || '').trim();
    return /^[（(].*[）)]$/s.test(t);
  }

  function convertFanPlayerArray(items, opts = {}) {
    const lines = [];
    const charCatalog = {};
    const stageState = new Map();
    const bgSet = new Set();
    let prevBg = '';
    let prevBgm = '';
    let uidSeq = 1;
    let firstTitle = opts.title || '';
    const sampleDialogueSummary = [];

    const nextUid = (prefix) => `${prefix}_${uidSeq++}`;

    const ensureCharEntry = (spec, displayName) => {
      if (!spec.charLabel || spec.charLabel === 'producer') return;
      const meta = META_BY_LABEL[spec.charLabel] || {};
      if (!charCatalog[spec.charLabel]) {
        charCatalog[spec.charLabel] = {
          charType: spec.charType,
          charId: spec.charId,
          clothId: spec.clothId,
          charCategory: spec.charCategory,
          name: displayName || meta.speaker || spec.charLabel,
          nameZh: meta.nameZh || displayName || spec.charLabel
        };
      }
    };

    let pendingStageNotes = [];

    items.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const itemStageNotes = [];

      // 1. Background + transition
      const curBg = item.bg !== undefined ? padBgId(item.bg) : '';
      const bgChanged = Boolean(curBg && curBg !== prevBg);
      if (curBg) {
        bgSet.add(curBg);
        prevBg = curBg;
      }
      const transEffect = mapTransToBgEffect(item.trans, bgChanged);
      const pendingBgProps = {};
      if (bgChanged || (idx === 0 && curBg)) {
        pendingBgProps.bg = curBg;
        itemStageNotes.push(`切换背景 BG ${curBg}`);
      }
      if (transEffect) {
        pendingBgProps.bgEffect = transEffect.bgEffect;
        pendingBgProps.bgEffectTime = transEffect.bgEffectTime;
        if (item.trans) {
          itemStageNotes.push(`过场 ${String(item.trans).trim()}`);
        }
      }
      if (item.bgm !== undefined && String(item.bgm) !== prevBgm) {
        pendingBgProps.bgm = String(item.bgm);
        prevBgm = String(item.bgm);
        itemStageNotes.push(`切换 BGM ${item.bgm}`);
      }
      let bgPropsUsed = false;
      const takeBgProps = () => {
        if (bgPropsUsed) return {};
        bgPropsUsed = true;
        return pendingBgProps;
      };

      // 2. Resolve active characters on stage from item.chars
      const rawChars = item.chars && typeof item.chars === 'object' ? item.chars : {};
      const slotEntries = Object.entries(rawChars).filter(([, v]) => v && typeof v === 'object');
      const activeByLabel = new Map();
      slotEntries.forEach(([slotName, slotChar], slotIdx) => {
        const spec = parseSpineDir(slotChar);
        const pos = resolveSlotPosition(slotName, slotIdx, slotEntries.length);
        const anim1 = String(slotChar.anim || 'wait1').trim() || 'wait1';
        const anim2 = normalizeFace(slotChar.face || 'face_wait');
        const lipAnim = normalizeLip(slotChar.talkAnim || '');
        const scale = slotChar.scale != null && Number(slotChar.scale) > 0 ? Number(slotChar.scale) : 1;
        ensureCharEntry(spec, slotChar.name);
        activeByLabel.set(spec.charLabel, {
          ...spec,
          slotName,
          pos,
          anim1,
          anim2,
          lipAnim,
          scale,
          rawName: slotChar.name || ''
        });
      });

      // 3. Emit exit cues for characters that left the stage
      const exitedNames = [];
      for (const prevLabel of Array.from(stageState.keys())) {
        if (!activeByLabel.has(prevLabel)) {
          const prevMeta = META_BY_LABEL[prevLabel] || (charCatalog && charCatalog[prevLabel]) || {};
          exitedNames.push(prevMeta.nameZh || prevMeta.name || prevLabel);
          lines.push({
            id: nextUid('ext_exit'),
            ...takeBgProps(),
            charLabel: prevLabel,
            charEffect: { type: 'to', alpha: 0, time: 220 },
            textFrame: 'off',
            waitType: 'time',
            waitTime: 1,
            _meta: { uid: nextUid('u_exit'), origin: 'external-import', sourceId: item.id || String(idx + 1) }
          });
          stageState.delete(prevLabel);
        }
      }
      if (exitedNames.length) {
        itemStageNotes.push(`角色退场：${exitedNames.join('、')}`);
      }

      // 4. Determine speaker character label
      const speakerName = String(item.speaker || '').trim();
      const speakerResolved = resolveIdolLabel(speakerName);
      const speakingChar = (speakerResolved && speakerResolved !== 'producer' && activeByLabel.has(speakerResolved))
        ? activeByLabel.get(speakerResolved)
        : (activeByLabel.size === 1 && speakerResolved && speakerResolved !== 'producer'
          ? Array.from(activeByLabel.values())[0]
          : null);

      // 5. Emit silent setup/update cues for non-speaking co-stage characters
      const cueNotes = [];
      for (const [lb, ch] of activeByLabel.entries()) {
        if (speakingChar && lb === speakingChar.charLabel) continue;
        const prev = stageState.get(lb);
        const changed = !prev ||
          prev.x !== ch.pos.x ||
          prev.y !== ch.pos.y ||
          prev.clothId !== ch.clothId ||
          prev.anim1 !== ch.anim1 ||
          prev.anim2 !== ch.anim2 ||
          prev.scale !== ch.scale;
        if (changed) {
          const chMeta = META_BY_LABEL[lb] || charCatalog[lb] || {};
          const dispName = chMeta.nameZh || ch.rawName || chMeta.name || lb;
          cueNotes.push(!prev ? `${dispName}登场(${ch.slotName})` : `${dispName}动作(${ch.anim1}/${ch.anim2 || 'face_wait'})`);
          lines.push({
            id: nextUid('ext_cue'),
            ...takeBgProps(),
            charLabel: ch.charLabel,
            charType: ch.charType,
            charId: ch.charId,
            clothId: ch.clothId,
            charCategory: ch.charCategory,
            charPosition: { x: ch.pos.x, y: ch.pos.y, order: ch.pos.order },
            charScale: ch.scale,
            charAnim1: ch.anim1,
            ...(ch.anim2 ? { charAnim2: ch.anim2 } : {}),
            charLipAnim: 'lip_wait',
            ...(!prev ? { charEffect: { type: 'from', alpha: 0, time: 180 } } : {}),
            textFrame: 'off',
            waitType: 'time',
            waitTime: 1,
            _meta: { uid: nextUid('u_cue'), origin: 'external-import', sourceId: item.id || String(idx + 1) }
          });
          stageState.set(lb, {
            x: ch.pos.x,
            y: ch.pos.y,
            clothId: ch.clothId,
            anim1: ch.anim1,
            anim2: ch.anim2,
            scale: ch.scale
          });
        }
      }
      if (cueNotes.length) {
        itemStageNotes.push(`同台角色变化：${cueNotes.join('、')}`);
      }
      if (itemStageNotes.length) {
        pendingStageNotes.push(...itemStageNotes);
      }

      // 6. Emit main line (dialogue / producer / narration)
      const text = String(item.text || '');
      const frame = String(item.frame || item.textFrame || '001');
      if (sampleDialogueSummary.length < 4 && text.trim()) {
        sampleDialogueSummary.push(`${speakerName || '旁白'}：${text.replace(/\s+/g, ' ').slice(0, 24)}`);
      }
      if (!firstTitle && text.trim()) {
        firstTitle = opts.title || '';
      }

      const stageNoteSummary = pendingStageNotes.length ? pendingStageNotes.join('；') : '';
      pendingStageNotes = [];

      if (speakingChar) {
        const thought = isInnerThoughtText(text);
        const chosenLip = speakingChar.lipAnim || (thought ? 'lip_wait' : 'lip_normal');
        const mainLine = {
          id: item.id ? String(item.id) : nextUid('ext_line'),
          ...takeBgProps(),
          speaker: speakerName || charCatalog[speakingChar.charLabel].name,
          charLabel: speakingChar.charLabel,
          charType: speakingChar.charType,
          charId: speakingChar.charId,
          clothId: speakingChar.clothId,
          charCategory: speakingChar.charCategory,
          charPosition: { x: speakingChar.pos.x, y: speakingChar.pos.y, order: speakingChar.pos.order },
          charScale: speakingChar.scale,
          charAnim1: speakingChar.anim1,
          ...(speakingChar.anim2 ? { charAnim2: speakingChar.anim2 } : {}),
          charLipAnim: chosenLip,
          text,
          textCtrl: item.textCtrl || 'p',
          textFrame: frame,
          ...(item.voice ? { voice: String(item.voice) } : {}),
          _meta: {
            uid: nextUid('u_line'),
            origin: 'external-import',
            sourceId: item.id || String(idx + 1),
            slot: speakingChar.slotName,
            ...(stageNoteSummary ? { 'x-stageNote': stageNoteSummary } : {})
          }
        };
        lines.push(mainLine);
        stageState.set(speakingChar.charLabel, {
          x: speakingChar.pos.x,
          y: speakingChar.pos.y,
          clothId: speakingChar.clothId,
          anim1: speakingChar.anim1,
          anim2: speakingChar.anim2,
          scale: speakingChar.scale
        });
      } else {
        lines.push({
          id: item.id ? String(item.id) : nextUid('ext_narr'),
          ...takeBgProps(),
          ...(speakerName ? { speaker: speakerName } : {}),
          ...(speakerResolved && speakerResolved !== 'producer' ? { charLabel: speakerResolved } : {}),
          text,
          textCtrl: item.textCtrl || 'p',
          textFrame: frame,
          _meta: {
            uid: nextUid('u_narr'),
            origin: 'external-import',
            sourceId: item.id || String(idx + 1),
            ...(stageNoteSummary ? { 'x-stageNote': stageNoteSummary } : {})
          }
        });
      }
    });

    const cast = Object.keys(charCatalog);
    const firstBg = Array.from(bgSet)[0] || '00001';
    const title = opts.title || opts.fileBaseName || (cast.length
      ? `外部导入剧本（${cast.map((c) => (META_BY_LABEL[c] ? META_BY_LABEL[c].nameZh : c)).join(' × ')}）`
      : '外部导入剧本');

    const scriptRowsForOutline = lines
      .filter((l) => l.text !== undefined)
      .map((l) => ({
        kind: l.speaker ? 'dialogue' : 'narration',
        speaker: l.speaker || '',
        charLabel: l.charLabel || '',
        text: l.text || '',
        textZh: l.text || '',
        anim1: l.charAnim1 || 'wait1',
        anim2: l.charAnim2 || 'face_wait',
        lip: l.charLipAnim || '',
        ...(l.bg ? { bg: l.bg } : {}),
        ...(l.bgm ? { bgm: l.bgm } : {}),
        ...(l.se ? { se: l.se } : {}),
        ...(l._meta && l._meta['x-stageNote'] ? { stageNote: l._meta['x-stageNote'] } : {}),
        ...(l._meta ? { _meta: Object.assign({}, l._meta) } : {})
      }));

    return {
      ok: true,
      format: 'fan_player_json',
      formatLabel: '外部剧场 JSON（自动转换站位/立绘/转场）',
      preservePrecompiled: true,
      title,
      premise: sampleDialogueSummary.join(' / ') || `外部导入共 ${items.length} 条剧情`,
      cast,
      characters: charCatalog,
      scenes: [
        {
          sceneId: 'scene_01',
          title,
          titleJa: title,
          bg: firstBg,
          bgm: '002',
          cast,
          preservePrecompiled: true,
          summary: `外部剧场 JSON 无损导入：共 ${items.length} 条原拍（转换后 ${lines.length} 条演出指令，涉及 ${bgSet.size} 个背景）`,
          segments: [
            {
              beatId: 'beat_1',
              title: '外部导入完整剧情',
              summary: sampleDialogueSummary.slice(0, 2).join('；') || `共 ${lines.length} 条演出指令`,
              cast,
              targetLines: lines.length
            }
          ],
          beats: [`节拍 1：外部剧场完整演出（${items.length} 句 / ${bgSet.size} 背景）`],
          scriptRows: scriptRowsForOutline,
          precompiledLines: lines
        }
      ],
      stats: {
        sceneCount: 1,
        sourceCount: items.length,
        lineCount: lines.length,
        dialogueCount: lines.filter((l) => l.text).length,
        bgCount: bgSet.size,
        castCount: cast.length
      }
    };
  }

  function convertScprojToResult(scprojObj, opts = {}) {
    const rawLines = Array.isArray(scprojObj) ? scprojObj : (scprojObj.lines || []);
    const characters = (scprojObj && scprojObj.pack && scprojObj.pack.characters)
      || (scprojObj && scprojObj.meta && scprojObj.meta.characters)
      || {};
    const castSet = new Set(Object.keys(characters));
    const bgSet = new Set();
    let firstBg = '00001';
    let firstBgm = '002';

    rawLines.forEach((l) => {
      if (!l || typeof l !== 'object') return;
      if (l.charLabel && !['producer', 'narrator', 'mob'].includes(l.charLabel)) castSet.add(l.charLabel);
      if (l.bg && l.bg !== 'off') {
        if (!bgSet.size) firstBg = String(l.bg);
        bgSet.add(String(l.bg));
      }
      if (l.bgm && firstBgm === '002' && !['off', 'fade_out', 'pause'].includes(String(l.bgm))) {
        firstBgm = String(l.bgm);
      }
    });

    castSet.forEach((lb) => {
      if (!characters[lb] && META_BY_LABEL[lb]) {
        const m = META_BY_LABEL[lb];
        characters[lb] = { charType: 'characters', charId: m.id, charCategory: 'stand_fix', name: m.speaker, nameZh: m.nameZh };
      }
    });

    const meta = (scprojObj && scprojObj.meta) || {};
    const title = opts.title || meta.titleZh || meta.title || opts.fileBaseName || '导入的 scproj 剧本';
    const cast = Array.from(castSet);
    const scriptRows = rawLines
      .filter((l) => l && l.text !== undefined)
      .map((l) => ({
        kind: l.speaker ? 'dialogue' : 'narration',
        speaker: l.speaker || '',
        charLabel: l.charLabel || '',
        text: l.text || '',
        textZh: (l._meta && l._meta.zh) || l.text || '',
        anim1: l.charAnim1 || 'wait1',
        anim2: l.charAnim2 || 'face_wait',
        lip: l.charLipAnim || '',
        ...(l.bg ? { bg: l.bg } : {}),
        ...(l.bgm ? { bgm: l.bgm } : {}),
        ...(l.se ? { se: l.se } : {}),
        ...(l._meta && l._meta['x-stageNote'] ? { stageNote: l._meta['x-stageNote'] } : {}),
        ...(l._meta ? { _meta: Object.assign({}, l._meta) } : {})
      }));

    return {
      ok: true,
      format: 'scproj',
      formatLabel: 'scproj 标准剧本 JSON',
      preservePrecompiled: true,
      title,
      premise: `导入 scproj 剧本（${rawLines.length} 行）`,
      cast,
      characters,
      scenes: [
        {
          sceneId: 'scene_01',
          title,
          titleJa: meta.title || title,
          bg: firstBg,
          bgm: firstBgm,
          cast,
          preservePrecompiled: true,
          summary: `导入 scproj 剧本：共 ${rawLines.length} 行演出指令`,
          segments: [{ beatId: 'beat_1', title: '完整导入剧情', summary: `共 ${rawLines.length} 行演出指令`, cast, targetLines: rawLines.length }],
          beats: [`节拍 1：scproj 完整演出（${rawLines.length} 行）`],
          scriptRows,
          precompiledLines: rawLines
        }
      ],
      stats: {
        sceneCount: 1,
        sourceCount: rawLines.length,
        lineCount: rawLines.length,
        dialogueCount: rawLines.filter((l) => l && l.text).length,
        bgCount: bgSet.size || 1,
        castCount: cast.length
      }
    };
  }

  // Semantic rules for automatic bg / bgm / emotion assignment on plain dialogue
  const SEMANTIC_BG_RULES = [
    { re: /海边|沙滩|海滩|大海|泳池|海岸|浪花|夏日海|beach|sea|ocean/i, bg: '00269', bgm: '026' },
    { re: /舞台|演唱会|Live|聚光灯|公演|演出会场|观众席|偶像祭/i, bg: '00015', bgm: '028' },
    { re: /录音棚|录音室|麦克风|录歌|试音/i, bg: '00032', bgm: '014' },
    { re: /练习室|舞蹈室|排练|镜子前|练舞|训练室|lesson/i, bg: '00014', bgm: '014' },
    { re: /咖啡厅|甜品店|蛋糕|下午茶|餐厅|喫茶店|食堂/i, bg: '00011', bgm: '005' },
    { re: /天台|屋顶/i, bg: '00363', bgm: '011' },
    { re: /夜晚|星空|夜空|月光|深夜|夜景|街头夜|回家路上/i, bg: '00004', bgm: '019' },
    { re: /公园|街道|散步|樱花|树下|长椅|户外|商店街/i, bg: '00028', bgm: '003' },
    { re: /车站|电车|月台|机场|列车/i, bg: '00116', bgm: '011' },
    { re: /教室|学校|放学|课桌|走廊|校园/i, bg: '00039', bgm: '003' },
    { re: /房间|卧室|家里|宿舍|被窝|客厅/i, bg: '00054', bgm: '005' },
    { re: /休息室|后台|乐屋|化妆间|待机室|事务所|办公室|283|社长室|会议|工作台/i, bg: '00001', bgm: '002' }
  ];

  const SEMANTIC_BGM_MOOD_RULES = [
    { re: /悲伤|难过|哭泣|眼泪|失落|痛苦|寂寞|对不起|遗憾|委屈|哽咽/i, bgm: '019' },
    { re: /紧张|危机|糟糕|不妙|争吵|严肃|质问|冲突|心跳加速|决胜/i, bgm: '022' },
    { re: /感动|温暖|温柔|约定|星空|告白|谢谢你|最重要|心意|羁绊/i, bgm: '011' },
    { re: /开心|高兴|太好了|耶|庆祝|欢呼|热闹|元气|干劲|冲呀|出发/i, bgm: '026' }
  ];

  const SEMANTIC_EMOTION_RULES = [
    {
      emotion: 'confess_shy',
      anim1: '',
      anim2: '',
      re: /告白|喜欢你|最喜欢|一直想着|待在.*身边|最重要的人|其实我一直|那、那个……|すき|好きだ|ずっと.*そばに/i
    },
    {
      emotion: 'fluster_panic',
      anim1: '',
      anim2: '',
      re: /慌张|手忙脚乱|糟糕|完蛋|来不及|救命|不妙|语无伦次|结结巴巴|没、没有啦|怎么会这样|やばい|あわて|大変/i
    },
    {
      emotion: 'coverup_bright',
      anim1: '',
      anim2: '',
      re: /改口|强装|逞强|转移话题|没、没什么|没什么啦|才不是呢|开玩笑的|哈哈.*对了|なんでもない|冗談/i
    },
    {
      emotion: 'smug_tease',
      anim1: '',
      anim2: '',
      re: /得意|叉腰|坏笑|挑眉|轻哼|哼哼|早知道了|当然啦|还差得远|逗你玩|ふふん|当然/i
    },
    {
      emotion: 'deadpan_tsukkomi',
      anim1: '',
      anim2: '',
      re: /吐槽|半月眼|冷漠|面无表情|敷衍|真是受不了|你认真的吗|行吧行吧|じとっ|やれやれ/i
    },
    {
      emotion: 'wry_smile',
      anim1: '',
      anim2: '',
      re: /苦笑|干笑|勉强笑|讪笑|营业笑|假笑|真拿你没办法|あはは…/i
    },
    {
      emotion: 'warm_relief',
      anim1: '',
      anim2: '',
      re: /温柔|松了口气|会心一笑|欣慰|安心|太好了呢|温和|柔声|ほっと|安心し/i
    },
    {
      emotion: 'shy',
      anim1: '',
      anim2: '',
      re: /害羞|脸红|小声|欲言又止|羞|笨蛋|讨厌啦|才不是|唔…|呜…|心跳|笨、笨蛋|別看我|太近了|支吾|バカ|好き|照れ|ドキドキ/i
    },
    {
      emotion: 'surprised',
      anim1: '',
      anim2: '',
      re: /惊讶|惊慌|震惊|吃惊|吓一跳|呀啊[！？?!]|诶[？！?!]|咦[？！?!]|欸[？！?!]|什么[？！?!]|真的吗|不会吧|骗人|居然|竟然|えっ|ええっ|まさか|本当[？?!]/i
    },
    {
      emotion: 'sad',
      anim1: '',
      anim2: '',
      re: /难过|悲伤|伤心|眼泪|哭|呜呜|对不起|抱歉|失落|委屈|寂寞|不安|做不到|放弃|ごめん|すみません|泣|寂しい|辛い/i
    },
    {
      emotion: 'angry',
      anim1: '',
      anim2: '',
      re: /生气|愤怒|傲娇|可恶|太过分|不许|绝对不行|哼[！!]|真是的|气死|不原谅|怒|ひどい|もう[！!]|絶対ダメ/i
    },
    {
      emotion: 'excited',
      anim1: '',
      anim2: '',
      re: /兴奋|激动|欢呼|营业|偶像|太棒了|好耶|耶[！!~～]|太好了|超开心|干劲十足|全力以赴|冲鸭|一定能行|交给我吧|やった|最高|頑張る|楽しみ/i
    },
    {
      emotion: 'happy',
      anim1: '',
      anim2: '',
      re: /开心|高兴|笑|呵呵|嘻嘻|哈哈|谢谢|太感谢|喜欢|好吃|美味|真好|幸福|欢迎回来|辛苦啦|辛苦了|早安|早上好|♪|♡|ふふ|あはは|ありがとう|嬉しい|楽しい|おかえり|お疲れ/i
    },
    {
      emotion: 'serious',
      anim1: '',
      anim2: '',
      re: /认真|严肃|思考|考虑|必须|决定|目标|排练|练习|正式|约定|绝对要|发誓|真剣|考え|約束|目標/i
    },
    {
      emotion: 'troubled',
      anim1: '',
      anim2: '',
      re: /困扰|烦恼|怎么办|头疼|为难|纠结|不知道|迷茫|叹气|唉|困った|どうしよう|悩/i
    }
  ];

  function inferSceneBgAndBgm(contextText, fallbackBg, fallbackBgm, sceneIndex = 0) {
    const text = String(contextText || '');
    const explicitBg = text.match(/(?:背景|bg)[：:\s]*(\d{1,5})/i);
    const explicitBgm = text.match(/(?:bgm|音乐|配乐)[：:\s]*(\d{1,4})/i);
    let chosenBg = explicitBg ? padBgId(explicitBg[1]) : (fallbackBg ? padBgId(fallbackBg) : '');
    let chosenBgm = explicitBgm ? String(explicitBgm[1]) : (fallbackBgm ? String(fallbackBgm) : '');

    for (const rule of SEMANTIC_BG_RULES) {
      if (rule.re.test(text)) {
        if (!chosenBg) chosenBg = rule.bg;
        if (!chosenBgm) chosenBgm = rule.bgm;
        break;
      }
    }
    for (const mRule of SEMANTIC_BGM_MOOD_RULES) {
      if (mRule.re.test(text)) {
        if (!explicitBgm && (!fallbackBgm || fallbackBgm === '002')) {
          chosenBgm = mRule.bgm;
        }
        break;
      }
    }
    const defaultBgRotation = ['00001', '00004', '00003', '00008', '00012'];
    const defaultBgmRotation = ['002', '014', '003', '011', '026'];
    if (!chosenBg) chosenBg = defaultBgRotation[sceneIndex % defaultBgRotation.length];
    if (!chosenBgm) chosenBgm = defaultBgmRotation[sceneIndex % defaultBgmRotation.length];
    return { bg: chosenBg, bgm: chosenBgm };
  }

  function inferRowEmotionAndStage(row, prevEmotion = 'calm') {
    const noteText = String(row.emotionHint || row.note || '').trim();
    const bodyText = `${row.text || ''} ${row.textZh || ''}`.trim();
    const combined = `${noteText} ${row.emotion || ''} ${bodyText}`.trim();

    // 复合心理识别：避免单个舞台提示词 `(认真)` 把紧张结巴的告白台词锁成面瘫 `serious`；
    // 明确舞台情绪标签（如 `（偶像）`/`（开心）`）优先于正文中提到的第三人称情绪词。
    let matchedEmotion = '';
    if (/(认真|鼓起勇气|下定决心|深吸)/.test(noteText) && /(那、那个|一直|喜欢|告白|其实|对不起|笨蛋|别|没、没|只、只是)/.test(bodyText)) {
      matchedEmotion = /告白|喜欢|一直|待在.*身边/.test(bodyText) ? 'confess_shy' : 'earnest_shy';
    } else if (/(改口|强装|逞强|摆手|慌忙笑着)/.test(noteText) || (/(哈哈|啊哈哈|开玩笑)/.test(bodyText) && /(没、|才不|……|对、对不起)/.test(bodyText))) {
      matchedEmotion = 'coverup_bright';
    } else if (/^(?:偶像|营业|perform|idol)$/i.test(noteText)) {
      matchedEmotion = 'idol';
    } else {
      if (noteText) {
        for (const rule of SEMANTIC_EMOTION_RULES) {
          if (rule.re.test(noteText)) {
            matchedEmotion = rule.emotion;
            break;
          }
        }
      }
      if (!matchedEmotion) {
        for (const rule of SEMANTIC_EMOTION_RULES) {
          if (rule.re.test(bodyText)) {
            matchedEmotion = rule.emotion;
            break;
          }
        }
      }
    }

    const explicitEmo = String(row.emotion || '').trim().toLowerCase();
    const emotion = explicitEmo || matchedEmotion || (row.kind === 'narration' ? 'calm' : prevEmotion || 'calm');
    // 不再用静态 wait1 / face_wait / wait3 预先占位，把 28 人实测骨架选择权完整交给 studio-engine 编译器
    const anim1 = (row.anim1 && row.anim1 !== 'wait1') ? row.anim1 : '';
    const anim2 = (row.anim2 && row.anim2 !== 'face_wait') ? row.anim2 : '';

    // 只有旁白/转场提示行才触发场景与情绪配乐切换，避免普通对白因关键词频繁重切 BGM
    let rowBg = row.bg ? padBgId(row.bg) : '';
    let rowBgm = row.bgm ? String(row.bgm) : '';
    if (!rowBg && row.kind === 'narration') {
      for (const rule of SEMANTIC_BG_RULES) {
        if (rule.re.test(combined)) {
          rowBg = rule.bg;
          if (!rowBgm) rowBgm = rule.bgm;
          break;
        }
      }
    }
    if (!rowBgm && (row.kind === 'narration' || row.sceneBreak)) {
      for (const mRule of SEMANTIC_BGM_MOOD_RULES) {
        if (mRule.re.test(combined)) {
          rowBgm = mRule.bgm;
          break;
        }
      }
    }

    return {
      emotion,
      anim1,
      anim2,
      ...(rowBg ? { bg: rowBg } : {}),
      ...(rowBgm ? { bgm: rowBgm } : {})
    };
  }

  function convertOutlineJsonToResult(rawObj, opts = {}) {
    const rawScenes = Array.isArray(rawObj) ? rawObj : (rawObj.scenes || rawObj.outlines || []);
    const characters = {};
    const allCast = new Set();
    let totalRows = 0;

    const scenes = rawScenes.map((sc, sIdx) => {
      const castArr = Array.isArray(sc.cast)
        ? sc.cast.map((c) => resolveIdolLabel(c) || String(c)).filter((c) => META_BY_LABEL[c])
        : [];
      const rowSrc = Array.isArray(sc.scriptRows) ? sc.scriptRows : (Array.isArray(sc.lines) ? sc.lines : []);
      let prevEmo = 'calm';
      const scriptRows = rowSrc.map((r) => {
        if (typeof r === 'string') {
          const parsedRow = parsePlainDialogueLine(r);
          if (!parsedRow) return null;
          if (parsedRow.charLabel && parsedRow.charLabel !== 'producer' && !castArr.includes(parsedRow.charLabel)) {
            castArr.push(parsedRow.charLabel);
          }
          prevEmo = parsedRow.emotion || prevEmo;
          return parsedRow;
        }
        const sp = String(r.speaker || r.name || '').trim();
        const lb = resolveIdolLabel(r.charLabel || sp);
        if (lb && lb !== 'producer' && !castArr.includes(lb)) castArr.push(lb);
        const explicitAnim1 = r.anim1 || r.charAnim1 || '';
        const explicitAnim2 = normalizeFace(r.anim2 || r.charAnim2 || '');
        const explicitLip = normalizeLip(r.lip || r.charLipAnim || '');
        const baseRow = {
          ...r,
          kind: r.kind || (sp ? 'dialogue' : 'narration'),
          speaker: sp,
          charLabel: (lb && lb !== 'producer') ? lb : (r.charLabel || ''),
          text: String(r.text || r.line || ''),
          textZh: String(r.textZh || r.zh || r.text || ''),
          anim1: explicitAnim1,
          anim2: explicitAnim2,
          lip: explicitLip
        };
        const inferred = inferRowEmotionAndStage(baseRow, prevEmo);
        prevEmo = inferred.emotion;
        return {
          ...baseRow,
          emotion: r.emotion || inferred.emotion,
          anim1: explicitAnim1,
          anim2: explicitAnim2,
          ...(r.bg ? { bg: padBgId(r.bg) } : (inferred.bg ? { bg: inferred.bg } : {})),
          ...(r.bgm ? { bgm: String(r.bgm) } : (inferred.bgm ? { bgm: inferred.bgm } : {}))
        };
      }).filter((r) => r && r.text);

      totalRows += scriptRows.length;
      castArr.forEach((c) => {
        allCast.add(c);
        if (!characters[c] && META_BY_LABEL[c]) {
          const m = META_BY_LABEL[c];
          characters[c] = { charType: 'characters', charId: m.id, charCategory: 'stand', name: m.speaker, nameZh: m.nameZh };
        }
      });

      const segsIn = Array.isArray(sc.segments) ? sc.segments : [];
      const beatsIn = Array.isArray(sc.beats) ? sc.beats : [];
      const segments = segsIn.length
        ? segsIn.map((sg, bIdx) => ({
            beatId: sg.beatId || `beat_${bIdx + 1}`,
            title: String(sg.title || `小段 ${bIdx + 1}`),
            summary: String(sg.summary || sg.title || ''),
            cast: Array.isArray(sg.cast) ? sg.cast : castArr.slice(),
            targetLines: Number(sg.targetLines) || 4
          }))
        : beatsIn.map((b, bIdx) => ({
            beatId: `beat_${bIdx + 1}`,
            title: String(b).slice(0, 24),
            summary: String(b),
            cast: castArr.slice(),
            targetLines: 4
          }));

      if (!segments.length) {
        segments.push({
          beatId: 'beat_1',
          title: sc.title || `第 ${sIdx + 1} 幕内容`,
          summary: sc.summary || (scriptRows[0] && scriptRows[0].text) || '导入剧情',
          cast: castArr.slice(),
          targetLines: Math.max(2, scriptRows.length || 4)
        });
      }

      const sceneTextSample = `${sc.title || ''} ${sc.summary || ''} ${scriptRows.map((r) => r.text).join(' ')}`;
      const inferredSceneStage = inferSceneBgAndBgm(sceneTextSample, sc.bg, sc.bgm, sIdx);

      return {
        sceneId: sc.sceneId || `scene_${String(sIdx + 1).padStart(2, '0')}`,
        title: String(sc.title || `第 ${sIdx + 1} 幕`),
        titleJa: String(sc.titleJa || sc.title || `Scene ${sIdx + 1}`),
        bg: sc.bg ? padBgId(sc.bg) : inferredSceneStage.bg,
        bgm: sc.bgm ? String(sc.bgm) : inferredSceneStage.bgm,
        cast: castArr,
        preservePrecompiled: false,
        summary: String(sc.summary || ''),
        segments,
        beats: segments.map((sg, i) => `节拍 ${i + 1}：${sg.title} —— ${sg.summary}`),
        scriptRows
      };
    });

    const title = opts.title || (!Array.isArray(rawObj) && (rawObj.title || rawObj.nameZh || rawObj.name)) || opts.fileBaseName || '外部导入大纲与剧本';
    return {
      ok: true,
      format: 'outline_json',
      formatLabel: '外部分幕大纲 / AI 生成 JSON',
      preservePrecompiled: false,
      title,
      premise: (!Array.isArray(rawObj) && (rawObj.premise || rawObj.summary)) || scenes.map((s) => s.title).join(' → '),
      cast: Array.from(allCast),
      characters,
      scenes,
      stats: {
        sceneCount: scenes.length,
        sourceCount: rawScenes.length,
        lineCount: totalRows || scenes.length * 3,
        dialogueCount: totalRows,
        bgCount: new Set(scenes.map((s) => s.bg)).size,
        castCount: allCast.size
      }
    };
  }

  function parsePlainDialogueLine(rawLine, prevEmotion = 'calm') {
    const line = String(rawLine || '').trim();
    if (!line) return null;
    // Match `说话人（动作/表情）：台词` or `说话人: 台词`
    const m = line.match(/^([^：:（）()\[\]【】]{1,18}?)(?:\s*[（(\[]([^）)\]]{1,48})[）)\]])?\s*[：:]\s*(.+)$/);
    if (m) {
      const spRaw = m[1].trim();
      const note = (m[2] || '').trim();
      const text = m[3].trim();
      const lb = resolveIdolLabel(spRaw);
      const isProd = lb === 'producer';
      const baseRow = {
        kind: 'dialogue',
        speaker: isProd ? '制作人' : (lb && META_BY_LABEL[lb] ? META_BY_LABEL[lb].speaker : spRaw),
        charLabel: (!isProd && lb) ? lb : '',
        text,
        textZh: text,
        anim1: '',
        anim2: '',
        lip: '',
        ...(note ? { emotionHint: note, note } : {})
      };
      const inferred = inferRowEmotionAndStage(baseRow, prevEmotion);
      return {
        ...baseRow,
        emotion: inferred.emotion,
        anim1: '',
        anim2: '',
        ...(inferred.bg ? { bg: inferred.bg } : {}),
        ...(inferred.bgm ? { bgm: inferred.bgm } : {})
      };
    }
    const cleanNarr = line.replace(/^[（(]|[）)]$/g, '');
    const narrBase = {
      kind: 'narration',
      speaker: '',
      charLabel: '',
      text: cleanNarr,
      textZh: cleanNarr
    };
    const inferred = inferRowEmotionAndStage(narrBase, prevEmotion);
    return {
      ...narrBase,
      emotion: inferred.emotion,
      ...(inferred.bg ? { bg: inferred.bg } : {}),
      ...(inferred.bgm ? { bgm: inferred.bgm } : {})
    };
  }

  function convertPlainDialogue(rawInput, opts = {}) {
    // Support both structured array of dialogue rows `[ { speaker, text, ... } ]` and plain text string
    if (Array.isArray(rawInput)) {
      const scenes = [];
      let curScene = null;
      const allCast = new Set();
      const characters = {};
      let prevEmo = 'calm';

      const startScene = (titleHint, bgHint, bgmHint) => {
        const idx = scenes.length + 1;
        curScene = {
          sceneId: `scene_${String(idx).padStart(2, '0')}`,
          title: titleHint || `第 ${idx} 幕 · 导入对话`,
          titleJa: titleHint || `第 ${idx} 幕`,
          bg: bgHint ? padBgId(bgHint) : '',
          bgm: bgmHint ? String(bgmHint) : '',
          cast: [],
          preservePrecompiled: false,
          summary: '',
          segments: [],
          beats: [],
          scriptRows: []
        };
        scenes.push(curScene);
      };

      rawInput.forEach((item, idx) => {
        if (!item) return;
        if (typeof item === 'string') {
          const parsed = parsePlainDialogueLine(item, prevEmo);
          if (!parsed) return;
          if (!curScene) startScene(opts.title || '第 1 幕 · 外部导入对话', parsed.bg, parsed.bgm);
          if (parsed.bg && !curScene.bg) curScene.bg = parsed.bg;
          if (parsed.bgm && !curScene.bgm) curScene.bgm = parsed.bgm;
          if (parsed.charLabel) {
            if (!curScene.cast.includes(parsed.charLabel)) curScene.cast.push(parsed.charLabel);
            allCast.add(parsed.charLabel);
            if (!characters[parsed.charLabel] && META_BY_LABEL[parsed.charLabel]) {
              const m = META_BY_LABEL[parsed.charLabel];
              characters[parsed.charLabel] = { charType: 'characters', charId: m.id, charCategory: 'stand', name: m.speaker, nameZh: m.nameZh };
            }
          }
          prevEmo = parsed.emotion || prevEmo;
          curScene.scriptRows.push(parsed);
          return;
        }
        if (typeof item === 'object') {
          const spRaw = String(item.speaker || item.name || '').trim();
          const lb = resolveIdolLabel(item.charLabel || spRaw);
          const isProd = lb === 'producer';
          const text = String(item.text || item.line || item.zh || '').trim();
          if (!text && !item.bg && !item.bgm) return;
          const explicitAnim1 = item.anim1 || item.charAnim1 || '';
          const explicitAnim2 = normalizeFace(item.anim2 || item.charAnim2 || '');
          const explicitLip = normalizeLip(item.lip || item.charLipAnim || '');
          const baseRow = {
            ...item,
            kind: item.kind || (spRaw ? 'dialogue' : 'narration'),
            speaker: isProd ? '制作人' : (lb && META_BY_LABEL[lb] ? META_BY_LABEL[lb].speaker : spRaw),
            charLabel: (!isProd && lb) ? lb : (item.charLabel || ''),
            text,
            textZh: String(item.textZh || item.zh || text),
            anim1: explicitAnim1,
            anim2: explicitAnim2,
            lip: explicitLip
          };
          const inferred = inferRowEmotionAndStage(baseRow, prevEmo);
          prevEmo = item.emotion || inferred.emotion || prevEmo;

          // If this row shifts to a new background after several lines, or if no scene exists yet
          if (!curScene) {
            startScene(opts.title || '第 1 幕 · 外部导入对话', item.bg || inferred.bg, item.bgm || inferred.bgm);
          } else if (item.sceneBreak || (inferred.bg && curScene.bg && inferred.bg !== curScene.bg && curScene.scriptRows.length >= 3 && !item.bg)) {
            startScene(`第 ${scenes.length + 1} 幕 · 场景转换`, inferred.bg, item.bgm || inferred.bgm);
          }

          const enrichedRow = {
            ...baseRow,
            emotion: item.emotion || inferred.emotion,
            anim1: explicitAnim1,
            anim2: explicitAnim2,
            ...(item.bg ? { bg: padBgId(item.bg) } : (inferred.bg ? { bg: inferred.bg } : {})),
            ...(item.bgm ? { bgm: String(item.bgm) } : (inferred.bgm ? { bgm: inferred.bgm } : {}))
          };

          if (!curScene.bg && enrichedRow.bg) curScene.bg = enrichedRow.bg;
          if (!curScene.bgm && enrichedRow.bgm) curScene.bgm = enrichedRow.bgm;

          if (enrichedRow.charLabel && enrichedRow.charLabel !== 'producer') {
            if (!curScene.cast.includes(enrichedRow.charLabel)) curScene.cast.push(enrichedRow.charLabel);
            allCast.add(enrichedRow.charLabel);
            if (!characters[enrichedRow.charLabel] && META_BY_LABEL[enrichedRow.charLabel]) {
              const m = META_BY_LABEL[enrichedRow.charLabel];
              characters[enrichedRow.charLabel] = { charType: 'characters', charId: m.id, charCategory: 'stand', name: m.speaker, nameZh: m.nameZh };
            }
          }
          curScene.scriptRows.push(enrichedRow);
        }
      });

      if (!scenes.length || !scenes.some((s) => s.scriptRows.length > 0)) {
        return { ok: false, error: '未能识别到有效剧情行' };
      }

      scenes.forEach((sc, sIdx) => {
        const combinedText = `${sc.title} ${sc.scriptRows.map((r) => r.text).join(' ')}`;
        const stage = inferSceneBgAndBgm(combinedText, sc.bg, sc.bgm, sIdx);
        sc.bg = sc.bg || stage.bg;
        sc.bgm = sc.bgm || stage.bgm;
        sc.scriptRows.forEach((r) => {
          if (!r.bg) r.bg = sc.bg;
          if (!r.bgm) r.bgm = sc.bgm;
        });
        const preview = sc.scriptRows.slice(0, 3).map((r) => `${r.speaker || '旁白'}：${r.text.slice(0, 18)}`).join(' / ');
        sc.summary = preview || sc.title;
        sc.segments = [{
          beatId: 'beat_1',
          title: sc.title,
          summary: sc.summary,
          cast: sc.cast.slice(),
          targetLines: Math.max(2, sc.scriptRows.length)
        }];
        sc.beats = [`节拍 1：${sc.title}（${sc.scriptRows.length} 句）`];
      });

      const totalLines = scenes.reduce((acc, s) => acc + s.scriptRows.length, 0);
      return {
        ok: true,
        format: 'plain_dialogue_json',
        formatLabel: '纯对话数组（自动推断背景/配乐/情绪）',
        preservePrecompiled: false,
        title: opts.title || opts.fileBaseName || (scenes[0] && scenes[0].title) || '对话导入剧本',
        premise: scenes.map((s) => s.summary).join('；').slice(0, 180),
        cast: Array.from(allCast),
        characters,
        scenes,
        stats: {
          sceneCount: scenes.length,
          sourceCount: rawInput.length,
          lineCount: totalLines,
          dialogueCount: totalLines,
          bgCount: new Set(scenes.map((s) => s.bg)).size,
          castCount: allCast.size
        }
      };
    }

    const linesRaw = String(rawInput || '').replace(/\r\n/g, '\n').split('\n');
    const scenes = [];
    let curScene = null;
    const allCast = new Set();
    const characters = {};
    let prevEmo = 'calm';

    const pushSceneIfNeeded = (titleHint, bgHint, bgmHint) => {
      const idx = scenes.length + 1;
      const inferred = inferSceneBgAndBgm(titleHint || '', bgHint, bgmHint, idx - 1);
      curScene = {
        sceneId: `scene_${String(idx).padStart(2, '0')}`,
        title: titleHint || `第 ${idx} 幕 · 导入剧情`,
        titleJa: titleHint || `第 ${idx} 幕`,
        bg: bgHint ? padBgId(bgHint) : (titleHint ? inferred.bg : ''),
        bgm: bgmHint ? String(bgmHint) : (titleHint ? inferred.bgm : ''),
        cast: [],
        preservePrecompiled: false,
        summary: '',
        segments: [],
        beats: [],
        scriptRows: []
      };
      scenes.push(curScene);
    };

    linesRaw.forEach((rawLine) => {
      const ln = rawLine.trim();
      if (!ln) return;
      // Match Markdown headings or `第X幕` / `Scene X` / `【场景：...】` headers
      const hm = ln.match(/^(?:#{1,3}\s*|【)?((?:第\s*[0-9一二三四五六七八九十]+\s*[幕场节话]|Scene\s*\d+|场景\s*[0-9一二三四五六七八九十：:])[^】]*)(?:】)?$/i)
        || (ln.startsWith('#') ? [ln, ln.replace(/^#+\s*/, '').trim()] : null);
      if (hm) {
        const headerTitle = (hm[1] || ln).trim();
        const bgMatch = headerTitle.match(/(?:背景|bg)[：:\s]*(\d{1,5})/i);
        const bgmMatch = headerTitle.match(/(?:bgm|音乐|配乐)[：:\s]*(\d{1,4})/i);
        pushSceneIfNeeded(
          headerTitle,
          bgMatch ? padBgId(bgMatch[1]) : '',
          bgmMatch ? String(bgmMatch[1]) : ''
        );
        return;
      }
      const parsed = parsePlainDialogueLine(ln, prevEmo);
      if (!parsed) return;
      prevEmo = parsed.emotion || prevEmo;

      // Check if a narration line indicates a clear location transition mid-text
      if (curScene && parsed.kind === 'narration' && parsed.bg && curScene.bg && parsed.bg !== curScene.bg && curScene.scriptRows.length >= 2) {
        pushSceneIfNeeded(`第 ${scenes.length + 1} 幕 · ${parsed.text.slice(0, 16)}`, parsed.bg, parsed.bgm);
      }
      if (!curScene) {
        pushSceneIfNeeded(opts.title || '第 1 幕 · 外部导入文本', parsed.bg || '', parsed.bgm || '');
      }
      if (!curScene.bg && parsed.bg) curScene.bg = parsed.bg;
      if (!curScene.bgm && parsed.bgm) curScene.bgm = parsed.bgm;

      if (parsed.charLabel) {
        if (!curScene.cast.includes(parsed.charLabel)) curScene.cast.push(parsed.charLabel);
        allCast.add(parsed.charLabel);
        if (!characters[parsed.charLabel] && META_BY_LABEL[parsed.charLabel]) {
          const m = META_BY_LABEL[parsed.charLabel];
          characters[parsed.charLabel] = { charType: 'characters', charId: m.id, charCategory: 'stand', name: m.speaker, nameZh: m.nameZh };
        }
      }
      curScene.scriptRows.push(parsed);
    });

    if (!scenes.length || !scenes.some((s) => s.scriptRows.length > 0)) {
      return { ok: false, error: '未能识别到有效剧情行，请检查输入格式（支持 JSON 或「角色：台词」文本）' };
    }

    scenes.forEach((sc, sIdx) => {
      const combinedText = `${sc.title} ${sc.scriptRows.map((r) => `${r.emotionHint || ''} ${r.text}`).join(' ')}`;
      const stage = inferSceneBgAndBgm(combinedText, sc.bg, sc.bgm, sIdx);
      sc.bg = sc.bg || stage.bg;
      sc.bgm = sc.bgm || stage.bgm;
      let activeBg = sc.bg;
      let activeBgm = sc.bgm;
      sc.scriptRows.forEach((r) => {
        if (r.bg) activeBg = r.bg;
        else r.bg = activeBg;
        if (r.bgm) activeBgm = r.bgm;
        else r.bgm = activeBgm;
      });
      const preview = sc.scriptRows.slice(0, 3).map((r) => `${r.speaker || '旁白'}：${r.text.slice(0, 18)}`).join(' / ');
      sc.summary = preview || sc.title;
      sc.segments = [{
        beatId: 'beat_1',
        title: sc.title,
        summary: sc.summary,
        cast: sc.cast.slice(),
        targetLines: Math.max(2, sc.scriptRows.length)
      }];
      sc.beats = [`节拍 1：${sc.title}（${sc.scriptRows.length} 句）`];
    });

    const totalLines = scenes.reduce((acc, s) => acc + s.scriptRows.length, 0);
    return {
      ok: true,
      format: 'plain_text',
      formatLabel: '纯文本 / Markdown 对白剧本',
      preservePrecompiled: false,
      title: opts.title || opts.fileBaseName || (scenes[0] && scenes[0].title) || '文本导入剧本',
      premise: scenes.map((s) => s.summary).join('；').slice(0, 180),
      cast: Array.from(allCast),
      characters,
      scenes,
      stats: {
        sceneCount: scenes.length,
        sourceCount: totalLines,
        lineCount: totalLines,
        dialogueCount: totalLines,
        bgCount: new Set(scenes.map((s) => s.bg)).size,
        castCount: allCast.size
      }
    };
  }

  const convertPlainTextToResult = convertPlainDialogue;

  function parseExternalInput(rawTextOrObj, opts = {}) {
    let parsedObj = null;
    if (typeof rawTextOrObj === 'string') {
      const trimmed = rawTextOrObj.trim();
      if (!trimmed) return { ok: false, error: '输入内容为空' };
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          parsedObj = JSON.parse(trimmed);
        } catch (err) {
          return { ok: false, error: 'JSON 解析失败：' + err.message };
        }
      } else {
        return convertPlainDialogue(trimmed, opts);
      }
    } else if (rawTextOrObj && typeof rawTextOrObj === 'object') {
      parsedObj = rawTextOrObj;
    } else {
      return { ok: false, error: '不支持的输入类型' };
    }

    if (Array.isArray(parsedObj)) {
      if (isFanPlayerArray(parsedObj)) return convertFanPlayerArray(parsedObj, opts);
      if (isScprojArray(parsedObj)) return convertScprojToResult(parsedObj, opts);
      if (parsedObj.some((x) => x && typeof x === 'object' && (x.scenes || x.segments || x.beats || x.summary || x.lines || x.scriptRows))) {
        return convertOutlineJsonToResult(parsedObj, opts);
      }
      if (parsedObj.some((x) => x && typeof x === 'object' && ('text' in x || 'speaker' in x || 'line' in x || 'zh' in x))) {
        return convertPlainDialogue(parsedObj, opts);
      }
      return { ok: false, error: '无法识别该 JSON 数组结构（缺少 bg / chars / speaker / text 等字段）' };
    }

    if (parsedObj.format === 'scproj' && Array.isArray(parsedObj.lines)) {
      return convertScprojToResult(parsedObj, opts);
    }
    if (Array.isArray(parsedObj.scenes) || Array.isArray(parsedObj.outlines)) {
      return convertOutlineJsonToResult(parsedObj, opts);
    }
    if (Array.isArray(parsedObj.lines)) {
      if (isFanPlayerArray(parsedObj.lines)) return convertFanPlayerArray(parsedObj.lines, { ...opts, title: parsedObj.title || opts.title });
      return convertScprojToResult(parsedObj, opts);
    }
    if (parsedObj.title || parsedObj.summary || parsedObj.segments) {
      return convertOutlineJsonToResult([parsedObj], opts);
    }
    return { ok: false, error: '无法识别的 JSON 对象结构（请提供 scproj、外部播放器数组、或 { scenes: [...] } 大纲 JSON）' };
  }

  function toScprojDocument(rawTextOrObj, opts = {}) {
    const res = parseExternalInput(rawTextOrObj, opts);
    if (!res.ok) return res;
    const sc = res.scenes[0];
    const lines = (sc && Array.isArray(sc.precompiledLines) && sc.precompiledLines.length)
      ? sc.precompiledLines
      : (res.scenes.flatMap((s) => (s.scriptRows || []).map((r, ri) => ({
          id: `${s.sceneId}_${ri + 1}`,
          ...(ri === 0 && (r.bg || s.bg) ? { bg: r.bg || s.bg } : (r.bg ? { bg: r.bg } : {})),
          ...(ri === 0 && (r.bgm || s.bgm) ? { bgm: r.bgm || s.bgm } : (r.bgm ? { bgm: r.bgm } : {})),
          ...(r.speaker ? { speaker: r.speaker } : {}),
          ...(r.charLabel ? { charLabel: r.charLabel } : {}),
          ...(r.anim1 ? { charAnim1: r.anim1 } : {}),
          ...(r.anim2 ? { charAnim2: r.anim2 } : {}),
          ...(r.lip ? { charLipAnim: r.lip } : {}),
          text: r.text || '',
          textCtrl: 'p',
          textFrame: '001',
          _meta: {
            uid: `${s.sceneId}_u_${ri + 1}`,
            origin: 'external-import',
            ...(r.emotion ? { surfaceEmotion: r.emotion } : {}),
            ...(r._meta && r._meta['x-stageNote'] ? { 'x-stageNote': r._meta['x-stageNote'] } : {})
          }
        }))));

    return {
      ok: true,
      format: res.format,
      formatLabel: res.formatLabel,
      preservePrecompiled: Boolean(res.preservePrecompiled),
      stats: res.stats,
      scproj: {
        format: 'scproj',
        formatVersion: 2,
        meta: {
          id: opts.id || (opts.fileBaseName ? opts.fileBaseName.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) : 'imported_external') || 'imported_external',
          title: res.title,
          titleZh: res.title,
          origin: res.preservePrecompiled ? 'external-import' : res.format,
          ...(res.preservePrecompiled ? { 'x-preservePrecompiled': true } : {}),
          characters: res.characters
        },
        pack: {
          characters: res.characters
        },
        lines
      }
    };
  }

  return {
    IDOL_TABLE,
    resolveIdolLabel,
    padBgId,
    convertFanPlayerArray,
    convertPlainDialogue,
    convertPlainTextToResult,
    parseExternalInput,
    toScprojDocument
  };
});
