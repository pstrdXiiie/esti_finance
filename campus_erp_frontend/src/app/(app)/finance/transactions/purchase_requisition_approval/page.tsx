"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { frappe } from "@/lib/frappe"
import { financeRowInput, financeRowSelect, financePrimaryButton } from "@/lib/finance-ui"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"
import { FinanceRecordTable, type FinanceRecordColumn } from "@/components/sms/FinanceRecordTable"

type ApprovalStatus = "Pending" | "Approved" | "Denied"

interface PurchaseRequisitionRow {
  name: string
  pr_date: string
  date_needed: string
  total_amount: number
  prepared_by: string
  purpose: string
}

const requisitionColumns: FinanceRecordColumn<PurchaseRequisitionRow>[] = [
  { key: "name", label: "Requisition", render: (r) => <span className="font-medium text-zinc-900">{r.name}</span> },
  { key: "date_needed", label: "Date Needed", render: (r) => <span className="text-zinc-500">{r.date_needed}</span> },
  { key: "total_amount", label: "Total", align: "right", render: (r) => `₱${Number(r.total_amount).toFixed(2)}` },
  { key: "prepared_by", label: "Requested By", render: (r) => <span className="text-zinc-500">{r.prepared_by}</span> },
]

export default function PurchaseRequisitionApprovalPage() {
  const [searchAll, setSearchAll] = useState(true)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selected, setSelected] = useState<PurchaseRequisitionRow | null>(null)
  const [recommendingApproval, setRecommendingApproval] = useState("")
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("Pending")
  const [approvalRemarks, setApprovalRemarks] = useState("")

  // NOTE: filtering on pr_date only — "SMS Purchase Requisition" has no
  // approval_status field of its own (that lives on the separate
  // "SMS Purchase Requisition Approval" doctype), so this currently lists
  // ALL requisitions in range, not just pending ones. Confirm whether
  // there's a status field to filter on before shipping.
  const { data: requisitions = [], isLoading } = useQuery({
    queryKey: ["SMS Purchase Requisition", "list", searchAll, dateFrom, dateTo],
    queryFn: () =>
      frappe.list<PurchaseRequisitionRow>("SMS Purchase Requisition", {
        fields: ["name", "pr_date", "date_needed", "total_amount", "prepared_by", "purpose"],
        filters: searchAll
          ? undefined
          : {
              ...(dateFrom ? { pr_date: [">=", dateFrom] } : {}),
              ...(dateTo ? { pr_date: ["<=", dateTo] } : {}),
            },
        limit_page_length: 100,
      }),
  })

  const canSave = selected !== null

  function handleSelect(req: PurchaseRequisitionRow) {
    setSelected(req)
    setRecommendingApproval("")
    setApprovalStatus("Pending")
    setApprovalRemarks("")
  }

  function handleSave() {
    if (!selected) return
    const payload = {
      purchase_requisition: selected.name,
      date_needed: selected.date_needed,
      total_amount: selected.total_amount,
      requested_by: selected.prepared_by,
      purpose: selected.purpose,
      recommending_approval: recommendingApproval,
      approval_status: approvalStatus,
      approval_remarks: approvalRemarks,
    }
    // TODO: wire up to the real approve/deny persistence call
    console.log(payload)
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Purchase Request Approval</h1>
        <p className="mt-1 text-sm text-zinc-500">Review and approve submitted purchase requisitions.</p>
      </div>

      <FinancePropertySection title="Search & Filter">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <input
              type="checkbox"
              checked={searchAll}
              onChange={(e) => setSearchAll(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Search all
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            From
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="date"
              value={dateFrom}
              disabled={searchAll}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            To
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="date"
              value={dateTo}
              disabled={searchAll}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>
      </FinancePropertySection>

      <FinancePropertySection title="Matching Requisitions">
        <FinanceRecordTable
          columns={requisitionColumns}
          rows={requisitions}
          rowKey={(r) => r.name}
          selectedRowKey={selected?.name}
          onSelectRow={handleSelect}
          isLoading={isLoading}
          emptyMessage="No requisitions match this date range."
        />
      </FinancePropertySection>

      <FinancePropertySection title="Request Details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Purchase Requisition
            <input
              className={`rounded border border-zinc-200 bg-zinc-50 text-zinc-500 ${financeRowInput}`}
              type="text"
              value={selected?.name ?? "Select a row above"}
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Date Needed
            <input
              className={`rounded border border-zinc-200 bg-zinc-50 text-zinc-500 ${financeRowInput}`}
              type="text"
              value={selected?.date_needed ?? "—"}
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Total
            <input
              className={`rounded border border-zinc-200 bg-zinc-50 text-right text-zinc-500 ${financeRowInput}`}
              type="text"
              value={selected ? `₱${Number(selected.total_amount).toFixed(2)}` : "—"}
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Requested By
            <input
              className={`rounded border border-zinc-200 bg-zinc-50 text-zinc-500 ${financeRowInput}`}
              type="text"
              value={selected?.prepared_by ?? "—"}
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500 sm:col-span-2">
            Purpose
            <textarea
              className={`min-h-[56px] rounded border border-zinc-200 bg-zinc-50 text-zinc-500 ${financeRowInput}`}
              value={selected?.purpose ?? "—"}
              readOnly
            />
          </label>
        </div>
      </FinancePropertySection>

      <FinancePropertySection title="Approval">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Recommending Approval
            <input
              className={`rounded border border-zinc-200 ${financeRowInput}`}
              type="text"
              value={recommendingApproval}
              onChange={(e) => setRecommendingApproval(e.target.value)}
              placeholder="Link — Employee"
              disabled={!selected}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Approved By
            <input
              className={`rounded border border-zinc-200 bg-zinc-50 text-zinc-500 ${financeRowInput}`}
              type="text"
              value="Assigned on approval"
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Approval Status
            <select
              className={`rounded border border-zinc-200 ${financeRowSelect}`}
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value as ApprovalStatus)}
              disabled={!selected}
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Denied">Denied</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500">
            Approval Date
            <input
              className={`rounded border border-zinc-200 bg-zinc-50 text-zinc-500 ${financeRowInput}`}
              type="text"
              value="Assigned on approval"
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-zinc-500 sm:col-span-2">
            Approval Remarks
            <textarea
              className={`min-h-[56px] rounded border border-zinc-200 ${financeRowInput}`}
              value={approvalRemarks}
              onChange={(e) => setApprovalRemarks(e.target.value)}
              disabled={!selected}
            />
          </label>
        </div>
      </FinancePropertySection>

      <div className="flex items-center justify-end gap-3">
        <button type="button" className={financePrimaryButton} onClick={handleSave} disabled={!canSave}>
          Save Approval
        </button>
      </div>
    </div>
  )
}
