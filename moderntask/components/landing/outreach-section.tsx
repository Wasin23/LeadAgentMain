'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import * as THREE from 'three'

// ── geo data ──────────────────────────────────────────────────────────────────
const HOME = { lat: 40.71, lon: -74.01 }   // New York (sender)

const TARGETS = [
  // US
  { lat: 34.05, lon: -118.24 },  // Los Angeles
  { lat: 41.88, lon:  -87.63 },  // Chicago
  { lat: 25.77, lon:  -80.19 },  // Miami
  { lat: 47.61, lon: -122.33 },  // Seattle
  { lat: 29.76, lon:  -95.37 },  // Houston
  { lat: 33.75, lon:  -84.39 },  // Atlanta
  // International
  { lat: 51.51, lon:   -0.12 },  // London
  { lat: 48.85, lon:    2.35 },  // Paris
  { lat: 19.43, lon:  -99.13 },  // Mexico City
  { lat: 43.65, lon:  -79.38 },  // Toronto
  { lat: 35.69, lon:  139.69 },  // Tokyo
  { lat: 55.75, lon:   37.62 },  // Moscow
]

const PROFILES = [
  { name: 'Jake Torres',     title: 'Head of Marketing',  init: 'JT' },
  { name: 'Priya Shah',      title: 'VP Sales',           init: 'PS' },
  { name: 'Carlos Reyes',    title: 'Dir. of Growth',     init: 'CR' },
  { name: 'Mia Chen',        title: 'CRO',                init: 'MC' },
  { name: 'Derek Mills',     title: 'VP Revenue',         init: 'DM' },
  { name: 'Lisa Park',       title: 'Head of BD',         init: 'LP' },
  { name: 'James Whitfield', title: 'Chief Revenue Off.', init: 'JW' },
  { name: 'Sophie Laurent',  title: 'VP Commercial',      init: 'SL' },
  { name: 'Ana Morales',     title: 'Dir. Comercial',     init: 'AM' },
  { name: 'Ethan Brooks',    title: 'VP Growth',          init: 'EB' },
  { name: 'Kenji Tanaka',    title: 'Sales Director',     init: 'KT' },
  { name: 'Ivan Petrov',     title: 'Head of Revenue',    init: 'IP' },
]

// ── profile sprite helpers ─────────────────────────────────────────────────────
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function makeProfileSprite(name: string, title: string, init: string): THREE.Sprite {
  const CW = 210, CH = 58
  const cv = document.createElement('canvas')
  cv.width = CW; cv.height = CH
  const ctx = cv.getContext('2d')!

  // card bg
  ctx.fillStyle = 'rgba(8, 13, 32, 0.93)'
  rrect(ctx, 0, 0, CW, CH, 10); ctx.fill()
  ctx.strokeStyle = 'rgba(90, 110, 255, 0.32)'
  ctx.lineWidth = 1.5
  rrect(ctx, 1, 1, CW - 2, CH - 2, 9); ctx.stroke()

  // avatar bg
  ctx.fillStyle = 'rgba(70, 90, 220, 0.28)'
  ctx.beginPath(); ctx.arc(32, CH / 2, 17, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(100, 130, 255, 0.5)'
  ctx.lineWidth = 1.2
  ctx.beginPath(); ctx.arc(32, CH / 2, 17, 0, Math.PI * 2); ctx.stroke()

  // initials
  ctx.fillStyle = 'rgba(170, 190, 255, 1)'
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(init, 32, CH / 2)

  // name
  ctx.fillStyle = 'rgba(255, 255, 255, 0.90)'
  ctx.font = 'bold 12.5px sans-serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.fillText(name, 58, CH / 2 - 3)

  // title
  ctx.fillStyle = 'rgba(180, 190, 255, 0.42)'
  ctx.font = '10px sans-serif'
  ctx.fillText(title, 58, CH / 2 + 13)

  const tex = new THREE.CanvasTexture(cv)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(CW / CH * 0.22, 0.22, 1)
  return sprite
}

function makeOpenedSprite(): THREE.Sprite {
  const CW = 160, CH = 36
  const cv = document.createElement('canvas')
  cv.width = CW; cv.height = CH
  const ctx = cv.getContext('2d')!

  // subtle dark bg pill
  ctx.fillStyle = 'rgba(4, 22, 10, 0.82)'
  rrect(ctx, 0, 0, CW, CH, 18); ctx.fill()

  // green dot
  ctx.fillStyle = 'rgba(52, 211, 110, 1)'
  ctx.beginPath(); ctx.arc(18, CH / 2, 5, 0, Math.PI * 2); ctx.fill()

  // "✓ opened" text — big and clear
  ctx.fillStyle = 'rgba(52, 211, 110, 1)'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText('✓  opened', 30, CH / 2)

  const tex = new THREE.CanvasTexture(cv)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, opacity: 1 })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(CW / CH * 0.14, 0.14, 1)
  return sprite
}

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
  const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(r * 1.18)
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

    // camera sits BELOW the globe's top surface → horizon view, not arctic bowl
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 300)
    camera.position.set(0, -3, 12)
    camera.lookAt(0, -6, 0)

    const R     = 5.8
    const group = new THREE.Group()
    group.position.set(0, -7.8, 0)
    group.rotation.z = 0
    scene.add(group)

    renderer.localClippingEnabled = true
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 8.5)

    // earth sphere
    const sGeo = new THREE.SphereGeometry(R, 64, 64)
    const sMat = new THREE.MeshPhongMaterial({
      color: 0x1a3a5c, shininess: 10,
      clippingPlanes: [clipPlane],
    })
    new THREE.TextureLoader().load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
      tx => { sMat.map = tx; sMat.needsUpdate = true },
    )
    group.add(new THREE.Mesh(sGeo, sMat))

    // ── lat / lon grid lines ───────────────────────────────────────────────────
    const gridMat = () => new THREE.LineBasicMaterial({
      color: 0x4466aa, transparent: true, opacity: 0.13,
      depthTest: true, clippingPlanes: [clipPlane],
    })
    // latitude parallels — every 15°
    for (let lat = -60; lat <= 75; lat += 15) {
      const pts: THREE.Vector3[] = []
      for (let lon = 0; lon <= 360; lon += 3) pts.push(ll3(lat, lon - 180, R + 0.01))
      group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), gridMat()))
    }
    // longitude meridians — every 15°
    for (let lon = 0; lon < 360; lon += 15) {
      const pts: THREE.Vector3[] = []
      for (let lat = -90; lat <= 90; lat += 2) pts.push(ll3(lat, lon - 180, R + 0.01))
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat()))
    }

    // atmosphere glow layers
    for (const [scale, opacity, color] of [
      [1.018, 0.13, 0x2255cc],
      [1.045, 0.05, 0x4488ff],
    ] as [number, number, number][]) {
      const m = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
        clippingPlanes: [clipPlane],
      })
      group.add(new THREE.Mesh(new THREE.SphereGeometry(R * scale, 32, 32), m))
    }

    // lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.38))
    const sun = new THREE.DirectionalLight(0xddeeff, 1.1)
    sun.position.set(-5, 3, 6)
    scene.add(sun)

    // sender dot (New York)
    const homeDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x99aaff }),
    )
    homeDot.position.copy(ll3(HOME.lat, HOME.lon, R + 0.04))
    group.add(homeDot)

    // destination dots + profile sprites
    TARGETS.forEach((t, i) => {
      // surface landing dot
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x6688ff, depthTest: true, clippingPlanes: [clipPlane] }),
      )
      dot.position.copy(ll3(t.lat, t.lon, R + 0.03))
      group.add(dot)

      // profile card sprite above dot
      const p = PROFILES[i]
      const sprite = makeProfileSprite(p.name, p.title, p.init)
      sprite.position.copy(ll3(t.lat, t.lon, R + 0.28))
      group.add(sprite)
    })

    // ── arcs ──────────────────────────────────────────────────────────────────
    interface Arc {
      geo:          THREE.BufferGeometry
      mat:          THREE.LineBasicMaterial
      buf:          Float32Array
      head:         THREE.Mesh
      baseOp:       number
      prog:         number
      speed:        number
      delay:        number
      total:        number
      active:       boolean
      done:         boolean
      holdT:        number
      openedSprite: THREE.Sprite | null
      showOpenedAt: number
      openedStartT: number
      openedDone:   boolean
    }
    const arcs: Arc[] = []

    const makeArc = (
      aLat: number, aLon: number,
      bLat: number, bLon: number,
      color: number, headColor: number,
      speed: number, delay: number,
      openedSprite: THREE.Sprite | null = null,
      showOpenedAt = 0,
    ) => {
      const buf = arcBuf(aLat, aLon, bLat, bLon, R)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(buf, 3))
      geo.setDrawRange(0, 0)
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: true, clippingPlanes: [clipPlane] })
      group.add(new THREE.Line(geo, mat))

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({ color: headColor, depthTest: true, clippingPlanes: [clipPlane] }),
      )
      head.visible = false
      group.add(head)

      arcs.push({ geo, mat, buf, head, baseOp: 0.85, prog: 0, speed, delay, total: N + 1, active: false, done: false, holdT: 0, openedSprite, showOpenedAt, openedStartT: 0, openedDone: false })
    }

    TARGETS.forEach(t => {
      makeArc(HOME.lat, HOME.lon, t.lat, t.lon, 0x4466ff, 0x88aaff, 0.008, 0)
      const replyDelay = 1.8 + Math.random() * 3.5
      const os = makeOpenedSprite()
      const cardPos = ll3(t.lat, t.lon, R + 0.28)
      os.position.set(cardPos.x, cardPos.y - 0.28, cardPos.z)
      os.visible = false
      group.add(os)
      makeArc(t.lat, t.lon, HOME.lat, HOME.lon, 0x22dd77, 0x66ffaa, 0.007, replyDelay, os, replyDelay - 1.3)
    })

    // ── animation loop ────────────────────────────────────────────────────────
    let cycleT  = 0
    const CYCLE = 11.0
    let lastMs  = performance.now()
    let raf: number

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      const dt  = (now - lastMs) / 1000
      lastMs    = now

      cycleT += dt
      if (cycleT > CYCLE) {
        cycleT = 0
        arcs.forEach(a => {
          a.prog   = 0
          a.active = false
          a.done   = false
          a.holdT  = 0
          a.mat.opacity = a.baseOp
          a.geo.setDrawRange(0, 0)
          a.head.visible = false
          if (a.openedSprite) {
            a.openedSprite.visible = false
            ;(a.openedSprite.material as THREE.SpriteMaterial).opacity = 1
          }
          a.openedStartT = 0
          a.openedDone   = false
        })
      }

      arcs.forEach(a => {
        // opened notification — show before reply fires, then fade
        if (a.openedSprite && !a.openedDone) {
          if (a.openedStartT === 0 && cycleT >= a.showOpenedAt) {
            a.openedSprite.visible = true
            a.openedStartT = cycleT
          }
          if (a.openedStartT > 0) {
            const elapsed = cycleT - a.openedStartT
            const fadeStart = 0.85, fadeDur = 0.35
            if (elapsed >= fadeStart) {
              const ft = Math.min(1, (elapsed - fadeStart) / fadeDur)
              ;(a.openedSprite.material as THREE.SpriteMaterial).opacity = 1 - ft
              if (ft >= 1) { a.openedSprite.visible = false; a.openedDone = true }
            }
          }
        }

        if (!a.active && cycleT >= a.delay) a.active = true
        if (!a.active) return

        if (a.done) {
          a.holdT += dt
          // fade out over 0.6s starting after 1s hold
          const fadeStart = 1.0
          const fadeDur   = 0.6
          if (a.holdT >= fadeStart) {
            const t = Math.min(1, (a.holdT - fadeStart) / fadeDur)
            a.mat.opacity = a.baseOp * (1 - t)
            if (t >= 1) a.geo.setDrawRange(0, 0)
          }
          return
        }

        a.prog = Math.min(1, a.prog + a.speed)
        const shown = Math.max(2, Math.ceil(a.prog * a.total))
        a.geo.setDrawRange(0, shown)

        const hi = (shown - 1) * 3
        a.head.visible = a.prog < 0.98
        a.head.position.set(a.buf[hi], a.buf[hi + 1], a.buf[hi + 2])

        if (a.prog >= 1) {
          a.done = true
          a.holdT = 0
          a.head.visible = false
        }
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

  return <div ref={ref} className="absolute inset-0" />
}

// ── section ───────────────────────────────────────────────────────────────────
export function OutreachSection() {
  return (
    <section className="relative z-10 h-full overflow-hidden">

      {/* left copy — centered vertically, above the globe layer */}
      <div className="relative z-10 h-full flex items-center pointer-events-none">
        <div className="w-full max-w-7xl mx-auto px-6 sm:px-12">
        <div className="max-w-[440px] pointer-events-auto">
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
        </div>
      </div>

      {/* globe — absolutely fills right 62% of section, full height */}
      <div className="absolute top-0 bottom-0 right-0" style={{ left: '38%', clipPath: 'inset(0 0 50px 0)' }}>
        <GlobeViz />
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-4 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-px" style={{ background: 'rgba(68,102,255,0.8)' }} />
            <span className="text-[9px] text-white/25">Outgoing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-px" style={{ background: 'rgba(34,221,119,0.8)' }} />
            <span className="text-[9px] text-white/25">Replies</span>
          </div>
        </div>
      </div>

    </section>
  )
}
