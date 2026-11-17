import { describe, test, expect } from 'vitest'
import { rgbToLab, nearestColor, parseHex, type Rgb } from './color'

const PALETTE: Rgb[] = [[0, 0, 0], [240, 168, 180], [255, 255, 255]] // black, pink, white

describe('rgbToLab (sRGB, D65)', () => {
  test('white → L 100, a/b ≈ 0', () => {
    const [L, a, b] = rgbToLab(255, 255, 255)
    expect(L).toBeCloseTo(100, 1)
    expect(a).toBeCloseTo(0, 1)
    expect(b).toBeCloseTo(0, 1)
  })
  test('black → L 0', () => {
    expect(rgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 3)
  })
  test('pure red ≈ (53.2, 80.1, 67.2)', () => {
    const [L, a, b] = rgbToLab(255, 0, 0)
    expect(L).toBeCloseTo(53.2, 0)
    expect(a).toBeCloseTo(80.1, 0)
    expect(b).toBeCloseTo(67.2, 0)
  })
})

describe('nearestColor: closest palette color by Lab distance (lightness included)', () => {
  test('exact palette colors map to themselves', () => {
    expect(nearestColor(0, 0, 0, PALETTE)).toBe(0)
    expect(nearestColor(240, 168, 180, PALETTE)).toBe(1)
    expect(nearestColor(255, 255, 255, PALETTE)).toBe(2)
  })
  test('black and white are told apart even though both have zero chroma', () => {
    expect(nearestColor(0, 0, 0, [[255, 255, 255], [0, 0, 0]])).toBe(1)
    expect(nearestColor(255, 255, 255, [[255, 255, 255], [0, 0, 0]])).toBe(0)
  })
  test('a pink cheek stays pink next to black and white (the case chroma-only classification lost)', () => {
    expect(nearestColor(235, 160, 172, PALETTE)).toBe(1)
    expect(nearestColor(224, 140, 156, PALETTE)).toBe(1)
  })
  test('pale pink and mid grays go to whichever palette color is closest in Lab', () => {
    const closest = (r: number, g: number, b: number) => {
      const p = rgbToLab(r, g, b)
      const d = PALETTE.map((c) => { const q = rgbToLab(c[0], c[1], c[2]); return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 })
      return d.indexOf(Math.min(...d))
    }
    for (const px of [[250, 215, 220], [128, 128, 128], [60, 60, 60], [200, 200, 200]] as const) {
      expect(nearestColor(px[0], px[1], px[2], PALETTE), px.join()).toBe(closest(px[0], px[1], px[2]))
    }
    expect(nearestColor(60, 60, 60, PALETTE)).toBe(0)
    expect(nearestColor(200, 200, 200, PALETTE)).toBe(2)
  })
  test('ties go to the lower slot index', () => {
    expect(nearestColor(255, 0, 0, [[255, 0, 0], [255, 0, 0]])).toBe(0)
  })
  test('a single color always wins', () => {
    expect(nearestColor(10, 200, 30, [[0, 0, 255]])).toBe(0)
  })
})

describe('parseHex', () => {
  test('#rrggbb → [r,g,b]', () => {
    expect(parseHex('#d03030')).toEqual([208, 48, 48])
  })
})
