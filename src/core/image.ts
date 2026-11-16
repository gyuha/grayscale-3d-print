export interface AdjustParams {
  /** -1..1, added as a fraction of 255 */
  brightness: number
  /** -1..1, scale factor (1 + contrast) around 128 */
  contrast: number
  /** > 0, output = 255 * (v/255)^(1/gamma) */
  gamma: number
  invert: boolean
}

export const DEFAULT_ADJUST: AdjustParams = { brightness: 0, contrast: 0, gamma: 1, invert: false }

export const MIN_STEPS = 2
export const MAX_STEPS = 10

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

/** RGBA → luminance (0..255), ignoring alpha (see toAlpha). */
export function toGray(rgba: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(rgba.length / 4)
  for (let i = 0; i < out.length; i++) out[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
  return out
}

/** RGBA → opacity (0..1). */
export function toAlpha(rgba: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(rgba.length / 4)
  for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4 + 3] / 255
  return out
}

/** Apply brightness → contrast → gamma → invert, clamped to 0..255. */
export function adjust(gray: Float32Array, p: AdjustParams): Float32Array {
  const out = new Float32Array(gray.length)
  for (let i = 0; i < gray.length; i++) {
    let v = clamp(gray[i] + p.brightness * 255)
    v = clamp((v - 128) * (1 + p.contrast) + 128)
    if (p.gamma !== 1) v = 255 * Math.pow(v / 255, 1 / p.gamma)
    if (p.invert) v = 255 - v
    out[i] = v
  }
  return out
}

/** Split 0..255 into N equal intervals → tone step index 0 (darkest) .. N-1 (brightest). */
export function quantize(gray: Float32Array, steps: number): Uint8Array {
  if (!Number.isInteger(steps) || steps < MIN_STEPS || steps > MAX_STEPS) {
    throw new RangeError(`steps must be an integer in ${MIN_STEPS}..${MAX_STEPS}`)
  }
  const out = new Uint8Array(gray.length)
  for (let i = 0; i < gray.length; i++) {
    out[i] = Math.min(steps - 1, Math.floor((gray[i] / 256) * steps))
  }
  return out
}
