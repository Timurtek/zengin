import { Button } from "@zenginui/ui";
import { CodeBlock } from "../components/CodeBlock";
import { INSTALL, REPO } from "../content";

export function GetStarted() {
  return (
    <section className="section" id="get-started">
      <div className="wrap start">
        <div className="start__copy">
          <span className="eyebrow">Get started</span>
          <h2 className="title">One command, then build</h2>
          <p>
            A new project arrives with the components copied into src/components/ui, yours to edit, the definitions in zengin/, a brand file, Storybook, and the engine, MCP server and
            hook already wired. This page is the marketing template; the review workspace is the other one.
          </p>
          <p>An existing project keeps its own system: a shadcn project gets its definitions derived, anything else gets a config template with the questions to answer.</p>
          <div className="hero__actions">
            <Button asChild tone="primary">
              <a href={REPO} target="_blank" rel="noreferrer">Open the repository</a>
            </Button>
            <Button asChild variant="ghost">
              <a href={`${REPO}/blob/main/skills/zengin/SKILL.md`} target="_blank" rel="noreferrer">The agent skill</a>
            </Button>
          </div>
        </div>
        <CodeBlock title="terminal">{INSTALL}</CodeBlock>
      </div>
    </section>
  );
}
