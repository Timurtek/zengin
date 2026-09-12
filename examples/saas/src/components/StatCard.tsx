import { Badge, Card, Sparkline } from "@zengin/ui";

interface StatCardProps {
  label: string;
  value: string;
  /** Change against the previous period, as a percentage. */
  delta: number;
  /** Whether a rise is good news (revenue) or bad (churn). */
  higherIsBetter?: boolean;
  series: number[];
}

/** A metric, its change, and the last thirty days beside it. */
export function StatCard({ label, value, delta, higherIsBetter = true, series }: StatCardProps) {
  const good = higherIsBetter ? delta >= 0 : delta <= 0;
  const tone = delta === 0 ? "neutral" : good ? "success" : "danger";
  return (
    <Card padding="md">
      <div className="stat">
      <span className="stat__label">{label}</span>
      <div className="stat__row">
        <span className="stat__value">{value}</span>
        <div className="stat__spark">
          <Sparkline values={series} tone={tone === "neutral" ? "primary" : tone} aria-label={`${label}, last 30 days`} />
        </div>
      </div>
      <div className="stat__delta">
        <Badge tone={tone} size="sm">
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}%
        </Badge>
        vs previous 30 days
      </div>
      </div>
    </Card>
  );
}
