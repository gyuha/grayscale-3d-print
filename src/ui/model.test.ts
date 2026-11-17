import { describe, test, expect } from 'vitest'
import { toneGray, toneRgba, grayRgba, summarize, maxCornerRadius, defaultColors, regionRgba, regionCounts, DEFAULT_PARAMS } from './model'
import { processImage } from '../core/pipeline'

describe('toneGray: step → linear black→white display grey', () => {
  test('N=7 endpoints and middle', () => {
    expect(toneGray(0, 7)).toBe(0)
    expect(toneGray(6, 7)).toBe(255)
    expect(toneGray(3, 7)).toBe(128)
  })
  test('N=4', () => {
    expect([0, 1, 2, 3].map((k) => toneGray(k, 4))).toEqual([0, 85, 170, 255])
  })
})

describe('preview pixels', () => {
  test('toneRgba maps each step to an opaque grey pixel', () => {
    expect(Array.from(toneRgba(new Uint8Array([0, 1]), 2))).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })
  test('grayRgba rounds and is opaque', () => {
    expect(Array.from(grayRgba(new Float32Array([10.4, 200.6])))).toEqual([10, 10, 10, 255, 201, 201, 201, 255])
  })
})

describe('summarize', () => {
  test('default params: change at 0.88, max 1.36, size from grid', () => {
    expect(summarize(DEFAULT_PARAMS, 250, 900)).toEqual({ colorChangeZ: 0.88, firstWhiteLayerZ: 0.96, maxZ: 1.36, widthMm: 50, heightMm: 180 })
  })
  test('base thickness is snapped to the layer grid', () => {
    const s = summarize({ ...DEFAULT_PARAMS, layers: { ...DEFAULT_PARAMS.layers, baseThickness: 0.9 } }, 10, 10)
    expect(s.colorChangeZ).toBe(0.88)
  })
})

describe('parameter changes recompute the pipeline', () => {
  const rgba = new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255])
  test('N=7 → N=4 changes step indices', () => {
    const p = { ...DEFAULT_PARAMS, widthMm: 0.6, pitch: 0.2 }
    expect(Array.from(processImage(rgba, 3, 1, p).stepIdx)).toEqual([0, 3, 6])
    expect(Array.from(processImage(rgba, 3, 1, { ...p, steps: 4 }).stepIdx)).toEqual([0, 2, 3])
  })
  test('snapped base flows into heights', () => {
    const p = { ...DEFAULT_PARAMS, widthMm: 0.6, pitch: 0.2, layers: { ...DEFAULT_PARAMS.layers, baseThickness: 0.9 } }
    expect(+processImage(rgba, 3, 1, p).heights[0].toFixed(4)).toBe(0.88)
  })
  test('pipeline exposes the adjusted grey at grid resolution', () => {
    const p = { ...DEFAULT_PARAMS, widthMm: 0.6, pitch: 0.2 }
    expect(Array.from(processImage(rgba, 3, 1, p).gray)).toEqual([0, 128, 255])
  })
})

describe('masked cells are transparent in previews', () => {
  test('toneRgba with mask', () => {
    expect(Array.from(toneRgba(new Uint8Array([0, 1]), 2, new Uint8Array([0, 1])))).toEqual([0, 0, 0, 0, 255, 255, 255, 255])
  })
  test('grayRgba with mask', () => {
    expect(Array.from(grayRgba(new Float32Array([10, 20]), new Uint8Array([1, 0])))).toEqual([10, 10, 10, 255, 20, 20, 20, 0])
  })
  test('maxCornerRadius = half the shorter side in mm', () => {
    expect(maxCornerRadius(250, 900, 0.2)).toBe(25)
  })
})

describe('filament colors', () => {
  test('defaults per filament count', () => {
    expect(defaultColors(1)).toEqual(['#ffffff'])
    expect(defaultColors(2)).toEqual(['#000000', '#ffffff'])
    expect(defaultColors(3)).toEqual(['#000000', '#ffffff', '#f0a8b4'])
    expect(defaultColors(4)).toEqual(['#000000', '#ffffff', '#f0a8b4', '#3050e0'])
  })
  test('regionRgba paints each cell in its palette color; masked cells are transparent', () => {
    const px = regionRgba(new Uint8Array([1, 0, 1]), ['#000000', '#f0a8b4'], new Uint8Array([1, 1, 0]))
    expect(Array.from(px)).toEqual([240, 168, 180, 255, 0, 0, 0, 255, 240, 168, 180, 0])
  })
  test('regionCounts counts the unmasked cells of each color', () => {
    expect(regionCounts(new Uint8Array([1, 0, 1, 2, 2]), new Uint8Array([1, 1, 0, 1, 1]), 4)).toEqual([1, 1, 2, 0])
  })
})
