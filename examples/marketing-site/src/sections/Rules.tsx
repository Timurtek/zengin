import { Badge, Table } from "@zenginui/ui";
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
        <Table aria-label="The seven rule kinds" className="rules">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Rule</Table.HeadCell>
              <Table.HeadCell>Family</Table.HeadCell>
              <Table.HeadCell>What it catches</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {RULES.map((r) => (
              <Table.Row key={r.id}>
                <Table.Cell className="rules__id">{r.id}</Table.Cell>
                <Table.Cell className="rules__family">
                  <Badge tone={FAMILY_TONE[r.family]} size="sm">
                    {r.family}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="rules__what">{r.description}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <p className="rules__note">{FAMILY_NOTE}</p>
      </div>
    </section>
  );
}
