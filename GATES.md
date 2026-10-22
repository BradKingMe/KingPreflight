# Gates: KingPreflight

OWNS: GATES.md, PRODUCT.md, DESIGN.md, README.md, SKILL.md, .gitignore, package.json, agents/**, app/**, docs/**, mockups/**, scripts/**, src/**, .impeccable/**

Scope: Create a local-first file-sharing preflight tool and a Codex skill that guides a read-only review workflow.

- [x] G1: The skill explains when to run the preflight, how to interpret findings, and the scanner's limits
  EVIDENCE: SKILL.md defines the user intent, absolute bundled-scanner path, finding interpretation, privacy rules, coverage limits, and read-only follow-up boundary.

- [x] G2: The browser experience presents a clear folder scan, findings review, and local-only privacy boundary at desktop and mobile sizes
  EVIDENCE: Reviewed the local browser app at 1440x1000 and 390x844. The desktop layout shows the findings ledger and coverage summary; the mobile layout stacks them without horizontal overflow.

- [x] G3: The scanner and product documentation make read-only behavior and incomplete coverage explicit without promising that a folder is safe
  EVIDENCE: Reviewed src/scanner.js, scripts/scan.mjs, app/app.js, README.md, and docs/scope-and-privacy.md. They state the read-only behavior, report uninspected bodies, and explicitly reject a safety guarantee.

- [x] G4: The skill package passes the official local quick validator
  CHECK: python C:/Users/bradk/.codex/skills/.system/skill-creator/scripts/quick_validate.py .
  EXPECT: Skill is valid
  EVIDENCE: quick_validate.py returned "Skill is valid!" after the final SKILL.md update.
