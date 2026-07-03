'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [uid, setUid] = useState('');

  // Canvas globe - same as signin
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      t += 0.001;
      ctx.clearRect(0, 0, W, H);

      const bg = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.5, H * 1.2);
      bg.addColorStop(0, '#0b1628');
      bg.addColorStop(0.4, '#0d1f3c');
      bg.addColorStop(1, '#060d1a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.32;

      const proj = (sinLon: number, sinLat: number) => [
        cx + R * sinLon,
        cy - R * sinLat,
      ] as [number, number];

      const NUM = 14;
      const SEGS = 80;

      // Latitude rings
      for (let i = 0; i < NUM; i++) {
        const phi = ((i / (NUM - 1)) * Math.PI - Math.PI / 2);
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);
        const isFront = true;
        const alpha = 0.08 + 0.12 * Math.abs(cosP);
        ctx.beginPath();
        for (let j = 0; j <= SEGS; j++) {
          const theta = (j / SEGS) * Math.PI * 2 + t * 0.5;
          const sinT = Math.sin(theta);
          const [sx, sy] = proj(cosP * sinT, sinP);
          j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = `rgba(100,180,255,${alpha})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Longitude rings
      for (let i = 0; i < NUM; i++) {
        const theta = (i / NUM) * Math.PI * 2 + t;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);
        const isFront = cosT > 0;
        const alpha = isFront
          ? 0.14 + 0.56 * Math.abs(sinT)
          : 0.04 + 0.06 * Math.abs(sinT);
        ctx.beginPath();
        for (let j = 0; j <= SEGS; j++) {
          const phi = (j / SEGS) * Math.PI - Math.PI / 2;
          const [sx, sy] = proj(Math.cos(phi) * sinT, Math.sin(phi));
          j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = `rgba(100,180,255,${alpha})`;
        ctx.lineWidth = isFront ? 1.0 + 1.1 * Math.abs(sinT) : 0.5;
        ctx.stroke();
      }

      // Atmosphere glow
      const atmo = ctx.createRadialGradient(cx, cy, R * 0.94, cx, cy, R * 1.06);
      atmo.addColorStop(0, 'rgba(60,130,255,0)');
      atmo.addColorStop(0.4, 'rgba(80,165,255,0.30)');
      atmo.addColorStop(1, 'rgba(40,100,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.06, 0, Math.PI * 2);
      ctx.fillStyle = atmo;
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const uidParam = searchParams.get('uid');
    if (uidParam) setUid(uidParam);
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      fetch(`${API_BASE}/api/unsubscribe?token=${tokenParam}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.email) {
            setEmail(data.email);
          } else {
            setStatus('error');
            setMessage(data.message || 'Invalid unsubscribe link');
          }
        })
        .catch(() => {
          setStatus('error');
          setMessage('Failed to validate unsubscribe link');
        });
    }
  }, [searchParams]);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const response = await fetch(`${API_BASE}/api/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token || undefined,
          email: !token ? email : undefined,
          reason,
          userId: uid || undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setStatus('success');
        setMessage(data.message || 'Successfully unsubscribed');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to unsubscribe');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .unsub-anim { animation: fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>

      <div className="min-h-screen relative flex items-center justify-center overflow-hidden p-4">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />

        <div className="relative w-full max-w-md unsub-anim" style={{ zIndex: 10 }}>
          {/* Logo */}
          <div className="text-center mb-7">
            <div className="flex justify-center mb-3">
              <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
                <ellipse cx="24" cy="24" rx="5" ry="19" stroke="white" strokeWidth="1.5" opacity="0.9"/>
                <ellipse cx="24" cy="24" rx="13" ry="19" stroke="white" strokeWidth="1.5" opacity="0.8"/>
                <ellipse cx="24" cy="24" rx="19" ry="19" stroke="white" strokeWidth="1.5" opacity="0.9"/>
                <ellipse cx="24" cy="24" rx="19" ry="7.5" stroke="white" strokeWidth="1.5" opacity="0.8"/>
                <line x1="5" y1="24" x2="43" y2="24" stroke="white" strokeWidth="1.5" opacity="0.7"/>
              </svg>
            </div>
            <h1
              className="text-4xl font-bold tracking-tight text-white"
              style={{ textShadow: '0 2px 32px rgba(80,140,255,0.5), 0 1px 4px rgba(0,0,0,0.8)', letterSpacing: '-0.02em' }}
            >
              Meridian
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(160,190,255,0.65)' }}>
              Email Preferences
            </p>
          </div>

          <Card className="shadow-2xl border-slate-200/70 bg-white/95 backdrop-blur-sm">
            {status === 'success' ? (
              <CardContent className="pt-8 pb-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-xl mb-2">You're Unsubscribed</CardTitle>
                <CardDescription className="mb-2">{message}</CardDescription>
                <p className="text-sm text-muted-foreground mb-6">
                  You will no longer receive emails at <span className="font-medium text-foreground">{email}</span>
                </p>
                <Button asChild className="w-full">
                  <Link href="/">Return to Meridian</Link>
                </Button>
              </CardContent>
            ) : status === 'error' && !email ? (
              <CardContent className="pt-8 pb-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>
                </div>
                <CardTitle className="text-xl mb-2">Invalid Link</CardTitle>
                <CardDescription className="mb-2">{message}</CardDescription>
                <p className="text-sm text-muted-foreground mb-6">
                  This unsubscribe link may have expired or is invalid. Please use the link from your most recent email.
                </p>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/">Go to Home</Link>
                </Button>
              </CardContent>
            ) : (
              <>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Unsubscribe from Emails</CardTitle>
                  <CardDescription>
                    We're sorry to see you go. You can unsubscribe from all future emails below.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUnsubscribe} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        readOnly={!!token}
                        placeholder="your@email.com"
                        className={token ? 'bg-muted text-muted-foreground' : ''}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="reason">Reason (Optional)</Label>
                      <Select value={reason} onValueChange={setReason}>
                        <SelectTrigger id="reason">
                          <SelectValue placeholder="Select a reason..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_interested">Not interested anymore</SelectItem>
                          <SelectItem value="too_many_emails">Too many emails</SelectItem>
                          <SelectItem value="not_relevant">Content not relevant</SelectItem>
                          <SelectItem value="never_signed_up">Never signed up</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {status === 'error' && message && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{message}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      variant="destructive"
                      className="w-full"
                      disabled={status === 'loading' || !email}
                    >
                      {status === 'loading' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Unsubscribing...
                        </>
                      ) : (
                        'Unsubscribe'
                      )}
                    </Button>

                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-center text-muted-foreground">
                        Changed your mind?{' '}
                        <Link href="/" className="text-primary hover:underline">
                          Return to Meridian
                        </Link>
                      </p>
                    </div>
                  </form>
                </CardContent>
              </>
            )}
          </Card>

          {/* Legal links */}
          <div className="mt-5 text-center text-sm" style={{ color: 'rgba(160,190,255,0.55)' }}>
            <Link href="/privacy" className="hover:text-white/90 transition-colors">
              Privacy Policy
            </Link>
            {' · '}
            <Link href="/terms" className="hover:text-white/90 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
