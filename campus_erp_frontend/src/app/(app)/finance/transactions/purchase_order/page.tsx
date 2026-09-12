"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
import { PurchaseOrderItemGrid, type PurchaseOrderItemRow } from "@/components/sms/PurchaseOrderItemGrid"
import { financeRowInput, financePrimaryButton } from "@/lib/finance-ui"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"
import { FinanceRecordTable, type FinanceRecordColumn } from "@/components/sms/FinanceRecordTable"

interface ApprovedRequisitionRow {
  name: string
  pr_date: string
  prepared_by: string
}

interface PurchaseRequisitionItemSource {
  item_code: string
  item_description: string
  quantity: number
  unit_cost: number
}

const today = () => new Date().toISOString().slice(0, 10)

const requisitionColumns: FinanceRecordColumn<ApprovedRequisitionRow>[] = [
  { key: "name", label: "Requisition", render: (r) => <span className="font-medium text-zinc-900">{r.name}</span> },
  { key: "pr_date", label: "PR Date", render: (r) => <span className="text-zinc-500">{r.pr_date}</span> },
  { key: "prepared_by", label: "Requested By", render: (r) => <span className="text-zinc-500">{r.prepared_by}</span> },
]

export default function PurchaseOrderPage() {
  const [fromPrDate, setFromPrDate] = useState("")
  const [toPrDate, setToPrDate] = useState("")

  const [selected, setSelected] = useState<ApprovedRequisitionRow | null>(null)
  const [poDate, setPoDate] = useState(today())
  const [supplier, setSupplier] = useState("")
  const [items, setItems] = useState<PurchaseOrderItemRow[]>([])
  const [remarks, setRemarks] = useState("")

  const { data: requisitions = [], isLoading } = useQuery({
    queryKey: ["SMS Purchase Requisition", "approved", fromPrDate, toPrDate],
    queryFn: () =>
      frappe.list<ApprovedRequisitionRow>("SMS Purchase Requisition", {
        fields: ["name", "pr_date", "prepared_by"],
        filters: {
          approval_status: "Approved",
          ...(fromPrDate ? { pr_date: [">=", fromPrDate] } : {}),
          ...(toPrDate ? { pr_date: ["<=", toPrDate] } : {}),
        },
        limit_page_length: 100,
      }),
  })

  const { data: sourceItems = [] } = useQuery({
    queryKey: ["SMS Purchase Requisition Item", "list", selected?.name],
    queryFn: () =>
      frappe.list<PurchaseRequisitionItemSource>("SMS Purchase Requisition Item", {
        fields: ["item_code", "item_description", "quantity", "unit_cost"],
        filters: { parent: selected?.name },
        limit_page_length: 200,
      }),
    enabled: !!selected,
  })

  const totalAmount = useMemo(() => items.reduce((sum, r) => sum + r.qty * r.rate, 0), [items])
  const canSave = selected !== null && supplier.trim() !== "" && items.length > 0

  function handleSelect(req: ApprovedRequisitionRow) {
    setSelected(req)
    setItems([])
  }

  useMemo(() => {
    if (selected && sourceItems.length > 0) {
      setItems(
        sourceItems.map((i) => ({
          item_code: i.item_code,
          item_description: i.item_description,
          qty: i.quantity,
          rate: i.unit_cost,
        }))
      )
    }
  }, [selected, sourceItems])

  function handleSave() {
    if (!selected) return
    const payload = {
      po_date: poDate,
      purchase_requisition: selected.name,
      supplier,
      items,
      total_amount: totalAmount,
      remarks,
    }
    // TODO: wire up to frappe.insert / frappe.save
    console.log(payload)
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Purchase Order</h1>
        <p className="mt-1 text-sm text-zinc-500">Create a purchase order from an approved requisition.</p>
      </div>

      <FinancePropertySection title="Filter Requisitions">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            From PR Date
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="date"
              value={fromPrDate}
              onChange={(e) => setFromPrDate(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            To PR Date
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="date"
              value={toPrDate}
              onChange={(e) => setToPrDate(e.target.value)}
            />
          </label>
        </div>
      </FinancePropertySection>

      <FinancePropertySection title="Approved Requisitions">
        <FinanceRecordTable
          columns={requisitionColumns}
          rows={requisitions}
          rowKey={(r) => r.name}
          selectedRowKey={selected?.name}
          onSelectRow={handleSelect}
          isLoading={isLoading}
          emptyMessage="No approved requisitions in this range."
        />
      </FinancePropertySection>

      <FinancePropertySection title="PO Details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            PO #
            <input
              className={`rounded border border-zinc-200 bg-zinc-50 text-zinc-500 ${financeRowInput}`}
              type="text"
              value="Assigned on save"
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            PO Date
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="date"
              value={poDate}
              onChange={(e) => setPoDate(e.target.value)}
            />
          </label>
        </div>
      </FinancePropertySection>

      <FinancePropertySection title="Requisition Reference">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Purchase Requisition
            <input
              className={`rounded border border-zinc-200 bg-zinc-50 text-zinc-500 ${financeRowInput}`}
              type="text"
              value={selected?.name ?? "Select an approved requisition above"}
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Supplier
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Link — Supplier"
              disabled={!selected}
            />
          </label>
        </div>
      </FinancePropertySection>

      <PurchaseOrderItemGrid rows={items} onChange={setItems} />

      <FinancePropertySection title="Summary">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Amount</p>
            <p className="mt-1 font-mono text-base text-zinc-900">₱{totalAmount.toFixed(2)}</p>
          </div>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Remarks / Terms
            <textarea
              className={`min-h-[56px] rounded border border-zinc-200 ${financeRowInput}`}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={!selected}
            />
          </label>
        </div>
      </FinancePropertySection>

      <div className="flex items-center justify-end gap-3">
        {!canSave && selected && (
          <span className="text-xs text-amber-700">Add a supplier and at least one item before saving.</span>
        )}
        <button type="button" className={financePrimaryButton} onClick={handleSave} disabled={!canSave}>
          Save Purchase Order
        </button>
      </div>
    </div>
  )
}
