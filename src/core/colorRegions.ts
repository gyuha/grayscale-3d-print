import { toAlpha } from './image'
import { resampleGray } from './heights'
import { nearestColor, parseHex } from './color'
import { processImage, type PipelineParams } from './pipeline'
import { buildMesh, type Mesh } from './mesh'

/**
 * Color region mode (3+ filaments): the grayscale pipeline's result (tone steps and heights, exactly as with 1–2
 * filaments) plus, per cell, the index of the Lab-nearest palette color of the cell's opacity-weighted average color.
 * `palette` is in AMS slot order (#rrggbb); slot i prints with filament i+1.
 */
export function processRegionImage(rgba: Uint8ClampedArray, w: number, h: number, p: PipelineParams, palette: string[]) {
  const result = processImage(rgba, w, h, p)
  const { cols, rows } = result
  const alpha = toAlpha(rgba)
  const cover = resampleGray(alpha, w, h, cols, rows)
  const avg = [0, 1, 2].map((ch) => {
    const premul = new Float32Array(w * h)
    for (let i = 0; i < premul.length; i++) premul[i] = rgba[i * 4 + ch] * alpha[i]
    const r = resampleGray(premul, w, h, cols, rows)
    for (let i = 0; i < r.length; i++) r[i] = cover[i] > 0 ? r[i] / cover[i] : 255
    return r
  })
  const rgb = palette.map(parseHex)
  const color = new Uint8Array(cols * rows)
  for (let i = 0; i < color.length; i++) color[i] = nearestColor(avg[0][i], avg[1][i], avg[2][i], rgb)
  return { ...result, color }
}

export interface RegionPart {
  /** AMS slot (0-based) the part is printed with */
  slot: number
  mesh: Mesh
}

/**
 * Parts of a color region print. Slot 0 is the base: a plate under every present cell (bed → `base`) merged with its own
 * color cells. Every other color sits only on top of the base, so the picture shows on the top face alone and the base
 * layers print without filament changes. Each cell ends `lift` above its tone height, so even the darkest tone step
 * (height = base) gets a layer of its own color. Colors without cells have no part.
 */
export function buildRegionParts(heights: Float32Array, color: Uint8Array, cols: number, rows: number, pitch: number, colors: number, base: number, lift: number): RegionPart[] {
  const plate = new Float32Array(heights.length)
  for (let i = 0; i < plate.length; i++) if (heights[i] > 0) plate[i] = color[i] === 0 ? heights[i] + lift : base
  const parts: RegionPart[] = [{ slot: 0, mesh: buildMesh(plate, cols, rows, pitch) }]
  for (let slot = 1; slot < colors; slot++) {
    const thick = new Float32Array(heights.length)
    let any = false
    for (let i = 0; i < thick.length; i++) if (color[i] === slot && heights[i] > 0) { thick[i] = heights[i] + lift - base; any = true }
    if (!any) continue
    const mesh = buildMesh(thick, cols, rows, pitch)
    for (let i = 2; i < mesh.positions.length; i += 3) mesh.positions[i] += base
    parts.push({ slot, mesh })
  }
  return parts
}
