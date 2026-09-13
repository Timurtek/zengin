import { Tabs } from "@zenginui/ui";
import { CodeBlock } from "../components/CodeBlock";
import { SURFACES } from "../content";

export function Surfaces() {
  return (
    <section className="section" id="surfaces">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Surfaces</span>
          <div className="section__head-text">
            <h2 className="title">One engine, everywhere the agent works</h2>
            <p className="lead">The same violation, with the same fix, whether the agent asked first, edited a file, opened a pull request, or the team looked across every repository.</p>
          </div>
        </div>
        <Tabs defaultValue={SURFACES[0]!.id} variant="line">
          <Tabs.List aria-label="Surfaces">
            {SURFACES.map((s) => (
              <Tabs.Trigger key={s.id} value={s.id}>
                {s.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          {SURFACES.map((s) => (
            <Tabs.Content key={s.id} value={s.id}>
              <div className="surface">
                <div className="surface__copy">
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  <ul className="surface__points">
                    {s.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
                <CodeBlock title={s.code.title}>{s.code.text}</CodeBlock>
              </div>
            </Tabs.Content>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
