import { classnamePolicy } from "./classname-policy.js";
import { colorLiteral } from "./color-literal.js";
import { componentSubstitution } from "./component-substitution.js";
import type { Rule } from "./context.js";
import { spacingLiteral } from "./spacing-literal.js";
import { tokenReference } from "./token-reference.js";
import { unknownProp } from "./unknown-prop.js";
import { unknownPropValue } from "./unknown-prop-value.js";

/** The seven rule kinds, in reporting order. */
export const RULES: readonly Rule[] = [
  colorLiteral,
  spacingLiteral,
  tokenReference,
  unknownProp,
  unknownPropValue,
  classnamePolicy,
  componentSubstitution,
];

export type { Rule, RuleContext } from "./context.js";
