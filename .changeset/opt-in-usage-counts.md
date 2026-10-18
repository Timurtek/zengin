---
"@zenginui/engine": minor
"@zenginui/cli": minor
"@zenginui/hook": minor
"@zenginui/mcp": minor
"create-zengin": minor
---

Anonymous, opt-in usage counts. Off until you say yes: the first `zengin` run at a terminal asks once, and Enter is no. `zengin telemetry on | off` changes it. Never sent in CI, under `DO_NOT_TRACK`, or before you answer, and an event carries only its name, the tool, its version, a random id and whole-number counts: never a path, code, a name or an email. Every event is listed in [docs/telemetry.md](https://github.com/Timurtek/zengin/blob/main/docs/telemetry.md).
