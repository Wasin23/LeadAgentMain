'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  SparklesIcon, 
  RocketLaunchIcon, 
  ChartBarIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  BoltIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/home');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#4FD1FF]/30 border-t-[#4FD1FF] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect to dashboard
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 sm:gap-3"
        >
          <svg width="40" height="40" viewBox="0 0 48 48" className="drop-shadow-lg sm:w-12 sm:h-12">
            <defs>
              <linearGradient id="globeGradientLanding" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: 'rgb(255, 255, 255)', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: 'rgb(255, 255, 255)', stopOpacity: 0.7 }} />
              </linearGradient>
            </defs>
            <circle cx="24" cy="24" r="20" fill="white" opacity="0.2"/>
            <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="url(#globeGradientLanding)" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="url(#globeGradientLanding)" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="url(#globeGradientLanding)" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="url(#globeGradientLanding)" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="url(#globeGradientLanding)" strokeWidth="1.5"/>
            <line x1="4" y1="24" x2="44" y2="24" stroke="url(#globeGradientLanding)" strokeWidth="1.5"/>
          </svg>
          <span className="text-lg sm:text-2xl font-bold text-white">Meridian</span>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 sm:gap-4"
        >
          <button
            onClick={() => router.push('/signin')}
            className="px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-base text-white font-semibold hover:bg-white/20 rounded-lg sm:rounded-xl transition-all backdrop-blur-sm border-2 border-white/30"
          >
            Sign In
          </button>
          <button
            onClick={() => router.push('/signin')}
            className="px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-base font-bold rounded-lg sm:rounded-xl hover:scale-105 transition-all shadow-lg"
            style={{ backgroundColor: 'white', color: 'rgb(147, 51, 234)' }}
          >
            <span className="hidden sm:inline">Start Free Trial</span>
            <span className="sm:hidden">Start</span>
          </button>
        </motion.div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-10 sm:py-20">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="inline-block mb-4 sm:mb-6 px-4 sm:px-6 py-1.5 sm:py-2 bg-white/20 backdrop-blur-lg rounded-full text-white font-medium text-xs sm:text-sm">
              ✨ AI-Powered Lead Generation
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl sm:text-6xl md:text-7xl font-bold text-white mb-4 sm:mb-6 leading-tight"
          >
            Find Your Perfect Leads
            <br />
            <span className="bg-gradient-to-r from-yellow-200 via-pink-200 to-blue-200 bg-clip-text text-transparent">
              On Autopilot
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-base sm:text-xl md:text-2xl text-white/90 mb-8 sm:mb-10 max-w-3xl mx-auto px-4"
          >
            Meridian uses advanced AI to research, qualify, and reach out to your ideal customers automatically. 
            Spend less time prospecting, more time closing deals.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
          >
            <button
              onClick={() => router.push('/signin')}
              className="px-8 sm:px-10 py-3 sm:py-4 font-bold text-base sm:text-lg rounded-xl sm:rounded-2xl hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-2 shadow-xl w-full sm:w-auto"
              style={{ backgroundColor: 'white', color: 'rgb(147, 51, 234)' }}
            >
              Start Now
              <ArrowRightIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 sm:px-10 py-3 sm:py-4 backdrop-blur-lg text-white font-bold text-base sm:text-lg rounded-xl sm:rounded-2xl hover:scale-105 transition-all border-2 border-white/50 shadow-lg w-full sm:w-auto"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
            >
              Learn More
            </button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto px-4"
          >
            {[
              { number: '10x', label: 'Faster Prospecting' },
              { number: '85%', label: 'Time Saved' },
              { number: '3x', label: 'More Qualified Leads' }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl sm:text-4xl font-bold text-white mb-1 sm:mb-2">{stat.number}</div>
                <div className="text-white/80 text-xs sm:text-sm">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="relative z-10 container mx-auto px-4 sm:px-6 py-10 sm:py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            Everything You Need to Scale
          </h2>
          <p className="text-base sm:text-xl text-white/80 px-4">
            Powerful features to automate your entire outbound process
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 max-w-6xl mx-auto">
          {[
            {
              icon: MagnifyingGlassIcon,
              title: 'AI Lead Research',
              description: 'Find companies that perfectly match your ICP using advanced web search and data enrichment.'
            },
            {
              icon: SparklesIcon,
              title: 'Smart Qualification',
              description: 'AI analyzes each lead against your criteria and scores them for quality and fit.'
            },
            {
              icon: EnvelopeIcon,
              title: 'Personalized Outreach',
              description: 'Generate highly personalized emails that get responses using GPT-4 intelligence.'
            },
            {
              icon: ChartBarIcon,
              title: 'Real-Time Analytics',
              description: 'Track opens, clicks, and replies with comprehensive email tracking and reporting.'
            },
            {
              icon: BoltIcon,
              title: 'Automated Follow-ups',
              description: 'AI agents handle follow-up sequences automatically based on lead engagement.'
            },
            {
              icon: RocketLaunchIcon,
              title: 'Scale Infinitely',
              description: 'Run multiple campaigns simultaneously with different targeting and messaging.'
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 hover:scale-105 transition-all shadow-xl border-2 border-white/30"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-lg" style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)' }}>
                <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">{feature.title}</h3>
              <p className="text-sm sm:text-base text-white/80">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-10 sm:py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            How Meridian Works
          </h2>
          <p className="text-base sm:text-xl text-white/80 px-4">
            Set it up once, let AI do the rest
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-8">
          {[
            {
              step: '1',
              title: 'Define Your Ideal Customer',
              description: 'Tell us about your target market, industry, company size, and pain points you solve.'
            },
            {
              step: '2',
              title: 'AI Finds & Qualifies Leads',
              description: 'Our AI agents search the web, enrich data, and qualify leads based on your criteria.'
            },
            {
              step: '3',
              title: 'Personalized Outreach',
              description: 'GPT-4 crafts unique, personalized emails for each lead based on deep research.'
            },
            {
              step: '4',
              title: 'Track & Optimize',
              description: 'Monitor performance in real-time and let AI optimize your campaigns automatically.'
            }
          ].map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex items-start gap-4 sm:gap-6 hover:scale-[1.02] transition-all shadow-xl border-2 border-white/30"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
            >
              <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-bold shadow-lg" style={{ background: 'linear-gradient(to bottom right, rgb(250, 204, 21), rgb(236, 72, 153))', color: 'white' }}>
                {step.step}
              </div>
              <div>
                <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">{step.title}</h3>
                <p className="text-white/80 text-sm sm:text-lg">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-10 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl sm:rounded-3xl p-8 sm:p-12 md:p-16 text-center max-w-4xl mx-auto shadow-2xl border-2 border-white/30"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 sm:mb-6">
            Ready to Scale Your Outbound?
          </h2>
          <p className="text-base sm:text-xl text-white/80 mb-6 sm:mb-10 px-4">
            Join companies using AI to generate qualified leads on autopilot.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => router.push('/signin')}
              className="px-10 sm:px-12 py-4 sm:py-5 font-bold text-lg sm:text-xl rounded-xl sm:rounded-2xl hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-2 shadow-xl w-full sm:w-auto"
              style={{ backgroundColor: 'white', color: 'rgb(147, 51, 234)' }}
            >
              Start Free Trial
              <ArrowRightIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <svg width="32" height="32" viewBox="0 0 48 48">
                <defs>
                  <linearGradient id="globeGradientFooter" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: 'rgb(255, 255, 255)', stopOpacity: 0.8 }} />
                    <stop offset="100%" style={{ stopColor: 'rgb(255, 255, 255)', stopOpacity: 0.5 }} />
                  </linearGradient>
                </defs>
                <circle cx="24" cy="24" r="20" fill="white" opacity="0.1"/>
                <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="url(#globeGradientFooter)" strokeWidth="1"/>
                <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="url(#globeGradientFooter)" strokeWidth="1"/>
                <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="url(#globeGradientFooter)" strokeWidth="1"/>
                <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="url(#globeGradientFooter)" strokeWidth="1"/>
                <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="url(#globeGradientFooter)" strokeWidth="1"/>
                <line x1="4" y1="24" x2="44" y2="24" stroke="url(#globeGradientFooter)" strokeWidth="1"/>
              </svg>
              <span className="text-white/80 text-xs sm:text-base text-center">© 2025 Meridian. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <a href="/privacy" className="text-white/80 hover:text-white transition-colors text-xs sm:text-base">Privacy Policy</a>
              <a href="/terms" className="text-white/80 hover:text-white transition-colors text-xs sm:text-base">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}