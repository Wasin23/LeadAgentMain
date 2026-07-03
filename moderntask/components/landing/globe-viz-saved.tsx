'use client'

// ── SAVED GLOBE VIZ - not currently used in OutreachSection ──
// Re-import GlobeViz and drop it back into OutreachSection to restore.

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const HOME = { lat: 40.71, lon: -74.01 }

const TARGETS = [
  { lat: 34.05, lon: -118.24 },
  { lat: 41.88, lon:  -87.63 },
  { lat: 25.77, lon:  -80.19 },
  { lat: 47.61, lon: -122.33 },
  { lat: 29.76, lon:  -95.37 },
  { lat: 33.75, lon:  -84.39 },
  { lat: 51.51, lon:   -0.12 },
  { lat: 48.85, lon:    2.35 },
  { lat: 19.43, lon:  -99.13 },
  { lat: 43.65, lon:  -79.38 },
  { lat: 35.69, lon:  139.69 },
  { lat: 55.75, lon:   37.62 },
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
  const CW = 240, CH = 64
  const cv = document.createElement('canvas')
  cv.width = CW; cv.height = CH
  const ctx = cv.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, CH)
  grad.addColorStop(0, 'rgb(235, 240, 255)')
  grad.addColorStop(1, 'rgb(220, 230, 255)')
  ctx.fillStyle = grad
  rrect(ctx, 0, 0, CW, CH, 10); ctx.fill()
  ctx.strokeStyle = 'rgba(100, 130, 255, 0.55)'
  ctx.lineWidth = 1.8
  rrect(ctx, 1, 1, CW - 2, CH - 2, 9); ctx.stroke()
  ctx.strokeStyle = 'rgba(160, 180, 255, 0.18)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(10, 1); ctx.lineTo(CW - 10, 1); ctx.stroke()
  const avGrad = ctx.createRadialGradient(34, CH / 2, 4, 34, CH / 2, 18)
  avGrad.addColorStop(0, 'rgba(100, 120, 255, 0.60)')
  avGrad.addColorStop(1, 'rgba(60, 80, 200, 0.30)')
  ctx.fillStyle = avGrad
  ctx.beginPath(); ctx.arc(34, CH / 2, 18, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(140, 165, 255, 0.65)'
  ctx.lineWidth = 1.4
  ctx.beginPath(); ctx.arc(34, CH / 2, 18, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = 'rgba(230, 240, 255, 1)'
  ctx.font = 'bold 13px sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(init, 34, CH / 2)
  ctx.fillStyle = 'rgba(30, 50, 140, 0.95)'
  ctx.font = 'bold 13px sans-serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.fillText(name, 62, CH / 2 - 3)
  ctx.fillStyle = 'rgba(80, 100, 210, 0.75)'
  ctx.font = '11px sans-serif'
  ctx.fillText(title, 62, CH / 2 + 14)
  const tex = new THREE.CanvasTexture(cv)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, alphaTest: 0.01 })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(CW / CH * 0.24, 0.24, 1)
  return sprite
}

function makeOpenedSprite(): THREE.Sprite {
  const CW = 160, CH = 36
  const cv = document.createElement('canvas')
  cv.width = CW; cv.height = CH
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = 'rgb(230, 250, 240)'
  rrect(ctx, 0, 0, CW, CH, 18); ctx.fill()
  ctx.fillStyle = 'rgba(52, 211, 110, 1)'
  ctx.beginPath(); ctx.arc(18, CH / 2, 5, 0, Math.PI * 2); ctx.fill()
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

const N = 90

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

export function GlobeViz() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const W = el.clientWidth, H = el.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 300)
    camera.position.set(0, -3, 12)
    camera.lookAt(0, -6, 0)

    const R      = 7.6
    const CY     = -10.0
    const group  = new THREE.Group()
    group.position.set(0, CY, 0)
    scene.add(group)

    renderer.localClippingEnabled = true
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 14)

    const sGeo = new THREE.SphereGeometry(R, 64, 64)
    const sMat = new THREE.MeshPhongMaterial({
      color: 0x7799bb, emissive: 0x050f1c, emissiveIntensity: 0.12,
      shininess: 20, specular: new THREE.Color(0x1a2e55),
      clippingPlanes: [clipPlane],
    })
    new THREE.TextureLoader().load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
      tx => { sMat.map = tx; sMat.needsUpdate = true },
    )
    group.add(new THREE.Mesh(sGeo, sMat))

    const gridMat = () => new THREE.LineBasicMaterial({
      color: 0x4488cc, transparent: true, opacity: 0.28,
      depthTest: true, clippingPlanes: [clipPlane],
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    for (let lat = -60; lat <= 75; lat += 15) {
      const pts: THREE.Vector3[] = []
      for (let lon = 0; lon <= 360; lon += 3) pts.push(ll3(lat, lon - 180, R + 0.01))
      group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), gridMat()))
    }
    for (let lon = 0; lon < 360; lon += 15) {
      const pts: THREE.Vector3[] = []
      for (let lat = -90; lat <= 90; lat += 2) pts.push(ll3(lat, lon - 180, R + 0.01))
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat()))
    }

    for (const [scale, opacity, color] of [
      [1.015, 0.22, 0x1a44cc], [1.038, 0.11, 0x2255ee],
      [1.07, 0.05, 0x3366ff],  [1.12,  0.02, 0x4477ff],
    ] as [number, number, number][]) {
      group.add(new THREE.Mesh(
        new THREE.SphereGeometry(R * scale, 32, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }),
      ))
    }

    scene.add(new THREE.AmbientLight(0xaabbdd, 0.85))
    const sun = new THREE.DirectionalLight(0xeef4ff, 2.2)
    sun.position.set(-6, 5, 10); scene.add(sun)
    const rim = new THREE.DirectionalLight(0x2244cc, 0.8)
    rim.position.set(6, -2, -10); scene.add(rim)

    const homeDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xaabbff }),
    )
    homeDot.position.copy(ll3(HOME.lat, HOME.lon, R + 0.04))
    group.add(homeDot)

    TARGETS.forEach((t, i) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x7799ff, depthTest: true, clippingPlanes: [clipPlane] }),
      )
      dot.position.copy(ll3(t.lat, t.lon, R + 0.03))
      group.add(dot)
      const p = PROFILES[i]
      const sprite = makeProfileSprite(p.name, p.title, p.init)
      sprite.position.copy(ll3(t.lat, t.lon, R + 0.28))
      group.add(sprite)
    })

    interface Arc {
      geo: THREE.BufferGeometry; mat: THREE.LineBasicMaterial; buf: Float32Array
      head: THREE.Mesh; baseOp: number; prog: number; speed: number; delay: number
      total: number; active: boolean; done: boolean; holdT: number
      openedSprite: THREE.Sprite | null; showOpenedAt: number
      openedStartT: number; openedDone: boolean
    }
    const arcs: Arc[] = []

    const makeArc = (
      aLat: number, aLon: number, bLat: number, bLon: number,
      color: number, headColor: number, speed: number, delay: number,
      openedSprite: THREE.Sprite | null = null, showOpenedAt = 0,
    ) => {
      const buf = arcBuf(aLat, aLon, bLat, bLon, R)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(buf, 3))
      geo.setDrawRange(0, 0)
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.92, depthTest: true, clippingPlanes: [clipPlane], blending: THREE.AdditiveBlending, depthWrite: false })
      group.add(new THREE.Line(geo, mat))
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: headColor, depthTest: true, clippingPlanes: [clipPlane] }))
      head.visible = false
      group.add(head)
      arcs.push({ geo, mat, buf, head, baseOp: 0.85, prog: 0, speed, delay, total: N + 1, active: false, done: false, holdT: 0, openedSprite, showOpenedAt, openedStartT: 0, openedDone: false })
    }

    TARGETS.forEach(t => {
      makeArc(HOME.lat, HOME.lon, t.lat, t.lon, 0x5577ff, 0xaabbff, 0.008, 0)
      const replyDelay = 1.8 + Math.random() * 3.5
      const os = makeOpenedSprite()
      const cardPos = ll3(t.lat, t.lon, R + 0.28)
      os.position.set(cardPos.x, cardPos.y - 0.28, cardPos.z)
      os.visible = false
      group.add(os)
      makeArc(t.lat, t.lon, HOME.lat, HOME.lon, 0x22dd77, 0x66ffaa, 0.007, replyDelay, os, replyDelay - 1.3)
    })

    let cycleT = 0
    const CYCLE = 11.0
    let lastMs = performance.now()
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
          a.prog = 0; a.active = false; a.done = false; a.holdT = 0
          a.mat.opacity = a.baseOp; a.geo.setDrawRange(0, 0); a.head.visible = false
          if (a.openedSprite) { a.openedSprite.visible = false; (a.openedSprite.material as THREE.SpriteMaterial).opacity = 1 }
          a.openedStartT = 0; a.openedDone = false
        })
      }
      arcs.forEach(a => {
        if (a.openedSprite && !a.openedDone) {
          if (a.openedStartT === 0 && cycleT >= a.showOpenedAt) { a.openedSprite.visible = true; a.openedStartT = cycleT }
          if (a.openedStartT > 0) {
            const elapsed = cycleT - a.openedStartT
            if (elapsed >= 0.85) {
              const ft = Math.min(1, (elapsed - 0.85) / 0.35)
              ;(a.openedSprite.material as THREE.SpriteMaterial).opacity = 1 - ft
              if (ft >= 1) { a.openedSprite.visible = false; a.openedDone = true }
            }
          }
        }
        if (!a.active && cycleT >= a.delay) a.active = true
        if (!a.active) return
        if (a.done) {
          a.holdT += dt
          if (a.holdT >= 1.0) {
            const t = Math.min(1, (a.holdT - 1.0) / 0.6)
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
        if (a.prog >= 1) { a.done = true; a.holdT = 0; a.head.visible = false }
      })
      renderer.render(scene, camera)
    }
    tick()

    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h)
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
