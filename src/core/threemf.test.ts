import { describe, test, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { build3mf, build3mfParts } from './threemf'
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

describe('build3mfParts (parts printed with their own AMS slot)', () => {
  const colors = ['#ffffff', '#000000', '#ff0000', '#0000ff']
  const plate = buildMesh(new Float32Array([0.88, 0.88, 0.88, 0.88]), 2, 2, 0.2)
  // one-cell part on the right half, sitting on the plate; other part one cell on the left
  const right = buildMesh(new Float32Array([0, 0.08, 0, 0]), 2, 2, 0.2)
  const left = buildMesh(new Float32Array([0.16, 0, 0, 0]), 2, 2, 0.2)
  for (const m of [right, left]) for (let i = 2; i < m.positions.length; i += 3) m.positions[i] += 0.88
  const parts = [{ slot: 0, mesh: plate }, { slot: 2, mesh: right }, { slot: 3, mesh: left }]
  const f = unzipSync(build3mfParts(parts, { layers: DEFAULT_LAYERS, title: 'g', colors }))
  const t = (p: string) => strFromU8(f[p])

  test('one mesh object per part, one component per object, build item is the wrapper object', () => {
    expect([...t('3D/Objects/object_1.model').matchAll(/<object id="(\d+)"/g)].map((m) => m[1])).toEqual(['1', '2', '3'])
    const root = t('3D/3dmodel.model')
    expect([...root.matchAll(/<component [^>]*objectid="(\d+)"/g)].map((m) => m[1])).toEqual(['1', '2', '3'])
    expect(root).toContain('<object id="4"')
    expect(root).toContain('<item objectid="4"')
  })
  test('every part carries its AMS slot as extruder (1-based)', () => {
    const ms = t('Metadata/model_settings.config')
    expect([...ms.matchAll(/<part id="(\d+)"[\s\S]*?<metadata key="extruder" value="(\d+)"\/>/g)].map((m) => [m[1], m[2]])).toEqual([['1', '1'], ['2', '3'], ['3', '4']])
    expect(ms).toContain('<object id="4">')
    expect(ms).toContain('<metadata key="filament_maps" value="1 1 1 1"/>')
  })
  test('parts share the plate\'s xy centering (not re-centered individually)', () => {
    const o = t('3D/Objects/object_1.model')
    const xs = (id: number) => {
      const seg = o.split(`<object id="${id}"`)[1].split('</object>')[0]
      return [...seg.matchAll(/<vertex x="([-\d.]+)"/g)].map((m) => Number(m[1]))
    }
    expect(Math.min(...xs(1))).toBeCloseTo(-0.2, 5) // plate spans -0.2..0.2
    expect(Math.min(...xs(2))).toBeCloseTo(0, 5) // right cell: 0..0.2
    expect(Math.max(...xs(3))).toBeCloseTo(0, 5) // left cell: -0.2..0
  })
  test('4 filaments: 100 per-filament keys extended, colors uppercase, no color-change file', () => {
    const s = JSON.parse(t('Metadata/project_settings.config'))
    expect(s.filament_colour).toEqual(['#FFFFFF', '#000000', '#FF0000', '#0000FF'])
    expect(s.filament_type).toHaveLength(4)
    expect(Object.values(s).filter((v) => Array.isArray(v) && v.length === 4 && (v as unknown[]).every((x) => typeof x === 'string')).length).toBeGreaterThanOrEqual(100)
    expect(s.flush_volumes_matrix).toHaveLength(16)
    expect(f['Metadata/custom_gcode_per_layer.xml']).toBeUndefined()
  })
  test('face count metadata is the total over all parts', () => {
    const total = parts.reduce((n, p) => n + p.mesh.indices.length / 3, 0)
    expect(t('Metadata/model_settings.config')).toContain(`face_count="${total}"`)
  })
})

describe('build3mfParts with a 3-color palette (color region mode)', () => {
  const colors = ['#000000', '#f0a8b4', '#ffffff'] // black, pink, white
  const part = (heights: number[]) => buildMesh(new Float32Array(heights), 2, 2, 0.2)
  const parts = [
    { slot: 0, mesh: part([0.88, 0, 0, 0]) },
    { slot: 1, mesh: part([0, 1.28, 0, 0]) },
    { slot: 2, mesh: part([0, 0, 1.36, 1.36]) },
  ]
  const f = unzipSync(build3mfParts(parts, { layers: DEFAULT_LAYERS, title: 'regions', colors }))
  const t = (p: string) => strFromU8(f[p])
  const settings = JSON.parse(t('Metadata/project_settings.config'))

  test('parts take filaments 1, 2, 3 in slot order', () => {
    const ms = t('Metadata/model_settings.config')
    expect([...ms.matchAll(/<part id="(\d+)"[\s\S]*?<metadata key="extruder" value="(\d+)"\/>/g)].map((m) => [m[1], m[2]])).toEqual([['1', '1'], ['2', '2'], ['3', '3']])
    expect(ms).toContain('<metadata key="filament_maps" value="1 1 1"/>')
  })
  test('3 filaments: palette colors (uppercase), per-filament arrays of 3, flush 3×3, no color-change file', () => {
    expect(settings.filament_colour).toEqual(['#000000', '#F0A8B4', '#FFFFFF'])
    expect(settings.filament_type).toHaveLength(3)
    expect(settings.filament_self_index).toEqual(['1', '2', '3'])
    expect(settings.flush_volumes_matrix).toHaveLength(9)
    expect(settings.flush_volumes_vector).toHaveLength(6)
    expect(f['Metadata/custom_gcode_per_layer.xml']).toBeUndefined()
  })
  test('a single part with one filament works too (height-only relief)', () => {
    const one = unzipSync(build3mfParts([{ slot: 0, mesh: part([0.88, 0.96, 1.04, 1.12]) }], { layers: DEFAULT_LAYERS, title: 'one', colors: ['#808080'] }))
    expect(JSON.parse(strFromU8(one['Metadata/project_settings.config'])).filament_colour).toEqual(['#808080'])
    expect(strFromU8(one['Metadata/model_settings.config'])).toContain('<metadata key="filament_maps" value="1"/>')
  })
})

describe('build3mf with chosen layer-mode colors', () => {
  const f = unzipSync(build3mf(mesh, { layers: DEFAULT_LAYERS, title: 'c', colors: ['#112233', '#aabbcc'] }))
  test('filament colors and the color change use the chosen pair (base first, then the stacked color)', () => {
    expect(JSON.parse(strFromU8(f['Metadata/project_settings.config'])).filament_colour).toEqual(['#112233', '#AABBCC'])
    expect(strFromU8(f['Metadata/custom_gcode_per_layer.xml'])).toContain('top_z="0.96" type="2" extruder="2" color="#AABBCC"')
  })
})
