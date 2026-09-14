---
"@zenginui/engine": minor
"@zenginui/adapter-css": minor
"@zenginui/cli": minor
"@zenginui/ui": patch
---

`owns` says who controls a property, accurately.

A manifest entry's `owns` names the prop a reader should reach for when the engine rejects their `className`,
so naming the wrong one sends them to a prop that does not do the thing. Running `zengin define` against
Zengin UI's own components surfaced eleven places where the manifest and the stylesheets disagreed. Two were
the manifest being wrong and the rest were the deriver being wrong, which is the more useful half.

- **A property may be controlled by more than one prop, and now says so.** A Button's background takes its hue
  from `tone` and its treatment from `variant`; the message reads "background-color is owned by the variant
  and tone props" instead of picking a winner.
- **A rule that styles a child is no longer attributed to the component.** `.z-tabs[data-variant="pill"]
  .z-tabs__list` styles the list, and Tabs does not own its radius. Only the compound a rule actually styles
  is read.
- **A rule behind a pseudo-class is a state, not a prop.** `.z-card[data-interactive]:hover` sets a border
  color because the pointer is over it, which says nothing about which prop controls it.
- **Reading a project's own source no longer guesses which element's attributes pass through.** The package
  path still guesses from a component's name and from `ComponentProps` without a literal, because a manifest
  derived from a stranger's `.d.ts` is better off with a likely answer than none. Source is not: this
  project's Dialog is a Radix dialog rather than an HTML one, and a wrong `extends` quietly widens what
  `unknown-prop` accepts.
- **`zengin define --force`** resolves a disagreement in the stylesheet's favour instead of only reporting it,
  which is the right way round when the manifest was written by hand and has fallen behind the CSS.

Zengin UI's own manifest is regenerated from its stylesheets and now disagrees with them nowhere.
