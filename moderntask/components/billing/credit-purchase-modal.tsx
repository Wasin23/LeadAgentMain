"use client"

import React, { useState, useEffect } from "react"
import { X, Sparkles, Check, Plus, Loader2 } from "lucide-react"
import api from "@/lib/api"

interface CreditPurchaseModalProps {
  onClose: () => void
  onSuccess: () => void
  mode?: "onboarding" | "topup"
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
  mode = "onboarding",
  currentPlan,
}: CreditPurchaseModalProps) {
  const [selectedTier, setSelectedTier] = useState<string>(mode === "onboarding" ? "growth" : "small")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userPlanInfo, setUserPlanInfo] = useState<any>(null)

  const pricingTiers: PricingTier[] = [
    {
      id: "starter",
      name: "Starter",
      price: 500,
      credits: 10000,
      emails: 15000,
      features: ["10,000 credits", "~15,000 emails", "Basic AI features", "Email support"],
    },
    {
      id: "growth",
      name: "Growth",
      price: 1000,
      credits: 20000,
      emails: 30000,
      popular: true,
      features: ["20,000 credits", "~30,000 emails", "Advanced AI features", "Priority support", "Custom integrations"],
    },
    {
      id: "scale",
      name: "Scale",
      price: 2500,
      credits: 70000,
      bonus: 20000,
      emails: 105000,
      features: ["70,000 credits", "+20,000 bonus credits", "~105,000 emails", "All AI features", "Dedicated support", "Custom workflows"],
    },
  ]

  const topupOptions: TopupOption[] = [
    { id: "mini",   name: "Mini Top-up",   price: 10,  credits: 200  },
    { id: "small",  name: "Small Top-up",  price: 50,  credits: 1000 },
    { id: "medium", name: "Medium Top-up", price: 100, credits: 2000, popular: true },
    { id: "bulk",   name: "Bulk Top-up",   price: 250, credits: 5000 },
  ]

  useEffect(() => {
    api.get("/api/plans/status")
      .then(({ data }) => { if (data.success) setUserPlanInfo(data) })
      .catch(() => {})
  }, [])

  const handlePurchase = async () => {
    const isOnboarding = mode === "onboarding"
    const options = isOnboarding ? pricingTiers : topupOptions
    const selectedOption = options.find((t) => t.id === selectedTier)
    if (!selectedOption) return

    setLoading(true)
    setError(null)
    try {
      const endpoint = isOnboarding ? "/api/billing/purchase-credits" : "/api/billing/add-credits"
      const { data } = await api.post(endpoint, {
        tierId: selectedOption.id,
        amount: selectedOption.price,
        credits: selectedOption.credits,
        mode,
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
              {mode === "onboarding" ? "Choose Your Plan" : "Buy More Credits"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "onboarding" ? "1 credit = $0.05 in API costs" : "Add more credits to your existing plan"}
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
          {/* Onboarding plans */}
          {mode === "onboarding" && (
            <>
              <h3 className="text-base font-semibold mb-4">Starter Plans</h3>
              <div className="grid gap-5 mb-8 grid-cols-1 md:grid-cols-3">
                {pricingTiers.map((tier, i) => {
                  const isCurrent = currentPlan === tier.id
                  const isSelected = selectedTier === tier.id
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setSelectedTier(tier.id)}
                      className={`relative cursor-pointer rounded-xl p-6 border-2 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : isCurrent
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : "border-border bg-muted/30 hover:border-muted-foreground/40"
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
                          <span className="text-4xl font-bold">${tier.price}</span>
                          <span className="text-sm text-muted-foreground ml-1">one-time</span>
                        </div>
                        <div className="mb-5">
                          <div className="text-3xl font-bold">{tier.credits.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">credits</div>
                        </div>
                        <ul className="space-y-2.5 text-left">
                          {tier.features.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )
                })}
              </div>
              <h3 className="text-base font-semibold mb-4">Quick Top-Ups</h3>
            </>
          )}

          {/* Top-up options */}
          <div className="grid gap-4 mb-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
                      <div className="text-xs text-muted-foreground">${(tier.price / tier.credits).toFixed(3)} per credit</div>
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
          </div>

          {/* Info box */}
          <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              {mode === "onboarding" ? "How Credits Work" : "About Additional Credits"}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>1 credit = $0.05</strong> in tracked API costs (transparent pricing)</li>
              <li>• <strong>~0.67 credits per email</strong> on average (includes AI research, enrichment, validation, sending)</li>
              <li>• Credits never expire and roll over month-to-month</li>
              {mode === "topup" && <li>• <strong>Top-ups are added instantly</strong> to your current balance</li>}
              <li>• Track exact usage in real-time on your dashboard</li>
            </ul>
          </div>

          {error && (
            <div className="bg-destructive/8 border border-destructive/30 rounded-lg p-4 mb-5">
              <p className="text-sm text-destructive">Error: {error}</p>
            </div>
          )}

          <button
            onClick={handlePurchase}
            disabled={loading}
            className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </span>
            ) : (
              (() => {
                const options = mode === "onboarding" ? pricingTiers : topupOptions
                const sel = options.find((t) => t.id === selectedTier)
                return mode === "onboarding"
                  ? `Choose ${sel?.name} — ${sel?.credits.toLocaleString()} Credits for $${sel?.price}`
                  : `Add ${sel?.credits.toLocaleString()} Credits for $${sel?.price}`
              })()
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground mt-3">
            Secure payment processed by Stripe. Credits added instantly to your account.
          </p>
        </div>
      </div>
    </div>
  )
}
