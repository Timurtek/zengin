---
"@zenginui/engine": minor
"@zenginui/adapter-css": minor
"@zenginui/cli": minor
"@zenginui/registry": patch
---

Two ways a system adapts without drifting.

`zengin define` teaches the manifest about the components a project writes itself. A component under an
ownership path had the contract and substitution rules switched off for its own file, which left the rest of
the project unable to be held to it: a misspelled prop or an invented variant on your own component passed.
The command reads the props from the component's TypeScript types, the defaults from its own destructuring,
`extends` from the element whose attributes pass through, and `owns` from its stylesheet, attributing a
property to the prop whose data attribute governs it. It exports the component from the system's barrel at the
same time, because a definition nobody can import changes nothing. The merge never removes: a prop the source
cannot see survives, a hand-declared enum beats a type the walker could not open, and a disagreement about who
controls a property is reported rather than resolved.

`surfaces` in the config declare that part of a project is a different design on purpose. A marketing page and
an application are not the same design, and the only previous ways to say so were two systems or a suppression,
which both spell a deliberate difference as drift. A surface may layer token values and change a component's
props, `owns` and `className` policy; it may not add or remove components. Each file is checked against the
first surface whose `include` matches it, so `shape="pill"` is correct on marketing and still a violation in the
application, and the inventory records which surface checked each file.
