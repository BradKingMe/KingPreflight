# Scan scope and privacy model

## Data flow

- The browser app scans files selected by the user inside the browser tab.
- The command-line scanner reads files from the provided local directory.
- Neither scanner calls a network service, creates an account, or stores file contents.
- Reports include paths and finding descriptions, not matched secret or personal-data values.
- The scanners do not write to, rename, copy, or delete source files. The browser can download a user-requested JSON report.

## Covered signals

The first version checks filenames for common secret/configuration names, private-key extensions, backup names, hidden paths, runnable files, and files above 25 MB. For selected plain-text formats it checks a small set of common private-key, cloud/service token, generic secret assignment, email, and SSN-shaped patterns.

These are risk signals, not a full data-loss-prevention system. Pattern checks can miss data or flag ordinary examples.

## Coverage boundaries

The first version does not read PDF, Microsoft Office, OpenDocument, image, or archive contents. It does not run OCR, inspect document metadata, detect faces, understand context, or infer whether a file is appropriate for a particular recipient. The CLI skips common build/dependency folders and reports every skipped path. The browser app can inspect only the files the user selected.

Files above 2 MB, or beyond the 64 MB total text-read budget, have their names checked but their bodies are not read. The report records this as incomplete coverage.

## User decision

KingPreflight does not remove files or certify a folder. A person should open the flagged and uninspected files and decide what to share. “No patterns flagged” means only that this limited scan did not detect its known patterns.
