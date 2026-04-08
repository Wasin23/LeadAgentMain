"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { DollarSign, CheckCircle, XCircle, RefreshCw, Calendar, CreditCard, Plus, Trash2, Loader2, Sparkles, ChevronDown, ChevronUp, Zap, Mail, TrendingDown, AlertTriangle, Gift, Lock } from "lucide-react"
import api from "@/lib/api"
import { fetchDisplayedCreditData } from "@/lib/credit-balance"
import { CreditPurchaseModal } from "./credit-purchase-modal"

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

interface Payment {
  paymentId: string
  timestamp: string
  amount: number
  status: "success" | "failed" | "refunded"
  currency: string
  stripePaymentIntentId?: string
  billingPeriod: string
  description: string
  errorMessage?: string
}

interface ApiUsageStats {
  apollo?: { cost: number; calls: number }
  openai?: { cost: number; tokens: number }
  mailgun?: { cost: number; sent: number }
  zerobounce?: { cost: number; validations: number }
  serper?: { cost: number; searches: number }
  total?: { cost: number }
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Secure badge */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg py-2 px-4 border">
        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        <span>Secure payment powered by <strong>Stripe</strong></span>
      </div>

      {/* Cardholder name */}
      <div>
        <label className="block text-sm font-medium mb-2">Cardholder Name</label>
        <input
          type="text"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          placeholder="John Doe"
          required
          className="w-full px-3 py-2.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Card element */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Card Information</label>
          <div className="flex items-center gap-1.5">
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzAwNTJGRiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSI1IiBmaWxsPSIjRUIwMDFCIi8+CjxjaXJjbGUgY3g9IjIwIiBjeT0iMTAiIHI9IjUiIGZpbGw9IiNGRjVGMDAiLz4KPC9zdmc+" alt="Mastercard" className="h-5 w-auto" />
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzFBMUY3MSIvPgo8dGV4dCB4PSI1IiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSI+VklTQTwvdGV4dD4KPC9zdmc+" alt="Visa" className="h-5 w-auto" />
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAzMiAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjIwIiByeD0iMiIgZmlsbD0iIzAwNzlDMSIvPgo8dGV4dCB4PSI0IiB5PSIxNCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjciIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSJ3aGl0ZSI+QU1FWDwvdGV4dD4KPC9zdmc+" alt="Amex" className="h-5 w-auto" />
          </div>
        </div>
        <div className="p-3.5 rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
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
        <p className="text-xs text-muted-foreground mt-1.5">Card number, expiration date, and CVC all appear in this field</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
          <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={!stripe || !elements || loading || !cardholderName.trim() || !cardReady || !clientSecret}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
          ) : !clientSecret ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Loading...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Add Card Securely</>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-5 py-2.5 border border-input rounded-lg text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      <div className="rounded-md border bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Your payment is secure</p>
            <p>• Industry-standard encryption</p>
            <p>• Stripe handles all card data securely</p>
            <p>• We never store your full card number</p>
            <p>• PCI DSS Level 1 certified</p>
          </div>
        </div>
      </div>
    </form>
  )
}

// ── Payment History ───────────────────────────────────────────────────────────

function PaymentHistorySection() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all")

  useEffect(() => {
    fetchPaymentData()
  }, [])

  const fetchPaymentData = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await api.get("/api/billing/payment-history?limit=50")
      setPayments(data.payments || [])
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to load payment data")
    } finally { setLoading(false) }
  }

  const fmt = (amount: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  })

  const filteredPayments = payments.filter(p => filter === "all" || p.status === filter)

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
    </div>
  )

  if (error) return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
      <p className="text-sm text-destructive">{error}</p>
      <button onClick={fetchPaymentData} className="mt-2 text-xs text-destructive underline">Try again</button>
    </div>
  )

  return (
    <div className="space-y-6 mt-8">
      {/* Filter buttons */}
      <div className="flex items-center gap-2">
        {([["all", "All"], ["success", "Successful"], ["failed", "Failed"]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === val
                ? val === "success" ? "bg-green-600 text-white" : val === "failed" ? "bg-red-600 text-white" : "bg-purple-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {label} ({val === "all" ? payments.length : payments.filter(p => p.status === val).length})
          </button>
        ))}
      </div>

      {/* Payment table */}
      {filteredPayments.length === 0 ? (
        <div className="text-center py-12 rounded-lg border bg-muted/30">
          <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No purchases or payment attempts found</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/40">
                <tr>
                  {["Date", "Description", "Status", "Amount", "Details"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.timestamp)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {p.status === "success" ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> :
                         p.status === "failed"  ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> :
                                                  <RefreshCw className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                        <div>
                          <div className="text-sm">{p.description}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(p.billingPeriod).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "success" ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" :
                        p.status === "failed"  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" :
                                                 "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                      }`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">{fmt(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.status === "failed" && p.errorMessage ? (
                        <span className="text-red-500 max-w-xs truncate block" title={p.errorMessage}>{p.errorMessage}</span>
                      ) : p.stripePaymentIntentId ? (
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{p.stripePaymentIntentId.substring(0, 20)}…</code>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Billing Tab (inner) ───────────────────────────────────────────────────────

function BillingTabInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
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
  const [showCreditPurchaseModal, setShowCreditPurchaseModal] = useState(false)
  const [creditPurchaseMode, setCreditPurchaseMode] = useState<"upgrade" | "topup">("topup")
  const [creditLoading, setCreditLoading] = useState(true)

  const avgCreditsPerEmail = 0.7
  const estimatedEmailsAvailable = Math.floor(creditBalance / avgCreditsPerEmail)
  const estimatedEmailsPerDay = Math.floor(estimatedEmailsAvailable / 30)
  const estimatedEmailsPerWeek = Math.floor(estimatedEmailsAvailable / 4.33)

  useEffect(() => {
    loadPaymentMethods()
    loadTrialCredits()
    fetchCreditData()
  }, [])

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
    if (!confirm("Are you sure you want to remove this card?")) return
    try {
      await api.delete(`/api/billing/payment-methods/${id}`)
      setPaymentMethods(pm => pm.filter(m => m.id !== id))
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to remove card")
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await api.post("/api/billing/set-default-payment", { paymentMethodId: id })
      setPaymentMethods(pm => pm.map(m => ({ ...m, isDefault: m.id === id })))
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to set default card")
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ── Credit Balance Card ─────────────────────────────────────────── */}
      <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Plan badge */}
            {userPlan?.plan && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-foreground/15 rounded-full text-xs font-medium mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                {userPlan.plan.name}
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
                  { label: "Apollo",     cost: apiStats.apollo?.cost ?? 0,     detail: `${(apiStats.apollo?.calls ?? 0).toLocaleString()} calls` },
                  { label: "OpenAI",     cost: apiStats.openai?.cost ?? 0,     detail: `${((apiStats.openai?.tokens ?? 0) / 1000).toFixed(1)}k tokens` },
                  { label: "Mailgun",    cost: apiStats.mailgun?.cost ?? 0,    detail: `${(apiStats.mailgun?.sent ?? 0).toLocaleString()} emails sent` },
                  { label: "ZeroBounce", cost: apiStats.zerobounce?.cost ?? 0, detail: `${(apiStats.zerobounce?.validations ?? 0).toLocaleString()} validations` },
                  { label: "Serper",     cost: apiStats.serper?.cost ?? 0,     detail: `${(apiStats.serper?.searches ?? 0).toLocaleString()} searches` },
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
      <div className="flex items-center justify-between">
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

      {/* Payment History */}
      <PaymentHistorySection />
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
