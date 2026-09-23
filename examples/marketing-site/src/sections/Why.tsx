import { Badge, Button, Card, CodeBlock, Icon, Table } from "@zenginui/ui";
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

export function Why() {
  return (
    <main className="why">
      <div className="wrap">
        <header className="why__head">
          <span className="eyebrow">Why Zengin</span>
          <h1 className="why__title">A design system a machine can hold you to</h1>
          <p className="why__lead">
            A design system is a set of rules nobody can enforce at the moment code is written. Tokens live in a design file, component contracts live in a
            documentation site, and the rules themselves live in a reviewer&rsquo;s head &mdash; so drift is caught days later, if at all. Coding agents made that
            acute: they produce interfaces that look right and are quietly off-system, faster than any team can review them.
          </p>
          <p className="why__lead">
            Zengin&rsquo;s answer is that the system your project owns should be machine-readable, and something should check every edit against it as it happens.
          </p>
        </header>

        <section className="why__block" aria-labelledby="why-loop">
          <h2 className="title" id="why-loop">
            The loop
          </h2>
          <svg className="why-di" viewBox="0 0 680 268" role="img" aria-labelledby="why-loop-t why-loop-d">
            <title id="why-loop-t">The Zengin enforcement loop</title>
            <desc id="why-loop-d">
              An edit by a person or an agent triggers the hook, which runs the engine against the project&rsquo;s own definitions; the write is blocked with the fix,
              and the loop returns to the edit.
            </desc>
            <defs>
              <marker id="why-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path className="why-di__head" d="M2 1L8 5L2 9" />
              </marker>
            </defs>
            <rect className="why-di__box why-di__box--system" x="345" y="24" width="130" height="56" rx="4" />
            <text className="why-di__t" x="410" y="50" textAnchor="middle">
              Definitions
            </text>
            <text className="why-di__s" x="410" y="68" textAnchor="middle">
              your own files
            </text>
            <line className="why-di__wire" x1="410" y1="80" x2="410" y2="118" markerEnd="url(#why-arrow)" />

            <rect className="why-di__box" x="45" y="124" width="130" height="64" rx="4" />
            <text className="why-di__t" x="110" y="152" textAnchor="middle">
              Edit
            </text>
            <text className="why-di__s" x="110" y="172" textAnchor="middle">
              you or an agent
            </text>

            <rect className="why-di__box why-di__box--surface" x="195" y="124" width="130" height="64" rx="4" />
            <text className="why-di__t" x="260" y="152" textAnchor="middle">
              Hook
            </text>
            <text className="why-di__s" x="260" y="172" textAnchor="middle">
              at write time
            </text>

            <rect className="why-di__box why-di__box--system" x="345" y="124" width="130" height="64" rx="4" />
            <text className="why-di__t" x="410" y="152" textAnchor="middle">
              Engine
            </text>
            <text className="why-di__s" x="410" y="172" textAnchor="middle">
              deterministic
            </text>

            <rect className="why-di__box why-di__box--surface" x="495" y="124" width="130" height="64" rx="4" />
            <text className="why-di__t" x="560" y="152" textAnchor="middle">
              Blocked
            </text>
            <text className="why-di__s" x="560" y="172" textAnchor="middle">
              with the fix
            </text>

            <line className="why-di__wire" x1="177" y1="156" x2="193" y2="156" markerEnd="url(#why-arrow)" />
            <line className="why-di__wire" x1="327" y1="156" x2="343" y2="156" markerEnd="url(#why-arrow)" />
            <line className="why-di__wire" x1="477" y1="156" x2="493" y2="156" markerEnd="url(#why-arrow)" />
            <path className="why-di__wire" d="M560 188 V230 H110 V194" markerEnd="url(#why-arrow)" />
          </svg>

          <div className="why__points">
            <Card padding="md">
              <h3 className="why__point-title">The definitions are yours</h3>
              <p className="why__point-body">
                <code>tokens.json</code> and <code>components.json</code> sit in your repository. They say what the tokens are and what each component accepts and
                owns &mdash; which props govern which CSS properties. You edit them, and they are what the engine checks against, so the rules are your
                system&rsquo;s rather than a plugin author&rsquo;s.
              </p>
            </Card>
            <Card padding="md">
              <h3 className="why__point-title">The engine is deterministic</h3>
              <p className="why__point-body">
                It parses TSX and CSS, resolves class names through your own stylesheets, and returns violations with ranges and confidence-graded fixes. Same
                input, same answer, in under a second, with no model involved. The thing checking an agent cannot itself be a guess.
              </p>
            </Card>
            <Card padding="md">
              <h3 className="why__point-title">One engine, four surfaces</h3>
              <p className="why__point-body">
                The edit hook above, an MCP server the agent can ask before it writes, the CLI in pre-commit and CI, and a rollup that shows drift across
                repositories over time. One judgement, four places to meet it.
              </p>
            </Card>
          </div>
        </section>

        <section className="why__block" aria-labelledby="why-gap">
          <h2 className="title" id="why-gap">
            Where the others stop
          </h2>
          <p className="why__lead">
            Each of these is good at its own column, and saying so is the point: the gap is not a missing feature, it is a pair of capabilities nobody puts
            together.
          </p>
          <div className="why__table">
            <Table density="sm">
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
          </div>
          <p className="why__lead">
            Component libraries hand you components and nothing knows your rules, because the rules are theirs. shadcn/ui made the important move &mdash; the
            source is copied in, so you own it &mdash; and ownership is where it stops: once the code is yours, nothing records what it was supposed to be. Lint
            plugins check at the right moment, with generic rules written by hand that know nothing about your Button&rsquo;s contract. Storybook and zeroheight
            document contracts beautifully for people, and cannot enforce anything.
          </p>
        </section>

        <section className="why__block" aria-labelledby="why-claim">
          <h2 className="title" id="why-claim">
            The claim
          </h2>
          <p className="why__lead why__lead--wide">
            A system you own, whose rules are written down in a form a machine can check, checked at the moment code is written. That combination is only
            possible because generating the project and enforcing it are the same product: the generator knows what it wrote, so it can say what the code was
            supposed to be for as long as the project lives.
          </p>
        </section>

        <section className="why__block" aria-labelledby="why-evidence">
          <h2 className="title" id="why-evidence">
            What has been tested
          </h2>
          <div className="why__points">
            <Card padding="md">
              <h3 className="why__point-title">422 violations, classified by hand</h3>
              <p className="why__point-body">
                Three public codebases &mdash; shadcn/taxonomy, vercel/ai-chatbot and umami, the last of which is not a shadcn project at all. Every violation was
                read and classified; zero false positives remain, and each miss became a regression test in the engine.
              </p>
            </Card>
            <Card padding="md">
              <h3 className="why__point-title">It found its own worst bug</h3>
              <p className="why__point-body">
                A fourth test built a real application on Zengin the way a stranger would, from the published packages. It found that the edit hook had never run
                for anyone but its author: the generated config named a binary an agent cannot launch. Fixed, published, and written down rather than hidden.
              </p>
            </Card>
            <Card padding="md">
              <h3 className="why__point-title">The page you are reading</h3>
              <p className="why__point-body">
                This site is built on Zengin UI and checked by the engine on every push, along with every template in the registry. The report over all of them is
                public at <a href="/rollup/">the rollup</a>.
              </p>
            </Card>
          </div>
        </section>

        <section className="why__cta" aria-labelledby="why-start">
          <h2 className="title" id="why-start">
            Start with one command
          </h2>
          <CodeBlock code="npm create zengin@latest acme -- --template saas" language="bash" />
          <div className="why__actions">
            <Button asChild tone="primary">
              <a href="/docs/">Read the docs</a>
            </Button>
            <Button asChild variant="soft" trailingIcon={<Icon.ExternalLink />}>
              <a href={REPO} target="_blank" rel="noreferrer">
                The source on GitHub
              </a>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
