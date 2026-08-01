import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Tuning values for the ambient authentication background animation. */

export const GRAPH_NODE_COUNT = 14;
export const GRAPH_CONNECTION_DISTANCE = 220;
export const GRAPH_NODE_RADIUS = 2;

export const GRAPH_NODE_OPACITY = 0.35;
export const GRAPH_LINE_OPACITY = 0.12;

/** Slow, ambient drift — intentionally longer than UI feedback durations. */
export const GRAPH_DRIFT_DURATION_SECONDS = 14;
export const GRAPH_DRIFT_DISTANCE_PX = 24;

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 1000;

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  driftDelaySeconds: number;
}

export interface GraphEdge {
  from: GraphNode;
  to: GraphNode;
  distance: number;
}

/** Deterministic pseudo-random layout so the graph doesn't reshuffle on re-render. */
function generateNodes(): GraphNode[] {
  return Array.from({ length: GRAPH_NODE_COUNT }, (_, index) => {
    const seed = index * 137.5;
    return {
      id: `node-${index}`,
      x: seed % VIEWBOX_WIDTH,
      y: (seed * 3.1) % VIEWBOX_HEIGHT,
      driftDelaySeconds: (index % 5) * 0.8
    };
  });
}

function buildEdges(nodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const from = nodes[i];
      const to = nodes[j];
      if (!from || !to) continue;
      const distance = Math.hypot(from.x - to.x, from.y - to.y);

      if (distance <= GRAPH_CONNECTION_DISTANCE) {
        edges.push({ from, to, distance });
      }
    }
  }

  return edges;
}

/**
 * Ambient, low-opacity network graph used as the right-side visual panel.
 * Purely decorative — never intercepts pointer or keyboard focus.
 */
export function AnimatedBackground() {
  const prefersReducedMotion = useReducedMotion();
  const nodes = useMemo(() => generateNodes(), []);
  const edges = useMemo(() => buildEdges(nodes), [nodes]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-neutral-950"
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {edges.map((edge) => (
          <line
            key={`${edge.from.id}-${edge.to.id}`}
            x1={edge.from.x}
            y1={edge.from.y}
            x2={edge.to.x}
            y2={edge.to.y}
            stroke="currentColor"
            strokeWidth={1}
            className="text-neutral-500"
            style={{ opacity: GRAPH_LINE_OPACITY }}
          />
        ))}

        {nodes.map((node) => {
          if (prefersReducedMotion) {
            return (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={GRAPH_NODE_RADIUS}
                fill="currentColor"
                className="text-neutral-300"
                style={{ opacity: GRAPH_NODE_OPACITY }}
              />
            );
          }

          return (
            <motion.circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={GRAPH_NODE_RADIUS}
              fill="currentColor"
              className="text-neutral-300"
              style={{ opacity: GRAPH_NODE_OPACITY }}
              animate={{
                cy: [node.y, node.y - GRAPH_DRIFT_DISTANCE_PX, node.y]
              }}
              transition={{
                duration: GRAPH_DRIFT_DURATION_SECONDS,
                delay: node.driftDelaySeconds,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          );
        })}
      </svg>

      {/* Subtle edge fade so the graph doesn't compete with foreground content */}
      <div className="absolute inset-0 bg-gradient-to-l from-neutral-950/0 via-neutral-950/0 to-neutral-950/60" />
    </div>
  );
}
