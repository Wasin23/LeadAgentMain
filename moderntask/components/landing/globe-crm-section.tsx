'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'

// ── City data ──────────────────────────────────────────────────────────────
const CITIES = [
  { lat: 40.7,  lng: -74.0  }, // 0 New York — source
  { lat: 51.5,  lng:  -0.1  }, // London
  { lat: 48.9,  lng:   2.3  }, // Paris
  { lat: 43.7,  lng: -79.4  }, // Toronto
  { lat: 37.8,  lng:-122.4  }, // San Francisco
  { lat: 41.9,  lng: -87.6  }, // Chicago
  { lat: 25.8,  lng: -80.2  }, // Miami
  { lat: 52.5,  lng:  13.4  }, // Berlin
  { lat: 52.4,  lng:   4.9  }, // Amsterdam
  { lat: 53.3,  lng:  -6.3  }, // Dublin
  { lat: 30.3,  lng: -97.7  }, // Austin
  { lat: 59.3,  lng:  18.1  }, // Stockholm
  { lat: 47.6,  lng:-122.3  }, // Seattle
  { lat: 34.1,  lng:-118.2  }, // Los Angeles
  { lat: 45.5,  lng: -73.6  }, // Montreal
]

const CONTACTS = [
  { name: 'Sarah Chen',   company: 'ScaleFlow',   role: 'Head of Growth',  stage: 'Contacted',  fit: 94 },
  { name: 'Marcus Lee',   company: 'Finova',      role: 'VP of Sales',     stage: 'Interested', fit: 88 },
  { name: 'Jade Morris',  company: 'FleetGrid',   role: 'Head of Revenue', stage: 'New',        fit: 91 },
  { name: 'Tom Reyes',    company: 'LayerStack',  role: 'CEO',             stage: 'New',        fit: 86 },
  { name: 'Nina Patel',   company: 'StitchOps',  role: 'VP Finance',      stage: 'New',        fit: 79 },
]

const CRM_UPDATES = [
  { field: 'Last researched', value: 'Just now' },
  { field: 'Email status',    value: 'Opened 3× · no reply yet' },
  { field: 'Deal stage',      value: 'New → Contacted' },
  { field: 'Intent signals',  value: 'Hiring 3 SDRs · Series A' },
  { field: 'Next action',     value: 'Follow-up: Q3 SDR expansion angle' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
const R       = 1.8
const ARC_SEG = 90
const TAIL    = 30

function ll2v(lat: number, lng: number, r: number) {
  const phi   = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  )
}

function arcPts(a: THREE.Vector3, b: THREE.Vector3) {
  const dist = a.distanceTo(b)
  const ctrl = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R + dist * 0.24)
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= ARC_SEG; i++) {
    const t = i / ARC_SEG
    pts.push(
      a.clone().multiplyScalar((1-t)*(1-t))
       .add(ctrl.clone().multiplyScalar(2*(1-t)*t))
       .add(b.clone().multiplyScalar(t*t))
    )
  }
  return pts
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

// ── CRM browser window ─────────────────────────────────────────────────────
type CrmPhase = 'scanning' | 'researching' | 'updating' | 'done'

function CrmPanel() {
  const [phase, setPhase]     = useState<CrmPhase>('scanning')
  const [scanIdx, setScanIdx] = useState(-1)
  const [active, setActive]   = useState(0)
  const [fields, setFields]   = useState<number>(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const run = async () => {
      // Scan through contacts
      setPhase('scanning'); setScanIdx(-1); setFields(0)
      for (let i = 0; i < CONTACTS.length; i++) {
        if (!alive.current) return
        setScanIdx(i)
        await sleep(320)
      }
      if (!alive.current) return

      // Pick top contact
      setActive(0)
      await sleep(300)
      if (!alive.current) return

      // Research
      setPhase('researching')
      await sleep(900)
      if (!alive.current) return

      // Update fields one by one
      setPhase('updating')
      for (let i = 0; i < CRM_UPDATES.length; i++) {
        if (!alive.current) return
        setFields(i + 1)
        await sleep(480)
      }
      if (!alive.current) return

      setPhase('done')
      await sleep(2000)
      if (!alive.current) return
      run()
    }
    run()
    return () => { alive.current = false }
  }, [])

  const stageColor: Record<string, string> = {
    'New':        'bg-white/10 text-white/40',
    'Contacted':  'bg-indigo-500/20 text-indigo-400',
    'Interested': 'bg-green-500/20 text-green-400',
  }

  return (
    <div className="rounded-2xl border border-white/[0.10] bg-[#07091c]/90 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/[0.04] w-full">
      {/* Title bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 px-3 py-[3px] rounded bg-white/[0.05] border border-white/[0.06] text-white/20 text-[10px] font-mono text-center truncate">
          meridian://crm/contacts
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full ${phase === 'done' ? 'bg-green-400' : 'bg-indigo-400 animate-pulse'}`} />
          <span className={`text-[10px] font-medium ${phase === 'done' ? 'text-green-400' : 'text-indigo-400/80'}`}>
            {phase === 'scanning' ? 'Scanning contacts…' : phase === 'researching' ? 'Researching…' : phase === 'updating' ? 'Updating CRM…' : 'Updated'}
          </span>
        </div>
      </div>

      <div className="flex h-[440px]">
        {/* Contact list */}
        <div className="w-[200px] shrink-0 border-r border-white/[0.06] overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold text-white/25 uppercase tracking-widest border-b border-white/[0.04]">
            Contacts · {CONTACTS.length}
          </div>
          {CONTACTS.map((c, i) => (
            <div
              key={i}
              className={`px-3 py-2.5 border-b border-white/[0.03] transition-all cursor-default ${
                i === active && phase !== 'scanning'
                  ? 'bg-indigo-500/12 border-l-2 border-l-indigo-500'
                  : scanIdx === i
                  ? 'bg-white/[0.04]'
                  : ''
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-[9px] font-bold shrink-0">
                  {c.name[0]}
                </div>
                <div className="min-w-0">
                  <div className={`text-[11px] font-semibold truncate ${i === active && phase !== 'scanning' ? 'text-white/85' : 'text-white/50'}`}>
                    {c.name}
                  </div>
                  <div className="text-[9px] text-white/25 truncate">{c.company}</div>
                </div>
              </div>
              {scanIdx === i && phase === 'scanning' && (
                <div className="mt-1 h-px bg-indigo-500/40 rounded" style={{ animation: 'scanLine 0.32s ease-out forwards' }} />
              )}
            </div>
          ))}
        </div>

        {/* Contact detail */}
        <div className="flex-1 p-5 overflow-y-auto">
          {phase === 'scanning' ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-white/20">
              <div className="text-[12px]">Select a contact</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-sm shrink-0">
                  {CONTACTS[active].name[0]}
                </div>
                <div>
                  <div className="text-white/85 font-bold text-sm">{CONTACTS[active].name}</div>
                  <div className="text-white/35 text-[11px]">{CONTACTS[active].role} · {CONTACTS[active].company}</div>
                  <div className="flex gap-1.5 mt-1">
                    <span className={`px-1.5 py-px rounded text-[9px] font-semibold ${stageColor[CONTACTS[active].stage]}`}>
                      {CONTACTS[active].stage}
                    </span>
                    <span className="px-1.5 py-px rounded text-[9px] font-semibold bg-white/[0.06] text-white/40">
                      Fit {CONTACTS[active].fit}%
                    </span>
                  </div>
                </div>
              </div>

              {phase === 'researching' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                  AI researching account signals…
                </div>
              )}

              {(phase === 'updating' || phase === 'done') && (
                <div className="space-y-2 border-t border-white/[0.06] pt-3">
                  <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">AI Updates</div>
                  {CRM_UPDATES.slice(0, fields).map((u, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <span className="text-green-400 text-[10px] mt-px shrink-0">✓</span>
                      <span className="text-white/30 w-28 shrink-0">{u.field}</span>
                      <span className="text-white/65 font-medium">{u.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {phase === 'done' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-[11px] text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  CRM record updated · next action queued
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main section ───────────────────────────────────────────────────────────
export function GlobeCrmSection() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const scrollProg = useRef(0)
  const [showCrm, setShowCrm] = useState(false)
  const crmShown = useRef(false)

  // Three.js globe
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(0, 0, 4.2)
    camera.lookAt(0, 0, 0)

    const setSize = () => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight)
      camera.aspect = canvas.clientWidth / canvas.clientHeight
      camera.updateProjectionMatrix()
    }
    setSize()

    // Globe group — y driven by scroll
    const g = new THREE.Group()
    g.position.set(0, -1.8, 0)
    scene.add(g)

    // Sphere
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry(R, 80, 80),
      new THREE.MeshPhongMaterial({ color: 0x020a1e, emissive: 0x050e2a, specular: 0x1a3080, shininess: 40 }),
    ))

    // Atmosphere (back-face glow)
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.055, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0x1e3fbf, transparent: true, opacity: 0.08, side: THREE.BackSide, blending: THREE.AdditiveBlending }),
    ))

    // Latitude lines — clear and prominent
    for (let la = -75; la <= 75; la += 15) {
      const pts: THREE.Vector3[] = []
      for (let lg = 0; lg <= 360; lg += 2) pts.push(ll2v(la, lg, R + 0.004))
      g.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: la === 0 ? 0x4466ee : 0x2d4bbb, transparent: true, opacity: la === 0 ? 0.35 : 0.22 }),
      ))
    }
    // Longitude lines — subtle
    for (let lg = 0; lg < 360; lg += 20) {
      const pts: THREE.Vector3[] = []
      for (let la = -90; la <= 90; la += 2) pts.push(ll2v(la, lg, R + 0.004))
      g.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x1a2f88, transparent: true, opacity: 0.10 }),
      ))
    }

    // City dots
    const cityVecs = CITIES.map(c => ll2v(c.lat, c.lng, R + 0.014))
    const dPos = new Float32Array(cityVecs.length * 3)
    cityVecs.forEach((v, i) => { dPos[i*3]=v.x; dPos[i*3+1]=v.y; dPos[i*3+2]=v.z })
    const dotGeo = new THREE.BufferGeometry()
    dotGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3))
    g.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: 0x99aaff, size: 0.024, sizeAttenuation: true })))

    // Source dot (NYC) — glowing sphere
    const src = cityVecs[0]
    const srcMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x5577ff, blending: THREE.AdditiveBlending }),
    )
    srcMesh.position.copy(src)
    g.add(srcMesh)

    // Pulsing ring around source
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4466ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.032, 0.052, 32), ringMat)
    ring.position.copy(src)
    ring.lookAt(src.clone().multiplyScalar(3))
    g.add(ring)

    // Lighting
    scene.add(new THREE.AmbientLight(0x1a2860, 3.5))
    const sun = new THREE.DirectionalLight(0x3355dd, 2.2)
    sun.position.set(5, 3, 4)
    scene.add(sun)

    // Arcs
    type Arc = { line: THREE.Line; geo: THREE.BufferGeometry; head: number; tail: number }
    const arcs: Arc[] = []
    const arcMat = new THREE.LineBasicMaterial({ color: 0x4d70ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    let arcTimer = 0
    let destIdx  = 1

    function spawnArc() {
      const dst = cityVecs[destIdx % (CITIES.length - 1) + 1]
      destIdx++
      const pts = arcPts(src, dst)
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      geo.setDrawRange(0, 0)
      const line = new THREE.Line(geo, arcMat)
      g.add(line)
      arcs.push({ line, geo, head: 0, tail: 0 })
    }

    let raf: number, prev = 0
    const animate = (now: number) => {
      raf = requestAnimationFrame(animate)
      const dt = now - prev; prev = now

      const p = scrollProg.current
      // First half: globe rises
      const riseP = Math.min(p * 2, 1)
      g.position.y = -1.8 + riseP * 1.8
      // Second half: globe shifts left for CRM panel
      const shiftP = Math.max(0, (p - 0.5) * 2)
      g.position.x = -shiftP * 0.75

      // Source ring pulse
      const t = now * 0.001
      ring.scale.setScalar(1 + Math.sin(t * 2.8) * 0.10)
      ringMat.opacity = 0.3 + Math.sin(t * 2.8) * 0.22

      // Arc spawn & animate
      arcTimer += dt
      if (arcTimer > 1050) { arcTimer = 0; spawnArc() }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i]
        a.head = Math.min(a.head + 2.8, ARC_SEG)
        a.tail = Math.max(0, a.head - TAIL)
        a.geo.setDrawRange(Math.floor(a.tail), Math.ceil(a.head - a.tail))
        if (a.tail >= ARC_SEG - 1) {
          g.remove(a.line); a.geo.dispose(); arcs.splice(i, 1)
        }
      }

      renderer.render(scene, camera)
    }
    animate(0)

    const onScroll = () => {
      const section = sectionRef.current
      if (!section) return
      const scrolled = window.scrollY - section.offsetTop
      const maxScroll = section.offsetHeight - window.innerHeight
      const p = Math.min(Math.max(scrolled / Math.max(maxScroll, 1), 0), 1)
      scrollProg.current = p
      const show = p > 0.42
      if (show !== crmShown.current) {
        crmShown.current = show
        setShowCrm(show)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', setSize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', setSize)
      renderer.dispose()
    }
  }, [])

  return (
    <div ref={sectionRef} className="relative z-10" style={{ height: '200vh' }}>
      <style>{`
        @keyframes scanLine { from{transform:scaleX(0)}to{transform:scaleX(1)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)} }
        .crm-panel-in { animation: slideInRight 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>

      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Globe canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* ── Outbound overlay (top section) ── */}
        <div
          className="absolute top-0 left-0 z-10 px-14 pt-24 max-w-[480px] transition-opacity duration-500"
          style={{ opacity: showCrm ? 0 : 1, pointerEvents: showCrm ? 'none' : 'auto' }}
        >
          <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight mb-5">
            Sends. Tracks.<br />Follows up.
          </h2>
          <p className="text-white/50 text-lg leading-relaxed mb-7">
            Every email fires from your real inbox. Opens are tracked, follow-ups schedule automatically, and when a reply lands — all sequences stop instantly.
          </p>
          <div className="space-y-3">
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
        </div>

        {/* ── CRM overlay (second section) ── */}
        {showCrm && (
          <div className="absolute inset-0 z-10 flex items-center justify-end px-10 gap-10 pointer-events-none">
            {/* Left copy */}
            <div className="max-w-[360px] crm-panel-in pointer-events-auto" style={{ animationDelay: '0ms' }}>
              <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.05] tracking-tight mb-4">
                Keeps your CRM<br />up to date.
              </h2>
              <p className="text-white/50 text-base leading-relaxed mb-6">
                Every time Meridian researches a lead or gets a reply, your CRM updates automatically — deal stage, last contact, next action, and signals pulled from the web.
              </p>
              <div className="space-y-2.5">
                {[
                  'Auto-updates deal stage on reply',
                  'Enriches contacts with live signals',
                  'Queues next actions automatically',
                  'Syncs with HubSpot, Salesforce, and more',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-white/50 text-[14px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* CRM browser panel */}
            <div className="w-[460px] shrink-0 crm-panel-in pointer-events-auto" style={{ animationDelay: '80ms' }}>
              <CrmPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
