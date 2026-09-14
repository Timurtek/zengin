import { Badge, Button, Card } from "@zenginui/ui";
import { useState } from "react";
import { PATH, PATH_NOTE } from "../content";

/**
 * The adoption path as a diagram, because the four surfaces are the hard part to explain in prose: one engine,
 * reached from four places, at four different moments.
 *
 * Everything is laid out in one percentage space, so the connectors and the cards cannot disagree: the cards
 * are positioned by percent and the SVG uses the same 0-100 viewBox with a non-scaling stroke. The nodes are
 * Zengin Cards rather than drawn shapes, which keeps them themed, focusable and readable; the SVG draws lines
 * and nothing else, and is hidden from assistive technology because the stops below say the same thing.
 */

/** The lane each stop sits in, as a percentage of the canvas. One place to change the layout. */
const LANES: Record<string, { x: number; y: number }> = {
  definitions: { x: 2, y: 50 },
  engine: { x: 37, y: 50 },
  mcp: { x: 72, y: 13 },
  hook: { x: 72, y: 38 },
  ci: { x: 72, y: 62 },
  rollup: { x: 72, y: 87 },
};
const CARD_WIDTH = 26;

/** From the right edge of one lane to the left edge of another, bent halfway across the gap. */
function connector(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const x1 = from.x + CARD_WIDTH;
  const x2 = to.x;
  const mid = x1 + (x2 - x1) / 2;
  return `M ${x1} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${x2} ${to.y}`;
}

export function Path() {
  const [active, setActive] = useState(PATH[0]!.id);
  const stop = PATH.find((s) => s.id === active) ?? PATH[0]!;

  return (
    <section className="section" id="path">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">The path</span>
          <div className="section__head-text">
            <h2 className="title">One engine, four moments</h2>
            <p className="lead">
              The definitions describe the system once. After that the same engine answers at every point where interface code appears, from the agent's first plan to the
              platform team's weekly read. Pick a stop.
            </p>
          </div>
        </div>

        <div className="path">
          <div className="path__canvas">
            <svg className="path__wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {PATH.flatMap((s) =>
                s.to.map((target) => (
                  <path
                    key={`${s.id}-${target}`}
                    className="path__wire"
                    d={connector(LANES[s.id]!, LANES[target]!)}
                    data-live={s.id === active || target === active ? "" : undefined}
                    vectorEffect="non-scaling-stroke"
                  />
                )),
              )}
            </svg>

            {PATH.map((s) => (
              // A positioned wrapper, not a control: the stops below are the keyboard path to the same thing,
              // so this only has to be clickable and must not restyle a button to get there.
              <div
                key={s.id}
                className="path__node"
                style={{ left: `${LANES[s.id]!.x}%`, top: `${LANES[s.id]!.y}%`, width: `${CARD_WIDTH}%` }}
                onClick={() => setActive(s.id)}
              >
                <Card variant={s.id === active ? "elevated" : "outlined"} padding="sm" interactive data-kind={s.kind}>
                  <span className="path__body">
                    <span className="path__when">{s.when}</span>
                    <strong>{s.title}</strong>
                    {s.badge && (
                      <Badge size="sm" tone={s.kind === "engine" ? "primary" : "neutral"} variant="outline">
                        {s.badge}
                      </Badge>
                    )}
                  </span>
                </Card>
              </div>
            ))}
          </div>

          <aside className="path__detail" aria-live="polite">
            <span className="eyebrow">{stop.when}</span>
            <h3>{stop.title}</h3>
            <p>{stop.detail}</p>
            <ul>
              {stop.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </aside>
        </div>

        <nav className="path__tabs" aria-label="Stops on the path">
          {PATH.map((s) => (
            <Button key={s.id} size="sm" variant={s.id === active ? "soft" : "ghost"} aria-current={s.id === active ? "true" : undefined} onClick={() => setActive(s.id)}>
              {s.title}
            </Button>
          ))}
        </nav>

        <p className="rules__note">{PATH_NOTE}</p>
      </div>
    </section>
  );
}
