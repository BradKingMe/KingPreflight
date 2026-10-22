# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Provisional for this build: dependency-free HTML, CSS, and JavaScript for the offline browser interface, plus a small Node.js command-line scanner for Codex workflows. This is a session-level implementation choice made because no framework preference was supplied; it is not a saved preference.

## Users

Working assumption from the request for something “everyone can use”: people preparing a folder to send, upload, or publish who want to catch accidental sensitive content or extra files before sharing.

## Product Purpose

KingPreflight reviews a selected folder locally and presents potential sharing risks for a person to inspect. Success means the user understands what was checked, what needs attention, and what the tool could not inspect before they share anything.

## Positioning

A read-only preflight checklist for folders: it inventories files, checks selected names and text formats for risk signals, and explains each finding. It helps people decide what to do; it does not redact or remove files.

## Operating Context

Used on a computer immediately before emailing, uploading, publishing, or handing off a folder. The web interface reads selected files in the browser; a Node.js scanner supports agent-assisted command-line review.

## Capabilities and Constraints

- Local-only processing; no upload, account, or network service is required.
- Read-only: never changes, deletes, renames, or copies source files.
- Findings are signals for human review, not proof a file is unsafe or safe.
- First version checks names, file types, hidden or backup paths, selected credential and personal-data patterns in supported text files, and reports coverage limits.
- PDF and Office document bodies, images, OCR, and archive contents are outside the first-version scan unless explicitly implemented and shown as covered.
- Large files and skipped directories must be reported as uninspected rather than silently treated as clear.
- Raw matched values should not be copied into reports; show masked evidence only when needed.

## Brand Commitments

Working product name: KingPreflight, chosen in this conversation. The meaning of “King” in the name remains open; do not assume it implies an employer or a particular industry.

## Evidence on Hand

No customer feedback, usage data, logos, benchmarks, or legal review has been supplied. Do not invent them.

## Product Principles

- Keep source files untouched.
- Make scan coverage and blind spots visible.
- Explain each signal in plain language.
- Keep sensitive match values out of generated reports.
- Leave the sharing decision with the user.
