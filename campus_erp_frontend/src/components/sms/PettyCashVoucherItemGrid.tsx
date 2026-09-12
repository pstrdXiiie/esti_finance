"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
import type { ChildTableSpec } from "@/lib/forms/types"
import {
  financeRowInput,
  financeRowSelect,
  financePrimaryButton,
} from "@/lib/finance-ui"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"

interface ChartOfAccountRow {
  name: string
  account_number: string
  account_name: string
}

interface EmployeeRow {
  name: string
  employee_name: string
}

export function PettyCashVoucherItemGrid({
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
  const [employeeNo, setEmployeeNo] = useState<string>("")

  const { data: accounts = [] } = useQuery({
    queryKey: ["Chart of Account", "list"],
    queryFn: () =>
      frappe.list<ChartOfAccountRow>("Chart of Account", {
        fields: ["name", "account_number", "account_name"],
        limit_page_length: 200,
      }),
  })

  const { data: employees = [] } = useQuery({
    queryKey: ["Employee", "list"],
    queryFn: () =>
      frappe.list<EmployeeRow>("Employee", {
        fields: ["name", "employee_name"],
        limit_page_length: 200,
      }),
  })

  const selectedAccount = accounts.find((a) => a.name === account)

  const total = useMemo(() => rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0), [rows])

  function addRow() {
    if (!account || !amount) return
    const next = [
      ...rows,
      {
        account,
        account_name: selectedAccount?.account_name ?? "",
        amount: Number(amount),
        employee_no: employeeNo || undefined,
      },
    ]
    onChange(next)
    setAccount("")
    setAmount("")
    setEmployeeNo("")
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <FinancePropertySection
      title="Petty Cash Voucher Items"
      right={
        rows.length > 0 ? (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
            Total ₱{total.toFixed(2)}
          </span>
        ) : undefined
      }
    >
      {rows.map((row, i) => {
        const emp = employees.find((e) => e.name === row.employee_no)
        return (
          <div
            key={i}
            className="grid grid-cols-[1fr_1fr_90px_20px] items-center gap-2 border-b border-zinc-100 py-1.5 text-[13px] last:border-b-0"
          >
            <span>
              {String(row.account ?? "")} · {String(row.account_name ?? "")}
            </span>
            <span className="text-zinc-500">
              {emp ? `${emp.name} · ${emp.employee_name}` : String(row.employee_no ?? "—")}
            </span>
            <span className="text-right font-mono">{Number(row.amount ?? 0).toFixed(2)}</span>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-center text-xs text-zinc-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )
      })}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <select
          className={`min-w-[160px] flex-1 rounded border border-zinc-200 ${financeRowSelect}`}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option value="">+ Account…</option>
          {accounts.map((a) => (
            <option key={a.name} value={a.name}>
              {a.account_number} - {a.account_name}
            </option>
          ))}
        </select>
        <select
          className={`min-w-[160px] flex-1 rounded border border-zinc-200 ${financeRowSelect}`}
          value={employeeNo}
          onChange={(e) => setEmployeeNo(e.target.value)}
        >
          <option value="">Employee (optional)…</option>
          {employees.map((e) => (
            <option key={e.name} value={e.name}>
              {e.name} - {e.employee_name}
            </option>
          ))}
        </select>
        <input
          className={`w-24 shrink-0 rounded border border-zinc-200 ${financeRowInput}`}
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
        <button type="button" className={`shrink-0 ${financePrimaryButton}`} onClick={addRow}>
          Add
        </button>
      </div>
    </FinancePropertySection>
  )
}
