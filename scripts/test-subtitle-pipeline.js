const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  buildNormalizedPayload,
} = require("./normalize-subtitle-transcript");
const {
  renderSingleFile,
} = require("./render-lesson-ready-transcript");

const fixturesDir = path.join(__dirname, "test-fixtures");

function readFixture(fileName) {
  return fs.readFileSync(path.join(fixturesDir, fileName), "utf8");
}

function withTempDir(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "subtitle-pipeline-"));
  try {
    run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testBasicSrt() {
  const payload = buildNormalizedPayload(path.join(fixturesDir, "basic-srt.srt"));
  assert.equal(payload.source.subtitle_format, "srt");
  assert.equal(payload.stats.rawCueCount, 2);
  assert.equal(payload.stats.cleanedUtteranceCount, 2);
  assert.equal(payload.stats.droppedNoiseCount, 1);
  assert.ok(payload.paragraphs[0].includes("Hello there."));
}

function testRollingVtt() {
  const payload = buildNormalizedPayload(path.join(fixturesDir, "rolling-vtt.vtt"));
  assert.equal(payload.source.subtitle_format, "vtt");
  assert.equal(payload.stats.rawCueCount, 3);
  assert.equal(payload.stats.cleanedUtteranceCount, 2);
  assert.ok(
    payload.cleaned_utterances[0].text.includes("1796 at the height of the French"),
    "rolling VTT should retain the full incremental cue text"
  );
}

function testMultilineVtt() {
  const payload = buildNormalizedPayload(path.join(fixturesDir, "multiline-vtt.vtt"));
  assert.equal(payload.source.subtitle_format, "vtt");
  assert.ok(
    payload.cleaned_utterances[0].text.includes("Hello there. General Kenobi."),
    "non-rolling multiline VTT should preserve both lines"
  );
}

function testBasicAss() {
  const payload = buildNormalizedPayload(path.join(fixturesDir, "basic-ass.ass"));
  assert.equal(payload.source.subtitle_format, "ass");
  assert.equal(payload.stats.cleanedUtteranceCount, 2);
  assert.ok(
    payload.cleaned_utterances[0].text.includes("This is styled text and a second line."),
    "ASS parser should strip override tags and line breaks"
  );
}

function testRenderFromNormalized() {
  withTempDir((tempDir) => {
    const normalizedPath = path.join(tempDir, "rolling-vtt.normalized-subtitle.json");
    const payload = buildNormalizedPayload(path.join(fixturesDir, "rolling-vtt.vtt"));
    fs.writeFileSync(normalizedPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    const summary = renderSingleFile(normalizedPath, {
      emitTxt: false,
      outputDir: tempDir,
      track: "article_reading",
    });

    assert.ok(fs.existsSync(summary.markdown), "render stage should create markdown output");
    const markdown = fs.readFileSync(summary.markdown, "utf8");
    assert.ok(markdown.includes("## Cleaned Text"));
    assert.ok(markdown.includes("track: article_reading"));
  });
}

function main() {
  testBasicSrt();
  testRollingVtt();
  testMultilineVtt();
  testBasicAss();
  testRenderFromNormalized();
  console.log("Subtitle pipeline tests passed.");
}

main();
