(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.IrodoriStraylight = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const IRODORI_DEFAULT_ENDPOINT = 'http://127.0.0.1:8088';
  const IRODORI_MODEL = 'irodori-tts';
  const STRAYLIGHT_CHAR_IDS = ['asahi', 'fuyuko', 'mei'];

  const STRAYLIGHT_CHAR_ALIAS_MAP = {
    asahi: 'asahi',
    asah: 'asahi',
    ash: 'asahi',
    'あさひ': 'asahi',
    '芹沢あさひ': 'asahi',
    '芹泽朝日': 'asahi',
    '芹泽朝阳': 'asahi',
    '朝日': 'asahi',
    '朝阳': 'asahi',
    fuyuko: 'fuyuko',
    fyuk: 'fuyuko',
    fyk: 'fuyuko',
    '冬優子': 'fuyuko',
    '黛冬優子': 'fuyuko',
    '黛冬优子': 'fuyuko',
    '冬优子': 'fuyuko',
    '冬优': 'fuyuko',
    mei: 'mei',
    '愛依': 'mei',
    '和泉愛依': 'mei',
    '和泉爱依': 'mei',
    '爱依': 'mei'
  };

  // 50 fine-grained Straylight Voice IDs (from Irodori-TTS Straylight specification §4)
  const STRAYLIGHT_VOICES = {
    asahi: [
      { id: 'asahi_neutral', group: 'asahi', label: '无特殊感情（日常/自然）' },
      { id: 'asahi_happy', group: 'asahi', label: '欣喜' },
      { id: 'asahi_excited', group: 'asahi', label: '激动+活力' },
      { id: 'asahi_confident', group: 'asahi', label: '自信' },
      { id: 'asahi_serious', group: 'asahi', label: '认真+决心' },
      { id: 'asahi_puzzled', group: 'asahi', label: '疑惑' },
      { id: 'asahi_shy', group: 'asahi', label: '害羞' },
      { id: 'asahi_sad', group: 'asahi', label: '低落+委屈' },
      { id: 'asahi_weak', group: 'asahi', label: '弱气' },
      { id: 'asahi_angry', group: 'asahi', label: '愤怒+较真' },
      { id: 'asahi_frustrated', group: 'asahi', label: '不甘+别扭' },
      { id: 'asahi_surprised', group: 'asahi', label: '惊讶' },
      { id: 'asahi_gentle', group: 'asahi', label: '温柔+平静' },
      { id: 'asahi_hesitant', group: 'asahi', label: '迟疑' }
    ],
    fuyuko: [
      // Omote (8)
      { id: 'fuyuko_omote', group: 'omote', label: '营业·招牌撒娇' },
      { id: 'fuyuko_neutral', group: 'omote', label: '营业·无特殊感情' },
      { id: 'fuyuko_happy', group: 'omote', label: '营业·欣喜' },
      { id: 'fuyuko_omote_excited', group: 'omote', label: '营业·激动+活力' },
      { id: 'fuyuko_surprised', group: 'omote', label: '营业·惊讶' },
      { id: 'fuyuko_omote_gentle', group: 'omote', label: '营业·温柔' },
      { id: 'fuyuko_omote_sad', group: 'omote', label: '营业·委屈装可怜' },
      { id: 'fuyuko_omote_hesitant', group: 'omote', label: '营业·小心翼翼' },
      // Honne (12)
      { id: 'fuyuko_honne', group: 'honne', label: '本音·招牌素声' },
      { id: 'fuyuko_honne_calm', group: 'honne', label: '本音·平淡日常' },
      { id: 'fuyuko_honne_happy', group: 'honne', label: '本音·得意真笑' },
      { id: 'fuyuko_angry', group: 'honne', label: '本音·愤怒' },
      { id: 'fuyuko_honne_tsun', group: 'honne', label: '本音·傲娇+责怪' },
      { id: 'fuyuko_honne_speechless', group: 'honne', label: '本音·无语白眼' },
      { id: 'fuyuko_shy', group: 'honne', label: '本音·害羞小声' },
      { id: 'fuyuko_sad', group: 'honne', label: '本音·低落+哭腔' },
      { id: 'fuyuko_serious', group: 'honne', label: '本音·认真思考' },
      { id: 'fuyuko_honne_surprised', group: 'honne', label: '本音·真吃惊' },
      { id: 'fuyuko_honne_sarcastic', group: 'honne', label: '本音·苦笑吐槽' },
      { id: 'fuyuko_honne_tired', group: 'honne', label: '本音·疲惫低沉' }
    ],
    mei: [
      { id: 'mei_neutral', group: 'mei', label: '无特殊感情' },
      { id: 'mei_gal', group: 'mei', label: '辣妹元气' },
      { id: 'mei_cool', group: 'mei', label: '冷静素声' },
      { id: 'mei_happy', group: 'mei', label: '欣喜' },
      { id: 'mei_excited', group: 'mei', label: '激动+活力' },
      { id: 'mei_confident', group: 'mei', label: '自信' },
      { id: 'mei_serious', group: 'mei', label: '认真+决心' },
      { id: 'mei_angry', group: 'mei', label: '愤怒+吐槽' },
      { id: 'mei_shy', group: 'mei', label: '害羞' },
      { id: 'mei_tsun', group: 'mei', label: '害羞别扭' },
      { id: 'mei_sad', group: 'mei', label: '低落+委屈' },
      { id: 'mei_surprised', group: 'mei', label: '惊讶' },
      { id: 'mei_puzzled', group: 'mei', label: '疑惑' },
      { id: 'mei_panic', group: 'mei', label: '慌张+急促' },
      { id: 'mei_gentle', group: 'mei', label: '温柔' },
      { id: 'mei_hesitant', group: 'mei', label: '迟疑' }
    ]
  };

  const VOICE_INDEX = new Map();
  for (const cid of STRAYLIGHT_CHAR_IDS) {
    for (const item of STRAYLIGHT_VOICES[cid]) {
      VOICE_INDEX.set(item.id, Object.assign({ charId: cid }, item));
    }
  }

  const COARSE_CHAR_TO_CANON = {
    asahi: 'asahi',
    asah: 'asahi',
    fuyuko: 'fuyuko',
    fyuk: 'fuyuko',
    mei: 'mei'
  };

  function normalizeStraylightCharId(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const lower = s.toLowerCase();
    if (STRAYLIGHT_CHAR_ALIAS_MAP[lower]) return STRAYLIGHT_CHAR_ALIAS_MAP[lower];
    if (STRAYLIGHT_CHAR_ALIAS_MAP[s]) return STRAYLIGHT_CHAR_ALIAS_MAP[s];
    const meta = VOICE_INDEX.get(lower);
    if (meta) return meta.charId;
    return '';
  }

  function isStraylightChar(charLabel, speaker) {
    return Boolean(normalizeStraylightCharId(charLabel) || normalizeStraylightCharId(speaker));
  }

  function isFineGrainedStraylightVoice(voiceId) {
    const v = String(voiceId || '').trim().toLowerCase();
    return Boolean(v && VOICE_INDEX.has(v));
  }

  function isCoarseStraylightVoice(voiceId) {
    const v = String(voiceId || '').trim().toLowerCase();
    return Boolean(v && Object.prototype.hasOwnProperty.call(COARSE_CHAR_TO_CANON, v));
  }

  function isValidStraylightVoiceId(voiceId) {
    return isFineGrainedStraylightVoice(voiceId) || isCoarseStraylightVoice(voiceId);
  }

  function getVoicesForChar(charId) {
    const cid = normalizeStraylightCharId(charId);
    return cid ? (STRAYLIGHT_VOICES[cid] || []) : [];
  }

  function getVoiceMeta(voiceId) {
    return VOICE_INDEX.get(String(voiceId || '').trim().toLowerCase()) || null;
  }

  function normalizeIrodoriOrigin(rawEndpoint) {
    let base = String(rawEndpoint || IRODORI_DEFAULT_ENDPOINT).trim().replace(/\/+$/, '');
    base = base
      .replace(/\/v1\/audio\/speech$/i, '')
      .replace(/\/v1$/i, '')
      .replace(/\/synthesize$/i, '');
    return base || IRODORI_DEFAULT_ENDPOINT;
  }

  const FISH_TAGS_RE = /<\/?(whisper|emphasis|soft|fast|slow|stress|forceful)\b[^>]*>/gi;
  const FISH_BRACKET_RE = /\[[A-Za-z][A-Za-z0-9 ,'-]{1,42}\]/g;

  function prepareIrodoriInputText(rawText) {
    let s = String(rawText || '').trim();
    if (!s) return '';
    // Remove stage directives like 【...】 and Fish Audio cues if present
    s = s.replace(/【[^】]*】/g, ' ')
      .replace(FISH_TAGS_RE, '')
      .replace(FISH_BRACKET_RE, '');
    s = s.trim();
    // Unwrap pure outer monologue parentheses so TTS receives clean spoken Japanese text
    if ((s.startsWith('（') && s.endsWith('）') && s.indexOf('（', 1) < 0) ||
        (s.startsWith('(') && s.endsWith(')') && s.indexOf('(', 1) < 0)) {
      s = s.slice(1, -1).trim();
    }
    const noInline = s.replace(/（[^）]{1,18}）/g, '').replace(/\([^)]{1,18}\)/g, '').trim();
    if (noInline) s = noInline;
    return s.replace(/\s+/g, ' ').trim();
  }

  function normalizeEmotionToken(raw) {
    const k = String(raw || '').trim().toLowerCase();
    if (!k) return '';
    const map = {
      joy_bright: 'joy',
      happy: 'joy',
      smile_gentle: 'idol',
      shy_flustered: 'shy',
      earnest_blush: 'confess_shy',
      earnest_tense: 'earnest_shy',
      panic_fluster: 'fluster_panic',
      flustered: 'fluster_panic',
      panic: 'fluster_panic',
      forced_bright: 'coverup_bright',
      gentle_relief: 'warm_relief',
      tender: 'warm_relief',
      relieved: 'warm_relief',
      gentle: 'warm_relief',
      smug_playful: 'smug_tease',
      confident: 'smug_tease',
      deadpan_stare: 'deadpan_tsukkomi',
      annoyed: 'deadpan_tsukkomi',
      wry_forced: 'wry_smile',
      anger_pout: 'tsun',
      sad_downcast: 'sad',
      surprise_wide: 'surp',
      surprised: 'surp',
      calm_neutral: 'serious',
      troubled_sigh: 'sigh',
      tired: 'sigh'
    };
    return map[k] || k;
  }

  function toCoarseIrodoriEmotion(emo) {
    const e = normalizeEmotionToken(emo);
    if (['joy', 'idol', 'warm_relief', 'smug_tease', 'excited'].includes(e)) return 'happy';
    if (['angry', 'tsun', 'frustrated', 'deadpan_tsukkomi'].includes(e)) return 'angry';
    if (['shy', 'confess_shy', 'earnest_shy'].includes(e)) return 'shy';
    if (['sad', 'weak', 'sigh', 'wry_smile'].includes(e)) return 'sad';
    if (['surp', 'fluster_panic'].includes(e)) return 'surprised';
    if (['serious', 'puzzled', 'cool'].includes(e)) return 'thinking';
    return 'calm';
  }

  const FUYUKO_AUTO_HONNE_EMOTIONS = new Set([
    'angry', 'tsun', 'deadpan_tsukkomi', 'wry_smile', 'smug_tease',
    'sigh', 'shy', 'confess_shy', 'earnest_shy', 'sad', 'serious'
  ]);

  function resolveStraylightVoice(opts = {}) {
    const charId = normalizeStraylightCharId(opts.charLabel) ||
      normalizeStraylightCharId(opts.speaker) ||
      normalizeStraylightCharId(opts.voiceId);
    if (!charId) {
      return { charId: '', voice: '', isExplicit: false, isCoarse: false, coarseEmotion: '', group: '' };
    }

    const rawExplicit = String(opts.voiceId || '').trim().toLowerCase();
    if (rawExplicit && isFineGrainedStraylightVoice(rawExplicit)) {
      const vm = VOICE_INDEX.get(rawExplicit);
      if (vm && vm.charId === charId) {
        return {
          charId,
          voice: vm.id,
          isExplicit: true,
          isCoarse: false,
          coarseEmotion: '',
          group: vm.group
        };
      }
    }
    if (rawExplicit && isCoarseStraylightVoice(rawExplicit) && COARSE_CHAR_TO_CANON[rawExplicit] === charId) {
      const rawEmo = normalizeEmotionToken(opts.emotion || opts.surfaceEmotion || '');
      return {
        charId,
        voice: rawExplicit,
        isExplicit: true,
        isCoarse: true,
        coarseEmotion: toCoarseIrodoriEmotion(rawEmo),
        group: charId
      };
    }

    const emo = normalizeEmotionToken(opts.emotion || opts.surfaceEmotion || '');
    const tone = String(opts.vocalTone || '').trim().toLowerCase();
    const mode = String(opts.mode || '').trim().toLowerCase();
    const text = String(opts.text || '').trim();
    const innerMonologue = Boolean(opts.innerMonologue);
    const hasExclaim = /[！!♪]/.test(text);
    const hasQuestion = /[？?]/.test(text);

    if (charId === 'asahi') {
      let voice = 'asahi_neutral';
      if (emo === 'angry') voice = 'asahi_angry';
      else if (emo === 'tsun' || emo === 'frustrated' || emo === 'coverup_bright') voice = 'asahi_frustrated';
      else if (emo === 'shy' || emo === 'confess_shy') voice = 'asahi_shy';
      else if (emo === 'sad') voice = 'asahi_sad';
      else if (emo === 'weak') voice = 'asahi_weak';
      else if (emo === 'surp') voice = 'asahi_surprised';
      else if (emo === 'fluster_panic') voice = hasQuestion || hasExclaim ? 'asahi_surprised' : 'asahi_weak';
      else if (emo === 'puzzled' || emo === 'deadpan_tsukkomi') voice = 'asahi_puzzled';
      else if (emo === 'serious') voice = 'asahi_serious';
      else if (emo === 'earnest_shy' || emo === 'hesitant' || emo === 'wry_smile' || emo === 'sigh') voice = 'asahi_hesitant';
      else if (emo === 'warm_relief') voice = 'asahi_gentle';
      else if (emo === 'smug_tease') voice = 'asahi_confident';
      else if (emo === 'excited') voice = 'asahi_excited';
      else if (emo === 'joy' || emo === 'idol') {
        voice = (hasExclaim || tone === 'bright' || tone === 'shout') ? 'asahi_excited' : 'asahi_happy';
      } else if (hasQuestion) {
        voice = 'asahi_puzzled';
      }
      if (voice === 'asahi_sad' && (tone === 'whisper' || tone === 'soft')) voice = 'asahi_weak';
      return { charId, voice, isExplicit: false, isCoarse: false, coarseEmotion: '', group: 'asahi' };
    }

    if (charId === 'fuyuko') {
      let isHonne = false;
      if (mode === 'honne' || mode === 'ura') isHonne = true;
      else if (mode === 'omote') isHonne = false;
      else isHonne = innerMonologue || FUYUKO_AUTO_HONNE_EMOTIONS.has(emo);

      let voice;
      if (!isHonne) {
        if (emo === 'idol' || emo === 'coverup_bright') voice = 'fuyuko_omote';
        else if (emo === 'excited') voice = 'fuyuko_omote_excited';
        else if (emo === 'joy') {
          if (tone === 'sweet') voice = 'fuyuko_omote';
          else voice = hasExclaim || tone === 'bright' ? 'fuyuko_omote_excited' : 'fuyuko_happy';
        } else if (emo === 'surp' || emo === 'fluster_panic') voice = 'fuyuko_surprised';
        else if (emo === 'warm_relief') voice = 'fuyuko_omote_gentle';
        else if (emo === 'sad') voice = 'fuyuko_omote_sad';
        else if (emo === 'hesitant' || emo === 'earnest_shy' || emo === 'shy' || emo === 'sigh') voice = 'fuyuko_omote_hesitant';
        else voice = tone === 'sweet' || /♪/.test(text) ? 'fuyuko_omote' : 'fuyuko_neutral';
      } else {
        if (emo === 'angry') voice = 'fuyuko_angry';
        else if (emo === 'tsun') voice = 'fuyuko_honne_tsun';
        else if (emo === 'deadpan_tsukkomi') voice = 'fuyuko_honne_speechless';
        else if (emo === 'wry_smile') voice = 'fuyuko_honne_sarcastic';
        else if (emo === 'sigh') voice = 'fuyuko_honne_tired';
        else if (emo === 'shy' || emo === 'confess_shy' || emo === 'earnest_shy') voice = 'fuyuko_shy';
        else if (emo === 'sad') voice = 'fuyuko_sad';
        else if (emo === 'serious') voice = 'fuyuko_serious';
        else if (emo === 'surp' || emo === 'fluster_panic') voice = 'fuyuko_honne_surprised';
        else if (emo === 'joy' || emo === 'smug_tease' || emo === 'excited') voice = 'fuyuko_honne_happy';
        else if (emo === 'warm_relief' || emo === 'neutral') voice = 'fuyuko_honne_calm';
        else voice = 'fuyuko_honne';
      }
      const vm = VOICE_INDEX.get(voice);
      return { charId, voice, isExplicit: false, isCoarse: false, coarseEmotion: '', group: vm ? vm.group : (isHonne ? 'honne' : 'omote') };
    }

    // mei
    let voice = 'mei_neutral';
    if (emo === 'angry') voice = 'mei_angry';
    else if (emo === 'deadpan_tsukkomi') voice = hasQuestion ? 'mei_puzzled' : 'mei_angry';
    else if (emo === 'tsun' || emo === 'coverup_bright') voice = 'mei_tsun';
    else if (emo === 'shy' || emo === 'confess_shy') voice = 'mei_shy';
    else if (emo === 'fluster_panic') voice = 'mei_panic';
    else if (emo === 'surp') voice = 'mei_surprised';
    else if (emo === 'puzzled') voice = 'mei_puzzled';
    else if (emo === 'sad') voice = 'mei_sad';
    else if (emo === 'earnest_shy' || emo === 'hesitant' || emo === 'wry_smile' || emo === 'sigh') voice = 'mei_hesitant';
    else if (emo === 'warm_relief') voice = 'mei_gentle';
    else if (emo === 'smug_tease') voice = 'mei_confident';
    else if (emo === 'cool' || emo === 'idol') voice = (tone === 'cold' || tone === 'low' || tone === 'monotone') ? 'mei_cool' : 'mei_gal';
    else if (emo === 'serious') voice = (tone === 'cold' || tone === 'low') ? 'mei_cool' : 'mei_serious';
    else if (emo === 'excited') voice = 'mei_excited';
    else if (emo === 'joy') voice = (hasExclaim || tone === 'bright' || tone === 'shout') ? 'mei_excited' : 'mei_happy';
    else if (hasQuestion) voice = 'mei_puzzled';
    else if (tone === 'cold' || tone === 'monotone') voice = 'mei_cool';

    return { charId, voice, isExplicit: false, isCoarse: false, coarseEmotion: '', group: 'mei' };
  }

  function isStraylightIrodoriEnabled(ttsConfig) {
    const baseCfg = (ttsConfig && typeof ttsConfig === 'object') ? ttsConfig : {};
    if (baseCfg.explicitOff || baseCfg.provider === 'off') return false;
    return baseCfg.provider === 'local_irodori' || Boolean(baseCfg.straylightIrodoriEnabled);
  }

  function resolveEffectiveTtsConfigForChar(ttsConfig, charLabel, speaker, explicitIrodoriEndpoint) {
    const baseCfg = (ttsConfig && typeof ttsConfig === 'object') ? ttsConfig : {};
    const strayCharId = normalizeStraylightCharId(charLabel) || normalizeStraylightCharId(speaker);
    if (!strayCharId) {
      return Object.assign({}, baseCfg, {
        isStraylightIsolated: false,
        straylightCharId: ''
      });
    }
    if (baseCfg.explicitOff && baseCfg.provider === 'off') {
      return Object.assign({}, baseCfg, {
        provider: 'off',
        isStraylightIsolated: false,
        straylightCharId: strayCharId
      });
    }
    if (!isStraylightIrodoriEnabled(baseCfg)) {
      return Object.assign({}, baseCfg, {
        isStraylightIsolated: false,
        straylightCharId: strayCharId
      });
    }
    const rawEp = explicitIrodoriEndpoint ||
      (baseCfg.provider === 'local_irodori' ? baseCfg.endpoint : '') ||
      baseCfg.irodoriEndpoint ||
      IRODORI_DEFAULT_ENDPOINT;
    return {
      provider: 'local_irodori',
      endpoint: normalizeIrodoriOrigin(rawEp),
      apiKey: '',
      model: IRODORI_MODEL,
      format: 'wav',
      explicitOff: false,
      straylightIrodoriEnabled: Boolean(baseCfg.straylightIrodoriEnabled || baseCfg.provider === 'local_irodori'),
      isStraylightIsolated: true,
      straylightCharId: strayCharId
    };
  }

  return {
    IRODORI_DEFAULT_ENDPOINT,
    IRODORI_MODEL,
    STRAYLIGHT_CHAR_IDS,
    STRAYLIGHT_VOICES,
    normalizeStraylightCharId,
    isStraylightChar,
    isStraylightIrodoriEnabled,
    isFineGrainedStraylightVoice,
    isCoarseStraylightVoice,
    isValidStraylightVoiceId,
    getVoicesForChar,
    getVoiceMeta,
    normalizeIrodoriOrigin,
    prepareIrodoriInputText,
    resolveStraylightVoice,
    resolveEffectiveTtsConfigForChar
  };
});
