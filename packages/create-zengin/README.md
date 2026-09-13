# create-zengin

`npm create zengin` is the way to start: a project on Zengin UI that owns its components, with the engine, the MCP server, the hook and Storybook wired.

```bash
npm create zengin@latest acme -- --template saas
cd acme && npm install && npm run dev
```

The word `create` is what this package adds; everything else is [`@zenginui/cli`](../cli), which the new project has as a dev dependency, so inside it the commands are `npx zengin check`, `npx zengin theme brutal`, `npx zengin upgrade`, and so on.
