import { buildMesh } from './mesh'
import { buildRegionParts, type RegionPart } from './colorRegions'

export interface MeshRequest {
  heights: Float32Array
  cols: number
  rows: number
  pitch: number
  /** color region mode only: per-cell palette index and the palette size → one part per color */
  color?: Uint8Array
  colors?: number
  /** color region mode: base plate height and the extra height every cell gets (one layer) */
  base?: number
  lift?: number
}

/** Always answers with a part list; without `color` it is a single part printed with slot 0. */
self.onmessage = (e: MessageEvent<MeshRequest>) => {
  const { heights, cols, rows, pitch, color, colors, base = 0, lift = 0 } = e.data
  const parts: RegionPart[] = color && colors
    ? buildRegionParts(heights, color, cols, rows, pitch, colors, base, lift)
    : [{ slot: 0, mesh: buildMesh(heights, cols, rows, pitch) }]
  ;(self as unknown as Worker).postMessage(parts, parts.flatMap((p) => [p.mesh.positions.buffer, p.mesh.indices.buffer]))
}
