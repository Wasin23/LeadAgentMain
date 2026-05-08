'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'
import Cookies from 'js-cookie'
import { Eye, EyeOff, AlertCircle, CheckCircle, Loader2, HelpCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

function getPasswordStrength(password: string) {
  if (password.length < 6) return { strength: 'weak', score: 0 }
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 2) return { strength: 'weak', score: 33 }
  if (score <= 3) return { strength: 'medium', score: 66 }
  return { strength: 'strong', score: 100 }
}

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [codeValidation, setCodeValidation] = useState<{
    isValid: boolean; message: string; isChecking: boolean
  }>({ isValid: false, message: '', isChecking: false })

  const [signInForm, setSignInForm] = useState({ username: '', password: '' })
  const [signUpForm, setSignUpForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [forgotForm, setForgotForm] = useState({ email: '' })
  const [resetForm, setResetForm] = useState({ code: '', newPassword: '', confirmPassword: '' })

  const { login, register, isAuthenticated } = useAuth()
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [globePaused, setGlobePaused] = useState(false)
  const pauseRef = useRef(false)
  const drawRef = useRef<(() => void) | null>(null)

  // Canvas globe
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
      } else if (!pauseRef.current) {
        raf = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const draw = () => {
      if (pauseRef.current) return
      const W = canvas.width
      const H = canvas.height
      t += 0.001
      ctx.clearRect(0, 0, W, H)

      // bg — solid deep blue, no stars
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

      // Tilt 40° to the left: rotate (x3d, y3d) around Z-axis
      // North pole leans left: x' = x*cos - y*sin, y' = x*sin + y*cos (negative tilt)
      const TILT = 40 * Math.PI / 180
      const cosA = Math.cos(TILT)
      const sinA = Math.sin(TILT)
      const proj = (x3: number, y3: number): [number, number] => [
        cx + R * (x3 * cosA - y3 * sinA),
        cy - R * (x3 * sinA + y3 * cosA),
      ]

      // clip to sphere
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()

      // globe surface — much lighter blue interior
      const body = ctx.createRadialGradient(cx + R * 0.20, cy - R * 0.35, R * 0.05, cx, cy, R)
      body.addColorStop(0, '#1e4898')
      body.addColorStop(0.25, '#122d6a')
      body.addColorStop(0.55, '#0a1c44')
      body.addColorStop(1, '#040c1e')
      ctx.fillStyle = body
      ctx.fillRect(cx - R - 2, cy - R - 2, R * 2 + 4, R * 2 + 4)

      // latitude lines — parametric with tilt, split front/back
      // Space latitudes so sin(lat) is evenly distributed → equal pixel gaps on screen
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
          // pass 0 = back half (z < 0, alpha PI/2→3PI/2), pass 1 = front half (z > 0, alpha -PI/2→PI/2)
          const aStart = pass === 0 ? Math.PI / 2 : -Math.PI / 2
          const aEnd   = pass === 0 ? Math.PI * 3 / 2 : Math.PI / 2
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

      // meridian lines — parametric with tilt applied
      const NUM = 24
      const SEGS = 64
      for (let i = 0; i < NUM; i++) {
        const theta = (i / NUM) * Math.PI * 2 + t
        const sinT = Math.sin(theta)
        const cosT = Math.cos(theta)
        const isFront = cosT > 0
        const alpha = isFront
          ? 0.14 + 0.56 * Math.abs(sinT)
          : 0.04 + 0.06 * Math.abs(sinT)
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
    drawRef.current = draw
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const justLoggedOut = localStorage.getItem('justLoggedOut')
      if (justLoggedOut !== 'true') {
        router.push('/home')
        return
      }
      localStorage.removeItem('justLoggedOut')
    }
  }, [isAuthenticated, router])

  // Handle Google OAuth callback via hash params
  useEffect(() => {
    const run = async () => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash?.startsWith('#')) return
    const params = new URLSearchParams(hash.slice(1))
    const googleStatus = params.get('google')
    if (googleStatus === 'error') { setError('Google sign-in failed. Please try again.'); return }
    if (googleStatus === 'denied') { setError('Google sign-in was cancelled.'); return }
    if (googleStatus !== 'success') return
    const token = params.get('token')
    const encodedUser = params.get('user')
    const redirectPath = params.get('redirect') || '/home'
    if (!token || !encodedUser) { setError('Google sign-in failed. Please try again.'); return }
    try {
      const userData = JSON.parse(atob(encodedUser))
      localStorage.setItem('currentUser', JSON.stringify(userData))
      localStorage.setItem('authToken', token)
      Cookies.set('authToken', token, { expires: 7 })
      setSuccessMsg('Google sign-in successful! Redirecting...')
      // For Google sign-in, check if user needs onboarding
      try {
        const { data } = await api.get('/api/company-profile/check')
        router.replace((data?.hasProfile || data?.hasCompletedOnboarding) ? redirectPath : '/onboarding?new=1')
      } catch {
        router.replace(redirectPath)
      }
    } catch {
      setError('Google sign-in failed. Please try again.')
    }
    }
    run()
  }, [router])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const ok = await login(signInForm.username, signInForm.password)
      if (ok) {
        setSuccessMsg('Sign in successful! Redirecting...')
        setTimeout(() => router.push('/home'), 1200)
      } else {
        setError('Invalid username or password')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (signUpForm.password !== signUpForm.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const ok = await register(signUpForm.username, signUpForm.email, signUpForm.password)
      if (ok) {
        setSuccessMsg('Account created! Redirecting...')
        setTimeout(() => router.push('/onboarding?new=1'), 1200)
      } else {
        setError('Registration failed. Username or email may already exist.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    window.location.href = `${api.defaults.baseURL}/api/auth/google/authorize`
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setForgotError('')
    setForgotSuccess('')
    try {
      const res = await fetch(`${api.defaults.baseURL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotForm.email }),
      })
      const data = await res.json()
      if (res.ok) {
        setForgotSuccess(data.message + (data.resetToken ? ` Reset token: ${data.resetToken}` : ''))
      } else {
        setForgotError(data.error || 'Failed to send reset email')
      }
    } catch {
      setForgotError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (resetForm.newPassword !== resetForm.confirmPassword) { setForgotError('Passwords do not match'); return }
    setIsLoading(true)
    setForgotError('')
    try {
      const res = await fetch(`${api.defaults.baseURL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetForm.code, newPassword: resetForm.newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccessMsg('Password reset successful! You can now sign in.')
        setResetForm({ code: '', newPassword: '', confirmPassword: '' })
        setForgotForm({ email: '' })
        setForgotSuccess('')
        setForgotError('')
        setShowForgotModal(false)
      } else {
        setForgotError(data.error || 'Failed to reset password')
      }
    } catch {
      setForgotError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const validateResetCode = async (code: string) => {
    if (!code || code.length < 6) { setCodeValidation({ isValid: false, message: '', isChecking: false }); return }
    setCodeValidation({ isValid: false, message: 'Checking code...', isChecking: true })
    try {
      const res = await fetch(`${api.defaults.baseURL}/api/auth/verify-reset-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code }),
      })
      const data = await res.json()
      if (res.ok) {
        setCodeValidation({ isValid: true, message: 'Valid reset code ✓', isChecking: false })
      } else {
        setCodeValidation({ isValid: false, message: data.error || 'Invalid reset code', isChecking: false })
      }
    } catch {
      setCodeValidation({ isValid: false, message: 'Error validating code', isChecking: false })
    }
  }

  const pwStrength = getPasswordStrength(signUpForm.password)
  const resetPwStrength = getPasswordStrength(resetForm.newPassword)

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .signin-card-anim { animation: fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both; }
        .signin-pressable {
          transform: translateY(0) scale(1);
          transition: transform 0.14s ease, box-shadow 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
        }
        .signin-pressable:active:not(:disabled) {
          transform: translateY(1px) scale(0.985);
        }
        .signin-primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.24);
        }
        .signin-primary-button:active:not(:disabled) {
          transform: translateY(1px) scale(0.985);
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18);
        }
        .signin-tab-trigger {
          transition: transform 0.14s ease, box-shadow 0.18s ease, background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        }
        .signin-tab-trigger:hover {
          transform: translateY(-1px);
        }
        .signin-tab-trigger:active {
          transform: translateY(1px) scale(0.985);
        }
        .signin-tab-trigger[data-state='active'] {
          background: white;
          color: rgb(15, 23, 42);
          border-color: rgba(148, 163, 184, 0.35);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }
        .google-auth-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.98);
          border-color: rgba(59, 130, 246, 0.95);
          color: rgb(29, 78, 216);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }
      `}</style>

    <div className="min-h-screen relative flex items-center justify-center overflow-hidden p-4">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />

      {/* Globe pause toggle — bottom left */}
      <button
        onClick={() => {
          const next = !globePaused
          pauseRef.current = next
          setGlobePaused(next)
          if (!next) drawRef.current?.()
        }}
        title={globePaused ? 'Resume globe' : 'Pause globe'}
        className="absolute bottom-4 left-4 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105"
        style={{ zIndex: 20, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        {globePaused ? (
          <>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9" /></svg>
            Resume
          </>
        ) : (
          <>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8" /><rect x="6" y="1" width="3" height="8" /></svg>
            Pause
          </>
        )}
      </button>

      {/* Back to landing — top left */}
      <Button
        variant="ghost"
        size="icon"
        title="Back to home"
        onClick={() => router.push('/')}
        className="signin-pressable absolute top-4 left-4 h-8 w-8 rounded-full transition-all duration-300 hover:scale-110"
        style={{ zIndex: 20, color: 'white', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.40)' }}
      >
        <ArrowLeft className="w-4 h-4" />
      </Button>

      {/* Help button — top right, matches dashboard icon style */}
      <Button
        variant="ghost"
        size="icon"
        title="Help & Support"
        onClick={() => window.location.href = '/help'}
        className="signin-pressable absolute top-4 right-4 h-8 w-8 rounded-full transition-all duration-300 hover:scale-110"
        style={{ zIndex: 20, color: 'white', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.40)' }}
      >
        <HelpCircle className="w-4 h-4" />
      </Button>

      {/* ── Card panel — centered ── */}
      <div className="relative w-full max-w-md signin-card-anim" style={{ zIndex: 10 }}>
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="flex justify-center mb-3">
            <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
              <ellipse cx="24" cy="24" rx="5" ry="19" stroke="white" strokeWidth="1.5" opacity="0.9"/>
              <ellipse cx="24" cy="24" rx="13" ry="19" stroke="white" strokeWidth="1.5" opacity="0.8"/>
              <ellipse cx="24" cy="24" rx="19" ry="19" stroke="white" strokeWidth="1.5" opacity="0.9"/>
              <ellipse cx="24" cy="24" rx="19" ry="7.5" stroke="white" strokeWidth="1.5" opacity="0.8"/>
              <line x1="5" y1="24" x2="43" y2="24" stroke="white" strokeWidth="1.5" opacity="0.7"/>
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white" style={{ textShadow: '0 2px 32px rgba(80,140,255,0.5), 0 1px 4px rgba(0,0,0,0.8)', letterSpacing: '-0.02em' }}>
            Meridian
          </h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(160,190,255,0.65)' }}>AI-Powered Lead Research & Automation</p>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {successMsg && (
          <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>{successMsg}</AlertDescription>
          </Alert>
        )}

        <Card className="shadow-2xl border-slate-200/70 bg-white/95 backdrop-blur-sm" style={{
          '--background': 'oklch(0.98 0.003 255)',
          '--foreground': 'oklch(0.22 0.02 255)',
          '--card': 'oklch(1 0 0)',
          '--card-foreground': 'oklch(0.22 0.02 255)',
          '--input': 'oklch(0.91 0.008 255)',
          '--border': 'oklch(0.91 0.008 255)',
          '--muted': 'oklch(0.96 0.008 255)',
          '--muted-foreground': 'oklch(0.54 0.015 255)',
          '--secondary': 'oklch(0.96 0.008 255)',
          '--secondary-foreground': 'oklch(0.22 0.02 255)',
          '--accent': 'oklch(0.56 0.15 255)',
          '--accent-foreground': 'oklch(0.98 0.01 255)',
          colorScheme: 'light',
        } as React.CSSProperties}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Welcome back</CardTitle>
            <CardDescription>Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="w-full mb-5">
                <TabsTrigger value="signin" className="signin-tab-trigger signin-pressable flex-1">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="signin-tab-trigger signin-pressable flex-1">Sign Up</TabsTrigger>
              </TabsList>

              {/* Sign In */}
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" type="email" required placeholder="you@example.com"
                      value={signInForm.username}
                      onChange={(e) => setSignInForm({ ...signInForm, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="si-password">Password</Label>
                      <button type="button" onClick={() => setShowForgotModal(true)}
                        className="signin-pressable rounded-md text-xs text-primary hover:underline">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input id="si-password" type={showPassword ? 'text' : 'password'} required placeholder="••••••••"
                        value={signInForm.password} className="pr-10"
                        onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="signin-pressable absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="signin-primary-button signin-pressable w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="signin-pressable google-auth-button w-full border-slate-200 bg-white hover:bg-white hover:text-blue-700 hover:border-blue-500" onClick={handleGoogleSignIn}>
                    <GoogleIcon /><span className="ml-2">Sign in with Google</span>
                  </Button>
                </form>
              </TabsContent>

              {/* Sign Up */}
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-username">Username</Label>
                    <Input id="su-username" type="text" required minLength={3} placeholder="yourname"
                      value={signUpForm.username}
                      onChange={(e) => setSignUpForm({ ...signUpForm, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" required placeholder="you@example.com"
                      value={signUpForm.email}
                      onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-password">Password</Label>
                    <Input id="su-password" type="password" required minLength={6} placeholder="••••••••"
                      value={signUpForm.password}
                      onChange={(e) => setSignUpForm({ ...signUpForm, password: e.target.value })}
                    />
                    {signUpForm.password && (
                      <div className="space-y-1">
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${
                            pwStrength.strength === 'weak' ? 'bg-red-500' :
                            pwStrength.strength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`} style={{ width: `${pwStrength.score}%` }} />
                        </div>
                        <p className={`text-xs capitalize ${pwStrength.strength === 'weak' ? 'text-red-500' : pwStrength.strength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                          {pwStrength.strength} password
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-confirm">Confirm Password</Label>
                    <Input id="su-confirm" type="password" required minLength={6} placeholder="••••••••"
                      value={signUpForm.confirmPassword}
                      onChange={(e) => setSignUpForm({ ...signUpForm, confirmPassword: e.target.value })}
                    />
                    {signUpForm.confirmPassword && (
                      <p className={`text-xs ${signUpForm.password === signUpForm.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                        {signUpForm.password === signUpForm.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                      </p>
                    )}
                  </div>
                  <Button type="submit" className="signin-primary-button signin-pressable w-full" disabled={isLoading || signUpForm.password !== signUpForm.confirmPassword}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="signin-pressable google-auth-button w-full border-slate-200 bg-white hover:bg-white hover:text-blue-700 hover:border-blue-500" onClick={handleGoogleSignIn}>
                    <GoogleIcon /><span className="ml-2">Continue with Google</span>
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Privacy / Terms links */}
      <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-6 text-xs" style={{ zIndex: 10 }}>
        <a href="/privacy" className="text-white/70 hover:text-white transition-colors">Privacy Policy</a>
        <span className="text-white/30">·</span>
        <a href="/terms" className="text-white/70 hover:text-white transition-colors">Terms of Service</a>
      </div>
      <Dialog open={showForgotModal} onOpenChange={(open) => {
        setShowForgotModal(open)
        if (!open) { setForgotError(''); setForgotSuccess('') }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter your email and we&apos;ll send you a reset code.</DialogDescription>
          </DialogHeader>
          {forgotError && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" /><AlertDescription>{forgotError}</AlertDescription>
            </Alert>
          )}
          {forgotSuccess && (
            <Alert className="mt-2 border-green-200 bg-green-50 text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" /><AlertDescription>{forgotSuccess}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleForgotPassword} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="fp-email">Email Address</Label>
              <Input id="fp-email" type="email" required placeholder="you@example.com"
                value={forgotForm.email}
                onChange={(e) => setForgotForm({ ...forgotForm, email: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="signin-pressable flex-1" onClick={() => setShowForgotModal(false)}>Cancel</Button>
              <Button type="submit" className="signin-primary-button signin-pressable flex-1" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Send Code
              </Button>
            </div>
          </form>
          {forgotSuccess && (
            <form onSubmit={handleResetPassword} className="space-y-4 pt-4 border-t mt-4">
              <p className="text-sm font-medium">Enter Reset Code</p>
              <div className="space-y-1.5">
                <Label htmlFor="rc-code">Reset Code</Label>
                <Input id="rc-code" type="text" required placeholder="Code from your email"
                  value={resetForm.code}
                  className={codeValidation.isValid ? 'border-green-500' : resetForm.code && !codeValidation.isChecking && codeValidation.message ? 'border-red-500' : ''}
                  onChange={(e) => { setResetForm({ ...resetForm, code: e.target.value }); validateResetCode(e.target.value) }}
                />
                {resetForm.code && codeValidation.message && (
                  <p className={`text-xs flex items-center gap-1 ${codeValidation.isValid ? 'text-green-600' : 'text-red-500'}`}>
                    {codeValidation.isChecking && <Loader2 className="w-3 h-3 animate-spin" />}{codeValidation.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-newpw">New Password</Label>
                <Input id="rc-newpw" type="password" required minLength={6} placeholder="••••••••"
                  value={resetForm.newPassword}
                  onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                />
                {resetForm.newPassword && (
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${resetPwStrength.strength === 'weak' ? 'bg-red-500' : resetPwStrength.strength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${resetPwStrength.score}%` }} />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rc-confirm">Confirm Password</Label>
                <Input id="rc-confirm" type="password" required placeholder="••••••••"
                  value={resetForm.confirmPassword}
                  onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                />
                {resetForm.confirmPassword && (
                  <p className={`text-xs ${resetForm.newPassword === resetForm.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                    {resetForm.newPassword === resetForm.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </p>
                )}
              </div>
              <Button type="submit" className="signin-primary-button signin-pressable w-full"
                disabled={isLoading || !codeValidation.isValid || !resetForm.newPassword || resetForm.newPassword !== resetForm.confirmPassword}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  </>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#4285F4" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#34A853" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
