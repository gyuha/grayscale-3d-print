// Generates samples/sample.3mf from a synthetic gradient (7 tone steps) for checking in Bambu Studio.
// `npm run sample -- regions` writes samples/sample-regions.3mf instead: color region mode (black ring, pink dots, white
// background; palette black / white / pink, one part per color, height from the tone steps) for checking the multi-part 3MF in
// Bambu Studio.
import { mkdirSync, writeFileSync } from 'node:fs'
import { processImage } from '../src/core/pipeline'
import { DEFAULT_ADJUST } from '../src/core/image'
import { DEFAULT_LAYERS, stepHeights, snapToLayerGrid } from '../src/core/heights'
import { buildMesh } from '../src/core/mesh'
import { build3mf, build3mfParts, toolChangeTopZ } from '../src/core/threemf'
import { processRegionImage, buildRegionParts } from '../src/core/colorRegions'

if (process.argv[2] === 'regions') {
  const w = 600, h = 400
  const img = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = Math.hypot(x - 300, y - 200)
    const dot = Math.min(Math.hypot(x - 230, y - 200), Math.hypot(x - 370, y - 200)) < 30
    const px = r > 150 && r < 170 ? [0, 0, 0] : dot ? [240, 168, 180] : [255, 255, 255]
    img.set([px[0], px[1], px[2], 255], (y * w + x) * 4)
  }
  const palette = ['#000000', '#ffffff', '#f0a8b4']
  const pitch = 0.2
  const r = processRegionImage(img, w, h, { steps: 7, adjust: DEFAULT_ADJUST, layers: DEFAULT_LAYERS, widthMm: 60, pitch }, palette)
  const parts = buildRegionParts(r.heights, r.color, r.cols, r.rows, pitch, palette.length, snapToLayerGrid(DEFAULT_LAYERS.baseThickness, DEFAULT_LAYERS), DEFAULT_LAYERS.layerHeight)
  mkdirSync('samples', { recursive: true })
  writeFileSync('samples/sample-regions.3mf', build3mfParts(parts, { layers: DEFAULT_LAYERS, title: 'grayscale-sample-color-regions', colors: palette }))
  console.log(`samples/sample-regions.3mf: ${r.cols}×${r.rows} cells, ${parts.length} parts`)
  for (const part of parts) {
    let top = 0
    for (let i = 2; i < part.mesh.positions.length; i += 3) top = Math.max(top, part.mesh.positions[i])
    console.log(`  filament ${part.slot + 1} (${palette[part.slot]}): ${r.color.filter((c) => c === part.slot).length} cells, height ${top.toFixed(2)} mm, ${part.mesh.indices.length / 3} triangles`)
  }
  process.exit(0)
}

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
