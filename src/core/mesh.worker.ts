import { buildMesh } from './mesh'

export interface MeshRequest {
  heights: Float32Array
  cols: number
  rows: number
  pitch: number
}

self.onmessage = (e: MessageEvent<MeshRequest>) => {
  const { heights, cols, rows, pitch } = e.data
  const mesh = buildMesh(heights, cols, rows, pitch)
  ;(self as unknown as Worker).postMessage(mesh, [mesh.positions.buffer, mesh.indices.buffer])
}
