import * as THREE from "three";
import { ANCHORS, TIMING } from "./config";

const DEFAULT_ORB_OPACITY = 0.42;
const DEFAULT_ORB_EMISSIVE = 1.1;

export type WormholePortRefs = {
  sparseOut: THREE.Object3D;
  denseIn: THREE.Object3D;
  denseOut: THREE.Object3D;
  graphIn: THREE.Object3D;
};

type Particle = {
  mesh: THREE.Mesh;
  beam: 0 | 1;
  offset: number;
  scaleJitter: number;
};

export class Wormhole {
  readonly group = new THREE.Group();
  private readonly particles: Particle[] = [];
  private readonly lineSparseToDense: THREE.LineCurve3;
  private readonly lineDenseToGraph: THREE.LineCurve3;
  private readonly tmp = new THREE.Vector3();
  private readonly wA = new THREE.Vector3();
  private readonly wB = new THREE.Vector3();
  private readonly wC = new THREE.Vector3();
  private readonly wD = new THREE.Vector3();
  private readonly sharedSphereGeom: THREE.SphereGeometry;
  private readonly spineSparseDense: THREE.Line;
  private readonly spineDenseGraph: THREE.Line;
  private readonly pulseSparse: THREE.Mesh;
  private readonly pulseDense: THREE.Mesh;
  private readonly pulseGeom: THREE.SphereGeometry;
  private readonly pulseSparseLight: THREE.PointLight;
  private readonly pulseDenseLight: THREE.PointLight;
  private portSparseOut: THREE.Object3D | null = null;
  private portDenseIn: THREE.Object3D | null = null;
  private portDenseOut: THREE.Object3D | null = null;
  private portGraphIn: THREE.Object3D | null = null;

  constructor(scene: THREE.Scene, particleCountPerBeam = 36) {
    scene.add(this.group);

    this.lineSparseToDense = new THREE.LineCurve3(
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
    );
    this.lineDenseToGraph = new THREE.LineCurve3(
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
    );

    const spineMat = new THREE.LineBasicMaterial({
      color: 0xe8e8f0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.spineSparseDense = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(1, 0, 0),
      ]),
      spineMat.clone(),
    );
    this.spineSparseDense.visible = false;
    this.group.add(this.spineSparseDense);

    this.spineDenseGraph = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(1, 0, 0),
      ]),
      spineMat.clone(),
    );
    this.spineDenseGraph.visible = false;
    this.group.add(this.spineDenseGraph);

    this.pulseGeom = new THREE.SphereGeometry(0.14, 20, 20);
    const pulseMatSparse = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xfbbf24,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.pulseSparse = new THREE.Mesh(this.pulseGeom, pulseMatSparse);
    this.pulseSparse.visible = false;
    this.group.add(this.pulseSparse);

    const pulseMatDense = new THREE.MeshStandardMaterial({
      color: 0xcffafe,
      emissive: 0x22d3ee,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.pulseDense = new THREE.Mesh(this.pulseGeom, pulseMatDense);
    this.pulseDense.visible = false;
    this.group.add(this.pulseDense);

    this.pulseSparseLight = new THREE.PointLight(0xfbbf24, 0, 10, 2);
    this.group.add(this.pulseSparseLight);

    this.pulseDenseLight = new THREE.PointLight(0x67e8f9, 0, 10, 2);
    this.group.add(this.pulseDenseLight);

    this.sharedSphereGeom = new THREE.SphereGeometry(0.1, 16, 16);
    const matTemplate = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xe879f9,
      emissiveIntensity: DEFAULT_ORB_EMISSIVE,
      transparent: true,
      opacity: DEFAULT_ORB_OPACITY,
      metalness: 0.05,
      roughness: 0.45,
      depthWrite: false,
    });

    const beams: readonly [0, 1] = [0, 1];
    for (const beam of beams) {
      for (let i = 0; i < particleCountPerBeam; i++) {
        const mat = matTemplate.clone();
        const mesh = new THREE.Mesh(this.sharedSphereGeom, mat);
        mesh.visible = false;
        mesh.scale.setScalar(0.95);
        this.group.add(mesh);
        this.particles.push({
          mesh,
          beam,
          offset:
            particleCountPerBeam > 1
              ? i / (particleCountPerBeam - 1)
              : 0,
          scaleJitter: 0.92 + (i % 5) * 0.02,
        });
      }
    }

    matTemplate.dispose();

    const glow = new THREE.PointLight(0xc084fc, 0.85, 18, 2);
    glow.position.copy(ANCHORS.dense);
    this.group.add(glow);
  }

  bindPorts(ports: WormholePortRefs): void {
    this.portSparseOut = ports.sparseOut;
    this.portDenseIn = ports.denseIn;
    this.portDenseOut = ports.denseOut;
    this.portGraphIn = ports.graphIn;
  }

  private syncPortWorldGeometry(): void {
    if (
      !this.portSparseOut ||
      !this.portDenseIn ||
      !this.portDenseOut ||
      !this.portGraphIn
    ) {
      return;
    }

    this.portSparseOut.getWorldPosition(this.wA);
    this.portDenseIn.getWorldPosition(this.wB);
    this.portDenseOut.getWorldPosition(this.wC);
    this.portGraphIn.getWorldPosition(this.wD);

    this.lineSparseToDense.v1.copy(this.wA);
    this.lineSparseToDense.v2.copy(this.wB);
    this.lineDenseToGraph.v1.copy(this.wC);
    this.lineDenseToGraph.v2.copy(this.wD);

    (this.spineSparseDense.geometry as THREE.BufferGeometry).setFromPoints([
      this.wA.clone(),
      this.wB.clone(),
    ]);
    (this.spineDenseGraph.geometry as THREE.BufferGeometry).setFromPoints([
      this.wC.clone(),
      this.wD.clone(),
    ]);

    this.pulseSparse.position.copy(this.wA);
    this.pulseSparseLight.position.copy(this.wA);
    this.pulseDense.position.copy(this.wC);
    this.pulseDenseLight.position.copy(this.wC);
  }

  reset(): void {
    for (const p of this.particles) {
      p.mesh.visible = false;
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = DEFAULT_ORB_OPACITY;
      mat.emissiveIntensity = DEFAULT_ORB_EMISSIVE;
      p.mesh.scale.setScalar(0.95);
    }
    this.spineSparseDense.visible = false;
    (this.spineSparseDense.material as THREE.LineBasicMaterial).opacity = 0;
    this.spineDenseGraph.visible = false;
    (this.spineDenseGraph.material as THREE.LineBasicMaterial).opacity = 0;
    this.pulseSparse.visible = false;
    this.pulseDense.visible = false;
    this.pulseSparseLight.intensity = 0;
    this.pulseDenseLight.intensity = 0;
  }

  update(elapsed: number): void {
    this.syncPortWorldGeometry();

    const {
      beamWarmup,
      beamSparseToDense,
      beamDenseStartAfterWarmup,
      beamDenseToGraph,
    } = TIMING;

    const pulseA = 0.5 + 0.5 * Math.sin(elapsed * 7.2);
    const pulseB = 0.5 + 0.5 * Math.sin(elapsed * 7.2 + 1.1);

    if (elapsed >= beamWarmup) {
      this.spineSparseDense.visible = true;
      (this.spineSparseDense.material as THREE.LineBasicMaterial).opacity = 0.55;
      this.pulseSparse.visible = true;
      this.pulseSparse.scale.setScalar(0.75 + pulseA * 0.55);
      (this.pulseSparse.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.4 + pulseA * 2.2;
      this.pulseSparseLight.intensity = 1.2 + pulseA * 2.0;
    } else {
      this.pulseSparse.visible = false;
      this.pulseSparseLight.intensity = 0;
    }

    if (elapsed >= beamDenseStartAfterWarmup) {
      this.spineDenseGraph.visible = true;
      (this.spineDenseGraph.material as THREE.LineBasicMaterial).opacity = 0.55;
      this.pulseDense.visible = true;
      this.pulseDense.scale.setScalar(0.75 + pulseB * 0.55);
      (this.pulseDense.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.2 + pulseB * 2.0;
      this.pulseDenseLight.intensity = 1.0 + pulseB * 1.8;
    } else {
      this.pulseDense.visible = false;
      this.pulseDenseLight.intensity = 0;
    }

    const waveSpeed = 4.2;

    for (const p of this.particles) {
      const line = p.beam === 0 ? this.lineSparseToDense : this.lineDenseToGraph;
      const dur = p.beam === 0 ? beamSparseToDense : beamDenseToGraph;
      const start =
        p.beam === 0 ? beamWarmup : beamDenseStartAfterWarmup;

      const u = (elapsed - start) / dur - p.offset * 0.92;
      const mat = p.mesh.material as THREE.MeshStandardMaterial;

      if (u < 0) {
        p.mesh.visible = false;
        continue;
      }

      const travelWave =
        0.5 + 0.5 * Math.sin(elapsed * waveSpeed - p.offset * Math.PI * 3.2);
      const idleWave =
        0.5 + 0.5 * Math.sin(elapsed * 2.8 + p.offset * Math.PI * 2.4);

      if (u > 1) {
        line.getPoint(p.offset, this.tmp);
        p.mesh.position.copy(this.tmp);
        p.mesh.visible = true;
        mat.opacity = THREE.MathUtils.clamp(0.28 + idleWave * 0.22, 0.18, 0.52);
        mat.emissiveIntensity = 0.75 + idleWave * 0.55;
        p.mesh.scale.setScalar(
          p.scaleJitter *
            (0.88 +
              idleWave * 0.14 +
              Math.sin(elapsed * 3.1 + p.offset * 8) * 0.06),
        );
        continue;
      }

      const t = THREE.MathUtils.clamp(u, 0, 1);
      line.getPoint(t, this.tmp);
      p.mesh.position.copy(this.tmp);
      p.mesh.visible = true;

      mat.opacity = THREE.MathUtils.clamp(
        0.3 +
          travelWave * 0.28 +
          Math.sin(elapsed * 5.5 + p.offset * 14) * 0.08,
        0.2,
        0.58,
      );
      mat.emissiveIntensity =
        0.85 +
        travelWave * 0.65 +
        Math.sin(elapsed * 4.2 + p.offset * 10) * 0.2;
      p.mesh.scale.setScalar(
        p.scaleJitter *
          (0.86 +
            travelWave * 0.2 +
            Math.sin(elapsed * 6 + p.offset * 12) * 0.08),
      );
    }
  }

  dispose(): void {
    this.sharedSphereGeom.dispose();
    this.pulseGeom.dispose();
    for (const p of this.particles) {
      (p.mesh.material as THREE.Material).dispose();
      this.group.remove(p.mesh);
    }
    this.particles.length = 0;
    (this.spineSparseDense.geometry as THREE.BufferGeometry).dispose();
    (this.spineSparseDense.material as THREE.Material).dispose();
    (this.spineDenseGraph.geometry as THREE.BufferGeometry).dispose();
    (this.spineDenseGraph.material as THREE.Material).dispose();
    (this.pulseSparse.material as THREE.Material).dispose();
    (this.pulseDense.material as THREE.Material).dispose();
    this.group.clear();
    this.group.removeFromParent();
  }
}
