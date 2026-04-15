import { createSceneBundle } from "./scene";
import { createDemoApp } from "./animation";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
const labelMount = document.querySelector<HTMLElement>("#labels-root");
const btnRestart = document.querySelector<HTMLButtonElement>("#btn-restart");
const btnPause = document.querySelector<HTMLButtonElement>("#btn-pause");

if (!canvas || !labelMount || !btnRestart || !btnPause) {
  throw new Error("Missing required DOM elements.");
}

const bundle = createSceneBundle(canvas, labelMount);
bundle.resize();

const demo = createDemoApp(bundle);
demo.start();

let paused = false;
btnPause.addEventListener("click", () => {
  paused = !paused;
  if (paused) demo.pause();
  else demo.resume();
});

btnRestart.addEventListener("click", () => {
  demo.restart();
  if (paused) {
    paused = false;
    demo.resume();
  }
});
