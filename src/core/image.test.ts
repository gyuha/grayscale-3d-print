import { describe, test, expect } from 'vitest'
import { toGray, toAlpha, adjust, quantize, DEFAULT_ADJUST } from './image'

const px = (...rgba: number[]) => new Uint8ClampedArray(rgba)

describe('toGray', () => {
  test('black/white/luminance', () => {
    const g = toGray(px(0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255))
    expect(g[0]).toBe(0)
    expect(g[1]).toBe(255)
    expect(g[2]).toBeCloseTo(0.299 * 255, 3)
  })
  test('luminance ignores alpha (transparency is handled as a separate mask)', () => {
    expect(toGray(px(0, 0, 0, 0))[0]).toBe(0)
  })
  test('toAlpha → 0..1', () => {
    const a = toAlpha(px(0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 51))
    expect([a[0], a[1]]).toEqual([0, 1])
    expect(a[2]).toBeCloseTo(0.2, 6)
  })
})

describe('adjust', () => {
  test('default params are identity', () => {
    const g = new Float32Array([0, 64, 128, 255])
    expect(Array.from(adjust(g, DEFAULT_ADJUST))).toEqual([0, 64, 128, 255])
  })
  test('invert', () => {
    const g = new Float32Array([0, 255, 100])
    expect(Array.from(adjust(g, { ...DEFAULT_ADJUST, invert: true }))).toEqual([255, 0, 155])
  })
  test('brightness clamps to 0..255', () => {
    const g = new Float32Array([0, 200])
    expect(Array.from(adjust(g, { ...DEFAULT_ADJUST, brightness: 0.5 }))).toEqual([127.5, 255])
  })
  test('contrast pivots on 128', () => {
    const g = new Float32Array([128, 192])
    expect(Array.from(adjust(g, { ...DEFAULT_ADJUST, contrast: 1 }))).toEqual([128, 255])
  })
  test('gamma > 1 brightens midtones, keeps endpoints', () => {
    const r = adjust(new Float32Array([0, 64, 255]), { ...DEFAULT_ADJUST, gamma: 2 })
    expect(r[0]).toBe(0)
    expect(r[2]).toBe(255)
    expect(r[1]).toBeCloseTo(255 * Math.sqrt(64 / 255), 3)
  })
})

describe('quantize', () => {
  test('N equal intervals, 0 → step 0, 255 → step N-1', () => {
    const q = quantize(new Float32Array([0, 255]), 7)
    expect(Array.from(q)).toEqual([0, 6])
  })
  test('interval boundaries for N=2', () => {
    expect(Array.from(quantize(new Float32Array([127.99, 128]), 2))).toEqual([0, 1])
  })
  test('N=10 covers all steps', () => {
    const g = new Float32Array(256).map((_, i) => i)
    const q = quantize(g, 10)
    expect(new Set(q).size).toBe(10)
    expect(q[0]).toBe(0)
    expect(q[255]).toBe(9)
  })
  test('rejects N outside 2..10', () => {
    expect(() => quantize(new Float32Array([0]), 1)).toThrow()
    expect(() => quantize(new Float32Array([0]), 11)).toThrow()
  })
})
