/*!
 * Shiny Colors Script Polisher Core Engine (polisher-core.js)
 * Extracted from projects/taibon/台本润色器.html (v1.8) + Phase 1 Studio Extensions.
 * Zero-DOM UMD module supporting Node.js (CommonJS) and Browser (window.ScPolisher).
 */
(function (root, factory) {
  const browserWin = typeof window !== 'undefined' && window ? window : null;
  if (typeof module === 'object' && module.exports) {
    const exported = factory(browserWin || root || globalThis);
    if (browserWin) browserWin.ScPolisher = exported;
    module.exports = exported;
  } else if (typeof define === 'function' && define.amd) {
    define([], function () {
      const exported = factory(browserWin || root || globalThis);
      if (browserWin) browserWin.ScPolisher = exported;
      return exported;
    });
  } else {
    const g = browserWin || root || globalThis;
    const exported = factory(g);
    g.ScPolisher = exported;
    if (root && typeof root === 'object') root.ScPolisher = exported;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this)), function (globalRoot) {
'use strict';

const STORAGE_KEYS = {
  codes: 'taibon.codes.v1',
  rules: 'taibon.rules.v1',
  scene: 'taibon.scene.v1',
  sceneType: 'taibon.sceneType.v1'
};

/* 本场类型：对应 cards/data 的 by_category 键（各角色覆盖 7–9 种）。 */
const SCENE_TYPES = Object.freeze(['仕事', '活动', '特殊', 'SCSP', '会話', '約束', '約束結果', 'テレビ', '主页']);
function sceneTypeStats(card, type = state.sceneType) {
  const t = String(type || '').trim();
  if (!t || !card || !card.by_category) return null;
  const row = card.by_category[t];
  if (!row || !Number(row.lines)) return null;
  return row;
}
const DEFAULT_CODE_MAP = Object.freeze({
  mano: '真乃', hio: '灯織', meg: 'めぐる', kog: '恋鐘', mami: '摩美々',
  sak: '咲耶', yui: '結華', kir: '霧子', kaho: '果穂', chiyo: '智代子',
  juri: '樹里', rin: '凛世', natsu: '夏葉', amn: '甘奈', tenka: '甜花',
  chiyuki: '千雪', ash: 'あさひ', fyk: '冬優子', mei: '愛依', toru: '透',
  mado: '円香', koito: '小糸', hinana: '雛菜', nichika: 'にちか', miko: '美琴',
  luca: 'ルカ', hana: '羽那', haru: 'はるき', hazu: 'はづき'
});

const RULE_DEFS = [
  { key: 'addressReplace', label: '称呼替换', desc: '他名 → 习惯称呼' },
  { key: 'addressCheck', label: '称呼校验', desc: '精确匹配；表外形式标红' },
  { key: 'firstPerson', label: '一人称校验', desc: '人称不符警告' },
  { key: 'endings', label: '句尾校验', desc: '只警告不改写' },
  { key: 'symbols', label: '符号统计', desc: '密度对比基准' },
  { key: 'length', label: '句长检查', desc: 'P90 × 2 提示' },
  { key: 'speed', label: '语速估算', desc: '字数 ÷ cps' },
  { key: 'traits', label: '特质配额', desc: '按 traits 算上限' },
  { key: 'firstPersonFix', label: '一人称校正', desc: '误用人称→角色自称' },
  { key: 'enriched', label: '参考 enriched', desc: '状态切换 / 底线' },
  { key: 'ruleCards', label: '判断规则', desc: 'merged §1 拼进 Prompt' },
  { key: 'ruleFirst', label: '规则优先', desc: '状态切换不重复（省 token）' },
  { key: 'textBox', label: '文本框上限', desc: '单句超 54 字或超 3 行标黄' },
  { key: 'fullAddressMatrix', label: '全量28×28称呼表', desc: '无语料对白时回退 28×28 全矩阵' }
];

const DEFAULT_RULES = Object.freeze({
  ...Object.fromEntries(RULE_DEFS.map(r => [r.key, true])),
  firstPersonFix: false,
  ruleFirst: false,
  fullAddressMatrix: false
});
const MAX_TEXTBOX_CHARS = 54;
const MAX_TEXTBOX_LINES = 3;
const BASELINE_CPS = 4.79;
const REQUIRED_SYMBOLS = ['…', '！', '？', '～', '─', '♪', '☆', '♡'];
const HONORIFICS = ['ちゃん', 'さん', 'くん', '君', '様', 'さま', '氏', '先輩', '後輩', '殿', 'ちん', 'たん', 'ぴょん', '姉さん', '兄さん'];
// 「自分」故意不收：日语里它多是「自己／你」（自分が濡れる＝你淋湿），
// 29 个角色里也没有人用它当一人称，收进来只会制造误报。
const FIRST_PERSON_FORMS = ['わたくし', 'わたし', 'あたし', 'アタシ', 'あたい', 'アタイ', 'うち', '僕', 'ぼく', '俺', 'おれ', '私', 'わし'];
const FIRST_PERSON_FAMILY = {
  '私': 'わたし', 'わたし': 'わたし', 'わたくし': 'わたし',
  'あたし': 'あたし', 'あたい': 'あたし', 'アタシ': 'あたし', 'アタイ': 'あたし',
  'うち': 'うち',
  '僕': '僕', 'ぼく': '僕',
  '俺': '俺', 'おれ': '俺',
  '自分': '自分', 'わし': 'わし'
};

const TRAIT_PATTERNS = {
  '毒舌': /バカ|ばか|馬鹿|あほ|アホ|アホ毛|鈍|鈍い|使えない|いらない|要らない|うるさい|うざ|めんどくさ|面倒くさ|ムカつ|むかつ|嫌い|きらい|変態|図々し|調子乗|調子の|消え|下手|ばーか|デリカシー|空気読|遅い|邪魔|しょーもな|くだらな|残念|マヌケ|まぬけ|ドジ|どじ/,
  '嘴硬心软': /別に|べつに|勘違い|かんちがい|仕方な|しかたな|心配|一応|いちおう|本当は|ほんとは|照れ|優し|やさし|ありがと|気にし|手伝|てつだ|大丈夫|だいじょうぶ|寂し|さびし|嫌じゃ|嫌いじゃ|恥ずかし/,
  '自贬': /どうせ|私なんか|わたしなんか|僕なんか|ぼくなんか|俺なんか|価値|役に立た|役立た|ダメ|だめ|申し訳|もうしわけ|ごめん|迷惑|失敗|へたくそ|下手くそ|情けな|最低|さいてい|消えたい|いなく|生まれ変わり/,
  '冷淡': /興味ない|興味ありません|興味がな|どうでもいい|どうでも|別に|べつに|ふーん|ふうん|へえ|そう|知らない|知らな|関係ない|関心ない|どうぞ|ふん|ふぅん|落ち着い|冷静/,
  '傲娇': /別に|べ、別に|勘違い|かんちがい|好きじゃ|嫌いじゃ|嫌じゃ|照れ|ツン|デレ|ありがとう|嬉しくな|うれしくな|バカ|あほ|もう知らない|知らない|しなくていい/,
  '温柔': /ありがと|大丈夫|だいじょうぶ|一緒|いっしょ|味方|応援|おつかれ|無理し|優し|やさし|助け|手伝|守|笑って|そばに|傍に/,
  '努力': /がんば|頑張|努力|練習|れんしゅう|負けな|まけない|挑戦|ちゃんと|もっと|成長|精一杯|全力/,
  '开朗': /楽しい|たのしい|うれしい|嬉しい|やった|わーい|わあ|元気|げんき|最高|さいこう|行こう|いこう|笑/,
  '元气': /元気|げんき|やるぞ|やった|がんば|頑張|いこう|行こう|楽しい|たのしい|わーい|わあ|全力|はりき|張り切/,
  '天然': /えへへ|えっと|あれ|ふしぎ|不思議|のんびり|ぽわ|ほわ|そうなの|知らなかった|？{2,}/,
  '小恶魔': /冗談|じょうだん|ふふ|からか|意地悪|いじわる|ねえ|ねぇ|内緒|ないしょ|秘密|ひみつ/,
  '自信': /当然|とうぜん|任せて|まかせて|完璧|かんぺき|私に|わたしに|余裕|よゆう|当然でしょ|できる/,
  '冷静': /落ち着|おちつ|別に|客観|事実|たしかに|確かに|まず|分析|判断|沈黙/,
  '礼貌': /です|ます|失礼|しつれい|お願い|おねがい|ありがとうございます|申し訳|よろしく/,
  '深情': /好き|すき|会いたい|あいたい|離れ|はなれ|そばに|傍に|ずっと|約束|やくそく|大切|たいせつ/,
  '照顾人': /大丈夫|だいじょうぶ|無理し|休ん|やすん|食べ|たべ|寒く|あたたか|温か|手伝|てつだ|お茶|おやすみ|気をつけ/,
  '撒娇': /お願い|おねがい|ねえ|ねぇ|だめ|ダメ|行こ|いこ|甘え|つらい|さみし|寂し/,
  '懒散': /ねむ|眠|だる|めんど|面倒|のんびり|ゆっくり|もう無理|起きられ/,
  '直率': /まっすぐ|正直|しょうじき|そのまま|言う|思った|感じた|好き|嫌い/,
  '高傲': /当然|とうぜん|私が|わたしが|一番|いちばん|見てなさい|見て|格好|かっこ/,
  '自由': /自由|じゆう|気まま|きまま|好きに|やりたい|どこでも|飛び出/,
  '自信家': /当然|任せて|完璧|余裕|できる|私に/,
  '热心': /手伝|助け|一緒に|いっしょに|任せて|やろう|やるよ/,
  '成熟': /落ち着|おちつ|大丈夫|だいじょうぶ|世話|せわ|大人|おとな|心配/,
  '認真': /ちゃんと|真面目|まじめ|きちんと|一生懸命|いっしょうけんめい|頑張|努力/,
  '认真': /ちゃんと|真面目|まじめ|きちんと|一生懸命|いっしょうけんめい|頑張|努力/,
  '固执': /絶対|ぜったい|曲げない|まげない|譲らない|ゆずらない|決めた|やめない/,
  '冷淡无口': /……|別に|興味ない|知らない|どうでも|ふーん|そう/,
  '爱操心': /心配|大丈夫|気をつけ|無理し|ちゃんと|忘れ|休ん/,
  '认真努力': /頑張|努力|練習|ちゃんと|一生懸命|負けな/
};

/* 角色元数据（名字 / 假名 / 罗马字 / 自称 / 句尾示例）。
   只做「字段缺失时的兜底」和读音词典，不再用来生成角色卡——
   内置数据见 REAL_CARDS（cards/data/ 下 29 张真实统计卡）。 */
const MOCK_META = [
  { id:'mano', code:'mano', jp:'櫻木真乃', short:'真乃', cn:'樱木真乃', romaji:'Sakuragi Mano', kana:'さくらぎ まの', surname:'櫻木', sk:'さくらぎ', first:'わたし', avg:16.8, speed:4.9, keigo:.05, exclaim:.12, ellipsis:.16, lineCount:8421, unit:'illumination STARS', traits:{'温柔':.16,'天然':.08,'努力':.12}, endings:['ですね','ます','かな','ね','よ'], quote:'真乃、みんなと一緒ならがんばれます。……えへへ、ありがとうございます。' },
  { id:'hiori', code:'hio', jp:'風野灯織', short:'灯織', cn:'风野灯织', romaji:'Kazano Hiori', kana:'かざの ひおり', surname:'風野', sk:'かざの', first:'私', avg:19.6, speed:4.7, keigo:.12, exclaim:.06, ellipsis:.09, lineCount:7980, unit:'illumination STARS', traits:{'认真':.17,'温柔':.09,'毒舌':.025}, endings:['です','ます','ね','よ','かしら','けど'], quote:'無理をしないでください。……あなたが倒れたら、私が困ります。' },
  { id:'meguru', code:'meg', jp:'八宮めぐる', short:'めぐる', cn:'八宫巡', romaji:'Hachimiya Meguru', kana:'はちみや めぐる', surname:'八宮', sk:'はちみや', first:'わたし', avg:15.4, speed:5.1, keigo:.04, exclaim:.18, ellipsis:.12, lineCount:8850, unit:'illumination STARS', traits:{'开朗':.18,'撒娇':.08,'温柔':.08}, endings:['だよ','だね','じゃん','かも','よ','ね','かな'], quote:'めぐる、今日もぜんぜん平気だよ！ みんなで行こう？' },
  { id:'kogane', code:'kog', jp:'月岡恋鐘', short:'恋鐘', cn:'月冈恋钟', romaji:'Tsukioka Kogane', kana:'つきおか こがね', surname:'月岡', sk:'つきおか', first:'うち', avg:17.2, speed:4.8, keigo:.035, exclaim:.2, ellipsis:.12, lineCount:7920, unit:"L'Antica", traits:{'元气':.18,'方言':.12,'努力':.09}, endings:['っちゃん','ばい','たい','ね','よ','けど','けん'], quote:'うちはな、アイドルになるっちゃん！ ばってん、みんなと一緒やけんね。' },
  { id:'mamimi', code:'mami', jp:'田中摩美々', short:'摩美々', cn:'田中摩美美', romaji:'Tanaka Mamimi', kana:'たなか まみみ', surname:'田中', sk:'たなか', first:'私', avg:14.8, speed:4.9, keigo:.05, exclaim:.06, ellipsis:.28, lineCount:7600, unit:"L'Antica", traits:{'小恶魔':.15,'冷淡':.1,'毒舌':.035}, endings:['かな','けど','じゃない','ね','よ','わ','し'], quote:'はぁ……めんどくさい。まみみ、帰っていい？' },
  { id:'sakuya', code:'sak', jp:'白瀬咲耶', short:'咲耶', cn:'白濑咲耶', romaji:'Shirase Sakuya', kana:'しらせ さくや', surname:'白瀬', sk:'しらせ', first:'私', avg:19.1, speed:4.8, keigo:.1, exclaim:.13, ellipsis:.11, lineCount:8500, unit:"L'Antica", traits:{'自信':.17,'温柔':.1,'傲娇':.06}, endings:['わ','のよ','でしょ','ね','よ','かしら','なさい'], quote:'ふふ、私に任せなさい。完璧にこなしてみせるわ。' },
  { id:'yuika', code:'yui', jp:'三峰結華', short:'結華', cn:'三峰结华', romaji:'Mitsumine Yuika', kana:'みつみね ゆいか', surname:'三峰', sk:'みつみね', first:'私', avg:17.8, speed:4.9, keigo:.06, exclaim:.08, ellipsis:.2, lineCount:8100, unit:"L'Antica", traits:{'小恶魔':.14,'温柔':.09,'冷淡':.05}, endings:['かな','けど','でしょ','ね','よ','かも','し'], quote:'結華ちゃん、ちょっとだけ意地悪してもいい？ ……なんてね。' },
  { id:'kiriko', code:'kir', jp:'幽谷霧子', short:'霧子', cn:'幽谷雾子', romaji:'Yukoku Kiriko', kana:'ゆうこく きりこ', surname:'幽谷', sk:'ゆうこく', first:'私', avg:12.6, speed:4.6, keigo:.07, exclaim:.04, ellipsis:.48, lineCount:7020, unit:"L'Antica", traits:{'神秘':.16,'温柔':.11,'天然':.06}, endings:['です','ます','ね','よ','……','かな','の'], quote:'霧子、……ここにいるよ。あなたが呼ぶなら、どこへでも。' },
  { id:'kaho', code:'kaho', jp:'小宮果穂', short:'果穂', cn:'小宫果穗', romaji:'Komiya Kaho', kana:'こみや かほ', surname:'小宮', sk:'こみや', first:'私', avg:15.9, speed:5.3, keigo:.03, exclaim:.28, ellipsis:.06, lineCount:9100, unit:'放課後クライマックスガールズ', traits:{'元气':.24,'努力':.18,'乖巧':.08}, endings:['です','ます','よ','ね','！','かな','でしょう'], quote:'果穂、はりきっちゃいます！ いっしょにがんばりましょう！' },
  { id:'chiyoko', code:'chiyo', jp:'園田智代子', short:'智代子', cn:'园田智代子', romaji:'Sonoda Chiyoko', kana:'そのだ ちよこ', surname:'園田', sk:'そのだ', first:'私', avg:16.4, speed:5.0, keigo:.06, exclaim:.15, ellipsis:.08, lineCount:8280, unit:'放課後クライマックスガールズ', traits:{'温柔':.15,'爱吃':.18,'努力':.08}, endings:['だよ','だね','よ','ね','かな','でしょ','ます'], quote:'今日もおつかれさま！ 智代子、甘いものならいくらでも食べられるよ。' },
  { id:'juri', code:'juri', jp:'西城樹里', short:'樹里', cn:'西城树里', romaji:'Saijo Juri', kana:'さいじょう じゅり', surname:'西城', sk:'さいじょう', first:'俺', avg:14.1, speed:5.1, keigo:.01, exclaim:.17, ellipsis:.13, lineCount:7950, unit:'放課後クライマックスガールズ', traits:{'傲娇':.17,'嘴硬心软':.12,'热血':.14}, endings:['だぜ','だろ','かよ','じゃねえ','よ','な','さ'], quote:'べ、別に心配してねえし。俺が付き合ってやるって言ってんだよ。' },
  { id:'rinze', code:'rin', jp:'杜野凛世', short:'凛世', cn:'杜野凛世', romaji:'Morino Rinze', kana:'もりの りんぜ', surname:'杜野', sk:'もりの', first:'私', avg:13.8, speed:4.4, keigo:.28, exclaim:.03, ellipsis:.32, lineCount:8210, unit:'放課後クライマックスガールズ', traits:{'礼貌':.17,'冷静':.09,'深情':.08}, endings:['です','ます','ね','よ','でしょう','かしら','……'], quote:'凛世、おそばにいます。……それが、凛世のいちばんの願いです。' },
  { id:'natsuha', code:'natsu', jp:'有栖川夏葉', short:'夏葉', cn:'有栖川夏叶', romaji:'Arisugawa Natsuha', kana:'ありすがわ なつは', surname:'有栖川', sk:'ありすがわ', first:'私', avg:17.5, speed:5.0, keigo:.05, exclaim:.19, ellipsis:.06, lineCount:8010, unit:'放課後クライマックスガールズ', traits:{'自信':.16,'照顾人':.14,'热血':.1}, endings:['わ','よ','ね','でしょ','なさい','かしら','だ'], quote:'夏葉、やるからには完璧に！ ついてきなさい！' },
  { id:'amana', code:'amn', jp:'大崎甘奈', short:'甘奈', cn:'大崎甘奈', romaji:'Osaki Amana', kana:'おおさき あまな', surname:'大崎', sk:'おおさき', first:'あたし', avg:16.7, speed:5.0, keigo:.04, exclaim:.18, ellipsis:.11, lineCount:8750, unit:'アルストロメリア', traits:{'撒娇':.18,'温柔':.1,'小恶魔':.05}, endings:['だよ','だね','よ','ね','かな','でしょ','もん'], quote:'甘奈、がんばるよー！ ね、一緒に帰ろ？' },
  { id:'tenka', code:'tenka', jp:'大崎甜花', short:'甜花', cn:'大崎甜花', romaji:'Osaki Tenka', kana:'おおさき てんか', surname:'大崎', sk:'おおさき', first:'わたし', avg:11.9, speed:4.3, keigo:.02, exclaim:.06, ellipsis:.31, lineCount:7080, unit:'アルストロメリア', traits:{'懒散':.17,'天然':.14,'温柔':.08}, endings:['……','かな','ね','よ','だよ','けど','だね'], quote:'甜花……ねむい。でも、がんばる……。' },
  { id:'chiyuki', code:'chiyuki', jp:'桑山千雪', short:'千雪', cn:'桑山千雪', romaji:'Kuwayama Chiyuki', kana:'くわやま ちゆき', surname:'桑山', sk:'くわやま', first:'私', avg:18.8, speed:4.6, keigo:.15, exclaim:.07, ellipsis:.14, lineCount:8670, unit:'アルストロメリア', traits:{'温柔':.18,'成熟':.13,'照顾人':.1}, endings:['です','ます','ね','よ','でしょう','かしら','の'], quote:'千雪、あなたの味方ですよ。無理しなくて大丈夫。' },
  { id:'asahi', code:'ash', jp:'芹沢あさひ', short:'あさひ', cn:'芹泽朝日', romaji:'Serizawa Asahi', kana:'せりざわ あさひ', surname:'芹沢', sk:'せりざわ', first:'わたし', avg:15.0, speed:5.56, keigo:.002, exclaim:.346, ellipsis:.353, lineCount:8126, unit:'ストレイライト', traits:{'天真':.17,'直率':.14,'天才':.1}, endings:['いっす','っすか','っすよ','たっす','るっす','っすね','っす～','───'], quote:'あはは、冬優子ちゃんは怒るだけっすもんね！' },
  { id:'fuyuko', code:'fyk', jp:'黛冬優子', short:'冬優子', cn:'黛冬优子', romaji:'Mayuzumi Fuyuko', kana:'まゆずみ ふゆこ', surname:'黛', sk:'まゆずみ', first:'ふゆ', avg:18.2, speed:4.85, keigo:.035, exclaim:.12, ellipsis:.51, lineCount:9764, unit:'ストレイライト', traits:{'毒舌':.032,'嘴硬心软':.012,'自贬':.015,'冷淡':.276,'傲娇':.231}, endings:['でしょ','けど','じゃない','かな','ね','よ','し','わ'], quote:'ふゆは、あんたのことなんて、べつに。……はぁ、なんで見てるのよ。' },
  { id:'mei', code:'mei', jp:'和泉愛依', short:'愛依', cn:'和泉爱依', romaji:'Izumi Mei', kana:'いずみ めい', surname:'和泉', sk:'いずみ', first:'あたし', avg:15.6, speed:5.1, keigo:.02, exclaim:.21, ellipsis:.08, lineCount:7300, unit:'ストレイライト', traits:{'开朗':.17,'撒娇':.11,'温柔':.09}, endings:['だよ','だね','じゃん','よ','ね','かな','っしょ'], quote:'愛依、今日もみんなで楽しも！ ねえねえ、聞いてる？' },
  { id:'toru', code:'toru', jp:'浅倉透', short:'透', cn:'浅仓透', romaji:'Asakura Toru', kana:'あさくら とおる', surname:'浅倉', sk:'あさくら', first:'僕', avg:12.3, speed:4.7, keigo:.03, exclaim:.04, ellipsis:.35, lineCount:8120, unit:'ノクチル', traits:{'冷淡':.16,'天然':.11,'温柔':.07}, endings:['だよ','かな','ね','よ','けど','……','かも'], quote:'……透、ここにいる。別に、どこにも行かない。' },
  { id:'madoka', code:'mado', jp:'樋口円香', short:'円香', cn:'樋口円香', romaji:'Higuchi Madoka', kana:'ひぐち まどか', surname:'樋口', sk:'ひぐち', first:'私', avg:15.1, speed:4.9, keigo:.04, exclaim:.07, ellipsis:.22, lineCount:8890, unit:'ノクチル', traits:{'毒舌':.13,'冷淡':.18,'嘴硬心软':.09}, endings:['けど','じゃない','かな','ね','よ','はぁ','し'], quote:'はぁ……なんでそんなことするの。別に、期待してないから。' },
  { id:'koito', code:'koito', jp:'福丸小糸', short:'小糸', cn:'福丸小糸', romaji:'Fukumaru Koito', kana:'ふくまる こいと', surname:'福丸', sk:'ふくまる', first:'私', avg:16.2, speed:4.8, keigo:.08, exclaim:.09, ellipsis:.15, lineCount:7830, unit:'ノクチル', traits:{'认真':.15,'温柔':.11,'努力':.09}, endings:['です','ます','ね','よ','かな','けど','の'], quote:'小糸、一生懸命やります。……迷惑をかけるかもしれませんけど。' },
  { id:'hinana', code:'hinana', jp:'市川雛菜', short:'雛菜', cn:'市川雏菜', romaji:'Ichikawa Hinana', kana:'いちかわ ひなな', surname:'市川', sk:'いちかわ', first:'ひなな', avg:14.7, speed:5.2, keigo:.02, exclaim:.2, ellipsis:.1, lineCount:8060, unit:'ノクチル', traits:{'自由':.18,'天然':.13,'小恶魔':.05}, endings:['だよ','だね','じゃん','よ','ね','でしょ','かな'], quote:'ひなな、自由にやるのがいっちばん！ ね、そうでしょ？' },
  { id:'nichika', code:'nichika', jp:'七草にちか', short:'にちか', cn:'七草日花', romaji:'Nanakusa Nichika', kana:'ななくさ にちか', surname:'七草', sk:'ななくさ', first:'私', avg:16.9, speed:5.0, keigo:.05, exclaim:.16, ellipsis:.14, lineCount:6980, unit:'SHHis', traits:{'努力':.17,'自信':.11,'傲娇':.07}, endings:['だよ','だよね','よ','ね','でしょ','かな','もん'], quote:'にちか、絶対に負けないんだから！ 見ててよね！' },
  { id:'mikoto', code:'miko', jp:'緋田美琴', short:'美琴', cn:'绯田美琴', romaji:'Hida Mikoto', kana:'ひだ みこと', surname:'緋田', sk:'ひだ', first:'私', avg:17.4, speed:4.8, keigo:.07, exclaim:.05, ellipsis:.22, lineCount:6460, unit:'SHHis', traits:{'冷静':.17,'温柔':.09,'努力':.09}, endings:['ね','よ','わ','かな','けど','です','ます'], quote:'美琴、あなたの音を聞かせて。……それだけ。' },
  { id:'luca', code:'luca', jp:'斑鳩ルカ', short:'ルカ', cn:'斑鸠露卡', romaji:'Ikaruga Luca', kana:'いかるが るか', surname:'斑鳩', sk:'いかるが', first:'私', avg:18.6, speed:4.7, keigo:.03, exclaim:.11, ellipsis:.18, lineCount:4200, unit:'CoMETIK', traits:{'高傲':.16,'毒舌':.07,'温柔':.05}, endings:['わ','のよ','でしょ','なさい','ね','よ','かしら'], quote:'ルカを誰だと思ってるの？ 当然、私が一番よ。' },
  { id:'hana', code:'hana', jp:'鈴木羽那', short:'羽那', cn:'铃木羽那', romaji:'Suzuki Hana', kana:'すずき はな', surname:'鈴木', sk:'すずき', first:'私', avg:15.8, speed:4.9, keigo:.04, exclaim:.11, ellipsis:.16, lineCount:3880, unit:'CoMETIK', traits:{'天然':.17,'开朗':.14,'温柔':.09}, endings:['だよ','だね','かな','ね','よ','かも','でしょ'], quote:'羽那、あなたのこと、ちょっと気になるかも。……ふふっ。' },
  { id:'haruki', code:'haru', jp:'郁田はるき', short:'はるき', cn:'郁田阳希', romaji:'Ikuta Haruki', kana:'いくた はるき', surname:'郁田', sk:'いくた', first:'はるき', avg:16.1, speed:5.0, keigo:.03, exclaim:.15, ellipsis:.09, lineCount:3650, unit:'CoMETIK', traits:{'直率':.17,'努力':.11,'温柔':.09}, endings:['だよ','だね','よ','ね','じゃん','かな','っしょ'], quote:'はるき、まっすぐに歌うだけ。それじゃ、だめ？' },
  { id:'hazuki', code:'hazu', jp:'七草はづき', short:'はづき', cn:'七草叶月', romaji:'Nanakusa Hazuki', kana:'ななくさ はづき', surname:'七草', sk:'ななくさ', first:'私', avg:18.0, speed:4.6, keigo:.2, exclaim:.05, ellipsis:.12, lineCount:1520, unit:'283 PRODUCTION', traits:{'温柔':.18,'成熟':.15,'照顾人':.09}, endings:['です','ます','ね','よ','ましょう','かしら','の'], quote:'はづき、おつかれさま。少し休みましょうか。' }
];

/* cards/data/<id>.json 的 textshape 基准（真实卡片会优先使用自己的字段）。
   这里内嵌一份，保证拖入 v1 旧卡（没有 textshape）时也能跑分布一致性评分；
   内置数据走 REAL_CARDS，自带 textshape，不会用到这份兜底。 */
const TEXT_SHAPE_BY_ID = Object.freeze({
  amana:  { kanji_rate:0.1396, small_kana_rate:0.0552, long_vowel_rate:0.0188, symbols_per_line:2.647, chars_per_line:19.88 },
  asahi:  { kanji_rate:0.1117, small_kana_rate:0.0898, long_vowel_rate:0.0192, symbols_per_line:2.124, chars_per_line:15.78 },
  chiyoko:{ kanji_rate:0.1371, small_kana_rate:0.0499, long_vowel_rate:0.0154, symbols_per_line:3.063, chars_per_line:22.68 },
  chiyuki:{ kanji_rate:0.1372, small_kana_rate:0.0482, long_vowel_rate:0.0125, symbols_per_line:2.395, chars_per_line:21.23 },
  fuyuko: { kanji_rate:0.1318, small_kana_rate:0.0474, long_vowel_rate:0.0099, symbols_per_line:2.391, chars_per_line:19.31 },
  hana:   { kanji_rate:0.1006, small_kana_rate:0.0667, long_vowel_rate:0.0405, symbols_per_line:1.835, chars_per_line:15.36 },
  haruki: { kanji_rate:0.1136, small_kana_rate:0.0421, long_vowel_rate:0.0109, symbols_per_line:2.959, chars_per_line:19.99 },
  hazuki: { kanji_rate:0.1583, small_kana_rate:0.032,  long_vowel_rate:0.0142, symbols_per_line:2.128, chars_per_line:26.18 },
  hinana: { kanji_rate:0.1313, small_kana_rate:0.0449, long_vowel_rate:0.0135, symbols_per_line:2.779, chars_per_line:17.08 },
  hiori:  { kanji_rate:0.1463, small_kana_rate:0.0331, long_vowel_rate:0.0103, symbols_per_line:2.292, chars_per_line:19.25 },
  juri:   { kanji_rate:0.1254, small_kana_rate:0.044,  long_vowel_rate:0.0206, symbols_per_line:2.462, chars_per_line:19.15 },
  kaho:   { kanji_rate:0.105,  small_kana_rate:0.0552, long_vowel_rate:0.0216, symbols_per_line:2.699, chars_per_line:19.62 },
  kiriko: { kanji_rate:0.087,  small_kana_rate:0.0332, long_vowel_rate:0.01,   symbols_per_line:4.796, chars_per_line:15.69 },
  kogane: { kanji_rate:0.1202, small_kana_rate:0.0403, long_vowel_rate:0.0159, symbols_per_line:3.399, chars_per_line:21.02 },
  koito:  { kanji_rate:0.1035, small_kana_rate:0.0409, long_vowel_rate:0.009,  symbols_per_line:3.696, chars_per_line:17.29 },
  luca:   { kanji_rate:0.0977, small_kana_rate:0.0346, long_vowel_rate:0.0038, symbols_per_line:4.101, chars_per_line:11.34 },
  madoka: { kanji_rate:0.1627, small_kana_rate:0.0288, long_vowel_rate:0.0059, symbols_per_line:1.621, chars_per_line:12.32 },
  mamimi: { kanji_rate:0.1274, small_kana_rate:0.0513, long_vowel_rate:0.0589, symbols_per_line:1.795, chars_per_line:16.59 },
  mano:   { kanji_rate:0.1163, small_kana_rate:0.0635, long_vowel_rate:0.0111, symbols_per_line:2.775, chars_per_line:19.68 },
  meguru: { kanji_rate:0.1307, small_kana_rate:0.0564, long_vowel_rate:0.0249, symbols_per_line:2.449, chars_per_line:20.34 },
  mei:    { kanji_rate:0.1134, small_kana_rate:0.0577, long_vowel_rate:0.02,   symbols_per_line:2.574, chars_per_line:18.4 },
  mikoto: { kanji_rate:0.133,  small_kana_rate:0.0331, long_vowel_rate:0.0131, symbols_per_line:1.948, chars_per_line:14.36 },
  natsuha:{ kanji_rate:0.1608, small_kana_rate:0.0342, long_vowel_rate:0.0105, symbols_per_line:1.852, chars_per_line:20.92 },
  nichika:{ kanji_rate:0.105,  small_kana_rate:0.0445, long_vowel_rate:0.0231, symbols_per_line:4.104, chars_per_line:17.68 },
  rinze:  { kanji_rate:0.1187, small_kana_rate:0.0126, long_vowel_rate:0.0129, symbols_per_line:4.699, chars_per_line:15.98 },
  sakuya: { kanji_rate:0.1621, small_kana_rate:0.0225, long_vowel_rate:0.0099, symbols_per_line:1.715, chars_per_line:22.28 },
  tenka:  { kanji_rate:0.1046, small_kana_rate:0.0376, long_vowel_rate:0.0161, symbols_per_line:4.994, chars_per_line:17.73 },
  toru:   { kanji_rate:0.1098, small_kana_rate:0.0509, long_vowel_rate:0.0349, symbols_per_line:1.459, chars_per_line:9.7 },
  yuika:  { kanji_rate:0.1451, small_kana_rate:0.0537, long_vowel_rate:0.0198, symbols_per_line:2.304, chars_per_line:21.97 }
});


const MERGED_CARDS = {};
const MERGED_PARSED = {};
const REAL_CARDS = {};
const ENRICHED_CARDS = {};
const BUILTIN_RULES = {};
let INITIAL_BUNDLE = null;

function parseMergedCard(text) {
  const source = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const fm = source.match(/^---\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!fm) return null;
  const meta = parseFrontMatter(fm[1]);
  const body = source.slice(fm[0].length);
  const buckets = {};
  let current = '';
  for (const line of body.split('\n')) {
    const m = line.match(/^##\s+(\d+)\.\s*(.*)$/);
    if (m) {
      current = m[1];
      buckets[current] = [];
      continue;
    }
    if (current) buckets[current].push(line);
  }
  const sectionText = key => (buckets[key] || []).join('\n').trim();
  const s4 = sectionText('4');
  const fenced = s4.match(/```json\s*\n([\s\S]*?)\n```/);
  let data = null;
  if (fenced) {
    try { data = JSON.parse(fenced[1]); } catch (err) { data = null; }
  }
  if (!data) return null;
  const id = String(meta.id || data.id || '').trim();
  if (!id) return null;
  return {
    id,
    meta,
    data,
    // §2 的标题在合并时降了一级（### 状态切换），还原成 ## 交给 parseEnrichedMarkdown；
    // 再补一份 front-matter，好让「拖入 enriched 覆盖」那条路认得它。
    enrichedText: `---\nid: ${id}\nname_jp: ${String(meta.name_jp || data.name_jp || '')}\nenriched: ${String(meta.generated || 'merged')}\n---\n\n`
      + `${sectionText('2').replace(/^### /gm, '## ')}\n`
      + (sectionText('3') ? `\n## 冲突记录\n${sectionText('3')}\n` : ''),
    // §1 去掉小节标题，补一份规则卡要的 front-matter + 「# 判断规则」
    rulesBody: sectionText('1').replace(/^##\s+1\.[^\n]*\n?/, '').trim(),
    sections: buckets
  };
}

/* 规则卡对象：给「规则卡」面板和 Prompt 用，形状与拖入 rules/<id>.md 时一致。 */
function builtinRuleCard(id) {
  const parsed = MERGED_PARSED[id];
  if (!parsed) return null;
  return {
    id,
    name: String(parsed.meta.name_jp || parsed.data.name_jp || ''),
    version: String(parsed.meta.version || ''),
    based_on: 'cards/merged/§1',
    meta: parsed.meta,
    body: parsed.rulesBody,
    fileName: `${id}.md`,
    path: `cards/merged/${id}.md`,
    raw: parsed.rulesBody
  };
}

/* 内置状态下把人格层与规则层灌进 state（拖入同名文件会覆盖）。 */
function seedMergedLayers() {
  for (const id of Object.keys(MERGED_PARSED)) {
    if (!state.enriched.has(id)) state.enriched.set(id, MERGED_PARSED[id].enrichedText);
    if (!state.ruleCards.has(id)) {
      const rule = builtinRuleCard(id);
      if (rule) state.ruleCards.set(id, rule);
    }
  }
}


/* ── 称呼矩阵数据补丁（语料复核）────────────────────────────
   只覆盖下面这三组「说话人 → 对象」关系，其余一律用卡片自带 address。
   结构：{ 说话人id: { address 键: { forms: [{ form, count, pct }], note } } }
   · forms 会整条替换同名 address 条目（不存在则新增），用于修正次数 / 补缺失对象。
   · note 只进报错文案，不参与匹配，也不会写进 Prompt。
   来源：cards/data/*.json + 语料/剧本复核（はづき 叫 にちか 18 次全是「にちか」；
   にちか 对 はづき 私下「お姉ちゃん」60 次、有外人「七草さん」22 次；
   甘奈 叫 冬優子 只有「ふゆちゃん」4 次）。 */
const ADDRESS_OVERRIDES = Object.freeze({
  hazuki: {
    'にちか': {
      forms: [{ form: 'にちか', count: 18, pct: 1 }],
      note: 'はづき 对 にちか 只叫「にちか」，语料 18 次没有「にちかちゃん／にちかさん」'
    }
  },
  nichika: {
    'はづき': {
      forms: [
        { form: 'お姉ちゃん', count: 60, pct: 0.732 },
        { form: '七草さん', count: 22, pct: 0.268 }
      ],
      note: '有外人时用「七草さん」，私下用「お姉ちゃん」'
    }
  },
  amana: {
    '冬優子': {
      forms: [{ form: 'ふゆちゃん', count: 4, pct: 1 }],
      note: '甘奈 叫 冬優子 只有「ふゆちゃん」（4 次），没有「冬優子ちゃん」'
    }
  }
});
/* 把补丁写回卡片对象，保证称呼矩阵 / Prompt / 校验看到同一份数据。 */
function applyAddressOverrides(card) {
  if (!card || !card.id || !card.address || typeof card.address !== 'object') return card;
  const spec = ADDRESS_OVERRIDES[card.id];
  if (!spec) return card;
  for (const [targetKey, entry] of Object.entries(spec)) {
    if (!entry || !Array.isArray(entry.forms) || !entry.forms.length) continue;
    const forms = entry.forms
      .map(item => ({ form: String(item.form == null ? '' : item.form).trim(), count: asNumber(item.count, 0), pct: asNumber(item.pct, 0) }))
      .filter(item => item.form);
    if (!forms.length) continue;
    if (entry.note) setFormNote(forms, entry.note);
    card.address[targetKey] = forms;
  }
  return card;
}
/* address 条目的可选说明（只用于文案）。挂在数组上、不参与 JSON 序列化与遍历。 */
function setFormNote(forms, note) {
  const text = String(note == null ? '' : note).trim();
  if (!Array.isArray(forms) || !text) return forms;
  Object.defineProperty(forms, 'note', { value: text, enumerable: false, writable: true, configurable: true });
  return forms;
}
function formNoteOf(forms) {
  return forms && typeof forms.note === 'string' ? forms.note : '';
}

/* 场景分布校准表 — 真实台词的「同长度窗口」得分零分布（cards/calibration.json v1）。
   内联一份，保证单文件离线可用；若拖入 cards/calibration.json，会用拖入值覆盖本表。
   阈值不再用绝对 0.85 / 0.70，而是按本角色台词行数就近取档的 P10 / P50 / P90。 */
const CALIBRATION_BUCKETS = Object.freeze([1, 2, 3, 5, 8, 12, 20]);
const DEFAULT_CALIBRATION = Object.freeze({
  version: 1,
  note: '真实台词窗口得分零分布；阈值按同长度分档',
  sizes: Object.freeze({
    1:  Object.freeze({ n:1740, p10:0.439, p25:0.512, p50:0.592, p75:0.667, p90:0.753, mean:0.591 }),
    2:  Object.freeze({ n:1740, p10:0.436, p25:0.515, p50:0.610, p75:0.697, p90:0.770, mean:0.605 }),
    3:  Object.freeze({ n:1740, p10:0.452, p25:0.533, p50:0.623, p75:0.708, p90:0.784, mean:0.618 }),
    5:  Object.freeze({ n:1740, p10:0.461, p25:0.547, p50:0.632, p75:0.713, p90:0.775, mean:0.627 }),
    8:  Object.freeze({ n:1740, p10:0.473, p25:0.552, p50:0.638, p75:0.713, p90:0.788, mean:0.631 }),
    12: Object.freeze({ n:1740, p10:0.484, p25:0.564, p50:0.648, p75:0.720, p90:0.790, mean:0.641 }),
    20: Object.freeze({ n:1740, p10:0.507, p25:0.578, p50:0.656, p75:0.733, p90:0.798, mean:0.652 })
  })
});

/* 检查分级：error=事实性错误（红，硬检查，整行标出）；
   warn=风格提示（黄，可忽略，不影响分数）；info=信息性（灰，不判分）。 */
const SEVERITY_DEFS = Object.freeze({
  error: { rank: 3, label: '错误', dot: '●' },
  warn:  { rank: 2, label: '警告', dot: '●' },
  info:  { rank: 1, label: '提示', dot: '●' }
});
const ADULT_WORD_AGE = Object.freeze({ kaho: 12 }); // 小宫果穗 12 岁
const ADULT_WORK_WORDS = Object.freeze([
  '効率化', 'コンプライアンス', '優先順位', '生産性', 'マネジメント', 'ガバナンス',
  'リスク管理', 'コスト削減', 'ワークライフバランス', '人事評価', '意思決定',
  '説明責任', '相乗効果', 'シナジー', 'KPI', 'ROI', '決算', '株主', '利益率', '売上目標'
]);

const SMALL_KANA_CHARS = new Set(Array.from('っゃゅょぁぃぅぇぉゎッャュョァィゥェォヮ'));
const KANJI_RE = /\p{Script=Han}/u;
const SYMBOL_CHAR_RE = /[\p{P}\p{S}]/u;
const KANA_RE = /[\u3040-\u30ff]/u;

const BUILTIN_PLACE_READINGS = {
  '東京':'とうきょう', '東京都':'とうきょうと', '渋谷':'しぶや', '新宿':'しんじゅく', '池袋':'いけぶくろ', '原宿':'はらじゅく', '秋葉原':'あきはばら',
  '横浜':'よこはま', '名古屋':'なごや', '大阪':'おおさか', '京都':'きょうと', '神戸':'こうべ', '札幌':'さっぽろ', '福岡':'ふくおか', '沖縄':'おきなわ',
  '北海道':'ほっかいどう', '事務所':'じむしょ', '楽屋':'がくや', '公園':'こうえん', '病院':'びょういん', '学校':'がっこう', '海':'うみ'
};

const state = {
  cards: new Map(),
  codeMap: new Map(Object.entries(DEFAULT_CODE_MAP)),
  ruleCards: new Map(),
  enriched: new Map(),
  focusId: null,
  sourceLabel: '内置真实数据（29 角色）',
  sourceKind: 'mock',
  rules: { ...DEFAULT_RULES },
  calibration: DEFAULT_CALIBRATION,
  calibrationSource: '内置默认',
  addressMatrix: { version: 1, idolIds28: [], speakerIds: [], byId: {}, producer: {} },
  unitsV2: new Map(),
  houseStyleV2: '',
  lastRulesPreviewHTML: '',
  lastModal: null,
  lastStatus: { message: '', tone: '' },
  scene: '',
  sceneType: '',        // 本场类型（仕事 / 会話 / 約束 …），空 = 不限
  activeTab: 'tab1',
  ai: { config: null, status: 'unconfigured', message: '', note: null },
  tabs: {
    tab1: { input: '', infoText: '', result: null, activeOutputTab: 'script', ttsFormat: 'json', parseFailures: [], aiUndo: null },
    tab2: { plot: '', chinese: '', japanese: '', maxLines: 12, zhClean: false, step1Disabled: true, step2Disabled: true, step1Status: '', step2Status: '', parseInfo: '', jpInfo: '', workbenchOpen: false, result: null, activeOutputTab: 'script', ttsFormat: 'json', cast: new Set(), castCleared: false, prompts: { step1: '', step2: '' }, aiNotes: {} },
    tab3: { plot: '', japanese: '', maxLines: 10, zhClean: false, step1Disabled: true, step1Status: '', jpInfo: '', workbenchOpen: false, result: null, activeOutputTab: 'script', ttsFormat: 'json', cast: new Set(), castCleared: false, prompts: { step1: '' }, aiNotes: {} }
  },
  autoDemoDone: false
};



/* ── basic utilities ─────────────────────────────────────── */
function $(sel, root) {
  const r = root || (typeof document !== 'undefined' ? document : null);
  return r && typeof r.querySelector === 'function' ? r.querySelector(sel) : null;
}
function $(sel, root) {
  const r = root || (typeof document !== 'undefined' ? document : null);
  return r && typeof r.querySelectorAll === 'function' ? Array.from(r.querySelectorAll(sel)) : [];
}
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normKey(value) { return String(value == null ? '' : value).normalize('NFKC').replace(/\s+/g, '').toLowerCase(); }
function cleanCodeKey(value) { return String(value == null ? '' : value).trim().toLowerCase(); }
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function asRate(value, fallback = 0) {
  let n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  if (n > 1 && n <= 100) n /= 100;
  return Math.min(1, n);
}
function fmtPct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits).replace(/\.0+$/, '')}%`;
}
function fmtSec(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1)} 秒`;
}
function truncate(value, max = 100) {
  const s = String(value == null ? '' : value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
function uniq(values) { return Array.from(new Set(values)); }
function uniqueBy(values, keyFn) {
  const seen = new Set();
  return values.filter(v => { const k = keyFn(v); if (seen.has(k)) return false; seen.add(k); return true; });
}
function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
const _memoryStorage = new Map();
function _getStorageBackend() {
  try {
    if (globalRoot && globalRoot.localStorage && typeof globalRoot.localStorage.getItem === 'function') {
      return globalRoot.localStorage;
    }
  } catch (err) { /* sandboxed */ }
  return null;
}
function safeStorageGet(key) {
  const ls = _getStorageBackend();
  if (ls) { try { return ls.getItem(key); } catch (err) { /* fallback */ } }
  return _memoryStorage.has(String(key)) ? _memoryStorage.get(String(key)) : null;
}
function safeStorageSet(key, value) {
  const str = String(value);
  const ls = _getStorageBackend();
  if (ls) { try { ls.setItem(key, str); return true; } catch (err) { /* fallback */ } }
  _memoryStorage.set(String(key), str);
  return true;
}
function safeStorageRemove(key) {
  const ls = _getStorageBackend();
  if (ls) { try { ls.removeItem(key); } catch (err) { /* fallback */ } }
  _memoryStorage.delete(String(key));
}
function parseJsonLoose(text) {
  let s = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!s) throw new Error('JSON 是空的');
  return JSON.parse(s);
}
function sentenceSplit(text) {
  const source = String(text == null ? '' : text).replace(/\r/g, '');
  if (!source.trim()) return [];
  const terminators = '。！？!?…';
  const closers = '」』）)]】〕〉》”’"\'';
  const raw = [];
  let buffer = '';
  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed) raw.push(trimmed);
    buffer = '';
  };
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\n') { flush(); continue; }
    buffer += ch;
    if (terminators.includes(ch)) {
      // Keep consecutive terminators (…… / !? / ！？) together.
      while (i + 1 < source.length && terminators.includes(source[i + 1])) {
        buffer += source[i + 1];
        i += 1;
      }
      // Closing quotes/brackets after punctuation belong to the sentence.
      while (i + 1 < source.length && (closers.includes(source[i + 1]) || /[ \t　]/.test(source[i + 1]))) {
        buffer += source[i + 1];
        i += 1;
      }
      flush();
    }
  }
  flush();
  // Leading/trailing punctuation-only chunks are attached to the nearest
  // real sentence, so "……はぁ" is one sentence while "そう……でも" is two.
  const out = [];
  let pending = '';
  for (const part of raw) {
    const combined = `${pending}${part}`.trim();
    pending = '';
    if (!/[\p{L}\p{N}]/u.test(combined)) { pending = combined; continue; }
    out.push(combined);
  }
  if (pending) {
    if (out.length) out[out.length - 1] += pending;
    else out.push(pending);
  }
  return out;
}
function speakableChars(text) {
  return Array.from(String(text == null ? '' : text)).filter(ch => !/[\s\p{P}\p{S}]/u.test(ch)).length;
}
function countChar(text, ch) {
  let count = 0;
  for (const c of String(text == null ? '' : text)) if (c === ch) count += 1;
  return count;
}
function shortKanaFromMeta(meta) {
  if (!meta || !meta.kana) return '';
  const k = meta.sk ? meta.kana.replace(meta.sk, '').trim() : '';
  if (k) return k;
  const parts = meta.kana.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : meta.kana;
}
function builtInMetaFor(card) {
  if (!card) return null;
  return MOCK_META.find(m => m.id === card.id)
    || MOCK_META.find(m => m.jp === card.name_jp || m.short === card.name_short)
    || null;
}

/* ── code table persistence / parsing ─────────────────────── */
function loadStoredCodeMap() {
  const raw = safeStorageGet(STORAGE_KEYS.codes);
  if (!raw) return new Map(Object.entries(DEFAULT_CODE_MAP));
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('bad');
    const map = new Map();
    for (const [code, target] of Object.entries(obj)) {
      if (String(code).trim() && String(target).trim()) map.set(cleanCodeKey(code), String(target).trim());
    }
    return map.size ? map : new Map(Object.entries(DEFAULT_CODE_MAP));
  } catch (err) {
    return new Map(Object.entries(DEFAULT_CODE_MAP));
  }
}
function saveStoredCodeMap(map) {
  const obj = {};
  for (const [code, target] of map) obj[code] = target;
  return safeStorageSet(STORAGE_KEYS.codes, JSON.stringify(obj));
}
function parseCodeTable(text) {
  const map = new Map();
  const errors = [];
  const duplicates = [];
  const lines = String(text == null ? '' : text).replace(/\r/g, '').split('\n');
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const m = line.match(/^([^=＝]+?)\s*[=＝]\s*(.+)$/);
    if (!m) { errors.push(`第 ${idx + 1} 行：缺少「=」`); return; }
    const code = cleanCodeKey(m[1]);
    const target = m[2].trim();
    if (!code) { errors.push(`第 ${idx + 1} 行：代码为空`); return; }
    if (/\s/.test(code)) { errors.push(`第 ${idx + 1} 行：代码不能含空格`); return; }
    if (!target) { errors.push(`第 ${idx + 1} 行：角色名为空`); return; }
    if (map.has(code)) duplicates.push(code);
    map.set(code, target);
  });
  return { map, errors, duplicates };
}
function codeMapToText(map) {
  return Array.from(map.entries()).map(([code, target]) => `${code}=${target}`).join('\n');
}
function loadStoredRules() {
  const raw = safeStorageGet(STORAGE_KEYS.rules);
  const rules = { ...DEFAULT_RULES };
  if (!raw) return rules;
  try {
    const obj = JSON.parse(raw);
    for (const def of RULE_DEFS) if (obj && typeof obj[def.key] === 'boolean') rules[def.key] = obj[def.key];
  } catch (err) { /* use defaults */ }
  return rules;
}
function saveStoredRules() {
  return safeStorageSet(STORAGE_KEYS.rules, JSON.stringify(state.rules));
}

/* ── cards/rules/<id>.md : LLM judgement rules (third layer) ─ */
function parseFrontMatter(text) {
  const meta = {};
  for (const rawLine of String(text == null ? '' : text).replace(/\r/g, '').split('\n')) {
    const m = rawLine.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    meta[m[1]] = value;
  }
  return meta;
}
function parseRuleCard(text, fileName = '', filePath = '') {
  const source = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!source.trim()) return null;
  const baseName = String(fileName || '').replace(/\.md$/i, '').trim();
  if (!baseName || baseName.startsWith('_')) return null;
  const path = String(filePath || '').replace(/\\/g, '/');
  const inRulesDir = /(^|\/)rules\//i.test(`/${path}`);
  const fm = source.match(/^---\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!fm && !inRulesDir) return null;
  const meta = fm ? parseFrontMatter(fm[1]) : {};
  const body = (fm ? source.slice(fm[0].length) : source).trim();
  if (!body) return null;
  if (!inRulesDir && !/#\s*判断规则/u.test(body)) return null;
  const id = String(meta.id || baseName).trim();
  if (!id) return null;
  return {
    id,
    name: String(meta.name || meta.name_jp || '').trim(),
    version: String(meta.version || '').trim(),
    based_on: String(meta.based_on || meta.sources || '').trim(),
    meta,
    body,
    fileName: String(fileName || ''),
    path,
    raw: source
  };
}
function isRulesCandidateFile(file) {
  const name = String(file?.name || '');
  if (!/\.md$/i.test(name) || /^_/u.test(name)) return false;
  const path = String(file.webkitRelativePath || name).replace(/\\/g, '/');
  if (/(^|\/)(base|enriched|merged)\//i.test(path)) return false;
  return true;
}

/* ── cards/enriched/<id>.md — 状态切换 / 底线（第四层资料）──────
   29 张内嵌在 ENRICHED_CARDS，开箱即用；拖入同名 <id>.md 可覆盖。
   只有「状态切换」「底线」两节会进 Prompt，其余节（语言特征 / 称呼 /
   few-shot / 写作提示）不进，避免和 data 重复。base/ 的原卡是给人读的，
   永远跳过。 */
function normalizeEnrichedSectionName(name) {
  return String(name == null ? '' : name)
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s\u3000/／·・:：、,，]+/g, '')
    .trim();
}
function parseEnrichedMarkdown(text) {
  const source = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!source.trim()) return {};
  // 去掉 YAML front-matter（里面的 conflicts 记录不参与切节）
  const body = source.replace(/^---\n[\s\S]*?\n---[ \t]*(?:\n|$)/, '');
  const sections = {};
  const buf = [];
  let current = '';
  const flush = () => {
    if (!current) return;
    const content = buf.join('\n').trim();
    if (!content) return;
    sections[current] = sections[current] ? `${sections[current]}\n${content}` : content;
  };
  for (const line of body.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (m) {
      flush();
      current = normalizeEnrichedSectionName(m[1]);
      buf.length = 0;
      continue;
    }
    if (current) buf.push(line);
  }
  flush();
  return sections;
}
function enrichedSection(sections, keyword) {
  const needle = normalizeEnrichedSectionName(keyword);
  if (!needle || !sections) return '';
  const keys = Object.keys(sections);
  const key = keys.find(k => k === needle)
    || keys.find(k => k.includes(needle))
    || keys.find(k => needle.includes(k));
  return key ? sections[key] : '';
}
function compressEnrichedSection(body, limit = 500) {
  const rows = [];
  for (const rawLine of String(body == null ? '' : body).replace(/\r/g, '').split('\n')) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.includes('|') && /^\|?[\s:|-]+\|[\s:|-]*$/.test(line)) continue; // 表格分隔行
    if (line.includes('|')) {
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 2) { rows.push(`${cells[0]}：${cells.slice(1).join(' / ')}`); continue; }
      if (cells.length === 1) { rows.push(cells[0]); continue; }
      continue;
    }
    line = line.replace(/^(?:[-*+・]|\d+[.、)])\s+/, '').replace(/\*\*/g, '').trim();
    if (line) rows.push(line);
  }
  let text = rows.join('\n');
  const chars = Array.from(text);
  if (limit > 0 && chars.length > limit) text = `${chars.slice(0, Math.max(1, limit - 1)).join('')}…`;
  return text;
}
function enrichedTextForCard(card) {
  if (!card || !state.enriched) return '';
  const id = String(card.id == null ? '' : card.id).trim();
  if (!id) return '';
  if (state.enriched.has(id)) return state.enriched.get(id) || '';
  const lower = id.toLowerCase();
  for (const [key, value] of state.enriched) {
    if (String(key).toLowerCase() === lower) return value || '';
  }
  return '';
}
function buildEnrichedProfileBlock(card) {
  if (!state.rules?.enriched) return '';
  const raw = enrichedTextForCard(card);
  if (!raw) return '';
  const sections = parseEnrichedMarkdown(raw);
  // 合并卡已经把「状态切换 / 底线 / 写作提示 / 冲突判据」都写全了，别再只取两节 800 字。
  // 「规则优先」开着且确实有规则卡时，状态切换与 §1 A 节重复，只留指路一行（默认关）。
  const dedupe = Boolean(state.rules?.ruleCards && state.rules?.ruleFirst && getRuleCardFor(card)?.body);
  const switches = dedupe ? '' : compressEnrichedSection(enrichedSection(sections, '状态切换'), 700);
  const floors = compressEnrichedSection(enrichedSection(sections, '底线'), 400);
  const tips = compressEnrichedSection(enrichedSection(sections, '写作提示'), 500);
  const conflicts = compressEnrichedSection(enrichedSection(sections, '冲突'), 600);
  if (!switches && !floors && !tips && !conflicts) return '';
  const indent = value => String(value).split('\n').filter(Boolean).map(line => `  ${line}`).join('\n');
  const out = [];
  if (switches) out.push('  【状态切换】', indent(switches));
  else if (dedupe) out.push('  【状态切换】见【角色判断规则卡】的 A 节（同一份内容，此处不重复）');
  if (floors) out.push('  【底线】', indent(floors));
  if (tips) out.push('  【写作提示】', indent(tips));
  if (conflicts) out.push('  【与原卡冲突处的判据（以此为准）】', indent(conflicts));
  return out.join('\n');
}
function looksLikeEnrichedCard(text) {
  const source = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!source.trim()) return false;
  const fm = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!fm || !/^enriched\s*:/m.test(fm[1])) return false;
  return /^##\s*状态切换/m.test(source) && /^##\s*底线/m.test(source);
}
function isEnrichedCandidateFile(file) {
  const name = String(file?.name || '');
  if (!/\.md$/i.test(name) || /^_/u.test(name)) return false;
  const path = String(file.webkitRelativePath || name).replace(/\\/g, '/');
  if (/(^|\/)(base|rules|merged)\//i.test(path)) return false; // base=人读原卡；rules=规则卡；merged=合并卡
  return true;
}
function resolveEnrichedCardId(fileName, metaId) {
  if (!state.cards || !state.cards.size) return '';
  const candidates = [String(fileName || '').replace(/\.md$/i, '').trim(), String(metaId || '').trim()].filter(Boolean);
  const byLower = new Map(Array.from(state.cards.keys()).map(id => [String(id).toLowerCase(), id]));
  for (const candidate of candidates) {
    if (state.cards.has(candidate)) return candidate;
    const hit = byLower.get(candidate.toLowerCase());
    if (hit) return hit;
  }
  return '';
}
function applyEnrichedOverride(text, fileName = '', filePath = '') {
  const path = String(filePath || fileName || '').replace(/\\/g, '/');
  if (/(^|\/)base\//i.test(`/${path}`)) return { ok: false, reason: 'base' };
  const source = String(text == null ? '' : text);
  if (!looksLikeEnrichedCard(source)) return { ok: false, reason: 'not-enriched' };
  const fm = source.replace(/\r\n?/g, '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  const meta = fm ? parseFrontMatter(fm[1]) : {};
  const id = resolveEnrichedCardId(fileName, meta.id);
  if (!id) return { ok: false, reason: 'no-card' };
  const sections = parseEnrichedMarkdown(source);
  if (!enrichedSection(sections, '状态切换') && !enrichedSection(sections, '底线')) {
    return { ok: false, reason: 'not-enriched' };
  }
  state.enriched.set(id, source);
  return { ok: true, id };
}
async function loadEnrichedOverrides(files) {
  const applied = [];
  const handled = [];
  const errors = [];
  for (const file of Array.from(files || [])) {
    if (!isEnrichedCandidateFile(file)) continue;
    try {
      const text = await file.text();
      if (!looksLikeEnrichedCard(text)) continue;
      const result = applyEnrichedOverride(text, file.name, file.webkitRelativePath || file.name);
      if (result.ok) applied.push(result.id);
      // 识别为 enriched 但当前卡组里没有这个角色：静默跳过，也不要再当规则卡。
      if (result.ok || result.reason === 'no-card') handled.push(file);
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }
  return { applied, files: handled, errors };
}
/* ── cards/merged/<id>.md — 合并卡 ─────────────────────────────
   一张卡里同时有人格（§2）、判断规则（§1）和数值（§4），拖进来就三样一起换。 */
function isMergedCardText(text) {
  const s = String(text == null ? '' : text).replace(/^\uFEFF/, '');
  return /^---\r?\n[\s\S]*?\r?\nmerged_from:/.test(s) && /^## 4\. /m.test(s);
}
function isMergedCandidateFile(file) {
  const name = String(file?.name || '');
  if (!/\.md$/i.test(name)) return false;
  const path = String(file.webkitRelativePath || name).replace(/\\/g, '/');
  if (/(^|\/)merged\//i.test(path)) return true;
  return Boolean(file.__mergedText && isMergedCardText(file.__mergedText));
}
async function loadMergedCards(files) {
  const applied = [];
  const errors = [];
  for (const file of Array.from(files || [])) {
    try {
      const text = file.__mergedText || await file.text();
      const parsed = parseMergedCard(text);
      if (!parsed) { errors.push(`${file.name}: 找不到 §4 数值层（不是 merged 卡？）`); continue; }
      const card = normalizeCard(parsed.data, parsed.id);
      card._builtin = false;
      card._merged = true;
      card.merged = parsed;
      state.cards.set(card.id, card);
      state.enriched.set(card.id, parsed.enrichedText);
      const rule = builtinRuleCard(parsed.id) || null;
      if (rule) state.ruleCards.set(rule.id, rule);
      const code = String(parsed.meta.code || parsed.data.code || '').trim();
      if (code && !state.codeMap.has(code)) state.codeMap.set(code, card.name_short || card.name_jp);
      applied.push(card.id);
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }
  if (applied.length) {
    state.sourceKind = 'local';
    state.sourceLabel = `${applied.length} 张 merged 卡`;
    state.tabs.tab2.prompts = { step1: '', step2: '' };
    state.tabs.tab3.prompts = { step1: '' };
    renderAll();
  }
  return { applied, errors };
}
async function loadRuleFiles(files) {
  const loaded = [];
  const errors = [];
  for (const file of Array.from(files || [])) {
    if (!isRulesCandidateFile(file)) continue;
    try {
      const text = await file.text();
      const path = file.webkitRelativePath || file.name || '';
      const rule = parseRuleCard(text, file.name, path);
      if (!rule) {
        // Drops of the whole cards/ folder also contain base/ (人读原卡) and
        // enriched/ (由 loadEnrichedOverrides 处理) markdown: skip silently.
        if (/#\s*判断规则/u.test(text) || /(^|\/)rules\//i.test(path)) {
          errors.push(`${file.name}: 不是规则卡（需要 YAML front-matter + 「# 判断规则」正文）`);
        }
        continue;
      }
      state.ruleCards.set(rule.id, rule);
      loaded.push(rule.id);
    } catch (err) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }
  if (loaded.length) {
    state.tabs.tab2.prompts = { step1: '', step2: '' };
    state.tabs.tab3.prompts = { step1: '' };
    renderRulesPreview();
    renderPromptsAll();
    renderDeck();
  }
  return { loaded, errors };
}
function getRuleCardFor(card) {
  if (!card) return null;
  return state.ruleCards.get(card.id)
    || state.ruleCards.get(String(card.id).toLowerCase())
    || null;
}
function buildRulesPromptBlock(cards) {
  if (!state.rules?.ruleCards) return '';
  const sections = [];
  for (const card of cards || []) {
    const rule = getRuleCardFor(card);
    if (rule?.body) sections.push(`── ${card.name_jp}（${card.id}）──\n${rule.body}`);
  }
  if (!sections.length) return '';
  return `【角色判断规则卡（LLM 逐条判断；与本档案摘要冲突时以本卡为准）】\n${sections.join('\n\n')}`;
}
/* 「查看角色」用的速览条：一眼看到这张卡的关键数值。 */
function buildCardGlanceHTML(card) {
  if (!card) return '';
  const s = card.speech || {};
  const bits = [
    `一人称 ${s.first_person || '—'}`,
    `中位 ${cardTextShape(card).len_p50 || '—'} 字`,
    `语速 ${Number(s.speed_cps || 0).toFixed(2)} 字/秒`,
    `敬语 ${(Number(s.keigo_rate || 0) * 100).toFixed(1)}%`,
    `台词 ${card.line_count || '?'} 行`
  ];
  return `<div class="card-glance">${bits.map(b => `<span>${escapeHtml(b)}</span>`).join('')}</div>`;
}
function renderRulesPreviewHTML(cardId = state.focusId) {
  const card = state.cards.get(cardId);
  if (!card) return '<div class="rules-empty">先载入角色卡。</div>';
  const rule = getRuleCardFor(card);
  if (!rule) {
    return `<div class="rules-empty">未载入 <code>${escapeHtml(card.id)}.md</code>。生成 Prompt 时会优雅降级为 data + enriched 摘要。<br>把 <code>cards/rules/</code> 拖进上方区域，或单独选择 .md 文件。</div>`;
  }
  const metaBits = [
    `<b>${escapeHtml(rule.id)}</b>`,
    rule.name ? escapeHtml(rule.name) : escapeHtml(card.name_jp),
    rule.version ? `v${escapeHtml(rule.version)}` : '',
    escapeHtml(rule.fileName || '')
  ].filter(Boolean);
  const parsed = card.merged || MERGED_PARSED[card.id] || null;
  const personaText = parsed ? String((parsed.sections['2'] || []).join('\n')).trim() : '';
  const conflictText = parsed ? String((parsed.sections['3'] || []).join('\n')).trim() : '';
  const fold = (title, body) => body
    ? `<details class="details-fold"><summary>${escapeHtml(title)}（${Array.from(body).length} 字符）</summary><pre class="rules-body">${escapeHtml(body)}</pre></details>`
    : '';
  return `${buildCardGlanceHTML(card)}`
    + `<div class="rules-meta">${metaBits.map(b => `<span>${b}</span>`).join('<span>·</span>')}</div>`
    + `<div class="rules-sub">判断规则 §1</div><pre class="rules-body">${escapeHtml(rule.body)}</pre>`
    + fold('人格 §2', personaText)
    + fold('与原卡的冲突 §3', conflictText);
}
function renderRulesPreview(cardId = state.focusId) {
  const html = renderRulesPreviewHTML(cardId);
  state.lastRulesPreviewHTML = html;
  const root = $('#rulesPreview');
  if (root) root.innerHTML = html;
  return html;
}

/* ── card normalization ───────────────────────────────────── */
function normalizeEndingList(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const merged = new Map();
  arr.forEach((item, idx) => {
    let form = '';
    let count = 0;
    let pct = 0;
    if (typeof item === 'string') { form = item.trim(); count = 1; }
    else if (item && typeof item === 'object') {
      form = String(item.form ?? item.ending ?? item.text ?? '').trim();
      count = asNumber(item.count ?? item.次数 ?? item.n, 0);
      pct = asNumber(item.pct ?? item.percent ?? item.占比, 0);
      if (pct > 1) pct = pct / 100;
    }
    if (!form) return;
    if (merged.has(form)) {
      const old = merged.get(form);
      old.count += count;
      if (!old.pct) old.pct = pct;
    } else {
      merged.set(form, { form, count, pct });
    }
  });
  return Array.from(merged.values()).sort((a, b) => (b.count - a.count) || a.form.localeCompare(b.form, 'ja'));
}
function normalizeFormList(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map(item => {
    if (typeof item === 'string') return { form: item, count: 1 };
    if (item && typeof item === 'object') {
      const form = String(item.form ?? item.word ?? item.text ?? '').trim();
      return form ? { form, count: asNumber(item.count ?? item.次数, 0) } : null;
    }
    return null;
  }).filter(Boolean);
}
function normalizeAddress(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [rawKey, rawValue] of Object.entries(raw)) {
    const key = String(rawKey == null ? '' : rawKey).trim();
    if (!key) continue;
    // 允许 { forms: [...], note: '...' } 这种带说明的写法（note 只用于文案）。
    let value = rawValue;
    let note = '';
    if (value && !Array.isArray(value) && typeof value === 'object' && Array.isArray(value.forms)) {
      note = String(value.note ?? value.说明 ?? '').trim();
      value = value.forms;
    }
    let list = [];
    if (Array.isArray(value)) {
      list = value.map(item => {
        if (typeof item === 'string') return { form: item.trim(), count: 1, pct: 0 };
        if (item && typeof item === 'object') {
          const form = String(item.form ?? item.name ?? item.value ?? item.称呼 ?? '').trim();
          if (!form) return null;
          return {
            form,
            count: asNumber(item.count ?? item.次数 ?? item.n, 0),
            pct: asRate(item.pct ?? item.占比, 0)
          };
        }
        return null;
      }).filter(Boolean);
    } else if (typeof value === 'string') {
      if (value.trim()) list = [{ form: value.trim(), count: 1, pct: 0 }];
    } else if (value && typeof value === 'object') {
      if ('form' in value || 'name' in value || 'value' in value) {
        const form = String(value.form ?? value.name ?? value.value ?? '').trim();
        if (form) list = [{ form, count: asNumber(value.count ?? value.次数, 1), pct: asRate(value.pct ?? value.占比, 0) }];
      } else {
        list = Object.entries(value).map(([form, count]) => ({
          form: String(form).trim(),
          count: asNumber(count, 0),
          pct: 0
        })).filter(item => item.form);
      }
    }
    if (list.length) {
      if (note) setFormNote(list, note);
      out[key] = list;
    }
  }
  return out;
}
function normalizeCard(raw, fallbackId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('卡片必须是一个 JSON 对象');
  const meta = MOCK_META.find(m => m.id === fallbackId) ||
    MOCK_META.find(m => raw.id && m.id === String(raw.id)) ||
    MOCK_META.find(m => raw.name_jp && (m.jp === String(raw.name_jp) || m.short === String(raw.name_jp))) ||
    null;
  let id = String(raw.id ?? fallbackId ?? meta?.id ?? '').trim();
  const nameJp = String(raw.name_jp ?? raw.name ?? meta?.jp ?? '').trim();
  if (!id && nameJp) id = String(raw.name_cn || raw.name_short || nameJp).trim() || 'card';
  if (!id) throw new Error('缺少 id');
  if (!nameJp) throw new Error(`卡片 ${id} 缺少 name_jp`);
  const speechRaw = (raw.speech && typeof raw.speech === 'object' && !Array.isArray(raw.speech)) ? raw.speech : {};
  const surname = String(raw.surname ?? meta?.surname ?? '').trim();
  let nameShort = String(raw.name_short ?? raw.short_name ?? meta?.short ?? '').trim();
  if (!nameShort) {
    if (surname && nameJp.startsWith(surname) && nameJp.length > surname.length) nameShort = nameJp.slice(surname.length).trim();
    else nameShort = nameJp;
  }
  const kana = String(raw.kana ?? meta?.kana ?? '').trim();
  const surnameKana = String(raw.surname_kana ?? raw.sk ?? meta?.sk ?? '').trim();
  const cn = String(raw.name_cn ?? meta?.cn ?? nameJp).trim();
  const romaji = String(raw.romaji ?? meta?.romaji ?? '').trim();
  const lineCount = Math.max(0, Math.round(asNumber(raw.line_count ?? raw.lineCount, meta?.lineCount ?? 0)));
  const avgLen = Math.max(1, asNumber(speechRaw.avg_len ?? raw.avg_len, meta?.avg ?? 16));
  const speed = Math.max(0.5, asNumber(speechRaw.speed_cps ?? raw.speed_cps, meta?.speed ?? 5));
  let endings = normalizeEndingList(speechRaw.endings ?? raw.endings);
  const endingsFull = normalizeEndingList(speechRaw.endings_full ?? raw.endings_full);
  if (!endings.length && endingsFull.length) {
    endings = normalizeEndingList(endingsFull.map(e => ({ form: e.form.replace(/^[〜~]/, ''), count: e.count, pct: e.pct })));
  }
  if (!endings.length && meta?.endings?.length) {
    endings = normalizeEndingList(meta.endings.map((form, idx) => ({ form, count: Math.max(1, 20 - idx * 3), pct: 0 })));
  }
  const interjections = normalizeFormList(speechRaw.interjections ?? raw.interjections);
  const hedges = normalizeFormList(speechRaw.hedges ?? raw.hedges);
  const onomatopoeia = normalizeFormList(speechRaw.onomatopoeia ?? raw.onomatopoeia);
  const emotionWords = normalizeFormList(speechRaw.emotion_words ?? raw.emotion_words);
  const traitsRaw = (raw.traits && typeof raw.traits === 'object' && !Array.isArray(raw.traits)) ? raw.traits : (meta?.traits || {});
  const traits = {};
  for (const [key, value] of Object.entries(traitsRaw)) {
    const rate = asRate(value, NaN);
    if (Number.isFinite(rate)) traits[String(key)] = rate;
  }
  const symbols = {};
  if (raw.symbols && typeof raw.symbols === 'object' && !Array.isArray(raw.symbols)) {
    for (const [key, value] of Object.entries(raw.symbols)) {
      const n = asNumber(value, 0);
      if (n) symbols[key] = n;
    }
  }
  const importMeta = builtInMetaFor({ id, name_jp: nameJp, name_short: nameShort });
  const byCategory = (raw.by_category && typeof raw.by_category === 'object') ? raw.by_category : {};
  const sampleByCategory = (raw.sample_by_category && typeof raw.sample_by_category === 'object') ? raw.sample_by_category : {};
  let fewShot = [];
  if (Array.isArray(raw.few_shot)) {
    fewShot = raw.few_shot.map(v => typeof v === 'string' ? v : (v && typeof v === 'object' ? String(v.line ?? v.text ?? '') : '')).filter(Boolean);
  } else if (typeof raw.few_shot === 'string') {
    fewShot = raw.few_shot.split(/\n+/).map(s => s.trim()).filter(Boolean);
  }
  if (!fewShot.length && importMeta?.quote) fewShot = [importMeta.quote];
  // textshape 是 v2 数据契约新增字段；缺失时退回内置真实基准 / 通用默认值。
  const textshapeRaw = (raw.textshape && typeof raw.textshape === 'object' && !Array.isArray(raw.textshape))
    ? raw.textshape
    : (TEXT_SHAPE_BY_ID[id] || {});
  const charsPerLine = Math.max(1, asNumber(textshapeRaw.chars_per_line, avgLen + 1));
  const textshape = {
    kanji_rate: asRate(textshapeRaw.kanji_rate, 0.12),
    small_kana_rate: asRate(textshapeRaw.small_kana_rate, 0.05),
    long_vowel_rate: asRate(textshapeRaw.long_vowel_rate, 0.015),
    symbols_per_line: Math.max(0, asNumber(textshapeRaw.symbols_per_line, 2.4)),
    chars_per_line: charsPerLine,
    len_mean: Math.max(1, asNumber(textshapeRaw.len_mean, charsPerLine)),
    // 句长分布：P10 / P50 / P90 都来自真实语料；缺 textshape 的旧卡按 avg_len 兜底
    // （P50 ≈ avg_len、P10 ≈ avg_len / 2、P90 ≈ avg_len × 2 或 chars_per_line × 1.9）。
    // 句长警告用 P90 × 2，见 lineLengthIssue()。
    len_p10: Math.max(1, asNumber(textshapeRaw.len_p10, Math.max(1, Math.round(avgLen * 0.5)))),
    len_p50: Math.max(1, asNumber(textshapeRaw.len_p50, Math.round(avgLen))),
    len_p90: Math.max(1, asNumber(textshapeRaw.len_p90, Math.max(avgLen * 2, charsPerLine * 1.9))),
    ending_hit_rate: asRate(textshapeRaw.ending_hit_rate, 0.37)
  };

  const card = {
    ...raw,
    id,
    age: Math.max(0, Math.round(asNumber(raw.age ?? meta?.age, 0))),
    name_jp: nameJp,
    name_short: nameShort || nameJp,
    name_cn: cn || nameJp,
    romaji,
    kana,
    surname,
    surname_kana: surnameKana,
    line_count: lineCount,
    textshape,
    speech: {
      first_person: String(speechRaw.first_person ?? raw.first_person ?? meta?.first ?? '').trim(),
      first_person_rate: asRate(speechRaw.first_person_rate ?? raw.first_person_rate, 0.1),
      avg_len: avgLen,
      speed_cps: speed,
      keigo_rate: asRate(speechRaw.keigo_rate ?? raw.keigo_rate, meta?.keigo ?? 0),
      exclaim_rate: asRate(speechRaw.exclaim_rate ?? raw.exclaim_rate, meta?.exclaim ?? 0),
      ellipsis_rate: asRate(speechRaw.ellipsis_rate ?? raw.ellipsis_rate, meta?.ellipsis ?? 0),
      endings,
      endings_full: endingsFull,
      interjections,
      hedges,
      onomatopoeia,
      emotion_words: emotionWords
    },
    symbols,
    address: normalizeAddress(raw.address),
    traits,
    by_category: byCategory,
    few_shot: fewShot,
    sample_by_category: sampleByCategory
  };
  applyAddressOverrides(card);
  return card;
}

/* ── built-in dataset builder ─────────────────────────────────
   内置数据 = cards/data/ 下 29 张真实统计卡（REAL_CARDS），不再用 MOCK_META 合成。
   每张卡都走和「拖入 cards/data/<id>.json」完全相同的 normalizeCard() 通路，
   所以称呼矩阵、符号计数、textshape、Prompt 全部来自真实语料；
   ADDRESS_OVERRIDES 会在 normalizeCard() 末尾再打一次人工补丁。 */
function buildMockCards() {
  const cards = [];
  for (const id of Object.keys(REAL_CARDS)) {
    const card = normalizeCard(REAL_CARDS[id], id);
    card._builtin = true;
    cards.push(card);
  }
  return cards;
}


/* ── aliases / context ────────────────────────────────────── */
function getCardAliases(card, { forReplacement = false } = {}) {
  if (!card) return [];
  const base = [];
  const push = value => { const s = String(value == null ? '' : value).trim(); if (s) base.push(s); };
  push(card.id);
  push(card.name_jp);
  if (card.name_jp && card.name_jp.includes(' ')) push(card.name_jp.replace(/\s+/g, ''));
  push(card.name_short);
  push(card.name_cn);
  if (!forReplacement) {
    push(card.kana);
    if (card.kana) push(card.kana.replace(/\s+/g, ''));
    push(card.romaji);
    push(card.surname);
    push(card.surname_kana);
  } else {
    if (card.surname && card.surname.length >= 2) push(card.surname);
    if (card.kana) {
      const kShort = shortKanaFromMeta(builtInMetaFor(card));
      if (kShort && kShort.length >= 2) push(kShort);
    }
  }
  return uniq(base).filter(Boolean);
}
function buildAliasTable(cardsMap) {
  const byNorm = new Map();
  const entries = [];
  for (const card of cardsMap.values()) {
    for (const alias of getCardAliases(card, { forReplacement: false })) {
      const key = normKey(alias);
      if (!key) continue;
      if (!byNorm.has(key)) byNorm.set(key, new Map());
      byNorm.get(key).set(card.id, card);
      entries.push({ alias, norm: key, cardId: card.id, card });
    }
  }
  return { byNorm, entries };
}
function resolveCardReference(value, cardsMap, aliasTable) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return null;
  const directId = Array.from(cardsMap.values()).find(c => c.id.toLowerCase() === raw.toLowerCase());
  if (directId) return directId;
  const key = normKey(raw.replace(/^[（(【\[]|[）)】\]]$/g, '').replace(/^[*`]+|[*`]+$/g, ''));
  const bucket = aliasTable.byNorm.get(key);
  if (bucket && bucket.size === 1) return Array.from(bucket.values())[0];
  // Try stripping a trailing parenthetical annotation like fyk（小声）
  const stripped = raw.replace(/[（(][^）)]*[）)]\s*$/u, '').trim();
  if (stripped !== raw) {
    const bucket2 = aliasTable.byNorm.get(normKey(stripped));
    if (bucket2 && bucket2.size === 1) return Array.from(bucket2.values())[0];
  }
  return null;
}
/* Speaker-directory: the tolerant name → code table described by the input spec.
   Rank order matters: primary code > name_jp > name_short > name_cn > kana >
   speech.first_person > surname/romaji/id (legacy fallbacks). A name shared by
   two cards is never guessed; callers get the candidate list instead. */
const SPEAKER_HONORIFICS = ['ちゃん', 'さん', 'くん', 'さま', '先輩'];
function stripSpeakerHonorific(value) {
  const raw = String(value == null ? '' : value).trim();
  for (const suffix of SPEAKER_HONORIFICS) {
    if (raw.length > suffix.length && raw.endsWith(suffix)) return raw.slice(0, -suffix.length).trim();
  }
  return '';
}
function buildSpeakerDirectory(cardsMap, primaryCodeByCard) {
  const byNorm = new Map();
  const add = (alias, card, rank, source) => {
    const key = normKey(alias);
    if (!key) return;
    if (!byNorm.has(key)) byNorm.set(key, new Map());
    const bucket = byNorm.get(key);
    const current = bucket.get(card.id);
    if (!current || rank < current.rank) {
      bucket.set(card.id, { card, rank, alias: String(alias), source });
    }
  };
  for (const card of cardsMap.values()) {
    add(primaryCodeByCard.get(card.id), card, 1, 'code');
    add(card.name_jp, card, 2, 'name_jp');
    add(card.name_short, card, 3, 'name_short');
    add(card.name_cn, card, 4, 'name_cn');
    add(card.kana, card, 5, 'kana');
    if (card.kana) add(String(card.kana).replace(/\s+/g, ''), card, 5, 'kana');
    add(card.surname, card, 7, 'surname');
    add(card.surname_kana, card, 7, 'surname_kana');
    add(card.romaji, card, 8, 'romaji');
    add(card.id, card, 9, 'id');
  }
  // A first-person pronoun is a weak alias only when it is unique across the
  // loaded cast (私 / わたし are shared by many cards and must not resolve).
  const firstPersonBuckets = new Map();
  for (const card of cardsMap.values()) {
    const token = String(card.speech?.first_person || '').trim();
    if (!token) continue;
    const key = normKey(token);
    if (!firstPersonBuckets.has(key)) firstPersonBuckets.set(key, new Map());
    firstPersonBuckets.get(key).set(card.id, card);
  }
  for (const cards of firstPersonBuckets.values()) {
    if (cards.size !== 1) continue;
    const card = Array.from(cards.values())[0];
    add(card.speech?.first_person, card, 6, 'first_person');
  }
  return byNorm;
}
function lookupSpeakerAlias(value, ctx) {
  const key = normKey(value);
  if (!key || !ctx?.speakerDirectory) return null;
  const bucket = ctx.speakerDirectory.get(key);
  if (!bucket || !bucket.size) return null;
  const matches = Array.from(bucket.values()).sort((a, b) => a.rank - b.rank);
  if (matches.length === 1) {
    return { card: matches[0].card, ambiguous: [], matched: matches[0].alias, source: matches[0].source };
  }
  return { card: null, ambiguous: matches.map(m => m.card), matched: matches[0].alias, source: matches[0].source };
}
function resolveSpeakerAlias(value, ctx) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return { card: null, ambiguous: [], matched: '' };
  const direct = lookupSpeakerAlias(raw, ctx);
  if (direct) return direct;
  // 冬優子ちゃん / あさひちゃん / ふゆちゃん → strip the honorific and retry.
  const stripped = stripSpeakerHonorific(raw);
  if (stripped) {
    const alt = lookupSpeakerAlias(stripped, ctx);
    if (alt) return alt;
  }
  return { card: null, ambiguous: [], matched: '' };
}
function buildContext(cardsMap, codeMap) {
  const aliasTable = buildAliasTable(cardsMap);
  const codeEntries = [];
  const codeToCard = new Map();
  const codesByCard = new Map();
  for (const [rawCode, target] of codeMap) {
    const code = cleanCodeKey(rawCode);
    if (!code) continue;
    const card = resolveCardReference(target, cardsMap, aliasTable);
    const entry = { code, target, cardId: card?.id || null, card };
    codeEntries.push(entry);
    codeToCard.set(code, card || null);
    if (card) {
      if (!codesByCard.has(card.id)) codesByCard.set(card.id, []);
      codesByCard.get(card.id).push(entry);
    }
  }
  // Tokens used for replacing names. Ambiguous aliases are deliberately excluded.
  const tokenBuckets = new Map();
  for (const card of cardsMap.values()) {
    const aliases = getCardAliases(card, { forReplacement: true });
    const seen = new Set();
    for (const alias of aliases) {
      const token = String(alias).trim();
      if (!token || token.length < 1) continue;
      const key = normKey(token);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (!tokenBuckets.has(key)) tokenBuckets.set(key, { token, cards: new Map() });
      tokenBuckets.get(key).cards.set(card.id, card);
    }
  }
  const nameTokens = [];
  const singleNameTokens = [];
  for (const bucket of tokenBuckets.values()) {
    if (bucket.cards.size !== 1) continue; // ambiguous name → don't auto-replace
    const card = Array.from(bucket.cards.values())[0];
    const item = { token: bucket.token, cardId: card.id, card };
    if (Array.from(bucket.token).length >= 2) nameTokens.push(item);
    else singleNameTokens.push(item);
  }
  // Longest first is essential: 黛冬優子 must win over 冬優子.
  nameTokens.sort((a, b) => b.token.length - a.token.length || a.token.localeCompare(b.token, 'ja'));
  singleNameTokens.sort((a, b) => b.token.length - a.token.length);

  const primaryCodeByCard = new Map();
  const defaultCodes = Object.entries(DEFAULT_CODE_MAP);
  for (const card of cardsMap.values()) {
    let found = null;
    for (const [code, target] of defaultCodes) {
      const entry = codeToCard.get(cleanCodeKey(code));
      if (entry && entry.id === card.id) { found = cleanCodeKey(code); break; }
    }
    if (!found) {
      const list = codesByCard.get(card.id) || [];
      if (list.length) found = list[0].code;
    }
    primaryCodeByCard.set(card.id, found || card.id);
  }

  return {
    cardsMap, codeMap, aliasTable, codeEntries, codeToCard, codesByCard,
    nameTokens, singleNameTokens, primaryCodeByCard,
    speakerDirectory: buildSpeakerDirectory(cardsMap, primaryCodeByCard)
  };
}
function cardDisplayName(card) {
  if (!card) return '—';
  return card.name_short || card.name_jp || card.id;
}
function cardFullName(card) {
  if (!card) return '—';
  return card.name_jp || card.name_short || card.id;
}
function primaryCodeForCard(card, ctx) {
  if (!card) return '??';
  if (ctx && ctx.primaryCodeByCard.has(card.id)) return ctx.primaryCodeByCard.get(card.id);
  return card.id;
}
function cardCodeList(card, ctx) {
  if (!card || !ctx) return [];
  return (ctx.codesByCard.get(card.id) || []).map(e => e.code);
}
function resolveSpeakerPrefix(rawPrefix, ctx) {
  const original = String(rawPrefix == null ? '' : rawPrefix).trim();
  if (!original) return { card: null, token: '', knownCode: false, ambiguous: [] };
  let p = original
    .replace(/^[\s>*#`\-–—•·|]+/u, '')
    .replace(/[*`]+$/g, '')
    .trim();
  const candidates = [p];
  const noParentheses = p.replace(/[（(][^）)]*[）)]/gu, '').trim();
  if (noParentheses && noParentheses !== p) candidates.push(noParentheses);
  if (p.includes('/') || p.includes('｜') || p.includes('・')) {
    candidates.push(...p.split(/[\/｜・]/u).map(s => s.trim()).filter(Boolean));
  }
  let ambiguity = null;
  for (const candidate of candidates) {
    const c = candidate.replace(/^[\s>*#`\-–—•·]+/u, '').replace(/[*`]+$/g, '').trim();
    if (!c) continue;
    const code = cleanCodeKey(c.replace(/^@/, ''));
    if (ctx.codeToCard.has(code)) {
      const card = ctx.codeToCard.get(code);
      return { card, token: c, knownCode: true, code, unresolved: !card, ambiguous: [] };
    }
    const alias = resolveSpeakerAlias(c, ctx);
    if (alias.card) return { card: alias.card, token: c, knownCode: false, code: null, ambiguous: [] };
    if (alias.ambiguous.length && !ambiguity) ambiguity = alias.ambiguous;
  }
  const codeOnly = cleanCodeKey(p);
  if (ctx.codeToCard.has(codeOnly)) {
    return { card: ctx.codeToCard.get(codeOnly), token: p, knownCode: true, code: codeOnly, unresolved: !ctx.codeToCard.get(codeOnly), ambiguous: [] };
  }
  if (ambiguity) return { card: null, token: p, knownCode: false, code: null, ambiguous: ambiguity };
  return { card: null, token: p, knownCode: false, code: null, ambiguous: [] };
}

/* ══════════════════════════════════════════════════════════
   RULE ENGINE / PARSER
   ══════════════════════════════════════════════════════════ */

function sortByCountThenOrder(forms) {
  const sorted = forms
    .map((f, i) => ({ ...f, _i: i }))
    .sort((a, b) => (b.count - a.count) || (a._i - b._i));
  if (forms && typeof forms.note === 'string' && forms.note) setFormNote(sorted, forms.note);
  return sorted;
}
function selectPrimaryForm(forms) {
  if (!Array.isArray(forms) || !forms.length) return null;
  const sorted = sortByCountThenOrder(forms.filter(f => f && f.form));
  return sorted[0]?.form || null;
}
function addressFormDetails(forms, limit = 4) {
  if (!Array.isArray(forms) || !forms.length) return '无记录';
  return sortByCountThenOrder(forms).slice(0, limit)
    .map(f => `${f.form}${f.count ? `（${f.count} 次）` : ''}`)
    .join(' / ');
}
/* ── 称呼精确匹配 ──────────────────────────────────────────
   从台词里抽出的称呼必须与 address 表中某个 form 完全相等：
   前缀 / 后缀都不算（にちか ≠ にちかちゃん，にちか ≠ にちかさん）。
   唯一例外是角色全名：写成「大崎甘奈 / 七草にちか」时，按
   「name_short + 同后缀」再比一次，所以表里存「甘奈」不会误伤
   「大崎甘奈」，但「甘奈ちゃん」照样判错。 */
function splitHonorificSuffix(value) {
  const raw = String(value == null ? '' : value).normalize('NFKC');
  const ordered = [...HONORIFICS].sort((a, b) => b.length - a.length);
  for (const suffix of ordered) {
    if (raw.length > suffix.length && raw.endsWith(suffix)) {
      return { base: raw.slice(0, -suffix.length), honor: suffix };
    }
  }
  return { base: raw, honor: '' };
}
function addressFormAccepted(matched, info, targetCard) {
  if (!info || !Array.isArray(info.forms) || !info.forms.length) return false;
  const allowed = new Set(info.forms.map(f => normKey(f.form)));
  const candidates = [];
  const push = value => {
    const key = normKey(value);
    if (key && !candidates.includes(key)) candidates.push(key);
  };
  push(matched);
  const { base, honor } = splitHonorificSuffix(matched);
  const fullNames = [
    targetCard?.name_jp,
    targetCard?.name_jp ? String(targetCard.name_jp).replace(/\s+/g, '') : '',
    targetCard?.name_cn
  ].filter(Boolean).map(value => normKey(value));
  if (targetCard?.name_short && fullNames.includes(normKey(base))) {
    push(`${targetCard.name_short}${honor}`);
  }
  return candidates.some(key => allowed.has(key));
}

function _resolveIdForMatrix(ref, ctx) {
  if (!ref) return '';
  if (typeof ref === 'object' && ref.id) return String(ref.id);
  const raw = String(ref).trim();
  if (!raw) return '';
  if ( /^(制作人|プロデューサー|p|producer)$/i.test(raw)) return 'producer';
  const c = ctx || (state.cards.size ? buildContext(state.cards, state.codeMap) : null);
  if (c) {
    const card = resolveCardReference(raw, c.cardsMap, c.aliasTable) || resolveSpeakerAlias(raw, c)?.card;
    if (card) return card.id;
  }
  return raw.toLowerCase();
}
function lookupAddressMatrix(speakerRef, targetRef, ctx) {
  const matrix = state.addressMatrix;
  const sId = _resolveIdForMatrix(speakerRef, ctx);
  const tId = _resolveIdForMatrix(targetRef, ctx);
  if (!sId || !tId || sId === tId) return null;
  if (tId === 'producer') {
    const prodCell = matrix?.producer?.[sId];
    if (prodCell) {
      const p = prodCell.primary || prodCell.canonical || prodCell.forms?.[0]?.form || '';
      return { ...prodCell, canonical: prodCell.canonical || p, primary: p };
    }
    const card = state.cards.get(sId);
    const forms = card?.address?.['制作人'];
    if (Array.isArray(forms) && forms.length) {
      const sorted = sortByCountThenOrder(forms);
      return { speakerId: sId, targetId: 'producer', speakerShort: card.name_short || sId, targetShort: '制作人', canonical: sorted[0].form, primary: sorted[0].form, count: asNumber(sorted[0].count, 0), source: 'card', forms: sorted };
    }
    return null;
  }
  const cell = matrix?.byId?.[sId]?.[tId];
  if (!cell) return null;
  const p = cell.primary || cell.canonical || cell.forms?.[0]?.form || '';
  return { ...cell, canonical: cell.canonical || p, primary: p };
}
function findAddressEntry(speakerCard, targetCard, ctx, options = {}) {
  if (!speakerCard || !targetCard || !speakerCard.address) return null;
  const address = speakerCard.address;
  const lookup = new Map();
  for (const [key, forms] of Object.entries(address)) {
    const norm = normKey(key);
    if (!norm) continue;
    if (!lookup.has(norm)) lookup.set(norm, { key, forms });
  }
  const candidates = [];
  const push = v => { if (v && String(v).trim()) candidates.push(String(v).trim()); };
  push(targetCard.name_short);
  push(targetCard.name_jp);
  push(targetCard.name_jp?.replace(/\s+/g, ''));
  push(targetCard.name_cn);
  push(targetCard.surname);
  push(targetCard.id);
  push(targetCard.kana);
  push(targetCard.romaji);
  if (ctx) {
    if (ctx.codesByCard) {
      for (const c of (ctx.codesByCard.get(targetCard.id) || [])) push(c.code);
    }
    if (ctx.codesByCard) {
      for (const c of (ctx.codesByCard.get(targetCard.id) || [])) push(c.target);
    }
  }
  for (const candidate of uniq(candidates)) {
    const found = lookup.get(normKey(candidate));
    if (found && Array.isArray(found.forms) && found.forms.length) {
      const sorted = sortByCountThenOrder(found.forms);
      return {
        key: found.key,
        forms: sorted,
        primary: sorted[0].form,
        primaryCount: sorted[0].count || 0,
        note: formNoteOf(found.forms) || formNoteOf(sorted),
        source: 'card',
        reason: `${speakerCard.name_short}→${targetCard.name_short}：主用「${sorted[0].form}」${sorted[0].count ? `（${sorted[0].count} 次）` : ''}；其他形式：${addressFormDetails(sorted)}`
      };
    }
  }
  const useMatrix = Boolean(options.useFullMatrix ?? state.rules?.fullAddressMatrix);
  if (useMatrix) {
    const cell = lookupAddressMatrix(speakerCard.id, targetCard.id, ctx);
    if (cell && (Array.isArray(cell.forms) && cell.forms.length || cell.canonical)) {
      const rawForms = Array.isArray(cell.forms) && cell.forms.length
        ? cell.forms.map(f => ({ form: f.form, count: asNumber(f.count, 1) }))
        : [{ form: cell.canonical, count: Math.max(1, asNumber(cell.count, 1)) }];
      const sorted = sortByCountThenOrder(rawForms);
      return {
        key: targetCard.name_short || targetCard.id,
        forms: sorted,
        primary: cell.canonical || sorted[0].form,
        primaryCount: sorted[0].count || 0,
        note: cell.source === '仅表格' ? '28×28全称呼表（语料无直接同场样本）' : '',
        source: cell.source || 'matrix',
        reason: `${speakerCard.name_short}→${targetCard.name_short}（28×28称呼矩阵）：主用「${cell.canonical || sorted[0].form}」`
      };
    }
  }
  return null;
}
function fallbackAddressForTarget(targetCard) {
  return targetCard?.name_short || targetCard?.name_jp || '你';
}
function addressDecision(speakerCard, targetCard, ctx) {
  const info = findAddressEntry(speakerCard, targetCard, ctx);
  if (info) {
    return {
      primary: info.primary,
      info,
      reason: info.reason,
      key: info.key,
      forms: info.forms
    };
  }
  const primary = fallbackAddressForTarget(targetCard);
  return {
    primary,
    info: null,
    reason: `address 没有「${targetCard?.name_short || '对象'}」的记录，回退为「${primary}」`,
    key: null,
    forms: []
  };
}

/* ── targeted mention scan (explicit / next / prev still preferred) ── */
function findMentionedCards(text, speakerId, ctx) {
  const source = String(text == null ? '' : text);
  const speakerCard = speakerId ? ctx.cardsMap.get(speakerId) : null;
  const codeHits = [];
  for (const entry of ctx.codeEntries) {
    if (!entry.card || entry.card.id === speakerId) continue;
    const token = entry.code;
    if (!token) continue;
    const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(token)}(?![A-Za-z0-9_])`, 'gi');
    let m;
    while ((m = re.exec(source)) !== null) {
      codeHits.push({ card: entry.card, token: m[0], index: m.index, kind: 'code' });
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  codeHits.sort((a, b) => a.index - b.index || b.token.length - a.token.length);
  if (codeHits.length) return { kind: 'code', ...codeHits[0] };

  const nameHits = [];
  for (const item of ctx.nameTokens) {
    if (!item.card || item.card.id === speakerId) continue;
    const re = new RegExp(escapeRegExp(item.token), 'gu');
    let m;
    while ((m = re.exec(source)) !== null) {
      nameHits.push({ card: item.card, token: m[0], index: m.index, kind: 'name' });
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  for (const item of ctx.singleNameTokens) {
    if (!item.card || item.card.id === speakerId) continue;
    const re = new RegExp(`${escapeRegExp(item.token)}(?=${HONORIFICS.map(escapeRegExp).join('|')})`, 'gu');
    let m;
    while ((m = re.exec(source)) !== null) {
      nameHits.push({ card: item.card, token: m[0], index: m.index, kind: 'name' });
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  nameHits.sort((a, b) => a.index - b.index || b.token.length - a.token.length);
  if (nameHits.length) return { kind: 'name', ...nameHits[0] };
  return null;
}

/* ── address replacement ──────────────────────────────────── */
function makePlaceholderFactory() {
  const forms = [];
  return {
    tokenFor(form) {
      const idx = forms.length;
      forms.push(form);
      return `\uE000${idx}\uE001`;
    },
    resolve(text) {
      return String(text).replace(/\uE000(\d+)\uE001/g, (_, i) => forms[Number(i)] ?? '');
    },
    get size() { return forms.length; }
  };
}
// 纯假名的短别名（まの / るか 等）极易命中词中片段（「たまの」里的「まの」）。
// 这类只在整个 token 后面紧跟助词/标点/空白/行尾时才认。
const KANA_ONLY_RE = /^[\u3040-\u309f\u30a0-\u30ffー]+$/;
function isKanaAlias(tok) { return KANA_ONLY_RE.test(tok) && tok.length <= 4; }
function kanaAliasBoundaryOk(text, start, len) {
  const next = text.slice(start + len, start + len + 1);
  if (next === '' || /[\s、。！？!?…「」『』（）()ー〜～]/u.test(next)) return true;
  return /^(は|が|を|に|の|も|と|や|へ|で|ね|よ|さ|か|だ|っ|ちゃん|さん|くん|さま)/u.test(
    text.slice(start + len, start + len + 3));
}
function replaceOtherNamesWithAddresses(text, speakerCard, ctx, enabled = true) {
  const source = String(text == null ? '' : text);
  if (!enabled || !speakerCard) return { content: source, occurrences: [] };
  const placeholders = makePlaceholderFactory();
  const occurrences = [];
  let content = source;

  // 1) shorthand code tokens: fyk / ash / amn ...
  const codeEntries = ctx.codeEntries.filter(e => e.card && e.card.id !== speakerCard.id && e.code);
  if (codeEntries.length) {
    const sorted = [...codeEntries].sort((a, b) => b.code.length - a.code.length);
    const alt = sorted.map(e => escapeRegExp(e.code)).join('|');
    const re = new RegExp(`(?<![A-Za-z0-9_])(${alt})(?![A-Za-z0-9_])`, 'gi');
    content = content.replace(re, (matched) => {
      const entry = codeEntries.find(e => e.code.toLowerCase() === matched.toLowerCase());
      if (!entry || !entry.card) return matched;
      const decision = addressDecision(speakerCard, entry.card, ctx);
      occurrences.push({
        targetId: entry.card.id,
        targetName: entry.card.name_short,
        original: matched,
        form: decision.primary,
        reason: decision.reason,
        via: '代码'
      });
      return placeholders.tokenFor(decision.primary);
    });
  }

  // 2) 单字名只在校验阶段处理（必须带敬称才算称呼，避免「透明」误判）。
  //    这里不再改写：表外的「透ちゃん」要留着让称呼校验报红，而不是被悄悄抹平。

  // 3) names with optional honorific. Longest alias wins.
  const longEntries = ctx.nameTokens.filter(item => item.card && item.card.id !== speakerCard.id);
  if (longEntries.length) {
    const alt = longEntries.map(e => escapeRegExp(e.token)).join('|');
    const honor = HONORIFICS.map(escapeRegExp).join('|');
    const re = new RegExp(`(${alt})(?:(${honor}))?`, 'gu');
    content = content.replace(re, (matched, token, suffix) => {
      const item = longEntries.find(e => e.token === token);
      if (!item) return matched;
      const decision = addressDecision(speakerCard, item.card, ctx);
      if (!decision.info) return matched;
      // 已经是表内形式（含「名字+敬称」）→ 原样保留。
      if (addressFormAccepted(matched, decision.info, item.card)) return matched;
      // 带了表外敬称（にちかちゃん / はづきさん）→ 不猜、不改写，交给称呼校验报红。
      if (suffix) return matched;
      // 表里有多个合法形式（お姉ちゃん / 七草さん）时也不猜：
      // 场景决定用哪个，裸名保留原文、交给校验显示 note。
      if (decision.info.forms.length > 1) return matched;
      // 只有「裸名 + 表里唯一形式」才按主用称呼校正（冬優子 → ふゆちゃん）。
      occurrences.push({
        targetId: item.card.id,
        targetName: item.card.name_short,
        original: matched,
        form: decision.primary,
        reason: decision.reason,
        via: '名字'
      });
      return placeholders.tokenFor(decision.primary);
    });
  }

  return { content: placeholders.resolve(content), occurrences };
}

/* 姓氏 → 卡片索引（按 ctx 缓存，供称呼校验的「姓+敬称」检查复用）。 */
const surnameTokenIndexCache = new WeakMap();
function getSurnameTokenIndex(ctx) {
  const cached = ctx && surnameTokenIndexCache.get(ctx);
  if (cached) return cached;
  const byToken = new Map();
  if (ctx && ctx.cardsMap) {
    for (const card of ctx.cardsMap.values()) {
      const token = String(card?.surname || '').trim();
      if (!token) continue;
      if (!byToken.has(token)) byToken.set(token, []);
      byToken.get(token).push(card);
    }
  }
  const tokens = Array.from(byToken.keys()).sort((a, b) => b.length - a.length);
  const index = {
    byToken,
    source: tokens.length ? tokens.map(escapeRegExp).join('|') : '',
    honor: HONORIFICS.map(escapeRegExp).join('|')
  };
  if (ctx && typeof ctx === 'object') surnameTokenIndexCache.set(ctx, index);
  return index;
}

/* Check the *processed* line against the speaker's address table.
   This intentionally warns rather than rewrites. */
function scanAddressUsage(content, speakerCard, ctx, options = {}) {
  const issues = [];
  if (!speakerCard) return issues;
  const longEntries = ctx.nameTokens.filter(item => item.card && item.card.id !== speakerCard.id);
  const singleEntries = ctx.singleNameTokens.filter(item => item.card && item.card.id !== speakerCard.id);
  const seen = new Set();
  const inspect = (targetCard, matched) => {
    if (!targetCard) return;
    const key = `${targetCard.id}|${matched}`;
    if (seen.has(key)) return;
    seen.add(key);
    const info = findAddressEntry(speakerCard, targetCard, ctx, options);
    // 没有 address 条目 = 语料里没有这对关系的记录。
    // 「没有数据」不等于「写错了」，所以这里什么都不报。
    if (!info) return;
    // 精确匹配：只接受 address 表里原样的 form（全名另有窄例外，见 addressFormAccepted）。
    if (!addressFormAccepted(matched, info, targetCard)) {
      const noteText = info.note ? ` · ${info.note}` : '';
      issues.push({
        targetId: targetCard.id,
        targetName: targetCard.name_short,
        form: matched,
        candidates: sortByCountThenOrder(info.forms.filter(f => f && f.form)).map(f => ({ form: f.form, count: asNumber(f.count, 0) })),
        note: info.note || '',
        fixable: true,
        message: `「${matched}」不在 address 表内；${speakerCard.name_short} 对 ${targetCard.name_short} 的主用称呼是「${info.primary}」（候选：${addressFormDetails(info.forms)}）${noteText}`
      });
    }
  };
  if (longEntries.length) {
    const alt = longEntries.map(e => escapeRegExp(e.token)).join('|');
    const honor = HONORIFICS.map(escapeRegExp).join('|');
    const re = new RegExp(`(${alt})(?:(${honor}))?`, 'gu');
    let m;
    while ((m = re.exec(String(content))) !== null) {
      const token = m[1];
      const item = longEntries.find(e => e.token === token);
      if (item) {
        if (isKanaAlias(token) && !kanaAliasBoundaryOk(String(content), m.index, token.length)) {
          // 词中片段，跳过
        } else {
          inspect(item.card, m[0]);
        }
      }
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  if (singleEntries.length) {
    const alt = singleEntries.map(e => escapeRegExp(e.token)).join('|');
    const honor = HONORIFICS.map(escapeRegExp).join('|');
    const re = new RegExp(`(${alt})(${honor})`, 'gu');
    let m;
    while ((m = re.exec(String(content))) !== null) {
      const item = singleEntries.find(e => e.token === m[1]);
      if (item) inspect(item.card, m[0]);
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  // 姓 + 敬称：七草 / 大崎 这类共享姓氏不会进 nameTokens（歧义），
  // 但 address 表里已经有该对象的条目时，仍要按精确匹配判一次，
  // 否则「七草先輩」会被漏掉。索引按 ctx 缓存，避免每行重复扫 29 张卡。
  const surnameIndex = getSurnameTokenIndex(ctx);
  if (surnameIndex.source) {
    const re = new RegExp(`(${surnameIndex.source})(${surnameIndex.honor})`, 'gu');
    let m;
    while ((m = re.exec(String(content))) !== null) {
      for (const targetCard of surnameIndex.byToken.get(m[1]) || []) {
        if (!targetCard || targetCard.id === speakerCard.id) continue;
        if (!findAddressEntry(speakerCard, targetCard, ctx, options)) continue;
        inspect(targetCard, m[0]);
      }
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  // Codes left in text only when address replacement was disabled; flag those too.
  for (const entry of ctx.codeEntries) {
    if (!entry.card || entry.card.id === speakerCard.id) continue;
    const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(entry.code)}(?![A-Za-z0-9_])`, 'gi');
    let m;
    while ((m = re.exec(String(content))) !== null) {
      const matched = m[0];
      const key = `code|${entry.card.id}|${matched}`;
      if (!seen.has(key)) {
        seen.add(key);
        issues.push({
          targetId: entry.card.id,
          targetName: entry.card.name_short,
          form: matched,
          candidates: [],
          note: '',
          // 残留代码不是「表外称呼」，不能靠改称呼修，别进一键修称呼。
          fixable: false,
          message: `台词仍残留代码「${matched}」（未替换为 ${entry.card.name_short} 的称呼）`
        });
      }
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  return issues;
}

/* ── 生成故障检查：语法崩坏 / 重复 / 出场角色 / 半截句 ─────────
   这一组全部只提示（warn / info），不改写、不影响分数：
   目标是抓「模型生成出来的坏句子」，不是判角色像不像。 */
// 规则 C 用：出现任意一个助词就说明两个名字不是「硬拼在一起」的。
// 比规则 C 原文的「も/と/や/、」多收 は が を に の で へ か，是为了不误伤
// 「真乃ちゃんが冬優子ちゃんを呼んだ」这类正常的主宾句（空格不算助词）。
const CONNECTIVE_PARTICLES = /[もとや、はがをにのでへか]/u;
const MENTION_SEPARATORS = /[、,，\s\u3000]/u;
function isGrammarNameToken(token) {
  const raw = String(token == null ? '' : token).trim();
  if (!raw) return false;
  // 纯 ASCII 的 id / romaji 不进语法检查，避免英文单词误判成角色名。
  return !/^[\x20-\x7E]+$/.test(raw);
}
/* 把一行里出现的角色名（name_jp / name_short / name_cn / 别名，含敬称）全部找出来。
   长名优先；被更长命中包含的短名会被丢掉（七草にちか 不会再算一次 にちか）。 */
function collectCharacterMentions(text, ctx) {
  const src = String(text == null ? '' : text);
  const spans = [];
  if (!src || !ctx) return spans;
  const honors = [...HONORIFICS].sort((a, b) => b.length - a.length);
  const pushSpan = (card, start, token, requireHonor = false) => {
    if (!card || !token) return;
    let end = start + token.length;
    let honor = '';
    for (const candidate of honors) {
      if (src.startsWith(candidate, end)) { honor = candidate; end += candidate.length; break; }
    }
    if (requireHonor && !honor) return;
    spans.push({ card, start, end, token: token + honor, honor });
  };
  for (const item of (ctx.nameTokens || [])) {
    if (!item.card || !isGrammarNameToken(item.token)) continue;
    const re = new RegExp(escapeRegExp(item.token), 'gu');
    let m;
    while ((m = re.exec(src)) !== null) {
      pushSpan(item.card, m.index, m[0]);
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  for (const item of (ctx.singleNameTokens || [])) {
    if (!item.card || !isGrammarNameToken(item.token)) continue;
    const re = new RegExp(escapeRegExp(item.token), 'gu');
    let m;
    while ((m = re.exec(src)) !== null) {
      // 单字名必须带敬称（透ちゃん / 透さん），避免「透明」这类复合词。
      pushSpan(item.card, m.index, m[0], true);
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  const surnameIndex = getSurnameTokenIndex(ctx);
  if (surnameIndex.source) {
    const re = new RegExp(`(${surnameIndex.source})(${surnameIndex.honor})`, 'gu');
    let m;
    while ((m = re.exec(src)) !== null) {
      if (!isGrammarNameToken(m[1])) continue;
      for (const card of (surnameIndex.byToken.get(m[1]) || [])) {
        spans.push({ card, start: m.index, end: m.index + m[0].length, token: m[0], honor: m[2] || '' });
      }
      if (re.lastIndex === m.index) re.lastIndex += 1;
    }
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  for (const span of spans) {
    if (out.length && span.start < out[out.length - 1].end) continue;
    out.push(span);
  }
  return out;
}
/* 两个角色名之间一个字符都没有（连空格都没有）= 紧邻，通常是漏了助词。 */
function adjacentMentionPairs(spans) {
  const pairs = [];
  for (let i = 1; i < spans.length; i += 1) {
    const prev = spans[i - 1];
    const cur = spans[i];
    if (!prev?.card || !cur?.card) continue;
    if (prev.card.id === cur.card.id) continue;
    if (prev.end !== cur.start) continue;
    pairs.push({ prev, cur });
  }
  return pairs;
}
/* 同一片段（2–6 字）连续出现 ≥3 次。2 次是正常结巴，不报。 */
function findConsecutiveRepeats(text) {
  const src = String(text == null ? '' : text);
  let best = null;
  for (let len = 2; len <= 6; len += 1) {
    for (let i = 0; i + len <= src.length; i += 1) {
      const frag = src.slice(i, i + len);
      if (!frag.trim() || !/[\p{L}\p{N}]/u.test(frag)) continue;
      let cursor = i + len;
      let count = 1;
      for (;;) {
        let p = cursor;
        while (p < src.length && MENTION_SEPARATORS.test(src[p])) p += 1;
        if (!src.startsWith(frag, p)) break;
        count += 1;
        cursor = p + len;
      }
      if (count >= 3 && (!best || count > best.count)) best = { frag, count, index: i };
    }
  }
  return best;
}
/* 半截句：、结尾 / 引号没闭合 / 台词为空。以「……」或「──」结尾是正常停顿，不报。 */
function lineTruncationIssues(content, rawLine, options = {}) {
  const issues = [];
  const src = String(content == null ? '' : content);
  const raw = String(rawLine == null ? '' : rawLine).trim();
  const hasKana = options.hasKana != null ? options.hasKana : /[\u3040-\u30ff]/u.test(src);
  const trimmed = src.trim();
  if (!trimmed) {
    issues.push({ type: 'truncated', label: '半截句', level: 'warn', message: '台词为空，句子看起来断了' });
    return issues;
  }
  if (hasKana) {
    // 允许后面还挂着收尾引号/括号：「……助けて、」
    const tail = trimmed.replace(/[」』”’）)\]】〕〉》]+$/u, '');
    if (/[、,，]$/u.test(tail)) {
      issues.push({ type: 'truncated', label: '半截句', level: 'warn', message: '句子看起来断了（台词以「、」结尾）' });
    }
  }
  // 引号闭合必须数「原始行」：解析会把外层的「」剥掉，只看 content 会永远平衡。
  const rawOrContent = raw || src;
  for (const [open, close] of [['「', '」'], ['『', '』']]) {
    const openCount = countChar(rawOrContent, open);
    const closeCount = countChar(rawOrContent, close);
    if (openCount !== closeCount) {
      issues.push({
        type: 'truncated', label: '半截句', level: 'warn',
        message: `引号没闭合（${open}×${openCount} / ${close}×${closeCount}）`
      });
    }
  }
  return issues;
}
/* 一行台词的全部「生成故障」检查。castIds 为空集时不报未出场（用户主动清空 cast）。 */
function textBoxOverflowIssue(content, limit = MAX_TEXTBOX_CHARS, maxLines = MAX_TEXTBOX_LINES) {
  const raw = String(content == null ? '' : content);
  const normalized = raw.replace(/\r\n?/g, '\n');
  const visible = normalized.replace(/\n/g, '');
  const chars = Array.from(visible).length;
  const lines = normalized ? normalized.split('\n').length : 0;
  const maxChars = asNumber(limit, MAX_TEXTBOX_CHARS);
  const lineCap = asNumber(maxLines, MAX_TEXTBOX_LINES);
  const overChars = chars > maxChars;
  const overLines = lines > lineCap;
  if (!overChars && !overLines) {
    return { over: false, chars, limit: maxChars, lines, maxLines: lineCap };
  }
  const reasons = [];
  if (overChars) reasons.push(`字数 ${chars} 字超过文本框上限 ${maxChars} 字`);
  if (overLines) reasons.push(`折行 ${lines} 行超过文本框上限 ${lineCap} 行`);
  return {
    over: true,
    type: 'textbox',
    label: '框长',
    level: 'warn',
    chars,
    limit: maxChars,
    lines,
    maxLines: lineCap,
    message: `台词超出 SC 对话框容量（${reasons.join('；')}），建议拆成两句或精简`
  };
}

/* ── 全 9 组合 / 30 角色：罕见称呼警告（rare_address）与实证 OOC 反模式（ooc_pattern）──
   依据：389,855 行全量语料（corpus_all.jsonl）+ cards_v2 30 人实证人设卡。
   全部为警告级（level: 'warn'），只提示不自动改写、不扣 6D 分布一致性分。 */
const RARE_ADDRESS_RULES = Object.freeze({
  toru: Object.freeze({
    madoka: { forms: ['まどか'], note: '仅限幼少期回想（2/33 次）；日常有声对话主用「樋口（31 次）」' },
    koito: { forms: ['福丸'], note: '极罕见打趣称呼（2/80 次）；日常主用「小糸ちゃん（78 次）」' },
    hinana: { forms: ['ひなな'], note: '罕见写法（2/17 次）；日常主用「雛菜ちゃん（15 次）」' },
    producer: { forms: ['あんた', 'プロデューサー様', 'プロデューサーさん'], primary: 'プロデューサー', note: '透对制作人日常固定直呼「プロデューサー（146 次）」，不加「さん／様」' }
  }),
  madoka: Object.freeze({
    toru: {
      forms: ['透', 'とおる'],
      note: '「透」仅限内心独白（…）（5/36 次），「とおる」仅限幼少期（6/36 次）；有声对话主用「浅倉（36 次）」',
      allowIf: (src, form) => form === '透' && /^[（(][\s\S]*[）)]$/u.test(src.trim())
    },
    producer: { forms: ['あんた'], primary: 'プロデューサー / あなた', note: '円香对制作人主用「プロデューサー」或防卫性代词「あなた」，极少用「あんた（3/22 次）」' }
  }),
  koito: Object.freeze({
    toru: { forms: ['とおるちゃん'], note: '幼少期/慌乱软化写法（11/244 次）；日常主用「透ちゃん（233 次）」' },
    producer: { forms: ['プロデューサー'], primary: 'プロデューサーさん', note: '小糸对制作人主用「プロデューサーさん（379 次）」，不加「さん」仅 4 次' }
  }),
  hinana: Object.freeze({
    producer: { forms: ['プロデューサーさん'], primary: 'プロデューサー', note: '雛菜对制作人主用直呼「プロデューサー（579 次，无さん）」，加「さん」仅在对外装乖场合' }
  }),
  hiori: Object.freeze({
    mano: { forms: ['櫻木さん'], note: '仅限早期 W.I.N.G. 破冰前（26/203 次）；组合结成后主用「真乃（177 次）」' },
    meguru: { forms: ['八宮さん'], note: '仅限早期 W.I.N.G. 破冰前（12/224 次）；组合结成后主用「めぐる（208 次）」' },
    producer: { forms: ['プロデューサーさん'], primary: 'プロデューサー', note: '灯織对制作人主用「プロデューサー（684 次）」，加「さん」仅 3 次' }
  }),
  meguru: Object.freeze({
    hiori: { forms: ['風野', '灯織さん', '風野さん'], note: '极罕见早期/玩笑称呼（≤7/301 次）；日常主用「灯織（294 次）」' },
    mano: { forms: ['櫻木さん', '櫻木'], note: '极罕见早期/玩笑称呼（≤5/245 次）；日常主用「真乃（240 次）」' }
  }),
  mano: Object.freeze({
    producer: { forms: ['プロデューサー'], primary: 'プロデューサーさん', note: '真乃对制作人 99.6% 称呼「プロデューサーさん（896 次）」，几乎不省「さん」' }
  }),
  asahi: Object.freeze({
    fuyuko: { forms: ['黛', '冬優子', 'ふゆちゃん'], note: '罕见称呼（≤4/335 次）；あさひ对冬優子日常主用「冬優子ちゃん（326 次）」' },
    mei: { forms: ['愛依', '和泉'], note: '罕见称呼（≤4/315 次）；あさひ对愛依日常主用「愛依ちゃん（308 次）」' },
    producer: { forms: ['プロデューサー', 'あんた'], primary: 'プロデューサーさん', note: 'あさひ对制作人主用「プロデューサーさん（486 次）」，直呼「プロデューサー」仅 8 次' }
  }),
  fuyuko: Object.freeze({
    producer: {
      forms: ['プロデューサー', 'プロデューサーさん'],
      primary: 'あんた（本音 223 次）/ プロデューサーさん（营业 17 次）',
      note: '冬優子本音模式（96%）对制作人叫「あんた」，仅营业模式（です/ます/♡）叫「プロデューサーさん」；直呼「プロデューサー（无さん）」仅 5 次',
      allowIf: (src, form) => form === 'プロデューサーさん' && /(です|ます|ましょ|ございます|ください|でしょう|でしょ|ません|♡|ふゆ)/u.test(src) && !/(あんた|わよ|なさいよ|っつーの)/u.test(src)
    }
  }),
  mei: Object.freeze({
    fuyuko: { forms: ['冬優子', '黛', '冬優子先輩', 'ふゆちゃん', 'ふゆ'], note: '愛依对冬優子实证主用「冬優子ちゃん（496 次）」；「冬優子／黛／ふゆちゃん」均 ≤4 次' },
    asahi: { forms: ['あさひ先輩', 'あさひ'], note: '愛依对あさひ实证主用「あさひちゃん（460 次）」；不加「ちゃん」或加「先輩」均 ≤6 次' },
    producer: { forms: ['あんた', 'プロデューサーさん'], primary: 'プロデューサー', note: '愛依对制作人主用直呼「プロデューサー（684 次，无さん）」' }
  }),
  yuika: Object.freeze({
    kogane: { forms: ['恋鐘'], note: '三峰对恋鐘主用昵称「こがたん（129 次）」，直呼「恋鐘」仅 3 次' },
    mamimi: { forms: ['田中さん', '田中', '摩美々ちゃん'], note: '三峰对摩美々主用昵称「まみみん（113 次）」，其余形式均 ≤4 次' },
    sakuya: { forms: ['咲耶', '咲耶さん'], note: '三峰对咲耶主用昵称「さくやん（91 次）」，直呼「咲耶」仅 3 次' },
    kiriko: { forms: ['霧子'], note: '三峰对霧子主用昵称「きりりん（80 次）」，直呼「霧子」仅 2 次' }
  }),
  mamimi: Object.freeze({
    kogane: { forms: ['月岡'], note: '摩美々对恋鐘主用「恋鐘（73 次）」，姓氏「月岡」仅 3 次' },
    yuika: { forms: ['結華'], note: '摩美々对結華主用「三峰（45 次）」，名「結華」仅 3 次' },
    kiriko: { forms: ['幽谷'], note: '摩美々对霧子主用「霧子（37 次）」，姓氏「幽谷」仅 4 次' },
    sakuya: { forms: ['白瀬'], note: '摩美々对咲耶主用「咲耶（17 次）」，姓氏「白瀬」仅 2 次' }
  }),
  sakuya: Object.freeze({
    producer: { forms: ['プロデューサーさん', 'プロデューサーくん'], primary: 'プロデューサー / あなた', note: '咲耶对制作人固定直呼「プロデューサー（980 次）」或「あなた」，不加「さん／くん」' }
  }),
  amana: Object.freeze({
    tenka: { forms: ['甜花'], note: '甘奈对双胞胎姐姐主用「甜花ちゃん（1043 次）」，不加「ちゃん」仅 5 次' },
    chiyuki: { forms: ['桑山さん', '千雪先輩'], note: '甘奈对千雪主用「千雪さん（565 次）」，「桑山さん／千雪先輩」仅 ≤5 次' },
    producer: { forms: ['プロデューサー'], primary: 'プロデューサーさん', note: '甘奈对制作人主用「プロデューサーさん（812 次）」，不省「さん」' }
  }),
  tenka: Object.freeze({
    amana: { forms: ['甘奈ちゃん', '甘奈'], note: '甜花对妹妹主用昵称「なーちゃん（439 次）」，「甘奈ちゃん／甘奈」仅 ≤5 次' },
    chiyuki: { forms: ['千雪'], note: '甜花对千雪主用「千雪さん（413 次）」，不加「さん」仅 5 次' },
    producer: { forms: ['プロデューサー'], primary: 'プロデューサーさん', note: '甜花对制作人主用「プロデューサーさん（546 次）」，不省「さん」' }
  }),
  chiyuki: Object.freeze({
    amana: { forms: ['甘奈'], note: '千雪对甘奈主用「甘奈ちゃん（399 次）」，不加「ちゃん」仅 3 次' },
    tenka: { forms: ['甜花さん'], note: '千雪对甜花主用「甜花ちゃん（395 次）」，「甜花さん」仅 2 次' },
    producer: { forms: ['プロデューサー'], primary: 'プロデューサーさん', note: '千雪对制作人 100% 称呼「プロデューサーさん（894 次）」，不直呼「プロデューサー」' }
  }),
  chiyoko: Object.freeze({
    kaho: { forms: ['果穂ちゃん', '果穂さん', '小宮'], note: '智代子对果穂主用直呼「果穂（132 次）」，「果穂ちゃん」仅早期 7 次' },
    juri: { forms: ['樹里', '樹里さん'], note: '智代子对樹里主用「樹里ちゃん（269 次）」，不加「ちゃん」仅 2 次' },
    producer: { forms: ['プロデューサー'], primary: 'プロデューサーさん', note: '智代子对制作人主用「プロデューサーさん（584 次）」，不省「さん」' }
  }),
  haruki: Object.freeze({
    luca: { forms: ['斑鳩さん'], note: '仅限 CoMETIK 结成初期（14/131 次）；熟悉后主用「ルカちゃん（113 次）」' },
    producer: { forms: ['プロデューサー'], primary: 'プロデューサーさん', note: 'はるき对制作人 100% 称呼「プロデューサーさん（368 次）」，不直呼「プロデューサー」' }
  }),
  juri: Object.freeze({
    luca: { forms: ['ルカさん'], note: '仅限早期客气称呼（14/104 次）；主用直呼「ルカ（90 次）」' },
    producer: { forms: ['プロデューサーさん'], primary: 'プロデューサー', note: '樹里对制作人固定直呼「プロデューサー（692 次，无さん）」' }
  }),
  nichika: Object.freeze({
    producer: { forms: ['プロデューサー'], primary: 'プロデューサーさん', note: 'にちか对制作人主用「プロデューサーさん（760 次）」，不省「さん」' }
  }),
  hazuki: Object.freeze({
    producer: { forms: ['プロデューサー'], primary: 'プロデューサーさん', note: 'はづき对制作人固定称呼「プロデューサーさん（311 次）」，不直呼「プロデューサー」' }
  })
});

function isRareAddressForm(speakerId, targetId, form, count, primaryCount) {
  const spRule = RARE_ADDRESS_RULES[speakerId]?.[targetId];
  if (spRule && Array.isArray(spRule.forms) && spRule.forms.includes(form)) return spRule;
  if (count > 0 && primaryCount >= 15 && count / primaryCount <= 0.14) {
    return { forms: [form], note: `低频称呼（仅 ${count}/${primaryCount} 次，占比 ${fmtPct(count / primaryCount)}）` };
  }
  return null;
}

function scanRareAddressUsage(content, speakerCard, ctx, options = {}) {
  const issues = [];
  if (!speakerCard) return issues;
  const src = String(content == null ? '' : content).replace(/『[^』]*』/gu, '');
  if (!src || !/[\u3040-\u30ff\u4e00-\u9fff]/u.test(src)) return issues;
  const seen = new Set();

  // 1) 对偶像/其他角色的罕见称呼（表内存在故未触发 error，但属于低频/特定时期/特定心之声）
  if (ctx) {
    const mentions = collectCharacterMentions(src, ctx);
    for (const span of mentions) {
      const targetCard = span.card;
      if (!targetCard || targetCard.id === speakerCard.id) continue;
      const matched = span.token;
      const info = findAddressEntry(speakerCard, targetCard, ctx, options);
      if (!info || !Array.isArray(info.forms) || !info.forms.length) continue;
      // 仅检查已在 info.forms 表内（即未报 error）或显式命中 RARE_ADDRESS_RULES 的称呼
      const formObj = info.forms.find(f => f.form === matched);
      const primaryCount = asNumber(info.forms[0]?.count, 0);
      const rareSpec = isRareAddressForm(speakerCard.id, targetCard.id, matched, asNumber(formObj?.count, 0), primaryCount);
      if (!rareSpec) continue;
      if (!formObj && !(RARE_ADDRESS_RULES[speakerCard.id]?.[targetCard.id]?.forms || []).includes(matched)) continue;
      if (typeof rareSpec.allowIf === 'function' && rareSpec.allowIf(src, matched)) continue;
      const key = `${targetCard.id}|${matched}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        type: 'rare_address',
        label: '罕见称呼',
        level: 'warn',
        targetId: targetCard.id,
        targetName: targetCard.name_short,
        form: matched,
        primary: info.primary,
        message: `${speakerCard.name_short} 对 ${targetCard.name_short} 使用了罕见/受限称呼「${matched}」——${rareSpec.note}（日常主用「${info.primary}」）`
      });
    }

    // 补充检查单汉字名（如円香有声台词直呼「透」），因 collectCharacterMentions 默认要求单汉字名后接敬称
    const spMap = RARE_ADDRESS_RULES[speakerCard.id];
    const cardsLookup = ctx.cardsMap || ctx.cards;
    if (spMap && cardsLookup instanceof Map) {
      for (const [targetId, rareSpec] of Object.entries(spMap)) {
        if (targetId === 'producer' || !rareSpec || !Array.isArray(rareSpec.forms)) continue;
        const targetCard = cardsLookup.get(targetId);
        if (!targetCard) continue;
        const info = findAddressEntry(speakerCard, targetCard, ctx, options);
        for (const form of rareSpec.forms) {
          const key = `${targetId}|${form}`;
          if (seen.has(key)) continue;
          const escForm = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`(?<![\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}])${escForm}(?=[、,，。！？!?…〜～\\s「」『』（）()はがをにのへもとやでか]|$)`, 'u');
          if (!re.test(src)) continue;
          if (typeof rareSpec.allowIf === 'function' && rareSpec.allowIf(src, form)) continue;
          seen.add(key);
          issues.push({
            type: 'rare_address',
            label: '罕见称呼',
            level: 'warn',
            targetId: targetCard.id,
            targetName: targetCard.name_short,
            form,
            primary: info?.primary || '',
            message: `${speakerCard.name_short} 对 ${targetCard.name_short} 使用了罕见/受限称呼「${form}」——${rareSpec.note}${info?.primary ? `（日常主用「${info.primary}」）` : ''}`
          });
        }
      }
    }
  }

  // 2) 对制作人（プロデューサー / プロデューサーさん / あんた 等）的罕见称呼检查
  const prodRule = RARE_ADDRESS_RULES[speakerCard.id]?.producer;
  if (prodRule && Array.isArray(prodRule.forms)) {
    for (const badForm of prodRule.forms) {
      let hit = false;
      if (badForm === 'プロデューサー') {
        hit = /(?<![ァ-ヶー])プロデューサー(?!さん|様|さま|くん|君|氏|殿)/u.test(src);
      } else {
        hit = src.includes(badForm);
      }
      if (!hit) continue;
      if (typeof prodRule.allowIf === 'function' && prodRule.allowIf(src, badForm)) continue;
      const key = `producer|${badForm}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        type: 'rare_address',
        label: '罕见称呼',
        level: 'warn',
        targetId: 'producer',
        targetName: 'プロデューサー',
        form: badForm,
        primary: prodRule.primary || 'プロデューサー',
        message: `${speakerCard.name_short} 对制作人使用了罕见/受限称呼「${badForm}」——${prodRule.note}`
      });
    }
  }
  return issues;
}

/* ── 全 9 组合 / 30 角色实证 OOC 反模式规则表 ── */
const OOC_ANTI_PATTERN_RULES = Object.freeze({
  // 1. illumination STARS
  mano: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /ほわぁ[。！？!?…～♪☆♡\s]*$/u.test(src.trim()) || (src.match(/ほわぁ/gu) || []).length >= 2,
      message: '真乃（mano）的「ほわぁ」是句首轻感叹（8,948 行仅 42 次），不能用作句尾语助词或单句刷屏'
    }
  ],
  hiori: [
    {
      type: 'symbol', label: '符号',
      test: src => /[☆♡]/u.test(src),
      message: '灯織（hiori）在 11,105 行语料中「☆／♡」为 0 次；认真克制的语感不使用心星装饰符'
    }
  ],
  meguru: [
    {
      type: 'symbol', label: '符号',
      test: src => /～{2,}/u.test(src) || (src.match(/～/gu) || []).length >= 3,
      message: 'めぐる（meguru）的「～」仅占 1.1%，严禁连续堆叠「～～」；她的元气靠「！」（38.5%）与直球短句体现'
    }
  ],
  // 2. L'Antica
  kogane: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /(やねん|やんか|せやな|せやろ|ほんまに|なんでやねん|あかん|ちゃうねん)/u.test(src),
      message: '恋鐘（kogane）说的是长崎佐世保/九州方言（ばい・けん・と・たい・っちゃん），严禁混入关西腔「やねん／せやな／ほんま／あかん」'
    }
  ],
  mamimi: [
    {
      type: 'symbol', label: '符号',
      test: src => /！{2,}|!{2,}/u.test(src),
      message: '摩美々（mamimi）是低能量拖长音（ー 5.9%），严禁使用双感叹号「！！」热血大喊'
    }
  ],
  kiriko: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /！{2,}|!{2,}|わたしなんて|私なんて/u.test(src),
      message: '霧子（kiriko）省略号高达 68.1%、感叹率仅 5.5%，严禁使用「！！」或自卑怨妇腔「私なんて」'
    }
  ],
  // 3. 放課後クライマックスガールズ
  kaho: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /(でちゅ|だじょ|なのー|まちゅ)/u.test(src),
      message: '果穂（kaho）是礼貌元气小学生（です！／ます！／スゴいです！），严禁写成幼儿退行语「でちゅ／だじょ／なのー」'
    }
  ],
  juri: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /(かしら|わよ|ですわ|ますわ)[。！？!?…\s]*$/u.test(src.trim()),
      message: '樹里（juri）使用少年感平语（だぜ・だろ・かよ・じゃねえか），严禁使用女性化句尾「かしら／わよ／ですわ」'
    }
  ],
  rinze: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /！{2,}|!{2,}|じゃん|っしょ|ヤバい|マジで/u.test(src),
      message: '凛世（rinze）省略号高达 71.1%、感叹率仅 6.8%，严禁使用「！！」或现代辣妹俗语「じゃん／っしょ／マジで」'
    }
  ],
  natsuha: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /(おーっほっほ|オーッホッホ|おほほ)/u.test(src),
      message: '夏葉（natsuha）是努力型名媛，严禁使用恶役大小姐刻板笑声「おーっほっほ」'
    }
  ],
  // 4. ALSTROEMERIA
  amana: [
    {
      type: 'symbol', label: '符号',
      test: src => /♡/u.test(src),
      message: '甘奈（amana）使用辣妹闪亮符号「☆（413 次）／～／♪」，不使用「♡」'
    }
  ],
  tenka: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /[\u3040-\u30ff]/u.test(src) && speakableChars(src) > 32 && !/[…‥]/u.test(src),
      message: '甜花（tenka）省略号率高达 52.8%（中位句长 12 字），超过 32 字且无「…」停顿的流利长句不符合其语感'
    }
  ],
  // 5. Straylight
  fuyuko: [
    {
      type: 'symbol', label: '符号',
      test: (src, zhSrc) => /♪/u.test(`${src}\n${zhSrc}`),
      message: '冬優子（fuyuko）极少使用「♪」（9,764 行仅 18 次）；营业模式（omote）尾音符号请改用「♡」'
    },
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => (/(あんた|あいつ|っつーの)/u.test(src) && /(です|ます|ございます|♡)/u.test(src))
        || (/プロデューサーさん/u.test(src) && /(わよ|じゃないの|なさいよ|っつーの)/u.test(src)),
      message: '冬優子（fuyuko）单句内混用了营业声道（です／ます／♡／プロデューサーさん）与本音声道（あんた／わよ／っつーの），请拆成切换前后的两句或统一声道'
    }
  ],
  mei: [
    {
      type: 'symbol', label: '符号',
      test: src => /♡/u.test(src),
      message: '愛依（mei）在 9,649 行语料中仅出现 3 次「♡」；阳光辣妹语感请改用「！／～／♪」'
    }
  ],
  // 6. noctchill
  toru: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /[\u3040-\u30ff]/u.test(src) && speakableChars(src) > 36,
      message: '透（toru）平均句长仅 9.7 字（全 30 人最短，中位 8 字），单句超过 36 字的长段说明不符合其留白语感'
    }
  ],
  madoka: [
    {
      type: 'symbol', label: '符号',
      test: src => /[！!]/u.test(src),
      message: '円香（madoka）感叹率仅 0.5%（全 30 人最低，7,594 行仅 41 次），严禁轻易使用「！」破防大喊'
    }
  ],
  hinana: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /(私なんか|わたしなんか|雛菜なんか|ひなななんか|どうせ私|どうせひなな)/u.test(src),
      message: '雛菜（hinana）自贬率为 0%，核心是享乐与自我肯定（「やは～♡」「しあわせ～」），严禁写自卑台词'
    }
  ],
  // 7. SHHis
  mikoto: [
    {
      type: 'symbol', label: '符号',
      test: src => /[☆♡]|！{2,}|!{2,}/u.test(src),
      message: '美琴（mikoto）在 5,745 行中「☆／♡」为 0、感叹率仅 1.7%，严禁使用心星符号或「！！」'
    }
  ],
  // 8. CoMETIK
  luca: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /(?<![ァ-ヶー])ルカ(は|が|の|も|を)/u.test(src.replace(/『[^』]*』/gu, '')),
      message: 'ルカ（luca）一人称是「私（わたし，99.4%）」，严禁使用第三人称自称「ルカは／ルカが」'
    },
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /(です|ます|ございます|プロデューサーさん)/u.test(src.replace(/『[^』]*』/gu, '')),
      message: 'ルカ（luca）敬语率仅 0.1%，对制作人只叫「あんた／お前／プロデューサー」，不使用敬体或「プロデューサーさん」'
    }
  ],
  hana: [
    {
      type: 'symbol', label: '符号',
      test: src => /♪/u.test(src),
      message: '羽那（hana）在 3,281 行语料中「♪」为 0 次；天然纯真尾音请改用「～（16.9%）／！」'
    }
  ],
  // 9. 283 Production Staff (jimuteki)
  hazuki: [
    {
      type: 'symbol', label: '符号',
      test: src => /♡/u.test(src),
      message: 'はづき（hazuki）在 1,857 行语料中从不使用「♡」（事务员职场边界）'
    }
  ],
  tsutomu: [
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /(わし|ワシ|うむ|ふむ|たまえ|くれたまえ|プロデューサーくん|プロデューサーさん)/u.test(src),
      message: '天井努（tsutomu）一人称是「私」，不叫「わし／うむ／ふむ／〜たまえ／プロデューサーくん」，对制作人只叫「君（122 次）」或「プロデューサー（34 次）」'
    },
    {
      type: 'ooc_pattern', label: 'OOC反模式',
      test: src => /(です|ます|ましょう|ください|[♪♡☆～])/u.test(src),
      message: '天井努（tsutomu）敬语率为 0.0%（1,116 行全为庄重断定体「〜だ／〜だな／〜だろう」），不使用「です／ます」或装饰符号'
    }
  ]
});

function scanOocAntiPatterns(content, speakerCard, ctx, options = {}) {
  const issues = [];
  if (!speakerCard) return issues;
  const src = String(content == null ? '' : content);
  const zhSrc = String(options.zhText == null ? '' : options.zhText);
  const combinedForOoc = `${src}\n${zhSrc}`;
  const charRules = OOC_ANTI_PATTERN_RULES[speakerCard.id] || [];
  for (const rule of charRules) {
    try {
      if (rule.test(src, zhSrc, speakerCard, ctx)) {
        issues.push({
          type: rule.type || 'ooc_pattern',
          label: rule.label || 'OOC反模式',
          level: 'warn',
          message: rule.message
        });
      }
    } catch (err) { /* ignore single rule error */ }
  }
  const isStaff = speakerCard.id === 'hazuki' || speakerCard.id === 'tsutomu' || speakerCard.id === 'producer';
  if (!isStaff && /(283プロの子たち|２８３プロの子たち|283的那些孩子|283的孩子们|那些孩子|孩子们)/u.test(combinedForOoc)) {
    issues.push({
      type: 'peer_term', label: '称谓', level: 'warn',
      message: `${speakerCard.name_short} 是同龄偶像而非职员/长辈，不应把 283 同伴称为「283プロの子たち / 283的那些孩子 / 孩子们」；请改用「事務所のみんな / 他の子」或具体名字`
    });
  }
  return issues;
}

function scanLineGrammar(content, speakerCard, ctx, options = {}) {
  const issues = [];
  const src = String(content == null ? '' : content);
  const hasKana = /[\u3040-\u30ff]/u.test(src);
  const spans = (ctx && hasKana) ? collectCharacterMentions(src, ctx) : [];
  // 规则 A：两个角色名紧邻。
  const pairs = adjacentMentionPairs(spans);
  if (pairs.length) {
    const first = pairs[0];
    const more = pairs.length > 1 ? `（本行共 ${pairs.length} 处）` : '';
    issues.push({
      type: 'grammar', label: '语法', level: 'warn',
      message: `疑似生成故障：两个角色名紧挨着（「${first.prev.token}${first.cur.token}」），可能漏了助词${more}`
    });
  }
  // 规则 C：≥2 个角色名却没有助词连接。A 已经报了就不再重复。
  const mentionCards = uniq(spans.map(span => span.card.id));
  if (!pairs.length && mentionCards.length >= 2 && !CONNECTIVE_PARTICLES.test(src)) {
    const names = uniq(spans.map(span => span.card.name_short)).slice(0, 3).join(' / ');
    issues.push({
      type: 'grammar', label: '语法', level: 'warn',
      message: `同一行出现 ${mentionCards.length} 个角色名（${names}），中间没有助词连接（も / と / や / 、），可能漏字`
    });
  }
  // 规则 B：同一片段连续 3 次以上。
  const repeat = hasKana ? findConsecutiveRepeats(src) : null;
  if (repeat) {
    issues.push({
      type: 'repeat', label: '重复', level: 'warn',
      message: `疑似重复：「${repeat.frag}」连续出现 ${repeat.count} 次`
    });
  }
  // 出场角色：提到不在 cast 里的人只灰不红（故意提不在场的人是合理的）。
  const castIds = options.castIds;
  if (castIds && typeof castIds.has === 'function' && castIds.size && spans.length) {
    const seen = new Set();
    for (const span of spans) {
      const id = span.card.id;
      if (id === speakerCard?.id || castIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      issues.push({
        type: 'cast', label: '出场', level: 'info',
        message: `提到了未出场的${span.card.name_short}`
      });
    }
  }
  issues.push(...lineTruncationIssues(src, options.rawLine, { hasKana }));
  issues.push(...scanRareAddressUsage(src, speakerCard, ctx, options));
  issues.push(...scanOocAntiPatterns(src, speakerCard, ctx, options));
  return issues;
}

/* ── sentence / speech helpers ────────────────────────────── */
function estimateLineSpeech(content, speedCps) {
  const speed = Math.max(0.1, Number(speedCps) || 5);
  const sentences = sentenceSplit(content);
  const sentenceTimings = sentences.map(s => {
    const chars = speakableChars(s);
    return { sentence: s, chars, seconds: chars / speed };
  });
  const chars = sentenceTimings.reduce((sum, s) => sum + s.chars, 0);
  const seconds = sentenceTimings.reduce((sum, s) => sum + s.seconds, 0);
  return { chars, seconds, sentences: sentenceTimings, speedCps: speed };
}
// 「可数行为」型特质：能明确数出「这一句是不是一次毒舌」。
// 冷淡 / 自贬 / 天然 之类是统计口径（短句比例、负面词比例），不是事件，不能按次数配额管。
// 只有「毒舌」是能客观数出来的（负面词出现在这一句）。
// 「嘴硬心软」是「前后 3 句内负面+关怀共现」的窗口式判定，一个来回会数好几次；
// 「傲娇」是行首否定词，也容易和普通否定混淆。这两个不作为配额警告。
const QUOTA_TRAITS = ['毒舌'];
function calcTraitQuota(sentenceCount, rate) {
  const n = Math.max(0, Number(sentenceCount) || 0);
  const r = clampNumber(rate, 0, 1, 0);
  return Math.max(1, Math.floor(n * r + 1e-9));
}
function lineLengthIssue(content, avgLen) {
  const avg = Math.max(1, Number(avgLen) || 1);
  const limit = avg * 2;
  let longest = 0;
  let longestSentence = '';
  const bad = [];
  for (const sentence of sentenceSplit(content)) {
    const len = speakableChars(sentence);
    if (len > longest) { longest = len; longestSentence = sentence; }
    if (len > limit + 1e-9) bad.push({ sentence, len, limit });
  }
  return {
    over: bad.length > 0,
    longest,
    limit,
    sentence: longestSentence,
    issues: bad
  };
}
function sentenceTokensForEnding(sentence) {
  let s = String(sentence == null ? '' : sentence).trim();
  s = s.replace(/^[「『]+/gu, '').replace(/[」』]+$/gu, '').trim();
  s = s.replace(/[。！？!?]+$/gu, '').trim();
  s = s.replace(/[」』]+$/gu, '').trim();
  return s;
}
function endingIssue(content, endings) {
  if (!Array.isArray(endings) || !endings.length) return null;
  if (!/[\u3040-\u30ff]/u.test(content)) return null; // Chinese draft lines are not checked
  const forms = uniq(endings.map(e => sentenceTokensForEnding(e.form)).filter(Boolean));
  const broken = [];
  for (const sentence of sentenceSplit(content)) {
    const tail = sentenceTokensForEnding(sentence);
    if (!tail) continue;
    const matched = forms.some(form => tail.endsWith(form));
    if (!matched) broken.push({ sentence, tail });
  }
  if (!broken.length) return null;
  return {
    first: broken[0],
    count: broken.length,
    endings: forms
  };
}
function normalizeFirstPerson(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  let v = raw.normalize('NFKC');
  // katakana pronoun → hiragana for comparison (アタシ/あたし are one family)
  v = v.replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  return v;
}
function firstPersonFamily(value) {
  const v = normalizeFirstPerson(value);
  if (!v) return '';
  if (FIRST_PERSON_FAMILY[v]) return FIRST_PERSON_FAMILY[v];
  if (v === 'あたし') return 'あたし';
  if (v === 'うち') return 'うち';
  if (v === 'ぼく') return '僕';
  if (v === 'おれ') return '俺';
  return v;
}
function firstPersonIssue(content, card) {
  if (!card) return null;
  // 『…』 里是被引用/模仿的别人的话（也常用于标题、台词本），
  // 里面的人称不代表说话人自己，先剔掉再判。
  const source = String(content == null ? '' : content).replace(/『[^』]*』/gu, '');
  const found = [];
  // 平假名一人称要做词边界检查：「もうちょっと」里的「うち」不是自称。
  const KANA = /[\u3040-\u309f\u30a0-\u30ff]/;
  const hasStandalone = (word) => {
    let idx = source.indexOf(word);
    while (idx >= 0) {
      const prev = idx > 0 ? source[idx - 1] : '';
      const after = source.slice(idx + word.length, idx + word.length + 2);
      // 复数形式（私たち・僕たち・俺ら・わたしら）是「我们」，不是自称
      const plural = /^(たち|ら|ども)/.test(after);
      // 平假名/片假名一人称：前一个字符也是假名 → 视为单词的一部分，跳过
      const glued = KANA.test(prev) && KANA.test(word[0]);
      if (!glued && !plural) return true;
      idx = source.indexOf(word, idx + word.length);
    }
    return false;
  };
  for (const pronoun of FIRST_PERSON_FORMS) {
    if (!source.includes(pronoun)) continue;
    if (!hasStandalone(pronoun)) continue;
    // 「自分」有反身用法（ご自分の / 自分の / 自分で / 自分たち / 自分自身），
    // 那些不是第一人称误用，跳过。
    if (pronoun === '自分') {
      let idx = source.indexOf('自分');
      let real = false;
      while (idx >= 0 && !real) {
        const prev = idx > 0 ? source[idx - 1] : '';
        const next = source.slice(idx + 2, idx + 4);
        const reflexive = prev === 'ご' || prev === 'お'
          || /^(の|で|から|まで|たち|自身|宛|用)/.test(next);
        if (!reflexive) real = true;
        idx = source.indexOf('自分', idx + 2);
      }
      if (!real) continue;
    }
    // あたし / アタシ are treated as the same family for matching, but report the literal form.
    found.push(pronoun);
  }
  if (!found.length) return null;
  const expectedRaw = card.speech?.first_person || '';
  const expectedFamily = firstPersonFamily(expectedRaw);
  const extraAllowed = card.id === 'mei' ? new Set(['あたし', 'うち']) : null;
  const mismatches = [];
  for (const pronoun of found) {
    const family = firstPersonFamily(pronoun);
    if (extraAllowed && extraAllowed.has(family)) continue;
    if (!expectedFamily || family !== expectedFamily) mismatches.push(pronoun);
  }
  if (!mismatches.length) return null;
  return {
    expected: expectedRaw || '—',
    found: mismatches,
    message: `检测到一人称「${mismatches[0]}」，但 ${card.name_short} 的 first_person 是「${expectedRaw || '未记录'}」`
  };
}

/* ── first-person correction (optional) ───────────────────── */
/* Conservative: only rewrite unambiguous pronouns. うち / 自分 / わし are
   skipped because they are frequently non-first-person (うちの, 自分で). */
const FIRST_PERSON_FIX_FORMS = ['わたくし', 'わたし', 'あたし', 'アタシ', 'あたい', 'アタイ', '僕', 'ぼく', '俺', 'おれ', '私'];
function correctFirstPerson(text, card) {
  const source = String(text == null ? '' : text);
  const target = String(card?.speech?.first_person || '').trim();
  if (!target || !source) return { text: source, replacements: [] };
  const targetFamily = firstPersonFamily(target);
  const replacements = [];
  let out = source;
  const forms = [...FIRST_PERSON_FIX_FORMS].sort((a, b) => b.length - a.length);
  for (const form of forms) {
    if (firstPersonFamily(form) === targetFamily) continue;
    let re;
    try {
      re = new RegExp(`(?<![\\p{Script=Han}])${escapeRegExp(form)}(?![\\p{Script=Han}])`, 'gu');
    } catch (err) {
      continue;
    }
    out = out.replace(re, matched => {
      replacements.push({ from: matched, to: target });
      return target;
    });
  }
  return { text: out, replacements };
}

/* ══════════════════════════════════════════════════════════
   DISTRIBUTION CONSISTENCY / TTS EXPORT
   ══════════════════════════════════════════════════════════ */
function cardTextShape(card) {
  const fallback = TEXT_SHAPE_BY_ID[card?.id] || {};
  const raw = (card?.textshape && typeof card.textshape === 'object' && !Array.isArray(card.textshape))
    ? card.textshape : {};
  const avgLen = Math.max(1, asNumber(card?.speech?.avg_len, 16));
  const charsPerLine = Math.max(1, asNumber(raw.chars_per_line, asNumber(fallback.chars_per_line, avgLen + 1)));
  return {
    kanji_rate: asRate(raw.kanji_rate, asRate(fallback.kanji_rate, 0.12)),
    small_kana_rate: asRate(raw.small_kana_rate, asRate(fallback.small_kana_rate, 0.05)),
    long_vowel_rate: asRate(raw.long_vowel_rate, asRate(fallback.long_vowel_rate, 0.015)),
    symbols_per_line: Math.max(0, asNumber(raw.symbols_per_line, asNumber(fallback.symbols_per_line, 2.4))),
    chars_per_line: charsPerLine,
    len_mean: Math.max(1, asNumber(raw.len_mean, asNumber(fallback.len_mean, charsPerLine))),
    // 句长分位数：真实卡自带 len_p10 / len_p50；缺字段时回退到 avg_len 旧算法。
    len_p10: Math.max(1, asNumber(raw.len_p10, asNumber(fallback.len_p10, Math.max(1, Math.round(avgLen * 0.5))))),
    len_p25: Math.max(1, asNumber(raw.len_p25, asNumber(fallback.len_p25, Math.max(1, Math.round(avgLen * 0.8))))),
    len_p50: Math.max(1, asNumber(raw.len_p50, asNumber(fallback.len_p50, Math.round(avgLen)))),
    len_p75: Math.max(1, asNumber(raw.len_p75, asNumber(fallback.len_p75, Math.max(1, Math.round(avgLen * 1.5))))),
    len_p90: Math.max(1, asNumber(raw.len_p90, asNumber(fallback.len_p90, Math.max(avgLen * 2, charsPerLine * 1.9)))),
    ending_hit_rate: asRate(raw.ending_hit_rate, asRate(fallback.ending_hit_rate, 0.37))
  };
}

/* ── 分级 / 校准表 / 场景分 ─────────────────────────────── */
function severityOf(level) {
  if (level === 'error' || level === 'danger') return 'error';
  if (level === 'warn') return 'warn';
  return 'info';
}
function severityRank(level) {
  return SEVERITY_DEFS[severityOf(level)]?.rank || 1;
}
function severityLabel(level) {
  return SEVERITY_DEFS[severityOf(level)]?.label || '提示';
}
function maxSeverity(levels) {
  let out = 'info';
  for (const level of levels) {
    const sev = severityOf(level);
    if (severityRank(sev) > severityRank(out)) out = sev;
  }
  return out;
}
function normalizeCalibrationTable(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('校准表必须是 JSON 对象');
  const rawSizes = (data.sizes && typeof data.sizes === 'object' && !Array.isArray(data.sizes)) ? data.sizes : data;
  const sizes = {};
  for (const [key, value] of Object.entries(rawSizes)) {
    const size = Math.round(Number(key));
    if (!Number.isFinite(size) || size < 1 || size > 999) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const p10 = Number(value.p10);
    const p50 = Number(value.p50);
    const p90 = Number(value.p90);
    if (![p10, p50, p90].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) continue;
    if (!(p10 <= p50 && p50 <= p90)) continue;
    sizes[String(size)] = Object.freeze({
      n: Math.max(0, Math.round(asNumber(value.n, 0))),
      p10, p25: Number.isFinite(Number(value.p25)) ? Number(value.p25) : p10,
      p50, p75: Number.isFinite(Number(value.p75)) ? Number(value.p75) : p90,
      p90, mean: Number.isFinite(Number(value.mean)) ? Number(value.mean) : p50
    });
  }
  const keys = Object.keys(sizes);
  if (!keys.length) throw new Error('没有可用的 p10 / p50 / p90 档位');
  return {
    version: Math.max(1, Math.round(asNumber(data.version, 1))),
    note: String(data.note == null ? '' : data.note),
    sizes
  };
}
function applyCalibrationTable(data, sourceLabel = 'calibration.json') {
  const table = normalizeCalibrationTable(data);
  state.calibration = table;
  state.calibrationSource = sourceLabel || 'calibration.json';
  return table;
}
function calibrationTable() {
  return (state.calibration && state.calibration.sizes && Object.keys(state.calibration.sizes).length)
    ? state.calibration
    : DEFAULT_CALIBRATION;
}
function nearestCalibrationSize(n, calibration = calibrationTable()) {
  const keys = Object.keys(calibration?.sizes || {}).map(Number).filter(k => Number.isFinite(k) && k > 0).sort((a, b) => a - b);
  if (!keys.length) return null;
  const target = Math.max(1, Math.min(20, Math.round(Number(n) || 1)));
  let best = keys[0];
  let bestDist = Math.abs(best - target);
  for (const key of keys.slice(1)) {
    const dist = Math.abs(key - target);
    // 同距离取更短档（例如 4 句 → 3 句档）。
    if (dist < bestDist || (dist === bestDist && key < best)) {
      best = key;
      bestDist = dist;
    }
  }
  return best;
}
function calibrationForSize(n, calibration = calibrationTable()) {
  const size = nearestCalibrationSize(n, calibration);
  if (size == null) return null;
  const row = calibration.sizes[String(size)];
  if (!row) return null;
  return { size, ...row };
}
function sceneThresholds(n, calibration = calibrationTable()) {
  const row = calibrationForSize(n, calibration);
  if (!row) return null;
  return {
    n: Math.max(0, Math.round(Number(n) || 0)),
    bucket: row.size,
    sample: row.n,
    p10: row.p10,
    p50: row.p50,
    p90: row.p90,
    refLow: row.p10,
    refHigh: row.p90
  };
}
function sceneReferenceText(thresholds) {
  return thresholds ? `${thresholds.p10.toFixed(2)}–${thresholds.p90.toFixed(2)}` : '—';
}
function sceneTier(score, thresholds) {
  if (score == null || score === '' || !thresholds || !Number.isFinite(Number(score))) {
    return { key: 'insufficient', label: '样本不足', tone: 'insufficient' };
  }
  const s = Number(score);
  if (s >= thresholds.p90) return { key: 'above', label: '优于九成真实台词', tone: 'above' };
  if (s >= thresholds.p50) return { key: 'normal', label: '正常', tone: 'normal' };
  if (s >= thresholds.p10) return { key: 'below', label: '略低于平均', tone: 'below' };
  return { key: 'low', label: '低于九成真实台词', tone: 'low' };
}
function calibrationDimension(observed, baseline, sampleSize, k = 2) {
  const obs = Number(observed);
  const base = Number(baseline);
  const n = Math.max(1, Math.round(Number(sampleSize) || 1));
  if (!Number.isFinite(obs)) return 0;
  if (!(base > 0)) return obs === 0 ? 1 : 0.5;
  const se = Math.sqrt(base * (1 - base) / n);
  const tol = Math.max(k * se, base * 0.2);
  if (!(tol > 0)) return 1;
  return Math.max(0, 1 - Math.min(1, Math.abs(obs - base) / tol));
}
function calibrationEndingHit(text, endings) {
  const forms = (Array.isArray(endings) ? endings : [])
    .map(e => String(e?.form ?? '').replace(/^[〜~]/, ''))
    .filter(Boolean);
  const sigCount = new Map();
  for (const form of forms) {
    const chars = Array.from(form);
    if (chars.length < 2) continue;
    const sig = chars.slice(-2).join('');
    sigCount.set(sig, (sigCount.get(sig) || 0) + 1);
  }
  const sigs = Array.from(sigCount.entries()).filter(([, count]) => count >= 2).map(([sig]) => sig);
  for (const part of String(text == null ? '' : text).split(/[。！？!?…\n]/u)) {
    const tail = part.replace(/[。．.！!？?…‥\s～☆♪♡─（）「」『』]+$/u, '');
    if (!tail) continue;
    if (forms.some(form => Array.from(form).length >= 2 && tail.endsWith(form))) return 1;
    if (sigs.some(sig => tail.endsWith(sig))) return 1;
  }
  return 0;
}
const CALIBRATION_SYMBOLS = '…！？～─♪☆♡　（）';
function countCalibrationSmallKana(text) {
  return Array.from(String(text == null ? '' : text)).filter(ch => /[ぁぃぅぇぉっゃゅょゎ]/u.test(ch)).length;
}
function scoreSceneConsistency(lines, card) {
  const texts = (Array.isArray(lines) ? lines : [])
    .map(line => typeof line === 'string' ? line : (line?.originalText ?? line?.content ?? line?.text ?? ''))
    .map(text => String(text == null ? '' : text))
    .filter(text => text.trim());
  if (!card || !texts.length) return null;
  const n = texts.length;
  const joined = texts.join('');
  const charCount = Array.from(joined).length || 1;
  const avgChars = charCount / n;
  const shape = cardTextShape(card);
  const lenMean = shape.len_mean;
  const metrics = [];
  const add = (key, label, score, actual, baseline) => {
    const s = Math.round(clampUnit(score) * 1000) / 1000;
    metrics.push({ key, label, score: s, actual, baseline });
  };

  add('length', '句长', calibrationDimension(avgChars / 40, lenMean / 40, n, 2.5),
    `${avgChars.toFixed(1)} 字/句`, `${lenMean.toFixed(1)} 字/句`);

  const endingHits = texts.reduce((sum, text) => sum + calibrationEndingHit(text, card.speech?.endings), 0);
  const endingObs = endingHits / n;
  const endingBase = shape.ending_hit_rate;
  const endingScore = endingBase > 0 ? Math.min(1, endingObs / endingBase) : endingObs;
  add('ending', '句尾', endingScore,
    `${endingHits}/${n} 句命中（${fmtPct(endingObs)}）`, `基准命中率 ${fmtPct(endingBase)}`);

  const kanjiCount = countKanjiChars(joined);
  const kanjiObs = kanjiCount / charCount;
  add('kanji', '汉字率', calibrationDimension(kanjiObs, shape.kanji_rate, charCount), fmtPct(kanjiObs), fmtPct(shape.kanji_rate));

  const symbolCount = Array.from(joined).filter(ch => CALIBRATION_SYMBOLS.includes(ch)).length;
  const perLineSymbols = symbolCount / n;
  const symbolTolerance = Math.max(2 * Math.sqrt(Math.max(shape.symbols_per_line, 0.1) / n), shape.symbols_per_line * 0.3);
  const symbolScore = symbolTolerance > 0
    ? Math.max(0, 1 - Math.min(1, Math.abs(perLineSymbols - shape.symbols_per_line) / symbolTolerance))
    : (symbolCount === 0 ? 1 : 0);
  add('symbols', '符号', symbolScore, `${perLineSymbols.toFixed(2)} 个/句`, `${shape.symbols_per_line.toFixed(2)} 个/句`);

  const smallCount = countCalibrationSmallKana(joined);
  const smallObs = smallCount / charCount;
  add('small_kana', '促音/小写假名', calibrationDimension(smallObs, shape.small_kana_rate, charCount), fmtPct(smallObs), fmtPct(shape.small_kana_rate));

  const longCount = countChar(joined, 'ー');
  const longObs = longCount / charCount;
  add('long_vowel', '长音', calibrationDimension(longObs, shape.long_vowel_rate, charCount), fmtPct(longObs), fmtPct(shape.long_vowel_rate));

  const total = Math.round((metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length) * 1000) / 1000;
  return { total, n, chars: charCount, avgChars, metrics, endingHits, endingHitRate: endingObs, shape };
}

/* 模型偶尔不写台词，而是回一句「【中文台词】の部分が空のようです。翻訳する中国語の台詞を貼ってください。」
   2a 压测里约 5% 的轮次会这样。这句会被当台词解析、进字幕 / TTS，所以要单独认出来。
   判据分两档：高置信度标记（【…】提示框架 / 「空のようです」 / 「〜に翻訳して」）直接判；
   否则要「两个以上元话语动词 + 请求语气」才判——真实台词里的「こっち来てください」不能被误杀。 */
const META_HEADER_RE = /【[^】]{0,16}(中文|台詞|台词|翻訳|译文|原文|出力|日本語|入力)[^】]{0,16}】/u;
const META_STRONG_RE = /の部分が空|翻訳する中国語|中国語の台詞を|日本語に翻訳して|台詞を貼|台本を貼|テキストを入力してください|台詞を入力してください|申し訳(ありません|ございません)が[^。]{0,30}できません/u;
const META_REQUEST_RE = /ください|下さい|お願いします|お願いいたします/u;
const META_VERBS = ['翻訳', '入力', '貼り付', '貼って', '提供', '記載', '指定', 'コピー', '送信'];
function looksLikeModelMeta(text) {
  const s = String(text == null ? '' : text).trim();
  if (!s) return false;
  if (META_HEADER_RE.test(s) || META_STRONG_RE.test(s)) return true;
  const verbs = META_VERBS.filter(v => s.includes(v)).length;
  return verbs >= 2 && META_REQUEST_RE.test(s);
}
/* 硬检查（错误级）：一人称、称呼。永远不参与分布分计算，
   但会让该行标红；规则开关只影响「改动说明」里的提示条，不影响这里的判定。 */
function lineHardChecks(content, card, ctx, options = {}) {
  const issues = [];
  if (!card) return issues;
  // 整行是『…』引用时，里面的人称不代表说话人（『全部俺のせい』这类），跳过一人称。
  const person = options.skipFirstPerson ? null : firstPersonIssue(content, card);
  if (person) {
    issues.push({ type: 'firstPerson', label: '一人称', level: 'error', message: person.message });
  }
  for (const item of (ctx ? scanAddressUsage(content, card, ctx, { useFullMatrix: options.useFullMatrix }) : [])) {
    issues.push({
      type: 'address', label: '称呼', level: item.level || 'error', message: item.message,
      targetId: item.targetId, form: item.form,
      candidates: Array.isArray(item.candidates) ? item.candidates : [],
      note: item.note || '',
      fixable: item.fixable !== false
    });
  }
  return issues;
}
function cardAge(card) {
  const explicit = asNumber(card?.age, 0);
  if (explicit > 0) return explicit;
  return ADULT_WORD_AGE[card?.id] || 0;
}
/* 角色名的异体字 / 简体字 / 旧字体 → 正确写法。
   模型从中文语境写日语时，经常把「灯織」写成「灯织」「燈織」。
   这里只做提示（warn），不改写。 */
const NAME_VARIANTS = [
  ['燈織', '灯織'], ['灯织', '灯織'], ['燈织', '灯織'],
  ['櫻木', '櫻木'], ['桜木', '櫻木'], ['樱木', '櫻木'],
  ['风野', '風野'], ['風野', '風野'],
  ['樹里', '樹里'], ['树里', '樹里'], ['樹理', '樹里'],
  ['凜世', '凛世'], ['凛世', '凛世'],
  ['结华', '結華'], ['結花', '結華'],
  ['雾子', '霧子'],
  ['果穗', '果穂'], ['果穂', '果穂'],
  ['智代子', '智代子'], ['知代子', '智代子'],
  ['夏叶', '夏葉'], ['夏葉', '夏葉'],
  ['冬优子', '冬優子'], ['冬優子', '冬優子'],
  ['爱依', '愛依'], ['愛依', '愛依'],
  ['円香', '円香'], ['円香', '円香'],
  ['小丝', '小糸'], ['小糸', '小糸'],
  ['雏菜', '雛菜'], ['雛菜', '雛菜'],
  ['日花', 'にちか'],
  ['叶月', 'はづき'], ['はづき', 'はづき'],
  ['朝日', 'あさひ'], ['あさひ', 'あさひ'],
  ['美琴', '美琴'],
  ['摩美美', '摩美々'], ['摩美々', '摩美々'],
  ['咲也', '咲耶'], ['咲耶', '咲耶'],
  ['露卡', 'ルカ'], ['ルカ', 'ルカ'],
  ['真乃', '真乃'],
  ['甜花', '甜花'],
  ['千雪', '千雪'],
  ['羽那', '羽那'],
  ['阳希', 'はるき'], ['春希', 'はるき'], ['はるき', 'はるき'],
];
const NAME_VARIANT_PAIRS = NAME_VARIANTS.filter(p => p[0] !== p[1]);
function variantIssue(content) {
  const text = String(content == null ? '' : content);
  const hits = [];
  for (const [wrong, right] of NAME_VARIANT_PAIRS) {
    if (text.includes(wrong)) hits.push({ wrong, right });
  }
  if (!hits.length) return null;
  const h = hits[0];
  const more = hits.length > 1 ? `（本行共 ${hits.length} 处）` : '';
  return { wrong: h.wrong, right: h.right, hits, message: `名字写成了「${h.wrong}」，正确是「${h.right}」${more}` };
}
function ageWordIssue(content, card) {
  const age = cardAge(card);
  if (!age || age > 15) return null;
  const hit = ADULT_WORK_WORDS.find(word => String(content == null ? '' : content).includes(word));
  if (!hit) return null;
  return {
    type: 'age', label: '年龄', level: 'warn',
    message: `${card.name_short}（${age} 岁）出现成人/商务词「${hit}」；同人设定可忽略，不影响分数`
  };
}
function registerMixInfo(bucket) {
  const card = bucket?.card;
  const lines = bucket?.lines || [];
  const keigoRate = asRate(card?.speech?.keigo_rate, 0);
  if (!card || lines.length < 3 || keigoRate >= 0.08) return null;
  const polite = [];
  const plain = [];
  for (const line of lines) {
    const text = String(line.content == null ? '' : line.content);
    // 「〜っす」是体育会系平语，不是敬体：「くださいっす」「いいっすよ」都不算敬体。
    const casual = /っす/.test(text);
    const isPolite = !casual && /(です|ます|ございます|ください|でしょう|ません|でした|ましょう)/u.test(text);
    const isPlain = !isPolite && /(だ|だよ|だね|じゃん|わよ|でしょ|かな|けど|ね|よ|な|さ|ぞ|ぜ)\s*[。！？!?…」』]*$/u.test(text);
    if (isPolite) polite.push(line);
    else if (isPlain) plain.push(line);
  }
  if (!polite.length || !plain.length) return null;
  // 一两句敬体是正常波动，不算声道混用；要「明显偏向敬体」才报。
  const politeRatio = polite.length / (polite.length + plain.length);
  if (polite.length < 2 || politeRatio < 0.35) return null;
  // keigo_rate 低 = 角色整体是平语；把混进来的敬体行标黄，提醒“营业腔/演法”而不是判错。
  return {
    type: 'register', label: '声道', level: 'warn',
    lineNos: polite.map(line => line.lineNo),
    message: `本角色 ${lines.length} 行里出现 ${polite.length} 行敬体 / ${plain.length} 行平语，而 keigo_rate 仅 ${fmtPct(keigoRate)}；标黄的是敬体行。同人设定可忽略，不影响分数`
  };
}
function dedupeIssues(issues) {
  const seen = new Set();
  const out = [];
  for (const issue of issues) {
    const key = `${severityOf(issue.level)}|${issue.type || ''}|${issue.message || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}
function collectAttachedIssues(line) {
  // 硬检查默认是错误级，但单项可以自报更低的级别（例如「语料里没有这条关系」只是提示）。
  const hard = (Array.isArray(line?.hardChecks) ? line.hardChecks : [])
    .map(issue => ({ ...issue, level: severityOf(issue.level || 'error') }));
  const hardTypes = new Set(hard.map(issue => issue.type));
  const warnings = (Array.isArray(line?.warnings) ? line.warnings : [])
    .filter(w => !(hardTypes.has(w.type) && (w.type === 'firstPerson' || w.type === 'address')))
    .map(w => ({ ...w, level: severityOf(w.level) }));
  return dedupeIssues([...hard, ...warnings]);
}
function collectLineIssues(line, card, ctx) {
  const hard = Array.isArray(line?.hardChecks) ? line.hardChecks : (card ? lineHardChecks(line?.originalText ?? line?.content ?? '', card, ctx) : []);
  return collectAttachedIssues({ ...line, hardChecks: hard });
}
function countSeverityCounts(result) {
  const counts = { error: 0, warn: 0, info: 0 };
  if (!result) return counts;
  const seen = new Set();
  const hardByLine = new Map();
  for (const line of (result.outputLines || [])) {
    const types = new Set((line.hardChecks || []).map(issue => issue.type));
    if (types.size) hardByLine.set(line.lineNo, types);
  }
  const add = (level, lineNo, message, type = '', fromHard = false) => {
    const sev = severityOf(level);
    const key = `${sev}|${lineNo == null ? '' : lineNo}|${message || ''}`;
    if (seen.has(key)) return;
    if (!fromHard && sev === 'error' && (type === 'firstPerson' || type === 'address') && hardByLine.get(lineNo)?.has(type)) return;
    seen.add(key);
    counts[sev] += 1;
  };
  for (const warning of (result.warnings || [])) add(warning.level, warning.lineNo, warning.message, warning.type);
  for (const line of (result.outputLines || [])) {
    for (const issue of (line.hardChecks || [])) add('error', line.lineNo, issue.message, issue.type, true);
  }
  return counts;
}
function clampUnit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function consistencyLevel(score) {
  if (score >= 0.85) return 'like';
  if (score >= 0.7) return 'ok';
  return 'bad';
}
function consistencyLevelLabel(level) {
  return level === 'like' ? '像' : (level === 'ok' ? '尚可' : '不像');
}
function countKanjiChars(text) {
  return Array.from(String(text == null ? '' : text)).filter(ch => KANJI_RE.test(ch)).length;
}
function countSmallKanaChars(text) {
  return Array.from(String(text == null ? '' : text)).filter(ch => SMALL_KANA_CHARS.has(ch)).length;
}
function countLongVowelChars(text) {
  return countChar(text, 'ー');
}
function countSymbolChars(text) {
  return Array.from(String(text == null ? '' : text)).filter(ch => !/\s/u.test(ch) && SYMBOL_CHAR_RE.test(ch)).length;
}
function endingSurface(text) {
  let s = String(text == null ? '' : text).trim();
  const closerRe = /[」』”’）)\]】〕〉》]/u;
  const punctRe = /[。．.！!？?、,，…‥・~～\s\u3000]/u;
  for (let pass = 0; pass < 2; pass += 1) {
    while (s && closerRe.test(s.slice(-1))) s = s.slice(0, -1).trim();
    while (s && punctRe.test(s.slice(-1))) s = s.slice(0, -1).trim();
  }
  return Array.from(s).slice(-3).join('');
}
function evaluateEnding(text, endings) {
  const forms = uniq((Array.isArray(endings) ? endings : [])
    .map(e => sentenceTokensForEnding(String(e?.form || '').replace(/^[〜~]/, '')))
    .filter(Boolean));
  const tail = endingSurface(text);
  if (!tail || !forms.length) return { score: 0, tail: tail || '—', form: null, forms };
  const hit = forms.find(form => {
    if (tail === form || tail.endsWith(form)) return true;
    // The line may end with a fragment of a longer ending (e.g. っす〜 → いっす).
    return Array.from(form).length >= 2 && Array.from(tail).length >= 2 && form.endsWith(tail);
  }) || null;
  return { score: hit ? 1 : 0, tail, form: hit, forms };
}
function evaluateFirstPerson(text, card) {
  const source = String(text == null ? '' : text);
  const expectedRaw = String(card?.speech?.first_person || '').trim();
  const expectedFamily = firstPersonFamily(expectedRaw);
  const extraAllowed = card?.id === 'mei' ? new Set(['あたし', 'うち']) : null;
  const hit = [];
  for (const pronoun of FIRST_PERSON_FORMS) {
    if (!source.includes(pronoun)) continue;
    const fam = firstPersonFamily(pronoun);
    if ((expectedFamily && fam === expectedFamily) || (extraAllowed && extraAllowed.has(fam))) hit.push(pronoun);
  }
  if (expectedRaw && source.includes(expectedRaw)) hit.unshift(expectedRaw);
  const wrong = [];
  for (const pronoun of FIRST_PERSON_FORMS) {
    if (!source.includes(pronoun)) continue;
    const fam = firstPersonFamily(pronoun);
    if ((expectedFamily && fam === expectedFamily) || (extraAllowed && extraAllowed.has(fam))) continue;
    wrong.push(pronoun);
  }
  if (wrong.length) {
    return { score: 0.4, actual: `误用「${wrong[0]}」`, expected: expectedRaw || '—', state: 'wrong' };
  }
  if (hit.length) {
    return { score: 1, actual: `含「${hit[0]}」`, expected: expectedRaw || '—', state: 'hit' };
  }
  return { score: 0.85, actual: '省略（日语常见）', expected: expectedRaw || '—', state: 'omitted' };
}
function scoreConsistency(text, card) {
  const source = String(text == null ? '' : text);
  if (!card) {
    return { total: 0, level: 'bad', label: '不像', metrics: [], chars: 0, sentenceCount: 0 };
  }
  const chars = speakableChars(source);
  const shape = cardTextShape(card);
  const avgLen = Math.max(1, asNumber(card.speech?.avg_len, 16));
  const sentences = sentenceSplit(source);
  const sentenceCount = Math.max(1, sentences.length);
  const metrics = [];
  const addMetric = (key, label, score, actual, baseline) => {
    const s = Math.round(clampUnit(score) * 100) / 100;
    metrics.push({ key, label, score: s, level: consistencyLevel(s), actual, baseline });
  };

  const lengthScore = 1 - Math.min(1, Math.abs(chars - avgLen) / (avgLen * 0.4));
  addMetric('length', '句长', lengthScore, `${chars} 字`, `${avgLen.toFixed(1)} 字`);

  const ending = evaluateEnding(source, card.speech?.endings);
  addMetric(
    'ending', '句尾', ending.score,
    ending.tail ? `${ending.tail}${ending.form ? ` → ${ending.form}` : '（未命中）'}` : '—',
    ending.forms.slice(0, 4).join(' / ') + (ending.forms.length > 4 ? ` 等 ${ending.forms.length} 个` : '')
  );

  const priorLines = 3;
  const priorChars = Math.max(0, priorLines * shape.chars_per_line - chars);
  const smoothedDenom = Math.max(1, chars + priorChars);
  const resolutionFloor = 0.5 / Math.max(1, shape.chars_per_line);
  const rateScore = (count, baselineRate, toleranceScale) => {
    if (baselineRate <= 0) return count === 0 ? 1 : clampUnit(1 - count * 0.25);
    const smoothed = (count + baselineRate * priorChars) / smoothedDenom;
    const tolerance = Math.max(baselineRate * toleranceScale, resolutionFloor);
    return clampUnit(1 - Math.min(1, Math.abs(smoothed - baselineRate) / tolerance));
  };

  const kanjiCount = countKanjiChars(source);
  const kanjiObserved = chars > 0 ? kanjiCount / chars : 0;
  addMetric('kanji', '汉字率', rateScore(kanjiCount, shape.kanji_rate, 0.4), fmtPct(kanjiObserved), fmtPct(shape.kanji_rate));

  const symbolCount = countSymbolChars(source);
  const perLineSymbols = symbolCount / sentenceCount;
  const symbolScore = shape.symbols_per_line <= 0
    ? (symbolCount === 0 ? 1 : 0)
    : 1 - Math.min(1, Math.abs(perLineSymbols - shape.symbols_per_line) / (shape.symbols_per_line * 0.5));
  addMetric('symbols', '符号密度', symbolScore, `${perLineSymbols.toFixed(2)} 个/句`, `${shape.symbols_per_line.toFixed(2)} 个/句`);

  const smallCount = countSmallKanaChars(source);
  const smallObserved = chars > 0 ? smallCount / chars : 0;
  addMetric('small_kana', '促音/小写假名', rateScore(smallCount, shape.small_kana_rate, 0.5), fmtPct(smallObserved), fmtPct(shape.small_kana_rate));

  const longCount = countLongVowelChars(source);
  const longObserved = chars > 0 ? longCount / chars : 0;
  addMetric('long_vowel', '长音', rateScore(longCount, shape.long_vowel_rate, 0.5), fmtPct(longObserved), fmtPct(shape.long_vowel_rate));

  const person = evaluateFirstPerson(source, card);
  addMetric('first_person', '一人称', person.score, person.actual, person.expected);

  const total = Math.round((metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length) * 100) / 100;
  const level = consistencyLevel(total);
  return { total, level, label: consistencyLevelLabel(level), metrics, chars, sentenceCount, ending, person };
}

/* ── TTS export model / formats ───────────────────────────── */
const TTS_FORMATS = Object.freeze([
  { key: 'json', label: 'JSON', ext: 'json', mime: 'application/json' },
  { key: 'txt', label: 'TXT', ext: 'txt', mime: 'text/plain' },
  { key: 'srt', label: 'SRT', ext: 'srt', mime: 'application/x-subrip' },
  { key: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv' }
]);
function ttsCpsForCard(card) {
  return Math.max(0.1, asNumber(card?.speech?.speed_cps, BASELINE_CPS));
}
function ttsSpeedForCard(card) {
  return Math.round((ttsCpsForCard(card) / BASELINE_CPS) * 100) / 100;
}
function ttsEstimateSec(text, card) {
  return Math.round((speakableChars(text) / ttsCpsForCard(card)) * 10) / 10;
}
function detectSpeechMode(text) {
  const source = String(text == null ? '' : text);
  // 本色 cues first: these words almost never appear in the public "ふゆ" persona
  if (/(あたし|あんた|あいつ|くそ|ざまぁ|バカ)/u.test(source)) return '本色';
  if (/[♡♪☆～]/u.test(source)) return '营业';
  if (/(です|ます|ましょ|ございます|ください|でしょう|でしょ|ません|いたします|いただ)/u.test(source)) return '营业';
  return '本色';
}
function scoreResultLines(result, cards = state.cards) {
  if (!result || !Array.isArray(result.outputLines)) return [];
  if (result._scoreCache && result._scoreCache.cards === cards) return result._scoreCache.rows;
  const rows = [];
  for (const line of result.outputLines) {
    if (line.type !== 'dialogue' || !line.speakerId) continue;
    const card = cards.get(line.speakerId);
    if (!card) continue;
    const text = line.originalText != null ? line.originalText : line.content;
    rows.push({ line, card, text, score: scoreConsistency(text, card) });
  }
  result._scoreCache = { cards, rows };
  return rows;
}
function buildTTSModel(result, options = {}) {
  const cards = options.cards || state.cards;
  const scene = options.scene != null ? options.scene : state.scene;
  const scored = scoreResultLines(result, cards);
  const lines = [];
  let totalRaw = 0;
  for (const row of scored) {
    const { card, text, score } = row;
    const speed = ttsSpeedForCard(card);
    const cps = ttsCpsForCard(card);
    const rawSec = speakableChars(text) / cps;
    totalRaw += rawSec;
    lines.push({
      i: lines.length + 1,
      speaker: card.id,
      name_jp: card.name_jp || card.name_short || card.id,
      text,
      speed,
      mode: detectSpeechMode(text),
      est_sec: Math.round(rawSec * 10) / 10,
      consistency: score.total,
      _estRaw: rawSec,
      _score: score
    });
  }
  const totalSec = Math.round(totalRaw * 10) / 10;
  const speakers = uniq(lines.map(l => l.speaker));
  const avgConsistency = lines.length
    ? Math.round((lines.reduce((sum, l) => sum + l.consistency, 0) / lines.length) * 100) / 100
    : 0;
  return {
    version: 1,
    baseline_cps: BASELINE_CPS,
    scene: String(scene == null ? '' : scene).trim() || '未指定',
    lines,
    total_sec: totalSec,
    stats: { totalSec, lineCount: lines.length, speakerCount: speakers.length, avgConsistency, level: consistencyLevel(avgConsistency) }
  };
}
function formatSrtTime(seconds) {
  const totalMs = Math.max(0, Math.round(Number(seconds) * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const p2 = n => String(n).padStart(2, '0');
  return `${p2(h)}:${p2(m)}:${p2(s)},${String(ms).padStart(3, '0')}`;
}
function csvCell(value) {
  const s = String(value == null ? '' : value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function buildTTSExport(result, format = 'json', options = {}) {
  const model = options.model || buildTTSModel(result, options);
  const fmt = TTS_FORMATS.some(f => f.key === format) ? format : 'json';
  if (fmt === 'txt') {
    return model.lines.map(l => `# ${l.speaker}|${l.speed.toFixed(2)}|${l.mode}\n${l.text}`).join('\n') + (model.lines.length ? '\n' : '');
  }
  if (fmt === 'srt') {
    let cursor = 0;
    return model.lines.map(l => {
      const start = cursor;
      cursor += Number.isFinite(l._estRaw) ? l._estRaw : l.est_sec;
      return `${l.i}\n${formatSrtTime(start)} --> ${formatSrtTime(cursor)}\n${l.name_jp}：${l.text}`;
    }).join('\n\n') + (model.lines.length ? '\n' : '');
  }
  if (fmt === 'csv') {
    const head = '序号,角色id,角色名,台词,speed,时长秒,一致性';
    const rows = model.lines.map(l => [
      l.i, l.speaker, l.name_jp, l.text, l.speed.toFixed(2), l.est_sec.toFixed(1), l.consistency.toFixed(2)
    ].map(csvCell).join(','));
    return [head, ...rows].join('\n') + '\n';
  }
  const payload = {
    version: 1,
    baseline_cps: model.baseline_cps,
    scene: model.scene,
    lines: model.lines.map(l => ({
      i: l.i,
      speaker: l.speaker,
      name_jp: l.name_jp,
      text: l.text,
      speed: l.speed,
      mode: l.mode,
      est_sec: l.est_sec,
      consistency: l.consistency
    })),
    total_sec: model.total_sec
  };
  return JSON.stringify(payload, null, 2);
}
function ttsFormatMeta(format) {
  return TTS_FORMATS.find(f => f.key === format) || TTS_FORMATS[0];
}

/* ── shorthand parser ─────────────────────────────────────── */
const HEADING_LINE_RE = /^\s*(?:#{1,6}\s|```|~~~|---{3,}|={3,}|\*\*{3,})/u;
function stripOuterDialogueQuotes(text) {
  let s = String(text == null ? '' : text).trim();
  const pairs = [['「', '」'], ['『', '』'], ['“', '”'], ['"', '"'], ['‘', '’'], ["'", "'"]];
  for (const [open, close] of pairs) {
    if (s.startsWith(open) && s.endsWith(close) && s.length >= 2) {
      s = s.slice(open.length, s.length - close.length).trim();
      break;
    }
  }
  return s;
}
function cleanSpeakerPart(part) {
  return String(part == null ? '' : part)
    .replace(/^[\s>*#`\-–—•·]+/u, '')
    .replace(/[*`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function _stripScsSpeakerTag(part) {
  const s = String(part == null ? '' : part).trim();
  // Support .scs.yaml style: 冬優子@fuyuko(smile,wait) or 冬優子(smile,wait)
  const m = s.match(/^([^@()\s]+?)@([A-Za-z0-9_]+)(?:\([^)]*\))?$/u);
  if (m) return m[2] === 'none' || m[2] === 'off' ? m[1] : m[2];
  const m2 = s.match(/^([^()]+?)\([A-Za-z0-9_,\s-]+\)$/u);
  if (m2) return m2[1].trim();
  return s;
}
function splitSpeakerTarget(prefix) {
  const raw = String(prefix == null ? '' : prefix).trim();
  let m = raw.match(/^(.*?)\s*(?:→|⇒|->|=>|＞)\s*(.*?)$/u);
  if (m) return { speakerPart: _stripScsSpeakerTag(m[1]), targetPart: m[2] };
  m = raw.match(/^(.*?)\s+@\s*(\S+)\s*$/u);
  if (m) return { speakerPart: _stripScsSpeakerTag(m[1]), targetPart: m[2] };
  return { speakerPart: _stripScsSpeakerTag(raw), targetPart: '' };
}
function _extractInlineBilingual(text) {
  const s = String(text == null ? '' : text);
  if (!s || /https?:\/\//i.test(s)) return { main: s, zhText: '' };
  const m = s.match(/^(.*?)(?:\s+\/\/\s+|\s+\|\|\s+|\s+‖\s+)(.+)$/u);
  if (m && m[1].trim()) return { main: m[1], zhText: m[2].trim() };
  const m2 = s.match(/^(.*?)\s*[（(]译[：:]\s*([^）)]+)[）)]\s*$/u);
  if (m2 && m2[1].trim()) return { main: m2[1], zhText: m2[2].trim() };
  return { main: s, zhText: '' };
}
function resolveTargetToken(token, ctx) {
  const raw = String(token == null ? '' : token)
    .replace(/^@/, '')
    .replace(/^[（(【\[]|[）)】\]]$/g, '')
    .replace(/[*`]+$/g, '')
    .trim();
  if (!raw) return { card: null, token: raw, knownCode: false, ambiguous: [] };
  const code = cleanCodeKey(raw);
  if (ctx.codeToCard.has(code)) {
    return { card: ctx.codeToCard.get(code) || null, token: raw, knownCode: true, ambiguous: [] };
  }
  const alias = resolveSpeakerAlias(raw, ctx);
  if (alias.card) return { card: alias.card, token: raw, knownCode: false, ambiguous: [] };
  if (alias.ambiguous.length) return { card: null, token: raw, knownCode: false, ambiguous: alias.ambiguous };
  const card = resolveCardReference(raw, ctx.cardsMap, ctx.aliasTable);
  return { card: card || null, token: raw, knownCode: false, ambiguous: [] };
}
function parseScriptText(text, ctx) {
  const source = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rawLines = source.split('\n');
  const entries = [];
  const warnings = [];
  const ignored = [];
  const failures = [];

  const makeWarning = (lineNo, message) => {
    warnings.push({ type: 'parse', label: '解析', level: 'warn', lineNo, message });
  };
  const suggestFix = line => {
    // Used by the "第 N 行无法识别" panel. Returns a rewrite candidate
    // ({ code, targetCode, content }) or an ambiguity ({ candidates, content }).
    const trimmed = String(line == null ? '' : line).trim();
    if (!trimmed) return null;
    const attempts = [];
    const colon = trimmed.match(/^(.{1,48}?)[：:]\s*([\s\S]*)$/u);
    if (colon) attempts.push({ prefix: colon[1], content: colon[2] });
    const quote = trimmed.match(/^(.{1,48}?)[「『]([\s\S]*?)[」』]\s*$/u);
    if (quote) attempts.push({ prefix: quote[1], content: quote[2] });
    const openQuote = trimmed.match(/^(.{1,48}?)[「『]([\s\S]*)$/u);
    if (openQuote) attempts.push({ prefix: openQuote[1], content: openQuote[2] });
    const bracket = trimmed.match(/^【(.{1,48}?)】\s*([\s\S]+)$/u);
    if (bracket) attempts.push({ prefix: bracket[1], content: bracket[2] });
    for (const attempt of attempts) {
      const { speakerPart, targetPart } = splitSpeakerTarget(attempt.prefix);
      const resolved = resolveSpeakerPrefix(speakerPart, ctx);
      if (resolved.card) {
        const content = stripOuterDialogueQuotes(attempt.content);
        if (!content) continue;
        let targetCode = '';
        if (targetPart) {
          const t = resolveTargetToken(targetPart, ctx);
          if (t.card && t.card.id !== resolved.card.id) targetCode = primaryCodeForCard(t.card, ctx);
        }
        return { code: primaryCodeForCard(resolved.card, ctx), targetCode, content };
      }
      if (resolved.ambiguous?.length) {
        const targetToken = targetPart ? resolveTargetToken(targetPart, ctx) : null;
        const targetCode = targetToken?.card ? primaryCodeForCard(targetToken.card, ctx) : '';
        return {
          candidates: resolved.ambiguous.map(card => ({ card, code: primaryCodeForCard(card, ctx) })),
          content: stripOuterDialogueQuotes(attempt.content),
          targetCode
        };
      }
    }
    return null;
  };
  const addFailure = (lineNo, raw, message, fix = null) => {
    failures.push({ lineNo, raw, message, fix });
  };
  const addDialogue = (lineNo, raw, speakerPart, targetPart, contentPart) => {
    const resolved = resolveSpeakerPrefix(speakerPart, ctx);
    if (!resolved.card && !resolved.knownCode) {
      const prefixLabel = truncate(cleanSpeakerPart(speakerPart), 30);
      if (resolved.ambiguous?.length) {
        const names = resolved.ambiguous.map(card => `${card.name_jp}（${primaryCodeForCard(card, ctx)}）`).join(' / ');
        const message = `说话人有歧义：「${prefixLabel}」可能指 ${names}；不自动猜测，请改用角色代码`;
        makeWarning(lineNo, message);
        const targetToken = targetPart ? resolveTargetToken(targetPart, ctx) : null;
        addFailure(lineNo, raw, message, {
          candidates: resolved.ambiguous.map(card => ({ card, code: primaryCodeForCard(card, ctx) })),
          content: stripOuterDialogueQuotes(contentPart),
          targetCode: targetToken?.card ? primaryCodeForCard(targetToken.card, ctx) : ''
        });
      } else {
        const message = `无法识别说话人「${prefixLabel}」，该行已跳过`;
        makeWarning(lineNo, message);
        addFailure(lineNo, raw, message, suggestFix(raw));
      }
      return false;
    }
    // 整行被『』包住 = 引用的别人的话（标题 / 广告词 / 台词本）。剥掉引号后
    // 人称会变成说话人的，所以先把标记留下，一人称检查据此放行。
    const bi = _extractInlineBilingual(contentPart);
    const mainPart = bi.main;
    const rawForGrammar = bi.zhText ? String(raw).replace(/(?:\s+\/\/\s+|\s+\|\|\s+|\s+‖\s+|\s*[（(]译[：:]).*$/u, '') : raw;
    const wholeQuoted = /^\s*『[\s\S]*』\s*$/u.test(String(mainPart == null ? '' : mainPart));
    let content = stripOuterDialogueQuotes(mainPart);
    if (!content) {
      const message = '台词为空，该行已跳过';
      makeWarning(lineNo, message);
      addFailure(lineNo, raw, message, null);
      return false;
    }
    let target = null;
    if (targetPart) {
      const t = resolveTargetToken(targetPart, ctx);
      if (t.card) target = { card: t.card, token: t.token, explicit: true };
      else if (t.ambiguous?.length) {
        const names = t.ambiguous.map(card => `${card.name_jp}（${primaryCodeForCard(card, ctx)}）`).join(' / ');
        makeWarning(lineNo, `显式对象「${truncate(t.token, 24)}」有歧义：可能指 ${names}；本行按无对象处理`);
      } else {
        makeWarning(lineNo, `显式对象「${truncate(t.token, 24)}」未匹配到角色`);
      }
    }
    let speakerCard = resolved.card || null;
    let speakerLabel = speakerCard ? speakerCard.name_jp : resolved.token;
    if (resolved.knownCode && !speakerCard) {
      const entry = ctx.codeEntries.find(e => e.code === resolved.code);
      speakerLabel = entry?.target || resolved.token;
      makeWarning(lineNo, `代码「${resolved.token}」没有匹配到已载入角色卡；将以「${speakerLabel}」输出`);
    }
    if (!resolved.knownCode && !speakerCard) return false;
    if (target?.card && speakerCard && target.card.id === speakerCard.id) {
      makeWarning(lineNo, `对象与说话人相同（${speakerCard.name_short}），已忽略显式对象`);
      target = null;
    }
    entries.push({
      type: 'dialogue',
      lineNo,
      rawLine: raw,
      speakerId: speakerCard?.id || null,
      speakerCard,
      speakerLabel,
      speakerToken: resolved.token,
      speakerCode: speakerCard ? primaryCodeForCard(speakerCard, ctx) : cleanCodeKey(resolved.token),
      explicitTargetId: target?.card?.id || null,
      explicitTargetCode: target?.card ? primaryCodeForCard(target.card, ctx) : '',
      explicitTargetBasis: target ? { kind: 'explicit', token: target.token, refLine: lineNo } : null,
      content,
      zhText: bi.zhText || '',
      rawForGrammar,
      quoted: wholeQuoted,
      originalContent: content,
      targetId: null,
      targetCard: null,
      targetBasis: null,
      mentions: null
    });
    return true;
  };

  rawLines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.trim();
    if (!line) return;
    if (HEADING_LINE_RE.test(line)) { ignored.push({ lineNo, raw, reason: 'markdown/分隔行' }); return; }

    // Entire line as stage direction: preserve as narration.
    if (/^[※]?\s*[（(][\s\S]*[）)]$/u.test(line)) {
      const content = line.replace(/^※\s*/u, '');
      entries.push({ type: 'narration', lineNo, rawLine: raw, content, originalContent: content, speakerId: null });
      return;
    }

    // Colon format. Try it before quote format because the content may contain quotes/colons.
    const colonMatch = line.match(/^([^\n：:]{1,48})[：:]\s*([\s\S]*)$/u);
    if (colonMatch) {
      const prefix = colonMatch[1];
      const { speakerPart, targetPart } = splitSpeakerTarget(prefix);
      const resolved = resolveSpeakerPrefix(speakerPart, ctx);
      if (resolved.card || resolved.knownCode || resolved.ambiguous?.length) {
        addDialogue(lineNo, raw, speakerPart, targetPart, colonMatch[2]);
        return;
      }
    }

    // Name「台词」 / Name『台词』
    const quoteMatch = line.match(/^(.{1,48}?)[「『]([\s\S]*)[」』]\s*$/u);
    if (quoteMatch) {
      const { speakerPart, targetPart } = splitSpeakerTarget(quoteMatch[1]);
      const resolved = resolveSpeakerPrefix(speakerPart, ctx);
      if (resolved.card || resolved.knownCode || resolved.ambiguous?.length) {
        addDialogue(lineNo, raw, speakerPart, targetPart, quoteMatch[2]);
        return;
      }
    }

    // Tolerate an LLM line that lost its closing 」 / 』 (very common when a
    // long line is truncated): Name「台词… — the rest of the line is content.
    const openQuoteMatch = line.match(/^(.{1,48}?)[「『]([\s\S]+)$/u);
    if (openQuoteMatch) {
      const { speakerPart, targetPart } = splitSpeakerTarget(openQuoteMatch[1]);
      const resolved = resolveSpeakerPrefix(speakerPart, ctx);
      if (resolved.card || resolved.knownCode || resolved.ambiguous?.length) {
        addDialogue(lineNo, raw, speakerPart, targetPart, openQuoteMatch[2]);
        return;
      }
    }

    // 【Name】台词
    const bracketMatch = line.match(/^【(.{1,48}?)】\s*([\s\S]+)$/u);
    if (bracketMatch) {
      const { speakerPart, targetPart } = splitSpeakerTarget(bracketMatch[1]);
      const resolved = resolveSpeakerPrefix(speakerPart, ctx);
      if (resolved.card || resolved.knownCode || resolved.ambiguous?.length) {
        addDialogue(lineNo, raw, speakerPart, targetPart, bracketMatch[2]);
        return;
      }
    }

    // A line starting with "※" but not fully parenthesized → narration-ish.
    if (line.startsWith('※')) {
      entries.push({ type: 'narration', lineNo, rawLine: raw, content: line.replace(/^※\s*/u, ''), originalContent: line, speakerId: null });
      return;
    }

    const message = `无法解析这一行：${truncate(line, 54)}`;
    makeWarning(lineNo, message);
    addFailure(lineNo, raw, message, suggestFix(raw));
  });

  return { entries, warnings, ignored, failures };
}
function inferTargets(entries, ctx) {
  const dialogues = entries.filter(e => e.type === 'dialogue');
  const dialogueIndex = new Map(dialogues.map((e, i) => [e, i]));
  for (const entry of dialogues) {
    if (entry.explicitTargetId) {
      const card = ctx.cardsMap.get(entry.explicitTargetId) || null;
      entry.targetId = card?.id || null;
      entry.targetCard = card;
      entry.targetBasis = { kind: 'explicit', refLine: entry.lineNo, token: entry.explicitTargetBasis?.token || '' };
      continue;
    }
    const mention = findMentionedCards(entry.originalContent || entry.content, entry.speakerId, ctx);
    if (mention) {
      entry.targetId = mention.card.id;
      entry.targetCard = mention.card;
      entry.mentions = mention;
      entry.targetBasis = { kind: 'mention', refLine: entry.lineNo, token: mention.token };
      continue;
    }
    const idx = dialogueIndex.get(entry);
    let target = null;
    let basis = null;
    const next = dialogues[idx + 1];
    if (next && next.speakerCard && next.speakerId && next.speakerId !== entry.speakerId) {
      target = next.speakerCard;
      basis = { kind: 'next', refLine: next.lineNo };
    } else {
      const prev = dialogues[idx - 1];
      if (prev && prev.speakerCard && prev.speakerId && prev.speakerId !== entry.speakerId) {
        target = prev.speakerCard;
        basis = { kind: 'prev', refLine: prev.lineNo };
      }
    }
    if (target) {
      entry.targetId = target.id;
      entry.targetCard = target;
      entry.targetBasis = basis;
    }
  }
  return entries;
}

/* ── reading / kana conversion (legacy utility only) ──────── */
/* The 朗读版 output was removed in favour of 原文形态版. These helpers are
   kept only for the historical self-test; they must not feed any output. */
function buildReadingDictionary(cardsMap) {
  const dict = new Map();
  const add = (key, kana) => {
    const k = String(key == null ? '' : key).trim();
    const v = String(kana == null ? '' : kana).trim();
    if (!k || !v) return;
    // One-character names are kept, but convertNamesToKana applies a stricter
    // boundary guard for them (so 透明 is never read as とおる明).
    dict.set(k, v);
  };
  for (const meta of MOCK_META) {
    add(meta.jp, meta.kana);
    add(meta.short, shortKanaFromMeta(meta));
    add(meta.surname, meta.sk);
  }
  for (const card of cardsMap.values()) {
    const meta = builtInMetaFor(card);
    const kana = card.kana || meta?.kana || '';
    const surnameKana = card.surname_kana || meta?.sk || '';
    add(card.name_jp, kana);
    add(card.name_jp?.replace(/\s+/g, ''), kana);
    if (kana) {
      let shortKana = '';
      if (surnameKana && kana.includes(surnameKana)) {
        shortKana = kana.replace(surnameKana, '').trim();
      } else {
        const parts = kana.replace(surnameKana, '').trim().split(/\s+/).filter(Boolean);
        shortKana = parts.length ? parts[parts.length - 1] : '';
      }
      add(card.name_short, shortKana || kana);
    }
    add(card.surname, surnameKana);
  }
  for (const [place, reading] of Object.entries(BUILTIN_PLACE_READINGS)) add(place, reading);
  return dict;
}
function convertNamesToKana(text, readingDict) {
  const source = String(text == null ? '' : text);
  const allKeys = Array.from(readingDict.keys());
  const longKeys = allKeys.filter(k => Array.from(k).length >= 2).sort((a, b) => b.length - a.length);
  const singleKeys = allKeys.filter(k => Array.from(k).length === 1);
  if (!longKeys.length && !singleKeys.length) return { text: source, count: 0, details: new Map() };
  const details = new Map();
  let count = 0;
  const remember = (matched, kana) => {
    if (!kana || kana === matched) return matched;
    count += 1;
    const old = details.get(matched) || { kana, count: 0 };
    old.count += 1;
    details.set(matched, old);
    return kana;
  };
  let out = source;
  if (longKeys.length) {
    const re = new RegExp(longKeys.map(escapeRegExp).join('|'), 'gu');
    out = out.replace(re, matched => remember(matched, readingDict.get(matched)));
  }
  if (singleKeys.length) {
    // A single kanji name only becomes kana when it behaves like a name/place
    // reference: followed by an honorific, particle, punctuation, quote or end.
    const honor = HONORIFICS.map(escapeRegExp).join('|');
    const guard = `${honor}|[、。！？!?…\\s「」『』（）()]|は|が|を|に|の|も|と|へ|で|や|か|ね|よ|な|$`;
    const re = new RegExp(`(${singleKeys.map(escapeRegExp).join('|')})(?=${guard})`, 'gu');
    out = out.replace(re, matched => remember(matched, readingDict.get(matched)));
  }
  return { text: out, count, details };
}

/* ── aggregate checks / main analysis ─────────────────────── */
function traitPatternFor(name) {
  if (TRAIT_PATTERNS[name]) return TRAIT_PATTERNS[name];
  const lower = String(name || '').toLowerCase();
  const matched = Object.keys(TRAIT_PATTERNS).find(k => k.toLowerCase() === lower);
  if (matched) return TRAIT_PATTERNS[matched];
  return null;
}
function traitMatches(sentence, traitName) {
  const pattern = traitPatternFor(traitName);
  if (!pattern) return false;
  return pattern.test(sentence);
}
function buildTraitQuotaReport(speakerData, ctx) {
  const rows = [];
  let overCount = 0;
  for (const data of speakerData) {
    const card = data.card;
    if (!card) continue;
    const traits = Object.entries(card.traits || {}).sort((a, b) => b[1] - a[1]);
    if (!traits.length) continue;
    const sentences = data.sentences;
    for (const [trait, rate] of traits) {
      const quota = calcTraitQuota(data.sentenceCount, rate);
      let used = 0;
      for (const sentence of sentences) {
        if (traitMatches(sentence, trait)) used += 1;
      }
      const over = used > quota;
      if (over) overCount += 1;
      rows.push({
        speakerId: card.id,
        speakerName: card.name_short,
        trait,
        rate,
        quota,
        used,
        over,
        sentenceCount: data.sentenceCount,
        detector: traitPatternFor(trait) ? 'keyword' : 'none'
      });
    }
  }
  return { rows, overCount };
}
function buildSymbolReport(speakerData, rules) {
  if (!rules.symbols) return { rows: [], overCount: 0 };
  const rows = [];
  let overCount = 0;
  for (const data of speakerData) {
    const card = data.card;
    if (!card) continue;
    const sentences = Array.isArray(data.sentences) && data.sentences.length
      ? data.sentences
      : (data.lines || []).map(l => l.content || '');
    const outputSentenceCount = Math.max(1, data.sentenceCount || sentences.length || data.lineCount || 1);
    const baselineLineCount = Math.max(0, card.line_count);
    for (const symbol of REQUIRED_SYMBOLS) {
      const baselineSentenceCount = asNumber(card.symbols?.[symbol], 0);
      const charCount = (data.lines || []).reduce((sum, l) => sum + countChar(l.content, symbol), 0);
      const sentenceCount = sentences.filter(s => String(s).includes(symbol)).length;
      const baselineDensity = baselineLineCount > 0 ? baselineSentenceCount / baselineLineCount : 0;
      const expected = baselineDensity * outputSentenceCount;
      if (!baselineSentenceCount && !charCount) continue;
      const over = sentenceCount > expected + 1e-9;
      if (over) overCount += 1;
      rows.push({
        speakerId: card.id,
        speakerName: card.name_short,
        symbol,
        charCount,
        sentenceCount,
        outputSentenceCount,
        baselineSentenceCount,
        baselineLineCount,
        baselineDensity,
        expected,
        actualDensity: sentenceCount / outputSentenceCount,
        over,
        baselineZero: baselineSentenceCount === 0
      });
    }
  }
  return { rows, overCount };
}

function analyzeScriptText(rawText, cardsMap = state.cards, codeMap = state.codeMap, rules = state.rules, options = {}) {
  const ctx = buildContext(cardsMap, codeMap);
  const parsed = parseScriptText(rawText, ctx);
  inferTargets(parsed.entries, ctx);
  /* 「当前 cast」：Tab2/Tab3 用角色勾选（空集 = 用户主动清空，不报未出场）；
     Tab1 没有勾选框，用本场实际说话的说话人当 cast。
     用鸭子类型判断 Set，避免跨 realm（iframe / 测试环境）时 instanceof 失效。 */
  const castOption = (options.cast && typeof options.cast.has === 'function' && typeof options.cast.size === 'number')
    ? options.cast : null;
  const castIds = castOption
    ? new Set(castOption)
    : new Set(parsed.entries.filter(e => e.type === 'dialogue' && e.speakerId).map(e => e.speakerId));
  const warnings = [...parsed.warnings];
  const changes = [];
  const outputLines = [];
  const speakerBuckets = new Map();
  const timings = [];
  let firstPersonFixCount = 0;
  let dialogueLineCount = 0;
  let metaLineCount = 0;
  let narrationCount = 0;
  let sentenceCount = 0;
  let charCount = 0;

  // Per-line warnings are attached both to the line view and the flat warning list.
  const addWarning = (lineNo, type, message, level = 'warn') => {
    const labels = {
      address: '称呼', rare_address: '罕见称呼', firstPerson: '一人称', endings: '句尾', register: '声道',
      length: '句长', textbox: '框长', age: '年龄', parse: '解析', symbol: '符号', quota: '配额', general: '提示',
      grammar: '语法', repeat: '重复', truncated: '半截句', cast: '出场', meta: '像报错',
      ooc_pattern: 'OOC反模式', peer_term: '称谓', variant: '异体字', dialect: '语体'
    };
    const warning = { lineNo, type, label: labels[type] || type, message, level };
    warnings.push(warning);
    return warning;
  };

  for (const entry of parsed.entries) {
    const lineWarnings = [];
    let content = entry.content;
    let scriptText = '';
    let speakerCard = entry.speakerId ? ctx.cardsMap.get(entry.speakerId) : null;
    let targetCard = entry.targetId ? ctx.cardsMap.get(entry.targetId) : null;
    let addressOccurrences = [];
    let seconds = null;

    if (entry.type === 'narration') {
      narrationCount += 1;
      scriptText = `※${content}`;
      outputLines.push({
        lineNo: entry.lineNo,
        type: 'narration',
        speakerId: null,
        speakerLabel: '',
        speakerCode: '',
        content,
        originalText: content,
        text: scriptText,
        readingText: scriptText,
        warnings: [],
        targetId: null,
        targetName: '',
        targetBasis: null,
        explicitTargetCode: '',
        seconds: null
      });
      continue;
    }

    dialogueLineCount += 1;
    const replacement = speakerCard && rules.addressReplace
      ? replaceOtherNamesWithAddresses(content, speakerCard, ctx, true)
      : { content, occurrences: [] };
    content = replacement.content;
    addressOccurrences = replacement.occurrences;

    // Optional first-person correction: only when the rule is enabled.
    let firstPersonFixes = [];
    if (speakerCard && rules.firstPersonFix) {
      const fix = correctFirstPerson(content, speakerCard);
      content = fix.text;
      firstPersonFixes = fix.replacements;
      firstPersonFixCount += fix.replacements.length;
    }

    // Target inference change note (not a text modification, but useful evidence).
    if (targetCard) {
      let basisText = '';
      const tb = entry.targetBasis || {};
      if (tb.kind === 'explicit') basisText = '依据：行首显式指定对象';
      else if (tb.kind === 'mention') basisText = `依据：本行提到「${tb.token || targetCard.name_short}」`;
      else if (tb.kind === 'next') basisText = `依据：下一行说话人（L${tb.refLine}）`;
      else if (tb.kind === 'prev') basisText = `依据：上一行说话人（L${tb.refLine}）`;
      else basisText = '依据：上下文推断';
      changes.push({
        lineNo: entry.lineNo,
        kind: 'target',
        title: '对话对象推断',
        detail: `对象 → ${targetCard.name_jp}（${targetCard.name_short}）`,
        basis: basisText
      });
    }

    // Address replacement notes, grouped per target/original literal.
    if (addressOccurrences.length) {
      const grouped = new Map();
      for (const occ of addressOccurrences) {
        if (occ.original === occ.form) continue;
        const key = `${occ.targetId}|${occ.original}|${occ.form}`;
        if (!grouped.has(key)) grouped.set(key, { ...occ, count: 0 });
        grouped.get(key).count += 1;
      }
      for (const occ of grouped.values()) {
        changes.push({
          lineNo: entry.lineNo,
          kind: 'address',
          title: '称呼替换',
          detail: `「${occ.original}」→「${occ.form}」${occ.count > 1 ? ` ×${occ.count}` : ''}`,
          basis: `依据：${occ.reason}${occ.via === '代码' ? '；匹配源：简写代码' : '；匹配源：名字'}`
        });
      }
    }

    if (firstPersonFixes.length) {
      const groupedFixes = new Map();
      for (const fix of firstPersonFixes) {
        const key = `${fix.from}|${fix.to}`;
        if (!groupedFixes.has(key)) groupedFixes.set(key, { ...fix, count: 0 });
        groupedFixes.get(key).count += 1;
      }
      for (const fix of groupedFixes.values()) {
        changes.push({
          lineNo: entry.lineNo,
          kind: 'firstPerson',
          title: '一人称校正',
          detail: `「${fix.from}」→「${fix.to}」${fix.count > 1 ? ` ×${fix.count}` : ''}`,
          basis: '依据：speech.first_person；规则「一人称校正」开启（保守替换）'
        });
      }
    }

    const lineLabel = speakerCard ? speakerCard.name_jp : entry.speakerLabel;
    scriptText = `${lineLabel}「${content}」`;

    // 一人称 / 称呼 = 错误级硬检查。规则开关只决定是否重复写入「改动说明」的条目；
    // 评分卡与台本行的红点始终读取 hardChecks，所以关掉规则也不会漏判。
    const useFullMatrix = Boolean(options.fullAddressMatrix ?? rules.fullAddressMatrix);
    const hardChecks = speakerCard ? lineHardChecks(content, speakerCard, ctx, { skipFirstPerson: Boolean(entry.quoted), useFullMatrix }) : [];
    if (rules.textBox !== false) {
      const tbIssue = textBoxOverflowIssue(content, options.maxTextboxChars ?? MAX_TEXTBOX_CHARS, options.maxTextboxLines ?? MAX_TEXTBOX_LINES);
      if (tbIssue.over) {
        const w = addWarning(entry.lineNo, 'textbox', tbIssue.message, 'warn');
        lineWarnings.push(w);
      }
    }
    // 报错行：标红，但不改写（用户可能真要保留）
    if (looksLikeModelMeta(content)) {
      metaLineCount += 1;
      const w = addWarning(entry.lineNo, 'meta', `这行像是模型的说明/报错，不是台词：「${truncate(content, 40)}」——先确认上一轮生成是否失败`, 'error');
      lineWarnings.push(w);
    }
    if (speakerCard) {
      if (rules.addressCheck) {
        for (const issue of hardChecks.filter(item => item.type === 'address')) {
          const w = addWarning(entry.lineNo, 'address', issue.message, 'error');
          lineWarnings.push(w);
        }
      }
      if (rules.firstPerson) {
        for (const issue of hardChecks.filter(item => item.type === 'firstPerson')) {
          const w = addWarning(entry.lineNo, 'firstPerson', issue.message, 'error');
          lineWarnings.push(w);
        }
      }
      // Sentence length: warning only when a sentence exceeds P90 × 2.
      if (rules.length && speakerCard.speech?.avg_len) {
        const shape = cardTextShape(speakerCard);
        const lengthRef = shape.len_p90;
        const issue = lineLengthIssue(content, lengthRef);
        if (issue.over) {
          for (const bad of issue.issues) {
            const w = addWarning(
              entry.lineNo,
              'length',
              `「${truncate(bad.sentence, 30)}」（${bad.len} 字）超过 ${speakerCard.name_short} 的 P90×2 上限 ${bad.limit.toFixed(1)} 字（P90 ${lengthRef.toFixed(1)}）`,
              'warn'
            );
            lineWarnings.push(w);
          }
        }
      }
      // Endings, only warn; no rewrite.
      if (rules.endings && speakerCard.speech?.endings?.length) {
        const issue = endingIssue(content, speakerCard.speech.endings);
        if (issue) {
          const more = issue.count > 1 ? `（本行共 ${issue.count} 句未命中）` : '';
          const w = addWarning(
            entry.lineNo,
            'endings',
            `「…${truncate(issue.first.tail.slice(-12), 12)}」不在 endings 库内${more}。库示例：${issue.endings.slice(0, 6).join(' / ')}`,
            'info'
          );
          lineWarnings.push(w);
        }
      }
      // 年龄词 = 警告级，只提示不改写、不影响分数。
      const ageIssue = ageWordIssue(content, speakerCard);
      if (ageIssue) {
        const w = addWarning(entry.lineNo, 'age', ageIssue.message, 'warn');
        lineWarnings.push(w);
      }
      // 异体字 / 简体字 / 旧字体（灯織 vs 灯织 vs 燈織）= 警告级，只提示。
      const variant = variantIssue(content);
      if (variant) {
        const w = addWarning(entry.lineNo, 'variant', variant.message, 'warn');
        lineWarnings.push(w);
      }
      // 生成故障检查：语法崩坏 / 重复 / 未出场 / 半截句。全部只提示，不改写。
      for (const grammarIssue of scanLineGrammar(content, speakerCard, ctx, {
        rawLine: entry.rawForGrammar || entry.rawLine || '',
        zhText: entry.zhText || '',
        castIds
      })) {
        const w = addWarning(entry.lineNo, grammarIssue.type, grammarIssue.message, grammarIssue.level);
        lineWarnings.push(w);
      }
      // Timings / length / speaker buckets.
      if (rules.speed) {
        const estimate = estimateLineSpeech(content, speakerCard.speech?.speed_cps);
        seconds = estimate.seconds;
        timings.push({
          lineNo: entry.lineNo,
          speakerId: speakerCard.id,
          speakerName: speakerCard.name_short,
          chars: estimate.chars,
          seconds,
          sentences: estimate.sentences
        });
      }
      const bucket = speakerBuckets.get(speakerCard.id) || {
        card: speakerCard,
        lines: [],
        sentences: [],
        lineCount: 0,
        sentenceCount: 0,
        chars: 0,
        seconds: 0
      };
      const contentSentences = sentenceSplit(content);
      bucket.lines.push({ lineNo: entry.lineNo, content, sentences: contentSentences });
      bucket.sentences.push(...contentSentences);
      bucket.lineCount += 1;
      bucket.sentenceCount += contentSentences.length;
      bucket.chars += speakableChars(content);
      if (seconds != null) bucket.seconds += seconds;
      speakerBuckets.set(speakerCard.id, bucket);
      sentenceCount += contentSentences.length;
      charCount += speakableChars(content);
    }

    const speakerCode = speakerCard ? primaryCodeForCard(speakerCard, ctx) : (entry.speakerCode || '');
    const explicitTargetCode = entry.targetBasis?.kind === 'explicit' && targetCard
      ? primaryCodeForCard(targetCard, ctx)
      : '';
    outputLines.push({
      lineNo: entry.lineNo,
      type: 'dialogue',
      speakerId: speakerCard?.id || null,
      speakerLabel: lineLabel,
      speakerCode,
      content,
      zhText: entry.zhText || '',
      originalText: content,
      text: scriptText,
      readingText: scriptText,
      firstPersonFixes,
      warnings: lineWarnings,
      hardChecks,
      targetId: targetCard?.id || null,
      targetName: targetCard?.name_jp || '',
      targetBasis: entry.targetBasis || null,
      explicitTargetCode,
      seconds
    });
  }

  const speakerData = Array.from(speakerBuckets.values()).sort((a, b) => a.card.name_jp.localeCompare(b.card.name_jp, 'ja'));

  // 声道混用 = 警告级。只标黄敬体行（keigo_rate 低的角色），不改写、不影响分布分。
  const lineByNo = new Map(outputLines.map(line => [line.lineNo, line]));
  for (const bucket of speakerData) {
    const mix = registerMixInfo(bucket);
    if (!mix) continue;
    // 同一角色只报一条，重复的只保留一次（否则 4 行敬体就报 4 条一样的）
    const firstLineNo = mix.lineNos.find(n => lineByNo.has(n));
    const w = addWarning(firstLineNo ?? null, 'register',
      mix.message + (mix.lineNos.length > 1 ? `（涉及第 ${mix.lineNos.join('、')} 行）` : ''), 'warn');
    for (const lineNo of mix.lineNos) {
      const line = lineByNo.get(lineNo);
      if (line) line.warnings.push(w);
    }
  }

  // 句长整体偏移 = 警告级。
  // 单句检查只在「> P90×2」时触发，太松；但模型普遍会把整场台词写长 30-130%。
  // 这里按「该角色本场平均句长 vs 她的 P25/P75」判，抓系统性偏差。
  if (rules.length) {
    for (const bucket of speakerData) {
      const card = bucket.card;
      const ts = cardTextShape(card);
      const p25 = asNumber(ts.len_p25, 0), p75 = asNumber(ts.len_p75, 0), p50 = asNumber(ts.len_p50, 0);
      const lines = bucket.lines.filter(l => (l.content || '').trim());
      if (!lines.length || p50 <= 0) continue;
      const chars = lines.reduce((s, l) => s + (l.content || '').length, 0);
      const avg = chars / lines.length;
      // 只作参考（info）：剧情描述写细了，某一句本来就该长，不算错。
      if (avg > p75 && p75 > 0) {
        addWarning(null, 'length',
          `句长参考：${card.name_short} 本场平均 ${avg.toFixed(1)} 字，她平时 P50 ${p50} / P75 ${p75}（+${Math.round((avg / p50 - 1) * 100)}%）。剧情需要就保留`,
          'info');
      } else if (avg < p25 && p25 > 0) {
        addWarning(null, 'length',
          `句长参考：${card.name_short} 本场平均 ${avg.toFixed(1)} 字，她平时 P25 ${p25} / P50 ${p50}`,
          'info');
      }
    }
  }

  // 装饰符号漏用 = 警告级。甘奈的 ☆ 是每 13 句 1 个，整场一个都没有就不像她。
  if (rules.symbols) {
    for (const bucket of speakerData) {
      const card = bucket.card;
      if (!card) continue;
      const body = bucket.lines.map(l => l.content || '').join('');
      const total = Math.max(1, card.line_count || 1);
      const nLines = bucket.lines.filter(l => (l.content || '').trim()).length;
      if (nLines < 4) continue;                 // 少于 4 句不判
      for (const s of DECO_SYMBOLS) {
        const base = asNumber(card.symbols?.[s], 0);
        if (!base) continue;
        const every = total / base;
        if (every > 60) continue;               // 太罕见的不管
        if (body.includes(s)) continue;
        addWarning(null, 'symbol',
          `符号漏用：${card.name_short} 平时每 ${Math.round(every)} 句就有一个「${s}」，本场 ${nLines} 句一个都没有`,
          'warn');
      }
    }
  }

  // 语体漏用 = 警告级。恋鐘整场不说博多弁、あさひ整场不「っす」，比句尾不准严重得多。
  if (rules.symbols) {
    for (const bucket of speakerData) {
      const card = bucket.card;
      if (!card) continue;
      const rule = detectDialect(card);
      if (!rule) continue;
      const nLines = bucket.lines.filter(l => (l.content || '').trim()).length;
      if (nLines < 4) continue;
      const body = bucket.lines.map(l => l.content || '').join('\n');
      const marks = {
        hakata: ['ばい', 'けん', 'とよ', 'やけん', 'ったい', 'んね'],
        ssu: ['っす'],
        chouon: ['ー', 'ぁ', 'ぃ'],
        kofu: ['ます', 'です', 'さま', 'ござい'],
        male: ['けれど', 'だろう', 'のかい', 'いかな', 'んだね'],
      }[rule.key] || [];
      const hits = marks.filter(m => body.includes(m)).length;
      if (!hits) {
        addWarning(null, 'dialect',
          `语体丢失：${card.name_short} 是「${rule.label}」，本场 ${nLines} 句完全没有体现`, 'warn');
      }
    }
  }

  const quotaReport = rules.traits ? buildTraitQuotaReport(speakerData, ctx) : { rows: [], overCount: 0 };
  for (const row of quotaReport.rows.filter(r => r.over && QUOTA_TRAITS.includes(r.trait))) {
    addWarning(null, 'quota', `特质配额：${row.speakerName} 的「${row.trait}」用了 ${row.used} 次，超过允许 ${row.quota} 次`, 'warn');
  }
  const symbolReport = buildSymbolReport(speakerData, rules);
  for (const row of symbolReport.rows.filter(r => r.over)) {
    addWarning(
      null,
      'symbol',
      `符号密度：${row.speakerName} 的「${row.symbol}」出现在 ${row.sentenceCount} 句，本场基准期望约 ${row.expected.toFixed(1)} 句${row.baselineZero ? '（原卡基准为 0）' : ''}（提示，不判分）`,
      'info'
    );
  }

  // 朗读版已废弃：原文形态版保留汉字/符号，只做称呼校正与可选一人称校正。
  // 读音工具仍保留为独立函数（自测也覆盖），但不再进入任何输出。
  const totalDuration = timings.reduce((sum, t) => sum + t.seconds, 0);
  const totalSentences = speakerData.reduce((sum, d) => sum + d.sentenceCount, 0);
  const activeSpeakers = speakerData.map(d => ({
    id: d.card.id,
    name: d.card.name_jp,
    short: d.card.name_short,
    lineCount: d.lineCount,
    sentenceCount: d.sentenceCount,
    chars: d.chars,
    seconds: d.seconds
  }));

  const result = {
    createdAt: new Date(),
    entries: parsed.entries,
    outputLines,
    changes,
    warnings,
    parseWarnings: parsed.warnings,
    parseFailures: parsed.failures || [],
    ignored: parsed.ignored,
    dialogueLineCount,
    metaLineCount,
    narrationCount,
    sentenceCount: totalSentences || sentenceCount,
    charCount,
    activeSpeakers,
    speakerData,
    timings,
    totalDuration: rules.speed ? totalDuration : null,
    quotaReport,
    symbolReport,
    readingConversions: [],
    readingCount: 0,
    firstPersonFixCount,
    settings: { ...rules },
    scriptText: outputLines.map(l => l.text).join('\n'),
    readingText: outputLines.map(l => l.readingText).join('\n'),
    originalText: outputLines.filter(l => l.type === 'dialogue').map(l => l.originalText).join('\n')
  };
  result.warningCount = warnings.length;
  result.lineWarningCount = outputLines.reduce((sum, l) => sum + l.warnings.length, 0);
  result.severityCounts = countSeverityCounts(result);
  result.shorthandText = buildShorthandText(result);
  return result;
}

function quickParse(text, cardsMap, codeMap) {
  const ctx = buildContext(cardsMap, codeMap);
  const parsed = parseScriptText(text, ctx);
  inferTargets(parsed.entries, ctx);
  return parsed;
}

/* ══════════════════════════════════════════════════════════
   PROMPT BUILDER
   ══════════════════════════════════════════════════════════ */

function _resolveScopeArgs(scopeOrOpts) {
  if (scopeOrOpts && typeof scopeOrOpts === 'object' && !Array.isArray(scopeOrOpts)) {
    return { scope: scopeOrOpts.scope || 'tab2', opts: scopeOrOpts };
  }
  return { scope: typeof scopeOrOpts === 'string' && scopeOrOpts ? scopeOrOpts : 'tab2', opts: {} };
}
function getScopeCast(scope, opts = {}) {
  if (Array.isArray(opts.cast)) {
    return opts.cast.map(c => typeof c === 'string' ? state.cards.get(c) : c).filter(Boolean);
  }
  const set = state.tabs[scope]?.cast || new Set();
  return Array.from(set).map(id => state.cards.get(id)).filter(Boolean);
}
function getScopeMaxLines(scope, opts = {}) {
  const fallback = scope === 'tab2' ? 12 : 10;
  if (opts.maxLines != null) return clampNumber(opts.maxLines, 2, 80, fallback);
  const tabVal = state.tabs[scope]?.maxLines;
  if (tabVal != null) return clampNumber(tabVal, 2, 80, fallback);
  const el = $(scope === 'tab2' ? '#t2Max' : '#t3Max');
  return clampNumber(el?.value, 2, 80, fallback);
}
function getPrimaryCodes(card, ctx) {
  const codes = (ctx.codesByCard.get(card.id) || []).map(e => e.code);
  if (!codes.length) codes.push(card.id);
  return uniq(codes);
}
function planLines(cards, total) {
  const map = new Map();
  const n = Math.max(0, Math.floor(total));
  if (!cards.length) return map;
  const base = Math.floor(n / cards.length);
  const remainder = n % cards.length;
  cards.forEach((card, idx) => map.set(card.id, base + (idx < remainder ? 1 : 0)));
  return map;
}
function formatLinePlan(cards, plan) {
  return cards.map(c => `${getScopeCodeLabel(c)} ${plan.get(c.id) || 0} 行`).join(' / ');
}
function getScopeCodeLabel(card, ctxOverride) {
  const ctx = ctxOverride || buildContext(state.cards, state.codeMap);
  const codes = getPrimaryCodes(card, ctx);
  return `${codes[0]}＝${card.name_short}`;
}
function cardCodesInline(card, ctx) {
  const codes = getPrimaryCodes(card, ctx);
  return codes.join(' / ');
}
function formatEndingLine(endings, limit = 8) {
  if (!Array.isArray(endings) || !endings.length) return '（无 endings 数据）';
  return endings.slice(0, limit).map(e => {
    const pct = e.pct ? ` ${fmtPct(e.pct)}` : '';
    const count = e.count ? `/${e.count}` : '';
    return `${e.form}${pct}${count}`;
  }).join(' ｜ ');
}
function formatRateMap(traits) {
  const entries = Object.entries(traits || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '（无 traits 数据）';
  return entries.map(([k, v]) => `${k} ${fmtPct(v)}`).join(' / ');
}
/* 语体识别：从该角色的句尾分布推出来，不按角色名硬编码。
   单一指标不够（凛世敬体 28%、千雪 29%，光看敬语率分不开），所以用组合特征。 */
const DIALECT_RULES = [
  {
    key: 'hakata', label: '博多弁（福岡）',
    test: ({ ratio }) => ratio(s => ['ばい', 'けん', 'とよ', 'やけん', 'ったい', 'んね'].some(m => s.includes(m))) >= 0.20,
    advice: '整场都用方言。不要写成标准语，也不要只在句尾偶尔加一个——方言是她的身份。'
  },
  {
    key: 'ssu', label: '「〜っす」体育会系',
    test: ({ ratio }) => ratio(s => s.includes('っす')) >= 0.30,
    advice: '几乎每句结尾都是「っす／っすか／っすよ」。不要换成普通敬语或平语。'
  },
  {
    key: 'chouon', label: '拖长音敬体',
    test: ({ ratio }) => ratio(s => /[ーぁぃぉぇ]$/.test(s) && /(です|ます|ね|よ|か)/.test(s)) >= 0.40,
    advice: '句尾要拖：「〜ですー」「〜ねー」「〜かぁ」。拖长音是她的标记，不是语气词。'
  },
  {
    key: 'kofu', label: '古風敬語',
    test: ({ ratio }) => ratio(s => s.includes('さま')) >= 0.05,
    advice: '日常对话也用敬语和古雅说法（「〜でございます」「〜ますわ」），不要突然变平语。'
  },
  {
    key: 'male', label: '落ち着いた男性的口調',
    test: ({ ratio }) => ratio(s => ['けれど', 'だろう', 'のかい', 'いかな', 'んだね'].some(m => s.includes(m))) >= 0.20,
    advice: '用「〜けれど」「〜だろう」「〜のかい」这种沉稳说法，不要用「〜じゃん」「〜だよっ」的轻快腔。'
  }
];
function detectDialect(card) {
  const ends = (card?.speech?.endings || []).map(e => String(e.form || ''));
  const total = (card?.speech?.endings || []).reduce((s, e) => s + asNumber(e.count, 0), 0) || 0;
  if (!total) return null;
  const ratio = (fn) => (card.speech.endings || []).reduce((s, e) => s + (fn(String(e.form || '')) ? asNumber(e.count, 0) : 0), 0) / total;
  for (const rule of DIALECT_RULES) {
    try { if (rule.test({ ratio })) return rule; } catch {}
  }
  return null;
}
function dialectLine(card) {
  const rule = detectDialect(card);
  if (!rule) return '';
  const ends = (card.speech.endings || []).slice(0, 5).map(e => e.form).join(' / ');
  return `${rule.label}。句尾实例：${ends}——${rule.advice}`;
}
/* 口头禅 / 软化词：这两组数据一直在卡里，之前完全没进 prompt。 */
function formatFormCounts(list, limit = 8) {
  const arr = Array.isArray(list) ? list : [];
  return arr.slice(0, limit).map(x => `${x.form}(${x.count})`).join(' / ') || '—';
}
function sampleByCategoryLine(card, limit = 2) {
  const cats = card?.sample_by_category;
  if (!cats || typeof cats !== 'object') return '';
  const prefer = ['会話', '活动', '仕事'];
  const picked = [];
  for (const key of prefer) {
    const arr = cats[key];
    if (Array.isArray(arr) && arr.length) { picked.push(arr[0]); if (picked.length >= limit) break; }
  }
  return picked.join(' / ');
}
function formatSymbolProfile(card, limit = 6) {
  const symbols = card.symbols || {};
  const lineCount = Math.max(1, card.line_count || 1);
  const rows = REQUIRED_SYMBOLS
    .map(s => ({ s, count: asNumber(symbols[s], 0) }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  if (!rows.length) return '（无明显符号习惯数据）';
  return rows.map(r => `${r.s} ${(r.count / lineCount * 100).toFixed(1)}%/台词`).join(' / ');
}
/* 装饰符号的「每 N 句 1 个」口径。
   百分比对模型没用——「☆ 5.3%」它不会换算成次数；写成「每 13 句 1 个」才会照做。 */
const DECO_SYMBOLS = ['♪', '☆', '♡', '★', '～'];
function symbolQuotaLine(card, plannedLines) {
  const sym = card.symbols || {};
  const total = Math.max(1, card.line_count || 1);
  const parts = [];
  for (const s of DECO_SYMBOLS) {
    const n = asNumber(sym[s], 0);
    if (!n) continue;
    const every = total / n;
    if (every > 200) continue;            // 太罕见，不值得要求
    if (every <= 60) {
      const should = plannedLines ? Math.max(1, Math.round(plannedLines / every)) : 0;
      parts.push(`${s} 每 ${Math.round(every)} 句 1 个${plannedLines ? `（本场约 ${should} 个，必须有）` : ''}`);
    } else {
      parts.push(`${s} 极少用（每 ${Math.round(every)} 句 1 个），本场可以不用`);
    }
  }
  return parts.join('；');
}
function producerAddressLine(card) {
  if (!card?.address) return '';
  const keys = ['制作人', 'プロデューサー', 'P'];
  const found = keys.map(k => card.address[k]).find(v => Array.isArray(v) && v.length);
  if (!found) return '';
  return sortByCountThenOrder(found).slice(0, 4).map(f => `${f.form}${f.count ? `(${f.count})` : ''}`).join(' / ');
}
/* 句长分布（真实语料 textshape）：P10 / 中位 P50 / P90 + 上限。
   档案、四幕骨架、总要求三处共用同一份数字，避免各算一套上限。
   缺 textshape 的旧卡自动落回 avg_len 旧算法（P50≈avg、P10≈avg/2、P90≈avg×2）。 */
function cardLengthProfile(card) {
  const shape = cardTextShape(card);
  const avg = Math.max(0, asNumber(card?.speech?.avg_len, 0));
  const p50 = Math.max(1, Math.round(asNumber(shape.len_p50, Math.round(avg) || 1)));
  const p10 = Math.min(p50, Math.max(1, Math.round(asNumber(shape.len_p10, Math.max(1, Math.round(avg * 0.5))))));
  const p90 = Math.max(p50, Math.round(asNumber(shape.len_p90, Math.round(avg * 2) || p50)));
  return {
    p10, p50, p90, avg,
    limit: p90 * 2,
    // 该角色「短句该短到几字」——P10 起算 4 字窗口（P10=2 → 2-5 字）。
    swing: `${p10}-${p10 + 3}`
  };
}
function buildProfileText(card, cast, ctx, plannedLines) {
  const speech = card.speech || {};
  const codes = getPrimaryCodes(card, ctx);
  const lines = [];
  const shape = cardTextShape(card);
  const lenP = cardLengthProfile(card);
  lines.push(`■ ${card.name_jp}（${card.name_cn}）｜代码：${codes.join(' / ')}｜读取：${card.kana || '—'}`);
  lines.push(`  一人称：${speech.first_person || '—'}${speech.first_person_rate ? `（占原台词 ${fmtPct(speech.first_person_rate)}）` : ''}；原卡 ${card.line_count || '?'} 行`);
  lines.push(`  声音参数：语速 ${Number(speech.speed_cps || 5).toFixed(2)} 字/秒；敬语率 ${fmtPct(speech.keigo_rate)}；感叹率 ${fmtPct(speech.exclaim_rate)}；省略率 ${fmtPct(speech.ellipsis_rate)}`);
  lines.push(`  句长：中位 ${lenP.p50} 字｜P10 ${lenP.p10} / P90 ${lenP.p90}｜均 ${Number(speech.avg_len || 0).toFixed(1)}（单句上限 ${lenP.limit} 字＝P90×2）`);
  {
    // 本场类型：同一角色在 仕事 / 会話 / 約束 下差别很大（冬優子 17.7 vs 25.8 字），
    // 只给全体基准会把闲聊写短。有该类型实测就补一行；没有就照旧。
    const st = sceneTypeStats(card);
    if (st) {
      lines.push(`  本场类型：${state.sceneType}（该类型均长 ${Number(st.avg_len).toFixed(1)} 字、敬语 ${fmtPct(st.keigo_rate)}、感叹 ${fmtPct(st.exclaim_rate)}、样本 ${st.lines} 行）——句长与敬语按这一档写，不要用全体基准`);
    }
  }
  lines.push(`  句长要有波动：该短的短到 ${lenP.swing} 字，该长的才到 ${lenP.p90} 字；不要把每句都压在中位附近。`);
  lines.push(`  文本形态：汉字率 ${fmtPct(shape.kanji_rate)} · 小写假名 ${fmtPct(shape.small_kana_rate)} · 长音 ${fmtPct(shape.long_vowel_rate)} · 符号 ${shape.symbols_per_line.toFixed(2)}/句 · 字/行 ${shape.chars_per_line.toFixed(1)}`);
  {
    // 语体：方言/体育会系/拖长音——这行比任何数字都重要，放在句尾前面
    const dia = dialectLine(card);
    if (dia) lines.push(`  语体：${dia}`);
  }
  {
    // 感叹 / 省略：百分比模型不会用，换算成「每 N 句 1 个」
    const ex = asNumber(speech.exclaim_rate, 0);
    const el = asNumber(speech.ellipsis_rate, 0);
    const bits = [];
    if (ex > 0) bits.push(`！约每 ${Math.max(1, Math.round(1 / ex))} 句 1 个`);
    if (el > 0) bits.push(`…约每 ${Math.max(1, Math.round(1 / el))} 句 1 个`);
    if (bits.length) lines.push(`  感叹/省略：${bits.join('；')}（不是上限，是她的平均手感）`);
  }
  lines.push(`  高频句尾：${formatEndingLine(speech.endings, 15)}`);
  {
    const ij = formatFormCounts(speech.interjections, 8);
    if (ij !== '—') lines.push(`  口头禅（句首感叹词）：${ij}`);
    const hg = formatFormCounts(speech.hedges, 6);
    if (hg !== '—') lines.push(`  软化词（「〜かな」「〜かも」这类）：${hg}`);
  }
  lines.push(`  性格系数：${formatRateMap(card.traits)}`);
  lines.push(`  符号习惯：${formatSymbolProfile(card)}`);
  {
    const quota = symbolQuotaLine(card, plannedLines);
    if (quota) lines.push(`  装饰符号：${quota}`);
  }
  const otherCast = cast.filter(c => c.id !== card.id);
  if (otherCast.length) {
    lines.push('  对在场角色的称呼：');
    for (const target of otherCast) {
      const info = findAddressEntry(card, target, ctx);
      if (info) {
        const primaryCount = asNumber(info.forms[0]?.count, 0);
        const forms = info.forms.slice(0, 4).map(f => {
          const rare = isRareAddressForm(card.id, target.id, f.form, asNumber(f.count, 0), primaryCount);
          const countTag = f.count ? `(${f.count}${rare ? '·罕见/限特定场合' : ''})` : '';
          return `${f.form}${countTag}`;
        }).join(' / ');
        lines.push(`   → ${target.name_short}：${forms}；主用「${info.primary}」`);
      } else {
        lines.push(`   → ${target.name_short}：无 address 记录（回退直呼「${target.name_short}」）`);
      }
    }
  }
  const prod = producerAddressLine(card);
  if (prod) lines.push(`  → 制作人：${prod}`);
  const shots = Array.from(new Set(card.few_shot || [])).slice(0, 4);
  if (shots.length) {
    lines.push('  角色语感样例（只学语感，不要照抄内容）：');
    for (const shot of shots) lines.push(`   「${shot}」`);
  }
  {
    // 按场景类型分的真实例句，比 few_shot 更贴近实际对话
    const catLine = sampleByCategoryLine(card, 2);
    if (catLine) lines.push(`  分场景例句（仕事/活动/会話）：${catLine}`);
  }
  const plannedQuota = plannedLines != null ? `本场预计 ${plannedLines} 行。` : '';
  if (plannedQuota) lines.push(`  ${plannedQuota}`);
  // 第四层：enriched 卡的「状态切换 / 底线」。没有该角色的 enriched 时静默跳过；
  // 「规则引擎 → 参考 enriched」关闭时整块不追加，其余档案内容一字不变。
  const enrichedBlock = buildEnrichedProfileBlock(card);
  if (enrichedBlock) lines.push(enrichedBlock);
  return lines.join('\n');
}
function buildAddressMatrix(cards, ctx) {
  const blocks = [];
  for (const speaker of cards) {
    const rows = [];
    for (const target of cards) {
      if (target.id === speaker.id) continue;
      const info = findAddressEntry(speaker, target, ctx);
      if (info) {
        const primaryCount = asNumber(info.forms[0]?.count, 0);
        const formsText = info.forms.slice(0, 4).map(f => {
          const rare = isRareAddressForm(speaker.id, target.id, f.form, asNumber(f.count, 0), primaryCount);
          const countTag = f.count ? `(${f.count}${rare ? '·罕见/限特定场合' : ''})` : '';
          return `${f.form}${countTag}`;
        }).join(' / ');
        rows.push(`  · ${speaker.name_short}→${target.name_short}：主用「${info.primary}」；可用形式 ${formsText}`);
      } else {
        rows.push(`  · ${speaker.name_short}→${target.name_short}：无 address 记录（默认真名，不强行加后缀）`);
      }
    }
    const prod = producerAddressLine(speaker);
    if (prod) rows.push(`  · ${speaker.name_short}→制作人：${prod}`);
    if (rows.length) blocks.push(rows.join('\n'));
  }
  return blocks.length ? blocks.join('\n') : '（无可用称呼数据）';
}

/* ── cards_v2 9 组合群像动力学与 sc_house_style 总则自动注入 ── */
let _fallbackUnitsCache = null;
let _fallbackHouseStyleCache = null;
function _getUnitsMapV2() {
  if (state.unitsV2 && state.unitsV2.size > 0) return state.unitsV2;
  if (_fallbackUnitsCache) return _fallbackUnitsCache;
  _fallbackUnitsCache = new Map();
  try {
    if (typeof require === 'function' && typeof __dirname === 'string') {
      const fsMod = require('fs');
      const pathMod = require('path');
      const unitsDir = pathMod.resolve(__dirname, '../../../taibon/cards_v2/units');
      if (fsMod.existsSync(unitsDir)) {
        for (const name of fsMod.readdirSync(unitsDir)) {
          if (name.endsWith('.json')) {
            const u = name.replace(/\.json$/i, '');
            _fallbackUnitsCache.set(u, JSON.parse(fsMod.readFileSync(pathMod.join(unitsDir, name), 'utf8')));
          }
        }
      }
    }
  } catch (err) { /* browser or missing dir */ }
  return _fallbackUnitsCache;
}
function _getHouseStyleV2() {
  if (state.houseStyleV2) return state.houseStyleV2;
  if (_fallbackHouseStyleCache !== null) return _fallbackHouseStyleCache;
  _fallbackHouseStyleCache = '';
  try {
    if (typeof require === 'function' && typeof __dirname === 'string') {
      const fsMod = require('fs');
      const pathMod = require('path');
      const housePath = pathMod.resolve(__dirname, '../../../taibon/cards_v2/sc_house_style.md');
      if (fsMod.existsSync(housePath)) {
        _fallbackHouseStyleCache = fsMod.readFileSync(housePath, 'utf8');
      }
    }
  } catch (err) { /* ignore */ }
  return _fallbackHouseStyleCache;
}
function buildUnitDynamicsPromptBlock(cast) {
  const cards = Array.isArray(cast) ? cast.filter(Boolean) : [];
  if (!cards.length) return '';
  const castIdSet = new Set(cards.map(c => c.id));
  const unitsMap = _getUnitsMapV2();
  if (!unitsMap || !unitsMap.size) return '';
  const unitSections = [];
  for (const [unitId, u] of unitsMap.entries()) {
    if (!u || !Array.isArray(u.members)) continue;
    const present = u.members.filter(m => castIdSet.has(m));
    const minMembers = unitId === 'jimuteki' ? 1 : 2;
    if (present.length < minMembers) continue;
    const topo = u.role_topology || {};
    const emp = u.empirical_topology || {};
    const lines = [`── ${u.name_zh || u.name_jp || unitId}（在场：${present.join(' / ')}）──`];
    if (u.tagline_zh) lines.push(`  定位：${u.tagline_zh}`);
    if (emp.turn_share) {
      const shares = present
        .map(m => emp.turn_share[m] ? `${m} ${fmtPct(emp.turn_share[m].share)}` : '')
        .filter(Boolean)
        .join(' / ');
      if (shares) lines.push(`  实证台词占比（${emp.unit_episode_count || '?'} 篇组合剧）：${shares}`);
    }
    if (topo.initiator) lines.push(`  起球役（Initiator）：${topo.initiator}`);
    if (topo.tsukkomi_or_brake) lines.push(`  吐槽/刹车（Tsukkomi）：${topo.tsukkomi_or_brake}`);
    if (topo.mediator_or_hub) lines.push(`  缓冲/枢纽（Hub）：${topo.mediator_or_hub}`);
    if (topo.rhythm_and_subtext_zh) lines.push(`  对话节奏与潜台词：${topo.rhythm_and_subtext_zh}`);
    if (topo.taboo_group_writing_zh) lines.push(`  组合群像禁忌：${topo.taboo_group_writing_zh}`);
    unitSections.push(lines.join('\n'));
  }
  if (!unitSections.length) return '';
  return `【组合群像拓扑与群聊禁忌（cards_v2 实证）】\n${unitSections.join('\n\n')}`;
}
function buildHouseStylePromptBlock() {
  const raw = _getHouseStyleV2();
  if (!raw) return '';
  return [
    '【闪耀色彩叙事与潜台词总则（sc_house_style v2）】',
    '- 三分台词、七分留白：全语料省略号「…」达 35.8%，禁止让角色用长段说明文解释动机或剖析心理；善用微物寄情与半截断句。',
    '- 剥离 1v1 聊天室习气：全角括号「（…）」唯独用于角色内心独白（心之声），严禁在普通台词内夹写括号动作描写（如「（脸红别过头）」）。',
    '- 单帧容量硬红线：单句不得超过 54 字或 3 行；同龄偶像严禁把 283 同伴称为「283プロの子たち / 孩子们」（仅社长/事务员可用）。'
  ].join('\n');
}
function buildQuotaBlock(cards, plan, ctx, sentenceNote = '') {
  const lines = [];
  for (const card of cards) {
    const n = plan.get(card.id) || 0;
    const traits = Object.entries(card.traits || {}).sort((a, b) => b[1] - a[1]);
    if (!traits.length) {
      lines.push(`- ${card.name_short}（${cardCodesInline(card, ctx)}）：${n} 行；无 traits 数据`);
      continue;
    }
    const quotas = traits.map(([trait, rate]) => {
      const q = calcTraitQuota(n, rate);
      return `${trait}≤${q} 次（${fmtPct(rate)}）`;
    });
    lines.push(`- ${card.name_short}（${cardCodesInline(card, ctx)}）：${n} 行；${quotas.join(' / ')}`);
  }
  return `${lines.join('\n')}${sentenceNote ? `\n${sentenceNote}` : ''}`;
}
function buildSkeletonBlock(total, cards) {
  const n = Math.max(1, Math.floor(total));
  const swing = (Array.isArray(cards) ? cards : [])
    .filter(Boolean)
    .map(c => {
      const lp = cardLengthProfile(c);
      return `${c.name_short} 中位 ${lp.p50} 字（P10 ${lp.p10} / P90 ${lp.p90}）`;
    })
    .join(' / ');
  return [
    `【四幕骨架（总计最多 ${n} 行台词）】`,
    `- 起（约前 20%）：用一句只有这个角色会说的话落下场景；不要用泛用天气/寒暄灌水。`,
    `- 承（约中段 30%）：让两人的目的或误解发生碰撞；至少一次正确使用称呼和一人称。`,
    `- 転（约后段 30%）：关系或情绪翻面；让潜台词从角色的句尾/停顿里漏出来。`,
    `- 結（最后 20%）：用留白、反差或轻幽默收束；最后一句必须具有最强角色辨识度。`,
    `- 每一行都要推动剧情或暴露角色；禁止旁白、动作说明、心理描写，除非单独以「（…）」写出。`,
    `- 句长要有波动：该短的短到 P10，该长的才到 P90，不要把每句都压在中位附近。${swing ? `本场：${swing}。` : ''}`
  ].join('\n');
}
function castLegend(cards, ctx) {
  return cards.map(c => `- ${c.name_jp}（${c.name_cn}）＝ ${getPrimaryCodes(c, ctx).join(' / ')}`).join('\n');
}
function addressAndRulesBlock(cards, ctx, plan, options = {}) {
  const rules = state.rules;
  const blocks = [];
  blocks.push(`【称呼矩阵】\n${buildAddressMatrix(cards, ctx)}\n${state.rules.addressReplace ? '后处理会把台词里的「别的名字 / 简写代码」换成主用称呼；表内已有的形式原样保留，表外形式（にちかちゃん / はづきさん）只报错不自动改写，请照着上面的形式写。' : '注意：当前「称呼替换」规则已关闭，后处理不会自动校正称呼；表外形式会被称呼校验标红。'}`);
  if (rules.firstPerson) {
    blocks.push(`【一人称锁定】\n${cards.map(c => `${c.name_short}＝「${c.speech.first_person || '未记录'}」`).join('；')}。任何一行都不得混用其他一人称。${rules.firstPersonFix ? '后处理会把误用的第一人称代词保守改写为该角色的自称。' : ''}`);
  }
  if (rules.endings) {
    blocks.push(`【句尾库（优先使用，不要机械复用）】\n${cards.map(c => `${c.name_short}：${formatEndingLine(c.speech.endings, 6)}`).join('\n')}`);
  }
  if (rules.length) {
    const lengthTable = cards.map(c => {
      const lp = cardLengthProfile(c);
      return `${c.name_short} ${lp.p10}–${lp.p90} 字（中位 ${lp.p50}）`;
    }).join(' / ');
    blocks.push(`【句长】每角色单句不得超过其 P90 × 2（见档案）。宁可断成两句，也不要写成说明文。\n句长要有波动：同一个人的台词要在 P10 到 P90 之间起伏——该短的短、该长的才长，不要把每句都压在中位附近。本场 P10–P90：${lengthTable}。`);
  }
  if (rules.symbols) {
    blocks.push(`【符号】按档案里的符号习惯使用；感叹号/问号/省略号不要堆叠。一个句末符号就够。`);
  }
  if (rules.traits) {
    blocks.push(`【性格配额（本场上限）】\n${buildQuotaBlock(cards, plan, ctx, '公式：max(1, floor(本角色台词句数 × 性格系数))。这是上限而不是任务；不要为了凑配额硬塞口癖。')}`);
  }
  return blocks.join('\n\n');
}
const TOLERANT_OUTPUT_HINT = '（如果无法严格遵守，用「角色名「台词」」的写法也可以，工具能识别。）';
function buildOutputFormat(cards, ctx, { japanese = false } = {}) {
  const codes = cards.map(c => getPrimaryCodes(c, ctx)[0]);
  const ex = codes.length > 1 ? `${codes[0]}→${codes[1]}：${japanese ? '……' : '……'}` : `${codes[0]}：……`;
  if (japanese) {
    return [
      '【输出格式（强制）】',
      '只输出日语台词，每行一句，不要编号、不要标题、不要 Markdown 表格、不要中文解释。',
      '每行使用：`说话人代码→对象代码：日语台词`；如果是对空气/群像/独白，可省略箭头：`说话人代码：日语台词`。',
      '箭头只能是 →。对象是实际在听这句话的人；没有明确对象就不要硬加。',
      '示例：',
      ex,
      '角色代码：',
      cards.map(c => `  ${getPrimaryCodes(c, ctx)[0]}＝${c.name_jp}`).join('\n'),
      TOLERANT_OUTPUT_HINT
    ].join('\n');
  }
  return [
    '【输出格式（强制）】',
    '只输出中文台词，每行一句，不要编号、不要标题、不要 Markdown 表格、不要解释。',
    '每行使用：`说话人代码→对象代码：中文台词`；如果是对空气/群像/独白，可省略箭头：`说话人代码：中文台词`。',
    '箭头只能是 →。对象是实际在听这句话的人；没有明确对象就不要硬加。',
    '示例：',
    ex,
    '角色代码：',
    cards.map(c => `  ${getPrimaryCodes(c, ctx)[0]}＝${c.name_jp}`).join('\n'),
    TOLERANT_OUTPUT_HINT
  ].join('\n');
}

function buildChineseDraftPrompt(scopeOrOpts) {
  const { scope, opts } = _resolveScopeArgs(scopeOrOpts);
  const ctx = buildContext(state.cards, state.codeMap);
  const cast = getScopeCast(scope, opts);
  const total = getScopeMaxLines(scope, opts);
  if (!cast.length) throw new Error('至少选择一个出场角色');
  if (total < cast.length) throw new Error(`句数上限至少要等于出场角色数（${cast.length}）`);
  const plotRaw = opts.plot != null ? opts.plot : (state.tabs[scope]?.plot || $(scope === 'tab2' ? '#t2Plot' : '#t3Plot')?.value || '');
  const plot = String(plotRaw).trim();
  if (!plot) throw new Error('请先填写剧情描述');
  const zhClean = opts.zhClean != null ? Boolean(opts.zhClean) : Boolean(state.tabs[scope]?.zhClean || $(scope === 'tab2' ? '#t2ZhClean' : '#t3ZhClean')?.checked);
  const plan = planLines(cast, total);
  const profiles = cast.map(c => buildProfileText(c, cast, ctx, plan.get(c.id))).join('\n\n');
  const rulesBlock = buildRulesPromptBlock(cast);
  const unitBlock = buildUnitDynamicsPromptBlock(cast);
  const houseBlock = buildHouseStylePromptBlock();
  return [
    '# Shiny Colors 同人剧情 · 中文台词草稿',
    '',
    '你是一位熟悉《アイドルマスター シャイニーカラーズ》角色语气的同人编剧。请根据下面的设定写一段中文台词草稿，供下一轮日语角色化翻译使用。',
    '',
    '【中文的写法】',
    '一律用**标准普通话**。不要方言、地方腔、台湾腔、网络流行语、翻译腔。',
    '这段中文会被直接拿去当字幕，所以：短、干净、能一眼读完；不要长定语，不要书面语。',
    '角色的方言/口癖**不要**在中文里体现（恋鐘的博多弁、あさひ的「っす」等），交给下一轮日语处理。',
    '**禁止出现假名**（あいうえお / アイウエオ 一个都不许有）；角色名用中文译名（あさひ→朝日、にちか→日花），不要写日文。',
    '写成日语就算失败，会被退回重写。',
    ...(zhClean
      ? ['**不要用装饰符号**：不写 ！ ？ … ～ ♪ ♡，只用「，」「。」断句。语气靠词句表达。']
      : []),
    '',
    '【剧情要求】',
    plot,
    '',
    '【出场角色与代码】',
    castLegend(cast, ctx),
    '',
    '【角色档案摘要】',
    profiles,
    ...(rulesBlock ? ['', rulesBlock] : []),
    ...(unitBlock ? ['', unitBlock] : []),
    ...(houseBlock ? ['', houseBlock] : []),
    '',
    addressAndRulesBlock(cast, ctx, plan),
    '',
    buildSkeletonBlock(total, cast),
    '',
    `【台词行数分配建议】`,
    formatLinePlan(cast, plan),
    `总数不得超过 ${total} 行。先保证人物关系与情绪转折，再考虑平均分配；不要让所有角色都说同一种句式。`,
    '',
    buildOutputFormat(cast, ctx, { japanese: false }),
    '',
    '【硬性检查】',
    '1. 只写中文台词，不写日语翻译、不写舞台说明。',
    '1b. 中文是标准普通话，不能出现方言词（如「俺们」「咋」「啥」「整」「贼」）和网络梗；这段直接做字幕。',
    '2. 保持角色登场；说话人代码严格使用上面给出的代码。',
    '3. 箭头对象必须在该行对话里真实存在；不要用箭头代替剧情信息。',
    '4. 每一行都要有潜台词或推进作用；删掉任何可替换成“今天天气真好”的句子。',
    '5. 如果某个角色的特质很难自然出现，宁可少用，不要贴标签。',
    '',
    '现在只输出中文台词行，不要输出任何其他内容。'
  ].join('\n');
}

function parseSpeakerStatsFromText(text, ctx) {
  const parsed = parseScriptText(text, ctx);
  inferTargets(parsed.entries, ctx);
  const counts = new Map();
  const cards = new Map();
  let dialogueCount = 0;
  for (const entry of parsed.entries) {
    if (entry.type !== 'dialogue' || !entry.speakerId) continue;
    dialogueCount += 1;
    counts.set(entry.speakerId, (counts.get(entry.speakerId) || 0) + 1);
    const card = ctx.cardsMap.get(entry.speakerId);
    if (card) cards.set(card.id, card);
  }
  return { parsed, counts, cards, dialogueCount };
}
function buildTranslationPrompt(scopeOrOpts, chineseText) {
  const { scope, opts } = _resolveScopeArgs(scopeOrOpts);
  const ctx = buildContext(state.cards, state.codeMap);
  let selected = getScopeCast(scope, opts);
  if (!selected.length) throw new Error('至少选择一个出场角色');
  const raw = String(chineseText != null ? chineseText : (opts.chineseText ?? state.tabs[scope]?.chinese ?? '')).trim();
  if (!raw) throw new Error('请先粘贴 LLM 返回的中文台词');
  // 中文可能被「去符号」处理过，提醒翻译步骤自己按角色补符号
  const zhHasSymbols = /[！？!?…～♪♡]/.test(raw);
  const stats = parseSpeakerStatsFromText(raw, ctx);
  const castMap = new Map(selected.map(c => [c.id, c]));
  for (const card of stats.cards.values()) castMap.set(card.id, card);
  const cast = selected.concat(Array.from(castMap.values()).filter(c => !selected.some(s => s.id === c.id)));
  let plan = new Map();
  if (stats.counts.size) {
    for (const card of cast) plan.set(card.id, stats.counts.get(card.id) || 0);
  } else {
    plan = planLines(cast, getScopeMaxLines(scope, opts));
  }
  const totalLines = stats.dialogueCount || Array.from(plan.values()).reduce((a, b) => a + b, 0);
  const profiles = cast.map(c => buildProfileText(c, cast, ctx, plan.get(c.id))).join('\n\n');
  const rulesBlock = buildRulesPromptBlock(cast);
  const unitBlock = buildUnitDynamicsPromptBlock(cast);
  const houseBlock = buildHouseStylePromptBlock();
  const plotRaw = opts.plot != null ? opts.plot : (state.tabs[scope]?.plot || $(scope === 'tab2' ? '#t2Plot' : '#t3Plot')?.value || '');
  const plot = String(plotRaw).trim();
  return [
    '# Shiny Colors 同人台本 · 日语翻译 + 角色化',
    '',
    '你是一位日语母语的脚本润色师，熟悉《アイドルマスター シャイニーカラーズ》的角色语气。请把下面的中文台词逐行翻译成自然的日语现场台词，并按角色档案做角色化润色。',
    '',
    '【剧情背景】',
    plot || '（未提供，以中文原稿为准）',
    '',
    '【角色档案摘要】',
    profiles,
    ...(rulesBlock ? ['', rulesBlock] : []),
    ...(unitBlock ? ['', unitBlock] : []),
    ...(houseBlock ? ['', houseBlock] : []),
    '',
    addressAndRulesBlock(cast, ctx, plan),
    '',
    '【翻译/角色化硬约束】',
    '1. 逐行一一对应：不增行、不删行、不合并、不拆分；保持原有的说话人和对象箭头。',
    '2. 不是直译：先理解中文意思，再用该角色会说的话说出来；可以调整语序、省略主语、添加该角色自然的口癖，但不得改变剧情信息。',
    '3. 一人称必须严格使用档案中的 first_person；不得因为中文“我”就自动写成「私」。',
    '4. 称呼他人时使用称呼矩阵中的主用形式；不要保留中文名，也不要自行加「さん」或「ちゃん」。',
    '5. 日语句尾优先从该角色的 endings 库中选；句长不得超过该角色 P90 × 2，并且要按档案的 P10–P90 做出长短起伏。',
    '5b. 写了「语体」的角色（博多弁 / っす / 拖长音 / 古風敬語 / 沉稳男腔），整场都必须保持，一句都不能滑回标准语。',
    '    「口头禅」和「软化词」是她的说话习惯，不是装饰：该出「ふぇ」「えへへ」就出，该用「〜かな」就用。',
    '6. 符号必须按「装饰符号」那一行照做：写了「本场约 N 个，必须有」的，就要真的用出来；写了「本场可以不用」的，一个都不要加。',
    '   注意：符号不是装饰，是她的说话方式——甘奈的「☆」、雛菜的「～」省略了就不像她。',
    '7. 不要写动作说明、括号演技指示、中文注释、罗马字或翻译说明。',
    '8. 每行必须是可被声优直接读出的日语台词。',
    '9. 翻译完成后，默默自检：说话人是否对、一人称是否对、称呼是否对、句尾是否像这个角色、是否超行数。',
    '',
    '【本次实际行数】',
    `共 ${totalLines} 行；${cast.map(c => `${c.name_short} ${plan.get(c.id) || 0} 行`).join(' / ')}`,
    '',
    ...(zhHasSymbols ? [] : [
      '',
      '【关于符号】',
      '中文原稿做过字幕净化，没有 ！ ？ … ～ ♪ ♡。**这不是省略语气**——请在日语里按上面对应角色的符号习惯自己补回来（该有省略号的地方要有，该用「～」的地方要用，该没有的不要加）。',
      '判断依据是角色的符号密度和句尾习惯，不是按行数平均分配。',
    ]),
    '',
    '【中文原稿】',
    '━━━━━━━━━━━━━━━━━━━━',
    raw,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    buildOutputFormat(cast, ctx, { japanese: true }),
    '',
    '现在只输出日语台词行。'
  ].join('\n');
}

function buildOneShotPrompt(scopeOrOpts = 'tab3') {
  const { scope, opts } = _resolveScopeArgs(scopeOrOpts || 'tab3');
  const ctx = buildContext(state.cards, state.codeMap);
  const cast = getScopeCast(scope, opts);
  const total = getScopeMaxLines(scope, opts);
  if (!cast.length) throw new Error('至少选择一个出场角色');
  if (total < cast.length) throw new Error(`句数上限至少要等于出场角色数（${cast.length}）`);
  const plotRaw = opts.plot != null ? opts.plot : (state.tabs[scope]?.plot || $('#t3Plot')?.value || '');
  const plot = String(plotRaw).trim();
  if (!plot) throw new Error('请先填写剧情描述');
  const plan = planLines(cast, total);
  const profiles = cast.map(c => buildProfileText(c, cast, ctx, plan.get(c.id))).join('\n\n');
  const rulesBlock = buildRulesPromptBlock(cast);
  const unitBlock = buildUnitDynamicsPromptBlock(cast);
  const houseBlock = buildHouseStylePromptBlock();
  return [
    '# Shiny Colors 同人台本 · 一步到位生成（日语成品）',
    '',
    '你是一位日语母语的同人脚本家，熟悉《アイドルマスター シャイニーカラーズ》的角色语气。请直接写出可以直接用于声优朗读的日语台本。',
    '',
    '【剧情要求】',
    plot,
    '',
    '【出场角色与代码】',
    castLegend(cast, ctx),
    '',
    '【角色档案摘要】',
    profiles,
    ...(rulesBlock ? ['', rulesBlock] : []),
    ...(unitBlock ? ['', unitBlock] : []),
    ...(houseBlock ? ['', houseBlock] : []),
    '',
    addressAndRulesBlock(cast, ctx, plan),
    '',
    buildSkeletonBlock(total, cast),
    '',
    '【台本制作规则】',
    '1. 日语口语，不要翻译腔；使用短句和真实停顿。',
    '2. 一人称、称呼、句尾、句长必须严格遵守档案。',
    '3. 箭头对象必须真实存在于该行对话中；没有明确对象时省略箭头。',
    '4. 所有角色都要有存在感，不要只是轮流说“是啊”“原来如此”。',
    '5. 不写旁白、动作说明、心理描写、标题和解释。',
    '6. 总行数不超过设定上限；优先保证剧情转折与角色辨识度。',
    '7. 写完后自检：是否有人称错误？是否把角色 A 的句尾写给角色 B？是否符号过载？是否出现中文？',
    '',
    `【行数分配建议】${formatLinePlan(cast, plan)}（总计不超过 ${total} 行）`,
    '',
    buildOutputFormat(cast, ctx, { japanese: true }),
    '',
    '现在只输出日语台词行。'
  ].join('\n');
}

/* ══════════════════════════════════════════════════════════
   NOTES / OUTPUT RENDERING
   ══════════════════════════════════════════════════════════ */
function sortedCards(cardsMap = state.cards) {
  const order = new Map(MOCK_META.map((m, i) => [m.id, i]));
  return Array.from(cardsMap.values()).sort((a, b) => {
    const oa = order.has(a.id) ? order.get(a.id) : 999 + a.name_jp.charCodeAt(0);
    const ob = order.has(b.id) ? order.get(b.id) : 999 + b.name_jp.charCodeAt(0);
    return oa - ob || a.name_jp.localeCompare(b.name_jp, 'ja');
  });
}
function warningsSorted(result) {
  return [...result.warnings].sort((a, b) => {
    const la = a.lineNo == null ? Infinity : a.lineNo;
    const lb = b.lineNo == null ? Infinity : b.lineNo;
    return la - lb || String(a.type).localeCompare(String(b.type));
  });
}
function changesSorted(result) {
  return [...result.changes].sort((a, b) => {
    const la = a.lineNo == null ? Infinity : a.lineNo;
    const lb = b.lineNo == null ? Infinity : b.lineNo;
    return la - lb;
  });
}
function buildNotesText(result) {
  if (!result) return '';
  const out = [];
  out.push('台本润色器 · 改动说明');
  out.push(`生成时间：${result.createdAt instanceof Date ? result.createdAt.toLocaleString('ja-JP') : String(result.createdAt || '')}`);
  const counts = result.severityCounts || countSeverityCounts(result);
  out.push(`台词：${result.dialogueLineCount} 行 / ${result.sentenceCount} 句 · 出场：${result.activeSpeakers.length} 人 · 检查：${counts.error} 错误 / ${counts.warn} 警告 / ${counts.info} 提示`);
  if (result.settings.speed) out.push(`朗读估算：${fmtSec(result.totalDuration)}（按各角色 speed_cps）`);
  out.push('');
  out.push('【改动明细】');
  const changes = changesSorted(result);
  if (!changes.length) out.push('（无）');
  for (const c of changes) {
    out.push(`${c.lineNo ? `L${c.lineNo}` : 'ALL'} [${c.title}] ${c.detail}`);
    if (c.basis) out.push(`   ${c.basis}`);
  }
  out.push('');
  out.push('【校验结果 · 错误 / 警告 / 提示】');
  const warnings = warningsSorted(result);
  if (!warnings.length) out.push('（无）');
  for (const w of warnings) {
    out.push(`${w.lineNo ? `L${w.lineNo}` : '全局'} [${severityLabel(w.level)} · ${w.label}] ${w.message}`);
  }
  if (result.ignored?.length) {
    out.push('');
    out.push(`【忽略行】${result.ignored.length} 行（markdown/分隔行）`);
  }
  out.push('');
  out.push('【特质配额】');
  if (!result.settings.traits) out.push('（本次已关闭）');
  else if (!result.quotaReport.rows.length) out.push('（无可用 traits 数据）');
  else {
    out.push('统计口径：台词分句后，含该特质启发式关键词的句数 / 上限 max(1, floor(句数 × 系数))');
    for (const r of result.quotaReport.rows) {
      out.push(`${r.speakerName}｜${r.trait}｜${r.used}/${r.quota}${r.over ? ' ⚠超配额' : ''}｜系数 ${fmtPct(r.rate)}｜基础句数 ${r.sentenceCount}`);
    }
  }
  out.push('');
  out.push('【符号统计】');
  if (!result.settings.symbols) out.push('（本次已关闭）');
  else if (!result.symbolReport.rows.length) out.push('（无符号数据）');
  else {
    out.push('原卡 symbols = 包含该符号的台词句数；基准 = 句数 / line_count；期望 = 基准 × 本场同角色句数。字符列为实际字符数。');
    for (const r of result.symbolReport.rows) {
      out.push(`${r.speakerName}｜${r.symbol}｜字符 ${r.charCount}｜出现 ${r.sentenceCount} 句 / 本场 ${r.outputSentenceCount} 句｜期望 ${r.expected.toFixed(1)} 句｜基准 ${(r.baselineDensity * 100).toFixed(1)}%/句${r.over ? ' ⚠超基准' : ''}`);
    }
  }
  out.push('');
  out.push('【语速估算】');
  if (!result.settings.speed || result.totalDuration == null) out.push('（本次已关闭）');
  else {
    out.push(`总时长：约 ${fmtSec(result.totalDuration)}`);
    for (const s of result.activeSpeakers) out.push(`${s.short}：${s.lineCount} 行 · ${s.chars} 字 · 约 ${fmtSec(s.seconds)}`);
    out.push('逐行：');
    for (const t of result.timings) out.push(`L${t.lineNo} ${t.speakerName}｜${t.chars} 字｜约 ${fmtSec(t.seconds)}`);
  }
  out.push('');
  out.push('【原文形态版】');
  out.push('保留汉字与符号，不做假名化；仅称呼校正 + 可选一人称校正。');
  out.push(`一人称校正：${result.firstPersonFixCount || 0} 处${result.settings.firstPersonFix ? '' : '（规则已关闭）'}；可直接用于 TTS 导出。`);
  out.push('');
  // 「参考 enriched」只影响 Prompt 生成，不参与台本转换，故不列进本次规则。
  out.push(`【本次规则】${RULE_DEFS.filter(r => r.key !== 'enriched' && result.settings[r.key]).map(r => r.label).join(' / ') || '全部关闭'}`);
  return out.join('\n');
}
function buildNotesHTML(result) {
  if (!result) return '';
  const counts = result.severityCounts || countSeverityCounts(result);
  const duration = result.settings.speed ? fmtSec(result.totalDuration) : '—';
  const ttsModel = buildTTSModel(result, { cards: state.cards });
  const parts = [];
  parts.push('<div class="notes-view">');
  parts.push('<div class="note-hero">');
  parts.push(`<div class="note-metric"><span>DIALOGUE</span><b>${result.dialogueLineCount} 行</b></div>`);
  parts.push(`<div class="note-metric"><span>EST. DURATION</span><b>${escapeHtml(duration)}</b></div>`);
  parts.push(`<div class="note-metric"><span>ERRORS / WARNINGS</span><b>${counts.error} / ${counts.warn}</b></div>`);
  parts.push(`<div class="note-metric"><span>CAST</span><b>${result.activeSpeakers.length} 人</b></div>`);
  parts.push('</div>');

  const changes = changesSorted(result);
  parts.push('<section class="note-section"><div class="note-section-head"><h3>改动明细</h3><span class="sec-meta">' + changes.length + ' 条</span></div>');
  if (!changes.length) parts.push('<div class="empty-note">无称呼替换 / 对象推断改动。</div>');
  else {
    for (const c of changes) {
      parts.push('<div class="change-entry">');
      parts.push(`<span class="line-tag">${c.lineNo != null ? `L${c.lineNo}` : 'ALL'}</span>`);
      parts.push('<div class="change-main">');
      parts.push(`<b>${escapeHtml(c.title)}</b>`);
      parts.push(`<p>${escapeHtml(c.detail)}</p>`);
      if (c.basis) parts.push(`<small>${escapeHtml(c.basis)}</small>`);
      parts.push('</div></div>');
    }
  }
  parts.push('</section>');

  const warnings = warningsSorted(result);
  parts.push('<section class="note-section"><div class="note-section-head"><h3>校验结果 · 错误 / 警告 / 提示</h3><span class="sec-meta">' + warnings.length + ' 条</span></div>');
  if (!warnings.length) parts.push('<div class="empty-note">没有触发检查项。注意：规则是启发式检查，不代表绝对正确。</div>');
  else {
    parts.push('<div class="diag-list">');
    const shown = warnings.slice(0, 180);
    for (const w of shown) {
      const severity = severityOf(w.level);
      const level = severity === 'error' ? ' danger' : (severity === 'info' ? ' info' : '');
      parts.push(`<div class="diag-row${level}">`);
      parts.push(`<span class="diag-type">${escapeHtml(severityLabel(severity))} · ${escapeHtml(w.label || w.type)}</span>`);
      parts.push(`<span class="diag-msg">${w.lineNo != null ? `<span class="diag-line">L${w.lineNo}</span>` : ''}${escapeHtml(w.message)}</span>`);
      parts.push('</div>');
    }
    if (warnings.length > shown.length) parts.push(`<div class="empty-note">仅显示前 ${shown.length} 条；复制文本版包含全部 ${warnings.length} 条。</div>`);
    parts.push('</div>');
  }
  parts.push('</section>');

  parts.push('<section class="note-section"><div class="note-section-head"><h3>特质配额</h3><span class="sec-meta">启发式关键词</span></div>');
  if (!result.settings.traits) parts.push('<div class="empty-note">规则「特质配额」已关闭。</div>');
  else if (!result.quotaReport.rows.length) parts.push('<div class="empty-note">无 traits 数据。</div>');
  else {
    parts.push('<table class="report-table"><thead><tr><th>角色</th><th>特质</th><th class="num">使用 / 上限</th><th class="num">基础句数</th></tr></thead><tbody>');
    for (const r of result.quotaReport.rows) {
      const meterWidth = r.quota > 0 ? Math.min(100, r.used / r.quota * 100) : 0;
      parts.push('<tr>');
      parts.push(`<td class="person">${escapeHtml(r.speakerName)}</td>`);
      parts.push(`<td>${escapeHtml(r.trait)} <span class="muted">${fmtPct(r.rate)}</span></td>`);
      parts.push(`<td class="num ${r.over ? 'over' : (r.used ? 'ok' : '')}">${r.used}/${r.quota}<span class="quota-meter ${r.over ? 'is-over' : ''}"><i style="width:${meterWidth}%"></i></span></td>`);
      parts.push(`<td class="num">${r.sentenceCount}</td>`);
      parts.push('</tr>');
    }
    parts.push('</tbody></table>');
    parts.push('<div class="report-note">上限 = max(1, floor(本角色台词分句数 × traits 系数))。实际使用按内置关键词对分句做启发式统计，可能和语义判断不同。</div>');
  }
  parts.push('</section>');

  parts.push('<section class="note-section"><div class="note-section-head"><h3>符号密度</h3><span class="sec-meta">SYMBOL DENSITY</span></div>');
  if (!result.settings.symbols) parts.push('<div class="empty-note">规则「符号统计」已关闭。</div>');
  else if (!result.symbolReport.rows.length) parts.push('<div class="empty-note">没有可比较的符号数据。</div>');
  else {
    parts.push('<table class="report-table"><thead><tr><th>角色</th><th>符号</th><th class="num">字符</th><th class="num">句</th><th class="num">期望句</th><th class="num">基准</th></tr></thead><tbody>');
    for (const r of result.symbolReport.rows) {
      parts.push('<tr>');
      parts.push(`<td class="person">${escapeHtml(r.speakerName)}</td>`);
      parts.push(`<td class="sym">${escapeHtml(r.symbol)}</td>`);
      parts.push(`<td class="num">${r.charCount}</td>`);
      parts.push(`<td class="num ${r.over ? 'over' : ''}">${r.sentenceCount}${r.over ? ' ▲' : ''}</td>`);
      parts.push(`<td class="num">${r.expected.toFixed(1)}</td>`);
      parts.push(`<td class="num">${(r.baselineDensity * 100).toFixed(1)}%/句</td>`);
      parts.push('</tr>');
    }
    parts.push('</tbody></table>');
    parts.push('<div class="report-note">原卡 symbols 记录的是「包含该符号的台词句数」，不是字符数。基准 = 符号句数 ÷ 原卡 line_count；期望 = 基准 × 本场同角色句数。红色 ▲ 为超过基准，字符数仅作参考。</div>');
  }
  parts.push('</section>');

  parts.push('<section class="note-section"><div class="note-section-head"><h3>语速估算</h3><span class="sec-meta">CHARS ÷ CPS</span></div>');
  if (!result.settings.speed || result.totalDuration == null) {
    parts.push('<div class="empty-note">规则「语速估算」已关闭。</div>');
  } else {
    parts.push(`<div class="timing-total"><b>${fmtSec(result.totalDuration)}</b><span>总朗读估算 · 含 ${result.activeSpeakers.length} 位角色 · 去除标点与符号后计字</span></div>`);
    parts.push('<div class="reading-list">');
    for (const s of result.activeSpeakers) {
      parts.push(`<span class="reading-chip"><b>${escapeHtml(s.short)}</b><span>·</span>${s.chars} 字 / ${fmtSec(s.seconds)}</span>`);
    }
    parts.push('</div>');
    if (result.timings.length) {
      parts.push('<details class="details-fold"><summary>逐行与逐句时间</summary>');
      parts.push('<table class="report-table"><thead><tr><th>行</th><th>角色</th><th class="num">句</th><th class="num">字</th><th class="num">秒</th></tr></thead><tbody>');
      for (const t of result.timings) {
        parts.push(`<tr><td>L${t.lineNo}</td><td class="person">${escapeHtml(t.speakerName)}</td><td class="num">${t.sentences.length}</td><td class="num">${t.chars}</td><td class="num">${t.seconds.toFixed(1)}</td></tr>`);
      }
      parts.push('</tbody></table>');
      parts.push('<div class="report-note">逐句拆分：');
      for (const t of result.timings) {
        const ss = t.sentences.map((s, i) => `第${i + 1}句 ${s.chars}字/${s.seconds.toFixed(1)}s`).join('；');
        parts.push(`<br><span class="muted">L${t.lineNo}</span> ${escapeHtml(ss)}`);
      }
      parts.push('</div></details>');
    }
  }
  parts.push('</section>');

  parts.push('<section class="note-section"><div class="note-section-head"><h3>原文形态版 / TTS</h3><span class="sec-meta">' + ttsModel.lines.length + ' 行</span></div>');
  parts.push('<div class="empty-note">保留汉字与符号，不做假名化；只应用称呼校正' + (result.settings.firstPersonFix ? ' + 一人称校正' : '（一人称校正规则关闭）') + '。按角色场景分档（六项分项）见输出区「TTS 导出」。</div>');
  if (ttsModel.lines.length) {
    const summary = resultHasJapaneseKana(result) ? getResultConsistencySummary(result) : null;
    const sceneText = summary
      ? (summary.scored ? `${summary.scored}/${summary.total} 角色已分档 · ${summary.errors} 错误 / ${summary.warnings} 警告` : '样本不足（需 ≥2 句）')
      : '—（中文草稿，未评分）';
    parts.push('<div class="reading-list">');
    parts.push(`<span class="reading-chip"><b>总时长</b><span>·</span>${fmtSec(ttsModel.total_sec)}</span>`);
    parts.push(`<span class="reading-chip"><b>行数</b><span>·</span>${ttsModel.lines.length}</span>`);
    parts.push(`<span class="reading-chip"><b>角色</b><span>·</span>${ttsModel.stats.speakerCount}</span>`);
    parts.push(`<span class="reading-chip"><b>场景分档</b><span>·</span>${sceneText}</span>`);
    parts.push('</div>');
  }
  parts.push('</section>');

  parts.push('<div class="report-note">本次启用规则：' + escapeHtml(RULE_DEFS.filter(r => r.key !== 'enriched' && result.settings[r.key]).map(r => r.label).join(' / ') || '无') + '。句尾校验只警告，不自动改写。</div>');
  parts.push('</div>');
  return parts.join('');
}

/* ══════════════════════════════════════════════════════════
   OUTPUT PANEL / UI RENDERING
   ══════════════════════════════════════════════════════════ */
const OUTPUT_TAB_LABELS = { script: '台本', subtitle: '字幕', voice: '配音', shorthand: '简写格式', original: '原文形态版', notes: '改动说明', tts: 'TTS 导出' };
const OUTPUT_TAB_ORDER = ['script', 'subtitle', 'voice', 'shorthand', 'original', 'notes', 'tts'];
function outputKicker(scope) {
  return scope === 'tab1' ? 'OUTPUT / SHORTHAND CONVERTER' : 'OUTPUT / POLISHED SCRIPT';
}
function createOutputPanel(scope) {
  const root = $(`#${scope}Output`);
  if (!root) return;
  const groups = OUTPUT_TAB_ORDER.map(tab => `
    <div class="out-tab-group">
      <button class="out-tab" type="button" role="tab" data-outtab="${tab}" data-scope="${scope}" aria-selected="false">${OUTPUT_TAB_LABELS[tab]}</button>
      <button class="copy-mini" type="button" data-copy-tab="${tab}" data-scope="${scope}" title="复制${OUTPUT_TAB_LABELS[tab]}" aria-label="复制${OUTPUT_TAB_LABELS[tab]}">⧉</button>
    </div>`).join('');
  root.innerHTML = `
    <div class="section-head">
      <div><span class="kicker">${outputKicker(scope)}</span><h2>处理结果</h2></div>
      <div class="result-pills" id="${scope}ResultPills"></div>
    </div>
    <div class="output-toolbar">
      <div class="out-tabs" role="tablist" aria-label="输出类型">${groups}</div>
      <button class="btn btn-primary copy-current" type="button" data-copy-current="${scope}">复制台本</button>
    </div>
    <div class="output-body" id="${scope}OutputBody"></div>
    <div class="output-foot" id="${scope}OutputFoot"></div>`;
}
function lineWarnInfo(line) {
  const issues = collectAttachedIssues(line);
  if (!issues.length) return null;
  const severity = maxSeverity(issues.map(issue => issue.level));
  return {
    count: issues.length,
    severity,
    danger: severity === 'error',
    issues,
    text: issues.map(issue => `${severityLabel(issue.level)} · ${issue.label}：${issue.message}`).join('\n'),
    errorText: issues.filter(issue => issue.level === 'error').map(issue => `${issue.label}：${issue.message}`).join('；')
  };
}
function renderDialogueHighlight(text, type) {
  if (type === 'narration' || !text.includes('「')) {
    return `<span class="narration-text">${escapeHtml(text)}</span>`;
  }
  const idx = text.indexOf('「');
  const name = text.slice(0, idx);
  const rest = text.slice(idx);
  return `<span class="char-name">${escapeHtml(name)}</span><span class="quote-mark">${escapeHtml(rest)}</span>`;
}
function buildScriptViewHTML(result) {
  if (!result || !result.outputLines.length) {
    return emptyOutputHTML(state.activeTab === 'tab1'
      ? '等待转换。左侧输入简写剧本后按「转换台本」。'
      : '等待日语台稿。生成 Prompt、贴回结果后按「规则处理出稿」。');
  }
  const rows = [];
  for (const line of result.outputLines) {
    const text = line.text;
    const wi = lineWarnInfo(line);
    const cls = !wi ? '' : (wi.severity === 'error' ? ' has-warn has-danger' : (wi.severity === 'warn' ? ' has-warn' : ' has-info'));
    rows.push(`<div class="script-line${cls}">`);
    rows.push(`<span class="line-no">${line.lineNo}</span>`);
    rows.push(`<span class="line-content">${renderDialogueHighlight(text, line.type)}</span>`);
    if (wi) {
      const glyph = SEVERITY_DEFS[wi.severity]?.dot || '●';
      rows.push(`<span class="line-warn ${wi.severity}" title="${escapeAttr(wi.text)}">${glyph}</span>`);
    } else rows.push('<span></span>');
    rows.push('</div>');
    if (wi?.severity === 'error' && wi.errorText) {
      rows.push(`<div class="line-hard-note"><span>错误</span>${escapeHtml(wi.errorText)}</div>`);
    }
  }
  return `<div class="script-view">${rows.join('')}</div>`;
}
function emptyOutputHTML(message) {
  return `<div class="empty-output"><div class="eo-glyph">⌁</div><b>还没有输出</b><span>${escapeHtml(message)}</span></div>`;
}
function renderResultPills(result, scope = '') {
  if (!result) return '<span class="stat-pill">待转换</span>';
  const duration = result.totalDuration != null ? fmtSec(result.totalDuration) : (result.settings.speed ? '0.0 秒' : '语速关闭');
  const hasKana = resultHasJapaneseKana(result);
  const cons = result.dialogueLineCount && hasKana ? getResultConsistencySummary(result) : null;
  const counts = cons
    ? { error: cons.errors, warn: cons.warnings, info: cons.infos }
    : (result.severityCounts || countSeverityCounts(result));
  const scenePill = cons
    ? (cons.scored
      ? `<span class="stat-pill cons-pill">场景 ${cons.scored}/${cons.total} 角色 · 参考 P10–P90</span>`
      : '<span class="stat-pill cons-pill">场景 · 样本不足（需 ≥2 句）</span>')
    : (result.dialogueLineCount ? '<span class="stat-pill">场景 — 中文草稿</span>' : '');
  const pills = [
    `<span class="stat-pill accent">${result.dialogueLineCount} 行 / ${result.sentenceCount} 句</span>`,
    `<span class="stat-pill">${escapeHtml(duration)}</span>`,
    scenePill,
    `<span class="stat-pill">${counts.error} 错误 / ${counts.warn} 警告</span>`,
    `<span class="stat-pill">${result.activeSpeakers.length} 角色</span>`
  ];
  // 只在有称呼错误（红标）时出现；多形式时点开会先改能改的，再列候选让用户选。
  if (scope === 'tab1') {
    const addressCount = addressErrorLines(result).length;
    if (addressCount) {
      pills.push(`<button class="btn btn-small fix-address-btn" type="button" data-fix-address="tab1" title="把表外称呼改成 address 表内形式；有多个合法形式时会列出候选让你按场合选"><span>一键修称呼</span><b>${addressCount}</b></button>`);
    }
  }
  return pills.join('');
}
function renderOutputFoot(result) {
  if (!result) return '等待处理 · 所有规则只在本机运行';
  const counts = result.severityCounts || countSeverityCounts(result);
  const items = [];
  items.push(`<span><b>${result.dialogueLineCount}</b> 台词行</span>`);
  if (result.narrationCount) items.push(`<span><b>${result.narrationCount}</b> 旁白行</span>`);
  if (result.totalDuration != null) items.push(`<span>朗读约 <b>${fmtSec(result.totalDuration)}</b></span>`);
  items.push(`<span class="${counts.error ? 'danger-count' : ''}">${counts.error} 错误</span>`);
  items.push(`<span class="${counts.warn ? 'warn-count' : ''}">${counts.warn} 警告</span>`);
  items.push(`<span>${counts.info} 提示</span>`);
  items.push(`<span>原文形态 <b>${result.dialogueLineCount}</b> 行</span>`);
  if (result.settings.firstPersonFix) items.push(`<span>一人称校正 ${result.firstPersonFixCount || 0} 处</span>`);
  items.push('<span>错误标红；警告 / 提示可忽略，不阻断导出。</span>');
  return items.join('<span class="dot"></span>');
}
function buildShorthandLines(result) {
  if (!result || !Array.isArray(result.outputLines)) return [];
  const lines = [];
  for (const line of result.outputLines) {
    if (line.type === 'narration') {
      lines.push(`※${line.content}`);
      continue;
    }
    if (line.type !== 'dialogue') continue;
    const code = line.speakerCode || '';
    if (!code) continue;
    const target = line.explicitTargetCode || '';
    lines.push(`${code}${target ? `→${target}` : ''}：${line.content}`);
  }
  return lines;
}
function buildShorthandText(result) {
  return buildShorthandLines(result).join('\n');
}
function buildShorthandViewHTML(result, scope) {
  if (!result) return emptyOutputHTML('等待台本结果。');
  const lines = buildShorthandLines(result);
  if (!lines.length) return emptyOutputHTML('没有可输出的简写台词。');
  return `<div class="shorthand-view">
    <div class="shorthand-toolbar">
      <button class="btn btn-primary" type="button" data-copy-shorthand="${escapeAttr(scope || 'tab1')}">复制简写格式</button>
      <span class="shorthand-hint">可直接回贴到左侧「简写剧本」输入框再次转换；只有原行显式写了箭头时才保留对象。</span>
    </div>
    <pre class="shorthand-pre">${escapeHtml(lines.join('\n'))}</pre>
  </div>`;
}
/* 字幕净化：只影响「字幕」标签的显示与复制，不影响分析与翻译。
   装饰符号（…～─♪♡）在语音里是停顿和情绪，但做字幕时会让文本显脏。 */
let SUB_CLEAN_MODE = (() => {
  return safeStorageGet('sc.subClean') || 'deco';
})();
const SUB_DECO_RE = /[…‥─―〜～♪♡☆★]/gu;
function cleanSubtitleText(text, mode = SUB_CLEAN_MODE) {
  let s = String(text == null ? '' : text);
  if (mode === 'deco' || mode === 'plain') {
    s = s.replace(SUB_DECO_RE, '').replace(/[ \u3000]{2,}/gu, ' ').trim();
  }
  if (mode === 'plain') {
    // 不是删掉，是换成句号：直接删会把「結華、結華！この置物」黏成「結華、結華この置物」
    s = s.replace(/[！？!?]+/gu, '。')
      .replace(/。{2,}/gu, '。')
      .replace(/，{2,}/gu, '，')
      .replace(/，。/gu, '。')
      .replace(/[ \u3000]{2,}/gu, ' ')
      .trim();
  }
  return s;
}
function setSubCleanMode(mode) {
  SUB_CLEAN_MODE = ['raw', 'deco', 'plain'].includes(mode) ? mode : 'deco';
  safeStorageSet('sc.subClean', SUB_CLEAN_MODE);
  return SUB_CLEAN_MODE;
}
function getSubCleanMode() {
  return SUB_CLEAN_MODE;
}
function subtitleLines(result) {
  return (result?.outputLines || []).filter(l => l.type === 'dialogue' && l.speakerId);
}
function buildSubtitleText(result) {
  return subtitleLines(result)
    .map(l => cleanSubtitleText(l.content || ''))
    .filter(Boolean)
    .join('\n');
}
function buildSubtitleViewHTML(result) {
  if (!result) return emptyOutputHTML('等待台本结果。');
  const lines = subtitleLines(result);
  if (!lines.length) return emptyOutputHTML('没有可输出的台词。');
  const rows = lines.map(line => {
    const card = state.cards.get(line.speakerId);
    const speaker = card ? card.name_short : (line.speakerLabel || line.speakerCode || '');
    return `<div class="sub-line"><span class="sub-who">${escapeHtml(speaker)}</span><span class="sub-text">${escapeHtml(cleanSubtitleText(line.content || ''))}</span></div>`;
  }).join('');
  const opt = (v, label) => `<option value="${v}"${SUB_CLEAN_MODE === v ? ' selected' : ''}>${label}</option>`;
  return `<div class="subtitle-view">
    <div class="sub-toolbar">
      <span class="sub-hint">说话人在左侧固定列；点「⧉」复制得到<b>纯台词</b>（一行一句，不带人名和冒号），可直接当字幕。</span>
      <label class="sub-clean">净化
        <select data-subclean>${opt('raw', '原样')}${opt('deco', '去装饰…～♪')}${opt('plain', '纯标点')}</select>
      </label>
    </div>
    <div class="sub-table">${rows}</div>
  </div>`;
}
/* ══ 配音：逐行调 TTS → 播放 → 下载 ═══════════════════════════
   默认按 OpenAI 兼容的 POST {base}/v1/audio/speech 发，
   请求 {model, input, voice, response_format, speed}，返回音频二进制。
   你自己的服务只要按这个形状返回音频就能直接用。 */
const TTS_STORAGE_KEY = 'sc.ttsConfig';
const DEFAULT_VOICE_MAP = [
  'asahi=asahi',
  'amana=amana',
  'fuyuko_honne=fuyuko_honne',
  'fuyuko_omote=fuyuko_omote',
].join('\n');
const TTS_AUDIO = new Map();          // `${scope}:${lineNo}` → {url, blob, name}
let TTS_RUNNING = false;

function loadTtsConfig() {
  let obj = {};
  try { obj = JSON.parse(safeStorageGet(TTS_STORAGE_KEY) || '{}') || {}; } catch { obj = {}; }
  const saved = obj && Number(obj.v) === 2;
  return {
    v: 2,
    base: String((saved ? obj.base : '') || 'http://127.0.0.1:8088').trim(),
    model: String((saved ? obj.model : '') || 'irodori-tts').trim(),
    speed: Number(obj.speed) > 0 ? Number(obj.speed) : 1,
    format: String(obj.format || 'wav').trim() || 'wav',
    apiKey: String(obj.apiKey || '').trim(),
    voices: String(saved ? (obj.voices || DEFAULT_VOICE_MAP) : DEFAULT_VOICE_MAP).trim(),
    // 段间隔（秒）：播放全部 / 合并下载共用
    gap: Number.isFinite(Number(obj.gap)) && Number(obj.gap) >= 0 ? Number(obj.gap) : 0.5,
    // 读音替换：只影响送 TTS 的文本，不改台本本身
    replace: String(obj.replace || '').trim(),
    // 冬優子营业声线（本音固定用 fuyuko_honne）
    omoteVoice: String(obj.omoteVoice || 'fuyuko_omote_v8_350').trim() || 'fuyuko_omote_v8_350',
  };
}
function saveTtsConfig(patch) {
  const cfg = { ...loadTtsConfig(), ...patch };
  try { safeStorageSet(TTS_STORAGE_KEY, JSON.stringify(cfg)); } catch {}
  return cfg;
}
function ttsVoiceFor(card, cfg, text) {
  const id = card?.id || '';
  const map = {};
  String(cfg.voices || '').split(/[\n,]/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*[=:：]\s*(.+?)\s*$/);
    if (m) map[id === m[1] ? m[1] : m[1]] = m[2];
  });
  if (map[id]) return map[id];
  if (id === 'fuyuko') {
    return detectSpeechMode(text) === '营业'
      ? (cfg.omoteVoice || 'fuyuko_omote_v8_350')
      : 'fuyuko_honne';
  }
  if (id === 'asahi' || id === 'amana') return id;
  return id || 'default';
}
/* 按角色修送 TTS 的文本。目前只有冬優子：
   「ふゆ、今日も…」这种「短词 + 逗号」在句首会被念成语气词，
   训练语料里她其实多用「ふゆは、」，所以把句首的「ふゆ、」补一个「は」。 */
function applyVoiceTextFix(text, cardId) {
  let s = String(text == null ? '' : text);
  if (cardId === 'fuyuko') {
    // 只动句首（开头，或句号/感叹号/问号/换行之后）
    s = s.replace(/(^|[。！？!?…\n\s]|」|』)ふゆ、(?!は)/g, '$1ふゆは、');
  }
  return s;
}
function ttsCacheKey(scope, lineNo) { return `${scope}:${lineNo}`; }
/* 读音替换：模型偶尔把汉字名字读成中文（甘奈 → がんなん），
   用这张表在送 TTS 前换成假名。写法：甘奈=あまな，一行一个，也支持逗号分隔。 */
/* 从角色卡推名字的假名读音：kana - surname_kana = 名（甘奈 → あまな）。
   只收含汉字的短名，避免把已经是假名的名字也塞进去。 */
function buildNameReadingRules() {
  const KANJI = /[\u4e00-\u9fff]/;
  const rules = [];
  for (const card of state.cards.values()) {
    const short = String(card.name_short || '').trim();
    if (!short || !KANJI.test(short)) continue;
    // 单字名（透）会撞普通词：透き通る → とおるき通る。跳过，要用就手动加
    if (short.length < 2) continue;
    const kana = String(card.kana || '').replace(/\s+/g, '');
    const sur = String(card.surname_kana || '').replace(/\s+/g, '');
    if (!kana) continue;
    let given = kana;
    if (sur && kana.startsWith(sur) && kana.length > sur.length) given = kana.slice(sur.length);
    if (!given || given === short) continue;
    rules.push(`${short}=${given}`);
  }
  return rules;
}
function applyTtsReplace(text, cfg) {
  let s = String(text == null ? '' : text);
  const rules = String(cfg?.replace || '').split(/[\n,，]/);
  for (const rule of rules) {
    const m = rule.match(/^\s*(.+?)\s*[=:：]\s*(.+?)\s*$/);
    if (!m) continue;
    const from = m[1], to = m[2];
    if (!from || from === to) continue;
    s = s.split(from).join(to);
  }
  return s;
}

function resultHasJapaneseKana(result) {
  if (!result || !Array.isArray(result.outputLines)) return false;
  return result.outputLines.some(line => line.type === 'dialogue' && looksLikeJapaneseLine(line.originalText || line.content || ''));
}
function countKanaChars(text) {
  return Array.from(String(text == null ? '' : text)).filter(ch => KANA_RE.test(ch)).length;
}
function looksLikeJapaneseLine(text) {
  const chars = speakableChars(text);
  if (chars < 3) return false;
  return countKanaChars(text) / chars >= 0.5;
}
function issueCounts(issues) {
  const counts = { error: 0, warn: 0, info: 0 };
  for (const issue of issues) counts[severityOf(issue.level)] += 1;
  return counts;
}
function buildSceneScoreModel(result, options = {}) {
  const cards = options.cards || state.cards;
  const ctx = options.ctx || buildContext(cards, options.codeMap || state.codeMap);
  const calibration = options.calibration || calibrationTable();
  const groups = new Map();
  for (const line of (result?.outputLines || [])) {
    if (line.type !== 'dialogue' || !line.speakerId) continue;
    const card = cards.get(line.speakerId);
    if (!card) continue;
    const text = line.originalText != null ? line.originalText : line.content;
    if (!groups.has(card.id)) groups.set(card.id, { card, lines: [] });
    groups.get(card.id).lines.push({
      lineNo: line.lineNo,
      text: String(text == null ? '' : text),
      issues: collectLineIssues(line, card, ctx)
    });
  }
  const rows = [];
  for (const group of groups.values()) {
    const n = group.lines.length;
    const thresholds = sceneThresholds(n, calibration);
    const score = n >= 2 ? scoreSceneConsistency(group.lines.map(line => line.text), group.card) : null;
    const tier = score ? sceneTier(score.total, thresholds) : sceneTier(null, thresholds);
    const issues = group.lines.flatMap(line => line.issues.map(issue => ({ ...issue, lineNo: line.lineNo })));
    rows.push({
      speakerId: group.card.id,
      card: group.card,
      name: group.card.name_jp,
      short: group.card.name_short,
      n,
      lines: group.lines,
      thresholds,
      score,
      scored: Boolean(score),
      tier,
      issues,
      counts: issueCounts(issues)
    });
  }
  const totals = rows.reduce((acc, row) => {
    acc.error += row.counts.error;
    acc.warn += row.counts.warn;
    acc.info += row.counts.info;
    return acc;
  }, { error: 0, warn: 0, info: 0 });
  return {
    rows,
    calibration,
    calibrationSource: options.source || state.calibrationSource || '内置默认',
    counts: totals,
    totalLines: rows.reduce((sum, row) => sum + row.n, 0)
  };
}
function getResultConsistencySummary(result) {
  const model = buildSceneScoreModel(result);
  if (!model.rows.length) return null;
  const scored = model.rows.filter(row => row.scored);
  return {
    total: model.rows.length,
    scored: scored.length,
    insufficient: model.rows.length - scored.length,
    errors: model.counts.error,
    warnings: model.counts.warn,
    infos: model.counts.info,
    low: scored.filter(row => row.tier.key === 'low').length
  };
}


function ensureFocusValid() {
  if (!state.focusId || !state.cards.has(state.focusId)) {
    state.focusId = state.cards.has('fuyuko') ? 'fuyuko' : (sortedCards()[0]?.id || null);
  }
}
function defaultCastSet() {
  const preferred = ['fuyuko', 'asahi', 'amana'].filter(id => state.cards.has(id));
  const set = new Set(preferred);
  for (const c of sortedCards()) {
    if (set.size >= Math.min(3, state.cards.size)) break;
    set.add(c.id);
  }
  return set;
}
function ensureCastSets() {
  for (const scope of ['tab2', 'tab3']) {
    const tab = state.tabs[scope];
    if (!tab) continue;
    const set = tab.cast;
    for (const id of Array.from(set)) if (!state.cards.has(id)) set.delete(id);
    // 「用户主动清空」标记：清空后不要用默认 3 人恢复，否则永远清不掉。
    if (!set.size && !tab.castCleared) tab.cast = defaultCastSet();
  }
}

function clearScopeCast(scope = 'tab2') {
  if (!state.tabs[scope]) return;
  state.tabs[scope].cast = new Set();
  state.tabs[scope].castCleared = true;
}

/* ── 按剧情自动勾选出场角色 ────────────────────────────────
   复用 parseScriptText 的名字表（name_jp / name_short / name_cn / kana /
   唯一 first_person / 姓 / 名字+敬称）。一个别名指向两个角色时按歧义处理，
   一个都不勾（大崎 → 甘奈 / 甜花）。 */
function plotCastAliases(ctx) {
  const entries = [];
  if (!ctx || !ctx.speakerDirectory) return entries;
  for (const bucket of ctx.speakerDirectory.values()) {
    if (!bucket || !bucket.size) continue;
    const hits = Array.from(bucket.values()).sort((a, b) => a.rank - b.rank);
    const best = hits[0];
    const alias = String(best?.alias || '').trim();
    if (!alias) continue;
    // 中文剧情里只认日文 / 汉字名；拉丁 id、romaji 太容易误判，直接跳过。
    if (!/[\u3040-\u30ff\u3400-\u9fff]/u.test(alias)) continue;
    entries.push({
      alias,
      // 单字姓（黛）本身不是常用词，裸写也认；单字名（透）见下面的复合词保护。
      isSurname: best.source === 'surname' || best.source === 'surname_kana',
      cards: hits.map(hit => hit.card).filter(Boolean)
    });
  }
  entries.sort((a, b) => b.alias.length - a.alias.length || a.alias.localeCompare(b.alias, 'ja'));
  return entries;
}
function detectPlotCast(text, ctx) {
  const source = String(text == null ? '' : text).normalize('NFKC');
  const result = { cards: [], tokens: [], ambiguous: [] };
  if (!source.trim() || !ctx) return result;
  const picked = new Map();
  const covered = [];
  for (const entry of plotCastAliases(ctx)) {
    const re = new RegExp(escapeRegExp(entry.alias), 'gu');
    let m;
    while ((m = re.exec(source)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // 长名优先：七草にちか 命中后，里面的 にちか / 七草 不再算。
      if (covered.some(span => start < span.end && end > span.start)) continue;
      // 单字名（透）默认要求跟敬称；后面不是汉字时也认（「只剩円香和透。」），
      // 但「透明」这类复合词不认。单字姓（黛）不受此限。
      if (Array.from(entry.alias).length < 2) {
        const honored = HONORIFICS.some(honor => source.startsWith(honor, end));
        const followedByKanji = /[\u3400-\u9fff]/u.test(source.slice(end, end + 1));
        if (!honored && followedByKanji && !entry.isSurname) continue;
      }
      if (entry.cards.length !== 1) {
        if (!result.ambiguous.some(item => item.token === entry.alias)) {
          result.ambiguous.push({ token: entry.alias, cards: [...entry.cards] });
        }
        continue;
      }
      covered.push({ start, end });
      const card = entry.cards[0];
      if (!picked.has(card.id)) picked.set(card.id, { card, tokens: [], first: start });
      picked.get(card.id).tokens.push(m[0]);
      if (re.lastIndex === start) re.lastIndex += 1;
    }
  }
  // 按首次出现的顺序排，提示行读起来和剧情一致（冬優子、あさひ、甘奈）。
  const ordered = Array.from(picked.values()).sort((a, b) => a.first - b.first);
  result.cards = ordered.map(item => item.card);
  result.tokens = ordered.flatMap(item => item.tokens);
  return result;
}

function autoSelectPlotCast(scope = 'tab2', options = {}) {
  const raw = options.plot != null
    ? options.plot
    : (state.tabs[scope]?.plot || $(scope === 'tab2' ? '#t2Plot' : '#t3Plot')?.value || '');
  const text = String(raw);
  if (options.plot != null && state.tabs[scope]) state.tabs[scope].plot = text;
  if (!text.trim()) return null;
  const ctx = buildContext(state.cards, state.codeMap);
  const found = detectPlotCast(text, ctx);
  if (!found.cards.length) return found;
  if (state.tabs[scope]) {
    state.tabs[scope].cast = new Set(found.cards.map(card => card.id));
    state.tabs[scope].castCleared = false;
  }
  syncStepAiButtons(scope);
  return found;
}



const SAMPLE_SCRIPT = `fyk：今天天气真不错呢
ash：是啊，fyk
amn：fyk和ash都在呢，今天也辛苦了`;
let toastTimer = null;
let modalPreviousFocus = null;


function setStatusMessage(message, tone = '') {
  state.lastStatus = { message: String(message || ''), tone };
}
function showToast() {}
function renderAll() {}
function updateTab1Info() {
  const input = String(state.tabs.tab1?.input || $('#t1Input')?.value || '');
  const rows = input.split(/\r?\n/).filter(l => l.trim());
  if (state.tabs.tab1) state.tabs.tab1.infoText = `${rows.length} 行 / ${Array.from(input).length} 字符`;
}

function appendResultWarning(result, type, label, message, level = 'warn', lineNo = null) {
  result.warnings.push({ type, label, message, level, lineNo });
  result.warningCount = result.warnings.length;
  result.severityCounts = countSeverityCounts(result);
}
function enforceMaxLineWarning(result, maxLines) {
  if (maxLines && result.dialogueLineCount > maxLines) {
    appendResultWarning(
      result, 'general', '行数',
      `输出共 ${result.dialogueLineCount} 行，超过本场设定上限 ${maxLines} 行`,
      'warn', null
    );
  }
}

let addressFixSession = null;
function addressErrorLines(result) {
  if (!result || !Array.isArray(result.outputLines)) return [];
  return result.outputLines.filter(line =>
    (line.hardChecks || []).some(issue => issue.type === 'address')
  );
}
function buildAddressFixPlan(result) {
  const plan = { auto: [], manual: [] };
  if (!result || !Array.isArray(result.outputLines)) return plan;
  const ctx = buildContext(state.cards, state.codeMap);
  const seen = new Set();
  for (const line of result.outputLines) {
    if (line.type !== 'dialogue' || !line.speakerId) continue;
    const speakerCard = state.cards.get(line.speakerId);
    if (!speakerCard) continue;
    for (const issue of (line.hardChecks || [])) {
      if (issue.type !== 'address' || issue.fixable === false) continue;
      if (!issue.targetId || !issue.form) continue;
      const key = `${line.lineNo}|${issue.targetId}|${issue.form}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const targetCard = state.cards.get(issue.targetId);
      if (!targetCard) continue;
      const info = findAddressEntry(speakerCard, targetCard, ctx);
      const candidates = info
        ? sortByCountThenOrder(info.forms.filter(f => f && f.form))
          .map(f => ({ form: String(f.form), count: asNumber(f.count, 0) }))
          .filter(f => f.form && f.form !== issue.form)
        : [];
      const item = {
        key,
        lineNo: line.lineNo,
        speakerId: speakerCard.id,
        speakerName: speakerCard.name_short,
        targetId: targetCard.id,
        targetName: targetCard.name_short,
        form: String(issue.form),
        candidates,
        note: (info && info.note) || issue.note || ''
      };
      // A. 唯一合法形式 → 直接改；B. 多种形式 → 交给面板选。
      if (item.candidates.length === 1) plan.auto.push(item);
      else plan.manual.push(item);
    }
  }
  return plan;
}

function applyAddressFixes(edits, options = {}) {
  const scope = options.scope || 'tab1';
  const tab = state.tabs[scope];
  const result = options.result || tab?.result;
  const currentInput = options.text != null ? String(options.text) : String(tab?.input || $('#t1Input')?.value || '');
  if (!currentInput || !result || !Array.isArray(edits) || !edits.length) return 0;
  const entries = new Map((result.entries || [])
    .filter(entry => entry.type === 'dialogue')
    .map(entry => [entry.lineNo, entry]));
  const lines = currentInput.split('\n');
  const byLine = new Map();
  for (const edit of edits) {
    if (!edit || !edit.form || edit.form === edit.to) continue;
    if (!byLine.has(edit.lineNo)) byLine.set(edit.lineNo, []);
    byLine.get(edit.lineNo).push(edit);
  }
  let applied = 0;
  for (const [lineNo, list] of byLine) {
    const entry = entries.get(lineNo);
    const idx = lineNo - 1;
    if (!entry || idx < 0 || idx >= lines.length) continue;
    const originalContent = String(entry.content == null ? '' : entry.content);
    if (!originalContent) continue;
    let content = originalContent;
    for (const edit of list) {
      const next = content.split(edit.form).join(edit.to);
      if (next !== content) { content = next; applied += 1; }
    }
    if (content === originalContent) continue;
    const raw = lines[idx];
    const pos = raw.lastIndexOf(originalContent);
    if (pos < 0) continue;
    lines[idx] = raw.slice(0, pos) + content + raw.slice(pos + originalContent.length);
  }
  if (!applied) return 0;
  const joined = lines.join('\n');
  if (tab) tab.input = joined;
  const ta = $('#t1Input');
  if (ta) ta.value = joined;
  updateTab1Info();
  return applied;
}

function addressFixManualRemaining() {
  const plan = buildAddressFixPlan(state.tabs.tab1?.result);
  const skipped = addressFixSession?.skipped || new Set();
  return plan.manual.filter(item => !skipped.has(item.key));
}

function renderAddressFixPanel() {
  const items = addressFixManualRemaining();
  if (!items.length) {
    state.lastModal = null;
    return '';
  }
  const rows = items.map(item => {
    const candidates = item.candidates.length
      ? item.candidates.map(candidate => `<button class="address-fix-cand" type="button" data-address-fix-line="${item.lineNo}" data-address-fix-form="${escapeAttr(item.form)}" data-address-fix-to="${escapeAttr(candidate.form)}" data-address-fix-key="${escapeAttr(item.key)}">改成 ${escapeHtml(candidate.form)}${candidate.count ? `（${candidate.count} 次）` : ''}</button>`).join('')
      : '<span class="address-fix-none">address 表里没有可选形式，只能手改</span>';
    return `<div class="address-fix-item">
      <div class="address-fix-head">
        <span class="address-fix-line">第 ${item.lineNo} 行</span>
        <b>「${escapeHtml(item.form)}」</b>
        <span>${escapeHtml(item.speakerName)} → ${escapeHtml(item.targetName)}</span>
      </div>
      ${item.note ? `<div class="address-fix-note">场合：${escapeHtml(item.note)}</div>` : ''}
      <div class="address-fix-actions">${candidates}<button class="address-fix-skip" type="button" data-address-fix-skip="${escapeAttr(item.key)}">跳过</button></div>
    </div>`;
  }).join('');
  const html = `<p class="address-fix-tip">这些对象有多个合法称呼，用哪个由场景决定，所以不自动猜。点候选直接改写这一行；点「跳过」保留原文。</p><div class="address-fix-list">${rows}</div>`;
  state.lastModal = { open: true, title: `一键修称呼 · ${items.length} 处需要你选`, html, items };
  return html;
}

function chooseAddressFix(dataset) {
  const lineNo = Number(dataset.addressFixLine ?? dataset.lineNo);
  const applied = applyAddressFixes([{
    lineNo,
    form: dataset.addressFixForm || dataset.form || '',
    to: dataset.addressFixTo || dataset.to || ''
  }]);
  if (!applied) {
    if (addressFixSession && (dataset.addressFixKey || dataset.key)) {
      addressFixSession.skipped.add(dataset.addressFixKey || dataset.key);
    }
    renderAddressFixPanel();
    return 0;
  }
  if (addressFixSession) addressFixSession.fixed += applied;
  runTab1({ quiet: true });
  renderAddressFixPanel();
  return applied;
}

function startAddressFix() {
  const result = state.tabs.tab1?.result;
  if (!result) return null;
  const plan = buildAddressFixPlan(result);
  if (!plan.auto.length && !plan.manual.length) return null;
  const before = String(state.tabs.tab1.input || $('#t1Input')?.value || '');
  state.tabs.tab1.aiUndo = { before, at: Date.now(), kind: 'addressFix' };
  addressFixSession = { fixed: 0, skipped: new Set(), manualTotal: plan.manual.length };
  const autoApplied = plan.auto.length
    ? applyAddressFixes(plan.auto.map(item => ({ lineNo: item.lineNo, form: item.form, to: item.candidates[0].form })))
    : 0;
  addressFixSession.fixed = autoApplied;
  if (autoApplied) runTab1({ quiet: true });
  const manualLeft = addressFixManualRemaining();
  const panelHtml = manualLeft.length ? renderAddressFixPanel() : '';
  return { fixed: autoApplied, manual: manualLeft.length, manualItems: manualLeft, panelHtml };
}

function undoTab1Ai() {
  const undo = state.tabs.tab1?.aiUndo;
  const before = undo?.before;
  if (before == null) return false;
  state.tabs.tab1.input = before;
  const ta = $('#t1Input');
  if (ta) ta.value = before;
  state.tabs.tab1.aiUndo = null;
  addressFixSession = null;
  state.lastModal = null;
  updateTab1Info();
  runTab1({ quiet: true });
  return true;
}

function updateDraftInfo(scope) {
  const ctx = buildContext(state.cards, state.codeMap);
  if (scope === 'tab2') {
    const zh = String(state.tabs.tab2?.chinese || $('#t2Chinese')?.value || '').trim();
    if (!zh) state.tabs.tab2.parseInfo = '等待中文草稿';
    else {
      const parsed = parseScriptText(zh, ctx);
      inferTargets(parsed.entries, ctx);
      const lines = parsed.entries.filter(e => e.type === 'dialogue');
      const speakers = new Set(lines.map(e => e.speakerId).filter(Boolean));
      state.tabs.tab2.parseInfo = lines.length
        ? `已识别 ${lines.length} 行 / ${speakers.size} 角色${parsed.warnings.length ? ` · ${parsed.warnings.length} 个解析提示` : ''}`
        : `未识别到规范台词${parsed.warnings.length ? ` · ${parsed.warnings.length} 个解析提示` : ''}`;
    }
    const jp = String(state.tabs.tab2?.japanese || $('#t2Japanese')?.value || '').trim();
    if (!jp) state.tabs.tab2.jpInfo = '等待日语台本';
    else {
      const parsed = parseScriptText(jp, ctx);
      inferTargets(parsed.entries, ctx);
      const lines = parsed.entries.filter(e => e.type === 'dialogue');
      state.tabs.tab2.jpInfo = lines.length
        ? `已识别 ${lines.length} 行${parsed.warnings.length ? ` · ${parsed.warnings.length} 个解析提示` : ''}`
        : `未识别到规范台词${parsed.warnings.length ? ` · ${parsed.warnings.length} 个解析提示` : ''}`;
    }
  } else if (scope === 'tab3') {
    const jp = String(state.tabs.tab3?.japanese || $('#t3Japanese')?.value || '').trim();
    if (!jp) state.tabs.tab3.jpInfo = '等待日语台本';
    else {
      const parsed = parseScriptText(jp, ctx);
      inferTargets(parsed.entries, ctx);
      const lines = parsed.entries.filter(e => e.type === 'dialogue');
      state.tabs.tab3.jpInfo = lines.length
        ? `已识别 ${lines.length} 行${parsed.warnings.length ? ` · ${parsed.warnings.length} 个解析提示` : ''}`
        : `未识别到规范台词${parsed.warnings.length ? ` · ${parsed.warnings.length} 个解析提示` : ''}`;
    }
  }
}

function runTab1(options = {}) {
  const text = String(options.text != null ? options.text : (state.tabs.tab1?.input || $('#t1Input')?.value || ''));
  if (options.text != null) state.tabs.tab1.input = text;
  if (!text.trim() || !state.cards.size) return null;
  const result = analyzeScriptText(text, state.cards, state.codeMap, state.rules);
  state.tabs.tab1.result = result;
  state.tabs.tab1.parseFailures = result.parseFailures || [];
  state.tabs.tab1.activeOutputTab = result.dialogueLineCount ? 'script' : 'notes';
  ensureFocusValid();
  return result;
}

function processJapanese(scope = 'tab2', options = {}) {
  const tab = state.tabs[scope];
  if (!tab) return null;
  const text = String(options.text != null ? options.text : (tab.japanese || $(scope === 'tab2' ? '#t2Japanese' : '#t3Japanese')?.value || ''));
  if (options.text != null) tab.japanese = text;
  if (!text.trim() || !state.cards.size) return null;
  const maxLines = getScopeMaxLines(scope, options);
  const result = analyzeScriptText(text, state.cards, state.codeMap, state.rules, {
    cast: new Set(tab.cast || [])
  });
  enforceMaxLineWarning(result, maxLines);
  tab.result = result;
  tab.activeOutputTab = result.dialogueLineCount ? 'script' : 'notes';
  ensureFocusValid();
  updateDraftInfo(scope);
  return result;
}

function extractCardRecords(data, fallbackId, origin = '') {
  if (data == null) return [];
  if (Array.isArray(data)) {
    const out = [];
    data.forEach((item, idx) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        out.push({ raw: item, fallbackId: fallbackId != null ? `${fallbackId}-${idx + 1}` : item.id || '', origin });
      }
    });
    return out;
  }
  if (typeof data !== 'object') return [];
  if (Array.isArray(data.cards)) return extractCardRecords(data.cards, fallbackId, origin);
  if (Array.isArray(data.characters) && !data.name_jp && !data.id) return []; // index.json
  if (data.name_jp || (data.id && (data.speech || data.symbols))) {
    return [{ raw: data, fallbackId: fallbackId || data.id || '', origin }];
  }
  const values = Object.values(data);
  const cardValues = values.filter(v => v && typeof v === 'object' && !Array.isArray(v) && (v.name_jp || v.id));
  if (cardValues.length) {
    const out = [];
    for (const [key, value] of Object.entries(data)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      if (value.name_jp || value.id) out.push({ raw: value, fallbackId: value.id || key, origin });
    }
    return out;
  }
  return [];
}

function loadRecords(records, options = {}) {
  const parsedCards = [];
  for (const rec of records || []) {
    try {
      parsedCards.push(normalizeCard(rec.raw, rec.fallbackId));
    } catch (err) { /* skip invalid */ }
  }
  if (!parsedCards.length) return false;
  const target = options.merge ? new Map(state.cards) : new Map();
  for (const card of parsedCards) target.set(card.id, card);
  if (!target.size) return false;
  const previousFocus = state.focusId;
  state.cards = target;
  state.sourceKind = options.sourceKind || 'paste';
  state.sourceLabel = options.sourceLabel || '加载卡片';
  state.focusId = previousFocus && target.has(previousFocus) ? previousFocus : (target.has('fuyuko') ? 'fuyuko' : (sortedCards()[0]?.id || null));
  ensureCastSets();
  return true;
}

function useBuiltInMock(options = {}) {
  if (INITIAL_BUNDLE && Object.keys(MERGED_PARSED).length === 0) {
    loadCardBundle(INITIAL_BUNDLE, { silent: true });
    return state.cards;
  }
  const cards = buildMockCards();
  const map = new Map(cards.map(c => [c.id, c]));
  state.cards = map;
  state.enriched = new Map();
  state.ruleCards = new Map();
  seedMergedLayers();
  state.sourceKind = 'mock';
  state.sourceLabel = `内置真实数据（${map.size} 角色）`;
  state.focusId = map.has('fuyuko') ? 'fuyuko' : (sortedCards()[0]?.id || null);
  if (!state.tabs.tab2.cast.size && !state.tabs.tab2.castCleared) state.tabs.tab2.cast = defaultCastSet();
  if (!state.tabs.tab3.cast.size && !state.tabs.tab3.castCleared) state.tabs.tab3.cast = defaultCastSet();
  state.tabs.tab1.result = null;
  state.tabs.tab2.result = null;
  state.tabs.tab3.result = null;
  state.tabs.tab2.prompts = { step1: '', step2: '' };
  state.tabs.tab3.prompts = { step1: '' };
  ensureCastSets();
  if (options.autoDemo) {
    state.tabs.tab1.input = SAMPLE_SCRIPT;
    runTab1({ quiet: true });
  }
  return state.cards;
}

function expandWorkbench(scope = 'tab2') {
  if (state.tabs[scope]) state.tabs[scope].workbenchOpen = true;
}

function generatePrompt1(scope = 'tab2', options = {}) {
  try {
    const prompt = scope === 'tab2' ? buildChineseDraftPrompt(options.plot ? { ...options, scope } : scope) : buildOneShotPrompt(options.plot ? { ...options, scope } : scope);
    if (scope === 'tab2') {
      state.tabs.tab2.prompts.step1 = prompt;
      state.tabs.tab2.prompts.step2 = '';
      state.tabs.tab2.aiNotes = {};
    } else if (state.tabs[scope]) {
      state.tabs[scope].prompts.step1 = prompt;
      state.tabs[scope].aiNotes = {};
    }
    if (options.reveal) expandWorkbench(scope);
    return prompt;
  } catch (err) {
    setStatusMessage(err.message, 'error');
    return null;
  }
}

function generatePrompt2(options = {}) {
  const chinese = String(options.chineseText != null ? options.chineseText : (state.tabs.tab2.chinese || $('#t2Chinese')?.value || ''));
  if (!chinese.trim()) return null;
  try {
    const prompt = buildTranslationPrompt('tab2', chinese);
    state.tabs.tab2.prompts.step2 = prompt;
    delete state.tabs.tab2.aiNotes.step2;
    if (options.reveal) expandWorkbench('tab2');
    updateDraftInfo('tab2');
    return prompt;
  } catch (err) {
    setStatusMessage(err.message, 'error');
    return null;
  }
}

const BUILD_INFO = {
  version: 'v1.8',
  date: '2026-11-08',
  tag: '台本润色器 · 本场类型 + merged 卡 · 字幕/配音',
};
const AI_STORAGE_KEY = 'scsp_ai_config';
const AI_BASE_DEFAULT = 'https://api.deepseek.com';
const AI_MODEL_DEFAULT = 'deepseek-flash';
const AI_MODEL_PRESETS = ['deepseek-flash', 'deepseek-v4-pro'];
const AI_TIMEOUT_MS = 120000;
const AI_SYSTEM_PROMPT = [
  '你是《アイドルマスター シャイニーカラーズ》同人台本的日语脚本润色师。',
  '严格遵守给定的角色档案：一人称、对他人称呼、语体（敬语/平语）、句尾习惯、句长上限、符号密度。',
  '输出必须是可直接给声优朗读的日语口语台词。',
  '先在心里确认约束，再一次性给出成品；不要在思考里反复重写同一行。',
  '不要输出标题、编号、解释、中文说明、罗马字或 Markdown 代码围栏。'
].join('');
const AI_SYSTEM_PROMPT_ZH = [
  '你是《アイドルマスター シャイニーカラーズ》同人台本的编剧。',
  '当前任务是写【中文台词草稿】，供下一轮翻译成日语使用。',
  '严格遵守给定的角色档案：一人称、对他人称呼、语体、句尾习惯、句长上限、符号密度。',
  '输出必须是自然的中文口语台词，不要写成书面语或说明文。',
  '不要输出标题、编号、解释、日语翻译、罗马字或 Markdown 代码围栏。'
].join('');

function aiNormalizeBaseUrl(value) {
  let url = String(value == null ? '' : value).trim().replace(/\s+/g, '');
  if (!url) return AI_BASE_DEFAULT.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(url)) return url;
  return `${url}/chat/completions`;
}
function aiEndpointOf(baseUrl) {
  return aiNormalizeBaseUrl(baseUrl);
}
function normalizeAiConfig(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const baseUrl = String(src.baseUrl ?? src.base_url ?? '').trim() || AI_BASE_DEFAULT;
  const apiKey = String(src.apiKey ?? src.api_key ?? '').trim();
  const model = String(src.model ?? '').trim() || AI_MODEL_DEFAULT;
  return { baseUrl, apiKey, model };
}
function loadAiConfig() {
  const raw = safeStorageGet(AI_STORAGE_KEY);
  if (!raw) return normalizeAiConfig(null);
  let obj = null;
  try { obj = JSON.parse(raw); } catch (err) { obj = null; }
  return normalizeAiConfig(obj);
}
function saveAiConfig(config) {
  const cfg = normalizeAiConfig(config);
  const ok = safeStorageSet(AI_STORAGE_KEY, JSON.stringify(cfg));
  return { ok, config: cfg };
}
function clearAiConfig() {
  safeStorageRemove(AI_STORAGE_KEY);
  return normalizeAiConfig(null);
}
function aiConfigReady(config) {
  const cfg = normalizeAiConfig(config || null);
  return Boolean(cfg.apiKey);
}
function aiConfigEqual(a, b) {
  const x = normalizeAiConfig(a);
  const y = normalizeAiConfig(b);
  return x.baseUrl === y.baseUrl && x.apiKey === y.apiKey && x.model === y.model;
}

/* ── language detection ──────────────────────────────────── */
function kanaRatio(text) {
  const source = String(text == null ? '' : text);
  const letters = Array.from(source).filter(ch => !/[\s\p{P}\p{S}\dA-Za-z]/u.test(ch));
  if (!letters.length) return 0;
  const kana = letters.filter(ch => /[\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff\u30fc]/.test(ch)).length;
  return kana / letters.length;
}
function detectScriptLanguage(text) {
  return kanaRatio(text) >= 0.3 ? 'ja' : 'zh';
}

/* ── error mapping ───────────────────────────────────────── */
function aiErrorInfo(error) {
  const err = (error && typeof error === 'object') ? error : { message: String(error || '') };
  const status = Number(err.status || 0);
  const kind = String(err.kind || '');
  const detail = truncate(String(err.detail || err.message || '').trim(), 180);
  let code = 'unknown';
  let message = detail || '未知错误';
  if (kind === 'timeout' || err.name === 'AbortError') {
    code = 'timeout';
    message = '超过 120 秒没响应，请重试或把请求缩短';
  } else if (kind === 'network') {
    code = 'network';
    message = '连不上 api.deepseek.com，检查网络（代理 / 防火墙 / 离线）';
  } else if (kind === 'empty') {
    code = 'empty-content';
    message = String(err.finish || '') === 'length'
      ? '模型只返回了思考过程，请重试（思考吃满了 max_tokens）'
      : '模型只返回了思考过程，请重试';
  } else if (kind === 'config') {
    code = 'no-config';
    message = '还没有配置 API key；先打开「AI 接口」面板填写并保存';
  } else if (status === 401) {
    code = 'invalid-key';
    message = 'API key 无效（401），检查是否复制完整';
  } else if (status === 402) {
    code = 'no-balance';
    message = '余额不足（402），请先充值';
  } else if (status === 429) {
    code = 'rate-limit';
    message = '请求太频繁，等一下再试（429）';
  } else if (status === 403) {
    code = 'forbidden';
    message = `没有访问权限（403）${detail ? `：${detail}` : ''}`;
  } else if (status >= 500) {
    code = 'server';
    message = `DeepSeek 服务器错误（${status}）${detail ? `：${detail}` : ''}`;
  } else if (status) {
    code = 'http';
    message = `API 返回 ${status}${detail ? `：${detail}` : ''}`;
  } else if (detail) {
    code = 'unknown';
    message = detail;
  }
  return { code, status, message, detail };
}

/* ── response parsing ────────────────────────────────────── */
function stripCodeFence(text) {
  let s = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
  if (!s) return '';
  const closed = s.match(/^```[A-Za-z0-9_+#.-]*[ \t]*\n?([\s\S]*?)\n?```$/);
  if (closed) return closed[1].trim();
  if (/^```/.test(s)) {
    s = s.replace(/^```[A-Za-z0-9_+#.-]*[ \t]*\n?/, '');
    s = s.replace(/\n?```\s*$/, '');
  }
  return s.trim();
}
function normalizeAiUsage(usage) {
  const u = (usage && typeof usage === 'object') ? usage : {};
  const prompt = asNumber(u.prompt_tokens, 0);
  const completion = asNumber(u.completion_tokens, 0);
  const reasoning = asNumber(u.reasoning_tokens ?? u.completion_tokens_details?.reasoning_tokens, 0);
  const total = asNumber(u.total_tokens, prompt + completion);
  return { prompt, completion, reasoning, total };
}
function parseAiResponse(payload) {
  const choice = payload?.choices?.[0] || {};
  const message = choice.message || {};
  return {
    content: stripCodeFence(message.content || ''),
    reasoning: String(message.reasoning_content ?? message.reasoning ?? '').trim(),
    finish: String(choice.finish_reason || ''),
    usage: normalizeAiUsage(payload?.usage)
  };
}
function fmtAiTokens(usage) {
  const u = (usage && typeof usage === 'object') ? usage : {};
  const prompt = asNumber(u.prompt ?? u.prompt_tokens, 0);
  const completion = asNumber(u.completion ?? u.completion_tokens, 0);
  const total = asNumber(u.total ?? u.total_tokens, prompt + completion);
  return `${total.toLocaleString('en-US')} tokens`;
}
function aiElapsedText(ms) {
  return `${(asNumber(ms, 0) / 1000).toFixed(1)} 秒`;
}
function aiUsageTitle(usage) {
  const u = (usage && typeof usage === 'object') ? usage : {};
  const prompt = asNumber(u.prompt ?? u.prompt_tokens, 0);
  const completion = asNumber(u.completion ?? u.completion_tokens, 0);
  const reasoning = asNumber(u.reasoning ?? u.reasoning_tokens, 0);
  return `prompt ${prompt} / completion ${completion} / reasoning ${reasoning}`;
}

/* ── generic API call ────────────────────────────────────── */
async function callAI(options = {}) {
  const cfg = normalizeAiConfig(options.config || (state.ai && state.ai.config) || loadAiConfig());
  const user = String(options.user == null ? '' : options.user).trim();
  if (!cfg.apiKey) { const err = new Error('missing api key'); err.kind = 'config'; throw err; }
  if (!user) { const err = new Error('empty prompt'); err.kind = 'config'; throw err; }
  const fetchImpl = typeof options.fetchImpl === 'function'
    ? options.fetchImpl
    : (typeof fetch === 'function' ? fetch.bind(globalRoot) : null);
  if (!fetchImpl) { const err = new Error('fetch unavailable'); err.kind = 'network'; throw err; }
  const endpoint = aiEndpointOf(cfg.baseUrl);
  const maxTokens = clampNumber(options.maxTokens, 1, 16384, 3000);
  const temperature = clampNumber(options.temperature, 0, 2, 0.9);
  const timeoutMs = clampNumber(options.timeoutMs, 1000, 600000, AI_TIMEOUT_MS);
  const system = String(options.system == null ? '' : options.system);
  const messages = [];
  if (system.trim()) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });
  const body = {
    model: cfg.model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: false
  };
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const started = Date.now();
  try {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined
      });
    } catch (error) {
      const err = new Error(error?.message || 'network error');
      err.kind = (error?.name === 'AbortError') ? 'timeout' : 'network';
      throw err;
    }
    if (!response || response.ok === false) {
      const status = Number(response?.status || 0);
      let detail = '';
      try {
        const raw = await response.text();
        const trimmed = String(raw || '').trim();
        try {
          const parsedError = JSON.parse(trimmed);
          detail = String(parsedError?.error?.message || parsedError?.message || parsedError?.detail || trimmed || '');
        } catch (jsonErr) {
          detail = trimmed;
        }
      } catch (readErr) { detail = ''; }
      const err = new Error(detail || `HTTP ${status}`);
      err.status = status;
      err.detail = detail;
      err.kind = 'http';
      throw err;
    }
    let payload;
    try {
      payload = await response.json();
    } catch (jsonErr) {
      const err = new Error('响应不是合法 JSON');
      err.status = Number(response.status || 0);
      err.kind = (jsonErr?.name === 'AbortError') ? 'timeout' : 'http';
      throw err;
    }
    // 计时覆盖「请求 → 读完响应体」的完整往返（不含流式，server 只在生成结束后返回 body）
    const elapsed = Date.now() - started;
    const parsed = parseAiResponse(payload);
    if (!parsed.content) {
      if (parsed.reasoning && options.allowEmpty) {
        return { content: '', reasoning: parsed.reasoning, usage: parsed.usage, elapsed, model: cfg.model, endpoint };
      }
      const err = new Error(parsed.reasoning ? 'reasoning only' : 'empty content');
      err.kind = 'empty';
      err.reasoning = parsed.reasoning;
      err.finish = parsed.finish;
      err.usage = parsed.usage;
      err.maxTokens = maxTokens;
      throw err;
    }
    return { content: parsed.content, reasoning: parsed.reasoning, usage: parsed.usage, elapsed, model: cfg.model, endpoint };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* 思考型模型会把 max_tokens 花在思考上：正文为空且 finish_reason=length 时
   自动加大预算重试一次，避免用户看到「只返回了思考过程」。 */
async function callAIWithRetry(options = {}) {
  const first = clampNumber(options.maxTokens, 1, 16384, 3000);
  try {
    return await callAI(options);
  } catch (error) {
    const truncated = error && error.kind === 'empty' && String(error.finish || '') === 'length';
    if (!truncated) throw error;
    const bigger = Math.min(16384, Math.max(first + 2000, Math.round(first * 1.8)));
    if (bigger <= first) throw error;
    state.lastStatus = { message: `模型思考用满了 max_tokens=${first}，已自动用 ${bigger} 重试一次…`, tone: '' };
    return callAI({ ...options, maxTokens: bigger });
  }
}

/* ── prompts ─────────────────────────────────────────────── */
function aiPromptCast(sourceText, ctx, options = {}) {
  const all = sortedCards();
  if (!all.length) return [];
  const picked = [];
  const add = card => {
    if (!card || picked.some(p => p.id === card.id)) return;
    picked.push(card);
  };
  if (options.cast && options.cast.length) options.cast.forEach(add);
  if (!picked.length && String(sourceText || '').trim()) {
    try {
      const parsed = parseScriptText(sourceText, ctx);
      inferTargets(parsed.entries, ctx);
      for (const entry of parsed.entries) {
        if (entry.type !== 'dialogue') continue;
        if (entry.speakerId) add(state.cards.get(entry.speakerId));
      }
    } catch (err) { /* fall through to defaults */ }
  }
  if (!picked.length) add(state.cards.get(state.focusId));
  if (!picked.length) add(all[0]);
  const limit = 4;
  for (const card of all) {
    if (picked.length >= limit) break;
    add(card);
  }
  return picked.slice(0, limit);
}
function aiPromptPlan(cast, text) {
  const rows = String(text == null ? '' : text).split(/\r?\n/).filter(line => line.trim()).length;
  return planLines(cast, Math.max(cast.length, rows));
}
function aiCastLegendLine(cast, ctx) {
  return cast.map(c => `- ${c.name_jp}（${c.name_cn}）＝ ${getPrimaryCodes(c, ctx).join(' / ')}`).join('\n');
}
function aiCastListLine(cast) {
  return cast.map(c => `${c.name_short}（${c.name_jp}）`).join('、');
}
function buildAiTranslationPrompt(sourceText, options = {}) {
  const ctx = options.ctx || buildContext(state.cards, state.codeMap);
  const text = String(sourceText == null ? '' : sourceText).trim();
  const cast = aiPromptCast(text, ctx, { cast: options.cast });
  const scene = String(options.scene != null ? options.scene : (state.scene || '')).trim();
  if (!cast.length) throw new Error('还没有角色卡；先载入 cards/data/ 或内置数据');
  const plan = aiPromptPlan(cast, text);
  const profiles = cast.map(c => buildProfileText(c, cast, ctx, plan.get(c.id))).join('\n\n');
  const rulesBlock = buildRulesPromptBlock(cast);
  return [
    '你在把中文剧本翻译成日语。',
    '',
    `【场景】${scene || '未指定'}`,
    '【出场角色】',
    aiCastLegendLine(cast, ctx),
    '',
    '【角色档案】',
    profiles,
    ...(rulesBlock ? ['', rulesBlock] : []),
    '',
    addressAndRulesBlock(cast, ctx, plan),
    '',
    '【翻译要求】',
    '1. 译成角色实际会说的日语口语，不是书面语；避免翻译腔和说明文句。',
    '2. 严格匹配参数表里的语体（敬语/平语）和一人称；不要因为中文「我」就写成「私」。',
    '3. 句长控制在各自的区间内（不超过 avg_len × 2）；宁可断成两句。',
    '4. 符号（…！？～ー）按角色的习惯使用，不要每句都堆符号。',
    '5. 性格特征按配额，不要每句都加口癖；宁可少用，不要贴标签。',
    '6. 逐行一一对应：不增行、不删行、不合并、不拆分；保留行首的说话人代码、箭头（→）与全角冒号（：）。',
    '7. 如果原文是「fyk：中文」或「fyk→ash：中文」，输出必须是「fyk：日语」或「fyk→ash：日语」，代码保持原样。',
    '8. 不要输出中文解释、罗马字、读音标注、动作说明或标题。',
    '',
    '【输入】',
    '━━━━━━━━━━━━━━━━━━━━',
    text,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    buildOutputFormat(cast, ctx, { japanese: true }),
    '',
    '现在只输出日语台词行。'
  ].join('\n');
}
function buildAiPolishPrompt(sourceText, options = {}) {
  const ctx = options.ctx || buildContext(state.cards, state.codeMap);
  const text = String(sourceText == null ? '' : sourceText).trim();
  const cast = aiPromptCast(text, ctx, { cast: options.cast });
  const scene = String(options.scene != null ? options.scene : (state.scene || '')).trim();
  if (!cast.length) throw new Error('还没有角色卡；先载入 cards/data/ 或内置数据');
  const plan = aiPromptPlan(cast, text);
  const profiles = cast.map(c => buildProfileText(c, cast, ctx, plan.get(c.id))).join('\n\n');
  const rulesBlock = buildRulesPromptBlock(cast);
  return [
    '你在润色一段日语台本，把它改得更像角色本人说的话。',
    '',
    `【场景】${scene || '未指定'}`,
    '【出场角色】',
    aiCastLegendLine(cast, ctx),
    '',
    '【角色档案】',
    profiles,
    ...(rulesBlock ? ['', rulesBlock] : []),
    '',
    addressAndRulesBlock(cast, ctx, plan),
    '',
    '【润色要求】',
    '1. 保持意思与信息量不变，只改说法：语序、省略、口癖、停顿、句尾。',
    '2. 严格匹配参数表里的语体（敬语/平语）和一人称。',
    '3. 句长控制在各自的区间内（不超过 avg_len × 2）。',
    '4. 符号（…！？～ー）按角色的习惯使用；清掉堆叠的感叹号和多余的波浪线。',
    '5. 性格特征按配额，不要每句都加口癖。',
    '6. 不增行、不删行、不合并、不拆分；保留行首的说话人代码、箭头（→）与全角冒号（：）。',
    '7. 已经不违和的行就少改，不要为了改而改；不要输出中文解释。',
    '',
    '【输入】',
    '━━━━━━━━━━━━━━━━━━━━',
    text,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    buildOutputFormat(cast, ctx, { japanese: true }),
    '',
    '现在只输出润色后的日语台词行。'
  ].join('\n');
}


let aiBusy = false;
function aiStepElapsed(result, startedAt) {
  const elapsed = Number(result && result.elapsed);
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : Math.max(0, Date.now() - startedAt);
}
function countDraftLines(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return 0;
  try {
    const ctx = buildContext(state.cards, state.codeMap);
    const parsed = parseScriptText(raw, ctx);
    return parsed.entries.filter(entry => entry.type === 'dialogue').length;
  } catch (err) {
    return raw.split(/\r?\n/).filter(line => line.trim()).length;
  }
}
const ZH_UNNATURAL_XIAO_RE = /小(朝日|爱依|爱衣|冬优子|冬优|真乃|灯织|恋钟|摩美美|咲耶|结华|雾子|智代子|树里|凛世|夏叶|甘奈|甜花|千雪|円香|雏菜|美琴|日花|斑鸠|露卡|羽那|晴辉)(?![子的丝心时姐弟妹孩猫狗屋店车路])/g;
const ZH_IDOL_JIANG_RE = /(朝日|爱依|冬优子|冬优|恋钟|摩美美|咲耶|结华|雾子|智代子|树里|凛世|夏叶|甘奈|甜花|千雪|円香|雏菜|小糸|美琴|日花)ちゃん/g;

function normalizeZhHonorifics(zhText, speakerCharLabel, jaText) {
  let text = String(zhText == null ? '' : zhText);
  if (!text) return text;
  const ja = String(jaText == null ? '' : jaText);
  // Typo guard: 爱依 frequently mistranscribed as 爱衣 in SC context
  text = text.replace(/小爱衣/g, '爱依')
    .replace(/和泉爱衣/g, '和泉爱依')
    .replace(/爱衣(酱|亲|桑)/g, '爱依$1');
  if (!ja || /愛依|めい|Mei/i.test(ja) || /fuyu|冬[优優]|asahi|朝日|straylight|p(?:roducer)?/i.test(String(speakerCharLabel || ''))) {
    text = text.replace(/(?<![喜偏恋可热])爱衣(?![服物裳架柜])/g, '爱依');
  }
  // Eliminate machine-translated 「Xちゃん」 -> 「小X」 (e.g. 小朝日 / 小爱依 / 小冬优)
  text = text.replace(ZH_UNNATURAL_XIAO_RE, (_, name) => (name === '爱衣' ? '爱依' : name));
  // Guarded single-char names when JA source explicitly uses their name
  if (!ja || /透(?:ちゃん|さん)?/.test(ja)) {
    text = text.replace(/(?<![\u4e00-\u9fa5])小透(?![明镜亮澈\u4e00-\u9fa5])/g, '透');
  }
  if (/めぐる|meguru/i.test(ja)) {
    text = text.replace(/(?<![\u4e00-\u9fa5])小巡(?![逻视回查演捕游检警\u4e00-\u9fa5])/g, '巡');
  }
  // Leaked Japanese -ちゃん attached directly to Chinese idol names
  text = text.replace(ZH_IDOL_JIANG_RE, '$1');
  // Stray JP given names left inside Chinese lines
  text = text
    .replace(/あさひちゃん/g, '朝日')
    .replace(/愛依ちゃん/g, '爱依')
    .replace(/(?:冬優子|ふゆ)ちゃん/g, '冬优');
  return text;
}

function buildChineseNormalizePrompt(chineseText) {
  const raw = String(chineseText || '').trim();
  if (!raw) throw new Error('STEP 02 里还没有中文台词');
  return [
    '# 中文台词 · 字幕规范化',
    '',
    '把下面这段中文台词改写成**标准普通话**，用于视频字幕。',
    '',
    '【必须保持不变】',
    '1. 行数完全一致：不增行、不删行、不合并、不拆分。',
    '2. 每行开头的「代码：」或「代码→对象：」原样保留，一个字符都不改。',
    '3. 剧情信息、说话对象、情绪走向不变；只是把说法换成标准普通话。',
    '',
    '【必须改掉】',
    '1. 方言词、地方腔、台湾腔：俺们、咋、啥、整、贼、老铁、倍儿、忒、蛮（作"很"时）、中不中……',
    '2. 网络流行语、梗、缩写：绝绝子、yyds、破防、绷不住、乐、6、xswl……',
    '3. 装饰符号：！ ？ … ～ ♪ ♡ ☆ ——这些交给日语去体现，中文一个都不要留。',
    '3b. 所有假名（あいうえお / アイウエオ）都必须换成中文；角色名用中文译名。原文如果是日文，整段翻成中文。',
    '3c. 称呼自然翻译：日文「～ちゃん」不要直译成生硬的「小＋名字」（禁止写小朝日、小爱依、小冬优等；「福丸小糸」除外），按粉丝汉化习惯直呼「朝日」「爱依」「冬优」；且不要把「和泉爱依」误写成「爱衣」。',
    '4. 翻译腔和长定语：把「他所认为的那个……」这类拆成短句。',
    '',
    '【要求】',
    '- 短、干净、一眼能读完；一句话不超过 22 个字，超了就断成两句（但要合并回同一行）。',
    '- 只保留「，」「。」「、」三种标点。',
    '- 不要加解释、不要输出序号、不要写"改写后："之类的话。',
    '',
    '【原文】',
    '━━━━━━━━━━━━━━━━━━━━',
    raw,
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '现在只输出改写后的中文台词行。'
  ].join('\n');
}

function syncStepAiButtons(scope) {
  const scopes = scope ? [scope] : ['tab2', 'tab3'];
  for (const name of scopes) {
    if (name === 'tab2' && state.tabs.tab2) {
      const plot = String(state.tabs.tab2.plot || $('#t2Plot')?.value || '').trim();
      const chinese = String(state.tabs.tab2.chinese || $('#t2Chinese')?.value || '').trim();
      state.tabs.tab2.step1Disabled = aiBusy || !plot;
      state.tabs.tab2.step2Disabled = aiBusy || !chinese;
    } else if (name === 'tab3' && state.tabs.tab3) {
      const plot = String(state.tabs.tab3.plot || $('#t3Plot')?.value || '').trim();
      state.tabs.tab3.step1Disabled = aiBusy || !plot;
    }
  }
}

async function runTab2ChineseAi(options = {}) {
  if (aiBusy) return null;
  if (options.plot != null) state.tabs.tab2.plot = String(options.plot);
  const plot = String(state.tabs.tab2.plot || '').trim();
  if (!plot || !state.cards.size) return null;
  const customCaller = typeof options.callAI === 'function';
  const caller = customCaller ? options.callAI : callAIWithRetry;
  const cfg = state.ai.config || loadAiConfig();
  if (!customCaller && !aiConfigReady(cfg)) return null;
  const prompt = buildChineseDraftPrompt('tab2');
  const startedAt = Date.now();
  aiBusy = true;
  syncStepAiButtons('tab2');
  try {
    const result = await caller({
      system: AI_SYSTEM_PROMPT_ZH,
      user: prompt,
      maxTokens: 6000,
      temperature: 0.95
    });
    const content = String(result?.content || '').trim();
    if (!content) { const err = new Error('empty content'); err.kind = 'empty'; throw err; }
    let finalContent = content;
    if (state.tabs.tab2.zhClean) {
      finalContent = content.split('\n').map(line => {
        const m = line.match(/^([^：:]{1,48}[：:])([\s\S]*)$/u);
        if (!m) return cleanSubtitleText(line, 'plain');
        const body = cleanSubtitleText(m[2], 'plain');
        return body ? m[1] + body : '';
      }).filter(Boolean).join('\n') || content;
    }
    state.tabs.tab2.chinese = finalContent;
    updateDraftInfo('tab2');
    const elapsed = aiStepElapsed(result, startedAt);
    const lines = countDraftLines(content);
    const tokens = fmtAiTokens(result?.usage);
    state.tabs.tab2.step1Status = `已生成 · ${lines} 行 · ${aiElapsedText(elapsed)} · ${tokens}`;
    state.ai.status = 'connected';
    return result;
  } catch (error) {
    const info = aiErrorInfo(error);
    state.tabs.tab2.step1Status = `失败 · ${info.message}`;
    state.ai.status = 'error';
    return null;
  } finally {
    aiBusy = false;
    syncStepAiButtons('tab2');
  }
}

async function runTab2NormalizeChinese(options = {}) {
  if (aiBusy) return null;
  if (options.chinese != null) state.tabs.tab2.chinese = String(options.chinese);
  const raw = String(state.tabs.tab2.chinese || '').trim();
  if (!raw) return null;
  const customCaller = typeof options.callAI === 'function';
  const caller = customCaller ? options.callAI : callAIWithRetry;
  const cfg = state.ai.config || loadAiConfig();
  if (!customCaller && !aiConfigReady(cfg)) return null;
  const prompt = buildChineseNormalizePrompt(raw);
  aiBusy = true;
  syncStepAiButtons('tab2');
  try {
    const result = await caller({
      system: AI_SYSTEM_PROMPT_ZH,
      user: prompt,
      maxTokens: 6000,
      temperature: 0.3
    });
    const content = String(result?.content || '').trim();
    if (!content) { const err = new Error('empty content'); err.kind = 'empty'; throw err; }
    const before = countDraftLines(raw);
    const after = countDraftLines(content);
    state.tabs.tab2.chinese = content;
    updateDraftInfo('tab2');
    state.tabs.tab2.step2Status = `中文已规范化 · ${before} → ${after} 行${before !== after ? '（行数变了，请检查）' : ''}`;
    return result;
  } catch (error) {
    const info = aiErrorInfo(error);
    state.tabs.tab2.step2Status = `失败 · ${info.message}`;
    return null;
  } finally {
    aiBusy = false;
    syncStepAiButtons('tab2');
  }
}

async function runTab2TranslateAi(options = {}) {
  if (aiBusy) return null;
  if (options.chinese != null) state.tabs.tab2.chinese = String(options.chinese);
  const chinese = String(state.tabs.tab2.chinese || '').trim();
  if (!chinese || !state.cards.size) return null;
  const customCaller = typeof options.callAI === 'function';
  const caller = customCaller ? options.callAI : callAIWithRetry;
  const cfg = state.ai.config || loadAiConfig();
  if (!customCaller && !aiConfigReady(cfg)) return null;
  const prompt = buildTranslationPrompt('tab2', chinese);
  const startedAt = Date.now();
  aiBusy = true;
  syncStepAiButtons('tab2');
  try {
    const result = await caller({
      system: AI_SYSTEM_PROMPT,
      user: prompt,
      maxTokens: 8000,
      temperature: 0.85
    });
    const content = String(result?.content || '').trim();
    if (!content) { const err = new Error('empty content'); err.kind = 'empty'; throw err; }
    state.tabs.tab2.japanese = content;
    updateDraftInfo('tab2');
    const processed = processJapanese('tab2');
    const elapsed = aiStepElapsed(result, startedAt);
    const tokens = fmtAiTokens(result?.usage);
    const lines = processed?.dialogueLineCount || countDraftLines(content);
    state.tabs.tab2.step2Status = `已生成 · ${lines} 行 · ${aiElapsedText(elapsed)} · ${tokens}`;
    state.ai.status = 'connected';
    return result;
  } catch (error) {
    const info = aiErrorInfo(error);
    state.tabs.tab2.step2Status = `失败 · ${info.message}`;
    state.ai.status = 'error';
    return null;
  } finally {
    aiBusy = false;
    syncStepAiButtons('tab2');
  }
}

async function runTab3Ai(options = {}) {
  if (aiBusy) return null;
  if (options.plot != null) state.tabs.tab3.plot = String(options.plot);
  const plot = String(state.tabs.tab3.plot || '').trim();
  if (!plot || !state.cards.size) return null;
  const customCaller = typeof options.callAI === 'function';
  const caller = customCaller ? options.callAI : callAIWithRetry;
  const cfg = state.ai.config || loadAiConfig();
  if (!customCaller && !aiConfigReady(cfg)) return null;
  const prompt = buildOneShotPrompt('tab3');
  const startedAt = Date.now();
  aiBusy = true;
  syncStepAiButtons('tab3');
  try {
    const result = await caller({
      system: AI_SYSTEM_PROMPT,
      user: prompt,
      maxTokens: 8000,
      temperature: 0.85
    });
    const content = String(result?.content || '').trim();
    if (!content) { const err = new Error('empty content'); err.kind = 'empty'; throw err; }
    state.tabs.tab3.japanese = content;
    updateDraftInfo('tab3');
    const processed = processJapanese('tab3');
    const elapsed = aiStepElapsed(result, startedAt);
    const tokens = fmtAiTokens(result?.usage);
    const lines = processed?.dialogueLineCount || countDraftLines(content);
    state.tabs.tab3.step1Status = `已生成 · ${lines} 行 · ${aiElapsedText(elapsed)} · ${tokens}`;
    state.ai.status = 'connected';
    return result;
  } catch (error) {
    const info = aiErrorInfo(error);
    state.tabs.tab3.step1Status = `失败 · ${info.message}`;
    state.ai.status = 'error';
    return null;
  } finally {
    aiBusy = false;
    syncStepAiButtons('tab3');
  }
}



/* ══════════════════════════════════════════════════════════
   PHASE 1 MODULE EXTENSIONS (BILINGUAL / REALTIME / V1+V2 BUNDLE LOADER)
   ══════════════════════════════════════════════════════════ */

function parseBilingualScript(text, ctx) {
  const context = ctx || buildContext(state.cards, state.codeMap);
  const parsed = parseScriptText(text, context);
  inferTargets(parsed.entries, context);
  const pairs = [];
  const dialogues = parsed.entries.filter(e => e.type === 'dialogue');
  let i = 0;
  while (i < dialogues.length) {
    const cur = dialogues[i];
    if (cur.zhText) {
      pairs.push({
        lineNo: cur.lineNo,
        speakerId: cur.speakerId,
        speakerLabel: cur.speakerLabel,
        targetId: cur.targetId,
        ja: cur.content,
        zh: cur.zhText,
        mode: 'inline'
      });
      i += 1;
      continue;
    }
    const curLang = detectScriptLanguage(cur.content);
    const next = dialogues[i + 1];
    if (next && !next.zhText && next.speakerId === cur.speakerId) {
      const nextLang = detectScriptLanguage(next.content);
      if (curLang !== nextLang) {
        pairs.push({
          lineNo: cur.lineNo,
          pairLineNo: next.lineNo,
          speakerId: cur.speakerId,
          speakerLabel: cur.speakerLabel,
          targetId: cur.targetId || next.targetId,
          ja: curLang === 'ja' ? cur.content : next.content,
          zh: curLang === 'zh' ? cur.content : next.content,
          mode: 'adjacent'
        });
        i += 2;
        continue;
      }
    }
    pairs.push({
      lineNo: cur.lineNo,
      speakerId: cur.speakerId,
      speakerLabel: cur.speakerLabel,
      targetId: cur.targetId,
      ja: curLang === 'ja' ? cur.content : '',
      zh: curLang === 'zh' ? cur.content : '',
      mode: 'single'
    });
    i += 1;
  }
  return { ...parsed, pairs };
}

function validateLine(input, speakerRef, options = {}) {
  const ctx = options.ctx || options.context || buildContext(state.cards, state.codeMap);
  const rules = { ...state.rules, ...(options.rules || {}) };
  let rawLine = '';
  let content = '';
  let zhText = '';
  let quoted = false;
  let speakerCard = null;
  let targetCard = null;

  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const bi = _extractInlineBilingual(String(input.text ?? input.content ?? ''));
    content = stripOuterDialogueQuotes(bi.main);
    zhText = String(input._meta?.zh ?? input.zhText ?? input.zh ?? bi.zhText ?? '');
    rawLine = String(input.raw ?? bi.main);
    const spk = speakerRef || input.charLabel || input.speakerId || input.speaker || '';
    if (spk && spk !== 'off') {
      speakerCard = resolveCardReference(spk, ctx.cardsMap, ctx.aliasTable)
        || resolveSpeakerAlias(spk, ctx)?.card
        || null;
    }
    const tgt = options.target || input.targetId || input.target || '';
    if (tgt) targetCard = resolveCardReference(tgt, ctx.cardsMap, ctx.aliasTable) || null;
    quoted = /^\s*『[\s\S]*』\s*$/u.test(bi.main);
  } else {
    rawLine = String(input == null ? '' : input);
    if (speakerRef) {
      speakerCard = resolveCardReference(speakerRef, ctx.cardsMap, ctx.aliasTable)
        || resolveSpeakerAlias(speakerRef, ctx)?.card
        || null;
      const bi = _extractInlineBilingual(rawLine);
      quoted = /^\s*『[\s\S]*』\s*$/u.test(bi.main);
      content = stripOuterDialogueQuotes(bi.main);
      zhText = bi.zhText;
    } else {
      const parsed = parseScriptText(rawLine, ctx);
      inferTargets(parsed.entries, ctx);
      const dial = parsed.entries.find(e => e.type === 'dialogue');
      if (dial) {
        content = dial.content;
        zhText = dial.zhText || '';
        quoted = Boolean(dial.quoted);
        speakerCard = dial.speakerCard || (dial.speakerId ? ctx.cardsMap.get(dial.speakerId) : null);
        targetCard = dial.targetCard || (dial.targetId ? ctx.cardsMap.get(dial.targetId) : null);
        rawLine = dial.rawForGrammar || dial.rawLine || rawLine;
      } else {
        const bi = _extractInlineBilingual(rawLine);
        quoted = /^\s*『[\s\S]*』\s*$/u.test(bi.main);
        content = stripOuterDialogueQuotes(bi.main);
        zhText = bi.zhText;
      }
    }
    if (!targetCard && options.target) {
      targetCard = resolveCardReference(options.target, ctx.cardsMap, ctx.aliasTable) || null;
    }
  }

  const originalText = content;
  const changes = [];
  const warnings = [];
  if (speakerCard && rules.addressReplace) {
    const rep = replaceOtherNamesWithAddresses(content, speakerCard, ctx, true);
    content = rep.content;
    for (const occ of rep.occurrences) {
      if (occ.original !== occ.form) changes.push({ kind: 'address', ...occ });
    }
  }
  if (speakerCard && rules.firstPersonFix && !quoted) {
    const fix = correctFirstPerson(content, speakerCard);
    if (fix.replacements.length) {
      content = fix.text;
      for (const r of fix.replacements) changes.push({ kind: 'firstPerson', ...r });
    }
  }

  const useFullMatrix = options.useFullMatrix !== undefined
    ? Boolean(options.useFullMatrix)
    : Boolean(options.fullAddressMatrix ?? rules.fullAddressMatrix ?? true);
  const hardChecks = speakerCard
    ? lineHardChecks(content, speakerCard, ctx, { skipFirstPerson: quoted, useFullMatrix })
    : [];

  if (looksLikeModelMeta(content)) {
    warnings.push({ type: 'meta', label: '像报错', level: 'error', message: `这行像是模型的说明/报错，不是台词：「${truncate(content, 40)}」` });
  }
  const textBox = textBoxOverflowIssue(content, options.maxTextboxChars ?? MAX_TEXTBOX_CHARS, options.maxTextboxLines ?? MAX_TEXTBOX_LINES);
  if (rules.textBox !== false && textBox.over) {
    warnings.push({ type: 'textbox', label: '框长', level: 'warn', message: textBox.message });
  }
  if (speakerCard) {
    if (rules.length && speakerCard.speech?.avg_len) {
      const shape = cardTextShape(speakerCard);
      const lenIssue = lineLengthIssue(content, shape.len_p90);
      if (lenIssue.over) {
        for (const bad of lenIssue.issues) {
          warnings.push({
            type: 'length', label: '句长', level: 'warn',
            message: `「${truncate(bad.sentence, 30)}」（${bad.len} 字）超过 ${speakerCard.name_short} 的 P90×2 上限 ${bad.limit.toFixed(1)} 字`
          });
        }
      }
    }
    if (rules.endings && speakerCard.speech?.endings?.length) {
      const endIssue = endingIssue(content, speakerCard.speech.endings);
      if (endIssue) {
        warnings.push({
          type: 'endings', label: '句尾', level: 'info',
          message: `「…${truncate(endIssue.first.tail.slice(-12), 12)}」不在 endings 库内`
        });
      }
    }
    const age = ageWordIssue(content, speakerCard);
    if (age) warnings.push(age);
    const variant = variantIssue(content);
    if (variant) warnings.push({ type: 'variant', label: '异体字', level: 'warn', message: variant.message });
    const biRaw = _extractInlineBilingual(rawLine).main;
    for (const g of scanLineGrammar(content, speakerCard, ctx, { rawLine: biRaw, zhText, castIds: options.castIds || null })) {
      warnings.push({ type: g.type, label: g.type, level: g.level, message: g.message });
    }
  }

  const issues = collectAttachedIssues({ hardChecks, warnings });
  const hasError = issues.some(i => i.level === 'error');
  const hasWarn = issues.some(i => i.level === 'warn');
  const consistency = speakerCard ? scoreConsistency(content, speakerCard) : null;
  const speech = estimateLineSpeech(content, speakerCard?.speech?.speed_cps);

  return {
    ok: !hasError,
    hasError,
    hasWarn,
    speakerId: speakerCard?.id || null,
    speakerName: speakerCard?.name_short || null,
    targetId: targetCard?.id || null,
    originalText,
    text: content,
    zhText,
    quoted,
    speech,
    textBox,
    consistency,
    hardChecks,
    warnings,
    issues,
    changes
  };
}

function validateScprojLines(scprojOrLines, options = {}) {
  const rawLines = Array.isArray(scprojOrLines)
    ? scprojOrLines
    : (Array.isArray(scprojOrLines?.lines) ? scprojOrLines.lines : []);
  const ctx = options.ctx || buildContext(state.cards, state.codeMap);
  const lineReports = [];
  const bySpeaker = new Map();
  rawLines.forEach((line, idx) => {
    if (!line || typeof line !== 'object') return;
    const text = String(line.text ?? '');
    if (!text || text === 'off') return;
    const spk = line.charLabel || (line.speaker && line.speaker !== 'off' ? line.speaker : '');
    const diag = validateLine(
      { text, speaker: spk, charLabel: line.charLabel, _meta: line._meta },
      spk,
      { ...options, ctx }
    );
    const oocFlags = diag.issues.map(x => `[${x.level}] ${x.type}: ${x.message}`);
    lineReports.push({
      index: idx,
      uid: line._meta?.uid || null,
      speaker: line.speaker || '',
      charLabel: line.charLabel || '',
      ...diag,
      oocFlags
    });
    if (diag.speakerId) {
      const card = ctx.cardsMap.get(diag.speakerId);
      if (card) {
        if (!bySpeaker.has(card.id)) bySpeaker.set(card.id, { card, texts: [] });
        bySpeaker.get(card.id).texts.push(diag.text);
      }
    }
  });
  const sceneScores = [];
  for (const { card, texts } of bySpeaker.values()) {
    const sc = texts.length >= 2 ? scoreSceneConsistency(texts, card) : null;
    const th = sceneThresholds(texts.length);
    sceneScores.push({
      speakerId: card.id,
      speakerName: card.name_short,
      n: texts.length,
      score: sc,
      thresholds: th,
      tier: sc ? sceneTier(sc.total, th) : sceneTier(null, th)
    });
  }
  return {
    totalDialogueLines: lineReports.length,
    errorCount: lineReports.filter(r => r.hasError).length,
    warnCount: lineReports.filter(r => !r.hasError && r.hasWarn).length,
    lines: lineReports,
    sceneScores
  };
}

function reconstructMergedMarkdown(entry) {
  const id = String(entry?.id || entry?.data?.id || '').trim();
  const data = entry?.data || {};
  const fm = entry?.rawFrontMatter
    ? String(entry.rawFrontMatter).trim()
    : [
        `id: ${id}`,
        `name_jp: ${data.name_jp || id}`,
        `name_cn: ${data.name_cn || data.name_jp || id}`,
        `name_short: ${data.name_short || data.name_jp || id}`,
        `romaji: ${data.romaji || ''}`,
        `kana: ${data.kana || ''}`,
        `code: ${data.code || id}`,
        `line_count: ${data.line_count || 0}`,
        `version: 1`,
        `generated: 2026-11-12`,
        `merged_from: polisher-cards-bundle`
      ].join('\n');
  const h = entry?.headings || {};
  const s = entry?.sections || {};
  const s0 = String(s['0'] ?? `一人称 ${data.speech?.first_person || '—'}`).trim();
  const s1 = String(entry?.rules || s['1'] || '').trim();
  let s2 = String(s['2'] || '').trim();
  let s3 = String(s['3'] || '').trim();
  if (!s2 && entry?.enriched) {
    const rawEnr = String(entry.enriched).replace(/^---\n[\s\S]*?\n---\s*/, '');
    const splitConflict = rawEnr.split(/^##\s*冲突记录\s*$/m);
    s2 = splitConflict[0].replace(/^## /gm, '### ').trim();
    if (!s3 && splitConflict[1]) s3 = splitConflict[1].trim();
  }
  return [
    '---',
    fm,
    '---',
    '',
    `## 0. ${h['0'] || '速览'}`,
    '',
    s0,
    '',
    `## 1. ${h['1'] || '判断规则（LLM 决策依据）'}`,
    '',
    s1,
    '',
    `## 2. ${h['2'] || '人格（状态切换 / 底线 / 语言特征 / few-shot）'}`,
    '',
    s2,
    '',
    `## 3. ${h['3'] || '与原卡的冲突记录（判据：以 verdict 为准）'}`,
    '',
    s3 || '（无）',
    '',
    `## 4. ${h['4'] || `数值层（原样嵌入 data/${id}.json）`}`,
    '',
    '```json',
    JSON.stringify(data, null, 2),
    '```',
    ''
  ].join('\n');
}

function loadCardBundle(bundle, options = {}) {
  const payload = typeof bundle === 'string' ? JSON.parse(bundle) : bundle;
  if (!payload || typeof payload !== 'object') throw new Error('无效的角色卡数据包');
  if (!options.keepInitial && !INITIAL_BUNDLE) INITIAL_BUNDLE = payload;

  if (!options.merge) {
    for (const obj of [MERGED_CARDS, MERGED_PARSED, REAL_CARDS, ENRICHED_CARDS, BUILTIN_RULES]) {
      for (const k of Object.keys(obj)) delete obj[k];
    }
    state.enriched = new Map();
    state.ruleCards = new Map();
  }

  if (payload.calibration) {
    try { applyCalibrationTable(payload.calibration, options.calibrationSource || 'polisher-cards-v1.json'); } catch {}
  }
  if (payload.addressMatrix && typeof payload.addressMatrix === 'object') {
    state.addressMatrix = payload.addressMatrix;
  }
  if (payload.codeMap && typeof payload.codeMap === 'object') {
    for (const [code, target] of Object.entries(payload.codeMap)) {
      state.codeMap.set(cleanCodeKey(code), String(target));
    }
  }

  const cardEntries = [];
  if (payload.cards && typeof payload.cards === 'object' && !Array.isArray(payload.cards)) {
    for (const [id, item] of Object.entries(payload.cards)) {
      if (item && typeof item === 'object') {
        cardEntries.push(item.data ? { ...item, id: item.id || id } : { id, data: item, enriched: payload.enriched?.[id] || '', rules: payload.rules?.[id] || '' });
      }
    }
  } else if (payload.data && typeof payload.data === 'object') {
    for (const [id, data] of Object.entries(payload.data)) {
      cardEntries.push({ id, data, enriched: payload.enriched?.[id] || '', rules: payload.rules?.[id] || '' });
    }
  }

  for (const entry of cardEntries) {
    const id = String(entry.id || entry.data?.id || '').trim();
    if (!id || !entry.data) continue;
    const md = entry.mergedMarkdown || reconstructMergedMarkdown(entry);
    MERGED_CARDS[id] = md;
    const parsed = parseMergedCard(md);
    if (parsed) {
      if (entry.enriched && /^---\n/.test(entry.enriched)) {
        parsed.enrichedText = entry.enriched;
      }
      MERGED_PARSED[id] = parsed;
      REAL_CARDS[id] = parsed.data;
      ENRICHED_CARDS[id] = parsed.enrichedText;
      BUILTIN_RULES[id] = parsed.rulesBody;
    }
  }

  const built = buildMockCards();
  const map = options.merge ? new Map(state.cards) : new Map();
  for (const c of built) map.set(c.id, c);
  state.cards = map;
  seedMergedLayers();
  state.sourceKind = options.sourceKind || 'bundle-v1';
  state.sourceLabel = options.sourceLabel || `数据包 v${payload.schemaVersion || 1}（${map.size} 角色）`;
  ensureFocusValid();
  ensureCastSets();
  return { count: map.size, ids: Array.from(map.keys()) };
}

async function loadCardBundleFromUrl(url, options = {}) {
  const fetchImpl = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalRoot) : null);
  if (!fetchImpl) throw new Error('当前环境不支持 fetch');
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  const json = await res.json();
  return loadCardBundle(json, options);
}

function _adaptV2PersonaToV1Entry(id, rawPersona, markdownText = '') {
  const p = rawPersona && typeof rawPersona === 'object' ? rawPersona : {};
  const cid = String(p.id || id || '').trim();
  const baseExisting = REAL_CARDS[cid] ? deepClone(REAL_CARDS[cid]) : {};
  const invariants = p.speech_invariants || p.core_speech_invariants || p.invariants || {};
  const speechSrc = p.speech || baseExisting.speech || {};
  const data = {
    ...baseExisting,
    id: cid,
    name_jp: p.name_jp || p.name || baseExisting.name_jp || cid,
    name_short: p.name_short || p.short_name || baseExisting.name_short || p.name_jp || cid,
    name_cn: p.name_cn || p.name_zh || baseExisting.name_cn || p.name_jp || cid,
    romaji: p.romaji || baseExisting.romaji || cid,
    kana: p.kana || baseExisting.kana || '',
    surname: p.surname || baseExisting.surname || '',
    surname_kana: p.surname_kana || baseExisting.surname_kana || '',
    code: p.code || baseExisting.code || cid,
    line_count: asNumber(p.line_count ?? invariants.line_count ?? baseExisting.line_count, 100),
    speech: {
      ...speechSrc,
      first_person: invariants.first_person ?? speechSrc.first_person ?? '',
      first_person_rate: asRate(invariants.first_person_rate ?? speechSrc.first_person_rate, 0.1),
      avg_len: asNumber(invariants.avg_len ?? speechSrc.avg_len, 18),
      speed_cps: asNumber(invariants.speed_cps ?? speechSrc.speed_cps, BASELINE_CPS),
      keigo_rate: asRate(invariants.keigo_rate ?? speechSrc.keigo_rate, 0.05),
      exclaim_rate: asRate(invariants.exclaim_rate ?? speechSrc.exclaim_rate, 0.15),
      ellipsis_rate: asRate(invariants.ellipsis_rate ?? speechSrc.ellipsis_rate, 0.3),
      endings: speechSrc.endings || invariants.endings || invariants.sentence_endings || [],
      interjections: speechSrc.interjections || invariants.interjections || [],
      hedges: speechSrc.hedges || invariants.hedges || []
    },
    symbols: p.symbols || baseExisting.symbols || {},
    address: p.address || invariants.address || invariants.addresses || baseExisting.address || {},
    traits: p.traits || baseExisting.traits || {},
    by_category: p.by_category || baseExisting.by_category || {},
    few_shot: p.few_shot || p.sample_lines || baseExisting.few_shot || [],
    textshape: p.textshape || p.text_shape || baseExisting.textshape || {}
  };

  // Synthesize enriched & rules from v2 persona JSON/MD if not explicitly provided
  let rules = String(p.rules || p.judgementRules || '').trim();
  if (!rules) {
    const ruleLines = [];
    if (p.interlocutor_shifts || p.interlocutor_matrix) {
      ruleLines.push('### A. 状态判定（对人切换矩阵 v2）');
      ruleLines.push(typeof (p.interlocutor_shifts || p.interlocutor_matrix) === 'string'
        ? (p.interlocutor_shifts || p.interlocutor_matrix)
        : JSON.stringify(p.interlocutor_shifts || p.interlocutor_matrix, null, 2));
    }
    if (p.era_slices || p.eras) {
      ruleLines.push('### B. 时期切片（W.I.N.G. / LP / S.T.E.P.）');
      ruleLines.push(typeof (p.era_slices || p.eras) === 'string'
        ? (p.era_slices || p.eras)
        : JSON.stringify(p.era_slices || p.eras, null, 2));
    }
    if (invariants.anti_patterns || p.ooc_anti_patterns) {
      ruleLines.push('### F. 禁忌（OOC 反模式）');
      const ap = invariants.anti_patterns || p.ooc_anti_patterns;
      ruleLines.push(Array.isArray(ap) ? ap.map((x, idx) => `${idx + 1}. ${typeof x === 'string' ? x : JSON.stringify(x)}`).join('\n') : String(ap));
    }
    rules = ruleLines.join('\n\n') || BUILTIN_RULES[cid] || '### A. 状态判定\n- 按 v2 人设卡语境保持角色口吻。';
  }

  let s2 = '';
  let s3 = '';
  if (p.enriched && /^---\n/.test(p.enriched)) {
    return { id: cid, data, rules, enriched: p.enriched, sections: { '0': `一人称 ${data.speech.first_person || '—'}`, '2': p.enriched, '3': '' } };
  }
  const switchBody = p.subtext_rules || p.mode_switch || p.status_switch || markdownText || '';
  const floorBody = p.red_lines || p.floor || (Array.isArray(invariants.anti_patterns) ? invariants.anti_patterns.join('\n- ') : '');
  const tipsBody = p.writing_tips || (p.stage_habits ? JSON.stringify(p.stage_habits) : '');
  const conflictsBody = p.conflicts ? (typeof p.conflicts === 'string' ? p.conflicts : JSON.stringify(p.conflicts, null, 2)) : '';
  s2 = [
    '### 状态切换（最高优先级）',
    String(switchBody || BUILTIN_RULES[cid] || '按场景与对话对象切换表层/本音语气。'),
    '',
    '### 底线 / 不会做的事',
    String(floorBody || '遵守角色核心人设与人称/称呼不变量。'),
    ...(tipsBody ? ['', '### 写作提示', String(tipsBody)] : [])
  ].join('\n');
  s3 = conflictsBody;

  const enriched = `---\nid: ${cid}\nname_jp: ${data.name_jp}\nenriched: cards_v2\n---\n\n${s2.replace(/^### /gm, '## ')}\n`
    + (s3 ? `\n## 冲突记录\n${s3}\n` : '');

  return {
    id: cid,
    data,
    rules,
    enriched,
    sections: { '0': `一人称 ${data.speech.first_person || '—'}`, '2': s2, '3': s3 }
  };
}

function loadCardsV2(v2Payload, options = {}) {
  const payload = typeof v2Payload === 'string' ? JSON.parse(v2Payload) : v2Payload;
  if (!payload || typeof payload !== 'object') throw new Error('无效的 cards_v2 数据');
  const merge = options.merge !== undefined ? Boolean(options.merge) : true;
  const rawPersonas = payload.personas || payload.characters || payload.cards || {};
  const markdownMap = payload.personaMarkdown || {};
  const adaptedCards = {};

  if (Array.isArray(rawPersonas)) {
    for (const item of rawPersonas) {
      if (item && (item.id || item.charId)) {
        const id = item.id || item.charId;
        adaptedCards[id] = _adaptV2PersonaToV1Entry(id, item, markdownMap[id] || '');
      }
    }
  } else {
    for (const [id, item] of Object.entries(rawPersonas)) {
      if (item && typeof item === 'object') {
        adaptedCards[id] = _adaptV2PersonaToV1Entry(id, item, markdownMap[id] || '');
      }
    }
  }

  if (payload.units && typeof payload.units === 'object') {
    for (const [uKey, uVal] of Object.entries(payload.units)) {
      state.unitsV2.set(uKey, uVal);
    }
  }
  if (payload.houseStyle || payload.sc_house_style) {
    state.houseStyleV2 = String(payload.houseStyle || payload.sc_house_style);
  }

  // Register codes for newly added v2 characters (e.g. tsutomu -> tsu / tsutomu)
  const extraCodeMap = { ...(payload.codeMap || {}) };
  for (const [id, entry] of Object.entries(adaptedCards)) {
    const code = cleanCodeKey(entry.data.code || id);
    if (code && !state.codeMap.has(code) && !extraCodeMap[code]) {
      extraCodeMap[code] = entry.data.name_short || entry.data.name_jp || id;
    }
  }

  return loadCardBundle(
    {
      schemaVersion: 2,
      cards: adaptedCards,
      codeMap: extraCodeMap,
      calibration: payload.calibration || null,
      addressMatrix: payload.addressMatrix || null
    },
    {
      merge,
      keepInitial: true,
      sourceKind: 'cards-v2',
      sourceLabel: options.sourceLabel || `cards_v2（${Object.keys(adaptedCards).length} 角色更新）`
    }
  );
}

function loadCardsV2FromDir(dirPath, options = {}) {
  if (typeof require !== 'function') throw new Error('loadCardsV2FromDir 仅支持 Node.js 环境');
  const fsMod = require('fs');
  const pathMod = require('path');
  const resolvedDir = dirPath || (typeof __dirname === 'string' ? pathMod.resolve(__dirname, '../../../taibon/cards_v2') : '');
  const personasDir = pathMod.join(resolvedDir, 'personas');
  const unitsDir = pathMod.join(resolvedDir, 'units');
  const payload = { personas: {}, personaMarkdown: {}, units: {}, houseStyle: '' };
  const housePath = pathMod.join(resolvedDir, 'sc_house_style.md');
  if (fsMod.existsSync(housePath)) {
    payload.houseStyle = fsMod.readFileSync(housePath, 'utf8');
  }
  if (fsMod.existsSync(personasDir)) {
    for (const name of fsMod.readdirSync(personasDir)) {
      const full = pathMod.join(personasDir, name);
      if (name.endsWith('.json')) {
        const id = name.replace(/\.json$/i, '');
        payload.personas[id] = JSON.parse(fsMod.readFileSync(full, 'utf8'));
      } else if (name.endsWith('.md')) {
        const id = name.replace(/\.md$/i, '');
        payload.personaMarkdown[id] = fsMod.readFileSync(full, 'utf8');
      }
    }
  }
  if (fsMod.existsSync(unitsDir)) {
    for (const name of fsMod.readdirSync(unitsDir)) {
      if (name.endsWith('.json')) {
        const u = name.replace(/\.json$/i, '');
        payload.units[u] = JSON.parse(fsMod.readFileSync(pathMod.join(unitsDir, name), 'utf8'));
      }
    }
  }
  return loadCardsV2(payload, options);
}

function enableCardsV2(dirPath, options = {}) {
  return loadCardsV2FromDir(dirPath, { merge: true, ...options });
}

// Auto-bootstrap built-in v1 bundle in Node.js or Browser if preloaded
(function autoBootstrapBundle() {
  try {
    if (globalRoot && globalRoot.SC_POLISHER_BUNDLE && typeof globalRoot.SC_POLISHER_BUNDLE === 'object') {
      loadCardBundle(globalRoot.SC_POLISHER_BUNDLE, { silent: true });
      return;
    }
  } catch (err) { /* ignore */ }
  try {
    if (typeof module === 'object' && module.exports && typeof require === 'function' && typeof __dirname === 'string') {
      const fsMod = require('fs');
      const pathMod = require('path');
      const bundlePath = pathMod.join(__dirname, 'polisher-cards-v1.json');
      if (fsMod.existsSync(bundlePath)) {
        const raw = JSON.parse(fsMod.readFileSync(bundlePath, 'utf8'));
        loadCardBundle(raw, { silent: true });
      }
    }
  } catch (err) { /* browser bundler without fs */ }
})();

const ScPolisher = {
  BUILD_INFO,
  STORAGE_KEYS,
  SCENE_TYPES,
  DEFAULT_CODE_MAP,
  RULE_DEFS,
  DEFAULT_RULES,
  BASELINE_CPS,
  MAX_TEXTBOX_CHARS,
  MAX_TEXTBOX_LINES,
  REQUIRED_SYMBOLS,
  DECO_SYMBOLS,
  HONORIFICS,
  SPEAKER_HONORIFICS,
  FIRST_PERSON_FORMS,
  FIRST_PERSON_FIX_FORMS,
  FIRST_PERSON_FAMILY,
  TRAIT_PATTERNS,
  MOCK_META,
  TEXT_SHAPE_BY_ID,
  ADDRESS_OVERRIDES,
  RARE_ADDRESS_RULES,
  OOC_ANTI_PATTERN_RULES,
  CALIBRATION_BUCKETS,
  DEFAULT_CALIBRATION,
  SEVERITY_DEFS,
  ADULT_WORD_AGE,
  ADULT_WORK_WORDS,
  DIALECT_RULES,
  TTS_FORMATS,
  SAMPLE_SCRIPT,
  MERGED_CARDS,
  MERGED_PARSED,
  REAL_CARDS,
  ENRICHED_CARDS,
  BUILTIN_RULES,
  state,

  // Card & Bundle Loaders (v1 + v2)
  loadCardBundle,
  loadCardBundleFromUrl,
  loadCardsV2,
  loadCardsV2FromDir,
  enableCardsV2,
  reconstructMergedMarkdown,
  parseFrontMatter,
  parseMergedCard,
  builtinRuleCard,
  seedMergedLayers,
  parseRuleCard,
  isRulesCandidateFile,
  isMergedCardText,
  isMergedCandidateFile,
  loadMergedCards,
  loadRuleFiles,
  parseEnrichedMarkdown,
  enrichedSection,
  compressEnrichedSection,
  buildEnrichedProfileBlock,
  looksLikeEnrichedCard,
  isEnrichedCandidateFile,
  applyEnrichedOverride,
  loadEnrichedOverrides,
  normalizeEndingList,
  normalizeFormList,
  normalizeAddress,
  normalizeCard,
  extractCardRecords,
  loadRecords,
  buildMockCards,
  useBuiltInMock,
  sortedCards,
  parseCodeTable,
  codeMapToText,

  // Parser & Context
  buildContext,
  getCardAliases,
  buildAliasTable,
  resolveCardReference,
  resolveSpeakerAlias,
  resolveSpeakerPrefix,
  primaryCodeForCard,
  parseScriptText,
  parseBilingualScript,
  inferTargets,
  quickParse,

  // Hard Rules, Address Matrix, Grammar & Real-time Single-line / Scproj Validators
  lookupAddressMatrix,
  findAddressEntry,
  addressDecision,
  addressFormAccepted,
  applyAddressOverrides,
  replaceOtherNamesWithAddresses,
  scanAddressUsage,
  isRareAddressForm,
  scanRareAddressUsage,
  scanOocAntiPatterns,
  firstPersonIssue,
  correctFirstPerson,
  endingIssue,
  lineLengthIssue,
  textBoxOverflowIssue,
  estimateLineSpeech,
  calcTraitQuota,
  ageWordIssue,
  variantIssue,
  registerMixInfo,
  detectDialect,
  dialectLine,
  looksLikeModelMeta,
  scanLineGrammar,
  collectCharacterMentions,
  adjacentMentionPairs,
  findConsecutiveRepeats,
  lineTruncationIssues,
  lineHardChecks,
  lineWarnInfo,
  severityOf,
  severityLabel,
  collectAttachedIssues,
  collectLineIssues,
  countSeverityCounts,
  buildTraitQuotaReport,
  buildSymbolReport,
  analyzeScriptText,
  validateLine,
  validateScprojLines,

  // 6D Distribution Consistency Scorer & Calibration
  cardTextShape,
  calibrationTable,
  normalizeCalibrationTable,
  applyCalibrationTable,
  nearestCalibrationSize,
  calibrationForSize,
  sceneThresholds,
  sceneReferenceText,
  sceneTier,
  calibrationDimension,
  scoreSceneConsistency,
  scoreConsistency,
  buildSceneScoreModel,
  getResultConsistencySummary,
  resultHasJapaneseKana,

  // Prompt Assembly (2a, 2b, Tab1 AI, Rules, Profile)
  sceneTypeStats,
  buildRulesPromptBlock,
  buildUnitDynamicsPromptBlock,
  buildHouseStylePromptBlock,
  buildCardGlanceHTML,
  renderRulesPreviewHTML,
  renderRulesPreview,
  cardLengthProfile,
  symbolQuotaLine,
  buildProfileText,
  buildAddressMatrix,
  buildQuotaBlock,
  buildSkeletonBlock,
  addressAndRulesBlock,
  buildOutputFormat,
  buildChineseDraftPrompt,
  buildChineseNormalizePrompt,
  normalizeZhHonorifics,
  buildTranslationPrompt,
  buildOneShotPrompt,
  buildAiTranslationPrompt,
  buildAiPolishPrompt,
  detectPlotCast,
  autoSelectPlotCast,
  clearScopeCast,
  ensureCastSets,
  defaultCastSet,
  ensureFocusValid,

  // Subtitle, Shorthand, Notes, Reading & TTS Export
  cleanSubtitleText,
  setSubCleanMode,
  getSubCleanMode,
  subtitleLines,
  buildSubtitleText,
  buildSubtitleViewHTML,
  buildShorthandLines,
  buildShorthandText,
  buildNotesText,
  buildNotesHTML,
  buildReadingDictionary,
  convertNamesToKana,
  ttsSpeedForCard,
  ttsEstimateSec,
  detectSpeechMode,
  buildTTSModel,
  buildTTSExport,
  ttsFormatMeta,
  loadTtsConfig,
  saveTtsConfig,
  ttsVoiceFor,
  applyVoiceTextFix,
  buildNameReadingRules,
  applyTtsReplace,

  // Address Fix Plan & Headless Workbench / AI Helpers
  addressErrorLines,
  buildAddressFixPlan,
  applyAddressFixes,
  startAddressFix,
  chooseAddressFix,
  undoTab1Ai,
  runTab1,
  processJapanese,
  generatePrompt1,
  generatePrompt2,
  syncStepAiButtons,
  updateDraftInfo,
  expandWorkbench,
  countDraftLines,
  runTab2ChineseAi,
  runTab2NormalizeChinese,
  runTab2TranslateAi,
  runTab3Ai,
  callAI,
  callAIWithRetry,
  parseAiResponse,
  aiErrorInfo,
  aiNormalizeBaseUrl,
  aiEndpointOf,
  stripCodeFence,
  detectScriptLanguage,
  kanaRatio,
  loadAiConfig,
  saveAiConfig,
  clearAiConfig,
  aiConfigReady,
  AI_STORAGE_KEY,
  AI_BASE_DEFAULT,
  AI_MODEL_DEFAULT,
  AI_TIMEOUT_MS,
  AI_SYSTEM_PROMPT,
  AI_SYSTEM_PROMPT_ZH,
  safeStorageGet,
  safeStorageSet,
  safeStorageRemove,
  fmtPct,
  fmtSec,
  truncate
};

ScPolisher.default = ScPolisher;
return ScPolisher;

});
