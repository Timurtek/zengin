# zenginui

The Zengin command line under its unscoped name, so `npx zenginui` works the way people expect.

```bash
npx zenginui create acme --template saas
cd acme && npm install && npm run dev
```

Everything runs from [`@zenginui/cli`](../cli); this package is one file that imports it. The installed command is still called `zengin` (`npx zenginui check`, or `zengin check` once it is a dev dependency), and the same commands exist under `@zenginui/cli`.
