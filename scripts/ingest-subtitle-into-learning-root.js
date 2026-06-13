const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const {
  buildMarkdown,
  cleanSubtitle,
  detectSubtitleFormat,
  extractSourceId,
  formatSeconds,
  stripSubtitleExtension,
  toAsciiLabel,
} = require("./clean-subtitle-transcript");

const SUPPORTED_EXTENSIONS = new Set([".srt", ".vtt", ".ass", ".ssa"]);
const NORMALIZED_SUFFIX = /\.normalized-subtitle(?:\.[a-z]{2}(?:-[A-Za-z]+)?)?\.json$/i;

function utcNowIso() {
  return new Date().toISOString();
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function endsWithStrongStop(text) {
  return /[.!?]["')\]]*$/.test(text);
}

function clipSummary(text, limit = 160) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) {
    return compact;
  }

  return `${compact.slice(0, limit - 1).trimEnd()}...`;
}

function summarizeLiveChatSegment(text, index) {
  const lower = text.toLowerCase();
  if (
    lower.includes("youtube") &&
    lower.includes("twitch") &&
    (
      lower.includes("get along") ||
      lower.includes("cellmates") ||
      lower.includes("behind the bars") ||
      lower.includes("introduce them to each other")
    )
  ) {
    return "Opening dual-stream setup where chat platforms are framed as needing to get along.";
  }

  if (lower.includes("house") || lower.includes("mortgage") || lower.includes("save money")) {
    return "Practical tangent about money, housing, and stream-related upgrades.";
  }

  if (
    lower.includes("illustrations") ||
    lower.includes("artist") ||
    lower.includes("subathon")
  ) {
    return "Planning segment about art commissions, stream events, and pending rewards.";
  }

  if (
    lower.includes("support everyone") ||
    lower.includes("be nice") ||
    lower.includes("penguins")
  ) {
    return "Community-values segment focused on friendliness and audience culture.";
  }

  const firstSentence = text.match(/.*?[.!?](?:\s|$)/);
  const fallback = firstSentence ? firstSentence[0].trim() : clipSummary(text, 120);
  return `Live-chat segment ${String(index).padStart(2, "0")}: ${fallback}`;
}

function summarizeArticleSegment(text, index) {
  const firstSentence = text.match(/.*?[.!?](?:\s|$)/);
  if (firstSentence) {
    return `Argument unit ${String(index).padStart(2, "0")}: ${clipSummary(firstSentence[0].trim(), 150)}`;
  }

  return `Argument unit ${String(index).padStart(2, "0")}: ${clipSummary(text, 150)}`;
}

function summarizeSegment(text, track, index) {
  if (track === "article_reading") {
    return summarizeArticleSegment(text, index);
  }

  return summarizeLiveChatSegment(text, index);
}

function startsWithTopicShift(text) {
  return /^(anyway|also|yeah,\s*so|okay|wait|but|pilates|what kind of games|there's an ankh test|are streams this time of day)/i.test(
    text
  );
}

function shouldSplitLiveChat(current, currentWords, nextParagraph, gapSeconds) {
  return (
    current.length > 0 &&
    (
      currentWords >= 460 ||
      (
        currentWords >= 340 &&
        (
          current.length >= 4 ||
          gapSeconds >= 40 ||
          (startsWithTopicShift(nextParagraph.text) && current.length >= 4)
        )
      ) ||
      (
        currentWords >= 260 &&
        gapSeconds >= 90
      )
    )
  );
}

function shouldSplitArticle(current, currentWords, gapSeconds) {
  return (
    current.length > 0 &&
    (
      currentWords >= 560 ||
      (currentWords >= 340 && current.length >= 3) ||
      (currentWords >= 260 && current.length >= 2 && gapSeconds >= 20)
    )
  );
}

function buildSegments(paragraphRecords, options) {
  const segments = [];
  let current = [];
  let currentWords = 0;

  for (let index = 0; index < paragraphRecords.length; index += 1) {
    const paragraph = paragraphRecords[index];
    const previous = current[current.length - 1];
    const gapSeconds = previous ? paragraph.start - previous.end : 0;
    const shouldSplit =
      options.track === "article_reading"
        ? shouldSplitArticle(current, currentWords, gapSeconds)
        : shouldSplitLiveChat(current, currentWords, paragraph, gapSeconds);

    if (shouldSplit) {
      segments.push(current);
      current = [];
      currentWords = 0;
    }

    current.push(paragraph);
    currentWords += paragraph.wordCount;
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments.map((group, index) => {
    const text = group.map((paragraph) => paragraph.text).join("\n\n");
    return {
      segmentIndex: index + 1,
      start: group[0].start,
      end: group[group.length - 1].end,
      startRef: formatSeconds(group[0].start),
      endRef: formatSeconds(group[group.length - 1].end),
      wordCount: countWords(text),
      text,
      sceneSummary: summarizeSegment(text, options.track, index + 1),
    };
  });
}

function buildSegmentMarkdown(segment, previousSummary, nextSummary, track) {
  const lines = [
    "# Transcript Segment",
    "",
    `- track: ${track}`,
    `- segment_index: ${segment.segmentIndex}`,
    `- start_ref: ${segment.startRef}`,
    `- end_ref: ${segment.endRef}`,
    `- scene_or_argument_summary: ${segment.sceneSummary}`,
    `- context_before_summary: ${previousSummary}`,
    `- context_after_summary: ${nextSummary}`,
    "",
    "## Text",
    "",
    segment.text,
    "",
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

function copyFile(sourcePath, targetPath) {
  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function removeExistingSegmentFiles(segmentsDir, sourceId) {
  if (!fs.existsSync(segmentsDir)) {
    return;
  }

  for (const fileName of fs.readdirSync(segmentsDir)) {
    if (fileName.startsWith(`${sourceId}--seg-`)) {
      fs.unlinkSync(path.join(segmentsDir, fileName));
    }
  }
}

function readJson(jsonPath) {
  return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
}

function writeJson(jsonPath, payload) {
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function upsertSource(database, source) {
  database.prepare(
    `
    INSERT INTO sources (
      id, language, material_type, track, title, source_url, creator,
      raw_path, cleaned_path, imported_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      language = excluded.language,
      material_type = excluded.material_type,
      track = excluded.track,
      title = excluded.title,
      source_url = excluded.source_url,
      creator = excluded.creator,
      raw_path = excluded.raw_path,
      cleaned_path = excluded.cleaned_path,
      imported_at = excluded.imported_at,
      status = excluded.status
    `
  ).run(
    source.id,
    source.language,
    source.materialType,
    source.track,
    source.title,
    source.sourceUrl,
    source.creator,
    source.rawPath,
    source.cleanedPath,
    source.importedAt,
    source.status
  );
}

function replaceSegments(database, sourceId, materialType, track, segments) {
  database.prepare("DELETE FROM segments WHERE source_id = ?").run(sourceId);

  const statement = database.prepare(
    `
    INSERT INTO segments (
      id, source_id, material_type, track, segment_index, segment_path,
      start_ref, end_ref, context_before_summary, context_after_summary,
      scene_or_argument_summary, created_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const previousSummary =
      index > 0
        ? segments[index - 1].sceneSummary
        : track === "article_reading"
          ? "Opening of the source argument."
          : "Stream opening.";
    const nextSummary =
      index < segments.length - 1
        ? segments[index + 1].sceneSummary
        : track === "article_reading"
          ? "End of the current source argument sequence."
          : "Segment sequence ends here.";

    statement.run(
      crypto.randomUUID(),
      sourceId,
      materialType,
      track,
      segment.segmentIndex,
      segment.segmentPath,
      segment.startRef,
      segment.endRef,
      previousSummary,
      nextSummary,
      segment.sceneSummary,
      utcNowIso(),
      "ready"
    );
  }
}

function getTrackProfileUpdate(track) {
  if (track === "article_reading") {
    return {
      baselineSummary: "Learning profile initialized from cleaned reading-style subtitle transcript imports.",
      priorities: [
        "argument comprehension",
        "written connector accuracy",
        "claim-support mapping",
        "summary paraphrase precision",
      ],
    };
  }

  return {
    baselineSummary: "Learning profile initialized from cleaned live-chat transcript imports.",
    priorities: [
      "live_chat chunk integrity",
      "spoken scene management",
      "dual-platform chat humor",
    ],
  };
}

function updateLearnerProfile(profilePath, track, sourceSummary) {
  const profile = readJson(profilePath);
  const existing = profile.language_profiles?.en;
  if (!existing) {
    return;
  }

  const trackUpdate = getTrackProfileUpdate(track);
  existing.track_bias = Array.from(new Set([track, ...(existing.track_bias || [])]));
  existing.recent_priorities = Array.from(
    new Set([...(trackUpdate.priorities || []), ...(existing.recent_priorities || [])])
  ).slice(0, 6);
  existing.last_updated_at = utcNowIso();
  existing.baseline_summary = existing.baseline_summary || trackUpdate.baselineSummary;

  profile.updated_at = utcNowIso();
  profile.last_imported_source = sourceSummary;
  writeJson(profilePath, profile);
}

function sortPaths(paths) {
  return [...paths].sort((left, right) => left.localeCompare(right, "en"));
}

function isSupportedSubtitleFile(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isSupportedNormalizedFile(filePath) {
  return NORMALIZED_SUFFIX.test(path.basename(filePath));
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

    if (
      stat.isFile() &&
      (
        isSupportedSubtitleFile(resolvedEntry) ||
        isSupportedNormalizedFile(resolvedEntry)
      )
    ) {
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

    if (
      !isSupportedSubtitleFile(resolvedPath) &&
      !isSupportedNormalizedFile(resolvedPath)
    ) {
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
    throw new Error("No subtitle files found to ingest.");
  }

  return collected;
}

function parseCliArgs(argv) {
  const cliOptions = {
    creator: null,
    emitTxt: false,
    inputPaths: [],
    learningRoot: null,
    manifestPath: null,
    recursive: false,
    sourceUrl: null,
    title: null,
    track: "live_chat",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--learning-root") {
      cliOptions.learningRoot = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--track") {
      cliOptions.track = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--creator") {
      cliOptions.creator = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--source-url") {
      cliOptions.sourceUrl = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--title") {
      cliOptions.title = argv[index + 1];
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

    if (arg === "--recursive") {
      cliOptions.recursive = true;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    cliOptions.inputPaths.push(arg);
  }

  if (!cliOptions.learningRoot) {
    throw new Error(
      "Usage: node scripts/ingest-subtitle-into-learning-root.js --learning-root <dir> [--track live_chat|article_reading] [--creator name] [--manifest file.txt] [--recursive] <input-file-or-dir> [more-inputs]"
    );
  }

  if (
    cliOptions.track !== "live_chat" &&
    cliOptions.track !== "article_reading"
  ) {
    throw new Error(`Unsupported track: ${cliOptions.track}`);
  }

  if (cliOptions.inputPaths.length === 0 && !cliOptions.manifestPath) {
    throw new Error("Provide at least one subtitle file, directory, or manifest.");
  }

  return cliOptions;
}

function buildDefaultTitle(stem, sourceId, track) {
  if (track === "article_reading") {
    return stem || `Article-style subtitle transcript [${sourceId}]`;
  }

  return stem || `Live chat transcript [${sourceId}]`;
}

function loadNormalizedPayload(inputPath) {
  const resolvedInput = path.resolve(inputPath);
  const payload = JSON.parse(fs.readFileSync(resolvedInput, "utf8"));
  if (payload?.kind !== "normalized_subtitle_transcript") {
    throw new Error(`Unsupported normalized payload: ${resolvedInput}`);
  }
  return payload;
}

function buildIngestSourceDataFromInput(inputPath) {
  const resolvedInput = path.resolve(inputPath);

  if (isSupportedNormalizedFile(resolvedInput)) {
    const payload = loadNormalizedPayload(resolvedInput);
    return {
      sourceId: payload.source?.source_id || extractSourceId(path.basename(resolvedInput)),
      stem:
        payload.source?.stem ||
        stripSubtitleExtension(payload.source?.file_name || "") ||
        path.basename(resolvedInput).replace(NORMALIZED_SUFFIX, ""),
      sourceLabel:
        payload.source?.source_label ||
        toAsciiLabel(payload.source?.stem || "") ||
        extractSourceId(path.basename(resolvedInput)),
      subtitleFormat: payload.source?.subtitle_format || "unknown",
      cleaned: {
        cleanedUtterances: payload.cleaned_utterances || [],
        paragraphRecords: payload.paragraph_records || [],
        paragraphs: payload.paragraphs || [],
        stats: payload.stats || {},
      },
      rawInputPath: payload.source?.input_path || null,
      normalizedInputPath: resolvedInput,
      cleaningSummary:
        payload.cleaning_summary ||
        "removed subtitle indices, timestamps, and subtitle markup; merged wrapped lines; merged likely cross-cue continuations; dropped exact duplicate cue repeats where present",
    };
  }

  const inputFileName = path.basename(resolvedInput);
  const rawText = fs.readFileSync(resolvedInput, "utf8");
  const format = detectSubtitleFormat(rawText, resolvedInput);
  const cleaned = cleanSubtitle(rawText, { format });
  const stem = stripSubtitleExtension(inputFileName);
  const sourceId = extractSourceId(inputFileName);

  return {
    sourceId,
    stem,
    sourceLabel: toAsciiLabel(stem) || sourceId,
    subtitleFormat: format,
    cleaned,
    rawInputPath: resolvedInput,
    normalizedInputPath: null,
    cleaningSummary:
      "removed subtitle indices, timestamps, and subtitle markup; merged wrapped lines; merged likely cross-cue continuations; dropped exact duplicate cue repeats where present",
  };
}

function ingestSingleFile(inputPath, cliOptions) {
  const resolvedInput = path.resolve(inputPath);
  const resolvedRoot = path.resolve(cliOptions.learningRoot);
  const coachDir = path.join(resolvedRoot, ".language-coach");
  const dbPath = path.join(coachDir, "state.db");

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Missing learning root DB: ${dbPath}`);
  }

  const sourceData = buildIngestSourceDataFromInput(resolvedInput);
  const sourceId = sourceData.sourceId;
  const stem = sourceData.stem;
  const sourceLabel = sourceData.sourceLabel;
  const title = cliOptions.title || buildDefaultTitle(stem, sourceId, cliOptions.track);
  const creator = cliOptions.creator;
  const cleaned = sourceData.cleaned;
  const segments = buildSegments(cleaned.paragraphRecords, {
    track: cliOptions.track,
  });
  const rawInputPath = sourceData.rawInputPath;
  const rawExtension = rawInputPath
    ? path.extname(rawInputPath).toLowerCase()
    : ".txt";
  let rawTargetPath = null;
  if (rawInputPath && fs.existsSync(rawInputPath)) {
    rawTargetPath = path.join(
      resolvedRoot,
      "languages",
      "en",
      "raw",
      `${sourceId}.en${rawExtension}`
    );
  }
  const cleanedMarkdownPath = path.join(
    resolvedRoot,
    "languages",
    "en",
    "cleaned",
    `${sourceId}.lesson-ready.en.md`
  );
  const segmentsDir = path.join(resolvedRoot, "languages", "en", "segments");

  if (rawTargetPath) {
    copyFile(rawInputPath, rawTargetPath);
  }
  if (cliOptions.emitTxt) {
    const cleanedTextPath = path.join(
      resolvedRoot,
      "languages",
      "en",
      "cleaned",
      `${sourceId}.lesson-ready.en.txt`
    );
    fs.writeFileSync(cleanedTextPath, `${cleaned.paragraphs.join("\n\n").trim()}\n`, "utf8");
  }
  fs.writeFileSync(
    cleanedMarkdownPath,
    buildMarkdown(
      {
        title,
        sourceId,
        sourceLabel,
        track: cliOptions.track,
        materialType: "subtitle_transcript",
        cleaningSummary: sourceData.cleaningSummary,
      },
      cleaned.paragraphs,
      cleaned.stats
    ),
    "utf8"
  );

  removeExistingSegmentFiles(segmentsDir, sourceId);

  const persistedSegments = segments.map((segment) => {
    const segmentFileName = `${sourceId}--seg-${String(segment.segmentIndex).padStart(2, "0")}.md`;
    const segmentPath = path.join(segmentsDir, segmentFileName);
    const previousSummary =
      segment.segmentIndex > 1
        ? segments[segment.segmentIndex - 2].sceneSummary
        : cliOptions.track === "article_reading"
          ? "Opening of the source argument."
          : "Stream opening.";
    const nextSummary =
      segment.segmentIndex < segments.length
        ? segments[segment.segmentIndex].sceneSummary
        : cliOptions.track === "article_reading"
          ? "End of the current source argument sequence."
          : "Segment sequence ends here.";

    fs.writeFileSync(
      segmentPath,
      buildSegmentMarkdown(
        segment,
        previousSummary,
        nextSummary,
        cliOptions.track
      ),
      "utf8"
    );

    return {
      ...segment,
      segmentPath,
    };
  });

  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("BEGIN");

  try {
    upsertSource(database, {
      id: sourceId,
      language: "en",
      materialType: "subtitle_transcript",
      track: cliOptions.track,
      title,
      sourceUrl: cliOptions.sourceUrl,
      creator,
      rawPath: rawTargetPath,
      cleanedPath: cleanedMarkdownPath,
      importedAt: utcNowIso(),
      status: "active",
    });

    replaceSegments(
      database,
      sourceId,
      "subtitle_transcript",
      cliOptions.track,
      persistedSegments
    );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }

  updateLearnerProfile(path.join(coachDir, "learner_profile.json"), cliOptions.track, {
    source_id: sourceId,
    title,
    track: cliOptions.track,
    imported_at: utcNowIso(),
    segment_count: persistedSegments.length,
  });

  return {
    learning_root: resolvedRoot,
    source_id: sourceId,
    source_title: title,
    track: cliOptions.track,
    raw_cues: cleaned.stats.rawCueCount,
    cleaned_utterances: cleaned.stats.cleanedUtteranceCount,
    segment_count: persistedSegments.length,
    first_segment: {
      start_ref: persistedSegments[0]?.startRef ?? null,
      end_ref: persistedSegments[0]?.endRef ?? null,
      summary: persistedSegments[0]?.sceneSummary ?? null,
    },
  };
}

function ingestFiles(cliOptions) {
  const inputFiles = collectInputFiles(cliOptions);
  return inputFiles.map((inputPath) => ingestSingleFile(inputPath, cliOptions));
}

function main(argv = process.argv.slice(2)) {
  try {
    const cliOptions = parseCliArgs(argv);
    const summaries = ingestFiles(cliOptions);
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
  buildSegments,
  ingestFiles,
  ingestSingleFile,
  main,
  parseCliArgs,
};
