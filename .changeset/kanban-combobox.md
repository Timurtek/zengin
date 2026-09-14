---
"@zenginui/ui": minor
"@zenginui/registry": patch
---

Kanban and Combobox, the last two components field test four asked for.

**Kanban** is a board of columns you move cards between. Every operations app rebuilds this, and the rebuild
is nearly always pointer-only: HTML5 drag events, a drop handler, done. That version cannot be used with a
keyboard at all, and drag-and-drop has no accessible fallback of its own, so the keyboard path is the
difference between a component and a demo. Space lifts a card, the arrow keys move it between and within
columns, Enter drops it and Escape puts it back, with every step announced because the move cannot be seen.
Both paths end in the same `onMove`. The board is controlled: it reports where a card should go and draws
what it is given, so an app that needs to save the move, refuse it, or animate it stays in charge.

**Combobox** is a text field that filters a list, for one value or several. Select is right up to a few
dozen options; past that the answer is typing, which is a different component rather than a bigger Select.
It follows the WAI-ARIA combobox pattern properly, which is the reason to have it in a system: focus stays
in the input and owns the keyboard, the list is a real listbox, and the current option is pointed at with
`aria-activedescendant` instead of by moving focus. Hand-rolled comboboxes usually get that last part wrong,
and a screen reader then reads nothing as the user arrows through. Arrow keys wrap and step over disabled
options, Backspace on an empty field takes the last chip, and groups, hints, an error and three sizes come
with it.

Also fixed: the story-requirements check counted type-only imports as components, so an item whose story
imported its own `type KanbanMove` looked like it needed a component called KanbanMove. Types are erased at
build time and can never be a missing component at runtime.
