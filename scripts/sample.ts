// Generates samples/sample.3mf from a synthetic gradient (7 tone steps) for checking in Bambu Studio.
import { mkdirSync, writeFileSync } from 'node:fs'
import { processImage } from '../src/core/pipeline'
import { DEFAULT_ADJUST } from '../src/core/image'
import { DEFAULT_LAYERS, stepHeights } from '../src/core/heights'
import { buildMesh } from '../src/core/mesh'
import { build3mf, toolChangeTopZ } from '../src/core/threemf'

const w = 700, h = 200
const rgba = new Uint8ClampedArray(w * h * 4)
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const v = Math.round((x / (w - 1)) * 255)
  rgba.set([v, v, v, 255], (y * w + x) * 4)
}
const steps = 7
const { cols, rows, heights } = processImage(rgba, w, h, { steps, adjust: DEFAULT_ADJUST, layers: DEFAULT_LAYERS, widthMm: 70, pitch: 0.2 })
const mesh = buildMesh(heights, cols, rows, 0.2)
mkdirSync('samples', { recursive: true })
writeFileSync('samples/sample.3mf', build3mf(mesh, { layers: DEFAULT_LAYERS, title: 'grayscale-sample-7-steps' }))
console.log(`samples/sample.3mf: ${cols}×${rows} cells, ${mesh.indices.length / 3} triangles`)
console.log(`step heights: ${stepHeights(steps, DEFAULT_LAYERS).join(', ')} mm; tool change top_z = ${toolChangeTopZ(DEFAULT_LAYERS)} mm`)
