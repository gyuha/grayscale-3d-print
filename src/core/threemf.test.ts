import { describe, test, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { build3mf } from './threemf'
import { buildMesh } from './mesh'
import { DEFAULT_LAYERS } from './heights'

const heights = new Float32Array([0.88, 0.96, 1.04, 1.12, 1.2, 1.28])
const mesh = buildMesh(heights, 3, 2, 0.2)
const files = unzipSync(build3mf(mesh, { layers: DEFAULT_LAYERS, title: 'test' }))
const text = (p: string) => strFromU8(files[p])

describe('build3mf', () => {
  test('contains the required package entries', () => {
    for (const p of [
      '[Content_Types].xml',
      '_rels/.rels',
      '3D/3dmodel.model',
      '3D/_rels/3dmodel.model.rels',
      '3D/Objects/object_1.model',
      'Metadata/model_settings.config',
      'Metadata/project_settings.config',
      'Metadata/custom_gcode_per_layer.xml',
    ]) expect(files[p], p).toBeDefined()
  })

  test('marks itself as a BambuStudio project', () => {
    expect(text('3D/3dmodel.model')).toContain('<metadata name="Application">BambuStudio-')
  })

  test('color change: tool_change to filament 2 (white) on the first layer above the base', () => {
    const x = text('Metadata/custom_gcode_per_layer.xml')
    const m = x.match(/<layer top_z="([\d.]+)" type="2" extruder="2" color="#FFFFFF" extra="" gcode="tool_change"\/>/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeCloseTo(0.96, 6) // base 0.88 + one 0.08 layer
    expect(x).toContain('<mode value="MultiAsSingle"/>')
  })

  test('project settings: A1, layer heights, black/white filaments', () => {
    const s = JSON.parse(text('Metadata/project_settings.config'))
    expect(s.printer_model).toBe('Bambu Lab A1')
    expect(s.layer_height).toBe('0.08')
    expect(s.initial_layer_print_height).toBe('0.16')
    expect(s.filament_colour).toEqual(['#000000', '#FFFFFF'])
    expect(s.filament_type).toHaveLength(2)
  })

  test('layer params flow into settings and color change', () => {
    const f = unzipSync(build3mf(mesh, { layers: { ...DEFAULT_LAYERS, layerHeight: 0.12, firstLayerHeight: 0.2, baseThickness: 0.8 }, title: 't' }))
    const s = JSON.parse(strFromU8(f['Metadata/project_settings.config']))
    expect(s.layer_height).toBe('0.12')
    expect(s.initial_layer_print_height).toBe('0.2')
    // base 0.8 snaps to 0.2 + 5×0.12 = 0.8 → first white layer top = 0.92
    expect(strFromU8(f['Metadata/custom_gcode_per_layer.xml'])).toContain('top_z="0.92"')
  })

  test('object mesh has every vertex and triangle', () => {
    const o = text('3D/Objects/object_1.model')
    expect(o.match(/<vertex /g)!.length).toBe(mesh.positions.length / 3)
    expect(o.match(/<triangle /g)!.length).toBe(mesh.indices.length / 3)
  })
})
