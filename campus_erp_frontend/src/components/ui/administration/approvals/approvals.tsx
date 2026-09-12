"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PendingApprovalsList } from "@/components/sms/PendingApprovalsList"
import { overtimeSpec, travelOrderSpec } from "@/lib/forms/personnel"
import { PendingLeavesTable } from "@/components/ui/personnel/loans/PendingLeavesTable"
import { LoanApprovalsPanel } from "@/components/ui/administration/approvals/LoanApprovalsPanel"

const PENDING_STATUSES = ["Pending Recommendation", "Recommended"]

/**
 * Administration > Approvals: one tab per workflow-driven doctype needing
 * recommendation/approval. Leave uses PendingLeavesTable (the
 * createApprovalTable-based approve/reject dialog, since Leave has no
 * Frappe Workflow doctype of its own — approve/reject are direct RPCs).
 * Loan Applications, Overtime, and Travel Orders are genuine Workflow
 * doctypes, so those go through each record's own Workflow Actions panel —
 * this just lists what's pending and links into it.
 */
export function PersonnelApprovals() {
    return (
        <Tabs
            defaultValue="leave-applications"
            orientation="vertical"
            className="flex-row items-stretch bg-card p-4 rounded-lg shadow-md w-full h-[85vh] border border-border"
        >
            <TabsList className="grid w-70 grid-cols-1 gap-5 border-0 bg-card mr-7 h-[50vh]! shrink-0">
                <TabsTrigger
                    value="leave-applications"
                    className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground"
                >
                    Leave Applications
                </TabsTrigger>
                <TabsTrigger
                    value="loan-applications"
                    className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground"
                >
                    Loan Applications
                </TabsTrigger>
                <TabsTrigger
                    value="overtime"
                    className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground"
                >
                    Overtime
                </TabsTrigger>
                <TabsTrigger
                    value="travel-orders"
                    className="w-full gap-2 p-3 border-border data-active:bg-primary data-active:text-primary-foreground"
                >
                    Travel Orders
                </TabsTrigger>
            </TabsList>

            <TabsContent value="leave-applications" className="mt-0 min-w-0 flex-1">
                <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                    <div className="rounded-2xl border border-border h-full p-7">
                        <PendingLeavesTable />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="loan-applications" className="mt-0 min-w-0 flex-1">
                <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                    <div className="rounded-2xl border border-border h-full p-7">
                        <LoanApprovalsPanel />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="overtime" className="mt-0 min-w-0 flex-1">
                <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                    <div className="rounded-2xl border border-border h-full p-7">
                        <PendingApprovalsList
                            spec={overtimeSpec}
                            basePath="/personnel/overtime"
                            pendingStatuses={PENDING_STATUSES}
                        />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="travel-orders" className="mt-0 min-w-0 flex-1">
                <div className="tabContent h-full! min-w-0 max-w-full overflow-y-auto rounded-md border-border">
                    <div className="rounded-2xl border border-border h-full p-7">
                        <PendingApprovalsList
                            spec={travelOrderSpec}
                            basePath="/personnel/travel-orders"
                            pendingStatuses={PENDING_STATUSES}
                        />
                    </div>
                </div>
            </TabsContent>
        </Tabs>
    )
}

export default PersonnelApprovals