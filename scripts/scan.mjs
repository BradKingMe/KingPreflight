#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { constants } from 'node:fs';
import { inspectFile, isTextFile, summarizeFiles } from "../src/scanner.js";

const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_FILES = 10000;
const IGNORED_DIRECTORIES = new Set([
  ".git", "node_modules", ".next", ".venv", "venv", "__pycache__",
  "dist", "build", "coverage", ".turbo"
]);

function usage() {
  return [
    "KingPreflight local scanner",
    "Usage: node scripts/scan.mjs --root <folder> [--json]",
    "The scan is read-only. Reports omit matched values.",
    "Unsupported file bodies and skipped folders are listed as uninspected."
  ].join("\n");
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function run() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const rootArg = argValue("--root");
  const args = process.argv.slice(2);
  if (!rootArg || rootArg.startsWith('--') || args.some((arg, index) => !['--root', '--json'].includes(arg) && args[index - 1] !== '--root')) {
    console.error(usage());
    process.exitCode = 2;
    return;
  }

  const root = path.resolve(rootArg);
  try {
    const rootStat = await fs.lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Select a real folder, not a symbolic link.");
  } catch (_) {
    console.error("Could not open folder. Check the path and permissions.");
    process.exitCode = 2;
    return;
  }

  const files = [];
  const skippedDirectories = [];
  const unreadable = [];
  let totalTextBytes = 0;
  let reachedFileLimit = false;
  let visitedEntries = 0;
  let reachedTraversalLimit = false;

  async function visit(directory, relativeDirectory) {
    if (relativeDirectory.split('/').length > 100 || ++visitedEntries > 50000) {
      reachedTraversalLimit = true;
      return;
    }
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      unreadable.push({ path: relativeDirectory || ".", reason: "Folder could not be read." });
      return;
    }

    entries.sort(function (a, b) { return a.name.localeCompare(b.name); });

    for (const entry of entries) {
      if (++visitedEntries > 50000) { reachedTraversalLimit = true; return; }
      if (files.length >= MAX_FILES) {
        reachedFileLimit = true;
        return;
      }
      const rel = relativeDirectory ? path.posix.join(relativeDirectory, entry.name) : entry.name;
      const absolute = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        files.push(inspectFile({ path: rel, bytes: 0, contentInspected: false, symbolicLink: true }));
        continue;
      }
      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) skippedDirectories.push(rel);
        else await visit(absolute, rel);
        if (reachedFileLimit || reachedTraversalLimit) return;
        continue;
      }
      if (!entry.isFile()) continue;

      let stat;
      try {
        stat = await fs.lstat(absolute);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Entry changed.');
      } catch (error) {
        unreadable.push({ path: rel, reason: "File metadata could not be read." });
        continue;
      }

      let content = "";
      let contentInspected = false;
      if (isTextFile(rel) && stat.size <= MAX_TEXT_FILE_BYTES && totalTextBytes + stat.size <= MAX_TEXT_TOTAL_BYTES) {
        try {
          const handle = await fs.open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
          try {
            const opened = await handle.stat();
            if (!opened.isFile() || opened.size > MAX_TEXT_FILE_BYTES) throw new Error('Entry changed.');
            const buffer = Buffer.alloc(Math.min(MAX_TEXT_FILE_BYTES + 1, MAX_TEXT_TOTAL_BYTES - totalTextBytes + 1));
            let offset = 0;
            while (offset < buffer.length) {
              const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, null);
              if (!bytesRead) break;
              offset += bytesRead;
            }
            if (offset > MAX_TEXT_FILE_BYTES || totalTextBytes + offset > MAX_TEXT_TOTAL_BYTES) throw new Error('Read limit exceeded.');
            totalTextBytes += offset;
            content = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, offset));
            if (content.includes('\u0000')) throw new Error('Unsupported text encoding.');
          } finally { await handle.close(); }
          contentInspected = true;
        } catch (error) {
          unreadable.push({ path: rel, reason: "File content could not be read." });
        }
      }
      files.push(inspectFile({ path: rel, bytes: stat.size, content: content, contentInspected: contentInspected }));
    }
  }

  await visit(root, "");
  const summary = summarizeFiles(files);
  const findings = files.flatMap(function (file) {
    return file.findings.map(function (finding) {
      return Object.assign({ path: file.path, bytes: file.bytes }, finding);
    });
  });

  const report = {
    product: "KingPreflight",
    version: "0.1.0",
    root: path.basename(root),
    readOnly: true,
    files: files,
    findings: findings,
    summary: summary,
    coverage: {
      supportedTextFilesRead: summary.inspectedTextFiles,
      fileBodiesNotRead: summary.uninspectedContents,
      ignoredDirectories: skippedDirectories,
      unreadableItems: unreadable,
      stoppedAtFileLimit: reachedFileLimit,
      stoppedAtTraversalLimit: reachedTraversalLimit,
      textFileLimitBytes: MAX_TEXT_FILE_BYTES,
      totalTextReadLimitBytes: MAX_TEXT_TOTAL_BYTES
    },
    limitations: [
      "Pattern checks can miss sensitive content and can raise false positives.",
      "PDF, Office, image, and archive bodies are not inspected.",
      "A clean result does not guarantee that the folder is safe to share."
    ]
  };

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("KingPreflight · local folder review");
  const safe = value => JSON.stringify(String(value));
  console.log("Folder: " + safe(report.root) + " · " + summary.fileCount + " files");
  console.log("Read-only scan. No file contents or matched values are written to this report.");
  console.log("Text files inspected: " + summary.inspectedTextFiles + " · file bodies not inspected: " + summary.uninspectedContents);
  console.log("");

  if (findings.length === 0) console.log("No patterns were flagged. This does not mean the folder is safe to share.");
  else {
    for (const item of findings) {
      console.log("[" + item.severity.toUpperCase() + "] " + safe(item.path));
      console.log("  " + item.title + " — " + item.detail);
    }
  }

  const notInspected = files.filter(function (file) { return !file.contentInspected; });
  if (notInspected.length) {
    console.log("");
    console.log("File bodies not inspected: " + notInspected.length);
    for (const file of notInspected.slice(0, 25)) console.log("  " + safe(file.path));
    if (notInspected.length > 25) console.log("  ... and " + (notInspected.length - 25) + " more; see the JSON report for the full list.");
  }

  if (skippedDirectories.length) {
    console.log("");
    console.log("Skipped directories (not scanned):");
    for (const name of skippedDirectories) console.log("  " + safe(name));
  }
  if (unreadable.length) {
    console.log("");
    console.log("Items the scanner could not read: " + unreadable.length);
    for (const item of unreadable) console.log("  " + safe(item.path) + " — " + item.reason);
  }
  if (reachedFileLimit) console.log("\nStopped after " + MAX_FILES + " files. Some contents may remain uninspected.");
  if (reachedTraversalLimit) console.log('Traversal limit reached. Some folders remain uninspected.');

  console.log("");
  console.log("Review every file you plan to share, including PDFs, Office files, images, and archives.");
}

run().catch(function (error) {
  console.error("Preflight failed: " + error.message);
  process.exitCode = 1;
});
