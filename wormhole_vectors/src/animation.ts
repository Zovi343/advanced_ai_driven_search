import type { SceneBundle } from "./scene";
import { VectorSpace } from "./VectorSpace";
import { GraphSpace } from "./GraphSpace";
import { Wormhole } from "./wormhole";
import { DENSE_SPACE, ROTATION_SPEED, SPARSE_SPACE } from "./config";

export type DemoApp = {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  dispose: () => void;
};

export function createDemoApp(bundle: SceneBundle): DemoApp {
  const { scene, camera, webglRenderer, labelRenderer } = bundle;

  const sparse = new VectorSpace(SPARSE_SPACE);
  const dense = new VectorSpace(DENSE_SPACE);
  const graph = new GraphSpace();
  const wormhole = new Wormhole(scene);

  wormhole.bindPorts({
    sparseOut: sparse.portWormholeA,
    denseIn: dense.portWormholeA,
    denseOut: dense.portWormholeB!,
    graphIn: graph.portWormholeLineEnd,
  });

  scene.add(sparse.group, dense.group, graph.group);

  let raf = 0;
  let running = true;
  let elapsed = 0;
  let last = performance.now();

  const tick = (now: number) => {
    if (running) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      sparse.update(dt, ROTATION_SPEED);
      dense.update(dt, ROTATION_SPEED * 0.92);
      graph.update(dt, ROTATION_SPEED);
      wormhole.update(elapsed);

      camera.position.x = Math.sin(elapsed * 0.08) * 0.35;
      camera.lookAt(0, -0.15, 0);
    } else {
      last = now;
    }

    webglRenderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  return {
    start() {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    pause() {
      running = false;
    },
    resume() {
      running = true;
    },
    restart() {
      elapsed = 0;
      last = performance.now();
      running = true;
      wormhole.reset();
    },
    dispose() {
      cancelAnimationFrame(raf);
      scene.remove(sparse.group, dense.group, graph.group);
      wormhole.dispose();
    },
  };
}
