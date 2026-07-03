'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Lead data ────────────────────────────────────────────────────────────────

const LEADS = [
  {
    id: 0,
    name: 'Sarah Chen',
    title: 'Head of Growth',
    company: 'ScaleFlow',
    initials: 'SC',
    color: '#6366f1',
    signals: ['Hiring 3 SDRs', 'Expanding into US', 'Posted about cold email fatigue'],
    px: 0.04, py: 0.18,
  },
  {
    id: 1,
    name: 'James Wilson',
    title: 'CEO',
    company: 'Finova',
    initials: 'JW',
    color: '#8b5cf6',
    signals: ['Raised $12M Series A', 'New GTM strategy', 'Seeking outbound automation'],
    px: 0.34, py: 0.11,
  },
  {
    id: 2,
    name: 'Megan Riley',
    title: 'VP of Sales',
    company: 'Altura Labs',
    initials: 'MR',
    color: '#a78bfa',
    signals: ['Open to new tools', 'High performer churn', 'Using Apollo + Outreach'],
    px: 0.68, py: 0.30,
  },
  {
    id: 3,
    name: 'David Park',
    title: 'Head of Marketing',
    company: 'Clearbit',
    initials: 'DP',
    color: '#60a5fa',
    signals: ['Recently launched new product', 'Active on LinkedIn', 'Engages with growth content'],
    px: 0.02, py: 0.60,
  },
  {
    id: 4,
    name: 'Priya Nair',
    title: 'Growth Lead',
    company: 'SynthCode',
    initials: 'PN',
    color: '#34d399',
    signals: ['Hiring growth engineer', 'Strong LinkedIn activity', 'Tech stack match'],
    px: 0.35, py: 0.72,
  },
  {
    id: 5,
    name: 'Lucas Moretti',
    title: 'Founder',
    company: 'Novus AI',
    initials: 'LM',
    color: '#f472b6',
    signals: ['Bootstrapped', 'Active in AI communities', 'Seeking scalable outbound'],
    px: 0.68, py: 0.68,
  },
]

// Bezier control-point offsets per lead (keeps curves stable - no Math.random in draw loop)
const CP_OFFSETS = [
  [-80, -90] as [number, number],
  [-30, -110] as [number, number],
  [90, -70] as [number, number],
  [-110, 30] as [number, number],
  [-50, 90] as [number, number],
  [90, 50] as [number, number],
]

// Signal-type prefix icons (no emoji dep)
const SIG_ICONS = ['◈', '◆', '◉']

// ─── Component ────────────────────────────────────────────────────────────────

export function ProspectGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const geoRef = useRef<{ lat: number; lng: number } | null>(null)
  const [coords, setCoords] = useState<string | null>(null)
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set())

  // Geolocation
  useEffect(() => {
    const fallback = { lat: 37.7749, lng: -122.4194 } // San Francisco
    if (!navigator.geolocation) {
      geoRef.current = fallback
      setCoords('37.77°N  122.42°W')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude
        const lng = p.coords.longitude
        geoRef.current = { lat, lng }
        const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`
        const lngStr = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`
        setCoords(`${latStr}  ${lngStr}`)
      },
      () => {
        geoRef.current = fallback
        setCoords('37.77°N  122.42°W')
      },
      { timeout: 6000 }
    )
  }, [])

  // Staggered card entrance
  useEffect(() => {
    const timers = LEADS.map((l, i) =>
      setTimeout(() => setVisibleCards(prev => new Set([...prev, l.id])), 900 + i * 250)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  // Canvas loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    let t = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Stable star field (golden-ratio spread)
    const STARS = Array.from({ length: 280 }, (_, i) => ({
      x: (i * 0.6180339887) % 1,
      y: (i * 0.3819660113) % 1,
      r: 0.3 + (i * 0.17) % 1.1,
      a: 0.1 + (i * 0.23) % 0.45,
      twinkleOff: (i * 0.41) % (Math.PI * 2),
    }))

    // Constellation background nodes
    const NET = Array.from({ length: 38 }, (_, i) => ({
      x: (i * 0.7137) % 0.92 + 0.04,
      y: (i * 0.5321) % 0.88 + 0.06,
    }))

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      t += 0.0035
      ctx.clearRect(0, 0, W, H)

      // ── Background ──────────────────────────────────────────────────────────
      ctx.fillStyle = '#03050d'
      ctx.fillRect(0, 0, W, H)

      // Upper-right glow (globe area)
      const ur = ctx.createRadialGradient(W * 0.74, 0, 0, W * 0.74, 0, H * 0.9)
      ur.addColorStop(0, 'rgba(70, 90, 220, 0.14)')
      ur.addColorStop(0.4, 'rgba(60, 80, 200, 0.05)')
      ur.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = ur
      ctx.fillRect(0, 0, W, H)

      // Center glow (origin area)
      const cg = ctx.createRadialGradient(W * 0.44, H * 0.46, 0, W * 0.44, H * 0.46, H * 0.5)
      cg.addColorStop(0, 'rgba(99, 102, 241, 0.06)')
      cg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = cg
      ctx.fillRect(0, 0, W, H)

      // ── Stars ───────────────────────────────────────────────────────────────
      STARS.forEach(s => {
        const twinkle = s.a * (0.7 + 0.3 * Math.sin(t * 1.8 + s.twinkleOff))
        ctx.beginPath()
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(210, 220, 255, ${twinkle})`
        ctx.fill()
      })

      // ── Constellation ───────────────────────────────────────────────────────
      NET.forEach((n, i) => {
        const nx = n.x * W, ny = n.y * H
        NET.slice(i + 1).forEach(m => {
          const d = Math.hypot(nx - m.x * W, ny - m.y * H)
          if (d < W * 0.13) {
            ctx.beginPath()
            ctx.moveTo(nx, ny)
            ctx.lineTo(m.x * W, m.y * H)
            ctx.strokeStyle = `rgba(99,102,241,${0.09 * (1 - d / (W * 0.13))})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        })
        ctx.beginPath()
        ctx.arc(nx, ny, 1.1, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(120,130,255,0.28)'
        ctx.fill()
      })

      // ── Globe ───────────────────────────────────────────────────────────────
      const GCX = W * 0.71
      const GCY = H * -0.04  // partially cut off at top
      const GR  = H * 0.57

      ctx.save()
      ctx.beginPath()
      ctx.arc(GCX, GCY, GR, 0, Math.PI * 2)
      ctx.clip()

      // Globe body - solid base so visible portion is never blended into background
      ctx.fillStyle = '#061428'
      ctx.fillRect(0, 0, W, H)

      // Surface sheen from upper-left of visible area
      const hx = GCX - GR * 0.28
      const hy = Math.max(H * 0.05, GCY + GR * 0.12)
      const gb = ctx.createRadialGradient(hx, hy, 0, hx, hy, GR * 1.15)
      gb.addColorStop(0,   'rgba(55, 100, 245, 0.52)')
      gb.addColorStop(0.38,'rgba(20, 55, 165, 0.24)')
      gb.addColorStop(1,   'rgba(0, 5, 20, 0)')
      ctx.fillStyle = gb
      ctx.fillRect(0, 0, W, H)

      // Latitude lines
      const LATS = [-60,-45,-30,-15,0,15,30,45,60]
      LATS.forEach(deg => {
        const lat = deg * Math.PI / 180
        const cL = Math.cos(lat), sL = Math.sin(lat)
        ctx.beginPath()
        for (let k = 0; k <= 80; k++) {
          const a = (k / 80) * Math.PI * 2
          ctx.lineTo(GCX + GR * cL * Math.cos(a), GCY + GR * sL + GR * cL * Math.sin(a) * 0.22)
        }
        ctx.strokeStyle = 'rgba(110,160,255,0.16)'
        ctx.lineWidth = 0.7
        ctx.stroke()
      })

      // Rotating meridian lines
      const ROT_SPEED = 0.18
      for (let i = 0; i < 20; i++) {
        const theta = (i / 20) * Math.PI * 2 + t * ROT_SPEED
        const sT = Math.sin(theta), cT = Math.cos(theta)
        const front = cT > 0
        const a = front ? 0.08 + 0.28 * Math.abs(sT) : 0.02 + 0.04 * Math.abs(sT)
        ctx.beginPath()
        for (let j = 0; j <= 64; j++) {
          const phi = (j / 64) * Math.PI * 2
          ctx.lineTo(GCX + GR * Math.cos(phi) * sT, GCY + GR * Math.sin(phi))
        }
        ctx.strokeStyle = `rgba(110,170,255,${a})`
        ctx.lineWidth = front ? 0.6 + 0.75 * Math.abs(sT) : 0.3
        ctx.stroke()
      }
      ctx.restore()

      // Atmosphere
      const atmo = ctx.createRadialGradient(GCX, GCY, GR * 0.91, GCX, GCY, GR * 1.1)
      atmo.addColorStop(0,   'rgba(60,120,255,0)')
      atmo.addColorStop(0.45,'rgba(80,160,255,0.20)')
      atmo.addColorStop(1,   'rgba(40,100,255,0)')
      ctx.beginPath()
      ctx.arc(GCX, GCY, GR * 1.1, 0, Math.PI * 2)
      ctx.fillStyle = atmo
      ctx.fill()

      // ── Orbital rings (Meridian logo, over globe) ───────────────────────────
      const rX = GCX, rY = GCY + GR * 0.60, rR = GR * 0.15
      const rings: [number, number, number, number][] = [
        [rR,       rR,       0,    0.70],
        [rR,       rR * 0.28, 0,   0.50],
        [rR * 0.5, rR,       0.22, 0.42],
        [rR * 0.28,rR,       0,    0.32],
      ]
      rings.forEach(([rx, ry, rot, a]) => {
        ctx.beginPath()
        ctx.ellipse(rX, rY, rx, ry, rot, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(170,200,255,${a})`
        ctx.lineWidth = 1.4
        ctx.stroke()
      })
      ctx.beginPath()
      ctx.moveTo(rX - rR * 1.1, rY)
      ctx.lineTo(rX + rR * 1.1, rY)
      ctx.strokeStyle = 'rgba(170,200,255,0.30)'
      ctx.lineWidth = 0.7
      ctx.stroke()

      // ── User location on globe ──────────────────────────────────────────────
      const geo = geoRef.current

      // Origin node (center of the visualization)
      let originX = W * 0.44
      let originY = H * 0.46

      if (geo) {
        // Orthographic projection
        // Center the globe view on (30°N, -30°W) so both Americas and Europe are visible
        const cLat = 30 * Math.PI / 180
        const cLng = -30 * Math.PI / 180

        // Current globe longitude rotation
        const curRot = t * ROT_SPEED

        const latR = geo.lat * Math.PI / 180
        const lngR = geo.lng * Math.PI / 180
        const dLng = lngR - cLng - curRot

        const cosC =
          Math.sin(cLat) * Math.sin(latR) +
          Math.cos(cLat) * Math.cos(latR) * Math.cos(dLng)

        if (cosC > 0.05) {
          const px = GCX + GR * Math.cos(latR) * Math.sin(dLng)
          const py = GCY - GR * (Math.cos(cLat) * Math.sin(latR) - Math.sin(cLat) * Math.cos(latR) * Math.cos(dLng))

          originX = px
          originY = py

          // Location dot glow
          const pulse = 0.55 + 0.45 * Math.sin(t * 2.8)
          const lg = ctx.createRadialGradient(px, py, 0, px, py, 22)
          lg.addColorStop(0, `rgba(130,150,255,${pulse})`)
          lg.addColorStop(1, 'rgba(99,102,241,0)')
          ctx.beginPath()
          ctx.arc(px, py, 22, 0, Math.PI * 2)
          ctx.fillStyle = lg
          ctx.fill()

          // Pulse rings
          for (let r = 0; r < 2; r++) {
            const rp = ((t * 1.4 + r * 0.5) % 1)
            ctx.beginPath()
            ctx.arc(px, py, 5 + rp * 22, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(140,160,255,${0.65 * (1 - rp)})`
            ctx.lineWidth = 1.2
            ctx.stroke()
          }

          // Center dot
          ctx.beginPath()
          ctx.arc(px, py, 3.5, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.fill()
        }
      }

      // ── Globe → origin connector ────────────────────────────────────────────
      // Line from ring center down to origin
      const beamSrcX = rX
      const beamSrcY = rY + rR * 0.3
      ctx.beginPath()
      ctx.moveTo(beamSrcX, beamSrcY)
      ctx.lineTo(originX, originY)
      ctx.strokeStyle = 'rgba(99,102,241,0.18)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 8])
      ctx.stroke()
      ctx.setLineDash([])

      // ── Origin node ─────────────────────────────────────────────────────────
      const op = 0.5 + 0.5 * Math.sin(t * 2.2)

      const og = ctx.createRadialGradient(originX, originY, 0, originX, originY, 32)
      og.addColorStop(0,   `rgba(120,130,255,${op * 0.65})`)
      og.addColorStop(0.5, `rgba(99,102,241,${op * 0.18})`)
      og.addColorStop(1,   'rgba(99,102,241,0)')
      ctx.beginPath()
      ctx.arc(originX, originY, 32, 0, Math.PI * 2)
      ctx.fillStyle = og
      ctx.fill()

      // Pulse rings from origin
      for (let r = 0; r < 3; r++) {
        const rp = ((t * 1.1 + r * 0.33) % 1)
        ctx.beginPath()
        ctx.arc(originX, originY, 7 + rp * 34, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(99,102,241,${0.55 * (1 - rp)})`
        ctx.lineWidth = 1.3
        ctx.stroke()
      }

      ctx.beginPath()
      ctx.arc(originX, originY, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#e0e4ff'
      ctx.fill()

      // ── Beams to lead cards ──────────────────────────────────────────────────
      const CARD_W = 220
      LEADS.forEach((lead, i) => {
        const dX = lead.px * W + CARD_W / 2
        const dY = lead.py * H + 68
        const mX = (originX + dX) / 2
        const mY = (originY + dY) / 2
        const [cDX, cDY] = CP_OFFSETS[i]
        const cpX = mX + cDX, cpY = mY + cDY

        // Dashed beam
        ctx.beginPath()
        ctx.moveTo(originX, originY)
        ctx.quadraticCurveTo(cpX, cpY, dX, dY)
        ctx.strokeStyle = 'rgba(99,102,241,0.22)'
        ctx.lineWidth = 1.1
        ctx.setLineDash([4, 9])
        ctx.stroke()
        ctx.setLineDash([])

        // Traveling dot
        const prog = ((t * 0.65 + i / LEADS.length) % 1)
        const q = 1 - prog
        const bX = q * q * originX + 2 * q * prog * cpX + prog * prog * dX
        const bY = q * q * originY + 2 * q * prog * cpY + prog * prog * dY

        const dg = ctx.createRadialGradient(bX, bY, 0, bX, bY, 9)
        dg.addColorStop(0, 'rgba(160,140,255,0.85)')
        dg.addColorStop(1, 'rgba(99,102,241,0)')
        ctx.beginPath()
        ctx.arc(bX, bY, 9, 0, Math.PI * 2)
        ctx.fillStyle = dg
        ctx.fill()

        ctx.beginPath()
        ctx.arc(bX, bY, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = '#d4d8ff'
        ctx.fill()

        // Destination node
        ctx.beginPath()
        ctx.arc(dX, dY, 4.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(99,102,241,0.65)'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(dX, dY, 8, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(99,102,241,0.25)'
        ctx.lineWidth = 1
        ctx.stroke()
      })

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="relative w-full h-screen bg-[#03050d] overflow-hidden select-none">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Wordmark */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
          <ellipse cx="24" cy="24" rx="6"  ry="20" stroke="white" strokeWidth="1.5"/>
          <ellipse cx="24" cy="24" rx="14" ry="20" stroke="white" strokeWidth="1.5"/>
          <ellipse cx="24" cy="24" rx="20" ry="20" stroke="white" strokeWidth="1.5"/>
          <ellipse cx="24" cy="24" rx="20" ry="8"  stroke="white" strokeWidth="1.5"/>
          <line x1="4" y1="24" x2="44" y2="24"    stroke="white" strokeWidth="1.5"/>
        </svg>
        <span className="text-white/90 text-sm font-semibold tracking-wide">Meridian</span>
        <span className="text-white/30 text-[11px] font-normal tracking-widest uppercase ml-0.5">Prospects</span>
      </div>

      {/* Lead cards */}
      {LEADS.map(lead => (
        <div
          key={lead.id}
          className="absolute z-10"
          style={{ left: `${lead.px * 100}%`, top: `${lead.py * 100}%`, width: 220 }}
        >
          <div
            className={`rounded-xl border border-white/10 bg-black/55 backdrop-blur-sm p-4 shadow-2xl
              transition-all duration-700
              ${visibleCards.has(lead.id) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${lead.color}55, ${lead.color}22)`,
                  border: `1px solid ${lead.color}55`,
                  boxShadow: `0 0 10px ${lead.color}33`,
                }}
              >
                {lead.initials}
              </div>
              <div className="min-w-0">
                <p className="text-white text-[13px] font-semibold leading-tight">{lead.name}</p>
                <p className="text-white/50 text-[11px] leading-tight mt-0.5">{lead.title}</p>
                <p className="text-white/30 text-[11px] leading-tight">{lead.company}</p>
              </div>
            </div>

            {/* Signals */}
            <div className="space-y-1.5 pt-2.5 border-t border-white/[0.07]">
              {lead.signals.map((s, si) => (
                <div key={si} className="flex items-start gap-1.5 text-[11px] text-white/55 leading-tight">
                  <span className="text-[9px] mt-0.5 shrink-0" style={{ color: lead.color }}>
                    {SIG_ICONS[si % SIG_ICONS.length]}
                  </span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Stats bar */}
      <div className="absolute bottom-8 left-7 z-10">
        <div className="flex items-end gap-8 mb-2">
          {[
            { val: '23.8M+', lbl: 'Prospects Analyzed' },
            { val: '178K+',  lbl: 'Signals Detected'   },
            { val: '6.2K+',  lbl: 'High-Intent Targets' },
          ].map(s => (
            <div key={s.lbl}>
              <div className="text-white text-[22px] font-bold leading-none tracking-tight">{s.val}</div>
              <div className="text-white/35 text-[11px] mt-1 leading-none">{s.lbl}</div>
            </div>
          ))}
        </div>
        {coords && (
          <p className="text-white/20 text-[10px] font-mono mt-3">
            📍 {coords} · scanning in real-time
          </p>
        )}
      </div>
    </div>
  )
}
