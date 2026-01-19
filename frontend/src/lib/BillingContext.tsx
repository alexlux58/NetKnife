/**
 * Billing/subscription context: hasPro, canUseRemote for gating remote tools.
 * Fetches usage on mount. Free = local only; Pro/grandfathered/superuser = remote allowed.
 * alex.lux is superuser: all access, no paywalls (even if /billing fails).
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { getUsername } from './auth'
import { billingUsage, type BillingUsage } from './billing'

const SUPERUSER_USERNAMES = ['alex.lux']

interface BillingContextValue {
  usage: BillingUsage | null
  loading: boolean
  hasPro: boolean
  canUseRemote: boolean
  isSuperuser: boolean
  refetch: () => void
}

const BillingContext = createContext<BillingContextValue | null>(null)

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [usage, setUsage] = useState<BillingUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSuperuser, setIsSuperuser] = useState(false)

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

  useEffect(() => {
    getUsername().then((u) => setIsSuperuser(SUPERUSER_USERNAMES.includes(u)))
  }, [])

  const hasPro = !!(usage?.plan === 'pro' || usage?.isGrandfathered || isSuperuser)
  const canUseRemote = hasPro || (usage?.limits?.remote ?? 0) > 0

  const value: BillingContextValue = {
    usage,
    loading,
    hasPro,
    canUseRemote,
    isSuperuser,
    refetch: fetchUsage,
  }

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}

export function useBilling() {
  const c = useContext(BillingContext)
  return c ?? { usage: null, loading: true, hasPro: false, canUseRemote: false, isSuperuser: false, refetch: () => {} }
}
