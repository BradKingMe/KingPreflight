---
name: kingpreflight
description: Review a local folder before the user shares, uploads, or publishes it. Run the read-only scanner, explain risk signals and coverage gaps, and leave every file unchanged.
---

# KingPreflight

Use this skill when someone asks whether a local folder, project, export, or handoff is ready to share, upload, or publish.

## Workflow

1. Confirm the exact folder the user wants reviewed. If it is not clear, ask for its path. Do not scan a broader parent folder by default.
2. Resolve the absolute directory containing this `SKILL.md` as `SKILL_DIR`. Do not assume the user's project folder is the skill directory. Run the bundled scanner by its full path:
   - Human-readable: `node "<SKILL_DIR>/scripts/scan.mjs" --root "<folder>"`
   - Structured: `node "<SKILL_DIR>/scripts/scan.mjs" --root "<folder>" --json`
3. Explain findings by severity and plain-language reason. Distinguish a strong signal (for example, a private-key marker) from a review suggestion (for example, an email address or backup filename).
4. Report skipped directories, unreadable items, files whose bodies were not inspected, and the scanner's file and byte limits. Never turn an incomplete scan into a clean bill of health.
5. Recommend specific files for the user to inspect or exclude. Do not edit, delete, rename, redact, copy, upload, or publish anything as part of this review. If the user asks for one of those follow-up actions, treat it as a separate request and preserve the original folder.

## Privacy and reporting

- The scanner reads local file names and selected text files. It does not call network services or write to the source folder.
- Do not print matched values in the conversation. The scanner intentionally reports pattern names and paths without storing the matched secret or personal-data text.
- Treat paths as potentially sensitive. Include only the path detail needed to help the user locate a finding.
- Do not use words like "safe," "clean," "compliant," or "guaranteed" as a result. Say "no patterns were flagged by this limited scan" when applicable.
- Do not ask users to paste private values into chat.

## Coverage boundaries

The bundled scanner checks names and selected plain-text formats. It does not inspect PDF, Office, image, or archive contents; run OCR; inspect document metadata; identify every kind of personal information; or understand whether a file is suitable for a specific recipient. Large text files and skipped directories are reported as uninspected.

If the scanner cannot run, explain the error and offer a manual review checklist. Do not silently substitute a broader scan or claim the tool reviewed content it did not read.
