import './style.css'
import { start } from './draw.ts'

// Select the already existing canvas elements from index.html
const canvas2d = document.querySelector<HTMLCanvasElement>('#canvas-2d');
const canvasWebGL = document.querySelector<HTMLCanvasElement>('#canvas-webgl');

// Ensure canvases exist before starting
if (canvas2d && canvasWebGL) {
  start({
    canvas2d: canvas2d,
    canvasWebGL: canvasWebGL
  });
} else {
  console.error("Canvas elements not found! Check index.html.");
}
