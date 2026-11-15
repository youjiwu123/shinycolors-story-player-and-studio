/* Shiny Colors 同人工坊 · G3 交互原型 — 真实演示数据 + 9情绪分层与平面位移预设 + 真实语音映射 */
(function () {
  'use strict';

  const showcasePack = {
  "$schema": "../../../schema/scproj.schema.json",
  "format": "scpack",
  "formatVersion": 2,
  "id": "sc_feature_showcase",
  "name": "283新機能ショーケース",
  "nameZh": "🌟 283五人走位·换景·三分支实测篇",
  "version": "0.2.0",
  "cover": "rooftop_after_rain",
  "unit": "straylight",
  "synopsis": "ストレイライトとノクチルの5人が、新プレイヤー＆同人工房の機能を実演テスト！",
  "synopsisZh": "Straylight 与 noctchill 五人同台，实测展示原版字体、2D平面移动、三分支回想与营业/本音秒切。",
  "themeColor": "#D92B4B",
  "description": "scproj v2.1 示例同人包：冬優子 omote/honne、双语、说话人自动解析与 @none 画外音、混合语音拼接 recipe、余韵停顿 holdMs、ImageGen 自定义背景。",
  "authors": [
    {
      "name": "example",
      "role": "writer"
    }
  ],
  "license": "CC-BY-NC-4.0 (fan work; official assets not included)",
  "createdAt": "2026-11-12T14:45:00+08:00",
  "updatedAt": "2026-11-12T15:12:00+08:00",
  "lang": {
    "primary": "ja",
    "translations": [
      "zh"
    ]
  },
  "requires": {
    "officialAssets": true
  },
  "overlay": {
    "mode": "overlay",
    "allowShadow": false
  },
  "stories": [
    {
      "id": "sc_feature_showcase",
      "file": "stories/sc_feature_showcase.scproj.json",
      "source": "stories/sc_feature_showcase.scs.yaml",
      "title": "283機能ショーケース・5人ステージと分岐テスト",
      "titleZh": "283新功能演示篇·五人走位与三分支实测",
      "order": 0,
      "era": "step",
      "cast": [
        "fuyuko",
        "asahi",
        "mei",
        "toru",
        "madoka"
      ],
      "entry": true,
      "tags": [
        "showcase",
        "straylight",
        "noctchill"
      ]
    },
    {
      "id": "fyk_rooftop01",
      "file": "stories/fyk_rooftop01.scproj.json",
      "source": "stories/fyk_rooftop01.scs.yaml",
      "title": "雨上がりの屋上",
      "titleZh": "雨后的天台",
      "order": 1,
      "era": "grad",
      "cast": [
        "fuyuko"
      ],
      "entry": false,
      "tags": [
        "fuyuko",
        "honne"
      ]
    }
  ],
  "characters": {
    "fuyuko": {
      "charType": "characters",
      "charId": "018",
      "charCategory": "stand_fix",
      "name": "冬優子",
      "nameZh": "冬优子",
      "voiceProfile": "sc_fuyuko_v2"
    },
    "asahi": {
      "charType": "characters",
      "charId": "017",
      "charCategory": "stand_fix",
      "name": "あさひ",
      "nameZh": "朝日",
      "voiceProfile": "sc_asahi_v2"
    },
    "mei": {
      "charType": "characters",
      "charId": "019",
      "charCategory": "stand_fix",
      "name": "愛依",
      "nameZh": "爱依",
      "voiceProfile": "sc_mei_v2"
    },
    "toru": {
      "charType": "characters",
      "charId": "020",
      "charCategory": "stand_fix",
      "name": "透",
      "nameZh": "透",
      "voiceProfile": "sc_toru_v2"
    },
    "madoka": {
      "charType": "characters",
      "charId": "021",
      "charCategory": "stand_fix",
      "name": "円香",
      "nameZh": "圆香",
      "voiceProfile": "sc_madoka_v2"
    }
  },
  "assets": {
    "bg": {
      "rooftop_after_rain": {
        "file": "assets/bg/rooftop_after_rain.png",
        "title": "雨上がりの屋上",
        "titleZh": "雨后的天台",
        "origin": "imageGen",
        "status": "approved",
        "fallback": "00889",
        "sha256": "cfd9f12925411c4a0aae18149900c556742370a4d40fc6e5f345ccd9677785be",
        "bytes": 4276,
        "width": 1136,
        "height": 640,
        "imageGen": {
          "provider": "comfy_sd",
          "prompt": "school-building rooftop after rain, puddles reflecting sky, wet chain-link fence, distant city, soft clouds breaking, late afternoon",
          "negativePrompt": "people, character, text, watermark, logo",
          "refBgId": "00889",
          "refStrength": 0.35,
          "stageFilter": {
            "preset": "enza_rain",
            "timeOfDay": "evening",
            "weather": "after_rain",
            "blur": 0.6,
            "saturation": 0.9,
            "grain": 0.05
          },
          "model": "sdxl-anime-bg",
          "seed": 424242,
          "size": {
            "w": 1136,
            "h": 640
          },
          "steps": 28,
          "guidance": 6.5,
          "sampler": "dpmpp_2m",
          "workflow": "gen/comfy/bg_sdxl_v1.json",
          "outputs": [
            {
              "file": "assets/bg/rooftop_after_rain.png",
              "seed": 424242,
              "createdAt": "2026-11-12T14:50:00+08:00",
              "selected": true,
              "sha256": "cfd9f12925411c4a0aae18149900c556742370a4d40fc6e5f345ccd9677785be"
            }
          ],
          "generatedAt": "2026-11-12T14:50:00+08:00"
        }
      },
      "office_window_rain": {
        "title": "事務所・雨の窓辺",
        "origin": "imageGen",
        "status": "pending",
        "fallback": "00014",
        "imageGen": {
          "provider": "openai",
          "prompt": "283 production office interior, rain on window, warm desk lamp, evening",
          "refBgId": "00014",
          "stageFilter": "enza_evening",
          "size": {
            "w": 1536,
            "h": 864
          }
        }
      }
    }
  },
  "tts": {
    "engine": "irodori",
    "voiceProfiles": {
      "fuyuko": "sc_fuyuko_v2"
    },
    "voiceDir": "custom/fyk_rooftop01"
  },
  "imageGen": {
    "defaults": {
      "provider": "comfy_sd",
      "promptPrefix": "anime visual-novel background, idolmaster shiny colors enza style, no people, ",
      "negativePrompt": "people, text, watermark",
      "size": {
        "w": 1136,
        "h": 640
      },
      "stageFilter": "enza_day"
    },
    "providers": {
      "comfy_sd": {
        "endpoint": "http://127.0.0.1:8188",
        "workflow": "gen/comfy/bg_sdxl_v1.json",
        "checkpoint": "sdxl-anime-bg"
      },
      "openai": {
        "model": "gpt-image-1"
      },
      "gemini": {
        "model": "imagen-4"
      },
      "local": {
        "command": "python gen_bg.py"
      }
    }
  }
};
  const showcaseStory = {
  "$schema": "../../../../schema/scproj.schema.json",
  "format": "scproj",
  "formatVersion": 2,
  "meta": {
    "id": "sc_feature_showcase",
    "cat": "custom",
    "title": "283機能ショーケース・5人ステージと分岐テスト",
    "titleZh": "283新功能演示篇·五人走位与三分支实测",
    "origin": "custom",
    "lang": {
      "primary": "ja",
      "translations": [
        "zh"
      ]
    },
    "era": "step",
    "cast": [
      "fuyuko",
      "asahi",
      "mei",
      "toru",
      "madoka"
    ],
    "compile": {
      "mode": "author",
      "sourceFile": "sc_feature_showcase.scs.yaml",
      "sourceSha256": "01bd4ca89df5d3321a090f63cd0d13572fb692e13f9e8e9bc9a915043523229f",
      "compiler": "scs_ref/0.1 (spec reference)",
      "compiledAt": "2026-11-12T19:58:00+08:00"
    },
    "authors": [
      {
        "name": "studio-showcase",
        "role": "writer"
      }
    ],
    "createdAt": "2026-11-12T19:30:00+08:00"
  },
  "lines": [
    {
      "bg": "00001",
      "bgm": "001",
      "waitType": "time",
      "waitTime": 500,
      "textFrame": "off"
    },
    {
      "id": "sc_feature_showcase_001",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_smile",
      "charAnim1": "wait1",
      "charLipAnim": "lip_smile",
      "text": "みなさん、こんにちはぁ♡　ふゆたちと一緒に、新機能をテストしていきましょうね♡",
      "charPosition": {
        "x": 568,
        "y": 640,
        "order": 0
      },
      "textFrame": "001",
      "charType": "characters",
      "charId": "018",
      "charCategory": "stand_fix",
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "_meta": {
        "mode": "omote",
        "surfaceEmotion": "happy",
        "vocalTone": "sweet",
        "zh": "大家下午好呀♡ 和冬优我们一起来测试新播放器与二创工坊的各项新功能吧♡",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/happy/clip_02_4001015020920.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/happy/clip_03_4001014080310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav"
    },
    {
      "id": "sc_feature_showcase_002",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_smile2",
      "charAnim1": "smile1",
      "charLipAnim": "lip_smile",
      "text": "見てください、プロデューサーさん♡　原作フォントと本物のテキスト枠まで再現されてますぅ♡",
      "textFrame": "001",
      "textCtrl": "p",
      "_meta": {
        "mode": "omote",
        "surfaceEmotion": "happy",
        "vocalTone": "sweet",
        "zh": "快看呀，制作人♡ 原版的『Humming』与『圆体』字库，还有原版对话框贴图都完整还原了呢♡",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/happy/clip_02_4001015020920.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/happy/clip_03_4001014080310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav"
    },
    {
      "id": "sc_feature_showcase_003",
      "speaker": "プロデューサー",
      "text": "（ああ、HummingとYuantiのフォント表示も枠も完璧だな。よし、カメラを回すぞ）",
      "textFrame": "002",
      "textCtrl": "p",
      "_meta": {
        "zh": "（嗯，Humming 与圆体字库还有对话框的显示都很完美。好，开始正式录制吧）"
      }
    },
    {
      "id": "sc_feature_showcase_004",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_serious",
      "charAnim1": "anger1",
      "charLipAnim": "lip_anger_s",
      "text": "……ちょっと、あんた。ちゃんと撮れてるんでしょうね……変な角度なら減点よ",
      "charPosition": {
        "x": 340,
        "y": 640,
        "order": 0
      },
      "charEffect": {
        "type": "to",
        "x": 340,
        "time": 400
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "holdMs": 450,
        "mode": "honne",
        "surfaceEmotion": "serious",
        "vocalTone": "sharp",
        "zh": "……喂，你这家伙。应该有好好拍清楚吧……要是敢拍奇怪的角度就扣分哦",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/serious/clip_01_1018001040250.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "serious",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/serious/clip_02_4901010050060.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "serious",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/serious/clip_03_4001015020920.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "serious",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/serious/clip_01_1018001040250.wav"
    },
    {
      "se": "0243",
      "charLabel": "asahi",
      "charAnim2": "face_smile2",
      "charAnim1": "glad1",
      "charPosition": {
        "x": 860,
        "y": 640,
        "order": 1
      },
      "charEffect": {
        "type": "from",
        "x": 1020,
        "alpha": 0,
        "time": 450
      },
      "charType": "characters",
      "charId": "017",
      "charCategory": "stand_fix",
      "textFrame": "off"
    },
    {
      "id": "sc_feature_showcase_005",
      "speaker": "あさひ",
      "charLabel": "asahi",
      "charAnim2": "face_smile2",
      "charAnim1": "glad1",
      "charLipAnim": "lip_a",
      "text": "おっ、画面が動いてるっすよ！　冬優子ちゃん、わたしもテストに混ぜてほしいっす！",
      "charPosition": {
        "x": 740,
        "y": 640,
        "order": 1
      },
      "charEffect": {
        "type": "to",
        "x": 740,
        "time": 450
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "happy",
        "vocalTone": "bright",
        "zh": "哦，画面动起来了耶！冬优子酱，我也要加入功能测试啦！",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/asahi/happy/clip_01_4902200510010.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/asahi/happy/clip_02_4001019081160.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/asahi/happy/clip_03_4001015070580.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/asahi/happy/clip_01_4902200510010.wav"
    },
    {
      "id": "sc_feature_showcase_006",
      "speaker": "愛依",
      "charLabel": "mei",
      "charAnim2": "face_wink",
      "charAnim1": "smile2",
      "charLipAnim": "lip_smile",
      "text": "あはは、あさひちゃん速いってば！　うちも一緒に平面移動を試してみよっか！",
      "charPosition": {
        "x": 560,
        "y": 640,
        "order": 2
      },
      "charType": "characters",
      "charId": "019",
      "charCategory": "stand_fix",
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "happy",
        "vocalTone": "bright",
        "zh": "啊哈哈，朝日酱跑得太快啦！我们也一起来试试双人平面走位吧！"
      }
    },
    {
      "id": "sc_feature_showcase_007",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_surp",
      "charAnim1": "shock1",
      "charLipAnim": "lip_trouble",
      "text": "ちょっ、あさひちゃん！？　いきなり飛び出してこないでくださぁい♡",
      "charPosition": {
        "x": 220,
        "y": 640,
        "order": 0
      },
      "charEffect": {
        "type": "to",
        "x": 220,
        "time": 380
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "mode": "omote",
        "surfaceEmotion": "surprised",
        "vocalTone": "sweet",
        "zh": "等、等一下朝日酱！？请不要突然冲出来呀♡",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/surprised/clip_01_4901010050060.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "surprised",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/surprised/clip_02_4001015020920.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "surprised",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/surprised/clip_03_4001014080310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "surprised",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/surprised/clip_01_4901010050060.wav"
    },
    {
      "bg": "00002",
      "bgEffect": "fade",
      "bgEffectTime": 500,
      "se": "0243",
      "charLabel": "asahi",
      "charAnim2": "face_smirk",
      "charAnim1": "wait2",
      "charPosition": {
        "x": 260,
        "y": 640,
        "order": 1
      },
      "charEffect": {
        "type": "to",
        "x": 260,
        "time": 450
      },
      "textFrame": "off"
    },
    {
      "id": "sc_feature_showcase_008",
      "speaker": "あさひ",
      "charLabel": "asahi",
      "charAnim2": "face_smirk",
      "charAnim1": "wait2",
      "charLipAnim": "lip_smile",
      "text": "えへへ、左右の位置を入れ替えてみたっす！　夕方の背景への変化もきれいっすね！",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "happy",
        "vocalTone": "bright",
        "zh": "诶嘿嘿，把左右站位互换过来了！切换到傍晚事务所背景的过渡也超漂亮呢！",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/asahi/happy/clip_01_4902200510010.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/asahi/happy/clip_02_4001019081160.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/asahi/happy/clip_03_4001015070580.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/asahi/happy/clip_01_4902200510010.wav"
    },
    {
      "id": "sc_feature_showcase_009",
      "speaker": "愛依",
      "charLabel": "mei",
      "charAnim2": "face_shy",
      "charAnim1": "shy1",
      "charLipAnim": "lip_smile",
      "text": "おおー、ほんとだ！　照れたり驚いたり、表情の変化もすっごく分かりやすいじゃん！",
      "charPosition": {
        "x": 860,
        "y": 640,
        "order": 2
      },
      "charEffect": {
        "type": "to",
        "x": 860,
        "time": 450
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "shy",
        "vocalTone": "bright",
        "zh": "哇——真的耶！不管是害羞还是惊讶，分层表情的切换都超级直观嘛！"
      }
    },
    {
      "charLabel": "fuyuko",
      "charEffect": {
        "type": "to",
        "alpha": 0,
        "time": 100
      },
      "textFrame": "off"
    },
    {
      "charLabel": "asahi",
      "charEffect": {
        "type": "to",
        "alpha": 0,
        "time": 100
      },
      "textFrame": "off"
    },
    {
      "charLabel": "mei",
      "charEffect": {
        "type": "to",
        "alpha": 0,
        "time": 100
      },
      "textFrame": "off"
    },
    {
      "bg": "00006",
      "bgEffect": "switch_fade",
      "bgEffectTime": 600,
      "bgm": "002",
      "se": "0113",
      "waitType": "time",
      "waitTime": 450,
      "textFrame": "off"
    },
    {
      "id": "sc_feature_showcase_010",
      "speaker": "円香",
      "charLabel": "madoka",
      "charAnim2": "face_normal",
      "charAnim1": "wait1",
      "charLipAnim": "lip_wait",
      "text": "……ご苦労さまです、プロデューサー。ここで待機モーションと多人数レイヤーの検証ですか",
      "charPosition": {
        "x": 740,
        "y": 640,
        "order": 3
      },
      "charType": "characters",
      "charId": "021",
      "charCategory": "stand_fix",
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "neutral",
        "vocalTone": "cold",
        "zh": "……辛苦了，制作人。是要在这里验证 Spine 呼吸频率与多人舞台图层吗",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/madoka/neutral/clip_01_4902500420010.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "neutral",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/madoka/neutral/clip_02_2021013030090.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "neutral",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/madoka/neutral/clip_03_1021001030080.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "neutral",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/madoka/neutral/clip_01_4902500420010.wav"
    },
    {
      "id": "sc_feature_showcase_011",
      "speaker": "透",
      "charLabel": "toru",
      "charAnim2": "face_normal",
      "charAnim1": "wait1",
      "charLipAnim": "lip_wait",
      "text": "……うん。なんか、息してるみたいだね。",
      "charPosition": {
        "x": 380,
        "y": 640,
        "order": 4
      },
      "charType": "characters",
      "charId": "020",
      "charCategory": "stand_fix",
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "neutral",
        "vocalTone": "soft",
        "zh": "……嗯。总觉得，真的像在呼吸一样呢。",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/toru/neutral/clip_01_4001083021310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "neutral",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/toru/neutral/clip_02_2020001001110020.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "neutral",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/toru/neutral/clip_03_1020001030270.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "neutral",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/toru/neutral/clip_01_4001083021310.wav"
    },
    {
      "id": "sc_feature_showcase_012",
      "speaker": "円香",
      "charLabel": "madoka",
      "charAnim2": "face_serious",
      "charAnim1": "wait2",
      "charLipAnim": "lip_wait",
      "text": "Spineの『wait1』の呼吸周期まで再現するなんて……別に、感心はしていませんけど",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "serious",
        "vocalTone": "cold",
        "zh": "连 Spine『wait1』的呼吸律动周期都原样还原……我可没有在佩服就是了",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/madoka/serious/clip_01_7021001020040.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "serious",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/madoka/serious/clip_02_4001026010370.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "serious",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/madoka/serious/clip_03_1021001050080.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "serious",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/madoka/serious/clip_01_7021001020040.wav"
    },
    {
      "id": "sc_feature_showcase_013",
      "speaker": "透",
      "charLabel": "toru",
      "charAnim2": "face_smile",
      "charAnim1": "wait1",
      "charLipAnim": "lip_smile",
      "text": "ふーん。カメラ、近いね。プロデューサー、見えてる？",
      "charPosition": {
        "x": 480,
        "y": 640,
        "order": 4
      },
      "charScale": 1.12,
      "charEffect": {
        "type": "to",
        "x": 480,
        "scale": 1.12,
        "time": 450
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "holdMs": 400,
        "surfaceEmotion": "happy",
        "vocalTone": "soft",
        "zh": "唔——镜头好近呀。制作人，看得见吗？",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/toru/happy/clip_01_7020001050040.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/toru/happy/clip_02_1020001010160.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/toru/happy/clip_03_1020001010180.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/toru/happy/clip_01_7020001050040.wav"
    },
    {
      "id": "sc_feature_showcase_014",
      "speaker": "円香",
      "charLabel": "madoka",
      "charAnim2": "face_trouble",
      "charAnim1": "Wait_sigh",
      "charLipAnim": "lip_trouble",
      "text": "浅倉、近づきすぎ。ピントがずれるから少し下がって",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "annoyed",
        "vocalTone": "low",
        "zh": "浅仓，靠得太近了。镜头对焦会偏掉的，稍微退后一点",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/madoka/angry/clip_01_1021004050240.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "angry",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/madoka/angry/clip_02_1021001001510080.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "angry",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/madoka/angry/clip_03_3021004020080.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "angry",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/madoka/angry/clip_01_1021004050240.wav"
    },
    {
      "id": "sc_feature_showcase_015",
      "speaker": "プロデューサー",
      "text": "（よし、ここからは3つの分岐ルートで各ユニットの演出をテストしよう）",
      "textFrame": "013",
      "textCtrl": "p",
      "_meta": {
        "zh": "（好，接下来就用 3 个分支选项来分别测试各组合的演出效果吧）"
      }
    },
    {
      "select": "「ストレイライトの平面移動と表情変化をもっと見せる」",
      "nextLabel": "branch_stray",
      "_meta": {
        "selectZh": "「再展示一下 Straylight 的双人平面走位与破防表情！」"
      }
    },
    {
      "select": "「ノクチルの間（ま）と距離感の演出をテストする」",
      "nextLabel": "branch_noct",
      "_meta": {
        "selectZh": "「测试一下 noctchill 的留白节奏与凑近互动！」"
      }
    },
    {
      "select": "「冬優子の『営業モード⇔本音モード』高速切り替えを試す」",
      "nextLabel": "branch_fuyu",
      "textCtrl": "cm",
      "_meta": {
        "selectZh": "「测试冬优子『营业甜嗓 ⇔ 冷淡本音』无缝秒切！」"
      }
    },
    {
      "label": "branch_stray",
      "bg": "00006",
      "bgEffect": "fade",
      "bgEffectTime": 350,
      "se": "0243",
      "textFrame": "off"
    },
    {
      "charLabel": "toru",
      "charEffect": {
        "type": "to",
        "alpha": 0,
        "time": 100
      },
      "textFrame": "off"
    },
    {
      "charLabel": "madoka",
      "charEffect": {
        "type": "to",
        "alpha": 0,
        "time": 100
      },
      "textFrame": "off"
    },
    {
      "id": "sc_feature_showcase_016",
      "speaker": "あさひ",
      "charLabel": "asahi",
      "charAnim2": "face_smile2",
      "charAnim1": "glad1",
      "charLipAnim": "lip_a",
      "text": "やったっす！　じゃあ冬優子ちゃんと愛依ちゃんの周りを走ってみるっすよ！",
      "charPosition": {
        "x": 540,
        "y": 640,
        "order": 1
      },
      "charEffect": {
        "type": "to",
        "x": 540,
        "time": 450
      },
      "charType": "characters",
      "charId": "017",
      "charCategory": "stand_fix",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "happy",
        "vocalTone": "bright",
        "zh": "太好啦！那我就绕着冬优子酱和爱依酱跑一圈试试看吧！",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/asahi/happy/clip_01_4902200510010.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/asahi/happy/clip_02_4001019081160.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/asahi/happy/clip_03_4001015070580.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/asahi/happy/clip_01_4902200510010.wav"
    },
    {
      "id": "sc_feature_showcase_017",
      "speaker": "愛依",
      "charLabel": "mei",
      "charAnim2": "face_smile",
      "charAnim1": "glad1",
      "charLipAnim": "lip_smile",
      "text": "あはは、あさひちゃんノリノリじゃん！　冬優子ちゃんも一緒に動こっ！",
      "charPosition": {
        "x": 860,
        "y": 640,
        "order": 2
      },
      "charType": "characters",
      "charId": "019",
      "charCategory": "stand_fix",
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "happy",
        "vocalTone": "bright",
        "zh": "啊哈哈，朝日酱超起劲的嘛！冬优子酱也一起动起来吧！"
      }
    },
    {
      "id": "sc_feature_showcase_018",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_shy",
      "charAnim1": "anger1",
      "charLipAnim": "lip_anger_s",
      "text": "ちょ、あんたたちね……！　そんなに寄ったら画面が狭くなるっつーの！",
      "charPosition": {
        "x": 220,
        "y": 640,
        "order": 0
      },
      "charEffect": {
        "type": "to",
        "x": 220,
        "time": 380
      },
      "charType": "characters",
      "charId": "018",
      "charCategory": "stand_fix",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "mode": "honne",
        "surfaceEmotion": "flustered",
        "vocalTone": "sharp",
        "zh": "等、你们两个家伙……！靠得这么近画面都要挤爆了啦！",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/shy/clip_01_4001023030170.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "shy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/shy/clip_02_1018001001110030.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "shy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/shy/clip_03_1018001000710070.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "shy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/shy/clip_01_4001023030170.wav"
    },
    {
      "id": "sc_feature_showcase_019",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_smile2",
      "charAnim1": "smile2",
      "charLipAnim": "lip_smile",
      "text": "……コホン！　もう、あさひちゃんも愛依ちゃんも元気いっぱいですねぇ♡",
      "charPosition": {
        "x": 300,
        "y": 640,
        "order": 0
      },
      "charEffect": {
        "type": "to",
        "x": 300,
        "time": 350
      },
      "nextLabel": "ending",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "mode": "omote",
        "surfaceEmotion": "happy",
        "vocalTone": "sweet",
        "zh": "……咳咳！真是的，朝日酱和爱依酱都这么有活力呢♡",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/happy/clip_02_4001015020920.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/happy/clip_03_4001014080310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav"
    },
    {
      "label": "branch_noct",
      "bg": "00007",
      "bgEffect": "switch_fade",
      "bgEffectTime": 600,
      "bgm": "016",
      "waitType": "time",
      "waitTime": 500,
      "textFrame": "off"
    },
    {
      "charLabel": "toru",
      "charAnim2": "face_normal",
      "charAnim1": "wait1",
      "charAnim4": "eye_right",
      "charPosition": {
        "x": 400,
        "y": 640,
        "order": 4
      },
      "textFrame": "off",
      "waitType": "time",
      "waitTime": 650,
      "charType": "characters",
      "charId": "020",
      "charCategory": "stand_fix",
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      }
    },
    {
      "id": "sc_feature_showcase_020",
      "speaker": "透",
      "charLabel": "toru",
      "charAnim2": "face_smile",
      "charAnim1": "wait1",
      "charLipAnim": "lip_smile",
      "text": "……樋口、ほら。夕日、きれいだね。",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "holdMs": 600,
        "surfaceEmotion": "tender",
        "vocalTone": "soft",
        "zh": "……樋口，你看。夕阳好美呀。",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/toru/neutral/clip_01_4001083021310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "neutral",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/toru/neutral/clip_02_2020001001110020.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "neutral",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/toru/neutral/clip_03_1020001030270.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "neutral",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/toru/neutral/clip_01_4001083021310.wav"
    },
    {
      "charLabel": "madoka",
      "charAnim2": "face_shy",
      "charAnim1": "wait2",
      "charAnim4": "eye_left",
      "charPosition": {
        "x": 740,
        "y": 640,
        "order": 3
      },
      "textFrame": "off",
      "waitType": "time",
      "waitTime": 550,
      "charType": "characters",
      "charId": "021",
      "charCategory": "stand_fix",
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      }
    },
    {
      "id": "sc_feature_showcase_021",
      "speaker": "円香",
      "charLabel": "madoka",
      "charAnim2": "face_normal",
      "charAnim1": "wait1",
      "charLipAnim": "lip_wait",
      "text": "……別に。いつもの屋上でしょう。あなた、間の演出はこれで十分ですか",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "neutral",
        "vocalTone": "cold",
        "zh": "……没什么特别的。不就是平时的天台吗。你觉得留白节奏的测试这样够了吗",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/madoka/neutral/clip_01_4902500420010.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "neutral",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/madoka/neutral/clip_02_2021013030090.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "neutral",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/madoka/neutral/clip_03_1021001030080.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "neutral",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/madoka/neutral/clip_01_4902500420010.wav"
    },
    {
      "id": "sc_feature_showcase_022",
      "speaker": "透",
      "charLabel": "toru",
      "charAnim2": "face_smile",
      "charAnim1": "smile1",
      "charLipAnim": "lip_smile",
      "text": "ふふ。いい感じだって。ね、プロデューサー。",
      "charPosition": {
        "x": 480,
        "y": 640,
        "order": 4
      },
      "charScale": 1.1,
      "charEffect": {
        "type": "to",
        "x": 480,
        "scale": 1.1,
        "time": 450
      },
      "nextLabel": "ending",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "happy",
        "vocalTone": "soft",
        "zh": "呵呵。很有感觉对吧。呐，制作人。",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/toru/happy/clip_01_7020001050040.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/toru/happy/clip_02_1020001010160.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/toru/happy/clip_03_1020001010180.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/toru/happy/clip_01_7020001050040.wav"
    },
    {
      "label": "branch_fuyu",
      "bg": "00002",
      "bgEffect": "fade",
      "bgEffectTime": 400,
      "textFrame": "off"
    },
    {
      "charLabel": "toru",
      "charEffect": {
        "type": "to",
        "alpha": 0,
        "time": 100
      },
      "textFrame": "off"
    },
    {
      "charLabel": "madoka",
      "charEffect": {
        "type": "to",
        "alpha": 0,
        "time": 100
      },
      "textFrame": "off"
    },
    {
      "id": "sc_feature_showcase_023",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_serious",
      "charAnim1": "anger1",
      "charLipAnim": "lip_anger_s",
      "text": "……はぁ。誰もいないわよね。あんた、なんでわざわざこの分岐を選んだわけ？",
      "charPosition": {
        "x": 520,
        "y": 640,
        "order": 0
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "mode": "honne",
        "surfaceEmotion": "annoyed",
        "vocalTone": "low",
        "zh": "……唉。周围没人吧。你这家伙，干嘛偏偏选这个测试分支啊？",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/angry/clip_01_1018001000710070.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "angry",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/angry/clip_02_4901010050060.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "angry",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/angry/clip_03_4001014080310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "angry",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/angry/clip_01_1018001000710070.wav"
    },
    {
      "id": "sc_feature_showcase_024",
      "speaker": "愛依",
      "charLabel": "mei",
      "charAnim2": "face_smile",
      "charAnim1": "wait1",
      "charLipAnim": "lip_smile",
      "text": "あれー、冬優子ちゃん、プロデューサーと何話してんのー？",
      "charPosition": {
        "x": 860,
        "y": 640,
        "order": 2
      },
      "se": "0113",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "happy",
        "vocalTone": "bright",
        "zh": "咦——冬优子酱，你在和制作人聊什么呀——？"
      }
    },
    {
      "id": "sc_feature_showcase_025",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_smile2",
      "charAnim1": "smile2",
      "charLipAnim": "lip_smile",
      "text": "あっ、愛依ちゃん♡　ふゆ、プロデューサーさんに演出の相談をしてたところですぅ♡",
      "charPosition": {
        "x": 340,
        "y": 640,
        "order": 0
      },
      "charEffect": {
        "type": "to",
        "x": 340,
        "time": 350
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "mode": "omote",
        "surfaceEmotion": "happy",
        "vocalTone": "sweet",
        "zh": "啊，爱依酱♡ 冬优正和制作人商量新演出的事情呢♡",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/happy/clip_02_4001015020920.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/happy/clip_03_4001014080310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav"
    },
    {
      "charLabel": "mei",
      "charEffect": {
        "type": "to",
        "alpha": 0,
        "time": 100
      },
      "textFrame": "off"
    },
    {
      "id": "sc_feature_showcase_026",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_shy",
      "charAnim1": "anger1",
      "charLipAnim": "lip_anger_s",
      "text": "……今の見たでしょ、あんた！　ニヤニヤしてんじゃないわよ、減点っつーの！",
      "charPosition": {
        "x": 520,
        "y": 640,
        "order": 0
      },
      "charEffect": {
        "type": "to",
        "x": 520,
        "time": 350
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "mode": "honne",
        "surfaceEmotion": "flustered",
        "vocalTone": "sharp",
        "zh": "……刚才的你都看见了吧，你这家伙！不许在那里偷笑啦，扣分！",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/shy/clip_01_4001023030170.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "shy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/shy/clip_02_1018001001110030.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "shy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/shy/clip_03_1018001000710070.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "shy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/shy/clip_01_4001023030170.wav"
    },
    {
      "id": "sc_feature_showcase_027",
      "speaker": "透",
      "charLabel": "toru",
      "charAnim2": "face_normal",
      "charAnim1": "wait1",
      "charLipAnim": "lip_wait",
      "text": "あ、まだ撮ってたんだ。お邪魔したね。",
      "charPosition": {
        "x": 840,
        "y": 640,
        "order": 4
      },
      "charType": "characters",
      "charId": "020",
      "charCategory": "stand_fix",
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "neutral",
        "vocalTone": "soft",
        "zh": "啊，还在拍呀。打扰你们了呢。",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/toru/neutral/clip_01_4001083021310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "neutral",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/toru/neutral/clip_02_2020001001110020.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "neutral",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/toru/neutral/clip_03_1020001030270.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "neutral",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/toru/neutral/clip_01_4001083021310.wav"
    },
    {
      "id": "sc_feature_showcase_028",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_smile",
      "charAnim1": "smile1",
      "charLipAnim": "lip_smile",
      "text": "いえいえ、透ちゃん♡　ちょうど今からエンディングの撮影なんですよぉ♡",
      "charPosition": {
        "x": 340,
        "y": 640,
        "order": 0
      },
      "nextLabel": "ending",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "mode": "omote",
        "surfaceEmotion": "happy",
        "vocalTone": "sweet",
        "zh": "哪里的话，透酱♡ 我们刚好现在要拍结尾的部分了哟♡",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/happy/clip_02_4001015020920.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/happy/clip_03_4001014080310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav"
    },
    {
      "label": "ending",
      "bg": "00060",
      "bgEffect": "switch_fade",
      "bgEffectTime": 600,
      "bgm": "003",
      "waitType": "time",
      "waitTime": 500,
      "textFrame": "off"
    },
    {
      "id": "sc_feature_showcase_029",
      "speaker": "あさひ",
      "charLabel": "asahi",
      "charAnim2": "face_smile2",
      "charAnim1": "glad1",
      "charLipAnim": "lip_a",
      "text": "全員集合っすね！　平面移動も背景の切り替えも、すごく楽しかったっす！",
      "charPosition": {
        "x": 140,
        "y": 640,
        "order": 1
      },
      "charScale": 0.72,
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "happy",
        "vocalTone": "bright",
        "zh": "全员集合啦！不管是平面走位还是背景切换，都超级好玩的！",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/asahi/happy/clip_01_4902200510010.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/asahi/happy/clip_02_4001019081160.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/asahi/happy/clip_03_4001015070580.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_asahi_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/asahi/happy/clip_01_4902200510010.wav"
    },
    {
      "id": "sc_feature_showcase_030",
      "speaker": "愛依",
      "charLabel": "mei",
      "charAnim2": "face_wink",
      "charAnim1": "smile2",
      "charLipAnim": "lip_smile",
      "text": "うんうん！　ところでさ、選ばなかった残りの選択肢ってどうやって見ればいいの？",
      "charPosition": {
        "x": 350,
        "y": 640,
        "order": 2
      },
      "charScale": 0.72,
      "charType": "characters",
      "charId": "019",
      "charCategory": "stand_fix",
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "happy",
        "vocalTone": "bright",
        "zh": "嗯嗯！话说回来，刚才没选到的另外两个分支选项，要怎么看呀？"
      }
    },
    {
      "id": "sc_feature_showcase_031",
      "speaker": "円香",
      "charLabel": "madoka",
      "charAnim2": "face_normal",
      "charAnim1": "wait1",
      "charLipAnim": "lip_wait",
      "text": "右上の『回想』ボタンを開けばいいそうですよ。あなた、そういう仕様でしょう？",
      "charPosition": {
        "x": 770,
        "y": 640,
        "order": 3
      },
      "charScale": 0.72,
      "charType": "characters",
      "charId": "021",
      "charCategory": "stand_fix",
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "neutral",
        "vocalTone": "cold",
        "zh": "听说只要点开右上角的『回想』按钮就可以了。是这样设计的吧，制作人？",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/madoka/neutral/clip_01_4902500420010.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "neutral",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/madoka/neutral/clip_02_2021013030090.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "neutral",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/madoka/neutral/clip_03_1021001030080.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_madoka_v2",
            "emotion": "neutral",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/madoka/neutral/clip_01_4902500420010.wav"
    },
    {
      "id": "sc_feature_showcase_032",
      "speaker": "透",
      "charLabel": "toru",
      "charAnim2": "face_smile",
      "charAnim1": "wait1",
      "charLipAnim": "lip_smile",
      "text": "そっか。クリックするだけで、戻れるんだね。",
      "charPosition": {
        "x": 980,
        "y": 640,
        "order": 4
      },
      "charScale": 0.72,
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "surfaceEmotion": "happy",
        "vocalTone": "soft",
        "zh": "这样啊。只要点一下，就能跳回去呢。",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/toru/happy/clip_01_7020001050040.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/toru/happy/clip_02_1020001010160.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/toru/happy/clip_03_1020001010180.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_toru_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/toru/happy/clip_01_7020001050040.wav"
    },
    {
      "id": "sc_feature_showcase_033",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_smile2",
      "charAnim1": "smile2",
      "charLipAnim": "lip_smile",
      "text": "右上の『回想』で3つの分岐の翻訳も見られますし、クリックでその場にすぐ戻れますよぉ♡",
      "charPosition": {
        "x": 560,
        "y": 640,
        "order": 0
      },
      "charScale": 0.78,
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "holdMs": 800,
        "mode": "omote",
        "surfaceEmotion": "happy",
        "vocalTone": "sweet",
        "zh": "对了，现在点开右上角的『回想』按钮试试看吧——里面不仅能看到刚刚 3 个分支的中文翻译，直接点击任意一句台词或者没选过的分支，就能立刻穿越回那一幕重看哦！",
        "takes": [
          {
            "id": "t1",
            "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1001,
            "durationMs": 2200,
            "status": "approved",
            "rating": 5,
            "note": "原版情绪参考音 (实测可用)"
          },
          {
            "id": "t2",
            "voice": "/ref-wav/fuyuko/happy/clip_02_4001015020920.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1018,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #2"
          },
          {
            "id": "t3",
            "voice": "/ref-wav/fuyuko/happy/clip_03_4001014080310.wav",
            "engine": "irodori-lora",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1035,
            "durationMs": 2200,
            "status": "generated",
            "rating": 4,
            "note": "同情绪候选参考音 #3"
          }
        ],
        "takeSelected": "t1"
      },
      "voice": "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav"
    }
  ]
};
  const rooftopPack = {
  "$schema": "../../../schema/scproj.schema.json",
  "format": "scpack",
  "formatVersion": 2,
  "id": "rooftop_after_rain",
  "name": "雨上がりの屋上",
  "nameZh": "🌟 雨后的天台（冬优子双声道演示）",
  "version": "0.2.0",
  "cover": "rooftop_after_rain",
  "unit": "straylight",
  "synopsis": "通り雨の上がった夕方、屋上でひとり息をつく冬優子とプロデューサーの短い幕間。",
  "synopsisZh": "阵雨初霁的傍晚，在天台独自松一口气的冬优子与制作人的简短幕间。",
  "themeColor": "#D92B4B",
  "description": "scproj v2.1 示例同人包：冬優子 omote/honne、双语、说话人自动解析与 @none 画外音、混合语音拼接 recipe、余韵停顿 holdMs、ImageGen 自定义背景。",
  "authors": [
    {
      "name": "example",
      "role": "writer"
    }
  ],
  "license": "CC-BY-NC-4.0 (fan work; official assets not included)",
  "createdAt": "2026-11-12T14:45:00+08:00",
  "updatedAt": "2026-11-12T15:12:00+08:00",
  "lang": {
    "primary": "ja",
    "translations": [
      "zh"
    ]
  },
  "requires": {
    "officialAssets": true
  },
  "overlay": {
    "mode": "overlay",
    "allowShadow": false
  },
  "stories": [
    {
      "id": "sc_feature_showcase",
      "file": "stories/sc_feature_showcase.scproj.json",
      "source": "stories/sc_feature_showcase.scs.yaml",
      "title": "283機能ショーケース・5人ステージと分岐テスト",
      "titleZh": "283新功能演示篇·五人走位与三分支实测",
      "order": 0,
      "era": "step",
      "cast": [
        "fuyuko",
        "asahi",
        "mei",
        "toru",
        "madoka"
      ],
      "entry": true,
      "tags": [
        "showcase",
        "straylight",
        "noctchill"
      ]
    },
    {
      "id": "fyk_rooftop01",
      "file": "stories/fyk_rooftop01.scproj.json",
      "source": "stories/fyk_rooftop01.scs.yaml",
      "title": "雨上がりの屋上",
      "titleZh": "雨后的天台",
      "order": 1,
      "era": "grad",
      "cast": [
        "fuyuko"
      ],
      "entry": false,
      "tags": [
        "fuyuko",
        "honne"
      ]
    }
  ],
  "characters": {
    "fuyuko": {
      "charType": "characters",
      "charId": "018",
      "charCategory": "stand_fix",
      "name": "冬優子",
      "nameZh": "冬优子",
      "voiceProfile": "sc_fuyuko_v2"
    },
    "asahi": {
      "charType": "characters",
      "charId": "017",
      "charCategory": "stand_fix",
      "name": "あさひ",
      "nameZh": "朝日",
      "voiceProfile": "sc_asahi_v2"
    },
    "mei": {
      "charType": "characters",
      "charId": "019",
      "charCategory": "stand_fix",
      "name": "愛依",
      "nameZh": "爱依",
      "voiceProfile": "sc_mei_v2"
    },
    "toru": {
      "charType": "characters",
      "charId": "020",
      "charCategory": "stand_fix",
      "name": "透",
      "nameZh": "透",
      "voiceProfile": "sc_toru_v2"
    },
    "madoka": {
      "charType": "characters",
      "charId": "021",
      "charCategory": "stand_fix",
      "name": "円香",
      "nameZh": "圆香",
      "voiceProfile": "sc_madoka_v2"
    }
  },
  "assets": {
    "bg": {
      "rooftop_after_rain": {
        "file": "assets/bg/rooftop_after_rain.png",
        "title": "雨上がりの屋上",
        "titleZh": "雨后的天台",
        "origin": "imageGen",
        "status": "approved",
        "fallback": "00889",
        "sha256": "cfd9f12925411c4a0aae18149900c556742370a4d40fc6e5f345ccd9677785be",
        "bytes": 4276,
        "width": 1136,
        "height": 640,
        "imageGen": {
          "provider": "comfy_sd",
          "prompt": "school-building rooftop after rain, puddles reflecting sky, wet chain-link fence, distant city, soft clouds breaking, late afternoon",
          "negativePrompt": "people, character, text, watermark, logo",
          "refBgId": "00889",
          "refStrength": 0.35,
          "stageFilter": {
            "preset": "enza_rain",
            "timeOfDay": "evening",
            "weather": "after_rain",
            "blur": 0.6,
            "saturation": 0.9,
            "grain": 0.05
          },
          "model": "sdxl-anime-bg",
          "seed": 424242,
          "size": {
            "w": 1136,
            "h": 640
          },
          "steps": 28,
          "guidance": 6.5,
          "sampler": "dpmpp_2m",
          "workflow": "gen/comfy/bg_sdxl_v1.json",
          "outputs": [
            {
              "file": "assets/bg/rooftop_after_rain.png",
              "seed": 424242,
              "createdAt": "2026-11-12T14:50:00+08:00",
              "selected": true,
              "sha256": "cfd9f12925411c4a0aae18149900c556742370a4d40fc6e5f345ccd9677785be"
            }
          ],
          "generatedAt": "2026-11-12T14:50:00+08:00"
        }
      },
      "office_window_rain": {
        "title": "事務所・雨の窓辺",
        "origin": "imageGen",
        "status": "pending",
        "fallback": "00014",
        "imageGen": {
          "provider": "openai",
          "prompt": "283 production office interior, rain on window, warm desk lamp, evening",
          "refBgId": "00014",
          "stageFilter": "enza_evening",
          "size": {
            "w": 1536,
            "h": 864
          }
        }
      }
    }
  },
  "tts": {
    "engine": "irodori",
    "voiceProfiles": {
      "fuyuko": "sc_fuyuko_v2"
    },
    "voiceDir": "custom/fyk_rooftop01"
  },
  "imageGen": {
    "defaults": {
      "provider": "comfy_sd",
      "promptPrefix": "anime visual-novel background, idolmaster shiny colors enza style, no people, ",
      "negativePrompt": "people, text, watermark",
      "size": {
        "w": 1136,
        "h": 640
      },
      "stageFilter": "enza_day"
    },
    "providers": {
      "comfy_sd": {
        "endpoint": "http://127.0.0.1:8188",
        "workflow": "gen/comfy/bg_sdxl_v1.json",
        "checkpoint": "sdxl-anime-bg"
      },
      "openai": {
        "model": "gpt-image-1"
      },
      "gemini": {
        "model": "imagen-4"
      },
      "local": {
        "command": "python gen_bg.py"
      }
    }
  }
};
  const rooftopStory = {
  "format": "scproj",
  "formatVersion": 2,
  "meta": {
    "id": "fyk_rooftop01",
    "cat": "custom",
    "title": "雨上がりの屋上",
    "titleZh": "雨后的天台",
    "origin": "custom",
    "lang": {
      "primary": "ja",
      "translations": [
        "zh"
      ]
    },
    "era": "grad",
    "cast": [
      "fuyuko"
    ],
    "tts": {
      "engine": "irodori",
      "voiceDir": "custom/fyk_rooftop01"
    },
    "compile": {
      "mode": "author",
      "sourceFile": "fyk_rooftop01.scs.yaml",
      "sourceSha256": "3b161ad2524e66f1d0abf6ba206dc5fe9845b9cfc4802aac39dfa311299d0361"
    },
    "authors": [
      {
        "name": "example",
        "role": "writer"
      }
    ],
    "createdAt": "2026-11-12T14:45:00+08:00"
  },
  "lines": [
    {
      "bg": "rooftop_after_rain",
      "bgm": "016",
      "waitType": "time",
      "waitTime": 1500,
      "textFrame": "off"
    },
    {
      "se": "0113",
      "textFrame": "off"
    },
    {
      "id": "fyk_rooftop01_001",
      "speaker": "プロデューサー",
      "text": "（雨、やんだな……）",
      "textCtrl": "p",
      "textFrame": "002",
      "_meta": {
        "zh": "（雨停了啊……）"
      }
    },
    {
      "id": "fyk_rooftop01_002",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_smile",
      "charAnim1": "wait1",
      "charLipAnim": "lip_smile",
      "text": "あっ、プロデューサーさん♡　こんなところにいたんですかぁ？",
      "charType": "characters",
      "charId": "018",
      "charCategory": "stand_fix",
      "charPosition": {
        "x": 568,
        "y": 640,
        "order": 0
      },
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "mode": "omote",
        "surfaceEmotion": "happy",
        "vocalTone": "sweet",
        "zh": "啊，制作人♡ 原来你在这里呀？"
      }
    },
    {
      "id": "fyk_rooftop01_003",
      "speaker": "プロデューサー",
      "text": "ああ。冬優子こそ、事務所に戻らなくていいのか？",
      "textCtrl": "p",
      "textFrame": "002",
      "_meta": {
        "zh": "嗯。冬优子你呢，不回事务所没关系吗？"
      }
    },
    {
      "id": "fyk_rooftop01_004",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_smile2",
      "charAnim1": "smile2",
      "charLipAnim": "lip_smile",
      "text": "ふゆ、雨上がりの空が見たくって……えへへ♡",
      "voice": "custom/fyk_rooftop01/004_t2",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "holdMs": 350,
        "innerEmotion": "tired",
        "lipBaked": true,
        "mode": "omote",
        "surfaceEmotion": "happy",
        "takeSelected": "t2",
        "takes": [
          {
            "id": "t1",
            "voice": "custom/fyk_rooftop01/004_t1",
            "engine": "irodori",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1201,
            "durationMs": 500,
            "status": "rejected",
            "rating": 2,
            "note": "語尾が硬い"
          },
          {
            "id": "t2",
            "voice": "custom/fyk_rooftop01/004_t2",
            "engine": "irodori",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "happy",
            "seed": 1207,
            "durationMs": 500,
            "status": "approved",
            "rating": 4.5
          }
        ],
        "ttsText": "ふゆ、あめあがりのそらがみたくって……えへへ",
        "vocalTone": "sweet",
        "zh": "冬优想看看雨后的天空嘛……诶嘿嘿♡"
      }
    },
    {
      "charLabel": "fuyuko",
      "charAnim2": "face_close",
      "charAnim1": "wait2",
      "textFrame": "off",
      "_meta": {
        "macroId": "look_around#1"
      }
    },
    {
      "charLabel": "fuyuko",
      "charAnim4": "eye_left",
      "waitType": "time",
      "waitTime": 600,
      "textFrame": "off",
      "_meta": {
        "macroId": "look_around#1"
      }
    },
    {
      "id": "fyk_rooftop01_005",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_serious",
      "charAnim1": "anger1",
      "charLipAnim": "lip_anger_s",
      "text": "……はぁ。誰も見てないわよね。事務所のみんなの前じゃ、こんな顔できないんだから",
      "voice": "custom/fyk_rooftop01/005_t1",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "holdMs": 750,
        "innerEmotion": "relieved",
        "mode": "honne",
        "oocFlags": [
          {
            "code": "register_shift_no_cue",
            "severity": "info",
            "message": "omote→honne 切替。直前の look_around マクロで舞台上の合図あり",
            "source": "polisher",
            "waived": true
          }
        ],
        "surfaceEmotion": "tired",
        "takeSelected": "t1",
        "takes": [
          {
            "id": "t1",
            "voice": "custom/fyk_rooftop01/005_t1",
            "engine": "irodori",
            "voiceProfile": "sc_fuyuko_v2",
            "emotion": "serious",
            "ref": "fuyuko/honne/03",
            "seed": 88,
            "durationMs": 500,
            "status": "approved",
            "recipe": {
              "crossfadeMs": 80,
              "segments": [
                {
                  "kind": "aizuchi",
                  "ref": "produce_events/101800401/1018004010220",
                  "text": "……はぁ",
                  "trimMs": [
                    0,
                    480
                  ],
                  "gainDb": 0
                },
                {
                  "kind": "tts",
                  "ref": "fuyuko/honne/03",
                  "text": "だれもみてないわよね。じむしょのみんなのまえじゃ、こんなかおできないんだから",
                  "seed": 88,
                  "gainDb": -0.5
                }
              ]
            }
          }
        ],
        "ttsText": "……はぁ。だれもみてないわよね。じむしょのみんなのまえじゃ、こんなかおできないんだから",
        "vocalTone": "low",
        "zh": "……唉。没人看着吧。在事务所大家面前，冬优可摆不出这种表情"
      }
    },
    {
      "select": "今の冬優子も好きだよ",
      "nextLabel": "honest",
      "_meta": {
        "selectZh": "现在的冬优子我也喜欢哦"
      }
    },
    {
      "select": "見なかったことにする",
      "nextLabel": "forget",
      "textCtrl": "cm",
      "_meta": {
        "selectZh": "就当没看见"
      }
    },
    {
      "label": "honest"
    },
    {
      "id": "fyk_rooftop01_006",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_shy",
      "charAnim1": "shy1",
      "charLipAnim": "lip_shy",
      "text": "なっ……！　あんた、バカじゃないの！？",
      "nextLabel": "end",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "mode": "honne",
        "surfaceEmotion": "flustered",
        "vocalTone": "sharp",
        "zh": "什……！你是笨蛋吗！？"
      }
    },
    {
      "label": "forget"
    },
    {
      "id": "fyk_rooftop01_007",
      "speaker": "冬優子",
      "charLabel": "fuyuko",
      "charAnim2": "face_smile",
      "charAnim1": "smile2",
      "charLipAnim": "lip_smile",
      "text": "ふふっ♡　さすがプロデューサーさんですぅ",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "innerEmotion": "annoyed",
        "mode": "omote",
        "surfaceEmotion": "happy",
        "ttsText": "ふふっ。さすがプロデューサーさんですぅ",
        "vocalTone": "sweet",
        "zh": "呵呵♡ 不愧是制作人呢"
      }
    },
    {
      "label": "end"
    },
    {
      "charLabel": "fuyuko",
      "charEffect": {
        "type": "to",
        "alpha": 0,
        "time": 100
      },
      "textFrame": "off"
    },
    {
      "id": "fyk_rooftop01_008",
      "speaker": "冬優子",
      "text": "……さて。階段、滑らないように降りなきゃね",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "holdMs": 800,
        "mode": "honne",
        "surfaceEmotion": "tender",
        "vocalTone": "soft",
        "zh": "……好啦。下楼梯可得小心别滑倒呢"
      }
    },
    {
      "bgm": "fade_out",
      "waitType": "time",
      "waitTime": 1000,
      "textFrame": "off"
    }
  ]
};
  const rehearsalPack = {
  "format": "scpack",
  "formatVersion": 2,
  "id": "after_school_rehearsal",
  "name": "放課後リハーサル",
  "nameZh": "放学后的彩排（イルミネ三人站位与OOC修复演示）",
  "version": "0.0.2",
  "lang": {
    "primary": "ja",
    "translations": [
      "zh"
    ]
  },
  "requires": {
    "officialAssets": true
  },
  "overlay": {
    "mode": "overlay",
    "allowShadow": false
  },
  "stories": [
    {
      "id": "ils_rehearsal01",
      "file": "stories/ils_rehearsal01.scproj.json",
      "title": "放課後リハーサル",
      "titleZh": "放学后的彩排",
      "order": 1,
      "cast": [
        "mano",
        "hiori",
        "meguru"
      ],
      "entry": true
    }
  ],
  "characters": {
    "mano": {
      "charType": "characters",
      "charId": "001",
      "charCategory": "stand",
      "name": "真乃",
      "nameZh": "真乃",
      "voiceProfile": "sc_mano_v1"
    },
    "hiori": {
      "charType": "characters",
      "charId": "002",
      "charCategory": "stand",
      "name": "灯織",
      "nameZh": "灯织",
      "voiceProfile": "sc_hiori_v1"
    },
    "meguru": {
      "charType": "characters",
      "charId": "003",
      "charCategory": "stand",
      "name": "めぐる",
      "nameZh": "巡",
      "voiceProfile": "sc_meguru_v1"
    }
  },
  "assets": {
    "bg": {}
  },
  "tts": {
    "engine": "irodori",
    "voiceProfiles": {
      "mano": "sc_mano_v1",
      "hiori": "sc_hiori_v1",
      "meguru": "sc_meguru_v1"
    },
    "voiceDir": "custom/ils_rehearsal01"
  },
  "imageGen": {
    "defaults": {
      "provider": "comfy_sd",
      "promptPrefix": "anime visual-novel background, idolmaster shiny colors enza style, no people, ",
      "size": {
        "w": 1136,
        "h": 640
      },
      "stageFilter": "enza_day"
    }
  }
};
  const rehearsalStory = {
  "format": "scproj",
  "formatVersion": 2,
  "meta": {
    "id": "ils_rehearsal01",
    "cat": "custom",
    "title": "放課後リハーサル",
    "titleZh": "放学后的彩排",
    "origin": "custom",
    "lang": {
      "primary": "ja",
      "translations": [
        "zh"
      ]
    },
    "era": "wing",
    "cast": [
      "mano",
      "hiori",
      "meguru"
    ],
    "tts": {
      "engine": "irodori",
      "voiceDir": "custom/ils_rehearsal01"
    },
    "compile": {
      "mode": "author"
    }
  },
  "lines": [
    {
      "bg": "00006",
      "bgm": "002",
      "waitType": "time",
      "waitTime": 1000,
      "textFrame": "off"
    },
    {
      "id": "ils_rehearsal01_001",
      "speaker": "めぐる",
      "charLabel": "meguru",
      "charAnim2": "face_smile",
      "charAnim1": "wait1",
      "text": "よーし！　もう一回、最初から通してみよっ！",
      "charType": "characters",
      "charId": "003",
      "charCategory": "stand",
      "charPosition": {
        "x": 200,
        "y": 640,
        "order": 0
      },
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "uid": "r.001",
        "surfaceEmotion": "happy",
        "vocalTone": "bright",
        "zh": "好——！再从头顺一遍吧！"
      }
    },
    {
      "id": "ils_rehearsal01_002",
      "speaker": "真乃",
      "charLabel": "mano",
      "charAnim2": "face_smile",
      "charAnim1": "wait1",
      "text": "ほわっ……うん、灯織ちゃん、めぐるちゃん、がんばろうね",
      "charType": "characters",
      "charId": "001",
      "charCategory": "stand",
      "charPosition": {
        "x": 568,
        "y": 640,
        "order": 1
      },
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "uid": "r.002",
        "surfaceEmotion": "happy",
        "vocalTone": "soft",
        "zh": "呼哇……嗯，灯织酱、巡酱，一起加油吧"
      }
    },
    {
      "id": "ils_rehearsal01_003",
      "speaker": "灯織",
      "charLabel": "hiori",
      "charAnim2": "face_serious",
      "charAnim1": "wait1",
      "text": "うん。真乃、めぐる、さっきのターンの呼吸をもう一度合わせよう",
      "charType": "characters",
      "charId": "002",
      "charCategory": "stand",
      "charPosition": {
        "x": 936,
        "y": 640,
        "order": 2
      },
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 100
      },
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "uid": "r.003",
        "surfaceEmotion": "serious",
        "vocalTone": "normal",
        "zh": "嗯。真乃、巡，把刚才转身的呼吸再合一次吧"
      }
    },
    {
      "id": "ils_rehearsal01_004",
      "speaker": "めぐる",
      "charLabel": "meguru",
      "charAnim2": "face_smile2",
      "charAnim1": "smile1",
      "text": "うんっ！　わたし、真乃と灯織となら何度でも踊れちゃうよ！",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "uid": "r.004",
        "surfaceEmotion": "happy",
        "vocalTone": "bright",
        "zh": "嗯！只要是和真乃还有灯织一起，我跳多少次都可以哦！"
      }
    },
    {
      "id": "ils_rehearsal01_005",
      "speaker": "プロデューサー",
      "text": "（三人とも、いい顔をしてるな）",
      "textCtrl": "p",
      "textFrame": "002",
      "_meta": {
        "uid": "r.005",
        "zh": "（三个人的表情都很好啊）"
      }
    },
    {
      "select": "もう一回見せてくれ",
      "nextLabel": "again",
      "_meta": {
        "uid": "r.006",
        "selectZh": "再给我看一遍吧"
      }
    },
    {
      "select": "少し休憩しよう",
      "nextLabel": "rest",
      "textCtrl": "cm",
      "_meta": {
        "uid": "r.007",
        "selectZh": "稍微休息一下吧"
      }
    },
    {
      "label": "again",
      "_meta": {
        "uid": "r.008"
      }
    },
    {
      "id": "ils_rehearsal01_006",
      "speaker": "灯織",
      "charLabel": "hiori",
      "charAnim2": "face_smile",
      "charAnim1": "wait1",
      "text": "はい、プロデューサー。今度こそ、三人の呼吸を合わせます",
      "nextLabel": "end",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "uid": "r.009",
        "surfaceEmotion": "happy",
        "vocalTone": "normal",
        "zh": "好的，制作人。这次一定让三个人的呼吸合上"
      }
    },
    {
      "label": "rest",
      "_meta": {
        "uid": "r.010"
      }
    },
    {
      "id": "ils_rehearsal01_007",
      "speaker": "真乃",
      "charLabel": "mano",
      "charAnim2": "face_smile",
      "charAnim1": "smile1",
      "text": "えへへ……プロデューサーさん、みんなでお茶にしましょうか",
      "textCtrl": "p",
      "textFrame": "001",
      "_meta": {
        "uid": "r.011",
        "surfaceEmotion": "happy",
        "vocalTone": "soft",
        "zh": "诶嘿嘿……制作人，大家一起喝茶吧"
      }
    },
    {
      "label": "end",
      "_meta": {
        "uid": "r.012"
      }
    },
    {
      "bgm": "fade_out",
      "waitType": "time",
      "waitTime": 800,
      "textFrame": "off",
      "_meta": {
        "uid": "r.013"
      }
    }
  ]
};

  const blankPack = {
    format: 'scpack', formatVersion: 2, id: 'my_new_pack', name: 'Untitled', nameZh: '新建空白包', version: '0.0.1',
    stories: [{ id: 'new_story01', file: 'stories/new_story01.scproj.json', title: 'Untitled', titleZh: '未命名故事', entry: true }],
    characters: Object.assign({}, showcasePack.characters, rehearsalPack.characters),
    assets: { bg: {} }, tts: { engine: 'irodori', voiceDir: 'custom/new_story01' }
  };
  const blankStory = {
    format: 'scproj', formatVersion: 2,
    meta: { id: 'new_story01', cat: 'custom', title: 'Untitled', titleZh: '未命名故事', origin: 'custom', compile: { mode: 'author' } },
    lines: [
      { bg: '00001', textFrame: 'off', _meta: { uid: 'n.001' } },
      { id: 'new_story01_001', speaker: 'プロデューサー', text: '', textCtrl: 'p', textFrame: '002', _meta: { uid: 'n.002', zh: '' } }
    ]
  };

  const charInfo = {
    fuyuko: {
      name: '冬優子', nameZh: '黛冬优子', unit: 'ストレイライト', color: '#f0609e', hair: '#5a3a4a', pitch: 1.18, dual: true,
      firstPerson: {
        omote: { ok: 'ふゆ', wrong: /あたし|わたし|私/g, msg: '冬優子自称「ふゆ」（禁用わたし/あたし）' },
        honne: { ok: 'ふゆ', wrong: /あたし|わたし|私/g, msg: '冬優子即使在本音（honne）下也自称「ふゆ」（禁用あたし/わたし）' },
        any:   { ok: 'ふゆ', wrong: /あたし|わたし|私/g, msg: '冬優子自称「ふゆ」' }
      }
    },
    asahi: {
      name: 'あさひ', nameZh: '芹泽朝日', unit: 'ストレイライト', color: '#f30100', hair: '#4a3530', pitch: 1.24, dual: false,
      firstPerson: { any: { ok: 'わたし', wrong: /あたし|私|僕/g, msg: 'あさひ自称「わたし」，语尾多用「〜っす」' } }
    },
    mei: {
      name: '愛依', nameZh: '和泉爱依', unit: 'ストレイライト', color: '#ff00ff', hair: '#d8b268', pitch: 1.08, dual: false,
      firstPerson: { any: { ok: 'あたし', wrong: /わたし|私|僕/g, msg: '愛依自称「あたし」（辣妹平假名）' } }
    },
    toru: {
      name: '透', nameZh: '浅仓透', unit: 'ノクチル', color: '#50d0d0', hair: '#2f3d4c', pitch: 1.02, dual: false,
      firstPerson: { any: { ok: 'わたし', wrong: /あたし|私|僕/g, msg: '透自称「わたし」' } }
    },
    madoka: {
      name: '円香', nameZh: '樋口圆香', unit: 'ノクチル', color: '#be1e3e', hair: '#3b2830', pitch: 0.96, dual: false,
      firstPerson: { any: { ok: 'わたし', wrong: /あたし|私|僕/g, msg: '円香自称「わたし」' } }
    },
    mano: {
      name: '真乃', nameZh: '樱木真乃', unit: 'イルミネーションスターズ', color: '#f7a1c4', hair: '#c97a92', pitch: 1.12, dual: false,
      firstPerson: { any: { ok: 'わたし', wrong: /あたし|僕|ボク|私/g, msg: '真乃自称「わたし」（平假名）' } }
    },
    hiori: {
      name: '灯織', nameZh: '风野灯织', unit: 'イルミネーションスターズ', color: '#4a7be0', hair: '#1f2a4a', pitch: 1.0, dual: false,
      firstPerson: { any: { ok: '私', wrong: /あたし|わたし|僕/g, msg: '灯織自称「私」（汉字）' } }
    },
    meguru: {
      name: 'めぐる', nameZh: '八宫巡', unit: 'イルミネーションスターズ', color: '#f6c33a', hair: '#e2a93a', pitch: 1.22, dual: false,
      firstPerson: { any: { ok: 'わたし', wrong: /あたし|私|僕/g, msg: 'めぐる自称「わたし」（平假名）' } }
    },
    amana: {
      charId: '014', name: '甘奈', nameZh: '大崎甘奈', unit: 'アルストロメリア', color: '#f54275', hair: '#9e6b58', pitch: 1.18, dual: false,
      firstPerson: { any: { ok: '甘奈', wrong: /わたし|あたし|私|僕/g, msg: '甘奈自称「甘奈」（第三人称自称，禁用わたし/あたし）' } }
    },
    tenka: {
      charId: '015', name: '甜花', nameZh: '大崎甜花', unit: 'アルストロメリア', color: '#e75bec', hair: '#6b4d47', pitch: 1.14, dual: false,
      firstPerson: { any: { ok: '甜花', wrong: /わたし|あたし|私|僕/g, msg: '甜花自称「甜花」（第三人称自称，禁用わたし/私）' } }
    },
    chiyuki: {
      charId: '016', name: '千雪', nameZh: '桑山千雪', unit: 'アルストロメリア', color: '#fbfafafa'.slice(0, 7) === '#fbfafa' ? '#f08aa8' : '#f08aa8', hair: '#8d7268', pitch: 1.04, dual: false,
      firstPerson: { any: { ok: '私', wrong: /あたし|僕|ボク/g, msg: '千雪自称「私」' } }
    },
    luca: {
      charId: '026', name: 'ルカ', nameZh: '斑鸠路加', unit: 'コメティック', color: '#38303c', hair: '#252129', pitch: 0.92, dual: false,
      firstPerson: { any: { ok: 'あたし', wrong: /わたし|私|僕/g, msg: 'ルカ自称「あたし」' } }
    },
    hana: {
      charId: '027', name: '羽那', nameZh: '铃木羽那', unit: 'コメティック', color: '#47b2c8', hair: '#3b4a5e', pitch: 1.16, dual: false,
      firstPerson: { any: { ok: 'あたし', wrong: /わたし|私|僕/g, msg: '羽那自称「あたし」（禁用わたし/私）' } }
    },
    haruki: {
      charId: '028', name: 'はるき', nameZh: '郁田阳希', unit: 'コメティック', color: '#fae084', hair: '#d89b6c', pitch: 1.08, dual: false,
      firstPerson: { any: { ok: 'わたし', wrong: /あたし|私|僕/g, msg: 'はるき自称「わたし」' } }
    }
  };

  const addressMatrix = [
    { from: 'fuyuko', to: 'producer', mode: 'omote', correct: 'プロデューサーさん', wrong: /プロデューサー(くん|ちゃん|様)|あんた/g, sev: 'warn', msg: '营业（omote）时冬優子称制作人「プロデューサーさん」' },
    { from: 'fuyuko', to: 'producer', mode: 'honne', correct: 'あんた', wrong: /プロデューサーさん/g, sev: 'warn', msg: '本音（honne）独处时冬優子称制作人「あんた」' },
    { from: 'fuyuko', to: 'asahi', mode: 'honne', correct: 'あさひ', wrong: /あさひ(ちゃん|さん)/g, sev: 'warn', msg: '本音（honne）时冬優子直呼「あさひ」' },
    { from: 'fuyuko', to: 'mei', mode: 'honne', correct: '愛依', wrong: /愛依(ちゃん|さん)/g, sev: 'warn', msg: '本音（honne）时冬優子直呼「愛依」' },
    { from: 'asahi', to: 'fuyuko', correct: '冬優子ちゃん', wrong: /冬優子(さん|様)|冬優子(?!ちゃん)/g, sev: 'warn', msg: 'あさひ称冬優子「冬優子ちゃん」' },
    { from: 'mei', to: 'fuyuko', correct: '冬優子ちゃん', wrong: /冬優子(さん|様)|冬優子(?!ちゃん)/g, sev: 'warn', msg: '愛依称冬優子「冬優子ちゃん」' },
    { from: 'toru', to: 'madoka', correct: '樋口', wrong: /円香(ちゃん|さん)?/g, sev: 'warn', msg: '透通常称圆香「樋口」（91.7% 语料占比）' },
    { from: 'madoka', to: 'toru', correct: '浅倉', wrong: /透(ちゃん|さん)/g, sev: 'warn', msg: '円香当面称透「浅倉」' },
    { from: 'mano', to: 'producer', correct: 'プロデューサーさん', wrong: /Pさん|プロデューサー(くん|様)/g, sev: 'warn', msg: '真乃称制作人「プロデューサーさん」' },
    { from: 'mano', to: 'hiori', correct: '灯織ちゃん', wrong: /灯織(さん|くん)/g, sev: 'warn', msg: '真乃称灯織「灯織ちゃん」' },
    { from: 'mano', to: 'meguru', correct: 'めぐるちゃん', wrong: /めぐる(さん|くん)/g, sev: 'warn', msg: '真乃称めぐる「めぐるちゃん」' },
    { from: 'hiori', to: 'mano', correct: '真乃', wrong: /真乃(さん|ちゃん)/g, sev: 'warn', msg: '灯織直呼「真乃」' },
    { from: 'hiori', to: 'meguru', correct: 'めぐる', wrong: /めぐる(さん|ちゃん)/g, sev: 'warn', msg: '灯織直呼「めぐる」' },
    { from: 'meguru', to: 'mano', correct: '真乃', wrong: /真乃(さん|ちゃん)/g, sev: 'warn', msg: 'めぐる直呼「真乃」' },
    { from: 'meguru', to: 'hiori', correct: '灯織', wrong: /灯織(さん|ちゃん)/g, sev: 'warn', msg: 'めぐる直呼「灯織」' }
  ];

  const readingRules = [
    { re: /283/g, kana: 'にーはちさん', msg: '数字「283」建议读作「にーはちさん」' },
    { re: /W\.I\.N\.G\./g, kana: 'ウィング', msg: '「W.I.N.G.」建议读作「ウィング」' }
  ];

  const macros = [
    { name: 'look_around', label: '张望四周', desc: '闭眼 → 视线左移 600ms（冬優子切本音前常用）', needsChar: true,
      rows: c => [{ charLabel: c, charAnim2: 'face_close', charAnim1: 'wait2', textFrame: 'off' }, { charLabel: c, charAnim4: 'eye_left', waitType: 'time', waitTime: 600, textFrame: 'off' }] },
    { name: 'sigh_turn', label: '叹气背身', desc: '闭眼叹息 + 风声，背身停 800ms', needsChar: true,
      rows: c => [{ charLabel: c, charAnim2: 'face_close', charAnim1: 'wait2', se: '0418', textFrame: 'off' }, { charLabel: c, charAnim3: 'turn_back', waitType: 'time', waitTime: 800, textFrame: 'off' }] },
    { name: 'enter_fade', label: '淡入登场', desc: '居中淡入 300ms', needsChar: true,
      rows: c => [{ charLabel: c, charPosition: { x: 568, y: 640, order: 0 }, charEffect: { type: 'from', alpha: 0, time: 300 }, textFrame: 'off' }] },
    { name: 'exit_fade', label: '淡出退场', desc: '淡出 300ms', needsChar: true,
      rows: c => [{ charLabel: c, charEffect: { type: 'to', alpha: 0, time: 300 }, textFrame: 'off' }] },
    { name: 'heart_zoom', label: '心跳特写', desc: '放大 1.15 + 心跳音效，500ms 后复原', needsChar: true,
      rows: c => [{ charLabel: c, charScale: 1.15, se: '0102', waitType: 'time', waitTime: 500, textFrame: 'off' }, { charLabel: c, charScale: 1, textFrame: 'off' }] },
    { name: 'flashback', label: '回忆闪回', desc: '闪白 → 回忆柔焦滤镜 + 闪光音效', needsChar: false,
      rows: () => [{ se: '0150', textFrame: 'off', _meta: { 'x-editor-filter': 'flash' } }, { waitType: 'time', waitTime: 800, textFrame: 'off', _meta: { 'x-editor-filter': 'memory' } }] },
    { name: 'rain_ambience', label: '雨声环境', desc: '雨雾叠加 + 水滴音效', needsChar: false,
      rows: () => [{ se: '0113', textFrame: 'off', _meta: { 'x-editor-filter': 'rain' } }] }
  ];

  const bgLibrary = [
    { id: '00001', title: '283事務所（昼）', tags: '事务所 办公室 白天 283 日常 沙发', sky: ['#bfe3ff', '#eef8ff'], ground: '#c5b095', motif: 'window', realUrl: '/bg/00001.jpg' },
    { id: '00002', title: '283事務所（夕）', tags: '事务所 办公室 傍晚 黄昏 夕阳 283', sky: ['#f6b98a', '#fde2c8'], ground: '#8a6f5c', motif: 'window', realUrl: '/bg/00002.jpg' },
    { id: '00006', title: 'レッスン室（昼）', tags: '练习室 舞蹈 镜子 室内 训练 彩排', sky: ['#e6ecf5', '#ffffff'], ground: '#c8b49a', motif: 'mirror', realUrl: '/bg/00006.jpg' },
    { id: '00007', title: '屋上（夕）', tags: '天台 屋顶 黄昏 傍晚 夕阳 栏杆', sky: ['#f08a6a', '#ffd1a1'], ground: '#7b6c75', motif: 'fence', realUrl: '/bg/00007.jpg' },
    { id: '00060', title: '283事務所（夜）', tags: '事务所 办公室 夜晚 灯光 加班 283', sky: ['#1b2550', '#4b3f7a'], ground: '#3b3546', motif: 'window', realUrl: '/bg/00060.jpg' },
    { id: '00889', title: '屋上（晴）', tags: '天台 屋顶 学校 晴天 蓝天 白天 栅栏', sky: ['#7ec8ff', '#d9f0ff'], ground: '#9aa7b4', motif: 'fence', realUrl: '/bg/00889.jpg' },
    { id: '00014', title: '事務所（夕・窓辺）', tags: '事务所 办公室 室内 傍晚 黄昏 窗户', sky: ['#f6b98a', '#fde2c8'], ground: '#8a6f5c', motif: 'window', realUrl: '/bg/00014.jpg' },
    { id: '00102', title: '教室（昼）', tags: '教室 学校 白天 课桌 黑板 室内', sky: ['#cfe9ff', '#f4fbff'], ground: '#b9a184', motif: 'desk', realUrl: '/bg/00102.jpg' },
    { id: '00230', title: 'リハーサル室', tags: '练习室 舞蹈 镜子 室内 训练 彩排', sky: ['#e6ecf5', '#ffffff'], ground: '#c8b49a', motif: 'mirror', realUrl: '/bg/00230.jpg' },
    { id: '00311', title: '駅前（夜）', tags: '车站 夜晚 城市 街道 霓虹 灯光', sky: ['#1b2550', '#4b3f7a'], ground: '#2b2f3f', motif: 'city', realUrl: '/bg/00311.jpg' },
    { id: '00062', title: '無人島・白い砂浜（昼）', tags: '海滩 沙滩 荒岛 无人岛 大海 夏天 白天 晴天 海岬', sky: ['#5ec4ff', '#c9f1ff'], ground: '#f2dfae', motif: 'sea', realUrl: '/bg/00062.jpg' },
    { id: '00053', title: '夏の海辺・砂浜キャンプ（昼）', tags: '海滩 沙滩 沙堡 荒岛 营地 夏天 白天', sky: ['#5ec4ff', '#c9f1ff'], ground: '#f2dfae', motif: 'sea', realUrl: '/bg/00053.jpg' },
    { id: '00061', title: '夕陽の砂浜・海岸（夕）', tags: '海滩 沙滩 夕阳 傍晚 黄昏 海岸 脚印 救援', sky: ['#f08a6a', '#ffd1a1'], ground: '#d89b6c', motif: 'sea', realUrl: '/bg/00061.jpg' },
    { id: '00415', title: '海辺（夏）', tags: '海边 沙滩 夏天 大海 蓝天 晴天', sky: ['#5ec4ff', '#c9f1ff'], ground: '#f2dfae', motif: 'sea', realUrl: '/bg/00415.jpg' },
    { id: '00520', title: '公園（雨）', tags: '公园 下雨 雨天 阴天 树 长椅', sky: ['#8a9bb0', '#c4ced9'], ground: '#5f7564', motif: 'tree', realUrl: '/bg/00520.jpg' },
    { id: '00618', title: 'ライブ会場', tags: '舞台 演唱会 Live 灯光 夜晚 观众', sky: ['#160c2e', '#5a1f6e'], ground: '#1d1430', motif: 'stage', realUrl: '/bg/00618.jpg' }
  ];
  const bgSynonyms = { '下雨': '雨', '雨后': '雨', '黄昏': '傍晚', '夕阳': '傍晚', '晚上': '夜晚', '夜': '夜晚', '屋顶': '天台', '学校': '学校', '海': '海边', '雪': '下雪', '办公室': '事务所', '舞台': '舞台', '练习': '练习室', '演唱会': '舞台' };

  const bgmLibrary = [
    { id: '002', title: '283プロの日常', tags: '日常 轻快 事务所 明亮', mood: [0, 4, 7, 9], tempo: 116 },
    { id: '003', title: 'いつもの事務所', tags: '日常 温暖 弦乐 谢幕', mood: [0, 4, 7, 11], tempo: 108 },
    { id: '004', title: '夕暮れの帰り道', tags: '夕阳 温柔 散步 抒情', mood: [0, 3, 7, 10], tempo: 88 },
    { id: '016', title: '雨上がりのメロディ', tags: '温柔 钢琴 雨后 治愈 安静', mood: [0, 4, 7, 11], tempo: 72 },
    { id: '021', title: 'ざわめき', tags: '紧张 不安 悬疑 心事', mood: [0, 3, 6, 10], tempo: 84 },
    { id: '034', title: 'ひかりの約束', tags: '感动 弦乐 告白 温暖', mood: [0, 4, 7, 14], tempo: 66 }
  ];
  const seCategories = [
    { id: 'all', label: '🔔 全部音效 (40)' },
    { id: 'footstep_door', label: '🚪 脚步与开关门' },
    { id: 'weather_nature', label: '🌊 天气与自然环境' },
    { id: 'phone_daily', label: '📱 手机与日常物品' },
    { id: 'emotion_gag', label: '💥 情绪与吐槽搞笑' },
    { id: 'stage_applause', label: '✨ 舞台与欢呼掌声' },
    { id: 'clear', label: '🧹 清除本行音效' }
  ];

  const seLibrary = [
    // 1. 🚪 脚步与开关门 (footstep_door)
    { id: '0113', category: 'footstep_door', categoryLabel: '🚪 脚步与开关门', title: '🚪 事务所推门进入声', desc: '走进283事务所或休息室推开门（原版高频 1,549 次）', tags: '开门 推门 进门 事务所 进场', kind: 'door' },
    { id: '0114', category: 'footstep_door', categoryLabel: '🚪 脚步与开关门', title: '🚪 轻轻关门声', desc: '离开房间或谈话结束轻轻带上房门（原版 629 次）', tags: '关门 离开 退场 门', kind: 'door' },
    { id: '1275', category: 'footstep_door', categoryLabel: '🚪 脚步与开关门', title: '🚪 休息室开门寒暄声', desc: '轻快推开练习室/休息室门打招呼（原版 521 次）', tags: '开门 休息室 打招呼 早安', kind: 'door' },
    { id: '0457', category: 'footstep_door', categoryLabel: '🚪 脚步与开关门', title: '🚪 推门出发声', desc: '「我出发了！」干脆利落推门而出（原版 309 次）', tags: '出门 出发 开门 门', kind: 'door' },
    { id: '1273', category: 'footstep_door', categoryLabel: '🚪 脚步与开关门', title: '✊ 礼貌敲门声（咚咚）', desc: '进入社长室或休息室前礼貌叩门（原版 462 次）', tags: '敲门 叩门 进门 礼貌', kind: 'door' },
    { id: '0243', category: 'footstep_door', categoryLabel: '🚪 脚步与开关门', title: '👣 室内走廊脚步声', desc: '事务所走廊/室内日常稳健脚步声（原版高频 1,916 次）', tags: '脚步 走路 走廊 室内 换位', kind: 'step' },
    { id: '0247', category: 'footstep_door', categoryLabel: '🚪 脚步与开关门', title: '🏃 轻快小跑靠近声', desc: '偶像欢快小跑凑近制作人搭话（原版高频 1,259 次）', tags: '小跑 跑近 脚步 欢快 靠近', kind: 'step' },
    { id: '0116', category: 'footstep_door', categoryLabel: '🚪 脚步与开关门', title: '👣 放轻脚步缓步走近', desc: '悄悄靠近或并肩散步的轻柔脚步（原版 1,168 次）', tags: '慢走 轻步 散步 靠近 脚步', kind: 'step' },
    { id: '0242b', category: 'footstep_door', categoryLabel: '🚪 脚步与开关门', title: '🏃 慌忙急促奔跑声', desc: '「等等我制作人！」急匆匆追赶奔跑（原版 853 次）', tags: '奔跑 急促 追赶 迟到 跑步', kind: 'step' },

    // 2. 🌊 天气与自然环境 (weather_nature)
    { id: '0417', category: 'weather_nature', categoryLabel: '🌊 天气与自然环境', title: '🌊 海浪拍岸与海风声', desc: '夏日海滩/无人岛岸边温柔海浪拍打沙滩（原版 157 次）', tags: '海浪 大海 沙滩 海边 荒岛 夏天', kind: 'wave' },
    { id: '0426', category: 'weather_nature', categoryLabel: '🌊 天气与自然环境', title: '🌧️ 淅沥雨声与环境音', desc: '雨天街头或屋檐下避雨的连绵雨声（原版 388 次）', tags: '下雨 雨声 雨天 避雨 阴天', kind: 'drop' },
    { id: '0188', category: 'weather_nature', categoryLabel: '🌊 天气与自然环境', title: '⚡ 倾盆大雨与雷鸣声', desc: '突降暴雨与远方闷雷轰鸣（原版 186 次）', tags: '大雨 雷声 暴雨 打雷 暴风雨', kind: 'thunder' },
    { id: '0418', category: 'weather_nature', categoryLabel: '🌊 天气与自然环境', title: '☀️ 晴朗微风与室外环境', desc: '天台/公园/海滨清爽微风吹拂（原版 216 次）', tags: '微风 晴天 天台 公园 户外', kind: 'wind' },
    { id: '0431', category: 'weather_nature', categoryLabel: '🌊 天气与自然环境', title: '🌬️ 强风呼啸吹拂声', desc: '阵风猛烈吹过发梢与衣角「哇…！」（原版 179 次）', tags: '大风 强风 吹风 海风 呼啸', kind: 'wind' },
    { id: '1004', category: 'weather_nature', categoryLabel: '🌊 天气与自然环境', title: '🦗 盛夏蝉鸣与树林鸟鸣', desc: '夏日合宿/林间小道蝉鸣与自然生机', tags: '蝉鸣 夏天 树林 鸟鸣 合宿 森林', kind: 'wind' },
    { id: '0820', category: 'weather_nature', categoryLabel: '🌊 天气与自然环境', title: '🔔 学校上下课铃声', desc: '放学黄昏教室经典叮咚上下课钟声（原版 300 次）', tags: '学校 铃声 下课 放学 教室', kind: 'bell' },
    { id: '0152', category: 'weather_nature', categoryLabel: '🌊 天气与自然环境', title: '🚗 街道车流与乘车环境', desc: '外景大巴/保姆车行驶或繁华街道环境（原版 732 次）', tags: '汽车 车内 街道 交通 移动', kind: 'car' },

    // 3. 📱 手机与日常物品 (phone_daily)
    { id: '0272', category: 'phone_daily', categoryLabel: '📱 手机与日常物品', title: '📱 手机震动 / 消息送达音', desc: '收到工作联络或日程通知手机嗡嗡震动（原版 542 次）', tags: '手机 震动 消息 联络 通知', kind: 'buzz' },
    { id: '1346', category: 'phone_daily', categoryLabel: '📱 手机与日常物品', title: '💬 LIME 新消息清脆提示音', desc: '偶像发来聊天消息「在车站前咖啡馆哦～！」（原版 371 次）', tags: 'LINE LIME 消息 聊天 提示音 手机', kind: 'buzz' },
    { id: '0330', category: 'phone_daily', categoryLabel: '📱 手机与日常物品', title: '📱 手机操作 / 刷动态点击音', desc: '发送推文或查看手机屏幕点击音效（原版高频 1,284 次）', tags: '手机 点击 发推 社交 屏幕', kind: 'buzz' },
    { id: '0134', category: 'phone_daily', categoryLabel: '📱 手机与日常物品', title: '📞 手机来电铃声 / 通话音', desc: '电话响起或接通语音通话提示（原版 317 次）', tags: '电话 来电 铃声 通话 手机', kind: 'buzz' },
    { id: '0242', category: 'phone_daily', categoryLabel: '📱 手机与日常物品', title: '☕ 倒茶水与放下茶杯声', desc: '事务所休息时泡茶倒水款待（原版高频 1,848 次）', tags: '倒水 泡茶 茶杯 休息 饮料', kind: 'drop' },
    { id: '0166', category: 'phone_daily', categoryLabel: '📱 手机与日常物品', title: '🍵 端上热茶与茶点声', desc: '咖啡厅或休息区轻轻端上茶杯与点心（原版 400 次）', tags: '茶水 咖啡 下午茶 甜点 餐饮', kind: 'drop' },
    { id: '0100', category: 'phone_daily', categoryLabel: '📱 手机与日常物品', title: '📄 翻阅企划书 / 台本纸张声', desc: '翻看通告资料、粉丝来信或台本哗啦声（原版 636 次）', tags: '翻书 纸张 文件 台本 资料', kind: 'paper' },
    { id: '0131', category: 'phone_daily', categoryLabel: '📱 手机与日常物品', title: '📷 相机快门咔嚓拍照声', desc: '杂志摄影棚或旅途纪念拍照快门声（原版 590 次）', tags: '相机 拍照 快门 摄影 合照', kind: 'sparkle' },

    // 4. 💥 情绪与吐槽搞笑 (emotion_gag)
    { id: '001', category: 'emotion_gag', categoryLabel: '💥 情绪与吐槽搞笑', title: '💬 制作人对话气泡弹出音 (001)', desc: '原版最具代表性的P开口/分支选项弹出轻响', tags: '气泡 制作人 选项 开口 001', kind: 'sparkle' },
    { id: '0327', category: 'emotion_gag', categoryLabel: '💥 情绪与吐槽搞笑', title: '❗ 惊讶一凛 / 猛然回神音', desc: '「——！」突然意识到某事或吃惊提示音（原版高频 1,632 次）', tags: '惊讶 震惊 回神 感叹 突然', kind: 'sparkle' },
    { id: '0182', category: 'emotion_gag', categoryLabel: '💥 情绪与吐槽搞笑', title: '💡 叮咚！灵光一闪好主意', desc: '「这个主意太棒了！」想出妙计清脆叮咚音（原版 670 次）', tags: '灵感 叮咚 主意 闪光 开心', kind: 'sparkle' },
    { id: '0453', category: 'emotion_gag', categoryLabel: '💥 情绪与吐槽搞笑', title: '💓 心跳加速 / 害羞脸红提示音', desc: '距离拉近或心意相通时的心动重音（原版 458 次）', tags: '心跳 害羞 脸红 心动 告白', kind: 'heart' },
    { id: '0478', category: 'emotion_gag', categoryLabel: '💥 情绪与吐槽搞笑', title: '✨ 欢欣雀跃 / 元气闪耀音', desc: '「太棒啦！」兴高采烈元气满满提示音（原版 458 次）', tags: '开心 雀跃 闪耀 元气 兴奋', kind: 'sparkle' },
    { id: '0789', category: 'emotion_gag', categoryLabel: '💥 情绪与吐槽搞笑', title: '⚡ 紧急打断 / 吐槽急刹车音', desc: '突发状况、吐槽打断或气氛骤紧冲击音（原版 344 次）', tags: '吐槽 打断 冲击 紧张 搞笑', kind: 'thunder' },
    { id: '0454', category: 'emotion_gag', categoryLabel: '💥 情绪与吐槽搞笑', title: '🧥 猛然起身 / 握拳衣料摩擦音', desc: '干劲十足站起身或肢体大幅动作衣料声（原版高频 2,227 次）', tags: '起身 动作 握拳 衣服 干劲', kind: 'step' },
    { id: '1268', category: 'emotion_gag', categoryLabel: '💥 情绪与吐槽搞笑', title: '💦 肚子咕咕叫 / 害羞石化囧音', desc: '「被、被听见了吗…！」搞笑尴尬名场面音效（原版 294 次）', tags: '搞笑 肚子饿 尴尬 石化 害羞', kind: 'drop' },

    // 5. ✨ 舞台与欢呼掌声 (stage_applause)
    { id: '0220', category: 'stage_applause', categoryLabel: '✨ 舞台与欢呼掌声', title: '👏 全场热烈鼓掌与欢呼声', desc: 'Live演出高潮或谢幕时全场雷鸣掌声（原版最高频 7,472 次）', tags: '掌声 欢呼 舞台 Live 谢幕 观众', kind: 'sparkle' },
    { id: '0328', category: 'stage_applause', categoryLabel: '✨ 舞台与欢呼掌声', title: '✨ 舞台环境与演出余韵音', desc: '登台前后的舞台空间感与光影余韵（原版高频 5,965 次）', tags: '舞台 演出 余韵 后台 登场', kind: 'sparkle' },
    { id: '1002', category: 'stage_applause', categoryLabel: '✨ 舞台与欢呼掌声', title: '🎉 观众席沸腾欢呼声', desc: '演出大成功时台下粉丝的欢呼喝彩（原版 875 次）', tags: '欢呼 粉丝 喝彩 舞台 庆功', kind: 'sparkle' },
    { id: '0247b', category: 'stage_applause', categoryLabel: '✨ 舞台与欢呼掌声', title: '👋 挥手告别与舞台欢送声', desc: '活动结束向大家挥手「拜拜——！」（原版 525 次）', tags: '挥手 告别 欢送 谢幕 结束', kind: 'step' },
    { id: '0491', category: 'stage_applause', categoryLabel: '✨ 舞台与欢呼掌声', title: '🎊 活动现场热闹气氛音', desc: '学园祭/商业路演/庆功宴火热气氛（原版 199 次）', tags: '热闹 活动 庆功 祭典 现场', kind: 'sparkle' },
    { id: '1021', category: 'stage_applause', categoryLabel: '✨ 舞台与欢呼掌声', title: '👏 室内排练室礼貌鼓掌声', desc: '节目收录或练习室小范围温暖掌声（原版 188 次）', tags: '鼓掌 排练 温暖 夸奖 室内', kind: 'sparkle' },
    { id: '0122', category: 'stage_applause', categoryLabel: '✨ 舞台与欢呼掌声', title: '💡 舞台聚光灯点亮登场音', desc: '大幕拉开、聚光灯打在偶像身上的瞬间（原版 82 次）', tags: '聚光灯 开场 灯光 亮相 舞台', kind: 'sparkle' }
  ];

  const voiceSnippets = {
  "mano": [
    {
      "voice": "/voice/game_event_communications/400100807/4001008070370",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1151
    },
    {
      "voice": "/voice/game_event_communications/400100807/4001008070920",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1407
    },
    {
      "voice": "/voice/game_event_communications/400100906/4001009060170",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1151
    },
    {
      "voice": "/voice/produce_events/200101603/2001016030190",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 997
    },
    {
      "voice": "/voice/produce_events/200101703/2001017030280",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1020
    },
    {
      "voice": "/voice/produce_events/300100703/3001007030050",
      "text": "はぁーっ",
      "zh": "（叹气）はぁーっ",
      "kind": "叹气",
      "durationMs": 1193
    },
    {
      "voice": "/voice/produce_events/200100801/2001008010040",
      "text": "ふぅ……っ",
      "zh": "（叹气）ふぅ……っ",
      "kind": "叹气",
      "durationMs": 1195
    },
    {
      "voice": "/voice/produce_events/300100801/3001008010010",
      "text": "はぁーっ……",
      "zh": "（叹气）はぁーっ……",
      "kind": "叹气",
      "durationMs": 1492
    }
  ],
  "hiori": [
    {
      "voice": "/voice/game_event_communications/400100905/4001009050220",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1279
    },
    {
      "voice": "/voice/produce_events/200201601/2002016010210",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1206
    },
    {
      "voice": "/voice/produce_events/300100603/3001006030170",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1236
    },
    {
      "voice": "/voice/produce_events/300202302/3002023020430",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1136
    },
    {
      "voice": "/voice/produce_events/300301002/3003010020220",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1193
    },
    {
      "voice": "/voice/game_event_communications/400101802/4001018020840",
      "text": "はあ……",
      "zh": "（叹气）はあ……",
      "kind": "叹气",
      "durationMs": 1003
    },
    {
      "voice": "/voice/game_event_communications/400101805/4001018050480",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1003
    },
    {
      "voice": "/voice/produce_events/200200403/2002004030040",
      "text": "……ふぅ",
      "zh": "（叹气）……ふぅ",
      "kind": "叹气",
      "durationMs": 1146
    }
  ],
  "meguru": [
    {
      "voice": "/voice/game_event_communications/400100607/4001006070450",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 1321
    },
    {
      "voice": "/voice/game_event_communications/400102707/4001027071020",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 596
    },
    {
      "voice": "/voice/game_event_communications/400108707/4001087070590",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 834
    },
    {
      "voice": "/voice/produce_events/100300309/1003003090020",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 491
    },
    {
      "voice": "/voice/produce_events/200300811/2003008110070",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 937
    },
    {
      "voice": "/voice/produce_events/200300403/2003004030010",
      "text": "……はぁ",
      "zh": "（叹气）……はぁ",
      "kind": "叹气",
      "durationMs": 1402
    },
    {
      "voice": "/voice/produce_events/200301301/2003013010060",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1717
    },
    {
      "voice": "/voice/produce_events/200301302/2003013020040",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1369
    }
  ],
  "koito": [
    {
      "voice": "/voice/produce_events/202201101/2022011010270",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 1229
    },
    {
      "voice": "/voice/produce_events/202201111/2022011110160",
      "text": "……ふふ",
      "zh": "（笑声）……ふふ",
      "kind": "笑声",
      "durationMs": 1392
    },
    {
      "voice": "/voice/game_event_communications/400104001/4001040010380",
      "text": "えへへ……",
      "zh": "（笑声）えへへ……",
      "kind": "笑声",
      "durationMs": 745
    },
    {
      "voice": "/voice/produce_events/202201001/2022010010070",
      "text": "えへへ……",
      "zh": "（笑声）えへへ……",
      "kind": "笑声",
      "durationMs": 1183
    },
    {
      "voice": "/voice/produce_events/202201101/2022011010220",
      "text": "ふふ……！",
      "zh": "（笑声）ふふ……！",
      "kind": "笑声",
      "durationMs": 1020
    },
    {
      "voice": "/voice/produce_events/302100403/3021004030210",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1557
    },
    {
      "voice": "/voice/produce_events/202201204/2022012040020",
      "text": "…………ふぅ",
      "zh": "（叹气）…………ふぅ",
      "kind": "叹气",
      "durationMs": 1276
    },
    {
      "voice": "/voice/produce_events/202200811/2022008110080",
      "text": "…………ふぅ",
      "zh": "（叹气）…………ふぅ",
      "kind": "叹气",
      "durationMs": 1043
    }
  ],
  "asahi": [
    {
      "voice": "/voice/produce_events/201700302/2017003020050",
      "text": "あはは",
      "zh": "（笑声）あはは",
      "kind": "笑声",
      "durationMs": 852
    },
    {
      "voice": "/voice/produce_events/301700202/3017002020140",
      "text": "あはは",
      "zh": "（笑声）あはは",
      "kind": "笑声",
      "durationMs": 980
    },
    {
      "voice": "/voice/game_event_communications/400104204/4001042040010",
      "text": "あははっ",
      "zh": "（笑声）あははっ",
      "kind": "笑声",
      "durationMs": 904
    },
    {
      "voice": "/voice/produce_events/201700511/2017005110190",
      "text": "あはは～",
      "zh": "（笑声）あはは～",
      "kind": "笑声",
      "durationMs": 832
    },
    {
      "voice": "/voice/produce_events/201701001/2017010010180",
      "text": "あはは～",
      "zh": "（笑声）あはは～",
      "kind": "笑声",
      "durationMs": 788
    },
    {
      "voice": "/voice/game_event_communications/400107208/4001072080200",
      "text": "むー",
      "zh": "（叹气）むー",
      "kind": "叹气",
      "durationMs": 1022
    },
    {
      "voice": "/voice/produce_events/201701204/2017012040100",
      "text": "むー",
      "zh": "（叹气）むー",
      "kind": "叹气",
      "durationMs": 1229
    },
    {
      "voice": "/voice/produce_events/301701901/3017019010560",
      "text": "むー",
      "zh": "（叹气）むー",
      "kind": "叹气",
      "durationMs": 858
    }
  ],
  "hinana": [
    {
      "voice": "/voice/game_event_communications/400102603/4001026030210",
      "text": "あは～",
      "zh": "（笑声）あは～",
      "kind": "笑声",
      "durationMs": 1088
    },
    {
      "voice": "/voice/game_event_communications/400102608/4001026080570",
      "text": "あは～",
      "zh": "（笑声）あは～",
      "kind": "笑声",
      "durationMs": 1173
    },
    {
      "voice": "/voice/game_event_communications/400103206/4001032060780",
      "text": "あは～",
      "zh": "（笑声）あは～",
      "kind": "笑声",
      "durationMs": 1535
    },
    {
      "voice": "/voice/game_event_communications/400103208/4001032080590",
      "text": "あは～",
      "zh": "（笑声）あは～",
      "kind": "笑声",
      "durationMs": 1449
    },
    {
      "voice": "/voice/game_event_communications/400103208/4001032080640",
      "text": "あは～",
      "zh": "（笑声）あは～",
      "kind": "笑声",
      "durationMs": 1407
    },
    {
      "voice": "/voice/produce_events/202301502/2023015020060",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1113
    },
    {
      "voice": "/voice/produce_events/102300404/1023004040180",
      "text": "はぁ～……",
      "zh": "（叹气）はぁ～……",
      "kind": "叹气",
      "durationMs": 1647
    },
    {
      "voice": "/voice/game_event_communications/400104907/4001049070180",
      "text": "ふぅ～！",
      "zh": "（叹气）ふぅ～！",
      "kind": "叹气",
      "durationMs": 1461
    }
  ],
  "madoka": [
    {
      "voice": "/voice/produce_events/102100102/1021001020050",
      "text": "……ふふっ",
      "zh": "（笑声）……ふふっ",
      "kind": "笑声",
      "durationMs": 683
    },
    {
      "voice": "/voice/produce_events/102100102/1021001020300",
      "text": "ふふっ……",
      "zh": "（笑声）ふふっ……",
      "kind": "笑声",
      "durationMs": 875
    },
    {
      "voice": "/voice/produce_events/602100107/6021001070080",
      "text": "ふふっ……",
      "zh": "（笑声）ふふっ……",
      "kind": "笑声",
      "durationMs": 853
    },
    {
      "voice": "/voice/produce_events/602100109/6021001090020",
      "text": "ふふっ……",
      "zh": "（笑声）ふふっ……",
      "kind": "笑声",
      "durationMs": 533
    },
    {
      "voice": "/voice/produce_events/302100701/3021007010260",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 1150
    },
    {
      "voice": "/voice/produce_events/702100107/7021001070010",
      "text": "あーあ",
      "zh": "（叹气）あーあ",
      "kind": "叹气",
      "durationMs": 1045
    },
    {
      "voice": "/voice/game_event_communications/400102607/4001026071060",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 896
    },
    {
      "voice": "/voice/produce_communication_cheers/402100100012/4021001000120010",
      "text": "……ふぅ",
      "zh": "（叹气）……ふぅ",
      "kind": "叹气",
      "durationMs": 1195
    }
  ],
  "toru": [
    {
      "voice": "/voice/produce_communications/102000100061/1020001000610060",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 981
    },
    {
      "voice": "/voice/game_event_communications/400101109/4001011090170",
      "text": "あはは",
      "zh": "（笑声）あはは",
      "kind": "笑声",
      "durationMs": 1152
    },
    {
      "voice": "/voice/game_event_communications/400102602/4001026021030",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 1088
    },
    {
      "voice": "/voice/game_event_communications/400102603/4001026030520",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 1259
    },
    {
      "voice": "/voice/game_event_communications/400102605/4001026050100",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 725
    },
    {
      "voice": "/voice/produce_events/500600202/5006002020530",
      "text": "ふう",
      "zh": "（叹气）ふう",
      "kind": "叹气",
      "durationMs": 852
    },
    {
      "voice": "/voice/game_event_communications/400102606/4001026060470",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1344
    },
    {
      "voice": "/voice/game_event_communications/400103204/4001032040730",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1321
    }
  ],
  "amana": [
    {
      "voice": "/voice/produce_events/201401301/2014013010250",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 997
    },
    {
      "voice": "/voice/produce_events/201401411/2014014110030",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 1299
    },
    {
      "voice": "/voice/produce_events/301400303/3014003030440",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 1658
    },
    {
      "voice": "/voice/produce_events/301400902/3014009020420",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 789
    },
    {
      "voice": "/voice/produce_events/301401002/3014010020290",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 1131
    },
    {
      "voice": "/voice/produce_events/201401011/2014010110010",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1664
    },
    {
      "voice": "/voice/produce_events/201401204/2014012040150",
      "text": "ふぅ……",
      "zh": "（叹气）ふぅ……",
      "kind": "叹气",
      "durationMs": 1215
    },
    {
      "voice": "/voice/produce_events/301400303/3014003030300",
      "text": "ふぅ……",
      "zh": "（叹气）ふぅ……",
      "kind": "叹气",
      "durationMs": 1146
    }
  ],
  "tenka": [
    {
      "voice": "/voice/game_event_communications/400100405/4001004050070",
      "text": "へへ……",
      "zh": "（笑声）へへ……",
      "kind": "笑声",
      "durationMs": 1236
    },
    {
      "voice": "/voice/game_event_communications/400100404/4001004040530",
      "text": "にへへ……",
      "zh": "（笑声）にへへ……",
      "kind": "笑声",
      "durationMs": 1577
    },
    {
      "voice": "/voice/game_event_communications/400100505/4001005050190",
      "text": "にへへ……",
      "zh": "（笑声）にへへ……",
      "kind": "笑声",
      "durationMs": 1449
    },
    {
      "voice": "/voice/game_event_communications/400101208/4001012081120",
      "text": "にへへ……",
      "zh": "（笑声）にへへ……",
      "kind": "笑声",
      "durationMs": 1236
    },
    {
      "voice": "/voice/game_event_communications/400102204/4001022040490",
      "text": "……にへへ",
      "zh": "（笑声）……にへへ",
      "kind": "笑声",
      "durationMs": 1045
    },
    {
      "voice": "/voice/game_event_communications/400106503/4001065030520",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1461
    },
    {
      "voice": "/voice/produce_events/101500102/1015001020030",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1573
    },
    {
      "voice": "/voice/produce_events/201501111/2015011110040",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1365
    }
  ],
  "chiyuki": [
    {
      "voice": "/voice/game_event_communications/400100802/4001008020390",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1065
    },
    {
      "voice": "/voice/game_event_communications/400101506/4001015060600",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 896
    },
    {
      "voice": "/voice/game_event_communications/400101202/4001012020500",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 1193
    },
    {
      "voice": "/voice/game_event_communications/400103708/4001037080770",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 1108
    },
    {
      "voice": "/voice/game_event_communications/400105608/4001056080400",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 1043
    },
    {
      "voice": "/voice/game_event_communications/400102704/4001027040630",
      "text": "ふぅ……",
      "zh": "（叹气）ふぅ……",
      "kind": "叹气",
      "durationMs": 1449
    },
    {
      "voice": "/voice/produce_events/201601202/2016012020040",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1001
    },
    {
      "voice": "/voice/produce_events/301402202/3014022020090",
      "text": "ふぅ……",
      "zh": "（叹气）ふぅ……",
      "kind": "叹气",
      "durationMs": 1206
    }
  ],
  "kogane": [
    {
      "voice": "/voice/produce_events/300601901/3006019010620",
      "text": "ふふー",
      "zh": "（笑声）ふふー",
      "kind": "笑声",
      "durationMs": 1392
    },
    {
      "voice": "/voice/game_event_communications/400100205/4001002050010",
      "text": "んふふ～",
      "zh": "（笑声）んふふ～",
      "kind": "笑声",
      "durationMs": 1485
    },
    {
      "voice": "/voice/game_event_communications/400103905/4001039050280",
      "text": "んふふ～",
      "zh": "（笑声）んふふ～",
      "kind": "笑声",
      "durationMs": 1321
    },
    {
      "voice": "/voice/game_event_communications/400104106/4001041060140",
      "text": "んふふ～",
      "zh": "（笑声）んふふ～",
      "kind": "笑声",
      "durationMs": 1001
    },
    {
      "voice": "/voice/game_event_communications/400108901/4001089010290",
      "text": "んふふ～",
      "zh": "（笑声）んふふ～",
      "kind": "笑声",
      "durationMs": 1554
    },
    {
      "voice": "/voice/produce_events/100400104/1004001040020",
      "text": "……はぁ",
      "zh": "（叹气）……はぁ",
      "kind": "叹气",
      "durationMs": 1573
    },
    {
      "voice": "/voice/produce_events/200400501/2004005010150",
      "text": "うぅ……",
      "zh": "（叹气）うぅ……",
      "kind": "叹气",
      "durationMs": 1236
    },
    {
      "voice": "/voice/produce_events/200401904/2004019040100",
      "text": "ふぅ……",
      "zh": "（叹气）ふぅ……",
      "kind": "叹气",
      "durationMs": 765
    }
  ],
  "mamimi": [
    {
      "voice": "/voice/game_event_communications/400101504/4001015040720",
      "text": "ふふー",
      "zh": "（笑声）ふふー",
      "kind": "笑声",
      "durationMs": 1536
    },
    {
      "voice": "/voice/game_event_communications/400102705/4001027051680",
      "text": "ふふー",
      "zh": "（笑声）ふふー",
      "kind": "笑声",
      "durationMs": 1620
    },
    {
      "voice": "/voice/game_event_communications/400103905/4001039051280",
      "text": "ふふー",
      "zh": "（笑声）ふふー",
      "kind": "笑声",
      "durationMs": 1599
    },
    {
      "voice": "/voice/game_event_communications/400104106/4001041060010",
      "text": "ふふー",
      "zh": "（笑声）ふふー",
      "kind": "笑声",
      "durationMs": 1769
    },
    {
      "voice": "/voice/game_event_communications/400105303/4001053030170",
      "text": "ふふー",
      "zh": "（笑声）ふふー",
      "kind": "笑声",
      "durationMs": 1485
    },
    {
      "voice": "/voice/produce_events/300500801/3005008010130",
      "text": "はぁ",
      "zh": "（叹气）はぁ",
      "kind": "叹气",
      "durationMs": 1259
    },
    {
      "voice": "/voice/produce_events/300701702/3007017020070",
      "text": "はぁ",
      "zh": "（叹气）はぁ",
      "kind": "叹气",
      "durationMs": 1020
    },
    {
      "voice": "/voice/game_event_communications/400101005/4001010050030",
      "text": "はぁい",
      "zh": "（叹气）はぁい",
      "kind": "叹气",
      "durationMs": 1151
    }
  ],
  "yuika": [
    {
      "voice": "/voice/game_event_communications/400101604/4001016040200",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 834
    },
    {
      "voice": "/voice/produce_events/300700502/3007005020300",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1090
    },
    {
      "voice": "/voice/produce_events/100700301/1007003010120",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 718
    },
    {
      "voice": "/voice/produce_events/100700305/1007003050260",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 811
    },
    {
      "voice": "/voice/produce_events/100700503/1007005030120",
      "text": "あはは",
      "zh": "（笑声）あはは",
      "kind": "笑声",
      "durationMs": 811
    },
    {
      "voice": "/voice/produce_events/100700406/1007004060200",
      "text": "あーあ",
      "zh": "（叹气）あーあ",
      "kind": "叹气",
      "durationMs": 1067
    },
    {
      "voice": "/voice/game_event_communications/400100702/4001007020660",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1136
    },
    {
      "voice": "/voice/produce_events/300700701/3007007010770",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1299
    }
  ],
  "kiriko": [
    {
      "voice": "/voice/produce_events/300501703/3005017030380",
      "text": "ふふふ",
      "zh": "（笑声）ふふふ",
      "kind": "笑声",
      "durationMs": 1118
    },
    {
      "voice": "/voice/game_event_communications/400100602/4001006020220",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 937
    },
    {
      "voice": "/voice/game_event_communications/400101007/4001010070040",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 1151
    },
    {
      "voice": "/voice/game_event_communications/400101505/4001015050460",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 981
    },
    {
      "voice": "/voice/game_event_communications/400101603/4001016030620",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 875
    },
    {
      "voice": "/voice/produce_events/200801402/2008014020040",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1322
    },
    {
      "voice": "/voice/produce_events/300800401/3008004010270",
      "text": "ふぅ……",
      "zh": "（叹气）ふぅ……",
      "kind": "叹气",
      "durationMs": 1065
    },
    {
      "voice": "/voice/produce_events/200800404/2008004040060",
      "text": "──はぁ……",
      "zh": "（叹气）──はぁ……",
      "kind": "叹气",
      "durationMs": 1620
    }
  ],
  "sakuya": [
    {
      "voice": "/voice/produce_events/300601901/3006019010070",
      "text": "ふふー",
      "zh": "（笑声）ふふー",
      "kind": "笑声",
      "durationMs": 1299
    },
    {
      "voice": "/voice/produce_events/300601901/3006019010630",
      "text": "ふふー",
      "zh": "（笑声）ふふー",
      "kind": "笑声",
      "durationMs": 858
    },
    {
      "voice": "/voice/produce_events/100600501/1006005010160",
      "text": "えへへ……！",
      "zh": "（笑声）えへへ……！",
      "kind": "笑声",
      "durationMs": 1369
    },
    {
      "voice": "/voice/produce_events/200601002/2006010020310",
      "text": "…………ふふ",
      "zh": "（笑声）…………ふふ",
      "kind": "笑声",
      "durationMs": 917
    },
    {
      "voice": "/voice/produce_events/300602801/3006028010470",
      "text": "ふぅ……",
      "zh": "（叹气）ふぅ……",
      "kind": "叹气",
      "durationMs": 1090
    },
    {
      "voice": "/voice/produce_events/600600101/6006001010010",
      "text": "ふぅー……",
      "zh": "（叹气）ふぅー……",
      "kind": "叹气",
      "durationMs": 1743
    },
    {
      "voice": "/voice/produce_events/500200201/5002002010300",
      "text": "ふう…………",
      "zh": "（叹气）ふう…………",
      "kind": "叹气",
      "durationMs": 852
    },
    {
      "voice": "/voice/produce_events/600600202/6006002020050",
      "text": "……はぁ……",
      "zh": "（叹气）……はぁ……",
      "kind": "叹气",
      "durationMs": 937
    }
  ],
  "kaho": [
    {
      "voice": "/voice/game_event_communications/400100308/4001003080240",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 1151
    },
    {
      "voice": "/voice/game_event_communications/400100308/4001003080460",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 1151
    },
    {
      "voice": "/voice/produce_events/200902203/2009022030140",
      "text": "えへへ",
      "zh": "（笑声）えへへ",
      "kind": "笑声",
      "durationMs": 1415
    },
    {
      "voice": "/voice/game_event_communications/400102802/4001028020310",
      "text": "えへへっ",
      "zh": "（笑声）えへへっ",
      "kind": "笑声",
      "durationMs": 1087
    },
    {
      "voice": "/voice/game_event_communications/400102804/4001028041000",
      "text": "えへへっ",
      "zh": "（笑声）えへへっ",
      "kind": "笑声",
      "durationMs": 959
    },
    {
      "voice": "/voice/produce_events/200902102/2009021020090",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1647
    },
    {
      "voice": "/voice/produce_events/300900502/3009005020320",
      "text": "……ぶはぁ！",
      "zh": "（叹气）……ぶはぁ！",
      "kind": "叹气",
      "durationMs": 809
    },
    {
      "voice": "/voice/game_event_communications/400106206/4001062060120",
      "text": "……うぅ…………",
      "zh": "（叹气）……うぅ…………",
      "kind": "叹气",
      "durationMs": 1554
    }
  ],
  "chiyoko": [
    {
      "voice": "/voice/produce_events/201001411/2010014110090",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 904
    },
    {
      "voice": "/voice/produce_events/201000811/2010008110210",
      "text": "あははっ",
      "zh": "（笑声）あははっ",
      "kind": "笑声",
      "durationMs": 1216
    },
    {
      "voice": "/voice/produce_events/301001002/3010010020310",
      "text": "あははっ",
      "zh": "（笑声）あははっ",
      "kind": "笑声",
      "durationMs": 1195
    },
    {
      "voice": "/voice/produce_events/301001401/3010014010350",
      "text": "あははっ",
      "zh": "（笑声）あははっ",
      "kind": "笑声",
      "durationMs": 1206
    },
    {
      "voice": "/voice/produce_events/101000304/1010003040420",
      "text": "……えへへ",
      "zh": "（笑声）……えへへ",
      "kind": "笑声",
      "durationMs": 1216
    },
    {
      "voice": "/voice/game_event_communications/400106204/4001062040420",
      "text": "ううっ……！",
      "zh": "（叹气）ううっ……！",
      "kind": "叹气",
      "durationMs": 830
    },
    {
      "voice": "/voice/produce_events/201001011/2010010110100",
      "text": "あっ",
      "zh": "（惊讶）あっ",
      "kind": "惊讶",
      "durationMs": 404
    },
    {
      "voice": "/voice/game_event_communications/400100501/4001005010270",
      "text": "はっ！",
      "zh": "（惊讶）はっ！",
      "kind": "惊讶",
      "durationMs": 468
    }
  ],
  "juri": [
    {
      "voice": "/voice/produce_events/301000601/3010006010580",
      "text": "……ふふ",
      "zh": "（笑声）……ふふ",
      "kind": "笑声",
      "durationMs": 788
    },
    {
      "voice": "/voice/produce_events/301101403/3011014030150",
      "text": "あははっ",
      "zh": "（笑声）あははっ",
      "kind": "笑声",
      "durationMs": 1647
    },
    {
      "voice": "/voice/produce_events/301101403/3011014030640",
      "text": "あははっ",
      "zh": "（笑声）あははっ",
      "kind": "笑声",
      "durationMs": 1136
    },
    {
      "voice": "/voice/game_event_communications/400102105/4001021050370",
      "text": "……あはは",
      "zh": "（笑声）……あはは",
      "kind": "笑声",
      "durationMs": 1749
    },
    {
      "voice": "/voice/produce_events/201100411/2011004110240",
      "text": "……っふふ",
      "zh": "（笑声）……っふふ",
      "kind": "笑声",
      "durationMs": 1449
    },
    {
      "voice": "/voice/produce_events/201100502/2011005020010",
      "text": "ふぅ……",
      "zh": "（叹气）ふぅ……",
      "kind": "叹气",
      "durationMs": 1065
    },
    {
      "voice": "/voice/produce_events/301200801/3012008010030",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1792
    },
    {
      "voice": "/voice/produce_events/301701702/3017017020020",
      "text": "……ふぅ",
      "zh": "（叹气）……ふぅ",
      "kind": "叹气",
      "durationMs": 1113
    }
  ],
  "rinze": [
    {
      "voice": "/voice/produce_events/301201003/3012010030910",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 447
    },
    {
      "voice": "/voice/game_event_communications/400100502/4001005020640",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 553
    },
    {
      "voice": "/voice/game_event_communications/400100504/4001005040270",
      "text": "……ふふ",
      "zh": "（笑声）……ふふ",
      "kind": "笑声",
      "durationMs": 468
    },
    {
      "voice": "/voice/game_event_communications/400100801/4001008010690",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 553
    },
    {
      "voice": "/voice/game_event_communications/400101707/4001017070160",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 576
    },
    {
      "voice": "/voice/game_event_communications/400103108/4001031080240",
      "text": "──はぁー……",
      "zh": "（叹气）──はぁー……",
      "kind": "叹气",
      "durationMs": 1172
    },
    {
      "voice": "/voice/produce_events/301202101/3012021010510",
      "text": "えっ……",
      "zh": "（惊讶）えっ……",
      "kind": "惊讶",
      "durationMs": 509
    },
    {
      "voice": "/voice/produce_events/201200903/2012009030320",
      "text": "きゃ……！",
      "zh": "（惊讶）きゃ……！",
      "kind": "惊讶",
      "durationMs": 640
    }
  ],
  "natsuha": [
    {
      "voice": "/voice/produce_events/201301803/2013018030190",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1090
    },
    {
      "voice": "/voice/game_event_communications/400106204/4001062040370",
      "text": "うふふ",
      "zh": "（笑声）うふふ",
      "kind": "笑声",
      "durationMs": 1054
    },
    {
      "voice": "/voice/produce_events/201300404/2013004040060",
      "text": "うふふ",
      "zh": "（笑声）うふふ",
      "kind": "笑声",
      "durationMs": 1065
    },
    {
      "voice": "/voice/produce_events/300901002/3009010020060",
      "text": "うふふ",
      "zh": "（笑声）うふふ",
      "kind": "笑声",
      "durationMs": 1237
    },
    {
      "voice": "/voice/produce_events/300901602/3009016020420",
      "text": "うふふ",
      "zh": "（笑声）うふふ",
      "kind": "笑声",
      "durationMs": 1043
    },
    {
      "voice": "/voice/produce_events/601300102/6013001020040",
      "text": "ふぅ……",
      "zh": "（叹气）ふぅ……",
      "kind": "叹气",
      "durationMs": 1103
    },
    {
      "voice": "/voice/produce_events/101300403/1013004030070",
      "text": "────ふぅ……",
      "zh": "（叹气）────ふぅ……",
      "kind": "叹气",
      "durationMs": 831
    },
    {
      "voice": "/voice/produce_events/201301402/2013014020010",
      "text": "んー……っ",
      "zh": "（叹气）んー……っ",
      "kind": "叹气",
      "durationMs": 1345
    }
  ],
  "nichika": [
    {
      "voice": "/voice/produce_events/202401511/2024015110070",
      "text": "あははっ",
      "zh": "（笑声）あははっ",
      "kind": "笑声",
      "durationMs": 1136
    },
    {
      "voice": "/voice/produce_events/302401701/3024017010030",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 1160
    },
    {
      "voice": "/voice/produce_communication_auditions/502400100022/5024001000220010",
      "text": "あははっ……",
      "zh": "（笑声）あははっ……",
      "kind": "笑声",
      "durationMs": 980
    },
    {
      "voice": "/voice/game_event_communications/400108507/4001085070120",
      "text": "あはははっ……",
      "zh": "（笑声）あはははっ……",
      "kind": "笑声",
      "durationMs": 1276
    },
    {
      "voice": "/voice/game_event_communications/400108507/4001085070260",
      "text": "あはははっ……",
      "zh": "（笑声）あはははっ……",
      "kind": "笑声",
      "durationMs": 1461
    },
    {
      "voice": "/voice/game_event_communications/400107503/4001075030050",
      "text": "……はぁ",
      "zh": "（叹气）……はぁ",
      "kind": "叹气",
      "durationMs": 1345
    },
    {
      "voice": "/voice/produce_events/302400803/3024008030130",
      "text": "……ふぅ",
      "zh": "（叹气）……ふぅ",
      "kind": "叹气",
      "durationMs": 1392
    },
    {
      "voice": "/voice/produce_events/302400402/3024004020020",
      "text": "はぁー……",
      "zh": "（叹气）はぁー……",
      "kind": "叹气",
      "durationMs": 1492
    }
  ],
  "mikoto": [
    {
      "voice": "/voice/game_event_communications/400103803/4001038030670",
      "text": "────ふふ",
      "zh": "（笑声）────ふふ",
      "kind": "笑声",
      "durationMs": 468
    },
    {
      "voice": "/voice/produce_events/202500502/2025005020180",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 997
    },
    {
      "voice": "/voice/produce_events/302500601/3025006010010",
      "text": "──はぁ……！",
      "zh": "（叹气）──はぁ……！",
      "kind": "叹气",
      "durationMs": 951
    },
    {
      "voice": "/voice/produce_events/302500602/3025006020010",
      "text": "──はぁ……！",
      "zh": "（叹气）──はぁ……！",
      "kind": "叹气",
      "durationMs": 904
    },
    {
      "voice": "/voice/game_event_communications/400103805/4001038050640",
      "text": "────ふぅ……",
      "zh": "（叹气）────ふぅ……",
      "kind": "叹气",
      "durationMs": 617
    },
    {
      "voice": "/voice/produce_events/302400201/3024002010530",
      "text": "──────ふぅ",
      "zh": "（叹气）──────ふぅ",
      "kind": "叹气",
      "durationMs": 745
    },
    {
      "voice": "/voice/produce_events/102500401/1025004010120",
      "text": "えっ？",
      "zh": "（惊讶）えっ？",
      "kind": "惊讶",
      "durationMs": 788
    },
    {
      "voice": "/voice/game_event_communications/400105808/4001058080850",
      "text": "終わったから",
      "zh": "（惊讶）終わったから",
      "kind": "惊讶",
      "durationMs": 858
    }
  ],
  "luca": [
    {
      "voice": "/voice/game_event_communications/400105806/4001058060480",
      "text": "あははっ！",
      "zh": "（笑声）あははっ！",
      "kind": "笑声",
      "durationMs": 1136
    },
    {
      "voice": "/voice/game_event_communications/400105807/4001058070770",
      "text": "……ふふっ",
      "zh": "（笑声）……ふふっ",
      "kind": "笑声",
      "durationMs": 811
    },
    {
      "voice": "/voice/produce_events/302601102/3026011020140",
      "text": "えへへ……！",
      "zh": "（笑声）えへへ……！",
      "kind": "笑声",
      "durationMs": 1276
    },
    {
      "voice": "/voice/game_event_communications/400105807/4001058070560",
      "text": "あははっ",
      "zh": "（笑声）あははっ",
      "kind": "笑声",
      "durationMs": 1415
    },
    {
      "voice": "/voice/game_event_communications/400105806/4001058060040",
      "text": "ふふふっ……",
      "zh": "（笑声）ふふふっ……",
      "kind": "笑声",
      "durationMs": 1531
    },
    {
      "voice": "/voice/special_communications/490170052/4901700520090",
      "text": "はぁ？",
      "zh": "（叹气）はぁ？",
      "kind": "叹气",
      "durationMs": 951
    },
    {
      "voice": "/voice/produce_events/202601002/2026010020160",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1624
    },
    {
      "voice": "/voice/produce_events/202601101/2026011010200",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1485
    }
  ],
  "hana": [
    {
      "voice": "/voice/produce_events/102700102/1027001020090",
      "text": "──あはっ",
      "zh": "（笑声）──あはっ",
      "kind": "笑声",
      "durationMs": 1578
    },
    {
      "voice": "/voice/produce_events/202700301/2027003010190",
      "text": "──あはっ",
      "zh": "（笑声）──あはっ",
      "kind": "笑声",
      "durationMs": 1276
    },
    {
      "voice": "/voice/produce_events/202700604/2027006040130",
      "text": "……あはっ",
      "zh": "（笑声）……あはっ",
      "kind": "笑声",
      "durationMs": 997
    },
    {
      "voice": "/voice/produce_events/302701101/3027011010500",
      "text": "……あはっ",
      "zh": "（笑声）……あはっ",
      "kind": "笑声",
      "durationMs": 417
    },
    {
      "voice": "/voice/produce_events/602700403/6027004030030",
      "text": "……ふふっ",
      "zh": "（笑声）……ふふっ",
      "kind": "笑声",
      "durationMs": 974
    },
    {
      "voice": "/voice/produce_events/102700404/1027004040010",
      "text": "はぁ…………",
      "zh": "（叹气）はぁ…………",
      "kind": "叹气",
      "durationMs": 1763
    },
    {
      "voice": "/voice/produce_events/102700501/1027005010060",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1670
    },
    {
      "voice": "/voice/produce_events/102700404/1027004040070",
      "text": "……はぁ…………",
      "zh": "（叹气）……はぁ…………",
      "kind": "叹气",
      "durationMs": 1740
    }
  ],
  "haruki": [
    {
      "voice": "/voice/produce_events/102800101/1028001010070",
      "text": "ふふ～",
      "zh": "（笑声）ふふ～",
      "kind": "笑声",
      "durationMs": 1578
    },
    {
      "voice": "/voice/produce_events/102800104/1028001040330",
      "text": "ふふ～",
      "zh": "（笑声）ふふ～",
      "kind": "笑声",
      "durationMs": 1508
    },
    {
      "voice": "/voice/produce_events/302800702/3028007020440",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 1299
    },
    {
      "voice": "/voice/produce_events/702800107/7028001070060",
      "text": "ふふ～",
      "zh": "（笑声）ふふ～",
      "kind": "笑声",
      "durationMs": 1601
    },
    {
      "voice": "/voice/produce_events/202800511/2028005110050",
      "text": "──ふふ",
      "zh": "（笑声）──ふふ",
      "kind": "笑声",
      "durationMs": 1578
    },
    {
      "voice": "/voice/produce_events/102800502/1028005020010",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 1020
    },
    {
      "voice": "/voice/produce_events/202800401/2028004010270",
      "text": "んー……",
      "zh": "（叹气）んー……",
      "kind": "叹气",
      "durationMs": 1322
    },
    {
      "voice": "/voice/produce_communications/102800100041/1028001000410070",
      "text": "ふぅん……？",
      "zh": "（叹气）ふぅん……？",
      "kind": "叹气",
      "durationMs": 1136
    }
  ],
  "fuyuko": [
    {
      "voice": "/voice/game_event_communications/400101506/4001015060480",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 960
    },
    {
      "voice": "/voice/game_event_communications/400108305/4001083050570",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 1276
    },
    {
      "voice": "/voice/produce_events/201801802/2018018020360",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 1136
    },
    {
      "voice": "/voice/game_event_communications/400103301/4001033010080",
      "text": "ふふ……",
      "zh": "（笑声）ふふ……",
      "kind": "笑声",
      "durationMs": 639
    },
    {
      "voice": "/voice/produce_events/201800311/2018003110180",
      "text": "……ふふ",
      "zh": "（笑声）……ふふ",
      "kind": "笑声",
      "durationMs": 937
    },
    {
      "voice": "/voice/game_event_communications/400102706/4001027061090",
      "text": "──はぁ",
      "zh": "（叹气）──はぁ",
      "kind": "叹气",
      "durationMs": 596
    },
    {
      "voice": "/voice/game_event_communications/400103304/4001033040120",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 447
    },
    {
      "voice": "/voice/game_event_communications/400103304/4001033040400",
      "text": "はぁ……",
      "zh": "（叹气）はぁ……",
      "kind": "叹气",
      "durationMs": 959
    }
  ],
  "hazuki": [
    {
      "voice": "/voice/produce_events/309100501/3091005010090",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1206
    },
    {
      "voice": "/voice/game_event_communications/400103104/4001031040040",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 660
    },
    {
      "voice": "/voice/produce_events/309100401/3091004010090",
      "text": "……ふふっ",
      "zh": "（笑声）……ふふっ",
      "kind": "笑声",
      "durationMs": 1369
    },
    {
      "voice": "/voice/produce_events/309100501/3091005010170",
      "text": "ふふ",
      "zh": "（笑声）ふふ",
      "kind": "笑声",
      "durationMs": 1252
    },
    {
      "voice": "/voice/game_event_communications/400103104/4001031040120",
      "text": "ふふっ",
      "zh": "（笑声）ふふっ",
      "kind": "笑声",
      "durationMs": 575
    },
    {
      "voice": "/voice/game_event_communications/400103101/4001031010950",
      "text": "はぁ…………",
      "zh": "（叹气）はぁ…………",
      "kind": "叹气",
      "durationMs": 1513
    },
    {
      "voice": "/voice/produce_events/202401403/2024014030190",
      "text": "はあ～…………",
      "zh": "（叹气）はあ～…………",
      "kind": "叹气",
      "durationMs": 1647
    },
    {
      "voice": "/voice/produce_events/309100601/3091006010260",
      "text": "えっ",
      "zh": "（惊讶）えっ",
      "kind": "惊讶",
      "durationMs": 626
    }
  ]
};
  const refWavMap = {
  "mano": {
    "default": [
      "/ref-wav/mano/neutral/clip_01_1001001030180.wav",
      "/ref-wav/mano/neutral/clip_02_3001021030310.wav",
      "/ref-wav/mano/neutral/clip_03_4001087020130.wav"
    ],
    "neutral": [
      "/ref-wav/mano/neutral/clip_01_1001001030180.wav",
      "/ref-wav/mano/neutral/clip_02_3001021030310.wav",
      "/ref-wav/mano/neutral/clip_03_4001087020130.wav"
    ],
    "happy": [
      "/ref-wav/mano/happy/clip_01_1001001050330.wav",
      "/ref-wav/mano/happy/clip_02_1001001050270.wav",
      "/ref-wav/mano/happy/clip_03_2001008010100.wav"
    ],
    "sad": [
      "/ref-wav/mano/sad/clip_01_4001006050070.wav",
      "/ref-wav/mano/sad/clip_02_4001009040010.wav",
      "/ref-wav/mano/sad/clip_03_4001025040200.wav"
    ],
    "angry": [
      "/ref-wav/mano/angry/clip_01_3002002010180.wav",
      "/ref-wav/mano/angry/clip_02_2001006010230.wav",
      "/ref-wav/mano/angry/clip_03_4001087050270.wav"
    ],
    "shy": [
      "/ref-wav/mano/shy/clip_01_1001001030220.wav",
      "/ref-wav/mano/shy/clip_02_4001009020280.wav",
      "/ref-wav/mano/shy/clip_03_1001003040180.wav"
    ],
    "surprised": [
      "/ref-wav/mano/surprised/clip_01_7001001010100.wav",
      "/ref-wav/mano/surprised/clip_02_1001001030090.wav",
      "/ref-wav/mano/surprised/clip_03_2001004110030.wav"
    ],
    "serious": [
      "/ref-wav/mano/serious/clip_01_7001001010030.wav",
      "/ref-wav/mano/serious/clip_02_1001001001210060.wav",
      "/ref-wav/mano/serious/clip_03_4001018010340.wav"
    ]
  },
  "hiori": {
    "default": [
      "/ref-wav/hiori/neutral/clip_01_2002014020010.wav",
      "/ref-wav/hiori/neutral/clip_02_4001087060560.wav",
      "/ref-wav/hiori/neutral/clip_03_2002020020280.wav"
    ],
    "neutral": [
      "/ref-wav/hiori/neutral/clip_01_2002014020010.wav",
      "/ref-wav/hiori/neutral/clip_02_4001087060560.wav",
      "/ref-wav/hiori/neutral/clip_03_2002020020280.wav"
    ],
    "happy": [
      "/ref-wav/hiori/happy/clip_01_1002003050080.wav",
      "/ref-wav/hiori/happy/clip_02_2002007040320.wav",
      "/ref-wav/hiori/happy/clip_03_2002007020320.wav"
    ],
    "sad": [
      "/ref-wav/hiori/sad/clip_01_2002009010250.wav",
      "/ref-wav/hiori/sad/clip_02_2002004010210.wav",
      "/ref-wav/hiori/sad/clip_03_5001002030490.wav"
    ],
    "angry": [
      "/ref-wav/hiori/angry/clip_01_3003005020400.wav",
      "/ref-wav/hiori/angry/clip_02_3001007010080.wav",
      "/ref-wav/hiori/angry/clip_03_1002003090100.wav"
    ],
    "shy": [
      "/ref-wav/hiori/shy/clip_01_3001007010160.wav",
      "/ref-wav/hiori/shy/clip_02_2002006020180.wav",
      "/ref-wav/hiori/shy/clip_03_2002009040220.wav"
    ],
    "surprised": [
      "/ref-wav/hiori/surprised/clip_01_3001018020710.wav",
      "/ref-wav/hiori/surprised/clip_02_3002022030160.wav",
      "/ref-wav/hiori/surprised/clip_03_2002006110070.wav"
    ],
    "serious": [
      "/ref-wav/hiori/serious/clip_01_2002005020340.wav",
      "/ref-wav/hiori/serious/clip_02_2002007040260.wav",
      "/ref-wav/hiori/serious/clip_03_3001005010060.wav"
    ]
  },
  "meguru": {
    "default": [
      "/ref-wav/meguru/neutral/clip_01_2003018010070.wav",
      "/ref-wav/meguru/neutral/clip_02_4001018050440.wav",
      "/ref-wav/meguru/neutral/clip_03_3003020010400.wav"
    ],
    "neutral": [
      "/ref-wav/meguru/neutral/clip_01_2003018010070.wav",
      "/ref-wav/meguru/neutral/clip_02_4001018050440.wav",
      "/ref-wav/meguru/neutral/clip_03_3003020010400.wav"
    ],
    "happy": [
      "/ref-wav/meguru/happy/clip_01_3001009020100.wav",
      "/ref-wav/meguru/happy/clip_02_1003001020060.wav",
      "/ref-wav/meguru/happy/clip_03_5001002010080.wav"
    ],
    "sad": [
      "/ref-wav/meguru/sad/clip_01_3003009010520.wav",
      "/ref-wav/meguru/sad/clip_02_4901002040160.wav",
      "/ref-wav/meguru/sad/clip_03_3003011010050.wav"
    ],
    "angry": [
      "/ref-wav/meguru/angry/clip_01_4901002040290.wav",
      "/ref-wav/meguru/angry/clip_02_3002007020790.wav",
      "/ref-wav/meguru/angry/clip_03_4001018060590.wav"
    ],
    "shy": [
      "/ref-wav/meguru/shy/clip_01_4001018050130.wav",
      "/ref-wav/meguru/shy/clip_02_1003005020210.wav",
      "/ref-wav/meguru/shy/clip_03_1003001010140.wav"
    ],
    "surprised": [
      "/ref-wav/meguru/surprised/clip_01_3002017010070.wav",
      "/ref-wav/meguru/surprised/clip_02_4901002040210.wav",
      "/ref-wav/meguru/surprised/clip_03_4901011010060.wav"
    ],
    "serious": [
      "/ref-wav/meguru/serious/clip_01_1003001050230.wav",
      "/ref-wav/meguru/serious/clip_02_1003001040230.wav",
      "/ref-wav/meguru/serious/clip_03_6003002020070.wav"
    ]
  },
  "koito": {
    "default": [
      "/ref-wav/koito/neutral/clip_01_1022004050190.wav",
      "/ref-wav/koito/neutral/clip_02_2022010010180.wav",
      "/ref-wav/koito/neutral/clip_03_2022011020150.wav"
    ],
    "neutral": [
      "/ref-wav/koito/neutral/clip_01_1022004050190.wav",
      "/ref-wav/koito/neutral/clip_02_2022010010180.wav",
      "/ref-wav/koito/neutral/clip_03_2022011020150.wav"
    ],
    "happy": [
      "/ref-wav/koito/happy/clip_01_3020014010150.wav",
      "/ref-wav/koito/happy/clip_02_1022001050250.wav",
      "/ref-wav/koito/happy/clip_03_4902801060070.wav"
    ],
    "sad": [
      "/ref-wav/koito/sad/clip_01_3021002020050.wav",
      "/ref-wav/koito/sad/clip_02_1022004030110.wav",
      "/ref-wav/koito/sad/clip_03_3025009020250.wav"
    ],
    "angry": [
      "/ref-wav/koito/angry/clip_01_4001026030820.wav",
      "/ref-wav/koito/angry/clip_02_2022009040250.wav",
      "/ref-wav/koito/angry/clip_03_3020002020170.wav"
    ],
    "shy": [
      "/ref-wav/koito/shy/clip_01_4902200640040.wav",
      "/ref-wav/koito/shy/clip_02_1022001050260.wav",
      "/ref-wav/koito/shy/clip_03_1022001001510030.wav"
    ],
    "surprised": [
      "/ref-wav/koito/surprised/clip_01_6022001090170.wav",
      "/ref-wav/koito/surprised/clip_02_2022009020020.wav",
      "/ref-wav/koito/surprised/clip_03_4001097020180.wav"
    ],
    "serious": [
      "/ref-wav/koito/serious/clip_01_1022001000710080.wav",
      "/ref-wav/koito/serious/clip_02_1022001050270.wav",
      "/ref-wav/koito/serious/clip_03_4901035880050.wav"
    ]
  },
  "asahi": {
    "default": [
      "/ref-wav/asahi/neutral/clip_01_4001091060460.wav",
      "/ref-wav/asahi/neutral/clip_02_2017018030230.wav",
      "/ref-wav/asahi/neutral/clip_03_4001091080240.wav"
    ],
    "neutral": [
      "/ref-wav/asahi/neutral/clip_01_4001091060460.wav",
      "/ref-wav/asahi/neutral/clip_02_2017018030230.wav",
      "/ref-wav/asahi/neutral/clip_03_4001091080240.wav"
    ],
    "happy": [
      "/ref-wav/asahi/happy/clip_01_4902200510010.wav",
      "/ref-wav/asahi/happy/clip_02_4001019081160.wav",
      "/ref-wav/asahi/happy/clip_03_4001015070580.wav"
    ],
    "sad": [
      "/ref-wav/asahi/sad/clip_01_2017003010130.wav",
      "/ref-wav/asahi/sad/clip_02_3017004020500.wav",
      "/ref-wav/asahi/sad/clip_03_7017001060070.wav"
    ],
    "angry": [
      "/ref-wav/asahi/angry/clip_01_4001015071000.wav",
      "/ref-wav/asahi/angry/clip_02_2017004020070.wav",
      "/ref-wav/asahi/angry/clip_03_4001019041200.wav"
    ],
    "shy": [
      "/ref-wav/asahi/shy/clip_01_3017004020650.wav",
      "/ref-wav/asahi/shy/clip_02_4001019060720.wav",
      "/ref-wav/asahi/shy/clip_03_4001019041280.wav"
    ],
    "surprised": [
      "/ref-wav/asahi/surprised/clip_01_4001015071100.wav",
      "/ref-wav/asahi/surprised/clip_02_1017005030150.wav",
      "/ref-wav/asahi/surprised/clip_03_7017001040040.wav"
    ],
    "serious": [
      "/ref-wav/asahi/serious/clip_01_4001014070450.wav",
      "/ref-wav/asahi/serious/clip_02_4001019060720.wav",
      "/ref-wav/asahi/serious/clip_03_4001019041200.wav"
    ]
  },
  "hinana": {
    "default": [
      "/ref-wav/hinana/neutral/clip_01_4001097030260.wav",
      "/ref-wav/hinana/neutral/clip_02_3023007020330.wav",
      "/ref-wav/hinana/neutral/clip_03_1023001020230.wav"
    ],
    "neutral": [
      "/ref-wav/hinana/neutral/clip_01_4001097030260.wav",
      "/ref-wav/hinana/neutral/clip_02_3023007020330.wav",
      "/ref-wav/hinana/neutral/clip_03_1023001020230.wav"
    ],
    "happy": [
      "/ref-wav/hinana/happy/clip_01_3023011020290.wav",
      "/ref-wav/hinana/happy/clip_02_3023017010210.wav",
      "/ref-wav/hinana/happy/clip_03_1023001050060.wav"
    ],
    "sad": [
      "/ref-wav/hinana/sad/clip_01_3023018020320.wav",
      "/ref-wav/hinana/sad/clip_02_4901600230030.wav",
      "/ref-wav/hinana/sad/clip_03_1023001050060.wav"
    ],
    "angry": [
      "/ref-wav/hinana/angry/clip_01_4901600230030.wav",
      "/ref-wav/hinana/angry/clip_02_3023011020290.wav",
      "/ref-wav/hinana/angry/clip_03_1023001050060.wav"
    ],
    "shy": [
      "/ref-wav/hinana/shy/clip_01_1023001020230.wav",
      "/ref-wav/hinana/shy/clip_02_1023001050060.wav",
      "/ref-wav/hinana/shy/clip_03_3023007020330.wav"
    ],
    "surprised": [
      "/ref-wav/hinana/surprised/clip_01_4001097030260.wav",
      "/ref-wav/hinana/surprised/clip_02_1023001020230.wav",
      "/ref-wav/hinana/surprised/clip_03_3023011020290.wav"
    ],
    "serious": [
      "/ref-wav/hinana/serious/clip_01_3023018020320.wav",
      "/ref-wav/hinana/serious/clip_02_3023007020330.wav",
      "/ref-wav/hinana/serious/clip_03_1023001050060.wav"
    ]
  },
  "madoka": {
    "default": [
      "/ref-wav/madoka/neutral/clip_01_4902500420010.wav",
      "/ref-wav/madoka/neutral/clip_02_2021013030090.wav",
      "/ref-wav/madoka/neutral/clip_03_1021001030080.wav"
    ],
    "neutral": [
      "/ref-wav/madoka/neutral/clip_01_4902500420010.wav",
      "/ref-wav/madoka/neutral/clip_02_2021013030090.wav",
      "/ref-wav/madoka/neutral/clip_03_1021001030080.wav"
    ],
    "happy": [
      "/ref-wav/madoka/happy/clip_01_1021001050080.wav",
      "/ref-wav/madoka/happy/clip_02_4001026040090.wav",
      "/ref-wav/madoka/happy/clip_03_1021005030020.wav"
    ],
    "sad": [
      "/ref-wav/madoka/sad/clip_01_2021015120020.wav",
      "/ref-wav/madoka/sad/clip_02_4001026010370.wav",
      "/ref-wav/madoka/sad/clip_03_3021011020570.wav"
    ],
    "angry": [
      "/ref-wav/madoka/angry/clip_01_1021004050240.wav",
      "/ref-wav/madoka/angry/clip_02_1021001001510080.wav",
      "/ref-wav/madoka/angry/clip_03_3021004020080.wav"
    ],
    "shy": [
      "/ref-wav/madoka/shy/clip_01_7021001020040.wav",
      "/ref-wav/madoka/shy/clip_02_1021004050240.wav",
      "/ref-wav/madoka/shy/clip_03_4001026040090.wav"
    ],
    "surprised": [
      "/ref-wav/madoka/surprised/clip_01_3021004020080.wav",
      "/ref-wav/madoka/surprised/clip_02_1021005030020.wav",
      "/ref-wav/madoka/surprised/clip_03_1021001050080.wav"
    ],
    "serious": [
      "/ref-wav/madoka/serious/clip_01_7021001020040.wav",
      "/ref-wav/madoka/serious/clip_02_4001026010370.wav",
      "/ref-wav/madoka/serious/clip_03_1021001050080.wav"
    ]
  },
  "toru": {
    "default": [
      "/ref-wav/toru/neutral/clip_01_4001083021310.wav",
      "/ref-wav/toru/neutral/clip_02_2020001001110020.wav",
      "/ref-wav/toru/neutral/clip_03_1020001030270.wav"
    ],
    "neutral": [
      "/ref-wav/toru/neutral/clip_01_4001083021310.wav",
      "/ref-wav/toru/neutral/clip_02_2020001001110020.wav",
      "/ref-wav/toru/neutral/clip_03_1020001030270.wav"
    ],
    "happy": [
      "/ref-wav/toru/happy/clip_01_7020001050040.wav",
      "/ref-wav/toru/happy/clip_02_1020001010160.wav",
      "/ref-wav/toru/happy/clip_03_1020001010180.wav"
    ],
    "sad": [
      "/ref-wav/toru/sad/clip_01_1020001000810020.wav",
      "/ref-wav/toru/sad/clip_02_2020008020060.wav",
      "/ref-wav/toru/sad/clip_03_4001055020480.wav"
    ],
    "angry": [
      "/ref-wav/toru/angry/clip_01_2020014110250.wav",
      "/ref-wav/toru/angry/clip_02_3020022020050.wav",
      "/ref-wav/toru/angry/clip_03_1020001000810010.wav"
    ],
    "shy": [
      "/ref-wav/toru/shy/clip_01_1020001020310.wav",
      "/ref-wav/toru/shy/clip_02_4001083060530.wav",
      "/ref-wav/toru/shy/clip_03_3020022020050.wav"
    ],
    "surprised": [
      "/ref-wav/toru/surprised/clip_01_3020022020050.wav",
      "/ref-wav/toru/surprised/clip_02_2020014110250.wav",
      "/ref-wav/toru/surprised/clip_03_7020001050040.wav"
    ],
    "serious": [
      "/ref-wav/toru/serious/clip_01_1020001030270.wav",
      "/ref-wav/toru/serious/clip_02_1020001010180.wav",
      "/ref-wav/toru/serious/clip_03_1020001020310.wav"
    ]
  },
  "amana": {
    "default": [
      "/ref-wav/amana/neutral/clip_01_3014014010290.wav",
      "/ref-wav/amana/neutral/clip_02_2014013010180.wav",
      "/ref-wav/amana/neutral/clip_03_2014022040310.wav"
    ],
    "neutral": [
      "/ref-wav/amana/neutral/clip_01_3014014010290.wav",
      "/ref-wav/amana/neutral/clip_02_2014013010180.wav",
      "/ref-wav/amana/neutral/clip_03_2014022040310.wav"
    ],
    "happy": [
      "/ref-wav/amana/happy/clip_01_6014001070050.wav",
      "/ref-wav/amana/happy/clip_02_4001012010320.wav",
      "/ref-wav/amana/happy/clip_03_3014018010030.wav"
    ],
    "sad": [
      "/ref-wav/amana/sad/clip_01_4001064030240.wav",
      "/ref-wav/amana/sad/clip_02_4001056040070.wav",
      "/ref-wav/amana/sad/clip_03_3009023010110.wav"
    ],
    "angry": [
      "/ref-wav/amana/angry/clip_01_4001077080060.wav",
      "/ref-wav/amana/angry/clip_02_2014009010250.wav",
      "/ref-wav/amana/angry/clip_03_3014009020600.wav"
    ],
    "shy": [
      "/ref-wav/amana/shy/clip_01_4901007560040.wav",
      "/ref-wav/amana/shy/clip_02_3016015020460.wav",
      "/ref-wav/amana/shy/clip_03_3014009020220.wav"
    ],
    "surprised": [
      "/ref-wav/amana/surprised/clip_01_3014025010150.wav",
      "/ref-wav/amana/surprised/clip_02_2014019110180.wav",
      "/ref-wav/amana/surprised/clip_03_3016004020310.wav"
    ],
    "serious": [
      "/ref-wav/amana/serious/clip_01_2014009020180.wav",
      "/ref-wav/amana/serious/clip_02_1014003090030.wav",
      "/ref-wav/amana/serious/clip_03_2014009030310.wav"
    ],
    "e1": [
      "/ref-wav/amana/neutral/clip_01_3014014010290.wav",
      "/ref-wav/amana/neutral/clip_02_2014013010180.wav",
      "/ref-wav/amana/neutral/clip_03_2014022040310.wav"
    ],
    "e2": [
      "/ref-wav/amana/neutral/clip_01_3014014010290.wav",
      "/ref-wav/amana/neutral/clip_02_2014013010180.wav",
      "/ref-wav/amana/neutral/clip_03_2014022040310.wav"
    ]
  },
  "tenka": {
    "default": [
      "/ref-wav/tenka/neutral/clip_01_4001056080080.wav",
      "/ref-wav/tenka/neutral/clip_02_2015005110210.wav",
      "/ref-wav/tenka/neutral/clip_03_4001012040340.wav"
    ],
    "neutral": [
      "/ref-wav/tenka/neutral/clip_01_4001056080080.wav",
      "/ref-wav/tenka/neutral/clip_02_2015005110210.wav",
      "/ref-wav/tenka/neutral/clip_03_4001012040340.wav"
    ],
    "happy": [
      "/ref-wav/tenka/happy/clip_01_2015008010320.wav",
      "/ref-wav/tenka/happy/clip_02_2015007020250.wav",
      "/ref-wav/tenka/happy/clip_03_3016008030360.wav"
    ],
    "sad": [
      "/ref-wav/tenka/sad/clip_01_3016004040130.wav",
      "/ref-wav/tenka/sad/clip_02_2015004030250.wav",
      "/ref-wav/tenka/sad/clip_03_4001015070370.wav"
    ],
    "angry": [
      "/ref-wav/tenka/angry/clip_01_4001065010550.wav",
      "/ref-wav/tenka/angry/clip_02_3014008010070.wav",
      "/ref-wav/tenka/angry/clip_03_2015021110060.wav"
    ],
    "shy": [
      "/ref-wav/tenka/shy/clip_01_2015008110050.wav",
      "/ref-wav/tenka/shy/clip_02_4001015050290.wav",
      "/ref-wav/tenka/shy/clip_03_4001022010180.wav"
    ],
    "surprised": [
      "/ref-wav/tenka/surprised/clip_01_4001008050630.wav",
      "/ref-wav/tenka/surprised/clip_02_2015008110031.wav",
      "/ref-wav/tenka/surprised/clip_03_2015009030220.wav"
    ],
    "serious": [
      "/ref-wav/tenka/serious/clip_01_4001012070410.wav",
      "/ref-wav/tenka/serious/clip_02_4001077030890.wav",
      "/ref-wav/tenka/serious/clip_03_2015008110031.wav"
    ]
  },
  "chiyuki": {
    "default": [
      "/ref-wav/chiyuki/neutral/clip_01_2016008010070.wav",
      "/ref-wav/chiyuki/neutral/clip_02_2016003010070.wav",
      "/ref-wav/chiyuki/neutral/clip_03_1016001050230.wav"
    ],
    "neutral": [
      "/ref-wav/chiyuki/neutral/clip_01_2016008010070.wav",
      "/ref-wav/chiyuki/neutral/clip_02_2016003010070.wav",
      "/ref-wav/chiyuki/neutral/clip_03_1016001050230.wav"
    ],
    "happy": [
      "/ref-wav/chiyuki/happy/clip_01_4001008050690.wav",
      "/ref-wav/chiyuki/happy/clip_02_5004002040310.wav",
      "/ref-wav/chiyuki/happy/clip_03_4001019010870.wav"
    ],
    "sad": [
      "/ref-wav/chiyuki/sad/clip_01_1016001001110070.wav",
      "/ref-wav/chiyuki/sad/clip_02_2016007030270.wav",
      "/ref-wav/chiyuki/sad/clip_03_2016017020030.wav"
    ],
    "angry": [
      "/ref-wav/chiyuki/angry/clip_01_1016001000210010.wav",
      "/ref-wav/chiyuki/angry/clip_02_6016001090280.wav",
      "/ref-wav/chiyuki/angry/clip_03_30004001070120.wav"
    ],
    "shy": [
      "/ref-wav/chiyuki/shy/clip_01_1016001050140.wav",
      "/ref-wav/chiyuki/shy/clip_02_4901009310020.wav",
      "/ref-wav/chiyuki/shy/clip_03_2016009110130.wav"
    ],
    "surprised": [
      "/ref-wav/chiyuki/surprised/clip_01_6016002030020.wav",
      "/ref-wav/chiyuki/surprised/clip_02_1016001000610070.wav",
      "/ref-wav/chiyuki/surprised/clip_03_2016007040300.wav"
    ],
    "serious": [
      "/ref-wav/chiyuki/serious/clip_01_1016001020060.wav",
      "/ref-wav/chiyuki/serious/clip_02_2016007020080.wav",
      "/ref-wav/chiyuki/serious/clip_03_3014009020490.wav"
    ]
  },
  "kogane": {
    "default": [
      "/ref-wav/kogane/neutral/clip_01_4001089060860.wav",
      "/ref-wav/kogane/neutral/clip_02_4001089060760.wav",
      "/ref-wav/kogane/neutral/clip_03_2004017010060.wav"
    ],
    "neutral": [
      "/ref-wav/kogane/neutral/clip_01_4001089060860.wav",
      "/ref-wav/kogane/neutral/clip_02_4001089060760.wav",
      "/ref-wav/kogane/neutral/clip_03_2004017010060.wav"
    ],
    "happy": [
      "/ref-wav/kogane/happy/clip_01_4901011090120.wav",
      "/ref-wav/kogane/happy/clip_02_3004027010190.wav",
      "/ref-wav/kogane/happy/clip_03_3008028020300.wav"
    ],
    "sad": [
      "/ref-wav/kogane/sad/clip_01_4001011010250.wav",
      "/ref-wav/kogane/sad/clip_02_4001089050140.wav",
      "/ref-wav/kogane/sad/clip_03_7004001040010.wav"
    ],
    "angry": [
      "/ref-wav/kogane/angry/clip_01_4001007030580.wav",
      "/ref-wav/kogane/angry/clip_02_2004015040290.wav",
      "/ref-wav/kogane/angry/clip_03_5002006010110.wav"
    ],
    "shy": [
      "/ref-wav/kogane/shy/clip_01_2004006110190.wav",
      "/ref-wav/kogane/shy/clip_02_4001089060950.wav",
      "/ref-wav/kogane/shy/clip_03_2004015040290.wav"
    ],
    "surprised": [
      "/ref-wav/kogane/surprised/clip_01_4901011090120.wav",
      "/ref-wav/kogane/surprised/clip_02_5002006010110.wav",
      "/ref-wav/kogane/surprised/clip_03_2004017010060.wav"
    ],
    "serious": [
      "/ref-wav/kogane/serious/clip_01_4001089060950.wav",
      "/ref-wav/kogane/serious/clip_02_4901011090120.wav",
      "/ref-wav/kogane/serious/clip_03_4001089050140.wav"
    ]
  },
  "mamimi": {
    "default": [
      "/ref-wav/mamimi/neutral/clip_01_3005013020270.wav",
      "/ref-wav/mamimi/neutral/clip_02_2005004110050.wav",
      "/ref-wav/mamimi/neutral/clip_03_4001024030910.wav"
    ],
    "neutral": [
      "/ref-wav/mamimi/neutral/clip_01_3005013020270.wav",
      "/ref-wav/mamimi/neutral/clip_02_2005004110050.wav",
      "/ref-wav/mamimi/neutral/clip_03_4001024030910.wav"
    ],
    "happy": [
      "/ref-wav/mamimi/happy/clip_01_2005008010210.wav",
      "/ref-wav/mamimi/happy/clip_02_3005010030080.wav",
      "/ref-wav/mamimi/happy/clip_03_3005021010500.wav"
    ],
    "sad": [
      "/ref-wav/mamimi/sad/clip_01_3005021010500.wav",
      "/ref-wav/mamimi/sad/clip_02_2005004110050.wav",
      "/ref-wav/mamimi/sad/clip_03_3005013020270.wav"
    ],
    "angry": [
      "/ref-wav/mamimi/angry/clip_01_3005010030080.wav",
      "/ref-wav/mamimi/angry/clip_02_3005021010500.wav",
      "/ref-wav/mamimi/angry/clip_03_3005013020270.wav"
    ],
    "shy": [
      "/ref-wav/mamimi/shy/clip_01_2005004110050.wav",
      "/ref-wav/mamimi/shy/clip_02_3005013020270.wav",
      "/ref-wav/mamimi/shy/clip_03_3005021010500.wav"
    ],
    "surprised": [
      "/ref-wav/mamimi/surprised/clip_01_2005008010210.wav",
      "/ref-wav/mamimi/surprised/clip_02_4001024030910.wav",
      "/ref-wav/mamimi/surprised/clip_03_3005013020270.wav"
    ],
    "serious": [
      "/ref-wav/mamimi/serious/clip_01_2005008010210.wav",
      "/ref-wav/mamimi/serious/clip_02_3005013020270.wav",
      "/ref-wav/mamimi/serious/clip_03_2005004110050.wav"
    ]
  },
  "yuika": {
    "default": [
      "/ref-wav/yuika/neutral/clip_01_2007019110190.wav",
      "/ref-wav/yuika/neutral/clip_02_2007019010230.wav",
      "/ref-wav/yuika/neutral/clip_03_3005018010110.wav"
    ],
    "neutral": [
      "/ref-wav/yuika/neutral/clip_01_2007019110190.wav",
      "/ref-wav/yuika/neutral/clip_02_2007019010230.wav",
      "/ref-wav/yuika/neutral/clip_03_3005018010110.wav"
    ],
    "happy": [
      "/ref-wav/yuika/happy/clip_01_4001095040760.wav",
      "/ref-wav/yuika/happy/clip_02_3005015030470.wav",
      "/ref-wav/yuika/happy/clip_03_3006006010820.wav"
    ],
    "sad": [
      "/ref-wav/yuika/sad/clip_01_2007008110140.wav",
      "/ref-wav/yuika/sad/clip_02_4001008030570.wav",
      "/ref-wav/yuika/sad/clip_03_2007011020130.wav"
    ],
    "angry": [
      "/ref-wav/yuika/angry/clip_01_6007003080100.wav",
      "/ref-wav/yuika/angry/clip_02_3007023010410.wav",
      "/ref-wav/yuika/angry/clip_03_7007001060050.wav"
    ],
    "shy": [
      "/ref-wav/yuika/shy/clip_01_2007004110190.wav",
      "/ref-wav/yuika/shy/clip_02_4901025070080.wav",
      "/ref-wav/yuika/shy/clip_03_4001061070440.wav"
    ],
    "surprised": [
      "/ref-wav/yuika/surprised/clip_01_3007003010190.wav",
      "/ref-wav/yuika/surprised/clip_02_3007003010410.wav",
      "/ref-wav/yuika/surprised/clip_03_1007001000810030.wav"
    ],
    "serious": [
      "/ref-wav/yuika/serious/clip_01_4001010030320.wav",
      "/ref-wav/yuika/serious/clip_02_2007019020070.wav",
      "/ref-wav/yuika/serious/clip_03_2007020110190.wav"
    ]
  },
  "kiriko": {
    "default": [
      "/ref-wav/kiriko/neutral/clip_01_2008007020190.wav",
      "/ref-wav/kiriko/neutral/clip_02_4001024070580.wav",
      "/ref-wav/kiriko/neutral/clip_03_3008022020650.wav"
    ],
    "neutral": [
      "/ref-wav/kiriko/neutral/clip_01_2008007020190.wav",
      "/ref-wav/kiriko/neutral/clip_02_4001024070580.wav",
      "/ref-wav/kiriko/neutral/clip_03_3008022020650.wav"
    ],
    "happy": [
      "/ref-wav/kiriko/happy/clip_01_4001010070690.wav",
      "/ref-wav/kiriko/happy/clip_02_6008001090010.wav",
      "/ref-wav/kiriko/happy/clip_03_1008001020210.wav"
    ],
    "sad": [
      "/ref-wav/kiriko/sad/clip_01_4008001000120020.wav",
      "/ref-wav/kiriko/sad/clip_02_4001010010330.wav",
      "/ref-wav/kiriko/sad/clip_03_3008004020380.wav"
    ],
    "angry": [
      "/ref-wav/kiriko/angry/clip_01_1008001020210.wav",
      "/ref-wav/kiriko/angry/clip_02_3008004020380.wav",
      "/ref-wav/kiriko/angry/clip_03_4001010010330.wav"
    ],
    "shy": [
      "/ref-wav/kiriko/shy/clip_01_1008001020210.wav",
      "/ref-wav/kiriko/shy/clip_02_4001010070690.wav",
      "/ref-wav/kiriko/shy/clip_03_6008001090010.wav"
    ],
    "surprised": [
      "/ref-wav/kiriko/surprised/clip_01_1008001020210.wav",
      "/ref-wav/kiriko/surprised/clip_02_3008004020380.wav",
      "/ref-wav/kiriko/surprised/clip_03_4008001000120020.wav"
    ],
    "serious": [
      "/ref-wav/kiriko/serious/clip_01_4001024070580.wav",
      "/ref-wav/kiriko/serious/clip_02_4001010010330.wav",
      "/ref-wav/kiriko/serious/clip_03_1008001020210.wav"
    ]
  },
  "sakuya": {
    "default": [
      "/ref-wav/sakuya/neutral/clip_01_4001006040480.wav",
      "/ref-wav/sakuya/neutral/clip_02_2006004020320.wav",
      "/ref-wav/sakuya/neutral/clip_03_1006001001210040.wav"
    ],
    "neutral": [
      "/ref-wav/sakuya/neutral/clip_01_4001006040480.wav",
      "/ref-wav/sakuya/neutral/clip_02_2006004020320.wav",
      "/ref-wav/sakuya/neutral/clip_03_1006001001210040.wav"
    ],
    "happy": [
      "/ref-wav/sakuya/happy/clip_01_6006001090200.wav",
      "/ref-wav/sakuya/happy/clip_02_4001010060860.wav",
      "/ref-wav/sakuya/happy/clip_03_7006001050120.wav"
    ],
    "sad": [
      "/ref-wav/sakuya/sad/clip_01_4001098070330.wav",
      "/ref-wav/sakuya/sad/clip_02_4001019080370.wav",
      "/ref-wav/sakuya/sad/clip_03_4001024060110.wav"
    ],
    "angry": [
      "/ref-wav/sakuya/angry/clip_01_7006001060050.wav",
      "/ref-wav/sakuya/angry/clip_02_3007006020030.wav",
      "/ref-wav/sakuya/angry/clip_03_1006001030080.wav"
    ],
    "shy": [
      "/ref-wav/sakuya/shy/clip_01_2006014110060.wav",
      "/ref-wav/sakuya/shy/clip_02_3007016010160.wav",
      "/ref-wav/sakuya/shy/clip_03_2006010020070.wav"
    ],
    "surprised": [
      "/ref-wav/sakuya/surprised/clip_01_2006004010040.wav",
      "/ref-wav/sakuya/surprised/clip_02_1006003030040.wav",
      "/ref-wav/sakuya/surprised/clip_03_2006004040060.wav"
    ],
    "serious": [
      "/ref-wav/sakuya/serious/clip_01_1006001001410070.wav",
      "/ref-wav/sakuya/serious/clip_02_4001024051160.wav",
      "/ref-wav/sakuya/serious/clip_03_1006001040180.wav"
    ]
  },
  "kaho": {
    "default": [
      "/ref-wav/kaho/neutral/clip_01_4001076020740.wav",
      "/ref-wav/kaho/neutral/clip_02_3009008010420.wav",
      "/ref-wav/kaho/neutral/clip_03_3021008010230.wav"
    ],
    "neutral": [
      "/ref-wav/kaho/neutral/clip_01_4001076020740.wav",
      "/ref-wav/kaho/neutral/clip_02_3009008010420.wav",
      "/ref-wav/kaho/neutral/clip_03_3021008010230.wav"
    ],
    "happy": [
      "/ref-wav/kaho/happy/clip_01_2009018010100.wav",
      "/ref-wav/kaho/happy/clip_02_3009025010170.wav",
      "/ref-wav/kaho/happy/clip_03_2009007010320.wav"
    ],
    "sad": [
      "/ref-wav/kaho/sad/clip_01_4001011070090.wav",
      "/ref-wav/kaho/sad/clip_02_3013019030450.wav",
      "/ref-wav/kaho/sad/clip_03_2009007010030.wav"
    ],
    "angry": [
      "/ref-wav/kaho/angry/clip_01_3011017020670.wav",
      "/ref-wav/kaho/angry/clip_02_2009010040090.wav",
      "/ref-wav/kaho/angry/clip_03_30003001061050.wav"
    ],
    "shy": [
      "/ref-wav/kaho/shy/clip_01_4001007050250.wav",
      "/ref-wav/kaho/shy/clip_02_2009004020380.wav",
      "/ref-wav/kaho/shy/clip_03_3021008010230.wav"
    ],
    "surprised": [
      "/ref-wav/kaho/surprised/clip_01_2009007010320.wav",
      "/ref-wav/kaho/surprised/clip_02_4001007050250.wav",
      "/ref-wav/kaho/surprised/clip_03_3013019030450.wav"
    ],
    "serious": [
      "/ref-wav/kaho/serious/clip_01_2009007010030.wav",
      "/ref-wav/kaho/serious/clip_02_2009004020380.wav",
      "/ref-wav/kaho/serious/clip_03_3009008010420.wav"
    ]
  },
  "chiyoko": {
    "default": [
      "/ref-wav/chiyoko/neutral/clip_01_1010003040460.wav",
      "/ref-wav/chiyoko/neutral/clip_02_6010003040020.wav",
      "/ref-wav/chiyoko/neutral/clip_03_2010003020290.wav"
    ],
    "neutral": [
      "/ref-wav/chiyoko/neutral/clip_01_1010003040460.wav",
      "/ref-wav/chiyoko/neutral/clip_02_6010003040020.wav",
      "/ref-wav/chiyoko/neutral/clip_03_2010003020290.wav"
    ],
    "happy": [
      "/ref-wav/chiyoko/happy/clip_01_1010001030330.wav",
      "/ref-wav/chiyoko/happy/clip_02_4902800300010.wav",
      "/ref-wav/chiyoko/happy/clip_03_1010003030220.wav"
    ],
    "sad": [
      "/ref-wav/chiyoko/sad/clip_01_4901009190011.wav",
      "/ref-wav/chiyoko/sad/clip_02_3013004020250.wav",
      "/ref-wav/chiyoko/sad/clip_03_2010019010020.wav"
    ],
    "angry": [
      "/ref-wav/chiyoko/angry/clip_01_20000100010130.wav",
      "/ref-wav/chiyoko/angry/clip_02_2010009030220.wav",
      "/ref-wav/chiyoko/angry/clip_03_3009020020450.wav"
    ],
    "shy": [
      "/ref-wav/chiyoko/shy/clip_01_2010013030110.wav",
      "/ref-wav/chiyoko/shy/clip_02_2010006040410.wav",
      "/ref-wav/chiyoko/shy/clip_03_20000100010070.wav"
    ],
    "surprised": [
      "/ref-wav/chiyoko/surprised/clip_01_4901800200020.wav",
      "/ref-wav/chiyoko/surprised/clip_02_2010003020210.wav",
      "/ref-wav/chiyoko/surprised/clip_03_1010005020190.wav"
    ],
    "serious": [
      "/ref-wav/chiyoko/serious/clip_01_2010019010020.wav",
      "/ref-wav/chiyoko/serious/clip_02_6010003040020.wav",
      "/ref-wav/chiyoko/serious/clip_03_1010005020190.wav"
    ]
  },
  "juri": {
    "default": [
      "/ref-wav/juri/neutral/clip_01_4001092030430.wav",
      "/ref-wav/juri/neutral/clip_02_4001008080280.wav",
      "/ref-wav/juri/neutral/clip_03_1011001030030.wav"
    ],
    "neutral": [
      "/ref-wav/juri/neutral/clip_01_4001092030430.wav",
      "/ref-wav/juri/neutral/clip_02_4001008080280.wav",
      "/ref-wav/juri/neutral/clip_03_1011001030030.wav"
    ],
    "happy": [
      "/ref-wav/juri/happy/clip_01_4901035430010.wav",
      "/ref-wav/juri/happy/clip_02_4001081080150.wav",
      "/ref-wav/juri/happy/clip_03_3011015010020.wav"
    ],
    "sad": [
      "/ref-wav/juri/sad/clip_01_2011013040140.wav",
      "/ref-wav/juri/sad/clip_02_2011006110030.wav",
      "/ref-wav/juri/sad/clip_03_1011003040010.wav"
    ],
    "angry": [
      "/ref-wav/juri/angry/clip_01_4901002060540.wav",
      "/ref-wav/juri/angry/clip_02_5011001000120040.wav",
      "/ref-wav/juri/angry/clip_03_2011005020170.wav"
    ],
    "shy": [
      "/ref-wav/juri/shy/clip_01_2011003110060.wav",
      "/ref-wav/juri/shy/clip_02_2011006030110.wav",
      "/ref-wav/juri/shy/clip_03_4001008080560.wav"
    ],
    "surprised": [
      "/ref-wav/juri/surprised/clip_01_5003002020250.wav",
      "/ref-wav/juri/surprised/clip_02_2011013010040.wav",
      "/ref-wav/juri/surprised/clip_03_2011006040130.wav"
    ],
    "serious": [
      "/ref-wav/juri/serious/clip_01_1011001050090.wav",
      "/ref-wav/juri/serious/clip_02_2011018040090.wav",
      "/ref-wav/juri/serious/clip_03_2011017010190.wav"
    ]
  },
  "rinze": {
    "default": [
      "/ref-wav/rinze/neutral/clip_01_4001088050640.wav",
      "/ref-wav/rinze/neutral/clip_02_1012001040210.wav",
      "/ref-wav/rinze/neutral/clip_03_4001019061120.wav"
    ],
    "neutral": [
      "/ref-wav/rinze/neutral/clip_01_4001088050640.wav",
      "/ref-wav/rinze/neutral/clip_02_1012001040210.wav",
      "/ref-wav/rinze/neutral/clip_03_4001019061120.wav"
    ],
    "happy": [
      "/ref-wav/rinze/happy/clip_01_2012019040180.wav",
      "/ref-wav/rinze/happy/clip_02_2012014030150.wav",
      "/ref-wav/rinze/happy/clip_03_1012001040210.wav"
    ],
    "sad": [
      "/ref-wav/rinze/sad/clip_01_4001019061120.wav",
      "/ref-wav/rinze/sad/clip_02_2012014030150.wav",
      "/ref-wav/rinze/sad/clip_03_2012019040180.wav"
    ],
    "angry": [
      "/ref-wav/rinze/angry/clip_01_4001019061120.wav",
      "/ref-wav/rinze/angry/clip_02_4001088050640.wav",
      "/ref-wav/rinze/angry/clip_03_1012001040210.wav"
    ],
    "shy": [
      "/ref-wav/rinze/shy/clip_01_4001019061120.wav",
      "/ref-wav/rinze/shy/clip_02_1012001040210.wav",
      "/ref-wav/rinze/shy/clip_03_2012019040180.wav"
    ],
    "surprised": [
      "/ref-wav/rinze/surprised/clip_01_4001019061120.wav",
      "/ref-wav/rinze/surprised/clip_02_2012019040180.wav",
      "/ref-wav/rinze/surprised/clip_03_2012014030150.wav"
    ],
    "serious": [
      "/ref-wav/rinze/serious/clip_01_2012019040180.wav",
      "/ref-wav/rinze/serious/clip_02_4001088050640.wav",
      "/ref-wav/rinze/serious/clip_03_4001019061120.wav"
    ]
  },
  "natsuha": {
    "default": [
      "/ref-wav/natsuha/neutral/clip_01_4001076020410.wav",
      "/ref-wav/natsuha/neutral/clip_02_2013003110040.wav",
      "/ref-wav/natsuha/neutral/clip_03_5013001000120040.wav"
    ],
    "neutral": [
      "/ref-wav/natsuha/neutral/clip_01_4001076020410.wav",
      "/ref-wav/natsuha/neutral/clip_02_2013003110040.wav",
      "/ref-wav/natsuha/neutral/clip_03_5013001000120040.wav"
    ],
    "happy": [
      "/ref-wav/natsuha/happy/clip_01_6013001040040.wav",
      "/ref-wav/natsuha/happy/clip_02_7013001030080.wav",
      "/ref-wav/natsuha/happy/clip_03_4001081070660.wav"
    ],
    "sad": [
      "/ref-wav/natsuha/sad/clip_01_1013003020090.wav",
      "/ref-wav/natsuha/sad/clip_02_4001076020900.wav",
      "/ref-wav/natsuha/sad/clip_03_1013003030020.wav"
    ],
    "angry": [
      "/ref-wav/natsuha/angry/clip_01_2013019020160.wav",
      "/ref-wav/natsuha/angry/clip_02_4001011020660.wav",
      "/ref-wav/natsuha/angry/clip_03_3013009030030.wav"
    ],
    "shy": [
      "/ref-wav/natsuha/shy/clip_01_2013007030180.wav",
      "/ref-wav/natsuha/shy/clip_02_3013018020340.wav",
      "/ref-wav/natsuha/shy/clip_03_1013001030030.wav"
    ],
    "surprised": [
      "/ref-wav/natsuha/surprised/clip_01_4001011020660.wav",
      "/ref-wav/natsuha/surprised/clip_02_3013009030030.wav",
      "/ref-wav/natsuha/surprised/clip_03_2013003110040.wav"
    ],
    "serious": [
      "/ref-wav/natsuha/serious/clip_01_2013003110040.wav",
      "/ref-wav/natsuha/serious/clip_02_4001076020410.wav",
      "/ref-wav/natsuha/serious/clip_03_2013019020160.wav"
    ]
  },
  "nichika": {
    "default": [
      "/ref-wav/nichika/neutral/clip_01_6024004010050.wav",
      "/ref-wav/nichika/neutral/clip_02_3025022010480.wav",
      "/ref-wav/nichika/neutral/clip_03_3025016010400.wav"
    ],
    "neutral": [
      "/ref-wav/nichika/neutral/clip_01_6024004010050.wav",
      "/ref-wav/nichika/neutral/clip_02_3025022010480.wav",
      "/ref-wav/nichika/neutral/clip_03_3025016010400.wav"
    ],
    "happy": [
      "/ref-wav/nichika/happy/clip_01_3024008010110.wav",
      "/ref-wav/nichika/happy/clip_02_1024004030070.wav",
      "/ref-wav/nichika/happy/clip_03_4001058080900.wav"
    ],
    "sad": [
      "/ref-wav/nichika/sad/clip_01_3025012020160.wav",
      "/ref-wav/nichika/sad/clip_02_3024010020320.wav",
      "/ref-wav/nichika/sad/clip_03_1024005050270.wav"
    ],
    "angry": [
      "/ref-wav/nichika/angry/clip_01_2024015110010.wav",
      "/ref-wav/nichika/angry/clip_02_4001066050450.wav",
      "/ref-wav/nichika/angry/clip_03_4001066010360.wav"
    ],
    "shy": [
      "/ref-wav/nichika/shy/clip_01_4001066020350.wav",
      "/ref-wav/nichika/shy/clip_02_3024011020410.wav",
      "/ref-wav/nichika/shy/clip_03_3025012020480.wav"
    ],
    "surprised": [
      "/ref-wav/nichika/surprised/clip_01_2024010010010.wav",
      "/ref-wav/nichika/surprised/clip_02_2024007040200.wav",
      "/ref-wav/nichika/surprised/clip_03_1024004030070.wav"
    ],
    "serious": [
      "/ref-wav/nichika/serious/clip_01_4001066050450.wav",
      "/ref-wav/nichika/serious/clip_02_1024004030070.wav",
      "/ref-wav/nichika/serious/clip_03_3024008010110.wav"
    ]
  },
  "mikoto": {
    "default": [
      "/ref-wav/mikoto/neutral/clip_01_4001088080330.wav",
      "/ref-wav/mikoto/neutral/clip_02_1025003040230.wav",
      "/ref-wav/mikoto/neutral/clip_03_4001058060470.wav"
    ],
    "neutral": [
      "/ref-wav/mikoto/neutral/clip_01_4001088080330.wav",
      "/ref-wav/mikoto/neutral/clip_02_1025003040230.wav",
      "/ref-wav/mikoto/neutral/clip_03_4001058060470.wav"
    ],
    "happy": [
      "/ref-wav/mikoto/happy/clip_01_3025023020450.wav",
      "/ref-wav/mikoto/happy/clip_02_3025023020280.wav",
      "/ref-wav/mikoto/happy/clip_03_2025007040160.wav"
    ],
    "sad": [
      "/ref-wav/mikoto/sad/clip_01_2025007040160.wav",
      "/ref-wav/mikoto/sad/clip_02_3025023020280.wav",
      "/ref-wav/mikoto/sad/clip_03_1025003040230.wav"
    ],
    "angry": [
      "/ref-wav/mikoto/angry/clip_01_3025023020450.wav",
      "/ref-wav/mikoto/angry/clip_02_3025023020280.wav",
      "/ref-wav/mikoto/angry/clip_03_4001088080330.wav"
    ],
    "shy": [
      "/ref-wav/mikoto/shy/clip_01_4001058060470.wav",
      "/ref-wav/mikoto/shy/clip_02_3025023020450.wav",
      "/ref-wav/mikoto/shy/clip_03_2025007040160.wav"
    ],
    "surprised": [
      "/ref-wav/mikoto/surprised/clip_01_3025023020450.wav",
      "/ref-wav/mikoto/surprised/clip_02_3025023020280.wav",
      "/ref-wav/mikoto/surprised/clip_03_4001088080330.wav"
    ],
    "serious": [
      "/ref-wav/mikoto/serious/clip_01_4001088080330.wav",
      "/ref-wav/mikoto/serious/clip_02_1025003040230.wav",
      "/ref-wav/mikoto/serious/clip_03_4001058060470.wav"
    ]
  },
  "luca": {
    "default": [
      "/ref-wav/luca/neutral/clip_01_2026012110150.wav",
      "/ref-wav/luca/neutral/clip_02_4001055060720.wav",
      "/ref-wav/luca/neutral/clip_03_2026007020090.wav"
    ],
    "neutral": [
      "/ref-wav/luca/neutral/clip_01_2026012110150.wav",
      "/ref-wav/luca/neutral/clip_02_4001055060720.wav",
      "/ref-wav/luca/neutral/clip_03_2026007020090.wav"
    ],
    "happy": [
      "/ref-wav/luca/happy/clip_01_2026007010160.wav",
      "/ref-wav/luca/happy/clip_02_4001058050310.wav",
      "/ref-wav/luca/happy/clip_03_2026007020100.wav"
    ],
    "sad": [
      "/ref-wav/luca/sad/clip_01_6026003020030.wav",
      "/ref-wav/luca/sad/clip_02_4001090050120.wav",
      "/ref-wav/luca/sad/clip_03_3027007010300.wav"
    ],
    "angry": [
      "/ref-wav/luca/angry/clip_01_2026007020190.wav",
      "/ref-wav/luca/angry/clip_02_1026001000410030.wav",
      "/ref-wav/luca/angry/clip_03_2026006020090.wav"
    ],
    "shy": [
      "/ref-wav/luca/shy/clip_01_3026011020040.wav",
      "/ref-wav/luca/shy/clip_02_3008018010240.wav",
      "/ref-wav/luca/shy/clip_03_4001058060870.wav"
    ],
    "surprised": [
      "/ref-wav/luca/surprised/clip_01_4001058060310.wav",
      "/ref-wav/luca/surprised/clip_02_4001058061050.wav",
      "/ref-wav/luca/surprised/clip_03_3025006010540.wav"
    ],
    "serious": [
      "/ref-wav/luca/serious/clip_01_1026004040350.wav",
      "/ref-wav/luca/serious/clip_02_4001048020760.wav",
      "/ref-wav/luca/serious/clip_03_2026008030270.wav"
    ]
  },
  "hana": {
    "default": [
      "/ref-wav/hana/neutral/clip_01_3027004010250.wav",
      "/ref-wav/hana/neutral/clip_02_1027004060140.wav",
      "/ref-wav/hana/neutral/clip_03_4001090070070.wav"
    ],
    "neutral": [
      "/ref-wav/hana/neutral/clip_01_3027004010250.wav",
      "/ref-wav/hana/neutral/clip_02_1027004060140.wav",
      "/ref-wav/hana/neutral/clip_03_4001090070070.wav"
    ],
    "happy": [
      "/ref-wav/hana/happy/clip_01_2027006030180.wav",
      "/ref-wav/hana/happy/clip_02_4027001000110020.wav",
      "/ref-wav/hana/happy/clip_03_2027004040260.wav"
    ],
    "sad": [
      "/ref-wav/hana/sad/clip_01_2027001001130020.wav",
      "/ref-wav/hana/sad/clip_02_1027001001410070.wav",
      "/ref-wav/hana/sad/clip_03_2027008020190.wav"
    ],
    "angry": [
      "/ref-wav/hana/angry/clip_01_1027003050030.wav",
      "/ref-wav/hana/angry/clip_02_1027004050130.wav",
      "/ref-wav/hana/angry/clip_03_2027006030260.wav"
    ],
    "shy": [
      "/ref-wav/hana/shy/clip_01_2027005030150.wav",
      "/ref-wav/hana/shy/clip_02_4001069020290.wav",
      "/ref-wav/hana/shy/clip_03_1027001000910060.wav"
    ],
    "surprised": [
      "/ref-wav/hana/surprised/clip_01_2027005020060.wav",
      "/ref-wav/hana/surprised/clip_02_2027010020120.wav",
      "/ref-wav/hana/surprised/clip_03_4027001000130040.wav"
    ],
    "serious": [
      "/ref-wav/hana/serious/clip_01_5027001000120050.wav",
      "/ref-wav/hana/serious/clip_02_1027003090050.wav",
      "/ref-wav/hana/serious/clip_03_1027001001410020.wav"
    ]
  },
  "haruki": {
    "default": [
      "/ref-wav/haruki/neutral/clip_01_4001088060490.wav",
      "/ref-wav/haruki/neutral/clip_02_2028004010370.wav",
      "/ref-wav/haruki/neutral/clip_03_1028001040220.wav"
    ],
    "neutral": [
      "/ref-wav/haruki/neutral/clip_01_4001088060490.wav",
      "/ref-wav/haruki/neutral/clip_02_2028004010370.wav",
      "/ref-wav/haruki/neutral/clip_03_1028001040220.wav"
    ],
    "happy": [
      "/ref-wav/haruki/happy/clip_01_2028003110110.wav",
      "/ref-wav/haruki/happy/clip_02_3028003010320.wav",
      "/ref-wav/haruki/happy/clip_03_1028003040110.wav"
    ],
    "sad": [
      "/ref-wav/haruki/sad/clip_01_2028008110190.wav",
      "/ref-wav/haruki/sad/clip_02_4902800840010.wav",
      "/ref-wav/haruki/sad/clip_03_1028005010070.wav"
    ],
    "angry": [
      "/ref-wav/haruki/angry/clip_01_5028001000120030.wav",
      "/ref-wav/haruki/angry/clip_02_4028001000120030.wav",
      "/ref-wav/haruki/angry/clip_03_1028001010190.wav"
    ],
    "shy": [
      "/ref-wav/haruki/shy/clip_01_3028009010170.wav",
      "/ref-wav/haruki/shy/clip_02_4001069020150.wav",
      "/ref-wav/haruki/shy/clip_03_4001069050220.wav"
    ],
    "surprised": [
      "/ref-wav/haruki/surprised/clip_01_4001069020020.wav",
      "/ref-wav/haruki/surprised/clip_02_3027005020250.wav",
      "/ref-wav/haruki/surprised/clip_03_3026008020060.wav"
    ],
    "serious": [
      "/ref-wav/haruki/serious/clip_01_2028009110130.wav",
      "/ref-wav/haruki/serious/clip_02_5028001000110010.wav",
      "/ref-wav/haruki/serious/clip_03_6028001030020.wav"
    ]
  },
  "fuyuko": {
    "default": [
      "/ref-wav/fuyuko/neutral/clip_01_3018024010480.wav",
      "/ref-wav/fuyuko/neutral/clip_02_4001023030170.wav",
      "/ref-wav/fuyuko/neutral/clip_03_4001014071030.wav"
    ],
    "neutral": [
      "/ref-wav/fuyuko/neutral/clip_01_3018024010480.wav",
      "/ref-wav/fuyuko/neutral/clip_02_4001023030170.wav",
      "/ref-wav/fuyuko/neutral/clip_03_4001014071030.wav"
    ],
    "happy": [
      "/ref-wav/fuyuko/happy/clip_01_4901010050060.wav",
      "/ref-wav/fuyuko/happy/clip_02_4001015020920.wav",
      "/ref-wav/fuyuko/happy/clip_03_4001014080310.wav"
    ],
    "sad": [
      "/ref-wav/fuyuko/sad/clip_01_1018001000710070.wav",
      "/ref-wav/fuyuko/sad/clip_02_1018001040250.wav",
      "/ref-wav/fuyuko/sad/clip_03_1018001001110030.wav"
    ],
    "angry": [
      "/ref-wav/fuyuko/angry/clip_01_1018001000710070.wav",
      "/ref-wav/fuyuko/angry/clip_02_4901010050060.wav",
      "/ref-wav/fuyuko/angry/clip_03_4001014080310.wav"
    ],
    "shy": [
      "/ref-wav/fuyuko/shy/clip_01_4001023030170.wav",
      "/ref-wav/fuyuko/shy/clip_02_1018001001110030.wav",
      "/ref-wav/fuyuko/shy/clip_03_1018001000710070.wav"
    ],
    "surprised": [
      "/ref-wav/fuyuko/surprised/clip_01_4901010050060.wav",
      "/ref-wav/fuyuko/surprised/clip_02_4001015020920.wav",
      "/ref-wav/fuyuko/surprised/clip_03_4001014080310.wav"
    ],
    "serious": [
      "/ref-wav/fuyuko/serious/clip_01_1018001040250.wav",
      "/ref-wav/fuyuko/serious/clip_02_4901010050060.wav",
      "/ref-wav/fuyuko/serious/clip_03_4001015020920.wav"
    ],
    "omote": [
      "/ref-wav/fuyuko/omote/clip_01_4901010050060.wav",
      "/ref-wav/fuyuko/omote/clip_02_4001014080310.wav",
      "/ref-wav/fuyuko/omote/clip_03_4001015020920.wav"
    ],
    "honne": [
      "/ref-wav/fuyuko/honne/clip_01_1018001000710070.wav",
      "/ref-wav/fuyuko/honne/clip_02_4001014080310.wav",
      "/ref-wav/fuyuko/honne/clip_03_4001015020920.wav"
    ],
    "omote_v8": [
      "/ref-wav/fuyuko/omote/clip_01_4901010050060.wav",
      "/ref-wav/fuyuko/omote/clip_02_4001014080310.wav",
      "/ref-wav/fuyuko/omote/clip_03_4001015020920.wav"
    ],
    "omote_cap": [
      "/ref-wav/fuyuko/omote/clip_01_4901010050060.wav",
      "/ref-wav/fuyuko/omote/clip_02_4001014080310.wav",
      "/ref-wav/fuyuko/omote/clip_03_4001015020920.wav"
    ],
    "honne_cap": [
      "/ref-wav/fuyuko/honne/clip_01_1018001000710070.wav",
      "/ref-wav/fuyuko/honne/clip_02_4001014080310.wav",
      "/ref-wav/fuyuko/honne/clip_03_4001015020920.wav"
    ]
  },
  "hazuki": {
    "default": [
      "/ref-wav/hazuki/neutral/clip_01_6901001090040.wav",
      "/ref-wav/hazuki/neutral/clip_02_4901011130390.wav",
      "/ref-wav/hazuki/neutral/clip_03_4001022050060.wav"
    ],
    "neutral": [
      "/ref-wav/hazuki/neutral/clip_01_6901001090040.wav",
      "/ref-wav/hazuki/neutral/clip_02_4901011130390.wav",
      "/ref-wav/hazuki/neutral/clip_03_4001022050060.wav"
    ],
    "happy": [
      "/ref-wav/hazuki/happy/clip_01_4001020080380.wav",
      "/ref-wav/hazuki/happy/clip_02_3091009010100.wav",
      "/ref-wav/hazuki/happy/clip_03_4901002010120.wav"
    ],
    "sad": [
      "/ref-wav/hazuki/sad/clip_01_4901011120060.wav",
      "/ref-wav/hazuki/sad/clip_02_4901011130400.wav",
      "/ref-wav/hazuki/sad/clip_03_4901039100110.wav"
    ],
    "angry": [
      "/ref-wav/hazuki/angry/clip_01_4901002010110.wav",
      "/ref-wav/hazuki/angry/clip_02_1901001010170.wav",
      "/ref-wav/hazuki/angry/clip_03_4001058070430.wav"
    ],
    "shy": [
      "/ref-wav/hazuki/shy/clip_01_4001058070430.wav",
      "/ref-wav/hazuki/shy/clip_02_4901011130390.wav",
      "/ref-wav/hazuki/shy/clip_03_4001020080380.wav"
    ],
    "surprised": [
      "/ref-wav/hazuki/surprised/clip_01_4901002010120.wav",
      "/ref-wav/hazuki/surprised/clip_02_4901011130390.wav",
      "/ref-wav/hazuki/surprised/clip_03_4001020080380.wav"
    ],
    "serious": [
      "/ref-wav/hazuki/serious/clip_01_1901001010170.wav",
      "/ref-wav/hazuki/serious/clip_02_4001058070430.wav",
      "/ref-wav/hazuki/serious/clip_03_4901011120060.wav"
    ]
  }
};

  /* 9 情绪分层选择器 (9-Emotion Stratified Picker) */
  const emotionStrata = [
    { id: 'calm',        icon: '😌', label: '平静 / 站姿', anim1: 'wait1',    face: 'normal',  lip: 'lip_normal',  emo: 'neutral',   tone: 'normal',  desc: '自然呼吸待机 (wait1 + face_normal)' },
    { id: 'happy',       icon: '😊', label: '开心 / 微笑', anim1: 'smile1',   face: 'smile',   lip: 'lip_smile',   emo: 'happy',     tone: 'bright',  desc: '自然开心微笑 (smile1 + face_smile)' },
    { id: 'omote_heart', icon: '🎀', label: '营业♡ / 甜笑', anim1: 'smile2',   face: 'wink',    lip: 'lip_smile',   emo: 'happy',     tone: 'sweet',   mode: 'omote', desc: '偶像营业甜笑眨眼 (smile2 + face_wink)' },
    { id: 'shy',         icon: '😳', label: '害羞破防',    anim1: 'shy1',     face: 'shy',     lip: 'lip_shy',     emo: 'flustered', tone: 'sharp',   desc: '脸红破防慌乱 (shy1 + face_shy)' },
    { id: 'surp',        icon: '😲', label: '惊讶 / 睁眼', anim1: 'surp1',    face: 'surp',    lip: 'lip_surp',    emo: 'surprised', tone: 'bright',  desc: '突发惊讶后仰 (surp1 + face_surp)' },
    { id: 'anger',       icon: '💢', label: '生气毒舌',    anim1: 'angry1',   face: 'angry',   lip: 'lip_anger_s', emo: 'annoyed',   tone: 'low',     mode: 'honne', desc: '本音毒舌/鼓腮抗议 (angry1 + face_angry)' },
    { id: 'sad',         icon: '🥺', label: '委屈低落',    anim1: 'sad1',     face: 'sad',     lip: 'lip_sad',     emo: 'sad',       tone: 'soft',    desc: '垂眸低落难过 (sad1 + face_sad)' },
    { id: 'think',       icon: '🤔', label: '思考 / 沉思', anim1: 'udin',     face: 'serious', lip: 'lip_normal',  emo: 'serious',   tone: 'low',     desc: '抱胸沉思/认真端详 (udin + face_serious)' },
    { id: 'sigh',        icon: '😮‍💨', label: '叹气疲惫',    anim1: 'sigh',     face: 'close',   lip: 'lip_normal',  emo: 'tired',     tone: 'whisper', desc: '闭眼叹息卸下防备 (sigh + face_close)' }
  ];

  /* 中文分类身体与头部动作预设库 (Categorized Chinese Motion Preset Library) */
  const motionCategories = [
    { id: 'recommend', label: '🌟 常用推荐', desc: '当前角色语料高频动作组合 + 9 大核心情绪预设' },
    { id: 'idle',      label: '🌱 日常待机', desc: '标准呼吸、放松、端庄、侧身、抱胸与招牌站姿 (charAnim1)' },
    { id: 'happy',     label: '😊 开心元气', desc: '微笑、晃身、欢笑、雀跃欢呼、兴奋前倾与松气 (charAnim1)' },
    { id: 'shy',       label: '😳 害羞慌张', desc: '害羞微扭、脸红低头、捂脸扭捏、困扰与慌乱 (charAnim1)' },
    { id: 'surp',      label: '😮 惊讶冲击', desc: '微微吃惊、后仰大惊、怔住石化与惊叹睁眼 (charAnim1)' },
    { id: 'angry',     label: '😠 生气严肃', desc: '鼓腮赌气、叉腰抗议、严肃认真、思索与抗拒转身 (charAnim1)' },
    { id: 'sad',       label: '😢 难过疲惫', desc: '失落垂肩、难过低头、叹气下沉、疲惫与委屈拭泪 (charAnim1)' },
    { id: 'head',      label: '🙇 头部与肢体 (charAnim3)', desc: '叠加在身体动作上的点头、摇头、歪头、张望与鞠躬 + 69动作底层骨骼白名单' }
  ];

  const motionPresetCatalog = [
    // 🌱 日常待机 (idle)
    { id: 'wait1',   cat: 'idle',  slot: 'anim1', code: 'wait1',   icon: '🌱', nameZh: '标准待机',     sceneHint: '日常对话自然呼吸站姿',       faceHint: 'face_normal' },
    { id: 'wait2',   cat: 'idle',  slot: 'anim1', code: 'wait2',   icon: '🍃', nameZh: '放松待机',     sceneHint: '熟人闲聊、卸下防备微松肩',   faceHint: 'face_normal' },
    { id: 'wait3',   cat: 'idle',  slot: 'anim1', code: 'wait3',   icon: '✨', nameZh: '端庄站姿',     sceneHint: '礼貌倾听、正式场合双手交叠', faceHint: 'face_normal' },
    { id: 'wait4',   cat: 'idle',  slot: 'anim1', code: 'wait4',   icon: '🎐', nameZh: '侧身待机',     sceneHint: '双人对戏、侧身面向搭档',     faceHint: 'face_normal' },
    { id: 'udin',    cat: 'idle',  slot: 'anim1', code: 'udin',    icon: '🤔', nameZh: '抱胸沉思',     sceneHint: '思考对策、冷静审视或抱臂',   faceHint: 'face_serious' },
    { id: 'pose1',   cat: 'idle',  slot: 'anim1', code: 'pose1',   icon: '⭐', nameZh: '招牌站姿',     sceneHint: '角色专属亮相姿势 A',         faceHint: 'face_smile' },
    { id: 'pose2',   cat: 'idle',  slot: 'anim1', code: 'pose2',   icon: '🌟', nameZh: '自信站姿',     sceneHint: '角色专属自信定格姿势 B',     faceHint: 'face_smile2' },

    // 😊 开心元气 (happy)
    { id: 'smile1',  cat: 'happy', slot: 'anim1', code: 'smile1',  icon: '😊', nameZh: '轻快微笑',     sceneHint: '温和回应、日常愉快寒暄',     faceHint: 'face_smile' },
    { id: 'smile2',  cat: 'happy', slot: 'anim1', code: 'smile2',  icon: '🎵', nameZh: '开心晃身',     sceneHint: '心情愉悦、身体轻快左右摆动', faceHint: 'face_smile2' },
    { id: 'smile3',  cat: 'happy', slot: 'anim1', code: 'smile3',  icon: '😄', nameZh: '灿烂欢笑',     sceneHint: '发自内心的开怀笑容',         faceHint: 'face_smile2' },
    { id: 'glad1',   cat: 'happy', slot: 'anim1', code: 'glad1',   icon: '🙌', nameZh: '雀跃欢呼',     sceneHint: '听到好消息、双手握拳小跳',   faceHint: 'face_smile2' },
    { id: 'glad2',   cat: 'happy', slot: 'anim1', code: 'glad2',   icon: '✨', nameZh: '兴奋前倾',     sceneHint: '期待感拉满、身体向前凑近',   faceHint: 'face_smile2' },
    { id: 'happy',   cat: 'happy', slot: 'anim1', code: 'happy',   icon: '🌈', nameZh: '元气开心',     sceneHint: '充满活力的全身高兴反应',     faceHint: 'face_smile2' },
    { id: 'relief',  cat: 'happy', slot: 'anim1', code: 'relief',  icon: '😮‍💨', nameZh: '抚胸松口气', sceneHint: '危机解除、安心拍拍胸口',     faceHint: 'face_smile' },

    // 😳 害羞慌张 (shy)
    { id: 'shy1',    cat: 'shy',   slot: 'anim1', code: 'shy1',    icon: '😳', nameZh: '害羞微扭',     sceneHint: '被夸奖或戳中心事时轻微扭身', faceHint: 'face_shy' },
    { id: 'shy2',    cat: 'shy',   slot: 'anim1', code: 'shy2',    icon: '🫣', nameZh: '脸红低头',     sceneHint: '不好意思直视、垂眸缩肩',     faceHint: 'face_shy' },
    { id: 'shy3',    cat: 'shy',   slot: 'anim1', code: 'shy3',    icon: '🙈', nameZh: '捂脸/扭捏',    sceneHint: '极度害羞、双手捂脸或手指打转', faceHint: 'face_shy' },
    { id: 'trouble', cat: 'shy',   slot: 'anim1', code: 'trouble', icon: '😣', nameZh: '困扰为难',     sceneHint: '不知如何作答、苦笑挠头',     faceHint: 'face_trouble' },
    { id: 'panic',   cat: 'shy',   slot: 'anim1', code: 'panic',   icon: '😰', nameZh: '慌张无措',     sceneHint: '突发状况、连忙摆手解释',     faceHint: 'face_surp' },
    { id: 'fluster', cat: 'shy',   slot: 'anim1', code: 'fluster', icon: '💦', nameZh: '手足无措',     sceneHint: '破防慌乱、身体局促摇晃',     faceHint: 'face_shy' },

    // 😮 惊讶冲击 (surp)
    { id: 'surp1',   cat: 'surp',  slot: 'anim1', code: 'surp1',   icon: '😮', nameZh: '微微吃惊',     sceneHint: '出乎意料、肩膀微颤睁眼',     faceHint: 'face_surp' },
    { id: 'surp2',   cat: 'surp',  slot: 'anim1', code: 'surp2',   icon: '😲', nameZh: '大吃一惊后仰', sceneHint: '受到强烈冲击、身体后仰',     faceHint: 'face_surp' },
    { id: 'shock',   cat: 'surp',  slot: 'anim1', code: 'shock',   icon: '⚡', nameZh: '怔住石化',     sceneHint: '大脑一片空白、原地定格僵住', faceHint: 'face_surp' },
    { id: 'amaze',   cat: 'surp',  slot: 'anim1', code: 'amaze',   icon: '🤩', nameZh: '惊叹睁眼',     sceneHint: '看到绝美景色或精彩演出的赞叹', faceHint: 'face_surp' },

    // 😠 生气严肃 (angry)
    { id: 'angry1',  cat: 'angry', slot: 'anim1', code: 'angry1',  icon: '😠', nameZh: '鼓腮赌气',     sceneHint: '傲娇不满、闹别扭或小声抱怨', faceHint: 'face_angry' },
    { id: 'angry2',  cat: 'angry', slot: 'anim1', code: 'angry2',  icon: '💢', nameZh: '叉腰抗议',     sceneHint: '大声反驳、训斥或强烈抗议',   faceHint: 'face_angry' },
    { id: 'serious', cat: 'angry', slot: 'anim1', code: 'serious', icon: '😐', nameZh: '严肃认真',     sceneHint: '赛前凝神、正色立下约定',     faceHint: 'face_serious' },
    { id: 'think',   cat: 'angry', slot: 'anim1', code: 'think',   icon: '🤔', nameZh: '低头思索',     sceneHint: '托腮推敲细节、陷入深思',     faceHint: 'face_serious' },
    { id: 'refuse',  cat: 'angry', slot: 'anim1', code: 'refuse',  icon: '🙅', nameZh: '抗拒转身',     sceneHint: '撇过头去拒绝妥协、背身赌气', faceHint: 'face_angry' },

    // 😢 难过疲惫 (sad)
    { id: 'sad1',    cat: 'sad',   slot: 'anim1', code: 'sad1',    icon: '😢', nameZh: '失落垂肩',     sceneHint: '沮丧受挫、双肩无力下垂',     faceHint: 'face_sad' },
    { id: 'sad2',    cat: 'sad',   slot: 'anim1', code: 'sad2',    icon: '🥺', nameZh: '难过低头',     sceneHint: '自责内疚、深深低下头去',     faceHint: 'face_sad' },
    { id: 'sigh',    cat: 'sad',   slot: 'anim1', code: 'sigh',    icon: '😮‍💨', nameZh: '叹气下沉',   sceneHint: '长舒一口气或无奈轻叹',       faceHint: 'face_close' },
    { id: 'tired',   cat: 'sad',   slot: 'anim1', code: 'tired',   icon: '🫩', nameZh: '疲惫无力',     sceneHint: '高强度训练后或酷暑下体力透支', faceHint: 'face_trouble' },
    { id: 'cry',     cat: 'sad',   slot: 'anim1', code: 'cry',     icon: '😭', nameZh: '委屈拭泪',     sceneHint: '感动落泪或不甘心地擦拭眼角', faceHint: 'face_sad' },

    // 🙇 头部与肢体 (head · charAnim3)
    { id: 'nod',     cat: 'head',  slot: 'anim3', code: 'nod',     icon: '🙇', nameZh: '点头肯定',     sceneHint: '回应制作人、乖巧点头答应 (charAnim3)' },
    { id: 'nod2',    cat: 'head',  slot: 'anim3', code: 'nod2',    icon: '🙇‍♀️', nameZh: '连连点头',   sceneHint: '非常赞同、连续快速点头两次 (charAnim3)' },
    { id: 'shake',   cat: 'head',  slot: 'anim3', code: 'shake',   icon: '🙅‍♀️', nameZh: '摇头否认',   sceneHint: '轻晃脑袋表示否定或谦虚 (charAnim3)' },
    { id: 'tilt',    cat: 'head',  slot: 'anim3', code: 'tilt',    icon: '❓', nameZh: '歪头疑惑',     sceneHint: '不解地歪一下脑袋「嗯？」(charAnim3)' },
    { id: 'look',    cat: 'head',  slot: 'anim3', code: 'look',    icon: '👀', nameZh: '左右张望',     sceneHint: '环顾四周确认有没有外人 (charAnim3)' },
    { id: 'bow',     cat: 'head',  slot: 'anim3', code: 'bow',     icon: '🙏', nameZh: '鞠躬致意',     sceneHint: '礼貌道谢、登台或退场行礼 (charAnim3)' }
  ];

  /* 25 种全量面部表情中文视觉卡片 (All 25 face_* Expressions) */
  const faceExpressionCatalog = [
    { code: 'face_normal',    short: 'normal',    icon: '🙂', nameZh: '平静',     hint: '自然默认神态' },
    { code: 'face_smile',     short: 'smile',     icon: '😊', nameZh: '微笑',     hint: '温和浅笑' },
    { code: 'face_smile2',    short: 'smile2',    icon: '😄', nameZh: '灿笑',     hint: '露齿开怀大笑' },
    { code: 'face_wink',      short: 'wink',      icon: '😉', nameZh: '眨眼',     hint: '单眼Wink营业♡' },
    { code: 'face_shy',       short: 'shy',       icon: '😳', nameZh: '害羞',     hint: '双颊泛红羞涩' },
    { code: 'face_surp',      short: 'surp',      icon: '😮', nameZh: '惊讶',     hint: '睁大双眼吃惊' },
    { code: 'face_angry',     short: 'angry',     icon: '😠', nameZh: '生气',     hint: '蹙眉不悦抗议' },
    { code: 'face_sad',       short: 'sad',       icon: '😢', nameZh: '难过',     hint: '八字眉委屈伤心' },
    { code: 'face_serious',   short: 'serious',   icon: '😐', nameZh: '严肃',     hint: '神情凝重认真' },
    { code: 'face_close',     short: 'close',     icon: '😌', nameZh: '闭眼',     hint: '沉思/叹气/品味' },
    { code: 'face_trouble',   short: 'trouble',   icon: '😣', nameZh: '困扰',     hint: '苦笑为难纠结' },
    { code: 'face_smirk',     short: 'smirk',     icon: '😏', nameZh: '冷笑/得意', hint: '嘴角微扬/本音审视' },
    { code: 'face_laugh',     short: 'laugh',     icon: '😆', nameZh: '眯眼欢笑', hint: '眉眼弯弯乐不可支' },
    { code: 'face_glad',      short: 'glad',      icon: '🥰', nameZh: '欣喜感动', hint: '满眼喜悦与憧憬' },
    { code: 'face_relief',    short: 'relief',    icon: '😮‍💨', nameZh: '释然安心', hint: '放下心来温柔微笑' },
    { code: 'face_shy2',      short: 'shy2',      icon: '🫣', nameZh: '羞怯移目', hint: '脸红不敢直视' },
    { code: 'face_panic',     short: 'panic',     icon: '😰', nameZh: '慌张冒汗', hint: '手忙脚乱焦急' },
    { code: 'face_shock',     short: 'shock',     icon: '😱', nameZh: '震惊瞳孔', hint: '晴天霹雳呆若木鸡' },
    { code: 'face_amaze',     short: 'amaze',     icon: '🤩', nameZh: '闪亮惊叹', hint: '眼里闪光充满崇拜' },
    { code: 'face_anger',     short: 'anger',     icon: '💢', nameZh: '恼火毒舌', hint: '冷脸不耐烦斥责' },
    { code: 'face_pout',      short: 'pout',      icon: '😤', nameZh: '鼓腮赌气', hint: '闹别扭嘟嘴哼声' },
    { code: 'face_cry',       short: 'cry',       icon: '😭', nameZh: '含泪欲泣', hint: '眼眶泛泪楚楚可怜' },
    { code: 'face_tired',     short: 'tired',     icon: '🫩', nameZh: '疲惫倦怠', hint: '半睁眼精疲力尽' },
    { code: 'face_think',     short: 'think',     icon: '🤔', nameZh: '若有所思', hint: '微蹙眉专注推敲' },
    { code: 'face_blank',     short: 'blank',     icon: '😶', nameZh: '放空呆滞', hint: '电波放空无表情' }
  ];

  const gazeCatalog = [
    { code: 'eye_left',  label: '← 看左 eye_left',   desc: '视线转向舞台左侧（或移开目光）' },
    { code: 'eye_front', label: '● 看正前 eye_front', desc: '视线正对镜头（直视制作人）' },
    { code: 'eye_right', label: '看右 → eye_right',  desc: '视线转向舞台右侧（看向右侧搭档）' },
    { code: 'close_eye', label: '◡ 闭目 close_eye',  desc: '眼睑闭合叠加（配合叹气或沉思）' }
  ];

  /* 全量 69 动作 Spine 骨骼白名单 (Full 69-Motion Spine Skeleton Whitelist) */
  const skeletonWhitelist = {
    anim1: [
      'wait1', 'wait2', 'wait3', 'wait4', 'udin', 'pose1', 'pose2',
      'smile1', 'smile2', 'smile3', 'glad1', 'glad2', 'happy', 'relief',
      'shy1', 'shy2', 'shy3', 'trouble', 'panic', 'fluster',
      'surp1', 'surp2', 'shock', 'amaze',
      'angry1', 'angry2', 'serious', 'think', 'refuse',
      'sad1', 'sad2', 'sigh', 'tired', 'cry'
    ],
    anim2: faceExpressionCatalog.map(f => f.code),
    anim3: ['', 'nod', 'nod2', 'shake', 'tilt', 'look', 'bow', 'head_nod', 'head_shake', 'head_tilt', 'turn_back'],
    anim4: ['', 'eye_front', 'eye_left', 'eye_right', 'close_eye'],
    lip:   ['lip_normal', 'lip_smile', 'lip_shy', 'lip_surp', 'lip_anger_s', 'lip_sad'],
    tooltipZh: '【什么是 69 动作 Spine 骨骼白名单？】闪耀色彩官方 2D 立绘（stand 骨骼）将动画拆分为 5 条正交轨道：Track 0 身体主动作（charAnim1，34种）、Track 1 面部五官表情（charAnim2，25种）、Track 2 头部与肢体叠加动作（charAnim3，点头/摇头/歪头/鞠躬等）、Track 3 眼球视线方向（charAnim4，4种）、Track 5 口型同步（charLipAnim，6种）。白名单用于校验脚本中的骨骼代号是否被官方引擎原生支持，防止拼写错误导致立绘卡死。'
  };

  /* 2D 平面移动预设 (2D Planar Movement Presets) */
  const planarMovePresets = [
    { id: 'approach',     label: '🚶‍♀️ 相向走近', desc: '向舞台内侧走近一步 (450ms + 脚步声)', dx: -150, toCenter: true, time: 450, scale: 1.0, se: '0243' },
    { id: 'step_back',    label: '↩️ 后退半步', desc: '受惊或拉开距离后退半步 (320ms)',      dx: 90,   toEdge: true,   time: 320, scale: 0.96 },
    { id: 'swap_lr',      label: '🔄 左右换位', desc: '与另一名角色平滑交换左右站位 (480ms)', swap: true,              time: 480, scale: 1.0, se: '0243' },
    { id: 'closeup',      label: '🔍 凑近特写', desc: '推进到中央近景特写 (×1.12, 400ms)',    targetX: 568, targetY: 648, time: 400, scale: 1.12 },
    { id: 'center_stand', label: '🎯 居中站定', desc: '平滑移至舞台正中央 C 位 (X=568, 360ms)', targetX: 568, targetY: 640, time: 360, scale: 1.0 },
    { id: 'move_left',    label: '⬅️ 移至左位', desc: '平滑移至双人/三人左位 (X=300, 380ms)',   targetX: 300, targetY: 640, time: 380, scale: 1.0 },
    { id: 'move_right',   label: '➡️ 移至右位', desc: '平滑移至双人/三人右位 (X=836, 380ms)',   targetX: 836, targetY: 640, time: 380, scale: 1.0 }
  ];

  const actionCards = {
    fuyuko: [
      { label: '营业站姿♡', anim1: 'wait1', face: 'smile', freq: 132 },
      { label: '招牌甜笑♡', anim1: 'smile2', face: 'wink', freq: 98 },
      { label: '闭眼叹息', anim1: 'wait2', face: 'close', freq: 41 },
      { label: '本音·毒舌', anim1: 'anger1', face: 'smirk', freq: 37 },
      { label: '慌张破防', anim1: 'shy1', face: 'shy', freq: 29 },
      { label: '震惊后仰', anim1: 'surp1', face: 'surp', freq: 18 }
    ],
    asahi: [
      { label: '元气待机', anim1: 'wait1', face: 'smile', freq: 145 },
      { label: '好奇凑近', anim1: 'smile2', face: 'smile2', freq: 88 },
      { label: '突发惊讶', anim1: 'surp1', face: 'surp', freq: 54 },
      { label: '歪头思考', anim1: 'trouble1', face: 'normal', freq: 39 }
    ],
    mei: [
      { label: '辣妹灿笑', anim1: 'smile1', face: 'smile', freq: 138 },
      { label: '打圆场眨眼', anim1: 'smile2', face: 'wink', freq: 72 },
      { label: '害羞挠头', anim1: 'shy1', face: 'shy', freq: 46 }
    ],
    toru: [
      { label: '透明感站姿', anim1: 'wait1', face: 'normal', freq: 164 },
      { label: '淡淡微笑', anim1: 'smile1', face: 'smile', freq: 79 },
      { label: '凑近端详', anim1: 'wait2', face: 'normal', freq: 34 }
    ],
    madoka: [
      { label: '冷淡抱臂', anim1: 'wait1', face: 'normal', freq: 152 },
      { label: '毒舌审视', anim1: 'wait2', face: 'smirk', freq: 68 },
      { label: '无奈叹气', anim1: 'trouble1', face: 'close', freq: 42 },
      { label: '被戳中移目', anim1: 'shy1', face: 'shy', freq: 21 }
    ],
    mano: [{ label: '温柔站姿', anim1: 'wait1', face: 'smile', freq: 150 }, { label: '双手合十', anim1: 'smile1', face: 'smile', freq: 61 }, { label: '困惑吃惊', anim1: 'wait2', face: 'surp', freq: 33 }],
    hiori: [{ label: '端正站姿', anim1: 'wait1', face: 'serious', freq: 140 }, { label: '轻轻微笑', anim1: 'smile1', face: 'smile', freq: 52 }, { label: '害羞别过脸', anim1: 'shy1', face: 'shy', freq: 27 }],
    meguru: [{ label: '元气挥手', anim1: 'wait1', face: 'smile', freq: 160 }, { label: '惊讶睁眼', anim1: 'surp1', face: 'surp', freq: 44 }, { label: '灿烂笑容', anim1: 'smile1', face: 'smile2', freq: 30 }],
    amana: [
      { label: '辣妹甜笑☆', anim1: 'smile2', face: 'smile2', freq: 168 },
      { label: '撒娇前倾♡', anim1: 'glad2', face: 'wink', freq: 94 },
      { label: '心疼担忧', anim1: 'trouble', face: 'trouble', freq: 58 },
      { label: '脸红害羞', anim1: 'shy1', face: 'shy', freq: 45 },
      { label: '抱胸思考', anim1: 'udin', face: 'serious', freq: 32 }
    ],
    hana: [
      { label: '纯真灿笑', anim1: 'smile1', face: 'smile', freq: 155 },
      { label: '歪头好奇', anim1: 'wait2', face: 'normal', anim3: 'tilt', freq: 86 },
      { label: '怕晒困扰', anim1: 'trouble', face: 'trouble', freq: 62 },
      { label: '惊喜欢呼', anim1: 'glad1', face: 'smile2', freq: 49 },
      { label: '乖巧点头', anim1: 'wait1', face: 'smile', anim3: 'nod', freq: 38 }
    ],
    tenka: [
      { label: '害羞缩肩', anim1: 'shy2', face: 'shy', freq: 142 },
      { label: '放松浅笑', anim1: 'smile1', face: 'smile', freq: 76 },
      { label: '困倦叹气', anim1: 'sigh', face: 'close', freq: 54 }
    ]
  };

  const emotions = [
    ['neutral', '平静'], ['happy', '开心'], ['sad', '难过'], ['angry', '生气'], ['shy', '害羞'], ['surprised', '惊讶'],
    ['serious', '认真'], ['flustered', '慌乱'], ['annoyed', '不耐烦'], ['tender', '温柔'], ['tired', '疲惫'], ['relieved', '释然']
  ];
  const tones = [
    ['normal', '普通'], ['soft', '轻柔'], ['whisper', '耳语'], ['bright', '明亮'], ['sweet', '甜美'], ['low', '低沉'],
    ['sharp', '尖锐'], ['shout', '喊叫'], ['tearful', '哽咽'], ['cold', '冷淡'], ['monotone', '平板']
  ];
  const eras = [
    ['', '（继承故事）'], ['pre_wing', 'W.I.N.G. 之前'], ['wing', 'W.I.N.G.'], ['kanshasai', '感谢祭'], ['grad', 'G.R.A.D.'],
    ['landing_point', 'LP（Landing Point）'], ['step', 'S.T.E.P.'], ['after', '之后'], ['other', '其他']
  ];
  const faceLabels = {
    normal: '平静', smile: '微笑', smile2: '灿笑', wink: '眨眼♡', shy: '害羞', surp: '惊讶', surprised: '惊讶',
    angry: '生气', anger: '恼火', sad: '难过', serious: '严肃', close: '闭眼', trouble: '困扰', smirk: '冷笑/得意',
    laugh: '眯眼欢笑', glad: '欣喜感动', relief: '释然安心', shy2: '羞怯移目', panic: '慌张冒汗',
    shock: '震惊瞳孔', amaze: '闪亮惊叹', pout: '鼓腮赌气', cry: '含泪欲泣', tired: '疲惫倦怠', think: '若有所思', blank: '放空呆滞'
  };

  const promptPresets = [
    { label: '雨后天台', prompt: 'school rooftop after rain, puddles reflecting soft sky, wet chain-link fence, watercolor wash, empty scene', filter: 'enza_rain', ref: '00889' },
    { label: '黄昏事务所', prompt: '283 production office at sunset, warm orange light through windows, long shadows, anime watercolor', filter: 'enza_evening', ref: '00002' },
    { label: '事务所夜景', prompt: '283 production office at night, warm desk lamp, city lights through window, calm watercolor', filter: 'enza_night', ref: '00060' },
    { label: '放学练习室', prompt: 'idol dance lesson room with large wall mirror, wooden floor, afternoon light, watercolor background', filter: 'enza_day', ref: '00006' },
    { label: '夕阳天台', prompt: 'school rooftop at sunset, glowing clouds, chain-link fence, nostalgic breeze, watercolor', filter: 'enza_evening', ref: '00007' }
  ];

  const museBank = {
    fuyuko: {
      omote: [['えへへ、プロデューサーさんってば、ふゆのことよく見てるんですねぇ♡', '诶嘿嘿，制作人真是很关注冬优呢♡'], ['ふゆ、事務所のみんなともっと素敵なステージを作りたいです♡', '冬优想和事务所的大家一起做出更棒的舞台呢♡']],
      honne: [['……別に。あんたに見られたって、どうってことないわよ', '……没什么。被你看到了也无所谓'], ['ほんと、ふゆのペースが狂うっつーの……', '真是的，冬优的节奏全被你打乱了……']]
    },
    asahi: { any: [['おっ、プロデューサー！　今の動き、すっごく面白かったっすよ！', '噢，制作人！刚才那个动作超级有意思呀！'], ['わたし、冬優子ちゃんと愛依ちゃんと一緒に、もっと動いてみたいっす！', '我想和冬优子酱、爱依酱一起再多动一动呀！']] },
    mei:   { any: [['あはは、冬優子ちゃんもあさひちゃんもノリノリじゃん！', '啊哈哈，冬优子酱和朝日酱都超起劲嘛！'], ['あたしも負けてらんないね、プロデューサー！', '我也不能输呢，制作人！']] },
    toru:  { any: [['……うん。樋口、いまの感じ、よかったよね。', '……嗯。樋口，刚才那种感觉，挺好的吧。'], ['ふーん……プロデューサー、近くで見るとこうなってるんだ。', '唔……制作人，凑近看原来是这样啊。']] },
    madoka:{ any: [['……別に。あなたがそれで満足なら、いいんじゃないですか', '……没什么。你要是那样就满足的话，不也挺好吗'], ['ご苦労さまです。浅倉、あんまりカメラに近づきすぎないで', '辛苦你了。浅仓，别凑镜头太近']] },
    mano:  { any: [['ほわっ……プロデューサーさん、ありがとうございます', '呼哇……制作人，谢谢您'], ['わたし、灯織ちゃんやめぐるちゃんともっとがんばりたいです', '我想和灯织酱、巡酱一起更加努力']] },
    hiori: { any: [['私は、まだまだです。でも……真乃やめぐると一緒に前に進みたい', '我还差得远。但是……我想和真乃、巡一起前进'], ['プロデューサー、次のレッスンの予定を確認させてください', '制作人，请让我确认一下接下来的课程安排']] },
    meguru:{ any: [['よーし、真乃、灯織、次は三人でいこう！', '好——，真乃、灯织，下次三个人一起上！'], ['えへへ、わたし、プロデューサーと一緒に頑張るよ！', '诶嘿嘿，我会和制作人一起加油的哦！']] }
  };

  /* ISLAND_PACK_START */
  const islandPack = {
  "$schema": "../../schema/scproj.schema.json",
  "format": "scpack",
  "formatVersion": 2,
  "id": "island_survival_pack",
  "x-projectType": "story",
  "name": "無人島サバイバル！？〜消えたふたりと水平線のレスキュー〜",
  "nameZh": "🏝️ 荒岛求生！？～偷溜的两人与海平线大营救～",
  "version": "0.2.0",
  "unit": "illumination STARS × ALSTROEMERIA × CoMETIK",
  "synopsis": "夏ロケの合間にボートで無人島へ流されてしまった甘奈と羽那。プロデューサーと3人で日除けを作り、SOSサインを送ると、水平線から真乃・灯織・めぐる・甜花のレスキュー艇がやってくる！",
  "synopsisZh": "夏日外景拍摄间隙，甘奈与羽那误乘小艇漂流到无人荒岛。制作人与两人合力搭建遮阳棚、在海岸发出求救信号后，真乃、灯织、缭与甜花乘着救援艇从海平线赶来，上演6人分镜大团圆！",
  "themeColor": "#f54275",
  "description": "三幕式荒岛求生二创工程包：第1幕码头偷溜与正午防晒、第2幕海岸SOS分支抉择、第3幕6人分镜全员大营救。",
  "authors": [
    {
      "name": "283 Production Studio",
      "role": "writer"
    }
  ],
  "createdAt": "2026-11-12T12:00:00Z",
  "updatedAt": "2026-11-14T15:28:55.974Z",
  "lang": {
    "primary": "ja",
    "translations": [
      "zh"
    ]
  },
  "characters": {
    "mano": {
      "charType": "characters",
      "charId": "001",
      "charCategory": "stand",
      "name": "真乃",
      "nameZh": "樱木真乃"
    },
    "hiori": {
      "charType": "characters",
      "charId": "002",
      "charCategory": "stand",
      "name": "灯織",
      "nameZh": "风野灯织"
    },
    "meguru": {
      "charType": "characters",
      "charId": "003",
      "charCategory": "stand",
      "name": "めぐる",
      "nameZh": "八宫巡"
    },
    "amana": {
      "charType": "characters",
      "charId": "014",
      "charCategory": "stand",
      "name": "甘奈",
      "nameZh": "大崎甘奈"
    },
    "tenka": {
      "charType": "characters",
      "charId": "015",
      "charCategory": "stand",
      "name": "甜花",
      "nameZh": "大崎甜花"
    },
    "hana": {
      "charType": "characters",
      "charId": "027",
      "charCategory": "stand",
      "name": "羽那",
      "nameZh": "铃木羽那"
    }
  },
  "stories": [
    {
      "id": "scene_01_harbor",
      "file": "stories/scene_01_harbor.scproj.json",
      "source": "stories/scene_01_harbor.scs.yaml",
      "title": "第1幕・港の抜け出しと無人島の正午",
      "titleZh": "第 1 幕 · 码头偷溜与荒岛正午",
      "order": 1,
      "cast": [
        "amana",
        "hana"
      ],
      "entry": true,
      "tags": [
        "island",
        "summer",
        "fanwork"
      ]
    },
    {
      "id": "scene_02_signal",
      "file": "stories/scene_02_signal.scproj.json",
      "source": "stories/scene_02_signal.scs.yaml",
      "title": "第2幕・ビーチのSOSサイン（分岐）",
      "titleZh": "第 2 幕 · 海岸求救信号（分支）",
      "order": 2,
      "cast": [
        "amana",
        "hana"
      ],
      "entry": false,
      "tags": [
        "island",
        "summer",
        "fanwork"
      ]
    },
    {
      "id": "scene_03_rescue",
      "file": "stories/scene_03_rescue.scproj.json",
      "source": "stories/scene_03_rescue.scs.yaml",
      "title": "第3幕・水平線の全員レスキュー",
      "titleZh": "第 3 幕 · 海平线上的全员大营救",
      "order": 3,
      "cast": [
        "mano",
        "hiori",
        "meguru",
        "amana",
        "tenka",
        "hana"
      ],
      "entry": false,
      "tags": [
        "island",
        "summer",
        "fanwork"
      ]
    }
  ]
};
  const islandStory = {
  "$schema": "../../../schema/scproj.schema.json",
  "format": "scproj",
  "formatVersion": 2,
  "meta": {
    "id": "scene_01_harbor",
    "cat": "custom",
    "title": "第1幕・港の抜け出しと無人島の正午",
    "titleZh": "第 1 幕 · 码头偷溜与荒岛正午",
    "origin": "custom",
    "lang": {
      "primary": "ja",
      "translations": [
        "zh"
      ]
    },
    "cast": [
      "amana",
      "hana"
    ],
    "characters": {
      "amana": {
        "charType": "characters",
        "charId": "014",
        "x-clothId": "014",
        "charCategory": "stand",
        "name": "甘奈",
        "nameZh": "大崎甘奈"
      },
      "hana": {
        "charType": "characters",
        "charId": "027",
        "x-clothId": "027",
        "charCategory": "stand",
        "name": "羽那",
        "nameZh": "铃木羽那"
      }
    },
    "authors": [
      {
        "name": "283 Fan-Story Studio",
        "role": "writer"
      }
    ],
    "createdAt": "2026-11-12T12:00:00Z",
    "updatedAt": "2026-11-14T15:28:55.922Z"
  },
  "lines": [
    {
      "bg": "00269",
      "bgEffect": "fade",
      "bgEffectTime": 600,
      "bgm": "003",
      "textFrame": "off",
      "waitType": "time",
      "waitTime": 350,
      "_meta": {
        "uid": "setup_bg_001",
        "x-autoGenerated": true,
        "note": "场景初始化：BG 00269 / BGM 003"
      }
    },
    {
      "charLabel": "amana",
      "charType": "characters",
      "charId": "014",
      "clothId": "014",
      "charCategory": "stand",
      "charPosition": {
        "x": 360,
        "y": 610,
        "order": 0
      },
      "charScale": 1,
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 200
      },
      "charAnim1": "smile1",
      "charAnim2": "face_smile",
      "charAnim4": "eye_front",
      "charLipAnim": "blank",
      "textFrame": "off",
      "waitType": "time",
      "waitTime": 1,
      "_meta": {
        "uid": "cut_in_amana_002",
        "x-autoGenerated": true,
        "note": "初始机位 #1 登场 (amana, hana)"
      }
    },
    {
      "charLabel": "hana",
      "charType": "characters",
      "charId": "027",
      "clothId": "027",
      "charCategory": "stand",
      "charPosition": {
        "x": 776,
        "y": 610,
        "order": 1
      },
      "charScale": 1,
      "charEffect": {
        "type": "from",
        "alpha": 0,
        "time": 200
      },
      "charAnim1": "smile2",
      "charAnim2": "face_smile",
      "charAnim4": "eye_front",
      "charLipAnim": "lip_wait_s",
      "textFrame": "off",
      "waitType": "time",
      "waitTime": 200,
      "_meta": {
        "uid": "cut_in_hana_003",
        "x-autoGenerated": true,
        "note": "初始机位 #1 登场 (amana, hana)"
      }
    },
    {
      "speaker": "甘奈",
      "text": "プロデューサーさん見て☆ 海がキラキラだよ！甘奈、羽那ちゃんと探検できて超ワクワクしてるんだ♪",
      "textFrame": "001",
      "textCtrl": "p",
      "charLabel": "amana",
      "charType": "characters",
      "charId": "014",
      "clothId": "014",
      "charCategory": "stand",
      "charPosition": {
        "x": 360,
        "y": 610,
        "order": 0
      },
      "charScale": 1,
      "charAnim1": "smile1",
      "charAnim2": "face_smile",
      "charAnim4": "eye_front",
      "charLipAnim": "lip_smile",
      "lip": "lip_smile",
      "_meta": {
        "uid": "s1_r01",
        "zh": "制作人先生快看☆ 大海闪闪发光哦！甘奈能和羽那酱一起探险，心里超激动的♪",
        "speakerZh": "大崎甘奈",
        "surfaceEmotion": "joy_bright",
        "innerEmotion": "trust_warm",
        "vocalTone": "warm_soft",
        "note": "[节拍 1] 码头偷溜登上无人荒岛浅滩",
        "x-beatId": "beat_1",
        "x-beatTitle": "偷溜登岛与游艇离开"
      }
    },
    {
      "speaker": "羽那",
      "text": "わぁ……！ほんとですね甘奈さん！ボートを覗くつもりが、こんな綺麗な島に着いちゃいました～！",
      "textFrame": "001",
      "textCtrl": "p",
      "charLabel": "hana",
      "charType": "characters",
      "charId": "027",
      "clothId": "027",
      "charCategory": "stand",
      "charPosition": {
        "x": 776,
        "y": 610,
        "order": 1
      },
      "charScale": 1,
      "charAnim1": "smile2",
      "charAnim2": "face_smile",
      "charAnim4": "eye_front",
      "charLipAnim": "lip_smile",
      "lip": "lip_smile",
      "_meta": {
        "uid": "s1_r02",
        "zh": "哇啊……！真的呢甘奈小姐！本来只是想看看小船，没想到漂到了这么漂亮的小岛上～！",
        "speakerZh": "铃木羽那",
        "surfaceEmotion": "joy_bright",
        "innerEmotion": "trust_warm",
        "vocalTone": "warm_soft",
        "x-beatId": "beat_1",
        "x-beatTitle": "偷溜登岛与游艇离开"
      }
    },
    {
      "speaker": "プロデューサー",
      "text": "ふたりとも無事でよかった……！迎えの船が来るまで、ヤシの葉で日陰を作って休もう。",
      "textFrame": "001",
      "textCtrl": "p",
      "_meta": {
        "uid": "s1_r03",
        "zh": "你们两个都平安无事真是太好了……！在救援船赶来之前，我们先用椰叶搭个遮阳棚休息吧。",
        "speakerZh": "制作人",
        "note": "[节拍 2] 制作人赶到，提议搭建树叶遮阳棚",
        "x-beatId": "beat_2",
        "x-beatTitle": "与制作人合力搭椰叶棚"
      }
    },
    {
      "speaker": "甘奈",
      "text": "あっ、正午の日差しがジリジリしてきたかも！プロデューサーさん、甘奈も葉っぱ集めてくるね☆",
      "textFrame": "001",
      "textCtrl": "p",
      "charLabel": "amana",
      "charType": "characters",
      "charId": "014",
      "clothId": "014",
      "charCategory": "stand",
      "charPosition": {
        "x": 360,
        "y": 610,
        "order": 0
      },
      "charScale": 1,
      "charAnim1": "surp1",
      "charAnim2": "face_surp",
      "charAnim4": "eye_front",
      "charLipAnim": "lip_surp",
      "lip": "lip_surp",
      "_meta": {
        "uid": "s1_r04",
        "zh": "啊，正午的阳光变得火辣辣的了！制作人先生，甘奈也去帮忙收集大椰子叶哦☆",
        "speakerZh": "大崎甘奈",
        "surfaceEmotion": "surprise_wide",
        "innerEmotion": "alert_spark",
        "vocalTone": "bright_pop",
        "x-beatId": "beat_2",
        "x-beatTitle": "与制作人合力搭椰叶棚"
      }
    },
    {
      "speaker": "羽那",
      "text": "あたしも行きますっ！大きな葉っぱを重ねたら、秘密基地みたいで絶対楽しいですよ～！",
      "textFrame": "001",
      "textCtrl": "p",
      "charLabel": "hana",
      "charType": "characters",
      "charId": "027",
      "clothId": "027",
      "charCategory": "stand",
      "charPosition": {
        "x": 776,
        "y": 610,
        "order": 1
      },
      "charScale": 1,
      "charAnim1": "yes",
      "charAnim2": "face_smile",
      "charAnim4": "eye_front",
      "charLipAnim": "lip_smile",
      "lip": "lip_smile",
      "_meta": {
        "uid": "s1_r05",
        "zh": "我也要去！要是把大大的叶子叠起来，肯定像秘密基地一样超有趣的哦～！",
        "speakerZh": "铃木羽那",
        "surfaceEmotion": "smile_gentle",
        "innerEmotion": "performative_sweet",
        "vocalTone": "sweet_performative",
        "x-beatId": "beat_2",
        "x-beatTitle": "与制作人合力搭椰叶棚"
      }
    },
    {
      "speaker": "甘奈",
      "text": "えへへ、テント完成☆ あっ、羽那ちゃんの肩が赤くなってる！甘奈の日焼け止め、一緒に塗ろっか♪",
      "textFrame": "001",
      "textCtrl": "p",
      "charLabel": "amana",
      "charType": "characters",
      "charId": "014",
      "clothId": "014",
      "charCategory": "stand",
      "charPosition": {
        "x": 360,
        "y": 610,
        "order": 0
      },
      "charScale": 1,
      "charAnim1": "shy1",
      "charAnim2": "face_shy",
      "charAnim4": "eye_right",
      "charLipAnim": "lip_shy",
      "lip": "lip_shy",
      "_meta": {
        "uid": "s1_r06",
        "zh": "嘿嘿，树叶帐篷完成啦☆ 啊，羽那酱的肩膀有点晒红了！来用甘奈的防晒霜，我们一起涂吧♪",
        "speakerZh": "大崎甘奈",
        "surfaceEmotion": "shy_flustered",
        "innerEmotion": "affection_bashful",
        "vocalTone": "breath_flutter",
        "note": "[节拍 3] 正午防晒互动，苦中作乐",
        "x-beatId": "beat_3",
        "x-beatTitle": "正午晒红肩膀与涂防晒霜"
      }
    },
    {
      "speaker": "羽那",
      "text": "わぁ、ありがとうございます甘奈さん！プロデューサーさんも隣でちゃんと涼んでくださいね！",
      "textFrame": "001",
      "textCtrl": "p",
      "charLabel": "hana",
      "charType": "characters",
      "charId": "027",
      "clothId": "027",
      "charCategory": "stand",
      "charPosition": {
        "x": 776,
        "y": 610,
        "order": 1
      },
      "charScale": 1,
      "charAnim1": "shy2",
      "charAnim2": "face_shy",
      "charAnim4": "eye_front",
      "charLipAnim": "lip_shy",
      "lip": "lip_shy",
      "_meta": {
        "uid": "s1_r07",
        "zh": "哇，谢谢甘奈小姐！制作人先生也要在我们身边好好乘凉休息哦！",
        "speakerZh": "铃木羽那",
        "surfaceEmotion": "shy_flustered",
        "innerEmotion": "affection_bashful",
        "vocalTone": "breath_flutter",
        "x-beatId": "beat_3",
        "x-beatTitle": "正午晒红肩膀与涂防晒霜"
      }
    },
    {
      "textFrame": "off",
      "bgm": "off",
      "waitType": "time",
      "waitTime": 700,
      "_meta": {
        "uid": "end_004",
        "x-autoGenerated": true,
        "note": "演出结束收尾"
      }
    }
  ]
};
  const islandScenesMap = {
  "scene_01_harbor": {
    "$schema": "../../../schema/scproj.schema.json",
    "format": "scproj",
    "formatVersion": 2,
    "meta": {
      "id": "scene_01_harbor",
      "cat": "custom",
      "title": "第1幕・港の抜け出しと無人島の正午",
      "titleZh": "第 1 幕 · 码头偷溜与荒岛正午",
      "origin": "custom",
      "lang": {
        "primary": "ja",
        "translations": [
          "zh"
        ]
      },
      "cast": [
        "amana",
        "hana"
      ],
      "characters": {
        "amana": {
          "charType": "characters",
          "charId": "014",
          "x-clothId": "014",
          "charCategory": "stand",
          "name": "甘奈",
          "nameZh": "大崎甘奈"
        },
        "hana": {
          "charType": "characters",
          "charId": "027",
          "x-clothId": "027",
          "charCategory": "stand",
          "name": "羽那",
          "nameZh": "铃木羽那"
        }
      },
      "authors": [
        {
          "name": "283 Fan-Story Studio",
          "role": "writer"
        }
      ],
      "createdAt": "2026-11-12T12:00:00Z",
      "updatedAt": "2026-11-14T15:28:55.922Z"
    },
    "lines": [
      {
        "bg": "00269",
        "bgEffect": "fade",
        "bgEffectTime": 600,
        "bgm": "003",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 350,
        "_meta": {
          "uid": "setup_bg_001",
          "x-autoGenerated": true,
          "note": "场景初始化：BG 00269 / BGM 003"
        }
      },
      {
        "charLabel": "amana",
        "charType": "characters",
        "charId": "014",
        "clothId": "014",
        "charCategory": "stand",
        "charPosition": {
          "x": 360,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "smile1",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "blank",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_in_amana_002",
          "x-autoGenerated": true,
          "note": "初始机位 #1 登场 (amana, hana)"
        }
      },
      {
        "charLabel": "hana",
        "charType": "characters",
        "charId": "027",
        "clothId": "027",
        "charCategory": "stand",
        "charPosition": {
          "x": 776,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "smile2",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_wait_s",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 200,
        "_meta": {
          "uid": "cut_in_hana_003",
          "x-autoGenerated": true,
          "note": "初始机位 #1 登场 (amana, hana)"
        }
      },
      {
        "speaker": "甘奈",
        "text": "プロデューサーさん見て☆ 海がキラキラだよ！甘奈、羽那ちゃんと探検できて超ワクワクしてるんだ♪",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "amana",
        "charType": "characters",
        "charId": "014",
        "clothId": "014",
        "charCategory": "stand",
        "charPosition": {
          "x": 360,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charAnim1": "smile1",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s1_r01",
          "zh": "制作人先生快看☆ 大海闪闪发光哦！甘奈能和羽那酱一起探险，心里超激动的♪",
          "speakerZh": "大崎甘奈",
          "surfaceEmotion": "joy_bright",
          "innerEmotion": "trust_warm",
          "vocalTone": "warm_soft",
          "note": "[节拍 1] 码头偷溜登上无人荒岛浅滩",
          "x-beatId": "beat_1",
          "x-beatTitle": "偷溜登岛与游艇离开"
        }
      },
      {
        "speaker": "羽那",
        "text": "わぁ……！ほんとですね甘奈さん！ボートを覗くつもりが、こんな綺麗な島に着いちゃいました～！",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "hana",
        "charType": "characters",
        "charId": "027",
        "clothId": "027",
        "charCategory": "stand",
        "charPosition": {
          "x": 776,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charAnim1": "smile2",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s1_r02",
          "zh": "哇啊……！真的呢甘奈小姐！本来只是想看看小船，没想到漂到了这么漂亮的小岛上～！",
          "speakerZh": "铃木羽那",
          "surfaceEmotion": "joy_bright",
          "innerEmotion": "trust_warm",
          "vocalTone": "warm_soft",
          "x-beatId": "beat_1",
          "x-beatTitle": "偷溜登岛与游艇离开"
        }
      },
      {
        "speaker": "プロデューサー",
        "text": "ふたりとも無事でよかった……！迎えの船が来るまで、ヤシの葉で日陰を作って休もう。",
        "textFrame": "001",
        "textCtrl": "p",
        "_meta": {
          "uid": "s1_r03",
          "zh": "你们两个都平安无事真是太好了……！在救援船赶来之前，我们先用椰叶搭个遮阳棚休息吧。",
          "speakerZh": "制作人",
          "note": "[节拍 2] 制作人赶到，提议搭建树叶遮阳棚",
          "x-beatId": "beat_2",
          "x-beatTitle": "与制作人合力搭椰叶棚"
        }
      },
      {
        "speaker": "甘奈",
        "text": "あっ、正午の日差しがジリジリしてきたかも！プロデューサーさん、甘奈も葉っぱ集めてくるね☆",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "amana",
        "charType": "characters",
        "charId": "014",
        "clothId": "014",
        "charCategory": "stand",
        "charPosition": {
          "x": 360,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charAnim1": "surp1",
        "charAnim2": "face_surp",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_surp",
        "lip": "lip_surp",
        "_meta": {
          "uid": "s1_r04",
          "zh": "啊，正午的阳光变得火辣辣的了！制作人先生，甘奈也去帮忙收集大椰子叶哦☆",
          "speakerZh": "大崎甘奈",
          "surfaceEmotion": "surprise_wide",
          "innerEmotion": "alert_spark",
          "vocalTone": "bright_pop",
          "x-beatId": "beat_2",
          "x-beatTitle": "与制作人合力搭椰叶棚"
        }
      },
      {
        "speaker": "羽那",
        "text": "あたしも行きますっ！大きな葉っぱを重ねたら、秘密基地みたいで絶対楽しいですよ～！",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "hana",
        "charType": "characters",
        "charId": "027",
        "clothId": "027",
        "charCategory": "stand",
        "charPosition": {
          "x": 776,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charAnim1": "yes",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s1_r05",
          "zh": "我也要去！要是把大大的叶子叠起来，肯定像秘密基地一样超有趣的哦～！",
          "speakerZh": "铃木羽那",
          "surfaceEmotion": "smile_gentle",
          "innerEmotion": "performative_sweet",
          "vocalTone": "sweet_performative",
          "x-beatId": "beat_2",
          "x-beatTitle": "与制作人合力搭椰叶棚"
        }
      },
      {
        "speaker": "甘奈",
        "text": "えへへ、テント完成☆ あっ、羽那ちゃんの肩が赤くなってる！甘奈の日焼け止め、一緒に塗ろっか♪",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "amana",
        "charType": "characters",
        "charId": "014",
        "clothId": "014",
        "charCategory": "stand",
        "charPosition": {
          "x": 360,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charAnim1": "shy1",
        "charAnim2": "face_shy",
        "charAnim4": "eye_right",
        "charLipAnim": "lip_shy",
        "lip": "lip_shy",
        "_meta": {
          "uid": "s1_r06",
          "zh": "嘿嘿，树叶帐篷完成啦☆ 啊，羽那酱的肩膀有点晒红了！来用甘奈的防晒霜，我们一起涂吧♪",
          "speakerZh": "大崎甘奈",
          "surfaceEmotion": "shy_flustered",
          "innerEmotion": "affection_bashful",
          "vocalTone": "breath_flutter",
          "note": "[节拍 3] 正午防晒互动，苦中作乐",
          "x-beatId": "beat_3",
          "x-beatTitle": "正午晒红肩膀与涂防晒霜"
        }
      },
      {
        "speaker": "羽那",
        "text": "わぁ、ありがとうございます甘奈さん！プロデューサーさんも隣でちゃんと涼んでくださいね！",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "hana",
        "charType": "characters",
        "charId": "027",
        "clothId": "027",
        "charCategory": "stand",
        "charPosition": {
          "x": 776,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charAnim1": "shy2",
        "charAnim2": "face_shy",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_shy",
        "lip": "lip_shy",
        "_meta": {
          "uid": "s1_r07",
          "zh": "哇，谢谢甘奈小姐！制作人先生也要在我们身边好好乘凉休息哦！",
          "speakerZh": "铃木羽那",
          "surfaceEmotion": "shy_flustered",
          "innerEmotion": "affection_bashful",
          "vocalTone": "breath_flutter",
          "x-beatId": "beat_3",
          "x-beatTitle": "正午晒红肩膀与涂防晒霜"
        }
      },
      {
        "textFrame": "off",
        "bgm": "off",
        "waitType": "time",
        "waitTime": 700,
        "_meta": {
          "uid": "end_004",
          "x-autoGenerated": true,
          "note": "演出结束收尾"
        }
      }
    ]
  },
  "scene_02_signal": {
    "$schema": "../../../schema/scproj.schema.json",
    "format": "scproj",
    "formatVersion": 2,
    "meta": {
      "id": "scene_02_signal",
      "cat": "custom",
      "title": "第2幕・ビーチのSOSサイン（分岐）",
      "titleZh": "第 2 幕 · 海岸求救信号（分支）",
      "origin": "custom",
      "lang": {
        "primary": "ja",
        "translations": [
          "zh"
        ]
      },
      "cast": [
        "amana",
        "hana"
      ],
      "characters": {
        "amana": {
          "charType": "characters",
          "charId": "014",
          "x-clothId": "014",
          "charCategory": "stand",
          "name": "甘奈",
          "nameZh": "大崎甘奈"
        },
        "hana": {
          "charType": "characters",
          "charId": "027",
          "x-clothId": "027",
          "charCategory": "stand",
          "name": "羽那",
          "nameZh": "铃木羽那"
        }
      },
      "authors": [
        {
          "name": "283 Fan-Story Studio",
          "role": "writer"
        }
      ],
      "createdAt": "2026-11-12T12:00:00Z",
      "updatedAt": "2026-11-14T15:28:55.944Z"
    },
    "lines": [
      {
        "bg": "00008",
        "bgEffect": "fade",
        "bgEffectTime": 600,
        "bgm": "021",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 350,
        "_meta": {
          "uid": "setup_bg_001",
          "x-autoGenerated": true,
          "note": "场景初始化：BG 00008 / BGM 021"
        }
      },
      {
        "charLabel": "amana",
        "charType": "characters",
        "charId": "014",
        "clothId": "014",
        "charCategory": "stand",
        "charPosition": {
          "x": 360,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "surp2",
        "charAnim2": "face_surp",
        "charAnim4": "eye_front",
        "charLipAnim": "blank",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_in_amana_002",
          "x-autoGenerated": true,
          "note": "初始机位 #1 登场 (amana, hana)"
        }
      },
      {
        "charLabel": "hana",
        "charType": "characters",
        "charId": "027",
        "clothId": "027",
        "charCategory": "stand",
        "charPosition": {
          "x": 776,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "surp1",
        "charAnim2": "face_surp",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_wait_s",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 200,
        "_meta": {
          "uid": "cut_in_hana_003",
          "x-autoGenerated": true,
          "note": "初始机位 #1 登场 (amana, hana)"
        }
      },
      {
        "speaker": "甘奈",
        "text": "プロデューサーさん、羽那ちゃん！水平線を見て！白いボートがこっちに向かってきてるよ☆",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "amana",
        "charType": "characters",
        "charId": "014",
        "clothId": "014",
        "charCategory": "stand",
        "charPosition": {
          "x": 360,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charAnim1": "surp2",
        "charAnim2": "face_surp",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_surp",
        "lip": "lip_surp",
        "_meta": {
          "uid": "s2_r01",
          "zh": "制作人先生、羽那酱！快看那边的海平线！有一艘白色快艇正朝这边开过来哦☆",
          "speakerZh": "大崎甘奈",
          "surfaceEmotion": "surprise_wide",
          "innerEmotion": "alert_spark",
          "vocalTone": "bright_pop",
          "note": "[节拍 1] 发现远方海平线上的搜救船",
          "x-beatId": "beat_1",
          "x-beatTitle": "发现远方海平线搜救船影"
        }
      },
      {
        "speaker": "羽那",
        "text": "ほんとだぁ……！プロデューサーさん、あたしたちがここにいるって合図を送らなきゃですっ！",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "hana",
        "charType": "characters",
        "charId": "027",
        "clothId": "027",
        "charCategory": "stand",
        "charPosition": {
          "x": 776,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charAnim1": "surp1",
        "charAnim2": "face_surp",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_surp",
        "lip": "lip_surp",
        "_meta": {
          "uid": "s2_r02",
          "zh": "真的耶……！制作人先生，我们得马上发出信号，让大家知道我们在这里才行！",
          "speakerZh": "铃木羽那",
          "surfaceEmotion": "surprise_wide",
          "innerEmotion": "alert_spark",
          "vocalTone": "bright_pop",
          "x-beatId": "beat_1",
          "x-beatTitle": "发现远方海平线搜救船影"
        }
      },
      {
        "speaker": "プロデューサー",
        "text": "よし、遠くの船からでも一目で気づいてもらえるように、一番目立つ合図を出そう！",
        "textFrame": "001",
        "textCtrl": "p",
        "_meta": {
          "uid": "s2_r03",
          "zh": "好，为了让远处的船只一眼就能注意到我们，用最醒目的方式发出求救信号吧！",
          "speakerZh": "制作人",
          "note": "[分支选项] 选择求救信号方式",
          "x-beatId": "beat_2",
          "x-beatTitle": "海岸求救信号分支抉择",
          "selectZh": "在沙滩上画出超巨型可爱的SOS涂鸦！"
        },
        "select": "砂浜に超巨大なSOSイラストを描こう！",
        "nextLabel": "branch_sos"
      },
      {
        "select": "ヤシの葉を大きく振って全力でアピールしよう！",
        "nextLabel": "branch_palm",
        "_meta": {
          "uid": "sel_004",
          "selectZh": "举起大椰子叶全力挥舞呼喊！"
        }
      },
      {
        "label": "branch_sos",
        "speaker": "甘奈",
        "text": "賛成っ☆ 甘奈、SOSの周りにハートも大きく描いちゃうね！これなら絶対見つけてもらえるよ♪",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "amana",
        "charType": "characters",
        "charId": "014",
        "clothId": "014",
        "charCategory": "stand",
        "charPosition": {
          "x": 360,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charAnim1": "smile2",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s2_r04",
          "zh": "赞成☆ 甘奈还要在SOS周围画上大大的爱心哦！这样大家肯定一眼就能找到我们啦♪",
          "speakerZh": "大崎甘奈",
          "surfaceEmotion": "joy_bright",
          "innerEmotion": "trust_warm",
          "vocalTone": "warm_soft",
          "note": "[分支A: branch_sos] 沙滩巨型SOS涂鸦路线",
          "x-beatId": "beat_2",
          "x-beatTitle": "海岸求救信号分支抉择"
        },
        "nextLabel": "signal_success"
      },
      {
        "label": "branch_palm",
        "speaker": "羽那",
        "text": "はいっ！あたし、大きなヤシの葉っぱを持ってブンブン振っちゃいます！おーい、こっちですよ～！",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "hana",
        "charType": "characters",
        "charId": "027",
        "clothId": "027",
        "charCategory": "stand",
        "charPosition": {
          "x": 776,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charAnim1": "smile1",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s2_r05",
          "zh": "好呀！我来拿起大大的椰子叶使劲挥舞！喂——我们在这里哟～！",
          "speakerZh": "铃木羽那",
          "surfaceEmotion": "smile_gentle",
          "innerEmotion": "performative_sweet",
          "vocalTone": "sweet_performative",
          "note": "[分支B: branch_palm] 挥舞椰叶呼喊路线",
          "x-beatId": "beat_2",
          "x-beatTitle": "海岸求救信号分支抉择"
        },
        "nextLabel": "signal_success"
      },
      {
        "label": "signal_success",
        "speaker": "甘奈",
        "text": "あっ、船のライトが光ったよ！プロデューサーさん、甘奈たちの合図がちゃんと届いたんだね☆",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "amana",
        "charType": "characters",
        "charId": "014",
        "clothId": "014",
        "charCategory": "stand",
        "charPosition": {
          "x": 360,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charAnim1": "yes",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s2_r06",
          "zh": "啊，船上的探照灯亮起来了！制作人先生，甘奈我们的信号已经稳稳传过去了呢☆",
          "speakerZh": "大崎甘奈",
          "surfaceEmotion": "smile_gentle",
          "innerEmotion": "performative_sweet",
          "vocalTone": "sweet_performative",
          "note": "[汇合: signal_success] 搜救船回应信号",
          "x-beatId": "beat_3",
          "x-beatTitle": "探照灯回应与海风欢呼"
        }
      },
      {
        "speaker": "羽那",
        "text": "やったぁ！船の上にみんなの姿が見えますよ、プロデューサーさん！",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "hana",
        "charType": "characters",
        "charId": "027",
        "clothId": "027",
        "charCategory": "stand",
        "charPosition": {
          "x": 776,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charAnim1": "smile2",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s2_r07",
          "zh": "太棒啦！已经能看到船上大家的身影了哦，制作人先生！",
          "speakerZh": "铃木羽那",
          "surfaceEmotion": "joy_bright",
          "innerEmotion": "trust_warm",
          "vocalTone": "warm_soft",
          "x-beatId": "beat_3",
          "x-beatTitle": "探照灯回应与海风欢呼"
        }
      },
      {
        "textFrame": "off",
        "bgm": "off",
        "waitType": "time",
        "waitTime": 700,
        "_meta": {
          "uid": "end_005",
          "x-autoGenerated": true,
          "note": "演出结束收尾"
        }
      }
    ]
  },
  "scene_03_rescue": {
    "$schema": "../../../schema/scproj.schema.json",
    "format": "scproj",
    "formatVersion": 2,
    "meta": {
      "id": "scene_03_rescue",
      "cat": "custom",
      "title": "第3幕・水平線の全員レスキュー",
      "titleZh": "第 3 幕 · 海平线上的全员大营救",
      "origin": "custom",
      "lang": {
        "primary": "ja",
        "translations": [
          "zh"
        ]
      },
      "cast": [
        "mano",
        "hiori",
        "meguru",
        "amana",
        "tenka",
        "hana"
      ],
      "characters": {
        "mano": {
          "charType": "characters",
          "charId": "001",
          "x-clothId": "001",
          "charCategory": "stand",
          "name": "真乃",
          "nameZh": "樱木真乃"
        },
        "hiori": {
          "charType": "characters",
          "charId": "002",
          "x-clothId": "002",
          "charCategory": "stand",
          "name": "灯織",
          "nameZh": "风野灯织"
        },
        "meguru": {
          "charType": "characters",
          "charId": "003",
          "x-clothId": "003",
          "charCategory": "stand",
          "name": "めぐる",
          "nameZh": "八宫巡"
        },
        "amana": {
          "charType": "characters",
          "charId": "014",
          "x-clothId": "014",
          "charCategory": "stand",
          "name": "甘奈",
          "nameZh": "大崎甘奈"
        },
        "tenka": {
          "charType": "characters",
          "charId": "015",
          "x-clothId": "015",
          "charCategory": "stand",
          "name": "甜花",
          "nameZh": "大崎甜花"
        },
        "hana": {
          "charType": "characters",
          "charId": "027",
          "x-clothId": "027",
          "charCategory": "stand",
          "name": "羽那",
          "nameZh": "铃木羽那"
        }
      },
      "authors": [
        {
          "name": "283 Fan-Story Studio",
          "role": "writer"
        }
      ],
      "createdAt": "2026-11-12T12:00:00Z",
      "updatedAt": "2026-11-14T15:28:55.972Z"
    },
    "lines": [
      {
        "bg": "00271",
        "bgEffect": "fade",
        "bgEffectTime": 600,
        "bgm": "0007",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 350,
        "_meta": {
          "uid": "setup_bg_001",
          "x-autoGenerated": true,
          "note": "场景初始化：BG 00271 / BGM 0007"
        }
      },
      {
        "charLabel": "mano",
        "charType": "characters",
        "charId": "001",
        "clothId": "001",
        "charCategory": "stand",
        "charPosition": {
          "x": 240,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "surp1",
        "charAnim2": "face_surp",
        "charAnim4": "eye_front",
        "charLipAnim": "blank",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_in_mano_002",
          "x-autoGenerated": true,
          "note": "初始机位 #1 登场 (mano, hiori, meguru)"
        }
      },
      {
        "charLabel": "hiori",
        "charType": "characters",
        "charId": "002",
        "clothId": "002",
        "charCategory": "stand",
        "charPosition": {
          "x": 568,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "wait1",
        "charAnim2": "face_serious",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_wait_s",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_in_hiori_003",
          "x-autoGenerated": true,
          "note": "初始机位 #1 登场 (mano, hiori, meguru)"
        }
      },
      {
        "charLabel": "meguru",
        "charType": "characters",
        "charId": "003",
        "clothId": "003",
        "charCategory": "stand",
        "charPosition": {
          "x": 896,
          "y": 610,
          "order": 2
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "smile1",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_wait_s",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 200,
        "_meta": {
          "uid": "cut_in_meguru_004",
          "x-autoGenerated": true,
          "note": "初始机位 #1 登场 (mano, hiori, meguru)"
        }
      },
      {
        "speaker": "真乃",
        "text": "プロデューサーさん、甘奈ちゃん、羽那ちゃん！よかったぁ……わたしたち、ずっと探していたんですっ！",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "mano",
        "charType": "characters",
        "charId": "001",
        "clothId": "001",
        "charCategory": "stand",
        "charPosition": {
          "x": 240,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charAnim1": "surp1",
        "charAnim2": "face_surp",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_trouble",
        "lip": "lip_trouble",
        "_meta": {
          "uid": "s3_r01",
          "zh": "制作人先生、甘奈酱、羽那酱！太好了……我们一直在到处找大家呢！",
          "speakerZh": "樱木真乃",
          "surfaceEmotion": "surprise_wide",
          "innerEmotion": "alert_spark",
          "vocalTone": "bright_pop",
          "note": "[机位A: 真乃/灯织/缭 3人同台] 救援小队靠岸登场",
          "x-beatId": "beat_1",
          "x-beatTitle": "救援艇靠岸与3人救援组呼喊"
        }
      },
      {
        "speaker": "灯織",
        "text": "プロデューサー、怪我はありませんか？真乃、めぐる、まずは冷たい水とタオルを渡しましょう。",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "hiori",
        "charType": "characters",
        "charId": "002",
        "clothId": "002",
        "charCategory": "stand",
        "charPosition": {
          "x": 568,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charAnim1": "wait1",
        "charAnim2": "face_serious",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s3_r02",
          "zh": "制作人，大家没有受伤吧？真乃、缭，先把冰水和毛巾递给她们两位吧。",
          "speakerZh": "风野灯织",
          "surfaceEmotion": "calm_neutral",
          "innerEmotion": "resolve_quiet",
          "vocalTone": "calm_even",
          "x-beatId": "beat_1",
          "x-beatTitle": "救援艇靠岸与3人救援组呼喊"
        }
      },
      {
        "speaker": "めぐる",
        "text": "おーいっ！砂浜の合図、船からでもすっごく目立ってたよ！無事でよかったね、プロデューサー！",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "meguru",
        "charType": "characters",
        "charId": "003",
        "clothId": "003",
        "charCategory": "stand",
        "charPosition": {
          "x": 896,
          "y": 610,
          "order": 2
        },
        "charScale": 1,
        "charAnim1": "smile1",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s3_r03",
          "zh": "喂——！沙滩上的信号，就算在船上也超级显眼哦！大家平安无事真是太好啦，制作人！",
          "speakerZh": "八宫巡",
          "surfaceEmotion": "joy_bright",
          "innerEmotion": "trust_warm",
          "vocalTone": "warm_soft",
          "x-beatId": "beat_1",
          "x-beatTitle": "救援艇靠岸与3人救援组呼喊"
        }
      },
      {
        "charLabel": "mano",
        "charScale": 1,
        "charEffect": {
          "type": "to",
          "alpha": 0,
          "time": 120
        },
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_out_mano_005",
          "x-autoGenerated": true,
          "note": "分镜切换淡出：樱木真乃"
        }
      },
      {
        "charLabel": "hiori",
        "charScale": 1,
        "charEffect": {
          "type": "to",
          "alpha": 0,
          "time": 120
        },
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_out_hiori_006",
          "x-autoGenerated": true,
          "note": "分镜切换淡出：风野灯织"
        }
      },
      {
        "charLabel": "meguru",
        "charScale": 1,
        "charEffect": {
          "type": "to",
          "alpha": 0,
          "time": 120
        },
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 120,
        "_meta": {
          "uid": "cut_out_meguru_007",
          "x-autoGenerated": true,
          "note": "分镜切换淡出：八宫巡"
        }
      },
      {
        "charLabel": "amana",
        "charType": "characters",
        "charId": "014",
        "clothId": "014",
        "charCategory": "stand",
        "charPosition": {
          "x": 240,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "smile1",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "blank",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_in_amana_008",
          "x-autoGenerated": true,
          "note": "自动切换机位 #2（最大3人同台限制）"
        }
      },
      {
        "charLabel": "tenka",
        "charType": "characters",
        "charId": "015",
        "clothId": "015",
        "charCategory": "stand",
        "charPosition": {
          "x": 568,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "surp1",
        "charAnim2": "face_surp",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_wait_s",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_in_tenka_009",
          "x-autoGenerated": true,
          "note": "自动切换机位 #2（最大3人同台限制）"
        }
      },
      {
        "charLabel": "hana",
        "charType": "characters",
        "charId": "027",
        "clothId": "027",
        "charCategory": "stand",
        "charPosition": {
          "x": 896,
          "y": 610,
          "order": 2
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "smile2",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_wait_s",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 200,
        "_meta": {
          "uid": "cut_in_hana_010",
          "x-autoGenerated": true,
          "note": "自动切换机位 #2（最大3人同台限制）"
        }
      },
      {
        "speaker": "甜花",
        "text": "なーちゃん……！無事でよかったぁ……！甜花、心配でずっと胸がドキドキしてたの……！",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "tenka",
        "charType": "characters",
        "charId": "015",
        "clothId": "015",
        "charCategory": "stand",
        "charPosition": {
          "x": 568,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charAnim1": "surp1",
        "charAnim2": "face_surp",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_surp",
        "lip": "lip_surp",
        "_meta": {
          "uid": "s3_r04",
          "zh": "甘奈酱……！平安无事真是太好了……！甜花因为太担心，心一直扑通扑通跳个不停……！",
          "speakerZh": "大崎甜花",
          "surfaceEmotion": "surprise_wide",
          "innerEmotion": "alert_spark",
          "vocalTone": "bright_pop",
          "note": "[机位B: 甘奈/甜花/羽那 3人同台] 自动淡出前3人，切入荒岛重逢组",
          "x-beatId": "beat_2",
          "x-beatTitle": "荒岛重逢组姐妹相拥报平安"
        }
      },
      {
        "speaker": "甘奈",
        "text": "甜花ちゃん、ごめんね☆ でもプロデューサーさんと羽那ちゃんが一緒で、甘奈ぜんぜん平気だったよ♪",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "amana",
        "charType": "characters",
        "charId": "014",
        "clothId": "014",
        "charCategory": "stand",
        "charPosition": {
          "x": 240,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charAnim1": "smile1",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s3_r05",
          "zh": "甜花酱，对不起让你担心啦☆ 不过有制作人先生和羽那酱在一起，甘奈完全没事哟♪",
          "speakerZh": "大崎甘奈",
          "surfaceEmotion": "joy_bright",
          "innerEmotion": "trust_warm",
          "vocalTone": "warm_soft",
          "x-beatId": "beat_2",
          "x-beatTitle": "荒岛重逢组姐妹相拥报平安"
        }
      },
      {
        "speaker": "羽那",
        "text": "えへへ、真乃さんたちも甜花さんも、迎えに来てくれてありがとうございます！あたし感激です～！",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "hana",
        "charType": "characters",
        "charId": "027",
        "clothId": "027",
        "charCategory": "stand",
        "charPosition": {
          "x": 896,
          "y": 610,
          "order": 2
        },
        "charScale": 1,
        "charAnim1": "smile2",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s3_r06",
          "zh": "嘿嘿，真乃小姐她们还有甜花小姐，谢谢大家赶来接我们！我真的太感动啦～！",
          "speakerZh": "铃木羽那",
          "surfaceEmotion": "smile_gentle",
          "innerEmotion": "performative_sweet",
          "vocalTone": "sweet_performative",
          "x-beatId": "beat_2",
          "x-beatTitle": "荒岛重逢组姐妹相拥报平安"
        }
      },
      {
        "speaker": "甜花",
        "text": "にへへ……プロデューサーさん、ふたりを守ってくれてありがとう……。帰ったらアイス食べよ……♪",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "tenka",
        "charType": "characters",
        "charId": "015",
        "clothId": "015",
        "charCategory": "stand",
        "charPosition": {
          "x": 568,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charAnim1": "smile1",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s3_r07",
          "zh": "嘿嘿……谢谢制作人先生保护了她们两位……。回去之后，大家一起吃冰淇淋吧……♪",
          "speakerZh": "大崎甜花",
          "surfaceEmotion": "joy_bright",
          "innerEmotion": "trust_warm",
          "vocalTone": "warm_soft",
          "x-beatId": "beat_2",
          "x-beatTitle": "荒岛重逢组姐妹相拥报平安"
        }
      },
      {
        "charLabel": "amana",
        "charScale": 1,
        "charEffect": {
          "type": "to",
          "alpha": 0,
          "time": 120
        },
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_out_amana_011",
          "x-autoGenerated": true,
          "note": "分镜切换淡出：大崎甘奈"
        }
      },
      {
        "charLabel": "tenka",
        "charScale": 1,
        "charEffect": {
          "type": "to",
          "alpha": 0,
          "time": 120
        },
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_out_tenka_012",
          "x-autoGenerated": true,
          "note": "分镜切换淡出：大崎甜花"
        }
      },
      {
        "charLabel": "hana",
        "charScale": 1,
        "charEffect": {
          "type": "to",
          "alpha": 0,
          "time": 120
        },
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 120,
        "_meta": {
          "uid": "cut_out_hana_013",
          "x-autoGenerated": true,
          "note": "分镜切换淡出：铃木羽那"
        }
      },
      {
        "charLabel": "mano",
        "charType": "characters",
        "charId": "001",
        "clothId": "001",
        "charCategory": "stand",
        "charPosition": {
          "x": 240,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "surp1",
        "charAnim2": "face_surp",
        "charAnim4": "eye_front",
        "charLipAnim": "blank",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_in_mano_014",
          "x-autoGenerated": true,
          "note": "自动切换机位 #1（最大3人同台限制）"
        }
      },
      {
        "charLabel": "hiori",
        "charType": "characters",
        "charId": "002",
        "clothId": "002",
        "charCategory": "stand",
        "charPosition": {
          "x": 568,
          "y": 610,
          "order": 1
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "wait1",
        "charAnim2": "face_serious",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_wait_s",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 1,
        "_meta": {
          "uid": "cut_in_hiori_015",
          "x-autoGenerated": true,
          "note": "自动切换机位 #1（最大3人同台限制）"
        }
      },
      {
        "charLabel": "meguru",
        "charType": "characters",
        "charId": "003",
        "clothId": "003",
        "charCategory": "stand",
        "charPosition": {
          "x": 896,
          "y": 610,
          "order": 2
        },
        "charScale": 1,
        "charEffect": {
          "type": "from",
          "alpha": 0,
          "time": 200
        },
        "charAnim1": "smile1",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_wait_s",
        "textFrame": "off",
        "waitType": "time",
        "waitTime": 200,
        "_meta": {
          "uid": "cut_in_meguru_016",
          "x-autoGenerated": true,
          "note": "自动切换机位 #1（最大3人同台限制）"
        }
      },
      {
        "speaker": "真乃",
        "text": "ふふっ、夕焼けの海が綺麗ですね……！プロデューサーさん、みんなで帰れるのが一番の宝物ですっ。",
        "textFrame": "001",
        "textCtrl": "p",
        "charLabel": "mano",
        "charType": "characters",
        "charId": "001",
        "clothId": "001",
        "charCategory": "stand",
        "charPosition": {
          "x": 240,
          "y": 610,
          "order": 0
        },
        "charScale": 1,
        "charAnim1": "smile2",
        "charAnim2": "face_smile",
        "charAnim4": "eye_front",
        "charLipAnim": "lip_smile",
        "lip": "lip_smile",
        "_meta": {
          "uid": "s3_r08",
          "zh": "呵呵，夕阳下的大海真漂亮呀……！制作人先生，大家能像这样一起回家，就是最珍贵的宝物了。",
          "speakerZh": "樱木真乃",
          "surfaceEmotion": "joy_bright",
          "innerEmotion": "trust_warm",
          "vocalTone": "warm_soft",
          "note": "[机位A切回] 夕阳下的全员团圆收尾",
          "x-beatId": "beat_3",
          "x-beatTitle": "海平线晚霞下的全员团圆终幕"
        }
      },
      {
        "textFrame": "off",
        "bgm": "off",
        "waitType": "time",
        "waitTime": 700,
        "_meta": {
          "uid": "end_017",
          "x-autoGenerated": true,
          "note": "演出结束收尾"
        }
      }
    ]
  }
};
  /* ISLAND_PACK_END */

  seLibrary.forEach(s => { if (s.category && !s.cat) s.cat = s.category; });
  window.SC_MOCK = {
    packs: [
      { id: 'island_survival_pack', scenesMap: islandScenesMap, pack: islandPack, story: islandStory, assetBase: '/examples/scproj/rooftop_after_rain.scpack/' },
      { id: 'sc_feature_showcase', pack: showcasePack, story: showcaseStory, assetBase: '/examples/scproj/rooftop_after_rain.scpack/' },
      { id: 'rooftop_after_rain', pack: rooftopPack, story: rooftopStory, assetBase: '/examples/scproj/rooftop_after_rain.scpack/' },
      { id: 'after_school_rehearsal', pack: rehearsalPack, story: rehearsalStory, assetBase: null },
      { id: 'my_new_pack', pack: blankPack, story: blankStory, assetBase: null }
    ],
    charInfo, addressMatrix, readingRules, macros, bgLibrary, bgSynonyms, bgmLibrary, seCategories, seLibrary, voiceSnippets, refWavMap, actionCards,
    emotionStrata, motionCategories, motionPresetCatalog, faceExpressionCatalog, gazeCatalog, skeletonWhitelist, planarMovePresets,
    emotions, tones, eras, faceLabels, promptPresets, museBank,
    LINE_LIMIT: 54,
    PRODUCER_NAMES: ['プロデューサー', '制作人', 'P']
  };
})();
