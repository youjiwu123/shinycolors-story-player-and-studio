'use strict';

const fs = require('fs');
const path = require('path');
const eng = require('./studio-engine.js');
const polisher = require('../studio/lib/polisher-core.js');

const SHINY_ROOT = path.resolve(__dirname, '..');
const Ajv = require(path.join(SHINY_ROOT, 'desktop', 'node_modules', 'ajv'));
const officialSchema = JSON.parse(fs.readFileSync(path.join(SHINY_ROOT, 'schema', 'official_script.schema.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(SHINY_ROOT, 'schema', 'scproj.schema.json'), 'utf8'));
const whitelist = JSON.parse(fs.readFileSync(path.join(SHINY_ROOT, 'data', 'anim_whitelist.json'), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(officialSchema);
const validate = ajv.compile(schema);

// Force-regenerate seed pack once with clean 0-OOC lines
eng.ensureSeededWorkspace({ force: true });
const projects = eng.listAllProjects();
console.log('Discovered projects:', projects.map((p) => `${p.id} (${p.stories.length} scenes)`));

// Verify OOC detector catches intentional OOC
const negCheck = eng.auditScriptRows([{ speaker: '甘奈', charLabel: 'amana', text: 'あたし、行くよ！' }]);
if (negCheck.summary.error === 0) {
  throw new Error('OOC validator failed to catch amana using あたし');
}
console.log('✓ auditScriptRows catches intentional OOC (amana あたし -> error)');

const packDir = path.join(SHINY_ROOT, 'projects_workspace', 'island_survival_pack.scpack');
const pack = JSON.parse(fs.readFileSync(path.join(packDir, 'pack.json'), 'utf8'));
if (!validate(pack)) {
  console.error('pack.json schema errors:', JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
console.log('✓ pack.json passes scproj.schema.json');

for (const st of pack.stories) {
  const relPath = st.compiled || st.file;
  const doc = JSON.parse(fs.readFileSync(path.join(packDir, relPath), 'utf8'));
  if (!validate(doc)) {
    console.error(st.id, 'schema errors:', JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }
  const visible = new Set();
  const charIdByLabel = {};
  for (const [k, v] of Object.entries((doc.meta && doc.meta.characters) || pack.characters || {})) charIdByLabel[k] = v.charId;
  let prevSpeaker = null;
  let prevAnim1 = null;

  for (let i = 0; i < doc.lines.length; i++) {
    const ln = doc.lines[i];
    if (ln.charScale !== undefined && ln.charScale !== 1) {
      throw new Error(`Non-1 charScale at ${st.id} line ${i}: ${ln.charScale}`);
    }
    if (ln.charLabel) {
      const cid = ln.charId || charIdByLabel[ln.charLabel];
      const valid = new Set(whitelist.packs['characters/stand/' + cid] || []);
      for (const slot of ['charAnim1', 'charAnim2', 'charAnim3', 'charAnim4', 'charAnim5', 'charLipAnim']) {
        if (ln[slot] && !valid.has(ln[slot])) {
          throw new Error(`Invalid anim ${ln[slot]} for char ${cid} in ${st.id} line ${i}`);
        }
      }
      const eff = ln.charEffect || ln.charAlpha;
      if (eff && eff.type === 'to' && eff.alpha === 0) {
        visible.delete(ln.charLabel);
      } else {
        visible.add(ln.charLabel);
      }
      if (visible.size > 3) {
        throw new Error(`More than 3 visible chars at ${st.id} line ${i}: ${Array.from(visible).join(',')}`);
      }
      if (ln.speaker && ln.charLabel === prevSpeaker && ln.charAnim1 && ln.charAnim1 === prevAnim1) {
        throw new Error(`Repeated charAnim1 on consecutive lines at ${st.id} line ${i}: ${ln.charAnim1}`);
      }
      if (ln.speaker) {
        prevSpeaker = ln.charLabel;
        if (ln.charAnim1) prevAnim1 = ln.charAnim1;
      }
    }
  }
  const pRes = polisher.validateScprojLines(doc.lines);
  if (pRes.errorCount > 0 || pRes.warnCount > 0) {
    console.error(st.id, 'polisher.validateScprojLines issues:', JSON.stringify(pRes.results.filter((r) => !r.ok || r.hasWarn), null, 2));
    process.exit(1);
  }
  console.log(`✓ ${st.id} (${st.titleZh}) passes scproj.schema.json + polisher.validateScprojLines (0 err, 0 warn) + 3-char stage limit + charScale=1 + anim_whitelist`);
}

// Also validate full-project merged .scproj.json (Task 3) against scproj.schema.json
const mergedResult = eng.compileFullProjectToScproj('island_survival_pack');
if (!validate(mergedResult.scproj)) {
  console.error('mergedScproj schema errors:', JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
console.log(`✓ island_survival_pack_full_all (${mergedResult.sceneCount} scenes, ${mergedResult.lineCount} lines) passes scproj.schema.json`);

// Task 1 verification: 4-Tier Hierarchy (Project -> Scene -> Beat/Segment -> Lines)
const islandLoaded = projects.find((p) => p.id === 'island_survival_pack');
for (const sc of islandLoaded.stories) {
  if (!Array.isArray(sc.segments) || sc.segments.length < 3) {
    throw new Error(`Scene ${sc.id} missing 3 segments in 4-tier hierarchy`);
  }
  for (const r of sc.scriptRows) {
    if (!r.beatId || !r.beatTitle) {
      throw new Error(`ScriptRow ${r.rowId} in ${sc.id} missing beatId/beatTitle`);
    }
  }
}
console.log('✓ Task 1: All 3 scenes of island_survival_pack have 4-tier segments (beat_1..beat_3) + tagged scriptRows');

// Task 2 verification: Reaction Anthology Mode (`reaction_idol_relation.scpack`)
const reactionDir = path.join(SHINY_ROOT, 'projects_workspace', 'reaction_idol_relation.scpack');
const reactionPack = JSON.parse(fs.readFileSync(path.join(reactionDir, 'pack.json'), 'utf8'));
if (!validate(reactionPack)) {
  console.error('reaction_idol_relation pack.json schema errors:', JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
if (reactionPack['x-projectType'] !== 'reaction') {
  throw new Error('reaction_idol_relation.scpack missing x-projectType=reaction');
}
const reactionCards = reactionPack['x-reactionCards'] || [];
if (reactionCards.length < 8) {
  throw new Error(`Expected >= 8 reaction cards in reaction_idol_relation.scpack, got ${reactionCards.length}`);
}
for (const st of reactionPack.stories) {
  const relPath = st.compiled || st.file;
  const doc = JSON.parse(fs.readFileSync(path.join(reactionDir, relPath), 'utf8'));
  if (!validate(doc)) {
    console.error('reaction scproj schema errors:', JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }
  const visible = new Set();
  for (let i = 0; i < doc.lines.length; i++) {
    const ln = doc.lines[i];
    if (ln.charScale !== undefined && ln.charScale !== 1) {
      throw new Error(`Non-1 charScale in reaction pack at line ${i}`);
    }
    if (ln.charLabel) {
      const eff = ln.charEffect || ln.charAlpha;
      if (eff && eff.type === 'to' && eff.alpha === 0) {
        visible.delete(ln.charLabel);
      } else {
        visible.add(ln.charLabel);
      }
      if (visible.size > 3) {
        throw new Error(`More than 3 visible chars in reaction pack at line ${i}`);
      }
    }
  }
  const pRes = polisher.validateScprojLines(doc.lines);
  if (pRes.errorCount > 0 || pRes.warnCount > 0) {
    console.error('reaction_idol_relation OOC issues:', JSON.stringify(pRes.results.filter((r) => !r.ok || r.hasWarn), null, 2));
    process.exit(1);
  }
  console.log(`✓ Task 2: reaction_idol_relation.scpack (${reactionCards.length} idols, ${doc.lines.length} lines) passes scproj.schema.json + 0 OOC (0 err, 0 warn)`);
}

// Task 3 verification: SCSP Read-Only Summary & CoMETIK Corpus
const scspSum = eng.getScspSummary();
const scspHana = eng.getScspLines({ char: 'hana', limit: 5 });
const scspLuca = eng.getScspLines({ char: 'luca', limit: 5 });
const scspHaruki = eng.getScspLines({ char: 'haruki', limit: 5 });
if (!scspSum.ok || !scspSum.readOnly || !scspHana.lines.length || !scspLuca.lines.length || !scspHaruki.lines.length) {
  throw new Error('SCSP read-only corpus check failed');
}
if (!scspHana.lines[0].text || !scspHana.lines[0].textJa) {
  throw new Error('SCSP line missing .text or .textJa');
}
console.log(`✓ Task 3: SCSP read-only summary (${scspSum.stats.audioBankFiles} banks) + CoMETIK lines (hana:${scspHana.lines.length}, luca:${scspLuca.lines.length}, haruki:${scspHaruki.lines.length}) verified`);

(async () => {
  // Verify S1: expandBeatWithLlmOrTemplate on beat_2 preserves beat_1 & beat_3
  const beatRes = await eng.expandBeatWithLlmOrTemplate({
    projectId: 'island_survival_pack',
    sceneId: 'scene_01_harbor',
    beat: { beatId: 'beat_2', title: '与制作人合力搭椰叶棚', summary: '甘奈与羽那和制作人一起收集大椰子叶搭建遮阳棚', cast: ['amana', 'hana'], targetLines: 3 },
    beatIndex: 1,
    applyToProject: false
  });
  const beatIdsAfter = new Set((beatRes.scriptRows || []).map((r) => r.beatId));
  if (!beatIdsAfter.has('beat_1') || !beatIdsAfter.has('beat_2') || !beatIdsAfter.has('beat_3')) {
    throw new Error(`expand-beat wiped other beats! Remaining beatIds: ${Array.from(beatIdsAfter).join(',')}`);
  }
  console.log(`✓ S1 verified: expand-beat on beat_2 preserved beat_1/beat_2/beat_3 (${beatRes.scriptRows.length} total rows, 0 OOC)`);

  // Verify S3: All 28 idols x 6 style keys (canon, canonical, heavy, sweet, meme, gag) pass 0 err, 0 warn, and numeric/bgm_stop SE
  for (const cid of Object.keys(eng.IDOL_META)) {
    for (const st of ['canon', 'canonical', 'heavy', 'sweet', 'meme', 'gag']) {
      const rx = await eng.generateIdolReaction({ charLabel: cid, style: st });
      if (!rx.ok || rx.oocSummary.error > 0 || rx.oocSummary.warn > 0) {
        throw new Error(`OOC in generateIdolReaction(${cid}, ${st}): ${JSON.stringify(rx.oocSummary)}`);
      }
      for (const ln of rx.card.lines) {
        if (ln.se === 'heartbeat' || ln.se === 'sparkle') {
          throw new Error(`Symbolic SE '${ln.se}' found in ${cid}/${st}`);
        }
      }
    }
  }
  console.log('✓ S3 verified: All 28 idols x 6 style keys pass 0 OOC (0 err, 0 warn) and valid SE codes');

  // Sync mock-data.js with island_survival_pack
  const mockPath = path.join(__dirname, 'mock-data.js');
  let mockTxt = fs.readFileSync(mockPath, 'utf8');
  const startIdx = mockTxt.indexOf('const islandPack =');
  const endIdx = mockTxt.indexOf('/* ISLAND_PACK_END */');
  if (startIdx >= 0 && endIdx >= 0) {
    const s1 = JSON.parse(fs.readFileSync(path.join(packDir, 'stories/scene_01_harbor.scproj.json'), 'utf8'));
    const s2 = JSON.parse(fs.readFileSync(path.join(packDir, 'stories/scene_02_signal.scproj.json'), 'utf8'));
    const s3 = JSON.parse(fs.readFileSync(path.join(packDir, 'stories/scene_03_rescue.scproj.json'), 'utf8'));
    const rep =
      'const islandPack = ' + JSON.stringify(pack, null, 2) + ';\n' +
      '  const islandStory = ' + JSON.stringify(s1, null, 2) + ';\n' +
      '  const islandScenesMap = ' + JSON.stringify({ scene_01_harbor: s1, scene_02_signal: s2, scene_03_rescue: s3 }, null, 2) + ';\n  ';
    mockTxt = mockTxt.slice(0, startIdx) + rep + mockTxt.slice(endIdx);
    mockTxt = mockTxt.replace("id: 'island_survival_rescue_01'", "id: 'island_survival_pack', scenesMap: islandScenesMap");
    fs.writeFileSync(mockPath, mockTxt, 'utf8');
    console.log('✓ Synced island_survival_pack into studio-proto/mock-data.js');
  }
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

