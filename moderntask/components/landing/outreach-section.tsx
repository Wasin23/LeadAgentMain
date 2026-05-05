'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

const NAMES = [
  ['Sarah Chen', 'ScaleFlow'], ['Marcus Lee', 'Finova'], ['Jade Morris', 'FleetGrid'],
  ['Tom Reyes', 'LayerStack'], ['Nina Patel', 'StitchOps'], ['Lena Kwon', 'Driftwork'],
  ['Alex Park', 'Vantara'], ['Chris Mao', 'Buildbase'], ['Dana Wu', 'Corepath'],
  ['Sam Ellis', 'Ironveil'], ['Priya Nair', 'Stacklane'], ['Jordan Hill', 'Novafront'],
  ['Riley Stone', 'Crestmark'], ['Casey Liu', 'Pulsedata'], ['Morgan West', 'Gridpoint'],
  ['Taylor Yoon', 'Driftco'], ['Quinn Blake', 'Arcflow'], ['Drew Shin', 'Basecamp'],
]

type PulseKind = 'send' | 'followup' | 'reply'
type Pulse = { ax: number; ay: number; bx: number; by: number; t: number; kind: PulseKind }
type Node  = { x: number; y: number; z: number; name: string; co: string; color: [number,number,number] }

const SEND_COLOR   = [99,  102, 241] as [number,number,number]
const FOLLOW_COLOR = [148, 163, 248] as [number,number,number]
const REPLY_COLOR  = [74,  222, 128] as [number,number,number]

function spawnNode(zOverride?: number): Node {
  const [name, co] = NAMES[Math.floor(Math.random() * NAMES.length)]
  return {
    x: (Math.random() - 0.5) * 860,
    y: (Math.random() - 0.5) * 560,
    z: zOverride ?? 900 + Math.random() * 300,
    name, co,
    color: SEND_COLOR,
  }
}

function NetworkViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dpr = window.devicePixelRatio || 1
    const setSize = () => {
      dpr = window.devicePixelRatio || 1
      canvas.width  = canvas.offsetWidth  * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    setSize()
    window.addEventListener('resize', setSize)

    const W = () => canvas.offsetWidth
    const H = () => canvas.offsetHeight
    const FOCAL = 400
    const SPEED = 1.0

    let nodes: Node[] = []
    let pulses: Pulse[] = []
    let frameN = 0

    for (let i = 0; i < 22; i++) nodes.push(spawnNode(80 + Math.random() * 820))

    const proj = (n: Node): [number, number, number] => {
      const s = FOCAL / n.z
      return [W() / 2 + n.x * s, H() / 2 + n.y * s, s]
    }

    const hubX = () => W() * 0.15
    const hubY = () => H() * 0.5

    const spawnPulse = () => {
      if (pulses.length >= 7) return
      const visible = nodes.filter(n => n.z > 80 && n.z < 480)
      if (!visible.length) return
      const target = visible[Math.floor(Math.random() * visible.length)]
      const [tx, ty] = proj(target)
      const hx = hubX(), hy = hubY()

      // weight replies less often
      const roll = Math.random()
      const kind: PulseKind = roll < 0.45 ? 'send' : roll < 0.75 ? 'followup' : 'reply'

      if (kind === 'reply') {
        pulses.push({ ax: tx, ay: ty, bx: hx, by: hy, t: 0, kind })
      } else {
        pulses.push({ ax: hx, ay: hy, bx: tx, by: ty, t: 0, kind })
      }
    }

    const pulseColor = (kind: PulseKind): [number,number,number] =>
      kind === 'reply' ? REPLY_COLOR : kind === 'followup' ? FOLLOW_COLOR : SEND_COLOR

    const drawHub = () => {
      const hx = hubX(), hy = hubY()

      // outer glow
      const grd = ctx.createRadialGradient(hx, hy, 0, hx, hy, 38)
      grd.addColorStop(0, 'rgba(99,102,241,0.18)')
      grd.addColorStop(1, 'rgba(99,102,241,0)')
      ctx.beginPath()
      ctx.arc(hx, hy, 38, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()

      // ring
      ctx.beginPath()
      ctx.arc(hx, hy, 14, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(99,102,241,0.7)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // fill
      ctx.beginPath()
      ctx.arc(hx, hy, 14, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(14,20,60,0.95)'
      ctx.fill()

      // envelope icon (simple lines)
      ctx.strokeStyle = 'rgba(165,180,252,0.9)'
      ctx.lineWidth = 1.2
      const ex = hx - 7, ey = hy - 4.5
      ctx.strokeRect(ex, ey, 14, 9)
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(hx, hy + 1)
      ctx.lineTo(ex + 14, ey)
      ctx.stroke()

      // label
      ctx.font = '500 10px Inter, sans-serif'
      ctx.fillStyle = 'rgba(165,180,252,0.55)'
      ctx.textAlign = 'center'
      ctx.fillText('Your inbox', hx, hy + 26)
      ctx.textAlign = 'left'
    }

    let raf: number
    const draw = () => {
      const w = W(), h = H()
      ctx.clearRect(0, 0, w, h)
      frameN++

      nodes.forEach(n => { n.z -= SPEED })
      nodes = nodes.filter(n => n.z > 20)
      while (nodes.length < 22) nodes.push(spawnNode())

      if (frameN % 48 === 0) spawnPulse()

      pulses.forEach(p => { p.t += 0.014 })
      pulses = pulses.filter(p => p.t < 1)

      const sorted = [...nodes].sort((a, b) => b.z - a.z)

      // lines between close nodes
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const a = sorted[i], b = sorted[j]
          const dx = a.x-b.x, dy = a.y-b.y, dz = a.z-b.z
          const d3 = Math.sqrt(dx*dx+dy*dy+dz*dz)
          if (d3 > 360) continue
          const [ax, ay, as_] = proj(a)
          const [bx, by, bs]  = proj(b)
          const fade = Math.min(as_, bs)
          const alpha = (1 - d3/360) * Math.min(fade * 0.65, 0.28) * Math.min(1, (900 - a.z)/180)
          if (alpha < 0.01) continue
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.strokeStyle = `rgba(99,102,241,${alpha})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }

      // pulses
      pulses.forEach(p => {
        const e = p.t < 0.5 ? 2*p.t*p.t : 1-2*(1-p.t)*(1-p.t)
        const x = p.ax + (p.bx - p.ax) * e
        const y = p.ay + (p.by - p.ay) * e
        const fade = p.t < 0.12 ? p.t/0.12 : p.t > 0.88 ? (1-p.t)/0.12 : 1
        const [r,g,b] = pulseColor(p.kind)
        // trail
        const tx0 = p.ax + (p.bx-p.ax) * Math.max(0, e - 0.1)
        const ty0 = p.ay + (p.by-p.ay) * Math.max(0, e - 0.1)
        ctx.beginPath()
        ctx.moveTo(tx0, ty0)
        ctx.lineTo(x, y)
        ctx.strokeStyle = `rgba(${r},${g},${b},${fade * 0.45})`
        ctx.lineWidth = 1.3
        ctx.stroke()
        // dot
        ctx.beginPath()
        ctx.arc(x, y, 2.8, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${fade})`
        ctx.fill()
      })

      // nodes
      sorted.forEach(n => {
        const [sx, sy, scale] = proj(n)
        if (sx < -80 || sx > w+80 || sy < -80 || sy > h+80) return
        const alpha = Math.min(1, (900 - n.z) / 200)
        if (alpha < 0.02) return
        const r_ = Math.max(2.5, scale * 7)

        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r_*3)
        grd.addColorStop(0, `rgba(99,102,241,${alpha * 0.22})`)
        grd.addColorStop(1, 'rgba(99,102,241,0)')
        ctx.beginPath()
        ctx.arc(sx, sy, r_*3, 0, Math.PI*2)
        ctx.fillStyle = grd
        ctx.fill()

        ctx.beginPath()
        ctx.arc(sx, sy, r_, 0, Math.PI*2)
        ctx.fillStyle = `rgba(129,140,248,${alpha})`
        ctx.fill()

        if (scale > 0.26 && alpha > 0.2) {
          const fs = Math.min(12, Math.max(8, scale * 11))
          ctx.font = `600 ${fs}px Inter, sans-serif`
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.82})`
          ctx.fillText(n.name, sx + r_ + 5, sy + 1)
          ctx.font = `${fs-1}px Inter, sans-serif`
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.32})`
          ctx.fillText(n.co, sx + r_ + 5, sy + fs + 2)
        }
      })

      // hub always on top
      drawHub()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', setSize)
    }
  }, [])

  return (
    <div className="relative rounded-2xl border border-white/[0.1] bg-[#04060f] overflow-hidden shadow-2xl shadow-black/60 w-full" style={{ height: 420 }}>
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06] absolute top-0 left-0 right-0 z-10 bg-[#04060f]">
        <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
        <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
        <div className="w-2 h-2 rounded-full bg-[#28c840]" />
        <span className="ml-2 text-[10px] text-white/20 font-mono">outreach · live</span>
      </div>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ top: 32 }} />
    </div>
  )
}

export function OutreachSection() {
  return (
    <section className="relative z-10 py-28 px-6">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row items-center gap-16">

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
          <Link href="/signin" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all hover:scale-105">
            Start free
          </Link>
        </div>

        <div className="flex-1 w-full min-w-0">
          <NetworkViz />
        </div>

      </div>
    </section>
  )
}
