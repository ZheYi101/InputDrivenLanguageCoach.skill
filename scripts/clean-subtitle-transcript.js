const fs = require("fs");
const path = require("path");

const SUPPORTED_EXTENSIONS = new Set([".srt", ".vtt", ".ass", ".ssa"]);

function parseTimestamp(timestamp) {
  const match = timestamp
    .trim()
    .match(/^(?:(?<hours>\d{2,}):)?(?<minutes>\d{2}):(?<seconds>\d{2})[,.](?<millis>\d{3})$/);

  if (!match || !match.groups) {
    return null;
  }

  const hours = Number(match.groups.hours || "0");
  const minutes = Number(match.groups.minutes);
  const seconds = Number(match.groups.seconds);
  const millis = Number(match.groups.millis);

  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

function parseTimeLine(timeLine) {
  if (!timeLine.includes("-->")) {
    return null;
  }

  const [startRaw, endAndSettingsRaw] = timeLine.split("-->");
  const endRaw = endAndSettingsRaw.trim().split(/\s+/)[0];
  const start = parseTimestamp(startRaw);
  const end = parseTimestamp(endRaw);

  if (start === null || end === null) {
    return null;
  }

  return { start, end };
}

function isIgnorableNoise(text) {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === "[music]" ||
    normalized === "(music)" ||
    normalized === "[applause]" ||
    normalized === "(applause)" ||
    normalized === "[laughter]" ||
    normalized === "(laughter)"
  );
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripCueMarkup(text) {
  return decodeHtmlEntities(
    text
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, " ")
      .replace(/<\/?c(?:\.[^>]*)?>/gi, " ")
      .replace(/<v\s+([^>]+)>/gi, "$1: ")
      .replace(/<\/v>/gi, " ")
      .replace(/<\/?(?:i|b|u|ruby|rt|lang)[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function stripAssMarkup(text) {
  return decodeHtmlEntities(
    text
      .replace(/\{[^}]*\}/g, " ")
      .replace(/\\N/gi, " ")
      .replace(/\\n/gi, " ")
      .replace(/\\h/gi, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function buildRollingCueText(normalizedLines) {
  let currentText = normalizedLines[0] || "";

  for (let index = 1; index < normalizedLines.length; index += 1) {
    currentText = mergeTexts(currentText, normalizedLines[index]);
  }

  return currentText;
}

function normalizeCueText(lines) {
  const usesRollingMarkup = lines.some(
    (line) =>
      /<\d{2}:\d{2}:\d{2}\.\d{3}>/.test(line) || /<\/?c(?:\.[^>]*)?>/i.test(line)
  );

  const normalizedLines = lines
    .map((line) => stripCueMarkup(line))
    .filter(Boolean);

  if (normalizedLines.length === 0) {
    return "";
  }

  if (usesRollingMarkup && normalizedLines.length > 1) {
    return buildRollingCueText(normalizedLines);
  }

  return normalizedLines.join(" ").replace(/\s+/g, " ").trim();
}

function endsWithStrongStop(text) {
  return /[.!?]["')\]]*$/.test(text);
}

function endsWithSoftStop(text) {
  return /[,;:]["')\]]*$/.test(text);
}

function startsWithContinuation(text) {
  return /^(and|but|so|because|if|when|which|that|to|or|then|than|as|while|though|although|unless|until|for|with|without|where|who|whose|whom|what|how)\b/i.test(
    text
  );
}

function tokenizeForOverlap(text) {
  return text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function findLeadingWordOverlap(previousText, currentText) {
  const previousWords = tokenizeForOverlap(previousText);
  const currentWords = tokenizeForOverlap(currentText);
  const maxOverlap = Math.min(previousWords.length, currentWords.length);

  for (let size = maxOverlap; size >= 1; size -= 1) {
    const previousSlice = previousWords
      .slice(previousWords.length - size)
      .join(" ")
      .toLowerCase();
    const currentSlice = currentWords
      .slice(0, size)
      .join(" ")
      .toLowerCase();

    if (previousSlice === currentSlice) {
      return size;
    }
  }

  return 0;
}

function removeLeadingOverlap(previousText, currentText) {
  if (!previousText) {
    return currentText;
  }

  const previousLower = previousText.toLowerCase();
  const currentLower = currentText.toLowerCase();

  if (previousLower.endsWith(currentLower)) {
    return "";
  }

  const overlapSize = findLeadingWordOverlap(previousText, currentText);
  if (overlapSize === 0) {
    return currentText;
  }

  return tokenizeForOverlap(currentText).slice(overlapSize).join(" ").trim();
}

function shouldMergeAcrossCues(previousText, currentText) {
  if (!previousText) {
    return false;
  }

  if (endsWithStrongStop(previousText)) {
    return false;
  }

  if (endsWithSoftStop(previousText)) {
    return true;
  }

  if (/^[a-z]/.test(currentText)) {
    return true;
  }

  if (startsWithContinuation(currentText)) {
    return true;
  }

  const previousWordCount = previousText.split(/\s+/).filter(Boolean).length;
  return previousWordCount <= 4 && /^[a-zA-Z]/.test(currentText);
}

function mergeTexts(previousText, currentText) {
  const incrementalText = removeLeadingOverlap(previousText, currentText);
  if (!incrementalText) {
    return previousText;
  }

  return `${previousText} ${incrementalText}`.replace(/\s+/g, " ").trim();
}

function formatSeconds(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(Math.floor(totalSeconds % 60)).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function parseAssTimestamp(timestamp) {
  const match = timestamp
    .trim()
    .match(/^(?<hours>\d+):(?<minutes>\d{2}):(?<seconds>\d{2})\.(?<centis>\d{2})$/);

  if (!match || !match.groups) {
    return null;
  }

  const hours = Number(match.groups.hours);
  const minutes = Number(match.groups.minutes);
  const seconds = Number(match.groups.seconds);
  const centis = Number(match.groups.centis);

  return hours * 3600 + minutes * 60 + seconds + centis / 100;
}

function extractSourceId(fileName) {
  const match = fileName.match(/\[([A-Za-z0-9_-]+)\](?=[^\[]*$)/);
  if (match) {
    return match[1];
  }

  return path
    .parse(fileName)
    .name
    .replace(/(?:\.[a-z]{2}(?:-[A-Za-z]+)?)+$/i, "");
}

function toAsciiLabel(text) {
  return text.replace(/[^\x20-\x7E]+/g, " ").replace(/\s+/g, " ").trim();
}

function buildParagraphs(utterances) {
  return buildParagraphRecords(utterances).map((paragraph) => paragraph.text);
}

function buildParagraphRecords(utterances) {
  const paragraphs = [];
  let current = [];
  let currentWordCount = 0;

  for (let index = 0; index < utterances.length; index += 1) {
    const utterance = utterances[index];
    const previous = index > 0 ? utterances[index - 1] : null;
    const gap = previous ? utterance.start - previous.end : 0;

    if (current.length > 0 && gap >= 8) {
      paragraphs.push({
        start: current[0].start,
        end: current[current.length - 1].end,
        text: current.map((item) => item.text).join(" "),
        wordCount: currentWordCount,
      });
      current = [];
      currentWordCount = 0;
    }

    current.push(utterance);
    currentWordCount += utterance.text.split(/\s+/).filter(Boolean).length;

    if (currentWordCount >= 85 && endsWithStrongStop(utterance.text)) {
      paragraphs.push({
        start: current[0].start,
        end: current[current.length - 1].end,
        text: current.map((item) => item.text).join(" "),
        wordCount: currentWordCount,
      });
      current = [];
      currentWordCount = 0;
      continue;
    }

    if (currentWordCount >= 140) {
      paragraphs.push({
        start: current[0].start,
        end: current[current.length - 1].end,
        text: current.map((item) => item.text).join(" "),
        wordCount: currentWordCount,
      });
      current = [];
      currentWordCount = 0;
    }
  }

  if (current.length > 0) {
    paragraphs.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      text: current.map((item) => item.text).join(" "),
      wordCount: currentWordCount,
    });
  }

  return paragraphs;
}

function detectSubtitleFormat(rawText, inputPath = "") {
  const extension = path.extname(inputPath).toLowerCase();
  if (extension === ".vtt") {
    return "vtt";
  }

  if (extension === ".ass") {
    return "ass";
  }

  if (extension === ".ssa") {
    return "ssa";
  }

  if (/^\uFEFF?WEBVTT\b/i.test(rawText.trimStart())) {
    return "vtt";
  }

  return "srt";
}

function parseAssDialogueFields(content, formatFields) {
  const expectedFieldCount = formatFields.length;
  const values = [];
  let remaining = content;

  for (let index = 0; index < expectedFieldCount - 1; index += 1) {
    const commaIndex = remaining.indexOf(",");
    if (commaIndex === -1) {
      values.push(remaining.trim());
      remaining = "";
    } else {
      values.push(remaining.slice(0, commaIndex).trim());
      remaining = remaining.slice(commaIndex + 1);
    }
  }

  values.push(remaining.trim());
  return values;
}

function buildParsedUtterancesFromAss(rawText) {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  let inEventsSection = false;
  let eventFormat = null;
  const parsedUtterances = [];
  let droppedNoiseCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (/^\[events\]$/i.test(line)) {
      inEventsSection = true;
      continue;
    }

    if (/^\[.+\]$/.test(line) && !/^\[events\]$/i.test(line)) {
      inEventsSection = false;
      continue;
    }

    if (!inEventsSection) {
      continue;
    }

    if (/^format:/i.test(line)) {
      eventFormat = line
        .replace(/^format:/i, "")
        .split(",")
        .map((field) => field.trim().toLowerCase());
      continue;
    }

    if (!/^dialogue:/i.test(line) || !eventFormat) {
      continue;
    }

    const values = parseAssDialogueFields(
      line.replace(/^dialogue:/i, "").trim(),
      eventFormat
    );
    if (values.length !== eventFormat.length) {
      continue;
    }

    const fieldMap = Object.fromEntries(
      eventFormat.map((field, index) => [field, values[index]])
    );
    const start = parseAssTimestamp(fieldMap.start || "");
    const end = parseAssTimestamp(fieldMap.end || "");
    if (start === null || end === null) {
      continue;
    }

    const text = stripAssMarkup(fieldMap.text || "");
    if (!text || isIgnorableNoise(text)) {
      droppedNoiseCount += 1;
      continue;
    }

    parsedUtterances.push({ start, end, text });
  }

  return {
    parsedUtterances,
    droppedNoiseCount,
  };
}

function buildParsedUtterancesFromSrtOrVtt(rawText) {
  const blocks = rawText.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const parsedUtterances = [];
  let droppedNoiseCount = 0;

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      continue;
    }

    let pointer = 0;

    if (/^\d+$/.test(lines[pointer])) {
      pointer += 1;
    }

    if (
      !lines[pointer]?.includes("-->") &&
      lines[pointer + 1]?.includes("-->")
    ) {
      pointer += 1;
    }

    const timeLine = lines[pointer];
    if (!timeLine || !timeLine.includes("-->")) {
      continue;
    }

    const parsedTime = parseTimeLine(timeLine);
    if (!parsedTime) {
      continue;
    }

    const textLines = lines.slice(pointer + 1);
    if (textLines.length === 0) {
      continue;
    }

    const text = normalizeCueText(textLines);
    if (!text || isIgnorableNoise(text)) {
      droppedNoiseCount += 1;
      continue;
    }

    parsedUtterances.push({
      start: parsedTime.start,
      end: parsedTime.end,
      text,
    });
  }

  return {
    parsedUtterances,
    droppedNoiseCount,
  };
}

function cleanSubtitle(rawText, options = {}) {
  const format = options.format || "srt";
  const parsed =
    format === "ass" || format === "ssa"
      ? buildParsedUtterancesFromAss(rawText)
      : buildParsedUtterancesFromSrtOrVtt(rawText);
  const parsedUtterances = parsed.parsedUtterances;
  let droppedNoiseCount = parsed.droppedNoiseCount;

  const cleanedUtterances = [];
  let dedupedCount = 0;
  let mergedCueCount = 0;

  for (const utterance of parsedUtterances) {
    const previous = cleanedUtterances[cleanedUtterances.length - 1];
    if (!previous) {
      cleanedUtterances.push({ ...utterance });
      continue;
    }

    if (previous.text.toLowerCase() === utterance.text.toLowerCase()) {
      previous.end = utterance.end;
      dedupedCount += 1;
      continue;
    }

    const overlapSize = findLeadingWordOverlap(previous.text, utterance.text);
    const incrementalText = removeLeadingOverlap(previous.text, utterance.text);
    if (!incrementalText) {
      previous.end = utterance.end;
      dedupedCount += 1;
      continue;
    }

    if (
      (
        overlapSize > 0 &&
        !endsWithStrongStop(previous.text)
      ) ||
      shouldMergeAcrossCues(previous.text, incrementalText)
    ) {
      previous.text = mergeTexts(previous.text, incrementalText);
      previous.end = utterance.end;
      mergedCueCount += 1;
      continue;
    }

    cleanedUtterances.push({
      ...utterance,
      text: incrementalText,
    });
  }

  return {
    cleanedUtterances,
    paragraphRecords: buildParagraphRecords(cleanedUtterances),
    paragraphs: buildParagraphs(cleanedUtterances),
    stats: {
      format,
      rawCueCount: parsedUtterances.length,
      cleanedUtteranceCount: cleanedUtterances.length,
      dedupedCount,
      mergedCueCount,
      droppedNoiseCount,
      start: cleanedUtterances[0]?.start ?? 0,
      end: cleanedUtterances[cleanedUtterances.length - 1]?.end ?? 0,
    },
  };
}

function buildMarkdown(metadata, paragraphs, stats) {
  const lines = [
    "# Lesson-Ready Transcript",
    "",
    `- input_type: transcript`,
    `- track: ${metadata.track || "live_chat"}`,
    `- material_type: ${metadata.materialType || "subtitle_transcript"}`,
    `- title: ${metadata.title}`,
    `- source_id: ${metadata.sourceId}`,
    `- source_label: ${metadata.sourceLabel}`,
    `- cleaned_span: ${formatSeconds(stats.start)}-${formatSeconds(stats.end)}`,
    `- cleaning_summary: ${metadata.cleaningSummary || "removed subtitle indices, timestamps, and subtitle markup; merged wrapped lines; merged likely cross-cue continuations; dropped exact duplicate cue repeats where present"}`,
    "",
    "## Cleaned Text",
    "",
  ];

  for (const paragraph of paragraphs) {
    lines.push(paragraph);
    lines.push("");
  }

  lines.push("## Cleaning Stats");
  lines.push("");
  lines.push(`- subtitle_format: ${stats.format}`);
  lines.push(`- raw_cues: ${stats.rawCueCount}`);
  lines.push(`- cleaned_utterances: ${stats.cleanedUtteranceCount}`);
  lines.push(`- merged_cross_cue_continuations: ${stats.mergedCueCount}`);
  lines.push(`- removed_exact_repeats: ${stats.dedupedCount}`);
  lines.push(`- dropped_noise_cues: ${stats.droppedNoiseCount}`);
  lines.push("");

  return `${lines.join("\n").trimEnd()}\n`;
}

function stripSubtitleExtension(fileName) {
  return fileName.replace(/(?:\.[a-z]{2}(?:-[A-Za-z]+)?)?\.(?:srt|vtt)$/i, "");
}

function isSupportedSubtitleFile(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function sortPaths(paths) {
  return [...paths].sort((left, right) => left.localeCompare(right, "en"));
}

function collectFilesFromDirectory(directoryPath, recursive) {
  const files = [];

  for (const entry of sortPaths(fs.readdirSync(directoryPath))) {
    const resolvedEntry = path.join(directoryPath, entry);
    const stat = fs.statSync(resolvedEntry);

    if (stat.isDirectory()) {
      if (recursive) {
        files.push(...collectFilesFromDirectory(resolvedEntry, recursive));
      }
      continue;
    }

    if (stat.isFile() && isSupportedSubtitleFile(resolvedEntry)) {
      files.push(resolvedEntry);
    }
  }

  return files;
}

function readManifest(manifestPath) {
  const manifestDir = path.dirname(manifestPath);
  return fs
    .readFileSync(manifestPath, "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) =>
      path.isAbsolute(line) ? line : path.resolve(manifestDir, line)
    );
}

function collectInputFiles(cliOptions) {
  const collected = [];
  const seen = new Set();

  function addFile(filePath) {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Input does not exist: ${resolvedPath}`);
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      for (const nestedFile of collectFilesFromDirectory(
        resolvedPath,
        cliOptions.recursive
      )) {
        addFile(nestedFile);
      }
      return;
    }

    if (!isSupportedSubtitleFile(resolvedPath)) {
      return;
    }

    if (!seen.has(resolvedPath)) {
      seen.add(resolvedPath);
      collected.push(resolvedPath);
    }
  }

  if (cliOptions.manifestPath) {
    for (const manifestEntry of readManifest(cliOptions.manifestPath)) {
      addFile(manifestEntry);
    }
  }

  for (const inputPath of cliOptions.inputPaths) {
    addFile(inputPath);
  }

  if (collected.length === 0) {
    throw new Error("No subtitle files found to clean.");
  }

  return collected;
}

function parseCliArgs(argv) {
  const cliOptions = {
    emitTxt: false,
    inputPaths: [],
    outputDir: null,
    manifestPath: null,
    recursive: false,
    track: "live_chat",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--output-dir") {
      cliOptions.outputDir = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--manifest") {
      cliOptions.manifestPath = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--emit-txt") {
      cliOptions.emitTxt = true;
      continue;
    }

    if (arg === "--track") {
      cliOptions.track = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--recursive") {
      cliOptions.recursive = true;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    cliOptions.inputPaths.push(arg);
  }

  if (cliOptions.inputPaths.length === 0 && !cliOptions.manifestPath) {
    throw new Error(
      "Usage: node scripts/clean-subtitle-transcript.js [--track live_chat|article_reading] [--output-dir dir] [--manifest file.txt] [--recursive] <input-file-or-dir> [more-inputs]"
    );
  }

  if (
    cliOptions.track !== "live_chat" &&
    cliOptions.track !== "article_reading"
  ) {
    throw new Error(`Unsupported track: ${cliOptions.track}`);
  }

  return cliOptions;
}

function cleanSingleFile(inputPath, cliOptions) {
  const resolvedInput = path.resolve(inputPath);
  const inputFileName = path.basename(resolvedInput);
  const stem = stripSubtitleExtension(inputFileName);
  const outputBaseDir = cliOptions.outputDir
    ? path.resolve(cliOptions.outputDir)
    : path.dirname(resolvedInput);
  const basePrefix = path.join(outputBaseDir, stem);

  ensureDirectory(outputBaseDir);

  const rawText = fs.readFileSync(resolvedInput, "utf8");
  const format = detectSubtitleFormat(rawText, resolvedInput);
  const result = cleanSubtitle(rawText, { format });
  const sourceId = extractSourceId(inputFileName);
  const sourceLabel = toAsciiLabel(stem) || sourceId;
  const markdown = buildMarkdown(
    {
      title: stem,
      sourceId,
      sourceLabel,
      track: cliOptions.track,
      materialType: "subtitle_transcript",
    },
    result.paragraphs,
    result.stats
  );
  const plainText = `${result.paragraphs.join("\n\n").trim()}\n`;
  const markdownPath = `${basePrefix}.lesson-ready.en.md`;
  fs.writeFileSync(markdownPath, markdown, "utf8");

  let plainTextPath = null;
  if (cliOptions.emitTxt) {
    plainTextPath = `${basePrefix}.lesson-ready.en.txt`;
    fs.writeFileSync(plainTextPath, plainText, "utf8");
  }

  return {
    input: resolvedInput,
    plain_text: plainTextPath,
    markdown: markdownPath,
    track: cliOptions.track,
    raw_cues: result.stats.rawCueCount,
    cleaned_utterances: result.stats.cleanedUtteranceCount,
    merged_cross_cue_continuations: result.stats.mergedCueCount,
    removed_exact_repeats: result.stats.dedupedCount,
    dropped_noise_cues: result.stats.droppedNoiseCount,
  };
}

function main() {
  try {
    const cliOptions = parseCliArgs(process.argv.slice(2));
    const inputFiles = collectInputFiles(cliOptions);
    const summaries = inputFiles.map((inputPath) =>
      cleanSingleFile(inputPath, cliOptions)
    );

    for (const summary of summaries) {
      if (summary.plain_text) {
        console.log(`Wrote ${summary.plain_text}`);
      }
      console.log(`Wrote ${summary.markdown}`);
    }

    console.log(JSON.stringify(summaries, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildMarkdown,
  cleanSubtitle,
  cleanSrt: cleanSubtitle,
  detectSubtitleFormat,
  extractSourceId,
  formatSeconds,
  main,
  stripSubtitleExtension,
  toAsciiLabel,
};
