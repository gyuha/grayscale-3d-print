import { zipSync, strToU8 } from 'fflate'
import type { Mesh } from './mesh'
import { type LayerParams, snapToLayerGrid } from './heights'
import projectTemplate from './bambu-a1-project-settings.json'

export interface ThreeMfOptions {
  layers: LayerParams
  title: string
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

function objectModel(mesh: Mesh): string {
  const p = mesh.positions
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < minX) minX = p[i]
    if (p[i] > maxX) maxX = p[i]
    if (p[i + 1] < minY) minY = p[i + 1]
    if (p[i + 1] > maxY) maxY = p[i + 1]
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const parts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n',
    ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n',
    ' <resources>\n  <object id="1" p:UUID="00010000-81cb-4c03-9d28-80fed5dfa1dc" type="model">\n   <mesh>\n    <vertices>\n',
  ]
  for (let i = 0; i < p.length; i += 3) {
    parts.push(`     <vertex x="${num(p[i] - cx)}" y="${num(p[i + 1] - cy)}" z="${num(p[i + 2])}"/>\n`)
  }
  parts.push('    </vertices>\n    <triangles>\n')
  const t = mesh.indices
  for (let i = 0; i < t.length; i += 3) parts.push(`     <triangle v1="${t[i]}" v2="${t[i + 1]}" v3="${t[i + 2]}"/>\n`)
  parts.push('    </triangles>\n   </mesh>\n  </object>\n </resources>\n <build/>\n</model>\n')
  return parts.join('')
}

function rootModel(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
 <metadata name="Application">${APP}</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="Title">${esc(title)}</metadata>
 <resources>
  <object id="2" p:UUID="00000001-61cb-4c03-9d28-80fed5dfa1dc" type="model">
   <components>
    <component p:path="/3D/Objects/object_1.model" objectid="1" p:UUID="00010000-b206-40ff-9872-83e8017abed1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
   </components>
  </object>
 </resources>
 <build p:UUID="2c7c17d8-22b5-4d84-8835-1976022ea369">
  <item objectid="2" p:UUID="00000002-b1ec-4553-aec9-835e5b724bb4" transform="1 0 0 0 1 0 0 0 1 ${BED_CENTER} ${BED_CENTER} 0" printable="1"/>
 </build>
</model>
`
}

function modelSettings(title: string, faces: number): string {
  const name = esc(title)
  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="2">
    <metadata key="name" value="${name}"/>
    <metadata key="extruder" value="1"/>
    <metadata face_count="${faces}"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="${name}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="source_object_id" value="0"/>
      <metadata key="source_volume_id" value="0"/>
      <mesh_stat face_count="${faces}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>
    </part>
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value=""/>
    <metadata key="locked" value="false"/>
    <metadata key="filament_map_mode" value="Auto For Flush"/>
    <metadata key="filament_maps" value="1 1"/>
    <model_instance>
      <metadata key="object_id" value="2"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="1"/>
    </model_instance>
  </plate>
  <assemble>
   <assemble_item object_id="2" instance_id="0" transform="1 0 0 0 1 0 0 0 1 ${BED_CENTER} ${BED_CENTER} 0" offset="0 0 0"/>
  </assemble>
</config>
`
}

function projectSettings(p: LayerParams): string {
  const s: Record<string, unknown> = structuredClone(projectTemplate)
  s.layer_height = num(p.layerHeight)
  s.initial_layer_print_height = num(p.firstLayerHeight)
  s.filament_colour = ['#000000', '#FFFFFF']
  const diff = s.different_settings_to_system as string[]
  const changed = new Set(diff[0].split(';').filter(Boolean))
  changed.add('layer_height').add('initial_layer_print_height')
  diff[0] = [...changed].sort().join(';')
  return JSON.stringify(s, null, 4)
}

function customGcode(p: LayerParams): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<custom_gcodes_per_layer>
<plate>
<plate_info id="1"/>
<layer top_z="${toolChangeTopZ(p)}" type="2" extruder="2" color="#FFFFFF" extra="" gcode="tool_change"/>
<mode value="MultiAsSingle"/>
</plate>
</custom_gcodes_per_layer>
`
}

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
  return zipSync(
    {
      '[Content_Types].xml': strToU8(CONTENT_TYPES),
      '_rels/.rels': strToU8(ROOT_RELS),
      '3D/3dmodel.model': strToU8(rootModel(opts.title)),
      '3D/_rels/3dmodel.model.rels': strToU8(MODEL_RELS),
      '3D/Objects/object_1.model': strToU8(objectModel(mesh)),
      'Metadata/model_settings.config': strToU8(modelSettings(opts.title, faces)),
      'Metadata/project_settings.config': strToU8(projectSettings(opts.layers)),
      'Metadata/custom_gcode_per_layer.xml': strToU8(customGcode(opts.layers)),
    },
    { level: 6 },
  )
}
