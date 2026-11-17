import { describe, test, expect } from 'vitest'
import { processRegionImage, buildRegionParts } from './colorRegions'
import { processImage, type PipelineParams } from './pipeline'
import { DEFAULT_ADJUST } from './image'
import { DEFAULT_LAYERS } from './heights'
import type { Mesh } from './mesh'

const PALETTE = ['#000000', '#f0a8b4', '#ffffff'] // black, pink, white
const params: PipelineParams = { steps: 7, adjust: DEFAULT_ADJUST, layers: DEFAULT_LAYERS, widthMm: 0.6, pitch: 0.2 }
// pink, black, white
const rgba = new Uint8ClampedArray([240, 168, 180, 255, 0, 0, 0, 255, 255, 255, 255, 255])
const CELL = 0.2 * 0.2

describe('processRegionImage', () => {
  test('each cell takes its Lab-nearest palette color', () => {
    expect(Array.from(processRegionImage(rgba, 3, 1, params, PALETTE).color)).toEqual([1, 0, 2])
  })
  test('heights and tone steps are exactly the grayscale pipeline\'s (same as 1–2 filaments)', () => {
    for (const p of [params, { ...params, steps: 4, adjust: { ...DEFAULT_ADJUST, invert: true, contrast: 0.3 } }]) {
      const r = processRegionImage(rgba, 3, 1, p, PALETTE), g = processImage(rgba, 3, 1, p)
      expect(Array.from(r.heights)).toEqual(Array.from(g.heights))
      expect(Array.from(r.stepIdx)).toEqual(Array.from(g.stepIdx))
      expect(Array.from(r.color)).toEqual([1, 0, 2]) // adjustments never move a cell to another color
    }
  })
  test('brighter is taller: black at the base, pink above it, white on top', () => {
    const h = processRegionImage(rgba, 3, 1, params, PALETTE).heights
    expect(h[1]).toBeCloseTo(0.88, 5)
    expect(h[0]).toBeGreaterThan(h[1])
    expect(h[2]).toBeGreaterThan(h[0])
  })
  test('transparent cells are masked out (height 0)', () => {
    const t = new Uint8ClampedArray([240, 168, 180, 255, 240, 168, 180, 0, 0, 0, 0, 255])
    const r = processRegionImage(t, 3, 1, params, PALETTE)
    expect(Array.from(r.mask)).toEqual([1, 0, 1])
    expect(r.heights[1]).toBe(0)
  })
})

function signedVolume(m: Mesh) {
  const p = m.positions
  let v = 0
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t] * 3, m.indices[t + 1] * 3, m.indices[t + 2] * 3]
    v += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
      p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6
  }
  return v
}

const zRange = (m: Mesh) => {
  let lo = Infinity, hi = -Infinity
  for (let i = 2; i < m.positions.length; i += 3) { lo = Math.min(lo, m.positions[i]); hi = Math.max(hi, m.positions[i]) }
  return [lo, hi].map((v) => Math.round(v * 1e6) / 1e6)
}

describe('buildRegionParts: slot-0 base plate, the other colors only above it', () => {
  const BASE = 0.88, LIFT = 0.08
  const r = processRegionImage(rgba, 3, 1, params, PALETTE) // heights: pink 1.28, black 0.88, white 1.36
  const build = (q: typeof r) => buildRegionParts(q.heights, q.color, q.cols, q.rows, params.pitch, 3, BASE, LIFT)
  const parts = build(r)

  test('one part per color that has cells, mapped to its AMS slot', () => {
    expect(parts.map((x) => x.slot)).toEqual([0, 1, 2])
  })
  test('slot 0 is the plate under everything (bed → base) plus its own cells one layer higher', () => {
    expect(zRange(parts[0].mesh)).toEqual([0, 0.96])
    expect(signedVolume(parts[0].mesh)).toBeCloseTo(CELL * (0.96 + 0.88 + 0.88), 6) // own black cell 0.88+0.08, base under the two others
  })
  test('the other colors start on top of the base and end one layer above their tone height', () => {
    expect(zRange(parts[1].mesh)).toEqual([0.88, 1.36]) // pink 1.28 + 0.08
    expect(zRange(parts[2].mesh)).toEqual([0.88, 1.44]) // white 1.36 + 0.08
    expect(signedVolume(parts[1].mesh)).toBeCloseTo(CELL * (1.36 - 0.88), 6)
    expect(signedVolume(parts[2].mesh)).toBeCloseTo(CELL * (1.44 - 0.88), 6)
  })
  test('even the darkest tone step of a non-base color gets one layer of its own color', () => {
    const dark = new Uint8ClampedArray([110, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]) // dark red: luma 33 → step 0
    const q = processRegionImage(dark, 3, 1, params, ['#000000', '#800000', '#ffffff'])
    expect(q.color[0]).toBe(1)
    expect(q.heights[0]).toBeCloseTo(0.88, 5)
    expect(zRange(build(q)[1].mesh)).toEqual([0.88, 0.96])
  })
  test('parts do not overlap: volumes add up to Σ cell area × (height + one layer)', () => {
    const total = parts.reduce((a, x) => a + signedVolume(x.mesh), 0)
    expect(total).toBeCloseTo(CELL * (r.heights[0] + r.heights[1] + r.heights[2] + 3 * LIFT), 6)
  })
  test('a color with no cells has no part; masked cells have no base either', () => {
    const t = new Uint8ClampedArray([240, 168, 180, 255, 0, 0, 0, 0, 0, 0, 0, 255])
    const q = processRegionImage(t, 3, 1, params, PALETTE)
    const ps = build(q)
    expect(ps.map((x) => x.slot)).toEqual([0, 1])
    expect(signedVolume(ps[0].mesh)).toBeCloseTo(CELL * (0.88 + 0.96), 6) // base under pink + own black cell; nothing under the masked one
  })
})
