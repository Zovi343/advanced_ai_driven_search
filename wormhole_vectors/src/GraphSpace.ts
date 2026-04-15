import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { GRAPH_PORTS, GRAPH_SPACE } from "./config";

function makeLabel(text: string, className: string): CSS2DObject {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.center.set(0.5, 1);
  return obj;
}

function makeSpaceHeading(main: string, sub: string): CSS2DObject {
  const wrap = document.createElement("div");
  wrap.className = "space-heading space-heading--graph";
  const mainEl = document.createElement("div");
  mainEl.className = "space-heading__main";
  mainEl.textContent = main;
  const subEl = document.createElement("div");
  subEl.className = "space-heading__sub";
  subEl.textContent = `(${sub})`;
  wrap.appendChild(mainEl);
  wrap.appendChild(subEl);
  const obj = new CSS2DObject(wrap);
  obj.center.set(0.5, 0);
  return obj;
}

export class GraphSpace {
  readonly group: THREE.Group;
  readonly rotating: THREE.Group;
  /** Incoming side anchor (bias); not the beam endpoint. */
  readonly portWormholeA: THREE.Object3D;
  /** World-synced end of the dense→graph wormhole segment. */
  readonly portWormholeLineEnd: THREE.Object3D;
  private readonly baseRotation: THREE.Euler;
  private angleX = 0;
  private angleY = 0;
  private angleZ = 0;

  constructor() {
    this.group = new THREE.Group();
    this.baseRotation = GRAPH_SPACE.initialRotation.clone();
    this.group.position.copy(GRAPH_SPACE.position);
    this.rotating = new THREE.Group();
    this.group.add(this.rotating);

    this.portWormholeA = new THREE.Object3D();
    this.portWormholeA.position.copy(GRAPH_PORTS.entryFromDense);
    this.rotating.add(this.portWormholeA);

    this.portWormholeLineEnd = new THREE.Object3D();
    this.rotating.add(this.portWormholeLineEnd);

    this.build();
  }

  private build(): void {
    const { nodes, edges, accent, title, subtitle } = GRAPH_SPACE;

    const lineMat = new THREE.LineBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const portBias = GRAPH_PORTS.entryFromDense.clone().multiplyScalar(0.22);
    const sphereGeom = new THREE.SphereGeometry(0.165, 18, 18);
    const nodeById = new Map<
      string,
      { mesh: THREE.Mesh; label: CSS2DObject }
    >();

    for (const n of nodes) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfae8ff,
        emissive: accent,
        emissiveIntensity: 0.55,
        metalness: 0.2,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(sphereGeom, mat);
      mesh.position.copy(n.local).multiplyScalar(0.88).add(portBias);
      this.rotating.add(mesh);

      const label = makeLabel(n.id, "label");
      label.position.copy(mesh.position).add(new THREE.Vector3(0, 0.28, 0));
      this.rotating.add(label);
      nodeById.set(n.id, { mesh, label });
    }

    const lineEnd = nodeById.get(GRAPH_SPACE.wormholeLineTargetNodeId);
    if (lineEnd) {
      this.portWormholeLineEnd.position.copy(lineEnd.mesh.position);
    } else {
      const first = nodes[0] ? nodeById.get(nodes[0].id) : undefined;
      if (first) this.portWormholeLineEnd.position.copy(first.mesh.position);
    }

    for (const [a, b] of edges) {
      const na = nodeById.get(a);
      const nb = nodeById.get(b);
      if (!na || !nb) continue;
      const geom = new THREE.BufferGeometry().setFromPoints([
        na.mesh.position.clone(),
        nb.mesh.position.clone(),
      ]);
      const line = new THREE.Line(geom, lineMat.clone());
      this.rotating.add(line);
    }

    const heading = makeSpaceHeading(title, subtitle);
    heading.position.set(0, 1.85, 0);
    this.group.add(heading);

    this.rotating.rotation.copy(this.baseRotation);
  }

  update(delta: number, speed: number): void {
    const v = delta * speed;
    this.angleX += v * 0.31;
    this.angleY += v * 0.5;
    this.angleZ += v * 0.34;
    const b = this.baseRotation;
    this.rotating.rotation.x = b.x + this.angleX;
    this.rotating.rotation.y = b.y + this.angleY;
    this.rotating.rotation.z = b.z + this.angleZ;
  }
}
