import { inspectFile, isTextFile, summarizeFiles } from "../src/scanner.js";

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
let scanGeneration = 0;
let scanning = false;
const state = { files: [], findings: [], root: "", summary: null, coverage: null, filter: "all", example: true };

const sampleFiles = [
  inspectFile({ path: "config/.env.local", bytes: 1228, contentInspected: true, content: "" }),
  inspectFile({ path: "exports/contact-list.csv", bytes: 86012, contentInspected: true, content: "Name,Email\nTaylor Example,taylor@example.com" }),
  inspectFile({ path: "docs/old-proposal.pdf", bytes: 2936012, contentInspected: false }),
  inspectFile({ path: "archive/report-final-final.xlsx", bytes: 432809, contentInspected: false })
];

const sampleFindings = sampleFiles.flatMap(function (file) {
  const findings = file.findings.map(function (finding) {
    return Object.assign({ path: file.path, bytes: file.bytes, extension: file.extension }, finding);
  });
  if (file.path.endsWith(".pdf") || file.path.endsWith(".xlsx")) {
    findings.push({
      path: file.path, bytes: file.bytes, extension: file.extension,
      severity: "note", code: "content-not-inspected",
      title: "Document body not inspected",
      detail: "This file type is outside the text-only scan. Open it yourself before sharing."
    });
  }
  return findings;
});

const exampleReport = {
  root: "Client handoff",
  files: sampleFiles,
  findings: sampleFindings,
  summary: { ...summarizeFiles(sampleFiles), findingCount: sampleFindings.length, noteCount: sampleFindings.filter(f => f.severity === "note").length },
  coverage: { ignoredDirectories: ["node_modules", "build", "coverage"], unreadableItems: [], stoppedAtFileLimit: false }
};

const fileInput = document.getElementById("folderInput");
const exportButton = document.getElementById("exportReport");
const findingsList = document.getElementById("findings-list");
const filterControls = document.getElementById("filter-controls");
const scanStatus = document.getElementById("scan-status");
const guideDialog = document.getElementById("guideDialog");

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function severityLabel(severity) {
  if (severity === "high") return "High review";
  if (severity === "review") return "Review";
  return "Note";
}

function renderFinding(finding) {
  const details = make("details", "finding");
  const summary = make("summary");
  summary.append(make("span", "severity-pill severity-" + finding.severity, severityLabel(finding.severity)));

  const fileCell = make("span", "file-cell");
  fileCell.append(make("strong", "", finding.path));
  fileCell.append(make("span", "", formatSize(finding.bytes) + " · " + (finding.extension || "file")));

  const reasonCell = make("span", "reason-cell");
  reasonCell.append(make("strong", "", finding.title));
  reasonCell.append(make("span", "", finding.detail.length > 66 ? finding.detail.slice(0, 63) + "…" : finding.detail));
  summary.append(fileCell, reasonCell);
  details.append(summary);

  const body = make("div", "finding-detail");
  body.append(make("p", "", finding.detail));
  body.append(make("p", "privacy-note", "KingPreflight does not include matched values in its reports. Check the source file yourself."));
  details.append(body);
  return details;
}

function updateCounts(summary) {
  const needsLook = summary.highCount + summary.reviewCount;
  const count = document.getElementById("review-count");
  count.replaceChildren();
  count.append(make("span"));
  count.append(document.createTextNode(needsLook + " need a look"));
  count.className = "attention-badge" + (needsLook === 0 ? " is-clear" : "");
  document.getElementById("file-count").textContent = String(summary.fileCount);
}

function renderFindings() {
  const active = state.findings.filter(function (finding) {
    return state.filter === "all" || finding.severity === state.filter;
  });
  findingsList.replaceChildren();
  active.slice(0, 500).forEach(function (finding) { findingsList.append(renderFinding(finding)); });
  if (active.length > 500) findingsList.append(make('p', '', 'Showing 500 findings. Export the JSON report for all findings.'));

  document.getElementById("empty-findings").hidden = state.findings.length !== 0;
  document.getElementById("filter-empty").hidden = state.findings.length === 0 || active.length !== 0;
  updateCounts(state.summary);

  const coverage = state.coverage;
  const parts = [
    state.summary.inspectedTextFiles + " text files read",
    state.summary.uninspectedContents + " file bodies not inspected",
    coverage.ignoredDirectories.length + " folders excluded"
  ];
  if (coverage.unreadableItems.length) parts.push(coverage.unreadableItems.length + " items unreadable");
  if (coverage.stoppedAtFileLimit) parts.push("file limit reached");
  document.getElementById("coverage-counts").textContent = parts.join(" · ");

  document.getElementById("review-title").firstChild.textContent = state.root;
  document.getElementById("review-path").textContent = state.example ? " / deliverables / june" : "";
  document.getElementById("review-mode").textContent = state.example ? "Example review" : "Folder scan";
  document.getElementById("panel-copy").textContent = state.example
    ? "The scan points out things to inspect. You decide what belongs."
    : "Signals to inspect, not a verdict about whether this folder is safe.";
  exportButton.disabled = scanning;
}

function setExample() {
  scanGeneration++;
  scanning = false;
  state.files = exampleReport.files;
  state.findings = exampleReport.findings;
  state.summary = Object.assign({}, exampleReport.summary);
  state.coverage = exampleReport.coverage;
  state.root = exampleReport.root;
  state.example = true;
  state.filter = "all";
  document.querySelectorAll(".filter-button").forEach(function (button) {
    const selected = button.dataset.filter === "all";
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  scanStatus.classList.remove("is-error");
  scanStatus.textContent = "Fictional sample data · choose a folder to scan your own files.";
  renderFindings();
}

function makeReport() {
  return {
    product: "KingPreflight",
    version: "0.1.0",
    folder: state.root,
    generatedAt: new Date().toISOString(),
    sampleData: state.example,
    readOnly: true,
    summary: state.summary,
    findings: state.findings.map(function (finding) {
      return {
        path: finding.path, bytes: finding.bytes, severity: finding.severity,
        code: finding.code, title: finding.title, detail: finding.detail
      };
    }),
    coverage: state.coverage,
    limitations: [
      "Pattern checks can miss sensitive content and can raise false positives.",
      "PDF, Office, image, and archive bodies are not inspected.",
      "A clean result does not guarantee that the folder is safe to share."
    ]
  };
}

async function scanSelection(fileList) {
  const generation = ++scanGeneration;
  const files = Array.from(fileList || []);
  if (files.length === 0) {
    scanning = false;
    exportButton.disabled = !state.summary;
    scanStatus.classList.add("is-error");
    scanStatus.textContent = "No folder files were selected. Choose a folder and try again.";
    return;
  }

  scanStatus.classList.remove("is-error");
  scanning = true;
  exportButton.disabled = true;
  scanStatus.textContent = "Scanning selected files locally…";
  const firstPath = files[0].webkitRelativePath || files[0].name;
  const selectedRoot = firstPath.split("/")[0] || "Selected folder";
  const inspected = [];
  const unreadableItems = [];
  let totalTextBytes = 0;

  for (const file of files.slice(0, 10000)) {
    if (generation !== scanGeneration) return;
    const relativePath = file.webkitRelativePath || file.name;
    let content = "";
    let contentInspected = false;
    if (isTextFile(relativePath) && file.size <= MAX_TEXT_BYTES && totalTextBytes + file.size <= 64 * 1024 * 1024) {
      try {
        const buffer = await file.arrayBuffer();
        if (generation !== scanGeneration) return;
        content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        if (content.includes('\u0000')) throw new Error('Unsupported text encoding');
        totalTextBytes += file.size;
        contentInspected = true;
      } catch (_) {
        contentInspected = false;
        unreadableItems.push({ path: relativePath, reason: 'Could not read as UTF-8 text.' });
      }
    }
    inspected.push(inspectFile({ path: relativePath, bytes: file.size, content: content, contentInspected: contentInspected }));
  }

  if (generation !== scanGeneration) return;
  scanning = false;
  state.root = selectedRoot;
  state.files = inspected;
  state.summary = summarizeFiles(inspected);
  state.coverage = { ignoredDirectories: [], unreadableItems, stoppedAtFileLimit: files.length > 10000 };
  state.findings = inspected.flatMap(function (file) {
    const fileFindings = file.findings.map(function (finding) {
      return Object.assign({ path: file.path, bytes: file.bytes, extension: file.extension }, finding);
    });
    if (!file.contentInspected && /^(?:\.pdf|\.docx?|\.xlsx?|\.pptx?|\.odt|\.ods|\.odp|\.png|\.jpe?g|\.gif|\.webp|\.zip|\.7z|\.rar|\.tar|\.gz)$/i.test(file.extension)) {
      fileFindings.push({
        path: file.path, bytes: file.bytes, extension: file.extension,
        severity: "note", code: "content-not-inspected",
        title: "File body not inspected",
        detail: "This file type is outside the text-only scan. Open it yourself before sharing."
      });
    }
    if (!file.contentInspected && !fileFindings.some(function (finding) { return finding.code === "content-not-inspected"; })) {
      fileFindings.push({
        path: file.path, bytes: file.bytes, extension: file.extension,
        severity: "note", code: "content-not-inspected",
        title: isTextFile(file.path) ? "Text body not inspected" : "File body not inspected",
        detail: isTextFile(file.path)
          ? "The name was checked, but this text file was too large or could not be read. Inspect its contents yourself."
          : "This file type is outside the text-only scan. Open it yourself before sharing."
      });
    }
    return fileFindings;
  }).sort(function (a, b) {
    const rank = { high: 0, review: 1, note: 2 };
    return rank[a.severity] - rank[b.severity] || a.path.localeCompare(b.path);
  });

  state.example = false;
  state.filter = "all";
  document.querySelectorAll(".filter-button").forEach(function (button) {
    const selected = button.dataset.filter === "all";
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  scanStatus.textContent = "Scan finished in this browser. Source files were not changed.";
  renderFindings();
}

fileInput.addEventListener("change", function (event) {
  scanSelection(event.target.files);
});

filterControls.addEventListener("click", function (event) {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll(".filter-button").forEach(function (item) {
    const selected = item === button;
    item.classList.toggle("is-selected", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  renderFindings();
});

document.getElementById("exampleButton").addEventListener("click", setExample);

exportButton.addEventListener("click", function () {
  if (!state.summary || scanning) return;
  const blob = new Blob([JSON.stringify(makeReport(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "kingpreflight-review.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

document.getElementById("coverageDetails").addEventListener("click", function () {
  showGuide("limits");
});

function showGuide(kind) {
  const title = document.getElementById("dialog-title");
  const eyebrow = document.getElementById("dialog-eyebrow");
  const body = document.getElementById("dialog-body");
  body.replaceChildren();

  if (kind === "checks") {
    eyebrow.textContent = "What gets checked";
    title.textContent = "A quick pass over names and text";
    [
      "KingPreflight checks filenames for common credential, key, backup, hidden-file, executable, and unusually large-file signals.",
      "It reads selected text formats up to 2 MB per file and looks for a small set of common credential and personal-data patterns.",
      "A signal can be a false positive. Open the source file and decide whether it belongs in the handoff."
    ].forEach(function (text) { body.append(make("p", "", text)); });
  } else {
    eyebrow.textContent = "Privacy & coverage";
    title.textContent = "Know the limits";
    [
      "Files are read in your browser. Folder contents are not sent to external services, and the app does not change, delete, rename, or copy your files.",
      "PDF, Office, image, and archive contents are not inspected. Other unsupported or large file bodies are counted as uninspected.",
      "A clean scan is not a safety guarantee. Review the files you intend to share, especially anything whose contents were not inspected."
    ].forEach(function (text) { body.append(make("p", "", text)); });
  }
  guideDialog.showModal();
}

document.querySelectorAll("[data-guide]").forEach(function (button) {
  button.addEventListener("click", function () { showGuide(button.dataset.guide); });
});

setExample();
