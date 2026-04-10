"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, CardElement, useStripe, useElements, PaymentRequestButtonElement } from "@stripe/react-stripe-js"
import type { PaymentRequest } from "@stripe/stripe-js"
import { Calendar, CreditCard, Plus, Trash2, Loader2, Sparkles, ChevronDown, ChevronUp, Zap, Mail, TrendingDown, AlertTriangle, Gift, Lock, Users, RefreshCcw, XCircle } from "lucide-react"
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Wallet Pay (Apple Pay / Google Pay) */}
      <WalletPayButton onSuccess={onSuccess} />

      {/* Cardholder name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium">Name on card</label>
        <input
          type="text"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder="Full name"
          required
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
        />
      </div>

      {/* Card element */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Card details</label>
          <div className="flex items-center gap-1.5">
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzAwNTJGRiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSI1IiBmaWxsPSIjRUIwMDFCIi8+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMTAiIHI9IjUiIGZpbGw9IiNGRjVGMDAiLz4KPC9zdmc+" alt="Mastercard" className="h-4 w-auto opacity-80" />
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzFBMUY3MSIvPgo8dGV4dCB4PSI1IiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSI+VklTQTwvdGV4dD4KPC9zdmc+" alt="Visa" className="h-4 w-auto opacity-80" />
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzAwNzlDMSIvPgo8dGV4dCB4PSI0IiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjciIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSI+QU1FWDwvdGV4dD4KPC9zdmc+" alt="Amex" className="h-4 w-auto opacity-80" />
          </div>
        </div>
        <div className="px-3 py-3 rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring transition">
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

      {/* Submit */}
      <button
        type="submit"
        disabled={!stripe || !elements || loading || !cardholderName.trim() || !cardReady || !clientSecret}
        className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
        ) : !clientSecret ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Loading...</>
        ) : (
          "Save Card"
        )}
      </button>

      {/* Cancel */}
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50"
      >
        Cancel
      </button>

      {/* Powered by Stripe */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-1">
        <Lock className="w-3 h-3" />
        <span>Secured by <strong>Stripe</strong></span>
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

  return (
    <div className="space-y-6">

      {/* ── Payment Failed Banner ───────────────────────────────────────── */}
      {paymentStatus === 'payment_failed' && (
        <div className="flex items-start gap-3 rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-destructive">Payment failed</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              We couldn't process your last payment.
              {gracePeriodEnd && ` You have until ${new Date(gracePeriodEnd).toLocaleDateString()} to update your payment method before your account is suspended.`}
            </p>
          </div>
          <button
            className="text-xs font-medium text-destructive underline underline-offset-2 flex-shrink-0"
            onClick={() => document.getElementById('payment-methods-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Fix now
          </button>
        </div>
      )}

      {/* ── Credit Balance Card ─────────────────────────────────────────── */}
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Plan badge */}
            {userPlan?.plan && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-foreground/15 rounded-full text-xs font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  {userPlan.plan.name}
                </div>
                {nextPaymentDue && userPlan.plan.id !== 'free-trial' && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-foreground/10 rounded-full text-xs text-primary-foreground/70">
                    <Calendar className="w-3 h-3" />
                    Next charge {new Date(nextPaymentDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </div>
            )}

            {/* Balance */}
            <div className="mb-1">
              {creditLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin opacity-50" />
                  <span className="text-2xl font-bold opacity-50">Loading...</span>
                </div>
              ) : (
                <span className="text-5xl font-bold tabular-nums">
                  {creditBalance.toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-sm text-primary-foreground/70 mb-1">credits remaining</p>
            <p className="text-xs text-primary-foreground/50">1 credit = $0.05 in API costs</p>

            {/* Email estimate */}
            <div className="mt-3 flex items-center gap-1.5 text-sm text-primary-foreground/70">
              <Mail className="w-4 h-4 text-primary-foreground/50" />
              ≈ {estimatedEmailsAvailable.toLocaleString()} emails available
            </div>
          </div>

          {/* Right column */}
          <div className="ml-4 flex flex-col items-end gap-3">
            {/* Credits spent */}
            <div className="text-right">
              <div className="text-xs text-primary-foreground/50 mb-0.5">Credits Spent This Month</div>
              <div className="text-xl font-bold">{Math.round(creditsSpent).toLocaleString()}</div>
              <div className="text-xs text-primary-foreground/50">${(creditsSpent * 0.05).toFixed(2)} in API costs</div>
            </div>

            {/* Upgrade plan */}
            <button
              onClick={() => {
                setCreditPurchaseMode("upgrade")
                setShowCreditPurchaseModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-foreground/20 hover:bg-primary-foreground/30 border border-primary-foreground/30 rounded-lg text-sm font-semibold transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade Plan
            </button>
            {/* Buy more credits */}
            <button
              onClick={() => {
                setCreditPurchaseMode("topup")
                setShowCreditPurchaseModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-foreground/10 hover:bg-primary-foreground/20 border border-primary-foreground/20 rounded-lg text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              Buy More Credits
            </button>
          </div>
        </div>

        {/* Low balance warning */}
        {!creditLoading && creditBalance < 100 && creditBalance >= 0 && (
          <div className="mt-4 flex items-center gap-2 bg-destructive/20 border border-destructive/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-destructive-foreground flex-shrink-0" />
            <p className="text-xs text-primary-foreground/80">
              {creditBalance === 0
                ? "You have no credits remaining. Add more to continue sending emails."
                : `Low balance — only ${creditBalance} credits left. Buy more to avoid interruptions.`}
            </p>
          </div>
        )}
      </div>

      {/* ── Email Capacity Estimates ────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Mail,     label: "emails / day",   value: estimatedEmailsPerDay },
          { icon: Calendar, label: "emails / week",  value: estimatedEmailsPerWeek },
          { icon: Zap,      label: "total available", value: estimatedEmailsAvailable },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-4 text-center">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted mx-auto mb-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Auto Top-up ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5">
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

      {/* ── Cost Breakdown Accordion ────────────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <button
          onClick={() => setShowCostBreakdown(!showCostBreakdown)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">API Cost Breakdown</span>
            {!creditLoading && (
              <span className="text-xs text-muted-foreground ml-1">
                ${((apiStats.apollo?.cost ?? 0) + (apiStats.openai?.cost ?? 0) + (apiStats.mailgun?.cost ?? 0) + (apiStats.zerobounce?.cost ?? 0) + (apiStats.serper?.cost ?? 0)).toFixed(2)} total
              </span>
            )}
          </div>
          {showCostBreakdown ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

          {showCostBreakdown && (
            <div className="overflow-hidden">
              <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Apollo (lead sourcing)",        cost: apiStats.apollo?.cost ?? 0,     detail: `${(apiStats.apollo?.calls ?? 0).toLocaleString()} lead lookups` },
                  { label: "OpenAI (AI writing)",           cost: apiStats.openai?.cost ?? 0,     detail: `${((apiStats.openai?.tokens ?? 0) / 1000).toFixed(1)}k tokens` },
                  { label: "Mailgun (email sending)",       cost: apiStats.mailgun?.cost ?? 0,    detail: `${(apiStats.mailgun?.sent ?? 0).toLocaleString()} emails sent` },
                  { label: "Email Validation",              cost: apiStats.zerobounce?.cost ?? 0, detail: `${(apiStats.zerobounce?.validations ?? 0).toLocaleString()} addresses checked` },
                  { label: "Web Research (Serper)",         cost: apiStats.serper?.cost ?? 0,     detail: `${(apiStats.serper?.searches ?? 0).toLocaleString()} searches` },
                ].map((service) => (
                  <div key={service.label} className="rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{service.label}</span>
                      <span className="text-sm font-bold">${service.cost.toFixed(2)}</span>
                    </div>
                    <div className="text-xs mt-1 text-muted-foreground">{service.detail}</div>
                    <div className="text-xs mt-0.5 text-muted-foreground">{Math.round(service.cost / 0.05)} credits</div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* ── Per-Agent Breakdown Accordion ───────────────────────────────── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <button
          onClick={() => {
            setShowAgentBreakdown(v => !v)
            if (!showAgentBreakdown && agentUsage.length === 0) loadAgentUsage()
          }}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Credits by Agent</span>
            <span className="text-xs text-muted-foreground ml-1">see which agent is spending the most</span>
          </div>
          {showAgentBreakdown ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showAgentBreakdown && (
          <div className="px-5 pb-5">
            {agentUsageLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : agentUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No agent usage data yet.</p>
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
                        <p className="text-xs text-muted-foreground mt-0.5">{pct}% of total · ${agent.totalCost.toFixed(2)} in API costs</p>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}
      </div>
      {/* ── Plan Management ─────────────────────────────────────────────── */}
      {userPlan?.plan?.id && userPlan.plan.id !== 'free-trial' && (() => {
        const currentIdx = PLAN_ORDER.indexOf(userPlan.plan.id)
        const downgradePlans = PLAN_ORDER.slice(1, currentIdx)
        return (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold">Manage Plan</h3>
                {nextPaymentDue && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Next renewal: {new Date(nextPaymentDue!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>

            {/* Downgrade */}
            {downgradePlans.length > 0 && (
              <div className="mb-4">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Downgrade to a lower plan</label>
                <p className="text-xs text-muted-foreground mb-2">No charge — your existing credits are kept. New agent and speed limits apply immediately.</p>
                <div className="flex items-center gap-2">
                  <select
                    value={downgradeTarget}
                    onChange={e => setDowngradeTarget(e.target.value)}
                    className="flex-1 text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">Select a plan…</option>
                    {downgradePlans.map(p => (
                      <option key={p} value={p}>{PLAN_LABELS[p] ?? p}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleDowngrade}
                    disabled={!downgradeTarget || downgradeLoading}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-input bg-background hover:bg-muted disabled:opacity-40 transition-colors flex items-center gap-1.5"
                  >
                    {downgradeLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirm Downgrade
                  </button>
                </div>
              </div>
            )}

            {/* Cancel plan */}
            <div className="border-t pt-4">
              {!cancelConfirm ? (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="text-sm text-destructive/70 hover:text-destructive underline underline-offset-2 transition-colors"
                >
                  Cancel plan
                </button>
              ) : (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                  <p className="text-sm font-medium mb-1">Cancel your plan?</p>
                  <p className="text-xs text-muted-foreground mb-3">Your account will be moved to Free Trial (1 agent, 5x speed). No further monthly charges will apply.</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancelPlan}
                      disabled={cancelLoading}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                      {cancelLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Yes, cancel plan
                    </button>
                    <button
                      onClick={() => setCancelConfirm(false)}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-input hover:bg-muted transition-colors"
                    >
                      Keep plan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
      {/* ── CreditPurchaseModal ─────────────────────────────────────────── */}
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

      {/* Trial Credits Banner */}
      {trialCredits && !trialCredits.paymentMethodAdded && (
        <div className={`rounded-lg p-4 border ${
          trialCredits.limitReached
            ? "bg-destructive/8 border-destructive/30"
            : trialCredits.warningThreshold
            ? "bg-muted border-border"
            : "bg-muted border-border"
        }`}>
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
                  ? `You've used all ${Math.round(Number(trialCredits.creditsLimit)).toLocaleString()} trial credits. Add a payment method to upgrade your plan or buy more credits.`
                  : `You've used ${Math.round(Number(trialCredits.creditsUsed)).toLocaleString()} of ${Math.round(Number(trialCredits.creditsLimit)).toLocaleString()} trial credits (${trialCredits.percentageUsed}%), equal to $${(Number(trialCredits.creditsUsed) * 0.05).toFixed(2)} in API costs.`}
              </p>
              <div className="mt-2 bg-border rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all ${trialCredits.limitReached ? "bg-destructive" : "bg-foreground"}`}
                  style={{ width: `${Math.min(parseFloat(trialCredits.percentageUsed || "0"), 100)}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreditPurchaseMode("upgrade")
                    setShowCreditPurchaseModal(true)
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background transition-colors hover:opacity-90"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Upgrade Plan
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCard(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Add Payment Method
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div id="payment-methods-section" className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Payment Methods</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage cards used for plan upgrades and credit purchases</p>
        </div>
        {!showAddCard && (
          <button
            onClick={() => setShowAddCard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Card
          </button>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
          Prepaid Credit Billing
        </h3>
        <p className="text-xs text-muted-foreground">
          Meridian uses prepaid credits. Add a card to upgrade your plan or buy more credits when your balance runs low.
          Your card is securely stored with Stripe and only used when you make a purchase.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}

      {/* Add card form */}
      {showAddCard && (
        <div className="rounded-xl border-2 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-base font-bold">Add Payment Method</h3>
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
      )}

      {/* Payment methods list */}
      <div className="space-y-3">
        {paymentMethods.length === 0 ? (
          <div className="text-center py-12 rounded-lg border bg-muted/20">
            <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No payment methods added yet</p>
            <p className="text-xs text-muted-foreground mt-1">Add a card to upgrade plans or buy more credits</p>
          </div>
        ) : (
          paymentMethods.map((pm) => (
            <div
              key={pm.id}
              className={`rounded-lg border p-4 flex items-center justify-between ${pm.isDefault ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" : "bg-card"}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${pm.isDefault ? "bg-blue-600" : "bg-muted"}`}>
                  <CreditCard className={`w-5 h-5 ${pm.isDefault ? "text-white" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium capitalize">{pm.brand} •••• {pm.last4}</p>
                    {pm.isDefault && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full font-medium">Default</span>
                    )}
                    {(pm.expYear < new Date().getFullYear() || (pm.expYear === new Date().getFullYear() && pm.expMonth < new Date().getMonth() + 1)) && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-xs rounded-full font-medium border border-red-200 dark:border-red-800">Expired</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Expires {pm.expMonth}/{pm.expYear}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!pm.isDefault && (
                  <button
                    onClick={() => handleSetDefault(pm.id)}
                    className="px-3 py-1.5 text-xs border border-input rounded-lg hover:bg-accent font-medium transition-colors"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleRemoveCard(pm.id)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  title="Remove card"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

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
