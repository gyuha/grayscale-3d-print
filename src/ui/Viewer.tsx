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

/** Rotatable relief preview. Each part renders in its filament color(s). */
export function Viewer({ meshes, colors, colorChangeZ }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const ctx = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; parts: Part[]; threshold: { value: number } } | null>(null)

  useEffect(() => {
    const el = host.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    el.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x8a8f98)
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000)
    camera.up.set(0, 0, 1)
    const controls = new OrbitControls(camera, renderer.domElement)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2))
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(-1, -1, 2)
    scene.add(sun)
    ctx.current = { scene, camera, controls, parts: [], threshold: { value: 0 } }

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()
    renderer.setAnimationLoop(() => {
      controls.update()
      renderer.render(scene, camera)
    })
    return () => {
      ro.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
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
    c.camera.position.set(0, -size * 0.9, size * 1.1)
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

  return <div ref={host} className="viewer" />
}
