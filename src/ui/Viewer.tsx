import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Mesh } from '../core/mesh'

interface Props {
  mesh: Mesh | null
  /** color change height: below → black filament, above → white filament */
  colorChangeZ: number
}

/** Rotatable relief preview. Fragments above the color change height render white, below black. */
export function Viewer({ mesh, colorChangeZ }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const ctx = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; obj?: THREE.Mesh; threshold: { value: number } } | null>(null)

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
    ctx.current = { scene, camera, controls, threshold: { value: 0 } }

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
    if (c.obj) {
      c.scene.remove(c.obj)
      c.obj.geometry.dispose()
      ;(c.obj.material as THREE.Material).dispose()
      c.obj = undefined
    }
    if (!mesh || mesh.indices.length === 0) return // e.g. fully transparent image
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions.slice(), 3))
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2
    geo.translate(-cx, -cy, 0)
    const flat = geo.toNonIndexed() // flat shading per face for crisp step walls
    geo.dispose()
    flat.computeVertexNormals()

    const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 })
    const threshold = c.threshold
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uThreshold = threshold
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvZ = position.z;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vZ;\nuniform float uThreshold;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vZ > uThreshold + 1e-4 ? vec3(0.95) : vec3(0.06);')
    }
    const obj = new THREE.Mesh(flat, mat)
    c.scene.add(obj)
    c.obj = obj

    const size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y)
    c.camera.position.set(0, -size * 0.9, size * 1.1)
    c.controls.target.set(0, 0, 0)
    c.camera.far = size * 20
    c.camera.updateProjectionMatrix()
  }, [mesh])

  return <div ref={host} className="viewer" />
}
