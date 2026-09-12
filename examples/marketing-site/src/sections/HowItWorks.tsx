import { STEPS } from "../content";

export function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">How it works</span>
          <div className="section__head-text">
            <h2 className="title">Definitions in, violations with fixes out</h2>
            <p className="lead">Nothing to train and nothing to prompt. The system describes itself once; the engine holds every agent to it.</p>
          </div>
        </div>
        <ol className="cells" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {STEPS.map((step) => (
            <li key={step.title} className="cell step">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
