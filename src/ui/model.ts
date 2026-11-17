import { DEFAULT_ADJUST } from '../core/image'
import { DEFAULT_LAYERS, snapToLayerGrid, stepHeights } from '../core/heights'
import type { PipelineParams } from '../core/pipeline'
import { toolChangeTopZ } from '../core/threemf'
import { parseHex } from '../core/color'

export const DEFAULT_PARAMS: PipelineParams = {
  steps: 7,
  adjust: DEFAULT_ADJUST,
  layers: DEFAULT_LAYERS,
  widthMm: 50,
  pitch: 0.2,
  cornerRadiusMm: 0,
}

/** Display grey of tone step k (linear black → white; not a print-color simulation). */
export const toneGray = (k: number, steps: number) => Math.round((k / (steps - 1)) * 255)

/** `mask` (optional): 0 = cell cut by the rounded outline → transparent */
export function toneRgba(stepIdx: Uint8Array, steps: number, mask?: Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(stepIdx.length * 4)
  for (let i = 0; i < stepIdx.length; i++) {
    const g = toneGray(stepIdx[i], steps)
    out.set([g, g, g, mask && !mask[i] ? 0 : 255], i * 4)
  }
  return out
}

export function grayRgba(gray: Float32Array, mask?: Uint8Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length * 4)
  for (let i = 0; i < gray.length; i++) {
    const g = Math.round(gray[i])
    out.set([g, g, g, mask && !mask[i] ? 0 : 255], i * 4)
  }
  return out
}

/** Default filament colors per count (AMS slot order). 2 = the original black base + white; 3+ add accent colors. */
export const defaultColors = (k: number) => (k === 1 ? ['#ffffff'] : ['#000000', '#ffffff', '#f0a8b4', '#3050e0'].slice(0, k))

/** Color region preview: each cell in its palette color. `mask`: 0 = cell not printed → transparent. */
export function regionRgba(color: Uint8Array, palette: string[], mask: Uint8Array): Uint8ClampedArray {
  const rgb = palette.map(parseHex)
  const out = new Uint8ClampedArray(color.length * 4)
  for (let i = 0; i < color.length; i++) out.set([...rgb[color[i]], mask[i] ? 255 : 0], i * 4)
  return out
}

/** Number of printed cells of each palette color. */
export function regionCounts(color: Uint8Array, mask: Uint8Array, colors: number): number[] {
  const n = Array(colors).fill(0)
  for (let i = 0; i < color.length; i++) if (mask[i]) n[color[i]]++
  return n
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6

export function summarize(p: PipelineParams, cols: number, rows: number) {
  const hs = stepHeights(p.steps, p.layers)
  return {
    colorChangeZ: snapToLayerGrid(p.layers.baseThickness, p.layers),
    firstWhiteLayerZ: toolChangeTopZ(p.layers),
    maxZ: hs[hs.length - 1],
    widthMm: r6(cols * p.pitch),
    heightMm: r6(rows * p.pitch),
  }
}

/** Largest meaningful corner radius (mm): half the shorter side of the model. */
export const maxCornerRadius = (cols: number, rows: number, pitch: number) => r6((Math.min(cols, rows) * pitch) / 2)
