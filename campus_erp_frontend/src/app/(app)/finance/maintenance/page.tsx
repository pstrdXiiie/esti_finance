"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"

interface WalletAccountRow {
  name: string
  account_no: string
  student: string
}

/** Loose unwrap: get_wallet_balance/wallet_topup/wallet_payment may return a
 * bare number or a dict with a `balance` key — handle either without caring
 * which. */
function toBalance(value: unknown): number | null {
  if (typeof value === "number") return value
  if (value && typeof value === "object" && "balance" in (value as Record<string, unknown>)) {
    const b = (value as Record<string, unknown>).balance
    const n = Number(b)
    return Number.isNaN(n) ? null : n
  }
  return null
}

function isWalletFeatureDisabled(message: string) {
  const m = message.toLowerCase()
  return m.includes("enable_wallet") || (m.includes("wallet") && m.includes("enable"))
}

/**
 * Bespoke screen (registrar/enrollment's spirit): pick a wallet account, show
 * its live balance, and record top-ups/payments through the whitelisted
 * campus_erp.api.finance_billing.* methods. The wallet feature is gated by
 * Education Settings' "Enable Student Wallet" checkbox — rather than fetch
 * that setting separately, we just surface whatever error the backend
 * already throws when it's off.
 */
export default function Page() {
  const queryClient = useQueryClient()
  const [walletAccount, setWalletAccount] = useState("")
  const [topupAmount, setTopupAmount] = useState("")
  const [paymentAmount, setPaymentAmount] = useState("")

  const accountsQuery = useQuery({
    queryKey: ["SMS Wallet Account", "list"],
    queryFn: () =>
      frappe.list<WalletAccountRow>("SMS Wallet Account", {
        fields: ["name", "account_no", "student"],
        limit_page_length: 200,
      }),
  })

  const balanceQuery = useQuery({
    queryKey: ["wallet-balance", walletAccount],
    queryFn: () =>
      frappe.call<unknown>("campus_erp.api.finance_billing.get_wallet_balance", {
        wallet_account: walletAccount,
      }),
    enabled: !!walletAccount,
    retry: false,
  })

  function invalidateBalance() {
    queryClient.invalidateQueries({ queryKey: ["wallet-balance", walletAccount] })
  }

  const topupMutation = useMutation({
    mutationFn: () =>
      frappe.call<unknown>("campus_erp.api.finance_billing.wallet_topup", {
        wallet_account: walletAccount,
        amount: Number(topupAmount),
      }),
    onSuccess: (result) => {
      const balance = toBalance(result)
      toast.success(balance != null ? `Top-up recorded. New balance: ${balance}` : "Top-up recorded")
      setTopupAmount("")
      invalidateBalance()
    },
    onError: (error) => toast.error(`Could not record top-up: ${getErrorMessage(error)}`),
  })

  const paymentMutation = useMutation({
    mutationFn: () =>
      frappe.call<unknown>("campus_erp.api.finance_billing.wallet_payment", {
        wallet_account: walletAccount,
        amount: Number(paymentAmount),
      }),
    onSuccess: (result) => {
      const balance = toBalance(result)
      toast.success(balance != null ? `Payment recorded. New balance: ${balance}` : "Payment recorded")
      setPaymentAmount("")
      invalidateBalance()
    },
    onError: (error) => toast.error(`Could not record payment: ${getErrorMessage(error)}`),
  })

  const firstError = balanceQuery.error ?? topupMutation.error ?? paymentMutation.error
  const errorMessage = firstError ? getErrorMessage(firstError) : null
  const walletFeatureDisabled = errorMessage ? isWalletFeatureDisabled(errorMessage) : false

  return (
    <div className="grid gap-6">
      
    </div>
  )
}
