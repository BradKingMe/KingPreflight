# KingPreflight

A local folder review for the moment before you send, upload, publish, or hand off files.

KingPreflight checks filenames and selected text files for common risk signals, then shows what it could not inspect. It is read-only: it does not edit, delete, rename, or copy the folder. It never claims that a folder is safe.

## Use the Codex skill

This repository is packaged as a Codex skill. Install the whole folder as a skill named kingpreflight, or ask Codex to review a folder from this checkout.

The skill uses the included Node.js scanner and explains each finding in plain language. It does not upload files or print detected secret values.

## Run the scanner

Requires Node.js 18 or later. No package installation is needed.

    node scripts/scan.mjs --root "C:\path\to\folder"
    node scripts/scan.mjs --root "C:\path\to\folder" --json

The JSON report is designed for other tools to read. It omits matched values and lists ignored folders, unreadable items, and files whose bodies were not inspected.

## Open the browser interface

The app is a static site with no third-party packages. From the repository root, start its loopback-only local server:

    node scripts/preview-server.mjs 4173
Then open http://127.0.0.1:4173/app/ in a browser.

The browser app reads selected files in your browser and does not send folder contents to a server. The sample review is fictional; choose a folder to scan your own files. Use Export report to download a JSON summary.

## What it checks

- Filenames that look like environment secrets, credentials, private keys, backups, hidden files, or executables.
- Common credential patterns, email addresses, and SSN-shaped values in supported text files.
- Large files over 25 MB.
- Scan coverage, including folders and document bodies it skips.

Text scanning is limited to selected common formats, files up to 2 MB each, and a 64 MB total content budget. The command-line scanner skips common build and dependency directories, lists them in its report, and never follows symbolic links.

## Limitations

This is a pattern-based review aid. It can miss sensitive data and produce false positives. PDF, Office, image, and archive contents are not inspected. A clean scan does not guarantee that a folder is safe to share. Review every file you intend to send.

## Project files

- SKILL.md — Codex skill instructions.
- scripts/scan.mjs — local, read-only scanner.
- src/scanner.js — shared detection rules.
- app/ — browser interface.
- docs/scope-and-privacy.md — scan behavior and limits.
- mockups/ — visual reference screens.

No license has been selected yet.


## Audit and checks

Run `npm ci` and `npm test` to run the regression suite. The browser check requires Google Chrome installed. Runtime scanning has no package dependencies.

The preview server serves only four app assets from the checkout, rejects other Host headers, and does not expose arbitrary files from the launch directory. It is a development preview, not a public hosting server.

Both scanners inspect at most 10,000 files. The CLI also bounds directory traversal to 50,000 visited entries and 100 path levels, reporting incomplete coverage. UTF-8 text containing NUL or invalid byte sequences is uninspected. Browser findings show at most 500 rows; JSON retains all findings. The CLI rejects a linked root and skips detected symbolic links. Do not scan folders concurrently modified by another process: filesystem checks cannot guarantee protection against every path replacement race, especially on Windows. Browser folder selection cannot independently verify symbolic-link targets.
