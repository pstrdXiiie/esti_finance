"use client"

import { PendingLeavesTable } from "@/components/ui/personnel/loans/PendingLeavesTable"

/**
 * Personnel > Approvals tab. Wraps PendingLeavesTable (createApprovalTable-
 * generated) the same way LeaveApplicationsPanel wraps the employee-facing
 * submission/status view — split out per the note in LeaveApplicationsPanel.tsx
 * so Approve/Reject don't live on the employee-facing list.
 */
export function LeaveApprovalsPanel() {
  return (
    <div className="tabContent h-full! min-w-0 max-w-full rounded-md border-border">
      <PendingLeavesTable />
    </div>
  )
}

export default LeaveApprovalsPanel
