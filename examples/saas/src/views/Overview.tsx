import { Avatar, Badge, BarChart, Button, Card, LineChart, Table } from "@zengin/ui";
import { StatCard } from "../components/StatCard";
import { activeUsers, activity, churn, compact, conversion, DAYS, money, PLANS, refunds, revenue, signupsByPlan } from "../data";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const last = (xs: number[]) => xs[xs.length - 1]!;
const pct = (now: number, before: number) => ((now - before) / before) * 100;

const KIND_TONE = { signup: "success", upgrade: "primary", invoice: "neutral", support: "warning", churn: "danger" } as const;

export function Overview() {
  const half = Math.floor(revenue.length / 2);
  return (
    <>
      <div className="page__head">
        <div>
          <p>Aug 14 to Sep 12, 2026. Compared with the 30 days before.</p>
        </div>
        <Button variant="soft" size="sm">
          Download report
        </Button>
      </div>

      <div className="stats z-stagger">
        <StatCard label="Revenue" value={money(sum(revenue))} delta={pct(sum(revenue.slice(half)), sum(revenue.slice(0, half)))} series={revenue} />
        <StatCard label="Active users" value={compact(last(activeUsers))} delta={pct(last(activeUsers), activeUsers[0]!)} series={activeUsers} />
        <StatCard label="Conversion" value={`${last(conversion).toFixed(2)}%`} delta={pct(last(conversion), conversion[0]!)} series={conversion} />
        <StatCard label="Churn" value={`${last(churn).toFixed(2)}%`} delta={pct(last(churn), churn[0]!)} higherIsBetter={false} series={churn} />
      </div>

      <div className="charts">
        <Card padding="md">
          <div className="panel">
          <div className="panel__head">
            <div>
              <h2>Revenue and refunds</h2>
              <p>Daily, in dollars.</p>
            </div>
            <Badge tone="success" size="sm">
              On track
            </Badge>
          </div>
          <LineChart
            series={[
              { name: "Revenue", values: revenue },
              { name: "Refunds", values: refunds, tone: "danger" },
            ]}
            labels={DAYS}
            area
            height={240}
            formatValue={(n) => money(n)}
            aria-label="Revenue and refunds, daily, last 30 days"
          />
          </div>
        </Card>
        <Card padding="md">
          <div className="panel">
          <div className="panel__head">
            <div>
              <h2>Signups by plan</h2>
              <p>This month against last.</p>
            </div>
          </div>
          <BarChart
            series={[
              { name: "This month", values: signupsByPlan.thisMonth },
              { name: "Last month", values: signupsByPlan.lastMonth, tone: "neutral" },
            ]}
            labels={[...PLANS]}
            height={240}
            aria-label="Signups by plan, this month and last"
          />
          </div>
        </Card>
      </div>

      <Card padding="none">
        <Table aria-label="Recent activity">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Who</Table.HeadCell>
              <Table.HeadCell>What</Table.HeadCell>
              <Table.HeadCell>Kind</Table.HeadCell>
              <Table.HeadCell align="end">When</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {activity.map((a) => (
              <Table.Row key={a.id}>
                <Table.Cell>
                  <div className="who">
                    <Avatar name={a.who} size="sm" />
                    {a.who}
                  </div>
                </Table.Cell>
                <Table.Cell>{a.what}</Table.Cell>
                <Table.Cell>
                  <Badge tone={KIND_TONE[a.kind]} size="sm">
                    {a.kind}
                  </Badge>
                </Table.Cell>
                <Table.Cell align="end" className="muted">
                  {a.when}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>
    </>
  );
}
