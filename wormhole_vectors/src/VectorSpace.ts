import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  DENSE_PORTS,
  SPARSE_PORTS,
  type VectorSpaceConfig,
} from "./config";

function makeLabel(text: string, className: string): CSS2DObject {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.center.set(0.5, 1);
  return obj;
}

function makeSpaceHeading(
  main: string,
  sub: string,
  variant: "sparse" | "dense",
): CSS2DObject {
  const wrap = document.createElement("div");
  wrap.className = `space-heading space-heading--${variant}`;
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

function randomBiasInSphere(radius: number): THREE.Vector3 {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = radius * Math.cbrt(Math.random());
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
  );
}

function strengthenArrow(arrow: THREE.ArrowHelper): void {
  const lineMat = arrow.line.material as THREE.LineBasicMaterial;
  lineMat.transparent = true;
  lineMat.opacity = 1;
  lineMat.linewidth = 2.5;
  const coneMat = arrow.cone.material as THREE.MeshBasicMaterial;
  coneMat.transparent = true;
  coneMat.opacity = 1;
}

export class VectorSpace {
  readonly group: THREE.Group;
  readonly rotating: THREE.Group;
  /** Wormhole port on this space (sparse: exit; dense: entry from sparse). */
  readonly portWormholeA: THREE.Object3D;
  /** Dense only: exit toward graph. Undefined use — only dense has two ports. */
  readonly portWormholeB: THREE.Object3D | null;
  private readonly config: VectorSpaceConfig;
  private readonly baseRotation: THREE.Euler;
  private readonly docAnchor = new THREE.Vector3();
  private angleX = 0;
  private angleY = 0;
  private angleZ = 0;

  constructor(config: VectorSpaceConfig) {
    this.config = config;
    this.baseRotation = config.initialRotation.clone();
    this.group = new THREE.Group();
    this.group.position.copy(config.position);
    this.rotating = new THREE.Group();
    this.group.add(this.rotating);

    if (config.key === "sparse") {
      this.portWormholeA = new THREE.Object3D();
      this.portWormholeA.position.copy(SPARSE_PORTS.exitTowardDense);
      this.rotating.add(this.portWormholeA);
      this.portWormholeB = null;
      this.docAnchor.copy(SPARSE_PORTS.exitTowardDense);
    } else {
      this.portWormholeA = new THREE.Object3D();
      this.portWormholeA.position.copy(DENSE_PORTS.entryFromSparse);
      this.portWormholeB = new THREE.Object3D();
      this.portWormholeB.position.copy(DENSE_PORTS.exitTowardGraph);
      this.rotating.add(this.portWormholeA, this.portWormholeB);
      this.docAnchor.copy(DENSE_PORTS.entryFromSparse);
    }

    this.buildRotating();
    this.buildTitle();
    this.rotating.rotation.copy(this.baseRotation);
  }

  private buildTitle(): void {
    const heading = makeSpaceHeading(
      this.config.title,
      this.config.subtitle,
      this.config.key,
    );
    heading.position.set(0, 2.12, 0);
    this.group.add(heading);
  }

  private buildRotating(): void {
    const { accent, accent2, planeCount, planeSpacing, planeSize, documents, arrows } =
      this.config;

    const half = ((planeCount - 1) * planeSpacing) / 2;

    for (let i = 0; i < planeCount; i++) {
      const z = -half + i * planeSpacing;
      const geom = new THREE.PlaneGeometry(planeSize, planeSize);
      const borderColor = i % 2 === 0 ? accent : accent2;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geom, 1),
        new THREE.LineBasicMaterial({
          color: borderColor,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        }),
      );
      edges.position.z = z;
      this.rotating.add(edges);
      geom.dispose();
    }

    const sphereGeom = new THREE.SphereGeometry(0.14, 20, 20);
    const biasRadius = 0.52;
    const queryBiasScale = 0.12;

    for (const doc of documents) {
      const color = doc.isQuery ? 0xfbbf24 : 0xf8fafc;
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: doc.isQuery ? 0xf59e0b : 0xe2e8f0,
        emissiveIntensity: doc.isQuery ? 0.9 : 0.45,
        metalness: 0.15,
        roughness: 0.35,
      });
      const mesh = new THREE.Mesh(sphereGeom, mat);
      const bias = doc.isQuery
        ? randomBiasInSphere(biasRadius * queryBiasScale)
        : randomBiasInSphere(biasRadius);
      mesh.position.copy(this.docAnchor).add(bias);
      this.rotating.add(mesh);

      const labelClass = doc.isQuery
        ? "label label--query"
        : "label";
      const label = makeLabel(doc.id, labelClass);
      label.position.copy(mesh.position).add(new THREE.Vector3(0, 0.26, 0));
      this.rotating.add(label);
    }

    const origin = new THREE.Vector3(0, 0, 0);
    for (const spec of arrows) {
      const dir = spec.direction.clone().normalize();
      const headLen = 0.38;
      const headWidth = 0.3;
      const arrow = new THREE.ArrowHelper(
        dir,
        origin,
        spec.length,
        spec.color,
        headLen,
        headWidth,
      );
      strengthenArrow(arrow);
      this.rotating.add(arrow);

      const shaftLen = Math.max(spec.length - headLen * 0.95, 0.2);
      const shaftGeom = new THREE.CylinderGeometry(0.045, 0.038, shaftLen, 14);
      const shaftMat = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const shaft = new THREE.Mesh(shaftGeom, shaftMat);
      shaft.position.copy(origin).addScaledVector(dir, shaftLen * 0.5);
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      this.rotating.add(shaft);

      const tip = origin.clone().addScaledVector(dir, spec.length + headLen * 0.55 + 0.12);
      const dimLabel = makeLabel(spec.label, "label label--dim");
      dimLabel.position.copy(tip);
      this.rotating.add(dimLabel);
    }
  }

  update(delta: number, speed: number): void {
    const v = delta * speed;
    this.angleX += v * 0.36;
    this.angleY += v * 0.58;
    this.angleZ += v * 0.29;
    const b = this.baseRotation;
    this.rotating.rotation.x = b.x + this.angleX;
    this.rotating.rotation.y = b.y + this.angleY;
    this.rotating.rotation.z = b.z + this.angleZ;
  }
}
