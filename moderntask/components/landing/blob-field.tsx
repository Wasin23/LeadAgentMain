'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Each blob: [cx, cy, rx, ry, rotation_rad]
// coords in 0-1 uv space; radii are relative to canvas height
const INIT = [
  [0.30, 0.62, 0.58, 0.38, -0.40],
  [0.74, 0.36, 0.52, 0.34,  0.55],
  [0.18, 0.32, 0.44, 0.30, -0.20],
  [0.65, 0.78, 0.48, 0.32,  0.28],
  [0.88, 0.62, 0.38, 0.26, -0.15],
]
const N = INIT.length
const DRIFT_SPEED  = [0.06, 0.05, 0.07, 0.04, 0.08]
const DRIFT_RADIUS = [0.08, 0.07, 0.09, 0.06, 0.07]
const DRIFT_PHASE  = [0.00, 1.30, 2.50, 0.80, 3.80]
const MORPH_SPEED  = [0.12, 0.09, 0.11, 0.08, 0.13]

// Per-section palettes: [brightSurface, darkShadow] per blob
const PALETTES: Array<[[number,number,number],[number,number,number]][]> = [
  // 0 Hero — electric greens & lime
  [[[0.45,0.92,0.08],[0.08,0.40,0.06]],[[0.12,0.78,0.22],[0.04,0.32,0.10]],[[0.00,0.72,0.60],[0.00,0.28,0.28]],[[0.70,0.95,0.04],[0.22,0.48,0.02]],[[0.10,0.60,0.42],[0.02,0.24,0.18]]],
  // 1 Agents — violet & cobalt
  [[[0.62,0.28,0.98],[0.24,0.06,0.58]],[[0.22,0.44,0.98],[0.06,0.14,0.58]],[[0.78,0.18,0.88],[0.36,0.04,0.50]],[[0.38,0.58,0.98],[0.12,0.18,0.58]],[[0.52,0.12,0.80],[0.20,0.02,0.44]]],
  // 2 AI Research — teal & cyan
  [[[0.04,0.82,0.78],[0.00,0.34,0.38]],[[0.18,0.92,0.62],[0.04,0.40,0.24]],[[0.00,0.70,0.90],[0.00,0.28,0.44]],[[0.10,0.88,0.72],[0.02,0.38,0.32]],[[0.00,0.62,0.82],[0.00,0.24,0.40]]],
  // 3 Outreach — coral, amber, pink
  [[[0.98,0.44,0.18],[0.58,0.14,0.04]],[[0.98,0.22,0.54],[0.58,0.06,0.22]],[[0.96,0.72,0.08],[0.56,0.32,0.02]],[[0.98,0.34,0.30],[0.58,0.10,0.10]],[[0.92,0.54,0.12],[0.50,0.20,0.02]]],
  // 4 CRM — emerald & lime
  [[[0.10,0.82,0.40],[0.02,0.36,0.14]],[[0.52,0.96,0.18],[0.18,0.48,0.04]],[[0.02,0.72,0.56],[0.00,0.30,0.22]],[[0.38,0.88,0.28],[0.12,0.42,0.08]],[[0.08,0.64,0.44],[0.02,0.26,0.16]]],
  // 5 Teams — violet, magenta, fuchsia
  [[[0.72,0.18,0.98],[0.32,0.04,0.50]],[[0.98,0.18,0.72],[0.50,0.04,0.32]],[[0.52,0.08,0.92],[0.22,0.02,0.46]],[[0.92,0.10,0.82],[0.44,0.02,0.38]],[[0.80,0.24,0.98],[0.36,0.06,0.50]]],
  // 6 Pricing — royal blue & periwinkle
  [[[0.28,0.38,0.98],[0.08,0.12,0.56]],[[0.52,0.58,0.98],[0.18,0.22,0.58]],[[0.18,0.28,0.92],[0.04,0.08,0.52]],[[0.62,0.68,0.98],[0.22,0.26,0.56]],[[0.38,0.44,0.96],[0.12,0.14,0.52]]],
  // 7 FAQ — sky & aqua
  [[[0.18,0.62,0.98],[0.04,0.22,0.54]],[[0.04,0.82,0.90],[0.00,0.34,0.44]],[[0.28,0.72,0.98],[0.08,0.26,0.54]],[[0.08,0.90,0.80],[0.00,0.38,0.36]],[[0.22,0.58,0.94],[0.06,0.20,0.50]]],
  // 8 Footer — muted blue-greens
  [[[0.22,0.52,0.72],[0.08,0.20,0.36]],[[0.18,0.60,0.80],[0.06,0.24,0.40]],[[0.26,0.58,0.70],[0.10,0.22,0.34]],[[0.20,0.54,0.76],[0.06,0.20,0.38]],[[0.24,0.56,0.74],[0.08,0.22,0.36]]],
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
uniform vec2  u_res;
uniform float u_time;
// per blob: xy=center(0-1), z=rotation
uniform vec3  u_pos[N];
// per blob: xy=radii, z=morph_phase
uniform vec3  u_rad[N];
// per blob: surface bright colour
uniform vec3  u_bright[N];
// per blob: shadow deep colour
uniform vec3  u_dark[N];

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){
  return .500*vnoise(p)
        +.250*vnoise(p*2.1+vec2(1.7,9.2))
        +.125*vnoise(p*4.3+vec2(8.3,2.8))
        +.062*vnoise(p*8.7+vec2(3.1,5.6));
}

// Rotated + polar-harmonic + FBM ellipse SDF (aspect-corrected space)
float blobSDF(vec2 p, int i) {
  float ang = u_pos[i].z;
  float c = cos(ang), s = sin(ang);
  vec2 d = p - vec2(u_pos[i].x * (u_res.x/u_res.y), u_pos[i].y);
  d = vec2(d.x*c+d.y*s, -d.x*s+d.y*c);
  vec2 ab = u_rad[i].xy;
  // base ellipse SDF
  float base = length(d/ab) - 1.0;

  // polar angle from blob centre → harmonic lobes at different frequencies
  float theta = atan(d.y / ab.y, d.x / ab.x);
  float ph = u_rad[i].z;
  float harm = 0.0;
  harm += sin(2.0*theta + ph         + u_time*0.07) * 0.13;
  harm += sin(3.0*theta + ph*1.6     - u_time*0.05) * 0.10;
  harm += cos(4.0*theta + ph*1.2     + u_time*0.06) * 0.07;
  harm += sin(5.0*theta + ph*2.4     + u_time*0.04) * 0.06;
  harm += sin(7.0*theta + ph*0.8     - u_time*0.03) * 0.04;

  // two FBM layers — coarse warp + fine detail
  float n1 = (fbm(p*1.5 + vec2(u_pos[i].x,u_pos[i].y)*2.0 + u_time*0.04 + ph      ) - 0.5) * 0.30;
  float n2 = (fbm(p*3.4 + vec2(u_pos[i].y,u_pos[i].x)*1.5 + u_time*0.03 + ph*0.7  ) - 0.5) * 0.10;

  return base + harm + n1 + n2;
}

void main() {
  vec2 uv  = vUv;
  float asp = u_res.x / u_res.y;
  vec2 uvA = vec2(uv.x * asp, uv.y); // aspect-corrected

  // White background
  vec3 col = vec3(1.0);

  // Render back-to-front so front blobs occlude rear ones
  for (int i = N-1; i >= 0; i--) {
    float sdf = blobSDF(uv, i);
    if (sdf > 0.04) continue;

    float coverage = smoothstep(0.03, -0.005, sdf);

    // depth inside blob (0 = at edge, 1 = deep centre)
    float depth = clamp(-sdf / (u_rad[i].x * 0.55), 0.0, 1.0);
    depth = depth * depth; // steepen so interior stays bright

    // Height within blob (1=top,0=bottom) — simulates top-down light
    vec2  ctr  = vec2(u_pos[i].x * asp, u_pos[i].y);
    float ht   = 1.0 - clamp((uvA.y - (ctr.y - u_rad[i].y * 0.9)) / (u_rad[i].y * 1.8), 0.0, 1.0);

    // Combined brightness: high near top & centre
    float bright = mix(0.0, 1.0, depth * 0.55 + ht * 0.45);
    bright = pow(bright, 1.4); // contrast push

    // Surface colour
    vec3 surf = mix(u_dark[i], u_bright[i], bright);

    // Specular highlight — small bright oval near top of blob
    vec2 hiPos = ctr + vec2(-u_rad[i].x * asp * 0.18, u_rad[i].y * 0.38);
    float hi   = exp(-dot(uvA - hiPos, uvA - hiPos) / (u_rad[i].x * asp * 0.18));
    surf += u_bright[i] * hi * 0.55;

    // Edge rim: subtle brighter outline so blob reads as a 3-D object
    float rim = smoothstep(-0.01, 0.02, sdf) * smoothstep(0.03, 0.0, sdf);
    surf += u_bright[i] * rim * 0.30;

    col = mix(col, surf, coverage);
  }

  gl_FragColor = vec4(col, 1.0);
}`

export function BlobField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(window.innerWidth, window.innerHeight)

    const scene  = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const pal0 = PALETTES[0]
    const uniforms = {
      u_res:    { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_time:   { value: 0 },
      u_pos:    { value: INIT.map(([cx, cy,, , ang]) => new THREE.Vector3(cx, cy, ang ?? 0)) },
      u_rad:    { value: INIT.map(([,, rx, ry], i) => new THREE.Vector3(rx, ry, i * 1.3)) },
      u_bright: { value: pal0.map(([b]) => new THREE.Color(...b)) },
      u_dark:   { value: pal0.map(([, d]) => new THREE.Color(...d)) },
    }

    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms }),
    ))

    // colour lerp buffers
    const curB = pal0.map(([b]) => [...b] as [number,number,number])
    const curD = pal0.map(([,d]) => [...d] as [number,number,number])
    const tgtB = pal0.map(([b]) => [...b] as [number,number,number])
    const tgtD = pal0.map(([,d]) => [...d] as [number,number,number])

    const onStep = (e: Event) => {
      const step = (e as CustomEvent).detail.step as number
      const pal  = PALETTES[Math.min(step, PALETTES.length - 1)]
      for (let i = 0; i < N; i++) {
        tgtB[i] = [...pal[i][0]]
        tgtD[i] = [...pal[i][1]]
      }
    }
    window.addEventListener('carousel-step', onStep)

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      uniforms.u_res.value.set(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    let raf: number, t = 0
    const bases = INIT.map(([cx, cy, rx, ry, ang]) => ({ cx, cy, rx, ry, ang: ang ?? 0 }))

    const tick = () => {
      raf = requestAnimationFrame(tick)
      t += 0.004
      uniforms.u_time.value = t

      for (let i = 0; i < N; i++) {
        const b = bases[i]
        const sp = DRIFT_SPEED[i], ph = DRIFT_PHASE[i], dr = DRIFT_RADIUS[i]
        // slow orbital drift of centre
        uniforms.u_pos.value[i].set(
          b.cx + Math.sin(t * sp + ph) * dr,
          b.cy + Math.cos(t * sp * 0.68 + ph * 1.3) * dr * 0.65,
          b.ang + Math.sin(t * MORPH_SPEED[i] + ph) * 0.18,  // gentle rotation
        )
        // colour lerp
        for (let c = 0; c < 3; c++) {
          curB[i][c] += (tgtB[i][c] - curB[i][c]) * 0.018
          curD[i][c] += (tgtD[i][c] - curD[i][c]) * 0.018
        }
        uniforms.u_bright.value[i].setRGB(curB[i][0], curB[i][1], curB[i][2])
        uniforms.u_dark.value[i].setRGB(curD[i][0], curD[i][1], curD[i][2])
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
