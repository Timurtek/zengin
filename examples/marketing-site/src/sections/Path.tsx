import { Button } from "@zenginui/ui";
import { lazy, Suspense, useState } from "react";
import { PATH, PATH_NOTE } from "../content";

/*
 * React Flow is about fifty kilobytes over the wire, and this diagram is below the fold on a page whose job
 * is to be read. It loads after the page does, into a box of its own height, so nothing moves when it lands.
 */
const PathDiagram = lazy(() => import("../components/PathDiagram").then((m) => ({ default: m.PathDiagram })));

/**
 * The adoption path as a diagram, because the four surfaces are the hard part to explain in prose: one engine,
 * reached from four places, at four different moments.
 *
 * The stops carry their own coordinates in content.ts and React Flow places and routes from them, so moving a
 * stop is moving one pair of numbers. It used to be two coordinate systems — percentages here for the cards
 * and a hand-written bezier for the wires — which had to be kept in agreement by hand.
 */
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
          <Suspense fallback={<div className="flow flow--path" aria-hidden="true" />}>
            <PathDiagram active={active} onSelect={setActive} />
          </Suspense>

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
