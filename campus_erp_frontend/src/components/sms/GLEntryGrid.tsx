"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
import type { ChildTableSpec } from "@/lib/forms/types"
import {
  financeRowInput,
  financeRowSelect,
  financePrimaryButton,
  financeBalanceBadge,
  financeAccentToggleOn,
  financeAccentToggleOff,
} from "@/lib/finance-ui"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"

interface ChartOfAccountRow {
  name: string
  account_number: string
  account_name: string
}

export function GLEntryGrid({
  spec,
  rows,
  onChange,
}: {
  spec: ChildTableSpec
  rows: Array<Record<string, unknown>>
  onChange: (rows: Array<Record<string, unknown>>) => void
}) {
  const [account, setAccount] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [drCr, setDrCr] = useState<"DR" | "CR">("DR")

  const { data: accounts = [] } = useQuery({
    queryKey: ["Chart of Account", "list"],
    queryFn: () =>
      frappe.list<ChartOfAccountRow>("Chart of Account", {
        fields: ["name", "account_number", "account_name"],
        limit_page_length: 200,
      }),
  })

  const selectedAccount = accounts.find((a) => a.name === account)

  const totals = useMemo(() => {
    return rows.reduce<{ debit: number; credit: number }>(
      (acc, r) => {
        acc.debit += Number(r.debit ?? 0)
        acc.credit += Number(r.credit ?? 0)
        return acc
      },
      { debit: 0, credit: 0 }
    )
  }, [rows])

  const isBalanced = rows.length > 0 && totals.debit === totals.credit

  function addRow() {
    if (!account || !amount) return
    const numAmount = Number(amount)
    const next = [
      ...rows,
      {
        account,
        account_name: selectedAccount?.account_name ?? "",
        debit: drCr === "DR" ? numAmount : 0,
        credit: drCr === "CR" ? numAmount : 0,
      },
    ]
    onChange(next)
    setAccount("")
    setAmount("")
    setDrCr("DR")
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <FinancePropertySection
      title="General Ledger Entries"
      right={
        rows.length > 0 ? (
          <span className={financeBalanceBadge(isBalanced)}>
            {isBalanced
              ? `✓ Balanced · ₱${totals.debit.toFixed(2)}`
              : `⚠ Out of balance · DR ${totals.debit.toFixed(2)} / CR ${totals.credit.toFixed(2)}`}
          </span>
        ) : undefined
      }
    >
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_90px_90px_20px] items-center border-b border-border py-1.5 text-sm last:border-b-0"
        >
          <span>
            {String(row.account ?? "")} · {String(row.account_name ?? "")}
          </span>
          <span className="text-right font-mono">
            {Number(row.debit ?? 0) > 0 ? Number(row.debit).toFixed(2) : "—"}
          </span>
          <span className="text-right font-mono">
            {Number(row.credit ?? 0) > 0 ? Number(row.credit).toFixed(2) : "—"}
          </span>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="text-center text-xs text-muted-foreground hover:text-destructive"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <select
          className={`min-w-[160px] flex-1 rounded border border-border ${financeRowSelect}`}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option value="">+ Add account…</option>
          {accounts.map((a) => (
            <option key={a.name} value={a.name}>
              {a.account_number} - {a.account_name}
            </option>
          ))}
        </select>
        <input
          className={`w-20 shrink-0 rounded border border-border ${financeRowInput}`}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
        <div className="flex shrink-0 overflow-hidden rounded border border-border">
          <button
            type="button"
            onClick={() => setDrCr("DR")}
            className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 text-xs ${drCr === "DR" ? financeAccentToggleOn : financeAccentToggleOff}`}
          >
            DR
          </button>
          <button
            type="button"
            onClick={() => setDrCr("CR")}
            className={`shrink-0 whitespace-nowrap border-l border-border px-2.5 py-1.5 text-xs ${drCr === "CR" ? financeAccentToggleOn : financeAccentToggleOff}`}
          >
            CR
          </button>
        </div>
        <button type="button" className={`shrink-0 ${financePrimaryButton}`} onClick={addRow}>
          Add
        </button>
      </div>
    </FinancePropertySection>
  )
}