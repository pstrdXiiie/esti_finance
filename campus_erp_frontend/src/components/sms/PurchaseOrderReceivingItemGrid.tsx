"use client"

import { financeRowInput } from "@/lib/finance-ui"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"

export interface ReceivingItemRow {
  item_code: string
  item_description: string
  qty_ordered: number
  qty_previously_received: number
  qty_received: number
  rate: number
}

export function PurchaseOrderReceivingItemGrid({
  rows,
  onChange,
  disabled = false,
}: {
  rows: ReceivingItemRow[]
  onChange: (rows: ReceivingItemRow[]) => void
  disabled?: boolean
}) {
  function updateReceived(index: number, value: string) {
    const remaining = rows[index].qty_ordered - rows[index].qty_previously_received
    const parsed = Number(value)
    const clamped = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, remaining))
    const next = rows.slice()
    next[index] = { ...next[index], qty_received: clamped }
    onChange(next)
  }

  return (
    <FinancePropertySection title="Receiving Orders">
      {rows.length === 0 && (
        <p className="py-4 text-center text-sm text-zinc-500">Select a PO above to load its items.</p>
      )}
      {rows.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_80px_80px_100px] gap-2 border-b border-zinc-200 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
          <span>Item</span>
          <span>Description</span>
          <span className="text-right">Ordered</span>
          <span className="text-right">Prev. Rcvd</span>
          <span className="text-right">Receiving</span>
        </div>
      )}
      {rows.map((row, i) => (
        <div
          key={row.item_code}
          className="grid grid-cols-[1fr_1fr_80px_80px_100px] items-center gap-2 border-b border-zinc-100 py-1.5 text-[13px] last:border-b-0"
        >
          <span className="font-medium text-zinc-900">{row.item_code}</span>
          <span className="text-zinc-500">{row.item_description || "—"}</span>
          <span className="text-right font-mono">{row.qty_ordered}</span>
          <span className="text-right font-mono text-zinc-500">{row.qty_previously_received}</span>
          <input
            className={`w-full rounded border border-zinc-200 text-right ${financeRowInput}`}
            type="number"
            min={0}
            max={row.qty_ordered - row.qty_previously_received}
            value={row.qty_received}
            disabled={disabled}
            onChange={(e) => updateReceived(i, e.target.value)}
          />
        </div>
      ))}
    </FinancePropertySection>
  )
}
