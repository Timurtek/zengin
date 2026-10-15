# Design System Drift Audit: umami-software/umami (DRAFT)

> DRAFT for review. Not for the client until it has been reviewed and edited. Every class below is proposed by rule and confirmed by hand before the report leaves.

Run: umami-software/umami at ca661c7, against @umami/react-zen@0.249.0. 934 files checked in 4.3 seconds by @zenginui/cli@0.9.0, 2026-10-15.

## Summary

- This run reported 155 findings in 92 groups. A group is one rule and one found value with one proposed class: one decision.
- Hand review covers 150 findings in 87 groups, up to the cap of 150, taken in rank order (severity times the number of files). 5 findings are summarised, not classified by hand. 150 + 5 = 155.
- False positives proposed in the hand-review set: 0 of 150. The rate is stated once each one has been confirmed by hand.
- Every number here comes from this run and is reconciled above. No figure from another run is quoted.

| Proposed class | Findings | Groups |
|---|---|---|
| True drift | 86 | 53 |
| Needs a decision | 64 | 34 |
| Intentional exception | 0 | 0 |
| False positive | 0 | 0 |
| Hand-review set | 150 | 87 |

## Top issues

### G01: spacing-literal `8px` (True drift)

- What: Spacing literal where a token reference is required. 8px matches space.padding-y-default but will not follow scale changes.
- Spread: 9 findings in 4 files, at error. Involves `space.padding-y-default`.
- Why this class: spacing-literal at error, with an exact fix.
- Fix: `var(--padding-y-default)` (exact)
- Examples: F001 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:27`, F002 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:28`, F003 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:39`.
- Findings: F001 to F009 (9).

### G02: spacing-literal `padding: '32px'` (Needs a decision)

- What: Arbitrary spacing value in inline style (padding). 32px is not on the spacing scale.
- Spread: 5 findings in 4 files, at error. Involves `padding: '32px'`.
- Why this class: No token is near this value: either the system is missing a token or this is a deliberate one-off.
- Fix: space.gap-default = 12px
- Examples: F010 `src/app/(main)/boards/[boardId]/BoardEditColumn.tsx:133`, F011 `src/app/(main)/websites/[websiteId]/settings/SharesTable.tsx:54`, F012 `src/app/(main)/websites/[websiteId]/settings/SharesTable.tsx:112`.
- Findings: F010 to F014 (5).

### G03: spacing-literal `2px` (Needs a decision)

- What: Arbitrary spacing value. 2px is not on the spacing scale.
- Spread: 4 findings in 3 files, at error. Involves `2px`.
- Why this class: No token is near this value: either the system is missing a token or this is a deliberate one-off.
- Fix: space.padding-y-default = 8px
- Examples: F015 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:66`, F016 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:147`, F017 `src/components/common/Badge.module.css:7`.
- Findings: F015, F016, F017, F018.

### G04: color-literal `"rgba(0,0,0,0.8)"` (True drift)

- What: Color literal in inline style (background-color) where a token reference is required. rgba(0,0,0,0.8) has no exact token match.
- Spread: 3 findings in 3 files, at error. Involves `color.gray-950`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `"var(--gray-950)"` (nearest). Nearest by value: color.gray-950 = #0a0a0a. Verify the semantic role before applying.
- Examples: F019 `src/components/charts/ChartTooltip.tsx:19`, F020 `src/components/metrics/WeeklyTraffic.tsx:110`, F021 `src/components/metrics/WorldMap.tsx:105`.
- Findings: F019, F020, F021.

### G05: color-literal `"white"` (True drift)

- What: Color literal in inline style (color) where a token reference is required. The value matches 4 tokens (color.primary-foreground, color.surface-base, color.surface-overlay, color.focus-ring-offset) in the default theme but will not follow theme changes.
- Spread: 3 findings in 3 files, at error. Involves `color.primary-foreground`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `"var(--primary-foreground)"` (nearest). Several tokens share this value. Pick by role: color.primary-foreground, color.surface-base, color.surface-overlay, color.focus-ring-offset.
- Examples: F022 `src/components/charts/ChartTooltip.tsx:19`, F023 `src/components/metrics/WeeklyTraffic.tsx:110`, F024 `src/components/metrics/WorldMap.tsx:105`.
- Findings: F022, F023, F024.

### G06: classname-policy `padding: '32px'` (Needs a decision)

- What: style on Dialog may not set padding. className on Dialog is limited to: margin, width, height, flex-item, grid-item, position, display, overflow.
- Spread: 5 findings in 4 files, at warn. Involves `Dialog`.
- Why this class: True by the component's contract, reported at warn: whether className.allow should widen for this component is a policy call.
- Fix: No fix the engine can write; decided by hand.
- Examples: F025 `src/app/(main)/boards/[boardId]/BoardEditColumn.tsx:133`, F026 `src/app/(main)/websites/[websiteId]/settings/SharesTable.tsx:54`, F027 `src/app/(main)/websites/[websiteId]/settings/SharesTable.tsx:112`.
- Findings: F025 to F029 (5).

### G07: classname-policy `whiteSpace: 'nowrap'` (Needs a decision)

- What: style on Row may not set white-space. className on Row is limited to: margin, width, height, flex-item, grid-item, position, display, overflow.
- Spread: 4 findings in 4 files, at warn. Involves `Row`.
- Why this class: True by the component's contract, reported at warn: whether className.allow should widen for this component is a policy call.
- Fix: No fix the engine can write; decided by hand.
- Examples: F030 `src/components/common/Pager.tsx:43`, F031 `src/components/input/FilterBar.tsx:240`, F032 `src/components/property-data/PropertyFilterBar.tsx:119`.
- Findings: F030, F031, F032, F033.

### G08: spacing-literal `10px` (True drift)

- What: Arbitrary spacing value. 10px is not on the spacing scale.
- Spread: 6 findings in 2 files, at error. Involves `space.padding-y-default`.
- Why this class: spacing-literal at error, with a nearest fix.
- Fix: `var(--padding-y-default)` (nearest). space.padding-y-default = 8px, space.padding-x-default = 12px
- Examples: F034 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:39`, F035 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:80`, F036 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:109`.
- Findings: F034 to F039 (6).

### G09: spacing-literal `20px` (True drift)

- What: Arbitrary spacing value. 20px is not on the spacing scale.
- Spread: 5 findings in 2 files, at error. Involves `space.gap-default`.
- Why this class: spacing-literal at error, with a nearest fix.
- Fix: `var(--gap-default)` (nearest). space.gap-default = 12px
- Examples: F040 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:22`, F041 `src/app/(main)/websites/[websiteId]/(reports)/journeys/Journey.module.css:22`, F042 `src/app/(main)/websites/[websiteId]/(reports)/journeys/Journey.module.css:26`.
- Findings: F040 to F044 (5).

### G10: spacing-literal `6px` (True drift)

- What: Arbitrary spacing value. 6px is not on the spacing scale.
- Spread: 4 findings in 2 files, at error. Involves `space.padding-y-default`.
- Why this class: spacing-literal at error, with a nearest fix.
- Fix: `var(--padding-y-default)` (nearest). space.padding-y-default = 8px
- Examples: F045 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:9`, F046 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:39`, F047 `src/app/(main)/websites/[websiteId]/(reports)/heatmaps/Heatmap.module.css:157`.
- Findings: F045, F046, F047, F048.

## Fix path by class

### True drift

Fix in code, in group order. Apply exact fixes first; check each nearest fix by eye, since a neighbouring step can be a different design.

| Group | Rule | Found | Findings | Files |
|---|---|---|---|---|
| G01 | spacing-literal | `8px` | F001 to F009 (9) | 4 |
| G04 | color-literal | `"rgba(0,0,0,0.8)"` | F019, F020, F021 | 3 |
| G05 | color-literal | `"white"` | F022, F023, F024 | 3 |
| G08 | spacing-literal | `10px` | F034 to F039 (6) | 2 |
| G09 | spacing-literal | `20px` | F040 to F044 (5) | 2 |
| G10 | spacing-literal | `6px` | F045, F046, F047, F048 | 2 |
| G17 | spacing-literal | `4px` | F067, F068, F069 | 2 |
| G18 | spacing-literal | `12px` | F070, F071 | 2 |
| G20 | spacing-literal | `paddingTop: '24px'` | F074, F075 | 2 |
| G24 | token-reference | `--border-base` | F082, F083, F084 | 1 |
| G25 | spacing-literal | `16px` | F085, F086 | 1 |
| G26 | spacing-literal | `gap: '16px'` | F087, F088 | 1 |
| G27 | spacing-literal | `padding: '12px 0'` | F089, F090 | 1 |
| G28 | color-literal | `"var(--color-danger, red)"` | F091 | 1 |
| G29 | color-literal | `#15803d` | F092 | 1 |
| G30 | color-literal | `#16a34a` | F093 | 1 |
| G31 | color-literal | `#4ade80` | F094 | 1 |
| G32 | color-literal | `#86efac` | F095 | 1 |
| G33 | color-literal | `#a16207` | F096 | 1 |
| G34 | color-literal | `#b91c1c` | F097 | 1 |
| G35 | color-literal | `#ca8a04` | F098 | 1 |
| G36 | color-literal | `#d1d5db` | F099 | 1 |
| G37 | color-literal | `#dc2626` | F100 | 1 |
| G38 | color-literal | `#dcfce7` | F101 | 1 |
| G39 | color-literal | `#f87171` | F102 | 1 |
| G40 | color-literal | `#facc15` | F103 | 1 |
| G41 | color-literal | `#fca5a5` | F104 | 1 |
| G42 | color-literal | `#fde047` | F105 | 1 |
| G43 | color-literal | `#fee2e2` | F106 | 1 |
| G44 | color-literal | `#fef9c3` | F107 | 1 |
| G45 | color-literal | `rgba(0, 0, 0, 0.7)` | F108 | 1 |
| G46 | color-literal | `rgba(202, 138, 4, 0.15)` | F109 | 1 |
| G47 | color-literal | `rgba(22, 163, 74, 0.15)` | F110 | 1 |
| G48 | color-literal | `rgba(220, 38, 38, 0.15)` | F111 | 1 |
| G49 | color-literal | `rgba(255, 200, 0, 0.6)` | F112 | 1 |
| G50 | color-literal | `rgba(255, 255, 255, 0.85)` | F113 | 1 |
| G51 | color-literal | `rgba(255, 60, 0, 0.9)` | F114 | 1 |
| G52 | component-substitution | `<button type="button" onClick={handleSort} className="inline-flex appearance-non` | F115 | 1 |
| G55 | spacing-literal | `gap: 24` | F118 | 1 |
| G56 | spacing-literal | `margin: '0 6px'` | F119 | 1 |
| G57 | spacing-literal | `marginLeft: 12` | F120 | 1 |
| G59 | spacing-literal | `marginTop: '12px'` | F122 | 1 |
| G61 | spacing-literal | `marginTop: '8px'` | F124 | 1 |
| G62 | spacing-literal | `padding: '0 0 12px'` | F125 | 1 |
| G63 | spacing-literal | `padding: '24px'` | F126 | 1 |
| G64 | spacing-literal | `paddingBottom: '16px'` | F127 | 1 |
| G66 | token-reference | `--base-color-text-secondary` | F129 | 1 |
| G67 | token-reference | `"1px solid var(--base300)"` | F130 | 1 |
| G68 | token-reference | `"var(--anchor-width)"` | F131 | 1 |
| G69 | token-reference | `"var(--available-width)"` | F132 | 1 |
| G70 | token-reference | `"var(--base75)"` | F133 | 1 |
| G71 | token-reference | `"var(--color-danger, red)"` | F134 | 1 |
| G72 | unknown-prop | `flex-direction="column"` | F135 | 1 |

### Needs a decision

A decision for the team before any code changes: add the missing token, name the file as a foundation, or widen the component's className.allow. Each decision closes a whole group.

| Group | Rule | Found | Findings | Files |
|---|---|---|---|---|
| G02 | spacing-literal | `padding: '32px'` | F010 to F014 (5) | 4 |
| G03 | spacing-literal | `2px` | F015, F016, F017, F018 | 3 |
| G06 | classname-policy | `padding: '32px'` | F025 to F029 (5) | 4 |
| G07 | classname-policy | `whiteSpace: 'nowrap'` | F030, F031, F032, F033 | 4 |
| G11 | classname-policy | `backgroundColor: 'rgba(0,0,0,0.8)'` | F049, F050, F051 | 3 |
| G12 | classname-policy | `color: 'white'` | F052, F053, F054 | 3 |
| G13 | classname-policy | `cursor: 'pointer'` | F055, F056, F057 | 3 |
| G14 | classname-policy | `padding: 0` | F058, F059, F060 | 3 |
| G15 | classname-policy | `rounded-lg` | F061, F062, F063 | 3 |
| G16 | classname-policy | `textOverflow: 'ellipsis'` | F064, F065, F066 | 3 |
| G19 | spacing-literal | `gap-1` | F072, F073 | 2 |
| G21 | classname-policy | `contain: 'layout'` | F076, F077 | 2 |
| G22 | classname-policy | `justifyContent: 'flex-start'` | F078, F079 | 2 |
| G23 | classname-policy | `paddingTop: '24px'` | F080, F081 | 2 |
| G53 | spacing-literal | `100px` | F116 | 1 |
| G54 | spacing-literal | `1px` | F117 | 1 |
| G58 | spacing-literal | `marginTop: '-6px'` | F121 | 1 |
| G60 | spacing-literal | `marginTop: '3px'` | F123 | 1 |
| G65 | spacing-literal | `paddingLeft: 28` | F128 | 1 |
| G73 | classname-policy | `alignContent: 'start'` | F136 | 1 |
| G74 | classname-policy | `color: 'var(--color-danger, red)'` | F137 | 1 |
| G75 | classname-policy | `cursor: 'col-resize'` | F138 | 1 |
| G76 | classname-policy | `cursor: 'row-resize'` | F139 | 1 |
| G77 | classname-policy | `flex-col` | F140 | 1 |
| G78 | classname-policy | `gap-2` | F141 | 1 |
| G79 | classname-policy | `gridTemplateRows: 'auto 1fr'` | F142 | 1 |
| G80 | classname-policy | `justify-between` | F143 | 1 |
| G81 | classname-policy | `opacity: 0.7` | F144 | 1 |
| G82 | classname-policy | `padding: '24px'` | F145 | 1 |
| G83 | classname-policy | `paddingBottom: '16px'` | F146 | 1 |
| G84 | classname-policy | `paddingLeft: 28` | F147 | 1 |
| G85 | classname-policy | `paddingTop: '15vh'` | F148 | 1 |
| G86 | classname-policy | `tableLayout: 'fixed'` | F149 | 1 |
| G87 | classname-policy | `textWrap: 'nowrap'` | F150 | 1 |

### Intentional exception

Keep it and write the reason after the zengin-allow comment's colon, so the engine honours it and the next reader knows why; or remove the exception.

No group in the hand-review set.

### False positive

Not a code change. Tune the definitions (a passthrough type, a foundation file) so the engine stops reporting it, and count it in the report's false-positive rate.

No group in the hand-review set.

## Beyond the hand-review cap

5 findings past the cap ship as engine output with a proposed class and no hand review. A second pass is a separate piece of work.

| Group | Rule | Found | Proposed class | Findings past the cap |
|---|---|---|---|---|
| G88 | classname-policy | `transform: 'translate(-50%, -50%)'` | Needs a decision | F151 |
| G89 | classname-policy | `transform: 'translateY(-50%)'` | Needs a decision | F152 |
| G90 | classname-policy | `transition: 'width 0.2s ease-in-out'` | Needs a decision | F153 |
| G91 | classname-policy | `whiteSpace: 'pre-wrap'` | Needs a decision | F154 |
| G92 | classname-policy | `wordBreak: 'break-word'` | Needs a decision | F155 |

## What the scan cannot see

- Drift outside the engine's seven rule kinds (color-literal, spacing-literal, token-reference, unknown-prop, unknown-prop-value, classname-policy, component-substitution): behavioural, architectural and most accessibility drift.
- What renders at runtime: class names built from runtime values, styles set from JavaScript, and the visual result of an override.
- Files outside the configured scope, and any system the definitions do not describe.
- Whether a finding matters to a user. That judgement is the hand review.

## Evidence

Every finding id above resolves in findings.json, with its `file:line`, rule, found value, the token or component involved, its proposed class and the reason for it. run.json records the run.
