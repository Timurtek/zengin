import { describe, expect, it } from "vitest";
import { loadTokens, TokenIndex } from "../src/index.js";

const dim = (cssVar: string, value: string) => ({ $value: value, $extensions: { zengin: { cssVar } } });

// A design system that names a use beside its scale: --safe-top and --gutter hold values --sp-3 and --sp-4 already hold.
const tokens = loadTokens({
  space: {
    $type: "dimension",
    "sp-1": dim("--sp-1", "4px"),
    "sp-2": dim("--sp-2", "8px"),
    "sp-3": dim("--sp-3", "12px"),
    "sp-4": dim("--sp-4", "16px"),
    "sp-6": dim("--sp-6", "24px"),
    "safe-top": dim("--safe-top", "12px"),
    gutter: dim("--gutter", "16px"),
    "tabbar-h": dim("--tabbar-h", "64px"),
  },
});

describe("spacing tokens that share a value", () => {
  const idx = new TokenIndex(tokens);

  it("names the scale step, not the token named for a use", () => {
    expect(idx.matchSpacing("12px").exact?.cssVar).toBe("--sp-3");
    expect(idx.matchSpacing("16px").exact?.cssVar).toBe("--sp-4");
  });

  it("takes neighbours from the scale, so a use-named token is not offered for an off-scale length", () => {
    const m = idx.matchSpacing("70px");
    expect(m.exact).toBeUndefined();
    expect(m.below?.token.cssVar).toBe("--sp-6");
    expect(m.above).toBeUndefined();
  });

  it("keeps every spacing token when the system names no scale", () => {
    const flat = new TokenIndex(loadTokens({ space: { $type: "dimension", gutter: dim("--gutter", "16px"), inset: dim("--inset", "8px") } }));
    expect(flat.matchSpacing("16px").exact?.cssVar).toBe("--gutter");
    expect(flat.matchSpacing("12px").below?.token.cssVar).toBe("--inset");
  });
});
