import { Badge } from "@zengin/ui";
import { FAMILY_NOTE, RULES } from "../content";

const FAMILY_TONE = { foundation: "primary", contract: "neutral", substitution: "warning" } as const;

export function Rules() {
  return (
    <section className="section" id="rules">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Rules</span>
          <div className="section__head-text">
            <h2 className="title">Seven rule kinds, three families</h2>
            <p className="lead">Foundation rules guard the tokens. Contract rules guard the components. The substitution rule catches the system being rebuilt by hand.</p>
          </div>
        </div>
        <div className="rules">
          <table>
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th scope="col">Family</th>
                <th scope="col">What it catches</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td className="rules__family">
                    <Badge tone={FAMILY_TONE[r.family]} size="sm">
                      {r.family}
                    </Badge>
                  </td>
                  <td>{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rules__note">{FAMILY_NOTE}</p>
      </div>
    </section>
  );
}
