import { PROOF, REPO } from "../content";

export function Proof() {
  return (
    <section className="section" id="proof">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Field tests</span>
          <div className="section__head-text">
            <h2 className="title">Run on code nobody wrote for it</h2>
            <p className="lead">
              Two public shadcn codebases, every violation read and classified by hand. The write-ups are in the repository under{" "}
              <a href={`${REPO}/tree/main/docs/field-tests`} target="_blank" rel="noreferrer">docs/field-tests</a>.
            </p>
          </div>
        </div>
        <div className="cells">
          {PROOF.map((p) => (
            <div key={p.title} className="cell proof__item">
              <span className="proof__figure">
                {p.figure}
                {p.after && <small> to {p.after}</small>}
              </span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
