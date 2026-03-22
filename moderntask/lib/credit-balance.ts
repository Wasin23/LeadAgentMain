import api from './api'

export interface DisplayedCreditData {
  balance: number
  userPlan: any | null
  trialCredits: any | null
  planLoaded: boolean
}

export async function fetchDisplayedCreditData(): Promise<DisplayedCreditData> {
  let balance = 0
  let planLoaded = false
  let userPlan: any | null = null
  let trialCredits: any | null = null

  try {
    const { data } = await api.get('/api/plans/status')
    if (data.success) {
      userPlan = data
      balance = Number(data.credits?.remaining ?? data.plan?.remainingCredits ?? 0)
      planLoaded = true
    }
  } catch {}

  try {
    const { data } = await api.get('/api/billing/trial-credits')
    if (data.success) {
      trialCredits = data.credits ?? null
      if (!planLoaded) {
        balance = Number(data.credits?.creditsRemaining ?? 0)
      }
    }
  } catch {}

  try {
    const { data } = await api.get('/api/billing/credit-balance')
    if (data.success && !planLoaded) {
      balance += Number(data.balance ?? 0)
    }
  } catch {}

  return {
    balance: Math.round(balance),
    userPlan,
    trialCredits,
    planLoaded,
  }
}