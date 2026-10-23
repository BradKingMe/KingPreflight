const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl",
  ".yaml", ".yml", ".toml", ".ini", ".conf", ".config", ".env",
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rb",
  ".go", ".rs", ".java", ".kt", ".sql", ".html", ".htm", ".css",
  ".scss", ".xml", ".properties", ".sh", ".bash", ".zsh", ".ps1",
  ".bat", ".cmd", ".log", ".ipynb"
]);

const SAFE_DOTFILES = new Set([
  ".gitignore", ".gitattributes", ".editorconfig", ".prettierignore",
  ".npmignore", ".dockerignore", ".nojekyll", ".env.example",
  ".env.sample", ".env.template"
]);

const SENSITIVE_NAME = /(^|[._-])(credentials?|secrets?|private[-_]?key|service[-_]?account|id_rsa|token)([._-]|$)/i;
const BACKUP_NAME = /(?:~$|\.bak$|\.old$|\.orig$|\.backup$|\.tmp$|(?:^|[._ -])copy(?:[._ -]|$)|(?:^|[._ -])final[-_ ]?final(?:[._ -]|$))/i;
const PRIVATE_KEY = /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/;
const AWS_KEY = /\bAKIA[0-9A-Z]{16}\b/;
const GITHUB_TOKEN = /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/i;
const SLACK_TOKEN = /\bxox[baprs]-[A-Za-z0-9-]{15,}\b/i;
const STRIPE_KEY = /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/i;
const GENERIC_SECRET = /\b(?:api[_-]?key|secret|password|token|client[_-]?secret)\s*[:=]\s*["']?([A-Za-z0-9/+=._-]{8,})/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const US_SSN = /\b\d{3}-\d{2}-\d{4}\b/;

function extensionOf(filePath) {
  const basename = String(filePath).split(/[\\/]/).pop() || "";
  if (/^\.env(?:\.|$)/i.test(basename)) return ".env";
  const dot = basename.lastIndexOf(".");
  return dot > 0 ? basename.slice(dot).toLowerCase() : "";
}

function add(findings, severity, code, title, detail) {
  if (!findings.some(function (item) { return item.code === code; })) {
    findings.push({ severity: severity, code: code, title: title, detail: detail });
  }
}

export function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(extensionOf(filePath)) || /(?:^|[\\/])(?:\.npmrc|\.pypirc|\.netrc|\.gitconfig|\.bashrc|\.zshrc|credentials|config)$/i.test(filePath);
}

export function inspectFile(input) {
  const filePath = String(input.path || "").replace(/\\/g, "/");
  const basename = filePath.split("/").pop() || filePath;
  const parts = filePath.split("/").filter(Boolean);
  const ext = extensionOf(filePath);
  const bytes = Number(input.bytes || 0);
  const findings = [];

  if (input.symbolicLink) {
    add(findings, "review", "symbolic-link", "Symbolic link not followed", "This entry may point outside the selected folder. Review its target separately.");
  }

  if (SENSITIVE_NAME.test(basename) || /^\.env(?:$|\.)/i.test(basename) && !/^\.env\.(?:example|sample|template)$/i.test(basename)) {
    add(findings, "high", "sensitive-name", "Sensitive-looking filename", "The filename commonly holds credentials or private configuration. Open it yourself and confirm what it contains.");
  }
  if (/\.(?:pem|key|p12|pfx|keystore)$/i.test(basename)) {
    add(findings, "high", "key-material", "Private key or certificate file", "This file type can contain material that should not be distributed publicly.");
  }
  if (BACKUP_NAME.test(basename)) {
    add(findings, "review", "backup-file", "Possible backup or temporary file", "Check whether this older or temporary copy belongs in the handoff.");
  }
  if (!findings.some(function (item) { return item.severity === "high"; }) && parts.some(function (part) { return part.startsWith(".") && !SAFE_DOTFILES.has(part); })) {
    add(findings, "note", "hidden-path", "Hidden path", "Hidden files are easy to overlook. Confirm this one is intentional.");
  }
  if (/\.(?:exe|msi|dll|so|dylib|bat|cmd|ps1|sh|app|apk|dmg)$/i.test(basename)) {
    add(findings, "review", "executable", "Runnable or installable file", "Confirm recipients expect an executable or installer in this folder.");
  }
  if (bytes > 25 * 1024 * 1024) {
    add(findings, "note", "large-file", "Large file", "This file is over 25 MB. Confirm its size and destination are intentional.");
  }

  if (input.contentInspected && typeof input.content === "string") {
    const body = input.content;
    if (PRIVATE_KEY.test(body)) add(findings, "high", "private-key-content", "Private key marker in text", "A private-key block marker was found. The matching value is not shown.");
    if (AWS_KEY.test(body)) add(findings, "high", "aws-key-content", "Cloud access key pattern", "A value matching a common access-key pattern was found. The matching value is not shown.");
    if (GITHUB_TOKEN.test(body) || SLACK_TOKEN.test(body) || STRIPE_KEY.test(body)) {
      add(findings, "high", "service-token-content", "Service token pattern", "A value matching a common service-token pattern was found. The matching value is not shown.");
    }
    if (GENERIC_SECRET.test(body)) {
      add(findings, "review", "secret-assignment", "Secret-like assignment", "A password, token, or key assignment may be present. Check the source file; reports never include the value.");
    }
    if (EMAIL.test(body)) {
      add(findings, "review", "email-address", "Email address found", "Contact details may be present. Confirm they are appropriate for the intended audience.");
    }
    if (US_SSN.test(body)) {
      add(findings, "high", "us-ssn-pattern", "Possible U.S. Social Security number", "A number matching the common SSN format was found. This may be a false positive; the value is not shown.");
    }
  }

  return {
    path: filePath,
    bytes: bytes,
    extension: ext || "(no extension)",
    contentInspected: Boolean(input.contentInspected && typeof input.content === 'string'),
    findings: findings
  };
}

export function summarizeFiles(files) {
  const list = Array.isArray(files) ? files : [];
  const flat = list.flatMap(function (file) { return file.findings || []; });
  return {
    fileCount: list.length,
    findingCount: flat.length,
    highCount: flat.filter(function (item) { return item.severity === "high"; }).length,
    reviewCount: flat.filter(function (item) { return item.severity === "review"; }).length,
    noteCount: flat.filter(function (item) { return item.severity === "note"; }).length,
    inspectedTextFiles: list.filter(function (file) { return file.contentInspected; }).length,
    uninspectedContents: list.filter(function (file) { return !file.contentInspected; }).length
  };
}
