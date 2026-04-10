"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, CardElement, useStripe, useElements, PaymentRequestButtonElement } from "@stripe/react-stripe-js"
import type { PaymentRequest } from "@stripe/stripe-js"
import { X, Calendar, CreditCard, Plus, Loader2, Sparkles, ChevronDown, ChevronUp, TrendingDown, AlertTriangle, Gift, Lock, Users, RefreshCcw, XCircle } from "lucide-react"
import api from "@/lib/api"
import { fetchDisplayedCreditData } from "@/lib/credit-balance"
import { useToast } from "@/hooks/use-toast"
import { CreditPurchaseModal } from "./credit-purchase-modal"
import { PaymentHistorySection } from "./payment-history-section"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentMethod {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

interface ApiUsageStats {
  apollo?: { cost: number; calls: number }
  openai?: { cost: number; tokens: number }
  mailgun?: { cost: number; sent: number }
  zerobounce?: { cost: number; validations: number }
  serper?: { cost: number; searches: number }
  total?: { cost: number }
}

// ── Wallet Pay Button (Apple Pay / Google Pay) ───────────────────────────────

function WalletPayButton({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe()
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!stripe) return
    let pr: PaymentRequest | null = null

    api.post("/api/billing/setup-intent")
      .then(({ data }) => {
        const secret: string = data.clientSecret
        setClientSecret(secret)

        pr = stripe.paymentRequest({
          country: "US",
          currency: "usd",
          total: { label: "Save payment method", amount: 0 },
          requestPayerName: true,
        })

        pr.canMakePayment().then(result => {
          if (result) setPaymentRequest(pr)
        })

        pr.on("paymentmethod", async (ev) => {
          setError(null)
          try {
            const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(
              secret,
              { payment_method: ev.paymentMethod.id },
              { handleActions: false }
            )
            if (confirmError) {
              ev.complete("fail")
              setError(confirmError.message ?? "Wallet payment failed")
              return
            }
            ev.complete("success")
            if (setupIntent?.payment_method) {
              await api.post("/api/billing/add-payment-method", {
                paymentMethodId: setupIntent.payment_method,
              })
            }
            onSuccess()
          } catch (err: any) {
            ev.complete("fail")
            setError(err.response?.data?.error ?? "Failed to save wallet payment method")
          }
        })
      })
      .catch(() => {})

    return () => { pr?.off("paymentmethod") }
  }, [stripe])

  if (!paymentRequest) return null

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground mb-2 text-center">Pay with wallet</p>
        <PaymentRequestButtonElement
          options={{
            paymentRequest,
            style: { paymentRequestButton: { theme: "dark", height: "44px" } },
          }}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or enter card manually</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    </div>
  )
}

// ── Add Card Form ─────────────────────────────────────────────────────────────

function AddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardholderName, setCardholderName] = useState("")
  const [cardReady, setCardReady] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  useEffect(() => {
    api.post("/api/billing/setup-intent")
      .then(({ data }) => setClientSecret(data.clientSecret))
      .catch(() => setError("Failed to initialize payment form. Please try again."))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || !clientSecret) return
    setLoading(true)
    setError(null)
    try {
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: { name: cardholderName },
        },
      })
      if (stripeError) {
        const msg = stripeError.message || "Failed to add card"
        setError(msg.toLowerCase().includes("too many")
          ? "Too many attempts. Please close this form and try again in a moment."
          : msg)
      } else if (setupIntent?.payment_method) {
        await api.post("/api/billing/add-payment-method", { paymentMethodId: setupIntent.payment_method })
        onSuccess()
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || "Failed to add card"
      setError(msg.toLowerCase().includes("different account")
        ? "This card was previously used. Close this form and reopen it to try again."
        : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Wallet Pay (Apple Pay / Google Pay) */}
      <WalletPayButton onSuccess={onSuccess} />

      {/* Grouped fields — Stripe-style bordered rows */}
      <div className="rounded-xl border border-input overflow-hidden">
        {/* Name row */}
        <div className="px-4 py-3 border-b border-input">
          <label className="block text-[11px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Name on card</label>
          <input
            type="text"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            placeholder="Full name"
            required
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        {/* Card row */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Card</label>
            <div className="flex items-center gap-1.5">
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzAwNTJGRiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSI1IiBmaWxsPSIjRUIwMDFCIi8+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMTAiIHI9IjUiIGZpbGw9IiNGRjVGMDAiLz4KPC9zdmc+" alt="Mastercard" className="h-4 w-auto opacity-80" />
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzFBMUY3MSIvPgo8dGV4dCB4PSI1IiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSI+VklTQTwvdGV4dD4KPC9zdmc+" alt="Visa" className="h-4 w-auto opacity-80" />
              <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzAwNzlDMSIvPgo8dGV4dCB4PSI0IiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjciIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSI+QU1FWDwvdGV4dD4KPC9zdmc+" alt="Amex" className="h-4 w-auto opacity-80" />
            </div>
          </div>
          <CardElement
            onReady={() => setCardReady(true)}
            onChange={(e) => setError(e.error?.message ?? null)}
            options={{
              style: {
                base: {
                  fontSize: "15px",
                  fontFamily: "inherit",
                  color: "var(--foreground, #111827)",
                  "::placeholder": { color: "var(--muted-foreground, #9ca3af)" },
                },
                invalid: { color: "#ef4444" },
              },
            }}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || loading || !cardholderName.trim() || !cardReady || !clientSecret}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
        ) : !clientSecret ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Loading...</>
        ) : (
          "Save Card"
        )}
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50"
      >
        Cancel
      </button>

      <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Powered by Stripe</span>
        <span>·</span>
        <span>Terms</span>
        <span>·</span>
        <span>Privacy</span>
      </div>
    </form>
  )
}

// ── Billing Tab (inner) ───────────────────────────────────────────────────────

function BillingTabInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCard, setShowAddCard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trialCredits, setTrialCredits] = useState<any>(null)

  // Credit system state
  const [creditBalance, setCreditBalance] = useState<number>(0)
  const [creditsSpent, setCreditsSpent] = useState<number>(0)
  const [userPlan, setUserPlan] = useState<any>(null)
  const [apiStats, setApiStats] = useState<ApiUsageStats>({})
  const [showCostBreakdown, setShowCostBreakdown] = useState(false)
  const [showAgentBreakdown, setShowAgentBreakdown] = useState(false)
  const [showCreditPurchaseModal, setShowCreditPurchaseModal] = useState(false)
  const [creditPurchaseMode, setCreditPurchaseMode] = useState<"upgrade" | "topup">("topup")

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyOpen = showAddCard || showCreditPurchaseModal
    document.body.style.overflow = anyOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showAddCard, showCreditPurchaseModal])
  const [creditLoading, setCreditLoading] = useState(true)

  // Auto top-up
  const [autoTopup, setAutoTopup] = useState({ enabled: false, threshold: 50, tierId: 'small' })
  const [autoTopupSaving, setAutoTopupSaving] = useState(false)

  // Per-agent usage
  type AgentUsage = { agentId: string; name: string; totalCost: number; credits: number }
  const [agentUsage, setAgentUsage] = useState<AgentUsage[]>([])
  const [agentUsageLoading, setAgentUsageLoading] = useState(false)

  // Payment status + plan management
  const [paymentStatus, setPaymentStatus] = useState<string>('active')
  const [nextPaymentDue, setNextPaymentDue] = useState<string | null>(null)
  const [gracePeriodEnd, setGracePeriodEnd] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [downgradeTarget, setDowngradeTarget] = useState('')
  const [downgradeLoading, setDowngradeLoading] = useState(false)

  const PLAN_ORDER = ['free-trial', 'basic', 'starter', 'professional', 'enterprise']
  const PLAN_LABELS: Record<string, string> = {
    basic: 'Basic — $100/mo',
    starter: 'Starter — $500/mo',
    professional: 'Professional — $1,000/mo',
    enterprise: 'Enterprise — $2,500/mo',
  }

  const avgCreditsPerEmail = 0.7
  const estimatedEmailsAvailable = Math.floor(creditBalance / avgCreditsPerEmail)
  const estimatedEmailsPerDay = Math.floor(estimatedEmailsAvailable / 30)
  const estimatedEmailsPerWeek = Math.floor(estimatedEmailsAvailable / 4.33)

  useEffect(() => {
    loadPaymentMethods()
    loadTrialCredits()
    fetchCreditData()
    api.get('/api/settings/auto-topup').then(r => { if (r.data?.settings) setAutoTopup(r.data.settings) }).catch(() => {})
    api.get('/api/billing/payment-status').then(r => {
      if (r.data) {
        setPaymentStatus(r.data.status || 'active')
        setNextPaymentDue(r.data.nextPaymentDue || null)
        setGracePeriodEnd(r.data.gracePeriodEnd || null)
      }
    }).catch(() => {})
  }, [])

  const handleCancelPlan = async () => {
    setCancelLoading(true)
    try {
      await api.post('/api/plans/cancel')
      setCancelConfirm(false)
      await fetchCreditData()
    } catch (err: any) {
      toast({ title: 'Failed to cancel plan', description: err.response?.data?.error, variant: 'destructive', duration: 4000 })
    } finally {
      setCancelLoading(false)
    }
  }

  const handleDowngrade = async () => {
    if (!downgradeTarget) return
    setDowngradeLoading(true)
    try {
      await api.post('/api/plans/downgrade', { planType: downgradeTarget })
      setDowngradeTarget('')
      await fetchCreditData()
    } catch (err: any) {
      toast({ title: 'Failed to downgrade plan', description: err.response?.data?.error, variant: 'destructive', duration: 4000 })
    } finally {
      setDowngradeLoading(false)
    }
  }

  const saveAutoTopup = async (updated: typeof autoTopup) => {
    setAutoTopupSaving(true)
    try { await api.put('/api/settings/auto-topup', updated) } catch {}
    finally { setAutoTopupSaving(false) }
  }

  const loadAgentUsage = async () => {
    setAgentUsageLoading(true)
    try {
      const { data } = await api.get('/api/lead-agent/api-usage/by-agent')
      if (data.success) setAgentUsage(data.agents || [])
    } catch {}
    finally { setAgentUsageLoading(false) }
  }

  useEffect(() => {
    if (searchParams.get("upgrade") === "plans") {
      setCreditPurchaseMode("upgrade")
      setShowCreditPurchaseModal(true)
      const next = new URLSearchParams(searchParams.toString())
      next.delete("upgrade")
      const query = next.toString()
      router.replace(query ? `/settings?${query}` : "/settings?tab=billing")
    }
  }, [router, searchParams])

  const fetchCreditData = async () => {
    setCreditLoading(true)
    try {
      const creditData = await fetchDisplayedCreditData()
      setUserPlan(creditData.userPlan)
      setTrialCredits(creditData.trialCredits)

      const total = creditData.balance
      setCreditBalance(total)
      // Sync top-right header counter
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("credits-updated", { detail: { credits: total } }))
      }

      // 4. API usage (to calculate spent)
      try {
        const { data } = await api.get("/api/lead-agent/api-usage/total")
        if (data.success && data.stats) {
          const stats: ApiUsageStats = data.stats
          setApiStats(stats)
          const totalCost =
            (stats.apollo?.cost ?? 0) +
            (stats.openai?.cost ?? 0) +
            (stats.mailgun?.cost ?? 0) +
            (stats.zerobounce?.cost ?? 0) +
            (stats.serper?.cost ?? 0)
          setCreditsSpent(totalCost / 0.05)
        }
      } catch {}
    } finally {
      setCreditLoading(false)
    }
  }

  const loadTrialCredits = async () => {
    try {
      const { data } = await api.get("/api/billing/trial-credits")
      if (data.success) setTrialCredits(data.credits)
    } catch { }
  }

  const loadPaymentMethods = async () => {
    try {
      const { data } = await api.get("/api/billing/payment-methods")
      setPaymentMethods(data.paymentMethods || [])
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load payment methods")
    } finally { setLoading(false) }
  }

  const handleRemoveCard = async (id: string) => {
    try {
      await api.delete(`/api/billing/payment-methods/${id}`)
      setPaymentMethods(pm => pm.filter(m => m.id !== id))
      toast({ title: 'Card removed', duration: 2000 })
    } catch (err: any) {
      toast({ title: 'Failed to remove card', description: err.response?.data?.error, variant: 'destructive', duration: 4000 })
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await api.post("/api/billing/set-default-payment", { paymentMethodId: id })
      setPaymentMethods(pm => pm.map(m => ({ ...m, isDefault: m.id === id })))
      toast({ title: 'Default card updated', duration: 2000 })
    } catch (err: any) {
      toast({ title: 'Failed to set default card', description: err.response?.data?.error, variant: 'destructive', duration: 4000 })
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
    </div>
  )

  const currentPlanIdx = PLAN_ORDER.indexOf(userPlan?.plan?.id ?? '')
  const downgradePlans = currentPlanIdx > 1 ? PLAN_ORDER.slice(1, currentPlanIdx) : []

  return (
    <div className="max-w-4xl space-y-8">

      {/* ── Page Header ── */}
      <h1 className="text-2xl font-bold">Billing Settings</h1>

      {/* ── Payment Failed Banner ── */}
      {paymentStatus === 'payment_failed' && (
        <div className="flex items-start gap-3 rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Payment failed</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              We couldn't process your last payment.
              {gracePeriodEnd && ` You have until ${new Date(gracePeriodEnd).toLocaleDateString()} to update your payment method.`}
            </p>
          </div>
          <button
            className="text-xs font-medium text-destructive underline underline-offset-2 flex-shrink-0"
            onClick={() => setShowAddCard(true)}
          >
            Fix now
          </button>
        </div>
      )}

      {/* ── Trial Credits Banner ── */}
      {trialCredits && !trialCredits.paymentMethodAdded && (
        <div className={`rounded-xl p-4 border ${trialCredits.limitReached ? "bg-destructive/8 border-destructive/30" : "bg-muted border-border"}`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {trialCredits.limitReached
                ? <XCircle className="w-4 h-4 text-destructive" />
                : trialCredits.warningThreshold
                ? <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                : <Gift className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold mb-1">
                {trialCredits.limitReached ? "Trial Credits Exhausted" : trialCredits.warningThreshold ? "Trial Credits Running Low" : "Free Trial Active"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {trialCredits.limitReached
                  ? `You've used all ${Math.round(Number(trialCredits.creditsLimit)).toLocaleString()} trial credits.`
                  : `${Math.round(Number(trialCredits.creditsUsed)).toLocaleString()} of ${Math.round(Number(trialCredits.creditsLimit)).toLocaleString()} credits used (${trialCredits.percentageUsed}%)`}
              </p>
              <div className="mt-2 bg-border rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full ${trialCredits.limitReached ? "bg-destructive" : "bg-foreground"}`}
                  style={{ width: `${Math.min(parseFloat(trialCredits.percentageUsed || "0"), 100)}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => { setCreditPurchaseMode("upgrade"); setShowCreditPurchaseModal(true) }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
                >
                  <Sparkles className="w-3 h-3" /> Upgrade Plan
                </button>
                <button
                  onClick={() => setShowAddCard(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                >
                  <Lock className="w-3 h-3" /> Add Card
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-2 space-y-6">

        {/* Current Plan */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold mb-5">Current Plan</h2>
          <div className="text-sm divide-y divide-border">
            <div className="flex justify-between pb-3">
              <span className="text-muted-foreground">Plan Type</span>
              <span className="font-medium">{userPlan?.plan?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Plan Pricing</span>
              <span className="font-medium">
                {userPlan?.plan?.id === 'free-trial' ? 'Free' : userPlan?.plan?.price ? `$${userPlan.plan.price}/mo` : '—'}
              </span>
            </div>
            {nextPaymentDue && userPlan?.plan?.id !== 'free-trial' ? (
              <div className="flex justify-between pt-3">
                <span className="text-muted-foreground">Next Charge</span>
                <span className="font-medium">{new Date(nextPaymentDue).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
            ) : <div />}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {userPlan?.plan?.id && userPlan.plan.id !== 'free-trial' && (
              <>
                {!cancelConfirm ? (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    className="px-3 py-1.5 text-sm border border-input rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    Cancel Plan
                  </button>
                ) : (
                  <div className="w-full rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                    <p className="text-xs text-muted-foreground mb-2">Your account moves to Free Trial. No further charges.</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCancelPlan}
                        disabled={cancelLoading}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-1"
                      >
                        {cancelLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                        Yes, cancel
                      </button>
                      <button onClick={() => setCancelConfirm(false)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-input hover:bg-muted">Keep plan</button>
                    </div>
                  </div>
                )}
                {!cancelConfirm && downgradePlans.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={downgradeTarget}
                      onChange={e => setDowngradeTarget(e.target.value)}
                      className="text-sm border border-input rounded-lg px-2.5 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Downgrade to…</option>
                      {downgradePlans.map(p => (
                        <option key={p} value={p}>{PLAN_LABELS[p] ?? p}</option>
                      ))}
                    </select>
                    {downgradeTarget && (
                      <button
                        onClick={handleDowngrade}
                        disabled={downgradeLoading}
                        className="text-sm px-3 py-1.5 border border-input rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {downgradeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Confirm
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {!cancelConfirm && (
              <button
                onClick={() => { setCreditPurchaseMode('upgrade'); setShowCreditPurchaseModal(true) }}
                className="text-sm text-primary hover:underline font-medium flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {userPlan?.plan?.id === 'free-trial' ? 'Upgrade Plan' : 'View Other Plans'}
              </button>
            )}
          </div>
        </div>

        {/* ── Auto Top-up ── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCcw className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Auto Top-up</span>
                {autoTopupSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground">Automatically buy more credits when your balance drops below a threshold. Prevents agents from going idle.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!autoTopup.enabled && paymentMethods.length === 0) {
                  toast({ title: 'No payment method', description: 'Add a card before enabling auto top-up.', variant: 'destructive', duration: 4000 })
                  return
                }
                const updated = { ...autoTopup, enabled: !autoTopup.enabled }
                setAutoTopup(updated)
                saveAutoTopup(updated)
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none mt-0.5 ${autoTopup.enabled ? 'bg-primary' : paymentMethods.length === 0 ? 'bg-muted-foreground/15 cursor-not-allowed' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${autoTopup.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {autoTopup.enabled && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Trigger when balance falls below</label>
                <select
                  value={autoTopup.threshold}
                  onChange={e => { const updated = { ...autoTopup, threshold: Number(e.target.value) }; setAutoTopup(updated); saveAutoTopup(updated) }}
                  className="w-full text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {[25, 50, 100, 200, 500].map(v => (
                    <option key={v} value={v}>{v} credits</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Top-up amount</label>
                <select
                  value={autoTopup.tierId}
                  onChange={e => { const updated = { ...autoTopup, tierId: e.target.value }; setAutoTopup(updated); saveAutoTopup(updated) }}
                  className="w-full text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="mini">Mini — 100 credits ($10)</option>
                  <option value="small">Small — 550 credits ($50)</option>
                  <option value="medium">Medium — 1,150 credits ($100)</option>
                  <option value="bulk">Bulk — 3,000 credits ($250)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ── Payment Methods ── */}
        <section id="payment-methods-section">
          <h2 className="text-base font-semibold mb-4">Payment Methods</h2>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive mb-4">{error}</div>
          )}
          <div className="flex flex-wrap gap-4 items-start">
            {paymentMethods.map((pm) => {
              const isExpired = pm.expYear < new Date().getFullYear() || (pm.expYear === new Date().getFullYear() && pm.expMonth < new Date().getMonth() + 1)
              const brandBg: Record<string, string> = {
                mastercard: 'bg-gradient-to-br from-gray-900 to-gray-700',
                visa:       'bg-gradient-to-br from-[#1a1f71] to-[#2d35a8]',
                amex:       'bg-gradient-to-br from-[#007ac1] to-[#005a8e]',
                discover:   'bg-gradient-to-br from-[#f76f20] to-[#e55c00]',
              }
              const bg = brandBg[pm.brand?.toLowerCase()] ?? 'bg-gradient-to-br from-gray-600 to-gray-800'
              return (
                <div key={pm.id} className="flex flex-col gap-2">
                  <div className={`${bg} rounded-xl w-48 h-28 p-4 flex flex-col justify-between shadow-sm relative`}>
                    {pm.isDefault && (
                      <span className="absolute top-2 right-2 text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-medium">Default</span>
                    )}
                    <span className="text-white/70 text-xs font-medium capitalize">{pm.brand}</span>
                    <div>
                      <p className="text-white text-sm tracking-widest font-mono">•••• {pm.last4}</p>
                      <p className="text-white/60 text-xs mt-0.5">
                        {isExpired ? <span className="text-red-300">Expired</span> : `Expires ${pm.expMonth}/${pm.expYear}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-1 text-xs">
                    {pm.isDefault
                      ? <span className="text-muted-foreground">✓ Default</span>
                      : <button onClick={() => handleSetDefault(pm.id)} className="text-primary hover:underline font-medium">Make Default</button>
                    }
                    <span className="text-border select-none">|</span>
                    <button onClick={() => handleRemoveCard(pm.id)} className="text-muted-foreground hover:text-destructive transition-colors">Remove</button>
                  </div>
                </div>
              )
            })}
            <button
              onClick={() => setShowAddCard(true)}
              className="w-48 h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-all"
            >
              <Plus className="w-6 h-6" />
              <span className="text-xs font-medium">Add a new card</span>
            </button>
          </div>
        </section>

        {/* ── Order History ── */}
        <section>
          <h2 className="text-base font-semibold mb-1">Order History</h2>
          <p className="text-xs text-muted-foreground mb-4">Your charges from plan upgrades and credit purchases.</p>
          <PaymentHistorySection />
        </section>

</div> {/* end left column */}

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">

        {/* Credits & Usage */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold mb-5">Credits & Usage</h2>
          <div className="text-sm divide-y divide-border">
            <div className="flex justify-between items-baseline pb-3">
              <span className="text-muted-foreground">Balance</span>
              {creditLoading
                ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                : <span className="text-3xl font-bold tabular-nums">{creditBalance.toLocaleString()}</span>
              }
            </div>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">Spent This Month</span>
              <span className="font-medium tabular-nums">{Math.round(creditsSpent).toLocaleString()} credits</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-muted-foreground">~Emails Available</span>
              <span className="font-medium tabular-nums">{Math.floor(creditBalance / 0.7).toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-3">
              <span className="text-muted-foreground">Rate</span>
              <span className="text-muted-foreground">1 credit = $0.05</span>
            </div>
          </div>
          {!creditLoading && creditBalance < 100 && creditBalance >= 0 && (
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {creditBalance === 0 ? 'No credits remaining.' : `Low balance — ${creditBalance} credits left.`}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => { setCreditPurchaseMode('topup'); setShowCreditPurchaseModal(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-input rounded-lg hover:bg-accent transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Buy Credits
            </button>
            <button
              onClick={() => { setCreditPurchaseMode('upgrade'); setShowCreditPurchaseModal(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Upgrade Plan
            </button>
          </div>
        </div>

        {/* ── API Cost Breakdown (static) ── */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">API Cost Breakdown</h2>
            {!creditLoading && (
              <span className="text-xs text-muted-foreground ml-auto">
                ${((apiStats.apollo?.cost ?? 0) + (apiStats.openai?.cost ?? 0) + (apiStats.mailgun?.cost ?? 0) + (apiStats.zerobounce?.cost ?? 0) + (apiStats.serper?.cost ?? 0)).toFixed(2)} total
              </span>
            )}
          </div>
          <div className="divide-y divide-border text-sm">
            {[
              { label: "Apollo",        cost: apiStats.apollo?.cost ?? 0,     detail: `${(apiStats.apollo?.calls ?? 0).toLocaleString()} lookups` },
              { label: "OpenAI",        cost: apiStats.openai?.cost ?? 0,     detail: `${((apiStats.openai?.tokens ?? 0) / 1000).toFixed(1)}k tokens` },
              { label: "Mailgun",       cost: apiStats.mailgun?.cost ?? 0,    detail: `${(apiStats.mailgun?.sent ?? 0).toLocaleString()} emails` },
              { label: "Email Validation", cost: apiStats.zerobounce?.cost ?? 0, detail: `${(apiStats.zerobounce?.validations ?? 0).toLocaleString()} checked` },
              { label: "Serper",        cost: apiStats.serper?.cost ?? 0,     detail: `${(apiStats.serper?.searches ?? 0).toLocaleString()} searches` },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{s.detail}</span>
                </div>
                <span className="font-semibold tabular-nums">${s.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Credits by Agent (static) ── */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Credits by Agent</h2>
            {!agentUsageLoading && agentUsage.length === 0 && (
              <button onClick={loadAgentUsage} className="ml-auto text-xs text-primary hover:underline">Load</button>
            )}
          </div>
          {agentUsageLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : agentUsage.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No agent usage data yet.</p>
          ) : (
            <div className="space-y-3">
              {agentUsage
                .sort((a, b) => b.credits - a.credits)
                .map(agent => {
                  const total = agentUsage.reduce((s, a) => s + a.credits, 0)
                  const pct = total > 0 ? Math.round((agent.credits / total) * 100) : 0
                  return (
                    <div key={agent.agentId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{agent.name}</span>
                        <span className="text-sm font-semibold tabular-nums">{agent.credits.toLocaleString()} credits</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{pct}% · ${agent.totalCost.toFixed(2)}</p>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        </div> {/* end right column */}
      </div> {/* end main grid */}

      {/* ── Credit Purchase Modal ── */}
      {showCreditPurchaseModal && (
        <CreditPurchaseModal
          mode={creditPurchaseMode}
          currentPlan={userPlan?.plan?.id}
          onClose={() => setShowCreditPurchaseModal(false)}
          onSuccess={() => {
            setShowCreditPurchaseModal(false)
            fetchCreditData()
            loadTrialCredits()
          }}
        />
      )}

      {/* ── Add Card Modal ── */}
      {showAddCard && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddCard(false)}
        >
          <div
            className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md p-6"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold">Add Payment Method</h3>
              </div>
              <button
                onClick={() => setShowAddCard(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <AddCardForm
              onSuccess={() => {
                setShowAddCard(false)
                loadPaymentMethods()
                loadTrialCredits()
                setTimeout(() => window.location.reload(), 800)
              }}
              onCancel={() => setShowAddCard(false)}
            />
          </div>
        </div>
      )}

    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export function BillingTab() {
  return (
    <Elements stripe={stripePromise}>
      <BillingTabInner />
    </Elements>
  )
}
