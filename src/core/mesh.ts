export interface Mesh {
  /** xyz in mm */
  positions: Float32Array
  /** CCW (outward) triangles */
  indices: Uint32Array
}

export interface MeshOptions {
  /** merge same-height cells into rectangles (default true) */
  merge?: boolean
}

/**
 * Heightmap → closed solid. `heights` is row-major with row 0 at the image top.
 * Model space: x = col × pitch, y grows upward (image top = max y), z = height, bottom at z = 0.
 * Cells outside the grid, and cells with height 0 (e.g. cut by a rounded outline), are absent: walls close them off
 * and only present cells get top and bottom faces.
 */
export function buildMesh(heights: Float32Array, cols: number, rows: number, pitch: number, opts: MeshOptions = {}): Mesh {
  const merge = opts.merge ?? true

  // --- height levels (0 is always level 0) ---
  const micro = (h: number) => Math.round(h * 1e6)
  const uniq = Array.from(new Set([0, ...Array.from(heights, micro)])).sort((a, b) => a - b)
  const levelOf = new Map(uniq.map((u, k) => [u, k]))
  const zOf = uniq.map((u) => u / 1e6)
  const L = uniq.length

  // cell level, model coords: (i = col, j = row from bottom)
  const lv = new Uint16Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    const j = rows - 1 - r
    for (let i = 0; i < cols; i++) lv[j * cols + i] = levelOf.get(micro(heights[r * cols + i]))!
  }
  const cell = (i: number, j: number) => (i < 0 || j < 0 || i >= cols || j >= rows ? 0 : lv[j * cols + i])

  // --- vertex pool ---
  const pos: number[] = []
  const idx: number[] = []
  const pool = new Map<number, number>()
  const lattice = (i: number, j: number, level: number) => {
    const key = (j * (cols + 1) + i) * L + level
    let v = pool.get(key)
    if (v === undefined) {
      v = pos.length / 3
      pos.push(i * pitch, j * pitch, zOf[level])
      pool.set(key, v)
    }
    return v
  }
  const free = (x: number, y: number, z: number) => {
    pos.push(x * pitch, y * pitch, z)
    return pos.length / 3 - 1
  }
  const tri = (a: number, b: number, c: number) => idx.push(a, b, c)

  /** zigzag between two chains; polygon is A[0] → B[0] → … B[end] → A[end] → … A[0], CCW */
  const zigzag = (A: number[], B: number[], t = tri) => {
    let a = 0, b = 0
    while (a < A.length - 1 || b < B.length - 1) {
      const advanceB = a === A.length - 1 || (b < B.length - 1 && (b + 1) / (B.length - 1) <= (a + 1) / (A.length - 1))
      if (advanceB) { t(A[a], B[b], B[b + 1]); b++ }
      else { t(A[a], B[b], A[a + 1]); a++ }
    }
  }

  /** distinct levels at a lattice vertex (from its 4 surrounding cells) within [lo, hi] */
  const levelsAt = (i: number, j: number, lo: number, hi: number) => {
    const s = new Set([cell(i - 1, j - 1), cell(i, j - 1), cell(i - 1, j), cell(i, j), lo, hi])
    return [...s].filter((l) => l >= lo && l <= hi).sort((a, b) => a - b)
  }

  // --- top and bottom faces ---
  const perimeter = (i0: number, j0: number, i1: number, j1: number, level: number) => {
    const p: number[] = []
    for (let i = i0; i < i1; i++) p.push(lattice(i, j0, level))
    for (let j = j0; j < j1; j++) p.push(lattice(i1, j, level))
    for (let i = i1; i > i0; i--) p.push(lattice(i, j1, level))
    for (let j = j1; j > j0; j--) p.push(lattice(i0, j, level))
    return p // CCW seen from +z
  }
  /** greedy rectangles over present cells; `bottom` emits z=0 faces facing -z, otherwise top faces at the cell level */
  const faces = (bottom: boolean) => {
    const used = new Uint8Array(cols * rows)
    const same = (a: number, b: number) => (bottom ? b !== 0 : a === b)
    const t = (a: number, b: number, c: number) => (bottom ? tri(a, c, b) : tri(a, b, c))
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const level = lv[j * cols + i]
        if (used[j * cols + i] || level === 0) continue
        const z = bottom ? 0 : level
        let i1 = i + 1, j1 = j + 1
        if (merge) {
          while (i1 < cols && !used[j * cols + i1] && same(level, lv[j * cols + i1])) i1++
          grow: while (j1 < rows) {
            for (let x = i; x < i1; x++) if (used[j1 * cols + x] || !same(level, lv[j1 * cols + x])) break grow
            j1++
          }
        }
        for (let y = j; y < j1; y++) for (let x = i; x < i1; x++) used[y * cols + x] = 1
        const w = i1 - i, h = j1 - j
        if (w === 1) {
          const A: number[] = [], B: number[] = []
          for (let y = j; y <= j1; y++) { A.push(lattice(i, y, z)); B.push(lattice(i1, y, z)) }
          zigzag(A, B, t)
        } else if (h === 1) {
          const A: number[] = [], B: number[] = []
          for (let x = i1; x >= i; x--) { A.push(lattice(x, j, z)); B.push(lattice(x, j1, z)) }
          zigzag(A, B, t)
        } else {
          const p = perimeter(i, j, i1, j1, z)
          const c = free(i + w / 2, j + h / 2, zOf[z])
          for (let k = 0; k < p.length; k++) t(c, p[k], p[(k + 1) % p.length])
        }
      }
    }
  }
  faces(false)
  faces(true)

  // --- walls ---
  // wall from lattice point P to Q (a unit edge), with corners CCW seen from outside: (P,lo) → (Q,lo) → (Q,hi) → (P,hi)
  const wall = (pi: number, pj: number, qi: number, qj: number, lo: number, hi: number) => {
    const A = levelsAt(pi, pj, lo, hi).map((l) => lattice(pi, pj, l))
    const B = levelsAt(qi, qj, lo, hi).map((l) => lattice(qi, qj, l))
    zigzag(A, B)
  }
  // edges along x at y = j, between cell (i, j-1) [south] and (i, j) [north]
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i < cols; i++) {
      const s = cell(i, j - 1), n = cell(i, j)
      if (s === n) continue
      if (n > s) wall(i, j, i + 1, j, s, n) // faces -y
      else wall(i + 1, j, i, j, n, s) // faces +y
    }
  }
  // edges along y at x = i, between cell (i-1, j) [west] and (i, j) [east]
  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j < rows; j++) {
      const w = cell(i - 1, j), e = cell(i, j)
      if (w === e) continue
      if (e > w) wall(i, j + 1, i, j, w, e) // faces -x
      else wall(i, j, i, j + 1, e, w) // faces +x
    }
  }

  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) }
}
