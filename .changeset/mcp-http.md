---
"@zenginui/mcp": minor
---

`zengin-mcp --http` serves the same tools over Streamable HTTP at `/mcp`, for clients that take a URL instead of launching a process. Stateless, so instances can sit behind a load balancer; `GET /` answers health checks. It binds to 127.0.0.1:3333 by default (`--port`, `$PORT`, `--host`) and accepts only loopback `Host` headers there, against DNS rebinding (`--allowed-host` adds a reverse proxy's name). Off loopback it refuses to start without `ZENGIN_MCP_TOKEN`, which clients send as a bearer token, or `--public`, which serves without auth and leaves out `zengin_get_violations`, the tool that returns file contents. `createServer` takes `{ files: false }` for the same.
