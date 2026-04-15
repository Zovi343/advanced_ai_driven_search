import * as THREE from "three";

/** World-space anchors for wormhole lines (centers of each region). */
export const ANCHORS = {
  sparse: new THREE.Vector3(-4.5, 1.55, 0),
  dense: new THREE.Vector3(4.5, 1.55, 0),
  graph: new THREE.Vector3(0, -2.4, 0.5),
} as const;

/**
 * Wormhole segment endpoints in world space — offset from space centers so
 * tunnels start/end at "ports" near doc clusters, not at group origins.
 */
export const TUNNEL = (() => {
  const s = ANCHORS.sparse.clone();
  const d = ANCHORS.dense.clone();
  const g = ANCHORS.graph.clone();

  const horiz = new THREE.Vector3().subVectors(d, s).normalize();
  const portH = 1.38;
  const sparseToDenseStart = s.clone().addScaledVector(horiz, portH);
  const sparseToDenseEnd = d.clone().addScaledVector(horiz, -portH);

  const diag = new THREE.Vector3().subVectors(g, d).normalize();
  const portDenseOut = 0.9;
  const portGraphIn = 0.55;
  const denseToGraphStart = d.clone().addScaledVector(diag, portDenseOut);
  const denseToGraphEnd = g.clone().addScaledVector(diag, -portGraphIn);

  return {
    sparseToDenseStart,
    sparseToDenseEnd,
    denseToGraphStart,
    denseToGraphEnd,
  };
})();

/** Local-space wormhole port markers (parent: each space's `rotating` group). */
export const SPARSE_PORTS = {
  exitTowardDense: new THREE.Vector3(0.92, 0.08, 0.06),
} as const;

export const DENSE_PORTS = (() => {
  const entryFromSparse = new THREE.Vector3(-0.92, 0.06, -0.04);
  const towardGraph = new THREE.Vector3(-0.22, -0.72, 0.1);
  const exitTowardGraph = new THREE.Vector3().lerpVectors(
    entryFromSparse,
    towardGraph,
    0.58,
  );
  return { entryFromSparse, exitTowardGraph };
})();

export const GRAPH_PORTS = {
  /** Visual “incoming” side; dense→graph beam ends on `GRAPH_SPACE.wormholeLineTargetNodeId`. */
  entryFromDense: new THREE.Vector3(0.42, 0.88, 0.1),
} as const;

export const TIMING = {
  /** Seconds before any beam starts. */
  beamWarmup: 2.8,
  /** Duration of sparse → dense beam stream. */
  beamSparseToDense: 2.4,
  /** Delay before dense → graph beam starts (overlap with first beam tail). */
  beamDenseStartAfterWarmup: 4.6,
  /** Duration of dense → graph beam. */
  beamDenseToGraph: 2.2,
} as const;

export const ROTATION_SPEED = 0.35;

export type DocPoint = {
  id: string;
  isQuery?: boolean;
};

export type ArrowSpec = {
  label: string;
  /** Direction from origin (normalized internally). */
  direction: THREE.Vector3;
  length: number;
  color: number;
};

export type VectorSpaceConfig = {
  key: "sparse" | "dense";
  title: string;
  subtitle: string;
  position: THREE.Vector3;
  /** Base tilt before animated spin (radians). */
  initialRotation: THREE.Euler;
  /** Accent for wireframe borders. */
  accent: number;
  /** Secondary tint for alternate plane borders. */
  accent2: number;
  planeCount: number;
  planeSpacing: number;
  planeSize: number;
  documents: DocPoint[];
  arrows: ArrowSpec[];
};

export const SPARSE_SPACE: VectorSpaceConfig = {
  key: "sparse",
  title: "SPARSE SPACE",
  subtitle: "TF-IDF Keywords",
  position: new THREE.Vector3(-4.5, 1.55, 0),
  initialRotation: new THREE.Euler(0.25, 0, 0.1),
  accent: 0xfbbf24,
  accent2: 0xf97316,
  planeCount: 5,
  planeSpacing: 0.55,
  planeSize: 3.6,
  documents: [
    { id: "DOC_E" },
    { id: "DOC_B" },
    { id: "DOC_D" },
    { id: "DOC_F" },
    { id: "QUERY", isQuery: true },
  ],
  arrows: [
    {
      label: "machine",
      direction: new THREE.Vector3(1, 0.15, 0.1),
      length: 1.35 * 1.35,
      color: 0xfff59a,
    },
    {
      label: "algorithm",
      direction: new THREE.Vector3(-0.35, 1, 0.2),
      length: 1.25 * 1.35,
      color: 0xfde047,
    },
    {
      label: "learning",
      direction: new THREE.Vector3(0.2, 0.2, 1),
      length: 1.2 * 1.35,
      color: 0xfbbf24,
    },
  ],
};

export const DENSE_SPACE: VectorSpaceConfig = {
  key: "dense",
  title: "DENSE SPACE",
  subtitle: "Semantic Embeddings",
  position: new THREE.Vector3(4.5, 1.55, 0),
  initialRotation: new THREE.Euler(0.2, 0, -0.1),
  accent: 0x2dd4bf,
  accent2: 0x22d3ee,
  planeCount: 5,
  planeSpacing: 0.55,
  planeSize: 3.6,
  documents: [
    { id: "DOC_B" },
    { id: "DOC_A" },
    { id: "DOC_C" },
    { id: "DOC_D" },
  ],
  arrows: [
    {
      label: "Formality",
      direction: new THREE.Vector3(1, 0.05, 0),
      length: 1.2 * 1.35,
      color: 0xa5f3fc,
    },
    {
      label: "Semantics",
      direction: new THREE.Vector3(-0.2, 1, 0.15),
      length: 1.3 * 1.35,
      color: 0x99f6e4,
    },
    {
      label: "Frequency",
      direction: new THREE.Vector3(0.15, 0.25, 1),
      length: 1.15 * 1.35,
      color: 0x99f6e4,
    },
  ],
};

export type GraphNodeSpec = { id: string; local: THREE.Vector3 };
export type GraphEdgeSpec = [string, string];

const gl = 1.26;

export const GRAPH_SPACE = {
  title: "GRAPH SPACE",
  subtitle: "Knowledge Graph",
  position: new THREE.Vector3(0, -2.4, 0.5),
  initialRotation: new THREE.Euler(0.06, 0, -0.04),
  accent: 0xe879f9,
  /** Dense→graph wormhole line ends at this node’s sphere (same local layout as meshes). */
  wormholeLineTargetNodeId: "DOC_E",
  nodes: [
    { id: "DOC_A", local: new THREE.Vector3(0.9 * gl, 0.35 * gl, 0.2 * gl) },
    { id: "DOC_B", local: new THREE.Vector3(-0.52 * gl, 0.58 * gl, -0.38 * gl) },
    { id: "DOC_C", local: new THREE.Vector3(-0.88 * gl, -0.28 * gl, 0.42 * gl) },
    { id: "DOC_D", local: new THREE.Vector3(0.38 * gl, -0.68 * gl, -0.22 * gl) },
    { id: "DOC_E", local: new THREE.Vector3(0.12 * gl, 0.08 * gl, 0.78 * gl) },
    { id: "DOC_G", local: new THREE.Vector3(1.05 * gl, -0.15 * gl, 0.28 * gl) },
    { id: "DOC_H", local: new THREE.Vector3(-0.42 * gl, 0.92 * gl, -0.32 * gl) },
  ] satisfies GraphNodeSpec[],
  edges: [
    ["DOC_A", "DOC_B"],
    ["DOC_B", "DOC_C"],
    ["DOC_C", "DOC_D"],
    ["DOC_D", "DOC_A"],
    ["DOC_A", "DOC_E"],
    ["DOC_C", "DOC_E"],
    ["DOC_B", "DOC_E"],
    ["DOC_D", "DOC_G"],
    ["DOC_A", "DOC_H"],
  ] satisfies GraphEdgeSpec[],
} as const;
