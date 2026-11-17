import { zipSync, strToU8 } from 'fflate'
import type { Mesh } from './mesh'
import { type LayerParams, snapToLayerGrid } from './heights'
import projectTemplate from './bambu-a1-project-settings.json'

export interface ThreeMfOptions {
  layers: LayerParams
  title: string
  /** [base, stacked] filament colors (#rrggbb); default black base + white */
  colors?: [string, string]
}

/** A1 bed is 256×256; place the model at its center. */
const BED_CENTER = 128
const APP = 'BambuStudio-02.02.00.85'

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
const num = (v: number) => String(Math.round(v * 1e5) / 1e5)

/**
 * Z (top of layer) of the first white layer. Bambu/Prusa apply a layer's custom G-code before printing that layer,
 * so the switch is attached to the layer right above the base (color change height).
 */
export function toolChangeTopZ(p: LayerParams): number {
  return Math.round((snapToLayerGrid(p.baseThickness, p) + p.layerHeight) * 1e6) / 1e6
}

/** UUIDs of the i-th (1-based) mesh object / component; i = 1 matches the single-part files. */
const hex8 = (i: number) => (0x10000 + i - 1).toString(16).padStart(8, '0')
const objUuid = (i: number) => `${hex8(i)}-81cb-4c03-9d28-80fed5dfa1dc`
const compUuid = (i: number) => `${hex8(i)}-b206-40ff-9872-83e8017abed1`

function centerOf(mesh: Mesh): [number, number] {
  const p = mesh.positions
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < minX) minX = p[i]
    if (p[i] > maxX) maxX = p[i]
    if (p[i + 1] < minY) minY = p[i + 1]
    if (p[i + 1] > maxY) maxY = p[i + 1]
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

function meshObject(mesh: Mesh, id: number, cx: number, cy: number): string {
  const p = mesh.positions
  const parts: string[] = [`  <object id="${id}" p:UUID="${objUuid(id)}" type="model">\n   <mesh>\n    <vertices>\n`]
  for (let i = 0; i < p.length; i += 3) {
    parts.push(`     <vertex x="${num(p[i] - cx)}" y="${num(p[i + 1] - cy)}" z="${num(p[i + 2])}"/>\n`)
  }
  parts.push('    </vertices>\n    <triangles>\n')
  const t = mesh.indices
  for (let i = 0; i < t.length; i += 3) parts.push(`     <triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"/>\n`)
  parts.push('    </triangles>\n   </mesh>\n  </object>\n')
  return parts.join('')
}

function objectsModel(objects: string): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n' +
    ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n' +
    ' <resources>\n' + objects + ' </resources>\n <build/>\n</model>\n'
}

/** `meshes[0]` decides the xy centering of every part, so parts keep their relative positions. */
function objectModel(meshes: Mesh[]): string {
  const [cx, cy] = centerOf(meshes[0])
  return objectsModel(meshes.map((m, i) => meshObject(m, i + 1, cx, cy)).join(''))
}

function rootModel(title: string, partCount: number): string {
  const wrapper = partCount + 1
  const components = Array.from({ length: partCount }, (_, i) =>
    `    <component p:path="/3D/Objects/object_1.model" objectid="${i + 1}" p:UUID="${compUuid(i + 1)}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>\n`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
 <metadata name="Application">${APP}</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Title">${esc(title)}</metadata>
 <resources>
  <object id="${wrapper}" p:UUID="00000001-61cb-4c03-9d28-80fed5dfa1dc" type="model">
   <components>
${components}   </components>
  </object>
 </resources>
 <build p:UUID="2c7c17d8-22b5-4d84-8835-1976022ea369">
  <item objectid="${wrapper}" p:UUID="00000002-b1ec-4553-aec9-835e5b724bb4" transform="1 0 0 0 1 0 0 0 1 ${BED_CENTER} ${BED_CENTER} 0" printable="1"/>
 </build>
</model>
`
}

/** One part per entry of `extruders` (1-based AMS slot of each part); omit for the single-part layer mode file. */
function modelSettings(title: string, faces: number, filaments: number, extruders?: { extruder: number; faces: number }[]): string {
  const name = esc(title)
  const wrapper = (extruders?.length ?? 1) + 1
  const partXml = extruders
    ? extruders.map((x, i) => `    <part id="${i + 1}" subtype="normal_part">
      <metadata key="name" value="${name}-${i + 1}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="extruder" value="${x.extruder}"/>
      <metadata key="source_object_id" value="0"/>
      <metadata key="source_volume_id" value="0"/>
      <mesh_stat face_count="${x.faces}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>
    </part>
`).join('')
    : `    <part id="1" subtype="normal_part">
      <metadata key="name" value="${name}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="source_object_id" value="0"/>
      <metadata key="source_volume_id" value="0"/>
      <mesh_stat face_count="${faces}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>
    </part>
`
  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="${wrapper}">
    <metadata key="name" value="${name}"/>
    <metadata key="extruder" value="1"/>
    <metadata face_count="${faces}"/>
${partXml}  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
    <metadata key="filament_map_mode" value="Auto For Flush"/>
    <metadata key="filament_maps" value="${Array(filaments).fill(1).join(' ')}"/>
    <model_instance>
      <metadata key="object_id" value="${wrapper}"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="1"/>
    </model_instance>
  </plate>
  <assemble>
   <assemble_item object_id="${wrapper}" instance_id="0" transform="1 0 0 0 1 0 0 0 1 ${BED_CENTER} ${BED_CENTER} 0" offset="0 0 0"/>
  </assemble>
</config>
`
}

/** Length-2 arrays of the template that do not depend on the filament count (machine-mode arrays). */
const NON_FILAMENT_KEYS = new Set([
  'extruder_ams_count', 'start_end_points', 'upward_compatible_machine',
  ...['acceleration_e', 'acceleration_extruding', 'acceleration_retracting', 'acceleration_travel', 'acceleration_x', 'acceleration_y', 'acceleration_z']
    .map((k) => `machine_max_${k}`),
  ...['e', 'x', 'y', 'z'].map((k) => `machine_max_jerk_${k}`),
  ...['e', 'x', 'y', 'z'].map((k) => `machine_max_speed_${k}`),
  'machine_min_extruding_rate', 'machine_min_travel_rate',
])
const TEMPLATE_FILAMENTS = 2
/** flush volume (mm³) between two filaments beyond the template's own pair; Bambu Studio recomputes it from the colors */
const EXTRA_FLUSH = '652'

/** Template (2 filaments) extended to colors.length filaments; 2 colors reproduce the template as is. */
function projectSettings(p: LayerParams, colors: string[]): string {
  const k = colors.length
  const s = structuredClone(projectTemplate) as Record<string, unknown>
  for (const [key, v] of Object.entries(s)) {
    if (!Array.isArray(v) || v.length !== TEMPLATE_FILAMENTS || NON_FILAMENT_KEYS.has(key)) continue
    s[key] = Array.from({ length: k }, (_, i) => v[i < TEMPLATE_FILAMENTS ? i : 0]) // new slots copy the first filament
  }
  s.layer_height = num(p.layerHeight)
  s.initial_layer_print_height = num(p.firstLayerHeight)
  s.filament_colour = colors
  s.filament_multi_colour = colors
  s.filament_self_index = colors.map((_, i) => String(i + 1))
  const matrix = (projectTemplate.flush_volumes_matrix as string[])
  s.flush_volumes_matrix = Array.from({ length: k * k }, (_, n) => {
    const i = Math.floor(n / k), j = n % k
    if (i === j) return '0'
    return i < TEMPLATE_FILAMENTS && j < TEMPLATE_FILAMENTS ? matrix[i * TEMPLATE_FILAMENTS + j] : EXTRA_FLUSH
  })
  s.flush_volumes_vector = Array(2 * k).fill((projectTemplate.flush_volumes_vector as string[])[0])
  const diff = projectTemplate.different_settings_to_system as string[]
  const changed = new Set(diff[0].split(';').filter(Boolean))
  changed.add('layer_height').add('initial_layer_print_height')
  s.different_settings_to_system = [[...changed].sort().join(';'), ...Array(k + 1).fill('')]
  return JSON.stringify(s, null, 4)
}

function customGcode(p: LayerParams, color: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<custom_gcodes_per_layer>
<plate>
<plate_info id="1"/>
<layer top_z="${toolChangeTopZ(p)}" type="2" extruder="2" color="${color}" extra="" gcode="tool_change"/>
<mode value="MultiAsSingle"/>
</plate>
</custom_gcodes_per_layer>
`
}

const LAYER_MODE_COLORS: [string, string] = ['#000000', '#FFFFFF']

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
 <Default Extension="gcode" ContentType="text/x.gcode"/>
</Types>
`
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`
const MODEL_RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`

/** Bambu Studio project 3MF (A1 profile, black → white tool change above the base). */
export function build3mf(mesh: Mesh, opts: ThreeMfOptions): Uint8Array {
  const faces = mesh.indices.length / 3
  const colors = (opts.colors ?? LAYER_MODE_COLORS).map((c) => c.toUpperCase())
  return zipSync(
    {
      '[Content_Types].xml': strToU8(CONTENT_TYPES),
      '_rels/.rels': strToU8(ROOT_RELS),
      '3D/3dmodel.model': strToU8(rootModel(opts.title, 1)),
      '3D/_rels/3dmodel.model.rels': strToU8(MODEL_RELS),
      '3D/Objects/object_1.model': strToU8(objectModel([mesh])),
      'Metadata/model_settings.config': strToU8(modelSettings(opts.title, faces, 2)),
      'Metadata/project_settings.config': strToU8(projectSettings(opts.layers, colors)),
      'Metadata/custom_gcode_per_layer.xml': strToU8(customGcode(opts.layers, colors[1])),
    },
    { level: 6 },
  )
}

export interface PartsOptions {
  layers: LayerParams
  title: string
  /** AMS slot colors (#rrggbb), slot order */
  colors: string[]
}

/**
 * Color group mode project 3MF: one mesh object per part inside a single wrapper object, each part printed with its own
 * AMS slot (`slot`, 0-based). `parts[0]` (the base plate) fixes the xy centering. No color-change file: the colors come
 * from the parts, not from layer heights.
 */
export function build3mfParts(parts: { slot: number; mesh: Mesh }[], opts: PartsOptions): Uint8Array {
  const colors = opts.colors.map((c) => c.toUpperCase())
  const sizes = parts.map((x) => ({ extruder: x.slot + 1, faces: x.mesh.indices.length / 3 }))
  const faces = sizes.reduce((n, x) => n + x.faces, 0)
  return zipSync(
    {
      '[Content_Types].xml': strToU8(CONTENT_TYPES),
      '_rels/.rels': strToU8(ROOT_RELS),
      '3D/3dmodel.model': strToU8(rootModel(opts.title, parts.length)),
      '3D/_rels/3dmodel.model.rels': strToU8(MODEL_RELS),
      '3D/Objects/object_1.model': strToU8(objectModel(parts.map((x) => x.mesh))),
      'Metadata/model_settings.config': strToU8(modelSettings(opts.title, faces, colors.length, sizes)),
      'Metadata/project_settings.config': strToU8(projectSettings(opts.layers, colors)),
    },
    { level: 6 },
  )
}
