'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export function HorizonHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  const smoothCameraPos = useRef({ x: 0, y: 30, z: 300 });
  const targetCamera = useRef({ x: 0, y: 30, z: 300 });

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03050d, 0.00025);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 30, 300);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.6;

    const starLayers: THREE.Points[] = [];
    for (let i = 0; i < 3; i++) {
      const count = 4000;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      for (let j = 0; j < count; j++) {
        const r = 200 + Math.random() * 800;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        pos[j * 3]     = r * Math.sin(phi) * Math.cos(theta);
        pos[j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[j * 3 + 2] = r * Math.cos(phi);
        const c = new THREE.Color();
        const rnd = Math.random();
        if (rnd < 0.7)       c.setHSL(0, 0, 0.8 + Math.random() * 0.2);
        else if (rnd < 0.85) c.setHSL(0.67, 0.6, 0.75);
        else                 c.setHSL(0.8,  0.5, 0.75);
        col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b;
        sizes[j] = Math.random() * 2 + 0.5;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
      geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, depth: { value: i } },
        vertexShader: `
          attribute float size; attribute vec3 color; varying vec3 vColor;
          uniform float time; uniform float depth;
          void main() {
            vColor = color;
            vec3 p = position;
            float a = time * 0.04 * (1.0 - depth * 0.3);
            mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
            p.xy = rot * p.xy;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = size * (300.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            gl_FragColor = vec4(vColor, 1.0 - smoothstep(0.0, 0.5, d));
          }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      scene.add(points);
      starLayers.push(points);
    }

    const nebGeo = new THREE.PlaneGeometry(6000, 3000, 60, 60);
    const nebMat = new THREE.ShaderMaterial({
      uniforms: {
        time:   { value: 0 },
        color1: { value: new THREE.Color(0x1a0066) },
        color2: { value: new THREE.Color(0x4400aa) },
      },
      vertexShader: `
        varying vec2 vUv; uniform float time;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z += sin(p.x * 0.008 + time) * cos(p.y * 0.008 + time) * 15.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 color1; uniform vec3 color2; uniform float time;
        varying vec2 vUv;
        void main() {
          float m = sin(vUv.x * 8.0 + time) * cos(vUv.y * 8.0 + time);
          vec3 col = mix(color1, color2, m * 0.5 + 0.5);
          float a = 0.25 * (1.0 - length(vUv - 0.5) * 2.0);
          gl_FragColor = vec4(col, max(a, 0.0));
        }`,
      transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    });
    const nebula = new THREE.Mesh(nebGeo, nebMat);
    nebula.position.z = -800;
    scene.add(nebula);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = Date.now() * 0.001;
      starLayers.forEach(s => { (s.material as THREE.ShaderMaterial).uniforms.time.value = t; });
      (nebMat as THREE.ShaderMaterial).uniforms.time.value = t * 0.4;

      const sf = 0.05;
      smoothCameraPos.current.x += (targetCamera.current.x - smoothCameraPos.current.x) * sf;
      smoothCameraPos.current.y += (targetCamera.current.y - smoothCameraPos.current.y) * sf;
      smoothCameraPos.current.z += (targetCamera.current.z - smoothCameraPos.current.z) * sf;

      camera.position.set(
        smoothCameraPos.current.x + Math.sin(t * 0.1) * 2,
        smoothCameraPos.current.y + Math.cos(t * 0.15) * 1,
        smoothCameraPos.current.z,
      );
      camera.lookAt(0, 10, -400);
      renderer.render(scene, camera);
    };
    animate();
    setIsReady(true);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      starLayers.forEach(s => { s.geometry.dispose(); (s.material as THREE.Material).dispose(); });
      nebGeo.dispose(); nebMat.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min(scrollY / Math.max(maxScroll, 1), 1);
      const positions = [
        { x: 0, y: 30, z: 300 },
        { x: 0, y: 40, z: -50 },
        { x: 0, y: 50, z: -600 },
      ];
      const section = Math.min(Math.floor(progress * 2), 1);
      const sp = (progress * 2) % 1;
      const cur = positions[section];
      const nxt = positions[section + 1] || cur;
      targetCamera.current.x = cur.x + (nxt.x - cur.x) * sp;
      targetCamera.current.y = cur.y + (nxt.y - cur.y) * sp;
      targetCamera.current.z = cur.z + (nxt.z - cur.z) * sp;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isReady || !titleRef.current || !subtitleRef.current) return;
    const tl = gsap.timeline();
    tl.from(titleRef.current.querySelectorAll('.char'), {
      y: 120, opacity: 0, duration: 1.2, stagger: 0.04, ease: 'power4.out',
    }).from(subtitleRef.current.querySelectorAll('.line'), {
      y: 40, opacity: 0, duration: 0.9, stagger: 0.15, ease: 'power3.out',
    }, '-=0.6');
    return () => { tl.kill(); };
  }, [isReady]);

  const words = ['Meridian', 'runs', '24/7.'];

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden bg-[#03050d]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center px-6">
        <h1 ref={titleRef} className="overflow-hidden mb-6">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {words.map((word, wi) => (
              <span key={wi} className="overflow-hidden inline-block">
                {word.split('').map((ch, ci) => (
                  <span key={ci} className="char inline-block text-6xl md:text-8xl font-black tracking-tight text-white">
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </h1>
        <div ref={subtitleRef} className="space-y-2 mb-10">
          <p className="line text-xl text-white/50 max-w-xl">
            AI agents that research leads and write personalized emails
          </p>
          <p className="line text-xl text-white/50 max-w-xl">
            — sent from your own inbox, automatically.
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/signin" className="group flex items-center gap-2 px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-white/90 transition-all hover:scale-105">
            Start free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <button className="px-8 py-4 border border-white/20 hover:border-white/50 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 backdrop-blur-sm bg-white/5">
            Learn More
          </button>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-xs tracking-widest uppercase">
        <span>Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </div>
  );
}
