import { describe, test, expect } from 'vitest'
import { buildMesh, type Mesh } from './mesh'

function edgeCounts(m: Mesh) {
  const directed = new Map<string, number>()
  for (let t = 0; t < m.indices.length; t += 3) {
    const v = [m.indices[t], m.indices[t + 1], m.indices[t + 2]]
    for (let k = 0; k < 3; k++) {
      const key = `${v[k]},${v[(k + 1) % 3]}`
      directed.set(key, (directed.get(key) ?? 0) + 1)
    }
  }
  return directed
}

/** closed & consistently oriented: every directed edge a→b is matched by b→a equally often */
function isClosed(m: Mesh) {
  const d = edgeCounts(m)
  for (const [k, n] of d) {
    const [a, b] = k.split(',')
    if (d.get(`${b},${a}`) !== n) return false
  }
  return true
}

function isManifold2(m: Mesh) {
  const d = edgeCounts(m)
  const und = new Map<string, number>()
  for (const [k, n] of d) {
    const [a, b] = k.split(',').map(Number)
    const key = a < b ? `${a},${b}` : `${b},${a}`
    und.set(key, (und.get(key) ?? 0) + n)
  }
  return [...und.values()].every((n) => n === 2)
}

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

function hasDegenerate(m: Mesh) {
  const p = m.positions
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t] * 3, m.indices[t + 1] * 3, m.indices[t + 2] * 3]
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2]
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx
    if (Math.hypot(cx, cy, cz) < 1e-12) return true
  }
  return false
}

// smooth gradient: heights rise left→right in 7 bands (no diagonal checkerboards)
function gradient(cols: number, rows: number) {
  const h = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) h[r * cols + c] = 0.88 + Math.floor((c / cols) * 7) * 0.08
  return h
}

function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
}

describe('buildMesh', () => {
  const cols = 30, rows = 20, pitch = 0.2
  const grad = gradient(cols, rows)

  test('gradient: every edge shared by exactly 2 triangles', () => {
    const m = buildMesh(grad, cols, rows, pitch)
    expect(isManifold2(m)).toBe(true)
    expect(isClosed(m)).toBe(true)
    expect(hasDegenerate(m)).toBe(false)
  })

  test('volume equals Σ cell height × pitch² (outward orientation)', () => {
    const m = buildMesh(grad, cols, rows, pitch)
    const expected = grad.reduce((s, h) => s + h, 0) * pitch * pitch
    expect(signedVolume(m)).toBeCloseTo(expected, 4)
  })

  test('random heights (incl. checkerboards): closed, oriented, no degenerate triangles', () => {
    const rnd = seeded(42)
    const h = new Float32Array(cols * rows).map(() => 0.88 + Math.floor(rnd() * 7) * 0.08)
    const m = buildMesh(h, cols, rows, pitch)
    expect(isClosed(m)).toBe(true)
    expect(hasDegenerate(m)).toBe(false)
    expect(signedVolume(m)).toBeCloseTo(h.reduce((s, v) => s + v, 0) * pitch * pitch, 4)
  })

  test('merging reduces triangle count vs unmerged', () => {
    const merged = buildMesh(grad, cols, rows, pitch)
    const unmerged = buildMesh(grad, cols, rows, pitch, { merge: false })
    expect(isClosed(unmerged)).toBe(true)
    expect(merged.indices.length).toBeLessThan(unmerged.indices.length)
  })

  test('model coords: x = col×pitch, image row 0 is the top (max y)', () => {
    const h = new Float32Array([1, 2, 3, 4]) // 2×2, top-left = 1
    const m = buildMesh(h, 2, 2, 0.5)
    let found = false
    for (let i = 0; i < m.positions.length; i += 3) {
      if (m.positions[i] === 0 && m.positions[i + 1] === 1 && Math.abs(m.positions[i + 2] - 1) < 1e-6) found = true
    }
    expect(found).toBe(true) // top-left corner (0, 1.0) at height 1
  })
})

describe('buildMesh with absent cells (height 0)', () => {
  test('rounded-corner style mask: closed, oriented, volume matches, no degenerate', () => {
    const cols = 24, rows = 16
    const rnd = seeded(7)
    const h = new Float32Array(cols * rows)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const dx = Math.max(0, 5 - (c + 0.5), c + 0.5 - (cols - 5)), dy = Math.max(0, 5 - (r + 0.5), r + 0.5 - (rows - 5))
      h[r * cols + c] = Math.hypot(dx, dy) > 5 ? 0 : 0.88 + Math.floor(rnd() * 7) * 0.08
    }
    const m = buildMesh(h, cols, rows, 0.2)
    expect(isClosed(m)).toBe(true)
    expect(hasDegenerate(m)).toBe(false)
    expect(signedVolume(m)).toBeCloseTo(h.reduce((s, v) => s + v, 0) * 0.04, 4)
  })
  test('no geometry at absent cells: z=0 faces only under present cells', () => {
    const h = new Float32Array([0, 1, 1, 1]) // 2×2, top-left absent
    const m = buildMesh(h, 2, 2, 1)
    expect(signedVolume(m)).toBeCloseTo(3, 6)
    expect(isClosed(m)).toBe(true)
  })
})

test('absent cells produce no upward-facing faces at z=0 (no zero-thickness sheet)', () => {
  const h = new Float32Array([0, 1, 1, 1])
  const m = buildMesh(h, 2, 2, 1)
  const p = m.positions
  let up = 0
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t] * 3, m.indices[t + 1] * 3, m.indices[t + 2] * 3]
    if (p[a + 2] !== 0 || p[b + 2] !== 0 || p[c + 2] !== 0) continue
    const nz = (p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[b + 1] - p[a + 1]) * (p[c] - p[a])
    if (nz > 0) up++
  }
  expect(up).toBe(0)
})
