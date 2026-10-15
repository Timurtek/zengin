# Design System Drift Audit: shadcn-ui/taxonomy (DRAFT)

> DRAFT for review. Not for the client until it has been reviewed and edited. Every class below is proposed by rule and confirmed by hand before the report leaves.

Run: shadcn-ui/taxonomy at 298a885, against @/components/ui@0.0.0. 117 files checked in 0.4 seconds by @zenginui/cli@0.9.0, 2026-10-15.

## Summary

- This run reported 35 findings in 31 groups. A group is one rule and one found value with one proposed class: one decision.
- 35 findings in 31 groups are queued for hand review, up to the cap of 150, taken in rank order (severity times the number of files). 0 findings past the cap are summarised. 35 + 0 = 35.
- Confirmed by hand so far: 0 of 35. Until a reviewer confirms a finding, its class is a proposal made by rule.
- False positives proposed in the queue: 0 of 35. The rate is stated once each one has been confirmed by hand.
- Every number here comes from this run and is reconciled above. No figure from another run is quoted.

| Proposed class | Findings | Groups |
|---|---|---|
| True drift | 31 | 27 |
| Needs a decision | 4 | 4 |
| Intentional exception | 0 | 0 |
| False positive | 0 | 0 |
| Queued for hand review | 35 | 31 |

## Top issues

### G01: token-reference `hover:text-brand` (True drift)

- What: No token matches "hover:text-brand".
- Spread: 3 findings in 2 files, at error. Involves `hover:text-brand`.
- Why this class: token-reference at error, with a fix to be written by hand.
- Fix: No fix the engine can write; decided by hand.
- Examples: F001 `app/(auth)/login/page.tsx:43`, F002 `app/(auth)/register/page.tsx:42`, F003 `app/(auth)/register/page.tsx:49`.
- Findings: F001, F002, F003.

### G02: color-literal `text-red-600` (True drift)

- What: text-red-600 references the Tailwind default palette (--color-red-600), not a system token.
- Spread: 2 findings in 2 files, at error. Involves `color.destructive`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `text-destructive` (nearest). destructive is the system's token for this role. Chosen by role, not by value; verify it reads correctly here.
- Examples: F004 `components/user-auth-form.tsx:78`, F005 `components/user-name-form.tsx:102`.
- Findings: F004, F005.

### G03: spacing-literal `p-[1px]` (True drift)

- What: Arbitrary spacing value. 1px is not on the spacing scale.
- Spread: 2 findings in 1 file, at error. Involves `p-[1px]`.
- Why this class: spacing-literal at error, with an exact fix.
- Fix: `p-px` (exact)
- Examples: F006 `components/ui/scroll-area.tsx:36`, F007 `components/ui/scroll-area.tsx:38`.
- Findings: F006, F007.

### G04: color-literal `bg-black` (True drift)

- What: bg-black references the Tailwind default palette (--color-black), not a system token.
- Spread: 1 finding in 1 file, at error. Involves `color.primary.foreground`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `bg-primary-foreground` (nearest). Nearest by value: color.primary.foreground = #020205 in the dark theme. Verify the semantic role before applying.
- Examples: F008 `components/mdx-components.tsx:135`.
- Findings: F008.

### G05: color-literal `bg-gray-800` (True drift)

- What: bg-gray-800 references the Tailwind default palette (--color-gray-800), not a system token.
- Spread: 1 finding in 1 file, at error. Involves `color.border`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `bg-border` (nearest). Nearest by value: color.border = #1d283a in the dark theme. Verify the semantic role before applying.
- Examples: F009 `components/tailwind-indicator.tsx:5`.
- Findings: F009.

### G06: color-literal `bg-red-50` (True drift)

- What: bg-red-50 references the Tailwind default palette (--color-red-50), not a system token.
- Spread: 1 finding in 1 file, at error. Involves `color.destructive`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `bg-destructive` (nearest). destructive is the system's token for this role. Chosen by role, not by value; verify it reads correctly here.
- Examples: F010 `components/callout.tsx:18`.
- Findings: F010.

### G07: color-literal `bg-red-600` (True drift)

- What: bg-red-600 references the Tailwind default palette (--color-red-600), not a system token.
- Spread: 1 finding in 1 file, at error. Involves `color.destructive`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `bg-destructive` (nearest). destructive is the system's token for this role. Chosen by role, not by value; verify it reads correctly here.
- Examples: F011 `components/post-operations.tsx:100`.
- Findings: F011.

### G08: color-literal `bg-slate-50` (True drift)

- What: bg-slate-50 references the Tailwind default palette (--color-slate-50), not a system token.
- Spread: 1 finding in 1 file, at error. Involves `color.primary.foreground`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `bg-primary-foreground` (nearest). Several tokens share this value. Pick by role: color.primary.foreground, color.destructive.foreground.
- Examples: F012 `app/(marketing)/page.tsx:73`.
- Findings: F012.

### G09: color-literal `bg-white` (True drift)

- What: bg-white references the Tailwind default palette (--color-white), not a system token.
- Spread: 1 finding in 1 file, at error. Involves `color.background`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `bg-background` (nearest). Several tokens share this value. Pick by role: color.background, color.popover, color.card.
- Examples: F013 `app/(marketing)/blog/[...slug]/page.tsx:135`.
- Findings: F013.

### G10: color-literal `bg-yellow-50` (True drift)

- What: bg-yellow-50 references the Tailwind default palette (--color-yellow-50), not a system token.
- Spread: 1 finding in 1 file, at error. Involves `color.primary.foreground`.
- Why this class: color-literal at error, with a nearest fix.
- Fix: `bg-primary-foreground` (nearest). Nearest by value: color.primary.foreground = #f8fafc. Verify the semantic role before applying.
- Examples: F014 `components/callout.tsx:19`.
- Findings: F014.

## Fix path by class

### True drift

Fix in code, in group order. Apply exact fixes first; check each nearest fix by eye, since a neighbouring step can be a different design.

| Group | Rule | Found | Findings | Files |
|---|---|---|---|---|
| G01 | token-reference | `hover:text-brand` | F001, F002, F003 | 2 |
| G02 | color-literal | `text-red-600` | F004, F005 | 2 |
| G03 | spacing-literal | `p-[1px]` | F006, F007 | 1 |
| G04 | color-literal | `bg-black` | F008 | 1 |
| G05 | color-literal | `bg-gray-800` | F009 | 1 |
| G06 | color-literal | `bg-red-50` | F010 | 1 |
| G07 | color-literal | `bg-red-600` | F011 | 1 |
| G08 | color-literal | `bg-slate-50` | F012 | 1 |
| G09 | color-literal | `bg-white` | F013 | 1 |
| G10 | color-literal | `bg-yellow-50` | F014 | 1 |
| G11 | color-literal | `border-red-900` | F015 | 1 |
| G12 | color-literal | `border-yellow-900` | F016 | 1 |
| G13 | color-literal | `group-[.destructive]:hover:text-red-50` | F017 | 1 |
| G14 | color-literal | `group-[.destructive]:text-red-300` | F018 | 1 |
| G15 | color-literal | `text-gray-500` | F019 | 1 |
| G16 | color-literal | `text-white` | F020 | 1 |
| G17 | component-substitution | `<button type="submit" className={cn(buttonVariants(), className)} disabled={isSa` | F021 | 1 |
| G18 | component-substitution | `<button type="submit" className={cn(buttonVariants())} disabled={isLoading} >` | F022 | 1 |
| G19 | component-substitution | `<button type="button" className={cn(buttonVariants({ variant: "outline" }))} onC` | F023 | 1 |
| G20 | component-substitution | `<button onClick={onClick} className={cn( buttonVariants({ variant }), { "cursor-` | F024 | 1 |
| G21 | component-substitution | `<button className={cn(buttonVariants())} disabled={isLoading}>` | F025 | 1 |
| G22 | component-substitution | `<button type="submit" className={cn(buttonVariants())}>` | F026 | 1 |
| G24 | spacing-literal | `px-[0.3rem]` | F028 | 1 |
| G25 | spacing-literal | `py-[0.2rem]` | F029 | 1 |
| G26 | token-reference | `divide-border-200` | F030 | 1 |
| G27 | token-reference | `placeholder:text-foreground-muted` | F031 | 1 |
| G28 | token-reference | `text-on-popover` | F032 | 1 |

### Needs a decision

A decision for the team before any code changes: add the missing token, name the file as a foundation, or widen the component's className.allow. Each decision closes a whole group.

| Group | Rule | Found | Findings | Files |
|---|---|---|---|---|
| G23 | spacing-literal | `marginLeft: "-3px"` | F027 | 1 |
| G29 | classname-policy | `!pl-14` | F033 | 1 |
| G30 | classname-policy | `px-0` | F034 | 1 |
| G31 | classname-policy | `sm:pr-12` | F035 | 1 |

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
