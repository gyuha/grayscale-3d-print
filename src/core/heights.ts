export interface LayerParams {
  /** slicer layer height (mm) */
  layerHeight: number
  /** slicer first layer height (mm) */
  firstLayerHeight: number
  /** black base thickness (mm); snapped to the layer grid = color change height */
  baseThickness: number
  /** white layers per tone step (m) */
  layersPerStep: number
}

export const DEFAULT_LAYERS: LayerParams = {
  layerHeight: 0.08,
  firstLayerHeight: 0.16,
  baseThickness: 0.88,
  layersPerStep: 1,
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6

/** Nearest Z on the grid firstLayer + n×layer (n ≥ 0). */
export function snapToLayerGrid(z: number, p: LayerParams): number {
  const n = Math.max(0, Math.round((z - p.firstLayerHeight) / p.layerHeight))
  return round6(p.firstLayerHeight + n * p.layerHeight)
}

/** Height of each tone step: k=0 sits at the base (color change height), k adds k×m white layers. */
export function stepHeights(steps: number, p: LayerParams): number[] {
  const base = snapToLayerGrid(p.baseThickness, p)
  return Array.from({ length: steps }, (_, k) => round6(base + k * p.layersPerStep * p.layerHeight))
}

export function heightMap(stepIdx: Uint8Array, steps: number, p: LayerParams): Float32Array {
  const hs = stepHeights(steps, p)
  const out = new Float32Array(stepIdx.length)
  for (let i = 0; i < stepIdx.length; i++) out[i] = hs[stepIdx[i]]
  return out
}

/** Grid dimensions for a model of the given width (mm) at the given pixel pitch (mm). */
export function gridSize(imgW: number, imgH: number, widthMm: number, pitch: number) {
  const cols = Math.max(1, Math.round(widthMm / pitch))
  const rows = Math.max(1, Math.round((cols * imgH) / imgW))
  return { cols, rows }
}

/** Box-average resample of a grayscale image to cols×rows. */
export function resampleGray(gray: Float32Array, w: number, h: number, cols: number, rows: number): Float32Array {
  const out = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor((r * h) / rows)
    const y1 = Math.max(y0 + 1, Math.floor(((r + 1) * h) / rows))
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * w) / cols)
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) * w) / cols))
      let sum = 0
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sum += gray[y * w + x]
      out[r * cols + c] = sum / ((y1 - y0) * (x1 - x0))
    }
  }
  return out
}

/**
 * 1 = cell kept, 0 = cell outside a rounded corner. `radius` is in cells, clamped to half the shorter side.
 * A corner cell is kept when its center lies within the corner arc.
 */
export function roundedCornerMask(cols: number, rows: number, radius: number): Uint8Array {
  const r = Math.min(radius, cols / 2, rows / 2)
  const mask = new Uint8Array(cols * rows).fill(1)
  if (r <= 0) return mask
  for (let y = 0; y < rows; y++) {
    const dy = Math.max(0, r - (y + 0.5), y + 0.5 - (rows - r))
    if (dy === 0) continue
    for (let x = 0; x < cols; x++) {
      const dx = Math.max(0, r - (x + 0.5), x + 0.5 - (cols - r))
      if (dx > 0 && Math.hypot(dx, dy) > r) mask[y * cols + x] = 0
    }
  }
  return mask
}
