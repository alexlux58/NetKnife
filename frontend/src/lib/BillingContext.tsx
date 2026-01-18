/**
 * Billing/subscription context: hasPro, canUseRemote for gating remote tools.
 * Fetches usage on mount. Free = local only; Pro/grandfathered = remote allowed.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { billingUsage, type BillingUsage } from './billing'

interface BillingContextValue {
  usage: BillingUsage | null
  loading: boolean
  hasPro: boolean
  canUseRemote: boolean
  refetch: () => void
}

const BillingContext = createContext<BillingContextValue | null>(null)

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [usage, setUsage] = useState<BillingUsage | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUsage = () => {
    setLoading(true)
    billingUsage()
      .then(setUsage)
      .catch(() => setUsage(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  const hasPro = !!(usage?.plan === 'pro' || usage?.isGrandfathered)
  const canUseRemote = hasPro || (usage?.limits?.remote ?? 0) > 0

  const value: BillingContextValue = {
    usage,
    loading,
    hasPro,
    canUseRemote,
    refetch: fetchUsage,
  }

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}

export function useBilling() {
  const c = useContext(BillingContext)
  return c ?? { usage: null, loading: true, hasPro: false, canUseRemote: false, refetch: () => {} }
}
