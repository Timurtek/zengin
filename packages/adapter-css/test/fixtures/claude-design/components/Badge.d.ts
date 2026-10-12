import * as React from "react";

export interface BadgeProps {
  /** @default "neutral" */
  tone?: "deal" | "savings" | "neutral";
  variant?: "solid" | "soft";
  icon?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Badge(props: BadgeProps): JSX.Element;
