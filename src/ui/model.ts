import { DEFAULT_ADJUST } from '../core/image'
import { DEFAULT_LAYERS, snapToLayerGrid, stepHeights } from '../core/heights'
import type { PipelineParams } from '../core/pipeline'
import { toolChangeTopZ } from '../core/threemf'

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
