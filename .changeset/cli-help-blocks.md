---
"@zenginui/cli": patch
---

`zengin --help` attributes its options to the right command.

The Init block had lost its last two lines into Define, so `--dir` was listed twice under Define and
`--force` appeared there with init's description, "overwrite existing zengin/ definitions and config".
Anyone reading the help to find out what `zengin define --force` does was told the wrong thing about
the one flag whose whole job is to overwrite something.
