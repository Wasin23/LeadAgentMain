"use client"

import { useState, useEffect } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { DollarSign, CheckCircle, XCircle, RefreshCw, Calendar, CreditCard, Plus, Trash2, Loader2, Sparkles, ChevronDown, ChevronUp, Zap, Mail, TrendingDown, AlertTriangle, Gift, Lock } from "lucide-react"
import api from "@/lib/api"
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

interface PaymentStats {
  totalPaid: number
  totalFailed: number
  outstanding: number
  successCount: number
  failedCount: number
  lastSuccessfulPayment?: Payment
  lastFailedPayment?: Payment
  nextBillingDate?: string
}

interface HistoricalData {
  date: string
  tokens: number
  cost: number
  credits: number
  label: string
}

type TimeFilter = "hour" | "day" | "month"

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
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all")
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([])
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("day")
  const [hoveredBar, setHoveredBar] = useState<{ index: number; cost: number; x: number; y: number } | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  useEffect(() => {
    fetchPaymentData()
    fetchHistoricalData("day")
  }, [])

  useEffect(() => { fetchHistoricalData(timeFilter) }, [timeFilter])

  const fetchHistoricalData = async (tf: TimeFilter) => {
    try {
      const params = tf === "hour"
        ? { days: 1, interval: "hour" }
        : tf === "month"
        ? { days: 365, interval: "month" }
        : { days: 365, interval: "day" }
      const res = await api.get("/api/lead-agent/api-usage/timeseries", { params })
      if (res.data.success && res.data.series) {
        setHistoricalData(res.data.series.map((item: any) => {
          const dateStr = item.sortKey.split("T")[0]
          const day = dateStr.split("-")[2]
          const cost = item.total?.cost || 0
          return { date: dateStr, label: tf === "day" ? day : item.date, tokens: item.totalCalls || 0, cost, credits: cost / 0.05 }
        }))
      } else { setHistoricalData([]) }
    } catch { setHistoricalData([]) }
  }

  const fetchPaymentData = async () => {
    setLoading(true); setError(null)
    try {
      const [histRes, statsRes] = await Promise.all([
        api.get("/api/billing/payment-history?limit=50"),
        api.get("/api/billing/payment-stats"),
      ])
      setPayments(histRes.data.payments || [])
      setStats(statsRes.data.stats)
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
      <h3 className="text-base font-semibold">Payment History</h3>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">Total Paid</p>
                <p className="text-xl font-bold text-green-800 dark:text-green-300">{fmt(stats.totalPaid)}</p>
              </div>
              <CheckCircle className="w-7 h-7 text-green-500" />
            </div>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">{stats.successCount} successful</p>
          </div>

          <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">Outstanding</p>
                <p className="text-xl font-bold text-orange-800 dark:text-orange-300">{fmt(stats.outstanding || 0)}</p>
              </div>
              <DollarSign className="w-7 h-7 text-orange-500" />
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
              {stats.nextBillingDate
                ? `Next: ${new Date(stats.nextBillingDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : "Unpaid usage"}
            </p>
          </div>

          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-700 dark:text-red-400 font-medium">Failed</p>
                <p className="text-xl font-bold text-red-800 dark:text-red-300">{fmt(stats.totalFailed)}</p>
              </div>
              <XCircle className="w-7 h-7 text-red-500" />
            </div>
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">{stats.failedCount} failed attempts</p>
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Success Rate</p>
                <p className="text-xl font-bold text-blue-800 dark:text-blue-300">
                  {stats.successCount + stats.failedCount > 0
                    ? Math.round((stats.successCount / (stats.successCount + stats.failedCount)) * 100)
                    : 0}%
                </p>
              </div>
              <DollarSign className="w-7 h-7 text-blue-500" />
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">Payment reliability</p>
          </div>

          <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-700 dark:text-purple-400 font-medium">Last Payment</p>
                <p className="text-lg font-bold text-purple-800 dark:text-purple-300">
                  {stats.lastSuccessfulPayment ? fmt(stats.lastSuccessfulPayment.amount) : "N/A"}
                </p>
              </div>
              <Calendar className="w-7 h-7 text-purple-500" />
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-500 mt-1">
              {stats.lastSuccessfulPayment
                ? new Date(stats.lastSuccessfulPayment.timestamp).toLocaleDateString()
                : "No payments yet"}
            </p>
          </div>
        </div>
      )}

      {/* Cost Over Time Chart */}
      {historicalData.length > 0 && (
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold">Credits Spent Over Time</h4>
            <div className="flex gap-2 items-center flex-wrap">
              {timeFilter === "day" && (
                <input
                  type="month"
                  value={selectedMonth}
                  min="2025-01"
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-md border border-input bg-background hover:bg-accent transition-colors cursor-pointer"
                />
              )}
              <div className="flex gap-1">
                {(["hour", "day", "month"] as TimeFilter[]).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeFilter(tf)}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${timeFilter === tf ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                  >
                    {tf.charAt(0).toUpperCase() + tf.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {timeFilter === "day" && (
            <div className="text-center mb-2 text-xs font-semibold text-muted-foreground">
              {(() => {
                const [y, m] = selectedMonth.split("-")
                const names = ["January","February","March","April","May","June","July","August","September","October","November","December"]
                return `${names[parseInt(m) - 1]} ${y}`
              })()}
            </div>
          )}
          <div className="relative h-64">
            <svg className="w-full h-full" viewBox="0 0 1400 256">
              {(() => {
                const fd = historicalData.filter(d => timeFilter !== "day" || d.date.startsWith(selectedMonth))
                const maxCredits = Math.max(...fd.map(d => d.credits)) || 1
                const yMax = Math.ceil(maxCredits / 5) * 5 || 5
                const yStep = yMax / 4
                return (
                  <>
                    {[0, 1, 2, 3, 4].map(i => (
                      <text key={i} x="10" y={240 - i * 50} fontSize="11" fill="currentColor" opacity="0.5">{(i * yStep).toFixed(1)}cr</text>
                    ))}
                    {fd.map((d, i) => {
                      const bw = 1340 / fd.length
                      const x = 50 + i * bw
                      const bh = (d.credits / yMax) * 200
                      const y = 220 - bh
                      return (
                        <g key={i}>
                          <rect x={x} y={y} width={bw * 0.8} height={bh} fill="#9333ea" opacity={hoveredBar?.index === i ? 1 : 0.75} rx="2"
                            onMouseEnter={() => setHoveredBar({ index: i, cost: d.credits, x: x + bw * 0.4, y })}
                            onMouseLeave={() => setHoveredBar(null)}
                            style={{ cursor: "pointer" }}
                          />
                          <text x={x + bw * 0.4} y="245" fontSize="10" fill="currentColor" opacity="0.5" textAnchor="middle">{d.label}</text>
                        </g>
                      )
                    })}
                  </>
                )
              })()}
            </svg>
            {hoveredBar && (
              <div
                className="absolute bg-popover text-popover-foreground border px-2 py-1 rounded text-xs font-semibold pointer-events-none z-50 whitespace-nowrap shadow"
                style={{ left: `${(hoveredBar.x / 1400) * 100}%`, top: `${(hoveredBar.y / 256) * 100}%`, transform: "translate(-50%, -120%)" }}
              >
                {hoveredBar.cost.toFixed(2)} credits
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t flex justify-between text-xs">
            <span className="text-muted-foreground">Total spent</span>
            <span className="font-semibold">{historicalData.reduce((s, d) => s + d.credits, 0).toFixed(1)} credits</span>
          </div>
        </div>
      )}

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
          <p className="text-sm text-muted-foreground">No payment history found</p>
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
  const [creditLoading, setCreditLoading] = useState(true)

  const avgCreditsPerEmail = 1
  const estimatedEmailsAvailable = Math.floor(creditBalance / avgCreditsPerEmail)
  const estimatedEmailsPerDay = Math.floor(estimatedEmailsAvailable / 30)
  const estimatedEmailsPerWeek = Math.floor(estimatedEmailsAvailable / 4.33)

  useEffect(() => {
    loadPaymentMethods()
    loadTrialCredits()
    fetchCreditData()
  }, [])

  const fetchCreditData = async () => {
    setCreditLoading(true)
    try {
      let balance = 0

      // 1. Trial credits
      try {
        const { data } = await api.get("/api/billing/trial-credits")
        if (data.success) {
          setTrialCredits(data.credits)
          balance += Number(data.credits?.creditsRemaining ?? 0)
        }
      } catch {}

      // 2. Plan credits
      try {
        const { data } = await api.get("/api/plans/status")
        if (data.success) {
          setUserPlan(data)
          balance += Number(data.plan?.remainingCredits ?? 0)
        }
      } catch {}

      // 3. Purchased credit balance
      try {
        const { data } = await api.get("/api/billing/credit-balance")
        if (data.success) balance += Number(data.balance ?? 0)
      } catch {}

      const total = Math.round(balance)
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

            {/* Buy more credits */}
            <button
              onClick={() => setShowCreditPurchaseModal(true)}
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
          mode="topup"
          currentPlan={userPlan?.plan?.id}
          onClose={() => setShowCreditPurchaseModal(false)}
          onSuccess={() => {
            setShowCreditPurchaseModal(false)
            fetchCreditData()
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
                  ? `You've used all $${trialCredits.creditsLimit} of your trial credits. Add a payment method below to continue using the platform.`
                  : `You've used $${trialCredits.creditsUsed} of your $${trialCredits.creditsLimit} trial credits (${trialCredits.percentageUsed}%). Add a payment method to unlock unlimited API usage.`}
              </p>
              <div className="mt-2 bg-border rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all ${trialCredits.limitReached ? "bg-destructive" : "bg-foreground"}`}
                  style={{ width: `${Math.min(parseFloat(trialCredits.percentageUsed || "0"), 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Payment Methods</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your credit cards for API usage billing</p>
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
          Token-Based Billing
        </h3>
        <p className="text-xs text-muted-foreground">
          You'll only be charged for actual API usage (Apollo credits, OpenAI tokens, etc.).
          Your card is securely stored with Stripe and will be charged monthly based on consumption.
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
            <p className="text-xs text-muted-foreground mt-1">Add a card to start using API services</p>
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
