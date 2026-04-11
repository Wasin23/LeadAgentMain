'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';

function WireframeGlobe() {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.004;
      groupRef.current.rotation.x += 0.001;
    }
  });
  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.18} wireframe />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.02, 32, 32]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.04} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

export function GlobeHero() {
  return (
    <div className="relative w-full h-screen bg-[#030307] overflow-hidden flex flex-col items-center justify-center">
      {/* glow blobs */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl animate-pulse pointer-events-none" />

      {/* Three.js canvas */}
      <div className="absolute inset-0 pointer-events-none">
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={75} />
          <ambientLight intensity={0.3} />
          <pointLight position={[5, 5, 5]} intensity={1.2} color="#818cf8" />
          <WireframeGlobe />
        </Canvas>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center space-y-10 px-6 max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 backdrop-blur-xl">
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping" />
          <span className="text-sm font-bold text-indigo-400 tracking-widest uppercase">AI Outreach Platform</span>
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
        </div>

        {/* Headline */}
        <div className="space-y-1">
          <div className="text-5xl md:text-7xl font-light text-white/50 tracking-tight">Your AI outreach team.</div>
          <div className="text-6xl md:text-8xl font-black tracking-tighter bg-gradient-to-br from-indigo-300 via-white to-indigo-400 bg-clip-text text-transparent leading-none">
            Runs 24/7.
          </div>
        </div>

        <p className="text-xl text-white/40 max-w-2xl mx-auto leading-relaxed">
          Agents that research leads, write hyper-personalized emails, and send from your real inbox — automatically.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signin"
            className="group flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-2xl shadow-indigo-500/25"
          >
            Start free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <button className="flex items-center justify-center gap-2 px-8 py-4 border border-white/10 hover:border-indigo-500/50 bg-white/5 backdrop-blur text-white rounded-xl font-semibold text-lg transition-all hover:scale-105">
            <Zap className="w-5 h-5 text-indigo-400" /> See it in action
          </button>
        </div>
      </div>
    </div>
  );
}
