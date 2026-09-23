import "@xyflow/react/dist/base.css";
import { Background, Handle, MarkerType, Position, ReactFlow, useReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { Badge } from "@zenginui/ui";
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * The site's diagrams, drawn with React Flow.
 *
 * Both diagrams here are graphs — boxes, wires, and in one of them a selection — and they were drawn by hand
 * twice: one page positioned cards by percentage and wrote its own bezier, the other laid out an SVG in
 * absolute coordinates where every nudge meant moving a box and four numbers. React Flow owns the layout,
 * the routing and the fitting, so a change to a diagram is a change to its nodes.
 *
 * Only `base.css` is imported: the library's own theme is not this site's, and everything visible below
 * comes from the same tokens as the rest of the page, through `.flow` in site.css.
 */

/** What every node on this site shows: a label, the thing itself, and sometimes a note beside it. */
export type StepData = {
  title: string;
  when?: string;
  note?: string;
  badge?: string;
  kind?: string;
  /** Where it falls in the reading order, which is the order the boxes arrive in. */
  order?: number;
  [key: string]: unknown;
};

export type StepNode = Node<StepData, "step">;

/** Every side, as both ends. An edge names the sides it leaves and arrives at, so routing stays in the data. */
const SIDES = [
  [Position.Top, "t"],
  [Position.Right, "r"],
  [Position.Bottom, "b"],
  [Position.Left, "l"],
] as const;

function StepNode({ data, selected }: NodeProps<StepNode>) {
  return (
    <div className="flow__node" data-kind={data.kind} data-selected={selected || undefined} data-order={data.order ?? 0}>
      {SIDES.map(([position, id]) => (
        <Handle key={id} id={id} type="source" position={position} className="flow__handle" isConnectable={false} />
      ))}
      {SIDES.map(([position, id]) => (
        <Handle key={`${id}-in`} id={id} type="target" position={position} className="flow__handle" isConnectable={false} />
      ))}
      {data.when && <span className="flow__when">{data.when}</span>}
      <strong className="flow__title">{data.title}</strong>
      {data.note && <span className="flow__note">{data.note}</span>}
      {data.badge && (
        <Badge size="sm" tone={data.kind === "system" || data.kind === "engine" ? "primary" : "neutral"} variant="outline">
          {data.badge}
        </Badge>
      )}
    </div>
  );
}

const NODE_TYPES = { step: StepNode };

/**
 * The arrowhead. Both diagrams read in a direction — one of them is a loop — and a plain line does not say
 * which way. The colour is a token rather than a literal: React Flow puts it on the marker's own style, where
 * a custom property resolves like any other.
 */
export function arrow(live = false) {
  return { type: MarkerType.ArrowClosed, width: 16, height: 16, color: live ? "var(--color-primary)" : "var(--color-border-strong)" };
}

/*
 * Fit, but never enlarge. The nodes are set at the size the prose beside them uses, and a diagram allowed to
 * scale past 1 sets its own labels bigger than the paragraph that introduces it.
 */
const FIT = { padding: 0.14, maxZoom: 1 } as const;

/**
 * Fitting, and the reason it is done here rather than by the `fitView` prop.
 *
 * These nodes are sized by the stylesheet, not by a width in the data, so React Flow has nothing to fit until
 * it has measured them — and while its own `fitView` is pending it keeps every node hidden, so a fit that
 * never resolves leaves an empty box rather than an unfitted diagram. Watching the canvas instead gives the
 * first fit when it has a size and another whenever the column around it changes width, and a fit that does
 * not happen costs the centring, not the picture.
 */
function Refit({ canvas }: { canvas: RefObject<HTMLDivElement | null> }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    // The first fit, for the size the canvas already has.
    void fitView(FIT);
    const observer = new ResizeObserver(() => void fitView(FIT));
    observer.observe(element);
    return () => observer.disconnect();
  }, [canvas, fitView]);
  return null;
}

/**
 * The canvas is hidden from assistive technology on purpose: it is a field of positioned boxes, and the
 * prose or the controls beside every diagram on this site say the same thing in an order that can be read.
 */
/**
 * The boxes arrive in reading order when the diagram is first reached, rather than on mount.
 *
 * Mount is the wrong moment: these load lazily and sit below the fold, so the sequence would play to an empty
 * room and a reader arriving later would find it already over. Once seen it stays seen — a diagram that
 * replays every time it scrolls past is a distraction, not an explanation.
 */
function useSeen(element: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = element.current;
    if (!node || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [element, seen]);
  return seen;
}

export function Flow({
  nodes,
  edges,
  className,
  onSelect,
}: {
  nodes: StepNode[];
  edges: Edge[];
  className?: string;
  onSelect?: (id: string) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const seen = useSeen(canvas);
  return (
    <div ref={canvas} className={className ? `flow ${className}` : "flow"} data-seen={seen || undefined} aria-hidden="true">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={Boolean(onSelect)}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        onNodeClick={onSelect ? (_, node) => onSelect(node.id) : undefined}
      >
        <Background gap={16} size={1} />
        <Refit canvas={canvas} />
      </ReactFlow>
    </div>
  );
}
