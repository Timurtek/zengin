import { CodeBlock } from "../components/CodeBlock";
import { GROWTH, GROWTH_NOTE } from "../content";

export function Growth() {
  return (
    <section className="section" id="growth">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Growth</span>
          <div className="section__head-text">
            <h2 className="title">A system that changes without drifting</h2>
            <p className="lead">
              A design system that cannot change is dead, and one that changes in every file is not a system. Both of these move the change into the
              definitions, where the engine can still hold everyone to it.
            </p>
          </div>
        </div>
        <div className="growth">
          {GROWTH.map((card) => (
            <article key={card.id} className="growth__card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <ul className="growth__points">
                {card.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className="growth__code">
                <span className="growth__code-title">{card.code.title}</span>
                <CodeBlock>{card.code.text}</CodeBlock>
              </div>
            </article>
          ))}
        </div>
        <p className="rules__note">{GROWTH_NOTE}</p>
      </div>
    </section>
  );
}
