/**
 * How an agent session reaches Zengin, in one place because three packages emit it: `zengin create` writes
 * it, `zengin doctor` checks it, and `zengin-hook settings` prints it.
 *
 * It lives in the engine because that is the only package all three depend on. It was in the registry first,
 * and the hook could not reach it from there — so the hook's own generator kept printing a bare
 * `zengin-hook` command and a matcher without `Bash`, which is to say it told people to write the exact
 * configuration the other two had been fixed to stop writing. A constant that cannot be imported by everyone
 * who needs it is not one source of truth.
 *
 * Everything goes through `npx --no-install`. The bins live in `node_modules/.bin`, which is on PATH inside
 * an npm script and nowhere else, and an agent launches these directly — so a bare `zengin-mcp` starts
 * nothing and a bare `zengin-hook` never fires, both silently. `--no-install` keeps npx off the network: the
 * project's own version, or a clear failure.
 *
 * `Bash` is in the matcher because the three editing tools are not the only way an agent changes a file; for
 * a shell payload the hook asks the working tree what changed.
 */
export const AGENT_WIRING = {
  server: "zengin",
  command: "npx",
  args: ["--no-install", "zengin-mcp"],
  hookCommand: "npx --no-install zengin-hook",
  hookMatcher: "Write|Edit|MultiEdit|Bash",
  configEnv: "ZENGIN_CONFIG",
  configFile: "zengin.config.yaml",
} as const;

/** The PostToolUse block `create` writes and `zengin-hook settings` prints, from the one definition above. */
export function hookSettings(): { hooks: { PostToolUse: { matcher: string; hooks: { type: string; command: string; timeout: number; statusMessage: string }[] }[] } } {
  return {
    hooks: {
      PostToolUse: [
        {
          matcher: AGENT_WIRING.hookMatcher,
          hooks: [{ type: "command", command: AGENT_WIRING.hookCommand, timeout: 30, statusMessage: "Checking against the design system..." }],
        },
      ],
    },
  };
}
