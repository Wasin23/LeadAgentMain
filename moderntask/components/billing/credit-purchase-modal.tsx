"use client"

import React, { useState, useEffect } from "react"
import { X, Sparkles, Check, Plus, Loader2 } from "lucide-react"
import api from "@/lib/api"
import { PaymentHistorySection } from "./payment-history-section"

interface CreditPurchaseModalProps {
  onClose: () => void
  onSuccess: () => void
  mode?: "upgrade" | "topup"
  currentPlan?: string
}

interface PricingTier {
  id: string
  name: string
  price: number
  credits: number
  bonus?: number
  popular?: boolean
  emails: number
  features: string[]
}

interface TopupOption {
  id: string
  name: string
  price: number
  credits: number
  popular?: boolean
}

export function CreditPurchaseModal({
  onClose,
  onSuccess,
  mode = "upgrade",
  currentPlan,
}: CreditPurchaseModalProps) {
  const [selectedTier, setSelectedTier] = useState<string>(mode === "upgrade" ? "team" : "small")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userPlanInfo, setUserPlanInfo] = useState<any>(null)
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null)

  const pricingTiers: PricingTier[] = [
    {
      id: "solo",
      name: "Solo",
      price: 100,
      credits: 1100,
      emails: 2025,
      features: ["1,100 credits included", "~2,025 emails", "2 agents", "4x speed"],
    },
    {
      id: "team",
      name: "Team",
      price: 250,
      credits: 2800,
      emails: 5065,
      popular: true,
      features: ["2,800 credits included", "~5,065 emails", "6 agents", "8x speed"],
    },
    {
      id: "agency",
      name: "Agency",
      price: 500,
      credits: 5500,
      emails: 10135,
      features: ["5,500 credits included", "~10,135 emails", "15 agents", "12x speed"],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 0,
      credits: 0,
      emails: 0,
      features: ["Custom credit volume", "Custom email volume", "Up to 30 agents", "Up to 30x speed"],
    },
  ]

  const topupOptions: TopupOption[] = [
    { id: "mini",   name: "Mini Top-up",   price: 10,  credits: 100  },
    { id: "small",  name: "Small Top-up",  price: 50,  credits: 550  },
    { id: "medium", name: "Medium Top-up", price: 100, credits: 1150, popular: true },
    { id: "bulk",   name: "Bulk Top-up",   price: 250, credits: 3000 },
  ]

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    api.get("/api/plans/status")
      .then(({ data }) => { if (data.success) setUserPlanInfo(data) })
      .catch(() => {})
    api.get("/api/billing/payment-methods")
      .then(({ data }) => { setHasPaymentMethod((data?.paymentMethods?.length ?? 0) > 0) })
      .catch(() => {})
  }, [])

  const handlePurchase = async () => {
    const isUpgrade = mode === "upgrade"
    const options = isUpgrade ? pricingTiers : topupOptions
    const selectedOption = options.find((t) => t.id === selectedTier)
    if (!selectedOption) return

    setLoading(true)
    setError(null)
    try {
      const { data } = isUpgrade
        ? await api.post("/api/plans/upgrade", {
            planType: selectedOption.id,
          })
        : await api.post("/api/plans/purchase-credits", {
            creditAmount: selectedOption.credits,
          })
      if (data.success) {
        onSuccess()
      } else {
        throw new Error(data.error || "Purchase failed")
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || "Failed to purchase credits")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-md border-b border-border p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-muted-foreground" />
              {mode === "upgrade" ? "Upgrade Plan" : "Buy More Credits"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "upgrade" ? "Pick the plan that matches your expected monthly volume." : "Add more credits to your existing plan"}
            </p>
            {mode === "topup" && userPlanInfo?.plan && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-muted border border-border rounded-full">
                <Check className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-foreground font-medium">
                  Current Plan: {userPlanInfo.plan.name}
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-7 h-7" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Upgrade plans */}
          {mode === "upgrade" && (
            <>
              <h3 className="text-base font-semibold mb-4">Upgrade Options</h3>
              <div className="grid gap-5 mb-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {pricingTiers.map((tier, i) => {
                  const isCurrent = currentPlan === tier.id
                  const isSelected = selectedTier === tier.id
                  return (
                    <div
                      key={tier.id}
                      onClick={() => tier.id !== "enterprise" && setSelectedTier(tier.id)}
                      className={`relative rounded-xl p-6 border-2 transition-all ${
                        tier.id === "enterprise"
                          ? "border-border bg-muted/20 cursor-default opacity-80"
                          : isSelected
                          ? "border-primary bg-primary/5 cursor-pointer"
                          : isCurrent
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20 cursor-pointer"
                          : "border-border bg-muted/30 hover:border-muted-foreground/40 cursor-pointer"
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full flex items-center gap-1 whitespace-nowrap">
                            <Check className="w-3 h-3" /> Current Plan
                          </span>
                        </div>
                      )}
                      {tier.popular && !isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full whitespace-nowrap">
                            Most Popular
                          </span>
                        </div>
                      )}
                      <div className="text-center">
                        <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                        <div className="mb-4">
                          {tier.id === "enterprise" ? (
                            <span className="text-4xl font-bold">Custom</span>
                          ) : (
                            <>
                              <span className="text-4xl font-bold">${tier.price}</span>
                              <span className="text-sm text-muted-foreground ml-1">/mo</span>
                            </>
                          )}
                        </div>
                        <div className="mb-5">
                          {tier.id === "enterprise" ? (
                            <>
                              <div className="text-2xl font-bold">-</div>
                              <div className="text-sm text-muted-foreground">credits</div>
                            </>
                          ) : (
                            <>
                              <div className="text-3xl font-bold">{tier.credits.toLocaleString()}</div>
                              <div className="text-sm text-muted-foreground">credits · ~{tier.emails.toLocaleString()} emails</div>
                            </>
                          )}
                        </div>
                        <ul className="space-y-2.5 text-left">
                          {tier.features.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                        {tier.id === "enterprise" && (
                          <a
                            href="mailto:colton.fidd@gmail.com?subject=Meridian%20Enterprise"
                            onClick={e => e.stopPropagation()}
                            className="mt-4 inline-block w-full py-2 text-xs font-semibold border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                          >
                            Contact us
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="bg-muted/50 border border-border rounded-lg p-4 mb-8">
                <h4 className="font-semibold mb-2">What these limits mean</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Agent:</strong> an agent is one AI outbound worker with its own targeting, settings, and sending behavior. More agents let you run separate outreach strategies at the same time.
                  </p>
                  <p>
                    <strong className="text-foreground">Speed:</strong> how many leads one agent researches in parallel. Higher speed means faster outreach, but burns through credits more quickly.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Top-up options */}
          {mode === "topup" && <div className="grid gap-4 mb-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {topupOptions.map((tier, i) => {
              const isSelected = selectedTier === tier.id
              return (
                <div
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`relative cursor-pointer rounded-xl p-5 border-2 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/30 hover:border-muted-foreground/40"
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full whitespace-nowrap">Popular</span>
                    </div>
                  )}
                  <div className="text-center">
                    <h3 className="text-base font-bold mb-2 flex items-center justify-center gap-1.5">
                      {mode === "topup" && <Plus className="w-4 h-4 text-muted-foreground" />}
                      {tier.name}
                    </h3>
                    <div className="mb-3">
                      <span className="text-3xl font-bold">${tier.price}</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-center gap-1.5 text-sm font-semibold">
                        <Check className="w-4 h-4 text-muted-foreground" />
                        {tier.credits.toLocaleString()} credits
                      </div>
  
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>}

          {/* Info box */}
          <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              {mode === "upgrade" ? "How Credits Work" : "About Additional Credits"}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>~0.54 credits per email</strong> (research, enrichment, validation, and send)</li>
              <li>• Credits never expire and roll over month-to-month</li>
              {mode === "topup" && <li>• <strong>Top-ups are added instantly</strong> to your current balance</li>}
              {mode === "upgrade" && <li>• Plan upgrades take effect immediately</li>}
              <li>• Track exact usage in real-time on your dashboard</li>
            </ul>
          </div>

          {hasPaymentMethod === false && (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 mb-5">
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                No payment method on file. Please add a card in <strong>Settings → Billing</strong> before purchasing.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/8 border border-destructive/30 rounded-lg p-4 mb-5">
              <p className="text-sm text-destructive">Error: {error}</p>
            </div>
          )}

          <button
            onClick={handlePurchase}
            disabled={loading || hasPaymentMethod === false || selectedTier === "enterprise"}
            className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </span>
            ) : (
              (() => {
                const options = mode === "upgrade" ? pricingTiers.filter(t => t.id !== "enterprise") : topupOptions
                const sel = options.find((t) => t.id === selectedTier)
                if (!sel) return "Select a plan above"
                return mode === "upgrade"
                  ? `Upgrade to ${sel.name} - ${sel.credits.toLocaleString()} Credits Included`
                  : `Add ${sel.credits.toLocaleString()} Credits for $${sel.price}`
              })()
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground mt-3">
            Secure payment processed by Stripe. Credits added instantly to your account.
          </p>

          {/* Payment History */}
          <div className="mt-8 border-t pt-6">
            <PaymentHistorySection />
          </div>
        </div>
      </div>
    </div>
  )
}
