'use client'

import { memo, useEffect, useRef } from 'react'

const GlobeBackground = memo(function GlobeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
      } else {
        raf = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      t += 0.001
      ctx.clearRect(0, 0, W, H)

      // bg — solid deep blue
      const bg = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.5, H * 1.2)
      bg.addColorStop(0, '#0a1e3d')
      bg.addColorStop(0.5, '#060f22')
      bg.addColorStop(1, '#020810')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // -- GLOBE --
      const cx = W * 0.28
      const cy = H * 0.90
      const R = Math.max(W, H) * 0.60

      const TILT = 40 * Math.PI / 180
      const cosA = Math.cos(TILT)
      const sinA = Math.sin(TILT)
      const proj = (x3: number, y3: number): [number, number] => [
        cx + R * (x3 * cosA - y3 * sinA),
        cy - R * (x3 * sinA + y3 * cosA),
      ]

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()

      const body = ctx.createRadialGradient(cx + R * 0.20, cy - R * 0.35, R * 0.05, cx, cy, R)
      body.addColorStop(0, '#1e4898')
      body.addColorStop(0.25, '#122d6a')
      body.addColorStop(0.55, '#0a1c44')
      body.addColorStop(1, '#040c1e')
      ctx.fillStyle = body
      ctx.fillRect(cx - R - 2, cy - R - 2, R * 2 + 4, R * 2 + 4)

      // latitude lines
      const LAT_COUNT = 11
      const sinMax = Math.sin(70 * Math.PI / 180)
      const lats = Array.from({ length: LAT_COUNT }, (_, i) => {
        const s = -sinMax + (i / (LAT_COUNT - 1)) * 2 * sinMax
        return Math.asin(s) * 180 / Math.PI
      })
      for (const deg of lats) {
        const lat = (deg * Math.PI) / 180
        const cosLat = Math.cos(lat)
        const sinLat = Math.sin(lat)
        for (let pass = 0; pass < 2; pass++) {
          const aStart = pass === 0 ? Math.PI / 2 : -Math.PI / 2
          const aEnd = pass === 0 ? Math.PI * 3 / 2 : Math.PI / 2
          ctx.beginPath()
          const steps = 48
          for (let k = 0; k <= steps; k++) {
            const alpha = aStart + (aEnd - aStart) * (k / steps)
            const [sx, sy] = proj(cosLat * Math.sin(alpha), sinLat)
            k === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
          }
          ctx.strokeStyle = pass === 0 ? 'rgba(100,180,255,0.07)' : 'rgba(100,180,255,0.28)'
          ctx.lineWidth = pass === 0 ? 0.7 : 1.1
          ctx.stroke()
        }
      }

      // meridian lines
      const NUM = 24
      const SEGS = 64
      for (let i = 0; i < NUM; i++) {
        const theta = (i / NUM) * Math.PI * 2 + t
        const sinT = Math.sin(theta)
        const cosT = Math.cos(theta)
        const isFront = cosT > 0
        const alpha = isFront ? 0.14 + 0.56 * Math.abs(sinT) : 0.04 + 0.06 * Math.abs(sinT)
        ctx.beginPath()
        for (let j = 0; j <= SEGS; j++) {
          const phi = (j / SEGS) * Math.PI - Math.PI / 2
          const [sx, sy] = proj(Math.cos(phi) * sinT, Math.sin(phi))
          j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)
        }
        ctx.strokeStyle = `rgba(100,180,255,${alpha})`
        ctx.lineWidth = isFront ? 1.0 + 1.1 * Math.abs(sinT) : 0.5
        ctx.stroke()
      }

      ctx.restore()

      // atmosphere glow
      const atmo = ctx.createRadialGradient(cx, cy, R * 0.94, cx, cy, R * 1.06)
      atmo.addColorStop(0, 'rgba(60,130,255,0)')
      atmo.addColorStop(0.4, 'rgba(80,165,255,0.30)')
      atmo.addColorStop(1, 'rgba(40,100,255,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.06, 0, Math.PI * 2)
      ctx.fillStyle = atmo
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
})

export default GlobeBackground
