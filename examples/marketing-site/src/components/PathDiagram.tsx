import type { Edge } from "@xyflow/react";
import { arrow, Flow, type StepNode } from "./Flow";
import { PATH } from "../content";

/**
 * The adoption path: the definitions feed the engine, and the engine answers at four surfaces.
 *
 * The stops carry their own coordinates in content.ts, so moving one is moving one pair of numbers. The
 * chosen stop lifts, and the wires it is an end of turn primary, which is the only thing connecting this to
 * the panel of prose beside it.
 */
export function PathDiagram({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  const nodes: StepNode[] = PATH.map((s, i) => ({
    id: s.id,
    type: "step",
    position: s.at,
    selected: s.id === active,
    data: { when: s.when, title: s.title, note: s.what, badge: s.badge, kind: s.kind, order: i },
  }));

  const edges: Edge[] = PATH.flatMap((s) =>
    s.to.map((target) => {
      const live = s.id === active || target === active;
      return {
        id: `${s.id}-${target}`,
        source: s.id,
        target,
        sourceHandle: "r",
        targetHandle: "l",
        type: "smoothstep",
        markerEnd: arrow(live),
        // Only the wires the chosen stop is an end of move, so the motion means the selection.
        animated: live,
        className: live ? "flow__edge flow__edge--live" : "flow__edge",
      };
    }),
  );

  return <Flow nodes={nodes} edges={edges} className="flow--path" onSelect={onSelect} />;
}
