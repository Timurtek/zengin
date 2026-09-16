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

describe("who controls a property", () => {
  const TSX = `import { forwardRef, type HTMLAttributes } from "react";
export type Tone = "neutral" | "primary";
export type Variant = "solid" | "soft";
export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  variant?: Variant;
  interactive?: boolean;
}
export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip({ tone = "neutral", variant = "solid", interactive = false }, ref) {
  return <span ref={ref} className="z-chip" data-tone={tone} data-variant={variant} data-interactive={interactive || undefined} />;
});
`;
  const CSS = `.z-chip { border-radius: var(--radius-md); }
.z-chip[data-variant="solid"][data-tone="neutral"] { background-color: var(--color-neutral); }
.z-chip[data-variant="solid"][data-tone="primary"] { background-color: var(--color-primary); }
.z-chip[data-variant="soft"] { background-color: var(--color-neutral-soft); }
.z-chip[data-size="sm"] .z-chip__label { font-size: var(--text-xs); }
.z-chip[data-interactive]:hover { box-shadow: var(--shadow-md); }
`;
  const d = deriveManifestFromSource(
    [
      { path: "src/components/ui/chip/chip.tsx", content: TSX },
      { path: "src/components/ui/chip/chip.css", content: CSS },
    ],
    opts,
  );
  const chip = d.components.find((c) => c.name === "Chip")!;

  it("names every prop that governs a property, most frequent first", () => {
    // The hue comes from tone and the treatment from variant; naming one would send a reader to the wrong half.
    expect(chip.owns?.["background-color"]).toEqual(["variant", "tone"]);
  });

  it("records a property no prop governs as null", () => {
    expect(chip.owns?.["border-radius"]).toBeNull();
  });

  it("does not attribute a property to a hover state", () => {
    // `interactive` is a prop, but the rule only fires under :hover, which says nothing about who controls it.
    expect(chip.owns?.["box-shadow"]).toBeNull();
  });

  it("follows a data attribute back to the prop that feeds it, through the component's own consts", () => {
    // A stylesheet names `data-invalid`; the manifest names props, and the prop here is `error`. Reading the
    // attribute as the prop name found no such prop and recorded null -- which sent a reader looking for a
    // prop that does not exist, and made `define --force` a way to discard a correct hand-written answer.
    const field = deriveManifestFromSource(
      [
        {
          path: "src/components/ui/entry/entry.tsx",
          content: `import type { ReactNode, HTMLAttributes } from "react";
export interface EntryProps extends HTMLAttributes<HTMLDivElement> { error?: ReactNode; loading?: boolean; disabled?: boolean }
export function Entry({ error, loading, disabled }: EntryProps) {
  const invalid = Boolean(error);
  const isDisabled = disabled || loading;
  return <div className="z-entry" data-invalid={invalid || undefined} data-disabled={isDisabled || undefined} />;
}
`,
        },
        {
          path: "src/components/ui/entry/entry.css",
          content: `.z-entry[data-invalid] { border-color: var(--color-danger); }\n.z-entry[data-disabled] { opacity: 0.55; }\n`,
        },
      ],
      opts,
    ).components.find((c) => c.name === "Entry")!;

    expect(field.owns?.["border-color"]).toEqual("error");
    // Two props feed `data-disabled`, and both are declared, so both are named.
    expect(field.owns?.["opacity"]).toEqual(expect.arrayContaining(["disabled", "loading"]));
  });

  it("does not invent an owner for a data attribute that is not a prop", () => {
    // `.z-chip[data-size] .z-chip__label` is switched by `data-size`, and this Chip has no `size` prop, so
    // there is no prop to send a reader to. Null, not a guess.
    expect(chip.owns?.["font-size"]).toBeNull();
  });

  it("attributes a part's property to the prop on the root that switches it", () => {
    // This reverses an earlier reading, deliberately. `owns` answers one question — which prop should a
    // reader reach for when their className is rejected — and for a rejected `className="mono"` on a field
    // the answer is `font`, whether the declaration lands on the root or on a part of it. The earlier rule
    // distinguished by which element is styled, which is not the question, and a field report found the
    // cost: TextField's font-family read as unowned, so `define --force` would have set the owner to null
    // and undone the `font="mono"` prop the manifest exists to point people at.
    const field = deriveManifestFromSource(
      [
        {
          path: "src/components/ui/field/field.tsx",
          content: `import type { HTMLAttributes } from "react";
export interface FieldProps extends HTMLAttributes<HTMLDivElement> { font?: "sans" | "mono" }
export function Field({ font = "sans" }: FieldProps) { return <div className="z-field" data-font={font}><input className="z-field__input" /></div>; }
`,
        },
        {
          path: "src/components/ui/field/field.css",
          content: `.z-field[data-font="mono"] .z-field__input { font-family: var(--font-mono); }
.z-field .z-field__input { color: var(--color-text); }
`,
        },
      ],
      opts,
    ).components.find((c) => c.name === "Field")!;

    expect(field.owns?.["font-family"]).toEqual("font");
    // And unconditional child styling is still not the component's at all: no prop switches it, so it is not
    // in `owns` in any form. The narrowing that keeps the earlier false positives out.
    expect(field.owns?.["color"]).toBeUndefined();
  });

  it("reads the element whose attributes pass through when the type states one", () => {
    expect(chip.extends).toBe("span");
  });

  it("does not guess an element the types never state", () => {
    const vague = deriveManifestFromSource(
      [
        {
          path: "src/components/ui/panel/panel.tsx",
          content: `import type { ComponentPropsWithoutRef } from "react";\nimport * as Radix from "@radix-ui/react-dialog";\nexport interface PanelProps extends ComponentPropsWithoutRef<typeof Radix.Root> { open?: boolean }\nexport function Panel({ open }: PanelProps) { return <div className="z-panel" data-open={open} />; }\n`,
        },
      ],
      opts,
    );
    // `ComponentPropsWithoutRef<typeof Radix.Root>` says whose props pass through, not which element renders.
    expect(vague.components[0]?.extends).toBeUndefined();
  });
});

describe("resolving a disagreement", () => {
  const derived = [
    { name: "Chip", export: { from: "x", name: "Chip" }, owns: { "background-color": "tone" } },
  ] as ComponentManifest[];
  const prior = [
    { name: "Chip", export: { from: "x", name: "Chip" }, owns: { "background-color": "variant" } },
  ] as ComponentManifest[];

  it("keeps the manifest by default and says so", () => {
    const plan = mergeIntoManifest(prior, derived);
    expect(plan.merged[0]!.owns?.["background-color"]).toBe("variant");
    expect(plan.disagreed).toHaveLength(1);
  });

  it("takes the stylesheet when asked, and still reports it", () => {
    const plan = mergeIntoManifest(prior, derived, true);
    expect(plan.merged[0]!.owns?.["background-color"]).toBe("tone");
    expect(plan.disagreed).toHaveLength(1);
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
