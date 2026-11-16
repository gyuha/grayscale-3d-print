import { test, expect } from 'vitest'
import { processImage } from './pipeline'
import { DEFAULT_ADJUST } from './image'
import { DEFAULT_LAYERS } from './heights'

test('black/white 2×1 image → darkest at base, brightest at top step', () => {
  const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])
  const r = processImage(rgba, 2, 1, { steps: 7, adjust: DEFAULT_ADJUST, layers: DEFAULT_LAYERS, widthMm: 0.4, pitch: 0.2 })
  expect([r.cols, r.rows]).toEqual([2, 1])
  expect(Array.from(r.stepIdx)).toEqual([0, 6])
  expect(Array.from(r.heights).map((v) => +v.toFixed(4))).toEqual([0.88, 1.36])
})

test('corner radius zeroes heights outside the arc and reports the mask', () => {
  const rgba = new Uint8ClampedArray(10 * 10 * 4).fill(255)
  const r = processImage(rgba, 10, 10, { steps: 7, adjust: DEFAULT_ADJUST, layers: DEFAULT_LAYERS, widthMm: 2, pitch: 0.2, cornerRadiusMm: 0.6 })
  expect(r.mask[0]).toBe(0)
  expect(r.heights[0]).toBe(0)
  expect(r.heights[5 * 10 + 5]).toBeCloseTo(1.36, 4)
})

test('transparent pixels are not printed (height 0, mask 0)', () => {
  const rgba = new Uint8ClampedArray([255, 255, 255, 0, 255, 255, 255, 255])
  const r = processImage(rgba, 2, 1, { steps: 7, adjust: DEFAULT_ADJUST, layers: DEFAULT_LAYERS, widthMm: 0.4, pitch: 0.2 })
  expect(Array.from(r.mask)).toEqual([0, 1])
  expect(r.heights[0]).toBe(0)
  expect(r.heights[1]).toBeCloseTo(1.36, 4)
})

test('cell kept only when average opacity ≥ 50%; partially transparent black stays black', () => {
  // 4×1 → 2 cells: [black a=1, black a=0] avg alpha .5 → kept, dark;  [white a=0.2, white a=0.2] → dropped
  const rgba = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 51, 255, 255, 255, 51])
  const r = processImage(rgba, 4, 1, { steps: 7, adjust: DEFAULT_ADJUST, layers: DEFAULT_LAYERS, widthMm: 0.4, pitch: 0.2 })
  expect(Array.from(r.mask)).toEqual([1, 0])
  expect(r.gray[0]).toBe(0)
  expect(r.stepIdx[0]).toBe(0)
})
