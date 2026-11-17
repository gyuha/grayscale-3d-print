export type Rgb = readonly [number, number, number]

/** '#rrggbb' → [r, g, b] (0..255). */
export function parseHex(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

const lin = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)

/** sRGB (0..255) → CIE Lab (D65): L 0..100, a/b roughly ±128. */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/**
 * Index of the palette color closest to the pixel in Lab (L*, a*, b* — lightness included, so black and white are told
 * apart and a pale pink is not pulled into a neutral color just because its chroma is low). Ties → lower index.
 */
export function nearestColor(r: number, g: number, b: number, palette: readonly Rgb[]): number {
  const [L, a, bb] = rgbToLab(r, g, b)
  let best = 0, bestD = Infinity
  palette.forEach((c, i) => {
    const [cl, ca, cb] = rgbToLab(c[0], c[1], c[2])
    const d = (L - cl) ** 2 + (a - ca) ** 2 + (bb - cb) ** 2
    if (d < bestD - 1e-9) { best = i; bestD = d }
  })
  return best
}
