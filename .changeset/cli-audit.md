---
"@zenginui/cli": minor
---

`zengin audit <repo> --out <dir>` runs the Design System Drift Audit on a repository whose definitions were derived in prework. Findings are grouped by cause (one rule and one found value is one decision), ranked by severity times the number of files, and each gets a proposed class (true drift, needs a decision, intentional exception, false positive) with its `file:line` evidence and the reason. The first 150 in rank order go to hand review (`--cap`), the rest are summarised. It writes `findings.json`, `run.json`, and a report draft as `report.md` and `report.pdf`, all to `--out` and nowhere else; the repository is only read.
