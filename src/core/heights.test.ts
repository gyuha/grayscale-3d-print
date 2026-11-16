import { describe, test, expect } from 'vitest'
import { snapToLayerGrid, stepHeights, heightMap, gridSize, resampleGray, roundedCornerMask, DEFAULT_LAYERS } from './heights'

describe('snapToLayerGrid', () => {
  test('0.9 → 0.88 (0.16 + 9×0.08)', () => {
    expect(snapToLayerGrid(0.9, DEFAULT_LAYERS)).toBe(0.88)
  })
  test('never below the first layer', () => {
    expect(snapToLayerGrid(0.05, DEFAULT_LAYERS)).toBe(0.16)
  })
  test('exact values stay', () => {
    expect(snapToLayerGrid(0.88, DEFAULT_LAYERS)).toBe(0.88)
  })
})

describe('stepHeights', () => {
  test('N=7, m=1 → 0.88 .. 1.36 in 0.08 steps', () => {
    expect(stepHeights(7, DEFAULT_LAYERS)).toEqual([0.88, 0.96, 1.04, 1.12, 1.2, 1.28, 1.36])
  })
  test('m=2 doubles the spacing', () => {
    expect(stepHeights(3, { ...DEFAULT_LAYERS, layersPerStep: 2 })).toEqual([0.88, 1.04, 1.2])
  })
  test('base is snapped before use', () => {
    expect(stepHeights(2, { ...DEFAULT_LAYERS, baseThickness: 0.9 })[0]).toBe(0.88)
  })
})

describe('heightMap', () => {
  test('maps step indices to heights', () => {
    const h = heightMap(new Uint8Array([0, 6, 3]), 7, DEFAULT_LAYERS)
    expect(Array.from(h).map((v) => +v.toFixed(4))).toEqual([0.88, 1.36, 1.12])
  })
})

describe('gridSize', () => {
  test('width 50mm @0.2 → 250 cols, rows follow aspect', () => {
    expect(gridSize(500, 1800, 50, 0.2)).toEqual({ cols: 250, rows: 900 })
  })
})

describe('resampleGray', () => {
  test('2×2 → 1×1 averages', () => {
    expect(Array.from(resampleGray(new Float32Array([0, 100, 200, 100]), 2, 2, 1, 1))).toEqual([100])
  })
  test('identity when same size', () => {
    const g = new Float32Array([1, 2, 3, 4, 5, 6])
    expect(Array.from(resampleGray(g, 3, 2, 3, 2))).toEqual([1, 2, 3, 4, 5, 6])
  })
  test('upscale 1×1 → 2×2 repeats', () => {
    expect(Array.from(resampleGray(new Float32Array([7]), 1, 1, 2, 2))).toEqual([7, 7, 7, 7])
  })
})

describe('roundedCornerMask', () => {
  test('radius 0 keeps every cell', () => {
    expect(Array.from(roundedCornerMask(4, 3, 0)).every((v) => v === 1)).toBe(true)
  })
  test('corner cells outside the arc are removed, symmetric on all 4 corners', () => {
    const cols = 20, rows = 10
    const m = roundedCornerMask(cols, rows, 5)
    const at = (c: number, r: number) => m[r * cols + c]
    for (const [c, r] of [[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]]) expect(at(c, r)).toBe(0)
    expect(at(10, 0)).toBe(1) // edge middle untouched
    expect(at(0, 5)).toBe(1)
    expect(at(2, 2)).toBe(1) // inside the arc
  })
  test('radius is clamped to half the shorter side', () => {
    const a = roundedCornerMask(10, 6, 3), b = roundedCornerMask(10, 6, 100)
    expect(Array.from(b)).toEqual(Array.from(a))
  })
})
