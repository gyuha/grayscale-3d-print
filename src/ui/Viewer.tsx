import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Mesh } from '../core/mesh'

/** Colors of one part: `below` up to the color change height, `above` over it (same color twice = one filament). */
export interface PartColors { below: string; above: string }

interface Props {
  /** one mesh per printed part, sharing one coordinate system */
  meshes: Mesh[] | null
  /** colors of meshes[i] (#rrggbb) */
  colors: PartColors[]
  /** color change height (only matters for parts whose below/above differ) */
  colorChangeZ: number
}

/** Preview shading: maps a filament color into the 0.06 (black) .. 0.95 (white) lit range. */
const shade = (hex: string | undefined) => {
  const c = new THREE.Color(hex ?? '#888888')
  return c.setRGB(c.r * 0.89 + 0.06, c.g * 0.89 + 0.06, c.b * 0.89 + 0.06)
}

interface Part { obj: THREE.Mesh; below: { value: THREE.Color }; above: { value: THREE.Color } }

/** Grid cell size (mm). */
const GRID_MM = 10
/** Axis colors (Bambu Studio convention: X red, Y green, Z blue), toned for the dark backdrop. */
const AXES: [THREE.Vector3, number, string][] = [
  [new THREE.Vector3(1, 0, 0), 0xe5534b, 'X'],
  [new THREE.Vector3(0, 1, 0), 0x57ab5a, 'Y'],
  [new THREE.Vector3(0, 0, 1), 0x539bf5, 'Z'],
]
/** Orientation gizmo size in CSS px (bottom-left corner). */
const GIZMO_PX = 104

function axisLabel(text: string, color: number): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.font = '700 44px "Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = `#${color.toString(16).padStart(6, '0')}`
  g.fillText(text, 32, 34)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }))
  sprite.scale.setScalar(0.5)
  return sprite
}

/** Small XYZ axes that turn with the main camera, rendered in their own corner viewport. */
function buildGizmo() {
  const scene = new THREE.Scene()
  const shaft = new THREE.CylinderGeometry(0.05, 0.05, 0.78, 12).translate(0, 0.39, 0)
  const head = new THREE.ConeGeometry(0.13, 0.28, 16).translate(0, 0.92, 0)
  const up = new THREE.Vector3(0, 1, 0)
  for (const [dir, color, text] of AXES) {
    const mat = new THREE.MeshBasicMaterial({ color })
    const arrow = new THREE.Group()
    arrow.add(new THREE.Mesh(shaft, mat), new THREE.Mesh(head, mat))
    arrow.quaternion.setFromUnitVectors(up, dir)
    scene.add(arrow)
    const label = axisLabel(text, color)
    label.position.copy(dir).multiplyScalar(1.3)
    scene.add(label)
  }
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: 0xa3a6ad })))
  const camera = new THREE.OrthographicCamera(-1.55, 1.55, 1.55, -1.55, 0.1, 10)
  return { scene, camera }
}

/** Build-plate style grid on z = 0 under the model, GRID_MM cells, covering the model with a margin. */
function buildGrid(size: number): THREE.GridHelper {
  const span = Math.max(GRID_MM * 4, Math.ceil((size * 1.6) / (GRID_MM * 2)) * GRID_MM * 2)
  const grid = new THREE.GridHelper(span, span / GRID_MM, 0x5b616b, 0x363a41)
  grid.rotation.x = Math.PI / 2 // GridHelper lies in XZ; the scene is Z-up
  grid.position.z = -0.01 // just under the model's bottom face, so they never z-fight
  return grid
}

/** Rotatable relief preview. Each part renders in its filament color(s). */
export function Viewer({ meshes, colors, colorChangeZ }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const ctx = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; parts: Part[]; grid?: THREE.GridHelper; threshold: { value: number } } | null>(null)

  useEffect(() => {
    const el = host.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x24272c) // dark studio backdrop: lighter than the panel so black parts still read
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000)
    camera.up.set(0, 0, 1)
    const controls = new OrbitControls(camera, renderer.domElement)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2))
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(-1, -1, 2)
    scene.add(sun)
    ctx.current = { scene, camera, controls, parts: [], threshold: { value: 0 } }
    const gizmo = buildGizmo()
    const view = new THREE.Vector3()

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()
    renderer.autoClear = false
    renderer.setAnimationLoop(() => {
      controls.update()
      const w = el.clientWidth, h = el.clientHeight
      renderer.setViewport(0, 0, w, h)
      renderer.setScissorTest(false)
      renderer.clear()
      renderer.render(scene, camera)
      // orientation gizmo: same viewing direction as the main camera, fixed size, bottom-left corner
      view.copy(camera.position).sub(controls.target).normalize().multiplyScalar(4)
      gizmo.camera.position.copy(view)
      gizmo.camera.up.copy(camera.up)
      gizmo.camera.lookAt(0, 0, 0)
      renderer.setScissorTest(true)
      renderer.setScissor(4, 4, GIZMO_PX, GIZMO_PX)
      renderer.setViewport(4, 4, GIZMO_PX, GIZMO_PX)
      renderer.clearDepth()
      renderer.render(gizmo.scene, gizmo.camera)
    })
    return () => {
      ro.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      gizmo.scene.traverse((o) => {
        if (o instanceof THREE.Sprite) { o.material.map?.dispose(); o.material.dispose() }
        if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() }
      })
      renderer.dispose()
      el.removeChild(renderer.domElement)
      ctx.current = null
    }
  }, [])

  useEffect(() => {
    const c = ctx.current
    if (!c) return
    c.threshold.value = colorChangeZ
  }, [colorChangeZ])

  useEffect(() => {
    const c = ctx.current
    if (!c) return
    for (const p of c.parts) {
      c.scene.remove(p.obj)
      p.obj.geometry.dispose()
      ;(p.obj.material as THREE.Material).dispose()
    }
    c.parts = []
    if (c.grid) {
      c.scene.remove(c.grid)
      c.grid.dispose()
      c.grid = undefined
    }
    const present = (meshes ?? []).filter((m) => m.indices.length > 0) // e.g. fully transparent image → nothing
    if (!present.length) return
    // shared center so the parts keep their relative positions
    const box = new THREE.Box3()
    const geos = (meshes ?? []).map((mesh) => {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions.slice(), 3))
      geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
      geo.computeBoundingBox()
      if (mesh.indices.length) box.union(geo.boundingBox!)
      return geo
    })
    const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2
    const threshold = c.threshold
    c.parts = geos.map((geo) => {
      geo.translate(-cx, -cy, 0)
      const flat = geo.toNonIndexed() // flat shading per face for crisp step walls
      geo.dispose()
      flat.computeVertexNormals()
      const below = { value: new THREE.Color() }, above = { value: new THREE.Color() }
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 })
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uThreshold = threshold
        shader.uniforms.uBelow = below
        shader.uniforms.uAbove = above
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vZ;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvZ = position.z;')
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vZ;\nuniform float uThreshold;\nuniform vec3 uBelow;\nuniform vec3 uAbove;')
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vZ > uThreshold + 1e-4 ? uAbove : uBelow;')
      }
      const obj = new THREE.Mesh(flat, mat)
      c.scene.add(obj)
      return { obj, below, above }
    })

    const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y)
    c.grid = buildGrid(size)
    c.scene.add(c.grid)
    const fit = 1 / Math.min(1, c.camera.aspect) // portrait viewports (phones) step back so the model's width fits
    c.camera.position.set(0, -size * 0.9 * fit, size * 1.1 * fit)
    c.controls.target.set(0, 0, 0)
    c.camera.far = size * 20
    c.camera.updateProjectionMatrix()
  }, [meshes])

  // colors change without rebuilding geometry (and without resetting the camera)
  useEffect(() => {
    ctx.current?.parts.forEach((p, i) => {
      p.below.value = shade(colors[i]?.below)
      p.above.value = shade(colors[i]?.above)
    })
  }, [meshes, colors])

  return (
    <div ref={host} className="viewer">
      <span className="viewer-scale">격자 {GRID_MM} mm</span>
    </div>
  )
}
