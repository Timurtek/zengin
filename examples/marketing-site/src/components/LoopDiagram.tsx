import type { Edge } from "@xyflow/react";
import { arrow, Flow, type StepNode } from "./Flow";
import { useNarrow } from "./useNarrow";

/**
 * The enforcement loop: an edit reaches the hook, the hook runs the engine against the project's own
 * definitions, the write comes back blocked with the fix, and the loop returns to the edit.
 *
 * Two layouts rather than one scaled down. The row is the argument at desk width; on a phone the same five
 * boxes at that width set their labels at seven pixels, so the narrow layout is a column and the definitions
 * reach the engine along the outside instead of through it.
 */
const NODES: Record<string, StepNode["data"]> = {
  // The order is the order it is explained in: the definitions exist first, then an edit meets them.
  definitions: { title: "Definitions", note: "your own files", kind: "system", order: 0 },
  edit: { title: "Edit", note: "you or an agent", order: 1 },
  hook: { title: "Hook", note: "at write time", kind: "surface", order: 2 },
  engine: { title: "Engine", note: "deterministic", kind: "system", order: 3 },
  blocked: { title: "Blocked", note: "with the fix", kind: "surface", order: 4 },
};

const WIDE: Record<string, { x: number; y: number }> = {
  definitions: { x: 480, y: 0 },
  edit: { x: 0, y: 140 },
  hook: { x: 240, y: 140 },
  engine: { x: 480, y: 140 },
  blocked: { x: 720, y: 140 },
};

const NARROW: Record<string, { x: number; y: number }> = {
  definitions: { x: 0, y: 0 },
  edit: { x: 0, y: 110 },
  hook: { x: 0, y: 220 },
  engine: { x: 0, y: 330 },
  blocked: { x: 0, y: 440 },
};

/** From, to, and the sides each end leaves by — the only thing that differs between the two layouts. */
const WIDE_EDGES: [string, string, string, string][] = [
  ["definitions", "engine", "b", "t"],
  ["edit", "hook", "r", "l"],
  ["hook", "engine", "r", "l"],
  ["engine", "blocked", "r", "l"],
  ["blocked", "edit", "b", "b"],
];

const NARROW_EDGES: [string, string, string, string][] = [
  ["definitions", "engine", "r", "r"],
  ["edit", "hook", "b", "t"],
  ["hook", "engine", "b", "t"],
  ["engine", "blocked", "b", "t"],
  ["blocked", "edit", "l", "l"],
];

function build(narrow: boolean): { nodes: StepNode[]; edges: Edge[] } {
  const at = narrow ? NARROW : WIDE;
  const wires = narrow ? NARROW_EDGES : WIDE_EDGES;
  return {
    nodes: Object.entries(NODES).map(([id, data]) => ({ id, type: "step", position: at[id]!, data })),
    edges: wires.map(([source, target, sourceHandle, targetHandle]) => ({
      id: `${source}-${target}`,
      source,
      target,
      sourceHandle,
      targetHandle,
      type: "smoothstep",
      markerEnd: arrow(),
      // It is a loop, and a still line does not say so: the dashes run the way the work does.
      animated: true,
      className: "flow__edge",
    })),
  };
}

export function LoopDiagram() {
  const narrow = useNarrow();
  const { nodes, edges } = build(narrow);
  return (
    <figure className="flow-figure">
      {/* The canvas itself is hidden from assistive technology; this is what it says. */}
      <figcaption className="flow-figure__alt">
        An edit by a person or an agent reaches the hook. The hook runs the engine against the project&rsquo;s own definitions, and the write comes back blocked
        with the fix, which returns to the edit.
      </figcaption>
      {/* Remounted when the layout changes, so the new positions are fitted rather than panned to. */}
      <Flow key={narrow ? "narrow" : "wide"} nodes={nodes} edges={edges} className="flow--loop" />
    </figure>
  );
}
