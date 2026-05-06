'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import * as THREE from 'three'

// ── geo data ──────────────────────────────────────────────────────────────────
const HOME = { lat: 40.71, lon: -74.01 }   // New York (sender)

const TARGETS = [
  { lat: 51.51, lon:  -0.12 },  // London
  { lat: 48.85, lon:   2.35 },  // Paris
  { lat: 52.52, lon:  13.40 },  // Berlin
  { lat: 35.69, lon: 139.69 },  // Tokyo
  { lat: 25.20, lon:  55.27 },  // Dubai
  { lat:  1.35, lon: 103.82 },  // Singapore
  { lat: 55.75, lon:  37.62 },  // Moscow
  { lat:-33.87, lon: 151.21 },  // Sydney
]

function ll3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi   = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

const N = 90  // arc segments

function arcBuf(aLat: number, aLon: number, bLat: number, bLon: number, r: number): Float32Array {
  const a   = ll3(aLat, aLon, r)
  const b   = ll3(bLat, bLon, r)
  const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(r * 1.55)
  const crv = new THREE.QuadraticBezierCurve3(a, mid, b)
  const pts = crv.getPoints(N)
  const buf = new Float32Array((N + 1) * 3)
  pts.forEach((p, i) => { buf[i * 3] = p.x; buf[i * 3 + 1] = p.y; buf[i * 3 + 2] = p.z })
  return buf
}

// ── globe component ───────────────────────────────────────────────────────────
function GlobeViz() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const W = el.clientWidth, H = el.clientHeight

    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    // scene / camera
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 200)
    camera.position.set(0, 0, 7)

    // ── globe group — pushed to bottom-right so only top-left arc is visible ──
    const R     = 3.9
    const group = new THREE.Group()
    group.position.set(3.0, -3.4, 0)
    scene.add(group)

    // earth sphere
    const sGeo = new THREE.SphereGeometry(R, 64, 64)
    const sMat = new THREE.MeshPhongMaterial({ color: 0x1a3a5c, shininess: 10 })
    new THREE.TextureLoader().load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
      tx => { sMat.map = tx; sMat.needsUpdate = true },
    )
    group.add(new THREE.Mesh(sGeo, sMat))

    // atmosphere glow layers
    for (const [scale, opacity, color] of [
      [1.018, 0.13, 0x2255cc],
      [1.045, 0.05, 0x4488ff],
    ] as [number, number, number][]) {
      const m = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
      })
      group.add(new THREE.Mesh(new THREE.SphereGeometry(R * scale, 32, 32), m))
    }

    // lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.38))
    const sun = new THREE.DirectionalLight(0xddeeff, 1.1)
    sun.position.set(-5, 3, 6)
    scene.add(sun)

    // city dots
    const addDot = (lat: number, lon: number, color: number, size: number) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(size, 8, 8),
        new THREE.MeshBasicMaterial({ color }),
      )
      m.position.copy(ll3(lat, lon, R + 0.03))
      group.add(m)
    }
    addDot(HOME.lat, HOME.lon, 0x99aaff, 0.058)
    TARGETS.forEach(t => addDot(t.lat, t.lon, 0x44ee88, 0.044))

    // ── arcs ──────────────────────────────────────────────────────────────────
    interface Arc {
      geo:    THREE.BufferGeometry
      buf:    Float32Array
      head:   THREE.Mesh
      prog:   number
      speed:  number
      delay:  number
      total:  number
      active: boolean
    }
    const arcs: Arc[] = []

    const makeArc = (
      aLat: number, aLon: number,
      bLat: number, bLon: number,
      color: number, headColor: number,
      speed: number, delay: number,
    ) => {
      const buf = arcBuf(aLat, aLon, bLat, bLon, R)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(buf, 3))
      geo.setDrawRange(0, 0)
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }),
      )
      group.add(line)

      // traveling head dot
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshBasicMaterial({ color: headColor }),
      )
      head.visible = false
      group.add(head)

      arcs.push({ geo, buf, head, prog: 0, speed, delay, total: N + 1, active: false })
    }

    TARGETS.forEach(t => {
      // outgoing blue — all launch at t=0
      makeArc(HOME.lat, HOME.lon, t.lat, t.lon, 0x4466ff, 0x88aaff, 0.020, 0)
      // incoming green — random reply delay
      makeArc(t.lat, t.lon, HOME.lat, HOME.lon, 0x22dd77, 0x66ffaa, 0.017, 1.8 + Math.random() * 3.5)
    })

    // ── animation loop ────────────────────────────────────────────────────────
    let cycleT  = 0
    const CYCLE = 8.5
    let lastMs  = performance.now()
    let raf: number

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      const dt  = (now - lastMs) / 1000
      lastMs    = now

      group.rotation.y += 0.00045

      cycleT += dt
      if (cycleT > CYCLE) {
        cycleT = 0
        arcs.forEach(a => {
          a.prog = 0
          a.active = false
          a.geo.setDrawRange(0, 0)
          a.head.visible = false
        })
      }

      arcs.forEach(a => {
        if (!a.active && cycleT >= a.delay) a.active = true
        if (!a.active) return

        a.prog = Math.min(1, a.prog + a.speed)
        const shown = Math.max(2, Math.ceil(a.prog * a.total))
        a.geo.setDrawRange(0, shown)

        // move head to leading point
        const hi = (shown - 1) * 3
        a.head.visible = a.prog < 0.98
        a.head.position.set(a.buf[hi], a.buf[hi + 1], a.buf[hi + 2])
      })

      renderer.render(scene, camera)
    }
    tick()

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={ref} className="absolute inset-0" style={{ top: 36 }} />
}

// ── section ───────────────────────────────────────────────────────────────────
export function OutreachSection() {
  return (
    <section className="relative z-10 pt-36 pb-16 px-6">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

        {/* left copy */}
        <div className="flex-1 max-w-[460px] shrink-0">
          <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4">Outreach</p>
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
            Sends. Tracks.<br />Follows up.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-8">
            Every email fires from your real inbox. Opens get tracked, follow-ups go out automatically, and the moment someone replies — all sequences stop instantly.
          </p>
          <div className="space-y-3 mb-10">
            {[
              'Sends from Gmail or Outlook — your real domain',
              'Open and click tracking per email',
              'Smart follow-ups — pause on reply, resume on silence',
              'Every reply routes back to your inbox',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-white/55 text-[15px]">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <Link
            href="/signin"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105"
          >
            Start free
          </Link>
        </div>

        {/* right: globe display */}
        <div className="flex-1 w-full min-w-0">
          <div
            className="relative rounded-2xl border border-white/[0.1] bg-[#04060f] overflow-hidden shadow-2xl shadow-black/60 w-full"
            style={{ height: 560 }}
          >
            {/* title bar */}
            <div
              className="absolute top-0 left-0 right-0 z-10 flex items-center px-3 border-b border-white/[0.06] bg-[#141414]"
              style={{ height: 36 }}
            >
              <span className="text-[10px] text-white/20 font-mono">outreach · live</span>
              <div className="ml-auto flex items-center">
                <button className="w-9 h-9 flex items-center justify-center text-white/25 hover:bg-white/[0.07] text-[13px] leading-none">─</button>
                <button className="w-9 h-9 flex items-center justify-center text-white/25 hover:bg-white/[0.07] text-[11px] leading-none">□</button>
                <button className="w-9 h-9 flex items-center justify-center text-white/25 hover:bg-red-600/70 hover:text-white text-[15px] leading-none rounded-tr-2xl">✕</button>
              </div>
            </div>

            {/* legend */}
            <div className="absolute bottom-3 left-4 z-10 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-px" style={{ background: 'rgba(68,102,255,0.8)' }} />
                <span className="text-[9px] text-white/25">Outgoing</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-px" style={{ background: 'rgba(34,221,119,0.8)' }} />
                <span className="text-[9px] text-white/25">Replies</span>
              </div>
            </div>

            <GlobeViz />
          </div>
        </div>

      </div>
    </section>
  )
}
