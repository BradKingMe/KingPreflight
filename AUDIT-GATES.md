# Gates: KingPreflight code audit

OWNS: **/*

Scope: Review scanner privacy, bounded reads, browser scan ordering, preview server exposure, and skill packaging.

- [x] K1: Regression checks cover secret omission, CLI coverage, invalid encoding, server access restrictions, and source preservation.
  CHECK: npm test
  EXPECT: fail 0
  EVIDENCE: automatic-evidence=v1; definition-sha256=29459e73eeecdf01d1217661a57d6bf4eca08c68489167b4db5a5ce0576dd123; exit=0; EXPECT=matched; output-sha256=900fba45ea54fe39b748dbdbb9688e8079c7e4bf388c12c038093237903241fd; output-bytes=568; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\bradk\Site\KingPreflight; path=b45c073664ed/40 entries
- [x] K2: Documentation describes actual scope and remaining limitations.
  EVIDENCE: AUDIT-2026-10-22.md and README describe fixes, tests, encoding and filesystem limitations.
- [x] K3: Skill validation and syntax checks pass.
  EVIDENCE: Skill quick_validate.py passed with isolated PyYAML; node --check passes for app and both scripts. Production dependency audit reports zero vulnerabilities.
