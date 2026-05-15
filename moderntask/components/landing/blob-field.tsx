'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// [baseX, baseY, initRadius]
const INIT: [number, number, number][] = [
  [0.18, 0.75, 0.32],
  [0.82, 0.25, 0.30],
  [0.55, 0.58, 0.28],
  [0.76, 0.82, 0.26],
  [0.24, 0.28, 0.27],
  [0.62, 0.10, 0.24],
  [0.10, 0.50, 0.22],
]
const N      = INIT.length
const SPEED  = [0.10, 0.07, 0.09, 0.08, 0.11, 0.06, 0.13]
const ORBIT  = [0.18, 0.16, 0.13, 0.15, 0.14, 0.17, 0.12]
const PHASE  = [0.00, 1.30, 2.50, 0.75, 1.90, 3.20, 4.10]
const MAX_R  = 0.44   // cap on how large an absorbing blob can grow
const ABS_AT = 0.72   // fraction of combined radii at which absorption triggers

const PALETTES: [number, number, number][][] = [
  [[0.58,0.22,0.96],[0.18,0.52,0.98],[0.96,0.28,0.62],[0.04,0.76,0.76],[0.42,0.28,0.96],[0.96,0.64,0.14],[0.72,0.42,0.98]],
  [[0.14,0.46,0.96],[0.02,0.78,0.90],[0.22,0.62,0.98],[0.04,0.68,0.92],[0.40,0.50,0.96],[0.02,0.82,0.80],[0.06,0.40,0.90]],
  [[0.04,0.74,0.66],[0.08,0.78,0.40],[0.02,0.80,0.90],[0.18,0.94,0.70],[0.02,0.66,0.46],[0.18,0.74,0.96],[0.10,0.88,0.72]],
  [[0.96,0.36,0.24],[0.96,0.24,0.62],[0.96,0.66,0.08],[0.96,0.48,0.12],[0.92,0.16,0.48],[0.90,0.82,0.04],[0.98,0.58,0.38]],
  [[0.08,0.74,0.40],[0.48,0.90,0.14],[0.04,0.74,0.66],[0.36,0.78,0.44],[0.02,0.66,0.36],[0.22,0.90,0.62],[0.44,0.76,0.30]],
  [[0.56,0.18,0.96],[0.96,0.22,0.66],[0.44,0.10,0.88],[0.92,0.16,0.74],[0.88,0.28,0.52],[0.66,0.40,0.96],[0.80,0.10,0.92]],
  [[0.30,0.28,0.96],[0.14,0.46,0.96],[0.56,0.18,0.96],[0.36,0.50,0.96],[0.14,0.62,0.98],[0.08,0.28,0.88],[0.46,0.22,0.96]],
  [[0.14,0.46,0.96],[0.04,0.74,0.74],[0.24,0.60,0.96],[0.08,0.78,0.90],[0.32,0.56,0.96],[0.06,0.82,0.78],[0.06,0.40,0.90]],
  [[0.42,0.54,0.82],[0.34,0.62,0.86],[0.50,0.58,0.82],[0.38,0.68,0.86],[0.46,0.58,0.82],[0.30,0.54,0.82],[0.54,0.62,0.86]],
]

const vert = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const frag = /* glsl */`
precision highp float;
#define N ${N}
varying vec2 vUv;
uniform vec3  u_blobs[N];
uniform vec3  u_colors[N];
uniform vec2  u_res;
uniform float u_time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {
  return 0.500*vnoise(p)
       + 0.250*vnoise(p*2.1+vec2(1.7,9.2))
       + 0.125*vnoise(p*4.3+vec2(8.3,2.8));
}

float blobW(vec2 uv, vec2 center, float radius) {
  if (radius < 0.005) return 0.0;
  float d = distance(uv, center);
  float n = (fbm(uv*3.2 + center*2.0 + u_time*0.07) - 0.5) * 0.36 * radius;
  float t = 1.0 - clamp(d / max(radius + n, 0.005), 0.0, 1.0);
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

void main() {
  vec2 uv = vUv;
  float asp = u_res.x / u_res.y;
  uv.x *= asp;

  vec3  wCol = vec3(0.0);
  float wSum = 0.0;

  for (int i = 0; i < N; i++) {
    float w = blobW(uv, vec2(u_blobs[i].x*asp, u_blobs[i].y), u_blobs[i].z);
    wCol += u_colors[i] * w;
    wSum += w;
  }

  vec3 blended = wSum > 0.001 ? wCol / wSum : vec3(1.0);
  float cov = smoothstep(0.0, 0.50, wSum);
  // White background, vivid blobs
  gl_FragColor = vec4(mix(vec3(1.0), blended, cov * 0.94), 1.0);
}`

export function BlobField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    renderer.setPixelRatio(1)
    renderer.setSize(window.innerWidth, window.innerHeight)

    const scene  = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const blobVec  = INIT.map(([x, y, r]) => new THREE.Vector3(x, y, r))
    const colorVec = PALETTES[0].map(([r, g, b]) => new THREE.Color(r, g, b))

    const uniforms = {
      u_blobs:  { value: blobVec },
      u_colors: { value: colorVec },
      u_res:    { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_time:   { value: 0 },
    }

    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms }),
    ))

    // ── per-blob mutable state ────────────────────────────────────────────────
    const states = INIT.map(([x, y, r]) => ({
      baseX: x, baseY: y,
      curX: x, curY: y,
      curR: r, targetR: r, initR: r,
      absorbing: false,
    }))

    // colour lerp state
    const cur = PALETTES[0].map(c => [...c] as [number, number, number])
    const tgt = PALETTES[0].map(c => [...c] as [number, number, number])

    const onStep = (e: Event) => {
      const step = (e as CustomEvent).detail.step as number
      const pal  = PALETTES[Math.min(step, PALETTES.length - 1)]
      for (let i = 0; i < N; i++) tgt[i] = [...pal[i]]
    }
    window.addEventListener('carousel-step', onStep)

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      uniforms.u_res.value.set(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    let raf: number
    let t = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      t += 0.004
      uniforms.u_time.value = t

      const asp = window.innerWidth / window.innerHeight

      // ── update orbital positions ──────────────────────────────────────────
      for (let i = 0; i < N; i++) {
        states[i].curX = states[i].baseX + Math.sin(t * SPEED[i] + PHASE[i]) * ORBIT[i]
        states[i].curY = states[i].baseY + Math.cos(t * SPEED[i] * 0.65 + PHASE[i] * 1.4) * ORBIT[i] * 0.75
      }

      // ── collision / absorption ────────────────────────────────────────────
      for (let i = 0; i < N; i++) {
        if (states[i].absorbing || states[i].curR < 0.02) continue
        for (let j = i + 1; j < N; j++) {
          if (states[j].absorbing || states[j].curR < 0.02) continue

          const dx   = (states[i].curX - states[j].curX) * asp
          const dy   = states[i].curY - states[j].curY
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < (states[i].curR + states[j].curR) * ABS_AT) {
            const big = states[i].curR >= states[j].curR ? i : j
            const sml = big === i ? j : i
            states[sml].absorbing = true
            states[sml].targetR   = 0
            // big blob grows modestly
            states[big].targetR   = Math.min(MAX_R, states[big].curR + states[sml].initR * 0.35)
          }
        }
      }

      // ── radius lerp + respawn ─────────────────────────────────────────────
      for (let i = 0; i < N; i++) {
        const speed = states[i].absorbing ? 0.030 : 0.012
        states[i].curR += (states[i].targetR - states[i].curR) * speed

        // absorbed blob: pull its orbit centre toward the absorber for visual suck-in
        if (states[i].absorbing) {
          let nearestBig = -1, nearestDist = Infinity
          for (let j = 0; j < N; j++) {
            if (j === i || states[j].absorbing) continue
            const dx = (states[j].curX - states[i].curX) * asp
            const dy = states[j].curY - states[i].curY
            const d  = Math.sqrt(dx * dx + dy * dy)
            if (d < nearestDist) { nearestDist = d; nearestBig = j }
          }
          if (nearestBig >= 0) {
            states[i].baseX += (states[nearestBig].curX - states[i].baseX) * 0.04
            states[i].baseY += (states[nearestBig].curY - states[i].baseY) * 0.04
          }
        }

        // fully absorbed — respawn off-screen and grow back
        if (states[i].absorbing && states[i].curR < 0.012) {
          // pick a random edge to spawn from
          const edge = Math.floor(Math.random() * 4)
          if (edge === 0) { states[i].baseX = -0.15; states[i].baseY = Math.random() }
          else if (edge === 1) { states[i].baseX = 1.15; states[i].baseY = Math.random() }
          else if (edge === 2) { states[i].baseX = Math.random(); states[i].baseY = -0.15 }
          else                 { states[i].baseX = Math.random(); states[i].baseY = 1.15 }
          states[i].curR      = 0.01
          states[i].targetR   = states[i].initR
          states[i].absorbing = false
        }

        // push shader uniforms
        uniforms.u_blobs.value[i].set(states[i].curX, states[i].curY, states[i].curR)

        // colour lerp
        for (let c = 0; c < 3; c++) cur[i][c] += (tgt[i][c] - cur[i][c]) * 0.018
        uniforms.u_colors.value[i].setRGB(cur[i][0], cur[i][1], cur[i][2])
      }

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('carousel-step', onStep)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  )
}
