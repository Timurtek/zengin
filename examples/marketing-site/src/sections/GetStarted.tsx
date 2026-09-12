import { Button } from "@zengin/ui";
import { CodeBlock } from "../components/CodeBlock";
import { INSTALL, REPO } from "../content";

export function GetStarted() {
  return (
    <section className="section" id="get-started">
      <div className="wrap start">
        <div className="start__copy">
          <span className="eyebrow">Get started</span>
          <h2 className="title">A clone, a config, a check</h2>
          <p>
            The packages publish to npm as @zengin/engine, @zengin/cli, @zengin/mcp, @zengin/hook, @zengin/rollup, @zengin/adapter-shadcn and @zengin/ui with the first release. Until
            then, a local clone is the install, and the CLI runs from packages/cli/dist.
          </p>
          <p>The config is one line when the system is an installed package. A shadcn project gets its definitions derived; anything else gets a template with the questions to answer.</p>
          <div className="hero__actions">
            <Button asChild tone="primary">
              <a href={REPO}>Open the repository</a>
            </Button>
            <Button asChild variant="ghost">
              <a href={`${REPO}/blob/main/skills/zengin/SKILL.md`}>The agent skill</a>
            </Button>
          </div>
        </div>
        <CodeBlock title="terminal">{INSTALL}</CodeBlock>
      </div>
    </section>
  );
}
