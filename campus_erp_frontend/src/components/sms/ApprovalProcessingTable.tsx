"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { frappe, getErrorMessage } from "@/lib/frappe"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { SearchTable, type SearchTableColumn } from "@/components/sms/SearchTable"
import type { RecordViewField } from "@/components/sms/RecordViewDialog"

export interface ApprovableRow {
  name: string
  personnel_info: string
}

export interface ApprovalProcessingTableProps<T extends ApprovableRow, F> {
  title: string
  queryKey: string
  method: string
  emptyMessage?: string
  columns: SearchTableColumn<T>[]
  viewFields?: RecordViewField<T>[]
  viewTitle?: (row: T) => string

  dialogTitle: (row: T) => React.ReactNode
  emptyForm: F
  renderInfoGrid: (row: T) => React.ReactNode
  renderReasonPanel?: (row: T) => React.ReactNode
  MiddleSection?: React.ComponentType<{ row: T; form: F; setForm: Dispatch<SetStateAction<F>> }>
  renderDecisionFields: (form: F, setForm: Dispatch<SetStateAction<F>>) => React.ReactNode

  approveMethod: string
  rejectMethod: string
  buildApprovePayload: (row: T, form: F) => Record<string, unknown>
  buildRejectPayload: (row: T, form: F) => Record<string, unknown>
  invalidateKeys: string[]
  approveSuccessMessage?: string
  rejectSuccessMessage?: string
}

export function ApprovalProcessingTable<T extends ApprovableRow, F>({
  title,
  queryKey,
  method,
  emptyMessage = "No pending records.",
  columns,
  viewFields,
  viewTitle,
  dialogTitle,
  emptyForm,
  renderInfoGrid,
  renderReasonPanel,
  MiddleSection,
  renderDecisionFields,
  approveMethod,
  rejectMethod,
  buildApprovePayload,
  buildRejectPayload,
  invalidateKeys,
  approveSuccessMessage = "Approved",
  rejectSuccessMessage = "Rejected",
}: ApprovalProcessingTableProps<T, F>) {
  const queryClient = useQueryClient()
  const [approvingRow, setApprovingRow] = useState<T | null>(null)
  const [form, setForm] = useState<F>(emptyForm)

  const invalidate = () => {
    invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  }

  const closeDialog = () => {
    setApprovingRow(null)
    setForm(emptyForm)
  }

  const approve = useMutation({
    mutationFn: (row: T) => frappe.call(approveMethod, buildApprovePayload(row, form)),
    onSuccess: () => {
      toast.success(approveSuccessMessage)
      closeDialog()
      invalidate()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const reject = useMutation({
    mutationFn: (row: T) => frappe.call(rejectMethod, buildRejectPayload(row, form)),
    onSuccess: () => {
      toast.success(rejectSuccessMessage)
      closeDialog()
      invalidate()
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const busy = approve.isPending || reject.isPending

  const tableColumns: SearchTableColumn<T>[] = [
    ...columns,
    {
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm)
              setApprovingRow(row)
            }}
            disabled={busy}
          >
            Process
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <SearchTable<T>
        title={title}
        queryKey={queryKey}
        method={method}
        emptyMessage={emptyMessage}
        rowKey={(row) => row.name}
        viewFields={viewFields}
        viewTitle={viewTitle}
        columns={tableColumns}
      />

      <Dialog open={approvingRow !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-2xl md:max-w-4xl max-h-[90vh] overflow-y-auto p-10">
          <DialogHeader>
            <DialogTitle>{approvingRow ? dialogTitle(approvingRow) : null}</DialogTitle>
          </DialogHeader>

          {approvingRow ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  {renderInfoGrid(approvingRow)}
                </div>

                {renderReasonPanel ? renderReasonPanel(approvingRow) : null}
              </div>

              <div className="space-y-5 md:border-l md:pl-6">
                {renderDecisionFields(form, setForm)}

                {MiddleSection ? (
                  <MiddleSection row={approvingRow} form={form} setForm={setForm} />
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter className="sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => approvingRow && reject.mutate(approvingRow)}
              disabled={busy}
            >
              {reject.isPending ? "Rejecting..." : "Reject"}
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={closeDialog} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={() => approvingRow && approve.mutate(approvingRow)} disabled={busy}>
                {approve.isPending ? "Approving..." : "Approve"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
