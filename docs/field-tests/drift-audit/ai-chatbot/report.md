# Design System Drift Audit: vercel/ai-chatbot (DRAFT)

> DRAFT for review. Not for the client until it has been reviewed and edited. Every class below is proposed by rule and confirmed by hand before the report leaves.

Run: vercel/ai-chatbot at c2f8235, against @/components/ui@0.0.0. 124 files checked in 0.5 seconds by @zenginui/cli@0.9.0, 2026-10-15.

## Summary

- This run reported 109 findings in 82 groups. A group is one rule and one found value with one proposed class: one decision.
- 109 findings in 82 groups are queued for hand review, up to the cap of 150, taken in rank order (severity times the number of files). 0 findings past the cap are summarised. 109 + 0 = 109.
- Confirmed by hand so far: 0 of 109. Until a reviewer confirms a finding, its class is a proposal made by rule.
- False positives proposed in the queue: 0 of 109. The rate is stated once each one has been confirmed by hand.
- Every number here comes from this run and is reconciled above. No figure from another run is quoted.

| Proposed class | Findings | Groups |
|---|---|---|
| True drift | 75 | 56 |
| Needs a decision | 34 | 26 |
| Intentional exception | 0 | 0 |
| False positive | 0 | 0 |
| Queued for hand review | 109 | 82 |

## Top issues

### G01: classname-policy `rounded-full` (Needs a decision)

- What: className on Button may not set border-radius. border-radius is owned by the component; use a variant or a token.
- Spread: 4 findings in 3 files, at warn. Involves `Button`.
- Why this class: True by the component's contract, reported at warn: whether className.allow should widen for this component is a policy call.
- Fix: No fix the engine can write; decided by hand.
- Examples: F001 `components/ai-elements/conversation.tsx:88`, F002 `components/ai-elements/conversation.tsx:155`, F003 `components/ai-elements/suggestion.tsx:48`.
- Findings: F001, F002, F003, F004.

### G02: color-literal `text-red-500` (True drift)

- What: text-red-500 references the Tailwind default palette (--color-red-500), not a system token.
- Spread: 4 findings in 2 files, at error. Involves `color.destructive`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `text-destructive` (nearest). destructive is the system's token for this role. Chosen by role, not by value; verify it reads correctly here.
- Examples: F005 `components/chat/message.tsx:264`, F006 `components/chat/message.tsx:287`, F007 `components/chat/message.tsx:323`.
- Findings: F005, F006, F007, F008.

### G03: color-literal `text-white` (True drift)

- What: text-white references the Tailwind default palette (--color-white), not a system token.
- Spread: 3 findings in 2 files, at error. Involves `color.card`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `text-card` (nearest). Several tokens share this value. Pick by role: color.card, color.popover.
- Examples: F009 `components/chat/preview-attachment.tsx:47`, F010 `components/chat/weather.tsx:363`, F011 `components/chat/weather.tsx:412`.
- Findings: F009, F010, F011.

### G04: color-literal `bg-black/80` (True drift)

- What: bg-black/80 references the Tailwind default palette (--color-black), not a system token.
- Spread: 2 findings in 2 files, at error. Involves `color.foreground`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `bg-foreground` (nearest). Nearest by value: color.foreground = #060606. Verify the semantic role before applying.
- Examples: F012 `components/ui/alert-dialog.tsx:39`, F013 `components/ui/dialog.tsx:42`.
- Findings: F012, F013.

### G05: classname-policy `gap-1.5` (Needs a decision)

- What: className on Badge may not set gap. className on Badge is limited to: margin, flex-item, grid-item, position, display.
- Spread: 2 findings in 2 files, at warn. Involves `Badge`.
- Why this class: True by the component's contract, reported at warn: whether className.allow should widen for this component is a policy call.
- Fix: No fix the engine can write; decided by hand.
- Examples: F014 `components/ai-elements/tool.tsx:69`, F015 `components/chat/visibility-selector.tsx:117`.
- Findings: F014, F015.

### G06: classname-policy `px-4` (Needs a decision)

- What: className on Button may not set padding-inline. padding is owned by the size prop.
- Spread: 2 findings in 2 files, at warn. Involves `Button`.
- Why this class: True by the component's contract, reported at warn: whether className.allow should widen for this component is a policy call.
- Fix: No fix the engine can write; decided by hand.
- Examples: F016 `components/ai-elements/suggestion.tsx:48`, F017 `components/chat/chat-header.tsx:55`.
- Findings: F016, F017.

### G07: classname-policy `rounded-lg` (Needs a decision)

- What: className on Button may not set border-radius. border-radius is owned by the component; use a variant or a token.
- Spread: 2 findings in 2 files, at warn. Involves `Button`.
- Why this class: True by the component's contract, reported at warn: whether className.allow should widen for this component is a policy call.
- Fix: No fix the engine can write; decided by hand.
- Examples: F018 `components/chat/chat-header.tsx:55`, F019 `components/chat/visibility-selector.tsx:117`.
- Findings: F018, F019.

### G08: color-literal `text-white/60` (True drift)

- What: text-white/60 references the Tailwind default palette (--color-white), not a system token.
- Spread: 3 findings in 1 file, at error. Involves `color.card`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `text-card` (nearest). Several tokens share this value. Pick by role: color.card, color.popover.
- Examples: F020 `components/chat/weather.tsx:348`, F021 `components/chat/weather.tsx:404`, F022 `components/chat/weather.tsx:421`.
- Findings: F020, F021, F022.

### G09: color-literal `text-white/80` (True drift)

- What: text-white/80 references the Tailwind default palette (--color-white), not a system token.
- Spread: 3 findings in 1 file, at error. Involves `color.card`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `text-card` (nearest). Several tokens share this value. Pick by role: color.card, color.popover.
- Examples: F023 `components/chat/weather.tsx:347`, F024 `components/chat/weather.tsx:365`, F025 `components/chat/weather.tsx:380`.
- Findings: F023, F024, F025.

### G10: color-literal `bg-red-50` (True drift)

- What: bg-red-50 references the Tailwind default palette (--color-red-50), not a system token.
- Spread: 2 findings in 1 file, at error. Involves `color.destructive`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `bg-destructive` (nearest). destructive is the system's token for this role. Chosen by role, not by value; verify it reads correctly here.
- Examples: F026 `components/chat/message.tsx:264`, F027 `components/chat/message.tsx:287`.
- Findings: F026, F027.

## Fix path by class

### True drift

Fix in code, in group order. Apply exact fixes first; check each nearest fix by eye, since a neighbouring step can be a different design.

| Group | Rule | Found | Findings | Files |
|---|---|---|---|---|
| G02 | color-literal | `text-red-500` | F005, F006, F007, F008 | 2 |
| G03 | color-literal | `text-white` | F009, F010, F011 | 2 |
| G04 | color-literal | `bg-black/80` | F012, F013 | 2 |
| G08 | color-literal | `text-white/60` | F020, F021, F022 | 1 |
| G09 | color-literal | `text-white/80` | F023, F024, F025 | 1 |
| G10 | color-literal | `bg-red-50` | F026, F027 | 1 |
| G11 | color-literal | `bg-white/10` | F028, F029 | 1 |
| G12 | color-literal | `border-red-200` | F030, F031 | 1 |
| G13 | color-literal | `dark:bg-red-950/50` | F032, F033 | 1 |
| G14 | color-literal | `dark:text-neutral-50` | F034, F035 | 1 |
| G15 | color-literal | `text-blue-200` | F036, F037 | 1 |
| G16 | color-literal | `text-white/70` | F038, F039 | 1 |
| G17 | color-literal | `text-white/90` | F040, F041 | 1 |
| G18 | color-literal | `text-yellow-200` | F042, F043 | 1 |
| G19 | color-literal | `bg-amber-500` | F044 | 1 |
| G20 | color-literal | `bg-black/20` | F045 | 1 |
| G21 | color-literal | `bg-black/40` | F046 | 1 |
| G22 | color-literal | `bg-black/50` | F047 | 1 |
| G23 | color-literal | `bg-black/60` | F048 | 1 |
| G24 | color-literal | `bg-white/20` | F049 | 1 |
| G25 | color-literal | `dark:bg-neutral-900` | F050 | 1 |
| G26 | color-literal | `dark:bg-neutral-950` | F051 | 1 |
| G27 | color-literal | `data-[type=error]:text-red-600` | F052 | 1 |
| G28 | color-literal | `data-[type=success]:text-green-600` | F053 | 1 |
| G29 | color-literal | `hover:bg-black/80` | F054 | 1 |
| G30 | color-literal | `text-blue-600` | F055 | 1 |
| G31 | color-literal | `text-emerald-500` | F056 | 1 |
| G32 | color-literal | `text-green-600` | F057 | 1 |
| G33 | color-literal | `text-neutral-500` | F058 | 1 |
| G34 | color-literal | `text-orange-600` | F059 | 1 |
| G35 | color-literal | `text-red-400` | F060 | 1 |
| G36 | color-literal | `text-red-600` | F061 | 1 |
| G37 | color-literal | `text-yellow-600` | F062 | 1 |
| G38 | component-substitution | `<button className="flex size-6 cursor-pointer items-center justify-center rounde` | F063 | 1 |
| G39 | component-substitution | `<button className="flex size-7 items-center justify-center rounded-md text-muted` | F064 | 1 |
| G40 | component-substitution | `<button className="flex size-7 items-center justify-center rounded-md text-muted` | F065 | 1 |
| G41 | component-substitution | `<button className="rounded px-1.5 py-0.5 text-muted-foreground/50 transition-col` | F066 | 1 |
| G42 | component-substitution | `<button className="absolute top-1.5 right-1.5 flex size-5 items-center justify-c` | F067 | 1 |
| G43 | component-substitution | `<button className="flex w-full items-center rounded-2xl border border-border/30 ` | F068 | 1 |
| G44 | component-substitution | `<button className="inline-flex items-center justify-center gap-2 rounded-lg bg-f` | F069 | 1 |
| G45 | component-substitution | `<button className="inline-flex items-center justify-center rounded-lg border bor` | F070 | 1 |
| G46 | component-substitution | `<button className={cn( "flex items-center justify-center rounded-full p-3 text-m` | F071 | 1 |
| G47 | component-substitution | `<button className={cn( "flex size-7 items-center justify-center rounded-md text-` | F072 | 1 |
| G48 | component-substitution | `<button aria-label="Scroll to bottom" className={'absolute bottom-4 left-1/2 z-1` | F073 | 1 |
| G49 | component-substitution | `<button className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground tex` | F074 | 1 |
| G50 | component-substitution | `<button className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transiti` | F075 | 1 |
| G51 | component-substitution | `<button className="cursor pointer flex w-fit flex-row items-start justify-betwee` | F076 | 1 |
| G52 | component-substitution | `<button className="flex w-fit cursor-pointer flex-row items-center gap-2 rounded` | F077 | 1 |
| G53 | component-substitution | `<button className="group flex size-8 items-center justify-center rounded-lg bord` | F078 | 1 |
| G54 | component-substitution | `<button className="rounded-xl border border-border/30 bg-card/20 px-3 py-2.5 tex` | F079 | 1 |
| G55 | component-substitution | `<button className={cn( "flex w-full items-center gap-3 px-4 py-2.5 text-left tra` | F080 | 1 |
| G56 | component-substitution | `<button className="w-full px-1 py-0.5 text-left text-red-500" type="submit">` | F081 | 1 |
| G57 | spacing-literal | `has-[>kbd]:ml-[-0.15rem]` | F082 | 1 |
| G58 | spacing-literal | `has-[>kbd]:mr-[-0.15rem]` | F083 | 1 |
| G59 | token-reference | `toast-mobile:w-[356px]` | F084 | 1 |
| G60 | token-reference | `toast-mobile:w-fit` | F085 | 1 |

### Needs a decision

A decision for the team before any code changes: add the missing token, name the file as a foundation, or widen the component's className.allow. Each decision closes a whole group.

| Group | Rule | Found | Findings | Files |
|---|---|---|---|---|
| G01 | classname-policy | `rounded-full` | F001, F002, F003, F004 | 3 |
| G05 | classname-policy | `gap-1.5` | F014, F015 | 2 |
| G06 | classname-policy | `px-4` | F016, F017 | 2 |
| G07 | classname-policy | `rounded-lg` | F018, F019 | 2 |
| G61 | classname-policy | `dark:bg-background` | F086, F087 | 1 |
| G62 | classname-policy | `dark:hover:bg-muted` | F088, F089 | 1 |
| G63 | classname-policy | `[&>*:not(:first-child)]:rounded-l-md` | F090 | 1 |
| G64 | classname-policy | `[&>*:not(:last-child)]:rounded-r-md` | F091 | 1 |
| G65 | classname-policy | `**:data-[slot=command-input-wrapper]:h-auto` | F092 | 1 |
| G66 | classname-policy | `active:translate-y-0` | F093 | 1 |
| G67 | classname-policy | `bg-foreground` | F094 | 1 |
| G68 | classname-policy | `border` | F095 | 1 |
| G69 | classname-policy | `border-border/50` | F096 | 1 |
| G70 | classname-policy | `cursor-pointer` | F097 | 1 |
| G71 | classname-policy | `focus-visible:border-border/50` | F098 | 1 |
| G72 | classname-policy | `focus-visible:ring-0` | F099 | 1 |
| G73 | classname-policy | `hover:bg-foreground/90` | F100 | 1 |
| G74 | classname-policy | `hover:text-foreground` | F101 | 1 |
| G75 | classname-policy | `rounded-md` | F102 | 1 |
| G76 | classname-policy | `shadow-none` | F103 | 1 |
| G77 | classname-policy | `text-background` | F104 | 1 |
| G78 | classname-policy | `text-muted-foreground` | F105 | 1 |
| G79 | classname-policy | `text-xs` | F106 | 1 |
| G80 | classname-policy | `transition-colors` | F107 | 1 |
| G81 | classname-policy | `translate-x-[-50%]` | F108 | 1 |
| G82 | classname-policy | `whitespace-nowrap` | F109 | 1 |

### Intentional exception

Keep it and write the reason after the zengin-allow comment's colon, so the engine honours it and the next reader knows why; or remove the exception.

No group in the hand-review queue.

### False positive

Not a code change. Tune the definitions (a passthrough type, a foundation file) so the engine stops reporting it, and count it in the report's false-positive rate.

No group in the hand-review queue.

## Beyond the hand-review cap

Every finding is queued for hand review; the cap of 150 was not reached.

## What the scan cannot see

- Drift outside the engine's seven rule kinds (color-literal, spacing-literal, token-reference, unknown-prop, unknown-prop-value, classname-policy, component-substitution): behavioural, architectural and most accessibility drift.
- What renders at runtime: class names built from runtime values, styles set from JavaScript, and the visual result of an override.
- Files outside the configured scope, and any system the definitions do not describe.
- Whether a finding matters to a user. That judgement is the hand review.

## Evidence

Every finding id above resolves in findings.json, with its `file:line`, rule, found value, the token or component involved, its proposed class and the reason for it. run.json records the run.
