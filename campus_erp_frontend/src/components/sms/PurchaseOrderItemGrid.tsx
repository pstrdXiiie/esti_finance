"use client"

import { useState } from "react"

import { financeRowInput, financePrimaryButton } from "@/lib/finance-ui"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"

export interface PurchaseOrderItemRow {
  item_code: string
  item_description: string
  qty: number
  rate: number
}

export function PurchaseOrderItemGrid({
  rows,
  onChange,
}: {
  rows: PurchaseOrderItemRow[]
  onChange: (rows: PurchaseOrderItemRow[]) => void
}) {
  const [itemCode, setItemCode] = useState("")
  const [description, setDescription] = useState("")
  const [qty, setQty] = useState("")
  const [rate, setRate] = useState("")

  const total = rows.reduce((sum, r) => sum + r.qty * r.rate, 0)

  function addRow() {
    const q = Number(qty)
    const r = Number(rate)
    if (!itemCode || !q || Number.isNaN(r)) return
    onChange([...rows, { item_code: itemCode, item_description: description, qty: q, rate: r }])
    setItemCode("")
    setDescription("")
    setQty("")
    setRate("")
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <FinancePropertySection
      title="Ordered Items"
      right={
        rows.length > 0 ? (
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-xs text-zinc-700">
            ₱{total.toFixed(2)} total
          </span>
        ) : undefined
      }
    >
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_1fr_60px_90px_90px_20px] items-center gap-2 border-b border-zinc-100 py-1.5 text-[13px] last:border-b-0"
        >
          <span>{row.item_code}</span>
          <span className="text-zinc-500">{row.item_description || "—"}</span>
          <span className="text-right font-mono">{row.qty}</span>
          <span className="text-right font-mono">{row.rate.toFixed(2)}</span>
          <span className="text-right font-mono">{(row.qty * row.rate).toFixed(2)}</span>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="text-center text-xs text-zinc-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <input
          className={`min-w-[120px] flex-1 rounded border border-zinc-200 ${financeRowInput}`}
          type="text"
          value={itemCode}
          onChange={(e) => setItemCode(e.target.value)}
          placeholder="Item code…"
        />
        <input
          className={`min-w-[160px] flex-1 rounded border border-zinc-200 ${financeRowInput}`}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description…"
        />
        <input
          className={`w-16 shrink-0 rounded border border-zinc-200 ${financeRowInput}`}
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Qty"
        />
        <input
          className={`w-24 shrink-0 rounded border border-zinc-200 ${financeRowInput}`}
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="0.00"
        />
        <button type="button" className={`shrink-0 ${financePrimaryButton}`} onClick={addRow}>
          Add
        </button>
      </div>
    </FinancePropertySection>
  )
}
