"use client"

import { useState, useEffect } from "react"
import { DollarSign, CheckCircle, XCircle, RefreshCw, Loader2 } from "lucide-react"
import api from "@/lib/api"

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

export function PaymentHistorySection() {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Payment History</h3>
        {/* Filter buttons */}
        <div className="flex items-center gap-1.5">
          {([["all", "All"], ["success", "Paid"], ["failed", "Failed"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === val
                  ? val === "success" ? "bg-green-600 text-white" : val === "failed" ? "bg-red-600 text-white" : "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {label} ({val === "all" ? payments.length : payments.filter(p => p.status === val).length})
            </button>
          ))}
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <div className="text-center py-10 rounded-lg border bg-muted/30">
          <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No payments yet</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/40">
                <tr>
                  {["Date", "Description", "Status", "Amount"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPayments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.timestamp)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {p.status === "success" ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> :
                         p.status === "failed"  ? <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /> :
                                                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                        <div>
                          <div className="text-sm">{p.description}</div>
                          {p.status === "failed" && p.errorMessage && (
                            <div className="text-xs text-red-500 mt-0.5 max-w-xs truncate">{p.errorMessage}</div>
                          )}
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
