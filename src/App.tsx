import { useEffect, useMemo, useRef, useState } from 'react'
import './app.css'
import { processImage, type PipelineParams } from './core/pipeline'
import type { Mesh } from './core/mesh'
import type { MeshRequest } from './core/mesh.worker'
import { build3mf } from './core/threemf'
import { MIN_STEPS, MAX_STEPS } from './core/image'
import { decodeFile, type DecodedImage } from './ui/decode'
import { DEFAULT_PARAMS, grayRgba, toneRgba, toneGray, summarize, maxCornerRadius } from './ui/model'
import { Viewer } from './ui/Viewer'

function PixelCanvas({ rgba, w, h }: { rgba: Uint8ClampedArray; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    c.width = w
    c.height = h
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0)
  }, [rgba, w, h])
  return <canvas ref={ref} />
}

interface NumProps { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }
function Num({ label, value, min, max, step, onChange, unit }: NumProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
      {unit && <em>{unit}</em>}
    </label>
  )
}

export function App() {
  const [img, setImg] = useState<DecodedImage | null>(null)
  const [params, setParams] = useState<PipelineParams>(DEFAULT_PARAMS)
  const [mesh, setMesh] = useState<Mesh | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)

  const result = useMemo(() => (img ? processImage(img.rgba, img.w, img.h, params) : null), [img, params])
  const info = result ? summarize(params, result.cols, result.rows) : null

  // mesh generation in a Web Worker, debounced so slider drags don't queue up work
  const worker = useRef<Worker | null>(null)
  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => {
      worker.current?.terminate()
      const w = new Worker(new URL('./core/mesh.worker.ts', import.meta.url), { type: 'module' })
      worker.current = w
      setBusy(true)
      w.onmessage = (e: MessageEvent<Mesh>) => {
        setMesh(e.data)
        setBusy(false)
        w.terminate()
      }
      const req: MeshRequest = { heights: result.heights.slice(), cols: result.cols, rows: result.rows, pitch: params.pitch }
      w.postMessage(req, [req.heights.buffer])
    }, 250)
    return () => clearTimeout(t)
  }, [result, params.pitch])

  const load = async (file?: File) => {
    if (!file) return
    if (img) URL.revokeObjectURL(img.url)
    setMesh(null)
    setImg(await decodeFile(file))
  }

  const set = <K extends keyof PipelineParams>(k: K, v: PipelineParams[K]) => setParams((p) => ({ ...p, [k]: v }))
  const setAdj = (k: keyof PipelineParams['adjust'], v: number | boolean) => setParams((p) => ({ ...p, adjust: { ...p.adjust, [k]: v } }))
  const setLay = (k: keyof PipelineParams['layers'], v: number) => setParams((p) => ({ ...p, layers: { ...p.layers, [k]: v } }))

  const download = () => {
    if (!mesh || !img) return
    const title = `${img.name}-${params.steps}steps`
    const blob = new Blob([build3mf(mesh, { layers: params.layers, title }) as Uint8Array<ArrayBuffer>], { type: 'model/3mf' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${title}.3mf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div className="app">
      <aside className="panel">
        <h1>Grayscale 3D Print</h1>
        <div
          className={`drop ${drag ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files[0]) }}
        >
          <input type="file" accept="image/*" onChange={(e) => load(e.target.files?.[0])} />
          <p>이미지를 끌어다 놓거나 선택하세요</p>
        </div>

        <h2>톤 단계</h2>
        <Num label="단계 수 N" value={params.steps} min={MIN_STEPS} max={MAX_STEPS} step={1} onChange={(v) => set('steps', v)} />
        <Num label="단계당 흰 레이어 m" value={params.layers.layersPerStep} min={1} max={5} step={1} onChange={(v) => setLay('layersPerStep', v)} />
        <div className="swatches">
          {Array.from({ length: params.steps }, (_, k) => (
            <span key={k} style={{ background: `rgb(${toneGray(k, params.steps)},${toneGray(k, params.steps)},${toneGray(k, params.steps)})` }}>{k * params.layers.layersPerStep}</span>
          ))}
        </div>

        <h2>이미지 보정</h2>
        <Num label="밝기" value={params.adjust.brightness} min={-1} max={1} step={0.01} onChange={(v) => setAdj('brightness', v)} />
        <Num label="대비" value={params.adjust.contrast} min={-1} max={1} step={0.01} onChange={(v) => setAdj('contrast', v)} />
        <Num label="감마" value={params.adjust.gamma} min={0.2} max={3} step={0.05} onChange={(v) => setAdj('gamma', v)} />
        <label className="field check">
          <input type="checkbox" checked={params.adjust.invert} onChange={(e) => setAdj('invert', e.target.checked)} />
          <span>반전</span>
        </label>

        <h2>크기</h2>
        <Num label="가로" value={params.widthMm} min={10} max={250} step={1} unit="mm" onChange={(v) => set('widthMm', v)} />
        <Num label="픽셀 간격" value={params.pitch} min={0.1} max={0.4} step={0.05} unit="mm" onChange={(v) => set('pitch', v)} />
        <Num label="모서리 라운드" value={params.cornerRadiusMm ?? 0} min={0} max={result ? maxCornerRadius(result.cols, result.rows, params.pitch) : 50} step={0.5} unit="mm" onChange={(v) => set('cornerRadiusMm', v)} />

        <h2>레이어</h2>
        <Num label="베이스 두께" value={params.layers.baseThickness} min={0.16} max={3} step={0.04} unit="mm" onChange={(v) => setLay('baseThickness', v)} />
        <Num label="레이어 높이" value={params.layers.layerHeight} min={0.04} max={0.28} step={0.02} unit="mm" onChange={(v) => setLay('layerHeight', v)} />
        <Num label="첫 레이어 높이" value={params.layers.firstLayerHeight} min={0.08} max={0.32} step={0.02} unit="mm" onChange={(v) => setLay('firstLayerHeight', v)} />

        {info && (
          <dl className="info">
            <dt>색 교체 높이</dt><dd>{info.colorChangeZ} mm (슬라이서 마커 {info.firstWhiteLayerZ} mm)</dd>
            <dt>최대 높이</dt><dd>{info.maxZ} mm</dd>
            <dt>크기</dt><dd>{info.widthMm} × {info.heightMm} mm</dd>
            <dt>삼각형</dt><dd>{busy || !mesh ? '생성 중…' : (mesh.indices.length / 3).toLocaleString()}</dd>
          </dl>
        )}
        <button className="download" disabled={!mesh || busy || mesh.indices.length === 0} onClick={download}>3MF 다운로드 (Bambu A1)</button>
      </aside>

      <main className="previews">
        {img && result ? (
          <>
            <section className="row2d">
              <figure><img src={img.url} alt="원본" /><figcaption>원본</figcaption></figure>
              <figure><PixelCanvas rgba={grayRgba(result.gray, result.mask)} w={result.cols} h={result.rows} /><figcaption>그레이스케일</figcaption></figure>
              <figure><PixelCanvas rgba={toneRgba(result.stepIdx, params.steps, result.mask)} w={result.cols} h={result.rows} /><figcaption>{params.steps}단계 톤</figcaption></figure>
            </section>
            <section className="row3d">
              <Viewer mesh={mesh} colorChangeZ={info!.colorChangeZ} />
            </section>
          </>
        ) : (
          <p className="empty">이미지를 업로드하면 미리보기가 나타납니다.</p>
        )}
      </main>
    </div>
  )
}
