import './style.css'
import { start } from './draw.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <div id="canvas-container">
      <canvas id="canvas-2d" width="600" height="600"></canvas>
      <canvas id="canvas-webgl" width="600" height="600"></canvas>
    </div>
    <div id="button-container">
      <button id="render-button">Render</button>
    </div>
  </div>
`

start({
  canvas2d: document.querySelector<HTMLCanvasElement>('#canvas-2d')!,
  canvasWebGL: document.querySelector<HTMLCanvasElement>('#canvas-webgl')!
})
