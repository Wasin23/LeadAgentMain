'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DemoPage() {
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [spotlightTarget, setSpotlightTarget] = useState<DOMRect | null>(null);
  
  // Refs for tour targets
  const box1Ref = useRef<HTMLDivElement>(null);
  const box2Ref = useRef<HTMLDivElement>(null);
  const box3Ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const tourSteps = [
    { ref: box1Ref, title: "Welcome!", content: "This is the first step of your guided tour. Notice the spotlight effect.", position: 'right' as const },
    { ref: box2Ref, title: "Feature Two", content: "Elements smoothly transition as you progress through the tour.", position: 'bottom' as const },
    { ref: box3Ref, title: "Another Feature", content: "The tooltip automatically positions itself based on available space.", position: 'left' as const },
    { ref: buttonRef, title: "All Done!", content: "Click here or press 'Finish' to complete the tour.", position: 'top' as const },
  ];

  // Update spotlight position when tour step changes
  useEffect(() => {
    if (showTour && tourSteps[tourStep]?.ref.current) {
      const rect = tourSteps[tourStep].ref.current.getBoundingClientRect();
      setSpotlightTarget(rect);
    }
  }, [tourStep, showTour]);

  const startTour = () => {
    setTourStep(0);
    setShowTour(true);
  };

  const nextStep = () => {
    if (tourStep < tourSteps.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      setShowTour(false);
      setSpotlightTarget(null);
    }
  };

  const prevStep = () => {
    if (tourStep > 0) {
      setTourStep(tourStep - 1);
    }
  };

  // Calculate tooltip position
  const getTooltipStyle = () => {
    if (!spotlightTarget) return {};
    const pos = tourSteps[tourStep]?.position || 'right';
    const padding = 16;
    
    switch (pos) {
      case 'right':
        return { 
          left: spotlightTarget.right + padding, 
          top: spotlightTarget.top + spotlightTarget.height / 2,
          transform: 'translateY(-50%)'
        };
      case 'left':
        return { 
          right: window.innerWidth - spotlightTarget.left + padding,
          top: spotlightTarget.top + spotlightTarget.height / 2,
          transform: 'translateY(-50%)'
        };
      case 'bottom':
        return { 
          left: spotlightTarget.left + spotlightTarget.width / 2, 
          top: spotlightTarget.bottom + padding,
          transform: 'translateX(-50%)'
        };
      case 'top':
        return { 
          left: spotlightTarget.left + spotlightTarget.width / 2, 
          bottom: window.innerHeight - spotlightTarget.top + padding,
          transform: 'translateX(-50%)'
        };
      default:
        return {};
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1628] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Animation Demo</h1>
        <p className="text-[#8FA6C1]">Showcasing Framer Motion capabilities for guided tours</p>
      </div>

      {/* Demo Controls */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={startTour}
          className="px-6 py-3 bg-[#4FD1FF] text-[#0A1628] font-semibold rounded-lg hover:bg-[#7FDFFF] transition-colors"
        >
          🚀 Start Guided Tour
        </button>
        <button
          onClick={() => setActiveDemo(activeDemo === 'spotlight' ? null : 'spotlight')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeDemo === 'spotlight' 
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border border-[#4FD1FF]/40' 
              : 'bg-[#1B2F52]/60 text-[#8FA6C1] border border-[#4FD1FF]/20 hover:bg-[#1B2F52]'
          }`}
        >
          Spotlight Effect
        </button>
        <button
          onClick={() => setActiveDemo(activeDemo === 'tooltips' ? null : 'tooltips')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeDemo === 'tooltips' 
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border border-[#4FD1FF]/40' 
              : 'bg-[#1B2F52]/60 text-[#8FA6C1] border border-[#4FD1FF]/20 hover:bg-[#1B2F52]'
          }`}
        >
          Tooltip Animations
        </button>
        <button
          onClick={() => setActiveDemo(activeDemo === 'sequence' ? null : 'sequence')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeDemo === 'sequence' 
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border border-[#4FD1FF]/40' 
              : 'bg-[#1B2F52]/60 text-[#8FA6C1] border border-[#4FD1FF]/20 hover:bg-[#1B2F52]'
          }`}
        >
          Stagger Sequence
        </button>
        <button
          onClick={() => setActiveDemo(activeDemo === 'pulse' ? null : 'pulse')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            activeDemo === 'pulse' 
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border border-[#4FD1FF]/40' 
              : 'bg-[#1B2F52]/60 text-[#8FA6C1] border border-[#4FD1FF]/20 hover:bg-[#1B2F52]'
          }`}
        >
          Pulse & Glow
        </button>
      </div>

      {/* Demo Grid - Tour Targets */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <motion.div
          ref={box1Ref}
          className="bg-[#1B2F52]/70 backdrop-blur-md border border-[#4FD1FF]/30 rounded-xl p-6 relative"
          whileHover={{ scale: 1.02, borderColor: 'rgba(79, 209, 255, 0.5)' }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="w-12 h-12 bg-gradient-to-br from-[#4FD1FF] to-[#6366F1] rounded-lg mb-4 flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
          <h3 className="text-white font-semibold mb-2">Analytics Dashboard</h3>
          <p className="text-[#8FA6C1] text-sm">View real-time metrics and performance data for your outreach campaigns.</p>
          
          {/* Pulse indicator when demo is active */}
          {activeDemo === 'pulse' && (
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 bg-[#4FD1FF] rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [1, 0.5, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          )}
        </motion.div>

        <motion.div
          ref={box2Ref}
          className="bg-[#1B2F52]/70 backdrop-blur-md border border-[#4FD1FF]/30 rounded-xl p-6 relative"
          whileHover={{ scale: 1.02, borderColor: 'rgba(79, 209, 255, 0.5)' }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="w-12 h-12 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-lg mb-4 flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <h3 className="text-white font-semibold mb-2">Agent Control</h3>
          <p className="text-[#8FA6C1] text-sm">Manage your AI agents, configure settings, and monitor their activity.</p>
          
          {activeDemo === 'pulse' && (
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 bg-[#10B981] rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [1, 0.5, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.3
              }}
            />
          )}
        </motion.div>

        <motion.div
          ref={box3Ref}
          className="bg-[#1B2F52]/70 backdrop-blur-md border border-[#4FD1FF]/30 rounded-xl p-6 relative"
          whileHover={{ scale: 1.02, borderColor: 'rgba(79, 209, 255, 0.5)' }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="w-12 h-12 bg-gradient-to-br from-[#F59E0B] to-[#D97706] rounded-lg mb-4 flex items-center justify-center">
            <span className="text-2xl">📧</span>
          </div>
          <h3 className="text-white font-semibold mb-2">Email Queue</h3>
          <p className="text-[#8FA6C1] text-sm">Review pending emails, manage schedules, and track delivery status.</p>
          
          {activeDemo === 'pulse' && (
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 bg-[#F59E0B] rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [1, 0.5, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.6
              }}
            />
          )}
        </motion.div>
      </div>

      {/* Action Button - Tour Target */}
      <button
        ref={buttonRef}
        className="px-6 py-3 bg-gradient-to-r from-[#4FD1FF] to-[#6366F1] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        Complete Action →
      </button>

      {/* Stagger Sequence Demo */}
      <AnimatePresence>
        {activeDemo === 'sequence' && (
          <motion.div 
            className="mt-8 grid grid-cols-5 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="h-24 bg-gradient-to-br from-[#4FD1FF]/20 to-[#6366F1]/20 border border-[#4FD1FF]/30 rounded-lg flex items-center justify-center"
                initial={{ opacity: 0, y: 30, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -30, scale: 0.8 }}
                transition={{ 
                  delay: i * 0.1,
                  type: 'spring',
                  stiffness: 200,
                  damping: 15
                }}
              >
                <span className="text-2xl font-bold text-[#4FD1FF]">{i + 1}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip Animations Demo */}
      <AnimatePresence>
        {activeDemo === 'tooltips' && (
          <motion.div 
            className="mt-8 flex gap-8 justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Fade + Scale */}
            <div className="relative group">
              <div className="w-20 h-20 bg-[#1B2F52] border border-[#4FD1FF]/30 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#4FD1FF]/60 transition-colors">
                <span className="text-[#8FA6C1]">Hover</span>
              </div>
              <motion.div
                className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-2 bg-[#0A1628] border border-[#4FD1FF]/40 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none"
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                Fade + Scale
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0A1628] border-r border-b border-[#4FD1FF]/40 rotate-45" />
              </motion.div>
            </div>

            {/* Slide from side */}
            <div className="relative group">
              <div className="w-20 h-20 bg-[#1B2F52] border border-[#10B981]/30 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#10B981]/60 transition-colors">
                <span className="text-[#8FA6C1]">Hover</span>
              </div>
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 left-24 px-3 py-2 bg-[#0A1628] border border-[#10B981]/40 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                Slide from left
                <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-[#0A1628] border-l border-b border-[#10B981]/40 rotate-45" />
              </motion.div>
            </div>

            {/* Bounce */}
            <div className="relative group">
              <div className="w-20 h-20 bg-[#1B2F52] border border-[#F59E0B]/30 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#F59E0B]/60 transition-colors">
                <span className="text-[#8FA6C1]">Hover</span>
              </div>
              <motion.div
                className="absolute -bottom-14 left-1/2 -translate-x-1/2 px-3 py-2 bg-[#0A1628] border border-[#F59E0B]/40 rounded-lg text-sm text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none"
                initial={{ opacity: 0, y: -20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                Bouncy!
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0A1628] border-l border-t border-[#F59E0B]/40 rotate-45" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spotlight Effect Demo */}
      <AnimatePresence>
        {activeDemo === 'spotlight' && (
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveDemo(null)}
          >
            {/* SVG Mask for spotlight cutout */}
            <svg className="absolute inset-0 w-full h-full">
              <defs>
                <mask id="spotlight-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <motion.circle
                    cx="50%"
                    cy="40%"
                    initial={{ r: 0 }}
                    animate={{ r: 120 }}
                    transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect 
                width="100%" 
                height="100%" 
                fill="rgba(0, 0, 0, 0.85)" 
                mask="url(#spotlight-mask)"
              />
            </svg>
            
            {/* Spotlight ring glow */}
            <motion.div
              className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full border-2 border-[#4FD1FF]/60 pointer-events-none"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
              style={{
                boxShadow: '0 0 40px rgba(79, 209, 255, 0.3), inset 0 0 40px rgba(79, 209, 255, 0.1)'
              }}
            />

            {/* Info card */}
            <motion.div
              className="absolute left-1/2 top-[60%] -translate-x-1/2 bg-[#0A1628] border border-[#4FD1FF]/40 rounded-xl p-6 max-w-sm"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              <h3 className="text-white font-semibold text-lg mb-2">Spotlight Effect</h3>
              <p className="text-[#8FA6C1] text-sm mb-4">
                This creates a focused attention area using SVG masks. The rest of the UI is dimmed while the target element remains visible.
              </p>
              <p className="text-[#4FD1FF] text-xs">Click anywhere to close</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GUIDED TOUR OVERLAY */}
      <AnimatePresence>
        {showTour && spotlightTarget && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Dynamic SVG Mask - follows target element */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                <mask id="tour-mask">
                  <rect width="100%" height="100%" fill="white" />
                  <motion.rect
                    fill="black"
                    rx="12"
                    initial={false}
                    animate={{
                      x: spotlightTarget.left - 8,
                      y: spotlightTarget.top - 8,
                      width: spotlightTarget.width + 16,
                      height: spotlightTarget.height + 16,
                    }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                  />
                </mask>
              </defs>
              <motion.rect 
                width="100%" 
                height="100%" 
                fill="rgba(0, 0, 0, 0.85)" 
                mask="url(#tour-mask)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            </svg>

            {/* Animated border around target */}
            <motion.div
              className="absolute border-2 border-[#4FD1FF] rounded-xl pointer-events-none"
              initial={false}
              animate={{
                left: spotlightTarget.left - 8,
                top: spotlightTarget.top - 8,
                width: spotlightTarget.width + 16,
                height: spotlightTarget.height + 16,
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              style={{
                boxShadow: '0 0 30px rgba(79, 209, 255, 0.4), 0 0 60px rgba(79, 209, 255, 0.2)'
              }}
            />

            {/* Tooltip */}
            <motion.div
              className="absolute bg-[#0A1628] border border-[#4FD1FF]/50 rounded-xl p-5 w-80 shadow-2xl"
              style={getTooltipStyle()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              key={tourStep} // Force re-animate on step change
            >
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-3">
                {tourSteps.map((_, i) => (
                  <motion.div
                    key={i}
                    className={`h-1.5 rounded-full ${i === tourStep ? 'bg-[#4FD1FF] w-6' : 'bg-[#4FD1FF]/30 w-1.5'}`}
                    layout
                    transition={{ type: 'spring', stiffness: 300 }}
                  />
                ))}
                <span className="text-[#8FA6C1] text-xs ml-auto">{tourStep + 1} of {tourSteps.length}</span>
              </div>

              <h3 className="text-white font-semibold text-lg mb-2">{tourSteps[tourStep].title}</h3>
              <p className="text-[#8FA6C1] text-sm mb-4">{tourSteps[tourStep].content}</p>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setShowTour(false); setSpotlightTarget(null); }}
                  className="text-[#8FA6C1] text-sm hover:text-white transition-colors"
                >
                  Skip tour
                </button>
                <div className="flex gap-2">
                  {tourStep > 0 && (
                    <button
                      onClick={prevStep}
                      className="px-4 py-2 bg-[#1B2F52] text-white text-sm rounded-lg hover:bg-[#2A4472] transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={nextStep}
                    className="px-4 py-2 bg-[#4FD1FF] text-[#0A1628] text-sm font-semibold rounded-lg hover:bg-[#7FDFFF] transition-colors"
                  >
                    {tourStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
