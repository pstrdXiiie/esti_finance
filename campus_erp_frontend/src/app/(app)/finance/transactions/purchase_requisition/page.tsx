"use client"

import { useMemo, useState } from "react"

import {
  PurchaseRequisitionItemGrid,
  type PurchaseRequisitionItemRow,
} from "@/components/sms/PurchaseRequisitionItemGrid"
import { financeRowInput, financePrimaryButton } from "@/lib/finance-ui"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"

const today = () => new Date().toISOString().slice(0, 10)

export default function PurchaseRequisitionPage() {
  const [prDate, setPrDate] = useState(today())
  const [itemCode, setItemCode] = useState("")
  const [itemDescription, setItemDescription] = useState("")
  const [supplierTerms, setSupplierTerms] = useState("")
  const [supplierCode, setSupplierCode] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [itemCost, setItemCost] = useState("")
  const [items, setItems] = useState<PurchaseRequisitionItemRow[]>([])
  const [purpose, setPurpose] = useState("")
  const [preparedBy, setPreparedBy] = useState("")
  const [dateNeeded, setDateNeeded] = useState("")

  const totalAmount = useMemo(
    () => items.reduce((sum, r) => sum + r.quantity * r.unit_cost, 0),
    [items]
  )

  const canSave =
    prDate.trim() !== "" && purpose.trim() !== "" && dateNeeded.trim() !== "" && items.length > 0

  function handleSave() {
    const payload = {
      pr_date: prDate,
      item_code: itemCode,
      item_description: itemDescription,
      supplier_terms: supplierTerms,
      supplier_code: supplierCode,
      supplier_name: supplierName,
      item_cost: itemCost ? Number(itemCost) : undefined,
      items,
      purpose,
      prepared_by: preparedBy,
      total_amount: totalAmount,
      date_needed: dateNeeded,
    }
    // TODO: wire up to frappe.insert / frappe.save
    console.log(payload)
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Purchase Requisition</h1>
        <p className="mt-1 text-sm text-zinc-500">Request items for procurement.</p>
      </div>

      <FinancePropertySection title="PR Information">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            PR Number
            <input
              className={`rounded border border-zinc-200 bg-zinc-50 text-zinc-500 ${financeRowInput}`}
              type="text"
              value="Assigned on save"
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            PR Date
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="date"
              value={prDate}
              onChange={(e) => setPrDate(e.target.value)}
            />
          </label>
        </div>
      </FinancePropertySection>

      <FinancePropertySection title="Item & Supplier Information">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Item Code
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="text"
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              placeholder="Link — Item"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Item Description
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="text"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Supplier Terms
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="text"
              value={supplierTerms}
              onChange={(e) => setSupplierTerms(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Supplier Code
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="text"
              value={supplierCode}
              onChange={(e) => setSupplierCode(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Supplier Name
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Link — Supplier"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Item Cost
            <input
              className={`rounded border border-zinc-200 text-right ${financeRowInput}`}
              type="number"
              value={itemCost}
              onChange={(e) => setItemCost(e.target.value)}
            />
          </label>
        </div>
      </FinancePropertySection>

      <PurchaseRequisitionItemGrid rows={items} onChange={setItems} />

      <FinancePropertySection title="Request Information">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-zinc-500 sm:col-span-2">
            Purpose
            <textarea
              className={`min-h-[72px] rounded border border-zinc-200 ${financeRowInput}`}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Reason for this request…"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Prepared By
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="text"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Date Needed
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="date"
              value={dateNeeded}
              onChange={(e) => setDateNeeded(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Amount</p>
            <p className="mt-1 font-mono text-base text-zinc-900">₱{totalAmount.toFixed(2)}</p>
          </div>
        </div>
      </FinancePropertySection>

      <div className="flex items-center justify-end gap-3">
        {!canSave && (
          <span className="text-xs text-amber-700">
            Fill in PR Date, Purpose, Date Needed, and add at least one item.
          </span>
        )}
        <button type="button" className={financePrimaryButton} onClick={handleSave} disabled={!canSave}>
          Save Purchase Requisition
        </button>
      </div>
    </div>
  )
}
