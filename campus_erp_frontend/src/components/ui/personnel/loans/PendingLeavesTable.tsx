"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createApprovalTable } from "@/components/sms/createApprovalTable"

// Reuses the old UI exactly as-is (createApprovalTable factory, same
// columns/infoFields/dialog layout/decision-field inputs). The ONLY change
// from the old esti_erp_frontend version is the approve/reject payload keys
// below — confirmed against campus_erp/api/personnel.py, whose
// approve_leave_application/reject_leave_application expect `employee_id`
// (a Personnel Info docname despite the name), not `personnel_info`.

export interface PendingLeaveRow {
  name: string
  personnel_info: string
  employee_id: string
  employee_name: string
  department: string
  leave_type: string
  from_date: string
  to_date: string
  half_day: number
  reason: string
  date: string
  status: string
  vacation_leave: number
  sick_leave: number
}

interface ApproveFormState {
  days_approved: string
  with_pay: string
  without_pay: string
  immediate_superior: string
  hrd_head: string
}

export const PendingLeavesTable = createApprovalTable<PendingLeaveRow, ApproveFormState>({
  title: "Pending Leave Approvals",
  queryKey: "pending-leaves",
  method: "campus_erp.api.personnel.list_pending_leaves",
  emptyMessage: "No pending leave applications.",

  columns: [
    { header: "Employee", render: (row) => row.employee_name },
    { header: "Department", render: (row) => row.department },
    { header: "Leave Type", render: (row) => row.leave_type },
    { header: "Date Applied", render: (row) => row.date },
    { header: "From", render: (row) => row.from_date },
    { header: "To", render: (row) => row.to_date },
  ],

  infoFields: [
    { label: "Employee Name", render: (row) => row.employee_name },
    { label: "Employee ID", render: (row) => row.employee_id },
    { label: "Department", render: (row) => row.department },
    { label: "Status", render: (row) => row.status },
    { label: "Type of Leave", render: (row) => row.leave_type },
    { label: "Date Applied", render: (row) => row.date },
    { label: "From", render: (row) => row.from_date },
    { label: "To", render: (row) => row.to_date },
  ],

  reasonField: { render: (row) => row.reason },

  dialogTitle: (row) => `Leave Processing — ${row.employee_name}`,

  emptyForm: {
    days_approved: "",
    with_pay: "",
    without_pay: "",
    immediate_superior: "",
    hrd_head: "",
  },

  // Vacation/sick balance panel — kept from the old UI (the new backend's
  // list_pending_leaves still returns vacation_leave/sick_leave per row, so
  // this is a pure display feature, no logic to fix).
  MiddleSection: ({ row }) => (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <p className="text-xs font-semibold text-muted-foreground">Leave Credits</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Vacation Balance</div>
          <div>{row.vacation_leave}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Sick Balance</div>
          <div>{row.sick_leave}</div>
        </div>
      </div>
    </div>
  ),

  renderDecisionFields: (form, setForm) => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="days_approved">No. of Days Approved</Label>
        <Input
          id="days_approved"
          type="number"
          step="0.5"
          placeholder="0.0"
          value={form.days_approved}
          onChange={(e) => setForm((f) => ({ ...f, days_approved: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="with_pay">With Pay</Label>
          <Input
            id="with_pay"
            type="number"
            step="0.5"
            placeholder="0.0"
            value={form.with_pay}
            onChange={(e) => setForm((f) => ({ ...f, with_pay: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="without_pay">Without Pay</Label>
          <Input
            id="without_pay"
            type="number"
            step="0.5"
            placeholder="0.0"
            value={form.without_pay}
            onChange={(e) => setForm((f) => ({ ...f, without_pay: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="immediate_superior">Immediate Superior</Label>
          <Input
            id="immediate_superior"
            placeholder="Name or ID"
            value={form.immediate_superior}
            onChange={(e) => setForm((f) => ({ ...f, immediate_superior: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hrd_head">HRD Head</Label>
          <Input
            id="hrd_head"
            placeholder="Name or ID"
            value={form.hrd_head}
            onChange={(e) => setForm((f) => ({ ...f, hrd_head: e.target.value }))}
          />
        </div>
      </div>
    </div>
  ),

  approveMethod: "campus_erp.api.personnel.approve_leave_application",
  rejectMethod: "campus_erp.api.personnel.reject_leave_application",

  // FIX (only change vs. old UI): employee_id, not personnel_info, per the
  // confirmed backend signature.
  buildApprovePayload: (row, form) => ({
    employee_id: row.personnel_info,
    row_name: row.name,
    days_approved: form.days_approved ? Number(form.days_approved) : null,
    with_pay: form.with_pay ? Number(form.with_pay) : null,
    without_pay: form.without_pay ? Number(form.without_pay) : null,
    immediate_superior: form.immediate_superior || null,
    hrd_head: form.hrd_head || null,
  }),
  buildRejectPayload: (row, form) => ({
    employee_id: row.personnel_info,
    row_name: row.name,
    immediate_superior: form.immediate_superior || null,
    hrd_head: form.hrd_head || null,
  }),

  invalidateKeys: ["pending-leaves", "recent-leaves"],
  approveSuccessMessage: "Leave approved",
  rejectSuccessMessage: "Leave rejected",
})