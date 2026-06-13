const fs = require("fs");
const path = require("path");

const {
  cleanSubtitle,
  detectSubtitleFormat,
  extractSourceId,
  stripSubtitleExtension,
  toAsciiLabel,
} = require("./clean-subtitle-transcript");

const SUPPORTED_EXTENSIONS = new Set([".srt", ".vtt", ".ass", ".ssa"]);

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function sortPaths(paths) {
  return [...paths].sort((left, right) => left.localeCompare(right, "en"));
}

function isSupportedSubtitleFile(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
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
    throw new Error("No subtitle files found to normalize.");
  }

  return collected;
}

function parseCliArgs(argv) {
  const cliOptions = {
    inputPaths: [],
    manifestPath: null,
    outputDir: null,
    recursive: false,
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
      "Usage: node scripts/normalize-subtitle-transcript.js [--output-dir dir] [--manifest file.txt] [--recursive] <input-file-or-dir> [more-inputs]"
    );
  }

  return cliOptions;
}

function buildCleaningSummary() {
  return "removed subtitle indices, timestamps, and subtitle markup; merged wrapped lines; merged likely cross-cue continuations; dropped exact duplicate cue repeats where present";
}

function buildNormalizedPayload(inputPath) {
  const resolvedInput = path.resolve(inputPath);
  const inputFileName = path.basename(resolvedInput);
  const rawText = fs.readFileSync(resolvedInput, "utf8");
  const format = detectSubtitleFormat(rawText, resolvedInput);
  const cleaned = cleanSubtitle(rawText, { format });
  const stem = stripSubtitleExtension(inputFileName);
  const sourceId = extractSourceId(inputFileName);

  return {
    schema_version: 1,
    kind: "normalized_subtitle_transcript",
    source: {
      input_path: resolvedInput,
      file_name: inputFileName,
      stem,
      source_id: sourceId,
      source_label: toAsciiLabel(stem) || sourceId,
      subtitle_format: format,
    },
    cleaning_summary: buildCleaningSummary(),
    cleaned_utterances: cleaned.cleanedUtterances,
    paragraph_records: cleaned.paragraphRecords,
    paragraphs: cleaned.paragraphs,
    stats: cleaned.stats,
  };
}

function normalizedOutputPath(inputPath, cliOptions) {
  const resolvedInput = path.resolve(inputPath);
  const inputFileName = path.basename(resolvedInput);
  const stem = stripSubtitleExtension(inputFileName);
  const outputBaseDir = cliOptions.outputDir
    ? path.resolve(cliOptions.outputDir)
    : path.dirname(resolvedInput);

  ensureDirectory(outputBaseDir);
  return path.join(outputBaseDir, `${stem}.normalized-subtitle.json`);
}

function normalizeSingleFile(inputPath, cliOptions) {
  const payload = buildNormalizedPayload(inputPath);
  const outputPath = normalizedOutputPath(inputPath, cliOptions);
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return {
    input: path.resolve(inputPath),
    normalized: outputPath,
    subtitle_format: payload.source.subtitle_format,
    raw_cues: payload.stats.rawCueCount,
    cleaned_utterances: payload.stats.cleanedUtteranceCount,
  };
}

function main() {
  try {
    const cliOptions = parseCliArgs(process.argv.slice(2));
    const inputFiles = collectInputFiles(cliOptions);
    const summaries = inputFiles.map((inputPath) =>
      normalizeSingleFile(inputPath, cliOptions)
    );

    for (const summary of summaries) {
      console.log(`Wrote ${summary.normalized}`);
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
  buildNormalizedPayload,
  main,
};
