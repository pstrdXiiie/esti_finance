"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { frappe, getErrorMessage } from "@/lib/frappe"
import { financeRowInput, financeRowSelect, financePrimaryButton } from "@/lib/finance-ui"
import { FinancePropertySection } from "@/components/finance/FinancePropertyPanel"
import { FinanceRecordTable, type FinanceRecordColumn } from "@/components/sms/FinanceRecordTable"

type ApprovalStatus = "Pending" | "Approved" | "Denied"

interface MaterialRequestRow {
  name: string
  transaction_date: string
  schedule_date: string
  total_amount: number
  requested_by: string
  pr_purpose: string
}

const requisitionColumns: FinanceRecordColumn<MaterialRequestRow>[] = [
  { key: "name", label: "Requisition", render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
  { key: "schedule_date", label: "Required By", render: (r) => <span className="text-muted-foreground">{r.schedule_date}</span> },
  { key: "total_amount", label: "Total", align: "right", render: (r) => `₱${Number(r.total_amount ?? 0).toFixed(2)}` },
  { key: "requested_by", label: "Requested By", render: (r) => <span className="text-muted-foreground">{r.requested_by}</span> },
]

export default function PurchaseRequisitionApprovalPage() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<MaterialRequestRow | null>(null)
  const [recommendingApproval, setRecommendingApproval] = useState("")
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("Pending")
  const [approvalRemarks, setApprovalRemarks] = useState("")

  const { data: requisitions = [], isLoading } = useQuery({
    queryKey: ["Material Request", "list", "pending-approval"],
    queryFn: () =>
      frappe.list<MaterialRequestRow>("Material Request", {
        fields: ["name", "transaction_date", "schedule_date", "total_amount", "requested_by", "pr_purpose"],
        filters: {
          material_request_type: "Purchase",
          approval_status: "Pending",
          docstatus: 0,
        },
        limit_page_length: 100,
      }),
  })

  const canSave = selected !== null

  function handleSelect(req: MaterialRequestRow) {
    setSelected(req)
    setRecommendingApproval("")
    setApprovalStatus("Pending")
    setApprovalRemarks("")
  }

  const approveMutation = useMutation({
    mutationFn: () =>
      frappe.call("campus_erp.api.finance_purchasing.approve_purchase_requisition", {
        material_request: selected?.name,
        approval_status: approvalStatus,
        recommending_approval: recommendingApproval || undefined,
        approval_remarks: approvalRemarks || undefined,
      }),
    onSuccess: () => {
      toast.success(`Requisition ${approvalStatus.toLowerCase()}`)
      queryClient.invalidateQueries({ queryKey: ["Material Request"] })
      setSelected(null)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Purchase Request Approval</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review and approve submitted purchase requisitions.</p>
      </div>

      <FinancePropertySection title="Pending Requisitions">
        <FinanceRecordTable
          columns={requisitionColumns}
          rows={requisitions}
          rowKey={(r) => r.name}
          selectedRowKey={selected?.name}
          onSelectRow={handleSelect}
          isLoading={isLoading}
          emptyMessage="No requisitions are pending approval."
        />
      </FinancePropertySection>

      <FinancePropertySection title="Request Details">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Purchase Requisition
            <input
              className={`rounded border border-border bg-muted text-muted-foreground ${financeRowInput}`}
              type="text"
              value={selected?.name ?? "Select a row above"}
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Required By
            <input
              className={`rounded border border-border bg-muted text-muted-foreground ${financeRowInput}`}
              type="text"
              value={selected?.schedule_date ?? "—"}
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Total
            <input
              className={`rounded border border-border bg-muted text-right text-muted-foreground ${financeRowInput}`}
              type="text"
              value={selected ? `₱${Number(selected.total_amount ?? 0).toFixed(2)}` : "—"}
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Requested By
            <input
              className={`rounded border border-border bg-muted text-muted-foreground ${financeRowInput}`}
              type="text"
              value={selected?.requested_by ?? "—"}
              readOnly
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
            Purpose
            <textarea
              className={`min-h-[56px] rounded border border-border bg-muted text-muted-foreground ${financeRowInput}`}
              value={selected?.pr_purpose ?? "—"}
              readOnly
            />
          </label>
        </div>
      </FinancePropertySection>

      <FinancePropertySection title="Approval">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Recommending Approval
            <input
              className={`rounded border border-border ${financeRowInput}`}
              type="text"
              value={recommendingApproval}
              onChange={(e) => setRecommendingApproval(e.target.value)}
              placeholder="Link — Employee"
              disabled={!selected}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Approval Status
            <select
              className={`rounded border border-border ${financeRowSelect}`}
              value={approvalStatus}
              onChange={(e) => setApprovalStatus(e.target.value as ApprovalStatus)}
              disabled={!selected}
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Denied">Denied</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
            Approval Remarks
            <textarea
              className={`min-h-[56px] rounded border border-border ${financeRowInput}`}
              value={approvalRemarks}
              onChange={(e) => setApprovalRemarks(e.target.value)}
              disabled={!selected}
            />
          </label>
        </div>
      </FinancePropertySection>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className={financePrimaryButton}
          onClick={() => approveMutation.mutate()}
          disabled={!canSave || approvalStatus === "Pending" || approveMutation.isPending}
        >
          {approveMutation.isPending ? "Saving…" : "Save Approval"}
        </button>
      </div>
    </div>
  )
}
