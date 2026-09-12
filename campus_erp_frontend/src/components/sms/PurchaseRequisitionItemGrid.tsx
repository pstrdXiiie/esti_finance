"use client"

import { useState } from "react"

import { financeRowInput, financePrimaryButton } from "@/lib/finance-ui"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"

export interface PurchaseRequisitionItemRow {
  item_code: string
  item_description: string
  quantity: number
  unit_cost: number
  subcode: string
}

export function PurchaseRequisitionItemGrid({
  rows,
  onChange,
}: {
  rows: PurchaseRequisitionItemRow[]
  onChange: (rows: PurchaseRequisitionItemRow[]) => void
}) {
  const [itemCode, setItemCode] = useState("")
  const [description, setDescription] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [subcode, setSubcode] = useState("")

  const total = rows.reduce((sum, r) => sum + r.quantity * r.unit_cost, 0)

  function addRow() {
    const qty = Number(quantity)
    const cost = Number(unitCost)
    if (!itemCode || !qty || Number.isNaN(cost)) return
    onChange([
      ...rows,
      { item_code: itemCode, item_description: description, quantity: qty, unit_cost: cost, subcode },
    ])
    setItemCode("")
    setDescription("")
    setQuantity("")
    setUnitCost("")
    setSubcode("")
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <FinancePropertySection
      title="Requested Items"
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
          className="grid grid-cols-[1fr_1fr_60px_90px_90px_80px_20px] items-center gap-2 border-b border-zinc-100 py-1.5 text-[13px] last:border-b-0"
        >
          <span>{row.item_code}</span>
          <span className="text-zinc-500">{row.item_description || "—"}</span>
          <span className="text-right font-mono">{row.quantity}</span>
          <span className="text-right font-mono">{row.unit_cost.toFixed(2)}</span>
          <span className="text-right font-mono">{(row.quantity * row.unit_cost).toFixed(2)}</span>
          <span className="text-zinc-500">{row.subcode || "—"}</span>
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
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Qty"
        />
        <input
          className={`w-24 shrink-0 rounded border border-zinc-200 ${financeRowInput}`}
          type="number"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          placeholder="0.00"
        />
        <input
          className={`w-20 shrink-0 rounded border border-zinc-200 ${financeRowInput}`}
          type="text"
          value={subcode}
          onChange={(e) => setSubcode(e.target.value)}
          placeholder="Subcode"
        />
        <button type="button" className={`shrink-0 ${financePrimaryButton}`} onClick={addRow}>
          Add
        </button>
      </div>
    </FinancePropertySection>
  )
}
