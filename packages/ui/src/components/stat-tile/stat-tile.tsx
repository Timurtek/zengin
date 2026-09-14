import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../internal/cx.js";
import { Badge } from "../badge/badge.js";
import { Sparkline } from "../sparkline/sparkline.js";

export type StatTileSize = "sm" | "md";

export interface StatTileProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** What is being measured. */
  label: ReactNode;
  /** The figure, already formatted: "£48,210", "1,180", "3.4%". Formatting is the caller's, not the tile's. */
  value: ReactNode;
  /** Change against the previous period, as a percentage. Omit for a figure with nothing to compare to. */
  delta?: number;
  /**
   * Whether a rise is good news. Revenue: yes. Churn, latency, open incidents: no. Getting this wrong is
   * how a dashboard ends up showing rising churn in green, so it has no safe default beyond the common case.
   */
  higherIsBetter?: boolean;
  /** Recent values, drawn beside the figure. Enough points to show a shape, not a chart. */
  series?: number[];
  /**
   * What the sparkline is, for anyone not looking at it: "Monthly revenue, last 30 days". A trend is
   * information rather than decoration, so it is named rather than hidden.
   */
  seriesLabel?: string;
  /** What the period is: "vs previous 30 days". */
  caption?: ReactNode;
  size?: StatTileSize;
}

/**
 * One number, its direction, and its recent shape.
 *
 * Every dashboard opens with a row of these and every team rebuilds them, usually getting the same detail
 * wrong: the colour of the change is a judgment about the metric, not about the sign of the number. A fall
 * in churn is good and a fall in revenue is not, so the tile asks which it is rather than assuming.
 */
export const StatTile = forwardRef<HTMLDivElement, StatTileProps>(function StatTile(
  { label, value, delta, higherIsBetter = true, series, seriesLabel, caption, size = "md", className, ...rest },
  ref,
) {
  const rising = delta !== undefined && delta > 0;
  const flat = delta === undefined || delta === 0;
  const good = higherIsBetter ? (delta ?? 0) >= 0 : (delta ?? 0) <= 0;
  const tone = flat ? "neutral" : good ? "success" : "danger";

  return (
    <div ref={ref} className={cx("z-stat", className)} data-size={size} data-tone={tone} {...rest}>
      <span className="z-stat__label">{label}</span>
      <div className="z-stat__row">
        <span className="z-stat__value">{value}</span>
        {series && series.length > 1 && (
          <span className="z-stat__spark">
            <Sparkline values={series} tone={tone === "neutral" ? "primary" : tone} aria-label={seriesLabel ?? "Recent trend"} />
          </span>
        )}
      </div>
      {(delta !== undefined || caption) && (
        <p className="z-stat__delta">
          {delta !== undefined && (
            <Badge tone={tone} size="sm">
              {rising ? "+" : ""}
              {delta.toFixed(1)}%
            </Badge>
          )}
          {caption}
        </p>
      )}
    </div>
  );
});
