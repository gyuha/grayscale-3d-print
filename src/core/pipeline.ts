import { type AdjustParams, toGray, toAlpha, adjust, quantize } from './image'
import { type LayerParams, gridSize, resampleGray, heightMap, roundedCornerMask } from './heights'

export interface PipelineParams {
  steps: number
  adjust: AdjustParams
  layers: LayerParams
  widthMm: number
  pitch: number
  /** rounded outline corner radius (mm); 0 = sharp rectangle */
  cornerRadiusMm?: number
}

/** RGBA image → tone steps and heights on the model grid. Cells outside the rounded outline or mostly transparent (average opacity < 50%) get height 0 (absent). */
export function processImage(rgba: Uint8ClampedArray, w: number, h: number, p: PipelineParams) {
  const { cols, rows } = gridSize(w, h, p.widthMm, p.pitch)
  // opacity-weighted resample: average luminance of the opaque part only, plus average opacity per cell
  const lum = toGray(rgba), alpha = toAlpha(rgba)
  for (let i = 0; i < lum.length; i++) lum[i] *= alpha[i]
  const premul = resampleGray(lum, w, h, cols, rows), cover = resampleGray(alpha, w, h, cols, rows)
  for (let i = 0; i < premul.length; i++) premul[i] = cover[i] > 0 ? premul[i] / cover[i] : 255
  const gray = adjust(premul, p.adjust)
  const stepIdx = quantize(gray, p.steps)
  const heights = heightMap(stepIdx, p.steps, p.layers)
  const mask = roundedCornerMask(cols, rows, (p.cornerRadiusMm ?? 0) / p.pitch)
  for (let i = 0; i < mask.length; i++) if (cover[i] < 0.5) mask[i] = 0 // transparent → not printed
  for (let i = 0; i < mask.length; i++) if (!mask[i]) heights[i] = 0
  return { cols, rows, gray, stepIdx, heights, mask }
}
