const fs = require("fs");
const path = require("path");

const {
  buildMarkdown,
  extractSourceId,
  stripSubtitleExtension,
  toAsciiLabel,
} = require("./clean-subtitle-transcript");

const NORMALIZED_SUFFIX = /\.normalized-subtitle(?:\.[a-z]{2}(?:-[A-Za-z]+)?)?\.json$/i;

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function sortPaths(paths) {
  return [...paths].sort((left, right) => left.localeCompare(right, "en"));
}

function isNormalizedFile(filePath) {
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

    if (stat.isFile() && isNormalizedFile(resolvedEntry)) {
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

    if (!isNormalizedFile(resolvedPath)) {
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
    throw new Error("No normalized subtitle files found to render.");
  }

  return collected;
}

function parseCliArgs(argv) {
  const cliOptions = {
    emitTxt: false,
    inputPaths: [],
    manifestPath: null,
    outputDir: null,
    recursive: false,
    track: null,
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

    if (arg === "--track") {
      cliOptions.track = argv[index + 1];
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

  if (cliOptions.inputPaths.length === 0 && !cliOptions.manifestPath) {
    throw new Error(
      "Usage: node scripts/render-lesson-ready-transcript.js --track live_chat|article_reading [--emit-txt] [--output-dir dir] [--manifest file.txt] [--recursive] <normalized-file-or-dir> [more-inputs]"
    );
  }

  if (
    cliOptions.track !== "live_chat" &&
    cliOptions.track !== "article_reading"
  ) {
    throw new Error("Render stage requires an explicit --track live_chat|article_reading.");
  }

  return cliOptions;
}

function loadNormalizedPayload(inputPath) {
  const resolvedInput = path.resolve(inputPath);
  const payload = JSON.parse(fs.readFileSync(resolvedInput, "utf8"));
  if (payload?.kind !== "normalized_subtitle_transcript") {
    throw new Error(`Unsupported normalized payload: ${resolvedInput}`);
  }
  return payload;
}

function lessonReadyBasePrefix(normalizedPath, payload, cliOptions) {
  const resolvedInput = path.resolve(normalizedPath);
  const inputFileName = path.basename(resolvedInput);
  const defaultStem =
    payload.source?.stem ||
    stripSubtitleExtension(payload.source?.file_name || "") ||
    inputFileName.replace(NORMALIZED_SUFFIX, "");
  const outputBaseDir = cliOptions.outputDir
    ? path.resolve(cliOptions.outputDir)
    : path.dirname(resolvedInput);

  ensureDirectory(outputBaseDir);
  return path.join(outputBaseDir, defaultStem);
}

function renderSingleFile(inputPath, cliOptions) {
  const resolvedInput = path.resolve(inputPath);
  const payload = loadNormalizedPayload(resolvedInput);
  const sourceId =
    payload.source?.source_id ||
    extractSourceId(payload.source?.file_name || path.basename(resolvedInput));
  const sourceLabel =
    payload.source?.source_label ||
    toAsciiLabel(payload.source?.stem || "") ||
    sourceId;
  const title = payload.source?.stem || sourceLabel || sourceId;
  const basePrefix = lessonReadyBasePrefix(resolvedInput, payload, cliOptions);
  const markdownPath = `${basePrefix}.lesson-ready.en.md`;
  const markdown = buildMarkdown(
    {
      title,
      sourceId,
      sourceLabel,
      track: cliOptions.track,
      materialType: "subtitle_transcript",
      cleaningSummary:
        payload.cleaning_summary ||
        "removed subtitle indices, timestamps, and subtitle markup; merged wrapped lines; merged likely cross-cue continuations; dropped exact duplicate cue repeats where present",
    },
    payload.paragraphs || [],
    payload.stats || {}
  );

  fs.writeFileSync(markdownPath, markdown, "utf8");

  let plainTextPath = null;
  if (cliOptions.emitTxt) {
    plainTextPath = `${basePrefix}.lesson-ready.en.txt`;
    fs.writeFileSync(
      plainTextPath,
      `${(payload.paragraphs || []).join("\n\n").trim()}\n`,
      "utf8"
    );
  }

  return {
    normalized: resolvedInput,
    markdown: markdownPath,
    plain_text: plainTextPath,
    track: cliOptions.track,
  };
}

function main() {
  try {
    const cliOptions = parseCliArgs(process.argv.slice(2));
    const inputFiles = collectInputFiles(cliOptions);
    const summaries = inputFiles.map((inputPath) =>
      renderSingleFile(inputPath, cliOptions)
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
  loadNormalizedPayload,
  main,
  renderSingleFile,
};
