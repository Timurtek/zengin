import { Badge, Button, Icon, Table } from "@zenginui/ui";
import { CodeBlock } from "../components/CodeBlock";
import { lazy, Suspense } from "react";

/* Below the fold, and fifty kilobytes of library: it arrives after the page, into a box of its own height. */
const LoopDiagram = lazy(() => import("../components/LoopDiagram").then((m) => ({ default: m.LoopDiagram })));
import { REPO } from "../content";

/** Where each neighbouring tool stops. The honest reading: each is good at its column, and the gap is the pair. */
const COMPARISON: { tool: string; note: string; cells: ("yes" | "partly" | "no")[] }[] = [
  { tool: "Component libraries", note: "MUI, Chakra", cells: ["yes", "no", "no", "no", "no"] },
  { tool: "shadcn/ui", note: "copied into your project", cells: ["yes", "yes", "no", "no", "no"] },
  { tool: "Token lint plugins", note: "rules you hand-write", cells: ["no", "no", "partly", "yes", "no"] },
  { tool: "Storybook, zeroheight", note: "for people to read", cells: ["no", "no", "partly", "no", "no"] },
  { tool: "Zengin", note: "generate, own, enforce", cells: ["yes", "yes", "yes", "yes", "yes"] },
];

const COLUMNS = ["Components", "You own it", "Machine-readable contracts", "Checked as code is written", "Drift across repositories"];

const MARK = { yes: "Yes", partly: "Partly", no: "No" } as const;

/**
 * The positioning page, built from the same parts as the home page.
 *
 * Every block here is a `.section` with a `.wrap` and a `.section__head`, the eyebrow in the label column and
 * the headline beside it, because that ruled rhythm is what the rest of the site is. The page had its own
 * heading sizes, its own leads, its own card and its own panel before this, which read as a different site
 * wearing the same colours. Only the comparison table's cells keep classes of their own; the diagram is a
 * Flow, the same component the home page's path uses.
 */
export function Why() {
  return (
    <>
      <section className="section section--opening" id="why">
        <div className="wrap">
          <div className="section__head">
            <span className="eyebrow">Why Zengin</span>
            <div className="section__head-text">
              <h1 className="title">A design system a machine can hold you to</h1>
              <p className="lead">
                A design system is a set of rules nobody can enforce at the moment code is written. Tokens live in a design file, component contracts live in a
                documentation site, and the rules themselves live in a reviewer&rsquo;s head &mdash; so drift is caught days later, if at all. Coding agents made
                that acute: they produce interfaces that look right and are quietly off-system, faster than any team can review them.
              </p>
              <p className="lead">
                Zengin&rsquo;s answer is that the system your project owns should be machine-readable, and something should check every edit against it as it
                happens.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="loop">
        <div className="wrap">
          <div className="section__head">
            <span className="eyebrow">The loop</span>
            <div className="section__head-text">
              <h2 className="title">Every edit meets the same judgement</h2>
              <p className="lead">
                An edit by a person or an agent reaches the hook, which runs the engine against the project&rsquo;s own definitions. The write is blocked with
                the fix in hand, and the loop returns to the edit.
              </p>
            </div>
          </div>
          <Suspense fallback={<div className="flow flow--loop" aria-hidden="true" />}>
            <LoopDiagram />
          </Suspense>

          <div className="cells">
            <div className="cell why__point">
              <h3>The definitions are yours</h3>
              <p>
                <code>tokens.json</code> and <code>components.json</code> sit in your repository. They say what the tokens are and what each component accepts and
                owns &mdash; which props govern which CSS properties. You edit them, and they are what the engine checks against, so the rules are your
                system&rsquo;s rather than a plugin author&rsquo;s.
              </p>
            </div>
            <div className="cell why__point">
              <h3>The engine is deterministic</h3>
              <p>
                It parses TSX and CSS, resolves class names through your own stylesheets, and returns violations with ranges and confidence-graded fixes. Same
                input, same answer, in under a second, with no model involved. The thing checking an agent cannot itself be a guess.
              </p>
            </div>
            <div className="cell why__point">
              <h3>One engine, four surfaces</h3>
              <p>
                The edit hook above, an MCP server the agent can ask before it writes, the CLI in pre-commit and CI, and a rollup that shows drift across
                repositories over time. One judgement, four places to meet it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="gap">
        <div className="wrap">
          <div className="section__head">
            <span className="eyebrow">The gap</span>
            <div className="section__head-text">
              <h2 className="title">Where the others stop</h2>
              <p className="lead">
                Each of these is good at its own column, and saying so is the point: the gap is not a missing feature, it is a pair of capabilities nobody puts
                together.
              </p>
            </div>
          </div>
          <Table aria-label="Where each neighbouring tool stops" density="sm">
            <Table.Head>
              <Table.Row>
                <Table.HeadCell>Tool</Table.HeadCell>
                {COLUMNS.map((c) => (
                  <Table.HeadCell key={c}>{c}</Table.HeadCell>
                ))}
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {COMPARISON.map((row) => (
                <Table.Row key={row.tool}>
                  <Table.Cell>
                    <span className="why__tool">{row.tool}</span>
                    <span className="why__tool-note">{row.note}</span>
                  </Table.Cell>
                  {row.cells.map((cell, i) => (
                    <Table.Cell key={COLUMNS[i]}>
                      <Badge size="sm" tone={cell === "yes" ? "primary" : "neutral"} variant={cell === "no" ? "outline" : "soft"}>
                        {MARK[cell]}
                      </Badge>
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          <p className="rules__note">
            Component libraries hand you components and nothing knows your rules, because the rules are theirs. shadcn/ui made the important move &mdash; the
            source is copied in, so you own it &mdash; and ownership is where it stops: once the code is yours, nothing records what it was supposed to be. Lint
            plugins check at the right moment, with generic rules written by hand that know nothing about your Button&rsquo;s contract. Storybook and zeroheight
            document contracts beautifully for people, and cannot enforce anything.
          </p>
        </div>
      </section>

      <section className="section" id="claim">
        <div className="wrap">
          <div className="section__head">
            <span className="eyebrow">The claim</span>
            <div className="section__head-text">
              <h2 className="title">Generating it and enforcing it are one product</h2>
              <p className="lead">
                A system you own, whose rules are written down in a form a machine can check, checked at the moment code is written. That combination is only
                possible because generating the project and enforcing it are the same product: the generator knows what it wrote, so it can say what the code was
                supposed to be for as long as the project lives.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="evidence">
        <div className="wrap">
          <div className="section__head">
            <span className="eyebrow">Evidence</span>
            <div className="section__head-text">
              <h2 className="title">What has been tested</h2>
              <p className="lead">Four field tests, every violation read by hand, and the worst bug the project has had found by one of them.</p>
            </div>
          </div>
          <div className="cells">
            <div className="cell why__point">
              <h3>422 violations, classified by hand</h3>
              <p>
                Three public codebases &mdash; shadcn/taxonomy, vercel/ai-chatbot and umami, the last of which is not a shadcn project at all. Every violation was
                read and classified; zero false positives remain, and each miss became a regression test in the engine.
              </p>
            </div>
            <div className="cell why__point">
              <h3>It found its own worst bug</h3>
              <p>
                A fourth test built a real application on Zengin the way a stranger would, from the published packages. It found that the edit hook had never run
                for anyone but its author: the generated config named a binary an agent cannot launch. Fixed, published, and written down rather than hidden.
              </p>
            </div>
            <div className="cell why__point">
              <h3>The page you are reading</h3>
              <p>
                This site is built on Zengin UI and checked by the engine on every push, along with every template in the registry. The report over all of them is
                public at <a href="/rollup/">the rollup</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="start">
        <div className="wrap start">
          <div className="start__copy">
            <span className="eyebrow">Start</span>
            <h2 className="title">One command, then build</h2>
            <p>
              The project arrives with the components copied in, the definitions in <code>zengin/</code>, and the engine, MCP server and hook already wired. The
              docs cover the rules, the config and every command.
            </p>
            <div className="hero__actions">
              <Button asChild tone="primary">
                <a href="/docs/">Read the docs</a>
              </Button>
              <Button asChild variant="soft" trailingIcon={<Icon.ExternalLink />}>
                <a href={REPO} target="_blank" rel="noreferrer">
                  The source on GitHub
                </a>
              </Button>
            </div>
          </div>
          <CodeBlock title="terminal">npm create zengin@latest acme -- --template saas</CodeBlock>
        </div>
      </section>
    </>
  );
}
