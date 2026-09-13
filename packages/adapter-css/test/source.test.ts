import type { ComponentManifest } from "@zenginui/engine";
import { describe, expect, it } from "vitest";
import { deriveManifestFromSource, mergeIntoManifest, type SourceFile } from "../src/index.js";

const THRESHOLD_TSX = `import { forwardRef, type InputHTMLAttributes } from "react";
import { cx } from "../../../lib/cx.js";

export type ThresholdSize = "sm" | "md";
export type ThresholdTone = "neutral" | "primary" | "danger";

export interface ThresholdProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  size?: ThresholdSize;
  tone?: ThresholdTone;
  showValue?: boolean;
  onCommit?: (value: number) => void;
}

export const Threshold = forwardRef<HTMLInputElement, ThresholdProps>(function Threshold(
  { label, size = "md", tone = "primary", showValue = true, className, ...rest },
  ref,
) {
  return (
    <label className={cx("z-threshold", className)} data-size={size} data-tone={tone}>
      <span className="z-threshold__label">{label}</span>
      <input ref={ref} type="range" {...rest} />
    </label>
  );
});
`;

const THRESHOLD_CSS = `.z-threshold {
  display: grid;
  gap: var(--spacing-2);
  color: var(--color-text);
}
.z-threshold[data-size="sm"] { padding: var(--spacing-2); font-size: var(--text-xs); }
.z-threshold[data-size="md"] { padding: var(--spacing-3); font-size: var(--text-sm); }
.z-threshold[data-tone="primary"] { background-color: var(--color-primary-soft); }
.z-threshold[data-tone="danger"] { background-color: var(--color-danger-soft); }
.z-threshold[data-disabled] { opacity: var(--opacity-disabled); }
.z-threshold__label { font-weight: var(--font-weight-medium); }
`;

const files: SourceFile[] = [
  { path: "src/components/ui/threshold/threshold.tsx", content: THRESHOLD_TSX },
  { path: "src/components/ui/threshold/threshold.css", content: THRESHOLD_CSS },
];

const opts = { importFrom: "@/components/ui", version: "0.1.0" };

describe("a manifest from the project's own source", () => {
  const d = deriveManifestFromSource(files, opts);
  const threshold = d.components.find((c) => c.name === "Threshold")!;

  it("finds the component behind forwardRef", () => {
    expect(d.components.map((c) => c.name)).toEqual(["Threshold"]);
    expect(threshold.export).toEqual({ from: "@/components/ui", name: "Threshold" });
  });

  it("opens a named type alias so a prop reads as an enum, not an opaque node", () => {
    expect(threshold.props?.["tone"]).toEqual({ type: "enum", values: ["neutral", "primary", "danger"], default: "primary" });
    expect(threshold.props?.["size"]).toEqual({ type: "enum", values: ["sm", "md"], default: "md" });
  });

  it("reads defaults from the component's own destructuring", () => {
    expect(threshold.props?.["showValue"]).toEqual({ type: "boolean", default: true });
  });

  it("keeps the kinds the types state", () => {
    expect(threshold.props?.["label"]).toEqual({ type: "string" });
    expect(threshold.props?.["onCommit"]).toEqual({ type: "function" });
  });

  it("takes the element whose attributes pass through", () => {
    expect(threshold.extends).toBe("input");
  });

  it("owns what its stylesheet sets, attributed to the prop that governs it", () => {
    expect(threshold.owns?.["padding"]).toBe("size");
    expect(threshold.owns?.["font-size"]).toBe("size");
    expect(threshold.owns?.["background-color"]).toBe("tone");
  });

  it("attributes nothing to a state the component sets for itself", () => {
    // `[data-disabled]` is not a declared prop, so nobody outside controls opacity.
    expect(threshold.owns?.["opacity"]).toBeNull();
  });

  it("does not own what only a child element sets", () => {
    // font-weight is set on .z-threshold__label, a different class.
    expect(threshold.owns?.["font-weight"]).toBeUndefined();
  });

  it("ignores className and children, which every component takes", () => {
    expect(threshold.props?.["className"]).toBeUndefined();
    expect(threshold.props?.["children"]).toBeUndefined();
  });
});

describe("which files may contribute components", () => {
  it("reads types from everywhere but takes components only from owned paths", () => {
    const shared: SourceFile = { path: "src/lib/tones.ts", content: `export type Tone = "a" | "b";\n` };
    const page: SourceFile = {
      path: "src/pages/Home.tsx",
      content: `export function Home() { return <div />; }\n`,
    };
    const comp: SourceFile = {
      path: "src/components/ui/chip/chip.tsx",
      content: `import type { Tone } from "../../../lib/tones.js";\nexport interface ChipProps { tone?: Tone }\nexport function Chip({ tone = "a" }: ChipProps) { return <span className="z-chip" data-tone={tone} />; }\n`,
    };
    const d = deriveManifestFromSource([shared, page, comp], { ...opts, owned: (p) => p.startsWith("src/components/ui/") });
    expect(d.components.map((c) => c.name)).toEqual(["Chip"]);
    // The enum lives in src/lib, outside the owned paths, and is still resolved.
    expect(d.components[0]!.props?.["tone"]).toEqual({ type: "enum", values: ["a", "b"], default: "a" });
  });
});

describe("merging into a manifest the project already has", () => {
  const derived = deriveManifestFromSource(files, opts).components;

  it("adds a component the manifest does not carry", () => {
    const plan = mergeIntoManifest([], derived);
    expect(plan.added).toEqual(["Threshold"]);
    expect(plan.merged).toHaveLength(1);
  });

  it("never drops a prop the source cannot see", () => {
    const prior: ComponentManifest[] = [
      { name: "Threshold", export: { from: "@/components/ui", name: "Threshold" }, props: { disabled: { type: "boolean" } } },
    ];
    const plan = mergeIntoManifest(prior, derived);
    expect(plan.merged[0]!.props?.["disabled"]).toEqual({ type: "boolean" });
    expect(plan.merged[0]!.props?.["tone"]?.values).toEqual(["neutral", "primary", "danger"]);
  });

  it("keeps a hand-declared enum when the source could only see a node", () => {
    const vague: ComponentManifest[] = [
      {
        name: "Widget",
        export: { from: "@/components/ui", name: "Widget" },
        props: { mode: { type: "enum", values: ["a", "b"] } },
      },
    ];
    const plan = mergeIntoManifest(vague, [
      { name: "Widget", export: { from: "@/components/ui", name: "Widget" }, props: { mode: { type: "node" } } },
    ]);
    expect(plan.merged[0]!.props?.["mode"]).toEqual({ type: "enum", values: ["a", "b"] });
    expect(plan.changed).toEqual([]);
  });

  it("takes a default the source states even when it keeps the manifest's kind", () => {
    const plan = mergeIntoManifest(
      [{ name: "W", export: { from: "x", name: "W" }, props: { mode: { type: "enum", values: ["a"] } } }],
      [{ name: "W", export: { from: "x", name: "W" }, props: { mode: { type: "node", default: "a" } } }],
    );
    expect(plan.merged[0]!.props?.["mode"]).toEqual({ type: "enum", values: ["a"], default: "a" });
  });

  it("reports a disagreement about who owns a property instead of resolving it", () => {
    const prior: ComponentManifest[] = [
      { name: "Threshold", export: { from: "@/components/ui", name: "Threshold" }, owns: { padding: "density" } },
    ];
    const plan = mergeIntoManifest(prior, derived);
    expect(plan.merged[0]!.owns?.["padding"]).toBe("density");
    expect(plan.disagreed).toContain("Threshold.padding: manifest says density, stylesheet says size");
  });

  it("leaves a hand-written className policy and replaces list alone", () => {
    const prior: ComponentManifest[] = [
      {
        name: "Threshold",
        export: { from: "@/components/ui", name: "Threshold" },
        replaces: ["input"],
        className: { allow: ["margin"] },
      },
    ];
    const plan = mergeIntoManifest(prior, derived);
    expect(plan.merged[0]!.className).toEqual({ allow: ["margin"] });
    expect(plan.merged[0]!.replaces).toEqual(["input"]);
  });
});
